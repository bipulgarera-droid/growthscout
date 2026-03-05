#!/bin/bash

# ==============================================================================
# CheckNumber.AI WhatsApp Bulk Checker Test Script
# ==============================================================================

# 1. Replace this with your actual API key from CheckNumber.AI
API_KEY="sk_YOUR_SECRET_KEY"

# 2. We'll create a temporary text file with some test numbers
cat << 'EOF' > test_numbers.txt
9876543210
9123456789
9999999999
EOF

echo "🚀 Sending bulk validation request to CheckNumber.AI..."
echo "Country Code: 91 (India)"
echo "Numbers: 3"
echo "------------------------------------------------------------"

# 3. The actual cURL command outlined in your docs
curl -X POST https://api.checknumber.ai/whatsapp/bulk-check \
  -H "Authorization: Bearer $API_KEY" \
  -F "country_code=91" \
  -F "file=@test_numbers.txt"

echo -e "\n\n------------------------------------------------------------"
echo "✅ Test completed. Cleaning up..."

# Clean up
rm test_numbers.txt
