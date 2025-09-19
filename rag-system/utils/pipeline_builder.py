"""Pipeline building utilities for assembling Haystack RAG pipelines."""

from typing import Dict, Any, Optional
try:
    from .progress_logging import log_progress, log_success
except ImportError:
    from progress_logging import log_progress, log_success


def build_hybrid_pipeline(
    text_embedder: object,
    embedding_retriever: object,
    bm25_retriever: object,
    document_joiner: object,
    reranker: object,
    prompt_builder: object,
    generator: object
) -> object:
    """
    Build a hybrid RAG pipeline with embedding and BM25 search.

    Args:
        text_embedder: Text embedder for queries
        embedding_retriever: Retriever for embedding search
        bm25_retriever: Retriever for keyword search
        document_joiner: Joiner for combining results
        reranker: Reranker for improving results
        prompt_builder: Prompt template builder
        generator: Text generator

    Returns:
        Configured Haystack Pipeline
    """
    log_progress("Building hybrid RAG pipeline (BM25 + embedding search)...")

    from haystack import Pipeline

    pipeline = Pipeline()

    # Add components
    pipeline.add_component("text_embedder", text_embedder)
    pipeline.add_component("embedding_retriever", embedding_retriever)
    pipeline.add_component("bm25_retriever", bm25_retriever)
    pipeline.add_component("document_joiner", document_joiner)
    pipeline.add_component("reranker", reranker)
    pipeline.add_component("prompt_builder", prompt_builder)
    pipeline.add_component("generator", generator)

    # Connect components for hybrid retrieval with reranking
    pipeline.connect("text_embedder.embedding", "embedding_retriever.query_embedding")
    pipeline.connect("embedding_retriever.documents", "document_joiner.documents")
    pipeline.connect("bm25_retriever.documents", "document_joiner.documents")
    pipeline.connect("document_joiner.documents", "reranker.documents")
    pipeline.connect("reranker.documents", "prompt_builder.documents")
    pipeline.connect("prompt_builder", "generator")

    log_success("Pipeline components connected successfully")
    return pipeline


def create_prompt_builder(
    template: str,
    required_variables: Optional[list] = None
) -> object:
    """
    Create a prompt builder with the specified template.

    Args:
        template: Jinja2 template string
        required_variables: List of required template variables

    Returns:
        Configured PromptBuilder
    """
    log_progress("Creating prompt builder...")

    from haystack.components.builders import PromptBuilder

    if required_variables is None:
        required_variables = ["query", "documents"]

    prompt_builder = PromptBuilder(
        template=template,
        required_variables=required_variables,
    )

    log_success("Prompt builder created")
    return prompt_builder


def create_indexing_pipeline(
    document_embedder: object,
    document_splitter: object,
    document_writer: object
) -> object:
    """
    Create a document indexing pipeline.

    Args:
        document_embedder: Embedder for documents
        document_splitter: Splitter for chunking documents
        document_writer: Writer for storing documents

    Returns:
        Configured indexing Pipeline
    """
    log_progress("Building document indexing pipeline...")

    from haystack import Pipeline

    pipeline = Pipeline()

    # Add components
    pipeline.add_component("splitter", document_splitter)
    pipeline.add_component("embedder", document_embedder)
    pipeline.add_component("writer", document_writer)

    # Connect components
    pipeline.connect("splitter", "embedder")
    pipeline.connect("embedder", "writer")

    log_success("Indexing pipeline created")
    return pipeline


def get_default_generation_kwargs() -> Dict[str, Any]:
    """
    Get default generation parameters for Ollama.

    Returns:
        Dictionary of generation parameters
    """
    return {
        "num_predict": 500,  # Allow complete responses
        "temperature": 0.1,  # Low temperature for accuracy
        "top_p": 0.9,
        "top_k": 20,
        "repeat_penalty": 1.1,
    }


def create_standard_rag_template(
    domain_name: str,
    domain_description: str,
    fallback_message: str
) -> str:
    """
    Create a standard RAG prompt template for a domain.

    Args:
        domain_name: Name of the domain (e.g., "LCFS", "Legal")
        domain_description: Description of what the domain covers
        fallback_message: Message for out-of-scope questions

    Returns:
        Jinja2 template string
    """
    return f"""You are an expert assistant for {domain_description}.

Use the following context documents to answer questions about {domain_name} topics. If the question is not related to {domain_name}, respond with: "{fallback_message}"

Context:
{{% for document in documents %}}
{{{{ document.content }}}}
---
{{% endfor %}}

Question: {{{{ query }}}}

Answer:"""


def validate_pipeline_components(components: Dict[str, object]) -> bool:
    """
    Validate that all required pipeline components are present.

    Args:
        components: Dictionary of component name -> component object

    Returns:
        True if all required components present, False otherwise
    """
    required = [
        "text_embedder", "embedding_retriever", "bm25_retriever",
        "document_joiner", "reranker", "prompt_builder", "generator"
    ]

    for component_name in required:
        if component_name not in components or components[component_name] is None:
            return False

    return True