/* eslint-disable no-process-env */
function getLoggingLevel({ env, loggingLevel }) {
  // See list of logging levels here
  // https://github.com/winstonjs/winston/tree/2.4.0#logging-levels

  if (!loggingLevel) {
    if (env === 'production') {
      return 'error';
    }
    return 'debug';
  }

  return loggingLevel;
}

const env = process.env.NODE_ENV || 'development';

const config = {
  apiServer: process.env.API_SERVER_URL,
  apiServerUrl: process.env.API_SERVER_URL,
  clientUrl: process.env.CLIENT_URL,
  env,
  graphQlServer: process.env.GRAPHQL_SERVER_URL,
  host: process.env.HOST || 'localhost',
  imigixUrl: process.env.IMIGIX_URL,
  loggingLevel: getLoggingLevel({
    env,
    loggingLevel: process.env.LOGGING_LEVEL,
  }),
  port: process.env.PORT || 3001,
};

if (typeof window !== 'undefined') {
  config.host = window.location.hostname;
  config.port = window.location.port || 80;
}

module.exports = config;
