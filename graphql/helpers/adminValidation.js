const { AuthenticationError, ApolloError } = require('apollo-server-express');

const { getSafe } = require('../../common/utility');

/**
 * Modifies error message to 'Unauthorized' if failed Users.onlyAdminValidation
 * Will help clients (CMS/Affiliates/Suppliers) to logout user
 * @param {AxiosError} error Error from axios
 * @throws {ApolloError} returns same error
 */
function adminValidation(error) {
  const errorMessage = getSafe(() => error.response.data.error.message);
  const unathorizedMessage = 'Unauthorized';
  const onlyAdminErrorMessage = 'Unauthorized';
  if (errorMessage === onlyAdminErrorMessage) {
    // error.message = unathorizedMessage;
    // error.statusCode = 401;
    throw new AuthenticationError(unathorizedMessage);
  }
  throw new ApolloError(error.message);
}

module.exports = adminValidation;
