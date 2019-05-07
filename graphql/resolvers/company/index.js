const GraphQlDefinition = require('../GraphQlDefinition');
const query = require('./query');
const type = require('./type');

module.exports = new GraphQlDefinition({
 query,
  type,
});
