const _ = require('underscore');
const reference = require('../../reference');
const { THE_ASIA_API } = require('../../config');
const logger = require('../../logger');
const axios = require('../../axios')

// const THE_ASIA_API = `http://localhost:3003`;
const AFFILIATE_API = `${THE_ASIA_API}/Affiliates`;

const statusDef = ['Pending', 'Active', 'Suspended'];
const resolvers = {
  Affiliate: {
    // only use fkey in User model
    // user_id(affiliate) {
    //   logger.debug('Fetching user from Affiliate ID => ', affiliate.id);

    //   return axios.get(`${AFFILIATE_API}/${affiliate.id}/user`).then(res => res.data);
    // },
    nationality(affiliate) {
      logger.debug('Fetching country => ', affiliate.nationality);

      // return axios.get(`${AFFILIATE_API}/${affiliate.id}/country`).then(res => res.data);
      return reference.app.models.Countries.findById(affiliate.nationality);
    },
    billing_country(affiliate) {
      logger.debug('Fetching billing country  => ', affiliate.billing_country);

      return reference.app.models.Countries.findById(affiliate.billing_country);
    },
    language_id(affiliate) {
      logger.debug('Translating language_id => ', affiliate.language_id);

      // return axios.get(`${THE_ASIA_API}/Languages/${affiliate.language_id}`).then(res => res.data);
      return reference.app.models.Languages.findById(affiliate.language_id);
    },
    languageId(affiliate) {
      return affiliate.language_id
    },
    currency_id(affiliate) {
      logger.debug('Translating currency_id => ', affiliate.currency_id);

      // return axios.get(`${THE_ASIA_API}/Currencies/${affiliate.currency_id}`).then(res => res.data);
      return reference.app.models.Currencies.findById(affiliate.currency_id);
    },
    currencyId(affiliate) {
      return affiliate.currency_id
    },
    status(affiliate) {
      logger.debug('Translating status from Affiliate ID => ', affiliate.id);

      return statusDef[affiliate.status];
    },
  },
};

