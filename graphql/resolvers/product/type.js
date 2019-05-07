module.exports = /* GraphQL */ `
  extend type Query {
    product(id: ID!, lang: ID, langCode: String, supplier_id: ID): Product
    productDetailList: [ProductDetailAssets]
    productFeatures: [ProductFeature]
    productPriceRange: ProductPriceRange
    products(filters: ProductFilters, limit: Int, offset: Int, order: String): [Product]!
    productsDiscover(
      application_name: String
      category_ids: [ID]
      category_type_ids: ID
      city_ids: [ID]
      city_slug: String
      count: Boolean
      country_id: ID
      currency_code: String
      feature_ids: [ID]
      lang_id: ID
      latest: Boolean
      limit: Int
      offset: Int
      price_range: [Float]
      promotionPage: Boolean
      promotions: Boolean
      query: String
      rating: [Float]
      recommended: Boolean
      sort: String
      supplier_id: ID
      trending: Boolean
    ): DiscoverResponse
    productsCount(where: ProductFilters): Int
  }

  extend type Mutation {
    deleteProduct(id: ID!): Success
    duplicateProduct(id: ID!, name: String, supplier_id: ID): Product
    getProductsByKeyword(input: ProductInput): [Product]
    updateProduct(input: ProductInput!, lang: ID, productLangId: ID): Product
    updateProductMedia(input: ProductMediaInput!): Success
  }

  type Product {
    id: ID
    created_at: String
    updated_at: String

    address: String
    author_id: Int
    availabilty_lang_id: ID
    available_day: String
    available_languages: [Language]
    available_time: String
    booking_method_id: Int
    booking_method: BookingMethod
    cancellation_policy_id: Int
    cancellation_policy: CancellationPolicy
    categories: [ProductCategory]!
    category_type_id: ID
    category_type(locale_code: String): ProductCategoryType
    city_id: Int
    city: City
    contract_ends_at: String
    contract_logo_id: Int
    contract_logo: ContractLogo
    contract_starts_at: String
    country_id: Int
    country: Country
    currency_id: Int
    currency: Currency
    default_language_id: ID
    departure: String
    description_header: String
    description: String
    enable: Boolean
    excerpt: String
    excluded_included: [ProductExcludeInclude]!
    features: [ProductFeature]!
    flight_information: String
    highlights: String
    highligts: String @deprecated(reason: "This is misspelling, Use highlights instead.")
    image: Image
    important_information: String
    importantInformation: [ProductImportantInformation]
    info: String
    is_discounted: Boolean
    is_featured: Boolean
    is_flight_information_required: Boolean
    is_passport_required: Boolean
    is_pickup_detail_required: Boolean
    is_pickup_time_required: Boolean
    is_published: Boolean!
    itinerary_name: String
    keywords: String
    lang_availability: String @deprecated(reason: "It is not used anymore")
    lang: [Language]! @deprecated(reason: "It is not used anymore")
    latitude: String
    location: String
    longitude: String
    map: String
    medias: [ProductMedia]
    meeting_point: String
    meeting_time: String
    minimum_adult_age: String
    minimum_child_age: String
    minimum_child_height: String
    minimumPrice: Float
    modified_user_id: Int
    name: String!
    opening_time: String
    parsed_description_header: [String]
    parsed_description: [String]
    parsed_short_description: [String]
    parsedHighlights: [String]
    parsedMaps: [ProductMap]
    passport_information: String
    pax_minimum_details: PaxMinimumDetails
    primary_media: ProductMedia
    product_type: String
    products_lang_id: ID
    rating: Float
    resolved_excluded_included_list: [ExcludeInclude]
    resolved_features(locale_code: String): [FeatureInfo]
    resolved_categories(locale_code: String): [Category]
    reviews: [Review]
    schema_org: String
    seo_description: String
    seo_keywords: String
    seo_title: String
    short_description: String
    show_time: String
    sku: String
    slug: String
    status: Boolean
    subProducts(status: Boolean): [SubProductOP]
    supplier_id: Int
    supplier_product_name: String
    supplier: Supplier
    tags: String
    telephone: String
    thumbnail: ProductMedia
    tour_duration: String
    type: String
  }

  type PaxMinimumDetails {
    minimum_adult_age: String
    minimum_child_age: String
    minimum_child_height: String
  }

  type ProductImportantInformation {
    head: String
    body: [String]
  }

  type ProductCategoryType {
    id: ID!
    name: String!
  }

  type ProductMap {
    title: String
    description: String
    latitude: String
    longitude: String
  }

  type ProductMedia {
    id: ID

    details: ProductMediaDetails
    is_primary: Boolean
    is_thumbnail: Boolean
    media_id: ID
    tour_id: ID

    created_at: String
    updated_at: String
  }

  type ProductMediaDetails {
    id: ID
    absolute_url: String
    imgix_url: String @deprecated(reason: "Invalid naming convention, use 'imgixUrl' instead")
    imgixUrl: String
    name: String
    mime_type: String
    size: String
    description: String
    bucket_path: String
    alt_text: String
    order: Int
    created_at: String
    updated_at: String
  }

  # Represent /categories/:id
  type CategoryInfo {
    id: ID!
    name: String
  }

  # Transaction of a products relation with categories
  type ProductCategory {
    id: ID!

    category: CategoryInfo
    category_id: ID
    tour_id: ID

    created_at: String
    updated_at: String
  }



  type ProductExcludeInclude {
    id: ID!
    created_at: String
    updated_at: String

    excluded_included_id: ID
    tour_id: ID
    type: Boolean
  }

  type ExcludeInclude {
    id: ID!
    name: String!
    type: Boolean!
  }

  type IncludeExclude {
    id: ID!
    name: String
  }

  type BookingMethod {
    id: ID!
    name: String
    active: Boolean
    created_at: String
    updated_at: String
  }

  type ProductDetailAssets {
    id: ID!
    icon: String
    name: String
    col_name: String
  }

  type Country {
    id: ID!
    name: String!
    region_id: ID!
    currency_id: ID!
    language: Language!
    created_at: String
    updated_at: String
  }

  type Language {
    id: ID!
    name: String!
    display_name: String!
    code: String!
    created_at: String
    updated_at: String
  }

  type CategoryType {
    id: ID!
    name: String
  }

  type Category {
    id: ID!
    name: String!
    image: Image
    category_type_id: String!
  }

  # Represent /features/:id
  type FeatureInfo {
    id: ID!
    name: String
  }

  # Transaction of a products relation with features and partialy merged with the Feature itself
  type ProductFeature {
    # becareful this is the transaction id for features that
    # related with the product. For sure use feature_id field instead.
    id: ID!

    feature: FeatureInfo
    feature_id: ID
    name: String
    tour_id: ID
    status: String
    value: String

    created_at: String
    updated_at: String
  }

  type Currency {
    id: ID!
    currency_code: String
    currency_symbol: String
    currency_name: String
    code: String
    symbol: String
    name: String
    display_name: String
    displayName: String
    exchangeRate: String
    exchange_rate: Float
  }

  type CancellationPolicy {
    id: ID!
    #slug lowercase, is used to compare and translate from locale json.
    slug: String!
    name: String
    description: String
    created_at: String
    updated_at: String
    localization: [Localization]
  }

  type NewsLettersSubscriptions {
    email: String!
    newsletter_promotional: Boolean
    newsletter_press: Boolean
    newsletter_product_updates: Boolean
  }

  type ContractLogo {
    id: ID!
    name: String
    logo_url: String
  }

  type DiscoverResponse {
    count: Int
    products: [DiscoverProduct]
    status: Boolean
  }

  type DiscoverProduct {
    id: ID!

    alt_text: String

    bucket_path: String

    city_id: ID
    city_name: String

    discount_percent: Float

    feature_names: [String]

    image: String
    image_name: String
    is_discounted: Boolean

    name: String

    rating: Float

    seo_title: String
    seo_description: String
    short_description: String
    slug: String
    starting_price: Float
  }

  input ProductInput {
    id: ID
    updated_at: String

    address: String
    author_id: ID
    available_day: String
    available_time: String
    availabilty_lang_id: String

    booking_method_id: ID

    cancellation_policy_id: ID
    category: [ID]
    category_type_id: ID
    city_id: ID
    country_id: ID
    contract_ends_at: String
    contract_logo_id: ID
    contract_starts_at: String
    currency_id: ID

    description: String
    default_language_id: ID
    departure: String
    description_header: String

    feature: [ID]
    flight_information: String

    highlights: String

    important_information: String
    info: String
    is_discounted: Boolean
    is_featured: Boolean
    is_flight_information_required: Boolean
    is_passport_required: Boolean
    is_pickup_detail_required: Boolean
    is_pickup_time_required: Boolean
    itinerary_name: String

    keywords: String

    latitude: String
    location: String
    longitude: String

    map: String
    meeting_point: String
    meeting_time: String
    minimum_adult_age: Int
    minimum_child_age: Int
    minimum_child_height: Int
    modified_user_id: ID

    name: String

    opening_time: String

    passport_information: String
    pax_minimum_details: PaxMinimumDetailsInput
    product_type: String

    rating: Float

    schema_org: String
    seo_description: String
    seo_keywords: String
    seo_title: String
    short_description: String
    show_time: String
    tags: String
    sku: String
    slug: String
    status: Boolean
    enable: Boolean
    supplier_id: ID
    supplier_product_name: String

    telephone: String
    tour_duration: String
  }

  input PaxMinimumDetailsInput {
    minimum_adult_age: String
    minimum_child_age: String
    minimum_child_height: String
  }

  # Transaction of a products relation with categories
  input ProductCategoryInput {
    id: ID
    tour_id: ID
    category_id: ID
    created_at: String
    updated_at: String
  }

  # Transaction of a products relation with Exclude and Include
  input ProductExcludeIncludeInput {
    # Becareful this is the transaction ID
    id: ID
    tour_id: ID
    excluded_included_id: ID
    type: Boolean
    created_at: String
    updated_at: String
  }

  # The product price input type
  input ProductPriceInput {
    id: ID
    pax: Int!
    adult_price: Float!
    adult_cost: Float!
    child_price: Float
    child_cost: Float
    infant_price: Float
    infant_cost: Float
    allotment: Int
    adult_walking_price: Float
    child_walking_price: Float
    infant_walking_price: Float
  }

  # product media actual details of images/videos
  input ProductMediaInput {
    id: ID

    alt_text: String
    order: Int
    description: String
    is_primary: Boolean
    is_thumbnail: Boolean
    mainMediaId: ID
    tour_id: ID
  }

  input ProductFilters {
    cancellation_policy_id: ID
    city_id: ID
    city_ids: [ID]
    country_id: ID

    is_discounted: Boolean
    is_published: Boolean

    keywords: String

    searchTerm: String
    status: ID
    supplier_id: ID
  }

  type ProductPriceRange {
    max: Float
    min: Float
  }
`;
