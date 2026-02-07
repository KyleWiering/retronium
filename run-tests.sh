#!/bin/bash
# Retronium P2P Test Runner
# This script runs the Docker-based E2E tests

set -e

echo "============================================================"
echo "Retronium P2P Test Runner"
echo "============================================================"
echo

# Clean up previous test results
echo "Cleaning up previous test results..."
rm -f test-results/*.json

# Build and run the test containers
echo
echo "Building and starting test environment..."
set +e
docker compose up --build --abort-on-container-exit
EXIT_CODE=$?
set -e

# Display results
echo
echo "============================================================"
echo "Test Results"
echo "============================================================"

if [ -f "test-results/host-result.json" ]; then
    echo
    echo "=== HOST RESULTS ==="
    cat test-results/host-result.json
else
    echo "Host results not found!"
fi

echo

if [ -f "test-results/client-result.json" ]; then
    echo
    echo "=== CLIENT RESULTS ==="
    cat test-results/client-result.json
else
    echo "Client results not found!"
fi

echo
echo "============================================================"

# Cleanup containers
echo
echo "Cleaning up containers..."
docker compose down

echo
echo "Test run complete. Exit code: $EXIT_CODE"
exit $EXIT_CODE

