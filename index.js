#!/usr/bin/env node
/**
 * WhatsApp MCP Server - Headless Wrapper
 * 
 * This wrapper manages both the Go WhatsApp bridge and Python MCP server
 * to provide seamless headless operation after initial QR authentication.
 */

const { spawn, execSync } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Get Windows host IP for WSL2
function getWindowsHostIP() {
  // Check if running in WSL
  if (process.platform === 'linux' && fs.existsSync('/proc/sys/fs/binfmt_misc/WSLInterop')) {
    // In WSL2, we need to use the Windows host IP
    // The WSL adapter typically uses 172.x.x.1
    try {
      // Try to get the default gateway which is the Windows host
      const { execSync } = require('child_process');
      const gateway = execSync("ip route show | grep default | awk '{print $3}'", { encoding: 'utf8' }).trim();
      if (gateway && gateway.match(/^\d+\.\d+\.\d+\.\d+$/)) {
        console.error(`[WHATSAPP-MCP] Detected WSL2, using Windows host IP: ${gateway}`);
        return gateway;
      }
    } catch (err) {
      // Fallback to common WSL2 host IPs
      const fallbackIPs = ['172.30.48.1', '172.31.240.1', '172.28.0.1'];
      for (const ip of fallbackIPs) {
        try {
          execSync(`timeout 1 nc -zv ${ip} 8080 2>/dev/null`, { encoding: 'utf8' });
          console.error(`[WHATSAPP-MCP] Detected WSL2, using Windows host IP: ${ip}`);
          return ip;
        } catch (e) {
          // Try next IP
        }
      }
    }
    console.error('[WHATSAPP-MCP] Could not detect Windows host IP, using localhost');
  }
  return 'localhost';
}

const BRIDGE_PORT = 8080;
const BRIDGE_HOST = getWindowsHostIP();
const MAX_RETRIES = 20;  // Reduced from 30 since binary starts faster
const RETRY_DELAY = 500;  // Reduced from 1000ms to 500ms
const SESSION_DB_PATH = path.join(__dirname, 'whatsapp-bridge', 'store', 'whatsapp.db');
const LOCK_FILE_PATH = path.join(__dirname, '.whatsapp-mcp.lock');

// Check if session exists
function checkSession() {
  return fs.existsSync(SESSION_DB_PATH);
}

// Wait for REST API to be available
async function waitForPort(port, host, maxRetries = MAX_RETRIES) {
  const http = require('http');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Try to call the health endpoint
      const response = await new Promise((resolve, reject) => {
        const req = http.get(`http://${host}:${port}/api/health`, {
          timeout: 2000
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              resolve(json);
            } catch (e) {
              reject(new Error('Invalid JSON response'));
            }
          });
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
      });
      
      console.error(`[WHATSAPP-MCP] REST API ready on port ${port} (status: ${response.status})`);
      return true;
    } catch (err) {
      console.error(`[WHATSAPP-MCP] Waiting for API... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
  return false;
}

// Start the Go WhatsApp Bridge
function startBridge() {
  console.error('[WHATSAPP-MCP] Starting WhatsApp Bridge...');
  
  const bridgePath = path.join(__dirname, 'whatsapp-bridge');
  
  // Check if compiled binary exists
  const binaryPath = path.join(bridgePath, 'main.exe');
  const binaryExists = fs.existsSync(binaryPath);
  
  let bridgeCmd, bridgeArgs;
  
  if (binaryExists) {
    // Use compiled binary for faster startup
    console.error('[WHATSAPP-MCP] Using compiled binary for faster startup');
    bridgeCmd = binaryPath;
    bridgeArgs = [];
  } else {
    // Fall back to go run
    console.error('[WHATSAPP-MCP] Compiled binary not found, using go run (slower)');
    const goCmd = process.platform === 'win32' ? 'go' : 'go.exe';
    bridgeCmd = goCmd;
    bridgeArgs = ['run', 'main.go'];
  }
  
  console.error(`[WHATSAPP-MCP] Bridge command: ${bridgeCmd}`);
  console.error(`[WHATSAPP-MCP] Bridge path: ${bridgePath}`);
  
  const bridge = spawn(bridgeCmd, bridgeArgs, {
    cwd: bridgePath,
    env: { ...process.env, CGO_ENABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform !== 'win32' // Use shell on non-Windows platforms
  });
  
  // Log bridge output to stderr (for debugging)
  bridge.stdout.on('data', (data) => {
    const output = data.toString();
    // Log all output for debugging
    console.error(`[BRIDGE STDOUT] ${output.trim()}`);
  });
  
  bridge.stderr.on('data', (data) => {
    console.error(`[BRIDGE ERROR] ${data.toString().trim()}`);
  });
  
  bridge.on('error', (err) => {
    console.error('[WHATSAPP-MCP] Failed to start bridge:', err);
    process.exit(1);
  });
  
  bridge.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[WHATSAPP-MCP] Bridge exited with code ${code}`);
      process.exit(code);
    }
  });
  
  return bridge;
}

