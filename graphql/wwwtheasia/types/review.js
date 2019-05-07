module.exports = [
  /* eslint-disable-next-line no-inline-comments */
  /* GraphQL */ `
    type Review {
      id: ID!
      created_at: String
      updated_at: String
      booking: Booking
      booking_id: ID
      group_size: Int
      language_id: ID
      rating: Float
      recommend: Boolean
      review: String
      review_title: String
      reviewer_name: String
      status: Int
      subTour: SubTour
      sub_product_id: ID
      tour: Tour
      tour_id: ID
      user_id: ID
      reviewerName: String
      reviewTitle: String
      reviewDescription: String
      nationalityFlag: String
      createdAt: String
    }

    input ReviewFilter {
      booking_id: ID

      user_id: ID
    }

    input ReviewInput {
      booking_id: ID

      group_size: Int

      language_id: ID

      nationality: ID

      rating: Float
      recommend: Boolean
      review: String
      review_title: String
      reviewer_name: String

      sub_product_id: ID

      tour_id: ID

      user_id: ID
    }

    type TopRatedProduct {
      id: ID
      tours: TourCard
      reviews: Review
    }
  `,
];
