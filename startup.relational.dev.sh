#!/usr/bin/env bash
set -e

# Wait for core services
# /opt/wait-for-it.sh postgres:5432
# /opt/wait-for-it.sh qdrant:6333
# /opt/wait-for-it.sh ollama:11434
/opt/wait-for-it.sh sui-ai-chat.postgres.database.azure.com:5432 -t 30
/opt/wait-for-it.sh qdrant-vector-db.happyfield-d4613d37.eastus.azurecontainerapps.io:443 -t 30
/opt/wait-for-it.sh ollama-embedding.happyfield-d4613d37.eastus.azurecontainerapps.io:443 -t 30

# Setup Ollama with embedding model
# echo "Waiting for Ollama to be ready..."
# sleep 5
# echo "Pulling embedding model..."
# curl -X POST http://ollama:11434/api/pull -d '{"name":"mxbai-embed-large"}' || echo "Model pull failed, continuing..."
sleep 10

# Run database setup and start
# npm run migration:run:prod
# npm run seed:run:relational
npm run start:prod
