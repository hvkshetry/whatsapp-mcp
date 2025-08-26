#!/usr/bin/env node
/**
 * WhatsApp Session Check Utility
 * 
 * Simple utility to verify WhatsApp session status
 */

const fs = require('fs');
const path = require('path');

const SESSION_DB_PATH = path.join(__dirname, 'whatsapp-bridge', 'store', 'whatsapp.db');
const MESSAGE_DB_PATH = path.join(__dirname, 'whatsapp-bridge', 'store', 'messages.db');

function checkSession() {
  console.log('WhatsApp Session Status Check');
  console.log('==============================\n');
  
  // Check main session database
  if (fs.existsSync(SESSION_DB_PATH)) {
    const stats = fs.statSync(SESSION_DB_PATH);
    const lastModified = new Date(stats.mtime);
    const daysSinceModified = (Date.now() - lastModified) / (1000 * 60 * 60 * 24);
    
    console.log('✅ Session database found');
    console.log(`   Path: ${SESSION_DB_PATH}`);
    console.log(`   Last modified: ${lastModified.toLocaleString()}`);
    console.log(`   Days since last activity: ${daysSinceModified.toFixed(1)} days`);
    
    if (daysSinceModified > 20) {
      console.log('\n⚠️  WARNING: Session may be expired (>20 days old)');
      console.log('   You may need to re-authenticate with QR code');
    } else {
      console.log('\n✅ Session appears to be valid');
    }
  } else {
    console.log('❌ No session database found');
    console.log(`   Expected at: ${SESSION_DB_PATH}`);
    console.log('\n   To authenticate:');
    console.log('   1. cd /mnt/c/Users/hvksh/mcp-servers/whatsapp-mcp/whatsapp-bridge');
    console.log('   2. go run main.go');
    console.log('   3. Scan the QR code with WhatsApp on your phone');
  }
  
  // Check message database
  console.log('\n' + '='.repeat(30) + '\n');
  if (fs.existsSync(MESSAGE_DB_PATH)) {
    const stats = fs.statSync(MESSAGE_DB_PATH);
    console.log('✅ Message database found');
    console.log(`   Path: ${MESSAGE_DB_PATH}`);
    console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
  } else {
    console.log('📝 No message database found (will be created on first use)');
  }
  
  console.log('\n' + '='.repeat(30));
  console.log('\nTo start WhatsApp MCP Server:');
  console.log('  node /mnt/c/Users/hvksh/mcp-servers/whatsapp-mcp/index.js');
}

// Run check
checkSession();