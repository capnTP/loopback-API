const { makeExecutableSchema } = require('graphql-tools');

const currency = require('./common/currency');
const tours = require('./tours');
const user = require('./user');
const countries = require('./countries');
const cities = require('./cities');
const booking = require('./booking');
const review = require('./review');
const payments = require('./payment');
const policies = require('./policies');
const contact = require('./contact');
const language = require('./language');
const newsletter = require('./newsletter');
const weather = require('./weather');
const feature = require('./feature');
const discover = require('./discover');
const category = require('./category');
const categoryType = require('./categoryType');
const home = require('./home');

const typeDefs =
  /* eslint-disable-next-line no-inline-comments */
  /* GraphQL */ `
    type Query {
      availablePayments: [AvailablePayment]

      blog: [Blog]
      bookings(where: BookingsFilter, limit: Int, offset: Int, order: String): [Booking]

      cancellationPolicies: [CancellationPolicy]
      categoryTypes(filter: CategoryTypesFilter): [CategoryType]
      cities: [City]
      countries(where: CountriesFilter, withoutLocale: Boolean): [Country]
      countryDestinations: [CountryDestination]
      countryTour: [Countries]
      currencies: [Currency]

      discover(input: DiscoverInput, page: Int): Discover
      discoverToursCount(input: DiscoverInput): Int

      features: [Feature]

      homePageFeed: [HomePageFeed]

      languages: [Language]

      newTours: NewTour

      productPriceRange: ProductPriceRange
      profile(id: ID, token: String): Profile

      review(id: ID, where: ReviewFilter): Review
      reviews(where: ReviewFilter, limit: Int, offset: Int, order: String): [Review]

      topRatedProducts: [TopRatedProduct]
      tourBySlug(slug: String!): Tour
      tourLanguages(slug: String): [String]
      tourPromotion: [Tour]

      weather(city: String, timezone: Int): Weather
    }

    type Mutation {
      contactUs(input: ContactInput): Boolean
      createBooking(input: BookingInput): CreatedBooking
      createReview(input: ReviewInput): Review

      getUserData(id: ID): LoginData

      loginUser(input: Login!): LoginSuccess
      logoutUser(accessToken: String!): LoginSuccess

      registerUser(input: Register!): RegisterSuccess
      resetPassword(input: ResetPasswordInput): ResetSuccess

      setAccessToken(input: AccessToken!): AccessTokenSuccess
      socialLogin(input: SocialLogin!): LoginSuccess
      subTours(tourId: ID, currency: TourCurrencyInput): [SubTour]

      toursPricing(input: ToursPricingInput, currency: TourCurrencyInput): [ToursPricing]

      updateReview(id: ID!, input: ReviewInput): Review
      updateUser(input: UpdateUserInput): UpdateSuccess
      updatePassword(password: String!, accessToken: String!): Boolean

      setBillingCountry(input: BookingInput, currency: String): UpdateBooking
      storeSearch(query: String!): Boolean
      subscribeNewsLetter(input: NewsLetterInput): NewsLetterStatus
    }

    schema {
      query: Query
      mutation: Mutation
    }
  `;

module.exports = makeExecutableSchema({
  typeDefs: [typeDefs].concat(
    tours,
    user,
    booking,
    category,
    categoryType,
    currency,
    countries,
    cities,
    booking,
    review,
    payments,
    policies,
    language,
    contact,
    newsletter,
    weather,
    feature,
    discover,
    home,
  ),
});
