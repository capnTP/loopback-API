module.exports = function (Languages) {
  Languages.beforeRemote('find', (ctx, products, next) => {
    if (ctx.args.filter) {
      ctx.args.filter.where = {
        locale_available: true,
      };
    } else {
      ctx.args.filter = {
        where: {
          locale_available: true,
        },
      }
    }
    next();
  });
};
