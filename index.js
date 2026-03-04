require('dotenv').config();
const http      = require('http');
const app       = require('./src/app');
const connectDB = require('./src/config/db');
const ws        = require('./src/websocket');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

// Attach socket.io to the HTTP server
ws.init(server);

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log('  ┌─────────────────────────────────────────┐');
    console.log('  │         UNIFIED SPORTS API              │');
    console.log('  ├─────────────────────────────────────────┤');
    console.log(`  │  Server   : http://localhost:${PORT}        │`);
    console.log(`  │  API Docs : http://localhost:${PORT}/api/docs │`);
    console.log(`  │  WebSocket: ws://localhost:${PORT}           │`);
    console.log('  │  ENV      : ' + (process.env.NODE_ENV || 'development') + '                    │');
    console.log('  └─────────────────────────────────────────┘');
    console.log('');
  });
});
