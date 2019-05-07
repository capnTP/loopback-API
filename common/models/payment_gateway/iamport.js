const axios = require('axios');
const moment = require('moment');

const hostConfig = require('../../../server/config/config.json');
const configCredential = require('../../../server/config/env-service');

const iamportConfig = configCredential.iamportCredentials;

const BASE_URL =
  process.env.NODE_ENV == 'production' ? hostConfig.production : hostConfig.development;
const IAMPORT_BASE_URL = iamportConfig.apiEndpoint.host;
const IAMPORT_KEY = iamportConfig.apiKeyId;
const IAMPORT_SECRET = iamportConfig.secretApiKey;

module.exports = function(Iamport) {
  const authenticate = async () => {
    try {
      const response = await axios.post(`${IAMPORT_BASE_URL}/users/getToken`, {
        imp_key: IAMPORT_KEY,
        imp_secret: IAMPORT_SECRET,
      });
      return response.data.response;
    } catch (err) {
      return { message: 'IAMPORT_ERROR_WHILE_AUTHENTICATE' };
    }
  };

  async function pushLogData(
    url,
    type,
    source,
    severity,
    message,
    response,
    model_name,
    status_code,
  ) {
    const PaymentLogs = Iamport.app.models.PaymentLogs;

    const logPostData = {
      type,
      source,
      severity,
      message,
      response: JSON.stringify(response),
      model_name,
      status_code,
    };
    try {
      const paymentLog = await PaymentLogs.create(logPostData);
    } catch (err) {
      console.log('payment logs cannot create ', err);
    }
  }

  /**
   * This method use to create payment data after booking_payment is completed
   * @param {*} booking_id
   */
  Iamport.createPayment = async data => {
    const booking_id = data.booking_id;
    const imp_uid = data.imp_uid;
    try {
      // const iamportPaymentData = await Iamport.findPayment(booking_id)
      const iamportPaymentData = await Iamport.getPayment(imp_uid);
      const paymentBodyData = {
        payment_status_id: 1,
        payment_gateway_response: JSON.stringify(iamportPaymentData),
        external_transaction_id: iamportPaymentData.imp_uid,
        external_authorize_id: iamportPaymentData.imp_uid,
        external_charge_id: '',
        external_refund_id: '',
        booking_id,
        payment_method_id: parseInt(5, 10),
        total: iamportPaymentData.amount,
        currency: iamportPaymentData.currency,
        external_reference_id: iamportPaymentData.imp_uid,
      };

      const paymentCreated = await Iamport.app.models.Payments.create(paymentBodyData);

      const resData = {};
      if (paymentCreated) {
        resData.status = 200;
        pushLogData(
          `${BASE_URL.api_url}/PaymentLogs/`,
          'PAYMENT_LOG',
          'CREATE_PAYMENT',
          2,
          `bid: ${booking_id}`,
          JSON.stringify(paymentCreated),
          'IAMPORT',
          0,
        );
      } else {
        resData.status = 500;
        resData.payment = false;
        resData.customer = 5000;
        resData.message = 'Api payment create has error';
        pushLogData(
          `${BASE_URL.api_url}/PaymentLogs/`,
          'PAYMENT_LOG',
          'CREATE_PAYMENT_FAIL',
          4,
          `bid: ${booking_id}`,
          resData,
          'IAMPORT',
          5000,
        );
      }

      return Promise.resolve(resData);
    } catch (err) {
      console.log(err);
      const statusCode = err.status;
      const statusText = err.statusText;
      return Promise.resolve({
        message: 'IAMPORT_ERROR_WHILE_CREATE_PAYMENT',
        statusCode,
        statusText,
      });
    }
  };
  Iamport.remoteMethod('createPayment', {
    accepts: [
      {
        arg: 'data',
        type: 'object',
        http: { source: 'body' },
        required: true,
      },
      { arg: 'req', type: 'object', http: { source: 'req' } },
    ],
    returns: { type: 'object', root: true },
    http: { path: '/createPayment', verb: 'post' },
  });

  Iamport.completePayment = async (gatewayPaymentId, merchantId, refId, bookingId) => {
    try {
      const bookingData = await Iamport.app.models.Booking.findById(bookingId);
      const bookingMethodId = parseInt(bookingData.booking_method_id, 10);

      // Create payment only for NOT AAB bookings
      // (AAB bookings already have payment data)
      if (![3, 4, 5, 6].includes(bookingMethodId)) {
        const iamportPaymentData = await Iamport.getPayment(gatewayPaymentId);

        // create new payment data
        const paymentBodyData = {
          payment_status_id: 1,
          payment_gateway_response: JSON.stringify(iamportPaymentData),
          external_transaction_id: iamportPaymentData.imp_uid,
          external_authorize_id: iamportPaymentData.imp_uid,
          external_charge_id: '',
          external_refund_id: '',
          booking_id: bookingId,
          payment_method_id: parseInt(5, 10),
          total: iamportPaymentData.amount,
          currency: iamportPaymentData.currency,
          total_refund: 0,
          external_reference_id: iamportPaymentData.imp_uid,
        };

        await Iamport.app.models.Payments.create(paymentBodyData);
      } else {
        // Update payment status to 1 -> will trigger booking status update
        const payment = await Iamport.app.models.Payments.findOne({
          where: { booking_id: bookingId },
        });
        await payment.updateAttributes({ payment_status_id: 1 });
        await bookingData.updateAttribute('booking_status_id', 1);
        await Iamport.app.models.Charge.createChargeFromBooking(bookingId);
      }

      return Promise.resolve({ status: 1000, statusCode: 'PAID' });
    } catch (err) {
      console.log(err);
      return Promise.resolve({
        status: 5000,
        statusCode: 'Fail in api complete Iamport',
      });
    }
  };

  Iamport.remoteMethod('completePayment', {
    accepts: [
      { arg: 'gatewayPaymentId', type: 'string', description: 'gatewayPaymentId', required: true },
      { arg: 'merchantId', type: 'string', description: 'merchantId', required: true },
      { arg: 'refId', type: 'string', description: 'refId', required: true },
      { arg: 'bookingId', type: 'string', description: 'booking_id', required: true },
    ],
    returns: { type: 'object', root: true },
    http: { path: '/completePayment', verb: 'post' },
  });

  /**
   * This method use to retrieve payment data from gateway by using booking id
   * @param {*} payment_id
   */
  Iamport.approvePayment = async function(data) {
    const Payment = Iamport.app.models.Payments;
    if (!data.pid) return Promise.reject('No payment id data');
    if (!data.payment_id) return Promise.reject('No database payment id data');
    const responseData = {};
    try {
      const responseFromIamport = await Iamport.getPayment(data.pid);

      if (responseFromIamport.status !== 'paid')
        return Promise.reject('THIS PAYMENT DID NOT COMPLETE');

      let paymentData = await Payment.findById(data.payment_id);
      await paymentData.updateAttributes({
        payment_status_id: 2,
        total_charge: data.amount,
        final_amount: data.amount,
      });

      paymentData = await Payment.findById(data.payment_id);

      pushLogData(
        `${BASE_URL.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'SETTLE',
        2,
        `Approve payment from pid: ${data.payment_id}`,
        paymentData,
        'IAMPORT',
        0,
      );

      responseData.api = paymentData;
      responseData.data = responseFromIamport;
      responseData.status = 1000; // success payment status

      return Promise.resolve(responseData);
    } catch (err) {
      pushLogData(
        `${BASE_URL.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'SETTLE',
        4,
        `pid: ${data.payment_id}`,
        err,
        'IAMPORT',
        0,
      );
      responseData.status = 5000;
      return Promise.resolve(responseData);
    }
  };

  /**
   * This method use to retrieve payment data from gateway by using booking id
   * @param {*} ref_id
   * @param {*} payment_status
   * @param {*} sorting
   */
  Iamport.findPayment = async (ref_id, payment_status = '', sorting = '-started') => {
    try {
      const token = await authenticate();
      let url = `${IAMPORT_BASE_URL}/payments/find/${ref_id}`;
      if (payment_status !== '' && payment_status !== null) url += `/${payment_status}`;
      url += `?sorting=${sorting}`;
      const response = await axios({
        method: 'get',
        url,
        headers: { Authorization: token.access_token },
      });
      return Promise.resolve({ statusCode: response.data.code, response: response.data.response });
    } catch (err) {
      const statusCode = err.response.status;
      const statusText = err.response.statusText;
      return Promise.resolve({
        message: 'IAMPORT_ERROR_WHILE_FIND_PAYMENT',
        statusCode,
        statusText,
      });
    }
  };
  Iamport.remoteMethod('findPayment', {
    accepts: [
      { arg: 'booking_id', type: 'string', description: 'booking id', required: true },
      {
        arg: 'payment_status',
        type: 'string',
        description: 'payment_status. if not specificed, all status are queried.',
        required: false,
      },
      {
        arg: 'sorting',
        type: 'string',
        description: '-started(default), started, -paid, paid, -updated, updated',
        required: false,
      },
    ],
    returns: { arg: 'response', type: 'object', root: true },
    http: { path: '/findPayment', verb: 'post' },
  });

  /**
   * This method use to retrieve payment data from gateway by using gateway id
   * @param {*} iamport_payment_id
   */
  Iamport.getPayment = async iamport_payment_id => {
    try {
      const token = await authenticate();
      const response = await axios({
        method: 'get',
        url: `${IAMPORT_BASE_URL}/payments/${iamport_payment_id}`,
        headers: { Authorization: token.access_token },
      });
      return Promise.resolve(response.data.response);
    } catch (err) {
      const statusCode = err.response.status;
      const statusText = err.response.statusText;
      return Promise.resolve({
        message: 'IAMPORT_ERROR_WHILE_GET_PAYMENT',
        statusCode,
        statusText,
      });
    }
  };
  Iamport.remoteMethod('getPayment', {
    accepts: [
      {
        arg: 'iamport_payment_id',
        type: 'string',
        description: 'iamport payment id',
        required: true,
      },
    ],
    returns: { arg: 'response', type: 'object', root: true },
    http: { path: '/getPayment', verb: 'post' },
  });

  Iamport.getPaymentData = async iamport_payment_id => {
    try {
      const token = await authenticate();
      const response = await axios({
        method: 'get',
        url: `${IAMPORT_BASE_URL}/payments/${iamport_payment_id}`,
        headers: { Authorization: token.access_token },
      });
      return Promise.resolve(response.data);
    } catch (err) {
      const statusCode = err.response.status;
      const statusText = err.response.statusText;
      return Promise.resolve({
        message: 'IAMPORT_ERROR_WHILE_GET_PAYMENT',
        statusCode,
        statusText,
      });
    }
  };
  Iamport.remoteMethod('getPaymentData', {
    accepts: [
      {
        arg: 'iamport_payment_id',
        type: 'string',
        description: 'iamport payment id',
        required: true,
      },
    ],
    returns: { arg: 'response', type: 'object', root: true },
    http: { path: '/getPaymentData', verb: 'post' },
  });

  /**
   * This method use for internal call from payment.refund only
   * @param {*} payment_obj
   * @param {*} amount
   * @param {*} currency
   */
  Iamport.refund = async (paymentObj, amount, currency) => {
    const iamportPaymentId = paymentObj.external_authorize_id;
    const bookingId = paymentObj.booking_id;
    const bookingData = Iamport.app.models.Booking.findById(bookingId);
    const responseData = {};

    try {
      const token = await authenticate();
      const responseFromIamport = await axios({
        method: 'post',
        url: `${IAMPORT_BASE_URL}/payments/cancel`,
        headers: { Authorization: token.access_token },
        data: {
          imp_uid: iamportPaymentId,
          merchant_uid: bookingData.refId || '',
          amount,
        },
      });

      if (responseFromIamport.data.code !== 0)
        return Promise.reject('THIS PAYMENT CANNOT BE REFUNDED');

      const iamportPaymentData = await Iamport.getPayment(paymentObj.external_authorize_id);

      const paymentBodyData = {
        payment_status_id: 4,
        payment_gateway_response: JSON.stringify(iamportPaymentData),
        external_transaction_id: paymentObj.external_transaction_id,
        external_authorize_id: paymentObj.external_authorize_id,
        external_charge_id: '',
        external_refund_id:
          responseFromIamport.data.response.cancel_history[
            responseFromIamport.data.response.cancel_history.length - 1
          ].pg_tid,
        booking_id: bookingId,
        payment_method_id: parseInt(paymentObj.payment_method_id, 10),
        total: 0,
        total_refund: amount,
        currency,
        final_amount: iamportPaymentData.cancel_amount,
        external_reference_id: paymentObj.external_authorize_id,
      };
      const refundPayment = await Iamport.app.models.Payments.create(paymentBodyData);
      // check this 3 comment again because this 3 lines have a problem with redirect
      // pushLogData(`${BASE_URL.api_url}/PaymentLogs/`, 'PAYMENT_API', 'REFUND', 2, `Create refund payment pid: ${refundPayment.id}`, refundPayment, 'IAMPORT', 0)

      // responseData.api = refundPayment
      // responseData.data = responseFromIamport
      responseData.status = 1000; // success payment status
      return Promise.resolve(responseData);
    } catch (err) {
      pushLogData(
        `${BASE_URL.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'CREATE REFUND ERROR',
        4,
        `pid: ${paymentObj.id}`,
        err,
        'IAMPORT',
        500,
      );
      responseData.status = 5000;
      return Promise.reject(responseData);
    }
  };

  /**
   * This method use for internal call from payment.cancel only
   ** Note, this method is not same like other cancel paymentGateWay
   **       because Inicis will charge the payment immediately when user complete payment
   **       Then we should refund in full amount when the booking is inquiry cancellation step
   * @param {*} payment_obj
   * @param {*} amount
   * @param {*} currency
   */
  Iamport.cancelWithRefund = async (paymentObj, amount, currency) => {
    const iamportPaymentId = paymentObj.external_authorize_id;
    const bookingId = paymentObj.booking_id;
    const bookingData = Iamport.app.models.Booking.findById(bookingId);
    const responseData = {};

    try {
      const token = await authenticate();
      const responseFromIamport = await axios({
        method: 'post',
        url: `${IAMPORT_BASE_URL}/payments/cancel`,
        headers: { Authorization: token.access_token },
        data: {
          imp_uid: iamportPaymentId,
          merchant_uid: bookingData.refId || '',
          amount: 0,
        },
      });

      if (responseFromIamport.data.code !== 0)
        return Promise.reject('THIS PAYMENT CANNOT BE CANCEL AND REFUND');

      const paymentData = await Iamport.app.models.Payments.findById(paymentObj.id);
      if (paymentData) {
        paymentData.updateAttributes({ payment_status_id: 5 });
      }
      // check this 3 comment again because this 3 lines have a problem with redirect
      // pushLogData(`${BASE_URL.api_url}/PaymentLogs/`, 'PAYMENT_API', 'REFUND', 2, `Create refund payment pid: ${refundPayment.id}`, refundPayment, 'IAMPORT', 0)

      // responseData.api = refundPayment
      // responseData.data = responseFromIamport
      responseData.status = 1000; // success payment status
      return Promise.resolve(responseData);
    } catch (err) {
      pushLogData(
        `${BASE_URL.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'CREATE REFUND ERROR',
        4,
        `pid: ${paymentObj.id}`,
        err,
        'IAMPORT',
        500,
      );
      responseData.status = 5000;
      return Promise.reject(responseData);
    }
  };
};
