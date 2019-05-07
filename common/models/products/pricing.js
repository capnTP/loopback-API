module.exports = function (Pricing) {
  Pricing.priceType = function (cb) {
    const price_types = [{
        name: 'Range',
        value: 'range',
        alias: 'Date-Range',
        localization: {
          'en': 'Range',
          'ko': 'Range',
          'zh': 'Range',
          'th': 'Range'
        }
      },
      {
        name: 'Repeat',
        value: 'repeat',
        alias: 'Date-Repeat',
        localization: {
          'en': 'repeat',
          'ko': 'repeat',
          'zh': 'repeat',
          'th': 'repeat'
        }
      }
    ]

    return cb(null, price_types);
  };

  Pricing.remoteMethod('priceType', {
    returns: {
      arg: 'response',
      type: 'string',
      root: true
    },
    http: {
      path: '/price-type',
      verb: 'get'
    },
  });
};
