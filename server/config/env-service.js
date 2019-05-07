module.exports = {
  // aws credentail s3 level access
  awsCredentials: {
    accessKeyId: '#AWS S3 access key',
    secretAccessKey: '#AWS S3 secret key',
  },
  // full-access sendgrid api key
  sendgrid: '#sendgrid api key',
  // open exchange rate app_id
  openExchangeRate: '#open exchange rate app_id',
  // ingenico credential
  ingenicoCredentials: {
    production: {
      apiKeyId: '#ingenico production api key',
      secretApiKey: '#ingenico production secret Api Key',
      merchantId: '#ingenico production merchantId',
      apiEndpoint: {
        host: 'api.globalcollect.com',
        scheme: 'https',
        port: 443,
      },
    },
    development: {
      apiKeyId: '#ingenico development api key',
      secretApiKey: '#ingenico development secret Api Key',
      merchantId: '#ingenico development merchantId',
      apiEndpoint: {
        host: 'api-preprod.globalcollect.com',
        scheme: 'https',
        port: 443,
      },
    },
  },
  // iamport credential
  iamportCredentials: {
    merchantId: '#iamport merchant id',
    apiKeyId: '#iamport api key',
    secretApiKey: '#iamport secret key',
    apiEndpoint: {
      host: 'https://api.iamport.kr',
      scheme: 'https',
      port: 443,
    },
  },
  // paypal credentials
  paypalCredentials: {
    production: {
      mode: 'live',
      client_id: '#paypal production client_id',
      client_secret: '#paypal production client_secret',
    },
    development: {
      mode: 'sandbox',
      client_id: '#paypal development client_id',
      client_secret: '#paypal development client_secret',
    },
  },
};
