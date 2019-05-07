process.setMaxListeners(0);

require('../graphql/shared/error');
require('dotenv').config();

const helmet = require('helmet');
const loopback = require('loopback');
const boot = require('loopback-boot');
const morgan = require('morgan');
const cors = require('cors');
const { DataSource } = require('loopback-datasource-juggler'); // Sendgrid Integration

const { setApp } = require('../graphql/reference');
const theasiawebSchema = require('../graphql/wwwtheasia');
const schema = require('../graphql/schema');
const attachApolloServer = require('../graphql/attachApolloServer');

const { getAccessToken, validateToken } = require('./helpers/accessToken');
const jsonTryParse = require('./helpers/jsonTryParse');
const env = require('./env');
const service = require('./config/env-service');

const dsSendGrid = new DataSource('loopback-connector-sendgrid', {
  // TODO: fZkVffEtZu
  // move to process.env
  api_key: service.sendgrid,
});
loopback.Email.attachTo(dsSendGrid);

const app = loopback();
app.use(helmet());
app.use(cors());
app.use(loopback.token());

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

attachApolloServer(
  {
    schema,
    playground: !env.IS_DISABLE_GRAPHIQL,
    async context({ req }) {
      const user = jsonTryParse(req.headers.authorization, '');
      // TODO: xDAYehCiFt
      // combine 2 lines below into 1 function
      const accessToken = await getAccessToken(app, user);
      const isValid = await validateToken(accessToken);
      return {
        user,
        accessToken: isValid ? { ...accessToken.toObject() } : {},
      };
    },
  },
  {
    app,
    path: '/graphql',
  },
);

attachApolloServer(
  {
    schema: theasiawebSchema,
    playground: !env.IS_DISABLE_GRAPHIQL,
    context({ req }) {
      return {
        currency: jsonTryParse(req.headers.currency, ''),
        kvariables: req.body.variables || {},
        locale: req.headers.locale,
        user: jsonTryParse(req.headers.authorization, ''),
      };
    },
  },
  {
    app,
    path: '/wwwtheasia_graphql',
  },
);

app.start = () =>
  app.listen(() => {
    app.emit('started');
    const baseUrl = app.get('url').replace(/\/$/, '');
    console.log('Web server listening at: %s', baseUrl);
    if (app.get('loopback-component-explorer')) {
      const explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
    }
  });

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, err => {
  if (err) throw err;
  app.start();
});

// Set App reference for making graphql resolve have direct access to loopback models
app.on('started', () => {
  setApp(app);
});

module.exports = app;
