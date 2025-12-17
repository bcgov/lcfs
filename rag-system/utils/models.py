"""Model loading utilities for embedders, rerankers, and generators."""

import os
from typing import Optional, Dict, Any

try:
    from .progress_logging import log_progress, log_error, log_success, log_subsection
except ImportError:
    from progress_logging import log_progress, log_error, log_success, log_subsection


def load_text_embedder(
    model_name: Optional[str] = None, progress_bar: bool = True, **kwargs
) -> object:
    """
    Load a text embedder for query processing.

    Args:
        model_name: Model name/path (defaults to EMBEDDING_MODEL env var)
        progress_bar: Whether to show progress bar during loading
        **kwargs: Additional arguments for the embedder

    Returns:
        Configured SentenceTransformersTextEmbedder instance

    Raises:
        Exception: If model loading fails
    """
    model_name = model_name or os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")

    log_progress(f"Loading {model_name} embedding model for queries...")
    log_subsection("Creating SentenceTransformersTextEmbedder for query processing...")

    try:
        from haystack.components.embedders import SentenceTransformersTextEmbedder

        embedder = SentenceTransformersTextEmbedder(
            model=model_name, progress_bar=progress_bar, **kwargs
        )

        log_success("Text embedder loaded")
        return embedder

    except Exception as e:
        log_error(f"Failed to load text embedder: {e}")
        raise


def load_document_embedder(
    model_name: Optional[str] = None,
    progress_bar: bool = True,
    warm_up: bool = True,
    **kwargs,
) -> object:
    """
    Load a document embedder for indexing.

    Args:
        model_name: Model name/path (defaults to EMBEDDING_MODEL env var)
        progress_bar: Whether to show progress bar during loading
        warm_up: Whether to warm up the model after loading
        **kwargs: Additional arguments for the embedder

    Returns:
        Configured SentenceTransformersDocumentEmbedder instance

    Raises:
        Exception: If model loading fails
    """
    model_name = model_name or os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")

    log_progress(f"Loading {model_name} for document indexing...")

    try:
        from haystack.components.embedders import SentenceTransformersDocumentEmbedder

        embedder = SentenceTransformersDocumentEmbedder(
            model=model_name, progress_bar=progress_bar, **kwargs
        )

        if warm_up:
            log_subsection("Warming up document embedder...")
            embedder.warm_up()

        log_success("Document embedder loaded")
        return embedder

    except Exception as e:
        log_error(f"Failed to load document embedder: {e}")
        raise


def load_reranker(model_name: Optional[str] = None, top_k: int = 2, **kwargs) -> object:
    """
    Load a reranker model for improving search results.

    Args:
        model_name: Model name/path (defaults to RERANKER_MODEL env var)
        top_k: Number of top results to return after reranking
        **kwargs: Additional arguments for the reranker

    Returns:
        Configured SentenceTransformersSimilarityRanker instance

    Raises:
        Exception: If model loading fails
    """
    model_name = model_name or os.getenv(
        "RERANKER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2"
    )

    log_progress(f"Loading {model_name} reranker model...")
    log_subsection("This may take 1-2 minutes on first run to download (~80MB)")
    log_subsection("Creating SentenceTransformersSimilarityRanker...")

    try:
        from haystack.components.rankers import SentenceTransformersSimilarityRanker

        reranker = SentenceTransformersSimilarityRanker(
            model=model_name, top_k=top_k, **kwargs
        )

        log_success("Reranker model loaded successfully")
        return reranker

    except Exception as e:
        log_error(f"Error loading reranker: {e}")
        raise


def load_ollama_generator(
    model_name: Optional[str] = None,
    url: Optional[str] = None,
    generation_kwargs: Optional[Dict[str, Any]] = None,
    **kwargs,
) -> object:
    """
    Load an Ollama generator for text generation.

    Args:
        model_name: Model name (defaults to OLLAMA_MODEL env var)
        url: Ollama server URL (defaults to OLLAMA_URL env var)
        generation_kwargs: Generation parameters
        **kwargs: Additional arguments for the generator

    Returns:
        Configured OllamaGenerator instance

    Raises:
        Exception: If generator initialization fails
    """
    model_name = model_name or os.getenv("OLLAMA_MODEL", "smollm2:135m")
    url = url or os.getenv("OLLAMA_URL", "http://ollama:11434")

    if generation_kwargs is None:
        generation_kwargs = {
            "num_predict": 420,  # Trim max tokens to cut generation time ~30%
            "temperature": 0.22,  # Slightly higher for quicker convergence but still steady
            "top_p": 0.9,  # Focused sampling for regulatory tone
            "top_k": 30,  # Smaller candidate list reduces per-token latency
            "repeat_penalty": 1.18,  # Keep structure without looping
            "num_ctx": 1536,  # Smaller context window = faster decoding
            "num_thread": 4,  # Use all available CPU threads in container
        }

    log_progress(f"Initializing Ollama generator with model: {model_name}")
    log_subsection(f"Connecting to Ollama at: {url}")

    try:
        from haystack_integrations.components.generators.ollama import OllamaGenerator

        generator = OllamaGenerator(
            model=model_name, url=url, generation_kwargs=generation_kwargs, **kwargs
        )

        log_success("Ollama generator initialized successfully")
        return generator

    except Exception as e:
        log_error(f"Error initializing Ollama generator: {e}")
        raise


def create_retrievers(
    embedding_store: object,
    bm25_store: object,
    embedding_top_k: int = 3,
    bm25_top_k: int = 3,
    use_qdrant: bool = True,
) -> tuple:
    """
    Create embedding and BM25 retrievers.

    Args:
        embedding_store: Document store for embeddings
        bm25_store: Document store for BM25 search
        embedding_top_k: Number of results from embedding search
        bm25_top_k: Number of results from BM25 search
        use_qdrant: Whether using Qdrant (affects retriever type)

    Returns:
        Tuple of (embedding_retriever, bm25_retriever)
    """
    log_progress("Creating embedding retriever...")

    if use_qdrant:
        from haystack_integrations.components.retrievers.qdrant import (
            QdrantEmbeddingRetriever,
        )

        embedding_retriever = QdrantEmbeddingRetriever(document_store=embedding_store)
        log_success("QdrantEmbeddingRetriever created")
    else:
        from haystack.components.retrievers import InMemoryEmbeddingRetriever

        embedding_retriever = InMemoryEmbeddingRetriever(document_store=embedding_store)
        log_success("InMemoryEmbeddingRetriever created")

    log_progress("Creating BM25 retriever for keyword search...")
    from haystack.components.retrievers.in_memory import InMemoryBM25Retriever

    bm25_retriever = InMemoryBM25Retriever(document_store=bm25_store)
    log_success("BM25 retriever created")

    return embedding_retriever, bm25_retriever


def create_document_joiner(join_mode: str = "reciprocal_rank_fusion") -> object:
    """
    Create a document joiner for combining retriever results.

    Args:
        join_mode: How to combine documents from multiple retrievers

    Returns:
        Configured DocumentJoiner instance
    """
    log_progress("Creating document joiner for hybrid search...")

    from haystack.components.joiners import DocumentJoiner

    joiner = DocumentJoiner(join_mode=join_mode)

    log_success("Document joiner created")
    return joiner
