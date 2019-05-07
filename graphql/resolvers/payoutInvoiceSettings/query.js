const axios = require('axios');
const {
  pick
} = require('underscore');

const {
  THE_ASIA_API
} = require('../../config');
const logger = require('../../logger');
const loopbackRef = require('../../reference')

const query = {
  async payoutInvoiceSettings(root, arg) {
    return await loopbackRef.app.models.PayoutInvoiceSettings.find();
  },
  async payoutInvoiceSetting(_, {
    id
  }) {
    return await loopbackRef.app.models.PayoutInvoiceSettings.findById(id);
  }
};

module.exports = query;
