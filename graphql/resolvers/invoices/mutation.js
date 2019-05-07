const { pick, isArray } = require('underscore');

const { THE_ASIA_API } = require('../../config');
const ErrorResponse = require('../../shared/error');
const logger = require('../../logger');
const loopbackRef = require('../../reference');
const axios = require('../../axios')

const query = require('./query');


module.exports = {
  async editInvoiceItems(root,{ input },context) {
    logger.debug('edit invoie details', input);

    const result = await loopbackRef.app.models.Invoices.editItems(input.id, input.details);

		return {
			id: result.id || input.id,
			status: result.status,
			message: result.message,
			itemsAdded: result.added,
			itemsRemoved: result.removed
		}
  },
  async updateInvoiceStatus(root,{ input },context) {
		logger.debug('update invoice status', input);
		
		const result = await loopbackRef.app.models.Invoices.updateStatus(input.id, input.status);

		return {
			id: result.id,
			status: result.status,
			message: result.message
		}
  }
};