// Start the Python MCP Server
function startMCPServer() {
  console.error('[WHATSAPP-MCP] Starting MCP Server...');
  
  const serverPath = path.join(__dirname, 'whatsapp-mcp-server');
  // Use virtual environment Python
  const pythonCmd = path.join(serverPath, '.venv', 'bin', 'python');
  const mcp = spawn(pythonCmd, ['main.py'], {
    cwd: serverPath,
    stdio: 'inherit' // Pass through stdio for MCP communication
  });
  
  mcp.on('error', (err) => {
    console.error('[WHATSAPP-MCP] Failed to start MCP server:', err);
    process.exit(1);
  });
  
  mcp.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[WHATSAPP-MCP] MCP server exited with code ${code}`);
      process.exit(code);
    }
  });
  
  return mcp;
}

// Kill any existing WhatsApp bridge processes
function killExistingBridges() {
  try {
    // Kill Windows Go processes
    execSync('powershell.exe -c "Get-Process | Where-Object { \\$_.Name -like \'main\' } | Stop-Process -Force" 2>nul', { 
      stdio: 'ignore',
      windowsHide: true 
    });
    console.error('[WHATSAPP-MCP] Cleaned up existing bridge processes');
  } catch (err) {
    // No processes to kill, this is fine
  }
}

// Check if port is in use
function isPortInUse(port, host) {
  return new Promise((resolve) => {
    const tester = net.createConnection({ port, host }, () => {
      tester.end();
      resolve(true);
    }).on('error', () => {
      resolve(false);
    });
  });
}

// Main execution
async function main() {
  console.error('[WHATSAPP-MCP] WhatsApp MCP Server starting...');
  
  // TEMPORARILY DISABLED - Lock file check was causing issues in WSL
  // TODO: Re-enable with proper timestamp-based stale detection
  /*
  // Check for existing lock file
  if (fs.existsSync(LOCK_FILE_PATH)) {
    const existingPid = fs.readFileSync(LOCK_FILE_PATH, 'utf8');
    console.error(`[WHATSAPP-MCP] Lock file found with PID ${existingPid}`);
    
    // Check if the process is still running
    try {
      process.kill(existingPid, 0); // Signal 0 tests if process exists
      console.error('[WHATSAPP-MCP] Another instance is already running');
      console.error('[WHATSAPP-MCP] Use /mcp to disconnect and reconnect, or manually remove lock file');
      process.exit(1);
    } catch (e) {
      // Process doesn't exist, remove stale lock
      console.error('[WHATSAPP-MCP] Previous instance crashed, removing stale lock');
      fs.unlinkSync(LOCK_FILE_PATH);
    }
  }
  
  // Create lock file with current PID
  fs.writeFileSync(LOCK_FILE_PATH, process.pid.toString());
  console.error(`[WHATSAPP-MCP] Created lock file with PID ${process.pid}`);
  */
  
  // First check if a valid bridge is already running
  let reuseExistingBridge = false;
  const portInUse = await isPortInUse(BRIDGE_PORT, BRIDGE_HOST);
  if (portInUse) {
    console.error('[WHATSAPP-MCP] Port 8080 is in use, checking if it\'s our WhatsApp bridge...');
    
    try {
      // Check if it's actually our WhatsApp bridge
      const http = require('http');
      const healthCheck = await new Promise((resolve, reject) => {
        const req = http.get(`http://${BRIDGE_HOST}:${BRIDGE_PORT}/api/health`, { timeout: 2000 }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              resolve(json);
            } catch (e) {
              resolve(null);
            }
          });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => {
          req.destroy();
          resolve(null);
        });
      });
      
      if (healthCheck && healthCheck.service === 'whatsapp-bridge' && healthCheck.status === 'connected') {
        console.error('[WHATSAPP-MCP] ✓ Found existing WhatsApp bridge, status: connected');
        console.error('[WHATSAPP-MCP] Reusing existing bridge on port 8080');
        reuseExistingBridge = true;
      } else if (healthCheck && healthCheck.service === 'whatsapp-bridge') {
        console.error('[WHATSAPP-MCP] Found WhatsApp bridge but not connected, will restart...');
      } else {
        console.error('[WHATSAPP-MCP] Port 8080 used by unknown service, will clean up...');
      }
    } catch (e) {
      console.error('[WHATSAPP-MCP] Could not check service on port 8080:', e.message);
    }
  }
  
  // Only kill bridge if we're not reusing it
  if (!reuseExistingBridge) {
    // Kill any existing bridge processes
    killExistingBridges();
    
    // Check if port is free after cleanup
    const portStillInUse = await isPortInUse(BRIDGE_PORT, BRIDGE_HOST);
    if (portStillInUse) {
      console.error('[WHATSAPP-MCP] WARNING: Port 8080 still in use after cleanup');
      console.error('[WHATSAPP-MCP] Waiting for port to be released...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Check session status
  if (!checkSession()) {
    console.error('[WHATSAPP-MCP] ⚠️  No WhatsApp session found!');
    console.error('[WHATSAPP-MCP] Please run the following command to authenticate:');
    console.error('[WHATSAPP-MCP]   cd /mnt/c/Users/hvksh/mcp-servers/whatsapp-mcp/whatsapp-bridge && go run main.go');
    console.error('[WHATSAPP-MCP] Scan the QR code with WhatsApp, then restart this server.');
    
    // Still start the services to allow initial authentication
    console.error('[WHATSAPP-MCP] Starting services for initial setup...');
  } else {
    console.error('[WHATSAPP-MCP] ✓ WhatsApp session found, starting in headless mode');
  }
  
  let bridge, mcpServer;
  let initTimeout;
  
  if (reuseExistingBridge) {
    // Skip bridge startup, just start MCP server
    console.error('[WHATSAPP-MCP] Skipping bridge startup, using existing bridge');
    
    // Start the Python MCP server
    mcpServer = startMCPServer();
    
    console.error('[WHATSAPP-MCP] All services started successfully');
  } else {
    // Start the Go bridge
    bridge = startBridge();
    
    // Set initialization timeout (45 seconds total)
    initTimeout = setTimeout(() => {
      console.error('[WHATSAPP-MCP] ERROR: Initialization timeout after 45 seconds');
      console.error('[WHATSAPP-MCP] The server appears to be hanging during startup');
      if (bridge) bridge.kill();
      killExistingBridges();
      process.exit(1);
    }, 45000);
    
    // Track process for cleanup
    let bridgePid = bridge.pid;
    
    // Wait for bridge REST API to be ready
    const apiReady = await waitForPort(BRIDGE_PORT, BRIDGE_HOST);
    if (!apiReady) {
      clearTimeout(initTimeout);
      console.error('[WHATSAPP-MCP] Bridge REST API failed to start');
      bridge.kill();
      killExistingBridges(); // Ensure cleanup
      process.exit(1);
    }
    
    // Start the Python MCP server
    mcpServer = startMCPServer();
    
    // Clear timeout on successful start
    clearTimeout(initTimeout);
    console.error('[WHATSAPP-MCP] Initialization completed successfully');
  }
  
  // Handle shutdown with comprehensive cleanup
  const cleanup = (code = 0) => {
    console.error('[WHATSAPP-MCP] Shutting down...');
    
    // Kill child processes
    if (mcpServer && !mcpServer.killed) {
      try {
        mcpServer.kill('SIGTERM');
      } catch (e) {
        // Process already dead
      }
    }
    
    if (bridge && !bridge.killed) {
      try {
        bridge.kill('SIGTERM');
      } catch (e) {
        // Process already dead
      }
    }
    
    // Force kill any remaining Windows processes
    killExistingBridges();
    
    // TEMPORARILY DISABLED - Lock file removal
    /*
    // Remove lock file
    if (fs.existsSync(LOCK_FILE_PATH)) {
      try {
        fs.unlinkSync(LOCK_FILE_PATH);
        console.error('[WHATSAPP-MCP] Removed lock file');
      } catch (e) {
        // Lock file already gone
      }
    }
    */
    
    // Only exit if not already exiting
    if (code !== null) {
      process.exit(code);
    }
  };
  
  // Set up multiple cleanup handlers
  process.on('SIGINT', () => cleanup(0));
  process.on('SIGTERM', () => cleanup(0));
  process.on('SIGHUP', () => cleanup(0));
  process.on('uncaughtException', (err) => {
    console.error('[WHATSAPP-MCP] Uncaught exception:', err);
    cleanup(1);
  });
  process.on('unhandledRejection', (err) => {
    console.error('[WHATSAPP-MCP] Unhandled rejection:', err);
    cleanup(1);
  });
  
  // Cleanup on exit but don't call exit again
  process.on('exit', () => cleanup(null));
  
  console.error('[WHATSAPP-MCP] All services started successfully');
}

// Run main function
main().catch(err => {
  console.error('[WHATSAPP-MCP] Fatal error:', err);
  process.exit(1);
});