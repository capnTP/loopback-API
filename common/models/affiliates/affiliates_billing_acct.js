module.exports = function (AffiliatesBillingAcct) {
  AffiliatesBillingAcct.observe('before save', async (ctx) => {
    if (ctx.data) {
      // console.log(ctx.data);
    }
  });
}
