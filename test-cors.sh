#!/bin/bash

echo "🧪 Testing CORS configuration..."
echo "================================"

# Test OPTIONS request
echo -e "\n1. Testing OPTIONS request:"
curl -X OPTIONS \
  -H "Origin: https://responsive-coder.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v https://responsive-coder-production.up.railway.app/api/test-cors 2>&1 | grep -E "(< HTTP|< Access-Control)"

# Test GET request
echo -e "\n\n2. Testing GET request:"
curl -H "Origin: https://responsive-coder.vercel.app" \
  https://responsive-coder-production.up.railway.app/api/test-cors

# Test main API endpoint
echo -e "\n\n3. Testing main API endpoint (OPTIONS):"
curl -X OPTIONS \
  -H "Origin: https://responsive-coder.vercel.app" \
  -v https://responsive-coder-production.up.railway.app/api/generate-code 2>&1 | grep -E "(< HTTP|< Access-Control)"

echo -e "\n\n✅ Test completed!"