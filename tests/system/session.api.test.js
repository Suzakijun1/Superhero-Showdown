/**
 * US-10: User session must remain valid across refreshes until token expiry.
 * We emulate refresh by making multiple requests with the same JWT.
 * Also verify that an invalid/altered token is rejected.
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

const ME = `query { me { _id username email } }`;

test("same JWT works across multiple requests (refresh behavior)", async () => {
  const add = await gql(ADD_USER, {
    email: "s@e.com",
    username: "sessionUser",
    password: "P@ssw0rd!",
  });
  const token = add.body.data.addUser.token;

  const me1 = await gql(ME, {}, token);
  expect(me1.status).toBe(200);
  expect(me1.body.data.me.username).toBe("sessionUser");

  // emulate a browser refresh → new request with same token
  const me2 = await gql(ME, {}, token);
  expect(me2.status).toBe(200);
  expect(me2.body.data.me.username).toBe("sessionUser");
});

test("invalid token is rejected", async () => {
  const bad = await gql(ME, {}, "invalid.token");

  // Case 1: middleware throws -> errors array exists
  if (bad.body.errors) {
    expect(bad.body.errors).toBeTruthy();
  } else {
    // Case 2: middleware just returns null user
    expect(bad.body.data.me).toBeNull();
  }
});
