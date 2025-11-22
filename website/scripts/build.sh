#!/bin/bash

# Build script for production
# Builds the Next.js application for production

set -e

cd "$(dirname "$0")/.."
cd website

echo "🔨 Building for production..."
npm run build

echo "✅ Build complete!"
echo ""
echo "To start the production server, run:"
echo "  cd website && npm start"

