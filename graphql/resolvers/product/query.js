const axios = require('axios');
const { pick } = require('underscore');

const { THE_ASIA_API } = require('../../config');
const PRODUCT_DETAILS_MAP = require('../../shared/productDetails');
const logger = require('../../logger');
const axiosIntance = require('../../axios');
const getCurrencyHelper = require('../../helpers/currency');

const INCLUDE_EXCLUDE_API = `${THE_ASIA_API}/ExcludedIncludeds`;
const CITIES_API = `${THE_ASIA_API}/Cities`;
const COUNTRIES_API = `${THE_ASIA_API}/Countries`;
const COUNTRIES_LANG_API = `${THE_ASIA_API}/CountriesLangs`;
const LANGUAGE_API = `${THE_ASIA_API}/Languages`;
const FEATURES_API = `${THE_ASIA_API}/Features`;
const CATEGORIES_API = `${THE_ASIA_API}/Categories`;
const CATEGORY_TYPE_API = `${THE_ASIA_API}/CategoryTypes`;
const CURRENCIES_API = `${THE_ASIA_API}/Currencies`;
const CANCELLATION_POLICIES_API = `${THE_ASIA_API}/CancellationPolicies`;
const NEWSLETTER_SUBSCRIPTIONS = `${THE_ASIA_API}/Newsletters`;
const CONTRACT_LOGO_API = `${THE_ASIA_API}/ContractLogos`;
const PRODUCT_API = `${THE_ASIA_API}/tours`;
const SUB_PRODUCT_API = `${THE_ASIA_API}/SubProducts`;
const SUB_PRODUCT_LANG_API = `${THE_ASIA_API}/SubProductsLangs`;
const PRODUCT_LANG_MODEL = [
  'address',
  'available_day',
  'available_time',
  'departure',
  'description',
  'description_header',
  'highlights',
  'important_information',
  'info',
  'itinerary_name',
  'keywords',
  'location',
  'map',
  'meeting_point',
  'meeting_time',
  'name',
  'opening_time',
  'pax_minimum_details',
  'schema_org',
  'seo_title',
  'seo_description',
  'seo_keywords',
  'short_description',
  'show_time',
  'tags',
  'telephone',
  'tour_duration',
  'enable',
];
const SUB_PRODUCT_LANG_MODEL = [
  'address',
  'departure',
  'itinerary',
  'location',
  'map',
  'meeting_point',
  'meeting_time',
  'meta_data',
  'name',
  'opening_time',
  'pickup_location_time',
  'short_description',
  'show_time',
  'telephone',
  'tour_duration',
  'meeting_point',
  'meeting_time',
  'notice',
];

const where = query => encodeURIComponent(JSON.stringify({ where: query }));

const getAndOr = (and, values, key) => {
  if (values && values.length > 0) {
    const or = [];
    values.forEach(value => {
      or.push({ [key]: value });
    });
    and.push({ or });
  }
  return [...and];
};

