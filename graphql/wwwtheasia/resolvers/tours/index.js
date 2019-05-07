const axios = require('axios');
const moment = require('moment');
const _ = require('underscore');
const money = require('money');

const { THE_ASIA_API: BASE_API, IMGIX_API } = require('../../config');
const Locale = require('../common/locale');
const ErrorResponse = require('../../shared/error');
const jsonTryParse = require('../../helpers/jsonTryParse');
const objectHelper = require('../../helpers/object');
const priceHelper = require('../../helpers/price');
const PRODUCT_DETAILS_MAP = require('../../shared/productDetails');
const logger = require('../../../logger');
const axiosInstance = require('../../axios');
const getCurrencyHelper = require('../../../helpers/currency');
const asyncForEach = require('../../../helpers/asyncForEach');

const TOURS = `${BASE_API}/Tours`;
const SUB_TOURS = `${BASE_API}/SubProducts`;
const TOURS_PRICING = `${BASE_API}/Pricings`;
const TOURS_FEATURES = `${BASE_API}/Features`;
const CITIES = `${BASE_API}/Cities`;
const REVIEWS_API = `${BASE_API}/Reviews`;
const NEW_TOURS = `${TOURS}/discover`;

const includeExclude = (langId, mainData) => {
  if (langId) {
    return mainData.map(item => {
      const localeData = item.exclude_include.localization.find(
        itemLocale => itemLocale.lang_id === langId,
      );
      return {
        icon: item.exclude_include.iconUrl,
        text: localeData.name,
      };
    });
  }
  return mainData.map(item => ({
    icon: item.exclude_include.iconUrl,
    text: item.exclude_include.name,
  }));
};

const priceConversion = async (price, { code: tourCurrency }, { code: userCurrency }) => {
  if (!price) {
    return {};
  }

  if (tourCurrency === userCurrency) {
    return price;
  }

  const finalPrices = {};

  try {
    const currencyHelper = getCurrencyHelper();

    await asyncForEach(Object.keys(price), async key => {
      finalPrices[key] = await currencyHelper
        .asyncConvert(price[key] || 0, tourCurrency, userCurrency)
        .then($ => $.toFixed(2));
    });
  } catch (e) {
    console.log('Error : Some currency is missing in conversion.', e);
  }

  return finalPrices;
};

// Reset time to 00.00.00 and return JSON format
const dateToJSON = (date = moment()) => {
  const clonedDate = date.clone();
  const userDate = clonedDate.utcOffset(0);
  userDate.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
  return userDate.toJSON();
};

