/* eslint no-unused-vars:2 */
const { getSafe } = require('../utility')
const logger = require('../utility').loggerBuilder('Mixins.Activity')
const _ = require('lodash')
const moment = require('moment')

const BOOKING_STATUS_READABLE = {
  1: 'On Request',
  2: 'Booking Complete',
  3: 'Amend to Supplier',
  4: 'Wait Charge',
  5: 'Departed',
  6: 'Canceled',
  7: 'Allotment Reject',
  8: 'Supplier Confirmerd',
  9: 'Supplier Rejected',
}

module.exports = (Model) => {
  Model.beforeRemote('**', (ctx, instance, next) => {
    // logger.debug('Req.headers.authorization:', ctx.req.headers.authorization)
    // logger.debug('AccessToken id:', ctx.req.accessToken && ctx.req.accessToken.id ? ctx.req.accessToken.id : '')
    const user_id = getSafe(() => ctx.req.accessToken.userId) || 0
    if (ctx.instance && instance) {
      ctx.instance.setAttribute('model_user_id', user_id);
    } else if (ctx.data) {
      ctx.data.setAttribute('model_user_id', user_id)
      logger.debug('ctx data', ctx.data)
    }
    return next()
  })

  Model.observe('before save', (ctx, next) => {
    // Set to prevent repeat when checking array of numbers/string
    let updateFields = new Set([])
    // Check Arrays(recursive)
    //  if length is inequal = updated
    //  else comapre each element inside
    // Check Object(recursive)
    //  loop through val1, if val2 is undefined = val1 has new entry, else compare element
    //  after first loop, loop through val2, if val1 is undefined = val1 removed that key
    // Check numerics (5 decimal)
    // Check date
    // Check strings
    function check(key, val1, val2) {
      if (typeof val1 === 'object') {
        if (Array.isArray(val1)) {
          if (val1.length !== val2.length) {
            updateFields = updateFields.add(key)
          } else {
            return _.each(val1, (__, i) => check(key, val1[i], val2[i]))
          }
        } else {
          _.forIn(val1, (__, innerKey) => {
            if (!_.has(val2, innerKey)) {
              updateFields = updateFields.add(`${key}.${innerKey}`)
            } else {
              check(`${key}.${innerKey}`, val1[innerKey], val2[innerKey])
            }
          })
          _.forIn(val2, (__, innerKey) => {
            if (!_.has(val1, innerKey)) {
              updateFields = updateFields.add(`${key}.${innerKey}`)
            }
          })
        }
      } else if (!Number.isNaN(parseInt(val1, 10)) && !Number.isNaN(parseInt(val2, 10))) {
        if (Number(val1).toFixed(5) !== Number(val2).toFixed(5)) {
          updateFields = updateFields.add(key)
        }
      } else if (val1 && moment(val1, ['YYYY-MM-DD', 'YYYY-MM-DDTHH:mm:ssZ', 'YYYY-MM-DDTHH:mm:ss.SSSZ'], true).isValid()) {
        if (moment.utc(val1).format() !== moment.utc(val2).format()) {
          updateFields.add(key)
        }
      } else if (!_.isEqual(val1, val2)) {
        updateFields = updateFields.add(key)
      }
    }

    // PATCH /<model>/:id
    if (ctx.currentInstance) {
      // ctx.Model.includeActivityFields allow Models to define which fields
      // to be included in activity log
      const includedFields = ctx.Model.includeActivityFields || ctx.currentInstance
      _.each(ctx.data, (value, key) => {
        if (includedFields[key] && key !== 'updated_at') {
          try {
            check(key, value, ctx.currentInstance[key])
          } catch (error) {
            console.log('Activity mixin catch:', key, value, error)
          }
        }
      })
    }

    ctx.hookState.updateFields = Array.from(updateFields)
    return next()
  })


  Model.observe('after save', ({
    instance,
    isNewInstance,
    hookState,
  }, next) => {
    try {
      // logger.debug('instance:', instance.model_user_id)
      logger.debug(`[${Model.name}] hookstate:`, hookState)
      if (isNewInstance) { // create case
        const newActivityList = []
        let user_id = instance.model_user_id ? instance.model_user_id : 0
        if (Model.name === 'Notes') { // spacial case
          newActivityList.push({
            model_name: Model.name,
            action_taken: `Create {${instance.note.split(' ').slice(0, 11).join(' ')}}`,
            action_result: 'Success',
            user_id: instance.user_id || user_id,
            model_id: instance.id,
          })
          logger.debug(newActivityList)
          Model.app.models.Activity.create(newActivityList)
          return next()
        }
        if (instance.tour_id && Model.name !== 'Booking') {
          user_id = instance.model_user_id ? instance.model_user_id : 0
          newActivityList.push({
            model_name: 'Tours',
            action_taken: `Add ${Model.name}`,
            action_result: 'Success',
            user_id,
            model_id: instance.tour_id,
          })
        }
        if (instance.city_id && Model.name !== 'Tours') {
          user_id = instance.model_user_id ? instance.model_user_id : 0
          newActivityList.push({
            model_name: 'Cities',
            action_taken: `Add ${Model.name}`,
            action_result: 'Success',
            user_id,
            model_id: instance.city_id,
          })
        }
        if (instance.country_id) {
          user_id = instance.model_user_id ? instance.model_user_id : 0
          newActivityList.push({
            model_name: 'Countries',
            action_taken: `Add ${Model.name}`,
            action_result: 'Success',
            user_id,
            model_id: instance.country_id,
          })
        }
        newActivityList.push({
          model_name: Model.name,
          action_taken: 'Create',
          action_result: 'Success',
          user_id: Model.name == 'Booking' ? getSafe(() => instance.user_id) || user_id : user_id,
          model_id: instance.id,
        })
        // logger.debug(newActivityList)
        Model.app.models.Activity.create(newActivityList)
      } else if (getSafe(() => hookState.updateFields.length)) { // update case
        const newActivityList = []
        const user_id = instance.model_user_id ? instance.model_user_id : 0
        // booking_status_id != 3 to display all changes in the first amend attempt
        // When confirm/reject it will just show the changed status
        if (Model.name == 'Booking' && hookState.updateFields.includes('booking_status_id') && instance.booking_status_id != 3) {
          newActivityList.push({
            model_name: 'Booking',
            action_taken: `Update {${BOOKING_STATUS_READABLE[parseInt(instance.booking_status_id, 10)]}}`,
            action_result: 'Success',
            user_id: Model.name == 'Booking' ? user_id : getSafe(() => instance.user_id) || user_id,
            model_id: instance.id,
          })
          // logger.debug(newActivityList)
          Model.app.models.Activity.create(newActivityList)
        } else {
          newActivityList.push({
            model_name: Model.name,
            action_taken: `Update <${getSafe(() => hookState.updateFields.join(', ')) || ''}>`.trim(),
            action_result: 'Success',
            user_id: Model.name == 'Booking' ? user_id : getSafe(() => instance.user_id) || user_id,
            model_id: instance.id,
          })
          logger.debug('Update activity list:', newActivityList)
          Model.app.models.Activity.create(newActivityList)
        }
      }
    } catch (error) {
      logger.error('after save', error)
    }

    return next()
  })

  Model.observe('before delete', async (ctx) => {
    const instances = await Model.find({
      where: ctx.where,
    })
    ctx.hookState.instances = instances
    return Promise.resolve()
  })

  Model.observe('after delete', (ctx, next) => {
    if (ctx.hookState.instances) {
      ctx.hookState.instances.forEach((instance) => {
        const newActivityList = []
        let user_id = instance.model_user_id ? instance.model_user_id : 0
        if (instance.tour_id && Model.name !== 'Booking') {
          user_id = instance.model_user_id ? instance.model_user_id : 0
          newActivityList.push({
            model_name: 'Tours',
            action_taken: `Remove ${Model.name}`,
            action_result: 'Success',
            user_id,
            model_id: instance.tour_id,
          })
        }
        if (instance.city_id && Model.name !== 'Tours') {
          user_id = instance.model_user_id ? instance.model_user_id : 0
          newActivityList.push({
            model_name: 'Cities',
            action_taken: `Remove ${Model.name}`,
            action_result: 'Success',
            user_id,
            model_id: instance.city_id,
          })
        }
        if (instance.country_id) {
          user_id = instance.model_user_id ? instance.model_user_id : 0
          newActivityList.push({
            model_name: 'Countries',
            action_taken: `Remove ${Model.name}`,
            action_result: 'Success',
            user_id,
            model_id: instance.country_id,
          })
        }
        newActivityList.push({
          model_name: Model.name,
          action_taken: 'Delete',
          action_result: 'Success',
          user_id,
          model_id: instance.id,
        })
        // logger.debug(newActivityList)
        Model.app.models.Activity.create(newActivityList)
      })
    }
    return next()
  })
}
