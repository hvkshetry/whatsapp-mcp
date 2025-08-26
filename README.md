# WhatsApp MCP Server

**Production-ready WhatsApp MCP server with WSL2 support and automatic startup.**

This Model Context Protocol (MCP) server enables Claude to interact with your personal WhatsApp account - search messages, read conversations, and send messages to individuals or groups.

## 🚀 Key Features
- ✅ **Direct Python MCP server** - Simplified architecture without wrapper complexity
- ✅ **Automatic Windows startup** - Go bridge starts automatically with Windows
- ✅ **WSL2 optimized** - Seamless operation across WSL/Windows boundary
- ✅ **10 working tools** - Full WhatsApp functionality (messaging, search, contacts)
- ✅ **Persistent storage** - All messages stored locally in SQLite

## 📋 Prerequisites

- Windows with WSL2
- Go (for bridge compilation)
- Python 3.11+
- UV package manager: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- Claude Code (Codex CLI) or Cursor

## 🔧 Installation

### Step 1: Clone and Build

```bash
# Clone repository
git clone https://github.com/hvkshmail/whatsapp-mcp.git
cd whatsapp-mcp

# Build Go bridge (if not already built)
cd whatsapp-bridge
go build -o main.exe main.go
cd ..
```

### Step 2: Configure MCP Server

Add to your `~/.mcp.json` configuration file (used by Claude Code/Codex CLI):

```json
{
  "mcpServers": {
    "whatsapp-mcp": {
      "type": "stdio",
      "command": "uv",
      "args": [
        "--directory",
        "/mnt/c/Users/YOUR_USERNAME/mcp-servers/whatsapp-mcp/whatsapp-mcp-server",
        "run",
        "main.py"
      ],
      "description": "WhatsApp MCP Server - Direct Python server connection"
    }
  }
}
```

Replace `YOUR_USERNAME` with your Windows username.

### Step 3: Set Up Automatic Startup (Windows)

#### Option A: Task Scheduler (Recommended)

1. Run the provided PowerShell script as Administrator:
```powershell
cd C:\Users\YOUR_USERNAME\mcp-servers\whatsapp-mcp
.\setup-auto-start.ps1
```

This creates a Windows Task Scheduler task that:
- Starts the Go bridge at Windows startup
- Runs in the background without a console window
- Automatically restarts if it crashes

#### Option B: Manual Task Scheduler Setup

1. Open Task Scheduler (Win+R, type `taskschd.msc`)
2. Create Basic Task → Name: "WhatsApp MCP Bridge"
3. Trigger: When the computer starts
4. Action: Start a program
   - Program: `C:\Users\YOUR_USERNAME\mcp-servers\whatsapp-mcp\whatsapp-bridge\main.exe`
   - Start in: `C:\Users\YOUR_USERNAME\mcp-servers\whatsapp-mcp\whatsapp-bridge`
5. Finish and edit properties:
   - Run whether user is logged on or not
   - Run with highest privileges
   - Hidden

#### Option C: Startup Folder

Copy `start-whatsapp-bridge.vbs` to your Windows startup folder:
```cmd
Win+R → shell:startup
```

## 🎯 First Time Setup

1. **Start the Go bridge** (if not using auto-start):
```bash
cd whatsapp-bridge
./main.exe
```

2. **Scan QR code** with WhatsApp mobile app (first time only)

3. **Connect in Claude Code** using `/mcp` command

## 📱 Available Tools (10 Working)

### Messaging
- `send_message` - Send text messages to individuals or groups
- `list_messages` - Search and retrieve message history
- `get_message_context` - Get conversation context around a message

### Contacts & Chats
- `search_contacts` - Find contacts by name or number
- `list_chats` - List all available chats
- `get_chat` - Get specific chat details
- `get_direct_chat_by_contact` - Find direct chat with a contact
- `get_contact_chats` - Get all chats involving a contact
- `get_last_interaction` - Get most recent message with a contact

### Media
- `download_media` - Download received media files

### Removed Tools (WSL/Windows Path Issues)
- ~~`send_file`~~ - File path translation issues
- ~~`send_audio_message`~~ - File path translation issues

## 🔍 Troubleshooting

### Connection Issues

1. **Check Go bridge is running**:
```bash
curl http://localhost:8080/api/health
```

2. **Check logs**:
```bash
# Go bridge logs
tail -f C:\Users\YOUR_USERNAME\mcp-servers\whatsapp-mcp\whatsapp-bridge\whatsapp-bridge.log

# MCP logs
ls ~/.cache/claude-cli-nodejs/*/mcp-logs-whatsapp-mcp/
```

3. **Manual restart**:
```bash
# Stop any existing bridge
taskkill /F /IM main.exe

# Restart
cd /mnt/c/Users/YOUR_USERNAME/mcp-servers/whatsapp-mcp/whatsapp-bridge
./main.exe
```

### Common Issues

- **"Connection timed out"**: Ensure Go bridge is running before connecting MCP
- **"Port 8080 in use"**: Another process is using the port, check with `netstat -an | grep 8080`
- **File sending fails**: Use alternative methods or share files through other means

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Claude Code    │────▶│  Python MCP      │────▶│  Go Bridge  │
│  (Codex CLI)    │     │  Server (WSL2)   │     │  (Windows)  │
└─────────────────┘     └──────────────────┘     └─────────────┘
                              │                         │
                              ▼                         ▼
                        ┌──────────┐            ┌──────────────┐
                        │ FastMCP  │            │  WhatsApp    │
                        │ Protocol │            │  Web API     │
                        └──────────┘            └──────────────┘
```

## 📝 Notes

- Messages are stored locally in SQLite database
- All communication happens on your local machine
- First QR code scan links to your WhatsApp account
- Bridge maintains persistent connection to WhatsApp

## 🔒 Security

- No external servers involved
- Messages stored locally only
- Direct connection to your WhatsApp account
- All processing happens on your machine

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Contributions welcome! Please submit PRs for:
- WSL/Windows path translation improvements
- Additional WhatsApp features
- Bug fixes and optimizations

---

*Maintained by: hvkshmail*
*Original project: lharries/whatsapp-mcp*