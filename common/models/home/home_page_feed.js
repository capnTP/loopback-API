module.exports = function (HomePageFeed) {
  HomePageFeed.beforeRemote('find', (ctx, products, next) => {
    if (ctx.args.filter) {
      ctx.args.filter.include = [{
        relation: 'localization',
      }];
    } else {
      ctx.args.filter = {
        include: [{
          relation: 'localization',
        }],
      }
    }
    next();
  });
  HomePageFeed.beforeRemote('findById', (ctx, product, next) => {
    if (ctx.args.filter) {
      ctx.args.filter.include = [{
        relation: 'localization',
      }];
    } else {
      ctx.args.filter = {
        include: [{
          relation: 'localization',
        }],
      }
    }
    next();
  });
};
