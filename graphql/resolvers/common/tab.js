const resolver = {
  tab_items: {
    __resolveType(data) {
      return 'latlong' in data ? 'Map' : 'text_format';
    },
  },
};

module.exports = { resolver };
