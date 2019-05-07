const axios = require('axios');

const { THE_ASIA_API } = require('../../../config');

const GraphQlDefinition = require('../../GraphQlDefinition');

module.exports = new GraphQlDefinition({
  query: {},
  mutation: {
    createPaymentIngenico(root, data, { accessToken }) {
      if (!accessToken.id) throw new Error('Unauthorized')
      return axios({
        method: 'POST',
        url: `${THE_ASIA_API}/Ingenicos/createPayment`,
        headers: {
          Authorization: accessToken.id,
        },
        data,
      })
      .then(res => res.data)
      .catch(err => err)
    },
    createNewPaymentIngenico(root, data, { accessToken }) {
      if (!accessToken.id) throw new Error('Unauthorized')
      return axios({
        method: 'POST',
        url: `${THE_ASIA_API}/Ingenicos/createNewPayment`,
        headers: {
          Authorization: accessToken.id,
        },
        data,
      })
      .then(res => res.data)
      .catch(err => err)
    },
    createSessionIngenico(root, data, { accessToken }) {
      if (!accessToken.id) throw new Error('Unauthorized')
      return axios({
        method: 'POST',
        url: `${THE_ASIA_API}/Ingenicos/createSession`,
        headers: {
          Authorization: accessToken.id,
        },
        data,
      })
      .then(res => res.data)
      .catch(err => err)
    },
    createPaymentFromToken(root, data, { accessToken }) {
      if (!accessToken.id) throw new Error('Unauthorized')
      return axios({
        method: 'POST',
        url: `${THE_ASIA_API}/Ingenicos/createPaymentFromToken`,
        headers: {
          Authorization: accessToken.id,
        },
        data,
      })
      .then(res => res.data)
      .catch(err => err)
    },
  },
  resolver: {},
  type: /* GraphQL */`
    extend type Mutation {
      createPaymentIngenico(booking_id: String, payment_method_id: String): IngenicoCreatePayment 
      createNewPaymentIngenico(booking_id: String, payment_method_id: String, encrypted_customer_input: String, save_payment: Boolean): IngenicoNewPayment
      createSessionIngenico(booking_id: String): IngenicoSession
      createPaymentFromToken(booking_id: String, payment_method_id: String, encrypted_customer_input: String): IngenicoNewPayment
    }

    type IngenicoCreatePayment {
      status: Int
      url: String
    }

    type IngenicoNewPayment {
      status: Int
      success: Boolean
      message: String
    }

    type IngenicoSession {
      s_key: String
      savedPaymentList: [IngenicoPaymentObject]
    }

    type IngenicoPaymentObject {
      user_id: String
      card_last_digits: String
      card_type: IngenicoPaymentObjectCardType
      card_name: String
    }

    type IngenicoPaymentObjectCardType {
      id: String
      name: String
    }
  `,
});
