#!/usr/bin/env node
/**
 * Test script to verify WhatsApp MCP connection
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get Windows host IP for WSL2
function getWindowsHostIP() {
  if (process.platform === 'linux' && fs.existsSync('/etc/resolv.conf')) {
    try {
      const resolv = fs.readFileSync('/etc/resolv.conf', 'utf8');
      const match = resolv.match(/nameserver\s+(\d+\.\d+\.\d+\.\d+)/);
      if (match) {
        console.log(`Detected WSL2, using Windows host IP: ${match[1]}`);
        return match[1];
      }
    } catch (err) {
      console.error('Could not detect Windows host IP, using localhost');
    }
  }
  return 'localhost';
}

const BRIDGE_HOST = getWindowsHostIP();
const BRIDGE_PORT = 8080;

async function testHealthEndpoint() {
  console.log(`\nTesting health endpoint at http://${BRIDGE_HOST}:${BRIDGE_PORT}/api/health`);
  
  return new Promise((resolve) => {
    const req = http.get(`http://${BRIDGE_HOST}:${BRIDGE_PORT}/api/health`, {
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log('Health check response:', json);
          resolve(true);
        } catch (e) {
          console.error('Invalid JSON response:', data);
          resolve(false);
        }
      });
    });
    
    req.on('error', (err) => {
      console.error('Health check failed:', err.message);
      resolve(false);
    });
    
    req.on('timeout', () => {
      console.error('Health check timeout');
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  console.log('WhatsApp MCP Connection Test');
  console.log('=============================');
  console.log(`Platform: ${process.platform}`);
  console.log(`Bridge Host: ${BRIDGE_HOST}`);
  console.log(`Bridge Port: ${BRIDGE_PORT}`);
  
  // Test 1: Direct health check
  console.log('\n1. Testing direct connection to bridge...');
  const healthOk = await testHealthEndpoint();
  
  if (!healthOk) {
    console.log('\nBridge is not running. Starting it manually for testing...');
    
    const bridgePath = path.join(__dirname, 'whatsapp-bridge');
    const goCmd = process.platform === 'win32' ? 'go' : 'go.exe';
    
    console.log(`Running: ${goCmd} run main.go in ${bridgePath}`);
    
    const bridge = spawn(goCmd, ['run', 'main.go'], {
      cwd: bridgePath,
      env: { ...process.env, CGO_ENABLED: '1' },
      stdio: 'inherit',
      shell: process.platform !== 'win32'
    });
    
    bridge.on('error', (err) => {
      console.error('Failed to start bridge:', err);
    });
    
    // Wait a bit for bridge to start
    console.log('\nWaiting 5 seconds for bridge to start...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Test again
    console.log('\n2. Testing connection after starting bridge...');
    await testHealthEndpoint();
  }
}

main().catch(console.error);