FROM deepset/hayhooks:v0.10.1

# Install additional dependencies for RAG functionality  
RUN pip install torch transformers sentence-transformers nltk

# Install Haystack Ollama integration
RUN pip install ollama-haystack

# Install reranking models - using lightweight cross-encoder
RUN pip install sentence-transformers accelerate

# Install Qdrant client and Haystack integration for vector database
RUN pip install qdrant-client qdrant-haystack

# Copy data directory for document ingestion
COPY data/ /opt/data/

# Copy entire pipelines directory - much cleaner!
COPY pipelines/ /opt/pipelines/

# Set working directory
WORKDIR /opt/pipelines

# Set environment variables
ENV HAYSTACK_TELEMETRY_ENABLED=False
ENV TOKENIZERS_PARALLELISM=false

# Run hayhooks server
CMD ["hayhooks", "run", "--host", "0.0.0.0", "--port", "1416"]