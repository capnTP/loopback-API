const moment = require('moment');
const { AuthenticationError } = require('apollo-server-express');

const loopbackRef = require('../../reference');

const query = {
  async currencies() {
    const currencies = await loopbackRef.app.models.Currencies.find();
    return currencies;
  },
  async payout(_, { id, reciever_id }) {
    const payout = await loopbackRef.app.models.Payouts.findById(id);
    if (reciever_id && Number(reciever_id) !== Number(payout.reciever_id)) {
      const e = new Error('Payout not Found');
      return e;
    }
    return payout;
  },
  async payouts(root, arg) {
    // logger.debug('payouts', arg);
    const params = {
      order: 'created_at DESC',
    };
    if (arg.where && arg.where.limit) {
      params.limit = arg.where.limit;
    }
    if (arg.where && arg.where.offset) {
      params.offset = arg.where.offset;
    }

    if (
      arg.where &&
      (arg.where.status || arg.where.reciever_ids || arg.where.created_at || arg.where.due_date)
    ) {
      params.where = {};
      if (arg.where.status && arg.where.status.length) {
        params.where.status = {
          inq: arg.where.status,
        };
      }
      if (arg.where.reciever_ids && arg.where.reciever_ids.length) {
        params.where.reciever_id = {
          inq: arg.where.reciever_ids,
        };
      }
      if (arg.where.due_date) {
        const { due_date } = arg.where;
        const today = moment();
        if (due_date === 'overdue') {
          params.where.due_date = {
            lte: `${today.format('YYYY-MM-DD')}T00:00:00.000Z`,
          };
        } else if (due_date === 'underdue') {
          params.where.due_date = {
            gte: `${today.format('YYYY-MM-DD')}T23:59:00.000Z`,
          };
        } else if (due_date === 'today') {
          params.where.due_date = {
            between: [
              `${today.format('YYYY-MM-DD')}T00:00:00.000Z`,
              `${today.format('YYYY-MM-DD')}T23:59:00.000Z`,
            ],
          };
        }
      }
      if (arg.where.created_at) {
        if (arg.where.created_at.from && arg.where.created_at.to) {
          params.where.created_at = {
            between: [
              `${moment(arg.where.created_at.from).format('YYYY-MM-DD')}T00:00:00.000Z`,
              `${moment(arg.where.created_at.to).format('YYYY-MM-DD')}T23:59:00.000Z`,
            ],
          };
        } else if (arg.where.created_at.from) {
          params.where.created_at = {
            between: [
              `${moment(arg.where.created_at.from).format('YYYY-MM-DD')}T00:00:00.000Z`,
              `${moment(arg.where.created_at.from).format('YYYY-MM-DD')}T23:59:00.000Z`,
            ],
          };
        } else if (arg.where.created_at.to) {
          params.where.created_at = {
            between: [
              `${moment(arg.where.created_at.to).format('YYYY-MM-DD')}T00:00:00.000Z`,
              `${moment(arg.where.created_at.to).format('YYYY-MM-DD')}T23:59:00.000Z`,
            ],
          };
        }
      }
    }
    // console.log('all filters',JSON.stringify(params));
    return loopbackRef.app.models.Payouts.find(params);
  },
  async payoutsCount(root, arg) {
    // logger.debug('payoutsCount', arg);
    const params = {};
    if (
      arg.where &&
      (arg.where.status || arg.where.reciever_ids || arg.where.created_at || arg.where.due_date)
    ) {
      if (arg.where.status && arg.where.status.length) {
        params.status = {
          inq: arg.where.status,
        };
      }
      if (arg.where.reciever_ids && arg.where.reciever_ids.length) {
        params.reciever_id = {
          inq: arg.where.reciever_ids,
        };
      }
      if (arg.where.due_date) {
        const { due_date } = arg.where;
        const today = moment();
        if (due_date === 'overdue') {
          params.due_date = {
            lte: `${today.format('YYYY-MM-DD')}T00:00:00.000Z`,
          };
        } else if (due_date === 'underdue') {
          params.due_date = {
            gte: `${today.format('YYYY-MM-DD')}T23:59:00.000Z`,
          };
        } else if (due_date === 'today') {
          params.due_date = {
            between: [
              `${today.format('YYYY-MM-DD')}T00:00:00.000Z`,
              `${today.format('YYYY-MM-DD')}T23:59:00.000Z`,
            ],
          };
        }
      }
      if (arg.where.created_at) {
        if (arg.where.created_at.from && arg.where.created_at.to) {
          params.created_at = {
            between: [
              `${moment(arg.where.created_at.from).format('YYYY-MM-DD')}T00:00:00.000Z`,
              `${moment(arg.where.created_at.to).format('YYYY-MM-DD')}T23:59:00.000Z`,
            ],
          };
        } else if (arg.where.created_at.from) {
          params.created_at = {
            between: [
              `${moment(arg.where.created_at.from).format('YYYY-MM-DD')}T00:00:00.000Z`,
              `${moment(arg.where.created_at.from).format('YYYY-MM-DD')}T23:59:00.000Z`,
            ],
          };
        } else if (arg.where.created_at.to) {
          params.created_at = {
            between: [
              `${moment(arg.where.created_at.to).format('YYYY-MM-DD')}T00:00:00.000Z`,
              `${moment(arg.where.created_at.to).format('YYYY-MM-DD')}T23:59:00.000Z`,
            ],
          };
        }
      }
    }
    const count = await loopbackRef.app.models.Payouts.count(params);
    // console.log('all filter',JSON.stringify(params),count);
    return count || 0;
  },
  async payoutsSupplier(
    root,
    arg,
    {
      accessToken: { userId },
    },
  ) {
    if (!userId) throw new AuthenticationError('Unauthorized');

    const supplierArg = {
      ...arg,
      where: {
        ...arg.where,
        reciever_ids: [userId],
        status: ['PAID'],
      },
    };

    const [payouts, count] = await Promise.all([
      query.payouts(root, supplierArg),
      query.payoutsCount(root, supplierArg),
    ]);

    return {
      payouts,
      count,
    };
  },
};

module.exports = query;
