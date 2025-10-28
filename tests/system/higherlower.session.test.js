const {
  gql,
  startApolloForTest,
  stopApolloForTest,
} = require("../util/testServer");
const mongoose = require("mongoose");
const Hero = require("../../server/models/Hero");

// ----- GraphQL ops -----
const ADD_USER = `
mutation AddUser($email: String!, $username: String!, $password: String!) {
  addUser(email: $email, username: $username, password: $password) {
    token
    user { _id username email }
  }
}
`;

const START_SESSION = `
mutation StartHL($attribute: String!) {
  startHigherLowerSession(attribute: $attribute) {
    heroA { id name powerstats { strength speed intelligence power } }
    heroB { id name powerstats { strength speed intelligence power } }
    attribute
    prompt
  }
}
`;

describe("US-3 Start Higher/Lower Session", () => {
  let token;

  beforeAll(async () => {
    await startApolloForTest();

    // seed heroes
    await Hero.create([
      {
        id: "101",
        name: "Alpha-Man",
        powerstats: {
          intelligence: "80",
          strength: "90",
          speed: "60",
          durability: "85",
          power: "88",
          combat: "70",
        },
      },
      {
        id: "102",
        name: "Beta-Woman",
        powerstats: {
          intelligence: "75",
          strength: "70",
          speed: "95",
          durability: "60",
          power: "77",
          combat: "82",
        },
      },
    ]);

    // create a user
    const res = await gql(ADD_USER, {
      email: "hluser@example.com",
      username: "hlplayer",
      password: "P@ssw0rd!",
    });

    // Debug helper if addUser blew up
    if (res.status !== 200) {
      throw new Error(
        `addUser HTTP failure: status ${res.status}\n${res.text}`
      );
    }
    if (!res.body || (!res.body.data && res.body.errors)) {
      throw new Error(
        `addUser GraphQL error:\n${JSON.stringify(res.body, null, 2)}`
      );
    }

    token = res.body.data.addUser.token;
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await stopApolloForTest();
  });

  test("authenticated user can start a Higher/Lower session with a valid attribute", async () => {
    const res = await gql(START_SESSION, { attribute: "strength" }, token);

    expect(res.status).toBe(200);

    // If GraphQL threw, surface it now instead of crashing below
    if (!res.body || (!res.body.data && res.body.errors)) {
      throw new Error(
        `startHigherLowerSession error:\n${JSON.stringify(res.body, null, 2)}`
      );
    }

    const sess = res.body.data.startHigherLowerSession;
    expect(sess).toBeDefined();

    // make sure we got two distinct heroes
    expect(sess.heroA).toBeDefined();
    expect(sess.heroB).toBeDefined();
    expect(sess.heroA.id).not.toEqual(sess.heroB.id);

    // attribute and prompt look sane
    expect(sess.attribute).toBe("strength");
    expect(typeof sess.prompt).toBe("string");
    expect(sess.prompt.length).toBeGreaterThan(0);

    // chosen attribute should be present on both heroes
    expect(sess.heroA.powerstats.strength).toBeDefined();
    expect(sess.heroB.powerstats.strength).toBeDefined();
  });

  test("unauthenticated request is rejected", async () => {
    const res = await gql(START_SESSION, { attribute: "speed" });

    expect(res.status).toBe(200);

    // Either we get .errors, OR null data
    if (res.body.errors) {
      expect(res.body.errors[0].message).toMatch(
        /not authenticated|logged in|unauthorized/i
      );
    } else {
      expect(res.body.data.startHigherLowerSession).toBeNull();
    }
  });

  test("invalid attribute is rejected", async () => {
    const res = await gql(START_SESSION, { attribute: "friendliness" }, token);

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeTruthy();
    expect(res.body.errors[0].message).toMatch(
      /invalid attribute|unsupported/i
    );
  });
});
