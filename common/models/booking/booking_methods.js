module.exports = function (BookingMethods) {
  BookingMethods.beforeRemote('find', (ctx, bookingmethods, next) => {
    if (ctx.args.filter) {
      ctx.args.filter.include = {
        relation: 'localization',
      };
    } else {
      ctx.args.filter = {
        include: {
          relation: 'localization',
        },
      }
    }


    next();
  });
  BookingMethods.beforeRemote('findById', (ctx, bookingmethod, next) => {
    if (ctx.args.filter) {
      ctx.args.filter.include = {
        relation: 'localization',
      };
    } else {
      ctx.args.filter = {
        include: {
          relation: 'localization',
        },
      }
    }
    next();
  });
};
