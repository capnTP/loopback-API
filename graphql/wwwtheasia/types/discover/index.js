const Discover =
  /* eslint-disable-next-line no-inline-comments */
  /* GraphQL */ `
    type Discover {
      tours: [TourCard]
      toursCount: Int
      city: City
      country: String
      language: Language
      promotions: [TourCard]
      recommended: [TourCard]
      trending: [TourCard]
    }
  `;

const DiscoverInput = `
input DiscoverInput {
  query: String
  countryId: ID
  citySlug: String
  cityIds: [ID]
  categoryTypeIds: [ID]
  categoryIds: [ID]
  featureIds: [ID]
  priceRange: [Float]
  ratingRange: [Float]
  recommended: Boolean
  trending: Boolean
  promotions: Boolean
  sort: [String]
  promotionPage : Boolean
}`;

module.exports = [Discover, DiscoverInput];
