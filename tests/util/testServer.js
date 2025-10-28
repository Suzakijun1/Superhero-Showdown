// tests/util/testServer.js
//
// Test harness for spinning up an Express + Apollo instance backed by
// an in-memory MongoDB for Jest system/integration tests.
//
// Exports:
//   - startApolloForTest()
//   - stopApolloForTest()
//   - gql(query, variables?, token?)
//
// Relies on:
//   - tests/util/test-db.js  (your in-memory MongoDB helper)
//   - server/schemas/index.js exporting { typeDefs, resolvers }
//   - server/utils/auth.js exporting getUserFromReq (or similar)

const express = require("express");
const request = require("supertest");
const { ApolloServer } = require("apollo-server-express");
const { typeDefs, resolvers } = require("../../server/schemas");
const { getUserFromReq } = require("../../server/utils/auth");
// If you actually export authMiddleware instead, swap this out and see the note below.

const testDb = require("../test-db");

let app;
let apolloServer;
let isStarted = false;

// Build Apollo context, same shape your resolvers expect.
function makeContextFn() {
  return async ({ req }) => {
    const user = getUserFromReq(req); // returns null or {_id,email,username}
    return { user };
  };
}

async function startApolloForTest() {
  if (isStarted) return;

  // 1. Connect to in-memory Mongo
  await testDb.connect();

  // 2. Create a fresh Express app
  app = express();
  // IMPORTANT: do NOT call app.use(express.json()) here.
  // Apollo will attach its own body parser for /graphql.
  // Adding another JSON parser here caused "stream is not readable".

  // 3. Spin up Apollo server
  apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    context: makeContextFn(),
  });

  await apolloServer.start();

  // 4. Attach Apollo middleware at /graphql
  // We do NOT pass bodyParserConfig: false here because we actually
  // want Apollo to handle parsing. Since we did NOT attach express.json()
  // above, there's no double-parse now.
  apolloServer.applyMiddleware({ app, path: "/graphql" });

  isStarted = true;
}

async function stopApolloForTest() {
  if (!isStarted) return;

  // stop Apollo
  if (apolloServer) {
    await apolloServer.stop();
  }

  // close in-memory Mongo
  await testDb.close();

  // reset globals
  apolloServer = null;
  app = null;
  isStarted = false;
}

// Helper to send a GraphQL operation with Supertest
async function gql(query, variables = {}, token) {
  if (!isStarted || !app) {
    throw new Error(
      "Test server not started. Call startApolloForTest() in beforeAll."
    );
  }

  const httpReq = request(app)
    .post("/graphql")
    .send({ query, variables })
    .set("Content-Type", "application/json");

  if (token) {
    httpReq.set("Authorization", `Bearer ${token}`);
  }

  return httpReq;
}

module.exports = {
  startApolloForTest,
  stopApolloForTest,
  gql,
};
