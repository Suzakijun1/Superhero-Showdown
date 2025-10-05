jest.setTimeout(120000);
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
  mutation AddUser($email:String!,$username:String!,$password:String!){
    addUser(email:$email, username:$username, password:$password){
      token
      user{ _id email username higherLowerGamesPlayed higherLowerGameHighestScore draftGamesPlayed draftGameWins draftGameLosses }
    }
  }`;

const UPDATE_HL = `
  mutation HL($streak:Int!){
    updateHigherLowerHighestScore(streak:$streak){
      _id
      higherLowerGameHighestScore
      higherLowerGamesPlayed
    }
  }`;

const UPDATE_DRAFT = `
  mutation Draft($won:Boolean!){
    updateDraftGameStats(won:$won){
      _id
      draftGamesPlayed
      draftGameWins
      draftGameLosses
    }
  }`;

describe("Stats mutations (Higher/Lower & Draft)", () => {
  const register = async () => {
    const res = await gql(ADD_USER, {
      email: "hl@example.com",
      username: "hluser",
      password: "P@ssword1",
    });
    return res.body.data.addUser.token;
  };

  test("updateHigherLowerHighestScore requires auth", async () => {
    const unauth = await gql(UPDATE_HL, { streak: 7 });
    expect(unauth.body.errors).toBeTruthy();
  });

  test("updateHigherLowerHighestScore updates high score and increments games played (if your resolver does that)", async () => {
    const token = await register();
    const res1 = await gql(UPDATE_HL, { streak: 5 }, token);
    expect(res1.status).toBe(200);
    expect(
      res1.body.data.updateHigherLowerHighestScore.higherLowerGameHighestScore
    ).toBe(5);

    // Submit a lower streak — high score should NOT go down
    const res2 = await gql(UPDATE_HL, { streak: 3 }, token);
    expect(res2.status).toBe(200);
    expect(
      res2.body.data.updateHigherLowerHighestScore.higherLowerGameHighestScore
    ).toBe(5);

    // Submit a higher streak — should update
    const res3 = await gql(UPDATE_HL, { streak: 8 }, token);
    expect(res3.status).toBe(200);
    expect(
      res3.body.data.updateHigherLowerHighestScore.higherLowerGameHighestScore
    ).toBe(8);
  });

  test("updateDraftGameStats increments played and win/loss counters", async () => {
    const token = await register();

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
});
