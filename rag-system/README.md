# LCFS RAG System

Simple LLM API using Haystack and Hayhooks with open-source models for the LCFS project.

## Quick Start

### Using Docker Compose

```bash
# Start core LCFS services + RAG LLM
docker-compose -f docker-compose.yml -f docker-compose.rag.yml up -d

# Or start just the RAG LLM service
docker-compose -f docker-compose.rag.yml up rag-llm

# Run automated tests
./test_rag.sh
```

### RAG System Features ✨

- **Document Ingestion**: Automatically loads and embeds knowledge from `data/` directory  
- **Semantic Search**: Uses sentence-transformers for similarity-based retrieval
- **Context Augmentation**: Relevant document chunks included in LLM prompts
- **No API Keys Required**: Uses local open-source models from Hugging Face

## API Usage

The service exposes a Hayhooks API on port 1416:

### Query the RAG System

```bash
# RAG query with context retrieval
curl -X POST http://localhost:1416/lcfs_pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"query": "What are the key accounting principles?"}'

# Dedicated RAG pipeline with detailed context
curl -X POST http://localhost:1416/rag_pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"query": "Explain revenue recognition principle"}' | jq

# Control number of retrieved documents  
curl -X POST http://localhost:1416/lcfs_pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"query": "How does depreciation work?", "top_k": 5}' | jq
```

### Example RAG Response

```json
{
  "answer": "Revenue recognition principle states that revenue should be recorded when earned...",
  "query": "Explain revenue recognition principle", 
  "context": [
    {
      "content": "Revenue should be recorded when it is earned, regardless of when cash is received...",
      "source": "accounting_principles.md",
      "score": 0.89
    }
  ],
  "num_documents_retrieved": 3,
  "model": "microsoft/DialoGPT-small",
  "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
  "rag_enabled": true
}
```

### Health Check

```bash
curl http://localhost:1416/status
```

## Available Endpoints

Current pipelines:
- `POST /lcfs_pipeline/run` - LCFS-focused RAG with context retrieval  
- `POST /rag_pipeline/run` - General RAG pipeline with detailed context display
- `POST /simple_echo/run` - Echo test pipeline

System endpoints:
- `GET /status` - Service health check and list all pipelines
- `GET /docs` - Interactive Swagger UI documentation
- `GET /openapi.json` - OpenAPI specification

## Creating New Pipelines

The system uses a clean directory-based structure for managing multiple pipelines:

### Directory Structure

```
rag-system/
├── Dockerfile              # Simple: just copies pipelines/ directory
├── README.md               # This file
└── pipelines/              # All pipelines organized here
    ├── lcfs_pipeline/
    │   └── pipeline_wrapper.py    # LLM chat pipeline
    ├── simple_echo/
    │   └── pipeline_wrapper.py    # Echo test pipeline
    └── your_new_pipeline/
        └── pipeline_wrapper.py    # Your custom pipeline
```

### Adding a New Pipeline

1. **Create the directory structure**:
```bash
mkdir rag-system/pipelines/your_pipeline_name/
```

2. **Create the pipeline wrapper** (`pipeline_wrapper.py`):
```python
"""Your custom pipeline wrapper"""

from typing import Dict, Any
from haystack import Pipeline
from hayhooks import BasePipelineWrapper

class PipelineWrapper(BasePipelineWrapper):
    """Your Pipeline Description"""
    
    def setup(self) -> None:
        """Setup your pipeline components"""
        # Create your pipeline here
        self.pipeline = Pipeline()
        # Add components, connections, etc.
        
    def run_api(self, your_input: str) -> Dict[str, Any]:
        """
        Describe your API endpoint here.
        
        Args:
            your_input: Description of input parameter
            
        Returns:
            Dictionary containing your response
        """
        result = self.pipeline.run({"component": {"input": your_input}})
        return {"output": result}
```

3. **Rebuild and deploy**:
```bash
docker compose -f docker-compose.rag.yml up --build -d
```

4. **Your new endpoint is automatically available**:
```bash
# New endpoint: POST /your_pipeline_name/run
curl -X POST http://localhost:1416/your_pipeline_name/run \
  -H "Content-Type: application/json" \
  -d '{"your_input": "test"}'
```

### Pipeline Wrapper Requirements

Each `pipeline_wrapper.py` must:
- Extend `BasePipelineWrapper`
- Have a `setup()` method that creates `self.pipeline`
- Have a `run_api()` method with proper type hints and docstring
- Be completely self-contained (all imports, dependencies, etc.)

### Key Benefits

- ✅ **No Dockerfile changes needed** - just create new directories
- ✅ **Automatic API generation** - endpoint created from directory name
- ✅ **Built-in Swagger docs** - docstrings become API documentation
- ✅ **Easy to manage** - each pipeline isolated in its own directory

## Architecture

- **Haystack 2.0**: LLM pipeline framework
- **Hayhooks**: REST API server for Haystack pipelines
- **HuggingFace Local**: Open-source models (DialoGPT-small)
- **Docker**: Containerized deployment
- **Directory-based pipelines**: Clean separation and easy management

## Models Available

The current setup uses `microsoft/DialoGPT-small` but you can easily switch to:
- `google/flan-t5-base` - Google's T5 model
- `microsoft/DialoGPT-medium` - Larger version
- Any other Hugging Face model compatible with `HuggingFaceLocalGenerator`