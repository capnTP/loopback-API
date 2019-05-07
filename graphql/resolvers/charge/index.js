const axios = require('../../axios')

const CHARGES_API = '/charges';
const CHARGE_TYPE_API = '/chargetypes';

const query = {
  getChargeByBookingId(root, params, context) {
    return axios
      .get(
        `${CHARGES_API}?access_token=${context.user.id}&filter=${encodeURIComponent(
          JSON.stringify({
            where: { booking_id: Number(params.booking_id) || 0 },
            include: ['typeRel', 'statusRel'],
          }),
        )}`,
        {
          headers: {
            Authorization: context.user.id || '',
          },
        },
      )
      .then(res => res.data)
      .catch(err => err);
  },
  chargeTypes() {
    return axios
      .get(CHARGE_TYPE_API)
      .then(res => res.data)
      .catch(err => err);
  },
};

const mutation = {
  addCharge(root, params, context) {
    const {
      input: data,
      isSendSupplierEmail,
      isSendCustomerEmail
    } = params;
    return axios
      .post(`${CHARGES_API}/addCharge`, {
        data,
        isSendCustomerEmail: !!isSendCustomerEmail,
        isSendSupplierEmail: !!isSendSupplierEmail
      }, {
        headers: {
          Authorization: context.user.id || '',
        },
      })
      .then(res => res.data.message)
      .catch(error => error);
  },
  deleteChargeBatch(root, params, context) {
    const {
      list,
      isSendSupplierEmail,
      isSendCustomerEmail
    } = params;
    const ids = list.map(item => Number(item));
    return axios
      .post(`${CHARGES_API}/batchDelete`, {
        ids,
        isSendCustomerEmail: !!isSendCustomerEmail,
        isSendSupplierEmail: !!isSendSupplierEmail
      }, {
        headers: {
          Authorization: context.user.id || '',
        },
      })
      .then(res => res.data.message)
      .catch(error => error);
  },
};

const resolvers = {
  Charge: {
    charge_status({
      statusRel = {}
    }) {
      return statusRel.name || '';
    },
    charge_type({
      typeRel = {}
    }) {
      return typeRel.name || '';
    },
  },
};

module.exports = {
  query,
  mutation,
  resolvers
};
