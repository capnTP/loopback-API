const {
  getSafe,
  newLoopbackError,
  HTTPStatusCode: {
    UNAUTHORIZED,
    BAD_REQUEST,
    UNPROCESSABLE_ENTITY,
    SERVER_ERROR
  }
} = require('../../utility')
const minify = require('html-minifier').minify
const puppeteer = require('puppeteer')
const path = require('path')
const pug = require('pug')
const fs = require('fs');
const request = require('request')
// const ejs = require('ejs')
const _ = require('lodash');
const moment = require('moment');
// const BookingHelper = require('../../helpers/booking')
// const EmailHelper = require('../../helpers/email')
// const moment = require('moment')
const INVOICE_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

/**  Three post-pay setting needs to be updated , it need to have plus 3 days in each one of them */
const formatDate = (date) => {
  var monthNames = [
    "January", "February", "March",
    "April", "May", "June", "July",
    "August", "September", "October",
    "November", "December"
  ];

  var day = date.getDate();
  var monthIndex = date.getMonth();
  var year = date.getFullYear();

  return day + ' ' + monthNames[monthIndex] + ' ' + year;
}

let SLACK_URL = process.env.NODE_ENV == 'production' ? 'https://hooks.slack.com/services/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' : 'https://hooks.slack.com/services/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'
// override with env's url
SLACK_URL = process.env.SLACK_URL || SLACK_URL;

const sendSlackHook = (isSuccess, attachmentsData) => {
  const payload = {
    text: `Invoice generation failed!!`,
    username: 'TheAsia.com | Invoice Bot',
    icon_emoji: ':money_with_wings:',
    attachments: attachmentsData,
  }
  if (isSuccess) {
    payload.text = 'Invoice generation successful!'
  }
  const options = {
    url: SLACK_URL,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
  };

  request.post(options, (err, response) => {
    if (err) {
      console.log(err)
    }
    console.log('Invoice Generation Process Completed')
  })
}

