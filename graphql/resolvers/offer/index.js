const loopbackRef = require('../../reference');
const axios = require('../../axios');
const GraphQlDefinition = require('../GraphQlDefinition');

module.exports = new GraphQlDefinition({
  mutation: {
    offerCreate(root, { input }, { user }) {
      const auth = user.id || '';
      return axios
        .post('/offers', input, {
          headers: {
            Authorization: auth,
          },
        })
        .then(res => res.data);
    },
    offerPatch(root, { id, input }, { user }) {
      const auth = user.id || '';
      return axios
        .patch(`/offers/${id}`, input, {
          headers: {
            Authorization: auth,
          },
        })
        .then(res => res.data);
    },
  },
  query: {
    offer(root, { id }) {
      return loopbackRef.app.models.Offers.findById(id, {
        include: 'offer_constraint_type',
      });
    },
    async offers(
      root,
      {
        filter: { searchTerm, limit = 10, order, skip = 0 },
      },
    ) {
      let where = {};

      if (searchTerm) {
        const searchTermCondition = {
          ilike: `%${searchTerm}%`,
        };

        where = {
          ...where,
          or: [
            { id: searchTermCondition },
            { name: searchTermCondition },
            { code: searchTermCondition },
          ],
        };
      }

      const findFilter = {
        where,
        include: 'offer_constraint_type',
        limit,
        order,
        skip,
      };

      const countFilter = {
        where,
      };

      const [offers, count] = await Promise.all([
        loopbackRef.app.models.Offers.find(findFilter),
        loopbackRef.app.models.Offers.count(countFilter),
      ]);

      return { offers, count };
    },
    offerConstraintTypes() {
      return loopbackRef.app.models.OfferConstraintTypes.find();
    },
  },
  resolver: {
    Offer: {
      offer_constraint_type(root) {
        // toObject/toJSON doesn't work if query directly to loopback (based on 'offers' query)
        // Need to call the relation function to populate
        return typeof root.offer_constraint_type === 'function'
          ? root.offer_constraint_type()
          : root.offer_constraint_type;
      },
    },
  },
  type: /* GraphQL */ `
    extend type Mutation {
      offerCreate(input: OfferInput!): Offer
      offerPatch(id: ID!, input: OfferInput!): Offer
    }
    extend type Query {
      offer(id: ID!): Offer
      offers(filter: OffersFilter): OffersResponse
      offerConstraintTypes: [OfferConstraintType]
    }

    type Offer {
      id: ID!
      name: String!
      discount_type: String!
      offer_constraint_type_id: ID!
      offer_constraint_type: OfferConstraintType
      start_date: String!
      end_date: String
      discount_value: Float!
      max_total_usage: Int
      code: String!
      is_active: Boolean!
      created_at: String!
      updated_at: String
    }

    type OfferConstraintType {
      id: ID!
      title: String!
      description: String
    }

    type OffersResponse {
      offers: [Offer]
      count: Int
    }

    # Offer without ID and created/updated
    input OfferInput {
      name: String
      discount_type: String
      offer_constraint_type_id: ID
      start_date: String
      end_date: String
      discount_value: Float
      max_total_usage: Int
      code: String
      is_active: Boolean
    }

    input OffersFilter {
      searchTerm: String
      limit: Int
      order: String
      skip: Int
    }
  `,
});
