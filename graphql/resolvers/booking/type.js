module.exports = /* GraphQL */ `
  extend type Query {
    bookingStats(type: String, status_id: String): [BookingStat]
  }

  type Booking {
    id: ID
    created_at: String
    updated_at: String

    access_token: String
    adult_cost: Int
    adult_pax: Int
    adult_price: Float
    amend_details: Booking
    billing_country_id: String
    billing_first_name: String
    billing_last_name: String
    billing_phone: String
    billingCountryIdFkeyrel: BillingCountryIdFkeyrel
    booking_currency_code: String
    booking_currency_id: String
    booking_email: String
    booking_method_id: String
    booking_no: String
    booking_status_id: String
    booking_status: BookingStatus
    bookingCurrencyIdFkeyrel: BookingCurrencyIdFkeyrel
    bookingUserIdFkeyrel: BookingUserIdFkeyrel
    chargeBreakdown: [ChargeBreakdown]
    child_pax: Int
    child_price: Float
    confirmed_at: String
    drop_off_place: String
    exchange_rate: Float
    flight_number: String
    hotel_name: String
    infant_cost: Int
    infant_pax: Int
    infant_price: Float
    input_details: InputDetails
    margin: String
    meeting_point: String
    meeting_time: String
    nationality: Country
    nationalityRel: Country
    notes: [Notes]
    passport_number: String
    pickup_location_time: String
    pickup_place: String
    pickup_time: String
    price_details: PriceDetails
    tour_id: String
    promocode: String
    selected_time: String
    special_request: String
    sub_product: SubProductData
    supplier_currency_code: String
    supplier_id: Int
    supplier_memo: String
    total: Float
    tour: BookingProductIdFkeyrel
    trip_ends: String
    trip_starts: String
    user_id: String
  }

  type BookingEmail {
    displayText: String
    key: String
  }

  input BookingsInput {
    bookingMethodId: ID
    bookingStatusId: String
    currencyCode: String
    dateCreated: String
    dateUpdated: String
    limit: Int
    nationalityId: String
    offset: Int
    order: String
    searchTerm: String
    supplier_id: Int
    tripDate: String
    userId: String
  }

  input BookingsAffiliateInput {
    bookingStatusId: ID
    end: String
    limit: Int
    offset: Int
    order: String
    searchTerm: String
    start: String
  }

  input BookingsSupplierInput {
    bookingStatusId: String
    end: String
    limit: Int
    offset: Int
    order: String
    searchTerm: String
    start: String
    supplier_id: ID!
  }

  type BookingsAffiliateRes {
    count: Int
    bookings: [Booking]
  }

  input BookingSupplierInput {
    id: ID
    supplier_id: ID
    booking_status_id: ID
    supplier_memo: String
  }

  input BookingInput {
    id: ID

    adult_pax: Int
    adult_price: Float

    billing_country_id: String
    billing_first_name: String
    billing_last_name: String
    billing_phone: String
    booking_currency_id: ID
    booking_method_id: ID
    booking_status_id: ID

    child_pax: Int
    child_price: Float
    countryCode: String

    drop_off_place: String

    hotel_name: String

    email: String

    flight_number: String

    infant_pax: Int
    infant_price: Float

    nationality: Int

    passport_number: String
    pickup_place: String
    pickup_time: String
    tour_id: ID
    price_id: ID

    pickup_location_time: String
    selected_time: String
    promocode: String

    special_request: String

    total: Float
    trip_starts: String
    trip_ends: String
    supplier_id: Int
  }

  input UpdateAffiliateBookingInput {
    # Booking Optional fields
    special_request: String
    additional_information: String # Used to create/update note
    pickup_place: String
    pickup_time: String
    pickup_location_time: String
    selected_time: String
    passport_number: String
    flight_number: String
    hotel_name: String
    drop_off_place: String
  }

  type BookingStatus {
    id: ID
    backend_name: String
    booking_count: Int
    front_name: String
  }

  input NinType {
    nin: [NinInt]
  }

  input NinInt {
    id: ID
  }

  type Bookings {
    id: ID
    total: Float
    usdTotal: Float
    usdPaid: Float
    billing_first_name: String
    billing_last_name: String
    nationality: String
    billing_phone: String
    billing_country_id: String
    access_token: String
    pickup_location_time: String
    selected_time: String
    pickup_place: String
    pickup_time: String
    flight_number: String
    passport_number: String
    drop_off_place: String
    hotel_name: String
    confirmed_at: String
    booking_method_id: String
    tour_id: String
    user_id: String
    supplier_id: Int
    booking_status_id: String
    booking_currency_id: String
    booking_currency_code: String
    exchange_rate: Float
    supplier_currency_code: String
    supplier_exchange_rate: Float
    trip_starts: String
    trip_ends: String
    adult_pax: Int
    adult_cost: Int
    infant_cost: Int
    child_pax: Int
    infant_pax: Int
    adult_price: Float
    child_price: Float
    infant_price: Float
    special_request: String
    created_at: String
    updated_at: String
    booking_no: String
    promocode: String
    bookingStatusIdFkeyrel: BookingStatus
    bookingCurrencyIdFkeyrel: BookingCurrencyIdFkeyrel
    billingCountryIdFkeyrel: BillingCountryIdFkeyrel
    tour: BookingProductIdFkeyrel
    bookingUserIdFkeyrel: BookingUserIdFkeyrel
    nationality_name: String
    billing_country_name: String
    sub_product: SubProductData
    margin: String
    meeting_point: String
    meeting_time: String
    supplier_memo: String

    input_details: InputDetails
    price_details: PriceDetails

    amend_details: Bookings
    booking_email: String
  }

  type InputDetails {
    adult_pax: Int
    child_pax: Int
    infant_pax: Int
  }

  input InputDetailsInput {
    adult_pax: Int
    child_pax: Int
    infant_pax: Int
  }

  type PriceDetails {
    walkInPrice: Prices
    supplierPrice: Prices
    sellingPrice: Prices
  }

  type Prices {
    adults: String
    children: String
    infants: String
  }

  input PricesInput {
    adults: String
    children: String
    infants: String
  }

  type SubProductData {
    id: ID
    name: String
    supplier_product_name: String
    is_passport_required: Boolean
    is_pickup_detail_required: Boolean
    is_pickup_time_required: Boolean
    is_flight_information_required: Boolean
    is_drop_off_required: Boolean
    localization: [Localization]
    cancellation_policy: CancellationPolicy
    meeting_point: String
    meeting_time: String
  }

  type Localization {
    id: ID
    name: String
    description: String
    lang_id: ID
  }

  type BookingCurrencyIdFkeyrel {
    id: String
    currency_code: String
    currency_symbol: String
    currency_name: String
    exchange_rate: Float
    default: Boolean
    supplier_currency: String
    created_at: String
    updated_at: String
  }

  type BookingUserIdFkeyrel {
    id: ID
    first_name: String
    last_name: String
    name: String
    passport_number: String
    phone: String
    email: String
    country_id: String
    role: String
    country_name: String
    affiliates: Affiliate
  }

  type ActivityLog {
    id: ID
    model_id: String
    user_id: String
    model_name: String
    action_taken: String
    action_result: String
    created_at: String
    updated_at: String
    activityUserIdFkeyrel: ActivityUserIdFkeyrel
    email_activity: EmailActivity
  }

  type EmailActivity {
    id: ID
    activity_id: String
    action_taken: String
    action_result: String
    email_data: String
    email_template: String
    from: String
    to: String
    subject: String
  }

  type ActivityUserIdFkeyrel {
    id: ID
    email: String
    first_name: String
    last_name: String
  }

  type CountryById {
    id: ID
    name: String
    description: String
  }

  type ProductsSupplierIdFkeyrel {
    id: ID
    name: String
    business_phone_number: String
    address: String
    reservation_email: String
  }

  type BillingCountryIdFkeyrel {
    id: String
    name: String
    region_id: String
    currency_id: String
    lang_id: String
    description: String
    rating: Int
    seo_title: String
    seo_description: String
    seo_keywords: String
    iso_code: String
    postal_code: String
    created_at: String
    updated_at: String
  }

  type PMDetails {
    id: String
    absolute_url: String
    name: String
    mime_type: String
    size: String
    description: String
    bucket_path: String
    alt_text: String
    created_at: String
    updated_at: String
  }

  type PM {
    id: ID
    tour_id: String
    media_id: String
    is_primary: Boolean
    is_thumbnail: Boolean
    created_at: String
    updated_at: String
    details: PMDetails
  }


  type ProductsCityIdFkeyrel {
    id: ID
    city_country: PMDetails
  }

  type Feature {
    id: ID
    feature: ProductsSupplierIdFkeyrel
  }

  type TemplateString {
    stauts: Boolean
    message: String
  }

  type EmailPreview {
    status: Boolean
    htmlBody: String
    links: String
    subject: String
  }

  type BookingEmailLangType {
    id: ID
    name: String
    display_name: String
    code: String
    created_at: String
    updated_at: String
  }

  type BookingProductIdFkeyrel {
    id: ID
    name: String
    slug: String
    description_header: String
    description: String
    short_description: String
    product_type: String
    status: Boolean
    is_featured: Boolean
    is_passport_required: Boolean
    is_pickup_detail_required: Boolean
    is_pickup_time_required: Boolean
    is_flight_information_required: Boolean
    itinerary_name: String
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
    location: String
    info: String
    highlights: String
    meeting_point: String
    departure: String
    tour_duration: String
    available_day: String
    available_time: String
    meeting_time: String
    telephone: String
    show_time: String
    opening_time: String
    minimum_adult_age: String
    minimum_child_age: String
    minimum_child_height: String
    rating: String
    author_id: String
    booking_method_id: String
    currency_id: String
    contract_logo_id: String
    city_id: String
    availabilty_lang_id: String
    default_language_id: String
    supplier_id: String
    modified_user_id: String
    cancellation_policy_id: String
    latest_minimum_price: String
    created_at: String
    updated_at: String
    product_medias: [PM]
    suppliers: ProductsSupplierIdFkeyrel
    productsCityIdFkeyrel: ProductsCityIdFkeyrel
    cities: ProductsCityIdFkeyrel
    features: [Feature]
    supplier_product_name: String
    localization: [Localization]
  }

  type BookingTours {
    id: ID
    name: String
    slug: String
    description_header: String
    description: String
    short_description: String
    status: Boolean
    is_featured: Boolean
    is_passport_required: Boolean
    is_pickup_detail_required: Boolean
    is_pickup_time_required: Boolean
    is_flight_information_required: Boolean
    itinerary_name: String
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
    location: String
    info: String
    highlights: String
    meeting_point: String
    departure: String
    tour_duration: String
    available_day: String
    available_time: String
    meeting_time: String
    telephone: String
    show_time: String
    opening_time: String
    minimum_adult_age: String
    minimum_child_age: String
    minimum_child_height: String
    rating: String
    author_id: String
    booking_method_id: String
    currency_id: String
    contract_logo_id: String
    city_id: String
    availabilty_lang_id: String
    default_language_id: String
    supplier_id: String
    modified_user_id: String
    cancellation_policy_id: String
    latest_minimum_price: String
    created_at: String
    updated_at: String
    product_medias: [PM]
    suppliers: ProductsSupplierIdFkeyrel
    productsCityIdFkeyrel: ProductsCityIdFkeyrel
    features: [Feature]
    supplier_product_name: String
    cancellation_policy_id_name: String
  }

  type ArrStr {
    name: String
  }

  type Charges {
    id: ID
    booking_id: String
    payment_id: String
    pax_type: String
    charge_type: String
    selling_price: ID
    supplier_price: ID
    local_price: ID
    local_currency_code: ID
    local_exchange_rate: ID
    charge_amount: ID
    charge_currency_code: String
    charge_exchange_rate: ID
    is_cancel: Boolean
    payment_date: String
    created_at: String
  }

  type ChargeBreakdown {
    count: Int
    currencyCode: String
    statusId: ID
    type: String
    value: Float
  }

  input Checkout {
    id: ID
    billing_first_name: String
    billing_last_name: String
    email: String
    nationality: Int
    billing_phone: String
    pickup_place: String
    pickup_time: String
    hotel_name: String
    flight_number: String
    passport_number: String
    booking_method_id: ID
    tour_id: ID
    price_id: ID
    booking_currency_id: ID
    trip_starts: String
    trip_ends: String
    adult_pax: Int
    child_pax: Int
    infant_pax: Int
    adult_price: Float
    child_price: Float
    infant_price: Float
    total: Float
    promocode: String
    special_request: String
    booking_status_id: ID
    pickup_location_time: String
    selected_time: String
    countryCode: String
  }

  type Status {
    id: ID
    status: String
    message: String
  }

  type RefundOP {
    statusCode: String
    name: String
    status: String
    success: Boolean
    message: String
  }

  type BookingStat {
    label: String!
    value: String!
  }
`;
