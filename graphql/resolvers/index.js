const user = require('./user');
const product = require('./product');
const common = require('./common');
const booking = require('./booking');
const notes = require('./Notes');
const subProduct = require('./subProduct');
const globalConfig = require('./globalConfig');
const topSearches = require('./topSearches');
const charge = require('./charge');
const affiliate = require('./affiliate');
const supplier = require('./supplier');
const draft = require('./draft');

const Queries = {
  Query: {
    ...product.query,
    ...booking.query,
    ...user.query,
    profile: user.query,
    ...subProduct.queries,
    ...globalConfig.query,
    ...topSearches.query,
    ...charge.query,
    ...affiliate.query,
    ...supplier.query,
    ...draft.queries,
  },
  Mutation: Object.assign(
    {},
    ...[
      affiliate.mutations,
      supplier.mutations,
      user.mutations,
      product.mutations,
      booking.mutation,
      notes.mutation,
      subProduct.mutations,
      globalConfig.mutations,
      charge.mutation,
      draft.mutations,
      topSearches.mutations,
    ],
  ),
};

module.exports = Object.assign(
  {},
  ...[
    Queries,
    user.resolvers,
    affiliate.resolvers,
    supplier.resolvers,
    product.resolver,
    booking.resolver,
    subProduct.resolvers,
    charge.resolvers,
    draft.resolvers,
  ],
);
