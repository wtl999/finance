// Production entrypoint: start the Node backend from the modular app factory.
const { createApp } = require('./server');

const PORT = Number(process.env.PORT || 3000);

const app = createApp();

app.listen(PORT, () => {
  console.log(`[server] listening on http://127.0.0.1:${PORT}`);
});
