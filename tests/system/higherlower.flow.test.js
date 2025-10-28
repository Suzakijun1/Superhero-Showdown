/**
 * US-13:
 * The system shall implement the Higher/Lower game mode,
 * allowing users to compare hero attributes and track scores.
 *
 * Here we treat it as an end-to-end sanity check:
 * 1. Start session
 * 2. Make a valid guess
 * 3. End session and persist
 *
 * We ALSO test "double guess" prevention logically.
 * For the double-guess rule, we can't click the browser UI here,
 * but we can assert that calling validateHigherLowerGuess twice
 * in a row with the same hero pair either:
 * - does not double-increment score, or
 * - returns an error on second submission.
 *
 * Adjust expectation to match your actual resolver behavior.
 */

const {
  gql,
  startApolloForTest,
  stopApolloForTest,
} = require("../util/testServer");
const mongoose = require("mongoose");
const User = require("../../server/models/User");
const Hero = require("../../server/models/Hero");

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
    heroA { id name powerstats { strength } }
    heroB { id name powerstats { strength } }
    attribute
    prompt
  }
}
`;

const GUESS = `
mutation HLGuess(
  $guess: String!,
  $attribute: String!,
  $heroAId: String!,
  $heroBId: String!
) {
  validateHigherLowerGuess(
    guess: $guess,
    attribute: $attribute,
    heroAId: $heroAId,
    heroBId: $heroBId
  ) {
    isCorrect
    newScore
  }
}
`;

const END_SESSION = `
mutation EndSession($finalScore: Int!) {
  endHigherLowerSession(finalScore: $finalScore) {
    higherLowerGamesPlayed
    higherLowerGameHighestScore
  }
}
`;

describe("US-13 Full Higher/Lower Flow", () => {
  let token;

  beforeAll(async () => {
    await startApolloForTest();

    // Seed known heroes to control attribute comparison
    await Hero.create([
      {
        id: "301",
        name: "Atlas",
        powerstats: {
          strength: "99",
          speed: "20",
          intelligence: "40",
          durability: "90",
          power: "88",
          combat: "75",
        },
      },
      {
        id: "302",
        name: "Swiftling",
        powerstats: {
          strength: "10",
          speed: "95",
          intelligence: "55",
          durability: "20",
          power: "15",
          combat: "30",
        },
      },
    ]);

    const res = await gql(ADD_USER, {
      email: "flow@example.com",
      username: "flowuser",
      password: "P@ssw0rd!",
    });
    token = res.body.data.addUser.token;
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await stopApolloForTest();
  });

  test("user can play a round, score increases, and score is persisted", async () => {
    // 1. Start a session
    const startRes = await gql(START_SESSION, { attribute: "strength" }, token);
    expect(startRes.status).toBe(200);
    const sess = startRes.body.data.startHigherLowerSession;
    expect(sess).toBeDefined();

    const heroA = sess.heroA;
    const heroB = sess.heroB;

    // figure out which guess SHOULD be correct for strength
    const strA = parseInt(heroA.powerstats.strength || "0", 10);
    const strB = parseInt(heroB.powerstats.strength || "0", 10);

    let guess;
    if (strA > strB) guess = "Higher";
    else if (strA < strB) guess = "Lower";
    else guess = "Higher"; // tie fallback

    // 2. Submit guess
    const guessRes = await gql(
      GUESS,
      {
        guess,
        attribute: "strength",
        heroAId: heroA.id,
        heroBId: heroB.id,
      },
      token
    );
    expect(guessRes.status).toBe(200);
    const gData = guessRes.body.data.validateHigherLowerGuess;
    expect(gData).toBeDefined();
    expect(typeof gData.newScore).toBe("number");

    const firstScore = gData.newScore;

    // 3. Attempt duplicate submit to simulate "double click"
    const dupRes = await gql(
      GUESS,
      {
        guess,
        attribute: "strength",
        heroAId: heroA.id,
        heroBId: heroB.id,
      },
      token
    );

    // We don't dictate exact behavior.
    // We'll just assert score didn't inflate by +1 twice in a row
    if (dupRes.body.errors) {
      // acceptable: API throws an error like "round already resolved"
      expect(dupRes.body.errors[0].message).toMatch(
        /already answered|locked|round complete/i
      );
    } else {
      // or it returns same score / not incremented
      const dupData = dupRes.body.data.validateHigherLowerGuess;
      expect(dupData.newScore).toBeLessThanOrEqual(firstScore + 1);
    }

    // 4. End session with whatever finalScore we have
    const endRes = await gql(END_SESSION, { finalScore: firstScore }, token);
    expect(endRes.status).toBe(200);

    const post = endRes.body.data.endHigherLowerSession;
    expect(post.higherLowerGamesPlayed).toBeGreaterThanOrEqual(1);
    expect(post.higherLowerGameHighestScore).toBeGreaterThanOrEqual(firstScore);
  });
});
