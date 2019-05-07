const asyncGetLanguages = require('./asyncGetLanguages');

module.exports = async function asyncGetLanguage(args) {
  const { id, code } = args;
  const languages = await asyncGetLanguages();
  if (id) {
    return languages.find(l => l.id === id);
  }
  if (code) {
    return languages.find(l => l.code === code);
  }
  return languages.find(l => l.code === 'en');
};
