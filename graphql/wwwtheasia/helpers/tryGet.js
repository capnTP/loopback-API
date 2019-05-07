module.exports = function tryGet(fn, defaultValue = null) {
  try {
    return fn();
  } catch (error) {
    return defaultValue;
  }
};
