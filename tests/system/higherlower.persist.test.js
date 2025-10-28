/**
 * US-5:
 * The system shall persist the final score at the end of a Higher/Lower session
 * and update the user's high score if the new result exceeds the previous.
 *
 * We assume an end-session mutation like:
 *
 * mutation EndSession($finalScore: Int!) {
 *   endHigherLowerSession(finalScore: $finalScore) {
 *     higherLowerGamesPlayed
 *     higherLowerGameHighestScore
 *   }
 * }
 *
 * and that it uses context.user to know which user to update.
 */

const {
  gql,
  startApolloForTest,
  stopApolloForTest,
} = require("../util/testServer");
const mongoose = require("mongoose");
const User = require("../../server/models/User");

const ADD_USER = `
mutation AddUser($email: String!, $username: String!, $password: String!) {
  addUser(email: $email, username: $username, password: $password) {
    token
    user { _id username email }
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

const ME = `
query Me {
  me {
    username
    higherLowerGamesPlayed
    higherLowerGameHighestScore
  }
}
`;

describe("US-5 Persist Final Score & Update High Score", () => {
  let token;

  beforeAll(async () => {
    await startApolloForTest();

    const res = await gql(ADD_USER, {
      email: "persist@example.com",
      username: "persister",
      password: "P@ssw0rd!",
    });
    token = res.body.data.addUser.token;
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await stopApolloForTest();
  });

  test("first completed session records gamesPlayed=1 and sets high score", async () => {
    const res = await gql(END_SESSION, { finalScore: 7 }, token);

    expect(res.status).toBe(200);
    const data = res.body.data.endHigherLowerSession;
    expect(data.higherLowerGamesPlayed).toBe(1);
    expect(data.higherLowerGameHighestScore).toBe(7);

    // double-check via profile/me
    const profileRes = await gql(ME, {}, token);
    const me = profileRes.body.data.me;
    expect(me.higherLowerGamesPlayed).toBe(1);
    expect(me.higherLowerGameHighestScore).toBe(7);
  });

  test("later session with lower score does NOT reduce high score", async () => {
    const res = await gql(
      END_SESSION,
      { finalScore: 3 }, // lower than 7
      token
    );
    expect(res.status).toBe(200);
    const data = res.body.data.endHigherLowerSession;
    expect(data.higherLowerGamesPlayed).toBe(2);
    // high score should stay 7
    expect(data.higherLowerGameHighestScore).toBe(7);
  });

  test("later session with higher score DOES update high score", async () => {
    const res = await gql(
      END_SESSION,
      { finalScore: 12 }, // higher than 7
      token
    );
    expect(res.status).toBe(200);

    const data = res.body.data.endHigherLowerSession;
    expect(data.higherLowerGamesPlayed).toBe(3);
    expect(data.higherLowerGameHighestScore).toBe(12);

    // confirm via profile
    const profileRes = await gql(ME, {}, token);
    const me = profileRes.body.data.me;
    expect(me.higherLowerGameHighestScore).toBe(12);
  });
});
