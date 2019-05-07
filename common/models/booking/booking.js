const _ = require('lodash');
const request = require('request');
const moment = require('moment');
const generatePassword = require('password-generator');
const nanoid = require('nanoid/generate');

const sqlHelper = require('../../helpers/sql');
const EmailHelper = require('../../helpers/email');
const logger = require('../../utility').loggerBuilder('Booking.js');
const { formatCurrency } = require('../../helpers/currency');
const { errorReporting } = require('../../helpers/slack');
const hostConfig = require('../../../server/config/config.json');
const {
  newLoopbackError,
  HTTPStatusCode: { BAD_REQUEST, FORBIDDEN, NOT_FOUND, UNPROCESSABLE_ENTITY, SERVER_ERROR },
  constants: isProduction,
  getSafe,
  generalErrorHandler,
} = require('../../utility');
const {
  getEmailObject,
  BOOKING_EMAIL_READABLE,
  BOOKING_EMAIL_TYPE,
} = require('../../helpers/booking');

const INGENICO_STATUS = {
  900: 'SENT',
  1050: 'COLLECTED',
  800: 'READY',
  1800: 'REFUNDED',
  99999: 'CANCELLED',
  600: 'PENDING',
  650: 'PENDING',
  160: 'DENIED',
  975: 'SETTLEMENT_IN_PROGRESS',
};

const PAYPAL_STATUS = {
  pending: 'PENDING',
  complete: 'COLLECTED',
  completed: 'COLLECTED',
  refunded: 'REFUNDED',
  partially_refunded: 'REFUNDED',
  denied: 'FAILED',
  void: 'CANCELLED',
  voided: 'CANCELLED',
  expired: 'NO-PAYMENT',
};

const INICIS_PAYMENT = {
  paid: 'PAID',
  cancelled: 'CANCELLED-REFUNDED',
};

const CMS_BASE_URL =
  process.env.NODE_ENV == 'production'
    ? hostConfig.production.payment_url
    : hostConfig.development.payment_url;
const AAB_PAYMENT_URL = `${CMS_BASE_URL}/AAB_Payment`;
const PAYMENT_SERVER = isProduction
  ? 'http://admin.theasia.com/booking-details'
  : 'http://admin.theasiadev.com/booking-details';
const IMAGE_SERVER = isProduction
  ? 'https://theasia.imgix.net'
  : 'https://theasia.imgix.net/sandbox';
let SLACK_URL = isProduction
  ? 'https://hooks.slack.com/services/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'
  : 'https://hooks.slack.com/services/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';
// override with env's url
SLACK_URL = process.env.SLACK_URL || SLACK_URL;

const defaultFilter = {
  include: [
    'nationalityRel',
    'payment',
    'bookingCurrencyIdFkeyrel',
    'billingCountryIdFkeyrel',
    'cancellationPoliciesRel',
    {
      relation: 'bookingUserIdFkeyrel',
      scope: {
        include: 'affiliates',
      },
    },
    {
      relation: 'tour',
      scope: {
        include: [
          'localization',
          'suppliers',
          {
            relation: 'excluded_included',
            scope: {
              include: 'exclude_include',
            },
          },
          {
            relation: 'tour_medias',
            scope: {
              include: 'details',
            },
          },
          {
            relation: 'features',
            scope: {
              include: {
                relation: 'feature',
                scope: {
                  include: 'localization',
                },
              },
            },
          },
          {
            relation: 'cities',
            scope: {
              include: ['city_country', 'localization'],
            },
          },
        ],
      },
    },
    {
      relation: 'sub_product',
      scope: {
        include: [
          'localization',
          {
            relation: 'cancellation_policy',
            scope: {
              include: 'localization',
            },
          },
        ],
      },
    },
  ],
};

const getReadableValidationError = error => {
  if (error.name !== 'ValidationError') return error.message || error;

  const { details: { messages = {} } = {} } = error;
  const readableMessages = Object.keys(messages).map(field => {
    const innerMessage = messages[field].join(' and ');
    return `${field} ${innerMessage}`;
  });
  return `${readableMessages.join(', ')}`;
};

const getBookingSequence = id => {
  const year = (new Date().getYear() - 100) * 1000000;
  return year + id;
};

