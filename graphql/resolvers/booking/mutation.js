const Json2csvParser = require('json2csv').Parser;

const logger = require('../../logger');
const ErrorResponse = require('../../shared/error');
const { getSafe } = require('../../../common/utility');
const loopbackRef = require('../../reference');
const axios = require('../../axios');

const BOOKING_STATUS_COUNT_API = '/Bookings/count';
const BOOKING_API = '/Bookings';
const USERS_API = '/Users';
const PAYMENTS_API = '/Payments';
const PAYMENT_REFUND_API = '/Payments/refund';
const EMAIL_PREVIEW = '/Bookings/emailPreview';
const SEND_TRANSACTIONAL_EMAIL = '/Bookings/sendTransactionalEmail';
const SEND_MANUAL_MAIL = '/Bookings/sendEmail';
const CHARGES_API = '/Charges';

module.exports = {
  async downloadBookingsAffiliate(root, args, context) {
    const {
      input: { limit, offset, order, bookingStatusId, searchTerm, start, end },
    } = args;
    const {
      accessToken: { userId },
    } = context;
    logger.debug('downloadBookingsAffiliate', {
      limit,
      offset,
      order,
      bookingStatusId,
      searchTerm,
      start,
      end,
    });

    if (!userId) throw new Error('Unauthorized');

    const { bookings } = await loopbackRef.app.models.Booking.search({
      user_id: userId,
      booking_method_id: 3,
      limit: null, // get all
      offset: 0, // get all
      order,
      bookingStatusId,
      searchTerm,
      start,
      end,
    });

    const fields = [
      {
        label: 'Booking Date',
        value: 'created_at',
      },
      {
        label: 'BID',
        value: 'booking_no',
      },
      {
        label: 'First Name',
        value: 'billing_first_name',
      },
      {
        label: 'Last Name',
        value: 'billing_last_name',
      },
      {
        label: 'Product Name',
        value: 'tour.name',
      },
      {
        label: 'Departed Date',
        value: 'trip_starts',
      },
      {
        label: 'Status',
        value: 'booking_status.front_name',
      },
    ];

    const parser = new Json2csvParser({
      fields,
    });
    const csv = parser.parse(bookings);

    return {
      data: csv,
    };
  },
  cancelBookingRefund(root, params, { user }) {
    return axios
      .post(`${PAYMENT_REFUND_API}`, params, {
        headers: {
          Authorization: user.id || '',
        },
      })
      .then(res => res.data)
      .catch(err => {
        // For admin authen error, return directly to let CMS logout the user
        if (err.message === 'Unauthorized') return adminError;
        return new ErrorResponse(err.response.data.error);
      });
  },
  bookingStatusCount(root, params, context) {
    const data = params.booking_status_id
      ? {
          params: {
            where: params,
          },
        }
      : {};
    return axios
      .get(BOOKING_STATUS_COUNT_API, data, {
        headers: {
          Authorization: context.user.id,
        },
      })
      .then(res => res.data)
      .catch(err => err);
  },
  async downloadBookingsSupplier(root, args) {
    const {
      input: { limit, offset, order, bookingStatusId, searchTerm, start, end, supplier_id },
    } = args;
    logger.debug('downloadBookingsSupplier', {
      limit,
      offset,
      order,
      bookingStatusId,
      searchTerm,
      start,
      end,
      supplier_id,
    });

    if (!supplier_id) throw new Error('Unauthorized');

    const { bookings } = await loopbackRef.app.models.Booking.search({
      supplier_id,
      limit: null, // get all
      offset: 0, // get all
      order,
      bookingStatusId,
      searchTerm,
      start,
      end,
    });

    const fields = [
      {
        label: 'Booking Date',
        value: 'created_at',
      },
      {
        label: 'BID',
        value: 'booking_no',
      },
      {
        label: 'First Name',
        value: 'billing_first_name',
      },
      {
        label: 'Last Name',
        value: 'billing_last_name',
      },
      {
        label: 'Product Name',
        value: 'tour.name',
      },
      {
        label: 'Departed Date',
        value: 'trip_starts',
      },
      {
        label: 'Status',
        value: 'booking_status.front_name',
      },
    ];

    const parser = new Json2csvParser({
      fields,
    });
    const csv = parser.parse(bookings);

    return {
      data: csv,
    };
  },
  bookingListByStatusId(root, params, context) {
    const accessToken = context.user.id || '';
    const filter = {
      order: params.order,
      limit: params.limit,
      offset: params.offset,
    };
    if (params.booking_status_id) {
      const input = {};
      input.booking_status_id = params.booking_status_id;
      if (params.tour_id) {
        input.tour_id = params.tour_id;
      }
      filter.where = { ...input };
    }
    return axios
      .get(`${BOOKING_API}?filter=${encodeURIComponent(JSON.stringify(filter))}`, {
        headers: {
          Authorization: accessToken,
        },
      })
      .then(res => res.data)
      .catch(err => err);
  },
  updateBooking(root, { id, update }) {
    return axios
      .patch(`${BOOKING_API}/${id}`, {
        ...update,
      })
      .then(res => res.data)
      .catch(err => err);
  },
  updateAffiliateBooking(root, args, context) {
    const { id, params } = args;
    const {
      accessToken: { userId },
    } = context;
    if (!userId) throw new Error('Unauthorized');
    return axios
      .post(`${BOOKING_API}/updateOptionals`, { id, params })
      .then(res => res.data)
      .catch(error => {
        if (getSafe(() => error.response.data.error)) {
          error.message = error.response.data.error.message;
        }
        return error;
      });
  },
  async updateSupplierBooking(root, { input }) {
    if (!input.supplier_id) throw new Error('Unauthorized');
    if (input.booking_status_id == 8 || input.booking_status_id == 9) {
      try {
        const booking = await loopbackRef.app.models.Booking.findById(input.id);
        if (booking) {
          if (booking.booking_status_id != 1) {
            throw new Error('Booking Status Update Not Allowed');
          }
          const updateData = {
            booking_status_id: input.booking_status_id,
          };
          if (input.booking_status_id == 8 && input.supplier_memo) {
            updateData.supplier_memo = input.supplier_memo;
          }
          const updated = await booking.updateAttributes(updateData);
          if (updated) {
            return updated;
          }
          throw new Error('Update failed, Please Try Again Later');
        } else {
          throw new Error('Update failed, Please Try Again Later');
        }
      } catch (e) {
        console.log('erro Updating Booking Status', e);
        throw new Error('Update failed, Please Try Again Later');
      }
    } else {
      throw new Error('Booking Status Update Not Allowed');
    }
  },
  amendBooking(root, { id, update, isSendCustomerEmail, isSendSupplierEmail }, context) {
    return axios
      .patch(`${BOOKING_API}/${id}/amend?access_token=${context.user.id}`, {
        data: update,
        isSendCustomerEmail,
        isSendSupplierEmail,
      })
      .then(res => res.data)
      .catch(err => err);
  },
  bookingUpdate(root, { input }) {
    const bookingInput = input;
    const booking_id = bookingInput.id;
    delete bookingInput.id;
    return axios
      .patch(`${BOOKING_API}/${booking_id}`, {
        ...input,
      })
      .then(res => res.data)
      .catch(err => err);
  },
  saveUserDetails(root, { input }, context) {
    return axios
      .patch(
        `${USERS_API}/${user.id}?access_token=${context.user.id}`,
        {
          ...input,
        },
        {
          headers: {
            Authorization: context.user.id,
          },
        },
      )
      .then(res => res.data)
      .catch(err => err);
  },
  getEmailTemplate(root, params, context) {
    return axios
      .get(
        `${EMAIL_PREVIEW}?lang_id=${params.lang_id}&booking_id=${
          params.booking_id_id
        }&email_template_type=${params.email_template_type}`,
        {
          headers: {
            Authorization: context.user.id,
          },
        },
      )
      .then(res => res.data)
      .catch(errData => errData);
  },
  getEmailTemplateAffiliate(root, params, context) {
    const {
      accessToken: { id },
    } = context;
    console.log({ id });
    if (!id) throw new Error('Unauthorized');

    return axios
      .get(
        `${EMAIL_PREVIEW}?lang_id=${params.lang_id}&booking_id=${
          params.booking_id_id
        }&email_template_type=${params.email_template_type}`,
        {
          headers: {
            Authorization: id,
          },
        },
      )
      .then(res => res.data)
      .catch(errData => errData);
  },
  getBookingStatus(root, params, context) {
    let path = '';
    if (parseInt(params.booking_status_id, 10) === 2) {
      // approve
      path = `${PAYMENTS_API}/approve`;
    } else if (parseInt(params.booking_status_id, 10) === 7) {
      // cancel
      path = `${PAYMENTS_API}/cancel`;
    } else if (parseInt(params.booking_status_id, 10) === 3 && params.isApprove) {
      // Approve charge changes
      path = `${CHARGES_API}/amendToSupplierConfirm`;
    } else if (parseInt(params.booking_status_id, 10) === 3 && !params.isApprove) {
      // Reject charge changes
      path = `${CHARGES_API}/amendToSupplierCancel`;
    }

    if (path) {
      return axios
        .post(
          path,
          {
            booking_id: params.booking_id,
            isSendCustomerEmail: params.isSendCustomerEmail,
            isSendSupplierEmail: params.isSendSupplierEmail,
          },
          {
            headers: {
              Authorization: context.user.id || '',
            },
          },
        )
        .then(res => res.data)
        .catch(err => err);
    }

    return {
      id: params.booking_id,
      status: 'fail',
      message: 'Not matched status',
    };
  },
  sendTransEmail(root, params, { user, accessToken }) {
    const auth = accessToken.id || user.id;
    return axios
      .post(`${SEND_TRANSACTIONAL_EMAIL}?access_token=${auth}`, params, {
        Authorization: auth || '',
      })
      .then(res => res.data)
      .catch(err => err);
  },
  sendManualMail(root, params, { user, accessToken }) {
    const auth = accessToken.id || user.id;
    return axios
      .post(`${SEND_MANUAL_MAIL}`, params, {
        headers: {
          Authorization: auth || '',
        },
      })
      .then(res => res.data)
      .catch(err => err);
  },
  convertBase64ToAscii(root, params) {
    return Buffer.from(params.text, 'base64').toString();
  },
  convertAsciiToBase64(root, params) {
    return Buffer.from(params.text).toString('base64');
  },
  aabBooking(root, args, context) {
    const { input, affiliateTemplate, customerTemplate, supplierTemplate, paymentType } = args;
    const { user, accessToken } = context;
    const auth = accessToken.id || user.id;
    return axios({
      method: 'POST',
      url: `${BOOKING_API}/aab`,
      data: {
        data: input,
        affiliateTemplate: affiliateTemplate || '',
        customerTemplate: customerTemplate || '',
        supplierTemplate: supplierTemplate || '',
        creatorUserId: user.userId || '',
        paymentType,
      },
      headers: {
        Authorization: auth,
      },
    })
      .then(res => res.data)
      .catch(error => {
        if (getSafe(() => error.response.data.error)) {
          error.message = error.response.data.error.message;
        }
        return error;
      });
  },
};
