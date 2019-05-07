module.exports = function (Prices) {

    Prices.priceType = function (cb) {
        var price_types = [
            {
                name: "Range-Repeat",
                value: "range-repeat",
                alias: "Both",
                localization: {
                    'en': "Range-Repeat",
                    'ko': "Range-Repeat",
                    'zh': "Range-Repeat",
                    'th': "Range-Repeat"
                }
            },
            {
                name: "Range",
                value: "range",
                alias: "Date-Range",
                localization: {
                    'en': "Range",
                    'ko': "Range",
                    'zh': "Range",
                    'th': "Range"
                }
            },
            {
                name: "Repeat",
                value: "repeat",
                alias: "Date-Repeat",
                localization: {
                    'en': "repeat",
                    'ko': "repeat",
                    'zh': "repeat",
                    'th': "repeat"
                }
            }]

        return cb(null,price_types);

    };

    Prices.remoteMethod('priceType', {
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