/**
 * US-08: Profile must display updated Draft stats (games played, wins, losses).
 * Uses your existing mutations:
 *   updateDraftGameStats(won: Boolean!): User
 * And query:
 *   me: User
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
      token user{ _id username draftGamesPlayed draftGameWins draftGameLosses }
    }
  }`;

const UPDATE_DRAFT = `
  mutation($won:Boolean!){
    updateDraftGameStats(won:$won){
      _id draftGamesPlayed draftGameWins draftGameLosses
    }
  }`;

const ME = `query{ me{ username draftGamesPlayed draftGameWins draftGameLosses } }`;

test("profile reflects updated draft stats after wins and losses", async () => {
  const add = await gql(ADD_USER, {
    email: "p@e.com",
    username: "player",
    password: "P@ssw0rd!",
  });
  const token = add.body.data.addUser.token;

  // simulate a win, then a loss
  const win = await gql(UPDATE_DRAFT, { won: true }, token);
  expect(win.body.data.updateDraftGameStats.draftGamesPlayed).toBe(1);
  expect(win.body.data.updateDraftGameStats.draftGameWins).toBe(1);
  expect(win.body.data.updateDraftGameStats.draftGameLosses).toBe(0);

  const loss = await gql(UPDATE_DRAFT, { won: false }, token);
  expect(loss.body.data.updateDraftGameStats.draftGamesPlayed).toBe(2);
  expect(loss.body.data.updateDraftGameStats.draftGameWins).toBe(1);
  expect(loss.body.data.updateDraftGameStats.draftGameLosses).toBe(1);

  // profile (me) should display the same numbers
  const me = await gql(ME, {}, token);
  expect(me.body.data.me.draftGamesPlayed).toBe(2);
  expect(me.body.data.me.draftGameWins).toBe(1);
  expect(me.body.data.me.draftGameLosses).toBe(1);
});
