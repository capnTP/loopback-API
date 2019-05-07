const axios = require('axios');
const {
  pick,
  isEmpty,
  isNaN
} = require('underscore');
const moment = require('moment');
const Json2csvParser = require('json2csv').Parser
const { AuthenticationError } = require('apollo-server-express')

const {
  THE_ASIA_API
} = require('../../config');
const logger = require('../../logger');
const loopbackRef = require('../../reference')
const axiosIntance = require('../../axios');
const PAYMENTS_API = `${THE_ASIA_API}/Payments`;

const PAYOUT_API = `${THE_ASIA_API}/payouts`;
const where = query => encodeURIComponent(JSON.stringify({
  where: query
}));
const AFFILIATE_STATUS = [
	'NO PAYMENT',
	'AUTHORIZED',
	'PAID',
	'',
	'REFUND',
	'CANCELLED',
	'AUTHORIZED',
	'PAID'
];

const getAndOr = (and, values, key) => {
  if (values && values.length > 0) {
    const or = [];
    values.forEach((value) => {
      or.push({
        [key]: value
      });
    });
    and.push({
      or
    });
  }
  return [...and];
};

const query = {
  payments(root, params, context) {
    if (params.booking_id) {
      return axios
        .get(
          `${PAYMENTS_API}?access_token=${context.user.id}&filter=${encodeURIComponent(
            JSON.stringify({
              where: { booking_id: params.booking_id },
            }),
          )}`,
        )
        .then(res => res.data)
        .catch(err => err);
    }
    return null;
  },
  async paymentReport(root,arg) {
    const data = await loopbackRef.app.models.Booking.paymentReport('theAsiaCRM',arg.where);
    // console.log("graphql is working perfect data with where",data?data.length:0,arg.where)
    if(data.status){
      return data.data;
    }
    else
      return [];
  },
  async bookingReport(root,arg) {
    const data = await loopbackRef.app.models.Booking.bookingReport('theAsiaCRM',arg.where);
    // console.log("graphql is working perfect data with where",data.length,arg.where)
    if(data.status){
      return data.data;
    }
    else
      return [];
  },
  async bookingReportSupplier(
    root,
    arg,
    {
      accessToken: { userId },
    },
  ) {
    if (!userId) throw new AuthenticationError('Unauthorized');
    const supplierArg = {
      ...arg,
      supplier_ids: [userId],
    };
    return query.bookingReport(root, supplierArg)
  },
  async paymentsIn(root, arg) {
    logger.debug('payments', arg);
    let params = {};
    if (arg.limit) {
      params.limit = arg.limit;
    }
    if (arg.offset) {
      params.offset = arg.offset;
    }

    if (arg.order) {
      params.order = arg.order;
    }

    const filters = {};
    if ('where' in arg) {
      Object.assign(filters, arg.where);
    }
    if (filters && filters.payment_status && filters.payment_status.length > 0) {
      const filteredStatus = await loopbackRef.app.models.PaymentStatus.find({ where: { affiliate_name: { inq: filters.payment_status } } })
      filters.payment_status_id = { inq: filteredStatus.map(status => status.id) };
      delete filters.payment_status;
    }
    // console.log(filters)
    //only charged and refunded payments
    const filtersObj = {
      payment_status_id: {inq: ['1','2','4','5','6','7']}
    };
    Object.keys(filters).forEach(key => {
      if (key in filters && filters[key] !== null && filters[key].toString().length > 0) {
        filtersObj[key] = filters[key];
      }
    });

    let and = [];
    if (filtersObj.searchTerm) {
      const or = [];
      or.push({
        name: {
          ilike: `%${filtersObj.searchTerm}%`
        }
      });
      or.push({
        id: {
          ilike: `%${filtersObj.searchTerm}%`
        }
      });
      or.push({
        booking_id: {
          ilike: `%${filtersObj.searchTerm}%`
        }
      });
      delete filtersObj.searchTerm;
      and.push({
        or
      });
    }

    if (filtersObj.fromDate && filtersObj.toDate) {
      and = [
        ...and,
        { created_at: { gte: arg.where.fromDate * 1 } },
        { created_at: { lte: arg.where.toDate * 1 } }
      ];
      delete filtersObj.fromDate;
      delete filtersObj.toDate;
    }
    if (and.length > 0) {
      filtersObj.and = and;
    }
    if(!isEmpty(filtersObj))
    params.where = pick(filtersObj, value => !!value);
    params.where = { ...params.where, payment_type: { inq: [ 'Offline', 'AAB Payment', 'Affiliate' ] } };
    const data = await loopbackRef.app.models.Payments.find(params);
    return data;
  },
  async paymentsInCount(root, arg) {
    logger.debug('payments', arg);
    let params = {};
    if (arg.limit) {
      params.limit = arg.limit;
    }
    if (arg.offset) {
      params.offset = arg.offset;
    }

    if (arg.order) {
      params.order = arg.order;
    }

    const filters = {};
    if ('where' in arg) {
      Object.assign(filters, arg.where);
    }

    const filtersObj = {};
    Object.keys(filters).forEach(key => {
      if (key in filters && filters[key] !== null && filters[key].toString().length > 0) {
        filtersObj[key] = filters[key];
      }
    });
    if (filtersObj && filtersObj.payment_status && filtersObj.payment_status.length > 0) {
      const filteredStatus = await loopbackRef.app.models.PaymentStatus.find({ where: { affiliate_name: { inq: filtersObj.payment_status } } })
      filtersObj.payment_status_id = { inq: filteredStatus.map(status => status.id) };
      delete filtersObj.payment_status;
    } else {
      filtersObj.payment_status_id = null;
      delete filtersObj.payment_status;
    }

    let and = [];
    if (filtersObj.searchTerm) {
      const or = [];
      or.push({
        name: {
          ilike: `%${filtersObj.searchTerm}%`
        }
      });
      or.push({
        id: {
          ilike: `%${filtersObj.searchTerm}%`
        }
      });
      or.push({
        booking_id: {
          ilike: `%${filtersObj.searchTerm}%`
        }
      });
      delete filtersObj.searchTerm;
      and.push({
        or
      });
    }

    if (filtersObj.fromDate && filtersObj.toDate) {
      and = [
        ...and,
        { created_at: { gte: arg.where.fromDate * 1 } },
        { created_at: { lte: arg.where.toDate * 1 } }
      ];
      delete filtersObj.fromDate;
      delete filtersObj.toDate;
    }

    if (and.length > 0) {
      filtersObj.and = and;
    }
    if(!isEmpty(filtersObj))
    params.where = pick(filtersObj, value => !!value);

    if(params.where)
    params.where = {
      ...params.where,
      payment_status_id: params.where.payment_status_id || {inq: ['1','2','4','5','6','7']},
      payment_type: { inq: [ 'Offline', 'AAB Payment', 'Affiliate' ] }
    };

    return await loopbackRef.app.models.Payments.count(params.where);
  },
  //transactions reports for affiliate application
  async affiliatePaymentsDownload(root, { where: { searchTerm, payer_id, fromDate, toDate }, order }) {
    logger.debug('inputs', {
			searchTerm,
			payer_id,
			fromDate,
			toDate,
			order,
    });

    const bookingScope = {
			relation: 'paymentsBookingIdFkeyrel',
			scope: {
				include: {
					relation: 'tour',
					scope: {
						fields: ['name'],
					},
				},
				fields: ['trip_starts', 'tour_id'],
			},
		};

		let where = {
      payment_status_id: {inq: ['1','2','4','5','6','7']},
      payment_type: { inq: [ 'Offline', 'AAB Payment', 'Affiliate' ] }
		};
		let and = [];

		if (payer_id)
			where = { ...where, payer_id };
		if (searchTerm && searchTerm !== '' && !isNaN(parseInt(searchTerm, 10))) {
			and.push({
				or: [
					{ id: { ilike: `%${searchTerm}%` } },
					{ booking_id: { ilike: `%${searchTerm}%` } },
				],
			});
		}
		if(fromDate && toDate) {
			and.push({ created_at: { gte: parseInt(fromDate, 10) } });
			and.push({ created_at: { lte: parseInt(toDate, 10) } });
		}

		if (and.length > 0)
			where.and = and;

		//filters for affiliate application
		const filters = {
			where,
			include: bookingScope,
		};

		//construct report from order by or by latest date
		filters.order = order || 'created_at DESC';
		const transactions = await loopbackRef.app.models.Payments.find(filters);
		const dataParser = [];
		transactions.forEach(item => {
			dataParser.push(item.toJSON());
		})

		//filter for requested tour name: description
		let report = [];
		if (searchTerm && searchTerm !== '' && isNaN(parseInt(searchTerm, 10))) {
			let pattern = RegExp('.*'+searchTerm+'.*', "i");
			report = dataParser.filter(transaction => pattern.test(transaction.paymentsBookingIdFkeyrel.tour.name));
		} else {
			report = dataParser;
		}

		const fields = [
			{
			label: 'Trans. ID',
			value: row => `${row.id.toString().padStart(10, '0')}`
			},
			{
			label: 'Trans. Date',
			value: row => moment(row.created_at).format('DD/MM/YYYY')
			},
			{
			label: 'Tour Date',
			value: row => moment(row.paymentsBookingIdFkeyrel.trip_starts).format('DD/MM/YYYY')
			},
			{
			label: 'Booking ID',
			value: row => `18${row.booking_id.toString().padStart(8, '0')}`
			},
			{
			label: 'Description',
			value: 'paymentsBookingIdFkeyrel.tour.name'
			},
			{
			label: 'Amount',
			value: 'total'
			},
			{
			label: 'Currency',
			value: 'currency'
			},
			{
			label: 'Status',
			value: row => AFFILIATE_STATUS[row.payment_status_id]
			},
		]

		const parser = new Json2csvParser({ fields })
		const csv = parser.parse(report)

		return { data: csv };
  },
  availablePaymentOptionsAffiliate(root, params, { accessToken: { id }}) {
    if (!id) throw new Error('Unauthorized')
    return loopbackRef.app.models.Payments.getAvailablePaymentOptions()
  },
  isCompletePayment(root, data, { accessToken }) {
    if (!accessToken.id) throw new Error('Unauthorized')
    return loopbackRef.app.models.Payments.isCompletePayment(data)
  },
};

module.exports = query;
