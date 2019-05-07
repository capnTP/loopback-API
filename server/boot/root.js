module.exports = function (server) {
  // Install a `/` route that returns server status
  const router = server.loopback.Router()
  router.get('/', server.loopback.status())
  const handlerRobot = (req, res) => {
    res.type('text/plain')
    res.send('User-agent: *\nDisallow: /')
  }
  router.get('/robots.txt', handlerRobot)
  router.get('/robot.txt', handlerRobot)
  router.get('/ping', (req, res) => {
    res.send({ pong: 1 })
  })

  router.get('/build-version', (req, res) => {
    res.set('Content-Type', 'text/json');
    return res.sendFile(`${__dirname}/version.json`);
  });

  const paymentGatewayRoute = require('./paymentRoute.js')(router)

  server.use(router)
}
