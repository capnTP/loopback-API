module.exports = function jsonTryParse(jsonString, defaultValue) {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    return defaultValue;
  }
};
