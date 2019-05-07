const { addResolveFunctionsToSchema } = require('graphql-tools');

const resolvers = require('./resolvers/index');
const schema = require('./types/index');

addResolveFunctionsToSchema(schema, resolvers);

module.exports = schema;
