const mongoose = require('mongoose');
const app = require('./app');
const connectDB = require('./config/db');

const port = Number(process.env.PORT) || 3000;
let server;

async function start() {
  const secret = process.env.JWT_SECRET || '';
  if (!secret || secret === 'replace-with-a-long-random-secret') {
    throw new Error('JWT_SECRET must be set to a private random value');
  }

  await connectDB();
  server = app.listen(port, () => console.log(`API listening on port ${port}`));
}

async function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  if (server) server.close();
  await mongoose.disconnect();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((error) => {
  console.error(`Startup failed: ${error.message}`);
  process.exit(1);
});
