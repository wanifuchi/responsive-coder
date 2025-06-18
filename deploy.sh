#!/bin/bash

echo "🚀 Responsive Coder Deployment Script"
echo "======================================"

# 1. Build frontend
echo "📦 Building frontend..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Frontend build successful"
else
    echo "❌ Frontend build failed"
    exit 1
fi

# 2. Install server dependencies
echo "📦 Installing server dependencies..."
cd server
npm ci --production

if [ $? -eq 0 ]; then
    echo "✅ Server dependencies installed"
else
    echo "❌ Server dependency installation failed"
    exit 1
fi

cd ..

# 3. Git operations
echo "📝 Preparing Git commit..."

# Add all changes
git add .

# Check if there are changes to commit
if git diff --staged --quiet; then
    echo "⚠️  No changes to commit"
else
    echo "📝 Committing changes..."
    git commit -m "Deploy: Ready for production deployment"
    
    echo "🔄 Pushing to GitHub..."
    git push
    
    if [ $? -eq 0 ]; then
        echo "✅ Code pushed to GitHub successfully"
    else
        echo "❌ Git push failed"
        exit 1
    fi
fi

echo ""
echo "🎉 Deployment preparation complete!"
echo ""
echo "Next steps:"
echo "1. Deploy backend to Railway: https://railway.app"
echo "2. Deploy frontend to Vercel: https://vercel.com"
echo "3. Update environment variables in both services"
echo ""
echo "Environment variables needed:"
echo "- Railway: OPENAI_API_KEY, FRONTEND_URL"
echo "- Vercel: VITE_API_URL"