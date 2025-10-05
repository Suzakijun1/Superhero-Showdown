const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod = null;

mongoose.set("bufferCommands", false); // don't queue ops before connect

async function startMongoOnce() {
  if (mongod) return mongod;
  mongod = await MongoMemoryServer.create({
    // Optional: persist the binary so it doesn't re-download every run
    downloadDir: process.env.MONGOMS_DOWNLOAD_DIR,
  });
  return mongod;
}

module.exports.connect = async () => {
  await startMongoOnce();
  const uri = mongod.getUri();

  // If already connected, reuse
  if (mongoose.connection.readyState === 1) return;

  await mongoose.connect(uri, {
    dbName: "jest",
    // Trim timeouts so failures surface quickly
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 20000,
    maxPoolSize: 5,
  });
};

module.exports.clear = async () => {
  if (mongoose.connection.readyState !== 1) return;

  const { collections } = mongoose.connection;
  const tasks = Object.values(collections).map((c) => c.deleteMany({}));
  await Promise.all(tasks);
};

module.exports.close = async () => {
  // Only attempt DB ops if connected
  if (mongoose.connection.readyState === 1) {
    try {
      // Drop database is nice-to-have; don't let it hang teardown
      await mongoose.connection.dropDatabase();
    } catch (e) {
      // ignore—db might not be fully ready or already dropped
    }
  }

  // Disconnect if not already
  if (mongoose.connection.readyState !== 0) {
    try {
      await mongoose.disconnect();
    } catch (_) {}
  }

  // Stop the memory server last
  if (mongod) {
    try {
      await mongod.stop();
    } catch (_) {}
    mongod = null;
  }
};
