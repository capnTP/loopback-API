const axios = require('../axios');
const logger = require('../logger');

const GraphQlDefinition = require('./GraphQlDefinition');

module.exports = new GraphQlDefinition({
  mutation: {
    addReview(root, args) {
      logger.debug('addReview', { args });
      const { input } = args;

      return axios.post('/reviews', input).then(res => res.data);
    },
    deleteReview(root, args) {
      logger.debug('deleteReview', { args });
      const { id } = args;

      return axios.delete(`/reviews/${id}`).then(res => res.data);
    },
    updateReview(root, args) {
      logger.debug('updateReview', { args });
      const { id, input } = args;

      return axios.patch(`/reviews/${id}`, input).then(res => res.data);
    },
  },
  query: {
    review(root, args) {
      logger.debug('review', { args });
      const { id } = args;

      return axios.get(`reviews/${id}`).then(res => res.data);
    },
    reviews(root, args) {
      logger.debug('reviews', { args, root });

      const { limit = 10, offset = 0, order, where } = args;

      const params = {
        filter: {
          limit,
          offset,
        },
      };

      if (order) {
        params.filter.order = order;
      }

      if (where) {
        params.filter.where = where;
      }

      return axios
        .request({
          url: '/reviews',
          method: 'GET',
          params,
        })
        .then(res => res.data);
    },
    reviewsCount(root, args) {
      logger.debug('reviewsCount', { args });

      const params = {};
      const { where } = args;
      if (where) {
        params.where = where;
      }

      return axios
        .request({
          url: '/reviews/count',
          method: 'GET',
          params,
        })
        .then(res => res.data)
        .then(({ count }) => count);
    },
  },
  resolver: {
    Review: {
      booking(root) {
        if (root.booking_id === '0') {
          return null;
        }

        return axios
          .get(`/bookings/${root.booking_id}`)
          .then(res => res.data)
          .catch(error => {
            if (error.response) {
              // review without booking is affiliate review
              if (error.response.status === 404) {
                return null;
              }
            }

            return error;
          });
      },
      nationality(root) {
        const { nationality } = root;

        if (!nationality) {
          return null;
        }

        return axios
          .get(`countries/${nationality}`)
          .then(res => res.data)
          .catch(() => null);
      },
      product(root) {
        const { tour_id } = root;

        if (!tour_id) {
          return null;
        }

        return axios
          .get(`tours/${tour_id}`)
          .then(res => res.data)
          .catch(() => null);
      },
      sub_product(root) {
        const { sub_product_id } = root;

        if (!sub_product_id) {
          return null;
        }

        return axios
          .get(`subproducts/${sub_product_id}`)
          .then(res => res.data)
          .catch(() => null);
      },
    },
  },
  type: /* GraphQL */ `
    type Review {
      id: ID!
      created_at: String
      updated_at: String

      booking: Booking
      booking_id: String

      group_size: Int

      language_id: ID

      nationality: Country

      rating: Float
      recommend: Boolean
      review: String
      review_title: String
      reviewer_name: String

      status: Int
      sub_product: SubProduct
      sub_product_id: ID

      tour_id: ID
      product: Product

      user_id: ID
    }

    input ReviewFilter {
      status: Int

      tour_id: ID
    }

    input ReviewInput {
      created_at: String

      group_size: Int

      language_id: ID

      nationality: ID

      rating: Float
      recommend: Boolean
      review: String
      review_title: String
      reviewer_name: String

      status: Int
      sub_product_id: ID

      tour_id: ID

      user_id: ID
    }

    extend type Query {
      review(id: ID!): Review
      reviews(where: ReviewFilter, limit: Int, offset: Int, order: String): [Review]
      reviewsCount(where: ReviewFilter, limit: Int, offset: Int, order: String): Int
    }

    extend type Mutation {
      addReview(input: ReviewInput): Review
      updateReview(id: ID!, input: ReviewInput): Review
    }
  `,
});
