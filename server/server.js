// const express = require("express");
// const db = require("./config/connection");
// const { typeDefs, resolvers } = require("./schemas");
// const { authMiddleware } = require("./utils/auth");
// const { ApolloServer } = require("apollo-server-express");
// const path = require("path");

// const PORT = process.env.PORT || 3001;
// const app = express();

// const server = new ApolloServer({
//   typeDefs,
//   resolvers,
//   context: authMiddleware,
// });

// app.use(express.urlencoded({ extended: true }));
// app.use(express.json());

// app.use(express.static(path.join(__dirname, "../client/build")));

// app.get("/*", (req, res) => {
//   res.sendFile(path.join(__dirname, "../client/build/index.html"));
// });

// const startApolloServer = async () => {
//   await server.start();
//   server.applyMiddleware({ app });

//   db.once("open", () => {
//     app.listen(PORT, () => {
//       console.log(`API server running on port ${PORT}!`);
//       console.log(
//         `Use GraphQL at http://localhost:${PORT}${server.graphqlPath}`
//       );
//     });
//   });
// };

// startApolloServer();

const express = require("express");
const cors = require("cors");
const { ApolloServer } = require("apollo-server-express");
require("./config/connection"); // guarded to skip connect in tests
const typeDefs = require("./schemas/typeDefs");
const resolvers = require("./schemas/resolvers");
const { getUserFromReq } = require("./utils/auth");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

async function initApollo() {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => {
      const user = getUserFromReq(req);
      return { user, req };
    },
  });
  await server.start();
  server.applyMiddleware({ app, path: "/graphql" });
  return server;
}

if (process.env.NODE_ENV !== "test") {
  (async () => {
    await initApollo();
    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () =>
      console.log(`Server ready at http://localhost:${PORT}/graphql`)
    );
  })();
}

module.exports = { app, initApollo };
