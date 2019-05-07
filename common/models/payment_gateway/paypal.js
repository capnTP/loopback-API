const paypal = require('paypal-rest-sdk');

const hostConfig = require('../../../server/config/config.json');
const configCredential = require('../../../server/config/env-service');

const paypalConfig = configCredential.paypalCredentials;
const { newLoopbackError, HTTPStatusCode, getSafe } = require('../../utility');

const { FORBIDDEN, BAD_REQUEST } = HTTPStatusCode;

let configHost;
if (process.env.NODE_ENV == 'production') {
  configHost = hostConfig.production;
} else if (process.env.NODE_ENV == 'development') {
  configHost = hostConfig.development;
} else {
  configHost = hostConfig.local;
}

let config;
if (process.env.NODE_ENV == 'production') {
  config = paypalConfig.production;
} else if (process.env.NODE_ENV == 'development') {
  config = paypalConfig.development;
} else {
  config = paypalConfig.development;
}

paypal.configure({
  mode: config.mode,
  client_id: config.client_id,
  client_secret: config.client_secret,
});

module.exports = Paypal => {
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
    const PaymentLogs = Paypal.app.models.PaymentLogs;

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
   * GET all payment from paypal
   * use it carefuly consume alot of time
   * @param {Internet Date/Time Format} start_time - rfc3339#section-5.6 ex: '2016-03-06T11:00:00Z', booking.created_at
   */
  Paypal.getAllPayments = async start_time => {
    try {
      const getPayments = start_id =>
        new Promise((resolve, reject) => {
          paypal.payment.list({ start_time, start_id, count: 20 }, (err, res) => {
            if (err) return reject(err);
            return resolve(res);
          });
        });

      const payments = [];
      let start_id = null;

      do {
        const responsePayments = await getPayments(start_id);
        start_id = responsePayments.next_id;
        payments.push(...responsePayments.payments);
      } while (start_id != null);

      return Promise.resolve(payments);
    } catch (error) {
      console.log(error);
      return Promise.reject(error);
    }
  };
  /*
  Paypal.remoteMethod('getAllPayments', {
    accepts: [
      { arg: 'booking_id', type: 'string' },
    ],
    returns: { type: 'Object', root: true },
    http: { path: '/getAllPayments', verb: 'get' },
  })
  */

  Paypal.getTotalPay = async booking_id => {
    try {
      // this approch are consume alot of time
      // const booking = await Paypal.app.models.Booking.findById(booking_id)
      // const allPayments = await Paypal.getAllPayments(booking.created_at)
      // const payments = allPayments.filter(e => e.transactions[0].reference_id == booking_id)
      // const totalPay = payments.reduce((acc, cur) => acc + cur.transactions[0].amount.total)
      // return Promise.resolve(totalPay)

      const payments = await Paypal.app.models.Payments.find({
        where: { booking_id, payment_method_id: 1 },
      });
      if (!payments || payments.length === 0) return Promise.resolve(0);
      const totalPay = payments.reduce((acc, cur) => acc + cur.total, 0);
      return Promise.resolve(totalPay);
    } catch (error) {
      console.log(error);
      return Promise.reject(error);
    }
  };

  Paypal.createPayment = async (data, req, cb) => {
    const Booking = Paypal.app.models.Booking;

    if (!data.booking_id) return Promise.reject('No booking id data');
    if (!data.payment_method_id) return Promise.reject('No payment_method_id data');
    if (data.payment_method_id != '1')
      return Promise.reject('this payment gateway is paypal, not provide others');

    try {
      const bookingData = await Booking.findById(data.booking_id, {
        include: [{ relation: 'billingCountryIdFkeyrel' }, { relation: 'bookingUserIdFkeyrel' }],
      });

      if (!bookingData) return Promise.reject('Not found booking data');

      if (!bookingData.total || bookingData.total == 0) return Promise.reject('empty total price');

      if (process.env.NODE_ENV == 'production') {
        // do it if booking_status_id property is undefined and not zero
        if (
          typeof bookingData.booking_status_id === 'undefined' ||
          parseInt(bookingData.booking_status_id, 10) != 0
        ) {
          return Promise.reject(`booking status id is not 0 bid: ${data.booking_id}`);
        }
      }
      // for none decimal currency code country
      let tempTotal = bookingData.total;
      switch (bookingData.booking_currency_code) {
        case 'JPY':
        case 'TWD':
          tempTotal = parseFloat(bookingData.total);
          break;
        default:
          break;
      }

      const create_payment_json = {
        intent: 'authorize',
        payer: {
          payment_method: 'paypal',
        },
        redirect_urls: {
          return_url: `${configHost.api_url}/paypal_callback?success=true`,
          cancel_url: `${configHost.api_url}/paypal_callback?success=false`,
        },
        transactions: [
          {
            amount: {
              currency: bookingData.booking_currency_code,
              total: tempTotal,
            },
            description: 'This is the payment description.',
          },
        ],
      };

      return new Promise((resolve, reject) => {
        paypal.payment.create(create_payment_json, (err, replyFromPaypal) => {
          if (err) return reject(err);
          // push log
          pushLogData(
            `${configHost.api_url}/PaymentLogs/`,
            'PAYMENT_LOG',
            'CREATE',
            2,
            `bid: ${data.booking_id}`,
            replyFromPaypal,
            'PAYPAL',
            0,
          );

          const urlFromPaypal = replyFromPaypal.links.find(element => element.method == 'REDIRECT');
          const replyData = {
            id: replyFromPaypal.id,
            intent: replyFromPaypal.intent,
            state: replyFromPaypal.state,
            url: urlFromPaypal.href,
          };
          return resolve(replyData);
        });
      });
    } catch (err) {
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'CREATE',
        4,
        `pid: ${data.booking_id}`,
        err,
        'PAYPAL',
        500,
      );
      return Promise.reject(err);
    }
  };
  Paypal.executePayment = async (data, req, cb) => {
    const Booking = Paypal.app.models.Booking;
    const Payment = Paypal.app.models.Payments;
    if (!data.booking_id) return Promise.reject('No booking id data');
    if (!data.paymentID) return Promise.reject('No paymentID data');
    if (!data.payerID) return Promise.reject('No payerID data');

    try {
      const paymentDataFromPaypal = await new Promise((resolve, reject) => {
        paypal.payment.get(data.paymentID, (err, replyFromPaypal) => {
          if (err) {
            // push log
            pushLogData(
              `${configHost.api_url}/PaymentLogs/`,
              'PAYMENT_LOG',
              'EXECUTE',
              4,
              `pid: ${data.paymentID}`,
              err,
              'PAYPAL',
              500,
            );
            return reject(err);
          }
          return resolve(replyFromPaypal);
        });
      });

      const execute_payment_json = {
        payer_id: data.payerID,
      };

      const paymentExecuteState = await new Promise((resolve, reject) => {
        paypal.payment.execute(data.paymentID, execute_payment_json, (err, payment) => {
          if (err) {
            // push log
            pushLogData(
              `${configHost.api_url}/PaymentLogs/`,
              'PAYMENT_LOG',
              'EXECUTE',
              4,
              `pid: ${data.paymentID}`,
              err,
              'PAYPAL',
              500,
            );
            return reject(err);
          }
          return resolve(payment);
        });
      });
      if (paymentExecuteState.state != 'approved') {
        const responseNotApprove = {
          status: 500,
          success: false,
          message: 'payment not successful',
          origin: paymentExecuteState,
          post: data,
        };
        return responseNotApprove;
      }

      const finalGatewayResponseData = await Paypal.getCapturedPayment(
        paymentExecuteState.transactions[0].related_resources[0].authorization.id,
      );
      const paymentData = {
        payment_status_id: 1,
        payment_gateway_response: JSON.stringify(finalGatewayResponseData),
        external_transaction_id: data.paymentID,
        external_authorize_id:
          paymentExecuteState.transactions[0].related_resources[0].authorization.id,
        external_charge_id: '',
        external_refund_id: '',
        booking_id: data.booking_id,
        payment_method_id: 1,
        total: paymentExecuteState.transactions[0].related_resources[0].authorization.amount.total,
        currency:
          paymentExecuteState.transactions[0].related_resources[0].authorization.amount.currency,
        external_reference_id:
          paymentExecuteState.transactions[0].related_resources[0].authorization.id,
      };

      const paymentCreated = await Payment.create(paymentData);
      // push log
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'EXECUTE',
        2,
        `bid: ${data.booking_id}`,
        paymentCreated,
        'PAYPAL',
        0,
      );

      // make update data in booking
      const bookingData = await Booking.findById(data.booking_id);

      const finalResponseData = {
        status: 1000,
        previous: paymentDataFromPaypal.state,
        current: paymentExecuteState.state,
        book: bookingData,
        payment: paymentCreated,
        id: 'paypal',
      };
      if (paymentExecuteState.state == 'approved') finalResponseData.success = true;
      else finalResponseData.success = false;

      return Promise.resolve(finalResponseData);
    } catch (err) {
      // push log
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'EXECUTE',
        4,
        `pid: ${data.paymentID}`,
        err,
        'PAYPAL',
        500,
      );
      return Promise.reject(err);
    }
  };

  Paypal.approvePayment = async data => {
    const Payment = Paypal.app.models.Payments;

    if (!data.pid) return Promise.reject('No pid id data');
    if (!data.payment_id) return Promise.reject('No payment_id data');
    if (!data.auth) return Promise.reject('No auth data');
    if (!data.cur) return Promise.reject('No cur data');
    if (!data.price) return Promise.reject('No price data');

    const responseData = {};

    try {
      const authorizationDataFromPaypal = await new Promise((resolve, reject) => {
        paypal.authorization.get(data.auth, (err, replyFromPaypal) => {
          if (err) return reject(err);
          return resolve(replyFromPaypal);
        });
      });

      // for none decimal currency code country
      let tempPrice = data.price;
      switch (data.cur) {
        case 'JPY':
        case 'TWD':
          tempPrice = parseFloat(data.price);
          break;
        default:
          break;
      }

      const capture_details = {
        amount: {
          currency: data.cur,
          total: tempPrice,
        },
        is_final_capture: true,
      };

      const authorizationCaptureFromPaypal = await new Promise((resolve, reject) => {
        paypal.authorization.capture(data.auth, capture_details, (err, replyFromPaypal) => {
          if (err) return reject(err);
          return resolve(replyFromPaypal);
        });
      });

      // push log
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'SETTLE',
        2,
        `pid: ${data.payment_id}`,
        authorizationCaptureFromPaypal,
        'PAYPAL',
        0,
      );

      if (authorizationCaptureFromPaypal.httpStatusCode !== 201) {
        responseData.api = null;
        responseData.data = authorizationCaptureFromPaypal;
        responseData.status = 5000; // unsuccess payment status

        const payment = await Payment.findById(data.payment_id);
        if (payment) {
          payment.updateAttributes({ payment_status_id: 3 });
        }

        return Promise.resolve(responseData);
      }

      const payment = await Payment.findById(data.payment_id);
      if (payment) {
        const finalGatewayResponseData = await Paypal.getCapturedPayment(
          authorizationCaptureFromPaypal.id,
        );
        await payment.updateAttributes({
          payment_status_id: 2,
          payment_gateway_response: JSON.stringify(finalGatewayResponseData),
          external_charge_id: authorizationCaptureFromPaypal.id,
          total_charge: data.price,
          final_amount: finalGatewayResponseData.amount.total,
          external_reference_id: finalGatewayResponseData.id,
        });
      }

      const paymentData = await Payment.findById(data.payment_id);

      // const beforeApprovePayment = await Payment.findById(data.payment_id)

      // const paymentData = {
      //   payment_status_id: 2,
      //   payment_gateway_response: JSON.stringify(authorizationCaptureFromPaypal),
      //   external_transaction_id: beforeApprovePayment.external_transaction_id,
      //   external_authorize_id: beforeApprovePayment.external_authorize_id,
      //   external_charge_id: authorizationCaptureFromPaypal.id,
      //   external_refund_id: '',
      //   booking_id: beforeApprovePayment.booking_id,
      //   payment_method_id: 1,
      //   total: beforeApprovePayment.total,
      //   total_charge: data.price,
      //   currency: beforeApprovePayment.currency,
      // }
      //
      // const paymentCreated = await Payment.create(paymentData)
      // push log
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'EXECUTE',
        2,
        `bid: ${data.booking_id}`,
        paymentData,
        'PAYPAL',
        0,
      );

      // push log
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'SETTLE',
        2,
        `Status change 1->2 pid: ${data.payment_id}`,
        paymentData,
        'PAYPAL',
        0,
      );
      responseData.api = paymentData;
      responseData.data = authorizationCaptureFromPaypal;
      responseData.status = 1000; // success payment status

      return Promise.resolve(responseData);
    } catch (err) {
      // push log
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'SETTLE',
        4,
        `pid: ${data.payment_id}`,
        err,
        'PAYPAL',
        500,
      );
      responseData.status = 5000; // unsuccess payment status
      return Promise.resolve(responseData);
    }
  };

  Paypal.cancelPayment = async (data, req, cb) => {
    const Payment = Paypal.app.models.Payments;

    if (!data.pid) return Promise.reject('No pid id data');
    if (!data.payment_id) return Promise.reject('No payment_id data');
    if (!data.auth) return Promise.reject('No auth data');

    try {
      const authorizationVoidDataFromPaypal = await new Promise((resolve, reject) => {
        paypal.authorization.void(data.auth, (err, replyFromPaypal) => {
          if (err) return reject(err);
          return resolve(replyFromPaypal);
        });
      });

      // push log
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'CANCEL',
        2,
        `pid: ${data.payment_id}`,
        authorizationVoidDataFromPaypal,
        'PAYPAL',
        0,
      );

      const paymentData = await Payment.findById(data.payment_id, async (err, payment) => {
        if (payment) {
          const finalGatewayResponseData = await Paypal.getCapturedPayment(
            authorizationVoidDataFromPaypal.id,
          );
          payment.updateAttributes({
            payment_status_id: 5,
            payment_gateway_response: JSON.stringify(authorizationVoidDataFromPaypal),
          });
          return Promise.resolve(payment);
        }
        return Promise.reject(err);
      });

      // push log
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'CANCEL',
        2,
        `Status change 1->5 pid: ${data.payment_id}`,
        paymentData,
        'PAYPAL',
        0,
      );

      const responseData = {
        data: authorizationVoidDataFromPaypal,
        api: paymentData,
        status: 1000,
      };
      return Promise.resolve(responseData);
    } catch (err) {
      // push log
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'CANCEL',
        4,
        `pid: ${data.payment_id}`,
        err,
        'PAYPAL',
        500,
      );
      return Promise.reject(err);
    }
  };

  const refundPaymentPromise = (capture_id, refund_details) =>
    new Promise((resolve, reject) => {
      paypal.capture.refund(capture_id, refund_details, (err, replyFromPaypal) => {
        if (err) return reject(err);
        return resolve(replyFromPaypal);
      });
    });

  /**
   * Refund function - only calla from payment model for sure
   * @param {*} payment_id
   * @param {*} refund_amount
   * @param {*} currencyCode
   */
  Paypal.refund = async (payment, refund_amount, currencyCode) => {
    const responseData = {};
    try {
      // const payment = await Paypal.app.models.Payments.findById(payment_id)
      if (!payment) return Promise.reject(newLoopbackError(FORBIDDEN, 'PAYMENT_IS_NOT_FOUND'));
      const paypalId = payment.external_transaction_id;
      const captureId = (await Paypal.getPayment(paypalId)).transactions[0].related_resources
        .map(element => getSafe(() => element.capture.id))
        .filter(a => a != null)[0];
      if (['HUF', 'JPY', 'TWD'].includes(currencyCode)) refund_amount = Math.floor(refund_amount);
      const refundResponse = await refundPaymentPromise(captureId, {
        amount: { currency: currencyCode, total: refund_amount },
      });
      if (refundResponse.httpStatusCode !== 201) {
        responseData.api = null;
        responseData.data = refundResponse;
        responseData.status = 5000; // unsuccess payment status

        await Paypal.app.models.Payments.findById(payment.id, (err, payment_obj) => {
          if (payment_obj) {
            payment_obj.updateAttributes({ payment_status_id: 3 });
          }
        });

        return Promise.resolve(responseData);
      }

      const finalGatewayResponseData = await Paypal.getCapturedPayment(refundResponse.id);
      // create payment with status 4
      const paymentData = Paypal.app.models.Payments.create({
        payment_status_id: 4,
        payment_gateway_response: JSON.stringify(finalGatewayResponseData),
        external_transaction_id: payment.external_transaction_id,
        external_authorize_id: payment.external_authorize_id,
        external_charge_id: '',
        external_refund_id: refundResponse.id,
        booking_id: payment.booking_id,
        payment_method_id: parseInt(payment.payment_method_id, 10),
        total: 0,
        total_refund: refund_amount,
        currency: currencyCode,
        final_amount: finalGatewayResponseData.amount.total * -1,
        external_reference_id: refundResponse.id,
      });

      // push log
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_API',
        'CREATE REFUNDED',
        2,
        `bid: ${payment.booking_id}`,
        paymentData,
        'PAYPAL',
        0,
      );
      // response
      responseData.api = paymentData;
      responseData.data = refundResponse;
      responseData.status = 1000; // success payment status

      return Promise.resolve(responseData);
      // await payment.updateAttributes({ payment_status_id: 4, total_refund: refund_amount })
      // // pushLogData(`${configHost.api_url}/PaymentLogs/`, 'PAYMENT_API', 'REFUND', 2, `Status change 2->4 pid: ${payment.id}`, payment, 'PAYPAL', 0)
      // return Promise.resolve(refundResponse)
      // return Promise.reject(newLoopbackError(BAD_REQUEST, 'PAYMENT_IS_UNABLE_TO_CANCEL_RO_REFUND'))
    } catch (error) {
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'CREATE REFUND ERROR',
        4,
        `pid: ${payment.id}`,
        error,
        'PAYPAL',
        500,
      );
      // console.log('Error Paypal.refund', error)
      responseData.status = 5000;
      return Promise.reject(responseData);
    }
  };

  Paypal.getPayment = async capture_id => {
    try {
      const getDataFromPaypal = await new Promise((resolve, reject) => {
        paypal.payment.get(capture_id, (err, replyFromPaypal) => {
          if (err) return reject(err);
          return resolve(replyFromPaypal);
        });
      });
      return Promise.resolve(getDataFromPaypal);
    } catch (err) {
      // push log
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'GET',
        4,
        `pid: ${capture_id}`,
        err,
        'PAYPAL',
        500,
      );
      return Promise.reject(err);
    }
  };

  Paypal.getCapturedPayment = async capture_id => {
    try {
      const getCapturedDataFromPaypal = await new Promise((resolve, reject) => {
        paypal.capture.get(capture_id, (err, replyFromPaypal) => {
          if (err) return reject(err);
          return resolve(replyFromPaypal);
        });
      });
      return Promise.resolve(getCapturedDataFromPaypal);
    } catch (err) {
      // push log
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'GET',
        4,
        `pid: ${capture_id}`,
        err,
        'PAYPAL',
        500,
      );
      return Promise.reject(err);
    }
  };
  Paypal.remoteMethod('getCapturedPayment', {
    accepts: [{ arg: 'capture_id', type: 'string', description: 'capture_id', required: true }],
    returns: { arg: 'response', type: 'object', root: true },
  });

  Paypal.getRefundPayment = async refund_id => {
    try {
      const getRefundDataFromPaypal = await new Promise((resolve, reject) => {
        paypal.refund.get(refund_id, (err, replyFromPaypal) => {
          if (err) return reject(err);
          return resolve(replyFromPaypal);
        });
      });
      return Promise.resolve(getRefundDataFromPaypal);
    } catch (err) {
      // push log
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'GET',
        4,
        `pid: ${refund_id}`,
        err,
        'PAYPAL',
        500,
      );
      return Promise.reject(err);
    }
  };
  Paypal.remoteMethod('getRefundPayment', {
    accepts: [{ arg: 'refund_id', type: 'string', description: 'refund_id', required: true }],
    returns: { arg: 'response', type: 'object', root: true },
  });

  Paypal.remoteMethod('createPayment', {
    accepts: [
      {
        arg: 'data',
        type: 'object',
        http: { source: 'body' },
        required: true,
      },
      {
        arg: 'req',
        type: 'object',
        http: { source: 'req' },
      },
    ],
    returns: { arg: 'response', type: 'object', root: true },
  });
  Paypal.remoteMethod('executePayment', {
    accepts: [
      {
        arg: 'data',
        type: 'object',
        http: { source: 'body' },
        required: true,
      },
      {
        arg: 'req',
        type: 'object',
        http: { source: 'req' },
      },
    ],
    returns: { arg: 'response', type: 'object', root: true },
  });
  Paypal.remoteMethod('approvePayment', {
    accepts: [
      {
        arg: 'data',
        type: 'object',
        http: { source: 'body' },
        required: true,
      },
    ],
    returns: { arg: 'response', type: 'object', root: true },
  });
  Paypal.remoteMethod('cancelPayment', {
    accepts: [
      {
        arg: 'data',
        type: 'object',
        http: { source: 'body' },
        required: true,
      },
      {
        arg: 'req',
        type: 'object',
        http: { source: 'req' },
      },
    ],
    returns: { arg: 'response', type: 'object', root: true },
  });
  Paypal.remoteMethod('getPayment', {
    accepts: [
      {
        arg: 'payment_id',
        type: 'string',
        required: true,
      },
      {
        arg: 'req',
        type: 'object',
        http: { source: 'req' },
      },
    ],
    returns: { arg: 'response', type: 'object', root: true },
  });
};
