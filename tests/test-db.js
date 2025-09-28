const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod;

module.exports.connect = async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, {
    dbName: "testdb",
  });
};

module.exports.clear = async () => {
  const { collections } = mongoose.connection;
  for (const name of Object.keys(collections)) {
    await collections[name].deleteMany({});
  }
};

module.exports.close = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongod) await mongod.stop();
};
