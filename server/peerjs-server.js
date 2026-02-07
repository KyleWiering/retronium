const { PeerServer } = require('peer');
const http = require('http');

// Start PeerJS server on port 9000
const PEER_PORT = process.env.PORT || 9000;
const peerServer = PeerServer({
    port: PEER_PORT,
    path: '/peerjs',
    proxied: false,
    allow_discovery: true,
    // Increase timeouts for better reliability
    alive_timeout: 60000,
    expire_timeout: 5000,
    concurrent_limit: 5000,
    // Enable CORS for all origins
    corsOptions: {
        origin: '*',
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }
});

peerServer.on('connection', (client) => {
    console.log(`[${new Date().toISOString()}] Client connected: ${client.getId()}`);
});

peerServer.on('disconnect', (client) => {
    console.log(`[${new Date().toISOString()}] Client disconnected: ${client.getId()}`);
});

peerServer.on('message', (client, message) => {
    console.log(`[${new Date().toISOString()}] Message from ${client.getId()}: ${message && message.type}`);
});

peerServer.on('error', (error) => {
    console.error(`[${new Date().toISOString()}] PeerJS Server Error:`, error);
});

console.log(`[${new Date().toISOString()}] PeerJS Server running on port ${PEER_PORT}`);
console.log(`[${new Date().toISOString()}] Path: /peerjs`);

// Create a small HTTP server for health checks on a different port (9001)
const HEALTH_PORT = process.env.HEALTH_PORT || 9001;
const healthServer = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString(), peerPort: PEER_PORT }));
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

healthServer.listen(HEALTH_PORT, () => {
    console.log(`[${new Date().toISOString()}] Health endpoint listening on port ${HEALTH_PORT}`);
});
