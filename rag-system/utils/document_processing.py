"""Document processing utilities for loading and indexing various file formats."""

import os
import time
from pathlib import Path
from typing import List, Dict, Any, Optional, Callable, Set
try:
    from .progress_logging import (
        log_progress, log_error, log_success, log_subsection,
        log_bullet, log_timing, log_step
    )
except ImportError:
    from progress_logging import (
        log_progress, log_error, log_success, log_subsection,
        log_bullet, log_timing, log_step
    )


def load_documents(
    data_paths: Optional[List[Path]] = None,
    supported_formats: Optional[Set[str]] = None,
    metadata_enricher: Optional[Callable[[Dict[str, Any]], Dict[str, Any]]] = None
) -> List[object]:
    """
    Load documents from multiple paths with format support and metadata enrichment.

    Args:
        data_paths: List of paths to search for documents
        supported_formats: Set of supported file extensions (with dots)
        metadata_enricher: Optional function to enrich document metadata

    Returns:
        List of Document objects
    """
    if data_paths is None:
        data_paths = [
            Path("/opt/data"),  # Container path
            Path(__file__).parent.parent.parent / "data",  # Local development path
        ]

    if supported_formats is None:
        supported_formats = {".md", ".docx", ".pdf", ".txt", ".html", ".csv", ".json", ".pptx", ".xlsx"}

    documents = []

    # Try to initialize the multi-file converter
    converter, converter_available = _initialize_converter()

    for data_path in data_paths:
        if data_path.exists():
            # Find all supported files in the directory
            supported_files = []
            for file_path in data_path.iterdir():
                if file_path.is_file() and file_path.suffix.lower() in supported_formats:
                    supported_files.append(file_path)

            if supported_files and converter_available:
                try:
                    log_progress(f"Found {len(supported_files)} supported files:")
                    for file_path in supported_files:
                        log_bullet(f"{file_path.name} ({file_path.suffix})")

                    # Convert all supported files at once
                    result = converter.run(sources=supported_files)
                    converted_docs = result.get("documents", [])

                    # Add metadata to converted documents
                    for doc in converted_docs:
                        if doc.meta is None:
                            doc.meta = {}

                        # Apply base metadata
                        doc.meta.update({
                            "processed_by": "MultiFileConverter"
                        })

                        # Apply domain-specific metadata enrichment if provided
                        if metadata_enricher:
                            doc.meta.update(metadata_enricher(doc.meta))

                        documents.append(doc)

                    log_success(f"Successfully converted {len(converted_docs)} documents")

                except Exception as e:
                    log_error(f"Error converting files with MultiFileConverter: {e}")
                    # Fallback to manual processing for .md files only
                    log_progress("Falling back to manual .md processing")
                    _fallback_md_processing(data_path, documents, metadata_enricher)

            elif not converter_available:
                # MultiFileConverter not available, use fallback
                log_progress("Using fallback .md processing (MultiFileConverter unavailable)")
                _fallback_md_processing(data_path, documents, metadata_enricher)

            break  # Stop after finding first valid path

    return documents


