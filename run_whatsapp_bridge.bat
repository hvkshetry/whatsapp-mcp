@echo off
cd /d "C:\Users\hvksh\mcp-servers\whatsapp-mcp\whatsapp-bridge"
go env -w CGO_ENABLED=1
go run main.go
pause
