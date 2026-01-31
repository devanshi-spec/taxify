#!/bin/bash

# Force IDE TypeScript Server Reload Script
# This script regenerates Prisma Client and forces IDE to reload types

echo "🔄 Regenerating Prisma Client..."
rm -rf node_modules/@prisma/client
npx prisma generate

echo ""
echo "✅ Prisma Client regenerated successfully!"
echo ""
echo "📝 Next Steps:"
echo "1. In your IDE, press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows)"
echo "2. Type: 'TypeScript: Restart TS Server'"
echo "3. Press Enter"
echo ""
echo "OR simply reload the window:"
echo "1. Press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows)"
echo "2. Type: 'Developer: Reload Window'"
echo "3. Press Enter"
echo ""
echo "🎯 All TypeScript errors should disappear after reloading!"
