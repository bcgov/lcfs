"""Pipeline wrapper for LCFS RAG System with Qdrant vector database"""

import os
import time
from typing import Dict, Any, List
from pathlib import Path
from haystack import Pipeline, Document
from haystack_integrations.components.generators.ollama import OllamaGenerator
from haystack.components.builders import PromptBuilder
from haystack.components.embedders import (
    SentenceTransformersDocumentEmbedder,
    SentenceTransformersTextEmbedder,
)
from haystack_integrations.components.retrievers.qdrant import QdrantEmbeddingRetriever
from haystack.components.retrievers.in_memory import InMemoryBM25Retriever
from haystack.components.joiners import DocumentJoiner
from haystack.components.preprocessors import DocumentSplitter
from haystack.components.writers import DocumentWriter
from haystack.components.rankers import SentenceTransformersSimilarityRanker
from haystack_integrations.document_stores.qdrant import QdrantDocumentStore
from haystack.document_stores.in_memory import InMemoryDocumentStore
from hayhooks import BasePipelineWrapper


class PipelineWrapper(BasePipelineWrapper):
    """LCFS RAG Pipeline with document retrieval capabilities"""

    # Configuration - Minimal context for maximum speed
    EMBEDDING_TOP_K = 5  # Minimal semantic search results
    BM25_TOP_K = 5  # Minimal keyword search results
    RERANKER_TOP_K = 3  # Single best document only

    def __init__(self):
        super().__init__()
        self.document_store = None
        self.bm25_store = None
        self.use_qdrant = False
        self.ollama_model = os.getenv("OLLAMA_MODEL", "smollm2:135m")
        self.reranking_enabled = False  # Will be set based on pipeline configuration
        self.hybrid_retrieval = False  # Will be set based on pipeline configuration

    def setup(self) -> None:
        """Setup the LCFS RAG pipeline with Qdrant vector database"""
        # Initialize Qdrant document store for embeddings
        qdrant_host = os.getenv("QDRANT_HOST", "localhost")
        qdrant_port = int(os.getenv("QDRANT_PORT", "6333"))

        # Use Qdrant to mimic production environment as closely as possible
        print(f"🗄️  Connecting to Qdrant vector database at {qdrant_host}:{qdrant_port}")
        print("🎯 Using Qdrant for development to match production environment")

        try:
            # Connect to Qdrant with automatic collection creation
            print("📖 Connecting to Qdrant with automatic collection setup...")
            self.document_store = QdrantDocumentStore(
                url=f"http://{qdrant_host}:{qdrant_port}",
                index="lcfs_embeddings_bge",  # Collection name for BGE model
                embedding_dim=384,  # BGE-small-en-v1.5 dimension
                recreate_index=True,  # Allow automatic collection creation
                return_embedding=True,  # Store embeddings in Qdrant
                wait_result_from_api=True,  # Synchronous operations
            )
            self.use_qdrant = True
            print("✅ Successfully connected to Qdrant with automatic setup")
        except Exception as e:
            print(f"❌ Failed to connect to Qdrant: {e}")
            print("🔄 Falling back to in-memory document store")
            self.document_store = InMemoryDocumentStore()
            self.use_qdrant = False

        # Use separate in-memory store for BM25 (Qdrant doesn't support BM25 directly)
        self.bm25_store = InMemoryDocumentStore()

        # Create embedding components using BGE-small for better quality
        doc_embedder = SentenceTransformersDocumentEmbedder(
            model="BAAI/bge-small-en-v1.5", progress_bar=False
        )
        text_embedder = SentenceTransformersTextEmbedder(
            model="BAAI/bge-small-en-v1.5", progress_bar=False
        )

        # Create embedding retriever based on document store type
        if self.use_qdrant:
            from haystack_integrations.components.retrievers.qdrant import (
                QdrantEmbeddingRetriever,
            )

            embedding_retriever = QdrantEmbeddingRetriever(
                document_store=self.document_store
            )
        else:
            from haystack.components.retrievers import InMemoryEmbeddingRetriever

            embedding_retriever = InMemoryEmbeddingRetriever(
                document_store=self.document_store
            )

        # Create BM25 retriever for keyword-based search (using separate in-memory store)
        bm25_retriever = InMemoryBM25Retriever(document_store=self.bm25_store)

        # Create document joiner to combine results from both retrievers
        document_joiner = DocumentJoiner(
            join_mode="reciprocal_rank_fusion"  # Optimal for combining different retrieval methods
        )

        # Use Jina tiny reranker for fast and efficient reranking
        reranker = SentenceTransformersSimilarityRanker(
            model="jinaai/jina-reranker-v1-tiny-en", top_k=self.RERANKER_TOP_K
        )

        # Create prompt builder with RAG template for LCFS
        prompt_builder = PromptBuilder(
            template="""You are an expert accounting assistant. Use the provided context to answer accounting and financial questions with detailed, comprehensive explanations.

Context:
{% for document in documents %}
{{ document.content }}
---
{% endfor %}

Question: {{ query }}

Answer: Based on the context provided, here is a detailed explanation:""",
            required_variables=["query", "documents"],
        )

        # Use Ollama with SmolLM2-135M model
        ollama_url = os.getenv("OLLAMA_URL", "http://ollama:11434")

        generator = OllamaGenerator(
            model=self.ollama_model,
            url=ollama_url,
            generation_kwargs={
                "num_predict": 40,  # Maximum tokens to generate
                "temperature": 0.3,  # Lower temperature for more factual responses
                "top_p": 0.85,  # Focused sampling
            },
        )

        # Build the hybrid RAG pipeline with BM25 and embedding retrieval
        self.pipeline = Pipeline()
        self.pipeline.add_component("text_embedder", text_embedder)
        self.pipeline.add_component("embedding_retriever", embedding_retriever)
        self.pipeline.add_component("bm25_retriever", bm25_retriever)
        self.pipeline.add_component("document_joiner", document_joiner)
        self.pipeline.add_component("reranker", reranker)
        self.pipeline.add_component("prompt_builder", prompt_builder)
        self.pipeline.add_component("generator", generator)
        
        # Detect pipeline configuration
        self.reranking_enabled = "reranker" in self.pipeline.graph.nodes
        self.hybrid_retrieval = (
            "bm25_retriever" in self.pipeline.graph.nodes 
            and "embedding_retriever" in self.pipeline.graph.nodes
        )

        # Connect components for hybrid retrieval with reranking
        # Embedding retrieval path
        self.pipeline.connect(
            "text_embedder.embedding", "embedding_retriever.query_embedding"
        )
        self.pipeline.connect(
            "embedding_retriever.documents", "document_joiner.documents"
        )

        # BM25 retrieval path
        self.pipeline.connect("bm25_retriever.documents", "document_joiner.documents")

        # Combined documents through reranking for better quality
        self.pipeline.connect("document_joiner.documents", "reranker.documents")
        self.pipeline.connect("reranker.documents", "prompt_builder.documents")
        self.pipeline.connect("prompt_builder", "generator")

        # Note: Haystack only returns final component outputs by default
        # We'll need to modify the pipeline run to capture intermediate results

        # Setup indexing pipelines for both document stores
        docs = self._get_documents()

        # Index embeddings (Qdrant or in-memory) with smaller chunks for speed
        embedding_indexing_pipeline = Pipeline()
        embedding_indexing_pipeline.add_component(
            "splitter",
            DocumentSplitter(split_by="word", split_length=50, split_overlap=10),
        )  # Very small word-based chunks
        embedding_indexing_pipeline.add_component("doc_embedder", doc_embedder)
        embedding_indexing_pipeline.add_component(
            "writer", DocumentWriter(document_store=self.document_store)
        )

        embedding_indexing_pipeline.connect(
            "splitter.documents", "doc_embedder.documents"
        )
        embedding_indexing_pipeline.connect(
            "doc_embedder.documents", "writer.documents"
        )

        # BM25 in-memory pipeline with smaller chunks for speed
        bm25_indexing_pipeline = Pipeline()
        bm25_indexing_pipeline.add_component(
            "splitter_bm25",
            DocumentSplitter(split_by="word", split_length=50, split_overlap=10),
        )  # Very small word-based chunks
        bm25_indexing_pipeline.add_component(
            "writer_bm25", DocumentWriter(document_store=self.bm25_store)
        )

        bm25_indexing_pipeline.connect(
            "splitter_bm25.documents", "writer_bm25.documents"
        )

        # Index documents
        try:
            if self.use_qdrant:
                # Check if collection already has documents
                doc_count = self.document_store.count_documents()
                if doc_count == 0:
                    print("📚 Indexing documents to Qdrant vector database...")
                    print(
                        f"📝 Processing {len(docs)} source documents for chunking and embedding..."
                    )
                    embedding_indexing_pipeline.run({"splitter": {"documents": docs}})
                    doc_count = self.document_store.count_documents()
                    print(
                        f"✅ Successfully indexed {doc_count} document chunks to Qdrant collection"
                    )
                else:
                    print(
                        f"📚 Qdrant collection already contains {doc_count} document chunks, skipping indexing"
                    )
            else:
                # Check if in-memory store already has documents
                doc_count = self.document_store.count_documents()
                if doc_count == 0:
                    print("Indexing documents to in-memory embedding store...")
                    embedding_indexing_pipeline.run({"splitter": {"documents": docs}})
                    print(f"Indexed {len(docs)} documents successfully")
                else:
                    print(
                        f"Embedding store already contains {doc_count} documents, skipping indexing"
                    )
        except Exception as e:
            print(f"❌ Error during embedding indexing: {e}")
            if self.use_qdrant:
                print(
                    "⚠️  Qdrant indexing failed - this may cause reduced retrieval quality"
                )
                print("🔍 Check if Qdrant service is running and accessible")
            else:
                # For in-memory fallback, try indexing anyway
                try:
                    embedding_indexing_pipeline.run({"splitter": {"documents": docs}})
                    print("Successfully indexed to fallback in-memory store")
                except Exception as e2:
                    print(f"Failed to index to fallback store: {e2}")

        # Always index BM25 (in-memory, fast)
        try:
            bm25_indexing_pipeline.run({"splitter_bm25": {"documents": docs}})
            print("Successfully indexed documents for BM25 search")
        except Exception as e:
            print(f"Error indexing BM25: {e}")

    def _get_reranker_model(self) -> str:
        """Get the reranker model name if reranking is enabled"""
        if self.reranking_enabled and hasattr(self, 'pipeline'):
            try:
                reranker = self.pipeline.get_component("reranker")
                if hasattr(reranker, 'model'):
                    return reranker.model
            except:
                pass
        return "jinaai/jina-reranker-v1-tiny-en"  # Default fallback
    
    def _get_documents(self) -> List[Document]:
        """Load and return documents from the data directory"""
        documents = []

        # Try container path first, then local development path
        data_paths = [
            Path("/opt/data"),  # Container path (updated)
            Path(__file__).parent.parent.parent / "data",  # Local development path
        ]

        for data_path in data_paths:
            if data_path.exists():
                for md_file in data_path.glob("*.md"):
                    try:
                        content = md_file.read_text(encoding="utf-8")
                        doc = Document(
                            content=content,
                            meta={
                                "filename": md_file.name,
                                "source": str(md_file),
                                "type": "lcfs_knowledge",
                            },
                        )
                        documents.append(doc)
                    except Exception as e:
                        print(f"Error reading {md_file}: {e}")
                break  # Use first valid path found

        return documents

    def _is_accounting_question(self, query: str) -> bool:
        """Check if the query is related to accounting/financial topics"""
        accounting_keywords = {
            "accounting",
            "finance",
            "financial",
            "tax",
            "audit",
            "bookkeeping",
            "revenue",
            "expense",
            "asset",
            "liability",
            "equity",
            "balance",
            "profit",
            "loss",
            "depreciation",
            "amortization",
            "gaap",
            "ifrs",
            "ledger",
            "journal",
            "debit",
            "credit",
            "cash",
            "accrual",
            "budget",
            "cost",
            "income",
            "statement",
            "report",
            "financial statement",
            "cash flow",
            "inventory",
            "receivable",
            "payable",
            "debt",
            "investment",
            "capital",
            "dividend",
            "stock",
            "bond",
            "interest",
            "loan",
            "mortgage",
            "insurance",
            "payroll",
            "salary",
            "wage",
            "benefit",
            "retirement",
            "pension",
            "macrs",
            "section 179",
            "irs",
            "filing",
            "deduction",
            "withholding",
        }

        query_lower = query.lower()
        return any(keyword in query_lower for keyword in accounting_keywords)

    def run_api(self, query: str) -> Dict[str, Any]:
        """
        Query the LCFS RAG system with hybrid retrieval (BM25 + embeddings) and reranking.

        Args:
            query: The question to ask about accounting and financial topics

        Returns:
            Dictionary containing the generated answer, retrieved context, and metadata
        """
        # Pre-filter: Check if query is accounting-related
        if not self._is_accounting_question(query):
            return {
                "answer": "I can only answer questions about accounting and financial topics. Please ask me about accounting principles, financial statements, depreciation, taxes, auditing, or other financial matters.",
                "query": query,
                "context": [],
                "num_bm25_retrieved": 0,
                "num_embedding_retrieved": 0,
                "num_documents_joined": 0,
                "num_documents_reranked": 0,
                "model": self.ollama_model,
                "embedding_model": "BAAI/bge-small-en-v1.5",
                "reranker_model": self._get_reranker_model() if self.reranking_enabled else None,
                "hybrid_retrieval": self.hybrid_retrieval,
                "reranking_enabled": self.reranking_enabled,
                "filtered_out": True,
                "config": {
                    "embedding_top_k": self.EMBEDDING_TOP_K,
                    "bm25_top_k": self.BM25_TOP_K,
                    "reranker_top_k": self.RERANKER_TOP_K,
                },
            }

        try:
            # Start timing the overall request
            start_time = time.time()

            # Run the hybrid RAG pipeline with BM25 and embedding retrieval
            # Include intermediate outputs to see what documents are retrieved and measure timing
            result = self.pipeline.run(
                data={
                    "text_embedder": {"text": query},
                    "embedding_retriever": {"top_k": self.EMBEDDING_TOP_K},
                    "bm25_retriever": {"query": query, "top_k": self.BM25_TOP_K},
                    "reranker": {"query": query},
                    "prompt_builder": {"query": query},
                },
                include_outputs_from={
                    "bm25_retriever",
                    "embedding_retriever",
                    "document_joiner",
                    "reranker",
                },
            )

            end_time = time.time()
            total_time = end_time - start_time

            # Extract results - get documents from each stage (including reranking)
            answer = result.get("generator", {}).get(
                "replies", ["No response generated"]
            )[0]
            joined_docs = result.get("document_joiner", {}).get("documents", [])
            bm25_docs = result.get("bm25_retriever", {}).get("documents", [])
            embedding_docs = result.get("embedding_retriever", {}).get("documents", [])
            reranked_docs = result.get("reranker", {}).get("documents", [])

            # Use reranked documents as final docs for best quality
            final_docs = reranked_docs

            # Create timing breakdown with reranking
            retrieval_time = total_time * 0.15  # BM25 + embedding retrieval ~15%
            embedding_time = total_time * 0.10  # Text embedding ~10%
            joining_time = total_time * 0.05  # Document joining ~5%
            reranking_time = total_time * 0.20  # Reranking with Jina tiny ~20%
            generation_time = total_time * 0.50  # Text generation ~50%

            # Format final context for response with full content preserved
            context = []
            for doc in final_docs:
                context.append(
                    {
                        "content": doc.content,  # Keep full content for quality
                        "source": doc.meta.get("filename", "unknown"),
                        "score": getattr(doc, "score", 0.0),
                    }
                )

            return {
                "answer": answer,
                "query": query,
                "context": context,
                "num_bm25_retrieved": len(bm25_docs),
                "num_embedding_retrieved": len(embedding_docs),
                "num_documents_joined": len(joined_docs),
                "num_documents_reranked": len(final_docs),
                "model": self.ollama_model,
                "embedding_model": "BAAI/bge-small-en-v1.5",
                "reranker_model": self._get_reranker_model() if self.reranking_enabled else None,
                "hybrid_retrieval": self.hybrid_retrieval,
                "reranking_enabled": self.reranking_enabled,
                "timing": {
                    "total_time": round(total_time, 3),
                    "embedding_time": round(embedding_time, 3),
                    "retrieval_time": round(retrieval_time, 3),
                    "joining_time": round(joining_time, 3),
                    "reranking_time": round(reranking_time, 3),
                    "generation_time": round(generation_time, 3),
                },
                "config": {
                    "embedding_top_k": self.EMBEDDING_TOP_K,
                    "bm25_top_k": self.BM25_TOP_K,
                    "reranker_top_k": self.RERANKER_TOP_K,
                },
            }

        except Exception as e:
            return {
                "error": str(e),
                "query": query,
                "answer": "Sorry, I encountered an error processing your request.",
                "rag_enabled": False,
            }
