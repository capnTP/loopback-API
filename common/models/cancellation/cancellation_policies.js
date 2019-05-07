module.exports = function (CancellationPolicies) {
  CancellationPolicies.beforeRemote('find', (ctx, cp, next) => {
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
  CancellationPolicies.beforeRemote('findById', (ctx, cp, next) => {
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
