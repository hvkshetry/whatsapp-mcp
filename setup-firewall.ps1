# PowerShell script to configure Windows Firewall for WhatsApp MCP Bridge
# Run as Administrator

Write-Host "Setting up Windows Firewall rules for WhatsApp MCP Bridge..." -ForegroundColor Green

# Remove any existing rules
Remove-NetFirewallRule -DisplayName "WhatsApp MCP Bridge" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "WhatsApp MCP Go Process" -ErrorAction SilentlyContinue

# Add firewall rule for go.exe
$goPath = (Get-Command go -ErrorAction SilentlyContinue).Source
if ($goPath) {
    Write-Host "Found Go at: $goPath" -ForegroundColor Cyan
    
    # Allow go.exe to accept incoming connections on port 8080
    New-NetFirewallRule -DisplayName "WhatsApp MCP Go Process" -Direction Inbound -Program $goPath -Action Allow -Protocol TCP -LocalPort 8080 -Profile Any
    
    Write-Host "[OK] Added firewall rule for go.exe" -ForegroundColor Green
} else {
    Write-Host "Warning: Could not find go.exe in PATH" -ForegroundColor Yellow
}

# Also add a general rule for port 8080 from WSL subnet
# WSL2 typically uses 172.16.0.0/12 range
New-NetFirewallRule -DisplayName "WhatsApp MCP Bridge" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8080 -RemoteAddress "172.16.0.0/12", "10.0.0.0/8", "LocalSubnet" -Profile Any

Write-Host "[OK] Added firewall rule for port 8080 from WSL" -ForegroundColor Green

# Verify rules were created
$rules = Get-NetFirewallRule -DisplayName "WhatsApp MCP*" -ErrorAction SilentlyContinue
if ($rules) {
    Write-Host "`nFirewall rules created successfully:" -ForegroundColor Green
    $rules | ForEach-Object { Write-Host "  - $($_.DisplayName)" -ForegroundColor Cyan }
} else {
    Write-Host "Warning: Failed to verify firewall rules" -ForegroundColor Yellow
}

Write-Host "`nSetup complete! The WhatsApp MCP Bridge should now be accessible from WSL." -ForegroundColor Green
Write-Host "You may need to restart the WhatsApp MCP server for changes to take effect." -ForegroundColor Yellow