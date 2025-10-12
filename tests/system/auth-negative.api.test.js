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

const gql = (query, variables = {}) =>
  request(app).post("/graphql").send({ query, variables });

const ADD_USER = `
  mutation($email:String!,$username:String!,$password:String!){
    addUser(email:$email, username:$username, password:$password){
      token user{ _id username }
    }
  }`;

const LOGIN = `
  mutation($username:String!,$password:String!){
    login(username:$username, password:$password){
      token user{ _id username }
    }
  }`;

test("login fails with unknown username", async () => {
  const res = await gql(LOGIN, { username: "nope", password: "anything" });
  expect(res.body.errors).toBeTruthy();
  expect(res.body.errors[0].message).toMatch(/No user found|No user/i);
});

test("login fails with incorrect password", async () => {
  await gql(ADD_USER, {
    email: "a@a.com",
    username: "user1",
    password: "correct",
  });
  const res = await gql(LOGIN, { username: "user1", password: "wrong" });
  expect(res.body.errors).toBeTruthy();
  expect(res.body.errors[0].message).toMatch(/Incorrect credentials/i);
});
