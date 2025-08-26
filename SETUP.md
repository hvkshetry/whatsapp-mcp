# WhatsApp MCP Server - Setup Guide

## Overview

The WhatsApp MCP Server now supports headless operation after initial authentication. This means you only need to scan the QR code once, and the session will persist for approximately 20 days.

## Initial Setup (One-Time Only)

### 1. Check Session Status

First, check if you already have an active WhatsApp session:

```bash
cd /mnt/c/Users/hvksh/mcp-servers/whatsapp-mcp
node check-session.js
```

### 2. Initial Authentication (If No Session)

If no session exists, you need to authenticate once:

```bash
cd /mnt/c/Users/hvksh/mcp-servers/whatsapp-mcp/whatsapp-bridge
go run main.go
```

1. A QR code will appear in your terminal
2. Open WhatsApp on your phone
3. Go to Settings → Linked Devices → Link a Device
4. Scan the QR code
5. Wait for "Successfully connected and authenticated!" message
6. Press `Ctrl+C` to stop the bridge

Your session is now saved and will persist for ~20 days!

### 3. Configure MCP

The MCP configurations have been updated to use the headless wrapper. No manual configuration needed if using the provided setup.

## Daily Usage

After initial setup, the WhatsApp MCP server will start automatically when Claude requests it. No manual intervention required!

The wrapper (`index.js`) will:
- Automatically start the Go WhatsApp bridge in the background
- Wait for the REST API to be ready
- Start the Python MCP server
- Forward all MCP communication between Claude and WhatsApp

## Session Management

### Session Lifetime
- Sessions remain valid for approximately 20 days
- After expiry, you'll need to scan the QR code again (follow Initial Authentication steps)

### Check Session Status
Run this anytime to verify your session:
```bash
node /mnt/c/Users/hvksh/mcp-servers/whatsapp-mcp/check-session.js
```

### Session Files
- Session data: `whatsapp-bridge/store/whatsapp.db`
- Message history: `whatsapp-bridge/store/messages.db`

## Troubleshooting

### "Not connected to WhatsApp" Error
1. Check session status: `node check-session.js`
2. If expired or missing, re-authenticate with QR code
3. Restart the MCP server

### Bridge Won't Start
1. Ensure Go is installed and in PATH
2. Check if port 8080 is available
3. Verify CGO is enabled: `go env CGO_ENABLED` (should be 1)

### Python Server Issues
1. Ensure Python and uv are installed
2. Check dependencies: `cd whatsapp-mcp-server && uv pip list`
3. Verify the `main.py` file exists

### Manual Testing
To test the bridge independently:
```bash
cd whatsapp-bridge
go run main.go
```

To test the full stack:
```bash
node /mnt/c/Users/hvksh/mcp-servers/whatsapp-mcp/index.js
```

## Architecture

```
Claude/AI ← MCP Protocol → index.js (Node Wrapper)
                               ├── Go WhatsApp Bridge (Port 8080)
                               │     └── WhatsApp Web API
                               └── Python MCP Server
                                     └── REST calls to Bridge
```

## Security Notes

- Never share or commit the `store/` directory - it contains your WhatsApp session
- The session is tied to your phone number
- Logging out from phone's Linked Devices will invalidate the session
- Multiple sessions can exist (different devices/clients)

## Comparison with Office MCP

Unlike Office MCP which uses OAuth tokens with refresh capability, WhatsApp uses device pairing with QR codes. This means:
- One-time manual QR scan required (vs OAuth flow)
- Sessions last ~20 days (vs hourly token refresh)
- No client secrets or API keys needed
- Direct WhatsApp Web protocol (vs Microsoft Graph API)