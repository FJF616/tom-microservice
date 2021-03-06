'use strict'

const bodyParser = require('body-parser')
const { forEach, mapKeys, camelCase } = require('lodash')

const { loadConfig, wrapRoute } = require('../src/helpers')
const createCommands = require('../src')

const { API_KEY } = process.env

module.exports = async (app, express) => {
  const config = await loadConfig()

  app
    .use(require('helmet')())
    .use(require('jsendp')())
    .use(require('compression')())
    .use(require('cors')())
    .use(require('query-types').middleware())
    .use(bodyParser.urlencoded({ extended: true }))
    .use(bodyParser.json())
    .use(require('morgan')('short'))
    .disable('x-powered-by')

  app.get('/', (req, res) => res.status(204).send())
  app.get('/robots.txt', (req, res) => res.status(204).send())
  app.get('/favicon.txt', (req, res) => res.status(204).send())
  app.get('/ping', (req, res) => res.send('pong'))

  app.use((req, res, next) => {
    req.body = mapKeys(req.body, (value, key) => camelCase(key))
    next()
  })

  if (API_KEY) {
    app.use((req, res, next) => {
      const apiKey = req.headers['x-api-key']
      return apiKey === API_KEY
        ? next()
        : res.fail({
          statusCode: 401,
          message: 'Invalid API token in x-api-key header.'
        })
    })
  }

  const commands = createCommands(config)

  forEach(commands, (subCommands, commandName) => {
    forEach(subCommands, (subCommandFn, subCommandName) => {
      const route = `/${commandName}/${subCommandName}`
      const fn = wrapRoute({
        fn: subCommandFn,
        keyword: `${commandName}.${subCommandName}`
      })
      app.post(route, fn)
    })
  })

  app.use((req, res) =>
    res.fail({
      statusCode: 405,
      message: 'HTTP Method Not Allowed'
    })
  )

  return app
}
