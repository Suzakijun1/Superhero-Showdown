// const { gql } = require("apollo-server-express");

// const typeDefs = gql`
//   type User {
//     _id: ID
//     email: String
//     username: String
//     password: String
//     higherLowerGamesPlayed: Int
//     higherLowerGameHighestScore: Int
//     draftGamesPlayed: Int
//     draftGameWins: Int
//     draftGameLosses: Int
//   }

//   type Auth {
//     token: ID!
//     user: User
//   }

//   type Powerstats {
//     intelligence: String
//     strength: String
//     speed: String
//     durability: String
//     power: String
//     combat: String
//   }

//   type Biography {
//     full_name: String
//     alter_egos: String
//     aliases: [String]
//     place_of_birth: String
//     first_appearance: String
//     publisher: String
//     alignment: String
//   }

//   type Appearance {
//     gender: String
//     race: String
//     height: [String]
//     weight: [String]
//     eye_color: String
//     hair_color: String
//   }

//   type Work {
//     occupation: String
//     base: String
//   }

//   type Connections {
//     group_affiliation: String
//     relatives: String
//   }

//   type Image {
//     url: String
//   }

//   type Hero {
//     _id: ID
//     response: String
//     id: String
//     name: String
//     powerstats: Powerstats
//     biography: Biography
//     appearance: Appearance
//     work: Work
//     connections: Connections
//     image: Image
//   }

//   type Query {
//     heroes: [Hero]
//     hero(id: String!): Hero
//     users: [User]
//     user: User
//     me: User
//   }

//   type Mutation {
//     addUser(email: String!, username: String!, password: String!): Auth
//     login(username: String!, password: String!): Auth
//     updateHigherLowerHighestScore(streak: Int!): User
//     updateDraftGameStats(won: Boolean!): User
//   }
// `;

// module.exports = typeDefs;
const { gql } = require("apollo-server-express");

const typeDefs = gql`
  ############################################
  # Core domain types
  ############################################

  type User {
    _id: ID
    email: String
    username: String
    password: String
    higherLowerGamesPlayed: Int
    higherLowerGameHighestScore: Int
    draftGamesPlayed: Int
    draftGameWins: Int
    draftGameLosses: Int
  }

  type Auth {
    token: ID!
    user: User
  }

  type Powerstats {
    intelligence: String
    strength: String
    speed: String
    durability: String
    power: String
    combat: String
  }

  type Biography {
    full_name: String
    alter_egos: String
    aliases: [String]
    place_of_birth: String
    first_appearance: String
    publisher: String
    alignment: String
  }

  type Appearance {
    gender: String
    race: String
    height: [String]
    weight: [String]
    eye_color: String
    hair_color: String
  }

  type Work {
    occupation: String
    base: String
  }

  type Connections {
    group_affiliation: String
    relatives: String
  }

  type Image {
    url: String
  }

  type Hero {
    _id: ID
    response: String
    id: String
    name: String
    powerstats: Powerstats
    biography: Biography
    appearance: Appearance
    work: Work
    connections: Connections
    image: Image
  }

  ############################################
  # Higher / Lower Game Types (Sprint 3)
  ############################################

  # Returned when a session starts. Includes two heroes,
  # the chosen attribute (e.g. "strength"), and a human-readable prompt.
  type HigherLowerSession {
    heroA: Hero
    heroB: Hero
    attribute: String
    prompt: String
  }

  # Returned when the player submits a guess ("Higher" or "Lower").
  # isCorrect -> whether the guess was right
  # newScore  -> updated streak/score after that guess
  type HigherLowerGuessResult {
    isCorrect: Boolean
    newScore: Int
  }

  # Returned when the session ends and stats are persisted.
  # Reflects what's now stored on the User.
  type HigherLowerPersistResult {
    higherLowerGamesPlayed: Int
    higherLowerGameHighestScore: Int
  }

  ############################################
  # Queries
  ############################################

  type Query {
    heroes: [Hero]
    hero(id: String!): Hero
    users: [User]
    user: User
    me: User
  }

  ############################################
  # Mutations
  ############################################

  type Mutation {
    # --- Existing auth / stats mutations ---
    addUser(email: String!, username: String!, password: String!): Auth
    login(username: String!, password: String!): Auth

    updateHigherLowerHighestScore(streak: Int!): User
    updateDraftGameStats(won: Boolean!): User

    # --- New Sprint 3 mutations for Higher/Lower game flow ---

    # US-3:
    # Allow an authenticated user to start a Higher/Lower session
    # by selecting an attribute. Return two heroes + prompt.
    startHigherLowerSession(attribute: String!): HigherLowerSession

    # US-4:
    # Validate the user's guess against hero stats,
    # respond with correctness + updated score.
    validateHigherLowerGuess(
      guess: String!
      attribute: String!
      heroAId: String!
      heroBId: String!
    ): HigherLowerGuessResult

    # US-5:
    # Persist the final score when the session ends.
    # Update higherLowerGamesPlayed and only raise the high score
    # if finalScore beats the previous record.
    endHigherLowerSession(finalScore: Int!): HigherLowerPersistResult
  }
`;

module.exports = typeDefs;
