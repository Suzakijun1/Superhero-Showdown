const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { connect, clear, close } = require("../test-db.js");

// const User = require("../../server/models/User");

describe("User Model Validation & Behavior", () => {
  let User;
  beforeAll(async () => {
    await connect();
    User = require("../../server/models/User");
    // Ensure unique indexes are created before testing duplicates
    await User.init();
  });

  afterEach(async () => {
    await clear();
  });

  afterAll(async () => {
    await close();
  });

  test("saves a valid user and hashes password", async () => {
    const plain = "P@ssw0rd!";
    const u = await User.create({
      email: "alice@example.com",
      username: "alice123",
      password: plain,
    });
    expect(u._id).toBeDefined();
    expect(u.password).not.toBe(plain);
    expect(u.password.length).toBeGreaterThan(20);
    const ok = await bcrypt.compare(plain, u.password);
    expect(ok).toBe(true);
  });

  test("enforces email format", async () => {
    await expect(
      User.create({
        email: "bad-email",
        username: "bob1234",
        password: "secret",
      })
    ).rejects.toThrow(/Must match an email address!/);
  });

  test("enforces username minlength (>=4)", async () => {
    await expect(
      User.create({
        email: "cathy@example.com",
        username: "cat", // 3 chars
        password: "secret",
      })
    ).rejects.toThrow(/is shorter than the minimum allowed length/);
  });

  test("enforces password minlength (>=5)", async () => {
    await expect(
      User.create({
        email: "dave@example.com",
        username: "dave777",
        password: "1234", // too short
      })
    ).rejects.toThrow(/is shorter than the minimum allowed length/);
  });

  test("enforces unique email and username", async () => {
    await User.create({
      email: "emma@example.com",
      username: "emma777",
      password: "secret",
    });
    // Duplicate email
    await expect(
      User.create({
        email: "emma@example.com",
        username: "emma888",
        password: "another",
      })
    ).rejects.toThrow(/duplicate key error/);

    // Duplicate username
    await expect(
      User.create({
        email: "emma2@example.com",
        username: "emma777",
        password: "another",
      })
    ).rejects.toThrow(/duplicate key error/);
  });

  test("isCorrectPassword returns true/false correctly", async () => {
    const plain = "P@ssw0rd!";
    const u = await User.create({
      email: "frank@example.com",
      username: "frank999",
      password: plain,
    });
    await expect(u.isCorrectPassword(plain)).resolves.toBe(true);
    await expect(u.isCorrectPassword("wrong")).resolves.toBe(false);
  });

  test("defaults for stats fields are zero", async () => {
    const u = await User.create({
      email: "grace@example.com",
      username: "grace001",
      password: "secret",
    });
    expect(u.higherLowerGamesPlayed).toBe(0);
    expect(u.higherLowerGameHighestScore).toBe(0);
    expect(u.draftGamesPlayed).toBe(0);
    expect(u.draftGameWins).toBe(0);
    expect(u.draftGameLosses).toBe(0);
  });

  test("pre-save only re-hashes when password is modified", async () => {
    const u = await User.create({
      email: "henry@example.com",
      username: "henry777",
      password: "firstPass",
    });
    const firstHash = u.password;

    // modify unrelated field
    u.higherLowerGamesPlayed = 3;
    await u.save();
    expect(u.password).toBe(firstHash); // unchanged

    // modify password
    u.password = "newPass123";
    await u.save();
    expect(u.password).not.toBe(firstHash);
    const ok = await bcrypt.compare("newPass123", u.password);
    expect(ok).toBe(true);
  });
});
