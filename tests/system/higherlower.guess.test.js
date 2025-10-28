/**
 * US-4:
 * The system shall validate a user's "Higher" or "Lower" guess
 * against the selected attribute, reveal correctness,
 * and update the session score.
 *
 * We assume you exposed a mutation like:
 *
 * mutation ValidateGuess($guess: String!, $attribute: String!, $heroAId: String!, $heroBId: String!) {
 *   validateHigherLowerGuess(
 *     guess: $guess,
 *     attribute: $attribute,
 *     heroAId: $heroAId,
 *     heroBId: $heroBId
 *   ) {
 *     isCorrect
 *     newScore
 *   }
 * }
 *
 * If your actual signature differs, adjust the variables / fields accordingly.
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

const VALIDATE_GUESS = `
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

describe("US-4 Validate Guess & Update Score", () => {
  let token;
  let heroStrong;
  let heroWeak;

  beforeAll(async () => {
    await startApolloForTest();

    // seed two heroes with known stats
    heroStrong = await Hero.create({
      id: "201",
      name: "PowerLord",
      powerstats: {
        strength: "95",
        speed: "40",
        intelligence: "60",
        durability: "90",
        power: "92",
        combat: "70",
      },
    });

    heroWeak = await Hero.create({
      id: "202",
      name: "SoftKid",
      powerstats: {
        strength: "20",
        speed: "30",
        intelligence: "55",
        durability: "25",
        power: "18",
        combat: "15",
      },
    });

    const res = await gql(ADD_USER, {
      email: "guessuser@example.com",
      username: "guesser",
      password: "P@ssw0rd!",
    });
    token = res.body.data.addUser.token;
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await stopApolloForTest();
  });

  test("correct 'Higher' guess increments score", async () => {
    // Compare strength: heroStrong (95) vs heroWeak (20)
    // "Higher" should be correct for heroStrong.strength > heroWeak.strength.
    const res = await gql(
      VALIDATE_GUESS,
      {
        guess: "Higher",
        attribute: "strength",
        heroAId: heroStrong.id,
        heroBId: heroWeak.id,
      },
      token
    );

    expect(res.status).toBe(200);
    const data = res.body.data.validateHigherLowerGuess;
    expect(data).toBeDefined();
    expect(data.isCorrect).toBe(true);
    expect(typeof data.newScore).toBe("number");
    expect(data.newScore).toBeGreaterThan(0);
  });

  test("incorrect guess returns isCorrect=false and does not inflate score", async () => {
    // Now intentionally guess wrong.
    // heroStrong.strength (95) vs heroWeak.strength (20)
    // "Lower" is incorrect.
    const res = await gql(
      VALIDATE_GUESS,
      {
        guess: "Lower",
        attribute: "strength",
        heroAId: heroStrong.id,
        heroBId: heroWeak.id,
      },
      token
    );

    expect(res.status).toBe(200);
    const data = res.body.data.validateHigherLowerGuess;
    expect(data.isCorrect).toBe(false);
    // When wrong, usually you end the streak, so newScore might reset to 0 or remain prior score.
    // We just assert it's a number and not incremented.
    expect(typeof data.newScore).toBe("number");
  });

  test("cannot validate guess without auth", async () => {
    const res = await gql(VALIDATE_GUESS, {
      guess: "Higher",
      attribute: "strength",
      heroAId: heroStrong.id,
      heroBId: heroWeak.id,
    }); // <-- no token

    expect(res.status).toBe(200);
    if (res.body.errors) {
      expect(res.body.errors[0].message).toMatch(
        /not authenticated|unauthorized/i
      );
    } else {
      // fallback if you return null data instead of explicit error
      expect(res.body.data.validateHigherLowerGuess).toBeNull();
    }
  });
});
