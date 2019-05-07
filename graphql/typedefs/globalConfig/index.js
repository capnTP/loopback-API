module.exports = [
  `
    type GlobalConfig {
      id: ID!
      key: String
      value: String
      enable: Boolean
      readonly: Boolean
    }

    input GlobalConfigInput {
      id: ID

    }
  `,
];
