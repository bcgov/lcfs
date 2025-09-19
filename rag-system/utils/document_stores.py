"""Document store creation and management utilities."""

import os
from typing import Tuple, Optional, Union
try:
    from .progress_logging import log_progress, log_error, log_success
except ImportError:
    from progress_logging import log_progress, log_error, log_success


def create_document_store(
    store_type: str = "auto",
    qdrant_host: Optional[str] = None,
    qdrant_port: Optional[int] = None,
    index_name: str = "embeddings",
    embedding_dim: int = 384,
    recreate_index: bool = False,
    return_embedding: bool = True,
    wait_result_from_api: bool = True
) -> Tuple[object, bool]:
    """
    Create a document store with automatic fallback.

    Args:
        store_type: "qdrant", "memory", or "auto" (try Qdrant first, fallback to memory)
        qdrant_host: Qdrant host (defaults to QDRANT_HOST env var or localhost)
        qdrant_port: Qdrant port (defaults to QDRANT_PORT env var or 6333)
        index_name: Collection/index name
        embedding_dim: Embedding dimensions
        recreate_index: Whether to recreate the index if it exists
        return_embedding: Whether to store embeddings in the store
        wait_result_from_api: Whether to wait for API responses

    Returns:
        Tuple of (document_store, is_persistent)
        is_persistent indicates if the store persists data between restarts
    """

    # Get connection details
    qdrant_host = qdrant_host or os.getenv("QDRANT_HOST", "localhost")
    qdrant_port = qdrant_port or int(os.getenv("QDRANT_PORT", "6333"))

    if store_type in ("qdrant", "auto"):
        try:
            log_progress(f"Connecting to Qdrant vector database at {qdrant_host}:{qdrant_port}")

            from haystack_integrations.document_stores.qdrant import QdrantDocumentStore

            log_progress("Creating QdrantDocumentStore...")
            document_store = QdrantDocumentStore(
                url=f"http://{qdrant_host}:{qdrant_port}",
                index=index_name,
                embedding_dim=embedding_dim,
                recreate_index=recreate_index,
                return_embedding=return_embedding,
                wait_result_from_api=wait_result_from_api,
            )

            log_success("Successfully connected to Qdrant")
            return document_store, True

        except Exception as e:
            if store_type == "qdrant":
                # If specifically requested Qdrant, don't fallback
                log_error(f"Failed to connect to Qdrant: {e}")
                raise
            else:
                # Auto mode - fallback to memory
                log_error(f"Failed to connect to Qdrant: {e}")
                log_progress("Falling back to in-memory document store")

    # Create in-memory store (fallback or explicitly requested)
    if store_type in ("memory", "auto"):
        from haystack.document_stores.in_memory import InMemoryDocumentStore

        log_progress("Creating InMemoryDocumentStore...")
        document_store = InMemoryDocumentStore()
        log_success("InMemoryDocumentStore created")
        return document_store, False

    raise ValueError(f"Unknown store_type: {store_type}. Use 'qdrant', 'memory', or 'auto'")


def create_bm25_store() -> object:
    """
    Create an in-memory BM25 document store for keyword search.

    Returns:
        InMemoryDocumentStore configured for BM25 search
    """
    from haystack.document_stores.in_memory import InMemoryDocumentStore

    log_progress("Creating in-memory BM25 store")
    store = InMemoryDocumentStore()
    log_success("In-memory BM25 store created")
    return store


def populate_bm25_from_vector_store(bm25_store: object, vector_store: object) -> bool:
    """
    Populate BM25 store from documents in vector store.

    Args:
        bm25_store: BM25 document store to populate
        vector_store: Vector store containing documents

    Returns:
        True if successful, False otherwise
    """
    try:
        log_progress("Populating BM25 index from existing documents...")

        # Get all documents from vector store
        all_docs = vector_store.filter_documents()

        if all_docs:
            from haystack.components.writers import DocumentWriter
            writer = DocumentWriter(document_store=bm25_store)
            writer.run(documents=all_docs)
            log_success(f"Populated BM25 index with {len(all_docs)} document chunks")
            return True
        else:
            log_error("No documents found in vector store to populate BM25")
            return False

    except Exception as e:
        log_error(f"Could not populate BM25 from vector store: {e}")
        log_progress("BM25 search will be unavailable")
        return False


def check_document_count(document_store: object) -> int:
    """
    Get the number of documents in a document store.

    Args:
        document_store: The document store to check

    Returns:
        Number of documents in the store
    """
    try:
        return document_store.count_documents()
    except Exception as e:
        log_error(f"Error counting documents: {e}")
        return 0