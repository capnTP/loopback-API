module.exports = [
  /* GraphQL */ `
    type Draft {
      id: ID!

      # Customer information
      billing_email: String
      billing_first_name: String
      billing_last_name: String
      billing_phone: String
      billing_country_id: ID
      billing_country: Country
      nationality: ID
      nationalityRel: Country
      billing_language_id: ID

      # Optional details depending on sub_product
      pickup_place: String
      pickup_time: String
      pickup_location_time: String
      selected_time: String
      passport_number: String
      flight_number: String
      hotel_name: String
      drop_off_place: String
      special_request: String
      additional_information: String

      # Booking Information
      booking_currency_id: ID
      booking_currency_code: String
      booking_currency: Currency
      exchange_rate: Float
      supplier_exchange_rate: Float
      total: Float
      trip_starts: String
      input_details: InputDetails
      price_details: DraftPriceDetails
      commission: Float
      commission_percent: Float
      discount: Float
      discount_percent: Float
      vat: Float
      vat_percent: Float

      draft_type: Int

      # Other Relations
      affiliate_id: ID
      affiliate: Affiliate
      sub_product_id: ID
      sub_product: SubProductOP
      tour_id: ID
      tour: Product
      user_id: ID
      user: User

      created_at: String
      updated_at: String
    }

    input DraftInput {
      id: ID
      booking_currency_id: ID
      booking_currency_code: String
      billing_email: String
      billing_first_name: String
      billing_last_name: String
      billing_phone: String
      billing_country_id: ID
      nationality: ID
      billing_language_id: ID

      special_request: String
      additional_information: String
      pickup_place: String
      pickup_time: String
      pickup_location_time: String
      selected_time: String
      passport_number: String
      flight_number: String
      hotel_name: String
      drop_off_place: String

      trip_starts: String
      input_details: InputDetailsInput
      price_details: DraftPriceDetailsInput
      commission: Float
      commission_percent: Float
      discount: Float
      discount_percent: Float
      vat: Float
      vat_percent: Float
      exchange_rate: Float
      supplier_exchange_rate: Float
      total: Float
      draft_type: Int

      affiliate_id: ID
      sub_product_id: ID
      tour_id: ID
      user_id: ID
    }

    type DraftPriceDetails {
      supplierPrice: Prices
      sellingPrice: Prices
      manualPrice: Prices
    }

    input DraftPriceDetailsInput {
      supplierPrice: PricesInput
      sellingPrice: PricesInput
      manualPrice: PricesInput
    }
  `,
];
