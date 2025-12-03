// tests/unit/dynamicMatchup.util.test.js

const Hero = require("../../server/models/Hero");
const {
  pickBalancedHeroPair,
  getDifficultyBucket,
  getTargetDiffRange,
} = require("../../server/utils/dynamicMatchup");

jest.mock("../../server/models/Hero");

function makeHero(id, name, attrName, value) {
  return {
    _id: id,
    id: String(id),
    name,
    powerstats: {
      [attrName]: String(value),
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ------------------------------
// Pure helpers
// ------------------------------
describe("getDifficultyBucket", () => {
  test("returns easy for streak < 5", () => {
    expect(getDifficultyBucket(0)).toBe("easy");
    expect(getDifficultyBucket(4)).toBe("easy");
  });

  test("returns medium for 5 ≤ streak < 10", () => {
    expect(getDifficultyBucket(5)).toBe("medium");
    expect(getDifficultyBucket(9)).toBe("medium");
  });

  test("returns hard for streak ≥ 10", () => {
    expect(getDifficultyBucket(10)).toBe("hard");
    expect(getDifficultyBucket(25)).toBe("hard");
  });

  test("defaults to easy when streak is undefined", () => {
    expect(getDifficultyBucket()).toBe("easy");
  });
});

describe("getTargetDiffRange", () => {
  test("returns large gap for easy bucket", () => {
    const r = getTargetDiffRange("easy");
    expect(r.min).toBeLessThan(r.max);
    expect(r).toEqual({ min: 20, max: 50 });
  });

  test("returns moderate gap for medium bucket", () => {
    const r = getTargetDiffRange("medium");
    expect(r).toEqual({ min: 10, max: 25 });
  });

  test("returns small gap for hard (default) bucket", () => {
    const r = getTargetDiffRange("hard");
    expect(r).toEqual({ min: 3, max: 15 });
    expect(getTargetDiffRange("unknown")).toEqual(r); // default path
  });
});

// ------------------------------
// pickBalancedHeroPair
// ------------------------------
describe("pickBalancedHeroPair", () => {
  /**
   * Utility to make Hero.find().limit().lean() return a fixed array.
   */
  function mockHeroFindReturn(heroes) {
    Hero.find.mockReturnValue({
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(heroes),
    });
  }

  test("throws if attribute is missing", async () => {
    await expect(pickBalancedHeroPair()).rejects.toThrow(
      /Attribute is required/i
    );
  });

  test("throws if there are fewer than 2 valid heroes", async () => {
    const heroes = [
      makeHero(1, "HeroOne", "strength", "100"),
      // second hero with non-numeric stat
      { name: "BadHero", powerstats: { strength: "unknown" } },
    ];
    mockHeroFindReturn(heroes);

    await expect(
      pickBalancedHeroPair("strength", { higherLowerGameHighestScore: 0 })
    ).rejects.toThrow(/Not enough heroes/i);
  });

  test("easy difficulty: picks pair with reasonably large gap", async () => {
    const heroes = [
      makeHero(1, "Tank", "strength", 95),
      makeHero(2, "Sidekick", "strength", 60), // diff 35 (inside 20-50)
      makeHero(3, "Weakling", "strength", 10),
    ];
    mockHeroFindReturn(heroes);

    const user = { higherLowerGameHighestScore: 2 }; // easy bucket
    const result = await pickBalancedHeroPair("strength", user);

    expect(result.attribute).toBe("strength");
    expect(result.difficulty).toBe("easy");
    expect(result.heroA).toBeDefined();
    expect(result.heroB).toBeDefined();
    expect(result.heroA.id).not.toBe(result.heroB.id);

    // For easy difficulty we expect a fairly big gap
    expect(result.diff).toBeGreaterThanOrEqual(10);
  });

  test("medium difficulty: gap is moderate", async () => {
    const heroes = [
      makeHero(1, "HeroA", "strength", 50),
      makeHero(2, "HeroB", "strength", 63), // diff 13
      makeHero(3, "HeroC", "strength", 90),
    ];
    mockHeroFindReturn(heroes);

    const user = { higherLowerGameHighestScore: 7 }; // medium bucket
    const result = await pickBalancedHeroPair("strength", user);

    expect(result.difficulty).toBe("medium");
    expect(result.diff).toBeGreaterThan(0);
    // In most cases diff should fall around the medium range
    expect(result.diff).toBeGreaterThanOrEqual(3);
  });

  test("hard difficulty: prefers close matchups", async () => {
    const heroes = [
      makeHero(1, "Edge1", "strength", 80),
      makeHero(2, "Edge2", "strength", 82), // diff 2 (maybe outside ideal)
      makeHero(3, "Close1", "strength", 90),
      makeHero(4, "Close2", "strength", 95), // diff 5 (good for hard)
    ];
    mockHeroFindReturn(heroes);

    const user = { higherLowerGameHighestScore: 15 }; // hard bucket
    const result = await pickBalancedHeroPair("strength", user);

    expect(result.difficulty).toBe("hard");
    expect(result.diff).toBeGreaterThan(0);
    // For hard we expect a relatively small gap
    expect(result.diff).toBeLessThanOrEqual(20);
  });

  test("ignores heroes without numeric stats for that attribute", async () => {
    const heroes = [
      { name: "NoStats", powerstats: {} },
      makeHero(1, "Strong", "strength", 80),
      makeHero(2, "Stronger", "strength", 90),
    ];
    mockHeroFindReturn(heroes);

    const user = { higherLowerGameHighestScore: 3 };
    const result = await pickBalancedHeroPair("strength", user);

    // Should still find a pair using only the valid heroes
    expect(["Strong", "Stronger"]).toContain(result.heroA.name);
    expect(["Strong", "Stronger"]).toContain(result.heroB.name);
  });
});
