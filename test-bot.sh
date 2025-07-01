#!/bin/bash

echo "🚀 Starting Slack Stand-up Bot..."
echo ""
echo "📋 Prerequisites:"
echo "  ✓ Slack app created at https://api.slack.com/apps"
echo "  ✓ Tokens added to .env file"
echo "  ✓ Socket Mode enabled"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "   Copy .env.example and add your tokens."
    exit 1
fi

# Check if tokens are set
if grep -q "REPLACE-WITH-YOUR" .env; then
    echo "⚠️  Warning: You still have placeholder values in .env"
    echo "   Please update with your actual Slack tokens."
    echo ""
    echo "   Get tokens from: https://api.slack.com/apps"
    echo ""
    read -p "   Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "🔧 Starting application..."
echo ""

pnpm dev

