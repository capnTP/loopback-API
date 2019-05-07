module.exports = function (Features) {
  Features.beforeRemote('find', (ctx, f, next) => {
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
  Features.beforeRemote('find', (ctx, f, next) => {
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
