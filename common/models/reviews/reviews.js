const _ = require('lodash');
const sgMail = require('@sendgrid/mail');
const service = require('../../../server/config/env-service')

sgMail.setApiKey(service.sendgrid);

const {
  constants: { isProduction },
} = require('../../utility');
const EmailHelper = require('../../helpers/email');

const WEBSITE_URL = isProduction ? 'https://www.theasia.com' : 'https://www.theasiadev.com';
const { getEmailObject, REVIEW_EMAIL_TYPE } = require('../../helpers/review');
const {
  newLoopbackError,
  HTTPStatusCode: { FORBIDDEN },
} = require('../../utility');

module.exports = function(Reviews) {
  // hooks (in combination of before & after)
  // validation review creation and update
  Reviews.observe('before save', async ctx => {
    const newData = ctx.instance || ctx.data;
    console.log('reviews', ctx.isNewInstance, !newData.tour_id);
    if (ctx.isNewInstance) {
      if (
        newData.user_id == 0 &&
        newData.booking_id != 0 &&
        (newData.user_id != 0 && newData.booking_id == 0)
      ) {
        return Promise.reject(
          newLoopbackError(FORBIDDEN, 'VALIDATION_ERROR', 'Booking and user_id incorrection', {
            booking_id: newData.booking_id,
            user_id: newData.user_id,
            allowed: 'booking id & userID must be 0 together or otherwise',
          }),
        );
      }
      if (
        !newData.tour_id ||
        !newData.language_id ||
        !newData.group_size ||
        !newData.sub_product_id
      ) {
        return Promise.reject(
          newLoopbackError(FORBIDDEN, 'VALIDATION_ERROR', "Can't be 0", {
            sub_product_id: newData.sub_product_id,
            language_id: newData.language_id,
            tour_id: newData.tour_id,
            group_size: newData.group_size,
            allowed: "Any of these value can't be zero while adding a review",
          }),
        );
      }
      if (newData.booking_id != 0) {
        const reviews = await Reviews.find({
          where: {
            booking_id: newData.booking_id,
          },
        });
        console.log(reviews, ' review for booking');
        if (reviews.length && reviews.length) {
          return Promise.reject(
            newLoopbackError(
              FORBIDDEN,
              'VALIDATION_ERROR',
              'Duplicate user review for the booking',
              {
                booking_id: newData.booking_id,
                allowed: 'review already exist for this booking',
                review: reviews[0],
              },
            ),
          );
        }
        return Promise.resolve();
      }
      return Promise.resolve();
    }
    if (
      ctx.currentInstance.user_id == 0 &&
      ctx.currentInstance.booking_id == 0 &&
      (!newData || !newData.status)
    )
      return Promise.resolve();

    try {
      console.log(ctx.currentInstance, 'current status');
      if (ctx.currentInstance.user_id != 0 && ctx.currentInstance.booking_id != 0) {
        if (ctx.currentInstance.status == 0) {
          // only allow approval or rejection if satus is 0
          return Promise.resolve();
        }
        return Promise.reject(
          newLoopbackError(FORBIDDEN, 'VALIDATION_ERROR', 'Review update validation error', {
            status: newData,
            currenct_status: ctx.currentInstance.status,
            allowed: 'Only status chnage allowed for user side reviews',
          }),
        );
      }
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(
        newLoopbackError(FORBIDDEN, 'VALIDATION_ERROR', 'Tours.map validation error', error),
      );
    }
  });

  Reviews.observe('after save', async ctx => {
    const response = {};
    if (!ctx.isNewInstance) {
      try {
        const newData = ctx.instance || ctx.data;
        if (newData.user_id != 0 && newData.booking_id != 0 && newData.status == 1) {
          await Reviews.sendReviewApprovedEmail(newData.id);
          console.log(111);
          Promise.resolve();
        } else if (newData.user_id != 0 && newData.booking_id != 0 && newData.status == 2) {
          await Reviews.sendReviewRejectionEmail(newData.id);
          console.log(111);
          Promise.resolve();
        } else {
          Promise.resolve();
        }
      } catch (e) {
        return Promise.reject(e);
      }
    } else {
      return Promise.resolve();
    }
  });

  // send review Cron
  const sendReviewEmail = async (bookings, reminder = false) => {
    const Users = Reviews.app.models.Users;
    const userIds = _.map(bookings, 'user_id');
    const users = await Users.find({
      where: {
        inq: userIds,
      },
    });
    const eObjects = [];
    let increment = 0;
    try {
      _.each(bookings, booking => {
        const url = `${WEBSITE_URL}/account/reviews?type=addreview&bookingId=${booking.id}`;
        const lang_id = _.findWhere(users, { id: parseInt(booking.user_id, 10) })
          ? _.findWhere(users, { id: parseInt(booking.user_id, 10) }).language_id
          : 1;
        if (reminder) {
          eObjects.push(
            getEmailObject(booking.user_id, REVIEW_EMAIL_TYPE.REVIEW_REMINDER, lang_id, 0, url),
          );
          increment++;
        } else {
          eObjects.push(
            getEmailObject(
              booking.user_id,
              REVIEW_EMAIL_TYPE.REVIEW_REQUEST,
              lang_id,
              0,
              url,
              null,
              booking.toObject(),
            ),
          );
          increment++;
        }
      });
      if (bookings.length == increment) {
        const emailObjects = await Promise.all(eObjects);
        const gmailObjects = [];
        increment = 0;
        _.each(emailObjects, obj => {
          gmailObjects.push(sgMail.send(obj));
          increment++;
        });
        if (emailObjects.length == increment) {
          const results = await Promise.all(gmailObjects);
          if (results && results.length == emailObjects.length) {
            increment = 0;
            const bookingUpdates = [];
            _.each(bookings, booking => {
              bookingUpdates.push(
                booking.updateAttributes({
                  review_email: 1,
                }),
              );
              increment++;
            });
            if (bookingUpdates.length == increment) {
              const updates = await Promise.all(bookingUpdates);
              if (updates && updates.length) {
                return {
                  status: true,
                  message: `${updates.length} Review email sent`,
                  count: updates.length,
                };
              }
              return {
                status: false,
                message: 'No Review email sent',
              };
            }
          }
        }
      }
    } catch (e) {
      console.log('error overall', e);
      return {
        status: false,
        message: e.message,
      };
    }
  };

  // Right now set limited to send to 10 users
  Reviews.sendReviewEmailCron = async cb => {
    const Booking = Reviews.app.models.Booking;
    const filter = {
      include: [
        {
          relation: 'tour',
          scope: {
            include: [
              {
                relation: 'tour_medias',
                scope: {
                  include: 'details',
                },
              },
            ],
          },
        },
      ],
      where: {
        booking_status_id: 5,
        review_email: 0,
      },
      limit: 10,
    };
    try {
      const bookings = await Booking.find(filter);
      if (bookings && bookings.length) {
        const response = await sendReviewEmail(bookings);
        return cb(null, response);
      }
      return cb(null, {
        status: false,
        message: 'No new Departed booking found for review email',
      });
    } catch (err) {
      return cb(err);
    }
  };

  // Right now set limited to send to 10 users
  Reviews.sendReviewEmailReminderCron = async cb => {
    const Booking = Reviews.app.models.Booking;
    const filter = {
      where: {
        booking_status_id: 5,
        review_email: 0,
      },
      limit: 10,
    };
    try {
      const bookings = await Booking.find(filter);
      if (bookings && bookings.length) {
        const response = await sendReviewEmail(bookings, true);
        return cb(null, response);
      }
      return cb(null, {
        status: false,
        message: 'No new Departed booking found for review email',
      });
    } catch (err) {
      return cb(err);
    }
  };

  Reviews.sendReviewApprovedEmail = async review_id => {
    const review = await Reviews.findById(review_id);
    if (!review) {
      return {
        status: false,
        message: 'No review',
      };
    }
    if (!review.user_id) {
      return {
        status: true,
        message: 'No need to send email, affiliate review',
      };
    }
    const Booking = Reviews.app.models.Booking;
    const booking = await Booking.findById(review.booking_id);
    const Users = Reviews.app.models.Users;
    const user = await Users.findById(review.user_id);
    if (!user || !user.id) {
      return {
        status: false,
        message: 'No user found',
      };
    }
    const url = `${WEBSITE_URL}/account/reviews?type=reviewAprroved&reviewId=${review_id}`;
    const emailObject = await getEmailObject(
      user.id,
      REVIEW_EMAIL_TYPE.REVIEW_APPROVED,
      user.language_id,
      0,
      url,
      review,
    );
    const result = await sgMail.send(emailObject);
    if (result) {
      const response = await booking.updateAttributes({
        review_email: 2,
      });
      const status = !!response;
      return {
        status: true,
        message: 'Approve email sent',
        email_status_updated: status,
      };
    }
    return {
      status: false,
      message: 'Approve email failed',
    };
  };

  Reviews.sendReviewRejectionEmail = async review_id => {
    const review = await Reviews.findById(review_id);
    if (!review) {
      return {
        status: false,
        message: 'No review',
      };
    }
    if (!review.user_id) {
      return {
        status: true,
        message: 'No need to send email, affiliate review',
      };
    }
    const Booking = Reviews.app.models.Booking;
    const booking = await Booking.findById(review.booking_id);
    const Users = Reviews.app.models.Users;
    const user = await Users.findById(review.user_id);
    if (!user || !user.id) {
      return {
        status: false,
        message: 'No user found',
      };
    }
    const url = `${WEBSITE_URL}/account/reviews?type=reviewReject&reviewId=${review_id}`;
    console.log('Review rejected:', url);
    const emailObject = await getEmailObject(
      user.id,
      REVIEW_EMAIL_TYPE.REVIEW_REJECT,
      user.language_id,
      0,
      url,
      review,
    );
    const result = await sgMail.send(emailObject);
    if (result) {
      const response = await booking.updateAttributes({
        review_email: 3,
      });
      const status = !!response;
      return {
        status: true,
        message: 'Reject email sent',
        email_status_updated: status,
      };
    }
    return {
      status: false,
      message: 'Reject email failed',
    };
  };

  Reviews.remoteMethod('sendReviewEmailCron', {
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/sendReviewEmailCron',
      verb: 'post',
    },
    description: 'Send Review Email Cron',
  });

  Reviews.remoteMethod('sendReviewEmailReminderCron', {
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/sendReviewEmailReminderCron',
      verb: 'post',
    },
    description: 'Send Review Email Cron',
  });

  Reviews.remoteMethod('sendReviewApprovedEmail', {
    accepts: [
      {
        arg: 'user_id',
        type: 'string',
        required: true,
        description: 'User ID',
      },
    ],
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/sendReviewApprovedEmail',
      verb: 'post',
    },
  });

  Reviews.remoteMethod('sendReviewRejectionEmail', {
    accepts: [
      {
        arg: 'user_id',
        type: 'string',
        required: true,
        description: 'User ID',
      },
    ],
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/sendReviewRejectionEmail',
      verb: 'post',
    },
  });

  Reviews.submitReview = async (review_id, data, cb) => {
    const tx = await Reviews.beginTransaction({
      isolationLevel: Reviews.Transaction.READ_COMMITTED,
      timeout: 10000,
    });
    const transaction = {
      transaction: tx,
    };
    const review = await Reviews.create(data, transaction);
    if (review && review.id) {
      const deleted = await Reviews.destroyById(review_id, transaction);
      if (deleted) {
        const txnErr = await tx.commit();
        if (txnErr) {
          return {
            status: false,
            message: txnErr.message,
          };
        }
        return {
          status: true,
          message: '',
          review,
        };
      }
      const txnErr = await tx.rollback();
      return {
        status: false,
        message: 'Failed to Edit Review',
      };
    }
    return {
      status: false,
      message: review.message,
      error: 'Validation error',
    };
  };

  Reviews.remoteMethod('reviewEdit', {
    accepts: [
      {
        arg: 'review_id',
        type: 'number',
        required: true,
        description: 'review Id',
      },
      {
        arg: 'data',
        type: 'object',
        required: true,
        description: 'review Object',
      },
    ],
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/submitReview',
      verb: 'post',
    },
  });

  Reviews.reviewApprove = async review_id => {
    const review = await Reviews.findById(review_id);
    if (review) {
      const result = await review.updateAttributes({
        status: 1,
      });
      if (result) {
        const email = await Reviews.sendReviewApprovedEmail(review_id);
        const email_status = !!email;
        return {
          status: true,
          message: 'updated',
          email_sent: email_status,
        };
      }
      return {
        status: false,
        message: 'failed',
      };
    }
    return {
      status: false,
      message: 'review not found',
    };
  };

  Reviews.reviewReject = async review_id => {
    const review = await Reviews.findById(review_id);
    if (review) {
      const result = await review.updateAttributes({
        status: 2,
      });
      if (result) {
        const email = await Reviews.sendReviewRejectionEmail(review_id);
        const email_status = !!email;
        return {
          status: true,
          message: 'updated',
          email_sent: email_status,
        };
      }
      return {
        status: false,
        message: 'failed',
      };
    }
    return {
      status: false,
      message: 'review not found',
    };
  };

  Reviews.updateRating = async () => {
    const reviews = await Reviews.find({
      where: {
        status: 1,
      },
    });
    const ratingObject = {};
    ratingObject.tours = [];
    ratingObject.subTours = [];
    if (reviews && reviews.length) {
      _.each(reviews, review => {
        const tourRatingObj = _.findWhere(ratingObject.tours, {
          tour_id: review.tour_id,
        });
        if (tourRatingObj && tourRatingObj.tour_id) {
          tourRatingObj.rating = parseFloat(tourRatingObj.rating) + parseFloat(review.rating);
          tourRatingObj.count += 1;
          const index = _.findIndex(ratingObject.tours, {
            tour_id: tourRatingObj.tour_id,
          });
          // Replace item at index using native splice
          ratingObject.tours.splice(index, 1, tourRatingObj);
        } else {
          ratingObject.tours.push({
            tour_id: review.tour_id,
            rating: review.rating,
            count: 1,
          });
        }

        const subToursRatingObj = _.findWhere(ratingObject.subTours, {
          sub_product_id: review.sub_product_id,
        });
        if (subToursRatingObj && subToursRatingObj.sub_product_id) {
          subToursRatingObj.rating =
            parseFloat(subToursRatingObj.rating) + parseFloat(review.rating);
          subToursRatingObj.count += 1;
          const index = _.findIndex(ratingObject.subTours, {
            sub_product_id: subToursRatingObj.sub_product_id,
          });
          // Replace item at index using native splice
          ratingObject.subTours.splice(index, 1, subToursRatingObj);
        } else {
          ratingObject.subTours.push({
            sub_product_id: review.sub_product_id,
            rating: review.rating,
            count: 1,
          });
        }
      });
      console.log(ratingObject, 'result');

      ratingObject.tours.forEach(async item => {
        const r = await Reviews.app.models.Tours.findById(item.tour_id);
        if (r) {
          console.log(
            'tour',
            r.id,
            (parseFloat(item.rating) / parseInt(item.count, 10)).toFixed(1),
          );
          await r.updateAttributes({
            rating: (parseFloat(item.rating) / parseInt(item.count, 10)).toFixed(1),
          });
        }
      });

      ratingObject.subTours.forEach(async item => {
        const s = await Reviews.app.models.SubProducts.findById(item.sub_product_id);
        if (s) {
          console.log('sub', (parseFloat(item.rating) / parseInt(item.count, 10)).toFixed(1));
          await s.updateAttributes({
            rating: (parseFloat(item.rating) / parseInt(item.count, 10)).toFixed(1),
          });
        }
      });

      return true;
      // loop throug this obket and update Sub products and Tours
    }
    return true;
  };

  Reviews.remoteMethod('reviewApprove', {
    accepts: [
      {
        arg: 'review_id',
        type: 'string',
        required: true,
        description: 'review Id',
      },
    ],
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/reviewApprove',
      verb: 'post',
    },
  });

  Reviews.remoteMethod('updateRating', {
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/updateRating',
      verb: 'post',
    },
  });

  Reviews.remoteMethod('reviewReject', {
    accepts: [
      {
        arg: 'review_id',
        type: 'string',
        required: true,
        description: 'review Id',
      },
    ],
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/reviewReject',
      verb: 'post',
    },
  });
};
