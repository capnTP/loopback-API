const moment = require('moment');

module.exports = function (SearchAnalaytics) {
  SearchAnalaytics.record = (query, cb) => {
    if (!query || query.length < 4) {
      return cb(null, false);
    }
    else {
      query = query.trim();
      SearchAnalaytics.find({ 'where': { 'query': query } }, (err, results) => {
        if (results && results.length) {
          results[0].updateAttributes({ count: parseInt(results[0].count, 10) + 1, recently_searched_at: moment() })
          return cb(null, true);
        }
        else {
          SearchAnalaytics.create({
            'query': query
          });
          return cb(null, true);
        }
      });
    }
  }
  SearchAnalaytics.remoteMethod('record', {
    accepts: [{
      arg: 'query',
      type: 'string',
      required: true,
    }],
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/record',
      verb: 'post',
    },
  });

  SearchAnalaytics.topSearches = (cb) => {
    SearchAnalaytics.find({
      order: 'count DESC',
      limit: 10
    }, (err, searches) => cb(null, searches));
  }


  SearchAnalaytics.remoteMethod('topSearches', {
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/topSearches',
      verb: 'get',
    },
  });
}
