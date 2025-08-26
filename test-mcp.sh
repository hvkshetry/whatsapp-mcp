#!/bin/bash
# Test script to verify WhatsApp MCP is working

echo "Testing WhatsApp MCP Server..."
echo "=============================="

# Kill any existing processes
echo "Cleaning up old processes..."
powershell.exe -c "Get-Process | Where-Object { \$_.Name -like 'main' } | Stop-Process -Force" 2>/dev/null || true

# Start the MCP server
echo "Starting MCP server..."
cd /mnt/c/Users/hvksh/mcp-servers/whatsapp-mcp
timeout 20s node index.js 2>&1 &
SERVER_PID=$!

# Wait for server to start
echo "Waiting for server to initialize..."
sleep 10

# Test the health endpoint
echo "Testing health endpoint..."
HEALTH=$(curl -s http://172.30.48.1:8080/api/health 2>/dev/null || echo "Connection failed")
echo "Health check result: $HEALTH"

# Kill the server
kill $SERVER_PID 2>/dev/null || true
powershell.exe -c "Get-Process | Where-Object { \$_.Name -like 'main' } | Stop-Process -Force" 2>/dev/null || true

echo "Test complete!"