module.exports = {
  mutations: {
    async addAffiliate(root, { input }) {
      logger.debug('inputs', input);

      try {
        const result = await axios.post(`${AFFILIATE_API}`, input).then(res => res.data);

        return result;
      } catch (e) {
        logger.error('error', e);
        return e;
      }
    },
    async addAffiliateAcct(root, { input }) {
      logger.debug('inputs => ', input);

      try {
        const result = await axios
          .post(`${AFFILIATE_API}/${input.affiliateId}/affiliate_acct`, input)
          .then(res => res.data);

        return result;
      } catch (e) {
        logger.error('error', e);
        return e;
      }
    },
    async updateAffiliate(root, { id, input }, context) {
      logger.debug('inputs', input);

      try {
        const result = await axios.patch(`${AFFILIATE_API}/${id}`, input, {
          headers: {token: context.user },
        }).then(res => res.data);

        return result;
      } catch (e) {
        logger.error('error', e);
        return e;
      }
    },
    async updateAffiliateAcct(root, { input }) {
      logger.debug('inputs => ', input);

      try {
        const result = await axios
          .put(`${AFFILIATE_API}/${input.affiliateId}/affiliate_acct`, input)
          .then(res => res.data);

        return result;
      } catch (e) {
        logger.error('error', e);
        return e;
      }
    },
    async updateAffiliateCompany(root, { account, company }) {
      logger.debug('affiliate', account);
      logger.debug('billingCompany', company);

      try {
        const result = await axios
          .put(`${AFFILIATE_API}/companyInfoUpdates`, { account, company })
          .then(res => res.data);

        return result;
      } catch (e) {
        logger.error('error', e);
        return e;
      }
    },
    deleteAffiliate(root, { id }) {
      return axios
        .delete(`${AFFILIATE_API}/${id}`)
        .then(res => res.data)
        .catch(err => console.log(err.response.data.error.detail));
    },
  },
  query: {
    async affiliates(
      root,
      {
        input: { searchTerm, limit, offset, markupRates, rates, order, status },
      },
    ) {
      logger.debug('affiliates', {
        searchTerm,
        limit,
        offset,
        markupRates,
        rates,
        order,
        status,
      });
      const filters = { order };
      if (limit) {
        filters.limit = limit;
      }
      if (offset) {
        filters.offset = offset;
      }
      if (markupRates) {
        filters.where = { ...filters.where, markupRates };
      }
      if (rates) {
        filters.where = { ...filters.where, rates };
      }
      if (status !== undefined) {
        filters.where = { ...filters.where, status };
      } else {
        filters.where = { ...filters.where, status: { nlike: "0" } };
      }
      if (searchTerm) {
        if (!_.isNaN(parseInt(searchTerm, 10))) {
          filters.where = { ...filters.where, id: searchTerm };
        } else {
          filters.where = {
            ...filters.where,
            and: [
              {
                or: [
                  { company_name: { ilike: `%${searchTerm}%` } },
                  { email: { ilike: `%${searchTerm}%` } },
                  { contact_firstname: { ilike: `%${searchTerm}%` } },
                  { contact_lastname: { ilike: `%${searchTerm}%` } },
                ],
              },
            ],
          };
        }
      }

      logger.debug('filters', filters);

      // const url = `${AFFILIATE_API}?filter=${encodeURIComponent(JSON.stringify(filters))}`;
      // logger.debug('url', url);

      try {
        // const result = await axios.get(url).then(res => res.data);
        // filters.include = reference.app.models.Affiliates.defaultFilter.include;
        const result = await reference.app.models.Affiliates.find(filters);
        // console.log(result[0], 'affiliate');
        return result;
      } catch (e) {
        logger.error('error', e);
        return e;
      }
    },
    async affiliatesCount(root, { input: { searchTerm, markupRates, rates, status } }) {
      logger.debug('where', {
        searchTerm,
        // limit,
        // offset,
        markupRates,
        rates,
        status,
      });

      const filters = {};
      // if (limit) {
      //   filters.limit = limit;
      // }
      // if (offset) {
      //   filters.offset = offset;
      // }
      if (markupRates) {
        filters.where = { ...filters.where, markupRates };
      }
      if (rates) {
        filters.where = { ...filters.where, rates };
      }
      if (status !== undefined) {
        filters.where = { ...filters.where, status };
      } else {
        filters.where = { ...filters.where, status: { nlike: "0" } };
      }
      if (searchTerm) {
        if (!_.isNaN(parseInt(searchTerm, 10))) {
          filters.where = { ...filters.where, id: searchTerm };
        } else {
          filters.where = {
            ...filters.where,
            and: [
              {
                or: [
                  { company_name: { ilike: `%${searchTerm}%` } },
                  { email: { ilike: `%${searchTerm}%` } },
                  { contact_firstname: { ilike: `%${searchTerm}%` } },
                  { contact_lastname: { ilike: `%${searchTerm}%` } },
                ],
              },
            ],
          };
        }
      }

      const result = await reference.app.models.Affiliates.count(filters.where);
      return result;
    },
    async affiliate(root, args) {
      // return axios
      //   .get(`${AFFILIATE_API}/${args.id}`)
      //   .then(res => res.data)
      //   .catch(err => err);
      const result = await reference.app.models.Affiliates.findById(args.id);
      // console.log(result, 'affiliate');
      return result;
    },
    async affiliateAcct(root, args) {
      // return axios
      //   .get(`${AFFILIATE_API}/${args.affiliate_id}/affiliate_acct`)
      //   .then(res => res.data)
      //   .catch(err => err);
      const result = await reference.app.models.AffiliatesBillingAcct.find({ where: { affiliateId: args.affiliate_id } });
      return result[0];
    },
    affiliatesRates() {
      // return axios
      //   .get(`${THE_ASIA_API}/affiliatesRates`)
      //   .then(res => res.data)
      //   .catch(err => err);
      // console.log(reference.app.models.AffiliatesRates);
      return reference.app.models.AffiliatesRates.find();
    },
    affiliatesStatuses() {
      // return axios
      //   .get(`${THE_ASIA_API}/affiliatesStatuses`)
      //   .then(res => res.data)
      //   .catch(err => err);
      return reference.app.models.AffiliatesStatus.find();
    },
    affiliateInvoiceSettings() {
      return reference.app.models.AffiliateInvoiceSettings.find();
    },
    affiliateTypes() {
      return reference.app.models.AffiliateTypes.find();
    },
  },
  resolvers,
};
