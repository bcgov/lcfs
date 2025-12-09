"""LCFS RAG Pipeline - Refactored to use extracted utils."""

import os
import sys
from pathlib import Path
from typing import Dict, Any, List

# Add utils to path
utils_path = Path("/opt/utils")
sys.path.insert(0, str(utils_path))

# Import utils
from document_stores import (  # noqa: E402
    create_document_store,
    create_bm25_store,
    populate_bm25_from_vector_store,
)
from models import (  # noqa: E402
    load_text_embedder,
    load_document_embedder,
    load_reranker,
    load_ollama_generator,
    create_retrievers,
    create_document_joiner,
)
from document_processing import (  # noqa: E402
    check_for_existing_embeddings,
    load_documents_step,
    process_documents_for_indexing,
)
from openai_adapter import run_openai_chat  # noqa: E402
from config import get_env_config, get_search_config  # noqa: E402
from pipeline_builder import build_hybrid_pipeline, create_prompt_builder  # noqa: E402
from progress_logging import (
    log_header,
    log_completion,
    log_error,
    log_progress,
)  # noqa: E402
from constants import DEFAULT_SUPPORTED_FORMATS, get_collection_name  # noqa: E402

from hayhooks import BasePipelineWrapper  # noqa: E402


class PipelineWrapper(BasePipelineWrapper):
    """LCFS RAG Pipeline using extracted utils - focused on domain-specific logic."""

    def __init__(self):
        log_header("LCFS RAG Pipeline - Initializing with utils")
        super().__init__()

        # Get configuration from utils
        self.config = get_env_config()
        self.search_config = get_search_config()

        # Debug logging configuration (from environment)
        self.debug_logging = os.getenv("RAG_DEBUG_LOGGING", "false").lower() == "true"

        # LCFS-specific configuration
        self.domain_name = "LCFS"
        self.domain_description = (
            "BC's Low Carbon Fuel Standard (LCFS) regulations and related fuel policies"
        )
        self.collection_name = get_collection_name("lcfs")
        self.source_base_url = self.config.get("source_base_url")

        # LCFS-specific search parameters (override defaults for regulatory precision)
        self.search_config["relevance_threshold"] = (
            0.80  # High precision for regulations
        )

        # LCFS fallback message
        self.fallback_message = (
            "I don't have information about that topic in my LCFS knowledge base. "
            "I can only answer questions about Low Carbon Fuel Standard regulations, "
            "compliance reporting, carbon intensities, fuel pathways, credit trading, "
            "and related BC government fuel regulations. Please ask me about LCFS topics."
        )

        # LCFS-specific metadata enricher
        self.metadata_enricher = lambda meta: {
            **meta,
            "type": "lcfs_regulation",
            "domain": "lcfs",
        }

        log_completion("LCFS pipeline initialized with domain-specific configuration")

    def setup(self) -> None:
        """Setup the LCFS RAG pipeline using utils."""
        try:
            log_header("Starting LCFS RAG pipeline setup...")

            # Create document stores using utils
            log_progress("Setting up document stores...")
            self.document_store, is_persistent = create_document_store(
                store_type="auto",
                index_name=self.collection_name,
                embedding_dim=self.config["embedding_dim"],
            )
            self.bm25_store = create_bm25_store()

            # Load models using utils
            log_progress("Loading models...")
            text_embedder = load_text_embedder(self.config["embedding_model"])

            # Create retrievers using utils
            log_progress("Creating retrievers...")
            embedding_retriever, bm25_retriever = create_retrievers(
                self.document_store,
                self.bm25_store,
                self.search_config["embedding_top_k"],
                self.search_config["bm25_top_k"],
                is_persistent,
            )

            # Create document joiner using utils
            document_joiner = create_document_joiner()

            # Load reranker using utils
            reranker = load_reranker(
                self.config["reranker_model"], self.search_config["reranker_top_k"]
            )

            # Create LCFS-specific prompt template
            lcfs_template = """
You are the LCFS Digital Policy Advisor supporting the Province of British Columbia's public-facing Low Carbon Fuel Standard (LCFS) information services.

Communication standards:
- Maintain a confident, plain-language, and professional tone suitable for BC Government websites.
- Base every statement strictly on the provided LCFS regulatory context; never speculate or rely on external memory.
- Highlight concrete obligations, thresholds, timelines, and forms when they appear in the context.
- Keep responses concise and scannable using the response frame below.
- If a request is outside LCFS scope, respond with: "[FALLBACK_MESSAGE]"
- Do not fabricate citations or URLs. The platform will append verified source links automatically after your answer.

Required response frame (omit a section only when not applicable):
Summary:
- Two short bullets that capture the key LCFS takeaways.

Guidance:
1. Ordered steps or clarifying details (maximum five lines).

Recommended Actions:
- Up to three actionable next steps (use "Recommended Actions: None identified." when there are none).

Need More Help? (optional):
- Provide escalation guidance only when the user must contact LCFS support; otherwise omit this section.

LCFS context materials:
{% for document in documents %}
Source: {{ document.meta.title or document.meta.filename or document.meta.file_name or document.meta.source or "LCFS Reference" }}
----
{{ document.content }}
---
{% endfor %}

Question: {{ query }}

Answer:"""

            lcfs_template = lcfs_template.replace(
                "[FALLBACK_MESSAGE]", self.fallback_message
            )
            prompt_builder = create_prompt_builder(lcfs_template)

            # Load Ollama generator using utils
            generator = load_ollama_generator(
                self.config["ollama_model"], self.config["ollama_url"]
            )

            # Build pipeline using utils
            log_progress("Assembling pipeline...")
            self.pipeline = build_hybrid_pipeline(
                text_embedder,
                embedding_retriever,
                bm25_retriever,
                document_joiner,
                reranker,
                prompt_builder,
                generator,
            )

            # Handle document indexing using utils
            log_progress("Processing LCFS documents...")
            self._handle_document_indexing()

            log_completion("LCFS RAG pipeline setup complete and ready to serve!")

        except Exception as e:
            log_error(f"LCFS pipeline setup failed: {e}")
            raise

    def _handle_document_indexing(self):
        """Handle LCFS document indexing using utils."""
        try:
            # Check existing embeddings using utils
            existing_count = check_for_existing_embeddings(self.document_store)

            if existing_count > 0:
                # Populate BM25 from existing using utils
                populate_bm25_from_vector_store(self.bm25_store, self.document_store)
                log_completion(
                    "LCFS document processing complete - using existing embeddings"
                )
                return

            # Load LCFS documents using utils
            docs = load_documents_step(
                supported_formats=DEFAULT_SUPPORTED_FORMATS,
                metadata_enricher=self.metadata_enricher,
            )

            if docs:
                # Create document embedder for indexing
                document_embedder = load_document_embedder(
                    self.config["embedding_model"]
                )

                # Process documents using utils (only pass splitting params)
                chunk_count = process_documents_for_indexing(
                    docs,
                    document_embedder,
                    self.document_store,
                    self.bm25_store,
                    split_by=self.config.get("split_by", "word"),
                    split_length=self.config.get("split_length", 100),
                    split_overlap=self.config.get("split_overlap", 20),
                    split_threshold=self.config.get("split_threshold", 3),
                )

                log_completion(
                    f"LCFS document indexing complete - indexed {chunk_count} chunks"
                )
            else:
                log_completion(
                    "LCFS document processing complete - no documents to index"
                )

        except Exception as e:
            log_error(f"LCFS document indexing failed: {e}")
            # Don't raise - indexing failure shouldn't break pipeline

    def run_api(self, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """Process OpenAI-format chat messages using utils."""
        try:
            return run_openai_chat(
                self.pipeline,
                messages,
                self.search_config["embedding_top_k"],
                self.search_config["bm25_top_k"],
                self.search_config["relevance_threshold"],
                self.fallback_message,
                "lcfs-rag",
                debug_logging=self.debug_logging,
                doc_base_url=self.source_base_url,
                append_sources_to_answer=False,
            )
        except Exception as e:
            log_error(f"LCFS chat processing failed: {e}")
            raise

    def _get_lcfs_terms(self) -> List[str]:
        """Return list of LCFS-related terms for reference (domain-specific logic)."""
        return [
            "lcfs",
            "low carbon fuel",
            "carbon intensity",
            "fuel pathway",
            "credit",
            "compliance",
            "reporting",
            "regulation",
            "fuel standard",
            "emissions",
            "ghg",
            "greenhouse gas",
            "biofuel",
            "renewable",
            "ethanol",
            "biodiesel",
            "hydrogen",
            "electric",
            "cng",
            "lng",
            "aviation fuel",
            "marine fuel",
            "allocation",
            "transfer",
            "penalty",
            "exemption",
            "supplier",
            "fuel supply",
            "carbon",
            "energy",
            "transportation",
            "fuel",
            "diesel",
            "gasoline",
            "rlcf",
            "bulletin",
            "ghgenius",
            "proxy",
            "ci value",
            "fuel pool",
        ]
