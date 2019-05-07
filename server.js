require('./server/index.js');

const request = require('request');

// slack cash reporting
process.on('uncaughtException', err => {
  if (process.env.SERVER_TYPE === 'production' || process.env.SERVER_TYPE === 'development') {
    let URL = 'https://hooks.slack.com/services/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';
    if (process.env.SERVER_TYPE === 'production') {
      URL = 'https://hooks.slack.com/services/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';
    }
    const payload = {
      text: `*API Server Crash :*  :bomb: :bomb: \n details. ${JSON.stringify(err)}`,
      username: 'Smart Bot',
      icon_emoji: ':loud_sound:',
    };
    const options = {
      url: URL,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    };
    request.post(options, (err, response) => {
      if (err) {
        console.log(err);
      }
      process.exit(1);
    });
  } else {
    console.log(err);
    process.exit(1);
  }
});
