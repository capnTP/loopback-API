// LoggerBuilder can't import, probably circular dependency causing error
// Replace with manual chalk

let allCountries = [];
let allCities = [];


const countryData = {
    set: (data, type) => {
      switch (type) {
        case 'city' :
          allCities = data;
          break;
        default :
          allCountries = data;
      }
    },
    get: (type) => {
      switch (type) {
        case 'city' :
          return allCities;
        default :
          return allCountries;
      }
    }
}

module.exports = countryData;
