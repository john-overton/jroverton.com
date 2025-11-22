#!/bin/bash

# Setup script for jroverton.com website
# This script initializes the development environment

set -e

echo "🚀 Setting up jroverton.com website..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check Node.js version (requires 18+)
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Navigate to website directory
cd "$(dirname "$0")/.."
cd website

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo "✅ Setup complete!"
echo ""
echo "To start the development server, run:"
echo "  cd website && npm run dev"
echo ""
echo "To build for production, run:"
echo "  cd website && npm run build"

