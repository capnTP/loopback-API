const { ApolloServer } = require('apollo-server-express');

module.exports = function createApolloServer(options, applyMiddlewareOptions) {
  const apolloServer = new ApolloServer(options);
  apolloServer.applyMiddleware(applyMiddlewareOptions);
};
