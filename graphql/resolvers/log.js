const axios = require('../axios');

const GraphQlDefinition = require('./GraphQlDefinition');

module.exports = new GraphQlDefinition({
  query: {
    logs(root, args) {
      const offset = args.offset || 0;
      const limit = args.limit || 10;

      const filter = {
        offset,
        limit,
        order: 'created_at desc',
      };

      if (args.where) {
        filter.where = args.where;
      }

      return axios
        .request({
          url: '/logs',
          params: { filter },
        })
        .then(res => res.data);
    },
    logsCount(root, args) {
      return axios
        .request({
          url: '/logs/count',
          params: { where: args.where },
        })
        .then(res => res.data.count);
    },
  },
  type: /* GraphQL */ `
    extend type Query {
      logs(offset: Int, limit: Int, where: LogsFilter): [Log]
      logsCount(where: LogsFilter): Float
    }

    type Log {
      id: ID!
      created_at: String
      updated_at: String

      message: String
      model_name: String
      response: String
      severity: Int
      source: String
      status_code: Int
      type: String
    }

    input LogsFilter {
      source: String
    }
  `,
});
