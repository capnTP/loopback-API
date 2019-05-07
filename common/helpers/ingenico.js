const connectSdk = require('connect-sdk-nodejs');

const configCredential = require('../../server/config/env-service');

const ingenicoConfig = configCredential.ingenicoCredentials;

let config;
if (process.env.NODE_ENV == 'production') {
  config = ingenicoConfig.production;
} else {
  config = ingenicoConfig.development;
}

connectSdk.init({
  host: config.apiEndpoint.host,
  scheme: config.apiEndpoint.scheme,
  port: config.apiEndpoint.port,
  enableLogging: config.enableLogging, // defaults to false
  logger: undefined, // if undefined console.log will be used
  apiKeyId: config.apiKeyId,
  secretApiKey: config.secretApiKey,
  integrator: config.integrator,
});

const ingenico = {
  // create hosted checkout
  createHostedCheckoutFromSDK(bodyData, merchantId = config.merchantId) {
    return new Promise((resolve, reject) => {
      connectSdk.hostedcheckouts.create(merchantId, bodyData, null, (error, sdkResponse) => {
        if (error) return reject(error);

        const finalData = sdkResponse.body;
        return resolve(finalData);
      });
    });
  },

  // Payment checkout status
  getHostedCheckoutsFromSDK(hostedCheckoutId, merchantId = config.merchantId) {
    return new Promise((resolve, reject) => {
      connectSdk.hostedcheckouts.get(merchantId, hostedCheckoutId, null, (error, sdkResponse) => {
        if (error) return reject(error);

        return resolve(sdkResponse);
      });
    });
  },

  createSessionFromSDK(bodyData, merchantId = config.merchantId) {
    return new Promise((resolve, reject) => {
      connectSdk.sessions.create(merchantId, bodyData, null, (error, sdkResponse) => {
        if (error) return reject(error);

        return resolve(sdkResponse);
      });
    });
  },

  createPaymentFromSDK(bodyData, merchantId = config.merchantId) {
    return new Promise((resolve, reject) => {
      connectSdk.payments.create(merchantId, bodyData, null, (error, sdkResponse) => {
        if (error) return reject(error);

        const finalData = sdkResponse;
        return resolve(finalData);
      });
    });
  },

  findPaymentsFromSDK(merchantOrderId, merchantId = config.merchantId) {
    return new Promise((resolve, reject) => {
      connectSdk.payments.find(merchantId, { merchantOrderId }, (error, sdkResponse) => {
        if (error) return reject(error);
        return resolve(sdkResponse);
      });
    });
  },

  // Payment status
  getPaymentFromSDK(paymentId, merchantId = config.merchantId) {
    return new Promise((resolve, reject) => {
      connectSdk.payments.get(merchantId, paymentId, null, (error, sdkResponse) => {
        if (error) return reject(error);

        return resolve(sdkResponse);
      });
    });
  },
  // Payment approve
  approvePaymentFromSDK(paymentId, merchantId = config.merchantId, bodyData) {
    return new Promise((resolve, reject) => {
      connectSdk.payments.approve(merchantId, paymentId, bodyData, null, (error, sdkResponse) => {
        if (error) return reject(error);

        return resolve(sdkResponse);
      });
    });
  },
  // Cancel Payment approve
  cancelApprovalPaymentFromSDK(paymentId, merchantId = config.merchantId) {
    return new Promise((resolve, reject) => {
      connectSdk.payments.cancelapproval(merchantId, paymentId, null, (error, sdkResponse) => {
        if (error) return reject(error);

        return resolve(sdkResponse);
      });
    });
  },
  // Cancel Payment
  cancelPaymentFromSDK(paymentId, merchantId = config.merchantId) {
    return new Promise((resolve, reject) => {
      connectSdk.payments.cancel(merchantId, paymentId, null, (error, sdkResponse) => {
        if (error) return reject(error);

        return resolve(sdkResponse);
      });
    });
  },
  // Create refund
  createRefundFromSDK(paymentId, merchantId = config.merchantId, bodyData) {
    return new Promise((resolve, reject) => {
      connectSdk.payments.refund(merchantId, paymentId, bodyData, null, (error, sdkResponse) => {
        if (error) return reject(error);

        return resolve(sdkResponse);
      });
    });
  },
  findRefundFromSDK(merchantOrderId, merchantId = config.merchantId) {
    return new Promise((resolve, reject) => {
      connectSdk.refunds.find(merchantId, { merchantOrderId }, (error, sdkResponse) => {
        if (error) return reject(error);

        return resolve(sdkResponse);
      });
    });
  },
  // Get refund
  getRefundFromSDK(refundId, merchantId = config.merchantId) {
    return new Promise((resolve, reject) => {
      connectSdk.refunds.get(merchantId, refundId, null, (error, sdkResponse) => {
        if (error) return reject(error);

        return resolve(sdkResponse);
      });
    });
  },
  // Approve refund
  approveRefundFromSDK(refundId, merchantId = config.merchantId, bodyData) {
    return new Promise((resolve, reject) => {
      connectSdk.refunds.approve(merchantId, refundId, bodyData, null, (error, sdkResponse) => {
        if (error) return reject(error);

        return resolve(sdkResponse);
      });
    });
  },
  // Cancel refund
  cancelRefundFromSDK(refundId, merchantId = config.merchantId) {
    return new Promise((resolve, reject) => {
      connectSdk.refunds.cancel(merchantId, refundId, null, (error, sdkResponse) => {
        if (error) return reject(error);

        return resolve(sdkResponse);
      });
    });
  },
  // Undo refund
  undoRefundFromSDK(refundId, merchantId = config.merchantId) {
    return new Promise((resolve, reject) => {
      connectSdk.refunds.cancelapproval(merchantId, refundId, null, (error, sdkResponse) => {
        if (error) return reject(error);

        return resolve(sdkResponse);
      });
    });
  },
  // Approve fraud Payment
  approveFraudPaymentFromSDK(paymentId, merchantId = config.merchantId) {
    return new Promise((resolve, reject) => {
      connectSdk.payments.processchallenged(merchantId, paymentId, null, (error, sdkResponse) => {
        if (error) return reject(error);

        return resolve(sdkResponse);
      });
    });
  },

  // get payment channel available
  getPaymentMethodsFromSDK(queryParams, merchantId = config.merchantId) {
    return new Promise((resolve, reject) => {
      connectSdk.products.find(merchantId, queryParams, (error, sdkResponse) => {
        if (error) return reject(error);

        return resolve(sdkResponse);
      });
    });
  },

  // get IIN details
  getIINdetailsFromSDK(postData, merchantId = config.merchantId) {
    return new Promise((resolve, reject) => {
      connectSdk.services.getIINdetails(merchantId, postData, null, (error, sdkResponse) => {
        if (error) return reject(error);

        return resolve(sdkResponse);
      });
    });
  },

  // create token for payments
  createTokenFromSDK(bodyData, merchantId = config.merchantId) {
    return new Promise((resolve, reject) => {
      connectSdk.tokens.create(merchantId, bodyData, null, (error, sdkResponse) => {
        if (error) return reject(error);

        return resolve(sdkResponse);
      });
    });
  },

  // get token for payments
  getTokenFromSDK(tokenId, merchantId = config.merchantId) {
    return new Promise((resolve, reject) => {
      connectSdk.tokens.get(merchantId, tokenId, null, (error, sdkResponse) => {
        if (error) return reject(error);

        return resolve(sdkResponse);
      });
    });
  },

  // update token for payments
  updateTokenFromSDK(bodyData, tokenId, merchantId = config.merchantId) {
    return new Promise((resolve, reject) => {
      connectSdk.tokens.update(merchantId, tokenId, bodyData, null, (error, sdkResponse) => {
        if (error) return reject(error);

        return resolve(sdkResponse);
      });
    });
  },

  // delete token for payments
  deleteTokenFromSDK(queryData, tokenId, merchantId = config.merchantId) {
    return new Promise((resolve, reject) => {
      connectSdk.tokens.remove(merchantId, tokenId, queryData, (error, sdkResponse) => {
        if (error) return reject(error);

        return resolve(sdkResponse);
      });
    });
  },
};

module.exports = ingenico;
