const NewsLetter = /* GraphQL */ `
  input NewsLetterInput {
    email: String
  }
`;

const NewsLetterStatus = /* GraphQL */ `
  type NewsLetterStatus {
    status: Boolean
    error: Boolean
    errorMessage: String
  }
`;

module.exports = [NewsLetter, NewsLetterStatus];
