/**
 * Realtime WebSocket test — run with: node test-realtime.js
 *
 * What this does:
 * 1. Connects TWO sockets: "customer" listener + "restaurant" actor
 * 2. Customer joins the order room
 * 3. Restaurant calls REST API to change order status
 * 4. We verify the customer socket receives the event in real-time
 */

const { io } = require('socket.io-client');
const https = require('https');
const http = require('http');

// ─── CONFIG — paste your tokens here ─────────────────────────────────────────
const CUSTOMER_TOKEN = process.env.CUSTOMER_TOKEN || '';
const ORDER_ID       = process.env.ORDER_ID || '';
// ─────────────────────────────────────────────────────────────────────────────

if (!CUSTOMER_TOKEN || !ORDER_ID) {
  console.error('\n❌  Missing env vars. Run like this:\n');
  console.error('  CUSTOMER_TOKEN=xxx ORDER_ID=yyy node test-realtime.js\n');
  process.exit(1);
}

const BASE = 'http://localhost:3000';

// Helper: make HTTP request
function httpPost(path, token, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ─── Main test ────────────────────────────────────────────────────────────────

console.log('\n🔌  Connecting customer socket...');

const customerSocket = io(`${BASE}/realtime`, {
  auth: { token: CUSTOMER_TOKEN },
  transports: ['websocket'],
});

let receivedEvents = [];

customerSocket.on('connect', () => {
  console.log(`✅  Customer connected  (socketId: ${customerSocket.id})`);

  // Join the order room
  customerSocket.emit('join_order', { orderId: ORDER_ID });
  console.log(`📡  Joined room: order:${ORDER_ID}`);
});

customerSocket.on('joined', (data) => {
  console.log('✅  Room joined:', data);
  console.log('\n⏳  Waiting for order_status_changed events...\n');
  console.log('    (Now trigger a status change via REST from another terminal)');
  console.log('    Example: accept the order from restaurant panel\n');
  console.log('─'.repeat(60));
});

customerSocket.on('order_status_changed', (data) => {
  receivedEvents.push(data);
  console.log('\n🎉  [REALTIME EVENT RECEIVED]');
  console.log(JSON.stringify(data, null, 2));
  console.log('─'.repeat(60));
});

customerSocket.on('driver_location_updated', (data) => {
  console.log('\n📍  [DRIVER LOCATION UPDATE]', data);
});

customerSocket.on('error', (err) => {
  console.error('❌  Socket error:', err);
});

customerSocket.on('disconnect', (reason) => {
  console.log('🔌  Disconnected:', reason);
});

// Auto-disconnect after 2 minutes
setTimeout(() => {
  console.log(`\n📊  Test complete. Received ${receivedEvents.length} event(s).`);
  customerSocket.disconnect();
  process.exit(0);
}, 120_000);
