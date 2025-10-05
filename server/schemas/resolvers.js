const { AuthenticationError } = require("apollo-server-express");
const { User, Hero } = require("../models");
const { signToken } = require("../utils/auth");

const resolvers = {
  Query: {
    users: async () => {
      return User.find();
    },
    user: async (parent, args, context) => {
      // return User.findOne({ _id: context.user._id });
      if (!context.user) throw new AuthenticationError("Not authenticated");
      return User.findById(context.user._id).select("-password -__v");
    },
    me: async (parent, args, context) => {
      // if (context.user) {
      //   return User.findOne({ _id: context.user._id });
      // }
      // throw new AuthenticationError("You need to be logged in!");
      if (!context.user) return null; // your test accepts error OR null when unauth
      return User.findById(context.user._id).select("-password -__v");
    },
    heroes: async () => {
      return Hero.find();
    },
    hero: async (parent, { id }) => {
      return Hero.findOne({
        id,
      });
    },
  },

  Mutation: {
    addUser: async (parent, { email, username, password }) => {
      const user = await User.create({
        email,
        username,
        password,
        higherLowerGameHighestScore: 0,
      });
      const token = signToken(user);
      return { token, user };
    },
    login: async (parent, { username, password }) => {
      const user = await User.findOne({ username });

      user.achievements;

      if (!user) {
        throw new AuthenticationError("No user found with this email address");
      }

      const correctPw = await user.isCorrectPassword(password);

      if (!correctPw) {
        throw new AuthenticationError("Incorrect credentials");
      }

      const token = signToken(user);

      return { token, user };
    },
    // updateHigherLowerHighestScore: async (parent, { streak }, context) => {
    //   console.log("Played game");
    //   if (context.user) {
    //     const updatedUser = await User.findOneAndUpdate(
    //       { username: context.user.username },
    //       {
    //         higherLowerGameHighestScore: streak,
    //         $inc: { higherLowerGamesPlayed: 1 },
    //       },
    //       { new: true }
    //     );
    //     return updatedUser;
    //   }

    //   throw new AuthenticationError("Not Logged In!");
    // },
    updateHigherLowerHighestScore: async (parent, args, context) => {
      if (!context.user) throw new AuthenticationError("Not authenticated");
      // accept either `streak` (tests) or `highestStreak` (older client)
      const s =
        typeof args.streak === "number"
          ? args.streak
          : typeof args.highestStreak === "number"
          ? args.highestStreak
          : 0;
      const updatedUser = await User.findByIdAndUpdate(
        context.user._id,
        {
          $inc: { higherLowerGamesPlayed: 1 },
          $max: { higherLowerGameHighestScore: s }, // never decrease
        },
        { new: true }
      ).select("-password -__v");
      return updatedUser;
    },
    updateDraftGameStats: async (parent, { won }, context) => {
      if (context.user) {
        const win = won ? 1 : 0;
        const loss = won ? 0 : 1;
        const updatedUser = await User.findOneAndUpdate(
          { username: context.user.username },
          {
            $inc: {
              draftGamesPlayed: 1,
              draftGameWins: win,
              draftGameLosses: loss,
            },
          },
          { new: true }
        );
        return updatedUser;
      }

      throw new AuthenticationError("Not Logged In!");
    },
  },
};

module.exports = resolvers;
