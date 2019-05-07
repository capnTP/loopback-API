module.exports = function (SuppliersPaymentAccounts) {

  SuppliersPaymentAccounts.makeDefault = async (supplier_id, account_id) => {
    try {
      const SupplierAccounts = await SuppliersPaymentAccounts.find({
        where: {
          supplier_id: supplier_id
        }
      })
      const updateSA = SupplierAccounts.map(sa => {
        if (sa.id == account_id) {
          return sa.updateAttributes({
            is_default: true
          });
        } else {
          return sa.updateAttributes({
            is_default: false
          })
        }
      });
      await Promise.all(updateSA);
      return true;
    } catch (e) {
      console.log(e)
      return false;
    }
  };


  SuppliersPaymentAccounts.remoteMethod('makeDefault', {
    accepts: [{
        arg: 'supplier_id',
        type: 'number',
        required: true
      },
      {
        arg: 'account_id',
        type: 'number',
        required: true
      }
    ],
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/makeDefault',
      verb: 'get',
    },
  });

}