const query = {
  cancellationPolicies() {
    return axios
      .get(CANCELLATION_POLICIES_API)
      .then(res => res.data)
      .catch(err => err);
  },
  categories() {
    return axios
      .get(CATEGORIES_API)
      .then(res => res.data)
      .catch(err => err);
  },
  categoryTypes() {
    return axios
      .get(CATEGORY_TYPE_API)
      .then(res => res.data)
      .catch(err => err);
  },
  cityList() {
    return axios
      .get(CITIES_API)
      .then(res => {
        res.data.push({ id: 9999999, name: 'All', value: 9999999 });
        return res.data;
      })
      .catch(err => err);
  },
  contractLogos() {
    return axios
      .get(CONTRACT_LOGO_API)
      .then(res => res.data)
      .catch(err => err);
  },
  currencies() {
    return axios
      .get(CURRENCIES_API)
      .then(res => res.data)
      .catch(err => err);
  },
  async getCountryById(root, params, context) {
    if (params.lang && params.lang.length > 0 && params.lang !== 'en') {
      const getLangParams = { langCode: params.lang };
      const getLang = await query.getLanguageCode(null, getLangParams, context);
      const filter = encodeURIComponent(
        JSON.stringify({ where: { country_id: params.id, lang_id: getLang.id } }),
      );

      return axios
        .get(`${COUNTRIES_LANG_API}?filter=${filter}&access_token=${context.user.id}`)
        .then(res => res.data[0])
        .catch(err => err);
    }
    return axios
      .get(`${COUNTRIES_API}/${params.id}?access_token=${context.user.id}`)
      .then(res => res.data)
      .catch(err => err);
  },
  getLanguageCode(root, params, context) {
    const filter = where({ code: params.langCode });
    const url = `${LANGUAGE_API}/findone?filter=${filter}`;
    return axios
      .get(`${url}&access_token=${context.user.id}`)
      .then(res => res.data)
      .catch(err => err);
  },
  async getSubProductById(root, params, context) {
    if (params.lang && params.lang.length > 0 && params.lang !== 'en') {
      const getLangParams = { langCode: params.lang };
      const getLang = await query.getLanguageCode(null, getLangParams, context);
      const filter = where({ sub_product_id: params.id, lang_id: getLang.id });

      return axios
        .get(`${SUB_PRODUCT_LANG_API}?filter=${filter}&access_token=${context.user.id}`)
        .then(res => res.data[0])
        .catch(err => err);
    }
    return axios
      .get(`${SUB_PRODUCT_API}/${params.id}?access_token=${context.user.id}`)
      .then(res => res.data)
      .catch(err => err);
  },
  includeExcludeList() {
    return axios
      .get(INCLUDE_EXCLUDE_API)
      .then(res => res.data)
      .catch(err => err);
  },
  languageList(root, { available }) {
    if (available !== undefined) {
      const filter = where({ locale_available: available });
      return axios
        .get(`${LANGUAGE_API}/?filter=${filter}`)
        .then(res => res.data)
        .catch(err => err);
    }
    return axios
      .get(LANGUAGE_API)
      .then(res => res.data)
      .catch(err => err);
  },
  newsletters() {
    return axios
      .get(`${NEWSLETTER_SUBSCRIPTIONS}`)
      .then(res => res.data)
      .catch(err => err);
  },
  async product(_, { id, lang, langCode, supplier_id }) {
    logger.debug('product ==========');
    logger.debug({ id, lang, langCode });

    const product = await axios.get(`${PRODUCT_API}/${id}`).then(res => res.data);
    logger.debug({ default_language_id: product.default_language_id });
    // eslint-disable-next-line eqeqeq
    if (supplier_id && supplier_id != product.supplier_id) {
      const e = new Error('Product Not found');
      return e;
    }
    // Find by lang id
    if (lang && lang !== product.default_language_id) {
      const productLang = product.localization.find(prod => prod.lang_id === lang) || {};
      PRODUCT_LANG_MODEL.forEach(key => {
        product[key] = productLang[key] || '';
      });

      // need to pass the id as a reference for updating the translation
      product.products_lang_id = productLang.id;
      return product;
    }

    // Find by locale code gets from URL
    if (langCode) {
      const filter = where({ code: langCode });
      const url = `${LANGUAGE_API}/findone?filter=${filter}`;
      logger.debug('url', url);

      try {
        // Get language data by code
        const langResult = await axios.get(url).then(res => res.data);
        logger.debug('langResult', langResult);

        // Do nothing if it is default language
        if (langResult.id.toString() === product.default_language_id.toString()) {
          logger.debug(`${langCode} is default language`);
          return product;
        }

        const productLang =
          product.localization.find(prod => prod.lang_id.toString() === langResult.id.toString()) ||
          {};
        logger.debug('localization', product.localization, '\n', productLang);

        PRODUCT_LANG_MODEL.forEach(key => {
          product[key] = productLang[key] || '';
          logger.debug(`set product.${key} = ${productLang[key]}`);
        });

        // NOTE: excluded_included field has different structure
        // compare to other fields with localization
        const excluded_included = product.excluded_included.map(i => {
          const { exclude_include } = i;
          const { name } = exclude_include.localization.find(
            // NOTE: id can be string or number 😞
            l => String(l.lang_id) === String(langResult.id),
          );
          exclude_include.name = name;
          return i;
        });
        product.excluded_included = excluded_included;

        // need to pass the id as a reference for updating the translation
        product.products_lang_id = productLang.id;
        logger.debug(`set product.products_lang_id = ${product.products_lang_id}`);
      } catch (e) {
        logger.error(`Can not get language data from code => ${langCode}`, e);
      }

      return product;
    }

    product.products_lang_id = product.default_language_id;
    return product;
  },
  productDetailList() {
    return PRODUCT_DETAILS_MAP;
  },
  productFeatures() {
    return axios
      .get(FEATURES_API)
      .then(res => res.data)
      .catch(err => err);
  },
  productPriceRange() {
    return axiosIntance.get('/tours/getpricerange').then(res => res.data);
  },
  products(root, arg) {
    logger.debug('products', arg);
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
    if ('filters' in arg) {
      Object.assign(filters, arg.filters);
    }

    const filtersObj = {};
    Object.keys(filters).forEach(key => {
      if (key in filters && filters[key] !== null && filters[key].toString().length > 0) {
        filtersObj[key] = filters[key];
      }
    });

    let and = [];
    if (filtersObj.keywords) {
      const or = [];
      or.push({ name: { ilike: `%${filtersObj.keywords}%` } });
      or.push({ id: { ilike: `%${filtersObj.keywords}%` } });
      delete filtersObj.keywords;
      and.push({ or });
    }

    const { city_ids, feature_ids, category_ids } = filtersObj;
    and = getAndOr(and, city_ids, 'city_id');
    and = getAndOr(and, feature_ids, 'feature_id');
    and = getAndOr(and, category_ids, 'category_id');

    if (and.length > 0) {
      filtersObj.and = and;
    }
    params.where = pick(filtersObj, value => !!value);
    params = encodeURI(JSON.stringify(params));
    return axios.get(`${PRODUCT_API}?filter=${params}`).then(res => res.data || []);
  },
  productsCount(root, arg) {
    logger.debug('productsCount', arg);
    const params = {};

    if (arg.where) {
      /** Extract special fields from `where`
       * because it use special key (`or`) in `where` object
       *  */
      const { searchTerm, city_ids, feature_ids, category_ids, ...rest } = arg.where;
      params.where = pick(rest, value => !!value);

      let and = [];
      if (searchTerm) {
        const or = [];
        or.push({ name: { ilike: `%${searchTerm}%` } });
        or.push({ id: { ilike: `%${searchTerm}%` } });
        and.push({ or });
      }

      and = getAndOr(and, city_ids, 'city_id');
      and = getAndOr(and, feature_ids, 'feature_id');
      and = getAndOr(and, category_ids, 'category_id');

      if (and.length > 0) {
        logger.debug({ and });
        params.where.and = and;
      }
    }

    return axiosIntance
      .get('/tours/count', {
        params,
      })
      .then(res => res.data.count);
  },
  async productsDiscover(root, arg) {
    const { currency_code, ...rest } = arg;
    const { data: discover } = await axiosIntance.get('/tours/discover', { params: { ...rest } });
    if (!currency_code || currency_code === 'USD') {
      return discover;
    }

    discover.products = discover.products.map(i => {
      const currencyHelper = getCurrencyHelper();
      let starting_price = 0;
      try {
        starting_price = currencyHelper.asyncConvert(i.starting_price, 'USD', currency_code);
      } catch (e) {
        logger.error('[productsDiscover]', e);
      }
      return { ...i, starting_price };
    });

    return discover;
  },
  suppliersCurrencies() {
    return axios
      .get(CURRENCIES_API)
      .then(res => res.data.filter(item => item.supplier_currency))
      .catch(err => err);
  },
  async subProduct(root, { id, languageCode }) {
    logger.debug('subProduct ==========');
    logger.debug('input', { id, languageCode });

    const requests = [];
    const subProductRequest = axios.get(`${SUB_PRODUCT_API}/${id}`).then(res => res.data);
    requests.push(subProductRequest);

    if (languageCode && languageCode !== 'en') {
      const languageApiUrl = `${LANGUAGE_API}/findone?filter=${where({ code: languageCode })}`;
      logger.debug('languageApiUrl =>', languageApiUrl);
      const languageRequest = axios.get(languageApiUrl).then(res => res.data);

      requests.push(languageRequest);
    }

    const [subProduct, language] = await Promise.all(requests);

    if (!subProduct) {
      logger.debug('subProduct not found');
      return null;
    }

    if (!language) {
      // Use default sub product data
      logger.debug('Use default language');
      return subProduct;
    }

    logger.debug('language =>', language);

    const subProductLang =
      subProduct.localization.find(prod => prod.lang_id.toString() === language.id.toString()) ||
      {};
    logger.debug('localization', subProductLang.localization, '\n', subProductLang);

    // To map localization fields with sub-product fields
    SUB_PRODUCT_LANG_MODEL.forEach(key => {
      subProduct[key] = subProductLang[key];
      logger.debug(`set subProduct.${key} = ${subProductLang[key]}`);
    });

    // Additional field use when update
    subProduct.lang_id = subProductLang.lang_id;

    return subProduct;
  },
};

module.exports = query;
