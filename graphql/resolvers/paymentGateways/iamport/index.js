const axios = require('axios');

const { THE_ASIA_API } = require('../../../config');

const GraphQlDefinition = require('../../GraphQlDefinition');

module.exports = new GraphQlDefinition({
  query: {},
  mutation: {
    createPaymentIamport(root, data, { accessToken }) {
      if (!accessToken.id) throw new Error('Unauthorized')
      return axios({
        method: 'POST',
        url: `${THE_ASIA_API}/Iamports/createPayment`,
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
      createPaymentIamport(booking_id: String, imp_uid: String): IamportCreatePayment 
    }

    type IamportCreatePayment {
      status: Int
    }
  `,
});
