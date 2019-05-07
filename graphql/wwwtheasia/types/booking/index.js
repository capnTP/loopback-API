/* eslint-disable no-inline-comments */

const BookingInput = `
input BookingInput {
  id: ID
  firstName: String
  lastName: String
  email: String
  nationality: ID
  phone: String
  pickupPlace: String
  pickupTime: String
  flightNumber: String
  passportNumber: String
  dropOffPlace: String
  hotelName: String
  bookingMethodId: Int
  tourId: ID
  subProductId: ID
  exchangeRate: Float
  tripStarts: String
  inputDetails: InputDetails
  priceDetails: PriceDetails
  total: Float
  specialRequest: String
  pickupLocationTime: String
  langId: ID
  cancellationPolicyId: ID
  supplierCurrencyCode: String
  supplierExchangeRate: Float
  promoCode: String
  bookingCurrencyCode: String
  bookingCurrencyId: String
  billingCountryId: ID,
  selectedTime: String
 }
`;

const InputDetails = `
input InputDetails {
  adultPax: Int
  childPax: Int
  infantPax: Int
}
`;

const PriceDetails = `
input PriceDetails {
    adultPrice: Float
    childPrice: Float
    infantPrice: Float
}
`;

const CreatedBooking = `
type CreatedBooking {
  id: String
  bookingNumber: String
  adultPrice: Float
  childPrice: Float
  infantPrice: Float
  total: Float
}
`;

const UpdateBooking = `
type UpdateBooking {
  id: ID
  currency: String
  oldExchangeRate: String
  exchangeRate: Float
  exchangeTotal: Float
  billingCountry: Int
  isUserCurrency: Boolean
}
`;

module.exports = [
  BookingInput,
  CreatedBooking,
  InputDetails,
  PriceDetails,
  CreatedBooking,
  UpdateBooking,
  /* GraphQL */ `
    type Booking {
      id: ID
      created_at: String
      updated_at: String

      adult_pax: Int

      billingCountry: Country
      billingCountryId: ID
      billingFirstName: String
      billingLastName: String
      billingPhone: String

      bookingCurrencyCode: String
      booking_no: String!
      booking_status_id: String!

      child_pax: Int

      flightNumber: String

      infant_pax: Int

      passportNumber: String
      pickupLocationTime: String
      pickupPlace: String
      pickupTime: String

      review: Review

      specialRequest: String
      subTour: SubTour
      sub_product_id: ID!

      total: Float
      tour: Tour
      tour_id: ID!
      trip_starts: String

      user: Profile
      user_id: ID!
    }

    input BookingsFilter {
      user_id: ID
    }
  `,
];
