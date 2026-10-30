const app = require('./app');
const env = require('./config/env');
const { connectMongo } = require('./config/db');
const { testPgConnection } = require('./config/pg');

async function startServer() {
  try {
    console.log('--- Starting InsightIQ Backend Server ---');

    // 1. Connect MongoDB
    await connectMongo();

    // 2. Verify PostgreSQL connection
    const pgOk = await testPgConnection();
    if (!pgOk) {
      console.warn('[Server Warning] PostgreSQL connection failed. Ensure PostgreSQL is running on port 5432 with insightiq database.');
    }

    // 3. Start Express HTTP Server
    const server = app.listen(env.PORT, () => {
      console.log(`🚀 InsightIQ Server listening on http://localhost:${env.PORT}`);
      console.log(`🔒 Environment: ${env.NODE_ENV}`);
      console.log(`🤖 AI Engine Mode: ${env.DEMO_MODE ? 'Demo Mode (Deterministic Engine)' : 'OpenAI Live'}`);
    });

    const shutdown = async () => {
      console.log('Shutting down InsightIQ server...');
      server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
