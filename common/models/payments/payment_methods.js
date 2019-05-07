module.exports = function (PaymentMethods) {
  PaymentMethods.beforeRemote('find', (ctx, f, next) => {
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
  PaymentMethods.beforeRemote('findById', (ctx, f, next) => {
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
