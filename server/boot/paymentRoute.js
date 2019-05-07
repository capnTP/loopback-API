const axios = require('axios');
const hostConfig = require('../config/config.json');

let configHost
if (process.env.NODE_ENV == 'production') {
  configHost = hostConfig.production
} else if (process.env.NODE_ENV == 'development') {
  configHost = hostConfig.development
} else {
  configHost = hostConfig.local
}

/**
 * This endpoint for ingenico callback and we will remove it after website use new checkout api
 */
module.exports = function (router) {
  router.get('/ingenico_callback', async (req, res) => {
    const merchantId = req.query.mchd;
    const hostedCheckoutId = req.query.hostedCheckoutId;

    const checkoutBodyData = {
      merchant: merchantId,
      checkout: hostedCheckoutId,
    };

    const checkoutRespose = await axios.post(`${configHost.api_url}/Ingenicos/getCheckouts`, checkoutBodyData);
    const checkoutData = checkoutRespose.data;

    if (checkoutData.status == 200) {
      const replyData = {};
      let card_type;
      let payment;
      const status_code = checkoutData.body.createdPaymentOutput.payment.statusOutput.statusCode;
      // in production we send booking id to ref with ingenico but on our dev we send unix timestamp.
      // then we can get booking_id by extract data in merchantReference field
      let bid = checkoutData.body.createdPaymentOutput.payment.paymentOutput.references.merchantOrderId;
      if (process.env.NODE_ENV !== 'production') {
        bid = checkoutData.body.createdPaymentOutput.payment.paymentOutput.references.merchantReference.replace('1800', '');
      }

      replyData.status = 200;
      if (checkoutData.body.createdPaymentOutput.payment.paymentOutput.paymentMethod == 'card') {
        payment = checkoutData.body.createdPaymentOutput.payment.paymentOutput.cardPaymentMethodSpecificOutput.card.cardNumber;
        card_type = checkoutData.body.createdPaymentOutput.payment.paymentOutput.cardPaymentMethodSpecificOutput.paymentProductId;
        replyData.redirect_type = false;
      } else if (checkoutData.body.createdPaymentOutput.payment.paymentOutput.paymentMethod == 'redirect') {
        card_type = checkoutData.body.createdPaymentOutput.payment.paymentOutput.redirectPaymentMethodSpecificOutput.paymentProductId;
        if (card_type == 840) { // PayPal
          payment = checkoutData.body.createdPaymentOutput.payment.paymentOutput.redirectPaymentMethodSpecificOutput.paymentProduct840SpecificOutput.customerAccount.accountId;
        } else if (card_type == 430) {
          payment = 'UnionPay';
        } else if (card_type == 861) {
          payment = 'Alipay';
        }
        replyData.redirect_type = true;
      }
      if ((checkoutData.body.status) && (checkoutData.body.status == 'IN_PROGRESS')) {
        replyData.status = 500;
        replyData.message = 'This payment is in progress';
      } else if (status_code != 600 && card_type != 861) {
        if (status_code == 100) {
          replyData.status = 422;
          replyData.message = 'Your card has been reject. Please try another card';
        } else {
          replyData.status = 422;
          replyData.message = 'Your card has been reject. Please try another card!!: '.status_code;
        }
      } else {
        let payment_method_id = 2;
        const pid = checkoutData.body.createdPaymentOutput.payment.id;


        switch (card_type) {
          case 861:
            payment_method_id = 3;
            break;
          case 430:
            payment_method_id = 4;
            break;
          case 128:
            payment_method_id = 5;
            break;
          case 132:
            payment_method_id = 6;
            break;
          default:
            break;
        }

        const finalBodyData = {
          merchantId: merchantId,
          ingenicoPaymentId: pid,
        };
        const finalResponseFromIngenico = (await axios.post(`${configHost.api_url}/Ingenicos/getPayment`, finalBodyData)).data;
        console.log(finalResponseFromIngenico)
        const paymentBodyData = {
          payment_status_id: 1,
          payment_gateway_response: JSON.stringify(finalResponseFromIngenico.body),
          external_transaction_id: payment,
          external_authorize_id: pid,
          external_charge_id: '',
          external_refund_id: '',
          booking_id: bid,
          payment_method_id: parseInt(payment_method_id, 10),
          total: checkoutData.body.createdPaymentOutput.payment.paymentOutput.amountOfMoney.amount / 100,
          currency: checkoutData.body.createdPaymentOutput.payment.paymentOutput.amountOfMoney.currencyCode,
          external_reference_id: pid.substring(10,20),
        }

        const paymentResponse = await axios.post(`${configHost.api_url}/Payments/`, paymentBodyData);
        const paymentData = paymentResponse.data;

        if ((paymentData.id) && (paymentData.external_authorize_id == pid)) {
          replyData.paymentData = payment;
          const bookingResponse = await axios.get(`${configHost.api_url}/Bookings/${bid}`);
          const bookingData = bookingResponse.data;

          replyData.bookingData = bookingData;
        } else {
          replyData.status = 500;
          replyData.message = 'Api payment create has error';
        }
      }
      replyData.origin = checkoutData;
      // Logs here before render
      const logPostData = {
        type: 'PAYMENT_LOG',
        source: 'POST',
        severity: 2,
        message: `bid: ${bid}`,
        response: JSON.stringify(replyData),
        model_name: 'INGENICO',
        status_code: 0,
      }
      axios.post(`${configHost.api_url}/PaymentLogs/`, logPostData);

      res.setHeader('X-FRAME-OPTIONS', `ALLOW-FROM ${configHost.web_url}`);
      res.setHeader('Access-Control-Allow-Origin', '*');
      // res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.render('ingenico/ingenico_callback.ejs', {
        data: replyData
      });
    } else {
      const errRes = {
        status: 600,
        merchant: merchantId,
        message: 'cannot get checkouts',
        origin: checkoutData,
      }

      // will render this page when payment is not accepeted or something else from response status 400+
      res.render('ingenico/ingenico_reject.ejs', {
        query: req.query.mchd
      });
    }
  });
}
