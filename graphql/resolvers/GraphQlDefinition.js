class GraphQlDefinition {
  constructor({ resolver, mutation, query, type }) {
    this.resolver = resolver;
    this.mutation = mutation;
    this.query = query;
    this.type = type;
  }
}

module.exports = GraphQlDefinition;
