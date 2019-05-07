const axios = require('axios');
const { isArray } = require('underscore');

const { THE_ASIA_API, IMGIX_API: IMGIX_BASE_URL } = require('../../config');
const axiosInstance = require('../../axios');
const asyncGetLanguages = require('../../helpers/asyncGetLanguages');
const asyncGetCategories = require('../../helpers/asyncGetCategories');
const asyncResolveLocalization = require('../../helpers/asyncResolveLocalization');
const loopbackRef = require('../../reference')

const CITIES_API = `${THE_ASIA_API}/Cities`;
const COUNTRIES_API = `${THE_ASIA_API}/Countries`;
const CATEGORIES_API = `${THE_ASIA_API}/Categories`;
const PRODUCT_API = `${THE_ASIA_API}/tours`;
const SUB_PRODUCT_API = `${THE_ASIA_API}/SubProducts`;
const SUB_PRODUCT_PRICING_API = `${THE_ASIA_API}/Pricings`;

const safeJsonParse = (target, defaultValue) => {
  try {
    return JSON.parse(target);
  } catch (e) {
    return defaultValue;
  }
};

const parseJsonArray = value => {
  const result = safeJsonParse(value, []);

  if (!Array.isArray(result)) {
    return [];
  }

  return result;
};

module.exports = {
  City: {
    country: data => axios.get(`${CITIES_API}/${data.id}/city_country`).then(res => res.data),
  },
  Country: {
    language: data =>
      axios.get(`${COUNTRIES_API}/${data.id}/countriesLanguageIdFkeyrel`).then(res => res.data),
  },
  DiscoverProduct: {
    feature_names(root) {
      return root.feature_name;
    },
  },
  Product: {
    async available_languages(root) {
      const languageCodes = await axiosInstance
        .get(`/tours/touravailablelangbyslug/${root.slug}`)
        .then(res => res.data);
      const languages = await asyncGetLanguages();
      return languageCodes.map(code => languages.find(l => l.code === code));
    },
    booking_method(product) {
      if (product.productsBookingMethodIdFkeyrel) {
        return Promise.resolve(product.productsBookingMethodIdFkeyrel);
      }
      return axios
        .get(`${PRODUCT_API}/${product.id}/productsBookingMethodIdFkeyrel`)
        .then(res => res.data);
    },
    cancellation_policy(product) {
      if (product.productsCancellationPolicyIdFkeyrel) {
        return Promise.resolve(product.productsCancellationPolicyIdFkeyrel);
      }
      return axios
        .get(`${PRODUCT_API}/${product.id}/productsCancellationPolicyIdFkeyrel`)
        .then(res => res.data);
    },
    categories(product) {
      const requests = product.categories.map(c =>
        axios.get(`${CATEGORIES_API}/${c.category_id}`).then(res => ({ ...c, category: res.data })),
      );

      return Promise.all(requests);
    },
    async category_type(root, args) {
      const { locale_code } = args;

      const categoryType = await axiosInstance
        .get(`/categorytypes/${root.category_type_id}`)
        .then(res => res.data);

      if (!locale_code || locale_code === 'en') {
        return categoryType;
      }

      return asyncResolveLocalization(categoryType, { code: locale_code, keys: ['name'] });
    },
    city(product) {
      if (product.productsCityIdFkeyrel) {
        return Promise.resolve(product.productsCityIdFkeyrel);
      }
      return axios.get(`${PRODUCT_API}/${product.id}/cities`).then(res => res.data);
    },
    contract_logo(product) {
      return axios.get(`${PRODUCT_API}/${product.id}/contract_logo`).then(res => res.data);
    },
    country(product) {
      return axios.get(`${CITIES_API}/${product.city_id}/city_country`).then(res => res.data);
    },
    currency(product) {
      return Promise.resolve(product.currencies);
    },
    excerpt(product) {
      return product.short_description;
    },
    highlights(product) {
      return product.highlights || product.highligts;
    },
    importantInformation(root) {
      const result = safeJsonParse(root.important_information, []);

      if (!Array.isArray(result)) {
        return [];
      }

      return result.map(r => {
        const body = safeJsonParse(r.body, []);

        if (!Array.isArray(body)) {
          return [];
        }

        return {
          ...r,
          body,
        };
      });
    },
    is_published(product) {
      return product.status || false;
    },
    parsedMaps(root) {
      return parseJsonArray(root.map);
    },
    medias(product) {
      return product.medias || product.tour_medias;
    },
    parsedHighlights(root) {
      return parseJsonArray(root.highlights);
    },
    primary_media(product) {
      const medias = product.medias || product.tour_medias;
      return Array.isArray(medias) ? medias.find(media => media.is_primary) : null;
    },
    reviews(root) {
      return loopbackRef.app.models.Reviews.find({ where: { tour_id: root.id } })
    },
    subProducts(product, { status }) {
      const filter = {
        tour_id: product.id,
      };
      if (status !== undefined) {
        filter.status = status;
      }
      return axios
        .get(`${SUB_PRODUCT_API}?filter=${encodeURIComponent(JSON.stringify({ where: filter }))}`)
        .then(res => res.data);
    },
    supplier(product) {
      if (product.suppliers) {
        return Promise.resolve(product.suppliers);
      }
      if (product.productsSupplierIdFkeyrel) {
        return Promise.resolve(product.productsSupplierIdFkeyrel);
      }
      return axios
        .get(`${PRODUCT_API}/${product.id}/productsSupplierIdFkeyrel`)
        .then(res => res.data);
    },
    thumbnail(product) {
      const medias = product.medias || product.tour_medias;
      return Array.isArray(medias) ? medias.find(media => media.is_thumbnail) : null;
    },
    parsed_description_header(root) {
      return parseJsonArray(root.description_header);
    },
    parsed_description(root) {
      return parseJsonArray(root.description);
    },
    parsed_short_description(root) {
      return parseJsonArray(root.short_description);
    },
    async resolved_categories(root, args) {
      const { locale_code } = args;

      const categories = await asyncGetCategories();
      const _categories = categories.filter(c =>
        root.categories.some(_c => String(_c.category_id) === String(c.id)),
      );

      if (!locale_code || locale_code === 'en') {
        return _categories;
      }

      return asyncResolveLocalization(_categories, { code: locale_code, keys: ['name'] });
    },
    resolved_features(root, args) {
      const { locale_code } = args;
      const _features = root.features.map(f => ({
        id: f.id,
        name: f.feature.name,
        localization: f.feature.localization,
      }));
      return asyncResolveLocalization(_features, { code: locale_code, keys: ['name'] });
    },
    resolved_excluded_included_list(root) {
      return root.excluded_included.map(i => ({
        id: i.id,
        name: i.exclude_include.name,
        type: i.type,
      }));
    },
    type(root) {
      const types = {
        1: 'NORMAL',
        2: 'TRANSPORTATION',
        3: 'LUGGAGE',
        4: 'SIMCARD',
      };
      return types[root.product_type];
    },
    minimum_adult_age(root) {
      return root.pax_minimum_details.minimum_adult_age || '';
    },
    minimum_child_age(root) {
      return root.pax_minimum_details.minimum_child_age || '';
    },
    minimum_child_height(root) {
      return root.pax_minimum_details.minimum_child_height || '';
    },
  },
  ProductDetailAssets: {
    icon(data) {
      return `icon-${data.name}`;
    },
  },
  ProductMedia: {
    details(media) {
      // handle returning empty object as a default
      return media.details || {};
    },
  },
  ProductMediaDetails: {
    imgixUrl(root) {
      if (root.bucket_path && root.name) {
        return `${IMGIX_BASE_URL}/${root.bucket_path}/${root.name}`;
      }
      return '';
    },
    // Deprecated
    imgix_url(details) {
      if (details.bucket_path && details.name) {
        return `${IMGIX_BASE_URL}/${details.bucket_path}/${details.name}`;
      }
      return null;
    },
  },
  ProductPriceRange: {
    min(root) {
      return root.low;
    },
    max(root) {
      return root.high;
    },
  },
  SubProductOP: {
    base_price({ base_price }) {
      if (!isArray(base_price)) {
        return [];
      }

      return base_price;
    },
    calendarPricing(data) {
      return axios
        .get(
          `${SUB_PRODUCT_PRICING_API}?filter=${encodeURIComponent(
            JSON.stringify({
              where: { sub_product_id: data.id },
            }),
          )}`,
        )
        .then(res => res.data);
    },
    date_excluded({ date_excluded = '[]' }) {
      return JSON.parse(date_excluded);
    },
    minimum_pax({ base_price }) {
      const prices = !isArray(base_price) ? [] : base_price;
      let min = null;
      // eslint-disable-next-line array-callback-return
      prices.map(price => {
        const pax = Number(price.pax);
        if (!min || pax < min) {
          min = pax;
        }
      });

      return min;
    },
    parsedItinerary(root) {
      const result = parseJsonArray(root.itinerary);

      return result.map(r => ({
        description: r.description,
        title: r.title,
        from: r.time.from,
        to: r.time.to,
      }));
    },
    pricing(data) {
      return axios
        .get(
          `${SUB_PRODUCT_PRICING_API}?filter=${encodeURIComponent(
            JSON.stringify({
              where: { sub_product_id: data.id },
            }),
          )}`,
        )
        .then(res => res.data);
    },
    repeat_on({ repeat_on = '[]' }) {
      return JSON.parse(repeat_on);
    },
    reviews(root) {
      return axiosInstance
        .get('/reviews', { params: { filter: { where: { sub_product_id: root.id } } } })
        .then(res => res.data);
    },
    tour(root) {
      return axios
        .request({
          method: 'GET',
          baseURL: THE_ASIA_API,
          url: `/tours/${root.tour_id}`,
        })
        .then(res => res.data)
        .catch(error => error);
    },
  },
  SubProductPricing: {
    endDate(data) {
      return data.to;
    },
    pricing(data) {
      return data.override_price;
    },
    startDate(data) {
      return data.from;
    },
  },
};
