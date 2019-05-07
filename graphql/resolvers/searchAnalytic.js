const loopbackRef = require('../reference');

const GraphQlDefinition = require('./GraphQlDefinition');

module.exports = new GraphQlDefinition({
  query: {
    searchAnalytics(root, arg) {
      return loopbackRef.app.models.SearchAnalytics.find({ ...arg });
    },
    searchAnalyticsCount() {
      return loopbackRef.app.models.SearchAnalytics.count();
    },
  },
  type: /* GraphQL */ `
    extend type Query {
      searchAnalytics(limit: Int, offset: Int, order: String): [SearchAnalytic]
      searchAnalyticsCount: Int
    }

    type SearchAnalytic {
      query: String!
      count: Int!
      recently_updated: String
    }
  `,
});
