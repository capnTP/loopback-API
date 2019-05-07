module.exports = /* GraphQL */ `
  extend type Query {
    payout(id: ID!, reciever_id: ID): Payout
    payouts(where: PayoutFilters): [Payout]!
    payoutsCount(where: PayoutFilters): Int
    payoutsSupplier(where: PayoutFilters): PayoutsResponse
  }

  extend type Mutation {
    removeBookingsFromPayout(input: RemoveBookingInput): RemoveBookingResponse
    addAttachment(input: PayoutsInput):  PayoutUpdateResponse
    updatePayoutStatus(input: PayoutsInput):  PayoutUpdateResponse
  }

  type Payout {
    id: ID!
    amount: Float
    attachments:[String]
    currency_code: String
    exchange_rate: Float
    details:[Int]
    reciever_id: Int
    supplier: Supplier
    payer_company_id: Int
    company: Company
    payment_method_id: Int
    payment_method: PaymentMethod
    comments: String
    status: String
    payment_type: String
    created_at: String
    transaction_date: String
    due_date: String
  }

  type PayoutsResponse {
    payouts: [Payout]!
    count: Int
  }

  input PayoutFilters {
    currency_code: String
    transaction_date: String
    due_date: String
    created_at: PayoutDateFilter
    payment_type: String
    status: [String]
    amount: Float
    limit: Int
    offset:Int
    payment_method_id: Int
    reciever_ids: [Int]
    payer_company_id: Int
  }

  input PayoutDateFilter {
    to:String
    from:String
  }

  type RemoveBookingResponse {
    status: Boolean
    message: String
    reminings: [Int]
  }

  type PayoutUpdateResponse {
    id:ID
    status: Boolean
    message: String
  }
  input PayoutsInput {
    id: ID
    payment_method_id: Int
    comments: String
    status: String
    transaction_date: String
    attachments: [String]
  }
  input PayoutBookingObjectMap {
    payout_id: Int
    booking_ids: [Int]
  }
  input RemoveBookingInput {
    payout_ids: [PayoutBookingObjectMap]
  }
`;
