const request = require("supertest");
const { connect, clear, close } = require("../test-db");
const mongoose = require("mongoose");

let app, initApollo;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
  await connect();
  ({ app, initApollo } = require("../../server/server"));
  await initApollo();
});

afterEach(async () => {
  await clear();
});
afterAll(async () => {
  await close();
  await mongoose.disconnect();
});

const gql = (query, variables = {}, token) => {
  const req = request(app).post("/graphql").send({ query, variables });
  if (token) req.set("Authorization", `Bearer ${token}`);
  return req;
};

const UPDATE_HL = `
  mutation($streak:Int!){
    updateHigherLowerHighestScore(streak:$streak){
      _id higherLowerGamesPlayed higherLowerGameHighestScore
    }
  }`;

const UPDATE_DRAFT = `
  mutation($won:Boolean!){
    updateDraftGameStats(won:$won){
      _id draftGamesPlayed draftGameWins draftGameLosses
    }
  }`;

// Helper: try to read JSON from res.text if res.body is empty
function parsePayload(res) {
  if (res.body && Object.keys(res.body).length) return res.body;
  try {
    return JSON.parse(res.text);
  } catch {
    return {};
  }
}

// Accept 200/400/401/403/500 and assert the mutation did NOT succeed
function expectUnauthRejected(res, fieldName) {
  const acceptable = [200, 400, 401, 403, 500];
  expect(acceptable).toContain(res.status);

  const body = parsePayload(res);

  // If GraphQL formatted error
  if (body.errors && Array.isArray(body.errors)) {
    const msg = (body.errors[0]?.message || "").toLowerCase();
    // Your resolvers use "Not authenticated" and "Not Logged In!"
    expect(
      msg.includes("not authenticated") ||
        msg.includes("not logged in") ||
        msg.includes("unauthorized")
    ).toBe(true);
    // If data exists, field should be null/undefined
    if (
      body.data &&
      Object.prototype.hasOwnProperty.call(body.data, fieldName)
    ) {
      expect(body.data[fieldName] == null).toBe(true);
    }
    return;
  }

  // If no errors array, then ensure mutation result is null/undefined
  if (body.data && Object.prototype.hasOwnProperty.call(body.data, fieldName)) {
    expect(body.data[fieldName] == null).toBe(true);
    return;
  }

  // As a final fallback (e.g., raw 500), just assert it's not a success payload
  expect(res.status).toBeGreaterThanOrEqual(400);
}

test("updateHigherLowerHighestScore rejects when unauthenticated", async () => {
  const res = await gql(UPDATE_HL, { streak: 7 });
  // Uncomment for one-time debugging:
  // console.log(res.status, res.text || JSON.stringify(res.body, null, 2));
  expectUnauthRejected(res, "updateHigherLowerHighestScore");
});

test("updateDraftGameStats rejects when unauthenticated", async () => {
  const res = await gql(UPDATE_DRAFT, { won: true });
  // console.log(res.status, res.text || JSON.stringify(res.body, null, 2));
  expectUnauthRejected(res, "updateDraftGameStats");
});
