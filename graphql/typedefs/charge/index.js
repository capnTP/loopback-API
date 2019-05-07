const Charge = `
  type Charge {
    id: ID!
    booking_id: ID!
    payment_id: ID!
    pax_type: String!
    selling_price: Float!
    supplier_price: Float!
    local_price: Float!
    local_currency_code: String!
    local_exchange_rate: Float!
    charge_amount: Float!
    charge_currency_code: String!
    charge_exchange_rate: Float!
    is_cancel: Boolean!
    payment_date: String
    charge_status_id: ID!
    charge_type_id: ID!
    charge_status: String!
    charge_type: String!
    created_at: String
    updated_at: String
  }
`;

const ChargeInput = `
  input ChargeInput {
    booking_id: ID!
    pax_type: String!
    charge_type_id: ID!
    selling_price: Float!
    supplier_price: Float!
    local_price: Float!
  }
`;

const ChargeType = `
  type ChargeType {
    id: ID!
    name: String!
    created_at: String
    updated_at: String
  }
`;

module.exports = [Charge, ChargeInput, ChargeType];
