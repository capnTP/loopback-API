module.exports = /* GraphQL */ `
  extend type Query {
    payoutInvoiceSetting(id: ID!, reciever_id: ID): PayoutInvoiceSetting
    payoutInvoiceSettings: [PayoutInvoiceSetting]!
  }

  type PayoutInvoiceSetting {
    id: ID!
    name: String
    code: String
    description: String
  }
`;
