const Currency = `
type Currency {
  id: ID!
  code: String
  symbol: String
  name: String
  displayName: String
  exchangeRate: String
}`;

module.exports = [Currency];
