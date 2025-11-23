// server/utils/dynamicMatchup.js
//
// Dynamic Matchup Algorithm
// -------------------------
// Selects two heroes for a Higher/Lower round by:
// 1. Filtering heroes that have valid numeric stats for the requested attribute.
// 2. Computing attribute differences for candidate pairs.
// 3. Choosing a pair whose difference is "balanced" based on a difficulty bucket.
//
// Difficulty scaling is tied to the user's historical performance
// (e.g., highest streak), but it can be easily adapted.

const Hero = require("../models/Hero");

/**
 * Map a user's historical performance to a difficulty bucket.
 * You can tune these ranges to match your desired pacing.
 *
 * @param {number} highestStreak - user's recorded best Higher/Lower streak
 * @returns {"easy"|"medium"|"hard"}
 */
function getDifficultyBucket(highestStreak = 0) {
  if (highestStreak < 5) return "easy"; // beginner
  if (highestStreak < 10) return "medium"; // intermediate
  return "hard"; // advanced
}

/**
 * Returns min/max target differences for each difficulty bucket.
 * - Easy: bigger gaps between heroes, guesses are more obvious.
 * - Medium: moderate gaps.
 * - Hard: small gaps, close and tricky comparisons.
 */
function getTargetDiffRange(bucket) {
  switch (bucket) {
    case "easy":
      return { min: 20, max: 50 }; // large attribute gap
    case "medium":
      return { min: 10, max: 25 }; // moderate gap
    case "hard":
    default:
      return { min: 3, max: 15 }; // small gap; harder to distinguish
  }
}

/**
 * Safely parse a hero's attribute value from the powerstats object.
 * Your schema stores them as strings, so we need to coerce.
 */
function getNumericStat(hero, attribute) {
  if (!hero || !hero.powerstats) return null;
  const raw = hero.powerstats[attribute];
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * Core Dynamic Matchup Algorithm.
 *
 * @param {string} attribute - one of "strength", "speed", "intelligence", "power", etc.
 * @param {object} [user] - optional user object (used to derive difficulty from highest streak)
 * @param {number} [user.higherLowerGameHighestScore]
 * @returns {Promise<{ heroA: object, heroB: object, attribute: string, difficulty: string, diff: number }>}
 *
 * @throws if there are not enough heroes or no suitable pair can be found
 */
async function pickBalancedHeroPair(attribute, user = null) {
  if (!attribute) {
    throw new Error("Attribute is required for dynamic matchup selection.");
  }

  // 1. Determine difficulty bucket based on user's history
  const highestStreak = user?.higherLowerGameHighestScore ?? 0;
  const difficulty = getDifficultyBucket(highestStreak);
  const targetRange = getTargetDiffRange(difficulty);

  // 2. Fetch a reasonable pool of heroes from MongoDB
  //    (tune the limit depending on dataset size/performance)
  const candidateHeroes = await Hero.find().limit(150).lean();

  // 3. Filter only heroes that have a valid numeric value for the attribute
  const validHeroes = candidateHeroes
    .map((h) => {
      const stat = getNumericStat(h, attribute);
      return stat === null ? null : { hero: h, stat };
    })
    .filter(Boolean);

  if (validHeroes.length < 2) {
    throw new Error(
      `Not enough heroes with numeric '${attribute}' stats to create a matchup.`
    );
  }

  // 4. Randomly shuffle the hero pool to avoid bias
  //    (Fisher–Yates shuffle)
  for (let i = validHeroes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [validHeroes[i], validHeroes[j]] = [validHeroes[j], validHeroes[i]];
  }

  // 5. Scan candidate pairs and score how "balanced" they are
  //    relative to the difficulty-dependent target diff range.
  let bestPair = null;
  let bestScore = Infinity; // lower score is better

  for (let i = 0; i < validHeroes.length; i++) {
    for (let j = i + 1; j < validHeroes.length; j++) {
      const a = validHeroes[i];
      const b = validHeroes[j];

      const diff = Math.abs(a.stat - b.stat);
      if (diff === 0) continue; // identical stats are not interesting

      // If diff lies outside the hard min/max window, penalize heavily
      let score;
      if (diff < targetRange.min) {
        score = targetRange.min - diff + 10; // penalty for being too close on easy/medium
      } else if (diff > targetRange.max) {
        score = diff - targetRange.max + 10; // penalty for being too far apart
      } else {
        // Inside the preferred window – score based on distance to the mid-point
        const mid = (targetRange.min + targetRange.max) / 2;
        score = Math.abs(diff - mid);
      }

      if (score < bestScore) {
        bestScore = score;
        bestPair = {
          heroA: a.hero,
          heroB: b.hero,
          diff,
        };
      }
    }
  }

  if (!bestPair) {
    throw new Error(
      `Unable to find a balanced hero pair for attribute '${attribute}'.`
    );
  }

  return {
    heroA: bestPair.heroA,
    heroB: bestPair.heroB,
    attribute,
    difficulty,
    diff: bestPair.diff,
  };
}

module.exports = {
  pickBalancedHeroPair,
  getDifficultyBucket,
  getTargetDiffRange,
};
