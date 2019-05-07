const axios = require('axios');
const moment = require('moment');

const { THE_ASIA_API: baseURL } = require('../config');
const ErrorResponse = require('../shared/error');
const logger = require('../../logger');
const tryGet = require('../helpers/tryGet');

const REVIEW_URL = '/reviews';
const TOUR_URL = '/Tours';
const SUB_PRODUCT_URL = '/subproducts';
const COUNTRY_API = `${baseURL}/Countries`;

const handleError = errorResponse => {
  const error = tryGet(() => errorResponse.data.error);
  logger.error(error);
  throw new ErrorResponse(Object.assign({}, error));
};

module.exports = {
  query: {
    review(root, arg) {
      logger.debug('review', { arg });

      const { id, where } = arg;

      if (id) {
        return axios
          .request({
            baseURL,
            url: `${REVIEW_URL}/${id}`,
            method: 'GET',
          })
          .then(res => res.data)
          .catch(handleError);
      }

      return axios
        .request({
          baseURL,
          url: `${REVIEW_URL}/findone`,
          method: 'GET',
          params: {
            filter: { where },
          },
        })
        .then(res => res.data)
        .catch(error => {
          if (error.response && error.response.status === 404) {
            return null;
          }
          return handleError(error);
        });
    },
    reviews(root, arg) {
      logger.debug('reviews', arg);

      const { where } = arg;

      const params = {};

      if (where) {
        params.filter = { where };
      }

      return axios
        .request({
          baseURL,
          url: REVIEW_URL,
          method: 'GET',
          params,
        })
        .then(res => res.data)
        .catch(handleError);
    },
  },
  mutation: {
    createReview(root, arg, context) {
      logger.debug('createReview', { arg, context });

      const { input } = arg;

      return axios
        .request({
          method: 'POST',
          baseURL,
          url: REVIEW_URL,
          data: input,
        })
        .then(res => res.data)
        .catch(handleError);
    },
    updateReview(root, arg, context) {
      logger.debug('updateReview', { arg, context });

      const { id, input } = arg;

      return axios
        .request({
          method: 'PATCH',
          baseURL,
          url: `${REVIEW_URL}/${id}`,
          data: input,
        })
        .then(res => res.data)
        .catch(handleError);
    },
  },
  resolver: {
    Review: {
      booking(root) {
        const { booking_id } = root;

        if (!booking_id) {
          return null;
        }

        return axios
          .request({
            method: 'GET',
            baseURL,
            url: `/bookings/${booking_id}`,
          })
          .then(res => res.data)
          .catch(handleError);
      },
      subTour(root) {
        return axios
          .request({
            method: 'GET',
            baseURL,
            url: `${SUB_PRODUCT_URL}/${root.sub_product_id}`,
          })
          .then(res => res.data)
          .catch(handleError);
      },
      tour(root) {
        return axios
          .request({
            method: 'GET',
            baseURL,
            url: `${TOUR_URL}/${root.tour_id}`,
          })
          .then(res => res.data)
          .catch(handleError);
      },
      reviewerName({ reviewer_name: reviewerName }) {
        return reviewerName;
      },
      reviewTitle({ review_title: reviewTitle = '' }) {
        return reviewTitle;
      },
      reviewDescription({ review: reviewDescription = '' }) {
        return reviewDescription;
      },
      nationalityFlag({ nationality }) {
        // console.log('nationality ==>', nationality);
        return axios
          .get(COUNTRY_API, {
            params: {
              filter: {
                where: {
                  id: nationality,
                },
              },
            },
          })
          .then(({ data }) => data[0].flag)
          .catch(err => {
            console.log('err nationality =>>', err);
            return '';
          });
      },
      createdAt({ created_at: createdAt }) {
        return moment(createdAt).format('MM/DD/YYYY');
      },
    },
    TopRatedProduct: {
      tours({
        id,
        slug,
        starting_price,
        city_id,
        city_name,
        rating,
        discount_percent,
        name,
        image_name,
        bucket_path,
        alt_text,
      }) {
        return {
          id,
          slug,
          starting_price,
          city_id,
          city_name,
          rating,
          discount_percent,
          name,
          bucket_path,
          alt_text,
          image_name,
        };
      },
      reviews({ review_title, review, nationality, flag, reviewer_name }) {
        return {
          review,
          review_title,
          nationality,
          flag,
          reviewer_name,
        };
      },
    },
  },
};
