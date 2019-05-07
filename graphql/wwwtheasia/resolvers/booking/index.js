const axios = require('axios');
const money = require('money');

const { THE_ASIA_API: BASE_API } = require('../../config');
const ErrorResponse = require('../../shared/error');
const logger = require('../../../logger');
const getCurrencyHelper = require('../../../helpers/currency');

const BOOKING_API = `${BASE_API}/Bookings`;
const baseURL = BASE_API;
const BOOKING_URL = '/bookings';
const COUNTRY_URL = '/countries';
const USER_URL = '/users';
const TOUR_URL = '/tours';
const SUB_PRODUCT_URL = '/subproducts';

const handleError = ({ response: { data: { error = {} } = {} } = {} }) => {
  logger.error(error);
  throw new ErrorResponse(Object.assign({}, error));
};

const resolvers = {
  Booking: {
    billingCountry(root) {
      return axios
        .request({
          method: 'GET',
          baseURL,
          url: `${COUNTRY_URL}/${root.billing_country_id}`,
        })
        .then(res => res.data);
    },
    billingCountryId(root) {
      return root.billing_country_id;
    },
    billingFirstName(root) {
      return root.billing_first_name;
    },
    billingLastName(root) {
      return root.billing_last_name;
    },
    billingPhone(root) {
      return root.billing_phone;
    },
    bookingCurrencyCode(root) {
      return root.booking_currency_code;
    },
    passportNumber(root) {
      return root.passport_number;
    },
    pickupLocationTime(root) {
      return root.pickup_location_time;
    },
    pickupPlace(root) {
      return root.pickup_place;
    },
    pickupTime(root) {
      return root.pickup_time;
    },
    review(root) {
      return axios
        .request({
          method: 'GET',
          baseURL,
          url: '/reviews/findone',
          params: {
            filter: { where: { booking_id: root.id } },
          },
        })
        .then(res => res.data)
        .catch(error => {
          if (error.response && error.response.status === 404) {
            return null;
          }
          return handleError(error);
        });
    },
    specialRequest(root) {
      return root.special_request;
    },
    subTour(root) {
      return axios
        .request({
          method: 'GET',
          baseURL,
          url: `${SUB_PRODUCT_URL}/${root.sub_product_id}`,
        })
        .then(res => res.data)
        .catch(handleError);
    },
    tour(root) {
      return axios
        .request({
          method: 'GET',
          baseURL,
          url: `${TOUR_URL}/${root.tour_id}`,
        })
        .then(res => res.data)
        .catch(handleError);
    },
    user(root) {
      return axios
        .request({
          method: 'GET',
          baseURL,
          url: `${USER_URL}/${root.user_id}`,
          params: {
            access_token: root.user_id,
          },
        })
        .then(res => res.data)
        .catch(handleError);
    },
  },
  CreatedBooking: {
    adultPrice({ price_details: { sellingPrice: { adults = 0 } = {} } = {} }) {
      return adults;
    },
    childPrice({ price_details: { sellingPrice: { children = 0 } = {} } = {} }) {
      return children;
    },
    infantPrice({ price_details: { sellingPrice: { infants = 0 } = {} } = {} }) {
      return infants;
    },
    bookingNumber({ booking_no: bookingNumber }) {
      return bookingNumber;
    },
  },
};

const mutations = {
  async createBooking(root, args, context) {
    const { input } = args;
    const {
      currency: { code: userCurrency },
    } = context;

    const currencyHelper = getCurrencyHelper();
    await currencyHelper.asyncSetExchangeRates();

    const form = {
      billing_first_name: input.firstName,
      billing_last_name: input.lastName,
      email: input.email,
      nationality: input.nationality,
      billing_phone: input.phone,
      pickup_place: input.pickupPlace,
      pickup_time: input.pickupTime,
      flight_number: input.flightNumber,
      passport_number: input.passportNumber,
      drop_off_place: input.dropOffPlace,
      hotel_name: input.hotelName,
      booking_method_id: input.bookingMethodId,
      tour_id: input.tourId,
      sub_product_id: input.subProductId,
      exchange_rate: money.rates[userCurrency],
      trip_starts: input.tripStarts,
      input_details: {
        adult_pax: input.inputDetails.adultPax,
        child_pax: input.inputDetails.childPax,
        infant_pax: input.inputDetails.infantPax,
      },
      price_details: {
        adult_price: input.priceDetails.adultPrice,
        child_price: input.priceDetails.childPrice,
        infant_price: input.priceDetails.infantPrice,
      },
      total: input.total,
      special_request: input.specialRequest,
      pickup_location_time: input.pickupLocationTime,
      lang_id: input.langId,
      cancellation_policy_id: input.cancellationPolicyId,
      supplier_currency_code: input.supplierCurrencyCode,
      supplier_exchange_rate: input.supplierExchangeRate,
      promocode: input.promoCode,
      booking_currency_code: input.bookingCurrencyCode,
      booking_currency_id: input.bookingCurrencyId,
      billing_country_id: input.billingCountryId,
      selected_time: input.selectedTime,
    };

    console.log('Booking form =>', form);

    return axios
      .post(BOOKING_API, { ...form })
      .then(res => {
        console.log('main data :::::', res.data);
        return res.data;
      })
      .catch(({ response: { data: { error = {} } = {} } = {} }) => {
        throw new ErrorResponse({ ...error });
      });
  },
  async setBillingCountry(root, args, context) {
    const { input: { id, billingCountryId } = {}, currency: countryCurrency = '' } = args;
    const { currency: { code: userCurrency } = {} } = context;

    const currencyHelper = getCurrencyHelper();
    await currencyHelper.asyncSetExchangeRates();

    const payload = {
      // booking_currency_id: id,
      booking_currency_code: countryCurrency,
      exchange_rate: money.rates[countryCurrency],
      billing_country_id: Number(billingCountryId),
    };
    logger.debug('payload => ', payload);
    logger.debug('booking => ', id);
    return axios
      .patch(`${BOOKING_API}/updateBookingBilling/${id}`, payload)
      .then(({ data: { status, total: serverTotal } = {} }) => {
        if (status) {
          throw {
            response: {
              data: {
                error: {
                  message: status,
                },
              },
            },
          };
        }
        return {
          id,
          currency: countryCurrency,
          oldExchangeRate: money.rates[userCurrency],
          exchangeRate: money.rates[countryCurrency],
          exchangeTotal: serverTotal,
          billingCountry: Number(billingCountryId),
          isUserCurrency: userCurrency === countryCurrency,
        };
      })
      .catch(({ response: { data: { error = {} } = {} } = {} }) => {
        throw new ErrorResponse(Object.assign({}, error));
      });
  },
};

const query = {
  bookings(root, arg) {
    logger.debug('bookings', arg);

    const { where, limit = 10, offset = 0 } = arg;

    const params = { filter: { limit, offset, where } };

    logger.debug('params', params);

    return axios
      .request({
        baseURL,
        method: 'GET',
        url: BOOKING_URL,
        params,
      })
      .then(res => res.data)
      .catch(handleError);
  },
};

module.exports = { query, resolvers, mutations };
