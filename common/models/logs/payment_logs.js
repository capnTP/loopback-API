module.exports = function (PaymentLogs) {
  PaymentLogs.pushLog = (type, source, severity, message, response, model_name, status_code) => {
    const logPostData = {
      type,
      source,
      severity,
      message,
      response: JSON.stringify(response),
      model_name,
      status_code,
    }
    PaymentLogs.create(logPostData)
  }
};
