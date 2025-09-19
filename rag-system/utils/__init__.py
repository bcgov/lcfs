"""RAG System Utilities - Reusable components for building domain-specific RAG pipelines."""

from .document_stores import create_document_store
from .models import load_text_embedder, load_document_embedder, load_reranker
from .document_processing import load_documents, process_documents_for_indexing
from .openai_adapter import run_openai_chat, estimate_tokens
from .config import get_env_config
from .progress_logging import log_progress, log_error, log_success
from .pipeline_builder import build_hybrid_pipeline

__version__ = "1.0.0"
__all__ = [
    "create_document_store",
    "load_text_embedder",
    "load_document_embedder",
    "load_reranker",
    "load_documents",
    "process_documents_for_indexing",
    "run_openai_chat",
    "estimate_tokens",
    "get_env_config",
    "log_progress",
    "log_error",
    "log_success",
    "build_hybrid_pipeline"
]