const fs = require('fs');

const CryptoJS = require('crypto-js');
const moment = require('moment');

const ingenicoHelper = require('../../helpers/ingenico');
const hostConfig = require('../../../server/config/config.json');
const paymentMethodList = require('../../downloads/paymentMethod.json');
const configCredential = require('../../../server/config/env-service');

const ingenicoConfig = configCredential.ingenicoCredentials;
const {
  newLoopbackError,
  HTTPStatusCode: { FORBIDDEN, BAD_REQUEST },
  constants: { isProduction },
  getSafe,
} = require('../../utility');

const _ = require('lodash');

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
  config = ingenicoConfig.production;
} else if (process.env.NODE_ENV == 'development') {
  config = ingenicoConfig.development;
} else {
  config = ingenicoConfig.development;
}

module.exports = function(Ingenico) {
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
    const { PaymentLogs } = Ingenico.app.models;

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

  async function validateResponseFromIngenico(ingenicoResponse, booking_id, ingenicoStageFlag) {
    const successStatus = [200, 201];
    const errorStatusWithPaymentResult = [400, 402, 403, 502, 503];
    const errorStatusWithOutPaymentResult = [404, 409];
    const responseObj = {};
    let logFlag = '';
    let severity = 1;
    if (successStatus.indexOf(ingenicoResponse.status) > 0) {
      responseObj.success = true;
      responseObj.message = ingenicoResponse.body.payment.status;
      if (
        ingenicoResponse.body.payment.paymentOutput.cardPaymentMethodSpecificOutput.card.cardNumber
      ) {
        responseObj.paymentInformationData =
          ingenicoResponse.body.payment.paymentOutput.cardPaymentMethodSpecificOutput.card.cardNumber;
      } else {
        // handle this for future to use this payment for another payment
        responseObj.paymentInformationData = '';
      }
      responseObj.originalBodyRes = ingenicoResponse.body;
      // responseObj.paymentCode = ingenicoResponse.body.payment.status
      responseObj.paymentCode = ingenicoResponse.body.payment.statusOutput.statusCode;
      logFlag = 'PAYMENT_LOG';
      severity = 2;
    } else if (errorStatusWithPaymentResult.indexOf(ingenicoResponse.status) > 0) {
      responseObj.success = false;
      responseObj.originalBodyRes = ingenicoResponse.body;
      if (Object.prototype.hasOwnProperty.call(ingenicoResponse.body, 'paymentResult')) {
        responseObj.paymentCode =
          ingenicoResponse.body.paymentResult.payment.statusOutput.statusCode;
        responseObj.message =
          ingenicoResponse.body.paymentResult.payment.statusOutput.statusCategory;
      }
      responseObj.paymentInformationData =
        ingenicoResponse.body.paymentResult.payment.paymentOutput.cardPaymentMethodSpecificOutput.card.cardNumber;
      logFlag = 'ERR_PAYMENT_LOG';
      severity = 2;
    } else if (errorStatusWithOutPaymentResult.indexOf(ingenicoResponse.status) > 0) {
      responseObj.success = false;
      responseObj.originalBodyRes = ingenicoResponse.body;
      switch (ingenicoResponse.status) {
        case 404:
          responseObj.paymentCode = 180;
          break;
        case 409:
          responseObj.paymentCode = 1000;
          break;
        default:
      }
      responseObj.message = '';
      ingenicoResponse.body.errors.forEach(element => {
        if (responseObj.message != '') {
          responseObj.message += ', ';
        }
        responseObj.message += ingenicoResponse.body.errors;
      });
      responseObj.paymentInformationData = '';
      logFlag = 'ERR_PAYMENT_LOG';
      severity = 2;
    } else {
      responseObj.success = false;
      responseObj.message = 'Api error : somthing wrong with api';
      responseObj.originalBodyRes = ingenicoResponse.body;
      // use this number for api error and other unknow error
      responseObj.paymentCode = 5000;
      responseObj.paymentInformationData = '';
      logFlag = 'API_ERR_PAYMENT_LOG';
      severity = 5;
    }
    // ingenico log
    pushLogData(
      `${configHost.api_url}/PaymentLogs/`,
      logFlag,
      ingenicoStageFlag,
      severity,
      `bid: ${booking_id}`,
      responseObj,
      'INGENICO',
      responseObj.paymentCode,
    );
    return Promise.resolve(responseObj);
  }

  // this mehod is called from payments model (isAbleCreate method)
  Ingenico.getTotalPay = async booking_id => {
    try {
      const ingenicoFindPaymentsResponse = await ingenicoHelper.findPaymentsFromSDK(booking_id);
      const payments = getSafe(() => ingenicoFindPaymentsResponse.body.payments);
      if (!payments || payments.length === 0) return Promise.resolve(0);
      const totalpay = payments.reduce(
        (cur, acc) => cur + acc.paymentOutput.amountOfMoney.amount / 100.0,
        0,
      );
      return Promise.resolve(totalpay);
    } catch (error) {
      console.log(error);
      return Promise.reject(error);
    }
  };

  /**
   * aab payment feature
   * Use this method to create hosted checkout link
   * this method for use with credit card, alipay, unionpay
   */
  Ingenico.createOnlinePayment = async (payment, booking, return_base_url, payment_method_id) => {
    if (!payment) return Promise.reject('No payment data in Ingenico createOnlinePayment endpoint');

    try {
      let cardType = 0;
      switch (parseInt(payment_method_id, 10)) {
        case 2:
          cardType = 1;
          break; // Credit Card
        case 3:
          cardType = 861;
          break; // Alipay
        case 4:
          cardType = 430;
          break; // UnionPay International
        default:
          break;
      }

      if (cardType === 0) return Promise.reject('This payment did not supported by Ingenico');

      let merchant = config.merchantId;
      // if (cardType == 128) merchant = '1771' // Discover
      // if (cardType == 132) merchant = '1771' // Diners Club
      if (cardType == 430) merchant = '1774'; // UnionPay International
      // this is return url, may be in frontend or build an web redirect like server template

      let amount = payment.total;
      switch (payment.currency) {
        case 'INR':
        case 'IDR':
        case 'JPY':
        case 'KRW':
        case 'VND':
          amount = Math.round(amount);
          break;
        default:
          break;
      }

      // return url for credit card
      let returnUrl = `${return_base_url}/payment/please-wait?mchd=${merchant}`;

      if (cardType > 400) {
        returnUrl = `${return_base_url}/payment/redirect-complete?mchd=${merchant}&uuid=${
          payment.uuid
        }&method=${payment_method_id}`;
      }

      const ingenicoObj = {
        order: {
          amountOfMoney: {
            currencyCode: payment.currency,
            amount: Math.round(amount * 100),
          },
          customer: {
            billingAddress: {
              street: '',
              houseNumber: '',
              additionalInfo: '',
              zip: '',
              city: '',
              state: '',
              countryCode:
                booking !== null
                  ? booking.billingCountryIdFkeyrel().iso_code
                  : payment.special_data.billing_country,
            },
            companyInformation: {
              name: 'TheAsia Thai Co.,Ltd',
            },
          },
          references: {
            // maybe use this later on our invoice
            // invoiceData: {
            //   invoiceNumber: jsonData.invoice,
            //   invoiceDate: jsonData.invoice_date,
            // },
            merchantOrderId: booking !== null ? parseInt(booking.id, 10) : 0,
            merchantReference: payment.uuid,
          },
        },
        hostedCheckoutSpecificInput: {
          locale: 'en_GB',
          returnCancelState: true,
          returnUrl,
          showResultPage: false,
          variant: '102',
        },
      };

      if (process.env.NODE_ENV !== 'production') {
        ingenicoObj.order.references.merchantOrderId = moment(booking.created_at).unix();
      }

      if (cardType < 400) {
        ingenicoObj.hostedCheckoutSpecificInput.paymentProductFilters = {
          restrictTo: {
            groups: ['cards'],
          },
        };

        ingenicoObj.cardPaymentMethodSpecificInput = {
          skipAuthentication: false,
          authorizationMode: 'FINAL_AUTHORIZATION',
          requiresApproval: true,
        };
        if (cardType > 1) {
          ingenicoObj.cardPaymentMethodSpecificInput.paymentProductId = cardType;
        }
      } else if (cardType > 400) {
        ingenicoObj.redirectPaymentMethodSpecificInput = {
          paymentProductId: cardType,
          requiresApproval: true,
        };
      }

      const resAwait = await ingenicoHelper.createHostedCheckoutFromSDK(ingenicoObj, merchant);

      return Promise.resolve({
        gateway: resAwait,
        url: `https://payment.${resAwait.partialRedirectUrl}`,
      });
    } catch (err) {
      Promise.reject(err);
    }
  };

  /**
   * Use to retrieve hosted checkout data
   * Ingenico and Payment internal call only
   */
  Ingenico.getHostedCheckouts = async function(hostedCheckedoutId, payment_method_id) {
    try {
      let cardType = 0;
      switch (parseInt(payment_method_id, 10)) {
        case 2:
          cardType = 1;
          break; // Credit Card
        case 3:
          cardType = 861;
          break; // Alipay
        case 4:
          cardType = 430;
          break; // UnionPay International
        default:
          break;
      }

      if (cardType === 0) return Promise.reject('This payment did not supported by Ingenico');

      let merchant = config.merchantId;
      // if (cardType == 128) merchant = '1771' // Discover
      // if (cardType == 132) merchant = '1771' // Diners Club
      if (cardType == 430) merchant = '1774'; // UnionPay International

      const resAwait = await ingenicoHelper.getHostedCheckoutsFromSDK(hostedCheckedoutId, merchant);
      return Promise.resolve(resAwait);
    } catch (err) {
      return Promise.reject(err);
    }
  };
  /**
   * Create hosted checkout payment link
   * this method is for alipay and unionpay
   */
  Ingenico.createPayment = async (data, req) => {
    const Booking = Ingenico.app.models.Booking;
    const Payment = Ingenico.app.models.Payments;

    if (!data.booking_id) return Promise.reject('No booking id data');

    try {
      const paymentIsAbleCreate = await Payment.isAbleCreate(data.booking_id);

      if (!paymentIsAbleCreate) {
        const [bookingData, createdPayment] = await Promise.all([
          Booking.findById(data.booking_id),
          Payment.find({ where: { booking_id: data.booking_id } }),
        ]);
        // prevent flush database on development
        if (createdPayment.length > 0) {
          const dataRep = {
            theasia: 'better than now',
            id: 'ingenico',
            status: 200,
            success: true,
            book: bookingData,
            payment: createdPayment[0].external_transaction_id,
            customer: createdPayment[0].external_transaction_id,
            origin: paymentIsAbleCreate,
          };
          return Promise.resolve({
            status: 429,
            message: 'This booking had paid, please make sure you did not make too many request',
            data: dataRep,
          });
        }
      }

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

      // prepare json data for card type
      const jsonData = {};
      switch (parseInt(data.payment_method_id, 10)) {
        case 2:
          jsonData.cardtype = 1;
          break; // Credit Card
        case 3:
          jsonData.cardtype = 861;
          break; // Alipay
        case 4:
          jsonData.cardtype = 430;
          break; // UnionPay International
        case 5:
          jsonData.cardtype = 128;
          break; // Discover
        case 6:
          jsonData.cardtype = 132;
          break; // Diners Club
        default:
          break;
      }

      // set locale from data in bookingData
      const locale = 'en_GB';
      switch (bookingData.billingCountryIdFkeyrel().iso_code) {
        case 'IN':
        case 'ID':
        case 'JP':
        case 'KR':
        case 'VN':
          bookingData.total = Math.round(bookingData.total);
          break;
        default:
          break;
      }

      let cardholder_f = bookingData.billing_first_name;
      let cardholder_l = bookingData.billing_last_name;
      const cardholder_m = '';
      if (cardholder_f.length > 15) cardholder_f = bookingData.billing_first_name.substr(0, 15);
      if (cardholder_l.length > 70) cardholder_l = bookingData.billing_last_name.substr(0, 70);

      jsonData.price = bookingData.total * 100;
      jsonData.currency = bookingData.booking_currency_code;
      jsonData.order_id = data.booking_id;
      jsonData.requiresApproval = true;
      jsonData.authorizationMode = 'FINAL_AUTHORIZATION';
      jsonData.lang = 'en';
      jsonData.locale = locale;
      jsonData.uid = bookingData.user_id;
      jsonData.phone = bookingData.billing_phone;
      jsonData.name = cardholder_f;
      jsonData.surname = cardholder_l;
      jsonData.invoice = '';
      jsonData.invoice_date = '';
      jsonData.variant = '102';
      jsonData.show_result_page = false;

      jsonData.country = bookingData.billingCountryIdFkeyrel().iso_code;
      jsonData.reference = bookingData.booking_no;
      jsonData.email = bookingData.bookingUserIdFkeyrel().email;

      // // not sure this will get the client ip addr
      // let ip = ''
      // if (req.ip) { ip = req.ip }
      // jsonData.ipaddr = ip

      let merchant = config.merchantId;
      // if (jsonData.cardtype == 128) merchant = '1771' // Discover
      // if (jsonData.cardtype == 132) merchant = '1771' // Diners Club
      if (jsonData.cardtype == 430) merchant = '1774'; // UnionPay International
      // this is return url, may be in frontend or build an web redirect like server template
      jsonData.return_url = `${configHost.api_url}/ingenico_callback?mchd=${merchant}`;

      const dataObject = {
        order: {
          amountOfMoney: {
            currencyCode: jsonData.currency,
            amount: Math.round(jsonData.price),
          },
          customer: {
            merchantCustomerId: String(jsonData.uid),
            personalInformation: {
              name: {
                title: '',
                firstName: cardholder_f,
                surnamePrefix: cardholder_m,
                surname: cardholder_l,
              },
              gender: '',
              dateOfBirth: '',
            },
            companyInformation: {
              name: 'TheAsia Thai Co.,Ltd',
            },
            locale: jsonData.lang,
            billingAddress: {
              street: '',
              houseNumber: '',
              additionalInfo: '',
              zip: '',
              city: '',
              state: '',
              countryCode: jsonData.country,
            },
            shippingAddress: {
              name: {
                title: '',
                firstName: jsonData.name,
                surname: jsonData.surname,
              },
              street: '',
              houseNumber: '',
              additionalInfo: '',
              zip: '',
              city: '',
              state: '',
              countryCode: '',
            },
            contactDetails: {
              emailAddress: jsonData.email,

              phoneNumber: jsonData.phone,
              faxNumber: '',
              emailMessageType: 'html',
            },
            vatNumber: '',
          },
          references: {
            merchantOrderId: parseInt(jsonData.order_id, 10),
            merchantReference: jsonData.reference,
            invoiceData: {
              invoiceNumber: jsonData.invoice,
              invoiceDate: jsonData.invoice_date,
            },
          },
        },
        hostedCheckoutSpecificInput: {
          showResultPage: !!jsonData.show_result_page,
          returnUrl: jsonData.return_url,
          variant: jsonData.variant,
          locale: jsonData.locale,
        },
        // fraudFields: {
        //   customerIpAddress: jsonData.ipaddr,
        // },
      };
      /**
       * Since Ingenico uses merchantOrderId as key for payment, to prevent mixing of dev and
       * production data it is replaced with unixtimestamp
       */
      if (process.env.NODE_ENV !== 'production') {
        dataObject.order.references.merchantOrderId = moment(bookingData.created_at).unix();
      }

      if (jsonData.cardtype < 400) {
        dataObject.hostedCheckoutSpecificInput.paymentProductFilters = {
          restrictTo: {
            groups: ['cards'],
          },
        };

        dataObject.cardPaymentMethodSpecificInput = {
          skipAuthentication: false,
          authorizationMode: jsonData.authorizationMode,
          requiresApproval: jsonData.requiresApproval,
        };
        if (jsonData.cardtype > 1) {
          dataObject.cardPaymentMethodSpecificInput.paymentProductId = jsonData.cardtype;
        }
      } else if (jsonData.cardtype > 400) {
        dataObject.redirectPaymentMethodSpecificInput = {
          paymentProductId: jsonData.cardtype,
          requiresApproval: jsonData.requiresApproval,
        };
      }

      const resAwait = await ingenicoHelper.createHostedCheckoutFromSDK(dataObject, merchant);

      const resData = {};
      resData.status = 1000;
      resData.url = `https://payment.${resAwait.partialRedirectUrl}`;
      resData.merchant = merchant;
      resData.data = resAwait;

      // push log
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'CREATE',
        2,
        `bid: ${data.booking_id}`,
        jsonData,
        'INGENICO',
        0,
      );

      return Promise.resolve(resData);
    } catch (err) {
      return Promise.reject(err);
    }
  };
  Ingenico.remoteMethod('createPayment', {
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

  /**
   * Ingenico and Payment Internal use to validate card data from ingenico
   * @param {*} paymentOutput
   */
  Ingenico.getCardPaymentData = paymentOutput => {
    const responseObj = {};
    const paymentProductId =
      paymentOutput.paymentMethod === 'redirect'
        ? paymentOutput.redirectPaymentMethodSpecificOutput.paymentProductId
        : paymentOutput.cardPaymentMethodSpecificOutput.paymentProductId;
    switch (parseInt(paymentProductId, 10)) {
      case 1:
        responseObj.merchantId = 1769;
        responseObj.cardTypeName = 'Credit Card';
        responseObj.paymentMethodId = 2;
        responseObj.payment = paymentOutput.cardPaymentMethodSpecificOutput.card.cardNumber;
        break;
      case 861:
        responseObj.merchantId = 1769;
        responseObj.cardTypeName = 'Alipay';
        responseObj.paymentMethodId = 3;
        responseObj.payment = 'Alipay';
        break;
      case 430:
        responseObj.merchantId = 1774;
        responseObj.cardTypeName = 'UnionPay';
        responseObj.paymentMethodId = 4;
        responseObj.payment = 'UnionPay';
        break;
      // case 128:
      //   responseObj.merchantId = 1771;
      //   responseObj.cardTypeName = 'Discovery';
      //   responseObj.paymentMethodId = 5;
      //   responseObj.payment = paymentOutput.cardPaymentMethodSpecificOutput.card.cardNumber;
      //   break;
      // case 132:
      //   responseObj.merchantId = 1771;
      //   responseObj.cardTypeName = 'Diners Club';
      //   responseObj.paymentMethodId = 6;
      //   responseObj.payment = paymentOutput.cardPaymentMethodSpecificOutput.card.cardNumber;
      //   break;
      default:
        break;
    }
    responseObj.cardType = paymentProductId;
    responseObj.paymentMethod = paymentOutput.paymentMethod;
    responseObj.amount = paymentOutput.amountOfMoney.amount;
    responseObj.currency = paymentOutput.amountOfMoney.currencyCode;
    return responseObj;
  };

  /**
   * Complete payment that cannot complete from website
   *
   */
  Ingenico.completePayment = async (gatewayPaymentId, merchantId, refId, bookingId) => {
    const paymentData = await Ingenico.getPayment(gatewayPaymentId, merchantId);
    const paymentObjRef = Ingenico.getCardPaymentData(paymentData.body.paymentOutput);
    if (paymentData.status !== 200)
      return Promise.resolve({
        status: 4004,
        statusCode: 'PAYMENT_NOT_FOUND',
        message: 'Cannot found this payment.',
      });
    if (paymentData.body.status === 'REDIRECTED')
      return Promise.resolve({
        status: 1002,
        statusCode: 'PAYMENT_IS_PENDING',
        message: 'This payment is in progress please try again soon.',
      });
    if (paymentData.body.status === 'IN_PROGRESS')
      return Promise.resolve({
        status: 1002,
        statusCode: 'PAYMENT_IS_IN_PROGRESS',
        message: 'This payment is in progress please try again soon.',
      });
    if (!paymentData.body.statusOutput.isAuthorized)
      return Promise.resolve({
        status: 4001,
        statusCode: 'PAYMENT_NOT_AUTHORIZED',
        message: 'This payment is in progress please try again soon.',
      });
    if (paymentData.body.statusOutput.statusCode !== 600 && paymentObjRef.cardType != 861)
      return Promise.resolve({
        status: 1100,
        statusCode: 'CARD_HAS_BEEN_REJECTED',
        message: 'This payment has been rejected.',
      });

    // Create payment only for NOT AAB bookings
    // (AAB bookings already have payment data)
    const bookingData = await Ingenico.app.models.Booking.findOne({ where: { id: bookingId } });
    const bookingMethodId = parseInt(bookingData.booking_method_id, 10);

    if (![3, 4, 5, 6].includes(bookingMethodId)) {
      // create new payment data
      const paymentBodyData = {
        payment_status_id: 1,
        payment_gateway_response: JSON.stringify(paymentData.body),
        external_transaction_id: paymentObjRef.payment,
        external_authorize_id: paymentData.body.id,
        external_charge_id: '',
        external_refund_id: '',
        booking_id: bookingId,
        payment_method_id: parseInt(paymentObjRef.paymentMethodId, 10),
        total: paymentObjRef.amount / 100,
        currency: paymentObjRef.currency,
      };

      await Ingenico.app.models.Payments.create(paymentBodyData);
    } else {
      // Update payment status to 1 -> will trigger booking status update
      const payment = await Ingenico.app.models.Payments.findOne({
        where: { booking_id: bookingId },
      });
      await payment.updateAttributes({
        payment_status_id: 1,
        payment_gateway_response: JSON.stringify(paymentData.body),
        external_transaction_id: paymentObjRef.payment,
        external_authorize_id: paymentData.body.id,
        payment_method_id: parseInt(paymentObjRef.paymentMethodId, 10),
        flag_update_state: paymentData.body.statusOutput.statusCode,
      });
      await bookingData.updateAttribute('booking_status_id', 1);
      await Ingenico.app.models.Charge.createChargeFromBooking(bookingId);
    }

    return Promise.resolve({ status: 1000, statusCode: 'PAID' });
  };

  Ingenico.remoteMethod('completePayment', {
    accepts: [
      { arg: 'gatewayPaymentId', type: 'string', description: 'gatewayPaymentId', required: true },
      { arg: 'merchantId', type: 'string', description: 'merchantId', required: true },
      { arg: 'refId', type: 'string', description: 'refId', required: true },
      { arg: 'bookingId', type: 'string', description: 'bookingId', required: true },
    ],
    returns: { type: 'object', root: true },
    http: { path: '/completePayment', verb: 'post' },
  });

  /*
  * this method use in payment creation (credit card)
  * we use this method to create token that use to encrypted data before sending back to api
  */
  Ingenico.createSession = async booking_id => {
    const Booking = Ingenico.app.models.Booking;
    const PaymentDetail = Ingenico.app.models.customerPaymentDetails;

    if (!booking_id) return Promise.reject('No booking id');

    try {
      const bookingData = await Booking.findOne({ where: { id: booking_id } });
      const customerPaymentDetails = await PaymentDetail.find({
        where: { user_id: bookingData.user_id, valid: true },
      });

      const responseBody = {};
      const savedPaymentList = [];
      customerPaymentDetails.forEach(element => {
        const cardTypeData = paymentMethodList.filter(
          paymentMethod => paymentMethod.id == element.card_type,
        );
        const tempPaymentList = {
          user_id: element.user_id,
          card_last_digits: element.card_last_digits,
          card_type: {
            id: cardTypeData[0].id,
            name: cardTypeData[0].displayHints.label,
          },
          card_name: element.card_name,
        };
        savedPaymentList.push(tempPaymentList);
      });
      responseBody.s_key = bookingData.access_token;
      responseBody.savedPaymentList = savedPaymentList;
      return Promise.resolve(responseBody);
    } catch (e) {
      return Promise.reject(e);
    }
  };
  Ingenico.remoteMethod('createSession', {
    accepts: [{ arg: 'booking_id', type: 'string', description: 'booking id', required: true }],
    returns: { type: 'object', root: true },
    http: { path: '/createSession', verb: 'post' },
  });

  /**
   * create payment method for credit card only
   * this method use token from create session method to decrypt data that send from our front end
   */
  Ingenico.createNewPayment = async (data, req, callback) => {
    // const save_card = !!data.save_card; ////use this for save cards
    const booking_id = data.booking_id;
    const payment_method_id = data.payment_method_id;
    const save_payment = data.save_payment;
    const Booking = Ingenico.app.models.Booking;
    // const PaymentDetail = Ingenico.app.models.customerPaymentDetails
    const UserCardData = Ingenico.app.models.UserCardData;
    const Payment = Ingenico.app.models.Payments;

    if (!booking_id) return Promise.reject('No booking id data');

    const bookingData = await Booking.findById(booking_id, {
      include: [{ relation: 'billingCountryIdFkeyrel' }, { relation: 'bookingUserIdFkeyrel' }],
    });

    const paymentIsAbleCreate = await Payment.isAbleCreate(booking_id);

    const resData = {
      theasia: 'better than now',
      id: 'ingenico',
    };

    if (!paymentIsAbleCreate) {
      const [createdPayment] = await Promise.all([Payment.find({ where: { booking_id } })]);
      // prevent flush database booking_id
      if (createdPayment.length > 0) {
        resData.status = 200;
        resData.success = true;
        resData.book = bookingData;
        resData.payment = createdPayment[0].external_transaction_id;
        resData.customer = createdPayment[0].external_transaction_id;
        resData.origin = paymentIsAbleCreate;
        resData.payment_code = 0;
        resData.message = 'The payment attempt was created.;';

        return Promise.resolve(resData);
      }
    }

    if (!bookingData) return Promise.reject('Not found booking data');

    if (!bookingData.total || bookingData.total == 0) return Promise.reject('empty total price');

    if (process.env.NODE_ENV == 'production') {
      // do it if booking_status_id property is undefined and not zero
      if (
        typeof bookingData.booking_status_id === 'undefined' ||
        parseInt(bookingData.booking_status_id, 10) != 0
      ) {
        return Promise.reject(`booking status id is not 0 bid: ${booking_id}`);
      }
    }

    // prepare json data for card type
    let cardType = 0;
    switch (parseInt(payment_method_id, 10)) {
      case 2:
        cardType = 1;
        break; // Credit Card
      case 3:
        cardType = 861;
        break; // Alipay
      case 4:
        cardType = 430;
        break; // UnionPay International
      case 5:
        cardType = 128;
        break; // Discover
      case 6:
        cardType = 132;
        break; // Diners Club
      default:
        break;
    }

    // check merchant id from cardtype
    let merchant;
    // if ((cardType == 128) || (cardType == 132)) merchant = '1771' // Diners Club
    if (cardType == 430) merchant = '1774';
    // UnionPay International
    else merchant = '1769';

    switch (bookingData.billingCountryIdFkeyrel().iso_code) {
      case 'IN':
      case 'ID':
      case 'JP':
      case 'KR':
      case 'VN':
        bookingData.total = Math.round(bookingData.total);
        break;
      default:
        break;
    }
    let cardholder_f = bookingData.billing_first_name;
    let cardholder_l = bookingData.billing_last_name;

    if (cardholder_f.length > 15) cardholder_f = bookingData.billing_first_name.substr(0, 15);
    if (cardholder_l.length > 70) cardholder_l = bookingData.billing_last_name.substr(0, 70);

    const dataObject = {
      order: {
        amountOfMoney: {
          currencyCode: bookingData.booking_currency_code,
          amount: Math.round(bookingData.total * 100),
        },
        customer: {
          merchantCustomerId: String(bookingData.user_id),
          personalInformation: {
            name: {
              title: '',
              firstName: cardholder_f,
              surnamePrefix: '',
              surname: cardholder_l,
            },
            gender: '',
            dateOfBirth: '',
          },
          companyInformation: {
            name: 'TheAsia Thai Co.,Ltd',
          },
          locale: 'en',
          billingAddress: {
            street: '',
            houseNumber: '',
            additionalInfo: '',
            zip: '',
            city: '',
            state: '',
            countryCode: bookingData.billingCountryIdFkeyrel().iso_code,
          },
          shippingAddress: {
            name: {
              title: '',
              firstName: cardholder_f,
              surname: cardholder_l,
            },
            street: '',
            houseNumber: '',
            additionalInfo: '',
            zip: '',
            city: '',
            state: '',
            countryCode: '',
          },
          contactDetails: {
            emailAddress: bookingData.bookingUserIdFkeyrel().email,

            phoneNumber: bookingData.billing_phone,
            faxNumber: '',
            emailMessageType: 'html',
          },
          vatNumber: '',
        },
      },
    };

    let cardDataFromFrontend = {};
    const encrypted_customer_input = data.encrypted_customer_input;
    const bytes = CryptoJS.AES.decrypt(encrypted_customer_input, bookingData.access_token, {
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    const decryptedCustomInput = bytes.toString(CryptoJS.enc.Utf8);
    cardDataFromFrontend = JSON.parse(decryptedCustomInput);
    cardDataFromFrontend.cardholderName = `${bookingData.billing_first_name} ${
      bookingData.billing_last_name
    }`;
    if (cardType < 400) {
      dataObject.cardPaymentMethodSpecificInput = {
        // authorizationMode: 'FINAL_AUTHORIZATION', // for capture full amount only
        authorizationMode: 'PRE_AUTHORIZATION', // for partial capture
        card: cardDataFromFrontend,
        skipAuthentication: false,
        requiresApproval: true,
        // token: token_customer_input,
      };

      // this line will check with allow save payment from frontend
      dataObject.cardPaymentMethodSpecificInput.tokenize = save_payment;
      // dataObject.cardPaymentMethodSpecificInput.tokenize = true

      if (cardType == 1) {
        const iinObject = {
          bin: cardDataFromFrontend.cardNumber.substring(0, 6),
        };
        const ingenicoIINDetail = await ingenicoHelper.getIINdetailsFromSDK(iinObject, merchant);
        dataObject.cardPaymentMethodSpecificInput.paymentProductId =
          ingenicoIINDetail.body.paymentProductId;
      }
    } else if (cardType > 400) {
      dataObject.redirectPaymentMethodSpecificInput = {
        paymentProductId: cardType,
        requiresApproval: true,
      };
    }
    const ingenicoCreatedRes = await ingenicoHelper.createPaymentFromSDK(dataObject, merchant);
    const ingenicoValidated = await validateResponseFromIngenico(
      ingenicoCreatedRes,
      booking_id,
      'CREATE_PAYMENT_INGENICO',
    );

    resData.status = 200;
    resData.success = ingenicoValidated.success;
    resData.book = bookingData;
    resData.payment = ingenicoValidated.paymentInformationData;
    resData.customer = ingenicoValidated.paymentInformationData;
    resData.origin = ingenicoValidated.originalBodyRes;
    resData.payment_code = ingenicoValidated.paymentCode;
    resData.message = ingenicoValidated.message;

    if (!resData.success) {
      return Promise.resolve(resData);
    }

    // this is for token saved flag
    if (dataObject.cardPaymentMethodSpecificInput.tokenize) {
      const user_id = bookingData.user_id;
      const randomTag = Math.random()
        .toString(36)
        .substring(2, 7);
      const last_four = cardDataFromFrontend.cardNumber.substring(
        cardDataFromFrontend.cardNumber.length - 4,
      );
      const alias = `${user_id}_${last_four}_${randomTag}`;

      const userCardDataBody = {
        user_id,
        token: ingenicoCreatedRes.body.creationOutput.token,
        last_four,
        valid: true,
        alias,
        card_type: dataObject.cardPaymentMethodSpecificInput.paymentProductId,
        default: false,
      };
      const dbUserCardData = await UserCardData.find({
        where: {
          last_four: cardDataFromFrontend.cardNumber.substring(
            cardDataFromFrontend.cardNumber.length - 4,
          ),
          user_id: bookingData.user_id,
        },
      });

      if (dbUserCardData.length > 0) {
        dbUserCardData[0].updateAttributes(userCardDataBody);
      } else {
        UserCardData.create(userCardDataBody);
      }
    }

    const bookingUpdatedData = await Booking.findById(booking_id);
    bookingUpdatedData.updateAttributes({ booking_status_id: 1 });

    resData.book = bookingUpdatedData;

    let payment_type = 'normal';
    payment_type =
      bookingUpdatedData.booking_method_id > 4
        ? 'Affiliate'
        : bookingUpdatedData.booking_method_id > 2
          ? 'AAB Payment'
          : 'normal';

    const finalResponseFromIngenico = await ingenicoHelper.getPaymentFromSDK(
      ingenicoValidated.originalBodyRes.payment.id,
      merchant,
    );
    const paymentBodyData = {
      payment_status_id: 1,
      payment_gateway_response: JSON.stringify(finalResponseFromIngenico.body),
      external_transaction_id: ingenicoValidated.paymentInformationData,
      external_authorize_id: ingenicoValidated.originalBodyRes.payment.id,
      external_charge_id: '',
      external_refund_id: '',
      booking_id,
      payment_method_id: parseInt(payment_method_id, 10),
      total: ingenicoValidated.originalBodyRes.payment.paymentOutput.amountOfMoney.amount / 100,
      currency: ingenicoValidated.originalBodyRes.payment.paymentOutput.amountOfMoney.currencyCode,
      external_reference_id: ingenicoValidated.originalBodyRes.payment.id.substring(10, 20),
      payment_type,
    };

    const paymentCreated = await Payment.create(paymentBodyData);
    if (paymentCreated) {
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'EXECUTE',
        2,
        `bid: ${booking_id}`,
        JSON.stringify(paymentCreated),
        'INGENICO',
        0,
      );
    } else {
      resData.success = false;
      resData.payment_code = 5000;
      resData.message = 'Api payment create has error';
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'CREATE_PAYMENT_FAIL',
        4,
        `bid: ${booking_id}`,
        resData,
        'INGENICO',
        5000,
      );
    }

    return Promise.resolve(resData);
  };

  Ingenico.remoteMethod('createNewPayment', {
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
    http: { path: '/createNewPayment', verb: 'post' },
  });

  /**
   * get response data from ingenico
   * use in payment update response cron
   */
  Ingenico.getPaymentData = async function(ingenicoPaymentId, merchantId, paymentStatus) {
    if (!ingenicoPaymentId)
      return Promise.resolve({ status: 404, message: 'No Ingenico payment id data' });
    if (!merchantId) return Promise.resolve({ status: 404, message: 'No merchant id data' });
    if (!paymentStatus)
      return Promise.resolve({ status: 404, message: 'No paymentStatus id data' });
    let resAwait;
    try {
      if (parseInt(paymentStatus, 10) === 4) {
        resAwait = await ingenicoHelper.getRefundFromSDK(ingenicoPaymentId, merchantId);
      } else {
        resAwait = await ingenicoHelper.getPaymentFromSDK(ingenicoPaymentId, merchantId);
      }
      return resAwait;
    } catch (err) {
      return resAwait;
    }
  };
  Ingenico.remoteMethod('getPaymentData', {
    accepts: [
      {
        arg: 'ingenicoPaymentId',
        type: 'string',
        description: 'ingenicoPaymentId',
        required: true,
      },
      { arg: 'merchantId', type: 'string', description: 'merchantId', required: true },
      { arg: 'paymentStatus', type: 'string', description: 'paymentStatus', required: true },
    ],
    returns: { arg: 'response', type: 'object', root: true },
  });

  /**
   * mainly get payment response data from ingenico
   * use in mostly api that connect with ingenico except update response cron
   */
  Ingenico.getPayment = async function(ingenicoPaymentId, merchantId) {
    if (!ingenicoPaymentId) return Promise.reject('No Ingenico payment id data');
    if (!merchantId) return Promise.reject('No merchant id data');

    try {
      const resAwait = await ingenicoHelper.getPaymentFromSDK(ingenicoPaymentId, merchantId);
      return Promise.resolve(resAwait);
    } catch (err) {
      return Promise.reject(err);
    }
  };
  Ingenico.remoteMethod('getPayment', {
    accepts: [
      {
        arg: 'ingenicoPaymentId',
        type: 'string',
        description: 'ingenicoPaymentId',
        required: true,
      },
      { arg: 'merchantId', type: 'string', description: 'merchantId', required: true },
    ],
    returns: { arg: 'response', type: 'object', root: true },
  });

  /**
   * Settle payment and booking
   * for safe we make this method intenal call from payments.approve only
   *
   */
  Ingenico.approvePayment = async function(data) {
    const Payment = Ingenico.app.models.Payments;
    if (!data.pid) return Promise.reject('No payment id data');
    if (!data.merchant) return Promise.reject('No merchant id data');
    if (!data.payment_id) return Promise.reject('No database payment id data');
    const responseData = {};

    try {
      const paymentCheckData = await Payment.findById(data.payment_id);
      switch (paymentCheckData.currency) {
        case 'INR':
        case 'IDR':
        case 'JPY':
        case 'KRW':
        case 'VND':
          data.amount = Math.round(data.amount);
          break;
        default:
          break;
      }

      const bodyPayment = {
        amount: parseInt(data.amount * 100, 10),
      };

      const paymentDataFromIngenico = await Ingenico.getPayment(
        paymentCheckData.external_authorize_id,
        data.merchant,
      );
      let responseFromApproveSDK = {};
      if (paymentDataFromIngenico.body.status === 'PENDING_APPROVAL') {
        responseFromApproveSDK = await ingenicoHelper.approvePaymentFromSDK(
          data.pid,
          data.merchant,
          bodyPayment,
        );
        // push log
        pushLogData(
          `${configHost.api_url}/PaymentLogs/`,
          'PAYMENT_LOG',
          'SETTLE',
          2,
          `pid: ${data.payment_id}`,
          responseFromApproveSDK,
          'INGENICO',
          0,
        );

        if (responseFromApproveSDK.status !== 200) {
          responseData.api = null;
          responseData.data = responseFromApproveSDK;
          responseData.status = 5000; // unsuccess payment status
          responseData.message = 'This payment fail while approve step. Please contact admin.';

          return Promise.resolve(responseData);
        }
      } else if (
        paymentDataFromIngenico.body.status !== 'PAID' &&
        paymentDataFromIngenico.body.status !== 'CAPTURED'
      ) {
        // do the other status thats not in this case
        responseData.api = null;
        responseData.data = responseFromApproveSDK;
        responseData.status = 5000; // unsuccess payment status
        responseData.message = 'Unknow status payment please contact admin';

        return Promise.resolve(responseData);
      }

      const finalResponseFromIngenico = await ingenicoHelper.getPaymentFromSDK(
        paymentCheckData.external_authorize_id,
        data.merchant,
      );
      // update payments data in db
      let paymentData = await Payment.findById(data.payment_id);
      await paymentData.updateAttributes({
        payment_status_id: 2,
        payment_gateway_response: JSON.stringify(finalResponseFromIngenico.body),
        total_charge: data.amount,
        final_amount:
          Number(finalResponseFromIngenico.body.paymentOutput.amountOfMoney.amount) / 100,
      });

      paymentData = await Payment.findById(data.payment_id);

      // push log
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'SETTLE',
        2,
        `Approve payment from pid: ${data.payment_id}`,
        paymentData,
        'INGENICO',
        0,
      );

      responseData.api = paymentData;
      responseData.data = responseFromApproveSDK;
      responseData.status = 1000; // success payment status

      return Promise.resolve(responseData);
    } catch (err) {
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'SETTLE',
        4,
        `pid: ${data.payment_id}`,
        err,
        'INGENICO',
        0,
      );
      responseData.status = 5000;
      responseData.message = 'Payment error please contact admin';
      return Promise.resolve(responseData);
    }
  };

  /**
   * cancelPayment function - only calla from payment model for sure
   * @param {*} payment_id
   */
  Ingenico.cancelPayment = async function(data) {
    const ingenicoId = data.pid;
    const merchant = data.merchant;
    const payment_id = data.payment_id;
    try {
      const paymentDataFromIngenico = await Ingenico.getPayment(ingenicoId, merchant);

      if (!paymentDataFromIngenico.body.statusOutput.isCancellable) {
        return Promise.resolve({
          api: {},
          data: paymentDataFromIngenico,
          message: 'This payment cannot cancel in this time. Please try again in 2 hours.',
          status: 5000,
        });
      }
      const resAwait = await ingenicoHelper.cancelPaymentFromSDK(ingenicoId, merchant);
      // logs
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'CANCEL',
        2,
        `pid: ${payment_id}`,
        resAwait,
        'INGENICO',
        0,
      );

      // update payments data in db
      const paymentData = await Ingenico.app.models.Payments.findById(payment_id);

      const finalResponseFromIngenico = await ingenicoHelper.getPaymentFromSDK(
        ingenicoId,
        merchant,
      );
      const paymentUpdatedData = await paymentData.updateAttributes({
        payment_status_id: 5,
        payment_gateway_response: JSON.stringify(finalResponseFromIngenico.body),
      });

      // push log
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_API',
        'CANCEL',
        2,
        `Status change 1->5 pid: ${payment_id}`,
        paymentUpdatedData,
        'INGENICO',
        0,
      );

      const responseData = {
        api: paymentUpdatedData,
        data: resAwait,
        status: 1000,
      };

      return Promise.resolve(responseData);
    } catch (err) {
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'CANCEL',
        4,
        `pid: ${payment_id}`,
        err,
        'INGENICO',
        0,
      );
      return Promise.reject(err);
    }
  };

  /**
   * cancelWithRefund function - only calla from payment model for sure
   * @param {*} payment_id
   */
  Ingenico.cancelWithRefund = async payment => {
    const responseData = {};
    try {
      // if (!payment) return Promise.reject(newLoopbackError(FORBIDDEN, 'PAYMENT_IS_NOT_FOUND'))
      const ingenicoId = payment.external_authorize_id;
      let merchant_id = config.merchantId;
      switch (parseInt(payment.payment_method_id, 10)) {
        case 2:
          merchant_id = '1769';
          break; // Credit Card
        case 3:
          merchant_id = '1769';
          break; // Alipay
        case 4:
          merchant_id = '1774';
          break; // UnionPay International
        // case 5: merchant_id = '1771'; break; // Discover
        // case 6: merchant_id = '1771'; break; // Diners Club
        default:
          break;
      }

      const ingenicoPaymentObject = await Ingenico.getPayment(ingenicoId, merchant_id);
      if (getSafe(() => ingenicoPaymentObject.body.statusOutput.isRefundable)) {
        // do refund
        let amount = payment.total;
        const currencyCode = payment.currency;
        switch (currencyCode) {
          case 'INR':
          case 'IDR':
          case 'JPY':
          case 'KRW':
          case 'VND':
            amount = Math.round(amount);
            break;
          default:
            break;
        }
        amount = parseInt(amount * 100, 10);

        const bodyRefund = {
          amountOfMoney: {
            amount,
            currencyCode,
          },
        };
        const refundResponse = await ingenicoHelper.createRefundFromSDK(
          ingenicoId,
          merchant_id,
          bodyRefund,
        );
        if (refundResponse.status !== 201) {
          responseData.api = null;
          responseData.data = refundResponse;
          responseData.status = 5000; // unsuccess payment status
          // const failedPaymentData = await Payment.findById(payment.id)
          // await failedPaymentData.updateAttributes({ payment_status_id: 3 })

          return Promise.resolve(responseData);
        }
        const finalResponseFromIngenico = await Ingenico.getPaymentData(
          refundResponse.body.id,
          merchant_id,
          4,
        );
        // update payments data in db
        const paymentData = await Ingenico.app.models.Payments.findById(payment.id);

        const paymentUpdatedData = await paymentData.updateAttributes({
          payment_status_id: 5,
          payment_gateway_response: JSON.stringify(finalResponseFromIngenico.body),
        });

        // push log
        pushLogData(
          `${configHost.api_url}/PaymentLogs/`,
          'PAYMENT_API',
          'CANCEL',
          2,
          `Status change 1->5 pid: ${payment.id}`,
          paymentUpdatedData,
          'INGENICO',
          0,
        );

        responseData.api = refundPayment;
        responseData.data = refundResponse;
        responseData.status = 1000; // success payment status
        return Promise.resolve(responseData);
      }
      return Promise.resolve({
        status: 5000,
        message:
          ' payment status is non cancellable. please re-check againg or try again in 2 hour ',
      });
      // return Promise.reject(newLoopbackError(BAD_REQUEST, 'UNCANCELABLE', 'payment status is uncancelable please re-check againg or try again in 2 hour'))
    } catch (error) {
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'CREATE REFUND ERROR',
        4,
        `pid: ${payment.id}`,
        error,
        'INGENICO',
        500,
      );
      // console.log('Error Paypal.refund', error)
      responseData.status = 5000;
      return Promise.reject(responseData);
      // console.log('Error Ingenico.refund', error)
      // return Promise.reject(error)
    }
  };

  /**
   * Refund function - only calla from payment model for sure
   * @param {*} payment_id
   * @param {*} refund_amount
   * @param {*} currencyCode
   */
  Ingenico.refund = async (payment, refund_amount, currencyCode) => {
    const Payment = Ingenico.app.models.Payments;
    const responseData = {};
    try {
      if (!payment) return Promise.reject(newLoopbackError(FORBIDDEN, 'PAYMENT_IS_NOT_FOUND'));
      const ingenicoId = payment.external_authorize_id;
      let merchant_id = config.merchantId;
      switch (parseInt(payment.payment_method_id, 10)) {
        case 2:
          merchant_id = '1769';
          break; // Credit Card
        case 3:
          merchant_id = '1769';
          break; // Alipay
        case 4:
          merchant_id = '1774';
          break; // UnionPay International
        // case 5: merchant_id = '1771'; break; // Discover
        // case 6: merchant_id = '1771'; break; // Diners Club
        default:
          break;
      }

      const ingenicoPaymentObject = await Ingenico.getPayment(ingenicoId, merchant_id);
      if (getSafe(() => ingenicoPaymentObject.body.statusOutput.isRefundable)) {
        // do refund
        let amount = refund_amount;
        switch (currencyCode) {
          case 'INR':
          case 'IDR':
          case 'JPY':
          case 'KRW':
          case 'VND':
            amount = Math.round(amount);
            break;
          default:
            break;
        }
        amount = parseInt(amount * 100, 10);

        const bodyRefund = {
          amountOfMoney: {
            amount,
            currencyCode,
          },
        };
        const refundResponse = await ingenicoHelper.createRefundFromSDK(
          ingenicoId,
          merchant_id,
          bodyRefund,
        );
        if (refundResponse.status !== 201) {
          responseData.api = null;
          responseData.data = refundResponse;
          responseData.status = 5000; // unsuccess payment status
          pushLogData(
            `${configHost.api_url}/PaymentLogs/`,
            'PAYMENT_API',
            'FAILED REFUND',
            4,
            `FAILED refund payment pid: ${payment.id}`,
            refundResponse,
            'INGENICO',
            0,
          );
          // const failedPaymentData = await Payment.findById(payment.id)
          // await failedPaymentData.updateAttributes({ payment_status_id: 3 })

          return Promise.resolve(responseData);
        }
        const finalResponseFromIngenico = await Ingenico.getPaymentData(
          refundResponse.body.id,
          merchant_id,
          4,
        );
        // const finalResponseFromIngenico = await ingenicoHelper.getPaymentFromSDK(ingenicoId, merchant_id)

        const paymentBodyData = {
          payment_status_id: 4,
          payment_gateway_response: JSON.stringify(finalResponseFromIngenico.body),
          external_transaction_id: payment.external_transaction_id,
          external_authorize_id: payment.external_authorize_id,
          external_charge_id: '',
          external_refund_id: refundResponse.body.id,
          booking_id: payment.booking_id,
          payment_method_id: parseInt(payment.payment_method_id, 10),
          total: 0,
          total_refund: refund_amount,
          currency: currencyCode,
          final_amount:
            Number(finalResponseFromIngenico.body.refundOutput.amountOfMoney.amount) / 100,
          external_reference_id: refundResponse.body.id,
        };
        const refundPayment = await Payment.create(paymentBodyData);
        pushLogData(
          `${configHost.api_url}/PaymentLogs/`,
          'PAYMENT_API',
          'REFUND',
          2,
          `Create refund payment pid: ${refundPayment.id}`,
          refundPayment,
          'INGENICO',
          0,
        );

        responseData.api = refundPayment;
        responseData.data = refundResponse;
        responseData.status = 1000; // success payment status
        return Promise.resolve(responseData);
      }
      return Promise.reject(
        newLoopbackError(
          BAD_REQUEST,
          'UNREFUNDABLE',
          'payment status is unrefundable please re-check again or try again in 2 hour',
        ),
      );
    } catch (error) {
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'CREATE REFUND ERROR',
        4,
        `pid: ${payment.id}`,
        error,
        'INGENICO',
        500,
      );
      responseData.status = 5000;
      return Promise.reject(responseData);
    }
  };

  /*
  * Debug tool method
  * this method in this section we call directly from explorer to find payment data
  */

  Ingenico.findPayment = async (merchantOrderId, merchantId) => {
    const paymentData = await ingenicoHelper.findPaymentsFromSDK(merchantOrderId, merchantId);
    return Promise.resolve(paymentData);
  };

  Ingenico.remoteMethod('findPayment', {
    accepts: [
      { arg: 'merchantOrderId', type: 'string', description: 'merchantOrderId', required: true },
      { arg: 'merchantId', type: 'string', description: 'merchantId', required: true },
    ],
    returns: { type: 'object', root: true },
    http: { path: '/findPayment', verb: 'post' },
  });

  Ingenico.getCheckouts = async function(data, req, callback) {
    if (!data.checkout) return Promise.reject('No checkout id data');
    if (!data.merchant) return Promise.reject('No merchant id data');
    try {
      const resAwait = await ingenicoHelper.getHostedCheckoutsFromSDK(data.checkout, data.merchant);
      return Promise.resolve(resAwait);
    } catch (err) {
      return Promise.reject(err);
    }
  };
  Ingenico.remoteMethod('getCheckouts', {
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
  Ingenico.getRefund = async function(rid, merchant) {
    if (!rid) return Promise.reject('No refund id data');
    if (!merchant) return Promise.reject('No merchant id data');

    try {
      const resAwait = await ingenicoHelper.getRefundFromSDK(rid, merchant);

      return Promise.resolve(resAwait);
    } catch (err) {
      return Promise.reject(err);
    }
  };
  Ingenico.remoteMethod('getRefund', {
    accepts: [
      { arg: 'rid', type: 'String', required: true },
      { arg: 'merchant', type: 'String', required: true },
    ],
    returns: { arg: 'response', type: 'object', root: true },
  });

  /*
  * future feature 
  * may be use in the future
  * 
  * */
  Ingenico.remoteMethod('createPaymentFromTokenWithoutEncrypt', {
    accepts: [
      {
        arg: 'payment_method_id',
        type: 'string',
        description: 'payment method id',
        required: true,
      },
      { arg: 'booking_id', type: 'string', description: 'booking id', required: true },
      {
        arg: 'encrypted_customer_input',
        type: 'string',
        description:
          'this field is json object {"cardNumber":"xxxx", "cvv":"xxx"} and do not forgot to encrypted data before send to api',
        required: true,
      },
    ],
    returns: { type: 'object', root: true },
    http: { path: '/createPaymentFromTokenWithoutEncrypt', verb: 'post' },
  });

  Ingenico.remoteMethod('createPaymentFromToken', {
    accepts: [
      {
        arg: 'payment_method_id',
        type: 'string',
        description: 'payment method id',
        required: true,
      },
      { arg: 'booking_id', type: 'string', description: 'booking id', required: true },
      {
        arg: 'encrypted_customer_input',
        type: 'string',
        description:
          'this field is json object {"cardNumber":"xxxx", "cvv":"xxx"} and do not forgot to encrypted data before send to api',
        required: true,
      },
    ],
    returns: { type: 'object', root: true },
    http: { path: '/createPaymentFromToken', verb: 'post' },
  });

  Ingenico.remoteMethod('saveCardToken', {
    accepts: [
      { arg: 'cardWithoutCvv', type: 'object', description: 'card with out cvv', require: true },
      { arg: 'customer', type: 'object', description: 'customer information', require: true },
      {
        arg: 'alias',
        type: 'string',
        description: 'An alias for the token. This can be used to visually represent the token.',
      },
    ],
    returns: { type: 'object', root: true },
    http: { path: '/saveCardToken', verb: 'post' },
  });

  Ingenico.saveCardToken = async (cardWithoutCvv, customer, alias) => {
    try {
      const payloadObj = {
        card: {
          customer,
          data: { cardWithoutCvv },
          alias,
        },
      };

      const iinObject = {
        bin: cardWithoutCvv.cardNumber.substring(0, 6),
      };
      const ingenicoIINDetail = await ingenicoHelper.getIINdetailsFromSDK(iinObject, 1769);
      payloadObj.paymentProductId = ingenicoIINDetail.body.paymentProductId;

      let merchant = config.merchantId;

      switch (parseInt(payloadObj.paymentProductId, 10)) {
        case 1:
          merchant = 1769;
          break; // Credit Card
        case 861:
          merchant = 1769;
          break; // Alipay
        case 430:
          merchant = 1774;
          break; // UnionPay International
        default:
          break;
      }

      const responseToken = await ingenicoHelper.createTokenFromSDK(payloadObj, merchant);

      return Promise.resolve(responseToken);
    } catch (err) {
      return Promise.reject(err);
    }
  };

  Ingenico.createPaymentFromToken = async (
    payment_method_id,
    booking_id,
    encrypted_customer_input,
  ) => {
    const Booking = Ingenico.app.models.Booking;
    // const PaymentDetail = Ingenico.app.models.customerPaymentDetails
    const UserCardData = Ingenico.app.models.UserCardData;
    const Payment = Ingenico.app.models.Payments;

    const bookingData = await Booking.findById(booking_id, {
      include: [{ relation: 'billingCountryIdFkeyrel' }, { relation: 'bookingUserIdFkeyrel' }],
    });

    const paymentIsAbleCreate = await Payment.isAbleCreate(booking_id);

    const resData = {
      theasia: 'better than now',
      id: 'ingenico',
      status: 200,
    };

    if (!paymentIsAbleCreate) {
      const [createdPayment] = await Promise.all([Payment.find({ where: { booking_id } })]);
      // prevent flush database booking_id
      if (createdPayment.length > 0) {
        resData.status = 200;
        resData.success = true;
        resData.book = bookingData;
        resData.payment = createdPayment[0].external_transaction_id;
        resData.customer = createdPayment[0].external_transaction_id;
        resData.origin = paymentIsAbleCreate;
        resData.payment_code = 0;
        resData.message = 'The payment attempt was created.;';

        return Promise.resolve(resData);
      }
    }
    if (!bookingData) return Promise.reject('Not found booking data');

    if (!bookingData.total || bookingData.total == 0) return Promise.reject('empty total price');

    if (process.env.NODE_ENV == 'production') {
      // do it if booking_status_id property is undefined and not zero
      if (
        typeof bookingData.booking_status_id === 'undefined' ||
        parseInt(bookingData.booking_status_id, 10) != 0
      ) {
        return Promise.reject(`booking status id is not 0 bid: ${booking_id}`);
      }
    }

    let cardType;
    switch (parseInt(payment_method_id, 10)) {
      case 2:
        cardType = 1;
        break; // Credit Card
      case 3:
        cardType = 861;
        break; // Alipay
      case 4:
        cardType = 430;
        break; // UnionPay International
      case 5:
        cardType = 128;
        break; // Discover
      case 6:
        cardType = 132;
        break; // Diners Club
      default:
        break;
    }
    // check merchant id from cardtype
    let merchant;
    // if ((cardType == 128) || (cardType == 132)) merchant = '1771'
    if (cardType == 430) merchant = '1774';
    else merchant = '1769';

    // round total for some currency
    switch (bookingData.billingCountryIdFkeyrel().iso_code) {
      case 'IN':
      case 'ID':
      case 'JP':
      case 'KR':
      case 'VN':
        bookingData.total = Math.round(bookingData.total);
        break;
      default:
        break;
    }

    // we will decrypt customer data here
    const bytes = CryptoJS.AES.decrypt(encrypted_customer_input, bookingData.access_token, {
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    const decryptedCustomInput = bytes.toString(CryptoJS.enc.Utf8);
    const jsonDecryptedCustomInput = JSON.parse(decryptedCustomInput);

    const savedCardData = await UserCardData.findById(jsonDecryptedCustomInput.cardNumber);

    const cardDataFromFrontend = {
      cvv: jsonDecryptedCustomInput.cvv,
      expiryDate: jsonDecryptedCustomInput.expiryDate,
    };

    const ingenicoCreatePaymentObject = {
      order: {
        amountOfMoney: {
          currencyCode: bookingData.booking_currency_code,
          amount: Math.round(bookingData.total * 100),
        },
      },
      cardPaymentMethodSpecificInput: {
        // authorizationMode: 'FINAL_AUTHORIZATION', // for capture full amount only
        authorizationMode: 'PRE_AUTHORIZATION', // for partial capture
        card: cardDataFromFrontend,
        skipAuthentication: false,
        requiresApproval: true,
        token: savedCardData.token,
      },
    };

    const ingenicoCreatedPayment = await ingenicoHelper.createPaymentFromSDK(
      ingenicoCreatePaymentObject,
      merchant,
    );
    const ingenicoValidated = await validateResponseFromIngenico(
      ingenicoCreatedPayment,
      booking_id,
      'CREATE_PAYMENT_TOKEN_INGENICO',
    );

    resData.status = 200;
    resData.success = ingenicoValidated.success;
    resData.book = bookingData;
    resData.payment = ingenicoValidated.paymentInformationData;
    resData.customer = ingenicoValidated.paymentInformationData;
    resData.origin = ingenicoValidated.originalBodyRes;
    resData.payment_code = ingenicoValidated.paymentCode;
    resData.message = ingenicoValidated.message;

    if (!resData.success) {
      return Promise.resolve(resData);
    }

    const bookingUpdatedData = await Booking.findById(booking_id);
    bookingUpdatedData.updateAttributes({ booking_status_id: 1 });

    resData.book = bookingUpdatedData;

    const finalResponseFromIngenico = await ingenicoHelper.getPaymentFromSDK(
      ingenicoValidated.originalBodyRes.payment.id,
      merchant,
    );
    const paymentBodyData = {
      payment_status_id: 1,
      payment_gateway_response: JSON.stringify(finalResponseFromIngenico.body),
      external_transaction_id: ingenicoValidated.paymentInformationData,
      external_authorize_id: ingenicoValidated.originalBodyRes.payment.id,
      external_charge_id: '',
      external_refund_id: '',
      booking_id,
      payment_method_id: parseInt(payment_method_id, 10),
      total: ingenicoValidated.originalBodyRes.payment.paymentOutput.amountOfMoney.amount / 100,
      currency: ingenicoValidated.originalBodyRes.payment.paymentOutput.amountOfMoney.currencyCode,
      external_reference_id: ingenicoValidated.originalBodyRes.payment.id.substring(10, 20),
    };

    const paymentCreated = await Payment.create(paymentBodyData);
    if (paymentCreated) {
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'CREATE_PAYMENT_BY_TOKEN',
        2,
        `bid: ${booking_id}`,
        JSON.stringify(paymentCreated),
        'INGENICO',
        0,
      );
    } else {
      resData.payment = false;
      resData.customer = 5000;
      resData.message = 'Api payment create has error';
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'CREATE_PAYMENT_BY_TOKEN_FAIL',
        4,
        `bid: ${booking_id}`,
        resData,
        'INGENICO',
        5000,
      );
    }

    return Promise.resolve(resData);
  };
  Ingenico.createPaymentFromTokenWithoutEncrypt = async (
    payment_method_id,
    booking_id,
    encrypted_customer_input,
  ) => {
    const Booking = Ingenico.app.models.Booking;
    const PaymentDetail = Ingenico.app.models.customerPaymentDetails;
    const Payment = Ingenico.app.models.Payments;

    const bookingData = await Booking.findById(booking_id, {
      include: [{ relation: 'billingCountryIdFkeyrel' }, { relation: 'bookingUserIdFkeyrel' }],
    });

    const paymentIsAbleCreate = await Payment.isAbleCreate(booking_id);

    const resData = {
      theasia: 'better than now',
      id: 'ingenico',
      status: 200,
    };

    if (!paymentIsAbleCreate) {
      const [createdPayment] = await Promise.all([Payment.find({ where: { booking_id } })]);
      // prevent flush database booking_id
      if (createdPayment.length > 0) {
        resData.status = 200;
        resData.success = true;
        resData.book = bookingData;
        resData.payment = createdPayment[0].external_transaction_id;
        resData.customer = createdPayment[0].external_transaction_id;
        resData.origin = paymentIsAbleCreate;
        resData.payment_code = 0;
        resData.message = 'The payment attempt was created.;';

        return Promise.resolve(resData);
      }
    }
    if (!bookingData) return Promise.reject('Not found booking data');

    if (!bookingData.total || bookingData.total == 0) return Promise.reject('empty total price');

    if (process.env.NODE_ENV == 'production') {
      // do it if booking_status_id property is undefined and not zero
      if (
        typeof bookingData.booking_status_id === 'undefined' ||
        parseInt(bookingData.booking_status_id, 10) != 0
      ) {
        return Promise.reject(`booking status id is not 0 bid: ${booking_id}`);
      }
    }

    let cardType;
    switch (parseInt(payment_method_id, 10)) {
      case 2:
        cardType = 1;
        break; // Credit Card
      case 3:
        cardType = 861;
        break; // Alipay
      case 4:
        cardType = 430;
        break; // UnionPay International
      case 5:
        cardType = 128;
        break; // Discover
      case 6:
        cardType = 132;
        break; // Diners Club
      default:
        break;
    }
    // check merchant id from cardtype
    let merchant;
    // if ((cardType == 128) || (cardType == 132)) merchant = '1771'
    if (cardType == 430) merchant = '1774';
    else merchant = '1769';

    // set locale
    const locale = 'en_GB';
    // round total for some currency
    switch (bookingData.billingCountryIdFkeyrel().iso_code) {
      case 'IN':
      case 'ID':
      case 'JP':
      case 'KR':
      case 'VN':
        bookingData.total = Math.round(bookingData.total);
        break;
      default:
        break;
    }

    const jsonDecryptedCustomInput = JSON.parse(encrypted_customer_input);

    const paymentDetailData = await PaymentDetail.find({
      where: {
        card_last_digits: jsonDecryptedCustomInput.cardNumber,
        user_id: bookingData.user_id,
      },
    });

    const cardDataFromFrontend = {
      cvv: jsonDecryptedCustomInput.cvv,
      expiryDate: paymentDetailData[0].expiry_date,
    };

    const ingenicoCreatePaymentObject = {
      order: {
        amountOfMoney: {
          currencyCode: bookingData.booking_currency_code,
          amount: Math.round(bookingData.total * 100),
        },
      },
      cardPaymentMethodSpecificInput: {
        // authorizationMode: 'FINAL_AUTHORIZATION', // for capture full amount only
        authorizationMode: 'PRE_AUTHORIZATION', // for partial capture
        card: cardDataFromFrontend,
        skipAuthentication: false,
        requiresApproval: true,
        token: paymentDetailData[0].token,
      },
    };

    const ingenicoCreatedPayment = await ingenicoHelper.createPaymentFromSDK(
      ingenicoCreatePaymentObject,
      merchant,
    );
    const ingenicoValidated = await validateResponseFromIngenico(
      ingenicoCreatedPayment,
      booking_id,
      'CREATE_PAYMENT_TOKEN_INGENICO',
    );

    resData.status = 200;
    resData.success = ingenicoValidated.success;
    resData.book = bookingData;
    resData.payment = ingenicoValidated.paymentInformationData;
    resData.customer = ingenicoValidated.paymentInformationData;
    resData.origin = ingenicoValidated.originalBodyRes;
    resData.payment_code = ingenicoValidated.paymentCode;
    resData.message = ingenicoValidated.message;

    if (!resData.success) {
      return Promise.resolve(resData);
    }

    const bookingUpdatedData = await Booking.findById(booking_id);
    bookingUpdatedData.updateAttributes({ booking_status_id: 1 });

    resData.book = bookingUpdatedData;

    const paymentBodyData = {
      payment_status_id: 1,
      payment_gateway_response: JSON.stringify(ingenicoValidated.originalBodyRes),
      external_transaction_id: ingenicoValidated.paymentInformationData,
      external_authorize_id: ingenicoValidated.originalBodyRes.payment.id,
      external_charge_id: '',
      external_refund_id: '',
      booking_id,
      payment_method_id: parseInt(payment_method_id, 10),
      total: ingenicoValidated.originalBodyRes.payment.paymentOutput.amountOfMoney.amount / 100,
      currency: ingenicoValidated.originalBodyRes.payment.paymentOutput.amountOfMoney.currencyCode,
    };

    const paymentCreated = await Payment.create(paymentBodyData);

    if (paymentCreated) {
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'CREATE_PAYMENT_BY_TOKEN',
        2,
        `bid: ${booking_id}`,
        JSON.stringify(paymentCreated),
        'INGENICO',
        0,
      );
    } else {
      resData.payment = false;
      resData.customer = 5000;
      resData.message = 'Api payment create has error';
      pushLogData(
        `${configHost.api_url}/PaymentLogs/`,
        'PAYMENT_LOG',
        'CREATE_PAYMENT_BY_TOKEN_FAIL',
        4,
        `bid: ${booking_id}`,
        resData,
        'INGENICO',
        5000,
      );
    }

    return Promise.resolve(resData);
  };
};
