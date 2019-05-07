const { THE_ASIA_API } = require('../../config');
const axios = require('../../axios')

const GraphQlDefinition = require('../GraphQlDefinition');

module.exports = new GraphQlDefinition({
  query: {},
  mutation: {
    updateVoucher(root, data, { user }) {
      // context 'user' = access token from CMS
      if (!user || !user.id) throw new Error('Unauthorized')
      return axios({
        method: 'POST',
        url: `${THE_ASIA_API}/Vouchers/updateVoucher`,
        headers: {
          Authorization: user.id,
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
      updateVoucher(booking_id: ID): UpdateVoucher 
    }

    type UpdateVoucher {
      status: Int
      message: String
    }
  `,
});