const resolvers = {
  Tour: {
    title({ name = '' }) {
      return name;
    },
    isPublished({ status: isPublished = false }) {
      return isPublished;
    },
    isDiscounted({ is_discounted: isDiscounted = false }) {
      return isDiscounted;
    },
    shortDescription({ short_description: shortDescription = '[]' }) {
      const parsed = jsonTryParse(shortDescription, []);

      try {
        return parsed.join('\n');
      } catch (e) {
        return parsed;
      }
    },
    longDescription({ description = '[]' }) {
      return jsonTryParse(description, []);
    },
    descriptionHeader({ description_header = '[]' }) {
      return jsonTryParse(description_header, []);
    },
    city({ city_id: cityId }) {
      return axios
        .get(`${CITIES}`, {
          params: {
            filter: {
              where: { id: cityId },
              limit: 1,
            },
          },
        })
        .then(res => res.data[0])
        .catch(({ response: { data: { error = {} } = {} } = {} }) => {
          console.log('Error: ', error);
          return '';
        });
    },
    latestMinimumPrice(root, args, context) {
      const currencyHelper = getCurrencyHelper();
      return currencyHelper
        .asyncConvert(root.latest_minimum_price || 0, 'USD', context.currency.code)
        .then(price => price.toFixed(2));
    },
    details(data) {
      return PRODUCT_DETAILS_MAP.reduce((acc, item) => {
        if (data[item.col_name]) {
          acc.push({ ...item, text: data[item.col_name] });
        }
        return acc;
      }, []);
    },
    highlights({ highlights = '[]' }) {
      return jsonTryParse(highlights, []);
    },
    images({ tour_medias: medias = [] }) {
      return medias.reduce(
        (acc, { is_primary: isPrimary, is_thumbnail: isThumb, details = {} }) => {
          if (isPrimary) {
            acc.unshift(details);
          } else if (!isThumb) {
            acc.push(details);
          }
          return acc;
        },
        [],
      );
    },
    includes({ excluded_included: excludeInclude = [], lang_id: langId }) {
      const included = excludeInclude.filter(item => item.type);
      return includeExclude(langId, included);
    },
    excludes({ excluded_included: excludeInclude = [], lang_id: langId }) {
      const excluded = excludeInclude.filter(item => !item.type);
      return includeExclude(langId, excluded);
    },
    information({ important_information: importantInfo = '[]' }) {
      return jsonTryParse(importantInfo, []);
    },
    locations({ map = '[]' }) {
      // TODO remove 'filter' once empty data is removed from back-office
      return jsonTryParse(map, []).filter(item => !!item.latitude);
    },
    currency({ currencies = {} }) {
      return currencies;
    },
    seo(data) {
      return data;
    },
    tourMedias(root) {
      return root.tour_medias;
    },
    travellerRequirement({
      pax_minimum_details: {
        minimum_adult_age: minimumAdultAge,
        minimum_child_age: minimumChildAge,
        minimum_child_height: minimumChildHeight,
      },
    }) {
      return {
        minimumAdultAge,
        minimumChildAge,
        minimumChildHeight,
      };
    },
    currentDate() {
      return new Date();
    },
    tourType({ product_type: tourType }) {
      const types = {
        1: 'NORMAL',
        2: 'TRANSPORTATION',
        3: 'LUGGAGE',
        4: 'SIMCARD',
      };
      return types[tourType];
    },
    featureType({ features = '[]' }, args, context) {
      const featuresData = jsonTryParse(features, []);

      if (featuresData && featuresData.length) {
        const typeId = featuresData[0].feature_id;
        const locale = Locale.resolve(context.locale);
        const tourFeature = axios.get(`${TOURS_FEATURES}/${typeId}`, {
          params: {
            filter: {
              include: ['localization'],
            },
          },
        });

        return axios
          .all([locale, tourFeature])
          .then(
            axios.spread((lang, { data: feature = {} }) => {
              const { data: { id = 0, code = 'en' } = {} } = lang;
              let featureMain = feature;
              if (id && code !== 'en') {
                const localizeFeature = feature.localization.find(
                  item => Number(item.lang_id) === id,
                );
                featureMain = Object.assign({}, feature, localizeFeature, {
                  id: feature.id,
                });
              }
              return featureMain.name;
            }),
          )
          .catch(({ response: { data: { error = {} } = {} } = {} }) => {
            console.log('Error: ', error);
            return '';
          });
      }
      return '';
    },
    reviews({ rating, id }) {
      if (rating > 0) {
        return axios
          .get(REVIEWS_API, {
            params: {
              filter: {
                where: { tour_id: id, status: 1 },
                order: 'rating DESC',
              },
            },
          })
          .then(({ data }) => data)
          .catch(err => {
            console.log('error.reviews ==>', err);
            return [];
          });
      }
      return [];
    },
    discountPercentage({ discount_percent: discountPercentage }) {
      return discountPercentage;
    },
  },
  TourMedia: {
    detail(root) {
      return root.details;
    },
  },
  TourMediaDetail: {
    absoluteUrl(root) {
      return root.absolute_url;
    },
  },
  SubTour: {
    title({ name = '' }) {
      return name;
    },
    type({ product_features: features = '[]' }, args, context) {
      const featuresData = jsonTryParse(features, []);

      if (featuresData && featuresData.length) {
        const typeId = featuresData[0];
        const locale = Locale.resolve(context.locale);
        const tourFeature = axios.get(`${TOURS_FEATURES}/${typeId}`, {
          params: {
            filter: {
              include: ['localization'],
            },
          },
        });

        return axios
          .all([locale, tourFeature])
          .then(
            axios.spread((lang, { data: feature = {} }) => {
              const { data: { id = 0, code = 'en' } = {} } = lang;
              let featureMain = feature;
              if (id && code !== 'en') {
                const localizeFeature = feature.localization.find(
                  item => Number(item.lang_id) === id,
                );
                featureMain = Object.assign({}, feature, localizeFeature, {
                  id: feature.id,
                });
              }
              return featureMain.name;
            }),
          )
          .catch(({ response: { data: { error = {} } = {} } = {} }) => {
            console.log('Error: ', error);
            return '';
          });
      }
      return '';
    },
    shortDescription({ short_description: shortDescription = '[]' }) {
      return jsonTryParse(shortDescription, []);
    },
    details(data) {
      return PRODUCT_DETAILS_MAP.reduce((acc, item) => {
        if (data[item.col_name]) {
          acc.push({ ...item, text: data[item.col_name] });
        }
        return acc;
      }, []);
    },
    itinerary({ itinerary = '[]' }) {
      return jsonTryParse(itinerary, []);
    },
    locations({ map = '[]' }) {
      return jsonTryParse(map, []).filter(item => !!item.latitude);
    },
    checkoutInfo({
      is_passport_required: isPassportRequired,
      is_pickup_place_required: isPickupDetailRequired,
      is_pickup_time_required: isPickupTimeRequired,
      is_flight_information_required: isFlightInfoRequired,
      is_hotel_name_required: isHotelNameRequired,
      is_drop_off_required: isDropOffRequired,
    }) {
      return {
        isPassportRequired,
        isPickupDetailRequired,
        isPickupTimeRequired,
        isFlightInfoRequired,
        isHotelNameRequired,
        isDropOffRequired,
      };
    },
    travellerRequirement({
      minimum_adult_age: minimumAdultAge = '',
      minimum_child_age: minimumChildAge = '',
      minimum_child_height: minimumChildHeight = '',
    }) {
      return {
        minimumAdultAge,
        minimumChildAge,
        minimumChildHeight,
      };
    },
    priceInfo({
      starts_on: startDate,
      ends_on: endDate,
      availability_type: availabilityType,
      repeat_on: repeatOn = '[]',
      date_excluded: excludeDates = '[]',
      max_pax: maximumPax,
      base_price: basePrice = [],
    }) {
      return {
        startDate,
        endDate,
        availabilityType,
        repeatOn: jsonTryParse(repeatOn, []),
        excludeDates: jsonTryParse(excludeDates, []),
        maximumPax,
        basePrice,
      };
    },
    cancellationPolicy({ cancellation_policy: cancellationPolicy = {} }, args, context) {
      const locale = Locale.resolve(context.locale);

      return locale
        .then(lang => {
          const { data: { id = 0, code = 'en' } = {} } = lang;
          let policyData = cancellationPolicy;
          if (id && code !== 'en') {
            const localizePolicy = cancellationPolicy.localization.find(
              item => Number(item.lang_id) === id,
            );
            policyData = Object.assign({}, cancellationPolicy, localizePolicy, {
              id: cancellationPolicy.id,
            });
          }
          return policyData;
        })
        .catch(({ response: { data: { error = {} } = {} } = {} }) => {
          throw new ErrorResponse(Object.assign({}, error));
        });
    },
    selectedTime({ selected_time: selectedTime = '[]' }) {
      let time = jsonTryParse(selectedTime, []);
      time = time || [];
      return time;
    },
    pickupLocationTime({ pickup_location_time: pickupLocationTime = '[]' }) {
      let pickUp = jsonTryParse(pickupLocationTime, []);
      pickUp = pickUp || [];
      return pickUp;
    },
    reviews({ rating, id }) {
      if (rating > 0) {
        return axios
          .get(REVIEWS_API, {
            params: {
              filter: {
                where: { sub_product_id: id, status: 1 },
                order: 'rating DESC',
              },
            },
          })
          .then(({ data }) => data)
          .catch(err => {
            console.log('error.reviews ==>', err);
            return [];
          });
      }
      return [];
    },
  },
  CancellationPolicy: {
    name({ name = '' }) {
      return name;
    },
    description({ description = '' }) {
      return description;
    },
  },
  ToursPricing: {
    subProductId({ sub_product_id: subProductId }) {
      return subProductId;
    },
    startDate({ from: startDate }) {
      return startDate;
    },
    endDate({ to: endDate }) {
      return endDate;
    },
    prices({ override_price: prices }) {
      return prices;
    },
  },
  PriceTypes: {
    walkIn(
      { walkInPrice: WalkIn = {} },
      args,
      { currency: userCurrency = {}, kvariables: { currency: tourCurrency = {} } = {} },
    ) {
      return priceConversion(WalkIn, tourCurrency, userCurrency);
    },
    selling({ sellingPrice: selling = {} }) {
      return selling;
    },
    exchange(
      { sellingPrice: selling = {} },
      args,
      { currency: userCurrency = {}, kvariables: { currency: tourCurrency = {} } = {} },
    ) {
      return priceConversion(selling, tourCurrency, userCurrency);
    },
  },
  TourGallery: {
    raw({ bucket_path: bucketPath = '', name = '' }) {
      return `${IMGIX_API}/${bucketPath}/${name}?auto=compress&lossless=1&q=40`;
    },
    small({ bucket_path: bucketPath = '', name = '' }) {
      return `${IMGIX_API}/${bucketPath}/${name}?crop=center,center&fit=crop&w=420&auto=compress&lossless=1`;
    },
    thumb({ bucket_path: bucketPath = '', name = '' }) {
      return `${IMGIX_API}/${bucketPath}/${name}?crop=center,center&fit=crop&w=52&auto=compress&lossless=1`;
    },
    alt({ alt_text: altText = '' }) {
      return altText;
    },
    description({ description = '' }) {
      return description;
    },
  },
  TourSEO: {
    title({ seo_title: title = '' }) {
      return title;
    },
    description({ seo_description: description = '' }) {
      return description;
    },
    keywords({ seo_keywords: keywords = '' }) {
      return keywords;
    },
    schema({ schema_org: schema = '' }) {
      return schema;
    },
  },
  TourCurrency: {
    code({ currency_code: code }) {
      return code;
    },
    exchangeRate({ exchange_rate: exchangeRate }) {
      return exchangeRate;
    },
  },
  TourCard: {
    startingPrice({ starting_price: startingPrice = 0 }, args, { currency: { code } = {} }) {
      if (code !== 'USD') {
        return Number(
          money(startingPrice)
            .from('USD')
            .to(code)
            .toFixed(2)
            .toString(),
        );
      }
      return Number(startingPrice.toFixed(2).toString());
    },
    cityId({ city_id: cityId }) {
      return cityId;
    },
    city({ city_name: city = '' }) {
      return city;
    },
    discount({ discount_percent: discount = 0, is_discounted }) {
      if (!is_discounted) {
        return 0;
      }

      return discount ? Number(discount.toFixed(2).toString()) : 0;
    },
    sortDescription({ short_description: shortDescription = '[]' }) {
      return jsonTryParse(shortDescription, []).join('');
    },
    seo(data) {
      return data;
    },
    image({ id, bucket_path, image_name: name, alt_text }) {
      return {
        id,
        bucket_path,
        name,
        alt_text,
      };
    },
    features({ feature_name: features = [] }) {
      return features;
    },
  },
  NewTour: {
    tours({ products = [] }) {
      return products;
    },
  },
};

