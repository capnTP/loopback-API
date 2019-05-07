const _ = require('lodash');
const request = require('request');

let SLACK_URL =
  process.env.NODE_ENV == 'production'
    ? 'https://hooks.slack.com/services/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'
    : 'https://hooks.slack.com/services/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';
// override with env's url
SLACK_URL = process.env.SLACK_URL || SLACK_URL;

module.exports = PaymentNotComplete => {
  const sendSlackHook = (isSuccess, attachmentsData) => {
    const payload = {
      text: `Payments completed`,
      username: 'TheAsia.com | Payment Bot',
      icon_emoji: ':heavy_dollar_sign:',
      attachments: attachmentsData,
    };
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
      console.log('Payments complete');
    });
  };
  /**
   * this method call from cron to complete payment that not complete in normal step
   * right now for aab booking and will support normal booking soon
   */
  PaymentNotComplete.callFromCron = async () => {
    try {
      const notCompleteList = await PaymentNotComplete.find();
      if (notCompleteList.length > 0) {
        _.each(notCompleteList, async obj => {
          const paymentData = await PaymentNotComplete.app.models.Payments.findOne({
            where: { id: obj.payment_id },
          });
          if (parseInt(paymentData.payment_status_id, 10) > 1) {
            await PaymentNotComplete.destroyById(obj.id);
          } else {
            const hostcheckoutStatusData = await PaymentNotComplete.app.models.Payments.hostedCheckoutStatus(
              null,
              null,
              obj.external_reference_id,
              obj.payment_method_id,
              paymentData.uuid,
            );
            if (
              hostcheckoutStatusData.gateway.status === 200 &&
              hostcheckoutStatusData.gateway.body.status === 'PAYMENT_CREATED' &&
              hostcheckoutStatusData.gateway.body.createdPaymentOutput.paymentStatusCategory ===
                'SUCCESSFUL'
            ) {
              sendSlackHook(true, [
                {
                  title: `Details (${
                    process.env.NODE_ENV == 'production' ? 'production' : 'development'
                  })`,
                  fields: [{ title: 'Payment ID', value: obj.payment_id }],
                },
              ]);
              await PaymentNotComplete.destroyById(obj.id);
            } else {
              const count_check = parseInt(obj.count_check, 10) + 1;
              if (count_check >= 10) {
                await PaymentNotComplete.destroyById(obj.id);
              } else {
                await obj.updateAttribute('count_check', count_check);
              }
            }
          }
        });
        return Promise.resolve();
      }
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  };

  PaymentNotComplete.remoteMethod('callFromCron', {
    accepts: [],
    returns: { type: 'object', root: true },
    http: { path: '/callFromCron', verb: 'post' },
  });
};
