/* eslint-disable func-names */
const moment = require('moment');

const { getSafe } = require('../../utility');

const DISCOUNT_TYPES = ['Flat', 'Percentage'];

const validateOffer = data => {
  if (!DISCOUNT_TYPES.includes(data.discount_type)) {
    throw new Error('Discount type invalid');
  }

  if (!data.start_date) throw new Error('Start date is required');

  if (data.end_date) {
    const startMoment = moment(data.start_date);
    const endMoment = moment(data.end_date);
    if (!startMoment.isValid()) throw new Error('Start date is invalid');
    if (!endMoment.isValid()) throw new Error('End date is invalid');
    if (endMoment.isBefore(startMoment)) throw new Error('End date must be after start date');
  }
};

/* eslint-disable no-param-reassign */
module.exports = function(Offers) {
  Offers.validateData = async (ctx, instance, next) => {
    try {
      const userId = getSafe(() => ctx.req.accessToken.userId);
      await Offers.app.models.Users.onlyAdminValidation(userId);

      validateOffer(ctx.args.data);
    } catch (error) {
      console.log('Error', error);
      return next(error);
    }

    return next();
  };

  Offers.beforeRemote('create', Offers.validateData);
  Offers.beforeRemote('prototype.patchAttributes', Offers.validateData);
};
