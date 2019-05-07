const { pick, isArray } = require('underscore');

const { THE_ASIA_API } = require('../../config');
const ErrorResponse = require('../../shared/error');
const logger = require('../../logger');
const loopbackRef = require('../../reference');
const axios = require('../../axios')

const query = require('./query');

const COUNTRIES_API = `${THE_ASIA_API}/Countries`;
const COUNTRIES_LANG_API = `${THE_ASIA_API}/CountriesLangs`;
const LANGUAGE_API = `${THE_ASIA_API}/Languages`;
const SUPPLIERS_API = `${THE_ASIA_API}/Suppliers`;
const MEDIAS_API = `${THE_ASIA_API}/Medias`;
const PRODUCT_API = `${THE_ASIA_API}/tours`;
const PRODUCT_LANG_API = `${THE_ASIA_API}/tourslangs`;
const SUB_PRODUCT_API = `${THE_ASIA_API}/SubProducts`;
const SUB_PRODUCT_LANG_API = `${THE_ASIA_API}/SubProductsLangs`;
const SUB_PRODUCT_PRICING_API = `${THE_ASIA_API}/Pricings`;
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

const where = arg => encodeURIComponent(JSON.stringify({ where: arg }));

module.exports = {
  async addCountryByLang(root, { input }, context) {
    const params = input;
    if (
      params.lang &&
      params.lang.length > 0 &&
      params.lang !== 'en' &&
      params.id &&
      params.id.length > 0
    ) {
      const getLangParams = { langCode: params.lang };
      const getLang = await query.getLanguageCode(null, getLangParams, context);
      const updateParams = Object.assign({}, params);
      updateParams.lang_id = getLang.id;
      updateParams.country_id = updateParams.id;
      delete updateParams.id;
      delete updateParams.lang;
      return axios
        .post(`${COUNTRIES_LANG_API}?access_token=${context.user.id}`, updateParams)
        .then(res => res.data)
        .catch(err => err);
    }
    return null;
  },
  async updateCountryFlag(root, params, context) {
    const input = Object.assign({}, params);
    delete input.id;
    return axios
      .patch(`${COUNTRIES_API}/${params.id}?access_token=${context.user.id}`, input)
      .then(res => res.data)
      .catch(err => err);
  },
  deleteCountryById(root, params) {
    logger.log('deleteCity', params);
    return axios
      .delete(`${COUNTRIES_API}/${params.id}`)
      .then(res => res.data)
      .catch(err => {
        logger.error(err);
        return err;
      });
  },
  async updateCountryById(root, { input }, context) {
    const params = input;
    if (params.lang && params.lang.length > 0 && params.lang !== 'en') {
      const getLangParams = { langCode: params.lang };
      const getLang = await query.getLanguageCode(null, getLangParams, context);
      const updateParams = Object.assign({}, params);
      updateParams.country_id = params.id;
      updateParams.lang_id = getLang.id;
      delete updateParams.id;
      delete updateParams.lang;
      return axios
        .patch(`${COUNTRIES_LANG_API}?access_token=${context.user.id}`, updateParams)
        .then(res => res.data[0])
        .catch(err => err);
    }
    const updateParams = Object.assign({}, params);
    delete updateParams.id;
    delete updateParams.lang;
    return axios
      .patch(`${COUNTRIES_API}/${params.id}?access_token=${context.user.id}`, updateParams)
      .then(res => res.data)
      .catch(err => err);
  },
  deleteProduct(root, { id }) {
    logger.debug('deleteProduct ==========');
    logger.debug('id', id);
    return axios
      .delete(`${PRODUCT_API}/${id}`)
      .then(res => res.data)
      .catch(err => new ErrorResponse(err.response.data.error));
  },
  deleteSubProduct(root, { id }) {
    return axios
      .delete(`${SUB_PRODUCT_API}/${id}`)
      .then(res => res.data)
      .catch(err => new ErrorResponse(err.response.data.error));
  },
  enterProduct(root, args, context) {
    logger.debug('enterProduct', args);

    const { input } = args;
    axios.defaults.headers.common.Authorization = context.user.id;

    return axios
      .post(PRODUCT_API, input)
      .then(res => res.data)
      .catch(err => new ErrorResponse(err.response.data.error));
  },
  async updateProduct(root, { input, lang, productLangId }) {
    // axios.defaults.headers.common.Authorization = context.user.id;
    logger.debug('updateProduct ==========');
    logger.debug({ input, lang, productLangId });
    const productId = input.id;

    if (lang && lang.toString() !== input.default_language_id.toString()) {
      logger.debug(`${lang} is not default language id`);

      const inputLang = Object.assign(pick(input, PRODUCT_LANG_MODEL), {
        lang_id: lang,
        tour_id: productId,
      });
      logger.debug('inputLang', inputLang);

      if (!productLangId) {
        logger.debug('No products_lang_id\n Change to create mode');
        return axios
          .post(PRODUCT_LANG_API, inputLang)
          .then(res => res.data)
          .catch(err => new ErrorResponse(err.response.data.error));
      }

      const endpoint = `${PRODUCT_LANG_API}/${productLangId}`;
      return axios
        .patch(endpoint, inputLang)
        .then(res => ({ ...res.data, id: productId, status: input.status }))
        .catch(err => new ErrorResponse(err.response.data.error));
    }

    if (isArray(input.category)) {
      await axios.delete(`${PRODUCT_API}/${input.id}/categories`);
      logger.debug('Remove all categories completed');

      const postCategoryRequests = input.category.map(f =>
        axios.post(`${PRODUCT_API}/${input.id}/categories`, {
          category_id: f,
          tour_id: input.id,
        }),
      );
      await Promise.all(postCategoryRequests);
      logger.debug('Insert categories completed');
    }

    if (isArray(input.feature)) {
      await axios.delete(`${PRODUCT_API}/${input.id}/features`);
      logger.debug('Remove all features completed');

      const postFeatureRequests = input.feature.map(f =>
        axios.post(`${PRODUCT_API}/${input.id}/features`, {
          feature_id: f,
          tour_id: input.id,
        }),
      );
      await Promise.all(postFeatureRequests);
      logger.debug('Insert features completed');
    }

    return axios
      .patch(`${PRODUCT_API}/${productId}`, input)
      .then(res => res.data)
      .catch(err => new ErrorResponse(err.response.data.error));
  },
  async updateProductMedia(root, { input }) {
    logger.debug('updateProductMedia test ==========');
    logger.debug('Input', input);

    const id = JSON.stringify({ id: input.mainMediaId });
    const apiFields = {
      alt_text: input.alt_text,
      order: input.order,
      description: input.description,
      id: input.id,
      tour_id: input.tour_id,
      is_primary: input.is_primary,
      is_thumbnail: input.is_thumbnail,
    };

    try {
      await axios.post(`${MEDIAS_API}${'/update?where='}${id}`, apiFields).then(res => res.data);
      logger.debug('Update success');

      return input;
    } catch (e) {
      logger.error(e);
      throw e;
    }
  },
  async updateSubProduct(root, arg, context) {
    logger.debug('updateSubProduct', { arg, context });

    const { id, input, languageCode, deleteCalendarPrice = false } = arg;

    if (!languageCode || languageCode === 'en') {
      try {
        logger.debug('Use default language');
        const responseData = await axios
          .patch(`${SUB_PRODUCT_API}/${id}`, input)
          .then(res => res.data);

        // reset pricing
        if (deleteCalendarPrice) {
          await axios.post(`${SUB_PRODUCT_API}/deletecalenderprice`, { id });
          logger.debug('deleteCalendarPrice > done');
        }

        return responseData;
      } catch (error) {
        logger.error('updateSubProduct > 1', error);
        return error;
      }
    }

    // To find language ID
    const languageApiUrl = `${LANGUAGE_API}/findone?filter=${where({ code: languageCode })}`;
    logger.debug('languageApiUrl =>', languageApiUrl);
    const languageData = await axios.get(languageApiUrl).then(res => res.data);
    logger.debug('language data', languageData);

    if (!languageData) {
      logger.debug('Use default language');
      return axios.patch(`${SUB_PRODUCT_API}/${id}`, input).then(res => res.data);
    }

    // To pick only fields available for /SubProductsLangs
    const inputLang = Object.assign(pick(input, SUB_PRODUCT_LANG_MODEL));
    logger.debug('inputLang', inputLang);

    // To check if target localization exists
    // If not, use POST
    // If yes, use PATCH
    const subProduct = await axios.get(`${SUB_PRODUCT_API}/${id}`).then(res => res.data);
    const localization = subProduct.localization || [];
    logger.debug('localization', localization);

    const subProductLang = localization.find(
      l => l.lang_id.toString() === languageData.id.toString(),
    );
    logger.debug('subProductLang', subProductLang);

    if (!subProductLang) {
      logger.debug('creation mode');
      return (
        axios
          .post(`${SUB_PRODUCT_LANG_API}`, {
            ...inputLang,
            lang_id: languageData.id,
            sub_product_id: id,
          })
          // NOTE: return as SupProduct, not SubProductLang
          .then(res => {
            const updatedData = { ...pick(res.data, SUB_PRODUCT_LANG_MODEL) };
            logger.debug('success', {
              ...subProduct,
              ...updatedData,
            });
            return {
              ...subProduct,
              ...updatedData,
            };
          })
      );
    }

    logger.debug('updating mode');
    return (
      axios
        .patch(`${SUB_PRODUCT_LANG_API}/${subProductLang.id}`, inputLang)
        // NOTE: return as SupProduct, not SubProductLang
        .then(res => {
          const updatedData = { ...pick(res.data, SUB_PRODUCT_LANG_MODEL) };
          logger.debug('success', {
            ...subProduct,
            ...updatedData,
          });
          return {
            ...subProduct,
            ...updatedData,
          };
        })
    );
  },
  async updateSubProductPricing(root, { id, input }) {
    logger.debug('updateSubProductPricing', { id, input });

    const data = {
      sub_product_id: id,
      from: input.startDate,
      to: input.endDate,
      override_price: JSON.stringify(input.pricing),
    };

    if (input.id) {
      data.id = input.id;
    }

    logger.debug('data', { data });

    return axios.patch(SUB_PRODUCT_PRICING_API, data).then(res => {
      const parsed = {
        ...res.data,
        override_price: JSON.parse(res.data.override_price),
      };
      logger.debug('done', parsed);

      return parsed;
    });
  },
  async replaceExcludedIncluded(root, { tourId, input }) {
    try {
      await axios.delete(`${PRODUCT_API}/${tourId}/excluded_included`);
    } catch (error) {
      logger.error({ error });
    }
    const requests = input.map(item =>
      axios.post(`${PRODUCT_API}/${tourId}/excluded_included`, item),
    );

    return Promise.all(requests);
  },
  deleteMedia(root, { id }) {
    return axios
      .delete(`${MEDIAS_API}/${id}`, id)
      .then(res => res.data)
      .catch(err => console.log('err : ', err.response.data.error));
  },
  deleteSupplier(root, { id }) {
    return axios
      .delete(`${SUPPLIERS_API}/${id}`, id)
      .then(res => res.data)
      .catch(err => console.log('err : ', err.response.data.error));
  },
  duplicateProduct(root, { id, name, supplier_id }) {
    logger.debug(id, name, supplier_id);
    return loopbackRef.app.models.Tours.duplicate(id, name, supplier_id);
  },
  async addSubProduct(root, { input }, context) {
    axios.defaults.headers.common.Authorization = context.user.id;
    if (input.lang && input.lang.length > 0 && input.lang !== 'en' && input.sub_product_id) {
      const langParams = { langCode: input.lang };
      const getLang = await query.getLanguageCode(null, langParams, context);
      const params = Object.assign({}, input);
      params.lang_id = getLang.id;
      return axios
        .post(`${SUB_PRODUCT_LANG_API}?access_token=${context.user.id}`, params)
        .then(res => res.data)
        .catch(err => err);
    }

    const params = Object.assign({}, input);
    if ('sub_product_id' in params) {
      delete params.sub_product_id;
      delete params.lang;
    }

    return axios
      .post(`${SUB_PRODUCT_API}?access_token=${context.user.id}`, params)
      .then(res => res.data)
      .catch(err => err);
  },
  async updateSubproductById(root, { input }, context) {
    if (input.lang && input.lang.length > 0 && input.lang !== 'en') {
      const langParams = { langCode: input.lang };
      const getLang = await query.getLanguageCode(null, langParams, context);
      const params = Object.assign({}, input);
      params.lang_id = getLang.id;
      params.sub_product_id = input.id;
      delete params.id;
      const filter = encodeURIComponent(
        JSON.stringify({
          sub_product_id: input.id,
          lang_id: getLang.id,
        }),
      );

      delete params.sub_product_id;
      delete params.lang_id;
      delete params.lang;

      return axios
        .post(
          `${SUB_PRODUCT_LANG_API}/update?where=${filter}&access_token=${context.user.id}`,
          params,
        )
        .then(res => res.data)
        .catch(err => err);
    }
    axios.defaults.headers.common.Authorization = context.user.id;
    return axios
      .patch(`${SUB_PRODUCT_API}/${input.id}?access_token=${context.user.id}`, input)
      .then(res => res.data)
      .catch(err => err);
  },
};
