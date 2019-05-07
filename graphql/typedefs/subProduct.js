module.exports = [
  /* GraphQL */ `
    type SubProduct {
      id: ID
      created_at: String
      updated_at: String

      address: String
      availability_type: String

      base_price: [Pricing]

      cancellation_policy_id: ID

      date_excluded: String
      departure: String

      ends_on: String

      is_passport_required: Boolean
      is_pickup_place_required: Boolean
      is_pickup_time_required: Boolean
      is_flight_information_required: Boolean
      is_hotel_name_required: Boolean
      itinerary: String

      map: String
      meta_data: [MetaData]
      max_pax: Int
      meeting_point: String
      meeting_time: String
      minimum_adult_age: Int
      minimum_child_age: Int
      minimum_child_height: Int

      name: String

      opening_time: String

      pickup_location_time: String
      selected_time: String
      product_features: String

      rating: Float
      repeat_on: String

      short_description: String
      show_time: String
      starts_on: String
      status: Boolean
      supplier_product_name: String

      telephone: String
      tour_duration: String
      tour_id: ID!
      tour: Product
    }

    type SubProductOP {
      id: ID
      created_at: String
      updated_at: String

      base_price: [Pricing]
      lang: String
      name: String
      description: String
      short_description: String
      description_header: String
      status: Boolean
      is_featured: Boolean
      product_features: String
      itinerary: String
      map: String
      starts_on: String
      ends_on: String
      availability_type: String
      repeat_on: [String]
      date_excluded: [String]
      localization: String
      is_passport_required: Boolean
      passport_information: String
      is_drop_off_required: Boolean
      is_pickup_detail_required: Boolean
      is_pickup_time_required: Boolean
      pickup_location_time: String
      selected_time: String
      is_flight_information_required: Boolean
      is_pickup_place_required: Boolean
      is_hotel_name_required: Boolean
      flight_information: String
      contract_starts_at: String
      contract_ends_at: String
      sku: String
      seo_title: String
      seo_description: String
      seo_keywords: String
      keywords: String
      address: String
      latitude: String
      longitude: String
      info: String
      highlights: String
      important_information: String
      meeting_point: String
      departure: String

      author_id: ID
      available_day: String
      available_time: String

      booking_method_id: ID

      calendarPricing: [SubProductPricing]
      cancellation_policy_id: ID
      cancellation_policy: CancellationPolicy
      city_id: ID
      contract_logo_id: ID
      currency_id: ID

      default_language_id: ID

      is_discounted: Boolean
      itinerary_name: String

      lang_availability: String
      location: String

      meta_data: [MetaData]
      max_pax: String
      meeting_time: String
      minimum_adult_age: Int
      minimum_child_age: Int
      minimum_child_height: Int
      modified_user_id: ID

      opening_time: String

      # Use JSON.parse before returning
      parsedItinerary: [SubProductItinerary]
      pricing: [SubProductPricing]

      rating: Float
      reviews: [Review]

      show_time: String
      slug: String
      sub_product_id: ID
      supplier_id: ID
      supplier_product_name: String

      telephone: String
      tour_duration: String
      tour_id: ID
      tour: Product
      notice: String

      # minimun pax calculated from base_price
      minimum_pax: Int
    }

    type SubProductItinerary {
      description: String
      from: String
      title: String
      to: String
    }

    type SubProductPricing {
      id: ID
      startDate: String
      endDate: String
      pricing: [Pricing]
    }

    type PricingPax {
      adults: String
      children: String
      infants: String
    }

    type Pricing {
      allotment: String
      pax: String
      walkInPrice: PricingPax
      supplierPrice: PricingPax
      sellingPrice: PricingPax
    }

    input SubProductInput {
      id: ID

      base_price: [PricingInput]
      tour_id: ID
      sub_product_id: ID
      lang: String
      name: String
      description: String
      short_description: String
      description_header: String
      status: Boolean
      is_featured: Boolean
      product_features: String
      itinerary: String
      map: String
      starts_on: String
      ends_on: String
      availability_type: String
      repeat_on: String
      date_excluded: String
      localization: String
      is_passport_required: Boolean
      passport_information: String
      is_drop_off_required: Boolean
      is_pickup_detail_required: Boolean
      is_pickup_time_required: Boolean
      is_flight_information_required: Boolean
      pickup_location_time: String
      selected_time: String
      is_pickup_place_required: Boolean
      is_hotel_name_required: Boolean
      flight_information: String
      contract_starts_at: String
      contract_ends_at: String
      sku: String
      seo_title: String
      seo_description: String
      seo_keywords: String
      keywords: String
      address: String
      latitude: String
      longitude: String
      info: String
      highlights: String
      important_information: String
      meeting_point: String
      departure: String
      tour_duration: String
      available_day: String
      available_time: String
      meeting_time: String
      minimum_adult_age: Int
      minimum_child_age: Int
      minimum_child_height: Int
      rating: Float
      author_id: ID
      booking_method_id: ID
      currency_id: ID
      contract_logo_id: ID
      city_id: ID
      supplier_id: ID
      modified_user_id: ID
      cancellation_policy_id: ID
      lang_availability: String
      updated_at: String
      category: [ID]
      feature: [ID]
      location: String
      telephone: String
      opening_time: String
      show_time: String
      default_language_id: ID
      slug: String
      itinerary_name: String
      supplier_product_name: String
      is_discounted: Boolean
      max_pax: String

      meta_data: [MetaDataInput]
      notice: String
    }

    input SubProductPricingInput {
      id: ID
      startDate: String
      endDate: String
      pricing: [PricingInput]
    }

    type MetaData {
      key: String
      value: String
    }

    input MetaDataInput {
      key: String!
      value: String!
    }

    input PricingInput {
      allotment: String
      pax: String
      walkInPrice: PricingPaxInput
      supplierPrice: PricingPaxInput
      sellingPrice: PricingPaxInput
    }

    input PricingPaxInput {
      adults: String
      children: String
      infants: String
    }
  `,
];
