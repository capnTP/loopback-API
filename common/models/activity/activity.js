const logger = require('../../utility').loggerBuilder('Activity')
const moment = require('moment')

module.exports = function (Activity) {
  Activity.beforeRemote('find', (ctx, products, next) => {
    ctx.args.filter = {
      include: [
        'activityUserIdFkeyrel',
        'email_activity',
      ],
      limit: 40,
      order: 'created_at DESC',
      ...ctx.args.filter,
    }
    return next()
  })

  Activity.beforeRemote('findById', (ctx, product, next) => {
    ctx.args.filter = {
      include: [
        'activityUserIdFkeyrel',
        'email_activity',
      ],
      order: 'created_at DESC',
      ...ctx.args.filter,
    }
    return next()
  })

  Activity.deleteExpiredActivities = async () => {
    try {
      const deleteDate = moment().subtract(1, 'month').format()
      const result = await Activity.destroyAll({ created_at: { lt: deleteDate } })
      return result
    } catch (error) {
      logger.error(error)
      return Promise.reject(error)
    }
  }

  Activity.remoteMethod('deleteExpiredActivities', {
    http: { verb: 'get', path: '/deleteExpiredActivities' },
    returns: { args: 'response', type: 'object', root: true },
  })
};
