"""Pipeline wrapper for LCFS RAG System with retrieval capabilities"""

from typing import Dict, Any, List
from pathlib import Path
from haystack import Pipeline, Document
from haystack.components.generators import HuggingFaceLocalGenerator
from haystack.components.builders import PromptBuilder
from haystack.components.embedders import SentenceTransformersDocumentEmbedder, SentenceTransformersTextEmbedder
from haystack.components.retrievers import InMemoryEmbeddingRetriever
from haystack.components.retrievers.in_memory import InMemoryBM25Retriever
from haystack.components.joiners import DocumentJoiner
from haystack.components.preprocessors import DocumentSplitter
from haystack.components.writers import DocumentWriter
from haystack.components.rankers import TransformersSimilarityRanker
from haystack.document_stores.in_memory import InMemoryDocumentStore
from hayhooks import BasePipelineWrapper


class PipelineWrapper(BasePipelineWrapper):
    """LCFS RAG Pipeline with document retrieval capabilities"""
    
    # Configuration - Modify these values to adjust retrieval behavior
    EMBEDDING_TOP_K = 10  # How many docs from semantic search
    BM25_TOP_K = 10       # How many docs from keyword search  
    RERANKER_TOP_K = 3    # Final docs sent to LLM after reranking
    
    def __init__(self):
        super().__init__()
        self.document_store = None
    
    def setup(self) -> None:
        """Setup the LCFS RAG pipeline with document retrieval"""
        # Initialize document store
        self.document_store = InMemoryDocumentStore()
        
        # Create embedding components
        doc_embedder = SentenceTransformersDocumentEmbedder(
            model="BAAI/bge-small-en-v1.5",
            progress_bar=False
        )
        text_embedder = SentenceTransformersTextEmbedder(
            model="BAAI/bge-small-en-v1.5",
            progress_bar=False
        )
        
        # Create embedding retriever for semantic search
        embedding_retriever = InMemoryEmbeddingRetriever(
            document_store=self.document_store
        )
        
        # Create BM25 retriever for keyword-based search
        bm25_retriever = InMemoryBM25Retriever(
            document_store=self.document_store
        )
        
        # Create document joiner to combine results from both retrievers
        document_joiner = DocumentJoiner(
            join_mode="reciprocal_rank_fusion"  # Optimal for combining different retrieval methods
        )
        
        # Create reranker using BGE reranker base
        reranker = TransformersSimilarityRanker(
            model="BAAI/bge-reranker-base",
            top_k=self.RERANKER_TOP_K
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
            required_variables=["query", "documents"]
        )

        # Use Flan-T5 small optimized for complete responses
        generator = HuggingFaceLocalGenerator(
            model="google/flan-t5-small",  # 80M params, instruction-tuned
            task="text2text-generation",
            generation_kwargs={
                "max_new_tokens": 180,  # Balanced length to avoid cutoffs
                "temperature": 0.6,     # Lower temperature for more factual responses
                "do_sample": True,
                "top_p": 0.85,         # Focused sampling
                "repetition_penalty": 1.1,  # Light anti-repetition
                "length_penalty": 0.9,     # Slight preference for conciseness
                "early_stopping": True     # Stop at natural completion
            }
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

        # Connect components for hybrid retrieval with reranking
        # Embedding retrieval path
        self.pipeline.connect("text_embedder.embedding", "embedding_retriever.query_embedding")
        self.pipeline.connect("embedding_retriever.documents", "document_joiner.documents")
        
        # BM25 retrieval path
        self.pipeline.connect("bm25_retriever.documents", "document_joiner.documents")
        
        # Combined documents through reranking to generation
        self.pipeline.connect("document_joiner.documents", "reranker.documents")
        self.pipeline.connect("reranker", "prompt_builder.documents")
        self.pipeline.connect("prompt_builder", "generator")
        
        # Note: Haystack only returns final component outputs by default
        # We'll need to modify the pipeline run to capture intermediate results
        
        # Setup indexing pipeline for document processing
        indexing_pipeline = Pipeline()
        indexing_pipeline.add_component("splitter", DocumentSplitter(split_by="sentence", split_length=3))
        indexing_pipeline.add_component("doc_embedder", doc_embedder)
        indexing_pipeline.add_component("writer", DocumentWriter(document_store=self.document_store))
        
        indexing_pipeline.connect("splitter.documents", "doc_embedder.documents")
        indexing_pipeline.connect("doc_embedder.documents", "writer.documents")
        
        # Index documents
        docs = self._get_documents()
        indexing_pipeline.run({"splitter": {"documents": docs}})
    
    
    def _get_documents(self) -> List[Document]:
        """Load and return documents from the data directory"""
        documents = []
        
        # Try container path first, then local development path
        data_paths = [
            Path("/opt/data"),  # Container path (updated)
            Path(__file__).parent.parent.parent / "data"  # Local development path
        ]
        
        for data_path in data_paths:
            if data_path.exists():
                for md_file in data_path.glob("*.md"):
                    try:
                        content = md_file.read_text(encoding='utf-8')
                        doc = Document(
                            content=content,
                            meta={
                                "filename": md_file.name,
                                "source": str(md_file),
                                "type": "lcfs_knowledge"
                            }
                        )
                        documents.append(doc)
                    except Exception as e:
                        print(f"Error reading {md_file}: {e}")
                break  # Use first valid path found
        
        return documents
        
    def _is_accounting_question(self, query: str) -> bool:
        """Check if the query is related to accounting/financial topics"""
        accounting_keywords = {
            'accounting', 'finance', 'financial', 'tax', 'audit', 'bookkeeping',
            'revenue', 'expense', 'asset', 'liability', 'equity', 'balance', 'profit',
            'loss', 'depreciation', 'amortization', 'gaap', 'ifrs', 'ledger',
            'journal', 'debit', 'credit', 'cash', 'accrual', 'budget', 'cost',
            'income', 'statement', 'report', 'financial statement', 'cash flow',
            'inventory', 'receivable', 'payable', 'debt', 'investment', 'capital',
            'dividend', 'stock', 'bond', 'interest', 'loan', 'mortgage', 'insurance',
            'payroll', 'salary', 'wage', 'benefit', 'retirement', 'pension',
            'macrs', 'section 179', 'irs', 'filing', 'deduction', 'withholding'
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
                "model": "google/flan-t5-small",
                "embedding_model": "BAAI/bge-small-en-v1.5",
                "reranker_model": "BAAI/bge-reranker-base",
                "hybrid_retrieval": True,
                "reranking_enabled": True,
                "filtered_out": True,
                "config": {
                    "embedding_top_k": self.EMBEDDING_TOP_K,
                    "bm25_top_k": self.BM25_TOP_K,
                    "reranker_top_k": self.RERANKER_TOP_K
                }
            }
            
        try:
            # Run the hybrid RAG pipeline with BM25 and embedding retrieval  
            # Include intermediate outputs to see what documents are retrieved
            result = self.pipeline.run(
                data={
                    "text_embedder": {"text": query},
                    "embedding_retriever": {"top_k": self.EMBEDDING_TOP_K},
                    "bm25_retriever": {"query": query, "top_k": self.BM25_TOP_K},
                    "reranker": {"query": query, "top_k": self.RERANKER_TOP_K},
                    "prompt_builder": {"query": query}
                },
                include_outputs_from={"bm25_retriever", "embedding_retriever", "document_joiner", "reranker"}
            )
            
            # Extract results - get documents from each stage
            answer = result.get("generator", {}).get("replies", ["No response generated"])[0]
            reranked_docs = result.get("reranker", {}).get("documents", [])
            joined_docs = result.get("document_joiner", {}).get("documents", [])
            bm25_docs = result.get("bm25_retriever", {}).get("documents", [])
            embedding_docs = result.get("embedding_retriever", {}).get("documents", [])
            
            # If no documents retrieved, still try to answer but note the issue
            # TODO: Fix document retrieval issue - currently always returns 0
            # if len(reranked_docs) == 0 and len(joined_docs) == 0:
            #     answer = "I can only answer questions about accounting and financial topics. Please ask me about accounting principles, financial statements, depreciation, taxes, auditing, or other financial matters."
            
            # Format reranked context for response
            context = []
            for doc in reranked_docs:
                context.append({
                    "content": doc.content[:150] + "..." if len(doc.content) > 150 else doc.content,
                    "source": doc.meta.get("filename", "unknown"),
                    "score": getattr(doc, 'score', 0.0)
                })
            
            return {
                "answer": answer,
                "query": query,
                "context": context,
                "num_bm25_retrieved": len(bm25_docs),
                "num_embedding_retrieved": len(embedding_docs),
                "num_documents_joined": len(joined_docs),
                "num_documents_reranked": len(reranked_docs),
                "model": "google/flan-t5-small",
                "embedding_model": "BAAI/bge-small-en-v1.5",
                "reranker_model": "BAAI/bge-reranker-base",
                "hybrid_retrieval": True,
                "reranking_enabled": True,
                "config": {
                    "embedding_top_k": self.EMBEDDING_TOP_K,
                    "bm25_top_k": self.BM25_TOP_K,
                    "reranker_top_k": self.RERANKER_TOP_K
                }
            }
            
        except Exception as e:
            return {
                "error": str(e),
                "query": query,
                "answer": "Sorry, I encountered an error processing your request.",
                "rag_enabled": False
            }