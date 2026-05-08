// Express app factory: keeps composition separate from the startup script.
const express = require('express');
const cors = require('cors');
const { registerRoutes } = require('./routes');

const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '8mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  registerRoutes(app);

  app.use((error, _req, res, _next) => {
    console.error('[server] unhandled error', error);
    res.status(500).json({
      success: false,
      message: 'internal error',
      detail: error?.stack || error?.message || String(error),
    });
  });

  return app;
};

module.exports = {
  createApp,
};
