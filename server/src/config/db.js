const mongoose = require('mongoose');
const env = require('./env');

let memoryServerInstance = null;

async function connectMongo() {
  try {
    // First try configured URI
    console.log(`[Mongo] Connecting to MongoDB at ${env.MONGODB_URI}...`);
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 2500,
    });
    console.log('[Mongo] Successfully connected to MongoDB server.');
  } catch (err) {
    console.warn(`[Mongo] Connection to ${env.MONGODB_URI} failed: ${err.message}`);
    console.log('[Mongo] Initializing local MongoMemoryServer for development...');
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      memoryServerInstance = await MongoMemoryServer.create();
      const memoryUri = memoryServerInstance.getUri();
      console.log(`[Mongo] MongoMemoryServer started at ${memoryUri}`);
      await mongoose.connect(memoryUri);
      console.log('[Mongo] Successfully connected to in-memory MongoDB.');
    } catch (memErr) {
      console.error('[Mongo] Failed to start MongoMemoryServer:', memErr.message);
      throw memErr;
    }
  }
}

async function closeMongo() {
  await mongoose.disconnect();
  if (memoryServerInstance) {
    await memoryServerInstance.stop();
  }
}

module.exports = {
  connectMongo,
  closeMongo,
  mongoose
};
