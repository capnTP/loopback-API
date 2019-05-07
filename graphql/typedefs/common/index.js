const image = require('./image');
const map = require('./map');
const tab = require('./tab');
const textFormats = require('./textFormats');
const success = require('./success');
const error = require('./error');
const count = require('./count');
const downloads = require('./downloads');

module.exports = [image, map, ...tab, ...textFormats, ...success, ...error, count, ...downloads];
