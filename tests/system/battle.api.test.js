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

// ----------------- GQL Docs -----------------
const ADD_USER = `
  mutation($email:String!,$username:String!,$password:String!){
    addUser(email:$email, username:$username, password:$password){
      token user{ _id username }
    }
  }`;

const UPDATE_DRAFT = `
  mutation($won:Boolean!){
    updateDraftGameStats(won:$won){
      draftGamesPlayed
      draftGameWins
      draftGameLosses
    }
  }`;

// intentionally non-existent (assert absence)
const START_BATTLE = `mutation { startBattle { id state } }`;

// ----------------- Helpers -----------------
function parsePayload(res) {
  if (res.body && Object.keys(res.body).length) return res.body;
  try {
    return JSON.parse(res.text);
  } catch {
    return {};
  }
}

function expectGraphQLErrorOr400(res, messageRegex) {
  // Some setups return 400, some 200+errors, some 500. Accept all and prove it's an error.
  const acceptable = [200, 400, 401, 403, 500];
  expect(acceptable).toContain(res.status);

  const body = parsePayload(res);

  if (Array.isArray(body.errors)) {
    // Should mention unknown field/mutation
    const msg = body.errors[0]?.message || "";
    if (messageRegex) {
      expect(msg).toMatch(messageRegex);
    } else {
      // generic fallback
      expect(msg.toLowerCase()).toMatch(/unknown|cannot query field/);
    }
  } else {
    // No 'errors' array: ensure it's not a success shape
    // If data exists with the tested field, it must be null/undefined
    if (
      body.data &&
      Object.prototype.hasOwnProperty.call(body.data, "startBattle")
    ) {
      expect(body.data.startBattle == null).toBe(true);
    } else {
      // Final fallback: status should indicate error
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  }
}

// ----------------- Tests -----------------

test("API does not expose battle mutations (startBattle/battleTurn/endBattle)", async () => {
  const res = await gql(START_BATTLE);
  // Uncomment one-time if you need to see raw output:
  // console.log("START_BATTLE:", res.status, res.text || JSON.stringify(res.body, null, 2));
  expectGraphQLErrorOr400(res, /Cannot query field "startBattle"|Unknown/i);
});

test("win/loss can still be recorded via updateDraftGameStats", async () => {
  // register & get token
  const add = await gql(ADD_USER, {
    email: "b@e.com",
    username: "battler",
    password: "P@ssw0rd!",
  });

  // Guard: ensure addUser succeeded before reading body
  if (add.status !== 200) {
    // Helpful debug if anything fails again
    throw new Error(
      `addUser failed: ${add.status} ${
        add.text || JSON.stringify(add.body, null, 2)
      }`
    );
  }

  const token = add.body?.data?.addUser?.token;
  expect(token).toBeDefined();

  const win = await gql(UPDATE_DRAFT, { won: true }, token);
  expect(win.status).toBe(200);
  expect(win.body.data.updateDraftGameStats.draftGamesPlayed).toBe(1);
  expect(win.body.data.updateDraftGameStats.draftGameWins).toBe(1);
  expect(win.body.data.updateDraftGameStats.draftGameLosses).toBe(0);

  const loss = await gql(UPDATE_DRAFT, { won: false }, token);
  expect(loss.status).toBe(200);
  expect(loss.body.data.updateDraftGameStats.draftGamesPlayed).toBe(2);
  expect(loss.body.data.updateDraftGameStats.draftGameWins).toBe(1);
  expect(loss.body.data.updateDraftGameStats.draftGameLosses).toBe(1);
});
