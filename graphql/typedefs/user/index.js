const Profile = `
type Profile {
 id: String
 name: String
 email: String!
 avatar: Image
}
`;

const UsersRoleRel = `
  type UsersRoleRel {
    id: ID
    name: String
  }`;

const UpdateUser = `
input UpdateUser {
  id:ID!
  first_name:String
  last_name:String
  phone:String
  role:ID
  country_id:ID
}
`;

const UpdateUserOP = `
  type UpdateUserOP {
    id:ID!
    first_name:String
    last_name:String
    phone:String
    role:ID
    country_id:ID
    email: String
}
`;

const User = `
type User {
  id: ID!
  email: String!
  # whether the user's email are verified or not
  email_verified: Boolean!
  # Date that user accept Terms and Conditions
  terms_accepted_at: String
  # Full name of the user
  name: String
  # The user's first name
  first_name: String
  # The user's last name
  last_name: String
  # Date of user birthday
  birthday: String
  # User passport infomation
  passport_number: String
  # User phone number
  phone: String
  country: Country
  supplier: Supplier
  created_at: String
  updated_at: String
  realm: String
  # ref id of language
  language_id: ID
  # ref id of country
  country_id: Int
  # ref id of supplier
  supplier_id: Int
  # ref id of affiliate
  affiliate_id: Int
  emailVerified: Boolean @deprecated(reason: "This field is not correct with the name convension")
  role: UsersRoleRel
  affiliates: Affiliate
}
`;

const Login = `
input Login {
    email: String!
    password: String!
}`;

const AccessToken = `
input AccessToken {
    userId: Int!
    accessToken: String!
}`;

const AccessTokenSuccess = `
type AccessTokenSuccess {
    userId: Int!
    accessToken: String!
}`;

const LoginSuccess = `
type LoginSuccess {
  id: String!
  ttl: String!
  created: String!
  userId: String!
  supplier_id: String
  affiliate_id: String
}
`;

const Register = `
input Register {
  email: String!
  password: String!
  birthday: String!
  terms_accepted_at: String!
  role: String
}
`;

const RegisterSuccess = `
type RegisterSuccess {
  email: String!
  dateCreated: String!
  birthday: String!
  terms_accepted_at: String!
}
`;

const Role = `
type Role {
  id: String!
  name: String
}
`;

const CardData = `
input CardData {
  cardType: String
  cipher: String
  makeDefault: Boolean
}
`;

const TokenizedCardData = `
type TokenizedCardData {
  id:ID!
  user_id: String
  alias: String
  token: String
  last_four: String
  card_type: String
  default: Boolean
}
`;

// const UserName = `
// type UserName {
//   id:ID,
//   email:String,
//   first_name:String,
//   last_name:String,
// }
// `;

module.exports = [
  CardData,
  TokenizedCardData,
  Register,
  RegisterSuccess,
  Login,
  LoginSuccess,
  AccessToken,
  AccessTokenSuccess,
  Profile,
  User,
  Role,
  UsersRoleRel,
  UpdateUser,
  UpdateUserOP,
];
