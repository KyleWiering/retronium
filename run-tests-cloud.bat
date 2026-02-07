@echo off
REM Retronium P2P Cloud Test Runner for Windows
REM This script tests against Google STUN + PeerJS cloud (no local servers)

echo ============================================================
echo Retronium P2P Cloud Test Runner
echo Testing with: PeerJS Cloud + Google STUN Servers
echo ============================================================
echo.

REM Clean up previous test results
echo Cleaning up previous test results...
if exist test-results\*.json del /Q test-results\*.json

REM Build and run the test containers (cloud mode)
echo.
echo Building and starting cloud test environment...
docker compose -f docker-compose.cloud.yml up --build --abort-on-container-exit

REM Capture exit code
set EXIT_CODE=%ERRORLEVEL%

REM Display results
echo.
echo ============================================================
echo Test Results (Cloud Mode - PeerJS + Google STUN)
echo ============================================================

if exist test-results\host-result.json (
    echo.
    echo === HOST RESULTS ===
    type test-results\host-result.json
) else (
    echo Host results not found!
)

echo.

if exist test-results\client-result.json (
    echo.
    echo === CLIENT RESULTS ===
    type test-results\client-result.json
) else (
    echo Client results not found!
)

echo.
echo ============================================================

REM Cleanup containers
echo.
echo Cleaning up containers...
docker compose -f docker-compose.cloud.yml down

echo.
echo Cloud test run complete. Exit code: %EXIT_CODE%
exit /b %EXIT_CODE%

