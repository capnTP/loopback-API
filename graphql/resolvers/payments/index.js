const GraphQlDefinition = require('../GraphQlDefinition');

const resolver = require('./resolver');
const query = require('./query');
const mutation = require('./mutation');
const type = require('./type');

module.exports = new GraphQlDefinition({
  query,
  mutation,
  resolver,
  type,
});
