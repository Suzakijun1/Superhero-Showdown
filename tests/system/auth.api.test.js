jest.setTimeout(120000);
const request = require("supertest");
const { connect, clear, close } = require("../test-db");
const mongoose = require("mongoose");

let app, initApollo;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

  await connect();
  await require("../../server/models/User").init();

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
      user{ _id email username }
    }
  }`;

const LOGIN = `
  mutation Login($username:String!,$password:String!){
    login(username:$username, password:$password){
      token
      user{ _id email username }
    }
  }`;

const ME = `query { me { _id email username } }`;

describe("Auth & identity", () => {
  test("addUser creates user and returns token + user", async () => {
    const res = await gql(ADD_USER, {
      email: "alice@example.com",
      username: "alice123",
      password: "P@ssw0rd!",
    });
    expect(res.status).toBe(200);
    const { token, user } = res.body.data.addUser;
    expect(token).toBeDefined();
    expect(user.email).toBe("alice@example.com");
    expect(user.username).toBe("alice123");
  });

  test("login returns token when credentials are correct", async () => {
    await gql(ADD_USER, {
      email: "bob@example.com",
      username: "bob7777",
      password: "P@ssw0rd!",
    });
    const res = await gql(LOGIN, {
      username: "bob7777",
      password: "P@ssw0rd!",
    });
    expect(res.status).toBe(200);
    expect(res.body.data.login.token).toBeDefined();
    expect(res.body.data.login.user.username).toBe("bob7777");
  });

  test("me requires auth; succeeds with Bearer token", async () => {
    // unauthenticated -> should error or return null
    const bad = await gql(ME);
    expect(bad.body.errors || bad.body.data.me === null).toBeTruthy();

    // authenticated
    const add = await gql(ADD_USER, {
      email: "carl@example.com",
      username: "carl9999",
      password: "P@ssw0rd!",
    });
    const token = add.body.data.addUser.token;
    const ok = await gql(ME, {}, token);
    expect(ok.status).toBe(200);
    expect(ok.body.data.me.email).toBe("carl@example.com");
  });
});
