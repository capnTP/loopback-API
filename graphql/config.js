/* eslint-disable no-process-env */

let THE_ASIA_API = 'http://localhost:3003';
let IMGIX_API = 'https://theasia.imgix.net/sandbox';
let PORT = 3003;

if (process.env.NODE_ENV === 'production') {
  THE_ASIA_API = 'https://api.theasia.com';
  IMGIX_API = 'https://theasia.imgix.net';
}
else if (process.env.NODE_ENV === 'development') {
  THE_ASIA_API = process.env.API_SERVER_URL || 'https://api.theasiadev.com';
  PORT = process.env.GRAPHQL_PORT || 80;
}
 else if (process.env.NODE_ENV === 'local') {
  THE_ASIA_API = process.env.API_SERVER_URL || 'http://localhost:3003';
  PORT = process.env.GRAPHQL_PORT || 3003;
}

module.exports = { THE_ASIA_API, IMGIX_API, PORT };
