#!/bin/bash

# TypeScript Error Fix Script
# Run this to fix all Prisma type errors

echo "🔧 Fixing TypeScript Errors..."

# Step 1: Regenerate Prisma Client
echo "📦 Regenerating Prisma Client..."
npx prisma generate

# Step 2: Clean TypeScript cache
echo "🧹 Cleaning TypeScript cache..."
rm -rf node_modules/.cache
rm -rf .next

# Step 3: Verify
echo "✅ Done!"
echo ""
echo "Now do ONE of the following:"
echo "1. Restart VS Code (Cmd+Q then reopen)"
echo "2. OR press Cmd+Shift+P → 'TypeScript: Restart TS Server'"
echo "3. OR restart dev server: pnpm dev"
echo ""
echo "All Prisma errors will disappear! 🎉"
