"""OpenAI API compatibility adapter for Haystack pipelines."""

import time
import uuid
from typing import Dict, Any, List, Optional
try:
    from .progress_logging import log_progress
except ImportError:
    from progress_logging import log_progress


def run_openai_chat(
    pipeline: object,
    messages: List[Dict[str, str]],
    embedding_top_k: int = 3,
    bm25_top_k: int = 3,
    relevance_threshold: float = 0.8,
    fallback_message: str = "I don't have information about that topic.",
    model_name: str = "rag-pipeline",
    debug_logging: bool = True
) -> Dict[str, Any]:
    """
    Process OpenAI-format chat messages through a Haystack RAG pipeline.

    Args:
        pipeline: Configured Haystack pipeline
        messages: List of message objects with 'role' and 'content' keys
        embedding_top_k: Number of results from embedding search
        bm25_top_k: Number of results from BM25 search
        relevance_threshold: Minimum document relevance score
        fallback_message: Message to return when no relevant docs found
        model_name: Model name for response metadata
        debug_logging: Whether to log debug information

    Returns:
        OpenAI-compatible chat completion response
    """
    try:
        # Extract the last user message
        user_messages = [msg for msg in messages if msg.get("role") == "user"]
        if not user_messages:
            raise ValueError("No user message found")

        query = user_messages[-1]["content"]

        # Run the RAG pipeline with intermediate outputs to check document retrieval
        result = pipeline.run(
            data={
                "text_embedder": {"text": query},
                "embedding_retriever": {"top_k": embedding_top_k},
                "bm25_retriever": {"query": query, "top_k": bm25_top_k},
                "reranker": {"query": query},
                "prompt_builder": {"query": query},
            },
            include_outputs_from={
                "reranker",  # Get the final documents after reranking
            }
        )

        # Check if any relevant documents were found
        final_docs = result.get("reranker", {}).get("documents", [])

        # Debug logging if enabled
        if debug_logging:
            log_progress(f"Query: {query}")
            log_progress(f"Found {len(final_docs)} documents")
            for i, doc in enumerate(final_docs):
                score = getattr(doc, 'score', 'no_score')
                log_progress(f"Doc {i}: score={score}, content_preview={doc.content[:100]}...")

        # Filter by relevance threshold
        relevant_docs = [doc for doc in final_docs if getattr(doc, 'score', 0) > relevance_threshold]

        if debug_logging:
            log_progress(f"Docs with score > {relevance_threshold}: {len(relevant_docs)}")

        if not relevant_docs:
            return _create_fallback_response(fallback_message, messages, model_name)

        # Extract the answer
        answer = result.get("generator", {}).get("replies", ["No response generated"])[0]

        # Format as OpenAI response
        return _create_success_response(answer, messages, model_name)

    except Exception as e:
        # Return error in OpenAI format
        return {
            "error": {
                "message": str(e),
                "type": "rag_pipeline_error",
                "code": "internal_error",
            }
        }


def _create_fallback_response(
    fallback_message: str,
    messages: List[Dict[str, str]],
    model_name: str
) -> Dict[str, Any]:
    """Create a fallback response when no relevant documents are found."""
    completion_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"

    return {
        "id": completion_id,
        "object": "chat.completion",
        "created": int(time.time()),
        "model": model_name,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": fallback_message
                },
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": estimate_tokens(messages),
            "completion_tokens": estimate_tokens([{"role": "assistant", "content": fallback_message}]),
            "total_tokens": 0,
        },
    }


def _create_success_response(
    answer: str,
    messages: List[Dict[str, str]],
    model_name: str
) -> Dict[str, Any]:
    """Create a successful response with the generated answer."""
    completion_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"

    return {
        "id": completion_id,
        "object": "chat.completion",
        "created": int(time.time()),
        "model": model_name,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": answer},
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": estimate_tokens(messages),
            "completion_tokens": estimate_tokens([{"role": "assistant", "content": answer}]),
            "total_tokens": 0,  # Will be calculated if needed
        },
    }


def estimate_tokens(messages: List[Dict[str, str]]) -> int:
    """
    Rough token estimation (4 chars ≈ 1 token).

    Args:
        messages: List of message objects

    Returns:
        Estimated token count
    """
    total_chars = sum(len(msg.get("content", "")) for msg in messages)
    return max(1, total_chars // 4)


def validate_openai_messages(messages: List[Dict[str, str]]) -> bool:
    """
    Validate that messages conform to OpenAI chat format.

    Args:
        messages: List of message objects to validate

    Returns:
        True if valid, False otherwise
    """
    if not isinstance(messages, list) or not messages:
        return False

    for msg in messages:
        if not isinstance(msg, dict):
            return False
        if "role" not in msg or "content" not in msg:
            return False
        if msg["role"] not in ["system", "user", "assistant"]:
            return False
        if not isinstance(msg["content"], str):
            return False

    return True


def extract_user_query(messages: List[Dict[str, str]]) -> Optional[str]:
    """
    Extract the most recent user message from the conversation.

    Args:
        messages: List of message objects

    Returns:
        The content of the last user message, or None if not found
    """
    user_messages = [msg for msg in messages if msg.get("role") == "user"]
    if user_messages:
        return user_messages[-1]["content"]
    return None


def create_system_message(content: str) -> Dict[str, str]:
    """
    Create a system message in OpenAI format.

    Args:
        content: The system message content

    Returns:
        Formatted system message
    """
    return {"role": "system", "content": content}


def create_user_message(content: str) -> Dict[str, str]:
    """
    Create a user message in OpenAI format.

    Args:
        content: The user message content

    Returns:
        Formatted user message
    """
    return {"role": "user", "content": content}


def create_assistant_message(content: str) -> Dict[str, str]:
    """
    Create an assistant message in OpenAI format.

    Args:
        content: The assistant message content

    Returns:
        Formatted assistant message
    """
    return {"role": "assistant", "content": content}