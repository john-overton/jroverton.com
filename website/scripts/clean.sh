#!/bin/bash

# Clean script
# Removes build artifacts and node_modules

cd "$(dirname "$0")/.."
cd website

echo "🧹 Cleaning build artifacts..."

# Remove Next.js build directory
if [ -d ".next" ]; then
    rm -rf .next
    echo "✅ Removed .next directory"
fi

# Remove node_modules (optional, uncomment if needed)
# if [ -d "node_modules" ]; then
#     rm -rf node_modules
#     echo "✅ Removed node_modules directory"
# fi

echo "✅ Clean complete!"


