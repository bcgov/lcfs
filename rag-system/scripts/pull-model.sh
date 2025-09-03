#!/bin/bash
set -e

MODEL_NAME=${OLLAMA_MODEL:-"flan-t5-small"}

echo "🚀 Starting Ollama model management for: $MODEL_NAME"

# Start ollama in the background
ollama serve &
OLLAMA_PID=$!

# Wait for ollama to be ready
echo "⏳ Waiting for Ollama service to be ready..."
while ! ollama list > /dev/null 2>&1; do
    echo "   Ollama not ready yet, waiting 2 seconds..."
    sleep 2
done
echo "✅ Ollama service is ready!"

# Check if model already exists
echo "🔍 Checking if model '$MODEL_NAME' is already downloaded..."
if ollama list | grep -q "$MODEL_NAME"; then
    echo "✅ Model '$MODEL_NAME' already exists, skipping download"
else
    echo "📥 Model '$MODEL_NAME' not found, downloading..."
    ollama pull "$MODEL_NAME"
    echo "✅ Model '$MODEL_NAME' downloaded successfully!"
fi

# List available models for confirmation
echo "📋 Available models:"
ollama list

echo "🎉 Model management complete. Ollama will continue running..."

# Keep ollama running in the foreground
wait $OLLAMA_PID