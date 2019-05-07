class ErrorResponse extends Error {
  constructor(error) {
    super(error);
    this.message = JSON.stringify({
      name: error.name,
      code: error.statusCode,
      message: error.message,
      details: error.details && error.details.messages ? error.details.messages : '',
    });
  }
}
module.exports = ErrorResponse;
