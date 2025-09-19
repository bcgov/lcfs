FROM deepset/hayhooks:v0.10.1

# Copy requirements file
COPY requirements.txt /tmp/requirements.txt

# Install all dependencies from requirements.txt
RUN pip install -r /tmp/requirements.txt && rm /tmp/requirements.txt

# Set default model names as build args (can be overridden)
ARG EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
ARG RERANKER_MODEL=cross-encoder/ms-marco-MiniLM-L-6-v2

# Pre-download embedding models during build to avoid runtime downloads
# This significantly speeds up container startup time
RUN python -c "import os; \
    from sentence_transformers import SentenceTransformer; \
    embedding_model = os.getenv('EMBEDDING_MODEL', '${EMBEDDING_MODEL}'); \
    reranker_model = os.getenv('RERANKER_MODEL', '${RERANKER_MODEL}'); \
    print(f'Downloading {embedding_model} embedding model...'); \
    SentenceTransformer(embedding_model); \
    print(f'{embedding_model} downloaded successfully'); \
    print(f'Downloading {reranker_model} reranker model...'); \
    SentenceTransformer(reranker_model); \
    print(f'{reranker_model} downloaded successfully'); \
    print('All models pre-cached in image');"

# Copy utils directory for reusable RAG components
COPY utils/ /opt/utils/

# Copy data directory for document ingestion (including test files)
COPY data/ /opt/data/

# Pipelines directory will be mounted as volume for development
# Set working directory
WORKDIR /opt/pipelines

# Set environment variables
ENV HAYSTACK_TELEMETRY_ENABLED=False
ENV TOKENIZERS_PARALLELISM=false
ENV PYTHONUNBUFFERED=1

# Run hayhooks server
CMD ["hayhooks", "run", "--host", "0.0.0.0", "--port", "1416"]