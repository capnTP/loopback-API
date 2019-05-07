const path = require('path');
const fs = require('fs');

const _ = require('lodash');
const moment = require('moment');
const request = require('request');
const ejs = require('ejs');
const { minify } = require('html-minifier');
const puppeteer = require('puppeteer');

const { REFUND_OPTION } = require('../../helpers/payment');
const hostConfig = require('../../../server/config/config.json');
const {
  getSafe,
  newLoopbackError,
  HTTPStatusCode: { UNAUTHORIZED, BAD_REQUEST, FORBIDDEN, SERVER_ERROR },
} = require('../../utility');
const {
  ingenicoPayload,
  paypalPayload,
  iamportPayload,
} = require('../../helpers/paymentGatewayPayloadFactory');
const BookingHelper = require('../../helpers/booking');
const EmailHelper = require('../../helpers/email');

const BASE_URL =
  process.env.NODE_ENV == 'production' ? hostConfig.production : hostConfig.development;

let SLACK_URL =
  process.env.NODE_ENV == 'production'
    ? 'https://hooks.slack.com/services/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'
    : 'https://hooks.slack.com/services/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';
// override with env's url
SLACK_URL = process.env.SLACK_URL || SLACK_URL;

module.exports = function(Payments) {
  Payments.beforeRemote('find', (ctx, status, next) => {
    if (ctx.args.filter) {
      ctx.args.filter.include = [
        {
          relation: 'paymentsPaymentMethodIdFkeyrel',
        },
        {
          relation: 'paymentsBookingIdFkeyrel',
        },
        {
          relation: 'paymentsPaymentStatusIdFkeyrel',
        },
      ];
    } else {
      ctx.args.filter = {
        include: [
          {
            relation: 'paymentsPaymentMethodIdFkeyrel',
          },
          {
            relation: 'paymentsBookingIdFkeyrel',
          },
          {
            relation: 'paymentsPaymentStatusIdFkeyrel',
          },
        ],
      };
    }
    next();
  });
  Payments.beforeRemote('findById', (ctx, status, next) => {
    if (ctx.args.filter) {
      ctx.args.filter.include = [
        {
          relation: 'paymentsPaymentMethodIdFkeyrel',
        },
        {
          relation: 'paymentsBookingIdFkeyrel',
        },
        {
          relation: 'paymentsPaymentStatusIdFkeyrel',
        },
      ];
    } else {
      ctx.args.filter = {
        include: [
          {
            relation: 'paymentsPaymentMethodIdFkeyrel',
          },
          {
            relation: 'paymentsBookingIdFkeyrel',
          },
          {
            relation: 'paymentsPaymentStatusIdFkeyrel',
          },
        ],
      };
    }
    next();
  });

  Payments.isAbleCreate = async booking_id => {
    try {
      const [booking, ingenicoTotal, paypalTotal] = await Promise.all([
        Payments.app.models.Booking.findById(booking_id),
        Payments.app.models.Ingenico.getTotalPay(booking_id),
        Payments.app.models.Paypal.getTotalPay(booking_id),
      ]);
      const sumTotal = ingenicoTotal + paypalTotal;
      if (sumTotal >= booking.total) {
        return Promise.resolve(false);
      }
      return Promise.resolve(true);
    } catch (error) {
      console.log(error);
      return Promise.reject(error);
    }
  };
  Payments.remoteMethod('isAbleCreate', {
    accepts: [{ arg: 'booking_id', type: 'string' }],
    returns: { arg: 'isAbleCreate', type: 'boolean', root: false },
    http: { path: '/isAbleCreate', verb: 'get' },
  });

  Payments.observe('before save', async ctx => {
    const { Currencies } = Payments.app.models;

    if (ctx.currentInstance && ctx.data && ctx.data.payment_status_id) {
      if (ctx.currentInstance.payment_status_id == 0 && ctx.data.payment_status_id > 0) {
        return Promise.resolve();
      }
      if (ctx.currentInstance.payment_status_id == 1 && ctx.data.payment_status_id > 1) {
        return Promise.resolve();
      }
      if (ctx.currentInstance.payment_status_id == 2 && ctx.data.payment_status_id == 1) {
        return Promise.resolve();
      }
      if (ctx.currentInstance.payment_status_id == 2 && ctx.data.payment_status_id == 3) {
        return Promise.resolve();
      }
      if (ctx.currentInstance.payment_status_id == 2 && ctx.data.payment_status_id == 4) {
        return Promise.resolve();
      }
      if (ctx.currentInstance.payment_status_id == 2 && ctx.data.payment_status_id == 5) {
        return Promise.resolve();
      }
      const message = `Invalid data : Payment Status is ${
        ctx.currentInstance.payment_status_id
      } It cannot updated to ${ctx.data.payment_status_id}`;
      return Promise.resolve(new Error(message));
    }
    if (ctx.currentInstance && ctx.data && ctx.data.payment_status_id == 0) {
      const message = "Invalid data : Payment status can't be reset to 0 in any case";
      return Promise.resolve(new Error(message));
    }
    if (ctx.isNewInstance && ctx.instance && ctx.instance.currency) {
      const currency = await Currencies.findOne({
        where: { currency_code: ctx.instance.currency },
      });
      if (currency && currency.exchange_rate) {
        await ctx.instance.setAttribute('exchange_rate', currency.exchange_rate);
      }
      await ctx.instance.setAttribute(
        'payment_type',
        getSafe(() => ctx.instance.payment_type) || 'normal',
      );
      const booking = await Payments.app.models.Booking.findById(ctx.instance.booking_id);
      if (booking && booking.user_id) {
        const payer_id = booking.user_id;
        await ctx.instance.setAttribute('payer_id', getSafe(() => payer_id));
      }
      return Promise.resolve();
    }
    console.log('other cases', ctx.currentInstance.id);
    return Promise.resolve();
  });

  Payments.observe('after save', (ctx, next) => {
    const { Booking } = Payments.app.models;
    if (
      ctx.instance &&
      ctx.instance.booking_id &&
      ctx.instance.payment_status_id &&
      ctx.instance.payment_status_id == 1 &&
      !ctx.instance.flag_update_state
    ) {
      Booking.findById(ctx.instance.booking_id, (err, booking) => {
        if (err) {
          console.log('err after payment save booking find', err);
        }
        if (booking && booking.booking_status_id != 1) {
          booking.updateAttribute('booking_status_id', 1);
          console.log('updated booking status 1');
        } else if (!booking) {
          console.log('Booking Not Found', err);
        }
        next();
      });
    } else if (
      ctx.instance &&
      ctx.instance.booking_id &&
      ctx.instance.payment_status_id &&
      ctx.instance.payment_status_id == 5 &&
      !ctx.instance.flag_update_state
    ) {
      Booking.findById(ctx.instance.booking_id, async (err, booking) => {
        if (err) {
          console.log('err after payment save booking find', err);
        }
        if (booking && booking.booking_status_id != 7) {
          booking.updateAttribute('booking_status_id', 7);
          console.log('updated booking status 7');
        } else if (!booking) {
          console.log('Booking Not Found', err);
        }
        next();
      });
    } else {
      next();
    }
  });

  const sendSlackHook = (isSuccess, attachmentsData) => {
    const payload = {
      text: `Payments response update is failed!!`,
      username: 'TheAsia.com | Payment Bot',
      icon_emoji: ':heavy_dollar_sign:',
      attachments: attachmentsData,
    };
    if (isSuccess) {
      payload.text = 'Payments response were updated';
    }
    const options = {
      url: SLACK_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    };

    request.post(options, (err, response) => {
      if (err) {
        console.log(err);
      }
      console.log('Payments Response Updated');
    });
  };

  const getPaymentGateWayAndPayloadFactory = payment_method_id => {
    if (payment_method_id == 1) {
      return { payloadFactory: paypalPayload, paymentGateWay: Payments.app.models.Paypal };
    }
    if (payment_method_id == 2 || payment_method_id == 3 || payment_method_id == 4) {
      return { payloadFactory: ingenicoPayload, paymentGateWay: Payments.app.models.Ingenico };
    }
    if (payment_method_id == 5) {
      return { payloadFactory: iamportPayload, paymentGateWay: Payments.app.models.Iamport };
    }
    return {};
  };

  const getPaymenAndBookingObject = async (booking_id, payment_status_id) => {
    const filter = Payments.app.models.Booking.defaultFilter;
    try {
      const booking = await Payments.app.models.Booking.findById(booking_id, filter);
      // Condition check if the booking is aab(offline) method then get payment status 6 to continue approve
      if (
        (booking.booking_method_id == 4 || booking.booking_method_id == 6) &&
        payment_status_id == 1
      )
        payment_status_id = 6;
      // Notes ** for aab online method booking and payment status will come to the same stage like normal booking
      const payment = await Payments.find({ where: { booking_id, payment_status_id } });
      return { payment, booking };
    } catch (error) {
      // error catch
    }
    return { payment: undefined, booking: undefined };
  };

  const createBookingActivity = (status, user_id, bookingId) =>
    Payments.app.models.Activity.create({
      model_name: 'Booking',
      action_taken: `Update {${status}}`,
      action_result: 'Success',
      user_id,
      model_id: bookingId,
    });

  const updateResponseService = async () => {
    const paymentFinalState = [
      {
        status_id: '1',
        ingenico_final_status: '800',
        paypal_final_status: 'approved',
        inicis_final_status: 'paid',
      },
      {
        status_id: '2',
        ingenico_final_status: '1050',
        paypal_final_status: 'completed',
        inicis_final_status: 'paid',
      },
      {
        status_id: '4',
        ingenico_final_status: '1800',
        paypal_final_status: 'partially_refunded',
        inicis_final_status: 'cancelled',
      },
      {
        status_id: '5',
        ingenico_final_status: '99999',
        paypal_final_status: 'voided',
        inicis_final_status: 'cancelled',
      },
    ];
    try {
      const paymentList = await Payments.find({
        where: {
          payment_status_id: { inq: ['1', '2', '4', '5'] },
          payment_method_id: { between: [1, 6] },
        },
        order: 'id ASC',
      });
      const promiseToDo = [];
      let countAffected = 0;
      for (let i = 0; i < paymentList.length; i++) {
        const tempRes = JSON.parse(paymentList[i].payment_gateway_response);
        let merchantId = 1769;
        let externalAuthorizeId = paymentList[i].external_authorize_id;
        let isNotUpdate = false;

        if (
          parseInt(paymentList[i].payment_method_id, 10) > 1 &&
          parseInt(paymentList[i].payment_method_id, 10) < 5
        ) {
          externalAuthorizeId =
            parseInt(paymentList[i].payment_status_id, 10) !== 4
              ? paymentList[i].external_authorize_id
              : paymentList[i].external_refund_id;
          if (!externalAuthorizeId) {
            await paymentList[i].updateAttributes({
              external_refund_id: `${paymentList[i].external_authorize_id.substring(
                0,
                23,
              )}-${paymentList[i].external_authorize_id.substring(24, 30)}`,
            });
            externalAuthorizeId = `${paymentList[i].external_authorize_id.substring(
              0,
              23,
            )}-${paymentList[i].external_authorize_id.substring(24, 30)}`;
          }
        } else if (parseInt(paymentList[i].payment_method_id, 10) === 1) {
          if (
            parseInt(paymentList[i].payment_status_id, 10) === 1 ||
            parseInt(paymentList[i].payment_status_id, 10) === 5
          ) {
            externalAuthorizeId = paymentList[i].external_authorize_id;
          } else if (parseInt(paymentList[i].payment_status_id, 10) === 2) {
            externalAuthorizeId = paymentList[i].external_charge_id;
          } else if (parseInt(paymentList[i].payment_status_id, 10) === 4) {
            externalAuthorizeId = paymentList[i].external_refund_id;
          }
        }

        const paymentStatus = paymentList[i].payment_status_id;
        let external_transaction_id = paymentList[i].external_transaction_id;
        const finalState = await paymentFinalState.find(
          payment => payment.status_id === paymentList[i].payment_status_id,
        );
        if (parseInt(paymentList[i].payment_method_id, 10) === 1) {
          isNotUpdate = finalState.paypal_final_status === paymentList[i].flag_update_state;
          external_transaction_id = paymentList[i].external_transaction_id;
        } else if (parseInt(paymentList[i].payment_method_id, 10) === 2) {
          // credit card
          isNotUpdate = finalState.ingenico_final_status === paymentList[i].flag_update_state;
          external_transaction_id = paymentList[i].external_transaction_id;
          merchantId = 1769;
        } else if (parseInt(paymentList[i].payment_method_id, 10) === 3) {
          // alipay
          if (
            paymentList[i].payment_status_id === '5' &&
            paymentList[i].flag_update_state === '1050'
          ) {
            isNotUpdate = true;
          } else {
            isNotUpdate = finalState.ingenico_final_status === paymentList[i].flag_update_state;
          }
          external_transaction_id = 'ALIPAY';
          merchantId = 1769;
        } else if (parseInt(paymentList[i].payment_method_id, 10) === 4) {
          // union pay
          isNotUpdate = finalState.ingenico_final_status === paymentList[i].flag_update_state;
          external_transaction_id = 'UnionPay';
          merchantId = 1774;
        } else if (parseInt(paymentList[i].payment_method_id, 10) === 5) {
          // inicis not complete
          if (
            paymentList[i].payment_status_id === '2' &&
            paymentList[i].flag_update_state === 'cancelled'
          ) {
            isNotUpdate = true;
          } else {
            isNotUpdate = finalState.inicis_final_status === paymentList[i].flag_update_state;
          }
          external_transaction_id = paymentList[i].external_transaction_id;
        }

        // special case for payment id 22-26 and other case like this
        if (paymentList[i].flag_update_state === '160' && tempRes.statusOutput.statusCode == 160) {
          isNotUpdate = true;
        }

        if (!isNotUpdate) {
          console.log('Processing payment id ::: ', paymentList[i].id);
          let gatewayResponse;
          if (parseInt(paymentList[i].payment_method_id, 10) === 5) {
            // call to inicis
            gatewayResponse = await Payments.app.models.Iamport.getPaymentData(externalAuthorizeId);
            if (gatewayResponse.code == 0) {
              const updatedPayment = await paymentList[i].updateAttributes({
                external_transaction_id,
                payment_gateway_response: JSON.stringify(gatewayResponse.response),
                flag_update_state: gatewayResponse.response.status,
                external_reference_id: externalAuthorizeId,
              });
              countAffected++;
            }
          } else if (parseInt(paymentList[i].payment_method_id, 10) === 1) {
            gatewayResponse = await Payments.app.models.Paypal.getCapturedPayment(
              externalAuthorizeId,
            );
            if (gatewayResponse.httpStatusCode == 200) {
              const updatedPayment = await paymentList[i].updateAttributes({
                external_transaction_id,
                payment_gateway_response: JSON.stringify(gatewayResponse),
                flag_update_state: gatewayResponse.state,
                external_reference_id: externalAuthorizeId,
              });
              countAffected++;
            }
          } else {
            // call to ingenico
            gatewayResponse = await Payments.app.models.Ingenico.getPaymentData(
              externalAuthorizeId,
              merchantId,
              paymentStatus,
            );
            if (gatewayResponse.status == 200) {
              const updatedPayment = await paymentList[i].updateAttributes({
                external_transaction_id,
                payment_gateway_response: JSON.stringify(gatewayResponse.body),
                flag_update_state: gatewayResponse.body.statusOutput.statusCode,
                external_reference_id: `${externalAuthorizeId.substring(10, 20)}`,
              });
              countAffected++;
            }
          }
        }
      }
      const finalAmountRes = await Payments.migrateFinalAmount();

      sendSlackHook(true, [
        {
          title: `Details (${process.env.NODE_ENV == 'production' ? 'production' : 'development'})`,
          fields: [{ title: 'Affected rows', value: countAffected }],
        },
      ]);
      // send complete message to slack
    } catch (err) {
      sendSlackHook(false, [
        {
          title: `With errors (${
            process.env.NODE_ENV == 'production' ? 'production' : 'development'
          })`,
          text: JSON.stringify(err),
        },
      ]);
      // send error message to slack
    }
  };

  // this migrate function use for update response from payment gateway
  Payments.updateResponseDataCRON = () => {
    // process will running in background and the success of fail message will send to slack
    updateResponseService();
    return Promise.resolve({
      message: 'Update response called. Final status will send back to slack channel',
    });
  };
  Payments.remoteMethod('updateResponseDataCRON', {
    returns: { type: 'object', root: true },
    http: { path: '/updateResponseDataCRON', verb: 'post' },
  });

  // we will remove this method after payment tabel and code is stable
  // this migration function is use for migrate final amount field
  // this method will called after updated response field
  Payments.migrateFinalAmount = async () => {
    let row_affected = 0;
    try {
      // only for ingenico now
      const paymentList = await Payments.find({
        where: { payment_method_id: { inq: ['1', '2', '3', '4', '5'] } },
      });
      paymentList.map(async payment => {
        const objToUpdate = {};
        const tempJson = JSON.parse(payment.payment_gateway_response);
        let amountToUpdate = 0;
        let refundAmountToUpdate = 0;
        let chargeAmountToUpdate = 0;
        if (payment.payment_method_id === '1') {
          if (payment.payment_status_id === '4') {
            refundAmountToUpdate = Number(tempJson.amount.total) * -1;
            amountToUpdate = Number(tempJson.amount.total) * -1;
          } else if (payment.payment_status_id === '2') {
            chargeAmountToUpdate = Number(tempJson.amount.total);
            amountToUpdate = Number(tempJson.amount.total);
          }
        } else if (payment.payment_method_id === '5') {
          if (payment.payment_status_id === '4') {
            refundAmountToUpdate = Number(tempJson.cancel_amount);
            amountToUpdate = Number(tempJson.cancel_amount);
          } else if (payment.payment_status_id === '2') {
            chargeAmountToUpdate = Number(tempJson.amount);
            amountToUpdate = Number(tempJson.amount);
          }
        } else if (payment.payment_status_id === '4') {
          refundAmountToUpdate = Number(tempJson.refundOutput.amountOfMoney.amount) / 100;
          amountToUpdate = Number(tempJson.refundOutput.amountOfMoney.amount) / 100;
        } else if (payment.payment_status_id === '2') {
          chargeAmountToUpdate = Number(tempJson.paymentOutput.amountOfMoney.amount) / 100;
          amountToUpdate = Number(tempJson.paymentOutput.amountOfMoney.amount) / 100;
        }
        objToUpdate.final_amount = amountToUpdate;
        objToUpdate.total_charge = chargeAmountToUpdate;
        objToUpdate.total_refund = refundAmountToUpdate;
        row_affected++;
        // await payment.updateAttributes({ final_amount: amountToUpdate })
        await payment.updateAttributes(objToUpdate);
      });
      return Promise.resolve({ status: 'complete', row_affected });
    } catch (err) {
      return Promise.resolve({ status: 'with error', row_affected, error: err });
    }
  };
  // Payments.remoteMethod('migrateFinalAmount', {
  //   returns: { type: 'object', root: true },
  //   http: { path: '/migrateFinalAmount', verb: 'post' },
  // })

  // we will remove this method after payment tabel and code is stable
  // use this method for migrate external transaction id for inicis only
  Payments.migrateExternalTransactionId = async () => {
    const paymentList = await Payments.find({ where: { payment_method_id: { inq: ['5'] } } });
    paymentList.map(async payment => {
      await payment.updateAttributes({ external_transaction_id: payment.external_authorize_id });
    });
  };
  Payments.remoteMethod('migrateExternalTransactionId', {
    returns: { type: 'object', root: true },
    http: { path: '/migrateExternalTransactionId', verb: 'post' },
  });
  // we will remove this method after payment tabel and code is stable
  // this migration function use for missing 2 record of payment that have refunded
  Payments.migrateRefundedBooking = async () => {
    try {
      const refundedBooking = await Payments.app.models.Booking.find({
        where: { booking_status_id: 6 },
      });
      const bookingIdList = refundedBooking.map(booking => booking.id);
      const paymentList = await Payments.find({ where: { booking_id: { inq: bookingIdList } } });
      let countAffected = 0;
      bookingIdList.map(async bookingId => {
        const paymentList = await Payments.find({ where: { booking_id: bookingId } });
        // find response should have status 2 or 4 in case refund
        let paymentInsertData;

        if (!_.find(paymentList, { payment_status_id: '2' })) {
          paymentInsertData = {
            payment_status_id: 2,
            payment_gateway_response: paymentList[0].payment_gateway_response,
            external_transaction_id: paymentList[0].external_transaction_id,
            external_authorize_id: paymentList[0].external_authorize_id,
            external_charge_id: paymentList[0].external_charge_id,
            external_refund_id: '',
            booking_id: paymentList[0].booking_id,
            payment_method_id: paymentList[0].payment_method_id,
            total: paymentList[0].total,
            currency: paymentList[0].currency,
            exchange_rate: paymentList[0].exchange_rate,
            total_charge: paymentList[0].total,
          };
          await Payments.create(paymentInsertData);
          countAffected++;
        } else if (!_.find(paymentList, { payment_status_id: '4' })) {
          paymentInsertData = {
            payment_status_id: 4,
            payment_gateway_response: paymentList[0].payment_gateway_response,
            external_transaction_id: paymentList[0].external_transaction_id,
            external_authorize_id: paymentList[0].external_authorize_id,
            external_charge_id: paymentList[0].external_charge_id,
            external_refund_id: '',
            booking_id: paymentList[0].booking_id,
            payment_method_id: paymentList[0].payment_method_id,
            total: paymentList[0].total,
            currency: paymentList[0].currency,
            exchange_rate: paymentList[0].exchange_rate,
            total_charge: paymentList[0].total,
          };
          await Payments.create(paymentInsertData);
          countAffected++;
        }
      });
      return Promise.resolve({
        row_affected: countAffected,
        booking_count: bookingIdList.length,
        payment_count: paymentList.length,
      });
    } catch (err) {
      return Promise.reject(err);
    }
  };
  Payments.remoteMethod('migrateRefundedBooking', {
    returns: { type: 'object', root: true },
    http: { path: '/migrateRefundedBooking', verb: 'post' },
  });

  Payments.getAvailablePaymentOptions = async () => {
    try {
      const globalConfigData = await Payments.app.models.GlobalConfig.find({
        where: { enable: true },
      });
      const availablePayments = [];
      const enabledConfigList = globalConfigData.map(item => item.key);

      // NOTE FOR ICON PATH IS THE RELATIVE PATH IN WEBSITE START FROM theasia/src/components/Forms/PaymentList/index.jsx
      // condition for cradit card mainly ingenico
      if (enabledConfigList.indexOf('CREDITCARD') !== -1) {
        availablePayments.push({
          id: 1,
          name: 'Credit/Debit Card',
          icon: 'newpayment/creditcard.png',
          type: 2,
          currencies: [
            'AUD',
            'CAD',
            'CNY',
            'EUR',
            'GBP',
            'HKD',
            'IDR',
            'INR',
            'JPY',
            'MYR',
            'PHP',
            'RUB',
            'SGD',
            'THB',
            'TWD',
            'USD',
            'VND',
          ],
        });
      }
      // condition for paypal
      if (enabledConfigList.indexOf('PAYPAL') !== -1) {
        availablePayments.push({
          id: 2,
          name: 'Paypal',
          icon: 'newpayment/paypal.png',
          type: 1,
          currencies: ['AUD', 'EUR', 'HKD', 'PHP', 'MYR', 'GBP', 'SGD', 'THB', 'USD'],
        });
      }
      // condition for alipay
      if (enabledConfigList.indexOf('ALIPAY') !== -1) {
        availablePayments.push({
          id: 3,
          name: 'Alipay',
          icon: 'newpayment/alipay.png',
          type: 3,
          currencies: ['CNY'],
        });
      }
      // condition for Unionpay
      if (enabledConfigList.indexOf('UNIONPAY') !== -1) {
        availablePayments.push({
          id: 4,
          name: 'Union Pay',
          icon: 'newpayment/unionpay.png',
          type: 4,
          currencies: [
            'AUD',
            'CAD',
            'CNY',
            'EUR',
            'GBP',
            'HKD',
            'IDR',
            'INR',
            'JPY',
            'MYR',
            'PHP',
            'RUB',
            'SGD',
            'THB',
            'TWD',
            'USD',
            'VND',
          ],
        });
      }
      // condition for Inicis
      if (enabledConfigList.indexOf('INICIS') !== -1) {
        availablePayments.push({
          id: 5,
          name: 'Credit Debit Card (Korea Domestic)',
          icon: 'newpayment/creditcard.png',
          type: 5,
          currencies: ['KRW'],
        });
      }
      if (enabledConfigList.indexOf('INTERCREDITCARD') !== -1) {
        availablePayments.push({
          id: 6,
          name: 'Credit/Debit Card (International)',
          icon: 'newpayment/creditcard.png',
          type: 2,
          currencies: ['KRW'],
        });
      }
      return Promise.resolve(availablePayments);
    } catch (error) {
      console.log('getAvailablePaymentOptions Error', error);
      return Promise.reject(error);
    }
  };

  Payments.remoteMethod('getAvailablePaymentOptions', {
    returns: { type: 'object', root: true },
    http: { path: '/getAvailablePaymentOptions', verb: 'get' },
  });

  Payments.getOnlinePaymentData = async data => {
    const uuid = data.uuid;
    const return_base_url = data.return_base_url;
    try {
      const paymentData = await Payments.findOne({ where: { uuid } });
      let bookingData = null;
      if (parseInt(paymentData.payment_status_id, 10) > 0) {
        return Promise.resolve({
          status: 1001,
          message: 'Payment was completed',
          payment: paymentData,
          booking: bookingData,
          uuid,
          return_base_url,
        });
      }
      if (paymentData.booking_id) {
        const Booking = Payments.app.models.Booking;
        // const bookingFilter = { include: [{ relation: 'billingCountryIdFkeyrel' }, { relation: 'bookingUserIdFkeyrel' }] }
        bookingData = await Booking.findById(paymentData.booking_id, Booking.defaultFilter);
      }
      if (!paymentData) return Promise.resolve({ status: 5000, message: 'payment not found' });

      const availablePayments = await Payments.getAvailablePaymentOptions();
      const transactionCurrency = paymentData.currency;
      const gatewayList = availablePayments.filter(option => {
        if (option.currencies.indexOf(transactionCurrency) !== -1 && option.id !== 5) {
          return option;
        }
      });

      // const { payloadFactory, paymentGateWay } = getPaymentGateWayAndPayloadFactory(paymentData[0].payment_method_id)

      // const gateRes = await paymentGateWay.createOnlinePayment(paymentData[0], bookingData, return_base_url)
      return Promise.resolve({
        status: 1000,
        message: 'Created payment',
        booking: bookingData,
        payment: paymentData,
        paymentOptions: gatewayList,
        uuid,
        return_base_url,
        // gateway: gateRes.gateway,
        // url: gateRes.url,
      });
    } catch (err) {
      console.log(err);
      return Promise.resolve({ status: 5000, message: 'payment error', error: err });
    }
  };
  Payments.remoteMethod('getOnlinePaymentData', {
    accepts: [
      {
        arg: 'data',
        type: 'object',
        http: {
          source: 'body',
        },
        required: true,
      },
    ],
    returns: { type: 'object', root: true },
    http: { path: '/getOnlinePaymentData', verb: 'post' },
  });

  Payments.createOnlinePayment = async (uuid, return_base_url, payment_method_id) => {
    try {
      const paymentData = await Payments.findOne({ where: { uuid } });
      let bookingData = null;
      if (paymentData.booking_id) {
        const Booking = Payments.app.models.Booking;
        const bookingFilter = {
          include: [{ relation: 'billingCountryIdFkeyrel' }, { relation: 'bookingUserIdFkeyrel' }],
        };
        bookingData = await Booking.findById(paymentData.booking_id, bookingFilter);
      }
      if (!paymentData) return Promise.resolve({ status: 5000, message: 'payment not found' });

      const { paymentGateWay } = getPaymentGateWayAndPayloadFactory(payment_method_id);

      const gateRes = await paymentGateWay.createOnlinePayment(
        paymentData,
        bookingData,
        return_base_url,
        payment_method_id,
      );

      await Payments.app.models.PaymentNotComplete.create({
        booking_id: paymentData.booking_id,
        payment_id: paymentData.id,
        payment_method_id,
        external_reference_id: gateRes.gateway.hostedCheckoutId,
      });

      return Promise.resolve({
        status: 1000,
        message: 'Created payment',
        // booking: bookingData,
        payment: paymentData,
        gateway: gateRes.gateway,
        url: gateRes.url,
      });
    } catch (err) {
      console.log(err);
      return Promise.resolve({ status: 5000, message: 'payment error', error: err });
    }
  };

  Payments.remoteMethod('createOnlinePayment', {
    accepts: [
      { arg: 'uuid', type: 'string', description: 'uuid', required: true },
      { arg: 'return_base_url', type: 'string', description: 'return_base_url', required: true },
      {
        arg: 'payment_method_id',
        type: 'string',
        description: 'payment_method_id',
        required: true,
      },
    ],
    returns: { type: 'object', root: true },
    http: { path: '/createOnlinePayment', verb: 'post' },
  });

  Payments.paymentIsCompleted = async (gatewayResponse, uuid, paymentMethodId) => {
    const paymentData = await Payments.findOne({ where: { uuid } });
    if (parseInt(paymentData.payment_status_id, 10) > 0) return;
    if (parseInt(paymentMethodId, 10) === 1) {
      await paymentData.updateAttributes({
        payment_status_id: 1,
        payment_gateway_response: JSON.stringify(gatewayResponse),
        external_transaction_id: gatewayResponse.id,
        external_authorize_id: gatewayResponse.transactions[0].related_resources[0].sale.id,
        external_charge_id: '',
        external_refund_id: '',
        payment_method_id: parseInt(paymentMethodId, 10),
        uuid,
        payment_type: 'AAB Payment',
        transaction_type: paymentData.transaction_type,
      });
    } else {
      const paymentObjRef = Payments.app.models.Ingenico.getCardPaymentData(
        gatewayResponse.body.createdPaymentOutput.payment.paymentOutput,
      );
      await paymentData.updateAttributes({
        payment_status_id: 1,
        payment_gateway_response: JSON.stringify(gatewayResponse.body),
        external_transaction_id: paymentObjRef.payment,
        external_authorize_id: gatewayResponse.body.createdPaymentOutput.payment.id,
        external_charge_id: '',
        external_refund_id: '',
        payment_method_id: parseInt(paymentMethodId, 10),
        uuid,
        payment_type: 'AAB Payment',
        transaction_type: paymentData.transaction_type,
      });
    }
    const bookingData = await Payments.app.models.Booking.findById(paymentData.booking_id);
    await bookingData.updateAttribute('booking_status_id', 1);
    await Payments.app.models.Charge.createChargeFromBooking(paymentData.booking_id);
  };

  Payments.hostedCheckoutStatus = async (
    paymentID,
    payerID,
    hostedCheckedoutId,
    paymentMethodId,
    uuid,
  ) => {
    try {
      if (parseInt(paymentMethodId, 10) === 1) {
        const gatewayRes = await Payments.app.models.Paypal.getPayment(paymentID);
        await Payments.paymentIsCompleted(gatewayRes, uuid, paymentMethodId);
        // const gatewayRes = await Payments.app.models.Paypal.executeAABPayment(paymentID, payerID)
        // if (gatewayRes.status === 1000) {
        //   // await Payments.paymentIsCompleted(gatewayRes, uuid, paymentMethodId)
        // }
        return Promise.resolve({
          status: 1000,
          gateway: gatewayRes.gateway,
        });
      }
      const gatewayRes = await Payments.app.models.Ingenico.getHostedCheckouts(
        hostedCheckedoutId,
        paymentMethodId,
      );
      if (
        gatewayRes.status === 200 &&
        gatewayRes.body.status === 'PAYMENT_CREATED' &&
        gatewayRes.body.createdPaymentOutput.paymentStatusCategory === 'SUCCESSFUL'
      ) {
        await Payments.paymentIsCompleted(gatewayRes, uuid, paymentMethodId);
      } else if (
        gatewayRes.status !== 200 ||
        (gatewayRes.body.status === 'PAYMENT_CREATED' &&
          gatewayRes.body.createdPaymentOutput.paymentStatusCategory === 'REJECTED')
      ) {
        return Promise.resolve({ status: 5000, message: 'Payment failed', error: gatewayRes });
      }
      return Promise.resolve({
        status: 1000,
        gateway: gatewayRes,
      });
    } catch (err) {
      console.log(err);
      return Promise.resolve({ status: 5000, message: 'Payment error', error: err });
    }
  };

  Payments.remoteMethod('hostedCheckoutStatus', {
    accepts: [
      {
        arg: 'paymentID',
        type: 'string',
        description: 'paymentID',
      },
      {
        arg: 'payerID',
        type: 'string',
        description: 'payerID',
      },
      {
        arg: 'hostedCheckedoutId',
        type: 'string',
        description: 'hostedCheckedoutId',
      },
      {
        arg: 'paymentMethodId',
        type: 'string',
        description: 'paymentMethodId',
      },
      {
        arg: 'uuid',
        type: 'string',
        description: 'uuid',
      },
    ],
    returns: { type: 'object', root: true },
    http: { path: '/hostedCheckoutStatus', verb: 'post' },
  });

  Payments.getUrlForIncompletePayment = async bookingId => {
    const Ingenico = Payments.app.models.Ingenico;
    const Iamport = Payments.app.models.Iamport;
    const bookingData = await Payments.app.models.Booking.findOne({ where: { id: bookingId } });
    const replyData = [];

    if (process.env.NODE_ENV !== 'production') {
      bookingId = moment(bookingData.created_at).unix();
    }
    // Iamport side
    const resFindPayment = await Iamport.findPayment(bookingData.ref_id, 'paid');
    if (resFindPayment.statusCode === 0) {
      replyData.push({
        gatewayPaymentId: resFindPayment.response.imp_uid,
        merchantId: 'Iamport',
        refId: resFindPayment.response.merchant_uid,
        cardType: 'Inicis',
        amount: resFindPayment.response.amount,
        currency: resFindPayment.response.currency,
        paymentStatus: resFindPayment.response.status,
        urlForCompleteCheckout: `${BASE_URL.api_url}/iamport_callback?gatewayPaymentId=${
          resFindPayment.response.imp_uid
        }`,
      });
    }

    // Ingenico side
    // const [resAwait1769, resAwait1771, resAwait1774] = await Promise.all([
    const [resAwait1769, resAwait1774] = await Promise.all([
      Ingenico.findPayment(bookingId, '1769'),
      // Ingenico.findPayment(bookingId, '1771'),
      Ingenico.findPayment(bookingId, '1774'),
    ]);
    let merchantId = 1769;
    const arrayOfPayment = resAwait1769.body.payments.concat(resAwait1774.body.payments);
    // let arrayOfPayment = resAwait1769.body.payments || []
    if (arrayOfPayment.length !== 0) {
      _.each(arrayOfPayment, element => {
        let cardType;
        switch (
          parseInt(element.paymentOutput.redirectPaymentMethodSpecificOutput.paymentProductId, 10)
        ) {
          case 1:
            merchantId = '1769';
            cardType = 'Credit Card';
            break;
          case 861:
            merchantId = '1769';
            cardType = 'Alipay';
            break;
          case 430:
            merchantId = '1774';
            cardType = 'UnionPay';
            break;
          // case 128:
          //   merchantId = '1771';
          //   cardType = 'AlDiscoveripay';
          //   break;
          // case 132:
          //   merchantId = '1771';
          //   cardType = 'Diners Club';
          //   break;
          default:
            break;
        }
        const hostedCheckedoutDataId = element.hostedCheckoutSpecificOutput.hostedCheckoutId;
        replyData.push({
          gatewayPaymentId: element.id,
          merchantId,
          refId: element.paymentOutput.references.paymentReference,
          cardType,
          amount: element.paymentOutput.amountOfMoney.amount,
          currency: element.paymentOutput.amountOfMoney.currencyCode,
          paymentStatus: element.status,
          urlForCompleteCheckout: `${
            BASE_URL.api_url
          }/ingenico_callback?mchd=${merchantId}&hostedCheckoutId=${hostedCheckedoutDataId}`,
        });
      });
    }
    // paypal will be in feature
    return Promise.resolve(replyData);
  };
  Payments.remoteMethod('getUrlForIncompletePayment', {
    accepts: [{ arg: 'bookingId', type: 'string', description: 'bookingId', required: true }],
    returns: { type: 'object', root: true },
    http: { path: '/getUrlForIncompletePayment', verb: 'post' },
  });

  Payments.iamportCallbackComplete = async (imp_uid, merchant_uid, status) => {
    if (status !== 'paid') return Promise.reject('THIS PAYMENT DID NOT COMPLETE');

    const Iamport = Payments.app.models.Iamport;
    const PaymentLogs = Payments.app.models.PaymentLogs;
    const gatewayPaymentData = await Iamport.getPayment(imp_uid);

    const splitMerchantUID = merchant_uid.split('_');
    if (gatewayPaymentData.status !== 'paid')
      return Promise.reject('THIS PAYMENT DID NOT COMPLETE');

    const bookingData = await Payments.app.models.Booking.findOne({
      where: { ref_id: splitMerchantUID[1] },
    });

    const paymentInDb = await Payments.findOne({ where: { external_authorize_id: imp_uid } });
    if (paymentInDb) {
      console.log({ status: 201, message: 'This payment already finished' });
      return Promise.resolve({ status: 201, message: 'This payment already finished' });
    }

    const resFromCreate = await Iamport.createPayment({
      booking_id: bookingData.id,
      imp_uid,
    });
    PaymentLogs.pushLog(
      'PAYMENT_IAMPORT_CALLBACK',
      'CREATE',
      2,
      `bid: ${bookingData.id}`,
      resFromCreate,
      'IAMPORT',
      0,
    );
    return Promise.resolve(resFromCreate);
  };
  Payments.remoteMethod('iamportCallbackComplete', {
    accepts: [
      { arg: 'imp_uid', type: 'string', description: 'Iamport UID from gateway', requied: true },
      {
        arg: 'merchant_uid',
        type: 'string',
        description: 'Merchant UID from gateway',
        requied: true,
      },
      {
        arg: 'status',
        type: 'string',
        description: 'Iamport payment status from gateway',
        requied: true,
      },
    ],
    returns: { type: 'object', root: true },
    http: { path: '/iamportCallbackComplete', verb: 'post' },
  });

  Payments.isCompletePayment = async data => {
    const bookingId = data.bookingId;
    const paymentMethodId = data.paymentMethodId;
    try {
      const bookingData = await Payments.app.models.Booking.findById(bookingId);
      let paymentData = null;
      if (paymentMethodId === 'Iamport') {
        paymentData = await Payments.app.models.Iamport.findPayment(bookingData.ref_id);
      }
      if (!paymentData || paymentData.statusCode !== 0 || paymentData.response.status !== 'paid') {
        return Promise.resolve({
          status: 4004,
          message: 'Not found payment for this booking',
        });
      }
      let paymentInDb = await Payments.findOne({ where: { booking_id: bookingId } });
      if (!paymentInDb) {
        const paymentBodyData = {
          payment_status_id: 1,
          payment_gateway_response: JSON.stringify(paymentData),
          external_transaction_id: paymentData.response.pg_tid,
          external_authorize_id: paymentData.response.imp_uid,
          external_charge_id: '',
          external_refund_id: '',
          booking_id: bookingId,
          payment_method_id: parseInt(5, 10),
          total: paymentData.response.amount,
          currency: paymentData.response.currency,
        };

        paymentInDb = await Payments.create(paymentBodyData);
      }

      return Promise.resolve({
        status: 2001,
        message: 'Founded payment, this booking already complete',
        success: true,
        book: bookingData,
        payment: paymentInDb,
        customer: paymentInDb,
        origin: paymentData,
        payment_code: 1000,
      });
    } catch (err) {
      return Promise.resolve({
        status: 5005,
        message: 'Payment not found or api errors',
        error: err,
      });
    }
  };
  Payments.remoteMethod('isCompletePayment', {
    accepts: [
      {
        arg: 'data',
        type: 'object',
        http: {
          source: 'body',
        },
        required: true,
      },
    ],
    returns: { type: 'object', root: true },
    http: { path: '/isCompletePayment', verb: 'post' },
  });

  // don't forget to remove payment_id in here and in backoffice api call
  Payments.approve = async (
    payment_id,
    booking_id,
    isSendCustomerEmail = true,
    isSendSupplierEmail = true,
    req,
  ) => {
    try {
      const finalApproveResponse = {};
      const user_id = getSafe(() => req.accessToken.userId);
      await Payments.app.models.Users.onlyAdminValidation(user_id);
      if (!booking_id)
        return Promise.reject(newLoopbackError(BAD_REQUEST, 'BOOKING_ID_IS_REQIORED'));
      const { booking, payment } = await getPaymenAndBookingObject(booking_id, 1);
      if (!booking) return Promise.reject(newLoopbackError(FORBIDDEN, 'BOOKING_IS_NOT_FOUND'));
      if (payment.length == 0 && booking.booking_method_id != 3)
        return Promise.reject(newLoopbackError(FORBIDDEN, 'PAYMENT_IS_NOT_FOUND'));
      if ([1, 8].indexOf(parseInt(booking.booking_status_id)) == -1)
        return Promise.reject(
          newLoopbackError(
            BAD_REQUEST,
            'BOOKING_IS_NOT_AUTHORIZATION',
            'booking status id is not 1 or 3',
            booking,
          ),
        );

      if (_.find(payment, { payment_status_id: '6' })) {
        _.each(payment, async payment_element => {
          await payment_element.updateAttributes({
            payment_status_id: 7,
            total_charge: payment_element.total,
            final_amount: payment_element.total,
          });
        });
        await booking.updateAttribute('booking_status_id', 2);
        await createBookingActivity('Booking Complete', user_id, booking.id);
        finalApproveResponse.status = 'approved';
        finalApproveResponse.message = 'all payment had been approved';
        await Payments.app.models.Charge.updateAll(
          { booking_id, charge_status_id: 1 },
          { charge_status_id: 2 },
        );
        // const createPayout = await Payments.app.models.Payouts.createPayoutPostConfirm(booking_id)
      } else {
        let totalToDeduct = await Payments.app.models.Charge.getNewBookingTotal(booking);
        const promiseToAwait = [];
        _.each(payment, payment_element => {
          let total_to_approve = 0;
          if (payment_element.total <= totalToDeduct) {
            total_to_approve = payment_element.total;
            totalToDeduct -= payment_element.total;
          } else if (payment_element.total > totalToDeduct) {
            total_to_approve = totalToDeduct;
          }
          if (parseInt(payment_element.payment_method_id, 10) !== 6) {
            // approve only payment method not equal offline(6)
            const { payloadFactory, paymentGateWay } = getPaymentGateWayAndPayloadFactory(
              payment_element.payment_method_id,
            );
            if (!payloadFactory || !paymentGateWay)
              return Promise.reject(
                newLoopbackError(BAD_REQUEST, 'PAYMENT_METHOD_IS_UNREFUNDABLE'),
              );
            if (parseInt(payment_element.payment_status_id, 10) < 2) {
              if (total_to_approve > 0) {
                promiseToAwait.push(
                  paymentGateWay.approvePayment(payloadFactory(payment_element, total_to_approve)),
                );
              }
            }
          }
        });

        try {
          const allPaymentResponse = await Promise.all(promiseToAwait);
          if (_.every(allPaymentResponse, { status: 1000 }) && allPaymentResponse.length > 0) {
            await booking.updateAttribute('booking_status_id', 2);
            await createBookingActivity('Booking Complete', user_id, booking.id);
            finalApproveResponse.status = 'approved';
            finalApproveResponse.message = 'all payment had been approved';
            await Payments.app.models.Charge.updateAll(
              { booking_id, charge_status_id: 1 },
              { charge_status_id: 2 },
            );
            // const createPayout = await Payments.app.models.Payouts.createPayoutPostConfirm(booking_id)
          } else if (parseInt(booking.booking_method_id, 10) === 3) {
            await booking.updateAttribute('booking_status_id', 2);
            await createBookingActivity('Booking Complete', user_id, booking.id);
            finalApproveResponse.status = 'approved';
            finalApproveResponse.message = 'the booking had been approved';
            await Payments.app.models.Charge.updateAll(
              { booking_id, charge_status_id: 1 },
              { charge_status_id: 2 },
            );
            // const createPayout = await Payments.app.models.Payouts.createPayoutPostConfirm(booking_id)
          } else {
            const objectFailed = _.find(allPaymentResponse, { status: 5000 });
            finalApproveResponse.status = 'not approve';
            finalApproveResponse.message = objectFailed.message;
          }
          finalApproveResponse.all_payment = allPaymentResponse;
        } catch (error) {
          console.log('Payments.approve error', error);
          return Promise.reject(error);
        }
      }

      if (
        finalApproveResponse.status == 'approved' &&
        (isSendCustomerEmail || isSendSupplierEmail)
      ) {
        try {
          if (isSendCustomerEmail) {
            const emailObjects = [
              await BookingHelper.getEmailObject(
                booking.toObject(),
                BookingHelper.BOOKING_EMAIL_TYPE.CUSTOMER_BOOKING_CONFIRMED,
                undefined,
                user_id,
              ),
            ];
            EmailHelper.send(emailObjects)
              .then(res => console.log('SUCCESS send - CUSTOMER_BOOKING_CONFIRMED'))
              .catch(error => console.log('ERROR send - CUSTOMER_BOOKING_CONFIRMED', error));
          }
          if (isSendSupplierEmail) {
            const emailObjects = [
              await BookingHelper.getEmailObject(
                booking.toObject(),
                BookingHelper.BOOKING_EMAIL_TYPE.SUPPLIER_BOOKING_CONFIRMED,
                1,
                user_id,
              ),
            ];
            EmailHelper.send(emailObjects)
              .then(res => console.log('SUCCESS send - SUPPLIER_BOOKING_CONFIRMED'))
              .catch(error => console.log('ERROR send - SUPPLIER_BOOKING_CONFIRMED', error));
          }
          finalApproveResponse.email_status = 'sent';
        } catch (error) {
          finalApproveResponse.email_status = 'error';
          finalApproveResponse.email_sending_error = error;
          console.log('Send Email Error', error);
        }
      }
      return Promise.resolve(finalApproveResponse);
    } catch (error) {
      console.log('Booking.Approve Error', error);
      return Promise.reject(error);
    }
  };
  Payments.remoteMethod('approve', {
    accepts: [
      {
        arg: 'payment_id',
        type: 'string',
        description: 'optional requied just payment_id or booking_id',
      },
      {
        arg: 'booking_id',
        type: 'string',
        description: 'optional requied just payment_id or booking_id',
      },
      { arg: 'isSendCustomerEmail', type: 'boolean', description: 'default is true' },
      { arg: 'isSendSupplierEmail', type: 'boolean', description: 'default is true' },
      { arg: 'req', type: 'object', http: { source: 'req' } },
    ],
    returns: { type: 'object', root: true },
    http: { path: '/approve', verb: 'post' },
  });

  Payments.cancel = async (payment_id, booking_id, isSendCustomerEmail = true, req) => {
    try {
      const user_id = getSafe(() => req.accessToken.userId);
      await Payments.app.models.Users.onlyAdminValidation(user_id);
      if (!booking_id && !payment_id)
        return Promise.reject(
          newLoopbackError(BAD_REQUEST, 'BOOKING_ID_OR_PAYMENT_ID_IS_REQIORED'),
        );
      const { booking, payment } = await getPaymenAndBookingObject(booking_id, 1);
      if (!booking) return Promise.reject(newLoopbackError(FORBIDDEN, 'BOOKING_IS_NOT_FOUND'));
      if (payment.length === 0 && booking.booking_method_id != 3)
        return Promise.reject(newLoopbackError(FORBIDDEN, 'PAYMENT_IS_NOT_FOUND'));
      const finalApproveResponse = {};
      const promiseToAwait = [];
      _.each(payment, payment_element => {
        const { payloadFactory, paymentGateWay } = getPaymentGateWayAndPayloadFactory(
          payment_element.payment_method_id,
        );
        if (!payloadFactory || !paymentGateWay)
          return Promise.reject(newLoopbackError(BAD_REQUEST, 'PAYMENT_METHOD_IS_NOT_SUPPORT'));
        if (parseInt(payment_element.payment_method_id, 10) === 3) {
          promiseToAwait.push(paymentGateWay.cancelWithRefund(payment_element));
        } else if (parseInt(payment_element.payment_method_id, 10) === 5) {
          promiseToAwait.push(
            paymentGateWay.cancelWithRefund(
              payment_element,
              payment_element.total,
              payment_element.currency,
            ),
          );
        } else if (parseInt(payment_element.payment_method_id, 10) !== 6) {
          promiseToAwait.push(paymentGateWay.cancelPayment(payloadFactory(payment_element)));
        }
      });

      try {
        const allPaymentResponse = await Promise.all(promiseToAwait);
        if (_.every(allPaymentResponse, { status: 1000 }) && allPaymentResponse.length > 0) {
          await booking.updateAttribute('booking_status_id', 7);
          await createBookingActivity('Allotment Reject', user_id, booking.id);
          finalApproveResponse.status = 'cancelled';
          finalApproveResponse.message = 'all payment had been cancelled';
          await Payments.app.models.Charge.updateAll(
            { booking_id, charge_status_id: 1 },
            { charge_status_id: 4 },
          );
        } else if (
          _.every(allPaymentResponse, { status: 1000 }) &&
          parseInt(booking.booking_method_id, 10) === 3
        ) {
          await booking.updateAttribute('booking_status_id', 7);
          await createBookingActivity('Allotment Reject', user_id, booking.id);
          finalApproveResponse.status = 'cancelled';
          finalApproveResponse.message = 'booking had been cancelled';
          await Payments.app.models.Charge.updateAll(
            { booking_id, charge_status_id: 1 },
            { charge_status_id: 4 },
          );
        } else {
          finalApproveResponse.status = 'not cancelled';
          const objectFailed = _.find(allPaymentResponse, { status: 5000 });
          finalApproveResponse.message = objectFailed.message;
        }
        finalApproveResponse.all_payment = allPaymentResponse;
      } catch (error) {
        console.log('Payments.cancellation error', error);
        return Promise.reject(error);
      }
      if (finalApproveResponse.status == 'cancelled' && isSendCustomerEmail) {
        try {
          const emailObjects = [
            await BookingHelper.getEmailObject(
              booking.toObject(),
              BookingHelper.BOOKING_EMAIL_TYPE.CUSTOMER_INQUIRY_CANCELLATION,
              undefined,
              user_id,
            ),
          ];
          EmailHelper.send(emailObjects)
            .then(res => console.log('SUCCESS send - CUSTOMER_INQUIRY_CANCELLATION'))
            .catch(error => console.log('ERROR send - CUSTOMER_INQUIRY_CANCELLATION', error));
          finalApproveResponse.email_status = 'sent';
        } catch (error) {
          finalApproveResponse.email_status = 'error';
          finalApproveResponse.email_sending_error = error;
          console.log('Send Email Error', error);
        }
      }

      return Promise.resolve(finalApproveResponse);
    } catch (error) {
      console.log('Payments.cancellation Error', error);
      return Promise.reject(error);
    }
  };
  Payments.remoteMethod('cancel', {
    accepts: [
      {
        arg: 'payment_id',
        type: 'string',
        description: 'optional requied just payment_id or booking_id',
      },
      {
        arg: 'booking_id',
        type: 'string',
        description: 'optional requied just payment_id or booking_id',
      },
      { arg: 'isSendCustomerEmail', type: 'boolean', description: 'default is true' },
      { arg: 'req', type: 'object', http: { source: 'req' } },
    ],
    returns: { type: 'object', root: true },
    http: { path: '/cancel', verb: 'post' },
  });

  Payments.refundOption = callback =>
    callback(null, [
      { name: 'Full charge', value: 'FULL_CHARGE' },
      { name: 'Cancellation Policy', value: 'APPLY_CANCELLATION_POLICY' },
      { name: 'Processing fee', value: 'APPLY_CANCELLATION_POLICY_IGNORE_DATE' },
      { name: 'Wave Cancellation fee', value: 'FULL_REFUND' },
    ]);
  Payments.remoteMethod('refundOption', {
    returns: { args: 'response', type: 'array', root: true },
    http: { path: '/refundOption', verb: 'get' },
  });

  /**
   * this method use to migrate data in response column
   * we display this data in our backoffice(popup from payment row)
   */
  Payments.migrateOriginalRes = async () => {
    try {
      const promiseToComplte = [];
      let countRowToFinish = 0;
      const paymentList1 = await Payments.find({
        where: {
          payment_gateway_response: {
            like: '{"status":200,"body":{"createdPaymentOutput":{"payment":%',
          },
        },
      });
      _.each(paymentList1, async element => {
        const singlePayment = await Payments.findOne({ where: { id: element.id } });
        const tempObj = JSON.parse(singlePayment.payment_gateway_response);
        promiseToComplte.push(
          singlePayment.updateAttribute(
            'payment_gateway_response',
            JSON.stringify(tempObj.body.createdPaymentOutput),
          ),
        );
      });
      countRowToFinish += paymentList1.length;
      const paymentList2 = await Payments.find({
        where: { payment_gateway_response: { like: '{"status":200,"body":{"payment":%' } },
      });
      _.each(paymentList2, async element => {
        const singlePayment = await Payments.findOne({ where: { id: element.id } });
        const tempObj = JSON.parse(singlePayment.payment_gateway_response);
        promiseToComplte.push(
          singlePayment.updateAttribute('payment_gateway_response', JSON.stringify(tempObj.body)),
        );
      });
      countRowToFinish += paymentList2.length;
      const paymentList3 = await Payments.find({
        where: { payment_gateway_response: { like: '{"createdPaymentOutput":{"payment":%' } },
      });
      _.each(paymentList3, async element => {
        const singlePayment = await Payments.findOne({ where: { id: element.id } });
        const tempObj = JSON.parse(singlePayment.payment_gateway_response);
        promiseToComplte.push(
          singlePayment.updateAttribute(
            'payment_gateway_response',
            JSON.stringify(tempObj.createdPaymentOutput),
          ),
        );
      });
      countRowToFinish += paymentList3.length;
      await Promise.all(promiseToComplte);
      return Promise.resolve({ updated_row: countRowToFinish });
    } catch (err) {
      return Promise.reject(err);
    }
  };
  Payments.remoteMethod('migrateOriginalRes', {
    returns: { type: 'object', root: true },
    http: { path: '/migrateOriginalRes', verb: 'get' },
  });

  Payments.refund = async (
    booking_id,
    refundOption,
    isSendCustomerEmail = true,
    isSendSupplierEmail = true,
    cancellationCost,
    supplierCancellationCost,
    req,
  ) => {
    try {
      const finalRefundResponse = {};
      const user_id = getSafe(() => req.accessToken.userId);
      await Payments.app.models.Users.onlyAdminValidation(user_id);
      if (!booking_id)
        return Promise.reject(newLoopbackError(BAD_REQUEST, 'BOOKING_ID_IS_REQIORED'));
      const { booking, payment } = await getPaymenAndBookingObject(booking_id, 2);
      if (!booking) return Promise.reject(newLoopbackError(FORBIDDEN, 'BOOKING_IS_NOT_FOUND'));
      if (payment.length === 0 && booking.booking_method_id != 3)
        return Promise.reject(newLoopbackError(FORBIDDEN, 'PAYMENT_IS_NOT_FOUND'));
      if (refundOption == REFUND_OPTION.APPLY_CANCELLATION_POLICY)
        await Payments.app.models.Booking.validateCancellationPolicy(booking);
      if (_.filter(payment, { payment_status_id: '1' }).length > 0)
        return Promise.reject(
          newLoopbackError(FORBIDDEN, 'PAYMENT_IS_NOT_CHARGED'),
          'payment is not charged',
          { payment },
        );

      const newObjPayment = [];

      const promiseRefund = [];
      const totalToRefundObject = await Payments.app.models.Charge.getRefundAmount(
        booking_id,
        refundOption,
        cancellationCost,
      );
      let totalToRefund = totalToRefundObject.amount;
      if (totalToRefund == 0) {
        for (let i = payment.length - 1; i >= 0; i--) {
          const paymentBodyData = {
            payment_status_id: 4,
            payment_gateway_response: payment[i].payment_gateway_response,
            external_transaction_id: payment[i].external_transaction_id,
            external_authorize_id: payment[i].external_authorize_id,
            external_charge_id: '',
            external_refund_id: '',
            booking_id: payment[i].booking_id,
            payment_method_id: parseInt(payment[i].payment_method_id, 10),
            total: payment[i].total,
            total_charge: 0,
            total_refund: 0,
            currency: payment[i].currency,
          };
          await Payments.create(paymentBodyData);
        }
        finalRefundResponse.status = 'refunded';
        finalRefundResponse.message = 'all payment had been refunded';
      } else {
        for (let i = payment.length - 1; i >= 0; i--) {
          const tempObj = {};
          tempObj.payment = payment[i];
          if (totalToRefund > payment[i].total_charge) {
            tempObj.refund_obj = {
              refund_amount: payment[i].total_charge,
              currency_code: payment[i].currency,
            };
            totalToRefund -= payment[i].total_charge;
          } else {
            tempObj.refund_obj = {
              refund_amount: totalToRefund,
              currency_code: payment[i].currency,
            };
            totalToRefund = 0;
          }
          newObjPayment.push(tempObj);
          if (totalToRefund == 0) {
            break;
          }
        }
        // ingenico || paypal
        _.each(newObjPayment, element => {
          const { paymentGateWay } = getPaymentGateWayAndPayloadFactory(
            element.payment.payment_method_id,
          );
          if (!paymentGateWay)
            return Promise.reject(newLoopbackError(BAD_REQUEST, 'PAYMENT_METHOD_IS_NOT_SUPPORT'));
          promiseRefund.push(
            paymentGateWay.refund(
              element.payment,
              element.refund_obj.refund_amount,
              element.refund_obj.currency_code,
            ),
          );
        });
        try {
          const allRefundPaymentObject = await Promise.all(promiseRefund);
          if (
            _.every(allRefundPaymentObject, { status: 1000 }) &&
            allRefundPaymentObject.length > 0
          ) {
            // create new refunded payment
            finalRefundResponse.status = 'refunded';
            finalRefundResponse.message = 'all payment had been refunded';
          } else if (parseInt(booking.booking_method_id, 10) === 3) {
            finalApproveResponse.status = 'refunded';
            finalApproveResponse.message = 'booking had been refunded';
          } else {
            // create new refunded payment with error
            finalRefundResponse.status = 'not refund';
            finalRefundResponse.message = 'some payment had error while refund state';
          }
          // finalRefundResponse.all_refund = allRefundPaymentObject
        } catch (error) {
          console.log('Payments.refund error', error);
          return Promise.reject(error);
        }
      }

      if (
        finalRefundResponse.status == 'refunded' &&
        (isSendCustomerEmail || isSendSupplierEmail)
      ) {
        const filter = Payments.app.models.Booking.defaultFilter;
        const updatedBooking = await Payments.app.models.Booking.findById(booking_id, filter);
        try {
          if (isSendCustomerEmail) {
            const emailObjects = [
              await BookingHelper.getEmailObject(
                updatedBooking.toObject(),
                BookingHelper.BOOKING_EMAIL_TYPE.CUSTOMER_BOOKING_CANCELLATION,
                undefined,
                user_id,
              ),
            ];
            EmailHelper.send(emailObjects)
              .then(res => console.log('SUCCESS send - CUSTOMER_BOOKING_CANCELLATION'))
              .catch(error => console.log('ERROR send - CUSTOMER_BOOKING_CANCELLATION', error));
          }
          if (isSendSupplierEmail) {
            const emailObjects = [
              await BookingHelper.getEmailObject(
                updatedBooking.toObject(),
                BookingHelper.BOOKING_EMAIL_TYPE.SUPPLIER_BOOKING_CANCELLATION,
                1,
                user_id,
              ),
            ];
            EmailHelper.send(emailObjects)
              .then(res => console.log('SUCCESS send - SUPPLIER_BOOKING_CANCELLATION'))
              .catch(error => console.log('ERROR send - SUPPLIER_BOOKING_CANCELLATION', error));
          }
        } catch (error) {
          console.log('Send Email Error', error);
        }
      }
      if (refundOption != REFUND_OPTION.REMOVE_PAX && finalRefundResponse.status == 'refunded') {
        if (refundOption == REFUND_OPTION.FULL_CHARGE) {
          await Payments.app.models.Charge.createFullPenalty(booking_id);
        } else if (refundOption == REFUND_OPTION.APPLY_CANCELLATION_POLICY) {
          await Payments.app.models.Charge.createCancellation(booking_id);
        } else if (refundOption == REFUND_OPTION.APPLY_CANCELLATION_POLICY_IGNORE_DATE) {
          await Payments.app.models.Charge.createCancellation(booking_id, 2, 6);
        } else if (refundOption == REFUND_OPTION.CUSTOM) {
          await Payments.app.models.Charge.createCancellation(
            booking_id,
            2,
            8,
            cancellationCost,
            supplierCancellationCost,
          );
        }
        await Payments.app.models.Charge.updateAll(
          { booking_id, charge_status_id: 2, charge_type_id: { nin: [4, 5, 6, 8] } },
          { charge_status_id: 6 },
        );

        await booking.updateAttribute('booking_status_id', 6);

        await Payments.app.models.Payouts.updateCanceledBooking(booking_id);

        // Activity log for booking status change
        await createBookingActivity('Canceled', user_id, booking.id);
      }
      return Promise.resolve(finalRefundResponse);
    } catch (error) {
      console.log('Payments.refund Error', error);
      return Promise.reject(error);
    }
  };
  Payments.remoteMethod('refund', {
    accepts: [
      {
        arg: 'booking_id',
        type: 'string',
        description: 'optional requied just payment_id or booking_id',
      },
      {
        arg: 'refundOption',
        type: 'string',
        required: true,
        description:
          'FULL_CHARGE, APPLY_CANCELLATION_POLICY, APPLY_CANCELLATION_POLICY_IGNORE_DATE, FULL_REFUND',
      },
      { arg: 'isSendCustomerEmail', type: 'boolean', description: 'default is true' },
      { arg: 'isSendSupplierEmail', type: 'boolean', description: 'default is true' },
      { arg: 'cancellationCost', type: 'string', description: 'cancellationCost' },
      { arg: 'supplierCancellationCost', type: 'string', description: 'supplierCancellationCost' },
      { arg: 'req', type: 'object', http: { source: 'req' } },
    ],
    returns: { type: 'object', root: true },
    http: { path: '/refund', verb: 'post' },
  });

  Payments.refundPreview = async (booking_id, refundOption) => {
    try {
      if (!booking_id)
        return Promise.reject(newLoopbackError(BAD_REQUEST, 'BOOKING_ID_IS_REQIORED'));
      const { booking, payment } = await getPaymenAndBookingObject(booking_id, 2);
      if (!booking) return Promise.reject(newLoopbackError(FORBIDDEN, 'BOOKING_IS_NOT_FOUND'));
      if (payment.length === 0)
        return Promise.reject(newLoopbackError(FORBIDDEN, 'PAYMENT_IS_NOT_FOUND'));
      if (!_.every(payment, { payment_status_id: '2' }))
        return Promise.reject(
          newLoopbackError(FORBIDDEN, 'PAYMENT_IS_NOT_CHARGED'),
          'payment is not charged',
          { payment },
        );
      const refundAmountObject = await Payments.app.models.Charge.getRefundAmount(
        booking_id,
        refundOption,
      );
      const refundAmount = refundAmountObject.amount;
      const refundMessage = refundAmountObject.message;
      const fee = Number(booking.total - refundAmount).toFixed(2);

      const refundObject = {
        fee,
        currency_code: booking.booking_currency_code,
        message: refundMessage,
      };

      return Promise.resolve(refundObject);
    } catch (error) {
      console.log('Payments.refundPreview Error', error);
      return Promise.reject(error);
    }
  };
  Payments.remoteMethod('refundPreview', {
    accepts: [
      {
        arg: 'booking_id',
        type: 'string',
        description: 'optional requied just payment_id or booking_id',
      },
      {
        arg: 'refundOption',
        type: 'string',
        required: true,
        description:
          'FULL_CHARGE, APPLY_CANCELLATION_POLICY, APPLY_CANCELLATION_POLICY_IGNORE_DATE, FULL_REFUND',
      },
    ],
    returns: { type: 'object', root: true },
    http: { path: '/refundPreview', verb: 'get' },
  });

  Payments.saveCardData = async (cardData, paymentMethodId) => {
    try {
      const sensitiveCardData = cardData.data.cardWithoutCvv;
      const customerData = cardData.customer;
      const alias = cardData.alias;
      let tokenRes;
      if (paymentMethodId === 2) {
        tokenRes = Payments.app.models.Ingenico.saveCardToken(
          sensitiveCardData,
          customerData,
          alias,
        );
      }

      if (tokenRes.status === 400) return Promise.reject(tokenRes.body);
      if (tokenRes.status === 403) return Promise.reject(tokenRes.body);

      return Promise.resolve(tokenRes);
    } catch (err) {
      return Promise.reject(err);
    }
  };
};