def process_documents_for_indexing(
    documents: List[object],
    document_embedder: object,
    document_store: object,
    bm25_store: Optional[object] = None,
    split_by: str = "word",
    split_length: int = 100,
    split_overlap: int = 20,
    split_threshold: int = 3
) -> int:
    """
    Process documents for indexing: split, embed, and store.

    Args:
        documents: List of documents to process
        document_embedder: Embedder for generating document embeddings
        document_store: Store for embeddings
        bm25_store: Optional store for BM25 search
        split_by: How to split documents ("word", "sentence", etc.)
        split_length: Length of each chunk
        split_overlap: Overlap between chunks
        split_threshold: Minimum chunk size threshold

    Returns:
        Number of chunks indexed
    """
    if not documents:
        log_error("No documents provided for indexing")
        return 0

    log_step(3, 3, "Starting live indexing")
    log_progress("Indexing documents (this takes 2-3 minutes on first run)...")
    log_subsection("Note: Data is persisted - subsequent restarts will be instant")

    # Create document writer
    from haystack.components.writers import DocumentWriter
    writer = DocumentWriter(document_store=document_store)

    # Build indexing pipeline
    from haystack.components.preprocessors import DocumentSplitter
    splitter = DocumentSplitter(
        split_by=split_by,
        split_length=split_length,
        split_overlap=split_overlap,
        split_threshold=split_threshold
    )

    # Run bulk indexing (faster than batching)
    start_time = time.time()

    log_progress(f"Processing {len(documents)} documents...")
    log_subsection("Splitting documents into chunks...")
    split_docs = splitter.run(documents=documents)
    chunks = split_docs["documents"]
    log_subsection(f"Generated {len(chunks)} text chunks")

    log_subsection("Generating embeddings (this is the slow part - please wait)...")
    log_subsection(f"Processing {len(chunks)} chunks with {document_embedder.model}")
    embed_start = time.time()
    embedded_docs = document_embedder.run(documents=chunks)
    embed_time = time.time() - embed_start
    log_subsection(f"Embeddings complete ({embed_time:.1f}s)")

    log_subsection("Writing to document store...")
    writer.run(documents=embedded_docs["documents"])
    log_subsection("Write complete")

    # Populate BM25 index if provided
    if bm25_store:
        log_progress("Populating BM25 index...")
        bm25_writer = DocumentWriter(document_store=bm25_store)
        bm25_writer.run(documents=chunks)

    points_count = len(chunks)
    log_success(f"Indexing complete: {points_count} document chunks indexed")
    log_progress("Ready to serve queries with hybrid search!")

    return points_count


def _initialize_converter() -> tuple:
    """
    Initialize the MultiFileConverter with fallback handling.

    Returns:
        Tuple of (converter_instance, is_available)
    """
    try:
        from haystack.components.converters import MultiFileConverter
        converter = MultiFileConverter()
        log_progress("MultiFileConverter loaded successfully")
        return converter, True
    except ImportError as e:
        log_error(f"MultiFileConverter not available: {e}")
        log_progress("Falling back to manual .md processing")
        return None, False


def _fallback_md_processing(
    data_path: Path,
    documents: List[object],
    metadata_enricher: Optional[Callable[[Dict[str, Any]], Dict[str, Any]]] = None
) -> None:
    """
    Fallback method to manually process .md files if MultiFileConverter fails.

    Args:
        data_path: Path to search for markdown files
        documents: List to append processed documents to
        metadata_enricher: Optional function to enrich document metadata
    """
    from haystack import Document

    for md_file in data_path.glob("*.md"):
        try:
            content = md_file.read_text(encoding="utf-8")

            meta = {
                "filename": md_file.name,
                "source": str(md_file),
                "processed_by": "manual_fallback"
            }

            # Apply domain-specific metadata enrichment if provided
            if metadata_enricher:
                meta.update(metadata_enricher(meta))

            doc = Document(content=content, meta=meta)
            documents.append(doc)
            log_success(f"Manually processed: {md_file.name}")

        except Exception as e:
            log_error(f"Error reading {md_file}: {e}")


def check_for_existing_embeddings(document_store: object) -> int:
    """
    Check if document store already contains embeddings.

    Args:
        document_store: The document store to check

    Returns:
        Number of existing documents
    """
    log_step(1, 3, "Checking for existing embeddings...")

    try:
        points_count = document_store.count_documents()
        if points_count > 0:
            log_success(f"Found collection with {points_count} embeddings")
            return points_count
        else:
            log_progress("Collection exists but is empty")
            log_progress("Will populate with embeddings...")
            return 0
    except Exception as e:
        log_progress(f"Collection doesn't exist: {e}")
        log_progress("Will create collection and populate with embeddings")
        return 0


def load_documents_step(
    data_paths: Optional[List[Path]] = None,
    supported_formats: Optional[Set[str]] = None,
    metadata_enricher: Optional[Callable[[Dict[str, Any]], Dict[str, Any]]] = None
) -> List[object]:
    """
    Step 2 wrapper for loading documents with consistent logging.

    Args:
        data_paths: List of paths to search for documents
        supported_formats: Set of supported file extensions
        metadata_enricher: Optional function to enrich document metadata

    Returns:
        List of loaded documents
    """
    log_step(2, 3, "Loading documents...")

    docs = load_documents(data_paths, supported_formats, metadata_enricher)

    if not docs:
        log_error("No documents found in data directory - cannot proceed")
        return []

    log_progress(f"Found {len(docs)} documents to index")
    return docs