module.exports = function jsonTryParse(input, defaultOutput) {
  try {
    return JSON.parse(input);
  } catch (error) {
    return input || defaultOutput;
  }
};
