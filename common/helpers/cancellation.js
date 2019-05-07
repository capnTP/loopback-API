const moment = require('moment')

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


  /**
   * calculate refund amount
   * @param {*} booking Booking Object
   */
  /*
  getRefundAmount(booking, isIgnoteDate = false) {
    if (!booking.cancellation_policy_id || booking.cancellation_policy_id == 0) booking.cancellation_policy_id = 1
    const policyObject = cancellationPolicyObjectList[booking.cancellation_policy_id || 1]

    const total = booking.total
    const fee = policyObject.transactionFee * booking.exchange_rate
    const currency_code = booking.booking_currency_code
    const refund_percentage = policyObject.refundPercentage

    const responseObject = { refund_amount: 0, currency_code, refund_percentage, fee }

    if (booking.booking_status_id != 2) return { ...responseObject, message: 'UNABLE-REFUND - booking is not complete' }
    if (parseInt(booking.cancellation_policy_id, 10) > 3 || parseInt(booking.cancellation_policy_id, 10) < 1) return { ...responseObject, message: 'UNABLE-REFUND - out of cancellation policy' }

    const startDateObj = {
      year: moment(booking.trip_starts).year(),
      month: moment(booking.trip_starts).month() + 1,
      date: moment(booking.trip_starts).date(),
    }

    const startDate = moment(`${startDateObj.year}-${startDateObj.month}-${startDateObj.date}-+07:00`, 'YYYY-MM-DD-Z')
    const avalibleDate = startDate.clone().subtract(policyObject.period, 'day')
    const now = moment()

    if (!isIgnoteDate && now.unix() > avalibleDate.unix()) return { ...responseObject, message: 'UNABLE-REFUND - not in refund reriod' }

    const refund_amount = (total * (policyObject.refundPercentage / 100.0)) - fee
    return { ...responseObject, refund_amount }
  },
  */

module.exports = {
  getRefundAmount(payment, booking, isIgnoteDate = false, refund_percentage = 100, transactionFee = 5) {
    let policyObject = cancellationPolicyObjectList[booking.cancellation_policy_id || 1]
    if (!policyObject) policyObject = cancellationPolicyObjectList[4]

    const total = payment.total_charge
    const exchange_rate = booking.exchange_rate
    const currency_code = payment.currency
    const fee = transactionFee * exchange_rate

    const responseObject = { refund_amount: (total * (refund_percentage / 100.0)) - fee, currency_code, refund_percentage, fee }

    if (!isIgnoteDate) {
      const startDateObj = {
        year: moment(booking.trip_starts).year(),
        month: moment(booking.trip_starts).month() + 1,
        date: moment(booking.trip_starts).date(),
      }
      const startDate = moment(`${startDateObj.year}-${startDateObj.month}-${startDateObj.date}-+07:00`, 'YYYY-MM-DD-Z')
      const avalibleDate = startDate.clone().subtract(policyObject.period, 'day')
      const now = moment()
      if (now.unix() > avalibleDate.unix()) responseObject.refund_amount = 0
    }

    if (responseObject.refund_amount < 0) responseObject.refund_amount = 0
    if (refund_percentage === 0) responseObject.fee = total

    return responseObject
  },
}
