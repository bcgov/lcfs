FROM deepset/hayhooks:v0.6.0

# Install additional dependencies for RAG functionality
RUN pip install torch transformers sentence-transformers nltk

# Install reranking models - using lightweight cross-encoder
RUN pip install sentence-transformers accelerate

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