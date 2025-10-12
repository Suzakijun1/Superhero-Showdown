const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-secret";
const { signToken, getUserFromReq } = require("../../server/utils/auth");

describe("auth utils", () => {
  const user = { _id: "u1", email: "x@e.com", username: "alex" };

  test("signToken() returns a valid JWT with expected claims", () => {
    const token = signToken(user);
    expect(typeof token).toBe("string");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded).toHaveProperty("data._id", "u1");
    expect(decoded).toHaveProperty("data.email", "x@e.com");
    expect(decoded).toHaveProperty("data.username", "alex");
  });

  test("getUserFromReq() extracts user from Bearer token", () => {
    const token = signToken(user);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const u = getUserFromReq(req);
    expect(u).toEqual({ _id: "u1", email: "x@e.com", username: "alex" });
  });

  test("getUserFromReq() returns null when header missing", () => {
    const req = { headers: {} };
    const u = getUserFromReq(req);
    expect(u).toBeNull();
  });

  test("getUserFromReq() returns null for malformed token", () => {
    const req = { headers: { authorization: "Bearer definitely-not-a-jwt" } };
    const u = getUserFromReq(req);
    expect(u).toBeNull();
  });

  test("getUserFromReq() returns null when token signed with wrong secret", () => {
    // sign with a different secret to simulate invalid signature
    const wrong = jwt.sign({ data: user }, "NOT-test-secret", {
      expiresIn: "2h",
    });
    const req = { headers: { authorization: `Bearer ${wrong}` } };
    const u = getUserFromReq(req);
    expect(u).toBeNull();
  });

  test("getUserFromReq() accepts raw token without 'Bearer ' prefix", () => {
    const token = signToken(user);
    const req = { headers: { authorization: token } }; // raw
    const u = getUserFromReq(req);
    expect(u).toEqual({ _id: "u1", email: "x@e.com", username: "alex" });
  });
});
