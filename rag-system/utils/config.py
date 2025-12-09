"""Configuration management utilities."""

import os
from typing import Dict, Any, Optional, Union


def get_env_config() -> Dict[str, Any]:
    """
    Get standard RAG configuration from environment variables.

    Returns:
        Dictionary of configuration values with defaults
    """
    return {
        # Qdrant settings
        "qdrant_host": os.getenv("QDRANT_HOST", "localhost"),
        "qdrant_port": int(os.getenv("QDRANT_PORT", "6333")),
        # Model settings
        "ollama_model": os.getenv("OLLAMA_MODEL", "smollm2:135m"),
        "ollama_url": os.getenv("OLLAMA_URL", "http://ollama:11434"),
        "embedding_model": os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5"),
        "reranker_model": os.getenv(
            "RERANKER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2"
        ),
        # Search settings
        "embedding_top_k": int(os.getenv("EMBEDDING_TOP_K", "3")),
        "bm25_top_k": int(os.getenv("BM25_TOP_K", "3")),
        "reranker_top_k": int(os.getenv("RERANKER_TOP_K", "2")),
        "relevance_threshold": float(os.getenv("RELEVANCE_THRESHOLD", "0.8")),
        # Document processing
        "embedding_dim": int(os.getenv("EMBEDDING_DIM", "384")),
        "split_length": int(os.getenv("SPLIT_LENGTH", "100")),
        "split_overlap": int(os.getenv("SPLIT_OVERLAP", "20")),
        "split_threshold": int(os.getenv("SPLIT_THRESHOLD", "3")),
        # Citation/link handling
        "source_base_url": os.getenv(
            "LCFS_SOURCE_BASE_URL",
            "https://www2.gov.bc.ca/assets/gov/environment/climate-change/industry/transportation-fuels/low-carbon-fuels/",
        ),
    }


def get_qdrant_config() -> Dict[str, Any]:
    """Get Qdrant-specific configuration."""
    config = get_env_config()
    return {
        "host": config["qdrant_host"],
        "port": config["qdrant_port"],
        "embedding_dim": config["embedding_dim"],
    }


def get_model_config() -> Dict[str, Any]:
    """Get model-specific configuration."""
    config = get_env_config()
    return {
        "ollama_model": config["ollama_model"],
        "ollama_url": config["ollama_url"],
        "embedding_model": config["embedding_model"],
        "reranker_model": config["reranker_model"],
    }


def get_search_config() -> Dict[str, Any]:
    """Get search-specific configuration."""
    config = get_env_config()
    return {
        "embedding_top_k": config["embedding_top_k"],
        "bm25_top_k": config["bm25_top_k"],
        "reranker_top_k": config["reranker_top_k"],
        "relevance_threshold": config["relevance_threshold"],
    }


def get_processing_config() -> Dict[str, Any]:
    """Get document processing configuration."""
    config = get_env_config()
    return {
        "split_length": config["split_length"],
        "split_overlap": config["split_overlap"],
        "split_threshold": config["split_threshold"],
    }


def get_env_var(
    key: str,
    default: Optional[Union[str, int, float, bool]] = None,
    var_type: type = str,
) -> Union[str, int, float, bool]:
    """
    Get environment variable with type conversion and default.

    Args:
        key: Environment variable name
        default: Default value if not found
        var_type: Type to convert to (str, int, float, bool)

    Returns:
        Environment variable value or default, converted to specified type
    """
    value = os.getenv(key)

    if value is None:
        return default

    if var_type is bool:
        return value.lower() in ("true", "1", "yes", "on")
    elif var_type is int:
        return int(value)
    elif var_type is float:
        return float(value)
    else:
        return value


def validate_config(config: Dict[str, Any]) -> bool:
    """
    Validate configuration values.

    Args:
        config: Configuration dictionary to validate

    Returns:
        True if valid, False otherwise
    """
    required_keys = [
        "qdrant_host",
        "qdrant_port",
        "embedding_model",
        "embedding_top_k",
        "bm25_top_k",
        "reranker_top_k",
    ]

    for key in required_keys:
        if key not in config:
            return False

    # Validate types and ranges
    if not isinstance(config["qdrant_port"], int) or config["qdrant_port"] <= 0:
        return False

    if not isinstance(config["embedding_top_k"], int) or config["embedding_top_k"] <= 0:
        return False

    if not isinstance(config["bm25_top_k"], int) or config["bm25_top_k"] <= 0:
        return False

    if not isinstance(config["reranker_top_k"], int) or config["reranker_top_k"] <= 0:
        return False

    return True
