/**
 * US-06 within current schema:
 *  - The API does NOT expose a draft persistence mutation (by design today).
 *  - There are ≥5 heroes available so the client can draft 5 unique heroes.
 */

const request = require("supertest");
const { connect, clear, close } = require("../test-db");
const mongoose = require("mongoose");

let app, initApollo, Hero;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  await connect();
  ({ app, initApollo } = require("../../server/server"));
  await initApollo();

  Hero = require("../../server/models/Hero");
  await Hero.init();
});

afterEach(async () => {
  await clear();
});
afterAll(async () => {
  await close();
  await mongoose.disconnect();
});

const gql = (query, variables = {}) =>
  request(app).post("/graphql").send({ query, variables });

const HEROES = `query { heroes { id name } }`;

// Seed minimal catalog (string ids)
const seedHeroes = async () => {
  await Hero.create([
    { id: "1", name: "Alpha" },
    { id: "2", name: "Beta" },
    { id: "3", name: "Gamma" },
    { id: "4", name: "Delta" },
    { id: "5", name: "Epsilon" },
    { id: "6", name: "Zeta" },
  ]);
};

test("API does not expose a draft persistence mutation (by design today)", async () => {
  const DRAFT_TEAM = `mutation($heroes:[String!]!){
    draftTeam(heroes:$heroes){ _id username }
  }`;
  const res = await gql(DRAFT_TEAM, { heroes: ["1", "2", "3", "4", "5"] });

  // Apollo validation error -> 400 OR 200 with errors, accept either
  if (res.status === 400) {
    expect(res.body.errors || res.error).toBeTruthy();
  } else {
    expect(res.body.errors).toBeTruthy();
    expect(res.body.errors[0].message).toMatch(
      /Cannot query field "draftTeam"|Unknown/i
    );
  }
});

test("catalog exposes ≥5 heroes so client can draft 5 unique heroes", async () => {
  await seedHeroes();
  const res = await gql(HEROES);
  expect(res.status).toBe(200);

  const list = res.body.data.heroes || [];
  expect(Array.isArray(list)).toBe(true);
  expect(list.length).toBeGreaterThanOrEqual(5);

  // ensure ids are unique so client can enforce 'no duplicates'
  const ids = list.map((h) => h.id);
  expect(new Set(ids).size).toBe(ids.length);
});
