const moment = require('moment');
const axios = require('axios');

const API_KEY = '85dcbc2754a9d2626c77b520d348b690';
const WEATHER_API = `https://api.openweathermap.org/data/2.5/weather?appid=${API_KEY}`;

const resolvers = {
  Weather: {
    icon({ weather = [] }) {
      const { icon } = weather[0] || {};
      return icon;
    },
    temperature({ main: { temp = '' } = {} }) {
      return temp;
    },
    description({ weather = [] }) {
      const { description } = weather[0] || {};
      return description;
    },
    time({ timezone }) {
      return moment()
        .utc()
        [timezone < 0 ? 'subtract' : 'add'](Math.abs(timezone), 'hours')
        .format('hh:mm A');
    },
  },
};

const query = {
  weather(obj, { city = '', timezone }) {
    return axios
      .get(`${WEATHER_API}&q=${city.split('-').join(' ')}&units=Metric`)
      .then(res => {
        res.data.timezone = timezone;
        return res.data;
      })
      .catch(e => {
        console.log('Error in getting weather of ', city, '\n', e);
        return {};
      });
  },
};

module.exports = {
  query,
  resolvers,
};
