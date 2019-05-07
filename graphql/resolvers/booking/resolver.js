const { getSafe } = require('../../../common/utility');
const loopbackRef = require('../../reference');
const { formatCurrency } = require('../../../common/helpers/currency');
const axios = require('../../axios');

module.exports = {
  Booking: {
    booking_status({ booking_status_id }) {
      return axios
        .get(`/BookingStatuses/${booking_status_id}`)
        .then(res => res.data)
        .catch(() => ({
          id: booking_status_id,
        }));
    },
    tour({ id }) {
      return axios
        .get(`/Bookings/${id}/tour`)
        .then(res => res.data)
        .catch(err => err);
    },
    chargeBreakdown({ charges }) {
      const result = [];
      charges.forEach(charge => {
        const type =
          Number(charge.charge_type_id) === 1 ? charge.pax_type.toLowerCase() : charge.typeRel.name;
        const dup = result.find(
          r =>
            r.type === type &&
            r.value === charge.charge_amount &&
            r.currencyCode === charge.charge_currency_code &&
            r.statusId === charge.charge_status_id,
        );
        if (dup) {
          dup.count += 1;
        } else {
          result.push({
            type,
            count: 1,
            value: charge.charge_amount,
            currencyCode: charge.charge_currency_code,
            statusId: charge.charge_status_id,
          });
        }
      });

      return result;
    },
  },
  Bookings: {
    nationality_name(root) {
      return axios
        .get(`/countries/${root.nationalityRel.id}`)
        .then(res => res.data.name)
        .catch(err => err);
    },
    billing_country_name(root) {
      return axios
        .get(`/countries/${root.billing_country_id}`)
        .then(res => res.data.name)
        .catch(err => err);
    },
    // If charge doesn't use formatCurrency, replace usdTotal/usdPaid as well
    usdTotal(root) {
      const usdTotal = root.total / root.exchange_rate;
      return formatCurrency('USD', usdTotal);
    },
    async usdPaid(root) {
      const payments = await loopbackRef.app.models.Payments.find({
        where: {
          booking_id: root.id,
        },
      });
      const totalPaid = payments.reduce(
        (acc, cur) => acc + (cur.total_charge - cur.total_refund),
        0,
      );
      return formatCurrency('USD', totalPaid / root.exchange_rate);
    },
    margin(root) {
      try {
        const {
          input_details: { adult_pax, infant_pax, child_pax },
          price_details: {
            supplierPrice: { adults: adult_cost, children: child_cost, infants: infant_cost },
          },
        } = root;

        const cp = adult_pax * adult_cost + child_pax * child_cost + infant_pax * infant_cost;

        const costPrice = cp / root.supplier_exchange_rate;
        const sellingPrice = root.total / root.exchange_rate;

        const margin = ((sellingPrice - costPrice) / costPrice) * 100;

        return `${Math.round(margin)}%`;
      } catch (ex) {
        return '';
      }
    },
    adult_pax(root) {
      return getSafe(() => root.input_details.adult_pax);
    },
    child_pax(root) {
      return getSafe(() => root.input_details.child_pax);
    },
    infant_pax(root) {
      return getSafe(() => root.input_details.infant_pax);
    },
  },
  BookingStatus: {
    booking_count({ id }) {
      return axios
        .get('/Bookings/count', {
          params: {
            where: {
              booking_status_id: id,
            },
          },
        })
        .then(({ data: { count } }) => count)
        .catch(err => err);
    },
  },
  BookingUserIdFkeyrel: {
    country_name({ country_id }) {
      if (!country_id || parseInt(country_id, 10) === 0) {
        return '';
      }

      return axios
        .get(`/countries/${country_id}`)
        .then(res => res.data.name)
        .catch(err => err);
    },
    name(user) {
      return `${user.first_name} ${user.last_name}`.trim();
    },
  },
  Charges: {
    payment_date(root, params, context) {
      if (Number(root.payment_id) === 0) return null;
      return axios
        .get(`/payments/${root.payment_id}?access_token=${context.user.id}`)
        .then(res => res.data.created_at)
        .catch(err => err);
    },
  },
};
