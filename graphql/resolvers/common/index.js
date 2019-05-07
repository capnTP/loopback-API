const GraphQlDefinition = require('../GraphQlDefinition');

const tab = require('./tab');
const textFormats = require('./textFormats');

module.exports = new GraphQlDefinition({
  query: {},
  mutation: {},
  resolver: {
    ...tab.resolver,
    ...textFormats.resolver,
  },
  type: '',
});
