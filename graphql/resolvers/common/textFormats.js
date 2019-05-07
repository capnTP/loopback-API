const resolver = {
  text_formats: {
    __resolveType(data) {
      return 'icon' in data ? 'listwithicons' : 'stringType';
    },
  },
};

module.exports = { resolver };
