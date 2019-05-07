/* eslint-disable no-inline-comments */

module.exports = [
  /* GraphQL */ `
    type Profile {
      id: String!

      birthday: String

      countryId: String

      email: String!

      firstName: String

      lastName: String
      languageId: String
      language_id: String @deprecated(reason: "Use languageId instead")

      name: String
      nationality: Country
      newsletter: NewsLetter

      passport_number: String
      phone: String
    }

    input Login {
      email: String!
      password: String!
    }

    input AccessToken {
      userId: Int!
      accessToken: String!
    }

    type AccessTokenSuccess {
      userId: Int!
      accessToken: String!
    }

    type LoginSuccess {
      id: String!
      ttl: String!
      created: String!
      userId: String!
      email: String
      first_name: String
      last_name: String
      passport_number: String
      phone: String
    }

    type LoginData {
      id: String
      ttl: String
      created: String
      userId: String
      email: String
      first_name: String
      last_name: String
      passport_number: String
      phone: String
    }

    input Register {
      userName: String
      email: String!
      password: String!
      birthday: String
      lang_id: ID
      terms_accepted_at: String!
    }

    type RegisterSuccess {
      email: String!
      dateCreated: String!
      birthday: String
      terms_accepted_at: String!
    }

    input SocialLogin {
      id: ID
      email: String
      firstName: String
      lastName: String
      loginType: String
      accessToken: String!
    }

    input UpdateUserInput {
      id: String

      birthday: String

      country_id: String

      email: String

      first_name: String

      last_name: String
      language_id: String

      name: String
      nationality: String

      passport_number: String
      phone: String
      profile_pic: String
    }

    input ResetPasswordInput {
      oldPassword: String!
      newPassword: String!
    }

    type UpdateSuccess {
      id: String
      name: String
      first_name: String
      last_name: String
      phone: String
      country_id: String
      birthday: String
      nationality: String
    }

    type ResetSuccess {
      oldPassword: String
      newPassword: String
    }

    type NewsLetter {
      id: ID!

      email: String!
      newsletter_press: Boolean!
      newsletter_product_updates: Boolean!
      newsletter_promotional: Boolean!
      user_id: ID
    }
  `,
];
