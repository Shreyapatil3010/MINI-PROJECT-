#!/bin/bash
# Start the Financial Document Analysis Agent backend

set -e
cd "$(dirname "$0")/backend"

# Create .env from example if missing
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  Created .env — please add your OPENAI_API_KEY to backend/.env"
fi

# Create virtual env if missing
if [ ! -d .venv ]; then
  echo "Creating Python virtual environment..."
  python3 -m venv .venv
fi

# Activate and install
source .venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

echo ""
echo "✅ Backend starting at http://localhost:8000"
echo "📖 API docs: http://localhost:8000/docs"
echo ""

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
