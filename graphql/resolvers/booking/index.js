const GraphQlDefinition = require('../GraphQlDefinition');

const query = require('./query');
const mutation = require('./mutation');
const resolver = require('./resolver');
const type = require('./type');

module.exports = new GraphQlDefinition({ mutation, query, resolver, type });
