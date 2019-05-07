// const axios = require('axios');
const _ = require('underscore');
const moment = require('moment');
const Json2csvParser = require('json2csv').Parser


const logger = require('../../logger');
const loopbackRef = require('../../reference');
// const AFFILIATE_STATUS = [
// 	'NO PAYMENT',
// 	'UNPAID',
// 	'PAID',
// 	'',
// 	'REFUND',
// 	'CANCELLED',
// 	'UNPAID',
// 	'PAID'
// ];

const mutation = {
	// use query instead of mutation for affiliate report download...

	// async paymentsDownload(root, { where: { searchTerm, payer_id, fromDate, toDate }, order }) {
	// 	logger.debug('inputs', {
	// 		searchTerm,
	// 		payer_id,
	// 		fromDate,
	// 		toDate,
	// 		order,
	// 	});

	// 	const bookingScope = {
	// 		relation: 'paymentsBookingIdFkeyrel',
	// 		scope: {
	// 			include: {
	// 				relation: 'tour',
	// 				scope: {
	// 					fields: ['name'],
	// 				},
	// 			},
	// 			fields: ['trip_starts', 'tour_id'],
	// 		},
	// 	};

	// 	let where = {
	// 		payment_status_id: {inq: ['0','1','2','4','5','6','7']},
	// 	};
	// 	let and = [];

	// 	if (payer_id)
	// 		where = { ...where, payer_id };
	// 	if (searchTerm && searchTerm !== '' && !_.isNaN(parseInt(searchTerm, 10))) {
	// 		and.push({
	// 			or: [
	// 				{ id: { ilike: `%${searchTerm}%` } },
	// 				{ booking_id: { ilike: `%${searchTerm}%` } },
	// 			],
	// 		});
	// 	}
	// 	if(fromDate && toDate) {
	// 		and.push({ created_at: { gte: parseInt(fromDate, 10) } });
	// 		and.push({ created_at: { lte: parseInt(toDate, 10) } });
	// 	}

	// 	if (and.length > 0)
	// 		where.and = and;

	// 	//filters for affiliate application
	// 	const filters = {
	// 		where,
	// 		include: bookingScope,
	// 	};

	// 	//construct report from order by or by latest date
	// 	filters.order = order || 'created_at DESC';
	// 	const transactions = await loopbackRef.app.models.Payments.find(filters);
	// 	const dataParser = [];
	// 	transactions.forEach(item => {
	// 		dataParser.push(item.toJSON());
	// 	})

	// 	//filter for requested tour name: description
	// 	let report = [];
	// 	if (searchTerm && searchTerm !== '' && _.isNaN(parseInt(searchTerm, 10))) {
	// 		let pattern = RegExp('.*'+searchTerm+'.*', "i");
	// 		report = dataParser.filter(transaction => pattern.test(transaction.paymentsBookingIdFkeyrel.tour.name));
	// 	} else {
	// 		report = dataParser;
	// 	}
		
	// 	const fields = [
	// 		{
	// 		label: 'Trans. ID',
	// 		value: row => `${row.id.toString().padStart(10, '0')}`
	// 		},
	// 		{
	// 		label: 'Trans. Date',
	// 		value: row => moment(row.created_at).format('DD/MM/YYYY')
	// 		},
	// 		{
	// 		label: 'Tour Date',
	// 		value: row => moment(row.paymentsBookingIdFkeyrel.trip_starts).format('DD/MM/YYYY')
	// 		},
	// 		{
	// 		label: 'Booking ID',
	// 		value: row => `18${row.booking_id.toString().padStart(8, '0')}`
	// 		},
	// 		{
	// 		label: 'Description',
	// 		value: 'paymentsBookingIdFkeyrel.tour.name'
	// 		},
	// 		{
	// 		label: 'Amount',
	// 		value: 'total'
	// 		},
	// 		{
	// 		label: 'Currency',
	// 		value: 'currency'
	// 		},
	// 		{
	// 		label: 'Status',
	// 		value: row => AFFILIATE_STATUS[row.payment_status_id]
	// 		},
	// 	]

	// 	const parser = new Json2csvParser({ fields })
	// 	const csv = parser.parse(report)
		
	// 	return { data: csv };
	// },
};

module.exports = mutation;