const moment = require('moment');
const _ = require('underscore');

const logger = require('../../logger');
const loopbackRef = require('../../reference');
const axios = require('../../axios');

const BOOKING_STATUS_LIST_API = '/BookingStatuses';
const BOOKING_API = '/Bookings';
const ACTIVITY_LOG = '/Activities';
const EMAIL_TYPES = '/Bookings/emailType';
const BOOKING_LANG = '/Languages';
const COUNTRIES_API = '/Countries';

module.exports = {
  // TODO: separate to activity type
  activities(root, args) {
    const { model_name, model_id } = args;
    return axios
      .get(
        `${ACTIVITY_LOG}?filter=${encodeURIComponent(
          JSON.stringify({
            where: {
              model_name,
              model_id,
            },
          }),
        )}`,
      )
      .then(res => res.data)
      .catch(err => err);
  },
  // TODO: separate to country type
  countryCount() {
    return axios
      .get(`${COUNTRIES_API}/count`)
      .then(res => res.data)
      .catch(error => Promise.reject(error));
  },
  async bookings(root, args) {
    const {
      input: {
        bookingStatusId,
        limit = 10,
        offset = 0,
        order,
        searchTerm,
        currencyCode,
        nationalityId,
        dateCreated,
        dateUpdated,
        tripDate,
        bookingMethodId,
        userId,
        supplier_id,
      },
    } = args;
    logger.debug('bookings', {
      bookingStatusId,
      userId,
      limit,
      offset,
      order,
      searchTerm,
      currencyCode,
      nationalityId,
      dateCreated,
      dateUpdated,
      bookingMethodId,
    });

    const filter = {
      limit,
      offset,
    };

    if (bookingStatusId) {
      filter.where = {
        ...filter.where,
        booking_status_id: bookingStatusId,
      };
    }

    if (userId) {
      filter.where = {
        ...filter.where,
        user_id: userId,
      };
    }

    if (currencyCode) {
      filter.where = {
        ...filter.where,
        booking_currency_code: currencyCode,
      };
    }

    if (nationalityId) {
      filter.where = {
        ...filter.where,
        nationality: nationalityId,
      };
    }

    if (bookingMethodId) {
      filter.where = {
        ...filter.where,
        booking_method_id: bookingMethodId,
      };
    }

    if (supplier_id) {
      filter.where = {
        ...filter.where,
        supplier_id,
      };
    }

    if (order) {
      filter.order = order;
    }

    if (dateCreated) {
      filter.where = {
        ...filter.where,
        created_at: {
          between: [
            `${moment(dateCreated).format('YYYY-MM-DD')}T00:00:00.000Z`,
            `${moment(dateCreated).format('YYYY-MM-DD')}T23:59:00.000Z`,
          ],
        },
      };
    }

    if (dateUpdated) {
      filter.where = {
        ...filter.where,
        updated_at: {
          between: [
            `${moment(dateUpdated).format('YYYY-MM-DD')}T00:00:00.000Z`,
            `${moment(dateUpdated).format('YYYY-MM-DD')}T23:59:00.000Z`,
          ],
        },
      };
    }

    if (searchTerm) {
      filter.where = {
        ...filter.where,
        and: [
          {
            or: [
              {
                booking_no: {
                  ilike: `%${searchTerm}%`,
                },
              },
              {
                billing_first_name: {
                  ilike: `%${searchTerm}%`,
                },
              },
              {
                billing_last_name: {
                  ilike: `%${searchTerm}%`,
                },
              },
            ],
          },
        ],
      };
    }

    if (tripDate) {
      filter.where = {
        ...filter.where,
        trip_starts: {
          between: [
            `${moment(tripDate).format('YYYY-MM-DD')}T00:00:00.000Z`,
            `${moment(tripDate).format('YYYY-MM-DD')}T23:59:00.000Z`,
          ],
        },
      };
    }

    logger.debug('filter', filter);

    const url = `${BOOKING_API}?filter=${encodeURIComponent(JSON.stringify(filter))}`;
    logger.debug(url);

    try {
      const result = await axios.get(url).then(res => res.data);

      return result;
    } catch (e) {
      logger.error('error', e);
      return e;
    }
  },
  async booking(root, args, context) {
    const { id, supplier_id } = args;
    const accessToken = context.user.id || '';
    const data = await axios
      .get(`${BOOKING_API}/${id}?access_token=${accessToken}`)
      .then(res => res.data)
      .catch(err => err);
    if (supplier_id && data.supplier_id != supplier_id) {
      const e = new Error('Booking Not Found');
    }
    return data;
  },
  async bookingAffiliate(root, args, context) {
    const { id } = args;
    const {
      accessToken: { userId },
    } = context;
    if (!userId) throw new Error('Unauthorized');
    // check user's role for affiliates
    const user = await loopbackRef.app.models.Users.findById(userId);
    if (!user || (user.role !== 9 && user.role !== 3))
      return Promise.reject(new Error('Unauthorized'));
    const filter = {
      where: {
        id,
        booking_method_id: { inq: [3, 4, 5, 6] },
      },
      include: [
        'bookingStatusIdFkeyrel',
        'bookingUserIdFkeyrel',
        'nationalityRel',
        'tour',
        'sub_product',
        {
          relation: 'charges',
          scope: {
            include: {
              relation: 'typeRel',
            },
          },
        },
        {
          relation: 'notes',
          scope: {
            include: {
              relation: 'notesUserIdFkeyrel',
            },
            order: 'id',
            where: {
              or: [
                {
                  user_id: userId,
                },
                {
                  is_public: true,
                },
              ],
            },
          },
        },
      ],
    };
    try {
      const data = await loopbackRef.app.models.Booking.findOne(filter);
      if (!data) throw new Error('Booking not Found');
      if (data.user_id !== user.id) throw new Error('Unauthorized');
      return data ? data.toObject() : null;
    } catch (error) {
      console.log('bookingAffiliate error:', error);
      throw new Error('Something went wrong');
    }
  },
  bookingStats(root, args) {
    const { type, status_id } = args;
    return axios
      .get('/bookings/bookingstats', { params: { type, status_id } })
      .then(res => res.data);
  },
  async bookingSupplier(root, args, context) {
    const { id, supplier_id } = args;
    const {
      accessToken: { userId },
    } = context;
    // const userFilter = {
    //   where: {
    //     supplier_id,
    //   },
    // };
    if (!supplier_id) {
      throw new Error('Unauthorized');
    }
    if (!userId) {
      throw new Error('Unauthorized');
    }

    const user = await loopbackRef.app.models.Users.findById(userId);
    // check user's role for supplier ,Not used in dev env (check should be there once in production)
    // const user = await loopbackRef.app.models.Users.findOne(userFilter)
    if (!user || user.supplier_id != supplier_id) {
      return Promise.reject(new Error('Unauthorized'));
    }
    const filter = {
      where: {
        id,
        supplier_id,
      },
      include: [
        'bookingStatusIdFkeyrel',
        'nationalityRel',
        'tour',
        'sub_product',
        {
          relation: 'charges',
          scope: {
            include: {
              relation: 'typeRel',
            },
          },
        },
        {
          relation: 'notes',
          scope: {
            include: {
              relation: 'notesUserIdFkeyrel',
            },
            order: 'id',
            where: {
              or: [
                {
                  user_id: user.id,
                },
                {
                  is_public: true,
                },
              ],
            },
          },
        },
      ],
    };
    const data = await loopbackRef.app.models.Booking.findOne(filter);
    return data ? data.toObject() : null;
  },
  async bookingsCount(root, args) {
    const {
      input: {
        bookingStatusId,
        searchTerm,
        currencyCode,
        nationalityId,
        dateCreated,
        dateUpdated,
        tripDate,
        bookingMethodId,
        userId,
      } = {},
    } = args;
    const filter = {};
    if (bookingStatusId) {
      filter.where = {
        ...filter.where,
        booking_status_id: bookingStatusId,
      };
    }

    if (userId) {
      filter.where = {
        ...filter.where,
        user_id: userId,
      };
    }

    if (currencyCode) {
      filter.where = {
        ...filter.where,
        booking_currency_code: currencyCode,
      };
    }

    if (nationalityId) {
      filter.where = {
        ...filter.where,
        nationality: nationalityId,
      };
    }

    if (dateCreated) {
      filter.where = {
        ...filter.where,
        created_at: {
          between: [
            `${moment(dateCreated).format('YYYY-MM-DD')}T00:00:00.000Z`,
            `${moment(dateCreated).format('YYYY-MM-DD')}T23:59:00.000Z`,
          ],
        },
      };
    }

    if (dateUpdated) {
      filter.where = {
        ...filter.where,
        updated_at: {
          between: [
            `${moment(dateUpdated).format('YYYY-MM-DD')}T00:00:00.000Z`,
            `${moment(dateUpdated).format('YYYY-MM-DD')}T23:59:00.000Z`,
          ],
        },
      };
    }

    if (searchTerm) {
      filter.where = {
        ...filter.where,
        and: [
          {
            or: [
              {
                booking_no: {
                  ilike: `%${searchTerm}%`,
                },
              },
              {
                billing_first_name: {
                  ilike: `%${searchTerm}%`,
                },
              },
              {
                billing_last_name: {
                  ilike: `%${searchTerm}%`,
                },
              },
            ],
          },
        ],
      };
    }

    if (tripDate) {
      filter.where = {
        ...filter.where,
        trip_starts: {
          between: [
            `${moment(tripDate).format('YYYY-MM-DD')}T00:00:00.000Z`,
            `${moment(tripDate).format('YYYY-MM-DD')}T23:59:00.000Z`,
          ],
        },
      };
    }

    if (bookingMethodId) {
      filter.where = {
        ...filter.where,
        booking_method_id: bookingMethodId,
      };
    }

    logger.debug('filter', filter);

    let url = `${BOOKING_API}/count`;

    if (_.isEmpty(filter.where) === false) {
      url = `${url}?where=${encodeURIComponent(JSON.stringify(filter.where))}`;
    }

    const { count } = await axios
      .get(url)
      .then(({ data }) => data)
      .catch(e => {
        logger.error(e);
        return {
          count: 0,
        };
      });
    logger.debug('done', count);

    return count;
  },
  async bookingEmails() {
    return loopbackRef.app.models.Booking.bookingEmails();
  },
  async bookingEmailsAffiliate(root, input, context) {
    const {
      accessToken: { userId },
    } = context;
    if (!userId) throw new Error('Unauthorized');

    return loopbackRef.app.models.Booking.bookingEmails('AFFILIATE_CUSTOMER_');
  },
  bookingStatusList() {
    return axios
      .get(BOOKING_STATUS_LIST_API)
      .then(res => res.data)
      .catch(err => err);
  },
  bookingMethods(root, { active }) {
    if (typeof active !== 'boolean') {
      active = true;
    }
    return loopbackRef.app.models.BookingMethods.find({
      where: {
        active,
      },
    });
  },
  getActivityLog(root, params) {
    const input = {
      where: {
        user_id: {
          neq: 0,
        },
      },
    };
    Object.keys(params).forEach(item => {
      if (item === 'model_name' || item === 'model_id') {
        input.where[item] = params[item];
      } else if (params[item] !== null || params[item] !== 'undefined') {
        input[item] = params[item];
      }
    });

    return axios
      .get(`${ACTIVITY_LOG}?filter=${encodeURIComponent(JSON.stringify(input))}`)
      .then(res => res.data)
      .catch(err => err);
  },
  getActivityLogCount(root, params, context) {
    return axios
      .get(
        `${ACTIVITY_LOG}/count?where=${encodeURIComponent(JSON.stringify(params))}&access_token=${
          context.user.id
        }`,
      )
      .then(res => res.data)
      .catch(err => err);
  },
  getEmailTypes(root, data, context) {
    const accessToken = context.user.id || '';
    return axios
      .get(`${EMAIL_TYPES}?access_token=${accessToken}`)
      .then(res => res.data)
      .catch(err => err);
  },
  bookingListByUserId(root, params) {
    if (params.user_id) {
      return axios
        .get(
          `${BOOKING_API}?filter=${encodeURIComponent(
            JSON.stringify({
              where: {
                user_id: parseInt(params.user_id, 10),
                id: { nin: [parseInt(params.nin_booking_id, 10)] },
              },
            }),
          )}`,
        )
        .then(res => res.data)
        .catch(err => err);
    }
    return null;
  },
  bookingEmailLang() {
    return axios
      .get(BOOKING_LANG)
      .then(res => res.data)
      .catch(err => err);
  },
  async bookingsAffiliate(root, args, context) {
    const {
      input: { limit, offset, order, bookingStatusId, searchTerm, start, end },
    } = args;
    const {
      accessToken: { userId },
    } = context;
    logger.debug('bookingsAffiliate', {
      limit,
      offset,
      order,
      bookingStatusId,
      searchTerm,
      start,
      end,
    });

    if (!userId) throw new Error('Unauthorized');

    return loopbackRef.app.models.Booking.search({
      user_id: userId,
      booking_method_id: '3, 4, 5, 6',
      limit: !limit || limit > 200 ? 10 : limit,
      offset: offset || 0,
      order,
      // Include amendToSupplier in on Request bookings
      bookingStatusId: bookingStatusId === '1' ? '1,3' : bookingStatusId,
      searchTerm,
      start,
      end,
    });
  },
  async bookingsSupplier(root, args) {
    const {
      input: { limit, offset, order, bookingStatusId, searchTerm, start, end, supplier_id },
    } = args;
    logger.debug('bookingsSupplier', {
      limit,
      offset,
      order,
      bookingStatusId,
      searchTerm,
      start,
      end,
      supplier_id,
    });

    if (!supplier_id) throw new Error('Unauthorized');
    const params = {
      supplier_id,
      limit: !limit || limit > 200 ? 10 : limit,
      offset: offset || 0,
      order,
      // Include amendToSupplier in on Request bookings
      bookingStatusId: bookingStatusId === '1' ? '1,3,8,9' : bookingStatusId,
      searchTerm,
      start,
      end,
    };
    console.log('params', params);
    const data = await loopbackRef.app.models.Booking.search(params);
    console.log('bookings', data);
    if (data) {
      return data;
    }

    return [];
  },
};
