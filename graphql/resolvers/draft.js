const moment = require('moment');

const axios = require('../axios');
const logger = require('../logger');
const loopbackRef = require('../reference');

module.exports = {
  queries: {
    draft(root, args) {
      logger.debug('draft', { args });
      const { id } = args;

      const { Drafts } = loopbackRef.app.models;

      return Drafts.findById(id, Drafts.defaultFilter).then(draft => draft.toObject());
    },
    drafts(root, args) {
      logger.debug('drafts', { args, root });

      const {
        limit = 10,
        offset = 0,
        order,
        searchTerm,
        currencyCode,
        nationalityId,
        dateCreated,
        dateUpdated,
        tripDate,
      } = args;

      const filter = { limit, offset };

      if (currencyCode) {
        filter.where = {
          ...filter.where,
          booking_currency_code: currencyCode,
        };
      }

      if (nationalityId) {
        filter.where = {
          ...filter.where,
          billing_country_id: nationalityId,
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
                { billing_email: { ilike: `%${searchTerm}%` } },
                { billing_first_name: { ilike: `%${searchTerm}%` } },
                { billing_last_name: { ilike: `%${searchTerm}%` } },
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

      logger.debug('drafts filter:', filter);

      return axios
        .request({
          url: '/drafts',
          method: 'GET',
          params: { filter },
        })
        .then(res => res.data);
    },
    draftsCount() {
      return axios.get('drafts/count').then(res => res.data);
    },
  },
  mutations: {
    addDraft(root, args) {
      logger.debug('addDraft', { args });
      const { input } = args;

      return loopbackRef.app.models.Drafts.create(input).catch(err => err);
      // return axios.post('/drafts', input).then(res => res.data);
    },
    deleteDraft(root, args) {
      logger.debug('deleteDraft', { args });
      const { id } = args;

      return axios.delete(`/drafts/${id}`).then(res => res.data);
    },
    async updateDraft(root, args) {
      logger.debug('updateDraft', { args });
      const { id, input } = args;

      const draft = await loopbackRef.app.models.Drafts.findById(id);
      const updated = await draft.updateAttributes(input);

      return updated;

      // return axios.patch(`/drafts/${id}`, input).then(res => res.data);
    },
  },
  resolvers: {},
};
