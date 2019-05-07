const axios = require('axios');
const _ = require('lodash');
const { constants: { isProduction } } = require('../../utility')
// const app = require('../../../server/index')

// TODO: replace with environment variables or a global config file
const BASE_PATH = isProduction
  ? 'https://blog.theasia.com/'
  : 'http://blog-development.theasia.com/'
const BLOG_API = `${BASE_PATH}?json=get_recent_posts&count=6&cat=`

module.exports = function (BlogFeed) {
  BlogFeed.getBlogDataCron = async () => {
    const blogLang = [
      { id: 74, code: 'en' },
      { id: 75, code: 'ko' },
      { id: 232, code: 'zh' },
      { id: 387, code: 'th' },
    ];
    const requestPromiseObject = [];
    _.each(blogLang, (lang_obj, index) => {
      const uri = `${BLOG_API}${lang_obj.id}`;
      requestPromiseObject.push(axios
      .get(uri, { timeout: 15000 }).then((res) => {
        const BlogArray = [];
        if (res.data.posts) {
          _.each(res.data.posts, (post) => {
            const postObj = {};
            postObj.title = post.title;
            postObj.content = post.content;
            postObj.thumbnail_images = post.thumbnail_images;
            postObj.thumbnail = post.thumbnail;
            postObj.large = post.large;
            postObj.url = post.url;
            BlogArray.push(postObj);
          })
          return BlogFeed.updateAll({ locale: lang_obj.code }, { content: JSON.stringify(BlogArray), fetch_url: uri })
        }
        }))
      });
      const results = await Promise.all(requestPromiseObject);
  }
  BlogFeed.remoteMethod('getBlogDataCron', {
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/getBlogDataCron',
      verb: 'get',
    },
  });
  // app.on('started', BlogFeed.getBlogDataCron)
};

