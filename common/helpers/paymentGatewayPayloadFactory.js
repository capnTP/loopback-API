const {
  constants: { isProduction },
} = require('../utility');
const configCredential = require('../../server/config/env-service');

const ingenicoConfig = isProduction
  ? configCredential.ingenicoCredentials.production
  : configCredential.ingenicoCredentials.development;

module.exports = {
  paypalPayload(payment, amount) {
    return {
      pid: payment.external_transaction_id,
      auth: payment.external_authorize_id,
      payment_id: payment.id,
      cur: payment.currency,
      price: Number(amount).toFixed(2),
      // price: Number(payment.total).toFixed(2),
    };
  },
  ingenicoPayload(payment, amount) {
    return {
      pid: payment.external_authorize_id,
      payment_id: payment.id,
      cur: payment.currency,
      merchant: payment.payment_method_id == 4 ? 1774 : ingenicoConfig.merchantId, // fix union pay
      amount,
      // amount: payment.total,
    };
  },
  iamportPayload(payment, amount) {
    return {
      pid: payment.external_authorize_id,
      payment_id: payment.id,
      cur: payment.currency,
      amount,
    };
  },
};
