const axios = require('axios');

const { THE_ASIA_API } = require('../../config');
const GraphqlDefinition = require('../GraphQlDefinition')
const loopback = require('../../reference')

const NOTES = `${THE_ASIA_API}/Notes`;

const mutation = {
  getNotesByBookingId(root, params, context) {
    axios.defaults.headers.common.Authorization = context.user.id;
    return axios
      .get(
        `${NOTES}?filter=${encodeURIComponent(
          JSON.stringify({
            where: { booking_id: params.booking_id },
          }),
        )}`,
      )
      .then(res => res.data)
      .catch(err => err);
  },
  addNote(root, params) {
    return axios
      .post(`${NOTES} `, params.input)
      .then(res => res.data)
      .catch(err => err);
  },
  async addNoteAffiliate(root, { input = {} }, { accessToken }) {
    const { id, userId: user_id } = accessToken;
    if (!id) throw new Error('Unauthorized')

    if (!input.booking_id) throw new Error('Missing Booking ID')
    const booking = await loopback.app.models.Booking.findById(input.booking_id)

    if (!booking) throw new Error('Booking not found')
    // Validate booking_id is this user's booking id
    // Maybe add allow admin check? preferably passing user through context
    if (Number(booking.user_id) !== Number(user_id)) throw new Error('Unauthorized')

    return axios
      .post(`${NOTES}?access_token=${accessToken.id}`, { ...input, user_id })
      .then(res => res.data)
      .catch(err => err)
  },
  async addNoteSupplier(root, { input = {} }, { accessToken }) {
    const { id, userId: user_id } = accessToken;
    if (!id) throw new Error('Unauthorized')

    if (!input.booking_id) throw new Error('Missing Booking ID')
    const booking = await loopback.app.models.Booking.findById(input.booking_id)

    if (!booking) throw new Error('Booking not found')

    return axios
      .post(`${NOTES}?access_token=${accessToken.id}`, { ...input, user_id })
      .then(res => res.data)
      .catch(err => err)
  },
};

const type = /* GraphQL */`
  extend type Mutation {
    addNote(input: PostNotes): Notes
    addNoteAffiliate(input: PostNotesAffiliate): Notes
    addNoteSupplier(input: PostNotesSupplier): Notes
    getNotesByBookingId(booking_id: String): [Notes]
  }

  type Notes{
      id: ID,
      booking_id: String
      user_id: String
      note: String
      channel: String
      from: String
      is_public: Boolean
      created_at: String
      updated_at: String

      notesUserIdFkeyrel: User
  }

  input PostNotes {
    booking_id: String
    user_id:ID
    note: String
    channel: String
    from: String
    is_public: Boolean
    created_at: String,
    updated_at: String,
  }

  input PostNotesAffiliate {
    booking_id: String
    note: String!
    channel: String
    from: String
  }

  input PostNotesSupplier {
    booking_id: String
    note: String!
    channel: String
    from: String
  }
`;

module.exports = new GraphqlDefinition({ mutation, type });
