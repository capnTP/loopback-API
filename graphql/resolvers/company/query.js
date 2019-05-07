const {
  pick
} = require('underscore');

const {
  THE_ASIA_API
} = require('../../config');
const logger = require('../../logger');
const loopbackRef = require('../../reference')
const axios = require('../../axios')

const query = {
  async companies(root, args) {
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

    return await loopbackRef.app.models.Company.find();
  },
  async companiesCount(root, arg) {
    return await loopbackRef.app.models.Company.count();
  },
  async company(_, {
    id
  }) {
    return await loopbackRef.app.models.Company.findById(id);
  }
};

module.exports = query;
