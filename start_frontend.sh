#!/bin/bash
# Start the Financial Document Analysis Agent frontend

set -e
cd "$(dirname "$0")/frontend"

echo "Installing frontend dependencies..."
npm install --silent

echo ""
echo "✅ Frontend starting at http://localhost:3000"
echo ""

npm start
