module.exports = {
  safeGet(fn) {
    try {
      return fn();
    } catch (error) {
      return null;
    }
  },
};
