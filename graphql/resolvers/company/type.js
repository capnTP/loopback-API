module.exports = /* GraphQL */ `
  extend type Query {
    company(id: ID!): Company
    companies(offset: Int, limit: Int): [Company]!
    companiesCount: Int
  }

  type Company {
    id: ID!
    company_name: String
    email: String
    country_id: Int
    country:Country
    user_id: Int
    logo: String
  }


  input CompanyInput {
    id: Int
    company_name: String
    email: String
    country_id: Int
    user_id: Int
    logo: String
    searchTerm: String
    order: String
  }
`;
