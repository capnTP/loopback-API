const countryHelper = require('../../common/helpers/country')

module.exports = async (app) => {
  const Countries = app.models.Countries;
  const Cities = app.models.Cities;
  const countries = await Countries.find({
    include: [{
        relation: 'cities',
        scope: {
          include: {
            relation: 'localization',
          }
        }
      },
      {
        relation: 'localization',
      }
    ]
  });
  const cities = await Cities.find({ include: { relation: 'localization' } });
  countryHelper.set(countries, 'country');
  countryHelper.set(cities, 'city');
};
