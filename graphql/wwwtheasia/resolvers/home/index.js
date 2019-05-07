const axios = require('axios');
const _ = require('underscore');

// const { THE_ASIA_API: BASE_API, BLOG_API, IMGIX_API } = require('../../config');
const { THE_ASIA_API: BASE_API, IMGIX_API } = require('../../config');
const Locale = require('../common/locale');
const ErrorResponse = require('../../shared/error');
const logger = require('../../../logger');
const numberHelper = require('../../helpers/number');

const HOME_FEED_API = `${BASE_API}/HomePageFeeds`;
const BLOG_API = `${BASE_API}/BlogFeeds`;

const resolvers = {
  HomePageFeed: {
    image({ image_url: name }) {
      return {
        raw: `${IMGIX_API}/${name}?auto=compress&lossless=1&q=15`,
        thumb: `${IMGIX_API}/${name}?crop=center,center&fit=crop&w=52&auto=compress&lossless=1&q=15`,
      };
    },
    mainText({ main_text: mainText }) {
      return mainText;
    },
    secondaryText({ secondary_text: secondaryText }) {
      return secondaryText;
    },
    secondaryTextLink({ secondary_text_link: secondaryTextLink }) {
      return secondaryTextLink;
    },
    localization({ localization }) {
      return localization;
    },
  },
  HomeFeedLocalization: {
    mainText({ main_text: mainText }) {
      return mainText;
    },
    secondaryText({ secondary_text: secondaryText }) {
      return secondaryText;
    },
  },
  Blog: {
    image(root) {
      return root.thumbnail_images;
    },
  },
  BlogImage: {
    raw(root) {
      return root.large.url;
    },
    thumb(root) {
      return root.thumbnail.url;
    },
  },
};

const query = {
  homePageFeed(root, args, context) {
    const locale = Locale.resolve(context.locale);
    const homeFeed = axios
      .get(HOME_FEED_API, {
        params: {
          filter: {
            where: {
              active: true,
              order: 'created_at DESC',
              limit: 5,
            },
          },
        },
      })
      .then(res => res.data)
      .then(list => {
        /** Pick only 1 image
         * why not return an object?
         * this is a workaround
         * and will be back to refactor it later
         *  */
        const randomIndex = numberHelper.random(0, 4);
        const randomImage = [list[randomIndex]];
        return randomImage;
      });

    return axios
      .all([locale, homeFeed])
      .then(
        axios.spread((lang, home) => {
          const { data: { id = 0, code = 'en' } = {} } = lang;
          let homePageFeed = home;
          if (id && code !== 'en') {
            homePageFeed = home.reduce((acc, item, index) => {
              const localizeProduct = item.localization.find(
                localeItem => Number(localeItem.lang_id) === id,
              );
              acc.push(Object.assign({}, home[index], localizeProduct, { id: home[index].id }));
              return acc;
            }, []);
          }

          // Remove null keys from data
          return _.map(homePageFeed, item => _.pick(item, _.identity));
        }),
      )
      .catch(({ response: { data: { error = {} } = {} } = {} }) => {
        throw new ErrorResponse(Object.assign({}, error));
      });
  },
  blog(root, args, context) {
    const locale = Locale.resolve(context.locale);
    return locale.then(localeData => {
      const code = localeData.data && localeData.data.code ? localeData.data.code : 'en';
      return axios
        .get(BLOG_API, {
          params: {
            filter: {
              where: {
                locale: code,
              },
            },
          },
        })
        .then(res => {
          const data = res.data && res.data.length ? res.data[0] : null;
          if (data && data.content) {
            try {
              const content = JSON.parse(data.content);
              return content;
            } catch (err) {
              console.log(err);
              return [];
            }
          }
          return [];
        })
        .catch(err => {
          logger.debug('blog err =>', err);
          return [];
        });
    });
  },
};

module.exports = { resolvers, query };
