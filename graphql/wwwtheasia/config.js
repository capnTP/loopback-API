/* eslint-disable no-process-env,import/no-mutable-exports,no-multi-spaces */
let THE_AISA_WEBSITE = 'https://www.theasiadev.com';
let THE_ASIA_API = 'https://api.theasiadev.com';
let IMGIX_API = 'https://theasia.imgix.net/sandbox';
let BLOG_API = 'https://blog.theasia.com/?json=get_recent_posts&count=5&cat=';

if (process.env.SERVER_TYPE === 'production') {
  THE_AISA_WEBSITE = 'https://www.theasia.com';
  THE_ASIA_API = 'https://api.theasia.com';
  IMGIX_API = 'https://theasia.imgix.net';
  BLOG_API = 'https://blog.theasia.com/?json=get_recent_posts&count=5&cat=';
} else if (process.env.SERVER_TYPE === 'development') {
  THE_AISA_WEBSITE = 'https://www.theasiadev.com';
  THE_ASIA_API = 'https://api.theasiadev.com';
  BLOG_API = 'https://blog.theasia.com/?json=get_recent_posts&count=6&cat=';
} else if (process.env.SERVER_TYPE === 'shop') {
  THE_AISA_WEBSITE = 'https://shop.theasiadev.com/';
  THE_ASIA_API = 'https://paymentsapi.theasiadev.com';
  BLOG_API = 'https://blog.theasia.com/?json=get_recent_posts&count=6&cat=';
}

module.exports = {
  THE_AISA_WEBSITE,
  THE_ASIA_API,
  IMGIX_API,
  BLOG_API,
};