module.exports = function (Invoices) {

  /** Disable Some Methods */
  // hide delete remote method
  Invoices.disableRemoteMethodByName('create');
  Invoices.disableRemoteMethodByName('deleteById');
  Invoices.disableRemoteMethodByName('prototype.updateAttributes');
  Invoices.disableRemoteMethodByName('prototype.__delete__accessTokens');
  Invoices.disableRemoteMethodByName('prototype.__destroyById__accessTokens');

  Invoices.checkInvoiceCreationValidity = async (affiliate, cron = false, booking_id) => {
    const today = moment().format('YYYY-MM-DD')
    const { Users } = await Invoices.app.models;
    const user = await Users.findOne({ where: { affiliate_id: affiliate.id } });
    const affiliateSettings = affiliate.invoice_settings;
    // console.log(affiliateSettings, `${affiliate.id}`)
    if (!affiliateSettings) {
      return {
        status: false,
        code: 'SETTINGS_NOT_FOUND'
      };
    }
    let bookingFilter = {
      booking_status_id: 5, //confirm departed bookings only
      user_id: user.id
    };
    if (!cron && booking_id) {
      bookingFilter.id = booking_id
    }
    const bookings = await Invoices.app.models.Booking.find({
      where: bookingFilter
    });
    let selectedBooking = []
    if (affiliateSettings && affiliateSettings.setting_code == 'POSTMDATE' && affiliateSettings.monthly_invoice_date >= 1 && affiliateSettings.monthly_invoice_date <= 30) {
      // allow manual post invoice creation in case of OFFLINE user pays online
      if (cron && !booking_id)  {
        selectedBooking = _.filter(bookings, (booking) => {
          if (affiliateSettings.monthly_invoice_date == moment().format('D')) {
            // console.log(affiliateSettings.monthly_invoice_date, 'matched')
            return true
          } else {
            return false;
          }
        })
      } else {
        selectedBooking = bookings;
      }
    } else if (affiliateSettings && affiliateSettings.setting_code == 'POSTMLAST') {
      if (cron && !booking_id)  {
        selectedBooking = _.filter(bookings, (booking) => {
          if (today == moment().endOf('month').format('YYYY-MM-DD')) {
            return true
          } else {
            return false;
          }
        })
      } else {
        selectedBooking = bookings;
      }
    } else if (affiliateSettings && affiliateSettings.setting_code == 'POSTWD' && INVOICE_DAYS.indexOf(affiliateSettings.weekly_invoice_day) >= 0) {
      if (cron && !booking_id)  {
        selectedBooking = _.filter(bookings, (booking) => {
          // console.log(INVOICE_DAYS.indexOf(affiliateSettings.weekly_payout_day) + 1, moment().isoWeekday(), 'weekday')
          if (INVOICE_DAYS.indexOf(affiliateSettings.weekly_invoice_day) + 1 === moment().isoWeekday()) {
            return true
          } else {
            return false;
          }
        })
      } else {
        selectedBooking = bookings;
      }
    } else if (affiliateSettings && affiliateSettings.setting_code == 'POSTDEPARTED' && !cron && booking_id) {
      selectedBooking = _.filter(bookings, (booking) => {
        if (booking.booking_status_id == 5) {
          return true;
        } else {
          return false;
        }
      })
    }
    const booking_ids = _.pluck(selectedBooking, 'id');
    if (booking_ids && booking_ids.length) {
      const payments = await Invoices.app.models.Payments.find({
        where: {
          invoice_id: 0,
          payment_status_id: { inq: !cron && booking_id ? [ 2, 6 ] : [ 6 ] }, // invoice for online PAID and offline UNPAID
          booking_id: {
            inq: booking_ids
          }
        }
      });
      if (payments && payments.length) {
        return {
          status: true,
          payments: payments
        }
      } else {
        return {
          status: false
        }
      }
    } else {
      return {
        status: false
      }
    }

  }
  // Invoices.beforeRemote('find', (ctx, status, next) => {
  //   if (ctx.args.filter) {
  //     ctx.args.filter.include = [{
  //       relation: 'payment_method',
  //     }];
  //   } else {
  //     ctx.args.filter = {
  //       include: [{
  //         relation: 'payment_method',
  //       }],
  //     }
  //   }
  //   next();
  // });
  // Invoices.beforeRemote('findById', (ctx, status, next) => {
  //   if (ctx.args.filter) {
  //     ctx.args.filter.include = [{
  //       relation: 'payment_method',
  //     }];
  //   } else {
  //     ctx.args.filter = {
  //       include: [{
  //         relation: 'payment_method',
  //       }],
  //     }
  //   }
  //   next();
  // });

  const getInvoiceAmount = async invoice => {
    const Affiliates = Invoices.app.models.Affiliates;
    const Users = Invoices.app.models.Users;
    const user = await Users.findById(invoice.payer_id);
    const affiliate = await Affiliates.findById(user.affiliate_id);
    const Payments = Invoices.app.models.Payments;
    const payments = await Payments.find({
      where: {
        booking_id: { inq: invoice.details }
      }
    });
    const charges = _.sum(payments, 'total');
    // const charges = payments.map(payment => payment.total); // need to check whether to take in 'total' or 'final_amount' field
    const chargesUSD = payments.map(payment => payment.total / payment.exchange_rate * 1);
    const currency_codes = _.pluck(payments, 'currency')
    const allcurrencySame = currency_codes.every( (val, i, arr) => val === arr[0] ) || false;
    let currency = currency_codes[0];
    let total = 0;
    if (allcurrencySame) {
      total = charges;
    } else {
      currency = 'USD';
      total = chargesUSD.reduce((acc, cur) => acc + cur);
    }
    // console.log(total, 'before taxes')
    if (total > 0) {
      // need confirmation if taxes calculation required before or after invoice generation 
      // if (affiliate.settings.vat) {
      //   total = (parseFloat(total) + parseFloat(total) * affiliate.settings.vat_amount).toFixed(2);
      // }
      // console.log(total, 'after taxes')
      return {
        amount: total,
        currency_code: currency,
      }
    }
  };

  const getInvoiceObject = async (payments, user_id) => {
    const Affiliates = Invoices.app.models.Affiliates;
    const Users = Invoices.app.models.Users;
    const user = await Users.findById(user_id);
    const affiliate = await Affiliates.findById(user.affiliate_id);
    const charges = _.sum(payments, 'total');
    // const charges = payments.map(payment => payment.total); // need to check whether to take in 'total' or 'final_amount' field
    const chargesUSD = payments.map(payment => payment.total / payment.exchange_rate * 1);
    if(!payments  || !payments.length){
      return false;
    }
    const details = _.pluck(payments, 'booking_id')
    let total = 0;
    const currency_codes = _.pluck(payments, 'currency')
    const allcurrencySame = currency_codes.every( (val, i, arr) => val === arr[0] ) || false
    let currency = currency_codes[0];
    if(allcurrencySame){
      total = charges;
      // total = _.sumBy(payments, 'final_amount');
    }
    else {
      currency = 'USD';
      total = chargesUSD.reduce((acc, cur) => acc + cur);
      // total = _.sumBy(payments, function(p) { return p.final_amount/p.exchange_rate * 1 ; });
    }

    if (total > 0) {
      // need confirmation if taxes calculation required before or after invoice generation 
      // if (affiliate.settings.vat) {
      //   total = (parseFloat(total) + parseFloat(total) * affiliate.settings.vat_amount).toFixed(2);
      // }
      const invoiceObject = {
        details: _.uniq(details),
        payer_id: user_id,
        receiver_id: 1,
        amount: total,
        currency_code: currency,
        payment_type: 'booking'
      }
      return { invoiceObject, total };
    }
    else {
      return false;
    }
  }

  Invoices.createInvoicePostDeparted = async (booking_id) => {
    const Affiliates = Invoices.app.models.Affiliates;
    const Users = Invoices.app.models.Users;
    const Booking = Invoices.app.models.Booking;
    const Payments = Invoices.app.models.Payments;
    const booking = await Booking.findById(booking_id)
    // console.log(booking);
    const user = await Users.findById(booking.user_id);
    // console.log(user);
    let payments = []
    try {
      if (booking && booking.booking_status_id == 5) {
        const affiliate = await Affiliates.findById(user.affiliate_id);
        if(!affiliate) {
           payments =  await Payments.find({
            where: {
              invoice_id: 0,
              payment_status_id: { inq: [2, 7]},
              booking_id: booking_id
            }
          });
        }
        else {
          const invoiceCreationStatus = await Invoices.checkInvoiceCreationValidity(affiliate, false, booking_id);
          if (invoiceCreationStatus && invoiceCreationStatus.status && invoiceCreationStatus.payments && invoiceCreationStatus.payments.length) {
            payments = invoiceCreationStatus.payments
          } else if (!invoiceCreationStatus.status && invoiceCreationStatus.code === 'SETTINGS_NOT_FOUND') {
            return {
              status: false,
              invoice_created: false,
              message: 'Invoice settings not found for following affiliate.'
            }
          } else {
            return {
              status: true,
              invoice_created: false,
              message: "Invoice creation not needed."
            }
          }
      }
      const payment = await Payments.findOne({ where: { booking_id } });
      const invoice = await getInvoiceObject(payments,booking.user_id);
      if(invoice && invoice.total) {
        if (payment.payment_status_id == '2' || payment.payment_status_id == '7') {
          invoice.invoiceObject.status = 'PAID';
        }
        const created = await Invoices.create(invoice.invoiceObject);
        if (created) {
            _.each(payments, async (payment) => {
              await payment.updateAttributes({
                invoice_id: created.id
            })
          })
          return {
            status: true,
            invoice_created: created,
          }
        } else {
          return {
            status: true,
            invoice_created: false,
          }
        }
      } else {
        return {
          status: false,
          invoice_created: false,
          message: "Can't create Invoice for this set of payments"
        }
      }
    }
    else {
      return {
        status: false,
        invoice_created: false,
        message: "Departed Booking Not Found"
      }
    }
   }
    catch (e) {
      return {
        status: false,
        invoice_created: false,
        message: e.message
      }
    }
  }

  Invoices.createInvoiceCron = async (data) => {
    const Affiliates = Invoices.app.models.Affiliates;
    const Users = Invoices.app.models.Users;
    const Booking = Invoices.app.models.Booking;
    const Payments = Invoices.app.models.Payments;
    const Charge = Invoices.app.models.Charge;
    const affiliates = await Affiliates.find({
      where: {
        status: 1
      }
    });
    let creationCount = 0;
    try {
      await Promise.all(affiliates.map(async (affiliate) => {
        const user = await Users.findOne({ where: { affiliate_id: affiliate.id } });
        const invoiceCreationStatus = await Invoices.checkInvoiceCreationValidity(affiliate, true);
        if (invoiceCreationStatus && invoiceCreationStatus.status) {

          if (invoiceCreationStatus.payments && invoiceCreationStatus.payments.length > 0) {

            const invoice = await getInvoiceObject(invoiceCreationStatus.payments, user.id);

            if (invoice && invoice.total) {
              const invoiceCreated = await Invoices.create(invoice.invoiceObject);
              if (invoiceCreated) {
                creationCount++;
                _.each(invoiceCreationStatus.payments, async (payment) => {
                  await payment.updateAttributes({
                    invoice_id: invoiceCreated.id
                  })
                });
              }
            }
          }
        }
      }));
      sendSlackHook(true, [
        {
          title: `Details (${process.env.NODE_ENV == 'production' ? 'production' : 'development'})`,
          fields: [
            { title: 'Invoice Created', value: creationCount }
          ]
        }
      ])
      return {
        count: creationCount,
        status: true
      };
    } catch(e) {
      sendSlackHook(false, [
        {
          title: `With errors (${process.env.NODE_ENV == 'production' ? 'production' : 'development'})`,
          text: JSON.stringify(e)
        }
      ])
    }
  }


  Invoices.updateStatus = async (invoice_id,status) => {
    const Payments = Invoices.app.models.Payments;
    const allowedStatus =  ['UNPAID','PAID','HOLD','CANCELED']
    console.log(allowedStatus.indexOf(status) >= 0 ,status)
    if(allowedStatus.indexOf(status) >= 0){
      try {
        const invoice = await Invoices.findById(invoice_id);
        const payments = await Payments.find({
          where: {
            booking_id: { inq: invoice.details }
          }
        });
        // if(allowedStatus.indexOf(invoice.status) >= 0){
        //   return {
        //     id : invoice_id,
        //     status: true,
        //     message : "Status can't be updated. Invalid Request"
        //   }
        // }
        // else {
          const updates = {
            status : status,
          }
          const updated = await invoice.updateAttributes(updates);
          if(updated) {
            if (status === 'PAID') {
              _.each(payments, async (payment) => {
                if (payment.payment_type === 'Offline') {
                  await payment.updateAttributes({
                    payment_status_id: 7
                  })  
                }
              })
            } else if (status === 'UNPAID') {
              _.each(payments, async (payment) => {
                if (payment.payment_type === 'Offline') {
                  await payment.updateAttributes({
                    payment_status_id: 6
                  })  
                }
              })
            } else if (status === 'CANCELED') {
              _.each(payments, async (payment) => {
                if (payment.payment_type === 'Offline') {
                  await payment.updateAttributes({
                    payment_status_id: 5
                  })  
                }
              })
            }
            return {
              id : invoice_id,
              status: true,
              message : `Status updated to ${status}`
            }
          }
          else {
            return {
              id : invoice_id,
              status: false,
              message : "Update Failed"
           }
          }
        // }
      }
      catch(e){
        return {
          id : invoice_id,
          status: false,
          message : e.message
       }
      }
    }
    else {
      return {
         id : invoice_id,
         status: false,
         message : `Invalid Request (Invalid status): ${status}`
      }
    }
  }

  Invoices.remoteMethod('updateStatus', {
    accepts: [{
      arg: 'invoice_id',
      type: 'string',
      required: true
    }, {
      arg: 'status',
      type: 'string',
      required: true
    }],
    returns: {
      type: 'object',
      root: true
    },
    http: {
      path: '/updateStatus',
      verb: 'post'
    },
  })

  Invoices.editItems = async (invoice_id, bookings) => {
    try {
      const Payments = Invoices.app.models.Payments;
      const invoice = await Invoices.findById(invoice_id);
      if (!invoice) {
        throw new Error('Invoice is not found.');
      }
      let tempList = [].concat(invoice.details);
      let addedItems = [], removedItems = [];

      //check add
      bookings.forEach(booking => {
        if (!_.includes(invoice.details, booking)) {
          tempList.push(booking)
          addedItems.push(booking)
        }
      })
      //check removed
      const removed = _.remove(tempList, (item) => {
        if (!_.includes(bookings, item)) {
          removedItems.push(item);
          return true;
        }
      })
      if (addedItems.length === 0 && removedItems.length === 0) {
        throw new Error('Nothing has been changed in invoice details.')
      }
      if (removedItems.length) {
        const removedPayments = await Payments.find({
          where: {
            booking_id: { inq: removedItems }
          }
        });
        _.each(removedPayments, async (payment) => {
          await payment.updateAttributes({
            invoice_id: 0
          })
        })
      }
      if (addedItems.length) {
        const addedPayments = await Payments.find({
          where: {
            booking_id: { inq: addedItems }
          }
        });
        _.each(addedPayments, async (payment) => {
          await payment.updateAttributes({
            invoice_id: invoice_id
          })
        })
      }
      tempList.sort();
      const updated = await invoice.updateAttributes({ details: tempList });
      if (updated) {
        const getAmount = await getInvoiceAmount(invoice);
        const valuated = await invoice.updateAttributes({ 
          amount: getAmount.amount,
          currency_code: getAmount.currency_code
        });
        if (!valuated) throw new Error('Invoice amount is not updated correctly.');
        return {
          id : invoice_id,
          status: true,
          message: `Invoice details updated with following bookings ${tempList}.`,
          amount: `${getAmount.amount} ${getAmount.currency_code}`,
          added: addedItems,
          removed: removedItems,
        }
      } else {
        return {
          id : invoice_id,
          status: false,
          message : "Update Failed"
       }
      }

    } catch(e) {
      return {
        status: false,
        message: e.message
      }
    }
  }

  Invoices.remoteMethod('editItems', {
    accepts: [{
      arg: 'invoice_id',
      type: 'string',
      required: true
    }, {
      arg: 'items',
      type: 'array',
      required: true
    }],
    returns: {
      type: 'object',
      root: true
    },
    http: {
      path: '/editItems',
      verb: 'post'
    },
  })

  // Invoices.editCharges = async (invoice_id, charges) => {
    
  // }

  // Invoices.remoteMethod('editCharges', {
  //   accepts: [{
  //     arg: 'invoice_id',
  //     type: 'string',
  //     required: true
  //   }, {
  //     arg: 'charges',
  //     type: 'array',
  //     required: true
  //   }],
  //   returns: {
  //     type: 'object',
  //     root: true
  //   },
  //   http: {
  //     path: '/editCharges',
  //     verb: 'post'
  //   },
  // })

  // Invoices.removeBookings = async (invoice_ids = []) => {
  //   const remaining_ids = [];
  //   let count = 0;
  //   let message = [];
  //   if (invoice_ids && invoice_ids.length) {
  //     try {
  //       const tx = await Invoices.beginTransaction({
  //         isolationLevel: Invoices.Transaction.READ_COMMITTED,
  //         timeout: 30000
  //       });
  //       const transaction = {
  //         transaction: tx
  //       };
  //       let counter = 0
  //       await Promise.all(invoice_ids.map(async (data) => {
  //         const invoice = await Invoices.findById(data.invoice_id);
  //         if (data.booking_ids && data.booking_ids.length && invoice && invoice.details && invoice.details.length > data.booking_ids.length) {
  //            const invoiceDetails = [];
  //           for (var i=0,l=invoice.details.length;i<l;i++) invoiceDetails.push(+invoice.details[i]);
  //           const newDetails = _.uniq(_.difference(invoiceDetails, data.booking_ids)) || [];
  //           if (newDetails.length && !(_.isEmpty(_.difference(newDetails, invoice.details)) && _.isEmpty(_.difference(invoice.details, newDetails)))) {
  //             const bookings = await Invoices.app.models.Booking.find({
  //               where: {
  //                 id: {
  //                   inq: data.booking_ids
  //                 }
  //               }
  //             })
  //             const payments = await Invoices.app.models.Payments.find({
  //               where: {
  //                 payment_status_id: 2 ,
  //                 invoice_id: data.invoice_id,
  //                 booking_id: {
  //                   inq: _.uniq(_.pluck(bookings,'id'))
  //                 }
  //               }
  //             });
  //             let total = 0;
  //             const currency_codes = _.pluck(payments, 'currency')
  //             const allcurrencySame = currency_codes.every( (val, i, arr) => val === arr[0] ) || false
  //             let currency = currency_codes[0];
  //             if(allcurrencySame){
  //               total = _.sumBy(payments, 'final_amount');
  //             }
  //             else {
  //               total = _.sumBy(payments, function(p) { return p.final_amount/p.exchange_rate * 1 ; });
  //             }

  //             const updated = await invoice.updateAttributes({
  //               details: newDetails,
  //               amount: invoice.amount - total
  //             }, transaction);
  //             if (updated) {
  //               counter++;
  //             } else {
  //               remaining_ids.push(data.invoice_id)
  //             }
  //           } else {
  //             message.push(`Can not Remove all Booking from Invoices for ${invoice.id}`);
  //             remaining_ids.push(data.invoice_id)
  //           }
  //         } else {
  //           message.push(`Can not Remove all Booking from Invoices for ${invoice.id}. A invoice should have atleast one Booking`)
  //           remaining_ids.push(data.invoice_id)
  //         }
  //       }));
  //       if (!counter) {
  //         await tx.rollback();
  //         return {
  //           status: false,
  //           message: `Failed to Remove any Bookings from invoice`,
  //           remaining_ids,
  //         }
  //       } else {
  //         await tx.commit();
  //         return {
  //           status: !!count,
  //           message: message && message.length? message.join('\n'): `${count.toString()} Payout updated`,
  //           remaining_ids,
  //         }
  //       }
  //     } catch (e) {
  //       return {
  //         status: false,
  //         message: e.message
  //       }
  //     }
  //   } else {
  //     return {
  //       status: false,
  //       message: "No Input Received"
  //     }
  //   }
  // }

  // Create Payout Cron Remote Method
  Invoices.remoteMethod('createInvoiceCron', {
    accepts: [{
      arg: 'data',
      type: 'object',
      http: {
        source: 'body'
      },
      required: false,
    }, ],
    returns: {
      type: 'object',
      root: true
    },
    http: {
      path: '/create-invoices-cron',
      verb: 'post'
    },
  })

  // Create Payout Cron Remote Method
  Invoices.remoteMethod('createInvoicePostDeparted', {
    accepts: [{
      arg: 'booking_id',
      type: 'string',
      required: true
    }],
    returns: {
      type: 'object',
      root: true
    },
    http: {
      path: '/create-invoice-post-departed',
      verb: 'post'
    },
  })

  Invoices.downloadInvoice = async (code, invoiceId, res) => {
    if(code == "theAsiaCRM") {
      const logoBuffer = fs.readFileSync(path.join(__dirname, '../../', 'template/images/theasia-logo.png'), 'base64')
      // const cssText = fs.readFileSync(path.join(__dirname, '../../', 'template/invoice/css/invoice_style.css'), 'utf8')
      const { Affiliates, AffiliatesBillingAcct, Booking, Users } = Invoices.app.models;
      const invoice = await Invoices.findById(invoiceId);
      const user = await Users.findById(invoice.payer_id);
      const affiliate = await Affiliates.findById(user.affiliate_id);
      const affiliateAcct = await AffiliatesBillingAcct.findOne({ where: { affiliateId: user.affiliate_id } });
      
      let params = {
				order : 'created_at DESC',
			};
      const tourScope = {
        relation: 'tour',
        scope: {
          fields: ['name'],
        },
      };
      params.where = { id: { inq: invoice.details } };
      params.include = tourScope;
      const bookings = await Booking.find(params);
      const dataParser = [];
      bookings.forEach(item => {
        dataParser.push(item.toJSON());
      })
      const prepaid = _.filter(bookings, (booking) => {
        return booking.booking_method_id == '3' || booking.booking_method_id == '5';
      });
      // console.log(bookings[0].input_details);
      const subTotal = _.sum(dataParser, obj => obj.total).toFixed(2);
      // const charges = _.pluck(dataParser, 'total');
      // const subTotal = charges.reduce((acc, cur) => acc + cur).toFixed(2);
      const tableData = dataParser.map(booking => ({
        // ...booking,
        date: moment(booking.created_at).format('YYYY-MM-DD'),
        tripDate: moment(booking.trip_starts).format('YYYY-MM-DD'),
        description: booking.tour.name,
        details: booking.input_details,
        amount: booking.total.toFixed(2)
      }));
      // optionData added here
      const optionData = [];
      if (affiliate.invoice_settings.setting_code != 'POSTDEPARTED') {
        if (affiliate.settings.vat && prepaid.length === 0 )
          optionData.push({
            optionName: `VAT (${Math.floor(affiliate.settings.vat_amount * 100)}%)`,
            amount: (subTotal * affiliate.settings.vat_amount).toFixed(2)
          })
      }
      const surchargeTotal = parseFloat(_.sum(optionData, 'amount')).toFixed(2);
      // const chargesTotal = surcharge.reduce((acc, cur) => acc + cur).toFixed(2);
      // console.log(affiliate);
      const objForPDF = {
        logoPath: `data:image/jpeg;base64, ${logoBuffer}`,
        header: 'Hello, this is your invoice.',
        currencyCode: invoice.currency_code,
        toName: affiliate.company_name,
        toAddress: affiliate.address,
        taxId: affiliateAcct.tax_id,
        refNo: `#${moment(invoice.created_at).format('YY')}${_.padLeft(invoice.id, 8, '0')}`,
        issueDate: `${moment(invoice.created_at).format('YYYY-MM-DD')}`,
        paymentDue: prepaid.length === 0 ? `${moment(invoice.created_at).add(15, 'days').format('YYYY-MM-DD')}` : '-',
        remark: 'Auto-Generated Affiliate Invoice',
        tableData,
        // [
        //   {
        //     date: '2018-06-30',
        //     description: [
        //       'TOTAL NUMBER OF 42 BOOKINGS',
        //       'between 2018-06-01 to 2018-06-30',
        //       'For a complete breakdown of all bookings please see the attached pages',
        //     ],
        //     amount: '125,680.00',
        //   }
        // ],
        subTotal,// '125,680.00',
        optionData,
        // [
        //   {
        //     optionName: 'VAT (7%)',
        //     amount: '9857.60',
        //   },
        //   {
        //     optionName: 'Service Charge (10%)',
        //     amount: '853.25',
        //   }
        // ],
        grandTotal: `${(parseFloat(subTotal) + parseFloat(surchargeTotal)).toFixed(2)}`, // '120,137.60',
        paymentOptions: {
          text: 'Our Bank details ar as follows:',
          bankName: 'Bangkok Bank PLC.',
          accountName: 'The Asia(Thai) Co.Ltd.',
          bankAddress: '12345 Silom Road, Bangkok 10110, Thailand',
          accountNo: '101-01010-0101',
          branch: 'Head Office, Silom',
          swiftCode: 'BKKHGSU-86383',
        },
        footerData: {
          companyAddres: 'The Asia(Thai) Co.Ltd. 15 Ekkamai Soi 4, Prakanong-Nua, Wattana, Bangkok 10110',
          phone: 'Tel +66(0) 2 255 7611-14 | Fax +66(0)2 255 7615 | info@theasia.com | www.theasia.com',
        },
        voucherStatus: invoice.status,
      };
      try {
          const result = await Invoices.generateVoucher(objForPDF);
          if(result.status){
            // res.set('Expires', 'Tue, 03 Jul 2001 06:00:00 GMT');
            // res.set('Cache-Control', 'max-age=0, no-cache, must-revalidate, proxy-revalidate');
            // res.set('Last-Modified', datetime +'GMT');
            // res.set('Content-Type','application/force-download');
            // res.set('Content-Type','application/octet-stream');
            res.setHeader('Content-Type','application/pdf');
            res.setHeader('Content-Disposition',`filename=INV-${moment(invoice.created_at).format('YY')}${_.padLeft(invoice.id, 8, '0')}.pdf`);
            // res.set('Content-Transfer-Encoding','binary');
            // res.send(result.data);
            // return {
            //   data:result.data,
            //   status:true
            // }
            return result.data
          }
          else {
            return {
              status:false
            }
          }
      }
      catch(e){
        console.log(e);
        return newLoopbackError(UNPROCESSABLE_ENTITY, 'Failed to generate PDF.');
      }
    }
    else {
      return newLoopbackError(UNAUTHORIZED, 'Invalid Request');
    }
  }

  // Invoices.afterRemote('downloadInvoice', async (ctx, output, next) => {
  //   const datetime = new Date();
  //   // res.set('Cache-Control', 'max-age=0, no-cache, must-revalidate, proxy-revalidate');
  //   // ctx.res.set('Last-Modified', datetime + 'GMT');

  //   // ctx.res.setHeader('Content-Type', 'application/force-download');
  //   // ctx.res.setHeader('Content-Type', 'application/octet-stream');
  //   // ctx.res.setHeader('Content-Type', 'application/download');

  //   if (ctx.result.status  == true) {
  //     console.log("coming here",ctx.result)
      
  //     // let fileContent = new Buffer(ctx.result.data, 'binary');
  //     // ctx.res.setHeader('Content-Length', stat.size);
  //     ctx.res.setHeader('Content-type', 'application/pdf');
  //     ctx.res.setHeader('Content-disposition', `attachment;filename=Invoice-TEST.pdf`);
  //     ctx.res.setHeader('Content-Transfer-Encoding', 'binary');
  //     // fs.writeFileSync(`${process.cwd()}/common/template/invoice/testInvoice.pdf`, ctx.result.data);
  //     ctx.res.send(ctx.result.data);
  //   } else {
  //     console.log("it is here")
  //     ctx.res.setHeader('content-type', 'text/json');
  //     const message = ctx.result.name ? `${ctx.result.name}, Status: ${ctx.result.status}` : `Invoice Failed To Print. Please Try Again Later.`
  //     ctx.res.send(message);
  //   }

  // });
Invoices.generateVoucher = async (dataObj) => {
  const templatePath = './common/template/invoice/invoice.pug'
  const filePath = './common/template/invoice/invoice_xxxx.pdf'
  try {
    const htmlToString = pug.renderFile(templatePath, {
      basedir: __dirname,
      ...dataObj,
    })
    // console.log(htmlToString)
    // const htmlToString = await ejs.renderFile(templatePath, dataObj, {
    //   rmWhitespace: true
    // })
    const minifiedHtml = await minify(htmlToString, {
      collapseInlineTagWhitespace: true,
      collapseWhitespace: true,
    })
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox']
    })
    const page = await browser.newPage()
    // await page.goto(`data:text/html,${minifiedHtml}`, { waitUntil: 'networkidle0' })
    await page.setContent(minifiedHtml, { waitUntil: 'networkidle0' })
    const pdfData = await page.pdf({
      // path: filePath,
      printBackground: true,
      format: 'A4'
    });
    await browser.close();
    console.log(pdfData,"pdfdata")
    return Promise.resolve({
      status: true,
      data: pdfData,
    })
  } catch (e) {
    console.log(e)
    return Promise.reject(e)
  }
}

  Invoices.remoteMethod('downloadInvoice', {
    accepts: [
      { arg: 'code', type: 'string', description: 'reference' },
      { arg: 'invoiceId', type: 'string', description: 'Invoice no.' },
      { arg: 'res', type: 'object', http: { source: 'res' } }
    ],
    returns: { arg: 'body', type: 'file', root: true },
    http: { path: '/downloadInvoice', verb: 'get' },
  })

};
