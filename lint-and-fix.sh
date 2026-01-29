#!/bin/bash
# Script to run ESLint with auto-fix on all TypeScript/TSX files

echo "Running ESLint with auto-fix on all TypeScript files..."

# Run ESLint with auto-fix
pnpm lint:fix

# Check if there are any remaining issues
echo "Checking for remaining ESLint issues..."
pnpm lint

if [ $? -eq 0 ]; then
    echo "✅ All files pass ESLint checks!"
else
    echo "❌ Some files still have ESLint issues that need manual fixing."
    exit 1
fi
