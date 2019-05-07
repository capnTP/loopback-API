class ErrorResponse extends Error {
  constructor(error) {
    super(error);
    this.message = JSON.stringify({
      name: error.name,
      // can't controll error 500 on react-apollo
      // Issue - https://github.com/apollographql/react-apollo/issues/615
      code: error.statusCode === 500 ? 404 : error.statusCode,
      message: error.message,
      details: error.details ? error.details.messages : {},
    });
  }
}
module.exports = ErrorResponse;
