const asyncGetLanguage = require('./asyncGetLanguage');

function getReducer(language, keys) {
  return function reducer(acc, val) {
    if (String(val.lang_id) === String(language.id)) {
      keys.forEach(k => {
        acc[k] = val[k];
      });
    }
    return acc;
  };
}

module.exports = async function asyncResolveLocalization(target, options) {
  const { code, keys } = options;
  const language = await asyncGetLanguage({ code });
  const _target = JSON.parse(JSON.stringify(target));

  if (Array.isArray(target)) {
    return _target.map(t => t.localization.reduce(getReducer(language, keys), t));
  }

  return _target.localization.reduce(getReducer(language, keys), _target);
};
