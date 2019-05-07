const axios = require('axios')

const WEBSITE_URLS = {
  production: 'https://www.theasia.com/refreshExchangeRate',
  development: 'https://www.theasiadev.com/refreshExchangeRate'
}

const url = WEBSITE_URLS[process.env.SERVER_TYPE]

function updateWebsiteExchangeRate() {
  if (url) {
    axios.get(url)
      .then(() => {
        console.log('Update Website exchangerate success')
      })
      .catch((error) => {
        console.log('Update Website exchange rate error:', error)
      })
  }
}

module.exports = updateWebsiteExchangeRate
