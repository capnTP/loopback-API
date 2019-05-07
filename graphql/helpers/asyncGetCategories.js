const axiosIntance = require('../axios');

let _categories = null;

module.exports = async function asyncGetCategories() {
  if (!_categories) {
    _categories = await axiosIntance.get('/categories').then(res => res.data);
  }

  return _categories;
};
