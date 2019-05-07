const path = require('path');
const fs = require('fs');

const { minify } = require('html-minifier');
const puppeteer = require('puppeteer');
const ejs = require('ejs');
const _ = require('lodash');
const moment = require('moment');

const {
  newLoopbackError,
  HTTPStatusCode: { UNAUTHORIZED, UNPROCESSABLE_ENTITY },
} = require('../../utility');
const sqlHelper = require('../../helpers/sql');

const PAYOUT_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

/**  Three post-pay setting needs to be updated , it need to have plus 3 days in each one of them */
const formatDate = date => {
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const day = date.getDate();
  const monthIndex = date.getMonth();
  const year = date.getFullYear();

  return `${day} ${monthNames[monthIndex]} ${year}`;
};

/* eslint-disable eqeqeq */
module.exports = Payouts => {
  /** Disable Some Methods */
  // hide delete remote method
  Payouts.disableRemoteMethodByName('create');
  Payouts.disableRemoteMethodByName('deleteById');
  Payouts.disableRemoteMethodByName('prototype.updateAttributes');
  Payouts.disableRemoteMethodByName('prototype.__delete__accessTokens');
  Payouts.disableRemoteMethodByName('prototype.__destroyById__accessTokens');

  Payouts.checkPayoutCreationValidity = async (supplier, cron = false, booking_id) => {
    const today = moment().format('YYYY-MM-DD');
    // Booking must be made 2 days before trip_starts
    const BOOKING_CUTOFF_DAYS = 2;
    const supplierSettings = supplier.settings;
    const bookingFilter = {
      booking_status_id: {
        inq: [2, 5, 6],
      },
      supplier_id: supplier.id,
    };
    if (!cron && booking_id) {
      bookingFilter.id = booking_id;
    }
    const bookings = await Payouts.app.models.Booking.find({
      where: bookingFilter,
    });
    let selectedBooking = [];
    // PRE01/03/05 has buffer of `BOOKING_CUTOFF_DAYS` variable
    // The payouts can therefore be created before hand to view in client apps
    if (!supplierSettings) {
      selectedBooking = [];
    } else if (supplierSettings.setting_code === 'PRE01') {
      selectedBooking = _.filter(bookings, booking => {
        const tripDateCutOff = moment(booking.trip_starts).subtract(BOOKING_CUTOFF_DAYS, 'days');
        return booking.booking_status_id == 2 && tripDateCutOff.diff(today, 'days', true) <= 1;
      });
    } else if (supplierSettings.setting_code === 'PRE03') {
      selectedBooking = _.filter(bookings, booking => {
        const tripDateCutOff = moment(booking.trip_starts).subtract(BOOKING_CUTOFF_DAYS, 'days');
        return booking.booking_status_id == 2 && tripDateCutOff.diff(today, 'days', true) <= 3;
      });
    } else if (supplierSettings.setting_code === 'PRE05') {
      selectedBooking = _.filter(bookings, booking => {
        const tripDateCutOff = moment(booking.trip_starts).subtract(BOOKING_CUTOFF_DAYS, 'days');
        return booking.booking_status_id == 2 && tripDateCutOff.diff(today, 'days', true) <= 5;
      });
    } else if (
      supplierSettings.setting_code === 'POSTMDATE' &&
      supplierSettings.monthly_payout_date >= 1 &&
      supplierSettings.monthly_payout_date <= 31 &&
      supplierSettings.monthly_payout_date == moment().format('D')
    ) {
      selectedBooking = _.filter(bookings, booking => {
        const triDate = moment(booking.trip_starts).format('YYYY-MM-DD');
        return moment().isAfter(triDate, 'day');
      });
    } else if (
      supplierSettings.setting_code === 'POSTMLAST' &&
      today ===
        moment()
          .endOf('month')
          .format('YYYY-MM-DD')
    ) {
      selectedBooking = _.filter(bookings, booking => {
        const tripDate = moment(booking.trip_starts).format('YYYY-MM-DD');
        return moment().isAfter(tripDate, 'days');
      });
    } else if (
      supplierSettings.setting_code === 'POSTWD' &&
      PAYOUT_DAYS.indexOf(supplierSettings.weekly_payout_day) >= 0 &&
      PAYOUT_DAYS.indexOf(supplierSettings.weekly_payout_day) + 1 === moment().isoWeekday()
    ) {
      selectedBooking = _.filter(bookings, booking => {
        const tripDate = moment(booking.trip_starts).format('YYYY-MM-DD');
        return moment().isAfter(tripDate, 'days');
      });
    } else if (
      supplierSettings.setting_code === 'POSTHM' &&
      (moment().format('D') == 1 || moment().format('D') == 16)
    ) {
      selectedBooking = _.filter(bookings, booking => {
        const tripDate = moment(booking.trip_starts).format('YYYY-MM-DD');
        return moment().isAfter(tripDate, 'days');
      });
    }

    const booking_ids = selectedBooking.map(s => s.id);
    if (!booking_ids.length) {
      return {
        status: false,
      };
    }

    const charges = await Payouts.app.models.Charge.find({
      where: {
        payout_status: 0,
        charge_status_id: {
          inq: [2, 6],
        },
        booking_id: {
          inq: booking_ids,
        },
      },
    });

    if (!charges.length) {
      return {
        status: false,
      };
    }

    const dueDate = ['PRE01', 'PRE03', 'PRE05'].includes(supplierSettings.setting_code)
      ? moment()
          .add(BOOKING_CUTOFF_DAYS, 'days')
          .format('YYYY-MM-DD HH:mm:ss')
      : today;

    return {
      status: true,
      charges,
      bookings: selectedBooking,
      dueDate,
    };
  };

  Payouts.beforeRemote('find', (ctx, status, next) => {
    if (ctx.args.filter) {
      ctx.args.filter.include = [
        {
          relation: 'payment_method',
        },
      ];
    } else {
      ctx.args.filter = {
        include: [
          {
            relation: 'payment_method',
          },
        ],
      };
    }
    next();
  });

  Payouts.beforeRemote('findById', (ctx, status, next) => {
    if (ctx.args.filter) {
      ctx.args.filter.include = [
        {
          relation: 'payment_method',
        },
      ];
    } else {
      ctx.args.filter = {
        include: [
          {
            relation: 'payment_method',
          },
        ],
      };
    }
    next();
  });

  Payouts.createPayoutFromCharges = async (charges, supplier, due_date) => {
    const response = (message, status = false, payouts) => ({
      status,
      message,
      payouts,
    });
    try {
      if (!charges || !charges.length) return response('Charges Not found');

      const details = charges.map(c => c.booking_id);
      const local_exchange_rates = charges.map(c => c.local_exchange_rate);
      const local_currency_codes = charges.map(c => c.local_currency_code);

      const total = charges.reduce((acc, charge) => {
        if (charge.charge_status_id == 2) return acc + charge.local_price;
        if (charge.charge_status_id == 6) return acc + charge.local_price;
        return acc;
      }, 0);
      if (total <= 0) {
        return response('Payout total is less than zero,Please recheck Booking and Charge data');
      }

      const payoutObject = {
        details: _.uniq(details),
        payer_company_id: 1,
        reciever_id: supplier.id,
        payment_method_id: 6,
        amount: total,
        currency_code: local_currency_codes[0],
        exchange_rate: _.max(local_exchange_rates),
        payment_type: 'booking',
        due_date,
      };
      const created = await Payouts.create(payoutObject);
      await Promise.all(
        charges.map(charge =>
          charge.updateAttributes({
            payout_status: 1,
          }),
        ),
      );
      if (!created) return response();

      return response(undefined, true, created);
    } catch (error) {
      console.log(error);
      return response(error.message);
    }
  };

  Payouts.createPayoutPostConfirm = async booking_id => {
    const { Suppliers, Booking } = Payouts.app.models;
    const response = message => ({
      status: false,
      payout_created: false,
      message,
    });
    try {
      const booking = await Booking.findById(booking_id);
      if (!booking || booking.bookint_status_id != 2)
        return response('Confirmed Booking Not Found');

      const supplier = await Suppliers.findById(booking.supplier_id);
      if (!supplier) return response('Supplier Not Found');

      const canCreatePayout = await Payouts.checkPayoutCreationValidity(
        supplier,
        false,
        booking_id,
      );
      if (!canCreatePayout || !canCreatePayout.status)
        return response('Payout creation not needed.');

      const { status, message, payouts } = await Payouts.createPayoutFromCharges(
        canCreatePayout.charges,
        supplier,
        canCreatePayout.dueDate,
      );
      if (!status) return response(message);

      return {
        status: true,
        payout_created: payouts,
      };
    } catch (e) {
      return response(e.message);
    }
  };

  Payouts.createPayoutsCron = async () => {
    const { Suppliers } = Payouts.app.models;
    const suppliers = await Suppliers.find({
      where: {
        status: 1,
      },
    });
    let creationCount = 0;
    const res = await Promise.all(
      suppliers.map(async supplier => {
        const canCreatePayout = await Payouts.checkPayoutCreationValidity(supplier, true);
        if (canCreatePayout && canCreatePayout.status) {
          console.log('can create');
          const { status } = await Payouts.createPayoutFromCharges(
            canCreatePayout.charges,
            supplier,
            canCreatePayout.dueDate,
          );
          if (status) {
            creationCount += 1;
          }
        }
      }),
    );
    console.log(res.filter(Boolean));
    return {
      count: creationCount,
      status: true,
    };
  };

  Payouts.addAttachment = async (payout_id, attachments) => {
    console.log('here', payout_id, attachments);
    if (attachments && attachments.length && payout_id) {
      try {
        const payout = await Payouts.findById(payout_id);
        console.log('attcahments old', payout_id, payout.attachments);
        const existingAttachments =
          payout.attachments && payout.attachments.constructor == Array ? payout.attachments : [];
        const updateObject = {
          attachments: [...existingAttachments, ...attachments],
        };
        console.log('updateObject', updateObject);
        const updated = await payout.updateAttributes(updateObject);
        console.log('Payout Updated', updated);
        if (updated) {
          return {
            id: payout_id,
            status: true,
            message: 'Updated',
          };
        }
        return {
          id: payout_id,
          status: false,
          message: 'Update Failed',
        };
      } catch (e) {
        console.log('eeeee', e);
        return {
          id: payout_id,
          status: false,
          message: e.message,
        };
      }
    } else {
      return {
        id: payout_id,
        status: false,
        message: 'Incorrect Params',
      };
    }
  };

  Payouts.updateStatus = async (payout_id, status, attachments) => {
    const allowedStatus = ['PAID', 'HOLD', 'CANCELED'];
    if (allowedStatus.indexOf(status) >= 0) {
      try {
        const payout = await Payouts.findById(payout_id);
        if (allowedStatus.indexOf(payout.status) >= 0) {
          return {
            id: payout_id,
            status: true,
            message: "Status can't be updated. Invalid Request",
          };
        }
        const updates = {
          status,
        };
        if (attachments && attachments.length) {
          updates.attachments = [...payout.attachments, ...attachments];
        }
        const updated = await payout.updateAttributes(updates);
        if (updated) {
          return {
            id: payout_id,
            status: true,
            message: `Status updated to ${status}`,
          };
        }
        return {
          id: payout_id,
          status: false,
          message: 'Update Failed',
        };
      } catch (e) {
        return {
          id: payout_id,
          status: false,
          message: e.message,
        };
      }
    } else {
      return {
        id: payout_id,
        status: false,
        message: `Invalid Request (Wrong status): ${status}`,
      };
    }
  };

  /**
   * type PAYOUT_IDS = Array<{
   *  payout_id: number,
   *  booking_ids: Array<number>,
   * }>
   */
  Payouts.removeBookings = async (payout_ids = []) => {
    const remaining_ids = [];
    let count = 0;
    const message = [];
    if (payout_ids && payout_ids.length) {
      try {
        const tx = await Payouts.beginTransaction({
          isolationLevel: Payouts.Transaction.READ_COMMITTED,
          timeout: 30000,
        });
        const transaction = {
          transaction: tx,
        };
        let chargeUpadateFailed = false;
        await Promise.all(
          payout_ids.map(async data => {
            const payout = await Payouts.findById(data.payout_id);
            if (
              data.booking_ids &&
              data.booking_ids.length &&
              payout &&
              payout.details &&
              payout.details.length > data.booking_ids.length
            ) {
              const payoutDetails = [];
              for (let i = 0, l = payout.details.length; i < l; i++)
                payoutDetails.push(+payout.details[i]);
              const newDetails = _.uniq(_.difference(payoutDetails, data.booking_ids)) || [];
              if (
                newDetails.length &&
                !(
                  _.isEmpty(_.difference(newDetails, payout.details)) &&
                  _.isEmpty(_.difference(payout.details, newDetails))
                )
              ) {
                const bookings = await Payouts.app.models.Booking.find({
                  where: {
                    id: {
                      inq: data.booking_ids,
                    },
                  },
                });
                const charges = await Payouts.app.models.Charge.find({
                  where: {
                    payout_status: 1,
                    charge_status_id: {
                      inq: [2, 6],
                    },
                    booking_id: {
                      inq: _.uniq(_.pluck(bookings, 'id')),
                    },
                  },
                });
                let total = 0;
                _.each(charges, charge => {
                  if (charge.charge_status_id == 2) {
                    total = charge.local_price + total;
                  } else if (charge.charge_status_id == 6) {
                    total -= charge.local_price;
                  }
                });
                const updated = await payout.updateAttributes(
                  {
                    details: newDetails,
                    amount: payout.amount - total,
                  },
                  transaction,
                );
                if (updated) {
                  await Promise.all(
                    charges.map(async charge => {
                      try {
                        const chargeUpdated = await charge.updateAttributes(
                          {
                            payout_status: 0,
                          },
                          transaction,
                        );
                        if (!chargeUpdated) {
                          chargeUpadateFailed = true;
                        }
                      } catch (e) {
                        chargeUpadateFailed = true;
                      }
                    }),
                  );
                  if (!chargeUpadateFailed) {
                    count += 1;
                  }
                } else {
                  remaining_ids.push(data.payout_id);
                }
              } else {
                message.push(`Can not Remove all Booking from Payouts for ${payout.id}`);
                remaining_ids.push(data.payout_id);
              }
            } else {
              message.push(
                `Can not Remove all Booking from Payouts for ${
                  payout.id
                }. A payout should have atleast one Booking`,
              );
              remaining_ids.push(data.payout_id);
            }
          }),
        );
        if (chargeUpadateFailed) {
          await tx.rollback();
          return {
            status: false,
            message: `Transaction Failed`,
            remaining_ids,
          };
        }
        await tx.commit();
        return {
          status: !!count,
          message:
            message && message.length ? message.join('\n') : `${count.toString()} Payout updated`,
          remaining_ids,
        };
      } catch (e) {
        return {
          status: false,
          message: e.message,
        };
      }
    } else {
      return {
        status: false,
        message: 'No Input Received',
      };
    }
  };

  Payouts.updateCanceledCharges = async booking_id => {
    if (!booking_id) return { success: false, data: {} };
    const data = await Payouts.app.models.Charge.updateAll({ booking_id }, { payout_status: 4 });
    return { success: true, data };
  };

  Payouts.updateCanceledBooking = async bookingId => {
    const sql = `select id, details from main.payouts where status = 'UNPAID' and details::jsonb @> '["${bookingId}"]'::jsonb`;
    const result = await sqlHelper.raw(sql);
    if (!result.length) return false;
    if (result.length > 1) return false; // 2 payouts for 1 booking? shouldnt be possible?

    const { id, details } = result[0];
    // Only 1 booking in payout, remove the payout
    if (details.length === 1) {
      await Payouts.destroyById(id);
      // More than 1 bookings, remove the canceled booking from list
    } else if (details.length > 1) {
      const payout = await Payouts.findById(id);
      const detailsCopy = [...payout.details];
      const detailsIndex = details.findIndex(d => d == bookingId);
      detailsCopy.splice(detailsIndex, 1);
      await payout.updateAttributes({ details: detailsCopy });
    }

    const updatedCharge = await Payouts.updateCanceledCharges(bookingId);
    return updatedCharge.success;
  };

  // Create Payout Cron Remote Method
  Payouts.remoteMethod('createPayoutsCron', {
    accepts: [
      {
        arg: 'data',
        type: 'object',
        http: {
          source: 'body',
        },
        required: false,
      },
    ],
    returns: {
      type: 'object',
      root: true,
    },
    http: {
      path: '/create-payouts-cron',
      verb: 'post',
    },
  });

  // Create Payout Cron Remote Method
  Payouts.remoteMethod('createPayoutPostConfirm', {
    accepts: [
      {
        arg: 'booking_id',
        type: 'string',
        required: true,
      },
    ],
    returns: {
      type: 'object',
      root: true,
    },
    http: {
      path: '/create-payouts-post-confirm',
      verb: 'post',
    },
  });

  Payouts.downloadVoucher = async (code, payout_id, res) => {
    const payoutsFilter = {
      where: {
        id: payout_id,
      },
      include: ['payment_method', 'payer_company'],
    };
    let isValidRequest = false;
    if (code === 'theAsiaCRM') {
      isValidRequest = true;
    } else if (code) {
      const accessToken = await Payouts.app.models.AccessToken.findById(code);
      if (accessToken && accessToken.userId) {
        payoutsFilter.where.reciever_id = accessToken.userId;
        isValidRequest = true;
      }
    }

    if (isValidRequest) {
      const payoutData = (await Payouts.findOne(payoutsFilter)).toObject();
      const bookingListData = await Payouts.app.models.Booking.find({
        where: {
          id: {
            inq: payoutData.details,
          },
        },
        include: {
          relation: 'tour',
          scope: {
            include: [
              {
                relation: 'features',
                scope: {
                  include: {
                    relation: 'feature',
                    scope: {
                      include: 'localization',
                    },
                  },
                },
              },
            ],
          },
        },
      });

      const logoBuffer = fs.readFileSync(
        path.join(__dirname, '../../', 'template/images/theasia-logo.png'),
        'base64',
      );
      const cssText = fs.readFileSync(
        path.join(__dirname, '../../', 'template/invoice/css/invoice_style.css'),
        'utf8',
      );
      const tableObjData = [];
      _.each(bookingListData, bookingObj => {
        const booking = bookingObj.toObject();
        const tripDate = new Date(booking.trip_starts);
        const tempData = {
          bid: booking.id,
          productCode: booking.booking_no,
          pax:
            `Adult: ${booking.input_details.adult_pax}` +
            `${
              booking.input_details.child_pax ? ` / Child: ${booking.input_details.child_pax}` : ``
            }`,
          tripStartDate: `${tripDate.getFullYear()}/${`0${tripDate.getMonth() + 1}`.slice(
            -2,
          )}/${`0${tripDate.getDate()}`.slice(-2)}`,
          amount: `${parseInt(booking.price_details.supplierPrice.adults, 10) *
            booking.input_details.adult_pax +
            parseInt(booking.price_details.supplierPrice.children, 10) *
              booking.input_details.child_pax +
            parseInt(booking.price_details.supplierPrice.infants, 10) *
              booking.input_details.infant_pax} ${booking.supplier_currency_code}`,
          bookingType: booking.tour.features.map(f => f.feature.name).join(', '),
          status: 'PAYBLE',
        };
        tableObjData.push(tempData);
      });
      const createdDate = new Date(payoutData.created_at);
      const transactionDate = new Date(payoutData.transaction_date);
      const objForPDF = {
        css: cssText,
        logoPath: `data:image/jpeg;base64, ${logoBuffer}`,
        header: 'Payment Voucher',
        voucherNo: `10${createdDate
          .getFullYear()
          .toString()
          .substr(-2)}-${`0${createdDate.getMonth() + 1}`.slice(
          -2,
        )}${`0${createdDate.getDate()}`.slice(-2)}-${payoutData.id}`, // 10{2 digit created_at year}-{2 digit created_at month}{2 digit created_at date}-{booking_id}
        paidTo: payoutData.payer_company.company_name,
        paymentDate: `${transactionDate.getFullYear()}/${transactionDate.getMonth()}/${transactionDate.getDate()}`,
        paymentType: payoutData.payment_type,
        paidBy: payoutData.payment_method.name,
        operation: '',
        accounting: '',
        tableData: tableObjData,
        total: `${payoutData.amount} ${payoutData.currency_code}`,
        paymentOptions: {
          text: 'Accounting Info',
          bankName: 'Bangkok Bank PLC.',
          accountName: 'The Asia(Thai) Co.Ltd.',
          bankAddress: '12345 Silom Road, Bangkok 10110, Thailand',
          accountNo: '101-01010-0101',
          branch: 'Head Office, Silom',
          swiftCode: 'BKKHGSU-86383',
        },
        footerData: {
          companyAddres:
            'The Asia(Thai) Co.Ltd. 15 Ekkamai Soi 4, Prakanong-Nua, Wattana, Bangkok 10110',
          phone:
            'Tel +66(0) 2 255 7611-14 | Fax +66(0)2 255 7615 | info@theasia.com | www.theasia.com',
        },
      };
      try {
        const result = await Payouts.generateVoucher(objForPDF);
        const datetime = new Date();
        // res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `filename=Supplier-Payment-Voucher-${formatDate(datetime)}.pdf`,
        );
        return result.data;
      } catch (e) {
        return newLoopbackError(UNPROCESSABLE_ENTITY, 'Failed to generate PDF.');
      }
    } else {
      return newLoopbackError(UNAUTHORIZED, 'Invalid Request');
    }
  };

  Payouts.generateVoucher = async dataObj => {
    const templatePath = './common/template/payment_voucher/voucher.ejs';
    try {
      const htmlToString = await ejs.renderFile(templatePath, dataObj, {
        rmWhitespace: true,
      });
      const minifiedHtml = await minify(htmlToString, {
        collapseInlineTagWhitespace: true,
        collapseWhitespace: true,
      });
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox'],
      });
      const page = await browser.newPage();
      // await page.goto(`data:text/html, ${minifiedHtml}`, { waitUntil: 'networkidle0' });
      await page.setContent(minifiedHtml, {
        waitUntil: 'networkidle0',
      });
      const pdfData = await page.pdf({
        printBackground: true,
        format: 'A4',
        margin: {
          top: '48px',
          right: '48px',
          bottom: '48px',
          left: '48px',
        },
      });
      await browser.close();
      return Promise.resolve({
        status: true,
        data: pdfData,
      });
    } catch (e) {
      console.log(e);
      return Promise.reject(e);
    }
  };

  Payouts.remoteMethod('downloadVoucher', {
    accepts: [
      {
        arg: 'code',
        type: 'string',
        description: 'reference',
      },
      {
        arg: 'payout_id',
        type: 'string',
        description: 'reference',
      },
      {
        arg: 'res',
        type: 'object',
        http: {
          source: 'res',
        },
      },
    ],
    returns: {
      arg: 'body',
      type: 'file',
      root: true,
    },
    http: {
      path: '/downloadVoucher',
      verb: 'get',
    },
  });
};
