const { getSafe } = require('../../utility')
const app = require('../../../server')


const defaultFilter = {
  include: [
    'billing_country',
    'nationalityRel',
    'billing_language',
    'booking_currency',
    'affiliate',
    'user',
    {
      relation: 'tour',
      scope: {
        include: [
          'currencies',
          'suppliers',
          {
            relation: 'features',
            scope: {
              include: 'feature'
            }
          },
          {
            relation: 'sub_product',
            scope: {
              include: ['cancellation_policy', 'price']
            }
          }
        ]
      }
    },
    {
      relation: 'sub_product',
      scope: {
        include: ['cancellation_policy', 'price']
      }
    }
  ],
}

module.exports = function (Draft) {
  Draft.defaultFilter = defaultFilter
  // Allow only find/findById for non-admin
  Draft.beforeRemote('**', (ctx, instance, next) => {
    if (ctx.methodString === 'Drafts.find' || ctx.methodString === 'Drafts.findById' || ctx.methodString === 'Drafts.count') {
      return next()
    } else {
      const user_id = getSafe(() => ctx.req.accessToken.userId)
      Draft.app.models.Users.onlyAdminValidation(user_id)
        .then(next)
        .catch(next)
    }
  })

  Draft.beforeRemote('find', (ctx, instance, next) => {
    ctx.args.filter = {
      ...defaultFilter,
      ...ctx.args.filter,
    }
    return next();
  })

  Draft.beforeRemote('findById', (ctx, instance, next) => {
    ctx.args.filter = {
      ...defaultFilter,
      ...ctx.args.filter,
    }
    return next();
  })
}
