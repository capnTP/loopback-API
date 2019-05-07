const axiosIntance = require('../axios');

let languages = null;

module.exports = async function asyncGetLanguages() {
  if (!languages) {
    languages = await axiosIntance.get('/languages').then(res => res.data);
  }
  return languages;
};
