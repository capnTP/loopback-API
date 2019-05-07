const _ = require('lodash')
const moment = require('moment')
const { newLoopbackError } = require('../../utility')
const { pluralize } = require('../../helpers/booking')
const logger = require('../../utility').loggerBuilder('Charge.js')
const { HTTPStatusCode: { BAD_REQUEST, NOT_FOUND, FORBIDDEN, SERVER_ERROR }, getSafe } = require('../../utility')
const { REFUND_OPTION } = require('../../helpers/payment')
const { formatCurrency, limitDecimals } = require('../../helpers/currency')

const ALLOW_CHARGE_BOOKING_IDS = [1, 2, 3]

const cancellationPolicyObjectList = {
  1: {
    period: 1,
  },
  2: {
    period: 3,
  },
  3: {
    period: 7,
  },
  4: {
    period: 0,
  },
}

module.exports = function (Charge) {
  Charge.createChargeFromBooking = async (booking_id, isMigration = false) => {
    try {
      const booking = await Charge.app.models.Booking.findById(booking_id, {
        include: 'payment'
      })
      if (!booking) return newLoopbackError(FORBIDDEN, 'BOOKING_IS_NOT_FOUND')
      if (!isMigration && booking.booking_status_id != 1 && booking.booking_status_id != 2) {
        return newLoopbackError(FORBIDDEN, 'BOOKING_STATUS_INVALID',
        `Cannot create charge for booking status ${booking.booking_status_id}`)
      }
      const existingCharges = await Charge.find({ where: { booking_id } })
      if (existingCharges.length > 0) {
        if (!isMigration || !(booking.adult_price && booking.adult_cost)) {
          return newLoopbackError(FORBIDDEN, 'CHARGES_ALREADY_CREATED')
        } else {
          await Promise.all(existingCharges.map(charge => charge.destroy()))
        }
      }
      let chargeStatusId = 2
      if (booking.booking_status_id == 1) chargeStatusId = 1
      if (booking.booking_status_id == 7) chargeStatusId = 4
      if (booking.booking_status_id == 6) chargeStatusId = 6
      const isCancel = booking.booking_status_id == 7
      const newChargeFor = (subject) => {
        const newChargeList = []
        const loopSize = booking.input_details[`${subject}_pax`]

        let sellingPriceSubject
        let supplierPriceSubject
        let selling_price
        let charge_amount
        let supplier_price
        // old booking
        if (booking.adult_price && booking.adult_cost && subject !== 'infant') {
          sellingPriceSubject = parseFloat(Number(Number(booking[`${subject}_price`]) / loopSize).toFixed(2))
          supplierPriceSubject = Number(booking[`${subject}_cost`])
          supplier_price = formatCurrency('USD', supplierPriceSubject / booking.supplier_exchange_rate, true)
          selling_price = formatCurrency('USD', sellingPriceSubject / booking.exchange_rate, true)
          charge_amount = formatCurrency(booking.booking_currency_code, sellingPriceSubject, true)
        } else {
          sellingPriceSubject = Number(booking.price_details.sellingPrice[`${pluralize(subject)}`])
          supplierPriceSubject = Number(booking.price_details.supplierPrice[`${pluralize(subject)}`])
          if (parseInt(booking.booking_method_id, 10) === 3) {
            supplier_price = limitDecimals(supplierPriceSubject / booking.supplier_exchange_rate)
            selling_price = limitDecimals(sellingPriceSubject / booking.exchange_rate)
            charge_amount = sellingPriceSubject
          } else {
            supplier_price = formatCurrency('USD', supplierPriceSubject / booking.supplier_exchange_rate, true)
            selling_price = formatCurrency('USD', sellingPriceSubject / booking.supplier_exchange_rate, true)
            charge_amount = formatCurrency(booking.booking_currency_code, (sellingPriceSubject / booking.supplier_exchange_rate) * booking.exchange_rate, true)
          }
        }

        for (let i = 0; i < loopSize; i++) {
          const newChargeObject = {
            booking_id: booking.id,
            payment_id: 0,
            pax_type: subject,
            selling_price,
            supplier_price,
            local_price: supplierPriceSubject,
            local_currency_code: booking.supplier_currency_code,
            local_exchange_rate: booking.supplier_exchange_rate,
            charge_amount,
            charge_currency_code: booking.booking_currency_code,
            charge_exchange_rate: booking.exchange_rate,
            is_cancel: isCancel,
            payment_date: null,
            charge_status_id: chargeStatusId,
            charge_type_id: 1, // Tour Charge
            supplier_id:booking.supplier_id
          }
          newChargeList.push(newChargeObject)
        }
        return newChargeList
      }

      const newChargesList = [
        ...newChargeFor('adult'),
        ...newChargeFor('child'),
        ...newChargeFor('infant')
      ]

      const createChargeDeductions = amount => ({
        booking_id: booking.id,
        payment_id: 0,
        pax_type: '',
        selling_price: limitDecimals(amount / booking.exchange_rate),
        supplier_price: 0,
        local_price: 0,
        local_currency_code: booking.supplier_currency_code,
        local_exchange_rate: booking.supplier_exchange_rate,
        charge_amount: amount,
        charge_currency_code: booking.booking_currency_code,
        charge_exchange_rate: booking.exchange_rate,
        is_cancel: false,
        payment_date: null,
        charge_status_id: chargeStatusId,
        charge_type_id: 2, // Other Charge
        supplier_id:booking.supplier_id
      })

      // Addition deductions from AAB
      if (Number(booking.booking_method_id) === 3) {
        if (booking.commission) {
          newChargesList.push(createChargeDeductions(-Number(booking.commission)))
        }
        if (booking.discount) {
          newChargesList.push(createChargeDeductions(-Number(booking.discount)))
        }
        if (booking.vat) {
          newChargesList.push(createChargeDeductions(-Number(booking.vat)))
        }
      }

      const charges = await Charge.create(newChargesList)

      // Create refund charge record
      if (chargeStatusId === 6) {
        const payments = booking.payment()
        // Find the latest refund payment
        const payment = payments
          .sort((a, b) => new Date(a.created_at) > new Date(b.created_at) ? 1 : -1 )
          .find(p => p.payment_status_id == 4)
        if (payment) {
          // Full Penalty
          // Waive Cancellation fee
          // Custom Cancellation Fee
          if (payment.final_amount === 0) {
            charges.push(await Charge.createCancellation(booking.id, 2, 4, payment.total, 0))
          } else if (payment.total === payment.final_amount) {
            charges.push(await Charge.createCancellation(booking.id, 2, 7, 0, 0))
          } else {
            charges.push(await Charge.createCancellation(booking.id, 2, 8, payment.total - payment.final_amount, 0))
          }
        }
      }

      return { status: 200, data: charges }
    } catch (error) {
      logger.error('[CreateChargeFromBooking]: Booking_id', booking_id)
      logger.error('[CreateChargeFromBooking]', error)
      return Promise.reject(newLoopbackError(SERVER_ERROR, 'CREATE_CHARGE_FAILED'))
    }
  }
  /**
   * For test or manual create charges
   */
  Charge.remoteMethod('createChargeFromBooking', {
    accepts: [
      { arg: 'booking_id', type: 'number', required: true },
      { arg: 'isMigration', type: 'boolean' },
    ],
    returns: { arg: 'response', type: 'object', root: true },
    http: { path: '/createChargeFromBooking', verb: 'post' },
  })

  /**
   * Creates cancellation charge based on booking details
   * TODO: Allow transactions and replace batchDelete with this implementation
   * @param {Number} booking_id
   * @param {Number} charge_status_id Defaults to 'settled' (2)
   * @param {Number} charge_type_id Defaults to 'Cancellation Fee'(5)
   */
  Charge.createCancellation = async (booking_id, charge_status_id = 2, charge_type_id = 5, customCancellationCost = 0, supplierCancellationCost = 0) => {
    try {
      const booking = await Charge.app.models.Booking.findOne({ where: { id: booking_id }, include: 'cancellationPoliciesRel' })
      await Charge.app.models.Booking.validateCancellationPolicy(booking)
      let sellingPrice = booking.cancellationPoliciesRel().cancellation_fee
      let chargeAmount = formatCurrency(booking.booking_currency_code, sellingPrice * booking.exchange_rate, true)
      let supplierPrice = 0
      let localPrice = 0
      let localCurrencyCode = booking.supplier_currency_code
      let localExchangeRate = booking.supplier_exchange_rate
      if (charge_type_id == 8) {
        supplierPrice = formatCurrency('USD', supplierCancellationCost / booking.supplier_exchange_rate, true)
        localPrice =  formatCurrency(booking.supplier_currency_code, supplierCancellationCost, true)
        localCurrencyCode = booking.supplier_currency_code
        localExchangeRate = booking.supplier_exchange_rate
        sellingPrice = formatCurrency('USD', customCancellationCost / booking.exchange_rate, true)
        chargeAmount = formatCurrency(booking.booking_currency_code, customCancellationCost, true)
      }
      await Charge.create({
        booking_id: booking.id,
        payment_id: 0,
        pax_type: '',
        selling_price: sellingPrice,
        supplier_price: supplierPrice,
        local_price: localPrice,
        local_currency_code: localCurrencyCode,
        local_exchange_rate: localExchangeRate,
        charge_amount: chargeAmount,
        charge_currency_code: booking.booking_currency_code,
        charge_exchange_rate: booking.exchange_rate,
        is_cancel: false,
        payment_date: null,
        charge_status_id,
        charge_type_id,
        supplier_id:booking.supplier_id
      })
    } catch (error) {
      return Promise.reject(error)
    }
  }

  /**
   * Create full penalty charge based on remaining settled tour charges
   * @param {Number} booking_id
   * @param {Number} charge_status_id Defaults to 'settled' (2)
   */
  Charge.createFullPenalty = async (booking_id, charge_status_id = 2) => {
    const booking = await Charge.app.models.Booking.findOne({ where: { id: booking_id } })
    const charges = await Charge.find({ where: { booking_id: booking.id } })
    let totalChargeAmount = 0
    let totalSellingAmount = 0
    _.each(charges, (charge) => {
      if (charge.charge_status_id === 2 && charge.charge_type_id) {
        totalChargeAmount += charge.charge_amount
        totalSellingAmount += charge.selling_price
      }
    })
    await Charge.create({
      booking_id: booking.id,
      payment_id: 0,
      pax_type: '',
      selling_price: formatCurrency('USD', totalSellingAmount, true),
      supplier_price: 0,
      local_price: 0,
      local_currency_code: booking.supplier_currency_code,
      local_exchange_rate: booking.supplier_exchange_rate,
      charge_amount: formatCurrency(booking.booking_currency_code, totalChargeAmount, true),
      charge_currency_code: booking.booking_currency_code,
      charge_exchange_rate: booking.exchange_rate,
      is_cancel: false,
      payment_date: null,
      charge_status_id,
      charge_type_id: 4, // Full Penalty
      supplier_id:booking.supplier_id
    })
    return Promise.resolve(totalChargeAmount)
  }

  Charge.isSameBooking = (charges = []) => Object.keys(_.countBy(charges, 'booking_id')).length === 1

  Charge.getPreviousBookingStatusId = async (bookingId) => {
    let chargeStatusIds = await Charge.find({
      where: { booking_id: bookingId },
      fields: { charge_status_id: true }
    })
    chargeStatusIds = chargeStatusIds.map(charge => charge.charge_status_id)
    const uniqueStatuses = _.uniq(chargeStatusIds)

    if (_.intersection(uniqueStatuses, [1, 3, 4, 7]).length === uniqueStatuses.length) {
      return Promise.resolve(1)
    } else if (_.intersection(uniqueStatuses, [2, 5, 6, 8]).length === uniqueStatuses.length) {
      return Promise.resolve(2)
    } else {
      return Promise.reject(new Error(`Unknown charge statuses ${uniqueStatuses}`))
    }
  }

  // Create charges for a single booking
  // Booking status must be allowed to create charge
  // Updates booking status to 3 (Amend to Supplier)
  Charge.addCharge = async (data, isSendCustomerEmail = true, isSendSupplierEmail = true, req) => {
    let tx
    try {
      const userId = getSafe(() => req.accessToken.userId)
      await Charge.app.models.Users.onlyAdminValidation(userId)

      const booking = await Charge.app.models.Booking.findOne({ where: { id: data.booking_id } })
      if (!booking) {
        return { status: false, message: 'Booking not found', statusCode: NOT_FOUND }
      }
      if (ALLOW_CHARGE_BOOKING_IDS.indexOf(Number(booking.booking_status_id)) === -1) {
        return { status: false, message: `Charge cannot be created for booking_status_id: ${booking.booking_status_id}`, statusCode: FORBIDDEN }
      }

      const prevBookingStatus = await Charge.getPreviousBookingStatusId(data.booking_id)
      const chargeAmount = formatCurrency(booking.booking_currency_code, data.selling_price * booking.exchange_rate)

      const chargeData = {
        booking_id: data.booking_id,
        payment_id: 0,
        pax_type: data.pax_type,
        selling_price: data.selling_price,
        supplier_price: data.supplier_price,
        local_price: data.local_price,
        local_currency_code: booking.supplier_currency_code,
        local_exchange_rate: booking.supplier_exchange_rate,
        charge_amount: chargeAmount,
        charge_currency_code: booking.booking_currency_code,
        charge_exchange_rate: booking.exchange_rate,
        charge_status_id: prevBookingStatus === 1 ? 7 : 8,
        charge_type_id: data.charge_type_id,
        supplier_id:booking.supplier_id
      }

      tx = await Charge.beginTransaction({
        isolationLevel: Charge.Transaction.READ_COMMITED,
        timeout: 10000
      })
      const transaction = { transaction: tx }
      const result = await Charge.create(chargeData, transaction)
      await booking.updateAttributes({ booking_status_id: 3 }, transaction)

      // Create activity log
      await Charge.app.models.Activity.create({
        model_name: 'Booking',
        action_taken: `Add Charge ID ${result.id}`,
        action_result: 'Success',
        user_id: userId,
        model_id: booking.id,
      }, transaction)

      const txErr = await tx.commit()
      if (txErr) {
        logger.error('[addCharge] TX Commit error:', txErr)
        return { status: false, message: txErr.message }
      }
      return Promise.resolve({ status: true, message: 'Charge create success', data: result })
    } catch (error) {
      logger.error('addCharge:', error)
      if (tx) {
        await tx.rollback()
      }
      return Promise.reject(newLoopbackError(SERVER_ERROR, 'SERVER_ERROR', error.message))
    }
  }

  Charge.remoteMethod('addCharge', {
    accepts: [
      { arg: 'data', type: 'object', required: true },
      { arg: 'isSendCustomerEmail', type: 'boolean', description: 'default is true' },
      { arg: 'isSendSupplierEmail', type: 'boolean', description: 'default is true' },
      { arg: 'req', type: 'object', http: { source: 'req' } },
    ],
    returns: { arg: 'response', type: 'object', root: true },
    http: { path: '/addCharge', verb: 'post' },
  })


  // Update booking and charge
  // On request booking, charge 'Created'(1) -> 'Pending Removal'(3)
  // Booking complete, charge 'Settled'(2) -> 'Pending Refund'(5)
  // Create cancel_fee charge status 'Pending Creation'(7)
  Charge.batchDelete = async (ids = [], isSendCustomerEmail = true, isSendSupplierEmail = true, req) => {
    let tx
    try {
      // Validation
      const userId = getSafe(() => req.accessToken.userId)
      await Charge.app.models.Users.onlyAdminValidation(userId)

      if (!Array.isArray(ids)) ids = [ids]
      if (ids.some(v => typeof v !== 'number')) return Promise.reject(newLoopbackError(BAD_REQUEST, 'INCORRECT_DATA_TYPE', 'Input is not a number'))

      const charges = await Charge.find({ where: { id: { inq: ids } } })
      if (charges.length < 1) return Promise.reject(newLoopbackError(FORBIDDEN, 'CHARGE_NOT_FOUND'))
      if (!Charge.isSameBooking(charges)) return Promise.reject(newLoopbackError(FORBIDDEN, 'INCORRECT_BOOKING', 'Charges must be from the same booking'))
      const totalCharge = await Charge.count({ booking_id: charges[0].booking_id })
      if (totalCharge === charges.length) return Promise.reject(newLoopbackError(FORBIDDEN, 'MAX_DELETE_CHARGE', 'Cannot delete all charges from this method'))

      const booking = await Charge.app.models.Booking.findOne({ where: { id: charges[0].booking_id }, include: 'cancellationPoliciesRel' })
      if (ALLOW_CHARGE_BOOKING_IDS.indexOf(Number(booking.booking_status_id)) === -1) {
        return Promise.reject(newLoopbackError(FORBIDDEN, 'BOOKING_MODIFICATION_NOT_ALLOWED', `Charge cannot be updated for booking_status_id: ${booking.booking_status_id}`))
      }

      tx = await Charge.beginTransaction({
        isolationLevel: Charge.Transaction.READ_COMMITED,
        timeout: 10000
      })
      const transaction = { transaction: tx }

      // All Charges of this booking
      const allCharges = await Charge.find({
        fields: { id: true, charge_status_id: true },
        where: {
          booking_id: booking.id,
        },
      })

      // Pending charges to determine whether all charges were reverted back or not
      const pendingCharges = allCharges
        .filter(charge => [3, 5, 7, 8].includes(Number(charge)))
        .map(c => c.id)

      let prevBookingStatus

      // Update charge and booking
      await Promise.all(charges.map((charge) => {
        if (charge.charge_status_id === 1) {
          pendingCharges.push(charge.id)
          return charge.updateAttributes({ charge_status_id: 3 }, transaction)
        } else if (charge.charge_status_id === 2) {
          pendingCharges.push(charge.id)
          return charge.updateAttributes({ charge_status_id: 5 }, transaction)
        } else if (charge.charge_status_id === 3) {
          prevBookingStatus = 1
          pendingCharges.splice(pendingCharges.indexOf(charge.id), 1)
          return charge.updateAttributes({ charge_status_id: 1 }, transaction)
        } else if (charge.charge_status_id === 5) {
          prevBookingStatus = 2
          pendingCharges.splice(pendingCharges.indexOf(charge.id), 1)
          return charge.updateAttributes({ charge_status_id: 2 }, transaction)
        } else if ([7, 8].includes(charge.charge_status_id)) {
          prevBookingStatus = charge.charge_status_id === 7 ? 1 : 2
          pendingCharges.splice(pendingCharges.indexOf(charge.id), 1)
          return charge.destroy(transaction)
        } else { // Removed and Refunded left
          return Promise.reject(newLoopbackError(FORBIDDEN, 'INCORRECT_CHARGE_STATUS', 'Cannot delete already deleted charge.'))
        }
      }))

      // check if no pending charges or amend, convert booking status back
      if (!booking.amend_details && pendingCharges.length === 0 && prevBookingStatus) {
        await booking.updateAttributes({ booking_status_id: prevBookingStatus }, transaction)
        // Cannot delete all charges, use cancel booking instead
      } else if (pendingCharges.length === allCharges.length) {
        return Promise.reject(newLoopbackError(FORBIDDEN, 'INCORRECT_CHARGE_STATUS', 'Cannot delete all charges, use cancel booking instead.'))
      } else {
        await booking.updateAttributes({ booking_status_id: 3 }, transaction)
      }

      // Create activity log
      await Charge.app.models.Activity.create({
        model_name: 'Booking',
        action_taken: `Put charge ids [${ids.join(', ')}] for deletion`,
        action_result: 'Success',
        user_id: userId,
        model_id: booking.id,
      }, transaction)

      // Commit tx and complete
      const txErr = await tx.commit()
      if (txErr) {
        logger.error('[batchCreate] TX Commit error:', txErr)
        return { status: false, message: txErr.message, statusCode: SERVER_ERROR }
      }
      return Promise.resolve({ status: true, message: 'Delete charges success', details: { ids } })
    } catch (error) {
      logger.error('batchDelete:', error)
      if (tx) {
        await tx.rollback()
      }
      if (error.status) {
        return Promise.reject(error)
      }
      return Promise.reject(newLoopbackError(SERVER_ERROR, 'SERVER_ERROR', error.message))
    }
  }

  Charge.remoteMethod('batchDelete', {
    accepts: [
      { arg: 'ids', type: ['number'], required: true },
      { arg: 'isSendCustomerEmail', type: 'boolean', description: 'default is true' },
      { arg: 'isSendSupplierEmail', type: 'boolean', description: 'default is true' },
      { arg: 'req', type: 'object', http: { source: 'req' } },
    ],
    returns: { arg: 'response', type: 'object', root: true },
    http: { path: '/batchDelete', verb: 'post' }
  })

  Charge.getNewBookingTotal = async (booking) => {
    const charges = await Charge.find({ where: { booking_id: booking.id } })
    const chargeStatuses = charges.map(charge => charge.charge_status_id)
    let totalChange = 0
    if (chargeStatuses.includes(3)) {
      _.each(charges, (charge) => {
        if (charge.charge_status_id === 3) {
          totalChange -= charge.charge_amount
        } else if (charge.charge_status_id === 7) {
          totalChange += charge.charge_amount
        }
      })
    } else if (chargeStatuses.includes(5)) {
      _.each(charges, (charge) => {
        if (charge.charge_status_id === 5) {
          totalChange -= charge.charge_amount
        } else if (charge.charge_status_id === 8) {
          totalChange += charge.charge_amount
        }
      })
    }
    const newTotal = formatCurrency(booking.booking_currency_code, booking.total + totalChange, true)
    return Promise.resolve(newTotal)
  }

  Charge.getRefundAmount = async (booking_id, option, cancellationCost) => {
    const charges = await Charge.find({ where: { booking_id } })
    const booking = await Charge.app.models.Booking.findById(booking_id);

    let totalRefund = 0
    let message = ``;
    if (option === REFUND_OPTION.FULL_REFUND) {
      _.each(charges, (charge) => {
        if (charge.charge_status_id === 2 && charge.charge_type_id !== 5 && charge.charge_type_id !== 6) {
          totalRefund += charge.charge_amount
        }
      })
      message = 'Refund Type: Full Refund';
    } else if (option === REFUND_OPTION.APPLY_CANCELLATION_POLICY) { //cancallation Policy
      let policyObject = cancellationPolicyObjectList[booking.cancellation_policy_id || 1]
      if (!policyObject) policyObject = cancellationPolicyObjectList[4]

      const startDateObj = {
        year: moment(booking.trip_starts).year(),
        month: moment(booking.trip_starts).month() + 1,
        date: moment(booking.trip_starts).date(),
      }
      const startDate = moment(`${startDateObj.year}-${startDateObj.month}-${startDateObj.date}-+07:00`, 'YYYY-MM-DD-Z')
      const avalibleDate = startDate.clone().subtract(policyObject.period, 'day')
      const now = moment()
      if(!policyObject.period) { // cancellation policy non refundable
        totalRefund = 0;
        message = `Refund Type: Cancallation Policy, Note: Cancallation Date is over,This won't refund any amount.`;
      }
      else if (now.unix() > avalibleDate.unix()) // Other cancellation policy
      {
        totalRefund = 0;
        message = `Refund Type: Cancallation Policy, Note: Cancallation Date is over,This won't refund any amount.`;
      } else {
        _.each(charges, (charge) => {
          if (charge.charge_status_id === 2 && charge.charge_type_id !== 5 && charge.charge_type_id !== 6) {
            totalRefund += charge.charge_amount
          }
        })
        totalRefund -= 5 * charges[0].charge_exchange_rate
        message = `Refund Type: Cancallation Policy,`
      }
    }
    else if (option === REFUND_OPTION.APPLY_CANCELLATION_POLICY_IGNORE_DATE){  //processing fee
      _.each(charges, (charge) => {
        if (charge.charge_status_id === 2 && charge.charge_type_id !== 5 && charge.charge_type_id !== 6) {
          totalRefund += charge.charge_amount
        }
      })
      totalRefund -= 5 * charges[0].charge_exchange_rate
      message = `Processing Fee: It will charge 5 USD and refund remaining amount irrespective of cancalltion policy and dates`;
    }
    else if (option === REFUND_OPTION.FULL_CHARGE) {
      totalRefund = 0
      message =  `Refund Type: Full-Charge/No-Refund`
    } else if (option === REFUND_OPTION.REMOVE_PAX) {
      _.each(charges, (charge) => {
        if (charge.charge_status_id === 5) {
          totalRefund += charge.charge_amount
        } else if (charge.charge_status_id === 8) {
          totalRefund -= charge.charge_amount
        }
      })
      message =  `Refund Type: removal of pax, partial refund`
    } else if (option === REFUND_OPTION.CUSTOM) {
      _.each(charges, (charge) => {
        if (charge.charge_status_id === 2 && charge.charge_type_id !== 5 && charge.charge_type_id !== 6) {
          totalRefund += charge.charge_amount
        }
      })
      totalRefund -= cancellationCost
      message =  `Refund Type: Custom Refund`
    }
    return Promise.resolve({amount :formatCurrency(charges[0].charge_currency_code, totalRefund, true), message:message })
  }

  // includes 5 or 8 (pending refund/settle) -> booking_status_id 2
  // inlcudes 3 or 7 (pending remove/create) -> booking_status_id 1
  // booking.amend_details = changes to booking
  Charge.amendToSupplierConfirm = async (booking_id, isSendCustomerEmail = true, isSendSupplierEmail = true, req) => {
    let tx
    let transaction
    try {
      const userId = getSafe(() => req.accessToken.userId)
      await Charge.app.models.Users.onlyAdminValidation(userId)

      const booking = await Charge.app.models.Booking.findById(booking_id)
      if (!booking) return Promise.reject(newLoopbackError(FORBIDDEN, 'BOOKING_IS_NOT_FOUND'))
      if (booking.booking_status_id != 3) return Promise.reject(newLoopbackError(FORBIDDEN, 'BOOKING_IS_NOT_AMEND_TO_SUPPLIER'))
      const charges = await Charge.find({ where: { booking_id } })
      if (!charges) return Promise.reject(newLoopbackError(FORBIDDEN, 'CHARGE_IS_NOT_FOUND'))
      const chargeStatuses = charges.map(charge => charge.charge_status_id)

      let totalChange = 0
      const inputDetailsChange = {
        adult_pax: 0,
        child_pax: 0,
        infant_pax: 0,
      }
      let oldStatus = null
      if (chargeStatuses.includes(5) || chargeStatuses.includes(8)) {
        oldStatus = 2
        // Call Refund API first if theres any refund
        if (chargeStatuses.includes(5)) {
          await Charge.app.models.Payments.refund(booking_id, REFUND_OPTION.REMOVE_PAX, isSendCustomerEmail, isSendSupplierEmail, req)
        }
        // TODO: Create payment for additional charge
        if (chargeStatuses.includes(8)) {
          // Call create payment if postive value
          // Call refund for negative value
          await Charge.app.models.Payments.refund(booking_id, REFUND_OPTION.REMOVE_PAX, isSendCustomerEmail, isSendSupplierEmail, req)
        }

        // Create transaction after Refund to prevent tx timeout
        tx = await Charge.beginTransaction({
          isolationLevel: Charge.Transaction.READ_COMMITED,
          timeout: 10000
        })
        transaction = { transaction: tx }
        await Promise.all(charges.map((charge) => {
          if (charge.charge_status_id === 5) {
            if (charge.charge_type_id === 1) {
              inputDetailsChange[`${charge.pax_type}_pax`]--
            }
            totalChange -= Number(charge.charge_amount)
            return charge.updateAttributes({ charge_status_id: 6 }, transaction)
          } else if (charge.charge_status_id === 8) {
            if (charge.charge_type_id === 1) {
              inputDetailsChange[`${charge.pax_type}_pax`]++
            }
            totalChange += charge.charge_amount
            return charge.updateAttributes({ charge_status_id: 2 }, transaction)
          } else {
            return Promise.resolve()
          }
        }))
      } else if (chargeStatuses.includes(3) || chargeStatuses.includes(7)) {
        oldStatus = 1
        // No Payment calls
        tx = await Charge.beginTransaction({
          isolationLevel: Charge.Transaction.READ_COMMITED,
          timeout: 10000
        })
        transaction = { transaction: tx }
        await Promise.all(charges.map((charge) => {
          if (charge.charge_status_id === 3) {
            if (charge.charge_type_id === 1) {
              inputDetailsChange[`${charge.pax_type}_pax`]--
            }
            totalChange -= Number(charge.charge_amount)
            return charge.updateAttributes({ charge_status_id: 4 }, transaction)
          } else if (charge.charge_status_id === 7) {
            if (charge.charge_type_id === 1) {
              inputDetailsChange[`${charge.pax_type}_pax`]++
            }
            totalChange += charge.charge_amount
            return charge.updateAttributes({ charge_status_id: 1 }, transaction)
          } else {
            return Promise.resolve()
          }
        }))
      }

      // Cases:
      // - Only booking update
      // - Booking and charge
      // - Only charge
      // - No change
      let updateData
      const newTotal = formatCurrency(booking.booking_currency_code, booking.total + totalChange, true)
      const newInputDetails = {
        adult_pax: Number(booking.input_details.adult_pax) + inputDetailsChange.adult_pax,
        child_pax: Number(booking.input_details.child_pax) + inputDetailsChange.child_pax,
        infant_pax: Number(booking.input_details.infant_pax) + inputDetailsChange.infant_pax,
      }
      if (booking.amend_details && !oldStatus) {
        tx = await Charge.beginTransaction({
          isolationLevel: Charge.Transaction.READ_COMMITED,
          timeout: 10000
        })
        transaction = { transaction: tx }
        updateData = {
          ...booking.amend_details,
          amend_details: {}
        }
      } else if (booking.amend_details && oldStatus) {
        updateData = {
          ...booking.amend_details,
          amend_details: {},
          total: newTotal,
          input_details: newInputDetails,
        }
      } else if (oldStatus) {
        updateData = {
          booking_status_id: oldStatus,
          total: newTotal,
          input_details: newInputDetails,
        }
      } else {
        return Promise.reject(newLoopbackError(FORBIDDEN, 'NO_CHANGE',
        'No changes in booking or charge. Booking/Charge in wrong state.'))
      }

      await booking.updateAttributes(updateData, transaction)

      // Create activity log
      if (!updateData.booking_status_id) {
        logger.warn('[amendToSupplierConfirm] Update data doesn\'t have booking_status_id')
      } else {
        const bookingStatus = await Charge.app.models.BookingStatus.findById(parseInt(updateData.booking_status_id, 10))
        const statusName = bookingStatus ? bookingStatus.status_name : updateData.booking_status_id;
        await Charge.app.models.Activity.create({
          model_name: 'Booking',
          action_taken: `Confirm Amend back to {${statusName}}`,
          action_result: 'Success',
          user_id: userId,
          model_id: booking.id,
        }, transaction)
      }

      const txErr = await tx.commit()
      if (txErr) {
        logger.error('[amendToSupplierConfirm] TX Commit error:', txErr)
        return Promise.reject(newLoopbackError(SERVER_ERROR, 'TX_COMMIT_ERROR'))
      }
      return Promise.resolve({ status: 200, message: 'Confirm pending charges success', details: { booking_id } })
    } catch (error) {
      logger.error('[amendToSupplierConfirm]: Booking_id', booking_id)
      logger.error('[amendToSupplierConfirm]', error)
      if (tx) {
        await tx.rollback()
      }
      return Promise.reject(error)
    }
  }

  Charge.remoteMethod('amendToSupplierConfirm', {
    accepts: [
      { arg: 'booking_id', type: 'string', required: true },
      { arg: 'isSendCustomerEmail', type: 'boolean', description: 'default is true' },
      { arg: 'isSendSupplierEmail', type: 'boolean', description: 'default is true' },
      { arg: 'req', type: 'object', http: { source: 'req' } },
    ],
    returns: { arg: 'response', type: 'object', root: true },
    http: { path: '/amendToSupplierConfirm', verb: 'post' }
  })

  // Delete all 'Pending Creation'(7), Turn 'Pending Removal'(3) -> 1, 'Pending Refund'(5) -> 2
  // Contains 'Pending Removal'(3) = Booking status 1
  // Contains 'Pending Refund'(5) = Booking status 2
  Charge.amendToSupplierCancel = async (booking_id, req) => {
    let tx
    try {
      const userId = getSafe(() => req.accessToken.userId)
      await Charge.app.models.Users.onlyAdminValidation(userId)

      const booking = await Charge.app.models.Booking.findById(booking_id)
      if (!booking) return Promise.reject(newLoopbackError(FORBIDDEN, 'BOOKING_IS_NOT_FOUND'))
      if (booking.booking_status_id != 3) return Promise.reject(newLoopbackError(FORBIDDEN, 'BOOKING_IS_NOT_AMEND_TO_SUPPLIER'))
      const charges = await Charge.find({ where: { booking_id } })
      if (!charges) return Promise.reject(newLoopbackError(FORBIDDEN, 'CHARGE_IS_NOT_FOUND'))

      tx = await Charge.beginTransaction({
        isolationLevel: Charge.Transaction.READ_COMMITED,
        timeout: 10000
      })
      const transaction = { transaction: tx }

      let newBookingStatus = 0
      await Promise.all(charges.map((charge) => {
        if (charge.charge_status_id === 7) {
          newBookingStatus = 1
          return charge.destroy(transaction)
        } else if (charge.charge_status_id === 3) {
          newBookingStatus = 1
          return charge.updateAttributes({ charge_status_id: 1 }, transaction)
        } else if (charge.charge_status_id === 5) {
          newBookingStatus = 2
          return charge.updateAttributes({ charge_status_id: 2 }, transaction)
        } else if (charge.charge_status_id === 8) {
          newBookingStatus = 2
          return charge.destroy(transaction)
        } else {
          return Promise.resolve()
        }
      }))

      if (booking.amend_details && newBookingStatus
        && booking.amend_details.booking_status_id != newBookingStatus) {
        return Promise.reject(newLoopbackError(SERVER_ERROR, 'DIFFERENT_STATUS', 'Booking and charge cannot have different status'))
      } else if (booking.amend_details) {
        newBookingStatus = booking.amend_details.booking_status_id
      }

      if (!newBookingStatus) {
        await tx.rollback()
        return Promise.reject(newLoopbackError(SERVER_ERROR, 'NO_NEW_BOOKING_STATUS', 'No charge required updating'))
      }
      await booking.updateAttributes({ booking_status_id: newBookingStatus, amend_details: null }, transaction)

    // Create activity log
      const bookingStatus = await Charge.app.models.BookingStatus.findById(parseInt(newBookingStatus, 10))
      const statusName = bookingStatus ? bookingStatus.status_name : newBookingStatus;
      await Charge.app.models.Activity.create({
        model_name: 'Booking',
        action_taken: `Reject Amend back to {${statusName}}`,
        action_result: 'Success',
        user_id: userId,
        model_id: booking.id,
      }, transaction)

      const txErr = await tx.commit()
      if (txErr) {
        logger.error('[amendToSupplierCancel] TX Commit error:', txErr)
        return Promise.reject(newLoopbackError(SERVER_ERROR, 'TX_COMMIT_ERROR'))
      }
      return Promise.resolve({ status: 200, message: 'Cancel pending charges success', details: { booking_id } })
    } catch (error) {
      logger.error('[amendToSupplierCancel]: Booking_id', booking_id)
      logger.error('[amendToSupplierCancel]', error)
      if (tx) {
        await tx.rollback()
      }
      return Promise.reject(error)
    }
  }

  Charge.remoteMethod('amendToSupplierCancel', {
    accepts: [
      { arg: 'booking_id', type: 'string', required: true },
      { arg: 'req', type: 'object', http: { source: 'req' } },
    ],
    returns: { arg: 'response', type: 'object', root: true },
    http: { path: '/amendToSupplierCancel', verb: 'post' }
  })

  Charge.migrationChargeFromPayment = async () => {
    const bookings = await Charge.app.models.Booking.find({
      where: {
        booking_status_id: { inq: [1, 2, 5, 7] },
      },
    })
    let countCreated = 0
    let countSettled = 0
    let countRemoved = 0
    let countError = 0
    const newCharges = await Promise.all(bookings.map((booking) => {
      if (booking.booking_status_id == 1) {
        countCreated++
        return Charge.createChargeFromBooking(booking.id, true).catch(() => countCreated--)
      } else if (booking.booking_status_id == 2 || booking.booking_status_id == 5) {
        countSettled++
        return Charge.createChargeFromBooking(booking.id, true).catch(() => countSettled--)
      } else if (booking.booking_status_id == 7) {
        countRemoved++
        return Charge.createChargeFromBooking(booking.id, true).catch(() => countRemoved--)
      } else {
        return countError++
      }
    }))

    const totalNewCharges = newCharges.reduce((acc, val) => acc + (val.data ? val.data.length : 0), 0)

    return { countCreated, countSettled, countRemoved, countError, totalNewCharges }
  }

  Charge.remoteMethod('migrationChargeFromPayment', {
    returns: { arg: 'response', type: 'object', root: true },
    http: { path: '/migrationChargeFromPayment', verb: 'get' }
  })
}
