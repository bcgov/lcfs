"""Common constants for RAG pipelines."""

# Default supported file formats for document processing
DEFAULT_SUPPORTED_FORMATS = {".md", ".docx", ".pdf", ".txt", ".html", ".csv", ".json", ".pptx", ".xlsx"}

# Default search parameters
DEFAULT_EMBEDDING_TOP_K = 3
DEFAULT_BM25_TOP_K = 3
DEFAULT_RERANKER_TOP_K = 2
DEFAULT_RELEVANCE_THRESHOLD = 0.8

# Default document processing parameters
DEFAULT_SPLIT_BY = "word"
DEFAULT_SPLIT_LENGTH = 100
DEFAULT_SPLIT_OVERLAP = 20
DEFAULT_SPLIT_THRESHOLD = 3

# Default embedding dimensions for common models
EMBEDDING_DIMENSIONS = {
    "BAAI/bge-small-en-v1.5": 384,
    "intfloat/e5-small-v2": 384,
    "sentence-transformers/all-MiniLM-L6-v2": 384,
    "sentence-transformers/all-mpnet-base-v2": 768,
}

# Default generation parameters for Ollama
DEFAULT_GENERATION_KWARGS = {
    "num_predict": 500,
    "temperature": 0.1,
    "top_p": 0.9,
    "top_k": 20,
    "repeat_penalty": 1.1,
}

# Common fallback messages
DEFAULT_FALLBACK_MESSAGE = "I don't have information about that topic in my knowledge base."

# Collection name patterns
def get_collection_name(domain: str) -> str:
    """Generate a standardized collection name for a domain."""
    return f"{domain.lower().replace(' ', '_')}_embeddings"