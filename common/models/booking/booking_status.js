module.exports = function (BookingStatus) {
  BookingStatus.beforeRemote('find', (ctx, status, next) => {
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
  BookingStatus.beforeRemote('findById', (ctx, status, next) => {
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
