module.exports = [
  /* eslint-disable-next-line no-inline-comments */
  /* GraphQL */ `
    type HomePageFeed {
      id: ID!
      image: HomeBanner
      mainText: String
      secondaryText: String
      secondaryTextLink: String
      localization: [HomeFeedLocalization]
    }

    type HomeBanner {
      thumb: String
      raw: String
    }

    type HomeFeedLocalization {
      id: String
      languageId: ID
      mainText: String
      secondaryText: String
    }

    type Blog {
      title: String
      url: String
      content: String
      image: BlogImage
    }

    type BlogImage {
      raw: String
      thumb: String
    }
  `,
];
