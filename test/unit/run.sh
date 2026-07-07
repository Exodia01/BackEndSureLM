#!/bin/bash

# Run all unit tests in this directory
echo "Running Unit Tests..."
echo "====================="

PASSED=0
FAILED=0

for test_file in *.test.ts; do
    if [ -f "$test_file" ]; then
        echo ""
        echo "Testing: $test_file"
        echo "-------------------"
        
        if npx tsx "$test_file"; then
            ((PASSED++))
        else
            ((FAILED++))
        fi
    fi
done

echo ""
echo "====================="
echo "Summary"
echo "====================="
echo "Passed: $PASSED"
echo "Failed: $FAILED"

if [ $FAILED -gt 0 ]; then
    exit 1
fi
