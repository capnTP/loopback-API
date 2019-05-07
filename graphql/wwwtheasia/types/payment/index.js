module.exports = [
  /* eslint-disable-next-line no-inline-comments */
  /* GraphQL */ `
    type AvailablePayment {
      id: ID
      name: String
      icon: String
      type: Int
      currencies: [String]
    }
  `,
];
