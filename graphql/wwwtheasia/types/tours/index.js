const IconText = `
type IconText {
 icon: String
 text: String
}
`;
const Information = `
type Information {
 head: String
 body: String
}
`;

const TourDetail = `
type TourDetail {
 icon: String
 name: String
 text: String
}
`;

const TourMap = `
type TourMap {
 title: String
 description: String
 latitude: String
 longitude: String
}
`;

const TourGallery = `
type TourGallery {
 id: ID
 raw: String
 small: String
 thumb: String
 alt: String
 description: String
}
`;

const TourSEO = `
type TourSEO {
 title: String
 description: String
 keywords: String
 schema: String
}
`;
const TourCurrency = `
type TourCurrency {
 id: ID
 code: String
 exchangeRate: String
}`;

const Tour = `
  type Tour {
    id: ID

    currency: TourCurrency
    city: City
    descriptionHeader: [String]
    details: [TourDetail]

    excludes: [IconText]

    highlights: [String]

    images: [TourGallery]
    includes: [IconText]
    information: [Information]
    isPublished: Boolean
    isDiscounted: Boolean

    latestMinimumPrice: Float
    locations: [TourMap]
    longDescription: [String]

    name: String

    seo: TourSEO
    shortDescription: String

    title: String
    tourMedias: [TourMedia]

    travellerRequirement: UserMinimumRequirement
    currentDate: String
    tourType: String
    featureType: String
    reviews: [Review]
    rating: Float
    discountPercentage: Float
    
    slug: String
  }
`;

const TourMedia = `
  type TourMedia {
    id: ID!

    isPrimary: Boolean
    isThumbnail: Boolean

    detail: TourMediaDetail
  }

  type TourMediaDetail {
    id: ID!

    absoluteUrl: String
  }
`;

// ------ Sub product ----

const PickupDetail = `
type PickupDetail{
id: ID
displayOrder: Int
details: String
}`;

const CheckoutInfo = `
type CheckoutInfo{
 isPassportRequired: Boolean
 isPickupDetailRequired: Boolean
 isPickupTimeRequired: Boolean
 isFlightInfoRequired: Boolean
 isHotelNameRequired: Boolean
 pickupDetails: [PickupDetail]
 isDropOffRequired: Boolean
}
`;

const UserMinimumRequirement = `
type UserMinimumRequirement {
 minimumAdultAge: String
 minimumChildAge: String
 minimumChildHeight: String
}`;

const ItineraryTime = `
 type ItineraryTime {
 from: String
 to: String
}
`;

const Itinerary = `
type Itinerary {
 title: String
 description: String
 time: ItineraryTime
}
`;

const TravellerCount = `
type TravellerCount {
 adults: Float
 children: Float,
 infants: Float
}
`;

const PriceTypes = `
type PriceTypes {
 pax: String
 walkIn: TravellerCount
 selling: TravellerCount
 exchange: TravellerCount
}
`;

const TourPrices = `
type TourPrices {
 startDate: String
 endDate: String
 availabilityType: String
 repeatOn: [String]
 excludeDates: [String]
 maximumPax: String
 basePrice: [PriceTypes]
}`;

const TourCard = `
type TourCard {
 id: ID
 slug: String
 startingPrice: Float
 cityId: ID
 city: String
 rating: Float
 discount: Float
 name: String
 sortDescription: String
 seo: TourSEO
 image: TourGallery
 features:[String]
}`;

const TimeLocation = `
type TimeLocation {
  time: String
  location: String
}`;

const SubTour = `
  type SubTour {
    id: ID

    cancellationPolicy: CancellationPolicy
    checkoutInfo: CheckoutInfo

    details: [TourDetail]

    itinerary: [Itinerary]

    locations: [TourMap]

    name: String

    priceInfo: TourPrices

    shortDescription: [String]

    title: String
    travellerRequirement: UserMinimumRequirement
    type: String
    selectedTime: [TimeLocation]
    pickupLocationTime: [TimeLocation]
    rating: Float
    reviews: [Review]
  }
`;

const ToursPricing = `
type ToursPricing {
 id: ID
 subProductId: ID
 startDate: String
 endDate: String
 prices:[PriceTypes]
}
`;

const ToursPricingInput = `
input ToursPricingInput {
 subProducts: [ID]
 date: String
 adults: Int
 children: Int
 infants: Int
}
`;

const TourCurrencyInput = `
input TourCurrencyInput {
 id: ID
 code: String
 exchangeRate: String
}`;

const NewTour = `
type NewTour {
  tours: [TourCard]
}`;

const ProductPriceRange =
  /* eslint-disable-next-line no-inline-comments */
  /* GraphQL */ `
    type ProductPriceRange {
      high: Float
      low: Float
    }
  `;

module.exports = [
  IconText,
  Information,
  TourDetail,
  TourMap,
  TourMedia,
  TourGallery,
  TourSEO,
  TourCurrency,
  Tour,
  TourCard,
  PickupDetail,
  ProductPriceRange,
  CheckoutInfo,
  UserMinimumRequirement,
  ItineraryTime,
  Itinerary,
  TravellerCount,
  PriceTypes,
  TourPrices,
  SubTour,
  ToursPricing,
  TimeLocation,
  // -Inputs
  ToursPricingInput,
  TourCurrencyInput,
  NewTour,
];
