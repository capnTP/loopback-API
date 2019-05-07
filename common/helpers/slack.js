// LoggerBuilder can't import, probably circular dependency causing error
// Replace with manual chalk
const chalk = require('chalk')
const axios = require('axios')

const errorReporting = (text) => {
  const env = process.env.NODE_ENV
  // Don't send slack message for tests
  if (env !== 'production' && env !== 'development' && env !== 'local') return

  const urls = {
    production: 'https://hooks.slack.com/services/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',
    development: 'https://hooks.slack.com/services/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',
    local: process.env.SLACK_ERROR_URL
  }

  const url = urls[env] || urls.development

  const payload = {
    text,
    username: 'Error Bot',
    icon_emoji: ':warning:'
  }

  axios.post(url, JSON.stringify(payload))
    .then(() => console.log(chalk.green('Info'), 'Slack Error Report Success'))
    .catch(error => console.log(chalk.red('Slack Error Reporting Error:'), error))
}

module.exports = {
  errorReporting
}