const query = {
  productPriceRange(root, args, context) {
    const defaultRange = { high: 1, low: 1000 };
    return axios
      .request({
        baseURL: BASE_API,
        method: 'get',
        url: '/tours/getpricerange',
      })
      .then(res => res.data)
      .then(data => {
        if (!data) {
          return defaultRange;
        }

        const { high, low } = data;
        const targetCurrency = objectHelper.safeGet(() => context.currency.code);

        /** Default currency is USD */
        if (!targetCurrency || targetCurrency === 'USD') {
          return data;
        }

        return {
          high: priceHelper.convert(money, high, 'USD', targetCurrency),
          low: priceHelper.convert(money, low, 'USD', targetCurrency),
        };
      })
      .catch(error => {
        logger.error(__filename, error);
        return defaultRange;
      });
  },
  tourBySlug(obj, { slug }, context) {
    const payloadUrl = `${TOURS}/findbyslug/${slug}`;
    const locale = Locale.resolve(context.locale);
    const products = axios.get(payloadUrl).then(res => res.data);

    return axios
      .all([locale, products])
      .then(
        axios.spread((lang, product) => {
          const { data: { id = 0, code = 'en' } = {} } = lang;
          let productData = product;
          if (id && code !== 'en') {
            const localizeProduct = product.localization.find(item => Number(item.lang_id) === id);
            productData = Object.assign({}, product, _.pick(localizeProduct, _.identity), {
              id: product.id,
            });
          }
          // Remove null keys from data
          return _.pick(productData, _.identity);
        }),
      )
      .catch(({ response: { data: { error = {} } = {} } = {} }) => {
        throw new ErrorResponse(Object.assign({}, error));
      });
  },
  tourPromotion() {
    // const locale = Locale.resolve(context.locale);
    return axios
      .get(TOURS, {
        params: {
          filter: {
            where: {
              is_discounted: true,
            },
          },
        },
      })
      .then(res => res.data)
      .catch(({ response: { data: { error = {} } = {} } = {} }) => {
        throw new ErrorResponse(Object.assign({}, error));
      });
  },
  tourLanguages(obj, { slug }) {
    if (!slug) {
      return [];
    }

    return axios.get(`${TOURS}/tourAvailableLangBySlug/${slug}`).then(res => res.data);
  },
  newTours(root, args, context) {
    const locale = Locale.resolve(context.locale);
    return locale.then(localeData => {
      const {
        data: { id = 1 },
      } = localeData;
      return axios
        .get(NEW_TOURS, {
          params: {
            limit: 10,
            lang_id: id,
            latest: true,
            filter: {
              where: {
                order: 'created_at DESC',
                status: true,
              },
            },
          },
        })
        .then(res => res.data)
        .catch(({ response: { data: { error = {} } = {} } = {} }) => {
          throw new ErrorResponse(Object.assign({}, error));
        });
    });
  },
  topRatedProducts(obj, args, context) {
    return Locale.resolve(context.locale)
      .then(({ data: { id } }) =>
        axiosInstance
          .get('/tours/gettopratedproducts', {
            params: {
              lang_id: id,
            },
          })
          .then(res => res.data),
      )
      .catch(({ response: { data: { error = {} } = {} } = {} }) => {
        throw new ErrorResponse(Object.assign({}, error));
      });
  },
};