module.exports = Booking => {
  Booking.defaultFilter = defaultFilter;

  const registerUser = details => {
    const userData = {
      first_name: details.billing_first_name,
      last_name: details.billing_last_name,
      email: details.email,
      phone: details.billing_phone ? details.billing_phone : null,
      password: generatePassword(),
      supplier_id: 0,
      language_id: details.lang_id ? details.lang_id : 1,
      country_id: details.nationality || 1,
      passport_number: details.passport_number ? details.passport_number : null,
    };
    console.log('USERDATA', userData);
    return Booking.app.models.Users.create(userData);
  };

  const sendBookingToSlack = (id, isAAB) => {
    const payload = {
      text: `You have a new Booking <${PAYMENT_SERVER}/${id} | Check here>`,
      username: 'TheAsia.com | Booking Bot',
      icon_emoji: ':heavy__dollar_sign:',
    };
    if (isAAB) {
      payload.text = `You have a new AAB Booking <${PAYMENT_SERVER}/${id} | Check here>`;
      payload.username = 'AAB Bot';
    }
    const options = {
      url: SLACK_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    };

    request.post(options, (err, _response) => {
      if (err) {
        logger.error(err);
      }
      logger.info('Booking Created');
    });
  };
  const handlerErrorValidateBooking = (error, message, details) => {
    Booking.app.models.BookingLogs.create({
      type: 'Error',
      source: 'Booking Internal',
      message,
      severity: 4,
      response: error,
      model_name: null,
      status_code: 0,
    });
    return newLoopbackError(FORBIDDEN, error, message, details);
  };

  const getSimiliarTours = booking => {
    const Tour = Booking.app.models.Tours;
    const similarTours = Tour.find({
      include: ['localization', 'reviews', 'currencies'],
      where: {
        city_id: booking.tour.city_id,
        status: true,
        id: {
          neq: booking.tour.id,
        },
        order: 'rating desc',
      },
      limit: 4,
    });
    similarTours.each(element => {
      element.full_converted_price = Number(
        element.latest_minimum_price * booking.exchange_rate,
      ).toFixed(2);
      element.discounted_price =
        element.full_converted_price -
        (element.full_converted_price * element.discount_percent) / 100;
      element.read_reviews = element.reviews().length;
      element.booking_currency_code = booking.booking_currency_code;
      element.thumbnail_url = `${IMAGE_SERVER}/tours/${element.id}/0.jpg`;
    });
    return similarTours;
  };

  /**
   * Returns most fitting selling price (equal to or less than totalPax)
   * @param {[Object]} server_prices Array of server prices for different pax
   * @param {Number} totalPax Total Pax
   * @returns {Object|undefined}
   */
  Booking.extractAppropriateServerPrice = (server_prices = [], totalPax = 0) => {
    if (totalPax < 1) return undefined;
    server_prices = server_prices.sort((a, b) => Number(a.pax) - Number(b.pax));
    let server_price = {
      pax: 0,
    };
    for (let i = 0; i < server_prices.length; i++) {
      const item = server_prices[i];
      const pax = Number(item.pax);
      if (Number.isNaN(Number(pax)) || pax < 1) return undefined;
      if (totalPax >= pax && pax > server_price.pax) {
        server_price = item;
      }
    }
    return server_price.pax === 0 ? undefined : server_price;
  };

  Booking.validateBooking = async (tour, sub_product, booking) => {
    if (tour && tour.toObject()) tour = tour.toObject();

    const nonInstantBooking = 1; // Website Booking
    const affiliateBookingMethodIds = [3, 4, 5, 6]; // AAB/Affiliate Offline/online Booking
    const isAffiliateBooking = affiliateBookingMethodIds.includes(
      Number(booking.booking_method_id),
    );

    if (!tour) return handlerErrorValidateBooking('TOUR_IS_REQUIRED', 'Tour is required');
    if (!sub_product)
      return handlerErrorValidateBooking('SUB_PRODUCT_IS_REQUIRED', 'Subproduct is required');

    // Booking field validations
    if (booking.tour_id != tour.id || booking.sub_product_id != sub_product.id)
      return handlerErrorValidateBooking(
        'PRODUCT_MISMATCH',
        'Tour or sub product is not matched',
        booking,
      );
    if (!booking.total || booking.total <= 0)
      return handlerErrorValidateBooking(
        'TOTAL_IS_REQUIRED',
        'Positive total is required',
        booking,
      );
    if (!booking.trip_starts || !moment(booking.trip_starts).isValid())
      return handlerErrorValidateBooking(
        'TRIP_STARTS_IS_REQUIRED',
        'Trip starts is required and must be a valid date',
        booking,
      );
    if (booking.booking_method_id != nonInstantBooking && !isAffiliateBooking) {
      return handlerErrorValidateBooking(
        'WRONG_BOOKING_METHOD',
        'Wrong booking Method option',
        booking,
      );
    }
    if (!booking.input_details.adult_pax && !booking.input_details.child_pax)
      return handlerErrorValidateBooking(
        'PAX_IS_REQUIRED',
        'Either Child or Adult pax are required',
        booking,
      );

    const { adult_pax, child_pax, infant_pax = 0 } = booking.input_details;
    const totalPax = Number(adult_pax) + Number(child_pax) + Number(infant_pax);

    // Validate with subproduct
    const trip_starts = moment(booking.trip_starts);
    if (sub_product.max_pax && sub_product.max_pax < totalPax)
      return handlerErrorValidateBooking(
        'EXCEED_MAX_PAX',
        `Total pax for sub_product: ${sub_product.id} cannot be more than ${sub_product.max_pax}`,
        booking,
      );
    if (
      (sub_product.starts_on && !trip_starts.isAfter(moment(sub_product.starts_on))) ||
      (sub_product.ends_on && !trip_starts.isBefore(moment(sub_product.ends_on)))
    )
      return handlerErrorValidateBooking(
        'INVALID_BOOKING_DATE',
        'Trip start date is invalid',
        booking,
      );
    if (JSON.parse(sub_product.date_excluded).indexOf(trip_starts.format('YYYY-MM-DD')) > -1)
      return handlerErrorValidateBooking(
        'INVALID_BOOKING_DATE',
        'Trip_starts cannot be on an excluded date',
        booking,
      );
    if (
      JSON.parse(sub_product.repeat_on).filter(
        day => day === trip_starts.format('dddd').toLowerCase(),
      ).length === 0
    )
      return handlerErrorValidateBooking(
        'INVALID_BOOKING_DATE',
        'Trip_starts is not in repeat_on',
        booking,
      );

    // Validate booking date with CS team
    // https://github.com/TheAsia/the-asia-web/wiki/Booking-date-rules
    // NOTE: currently this rule is applied for both website booking and AAB
    // Move this code section to after affiliates valiadate to skip checking for AAB
    const bangkokTime = moment.utc().add(7, 'hours');
    if (bangkokTime.hour() >= 18 && !trip_starts.diff(bangkokTime.startOf('day'), 'days') > 2) {
      throw handlerErrorValidateBooking(
        'INVALID_BOOKING_DATE',
        'Trip start date needs to be after 2 days',
      );
    } else if (
      bangkokTime.hour() < 18 &&
      !trip_starts.diff(bangkokTime.startOf('day'), 'days') > 1
    ) {
      throw handlerErrorValidateBooking(
        'INVALID_BOOKING_DATE',
        'Trip start date needs to be after 1 day ',
      );
    }

    // Compare supplier exchange rate
    if (booking.supplier_exchange_rate !== tour.currencies.exchange_rate)
      return handlerErrorValidateBooking(
        'SUPPLIER_EXCHANGE_RATE_NOT_MATCHED',
        'Supplier exchange rate mismatch',
        booking,
      );

    // Affiliate Booking validation
    if (isAffiliateBooking) {
      // Validate booking exchange rate
      const currency = await Booking.app.models.Currencies.findOne({
        where: {
          currency_code: booking.booking_currency_code,
        },
      });
      if (!currency || currency.exchange_rate !== booking.exchange_rate)
        return handlerErrorValidateBooking(
          'BOOKING_EXCHANGE_RATE_NOT_MATCHED',
          'Booking exchange rate mismatch',
          booking,
        );

      // customer email must exist
      if (!booking.booking_email)
        return handlerErrorValidateBooking(
          'BOOKING_EMAIL_NOT_FOUND',
          'Customer email cannot be empty',
          booking,
        );

      // Validate subProduct required fields
      if (sub_product.is_passport_required && !booking.passport_number)
        return handlerErrorValidateBooking(
          'SUB_PRODUCT_FIELD_REQUIRED',
          'Passport number is required',
          booking,
        );
      if (sub_product.is_pickup_place_required && !booking.pickup_place)
        return handlerErrorValidateBooking(
          'SUB_PRODUCT_FIELD_REQUIRED',
          'Pickup place is required',
          booking,
        );
      if (sub_product.is_pickup_time_required && !booking.pickup_time)
        return handlerErrorValidateBooking(
          'SUB_PRODUCT_FIELD_REQUIRED',
          'Pickup time is required',
          booking,
        );
      if (sub_product.pickup_location_time) {
        try {
          const pickupLocationTime = JSON.parse(sub_product.pickup_location_time);
          if (pickupLocationTime.length > 0 && !booking.pickup_location_time)
            return handlerErrorValidateBooking(
              'SUB_PRODUCT_FIELD_REQUIRED',
              'Pickup_location_time is required',
              booking,
            );
        } catch (error) {
          console.log('Clean pickup_location_time for sub_product id:', sub_product.id);
        }
      }
      if (sub_product.selected_time) {
        try {
          const selectedTime = JSON.parse(sub_product.selected_time);
          if (selectedTime.length > 0 && !booking.selected_time)
            return handlerErrorValidateBooking(
              'SUB_PRODUCT_FIELD_REQUIRED',
              'Selected time is required',
              booking,
            );
        } catch (error) {
          console.log('Clean pickup_location_time for sub_product id:', sub_product.id);
        }
      }
      if (sub_product.is_flight_information_required && !booking.flight_number)
        return handlerErrorValidateBooking(
          'SUB_PRODUCT_FIELD_REQUIRED',
          'Flight number is required',
          booking,
        );
      if (sub_product.is_hotel_name_required && !booking.hotel_name)
        return handlerErrorValidateBooking(
          'SUB_PRODUCT_FIELD_REQUIRED',
          'Hotel name is required',
          booking,
        );
      if (sub_product.is_drop_off_required && !booking.drop_off_place)
        return handlerErrorValidateBooking(
          'SUB_PRODUCT_FIELD_REQUIRED',
          'Drop off place is required',
          booking,
        );

      return true;
    }

    // get server price
    let server_prices = sub_product.base_price;
    if (!server_prices)
      return handlerErrorValidateBooking(
        'SUB_PRODUCT_NO_BASE_PRICE',
        'Sub product is required to have base price',
        booking,
      );
    const pricing = await Booking.app.models.Pricing.find({
      where: {
        sub_product_id: booking.sub_product_id,
        from: {
          lt: trip_starts.format(),
        },
        to: {
          gt: trip_starts.format(),
        },
      },
      order: 'created_at desc',
      limit: 1,
    });
    server_prices = pricing && pricing.length > 0 ? pricing[0].override_price : server_prices;
    const server_price = Booking.extractAppropriateServerPrice(server_prices, totalPax);
    if (!server_price)
      return handlerErrorValidateBooking(
        'SUB_PRODUCT_SELLING_PRICE_NOT_FOUND',
        "Sub product's base_price is required to have sellingPrice",
        booking,
      );

    // validate selling price
    const adults = Number(server_price.sellingPrice.adults);
    const children = Number(server_price.sellingPrice.children);
    const infants = Number(server_price.sellingPrice.infants);
    // const { adult_price, child_price, infant_price } = booking.price_details;
    // TODO: Enable Validation
    // if (adult_price !== adults || child_price !== children || infant_price !== infants) return handlerErrorValidateBooking('PRICE_MISMATCH', 'Price mismatch with server', booking)

    // validate booking exchange rate
    // compare client's total with server's computed value using server's exchange rate
    const { booking_currency_code, total, supplier_currency_code } = booking;
    const bookingCurrency = await Booking.app.models.Currencies.findOne({
      where: { currency_code: booking.booking_currency_code },
    });
    if (!bookingCurrency)
      return handlerErrorValidateBooking('CURRENCY_NOT_FOUND', 'Currency not found', booking);

    const adultPrice = formatCurrency(
      booking_currency_code,
      Number((adults / tour.currencies.exchange_rate) * bookingCurrency.exchange_rate).toFixed(2),
      true,
    );
    const childPrice = formatCurrency(
      booking_currency_code,
      Number((children / tour.currencies.exchange_rate) * bookingCurrency.exchange_rate).toFixed(2),
      true,
    );
    const infantPrice = formatCurrency(
      booking_currency_code,
      Number((infants / tour.currencies.exchange_rate) * bookingCurrency.exchange_rate).toFixed(2),
      true,
    );
    const adultTotal = +adult_pax * adultPrice;
    const childTotal = +child_pax * childPrice;
    const infantTotal = +infant_pax * infantPrice;
    const serverTotal = formatCurrency(
      booking_currency_code,
      adultTotal + childTotal + infantTotal,
      true,
    );
    if (serverTotal != total) {
      console.log({ serverTotal, total });
      // TODO: Enable validation
      // return handlerErrorValidateBooking('TOTAL_MISMATCH', 'Total calculation mismatch', booking)
    }

    // Replace incoming price details with sub_product's to save in db
    // also replace selling price with a formatted one
    delete server_price.pax;
    server_price.sellingPrice = {
      adults: formatCurrency(supplier_currency_code, server_price.sellingPrice.adults, true),
      children: formatCurrency(supplier_currency_code, server_price.sellingPrice.children, true),
      infants: formatCurrency(supplier_currency_code, server_price.sellingPrice.infants, true),
    };
    booking.price_details = server_price;

    // Set Meeting point and time from sub_product or tour
    booking.meeting_point = sub_product.meeting_point || tour.meeting_point;
    booking.meeting_time = sub_product.meeting_time || tour.meeting_time;

    return true;
  };

  Booking.beforeRemote('find', (ctx, status, next) => {
    ctx.args.filter = {
      ...defaultFilter,
      limit: 40,
      ...ctx.args.filter,
    };
    return next();
  });

  Booking.beforeRemote('findById', (ctx, status, next) => {
    ctx.args.filter = {
      ...defaultFilter,
      ...ctx.args.filter,
    };
    return next();
  });

  Booking.observe('before save', async ctx => {
    const errorResponse = error => {
      logger.error('before save', error);
      return Promise.reject(error);
    };
    try {
      if (!ctx.isNewInstance) return Promise.resolve(); // update case
      if (!ctx.instance.sub_product_id || !ctx.instance.tour_id)
        return errorResponse(newLoopbackError(FORBIDDEN, 'TOUR_ID_AND_SUB_PRODUCT_ID_IS_REQUIRED'));

      const tour = await Booking.app.models.Tours.findById(ctx.instance.tour_id, {
        include: ['currencies'],
      });
      const sub_product = await Booking.app.models.SubProducts.findOne({
        where: {
          id: ctx.instance.sub_product_id,
          status: true,
        },
      });
      const isValidBooking = await Booking.validateBooking(tour, sub_product, ctx.instance);
      if (isValidBooking != true)
        return errorResponse(
          newLoopbackError(BAD_REQUEST, 'BOOKING_VALIDATION_ERROR', isValidBooking.message, {
            booking: ctx.instance,
          }),
        );

      // Skip send email and user create/update for AAB/Affiliate
      if ([3, 4, 5, 6].includes(parseInt(ctx.instance.booking_method_id, 10)))
        return Promise.resolve();

      let user = await Booking.app.models.Users.findOne({
        where: {
          email: ctx.instance.email || null,
        },
      });
      if (!user) {
        user = await registerUser(ctx.instance);
        console.log(user, 'userafterRegistration');
        const accessToken = await user.createAccessToken();
        Booking.app.models.Users.bookingRegisteredEmail(
          user,
          'REGISTERED_FROM_BOOKING',
          accessToken.id,
        );
      } else if (ctx.instance.nationality) {
        await user.updateAttributes({
          country_id: parseInt(ctx.instance.nationality, 10),
        });
      }
      // Create access token to use as encryption key for ingenico
      // ** Reevaluate where still neeeded after removal of ingenico
      if (!ctx.instance.access_token) {
        const accesstoken = await Booking.app.models.AccessToken.findOne({
          where: {
            userId: user.id,
          },
          order: 'created desc',
        });
        ctx.instance.access_token =
          accesstoken && accesstoken.id ? accesstoken.id : moment().unix();
      }
      ctx.instance.user_id = user.id;
      return Promise.resolve();
    } catch (error) {
      return errorResponse(error);
    }
  });

  Booking.observe('after save', async ctx => {
    try {
      if (!ctx.isNewInstance) {
        const instance = ctx.instance || ctx.currentInstance;
        if (getSafe(() => instance.booking_status_id) > 0) {
          await Booking.app.models.Voucher.removeVoucher(instance.id);
          Booking.app.models.Voucher.createPdfToS3(instance.id)
            .then(res =>
              console.log('Update voucher for booking:', {
                id: instance.id,
                res,
              }),
            )
            .catch(_error => console.error('Failed update voucher for booking:', instance.id));
        }
      }
      return Promise.resolve();
    } catch (error) {
      logger.error('after save voucher', error);
      return Promise.resolve();
    }
  });

  Booking.observe('after save', async ctx => {
    const errorResponse = error => {
      logger.error('after save', error);
      return Promise.reject(error);
    };
    if (!ctx.instance || !ctx.instance.id) return Promise.resolve();
    try {
      const booking = await Booking.findById(ctx.instance.id, defaultFilter);
      const product = await Booking.app.models.Tours.findById(booking.tour_id);
      // New Booking
      if (ctx.isNewInstance) {
        const bookingNo = getBookingSequence(parseInt(ctx.instance.id, 10));
        await ctx.instance.updateAttributes({
          booking_no: `${bookingNo}`,
          supplier_id: product.supplier_id,
        });

        return Promise.resolve();
      }

      // send slack alert for AAB booking when isNewInstance
      if (
        booking.booking_status_id == 1 &&
        (parseInt(booking.booking_method_id, 10) === 3 ||
          parseInt(booking.booking_method_id, 10) === 4)
      ) {
        sendBookingToSlack(booking.id, true);
      }

      // AAB
      // charge and emails are created/sent inside aab method
      if (booking.booking_method_id == 3) return Promise.resolve();

      // Updates for normal booking
      // create charge
      if (booking.booking_status_id == 1) {
        await Booking.app.models.Charge.createChargeFromBooking(ctx.instance.id);
      }
      // send email
      if (booking.booking_status_id == 1 && booking.email_sent != 1) {
        const emailObjects = await Promise.all([
          getEmailObject(booking.toObject(), BOOKING_EMAIL_TYPE.CUSTOMER_BOOKING_INQUIRY),
          getEmailObject(booking.toObject(), BOOKING_EMAIL_TYPE.SUPPLIER_BOOKING_INQUIRY, 1),
        ]);
        await EmailHelper.send(emailObjects);
        booking.updateAttribute('email_sent', 1);
        sendBookingToSlack(booking.id);
      }
      if (booking.booking_status_id == 8 || booking.booking_status_id == 9) {
        // Send email to CS Team
      }
      return Promise.resolve();
    } catch (error) {
      return errorResponse(error);
    }
  });

  // curl -X GET --header 'Accept: application/json' 'http://api.theasiadev.com/Bookings/statusCheckAndUpdate'
  Booking.statusCheckAndUpdate = callback => {
    const where = {
      trip_starts: {
        lt: Date.now(),
      },
      booking_status_id: 2,
    };
    const data = {
      booking_status_id: 5,
    };
    Booking.updateAll(where, data, (err, info) => {
      // console.log({err, info})
      if (err) return callback(err);
      if (info && info.count) {
        return callback(null, {
          updated: info.count,
        });
      }

      return callback(null, {
        updated: 0,
      });
    });
  };

  Booking.remoteMethod('statusCheckAndUpdate', {
    returns: {
      arg: 'response',
      type: 'object',
      root: true,
    },
    http: {
      path: '/statusCheckAndUpdate',
      verb: 'get',
    },
  });

  // curl -X GET --header 'Accept: application/json' 'http://api.theasiadev.com/Bookings/expireBooking'
  Booking.expiredBooking = async () => {
    const compareDate = new Date();
    compareDate.setDate(compareDate.getDate() - 14);

    const where = {
      created_at: {
        lt: compareDate,
      },
      booking_status_id: 0,
    };

    const data = {
      booking_status_id: 10,
    };

    const updatedData = await Booking.updateAll(where, data);

    return { updated: updatedData.count };
  };

  Booking.remoteMethod('expiredBooking', {
    returns: {
      arg: 'response',
      type: 'object',
      root: true,
    },
    http: {
      path: '/expiredBooking',
      verb: 'get',
    },
  });

  Booking.updateBookingBilling = async (
    booking_id,
    booking_currency_code,
    exchange_rate,
    billing_country_id,
  ) => {
    try {
      let booking = await Booking.findOne({
        where: {
          id: booking_id,
        },
      });
      if (!booking) return newLoopbackError(NOT_FOUND, 'BOOKING_NOT_FOUND', 'Booking not found');

      if (!booking.ref_id) {
        const refPrefix = isProduction ? 'PRO' : 'DEV';
        const d = new Date(booking.created_at);
        const dd = `0${d.getDate()}`.slice(-2);
        const mm = `0${d.getMonth()}`.slice(-2);
        const yyyy = d.getFullYear();
        booking = await booking.updateAttribute(
          'ref_id',
          `${refPrefix}-${booking.id}-${dd}${mm}-${yyyy}`,
        );
      }

      // Compare exchange rates
      const currencies = await Booking.app.models.Currencies.find();
      const { exchange_rate: serverExchangeRate, id: currencyId } = currencies.find(
        c => c.currency_code === booking_currency_code,
      );
      if (!serverExchangeRate)
        return newLoopbackError(NOT_FOUND, 'CURRENCY_NOT_FOUND', 'Currency not found');
      if (exchange_rate !== serverExchangeRate)
        return newLoopbackError(
          UNPROCESSABLE_ENTITY,
          'EXCHANGE_RATE_MISMATCH',
          'Exchange rate differs from server. Please update',
        );

      // Compare value
      const {
        input_details,
        price_details: { sellingPrice },
        supplier_exchange_rate,
      } = booking;
      const adultPrice = Number(
        (sellingPrice.adults / supplier_exchange_rate) * serverExchangeRate,
      ).toFixed(2);
      const childPrice = Number(
        (sellingPrice.children / supplier_exchange_rate) * serverExchangeRate,
      ).toFixed(2);
      const infantPrice = Number(
        (sellingPrice.infants / supplier_exchange_rate) * serverExchangeRate,
      ).toFixed(2);
      const adultTotal =
        Number(input_details.adult_pax) * formatCurrency(booking_currency_code, adultPrice, true);
      const childTotal =
        Number(input_details.child_pax) * formatCurrency(booking_currency_code, childPrice, true);
      const infantTotal =
        Number(input_details.infant_pax) * formatCurrency(booking_currency_code, infantPrice, true);
      // Format again incase floating arithmetic error
      const serverTotal = formatCurrency(
        booking_currency_code,
        adultTotal + childTotal + infantTotal,
        true,
      );

      // Update booking
      const attributes = {
        total: serverTotal,
        booking_currency_code,
        booking_currency_id: currencyId,
        exchange_rate,
        billing_country_id,
      };
      const result = await booking.updateAttributes(attributes);
      return Promise.resolve(result);
    } catch (error) {
      logger.error('Update Booking Billing:', error);
      return generalErrorHandler('Booking.js', 'updateBookingBilling', error);
    }
  };

  Booking.remoteMethod('updateBookingBilling', {
    returns: {
      arg: 'response',
      type: 'object',
      root: true,
    },
    http: {
      path: '/updateBookingBilling/:id',
      verb: 'patch',
    },
    accepts: [
      {
        arg: 'id',
        type: 'number',
        http: {
          source: 'path',
        },
      },
      {
        arg: 'booking_currency_code',
        type: 'String',
        required: true,
      },
      {
        arg: 'exchange_rate',
        type: 'number',
        required: true,
      },
      {
        arg: 'billing_country_id',
        type: 'number',
        required: true,
      },
    ],
  });

  Booking.amend = async (
    id,
    data = {},
    _isSendCustomerEmail = true,
    _isSendSupplierEmail = true,
    req,
  ) => {
    try {
      const user_id = getSafe(() => req.accessToken.userId);
      await Booking.app.models.Users.onlyAdminValidation(user_id);

      const booking = await Booking.findById(id);
      if (!booking)
        return Promise.reject(
          newLoopbackError(NOT_FOUND, 'BOOKING_NOT_FOUND', 'Booking not found'),
        );
      if (![1, 2, 3].includes(parseInt(booking.booking_status_id, 10))) {
        return Promise.reject(
          newLoopbackError(
            FORBIDDEN,
            'NOT_AMENDABLE',
            `Booking status ${booking.booking_status_id} is not amendable`,
          ),
        );
      }

      // Keep only changed values
      const updateData = {
        amend_details: {
          ...booking.amend_details,
        },
      };
      _.forIn(data, (value, key) => {
        if (value != booking[key]) {
          updateData.amend_details[key] = value;
        }
      });

      // If amending from diff status, store prev status and update to 3
      // If status is amend and incoming update doesn't have prev status, use prev status
      if (parseInt(booking.booking_status_id, 10) !== 3) {
        updateData.booking_status_id = 3;
        updateData.amend_details.booking_status_id = booking.booking_status_id;
      } else if (
        booking.amend_details &&
        booking.amend_details.booking_status_id &&
        !data.booking_status_id
      ) {
        updateData.amend_details.booking_status_id = booking.amend_details.booking_status_id;
      }
      await booking.updateAttributes(updateData);

      // Explicitly Create activity log
      await Booking.app.models.Activity.create({
        model_name: 'Booking',
        action_taken: 'Amend Booking',
        action_result: 'Success',
        user_id,
        model_id: booking.id,
      });

      return Promise.resolve();
    } catch (error) {
      logger.error('Amend:', error);
      return Promise.reject(newLoopbackError(SERVER_ERROR, 'SERVER_ERROR', error.message, error));
    }
  };

  Booking.remoteMethod('amend', {
    http: {
      path: '/:id/amend',
      verb: 'patch',
    },
    accepts: [
      {
        arg: 'id',
        type: 'number',
        http: {
          source: 'path',
        },
      },
      {
        arg: 'data',
        type: 'Object',
        required: true,
      },
      {
        arg: 'isSendCustomerEmail',
        type: 'boolean',
        description: 'default is true',
      },
      {
        arg: 'isSendSupplierEmail',
        type: 'boolean',
        description: 'default is true',
      },
      {
        arg: 'req',
        type: 'Object',
        http: {
          source: 'req',
        },
      },
    ],
    returns: {
      arg: 'response',
      type: 'Object',
      root: true,
    },
  });

  /**
   * paymentType (same as booking_method):
   *   AAB_ONLINE - Send payment link from email
   *   AAB_OFFLINE - Skip Payment
   *   AFFILIATE_ONLINE - Affiliate pay directly in affiliate web (same as theasia website)
   *   AFFILIATE_OFFLINE - Skip Payment
   */
  Booking.aab = async (
    data,
    affiliateTemplate,
    customerTemplate,
    supplierTemplate,
    creatorUserId,
    paymentType,
    req,
  ) => {
    try {
      const affiliateUser = data.affiliate_id
        ? await Booking.app.models.Users.findOne({
            where: {
              affiliate_id: data.affiliate_id,
            },
          })
        : null;
      const tour = await Booking.app.models.Tours.findById(data.tour_id, {
        include: 'currencies',
      });
      const subProduct = await Booking.app.models.SubProducts.findById(data.sub_product_id);

      let { user_id } = data;
      if (!user_id && affiliateUser) {
        user_id = affiliateUser.id;
      }

      if (!user_id)
        return Promise.reject(
          newLoopbackError(400, 'BOOKING_VALIDATION_ERROR', 'Missing user id', data),
        );

      let bookingMethodId;
      if (paymentType === 'AAB_ONLINE') bookingMethodId = 3;
      else if (paymentType === 'AAB_OFFLINE') bookingMethodId = 4;
      else if (paymentType === 'AFFILIATE_ONLINE') bookingMethodId = 5;
      else if (paymentType === 'AFFILIATE_OFFLINE') bookingMethodId = 6;
      else bookingMethodId = 0;

      if (!bookingMethodId)
        return Promise.reject(
          newLoopbackError(400, 'PAYMENT_TYPE', 'Missing or incorrect payment type'),
        );
      const isOfflinePayment = paymentType.endsWith('OFFLINE');

      let priceDetails;
      if (data.affiliate_id) {
        priceDetails = {
          sellingPrice: data.price_details.manualPrice,
          supplierPrice: data.price_details.supplierPrice,
          originalSellingPrice: data.price_details.sellingPrice,
        };
      } else {
        priceDetails = {
          sellingPrice: data.price_details.sellingPrice,
          supplierPrice: data.price_details.supplierPrice,
        };
      }

      const bookingData = {
        billing_first_name: data.billing_first_name,
        billing_last_name: data.billing_last_name,
        nationality: data.nationality,
        billing_phone: data.billing_phone,
        billing_country_id: data.billing_country_id,

        pickup_place: data.pickup_place,
        pickup_time: data.pickup_time,
        pickup_location_time: data.pickup_location_time,
        flight_number: data.flight_number,
        passport_number: data.passport_number,
        hotel_name: data.hotel_name,
        drop_off_place: data.drop_off_place,
        selected_time: data.selected_time,
        special_request: data.special_request,

        meeting_point: tour.meeting_point,
        meeting_time: tour.meeting_time,

        sub_product_id: data.sub_product_id,
        tour_id: data.tour_id,
        user_id,

        booking_status_id: isOfflinePayment ? 1 : 0,
        booking_method_id: bookingMethodId,
        cancellation_policy_id: subProduct.cancellation_policy_id,

        booking_currency_id: data.booking_currency_id,
        booking_currency_code: data.booking_currency_code,
        exchange_rate: data.exchange_rate,
        supplier_exchange_rate: data.supplier_exchange_rate,
        supplier_currency_code: tour.currencies().currency_code,
        total: data.total,

        trip_starts: data.trip_starts,

        price_details: priceDetails,
        input_details: data.input_details,
        amend_details: {},
        commission: data.commission,
        discount: data.discount,
        vat: data.vat,

        booking_email: data.billing_email,
        // access_token to create session for ingenico
        access_token: req.accessToken ? req.accessToken.id || null : null,
      };

      const booking = await Booking.create(bookingData);

      // Create notes if additional information exists
      if (data.additional_information) {
        await Booking.app.models.Notes.create({
          booking_id: booking.id,
          user_id: creatorUserId,
          note: data.additional_information,
          channel: 'Draft',
          from: 'Draft',
          is_public: bookingMethodId === 5,
        });
      }

      // Create Charge
      await Booking.app.models.Charge.createChargeFromBooking(booking.id);

      // Delete Draft if exists
      if (data.id) {
        await Booking.app.models.Drafts.destroyById(data.id);
      }

      // Skip creating payment for ONLINE_AFFILIATE
      // It will create payment later same as website booking
      if (bookingMethodId === 5) {
        await booking.updateAttribute('email_sent', 1);
        return Promise.resolve(booking);
      }

      let paymentStatusId;
      if (paymentType === 'AAB_ONLINE' || paymentType === 'AFFILIATE_ONLINE') paymentStatusId = 0;
      else paymentStatusId = 6;

      // Create Payment
      const paymentData = {
        uuid: nanoid('1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 30),
        payment_status_id: paymentStatusId,
        payment_gateway_response: '',
        external_transaction_id: '',
        external_authorize_id: '',
        external_charge_id: '',
        external_refund_id: '',
        booking_id: booking.id,
        payment_method_id: 6,
        total: booking.total,
        currency: booking.booking_currency_code,
        payment_type: isOfflinePayment ? 'Offline' : 'AAB Payment',
      };
      const payment = await Booking.app.models.Payments.create(paymentData);

      // Send emails
      let bookingWithRelations = await Booking.findById(booking.id, defaultFilter);
      bookingWithRelations = bookingWithRelations.toObject();
      // Add payment_url from payment response
      bookingWithRelations.payment_url = `${AAB_PAYMENT_URL}/${payment.uuid}`;
      const emails = [];
      if (affiliateTemplate) {
        // Error no url
        if (affiliateTemplate === 'AFFILIATE_PAYMENT' && !bookingWithRelations.payment_url) {
          errorReporting(
            `Booking ID: ${
              booking.id
            } failed to send AFFILIATE_PAYMENT email. No payment url was present`,
          );
        } else {
          emails.push(getEmailObject(bookingWithRelations, affiliateTemplate));
        }
      }
      if (customerTemplate) {
        emails.push(getEmailObject(bookingWithRelations, customerTemplate));
      }
      if (supplierTemplate) {
        emails.push(getEmailObject(bookingWithRelations, supplierTemplate, 1));
      }
      const emailObjects = await Promise.all(emails);
      await EmailHelper.send(emailObjects);

      await booking.updateAttribute('email_sent', 1);

      return Promise.resolve(booking);
    } catch (error) {
      logger.error('AAB:', {
        error,
      });
      if (error.name === 'ValidationError') {
        return Promise.reject(
          newLoopbackError(
            error.statusCode,
            error.name,
            getReadableValidationError(error),
            error.details,
          ),
        );
        // return Promise.reject(new Error(error.message))
      }
      if (error.name === 'BOOKING_VALIDATION_ERROR') {
        return Promise.reject(error);
        // return Promise.reject(new Error(error.message))
      }
      error.message = 'AAB Booking failed';
      return Promise.reject(error);
    }
  };

  Booking.remoteMethod('aab', {
    accepts: [
      {
        arg: 'data',
        type: 'Object',
        required: true,
      },
      {
        arg: 'affiliateTemplate',
        type: 'string',
        description: 'Template name',
      },
      {
        arg: 'customerTemplate',
        type: 'string',
        description: 'Template name',
      },
      {
        arg: 'supplierTemplate',
        type: 'string',
        description: 'Template name',
      },
      {
        arg: 'creatorUserId',
        type: 'any',
        description: 'Template name',
      },
      {
        arg: 'paymentType',
        type: 'string',
        description: 'Booking method name as CAP_CASE: AAB/AFFILIATE_ONLINE/OFFLINE',
      },
      {
        arg: 'req',
        type: 'object',
        http: { source: 'req' },
      },
    ],
    returns: {
      args: 'response',
      type: 'object',
      root: true,
    },
    http: {
      path: '/aab',
      verb: 'post',
    },
    description: 'Create AAB booking from draft data',
  });

  /**
   * validate booking with its cancellation policy
   * @param {Booking} booking Booking with cancellationPoliciesRel
   */
  Booking.validateCancellationPolicy = async booking => {
    const now = moment();
    const tripStarts = moment(booking.trip_starts);
    if (booking.cancellationPoliciesRel()) {
      if (now.add(booking.cancellationPoliciesRel().depart_days_apply).isAfter(tripStarts)) {
        return Promise.reject(
          newLoopbackError(
            FORBIDDEN,
            'CANCELLATION_POLICY',
            `Cannot cancel charge at datetime ${now.format('YYYY-MM-DD HH:mm:ss')}` +
              `for booking that starts on ${tripStarts.format('YYYY-MM-DD HH:mm:ss')}` +
              `under policy: ${booking.cancellationPoliciesRel().name}`,
          ),
        );
      }
      return Promise.resolve(true);
    }
    return Promise.reject(
      newLoopbackError(
        FORBIDDEN,
        'NO_CANCELLATION_POLICY',
        'Booking does not have cancellation policy',
      ),
    );
  };

  /**
   * booking email management
   */
  Booking.emailTemplateList = () => Promise.resolve(BOOKING_EMAIL_READABLE);
  Booking.remoteMethod('emailTemplateList', {
    accepts: [],
    returns: {
      args: 'response',
      type: 'object',
      root: true,
    },
    http: {
      path: '/emailTemplateList',
      verb: 'get',
    },
    description: 'Get Email template list data',
  });
  Booking.emailType = (filter, callback) => {
    // return callback if function provided, else return Promise
    const respond = data =>
      // eslint-disable-next-line
      typeof filter === 'function'
        ? filter(null, data)
        : typeof callback === 'function'
          ? callback(null, data)
          : Promise.resolve(data);
    const data = filter
      ? Object.keys(BOOKING_EMAIL_TYPE).filter(type => type.startsWith(filter))
      : Object.keys(BOOKING_EMAIL_TYPE);

    return respond(data);
  };
  Booking.remoteMethod('emailType', {
    accepts: {
      arg: 'filter',
      type: 'string',
    },
    returns: {
      args: 'response',
      type: 'array',
      root: true,
    },
    http: {
      path: '/emailType',
      verb: 'get',
    },
  });
  Booking.bookingEmails = async filter => {
    try {
      const [emailTypes, emailDisplayTextMapper] = await Promise.all([
        Booking.emailType(filter),
        Booking.emailTemplateList(),
      ]);

      return emailTypes
        .reduce((acc, type) => {
          const displayText = emailDisplayTextMapper[type];
          if (!displayText) return acc;
          acc.push({ key: type, displayText });
          return acc;
        }, [])
        .sort((a, b) => {
          if (a.displayText > b.displayText) return -1;
          if (a.displayText < b.displayText) return 1;
          return 0;
        });
    } catch (error) {
      logger.error(error);
      return [];
    }
  };

  Booking.emailPreview = async (langId = 1, bookingId, emailTemplateType) => {
    try {
      const booking = await Booking.findById(bookingId, defaultFilter);
      const similarInEmailList = [
        'CUSTOMER_INQUIRY_CANCELLATION',
        'CUSTOMER_BOOKING_CANCELLATION',
        'CUSTOMER_BOOKING_CANCELED',
      ];
      if (similarInEmailList.indexOf(emailTemplateType) >= 0) {
        booking.similarTours = await getSimiliarTours(booking.toObject());
      }

      let emailObject = await getEmailObject(booking.toObject(), emailTemplateType, langId);
      emailObject = {
        ...emailObject,
        htmlBody: Buffer(emailObject.html).toString('base64'),
        status: true,
      };
      return Promise.resolve(emailObject);
    } catch (error) {
      return Promise.reject(error);
    }
  };
  Booking.remoteMethod('emailPreview', {
    accepts: [
      {
        arg: 'lang_id',
        type: 'string',
      },
      {
        arg: 'booking_id',
        type: 'string',
        require: true,
      },
      {
        arg: 'email_template_type',
        type: 'string',
        description:
          'emailType CUSTOMER_BOOKING_INQUIRY, CUSTOMER_GENERAL, CUSTOMER_INQUIRY_CANCELLATION, SUPPLIER_INQUIRY_CANCELLATION, CUSTOMER_BOOKING_CANCELLATION, CUSTOMER_BOOKING_CANCELED, CUSTOMER_BOOKING_CONFIRMED, SUPPLIER_BOOKING_INQUIRY, SUPPLIER_INQUIRY_CANCELLATION, SUPPLIER_BOOKING_CANCELLATION, SUPPLIER_BOOKING_CONFIRMED',
      },
    ],
    returns: {
      args: 'response',
      type: 'object',
      root: true,
    },
    http: {
      path: '/emailPreview',
      verb: 'get',
    },
    description: 'Get Email preview data in html format encoded base64 string',
  });

  Booking.sendTransactionalEmail = async (
    to,
    from,
    subject,
    langId = 1,
    bookingId,
    emailTemplateType,
    req,
  ) => {
    try {
      const user = await Booking.app.models.Users.validateRole(req, [3, 9]); // Admin or affiliate
      const booking = await Booking.findById(bookingId, defaultFilter);
      const similarInEmailList = [
        'CUSTOMER_INQUIRY_CANCELLATION',
        'CUSTOMER_BOOKING_CANCELLATION',
        'CUSTOMER_BOOKING_CANCELED',
      ];
      if (similarInEmailList.indexOf(emailTemplateType) >= 0) {
        booking.similarTours = await getSimiliarTours(booking.toObject());
      }
      let emailObject = await getEmailObject(
        booking.toObject(),
        emailTemplateType,
        langId,
        user.id,
        false,
      );
      emailObject = {
        ...emailObject,
        to,
        from,
        subject,
        text: subject,
      };
      await EmailHelper.send([emailObject]);
      return Promise.resolve({
        stauts: true,
        message: 'send email success',
      });
    } catch (error) {
      console.log('catch err', error);
      return Promise.reject(error);
    }
  };

  Booking.remoteMethod('sendTransactionalEmail', {
    accepts: [
      {
        arg: 'to',
        type: 'string',
      },
      {
        arg: 'from',
        type: 'string',
      },
      {
        arg: 'subject',
        type: 'string',
      },
      {
        arg: 'lang_id',
        type: 'string',
      },
      {
        arg: 'booking_id',
        type: 'string',
        require: true,
      },
      {
        arg: 'email_template_type',
        type: 'string',
        description:
          'emailType CUSTOMER_BOOKING_INQUIRY, CUSTOMER_GENERAL, CUSTOMER_INQUIRY_CANCELLATION, SUPPLIER_INQUIRY_CANCELLATION, CUSTOMER_BOOKING_CANCELLATION, CUSTOMER_BOOKING_CANCELED, CUSTOMER_BOOKING_CONFIRMED, SUPPLIER_BOOKING_INQUIRY, SUPPLIER_BOOKING_CANCELLATION, SUPPLIER_BOOKING_CONFIRMED',
      },
      {
        arg: 'req',
        type: 'object',
        http: { source: 'req' },
      },
    ],
    returns: {
      args: 'response',
      type: 'object',
      root: true,
    },
    http: {
      path: '/sendTransactionalEmail',
      verb: 'post',
    },
    // description: 'Send booking email if have attachment posted file to form data like "curl -F file=path_to_file -F file=path_to_second_file"',
  });

  Booking.sendEmail = async (
    to,
    from = 'no-reply@theasia.com',
    subject,
    html,
    attachments,
    booking_id,
    req,
  ) => {
    const bcc = process.env.BCC_EMAILS
      ? process.env.BCC_EMAILS.split(',')
      : ['vishal.sharma@theasia.com'];
    try {
      const user = await Booking.app.models.Users.validateRole(req, [3, 9]); // Admin or affiliates
      html = Buffer(html, 'base64').toString();
      let emailObject = {
        from,
        to,
        subject,
        text: subject,
        html,
        bcc,
        activityObject: {
          model_id: Number(booking_id),
          user_id: user.id,
          model_name: 'Booking',
          action_taken: 'Send manual email',
          action_result: 'Success',
          email_template: 'manual', // For email_activity
        },
      };

      try {
        attachments = attachments && JSON.parse(attachments);
        if (attachments && Array.isArray(attachments) && attachments.length > 0) {
          attachments = await EmailHelper.attachmentsFromURLs(attachments);
          emailObject = {
            ...emailObject,
            attachments,
          };
        }
      } catch (error) {
        console.log('catch err', error);
      }

      await EmailHelper.send([emailObject]);
      return Promise.resolve({
        stauts: true,
        message: 'send email success',
      });
    } catch (error) {
      console.log('catch err', error);
      return Promise.reject(error);
    }
  };

  Booking.remoteMethod('sendEmail', {
    accepts: [
      {
        arg: 'to',
        type: 'string',
      },
      {
        arg: 'from',
        type: 'string',
      },
      {
        arg: 'subject',
        type: 'string',
      },
      {
        arg: 'html',
        type: 'string',
      },
      {
        arg: 'attachments',
        type: 'string',
        description:
          'array of attachment url example ["https://s3-ap-southeast-1.amazonaws.com/theasia-uploader/1518511269743_b.pdf","https://s3-ap-southeast-1.amazonaws.com/theasia-uploader/1518512632475_b.pdf"]',
      },
      {
        arg: 'booking_id',
        type: 'string',
        required: true,
      },
      {
        arg: 'req',
        type: 'object',
        http: { source: 'req' },
      },
    ],
    returns: {
      args: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/sendEmail',
      verb: 'post',
    },
    // description: 'Send booking email if have attachment posted file to form data like "curl -F file=path_to_file -F file=path_to_second_file"',
  });

  /* Big CSV */

  const getCollectionDateAndCode = row => {
    if (row && row.response) {
      try {
        const response = JSON.parse(row.response);
        if (row.payment_method_id == 1) {
          // paypal
          const code = PAYPAL_STATUS[response.state]
            ? PAYPAL_STATUS[response.state]
            : PAYPAL_STATUS[response.state];
          const time = moment(response.create_time).format('MM/DD/YYYY');
          return {
            code,
            time,
          };
        }
        if (row.payment_method_id == 5) {
          // inicis
          let satus_code = ``;
          let status_time = ``;
          if (INICIS_PAYMENT[response.status] == 'PAID') {
            satus_code = 'COLLECTED';
            status_time = moment(parseInt(response.paid_at, 10) * 1000).format('MM/DD/YYYY');
          } else if (
            INICIS_PAYMENT[response.status] == 'CANCELLED-REFUNDED' &&
            row.payment_status_id == 5
          ) {
            satus_code = 'CANCELLED';
            if (response.cancelled_at)
              status_time = moment(parseInt(response.cancelled_at, 10) * 1000).format('MM/DD/YYYY');
          } else if (
            INICIS_PAYMENT[response.status] == 'CANCELLED-REFUNDED' &&
            row.payment_status_id == 4
          ) {
            satus_code = 'REFUNDED';
            if (response.cancelled_at)
              status_time = moment(parseInt(response.cancelled_at, 10) * 1000).format('MM/DD/YYYY');
          } else if (
            INICIS_PAYMENT[response.status] == 'CANCELLED-REFUNDED' &&
            row.payment_status_id == 2
          ) {
            satus_code = 'COLLECTED';
            status_time = moment(parseInt(response.paid_at, 10) * 1000).format('MM/DD/YYYY');
          } else {
            satus_code = ``;
          }
          const code = satus_code;
          return {
            code,
            time: status_time,
          };
        }
        if (
          row.payment_method_id == 2 ||
          row.payment_method_id == 3 ||
          row.payment_method_id == 4
        ) {
          //  ingenico-cc/ingenic-alipay/ingenico-union-pay
          try {
            if (response.statusOutput) {
              const code = INGENICO_STATUS[response.statusOutput.statusCode]
                ? INGENICO_STATUS[response.statusOutput.statusCode]
                : response.statusOutput.statusCode;
              const time = moment(
                response.statusOutput.statusCodeChangeDateTime,
                'YYYYMMDDHHmmss',
              ).format('MM/DD/YYYY');
              return {
                code,
                time,
              };
            }
            return {
              code: 'CORRUPT-DATA',
              time: 'CORRUPT-DATA-PROBLEM',
            };
          } catch (e) {
            console.log('err', response);
            return {
              code: response.statusOutput.statusCode,
              time: 'ERROR',
            };
          }
        } else {
          return {
            code: 'NA',
            time: 'NA',
          };
        }
      } catch (e) {
        console.log(e, 'parse error');
        return {
          code: 'NA',
          time: 'NA',
        };
      }
    } else {
      return {
        code: 'NA',
        time: 'NA',
      };
    }
  };

  Booking.paymentReport = async (code, filters) => {
    const status = ``;
    let currencies = ``;
    let payment_method_ids = ``;
    let payment_status_ids = ``;
    let booking_ids = ``;
    let user_ids = ``;
    let created_at = ``;
    let offset = 0;
    let limit = 100000;

    if (filters) {
      if (filters.limit) {
        // eslint-disable-next-line
        limit = filters.limit;
      }

      if (filters.offset) {
        // eslint-disable-next-line
        offset = filters.offset;
      }

      if (filters.currencies && filters.currencies.length) {
        currencies = `and P.currency in ${filters.currencies}`;
      }

      if (filters.payment_method_ids && filters.payment_method_ids.length) {
        payment_method_ids = `and P.payment_method_id in (${filters.payment_method_ids})`;
      }

      if (filters.payment_status_ids && filters.payment_status_ids.length) {
        const strArr = filters.payment_status_ids.map(id => `'${id}'`);
        payment_status_ids = `and P.payment_status_id in (${strArr.toString()})`;
      }

      if (filters.booking_ids && filters.booking_ids.length) {
        booking_ids = `and P.booking_id in (${filters.booking_ids})`;
      }
      if (filters.user_ids && filters.user_ids.length) {
        user_ids = `and P.booking_id in (${filters.user_ids})`;
      }

      if (filters.created_at && filters.created_at) {
        if (filters.created_at.to && filters.created_at.from) {
          created_at = `and ( P.created_at >= '${moment(filters.created_at.from).format(
            'YYYY-MM-DD',
          )} 00:00:00' and P.created_at<= '${moment(filters.created_at.to).format(
            'YYYY-MM-DD',
          )} 23:59:59' ) `;
        } else if (filters.created_at.to) {
          created_at = `and P.created_at <= '${moment(filters.created_at.to).format(
            'YYYY-MM-DD',
          )} 23:59:59' `;
        } else if (filters.created_at.from) {
          created_at = `and P.created_at >= '${moment(filters.created_at.from).format(
            'YYYY-MM-DD',
          )} 23:59:59' `;
        }
      }
    }

    if (code === 'theAsiaCRM') {
      const selectors = `P.external_transaction_id as transaction_id,
      B.booking_no as booking_no,
      P.id as payment_id,
      P.total as authorize_amount,
      count(b.id) over() as "count",
      P.final_amount as final_amount,
      case
          when P.payment_status_id = '4' then 0 - ceil(P.final_amount / P.exchange_rate)
          else  ceil(P.final_amount / P.exchange_rate)
      end as final_amount_usd,
      P.currency,
      P.exchange_rate::decimal,
      U.email as customer_email,
      to_char(P.created_at, 'MM/DD/YYYY') as "created_at",
      case
       when P.updated_at is not null then to_char(P.updated_at, 'MM/DD/YYYY')
       else to_char(P.created_at, 'MM/DD/YYYY')
      end as "payment_update_date",
      PS.status as payment_status,
      P.payment_status_id as payment_status_id,
      P.payment_method_id,
      PM.method_name as payment_method,
      PG.name as payment_gateway,
      P.external_reference_id::character varying as external_reference_id,
      P.response`;
      const sql = `SELECT  ${selectors}  from main.payments as P
          left join main.payment_status as PS on
            P.payment_status_id = PS.id::varchar
          left join main.booking as B on
            B.id = P.booking_id
          LEFT JOIN main.users as U on
            U.id = P.payer_id
          LEFT JOIN main.payment_methods as PM on
            PM.id = P.payment_method_id
          LEFT JOIN main.payment_gateways as PG on
            PG.id = PM.payment_gateways_id
      where P.payment_status_id::Int <> 0 ${status} ${currencies} ${payment_method_ids} ${booking_ids} ${user_ids} ${payment_status_ids} ${created_at}  offset ${offset} limit ${limit}`;

      console.log('payment report SQL', sql);
      const data = await sqlHelper.raw(sql, []);

      if (data && data.length) {
        await _.each(data, (row, i) => {
          const content = getCollectionDateAndCode(row);
          data[i].CollectionDate = content && content.time ? content.time : '';
          data[i].GatewayStatus = content && content.code ? content.code : '';
        });

        return Promise.resolve({
          status: true,
          data,
        });
      }
      return {
        status: false,
        message: 'No Data',
      };
    }
    return {
      status: false,
      message: 'Only allowed internally',
    };
  };

  Booking.bookingReport = async (code, filters) => {
    let tour_ids = ``;
    let booking_ids = ``;
    let user_ids = ``;
    let trip_date = ``;
    let created_at = ``;
    let supplier_ids = ``;
    let booking_status_ids = ``;
    let offset = 0;
    let limit = 100000;

    if (filters) {
      if (filters.limit) {
        // eslint-disable-next-line
        limit = filters.limit;
      }

      if (filters.offset) {
        // eslint-disable-next-line
        offset = filters.offset;
      }
      if (filters.booking_ids && filters.booking_ids.length) {
        booking_ids = `and b.id in (${filters.booking_ids})`;
      }

      if (filters.tour_ids && filters.tour_ids.length) {
        tour_ids = `and b.tour_id in (${filters.tour_ids})`;
      }

      if (filters.user_ids && filters.user_ids.length) {
        user_ids = `and b.user_id in (${filters.user_ids})`;
      }

      if (filters.supplier_ids && filters.supplier_ids.length) {
        supplier_ids = `and b.supplier_id in (${filters.supplier_ids})`;
      }

      if (filters.booking_status_ids && filters.booking_status_ids.length) {
        booking_status_ids = `and b.booking_status_id in (${filters.booking_status_ids})`;
      }

      if (filters.trip_date || filters.trip_date) {
        if (filters.trip_date.to && filters.trip_date.from) {
          trip_date = `and ( b.trip_starts >= '${moment(filters.trip_date.from).format(
            'YYYY-MM-DD',
          )} 00:00:00' and b.trip_starts <= '${moment(filters.trip_date.to).format(
            'YYYY-MM-DD',
          )} 23:59:59' ) `;
        } else if (filters.trip_date.to) {
          trip_date = `and b.trip_starts <= '${moment(filters.trip_date.to).format(
            'YYYY-MM-DD',
          )} 23:59:59' `;
        } else if (filters.trip_date.from) {
          trip_date = `and b.trip_starts >= '${moment(filters.trip_date.from).format(
            'YYYY-MM-DD',
          )} 23:59:59' `;
        }
      }

      if (filters.created_at && filters.created_at) {
        if (filters.created_at.to && filters.created_at.from) {
          created_at = `and ( b.created_at >= '${moment(filters.created_at.from).format(
            'YYYY-MM-DD',
          )} 00:00:00' and b.created_at<= '${moment(filters.created_at.to).format(
            'YYYY-MM-DD',
          )} 23:59:59' ) `;
        } else if (filters.created_at.to) {
          created_at = `and b.created_at <= '${moment(filters.created_at.to).format(
            'YYYY-MM-DD',
          )} 23:59:59' `;
        } else if (filters.created_at.from) {
          created_at = `and b.created_at >= '${moment(filters.created_at.from).format(
            'YYYY-MM-DD',
          )} 23:59:59' `;
        }
      }
    }

    if (code === 'theAsiaCRM') {
      const sql = `
    select
        to_char(b.created_at, 'MM/DD/YYYY') as "created_at",
        b.booking_no as "booking_no",
        b.id as "bid",
        case
            when b.booking_method_id = 1 then 'Direct'
            when b.booking_method_id = 3 then 'AAB'
            else b.booking_method_id::text -- Unknown method, display as it is
        end as "booking_type",
        case
            when b.booking_method_id = 1 then 'TheAsia'
            when b.booking_method_id = 3 then a.company_name
            else b.booking_method_id::text -- Unknown method, display as it is
        end as "booking_gateway",
        payouts.id as payout_id,
        t.name as "product",
        s.name as "sub_product",
        cities.name as "city",
        countries.name as "country",
        sup.name as "supplier",
        b.billing_first_name || ' ' || b.billing_last_name as "customer_name",
        nationality.name as "customer_nationality",
        b.input_details->'adult_pax' as "adult_pax",
        b.input_details->'child_pax' as "child_pax",
        to_char(b.trip_starts, 'MM/DD/YYYY') as "trip_date",
        sum(case
            when charge.charge_status_id in (1, 2) then charge.charge_amount/ charge.charge_exchange_rate -- Created/Settled add the amount
             else 0 -- Ignore pending charges and removed charges
         end) as "selling_price",
        sum(case
            when charge.charge_status_id in (1, 2) then charge.local_price / charge.local_exchange_rate
            else 0
        end) as "supplier_price",
        sum(case
            when charge.charge_status_id in (1, 2) then charge.local_price
            else 0
        end) as "local_price",
        max(charge.local_currency_code) as "local_price_currency", -- Aggregate and max to remove nullable currency_code e.g. manual other charge
        bs.backend_name as "booking_status",
        count(b.id) over() as "count",
        max(case
          when b.updated_at is not null then to_char(b.updated_at, 'MM/DD/YYYY')
          else to_char(b.created_at, 'MM/DD/YYYY')
        end) as "updated_at"
    from
        main.booking as b
    left join main.charge on
        charge.booking_id = b.id
    left JOIN main.payouts as payouts
        ON b.id = any (TRANSLATE(payouts.details::jsonb::text, '[]','{}')::INT[])
    join main.booking_status as bs on
        b.booking_status_id = bs.id
    join main.countries as nationality on
        b.nationality::int = nationality.id
    join main.users as u on
        b.user_id = u.id
        left join main.affiliates as a on
            u.affiliate_id = a.id
    join main.tours as t on
        b.tour_id = t.id
        join main.cities on
            t.city_id = cities.id
            join main.countries on
                cities.country_id = countries.id
        join main.suppliers as sup on
            t.supplier_id = sup.id
    left join main.sub_products as s on
        b.sub_product_id = s.id
    where
        b.booking_status_id <> 0
        ${booking_ids} ${tour_ids} ${user_ids} ${created_at} ${trip_date} ${supplier_ids} ${booking_status_ids}
    group by
        b.id,
        b.billing_first_name,
        b.billing_last_name,
        a.company_name,
        t.name,
        s.name,
        cities.name,
        countries.name,
        sup.name,
        nationality.name,
        bs.backend_name,
        payouts.id
    order by
        b.id desc offset ${offset} limit ${limit}`;
      console.log('Booking report SQL', sql);
      const data = await sqlHelper.raw(sql, []);

      if (data && data.length) {
        return Promise.resolve({
          status: true,
          data,
        });
      }
      return {
        status: false,
        message: 'No Data',
      };
    }
    return {
      status: false,
      message: 'Only allowed internally',
    };
  };

  Booking.remoteMethod('bookingReport', {
    accepts: [
      {
        arg: 'code',
        type: 'string',
        required: true,
      },
      {
        arg: 'filters',
        type: 'object',
      },
    ],
    returns: {
      arg: 'string',
      type: 'object',
      root: true,
    },
    http: {
      path: '/bookingReport',
      verb: 'get',
    },
  });

  Booking.remoteMethod('paymentReport', {
    accepts: [
      {
        arg: 'code',
        type: 'string',
        required: true,
      },
      {
        arg: 'filters',
        type: 'object',
      },
    ],
    returns: {
      arg: 'string',
      type: 'object',
      root: true,
    },
    http: {
      path: '/paymentReport',
      verb: 'get',
    },
  });

  // Booking.afterRemote('exportCSV', async (ctx, output, next) => {
  //   const datetime = new Date();
  //   // res.set('Cache-Control', 'max-age=0, no-cache, must-revalidate, proxy-revalidate');
  //   ctx.res.set('Last-Modified', datetime + 'GMT');
  //   ctx.res.setHeader('Content-Type', 'application/force-download');
  //   ctx.res.setHeader('Content-Type', 'application/octet-stream');
  //   ctx.res.setHeader('Content-Type', 'application/download');
  //   ctx.res.setHeader('Content-Disposition', `attachment;filename=Booking-Data-${datetime}.csv`);
  //   ctx.res.setHeader('Content-Transfer-Encoding', 'binary');
  //   if (ctx.result.status) {
  //     ctx.res.send(ctx.result.data);
  //   } else {
  //     ctx.res.send('Not Available');
  //   }

  // });

  // Booking.afterRemote('exportTransactionCSV', async (ctx, output, next) => {
  //   const datetime = new Date();
  //   // res.set('Cache-Control', 'max-age=0, no-cache, must-revalidate, proxy-revalidate');
  //   ctx.res.set('Last-Modified', datetime + 'GMT');
  //   ctx.res.setHeader('Content-Type', 'application/force-download');
  //   ctx.res.setHeader('Content-Type', 'application/octet-stream');
  //   ctx.res.setHeader('Content-Type', 'application/download');
  //   ctx.res.setHeader('Content-Disposition', `attachment;filename=Tranaction-Data-${datetime}.csv`);
  //   ctx.res.setHeader('Content-Transfer-Encoding', 'binary');
  //   if (ctx.result.status) {
  //     ctx.res.send(ctx.result.data);
  //   } else {
  //     ctx.res.send('Not Available');
  //   }

  // });

  Booking.bookingStats = (type, status_id, callback) => {
    const localeFormat = 'YYYY-MM-DD';
    type = parseInt(type, 10);
    let query = '';
    if (!status_id) {
      status_id = 1;
    }
    let from = moment().format(localeFormat);
    switch (type) {
      case 1: // weekly
        from = moment()
          .subtract(7, 'days')
          .format(localeFormat);
        break;
      case 2: // last 15 days
        from = moment()
          .subtract(15, 'days')
          .format(localeFormat);
        break;
      case 3: // last month
        from = moment()
          .subtract(1, 'months')
          .format(localeFormat);
        break;
      case 4: // last 3 month
        from = moment()
          .subtract(3, 'months')
          .format(localeFormat);
        break;
      case 5: // last 6 month
        from = moment()
          .subtract(6, 'months')
          .format(localeFormat);
        break;
      case 6: // last 1 year
        from = moment()
          .subtract(12, 'months')
          .format(localeFormat);
        break;
      default:
        from = moment()
          .subtract(60, 'months')
          .format(localeFormat);
    }

    if (status_id == 10) {
      // Booking Created
      query = `SELECT date_trunc('day', main.booking.created_at) AS label,count(*) as value FROM main.booking where  main.booking.created_at >= '${from}' group by 1 having count(main.booking.created_at) > 0`;
    } else {
      query = `SELECT date_trunc('day', main.booking.created_at) AS label,count(*) as value FROM main.booking where main.booking.booking_status_id > 0 and main.booking.booking_status_id <= ${status_id} and  main.booking.created_at >= '${from}' group by 1 having count(main.booking.created_at) > 0`;
    }

    const { connector } = Booking.app.dataSources.theasia;
    connector.query(query, [], (err, response) => {
      if (err) {
        return callback(err);
      }

      if (response && response.length) {
        let count = 0;
        _.each(response, res => {
          count = parseInt(res.count, 10) + count;
        });
        return callback(null, response);
      }
      return callback(null, []);
    });
  };

  Booking.remoteMethod('bookingStats', {
    accepts: [
      {
        arg: 'type',
        type: 'string',
      },
      {
        arg: 'status_id',
        type: 'string',
        description: 'booking_status_id',
      },
    ],
    returns: {
      args: 'response',
      type: 'object',
      root: true,
    },
    http: {
      path: '/bookingStats',
      verb: 'get',
    },
    description: 'Get booking Stats',
  });

  Booking.updateOptionals = async (id, { additional_information, ...rest }) => {
    if (!id) return Promise.reject(newLoopbackError(400, 'Bad Request', 'Missing booking ID'));

    const booking = await Booking.findOne({ where: { id } });

    if (!booking) {
      return Promise.reject(newLoopbackError(404, 'Not Found', 'Booking not found'));
    }

    // Validate booking before accepting update
    if (!booking.tour_id || !booking.sub_product)
      return Promise.reject(newLoopbackError(400, 'Booking Error', 'Booking instance error'));

    const changes = {
      special_request: rest.special_request,
      pickup_place: rest.pickup_place,
      pickup_time: rest.pickup_time,
      pickup_location_time: rest.pickup_location_time,
      selected_time: rest.selected_time,
      passport_number: rest.passport_number,
      flight_number: rest.flight_number,
      hotel_name: rest.hotel_name,
      drop_off_place: rest.drop_off_place,
    };
    const newBooking = Object.assign({}, booking.toObject(), changes);
    const tour = await Booking.app.models.Tours.findById(booking.tour_id, {
      include: ['currencies'],
    });
    const sub_product = await Booking.app.models.SubProducts.findOne({
      where: {
        id: booking.sub_product_id,
        status: true,
      },
    });
    const isValidBooking = await Booking.validateBooking(tour, sub_product, newBooking).catch(err =>
      console.log('validate catch:', err),
    );
    if (isValidBooking !== true)
      return Promise.reject(
        newLoopbackError(BAD_REQUEST, 'BOOKING_VALIDATION_ERROR', isValidBooking.message),
      );

    let tx;
    try {
      tx = await Booking.beginTransaction({
        isolationLevel: Booking.Transaction.READ_COMMITTED,
        timeout: 5000,
      });
      const transaction = { transaction: tx };

      // Create notes if additional information exists
      // Update first one if exists else create
      // NOTE: Function was meant for AAB therefore notes are public
      if (additional_information) {
        const note = await Booking.app.models.Notes.findOne({ where: { booking_id: booking.id } });
        if (note) {
          await note.updateAttribute('note', additional_information, transaction);
        } else {
          await Booking.app.models.Notes.create(
            {
              booking_id: id,
              user_id: booking.user_id,
              note: additional_information,
              channel: 'Draft',
              from: 'Draft',
              is_public: true,
            },
            transaction,
          );
        }
      }

      const finalBooking = await booking.updateAttributes(changes, transaction);

      await tx.commit();

      return finalBooking;
    } catch (error) {
      logger.error('UpdateOptionals', error);
      if (tx) await tx.rollback();
      return Promise.reject(newLoopbackError(500, SERVER_ERROR, 'Server error'));
    }
  };

  Booking.remoteMethod('updateOptionals', {
    accepts: [
      { arg: 'id', type: 'string', required: true },
      { arg: 'params', type: 'object', required: true },
    ],
    returns: { args: 'response', type: 'object', root: true },
    http: { path: '/updateOptionals', verb: 'post' },
    description: [
      'Direct partial update of optional(depends on sub product) booking details. ',
      'Meant to be used for immediate update right after booking. ',
      'Would likely not work 1 day after booking creation due to exchange rate changes and/or start date. ',
    ],
  });

  /**
   * Count and return bookings according to criteria
   * Made for affiliates
   * @param {BookingsAffiliateInput/BookingsSupplierInput} input
   * @returns {BookingsAffiliateRes}
   */
  Booking.search = async (
    {
      user_id,
      booking_method_id,
      limit = 10,
      offset = 0,
      order,
      bookingStatusId,
      searchTerm,
      start,
      end,
      supplier_id,
    },
    shouldCount = true,
  ) => {
    // if (!user_id) throw new Error('Missing user ID')
    let supplier_sql = ``;
    let user_sql = ``;
    if (user_id) {
      // used in affiliate app
      user_sql = `b.user_id = ${user_id}`;
    } else if (supplier_id) {
      // used in supplier app
      supplier_sql = `b.supplier_id = ${supplier_id}`;
    }
    const sqlSelect = shouldCount
      ? 'select b.*, bs.front_name, count(*) over() as full_count'
      : 'select b.*, bs.front_name';
    const sqlFrom =
      ' from main.booking as b join main.tours as t on b.tour_id = t.id' +
      ' join main.booking_status as bs on b.booking_status_id = bs.id';
    let sqlCondition = ` where ${user_sql} ${supplier_sql}`;

    // Allow multiple bookingMethods
    if (booking_method_id && booking_method_id.split(',').length > 1) {
      const ids = booking_method_id
        .split(',')
        .map(id => Number(id.trim()))
        .filter(id => [1, 2, 3, 4, 5, 6, 7, 8, 9].includes(id));
      sqlCondition += ` and b.booking_method_id in (${ids.join(', ')})`;
    } else if (booking_method_id) {
      sqlCondition += ` and b.booking_method_id = ${booking_method_id}`;
    }

    // Allow multiple bookingStatusIds
    if (bookingStatusId && bookingStatusId.split(',').length > 1) {
      const ids = bookingStatusId
        .split(',')
        .map(id => Number(id.trim()))
        .filter(id => [1, 2, 3, 4, 5, 6, 7, 8, 9].includes(id));
      sqlCondition += ` and b.booking_status_id in (${ids.join(', ')})`;
    } else if (bookingStatusId && [1, 2, 5, 7, 8, 9].includes(Number(bookingStatusId))) {
      // Allow only On Request, Completed, Departed, Canceled
      sqlCondition += ` and b.booking_status_id = ${bookingStatusId}`;
    } else {
      sqlCondition += ' and b.booking_status_id in (1, 2, 5, 7,8,9)';
    }

    if (start && end) {
      sqlCondition +=
        ` and b.created_at between '${moment(start).format('YYYY-MM-DD')} 00:00:00'` +
        ` and '${moment(end).format('YYYY-MM-DD')} 23:59:59'`;
    } else if (start) {
      sqlCondition += ` and b.created_at > '${moment(start).format('YYYY-MM-DD')} 00:00:00'`;
    } else if (end) {
      sqlCondition += ` and b.created_at < '${moment(end).format('YYYY-MM-DD')} 23:59:59'`;
    }

    if (searchTerm) {
      sqlCondition +=
        ` and (b.booking_no ilike '%${searchTerm}%'` +
        ` or b.billing_first_name ilike '%${searchTerm}%'` +
        ` or b.billing_last_name ilike '%${searchTerm}%'` +
        ` or t.name ilike '%${searchTerm}%')`;
    }

    if (order) {
      // map key from CMS to db
      order = order.replace('product_name', 't.name');
      sqlCondition += ` order by ${order}`;
    } else {
      sqlCondition += ' order by created_at desc';
    }

    if (limit) {
      sqlCondition += ` limit ${limit}`;
    }
    sqlCondition += ` offset ${offset}`;

    const sql = sqlSelect + sqlFrom + sqlCondition;
    logger.debug('sql', sql);
    const bookings = await new Promise((resolve, reject) => {
      Booking.app.dataSources.theasia.connector.query(sql, [], (error, res) => {
        if (error) return reject(error);
        return resolve(res);
      });
    });

    if (!bookings.length)
      return {
        count: 0,
        bookings: [],
      };

    let tourIds = new Set();
    let subProductIds = new Set();
    let bookingStatusIds = new Set();
    for (let i = 0; i < bookings.length; i++) {
      const booking = bookings[i];
      tourIds.add(booking.tour_id);
      subProductIds.add(booking.sub_product_id);
      bookingStatusIds.add(booking.booking_status_id);
    }
    tourIds = Array.from(tourIds);
    subProductIds = Array.from(subProductIds);
    bookingStatusIds = Array.from(bookingStatusIds);

    const generateSqlPlaceholders = length =>
      new Array(length).fill(undefined).map((val, index) => `$${index + 1}`);

    const toursSql = `select id, name from main.tours where id in (${generateSqlPlaceholders(
      tourIds.length,
    )})`;

    const toursPromise = new Promise((resolve, reject) => {
      Booking.app.dataSources.theasia.connector.query(toursSql, tourIds, (error, res) => {
        if (error) return reject(error);
        return resolve(res);
      });
    });

    const subProductsSql = `select id, name from main.sub_products where id in (${generateSqlPlaceholders(
      subProductIds.length,
    )})`;

    const subProductsPromise = new Promise((resolve, reject) => {
      Booking.app.dataSources.theasia.connector.query(
        subProductsSql,
        subProductIds,
        (error, res) => {
          if (error) return reject(error);
          return resolve(res);
        },
      );
    });

    const bookingStatusesSql = `select id, front_name from main.booking_status where id in (${generateSqlPlaceholders(
      bookingStatusIds.length,
    )})`;

    const bookingStatusesPromise = new Promise((resolve, reject) => {
      Booking.app.dataSources.theasia.connector.query(
        bookingStatusesSql,
        bookingStatusIds,
        (error, res) => {
          if (error) return reject(error);
          return resolve(res);
        },
      );
    });

    const [tours, subProducts, bookingStatuses] = await Promise.all([
      toursPromise,
      subProductsPromise,
      bookingStatusesPromise,
    ]);

    const mappedBookings = bookings.map(b => {
      b.tour = tours.find(t => t.id === b.tour_id);
      b.sub_product = subProducts.find(s => s.id === b.sub_product_id);
      b.booking_status = bookingStatuses.find(bs => Number(bs.id) === Number(b.booking_status_id));
      return b;
    });

    return {
      count: shouldCount ? bookings[0].full_count : 0,
      bookings: mappedBookings,
    };
  };

  Booking.migrationSupplierDetails = async () => {
    // Covers for supplier_exchange_rate = 0 and null
    const bookings = await Booking.find({
      where: {
        supplier_currency_code: null,
      },
      include: ['tour'],
    });
    const currencies = await Booking.app.models.Currencies.find();
    let countSuccess = 0;
    let countError = 0;
    await Promise.all(
      bookings.map(booking => {
        const currency = currencies.find(cur => cur.id == booking.tour().currency_id);
        if (!currency) return countError++;
        const data = {
          supplier_currency_code: currency.currency_code,
          supplier_exchange_rate: currency.exchange_rate,
        };
        countSuccess++;
        return booking.updateAttributes(data);
      }),
    );

    return {
      countSuccess,
      countError,
    };
  };

  Booking.remoteMethod('migrationSupplierDetails', {
    http: {
      path: '/migrationSupplierDetails',
      verb: 'get',
    },
    returns: {
      args: 'response',
      type: 'object',
      root: true,
    },
  });
};
