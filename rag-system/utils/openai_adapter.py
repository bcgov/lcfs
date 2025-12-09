"""OpenAI API compatibility adapter for Haystack pipelines."""

import time
import uuid
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Set
from urllib.parse import urljoin

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
    debug_logging: bool = True,
    doc_base_url: Optional[str] = None,
    max_citations: int = 5,
    append_sources_to_answer: bool = True,
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
        doc_base_url: Optional base URL to build citation links
        max_citations: Maximum number of citations to return
        append_sources_to_answer: Whether to append a human-readable "Sources" section

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
            },
        )

        # Check if any relevant documents were found
        final_docs = result.get("reranker", {}).get("documents", [])

        # Debug logging if enabled
        if debug_logging:
            log_progress(f"Query: {query}")
            log_progress(f"Found {len(final_docs)} documents")
            for i, doc in enumerate(final_docs):
                score = getattr(doc, "score", "no_score")
                log_progress(
                    f"Doc {i}: score={score}, content_preview={doc.content[:100]}..."
                )

        # Filter by relevance threshold
        relevant_docs = [
            doc for doc in final_docs if getattr(doc, "score", 0) > relevance_threshold
        ]

        if debug_logging:
            log_progress(
                f"Docs with score > {relevance_threshold}: {len(relevant_docs)}"
            )

        if not relevant_docs:
            return _create_fallback_response(fallback_message, messages, model_name)

        # Extract the answer
        answer = result.get("generator", {}).get("replies", ["No response generated"])[
            0
        ]

        citations = _build_citation_entries(relevant_docs, doc_base_url, max_citations)
        processed_answer = (
            _append_citations_to_answer(answer, citations)
            if append_sources_to_answer
            else answer
        )

        # Format as OpenAI response
        return _create_success_response(
            processed_answer, messages, model_name, citations
        )

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
    fallback_message: str, messages: List[Dict[str, str]], model_name: str
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
                "message": {"role": "assistant", "content": fallback_message},
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": estimate_tokens(messages),
            "completion_tokens": estimate_tokens(
                [{"role": "assistant", "content": fallback_message}]
            ),
            "total_tokens": 0,
        },
    }


def _create_success_response(
    answer: str,
    messages: List[Dict[str, str]],
    model_name: str,
    citations: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Create a successful response with the generated answer."""
    completion_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"

    response = {
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
            "completion_tokens": estimate_tokens(
                [{"role": "assistant", "content": answer}]
            ),
            "total_tokens": 0,  # Will be calculated if needed
        },
    }

    if citations:
        response["lcfs_metadata"] = {"citations": citations}

    return response


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


def _build_citation_entries(
    documents: List[Any], base_url: Optional[str], max_items: int
) -> List[Dict[str, Any]]:
    """
    Build a list of citation metadata from retrieved documents.
    """
    citations: List[Dict[str, Any]] = []
    seen: Set[Tuple[str, Optional[str]]] = set()

    for doc in documents:
        if len(citations) >= max_items:
            break

        meta = getattr(doc, "meta", {}) or {}
        title = _derive_citation_title(meta)
        url = _derive_citation_url(meta, base_url)
        origin = _extract_origin(meta)

        key = (title, url or origin)
        if key in seen:
            continue
        seen.add(key)

        entry: Dict[str, Any] = {
            "title": title,
            "url": url,
            "origin": origin,
        }

        score = getattr(doc, "score", None)
        if isinstance(score, (int, float)):
            entry["score"] = round(float(score), 4)
        elif score is not None:
            entry["score"] = score

        citations.append(entry)

    return citations


def _derive_citation_title(meta: Dict[str, Any]) -> str:
    """Choose the most helpful title for a citation."""
    title_keys = [
        "title",
        "document_title",
        "filename",
        "file_name",
        "display_name",
    ]

    for key in title_keys:
        value = meta.get(key)
        if value:
            return str(value)

    origin = _extract_origin(meta)
    if origin:
        return Path(str(origin)).name

    return "LCFS Reference Document"


def _derive_citation_url(
    meta: Dict[str, Any], base_url: Optional[str]
) -> Optional[str]:
    """Resolve the best available URL for a citation."""
    for key in ("source_url", "document_url", "url"):
        value = meta.get(key)
        if value:
            return str(value)

    origin = _extract_origin(meta)
    if origin and str(origin).startswith(("http://", "https://")):
        return str(origin)

    filename = None
    if meta.get("filename"):
        filename = meta["filename"]
    elif meta.get("file_name"):
        filename = meta["file_name"]
    elif origin:
        filename = Path(str(origin)).name

    if base_url and filename:
        return urljoin(base_url.rstrip("/") + "/", str(filename))

    return None


def _extract_origin(meta: Dict[str, Any]) -> Optional[str]:
    """Extract the raw origin/path for a document."""
    for key in ("source", "file_path", "path", "document_id"):
        value = meta.get(key)
        if value:
            return str(value)
    return None


def _append_citations_to_answer(answer: str, citations: List[Dict[str, Any]]) -> str:
    """Append a formatted Sources section to the answer."""
    if not citations:
        return answer

    lines = ["", "", "Sources:"]
    for idx, citation in enumerate(citations, 1):
        label = citation.get("title", "LCFS Reference")
        url = citation.get("url") or citation.get("origin")
        if url:
            lines.append(f"{idx}. {label} — {url}")
        else:
            lines.append(f"{idx}. {label}")

    return answer.rstrip() + "\n".join(lines)
