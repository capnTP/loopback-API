const axios = require('axios')

const { THE_ASIA_API } = require('../../../config')

const GraphQLDefinition = require('../../GraphQlDefinition')

module.exports = new GraphQLDefinition({
  query: {},
  mutation: {
    createPaymentPaypal(root, data, { accessToken }) {
      if (!accessToken.id) throw new Error('Unauthorized')
      return axios({
        method: 'POST',
        url: `${THE_ASIA_API}/Paypals/createPayment`,
        headers: {
          Authorization: accessToken.id,
        },
        data,
      })
      .then(res => res.data)
      .catch(err => err)
    },
    executePaymentPaypal(root, data, { accessToken }) {
      if (!accessToken.id) throw new Error('Unauthorized')
      return axios({
        method: 'POST',
        url: `${THE_ASIA_API}/Paypals/executePayment`,
        headers: {
          Authorization: accessToken.id,
        },
        data,
      })
      .then(res => res.data)
      .catch(err => err);
    },
  },
  resolver: {},
  type: /* GraphQL */`
    extend type Mutation {
      createPaymentPaypal(booking_id: String, payment_method_id: String): PaypalCreatePayment
      executePaymentPaypal(booking_id: String, paymentID: String, payerID: String): PaypalExecutePayment
    }

    type PaypalCreatePayment {
      id: String
    }

    type PaypalExecutePayment {
      book: Booking
      payment: Payment
      id: String
      current: String
      previous: String
      status: Int
      success: Boolean
    }
  `,
})