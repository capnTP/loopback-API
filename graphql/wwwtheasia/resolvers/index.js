const tours = require('./tours');
const user = require('./user');
const currency = require('./common/currency');
const countries = require('./countries');
const cities = require('./cities');
const booking = require('./booking');
const review = require('./review');
const search = require('./search');
const payment = require('./payment');
const policies = require('./policies');
const languages = require('./language');
const contact = require('./contact');
const newsletter = require('./newsletter');
const weather = require('./weather');
const feature = require('./feature');
const discover = require('./discover');
const category = require('./category');
const categoryType = require('./categoryType');
const home = require('./home');

const Queries = {
  Query: {
    ...tours.query,
    ...user.query,
    ...currency.query,
    ...booking.query,
    ...countries.query,
    ...cities.query,
    ...review.query,
    ...payment.query,
    ...policies.query,
    ...languages.query,
    ...weather.query,
    ...feature.query,
    ...discover.query,
    ...categoryType.query,
    ...home.query,
  },
  Mutation: Object.assign(
    {},
    ...[
      tours.mutations,
      user.mutations,
      booking.mutations,
      search.mutations,
      review.mutation,
      contact.mutations,
      newsletter.mutation,
    ],
  ),
};

module.exports = Object.assign(
  {},
  ...[
    Queries,
    tours.resolvers,
    user.resolvers,
    currency.resolvers,
    countries.resolvers,
    cities.resolvers,
    booking.resolvers,
    review.resolver,
    languages.resolver,
    weather.resolvers,
    feature.resolver,
    discover.resolvers,
    category.resolvers,
    categoryType.resolvers,
    home.resolvers,
  ],
);
