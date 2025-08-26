# WhatsApp MCP Bridge Auto-Start Setup Script
# Run as Administrator to create a Windows Task Scheduler task

$ErrorActionPreference = "Stop"

# Get the current directory and username
$currentPath = Get-Location
$userName = $env:USERNAME
$bridgePath = Join-Path $currentPath "whatsapp-bridge\main.exe"
$workingDir = Join-Path $currentPath "whatsapp-bridge"
$logPath = Join-Path $workingDir "whatsapp-bridge.log"

# Check if main.exe exists
if (-not (Test-Path $bridgePath)) {
    Write-Host "Error: main.exe not found at $bridgePath" -ForegroundColor Red
    Write-Host "Please build the Go bridge first with: go build -o main.exe main.go" -ForegroundColor Yellow
    exit 1
}

Write-Host "WhatsApp MCP Bridge Auto-Start Setup" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Bridge Path: $bridgePath" -ForegroundColor Cyan
Write-Host "Working Dir: $workingDir" -ForegroundColor Cyan
Write-Host "Log Path: $logPath" -ForegroundColor Cyan
Write-Host ""

# Create the scheduled task
$taskName = "WhatsAppMCPBridge"
$taskDescription = "Starts the WhatsApp MCP Go Bridge at system startup"

# Check if task already exists
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Task '$taskName' already exists. Updating..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Create the action
$action = New-ScheduledTaskAction -Execute $bridgePath -WorkingDirectory $workingDir

# Create the trigger (at system startup with 30 second delay)
$trigger = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = "PT30S"  # 30 second delay to ensure system is ready

# Create the principal (run with highest privileges, whether user logged in or not)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$userName" `
    -LogonType ServiceAccount -RunLevel Highest

# Create settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
    -Hidden

# Register the task
try {
    Register-ScheduledTask -TaskName $taskName `
        -Description $taskDescription `
        -Action $action `
        -Trigger $trigger `
        -Principal $principal `
        -Settings $settings `
        -Force | Out-Null
    
    Write-Host "✓ Task '$taskName' created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "The WhatsApp bridge will now start automatically when Windows starts." -ForegroundColor Cyan
    Write-Host ""
    
    # Ask if user wants to start the task now
    $startNow = Read-Host "Do you want to start the bridge now? (Y/N)"
    if ($startNow -eq 'Y' -or $startNow -eq 'y') {
        Start-ScheduledTask -TaskName $taskName
        Write-Host "✓ WhatsApp bridge started!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Check the bridge status with:" -ForegroundColor Yellow
        Write-Host "  curl http://localhost:8080/api/health" -ForegroundColor White
    }
    
    Write-Host ""
    Write-Host "To manage the task later:" -ForegroundColor Yellow
    Write-Host "  View:    Get-ScheduledTask -TaskName '$taskName'" -ForegroundColor White
    Write-Host "  Start:   Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor White
    Write-Host "  Stop:    Stop-ScheduledTask -TaskName '$taskName'" -ForegroundColor White
    Write-Host "  Remove:  Unregister-ScheduledTask -TaskName '$taskName'" -ForegroundColor White
    
} catch {
    Write-Host "Error creating scheduled task: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please ensure you're running this script as Administrator." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Setup complete!" -ForegroundColor Green