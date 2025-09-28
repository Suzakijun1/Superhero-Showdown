const { connect, clear, close } = require("../tests/test-db");
const Hero = require("../server/models/hero");

describe("Hero Model Validation & Shape", () => {
  beforeAll(async () => {
    await connect();
    await Hero.init();
  });

  afterEach(async () => {
    await clear();
  });

  afterAll(async () => {
    await close();
  });

  test("saves a minimal hero document with expected nested shapes", async () => {
    const h = await Hero.create({
      response: "success",
      id: "123",
      name: "TestHero",
      powerstats: {
        intelligence: "85",
        strength: "90",
        speed: "70",
        durability: "80",
        power: "88",
        combat: "76",
      },
      biography: {
        "full-name": "Test Hero",
        "alter-egos": "None",
        aliases: ["The Tester"],
        "place-of-birth": "UnitTest City",
        "first-appearance": "Issue #1",
        publisher: "UT Comics",
        alignment: "good",
      },
      appearance: {
        gender: "Male",
        race: "Human",
        height: ["6'0", "183 cm"],
        weight: ["200 lb", "90 kg"],
        "eye-color": "Brown",
        "hair-color": "Black",
      },
      work: {
        occupation: "QA",
        base: "CI/CD",
      },
      connections: {
        "group-affiliation": "Testing League",
        relatives: "N/A",
      },
      image: { url: "https://example.com/img.png" },
    });

    expect(h._id).toBeDefined();
    expect(h.name).toBe("TestHero");
    expect(h.powerstats.intelligence).toBe("85");
    expect(Array.isArray(h.biography.aliases)).toBe(true);
    expect(Array.isArray(h.appearance.height)).toBe(true);
    expect(h.image.url).toMatch(/^https?:\/\//);
  });

  test("allows partial hero docs (since fields are not required)", async () => {
    const h = await Hero.create({ id: "partial-1", name: "PartialHero" });
    expect(h.name).toBe("PartialHero");
    // No required constraints in schema—consider tightening if needed
  });

  test("preserves types as strings for powerstats", async () => {
    const h = await Hero.create({
      id: "string-check",
      name: "StringStatHero",
      powerstats: { strength: "95" },
    });
    expect(typeof h.powerstats.strength).toBe("string");
  });
});
