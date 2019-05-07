const {
  pick,
  isEmpty,
  isNaN
} = require('underscore');
const moment = require('moment');
const Json2csvParser = require('json2csv').Parser

const {
  THE_ASIA_API
} = require('../../config');
const logger = require('../../logger');
const loopbackRef = require('../../reference')
const axiosIntance = require('../../axios');
const PAYMENTS_API = `${THE_ASIA_API}/Payments`;
const axios = require('../../axios')

const PAYOUT_API = `${THE_ASIA_API}/payouts`;
const where = query => encodeURIComponent(JSON.stringify({
  where: query
}));

const query = {
  async invoices(root, { where }, context) {
		let params = {
      order : 'created_at DESC',
      where: {}
    };
    // let filters = {};
     
		if (where && where.limit) {
      params.limit = where.limit;
    }
    if (where && where.offset) {
      params.offset = where.offset;
    }
    if (where && where.payer_id && where.payer_id.length) {
      params.where.payer_id = { inq: where.payer_id }
    }
    if (where && where.status && where.status.length) {
      params.where.status = { inq: where.status }
		}
    if (where.created_at) {
      if(where.created_at.from && where.created_at.to) {
        params.where.created_at = {
          between: [
            `${moment(where.created_at.from).format('YYYY-MM-DD')}T00:00:00.000Z`,
            `${moment(where.created_at.to).format('YYYY-MM-DD')}T23:59:00.000Z`,
          ]
        }
      }
      else if (where.created_at.from) {
        params.where.created_at = {
          between: [
            `${moment(where.created_at.from).format('YYYY-MM-DD')}T00:00:00.000Z`,
            `${moment(where.created_at.from).format('YYYY-MM-DD')}T23:59:00.000Z`,
          ]
        }
      }
      else if(where.created_at.to) {
        params.where.created_at = {
          between: [
            `${moment(where.created_at.to).format('YYYY-MM-DD')}T00:00:00.000Z`,
            `${moment(where.created_at.to).format('YYYY-MM-DD')}T23:59:00.000Z`,
          ]
        }
      }
    }
    if (where && where.searchTerm) {
      if (!isNaN(parseInt(where.searchTerm, 10))) {
        const invoices = await loopbackRef.app.models.Invoices.find(params);
        const foundBooking = invoices.find(invoice => invoice.details.includes(where.searchTerm) && where.payer_id.includes(parseInt(invoice.payer_id, 10)));
        const selected = [];

        if (foundBooking) {
          selected.push(foundBooking.id);
        }

        params.where = { 
          ...params.where,
          and: [
            {
              or: [
                { id: { inq: [...selected, where.searchTerm.length == 10 ? where.searchTerm.slice(2).replace(/^(0+)/g, '') : where.searchTerm] } },
              ],
            },
          ],
        };
      } 
      // else {
      //   params.where = {
      //     ...params.where,
      //     and: [
      //       {
      //         or: [
      //           { company_name: { ilike: `%${searchTerm}%` } },
      //           { email: { ilike: `%${searchTerm}%` } },
      //           { contact_firstname: { ilike: `%${searchTerm}%` } },
      //           { contact_lastname: { ilike: `%${searchTerm}%` } },
      //         ],
      //       },
      //     ],
      //   };
      // }
    }

    return await loopbackRef.app.models.Invoices.find(params);
	},
	async invoice(root, args) {
		return await loopbackRef.app.models.Invoices.findById(args.id);
	},
	async invoicesCount(root, arg) {
    //logger.debug('payoutsCount', arg);
    let params = {};
    if (!arg.where) return loopbackRef.app.models.Invoices.count(params);

    if (arg.where && arg.where.status || arg.where.payer_id || arg.where.receiver_id || arg.where.created_at) {
      if (arg.where.status && arg.where.status.length){
        params.status =  { inq: arg.where.status }
      }
      if (arg.where.payer_id && arg.where.payer_id.length) {
        params.payer_id = { inq: arg.where.payer_id }
      }
      if (arg.where.created_at) {
        if(arg.where.created_at.from && arg.where.created_at.to) {
          params.created_at = {
            between: [
              `${moment(arg.where.created_at.from).format('YYYY-MM-DD')}T00:00:00.000Z`,
              `${moment(arg.where.created_at.to).format('YYYY-MM-DD')}T23:59:00.000Z`,
            ]
          }
        }
        else if (arg.where.created_at.from) {
          params.created_at = {
            between: [
              `${moment(arg.where.created_at.from).format('YYYY-MM-DD')}T00:00:00.000Z`,
              `${moment(arg.where.created_at.from).format('YYYY-MM-DD')}T23:59:00.000Z`,
            ]
          }
        }
        else if(arg.where.created_at.to) {
          params.created_at = {
            between: [
              `${moment(arg.where.created_at.to).format('YYYY-MM-DD')}T00:00:00.000Z`,
              `${moment(arg.where.created_at.to).format('YYYY-MM-DD')}T23:59:00.000Z`,
            ]
          }
        }
      }
      if (arg.where && arg.where.searchTerm) {
        // console.log(where.searchTerm)
        if (!isNaN(parseInt(arg.where.searchTerm, 10))) {
          const invoices = await loopbackRef.app.models.Invoices.find(params);
          const foundBooking = invoices.find(invoice => invoice.details.includes(arg.where.searchTerm) && arg.where.payer_id.includes(parseInt(invoice.payer_id, 10)));
          const selected = [];

          if (foundBooking) {
            selected.push(foundBooking.id);
          }

          params = { 
            ...params,
            and: [
              {
                or: [
                  { id: { inq: [...selected, arg.where.searchTerm.length == 10 ? arg.where.searchTerm.slice(2).replace(/^(0+)/g, '') : arg.where.searchTerm] } },
                ],
              },
            ],
          };
        } 
      }
    }
    const count = await loopbackRef.app.models.Invoices.count(params);
    // console.log('all filter',JSON.stringify(params),count);
    return count || 0;
  }
};

module.exports = query;
