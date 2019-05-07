const axios = require('axios');
const { pick, isArray } = require('underscore');

const { THE_ASIA_API } = require('../../config');
const ErrorResponse = require('../../shared/error');
const logger = require('../../logger');
const loopbackRef = require('../../reference');

const query = require('./query');


module.exports = {
  async removeBookingsFromPayout(root,{ input },context) {
    logger.debug('removal', input);
    if(input.payout_ids && input.payout_ids.length){
      const result = await loopbackRef.app.models.Payouts.removeBookings(input.payout_ids)
      if(result.status){
        return {
          status :true,
          message: result.message,
          reminings: result.reminings || [],
        }
      }
      else {
        return {
          status :false,
          message: result.message || "Failed to remove, Please try again Later",
          reminings: result.reminings || [],
        }
      }
    }
    else{
      return {
        status :false,
        message:  "Input Details are Missing",
        reminings:  [],
      }
    }
  },
  async addAttachment(root,{ input },context) {
    logger.debug('update', input);
    if(input.id && input.attachments){
      const result = await loopbackRef.app.models.Payouts.addAttachment(input.id,input.attachments)
      if(result.status){
        return {
          id:result.payout_id,
          status :true,
          message: result.message,
        }
      }
      else {
        return {
          id:result.payout_id,
          status :false,
          message: result.message || "Failed to Update, Please try again Later",
        }
      }
    }
    else{
      return {
        id:result.payout_id,
        status :false,
        message:  "Input Details are Missing",
      }
    }
  },
  async updatePayoutStatus(root,{ input },context) {
    logger.debug('update', input);
    if(input.id && input.status){
      const result = await loopbackRef.app.models.Payouts.updateStatus(input.id,input.status)
      if(result.status){
        return {
          id:result.id,
          status :true,
          message: result.message,
        }
      }
      else {
        return {
          id:result.id,
          status :false,
          message: result.message || "Failed to Update, Please try again Later",
        }
      }
    }
    else{
      return {
        id:input.id,
        status :false,
        message:  "Input Details are Missing",
      }
    }
  }
};
