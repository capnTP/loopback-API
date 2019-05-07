/* eslint-disable */
module.exports = function (Model) {
  Model.afterRemoteError('**', (ctx, next) => {
    if (!ctx.error.details) ctx.error.details = {};
    const PaymentLogs = Model.app.models.PaymentLogs;
    let error = JSON.stringify(ctx.error),
      data = {
        type: ctx.error.name,
        source: 'Internal',
        message: ctx.error.message,
        severity: 4,
        response: error,
        model_name: ctx.error.details.context,
        status_code: ctx.error.statusCode,
      };
    PaymentLogs.create(data, (e, r) => {
      console.log('payment error logs created successfully', e)
    })
    next();
  })
}
