/**
 * US-07 within current schema:
 *  - No battle mutations exist (startBattle/battleTurn/endBattle) -> assert absence.
 *  - Win/Loss recording IS supported through updateDraftGameStats(won:Boolean!).
 */

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

const ME = `query { me { draftGamesPlayed draftGameWins draftGameLosses } }`;

test("API does not expose battle mutations (startBattle/battleTurn/endBattle)", async () => {
  const START = `mutation { startBattle { id state } }`;
  const res = await gql(START);

  if (res.status === 400) {
    expect(res.body.errors || res.error).toBeTruthy();
  } else {
    expect(res.body.errors).toBeTruthy();
    expect(res.body.errors[0].message).toMatch(
      /Cannot query field "startBattle"|Unknown/i
    );
  }
});

test("win/loss can still be recorded via updateDraftGameStats", async () => {
  // register & get token
  const add = await gql(ADD_USER, {
    email: "b@e.com",
    username: "battler",
    password: "P@ssw0rd!",
  });
  const token = add.body.data.addUser.token;

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

  const me = await gql(ME, {}, token);
  expect(me.body.data.me.draftGamesPlayed).toBe(2);
  expect(me.body.data.me.draftGameWins).toBe(1);
  expect(me.body.data.me.draftGameLosses).toBe(1);
});