const mutations = {
  subTours(obj, { tourId }, context) {
    const locale = Locale.resolve(context.locale);
    // TODO we need to filter by contract Date end and start
    const subProducts = axios
      .get(SUB_TOURS, {
        params: {
          filter: {
            where: {
              and: [
                { tour_id: tourId },
                // { starts_on: { lte: dateToJSON() } },
                { ends_on: { gte: dateToJSON() } },
                { base_price: { neq: null } },
                { status: true },
              ],
            },
          },
        },
      })
      .then(res => res.data);

    return axios
      .all([locale, subProducts])
      .then(
        axios.spread((lang, subProduct) => {
          const { data: { id = 0, code = 'en' } = {} } = lang;
          let subProductsData = subProduct;
          if (id && code !== 'en') {
            subProductsData = subProduct.reduce((acc, item, index) => {
              const localizeProduct = item.localization.find(
                localeItem => Number(localeItem.lang_id) === id,
              );
              acc.push(
                Object.assign({}, subProduct[index], _.pick(localizeProduct, _.identity), {
                  id: subProduct[index].id,
                }),
              );
              return acc;
            }, []);
          }

          // Remove null keys from data
          return _.map(subProductsData, item => _.pick(item, _.identity));
        }),
      )
      .catch(({ response: { data: { error = {} } = {} } = {} }) => {
        throw new ErrorResponse(Object.assign({}, error));
      });
  },
  toursPricing(
    obj,
    { input: { subProducts = [], date = '', adults = 0, children = 0, infants = 0 } = {} },
  ) {
    const userDate = dateToJSON(moment(date));
    const payload = {
      params: {
        filter: {
          where: {
            and: [
              { sub_product_id: { inq: subProducts } },
              { from: { lte: userDate } },
              { to: { gte: userDate } },
            ],
          },
          limit: 1,
          order: 'created_at DESC',
        },
      },
    };

    const totalPax = Number(adults) + Number(children) + Number(infants);

    console.log('toursPricing : ', userDate, subProducts, adults, children, infants, '=', totalPax);

    const prices = axios.get(TOURS_PRICING, payload).then(res =>
      res.data
        // Filter pricing by pax count
        .reduce((acc, item) => {
          const priceClone = item;
          const { override_price: overridePrices = [] } = priceClone;
          priceClone.override_price = overridePrices.filter(price => totalPax >= price.pax);
          if (priceClone.override_price.length) {
            acc.push(priceClone);
          }
          return acc;
        }, []),
    );

    return prices.then(data => data).catch(({ response: { data: { error = {} } = {} } = {} }) => {
      throw new ErrorResponse(Object.assign({}, error));
    });
  },
};

module.exports = { resolvers, query, mutations };
