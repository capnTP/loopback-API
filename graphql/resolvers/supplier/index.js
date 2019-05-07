const _ = require('underscore');
const reference = require('../../reference');
const { THE_ASIA_API } = require('../../config');
const logger = require('../../logger');
const axios = require('../../axios')

// const THE_ASIA_API = `http://localhost:3003`;
const SUPPLIER_API = `${THE_ASIA_API}/Suppliers`;

const resolvers = {
  Supplier: {
    async country(supplier) {
      // console.log('lets see ', supplier);
      logger.debug('Fetching country from Supplier ID => ', supplier.id);
      return await reference.app.models.Countries.findById(supplier.country_id);
    },
    async currency(supplier) {
      // console.log('lets see ', supplier);
      logger.debug('Fetching country from Supplier ID => ', supplier.id,supplier.currency_id);
      return await reference.app.models.Currencies.findById(supplier.currency_id);
    },
  },
};

module.exports = {
  mutations: {
    async addSupplier(root, { input }) {
      try {
        const result = await reference.app.models.Suppliers.create(input);
        return result;
      } catch (e) {
        logger.error('error', e);
        return e;
      }
    },
    async addSupplierPaymentAccount(root, { input }) {
      try {
        const result = await reference.app.models.SuppliersPaymentAccounts.create(input);
        return result;
      } catch (e) {
        logger.error('error', e);
        return e;
      }
    },
    async updateSupplierPaymentAccount(root, { id, input }) {
      logger.debug('inputs', input);

      try {
        const supplierPaymentAccount = await reference.app.models.SuppliersPaymentAccounts.findById(id);
        if(supplierPaymentAccount) {
          const success = await supplierPaymentAccount.updateAttributes(input);
         return supplierPaymentAccount;
        }
        else {
          throw new Error('Supplier profile not found')
        }
      } catch (e) {
        logger.error('error', e);
        return e;
      }
    },
    async makeDefaultSupplierPaymentAccount(root, {supplier_id,account_id}) {
      const result = await reference.app.models.Suppliers.makeDefault(supplier_id,account_id);
      return result;
    },
    async updateSupplier(root, { id, input }) {
      logger.debug('inputs', input);

      try {
        delete input.reservation_email;
        delete input.company_name;
        const supplier = await reference.app.models.Suppliers.findById(id);
        if(supplier) {
          const success = await supplier.updateAttributes(input);
         return supplier;
        }
        else {
          throw new Error('Supplier profile not found')
        }
      } catch (e) {
        logger.error('error', e);
        return e;
      }
    }
  },
  query: {
    async suppliers(
      root,
      {
        input = {},
      }
    ) {
      const { searchTerm, order } = input || {};
      const filters = { order };
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
                  { name: { ilike: `%${searchTerm}%` } }
                ],
              },
            ],
          };
        }
      }
      // const url = `${SUPPLIER_API}?filter=${encodeURIComponent(JSON.stringify(filters))}`;
      // logger.debug('url', url);

      try {
        // const result = await axios.get(url).then(res => res.data);
        filters.include = reference.app.models.Suppliers.defaultFilter.include;
        const result = await reference.app.models.Suppliers.find(filters);
        // console.log(result[0], 'supplier');
        return result;
      } catch (e) {
        logger.error('error', e);
        return e;
      }
    },
    async supplier(root, args) {
      // return axios
      //   .get(`${SUPPLIER_API}/${args.id}`)
      //   .then(res => res.data)
      //   .catch(err => err);
      const result = await reference.app.models.Suppliers.findById(args.id);
      // console.log(result, 'supplier');
      return result;
    },
    SuppliersPaymentAccounts(root, args) {
      // return axios
      //   .get(`${SUPPLIER_API}/${args.supplier_id}/billing_accounts`)
      //   .then(res => res.data)
      //   .catch(err => err);
      return reference.app.models.SuppliersPaymentAccounts.find({ where: { supplier_id: args.supplier_id } });
    }
  },
  resolvers,
};
