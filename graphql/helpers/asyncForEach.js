module.exports = function asyncForEach(array, callback) {
  return Promise.all(array.map((i, index) => callback(i, index, array)));
};
