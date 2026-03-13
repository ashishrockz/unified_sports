require('dotenv').config();
const http      = require('http');
const app       = require('./src/app');
const connectDB = require('./src/config/db');
const ws        = require('./src/websocket');
const { autoAbandonStaleMatches } = require('./src/modules/match/match.service');

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

    // Auto-abandon stale matches every hour (older than 18 hours)
    autoAbandonStaleMatches().catch(err => console.error('[AUTO-ABANDON] Error on startup:', err.message));
    setInterval(() => {
      autoAbandonStaleMatches().catch(err => console.error('[AUTO-ABANDON] Error:', err.message));
    }, 60 * 60 * 1000); // every 1 hour
  });
});

// Export for Vercel serverless
module.exports = app;
