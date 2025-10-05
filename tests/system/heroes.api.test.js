jest.setTimeout(120000);
const request = require("supertest");
const { connect, clear, close } = require("../test-db");
const mongoose = require("mongoose");

let app, initApollo, Hero;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  await connect();

  Hero = require("../../server/models/Hero");
  await Hero.init();

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

const gql = (query, variables = {}) =>
  request(app).post("/graphql").send({ query, variables });

const HEROES = `query { heroes { id name powerstats { strength speed intelligence durability power combat } } }`;
const HERO_BY_ID = `query Hero($id:String!){ hero(id:$id){ id name } }`;

const seedHeroes = async () => {
  await Hero.create([
    {
      id: "100",
      name: "Iron Test",
      powerstats: { strength: "85", speed: "70" },
    },
    {
      id: "101",
      name: "Spider Test",
      powerstats: { strength: "60", speed: "95" },
    },
    {
      id: "102",
      name: "Captain Check",
      powerstats: { strength: "80", speed: "65" },
    },
  ]);
};

describe("Hero catalog queries", () => {
  test("heroes returns a non-empty list with expected fields", async () => {
    await seedHeroes();
    const res = await gql(HEROES);
    expect(res.status).toBe(200);
    const list = res.body.data.heroes;
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]).toHaveProperty("name");
    expect(list[0]).toHaveProperty("powerstats");
  });

  test("hero(id) returns a single hero by id", async () => {
    await seedHeroes();
    const res = await gql(HERO_BY_ID, { id: "101" });
    expect(res.status).toBe(200);
    expect(res.body.data.hero).toMatchObject({
      id: "101",
      name: "Spider Test",
    });
  });

  test("hero(id) returns null when id not found", async () => {
    await seedHeroes();
    const res = await gql(HERO_BY_ID, { id: "999999" });
    expect(res.status).toBe(200);
    expect(res.body.data.hero).toBeNull();
  });
});
