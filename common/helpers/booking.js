const fs = require('fs');
const app = require('../../server/index')
const loopback = require('loopback')
const path = require('path')
const i18n = require('i18n')
const moment = require('moment')
const _ = require('lodash')
const htmlclean = require('htmlclean')
const { formatCurrency } = require('../helpers/currency')
const { getSafe, constants: { isProduction, noreplyEmail, bizEmail } } = require('../utility')
const logger = require('../utility').loggerBuilder('Booking Helper')

const hostConfig = require('../../server/config/config.json')

const CMS_BASE_URL = process.env.NODE_ENV == 'production' ? hostConfig.production.payment_url : hostConfig.development.payment_url
const AAB_PAYMENT_URL = `${CMS_BASE_URL}/AAB_Payment`

const WEBSITE_URL = isProduction ? 'https://www.theasia.com' : 'https://www.theasiadev.com'
let bcc = isProduction ? ['vishal.sharma@theasia.com', 'jaebum.kim@theasia.com', 'jakyeong.ku@theasia.com', 'chanyoung.park@theasia.com'] : ['therachart.wiheanrat@theasia.com', 'vishal.sharma@theasia.com']
if (process.env.BCC_EMAILS) bcc = process.env.BCC_EMAILS.split(',')

const customerBookingOnRequestObj = JSON.parse(fs.readFileSync(`${__dirname}/locales/booking/on_request/en.json`, 'utf8'))
const customerBookingInquiryObj = JSON.parse(fs.readFileSync(`${__dirname}/locales/booking/ack/en.json`, 'utf8'))
const customerInquiryCancellation = JSON.parse(fs.readFileSync(`${__dirname}/locales/booking/inquiry_cancellation/en.json`, 'utf8'))
const customerBookingCancellation = JSON.parse(fs.readFileSync(`${__dirname}/locales/booking/customer_cancellation/en.json`, 'utf8'))
const customerBookingConfirmed = JSON.parse(fs.readFileSync(`${__dirname}/locales/booking/confirm/en.json`, 'utf8'))
const customerInvoice = JSON.parse(fs.readFileSync(`${__dirname}/locales/booking/customer_invoice/en.json`, 'utf-8'))
const customerSurvey = JSON.parse(fs.readFileSync(`${__dirname}/locales/booking/survey/en.json`, 'utf8'))
const supplierBookingConfirmed = JSON.parse(fs.readFileSync(`${__dirname}/locales/booking/supplier_confirm/en.json`, 'utf8'))
const supplierBookingCancellation = JSON.parse(fs.readFileSync(`${__dirname}/locales/booking/supplier_cancellation/en.json`, 'utf8'))
const supplierBookingUnavailable = JSON.parse(fs.readFileSync(`${__dirname}/locales/booking/supplier_booking_unavailable/en.json`, 'utf8'))
const supplierCanceledBooking = JSON.parse(fs.readFileSync(`${__dirname}/locales/booking/supplier_canceled_booking/en.json`, 'utf8'))
const supplierInquiryConfirm = JSON.parse(fs.readFileSync(`${__dirname}/locales/booking/supplier_inquiry_confirm/en.json`, 'utf8'))
const affilaiteInquiry = JSON.parse(fs.readFileSync(`${__dirname}/locales/booking/affiliate_inquiry/en.json`, 'utf8'))
const affilaiteInquiryCancellation = JSON.parse(fs.readFileSync(`${__dirname}/locales/booking/affiliate_inquiry_cancellation/en.json`, 'utf8'))
const affilaiteBookingCancellation = JSON.parse(fs.readFileSync(`${__dirname}/locales/booking/affiliate_cancellation/en.json`, 'utf8'))
const affilaiteBookingConfirmed = JSON.parse(fs.readFileSync(`${__dirname}/locales/booking/affiliate_confirm/en.json`, 'utf8'))
const affiliateInvoice = JSON.parse(fs.readFileSync(`${__dirname}/locales/booking/affiliate_invoice/en.json`, 'utf-8'))
const affiliatePayment = JSON.parse(fs.readFileSync(`${__dirname}/locales/booking/affiliate_payment/en.json`, 'utf-8'))
const footerLocale = JSON.parse(fs.readFileSync(`${__dirname}/locales/footer/en.json`, 'utf8'))
// review email
const requestReview = JSON.parse(fs.readFileSync(`${__dirname}/locales/review/request/en.json`, 'utf8'));
const rejectReview = JSON.parse(fs.readFileSync(`${__dirname}/locales/review/reject/en.json`, 'utf8'));
const approveReview = JSON.parse(fs.readFileSync(`${__dirname}/locales/review/approve/en.json`, 'utf8'));
const directoryReject = `${__dirname}/locales/review/reject`;
const directoryRequest = `${__dirname}/locales/review/request`;
const directoryApprove = `${__dirname}/locales/review/approve`;
// user email
const resetEmailObj = JSON.parse(fs.readFileSync(`${__dirname}/locales/reset/en.json`, 'utf8'));
const verifyEmailObj = JSON.parse(fs.readFileSync(`${__dirname}/locales/verify/en.json`, 'utf8'));
const bookingRegisteredEmailObj = JSON.parse(fs.readFileSync(`${__dirname}/locales/booking_registered/en.json`, 'utf8'));

const SUPPLIER_CURRENCIES = {
  1: 'THB',
  2: 'USD',
  4: 'SGD',
  6: 'KRW',
  45: 'VND',
}

const BOOKING_EMAIL_READABLE = {
  CUSTOMER_BOOKING_INQUIRY: '[CB001] Customer Inquiry',
  CUSTOMER_INQUIRY_CANCELLATION: '[CB002] Customer Inquiry Cancellation',
  CUSTOMER_BOOKING_CONFIRMED: '[CB003] Customer Booking Confirm',
  CUSTOMER_BOOKING_CANCELLATION: '[CB004] Customer Booking Cancellation',
  CUSTOMER_INVOICE: '[CB005] Customer Invoice',
  SUPPLIER_BOOKING_INQUIRY: '[SP001] Supplier Inquiry',
  SUPPLIER_BOOKING_UNAVAILABLE: '[SP002] Supplier Inquiry Cancallation',
  SUPPLIER_BOOKING_CONFIRMED: '[SP003] Supplier  Booking Confirmed',
  SUPPLIER_BOOKING_CANCELLATION: '[SP004] Supplier Booking Cancallation',
  SUPPLIER_BOOKING_INQUIRY_WITH_CONFIRM: '[SP005] Supplier Inquiry With Confirm',
  // Affiliate email
  AFFILIATE_BOOKING_INQUIRY: '[AAB001] Affiliate Inquiry',
  AFFILIATE_INQUIRY_CANCELLATION: '[AAB002] Affiliate Inquiry Cancellation',
  AFFILIATE_BOOKING_CONFIRMED: '[AAB003] Affiliate Booking Confirm',
  AFFILIATE_BOOKING_CANCELLATION: '[AAB004] Afiliate Booking Cancellation',
  AFFILIATE_INVOICE: '[AAB005] Affiliate Invoice',
  AFFILIATE_CUSTOMER_BOOKING_INQUIRY: '[AC001] Affiliate\'s Customer Inquiry',
  AFFILIATE_CUSTOMER_INQUIRY_CANCELLATION: '[AC002] Affiliate\'s Customer Inquiry Cancellation',
  AFFILIATE_CUSTOMER_BOOKING_CONFIRMED: '[AC003] Affiliate\'s Customer Booking Confirm',
  AFFILIATE_CUSTOMER_BOOKING_CANCELLATION: '[AC004] Affiliate\'s Customer Booking Cancellation',
  AFFILIATE_PAYMENT: '[AAB005] Affiliate Payment',
  // review email type
  REVIEW_REQUEST: '[CR001] Customer Review Request Email',
  REVIEW_REJECT: '[CR002] Customer Review Reject Email',
  REVIEW_APPROVED: '[CR003] Customer Review Approve Email',
  // user email
  VERIFICATION: '[CWU001] Welcome Email (Normal signup)',
  REGISTERED_FROM_BOOKING: '[CBW003] Registration from Booking (With reset password)',
  RESET_PASSWORD: '[CF002] Forget Password',
  CUSTOMER_SURVEY: '[CSU006] Customer Survey',
  CUSTOMER_GENERAL: '[CG007] Customer General Email'
}

const BOOKING_EMAIL_TYPE = {
  CUSTOMER_BOOKING_INQUIRY: 'CUSTOMER_BOOKING_INQUIRY',
  CUSTOMER_GENERAL: 'CUSTOMER_GENERAL',
  CUSTOMER_INQUIRY_CANCELLATION: 'CUSTOMER_INQUIRY_CANCELLATION',
  CUSTOMER_BOOKING_CANCELLATION: 'CUSTOMER_BOOKING_CANCELLATION',
  CUSTOMER_BOOKING_CONFIRMED: 'CUSTOMER_BOOKING_CONFIRMED',
  CUSTOMER_SURVEY: 'CUSTOMER_SURVEY',
  CUSTOMER_INVOICE: 'CUSTOMER_INVOICE',
  SUPPLIER_BOOKING_INQUIRY: 'SUPPLIER_BOOKING_INQUIRY',
  SUPPLIER_BOOKING_UNAVAILABLE: 'SUPPLIER_BOOKING_UNAVAILABLE',
  SUPPLIER_BOOKING_CANCELLATION: 'SUPPLIER_BOOKING_CANCELLATION',
  SUPPLIER_BOOKING_CONFIRMED: 'SUPPLIER_BOOKING_CONFIRMED',
  SUPPLIER_BOOKING_INQUIRY_WITH_CONFIRM: 'SUPPLIER_BOOKING_INQUIRY_WITH_CONFIRM',
  // Affiliate email
  AFFILIATE_BOOKING_INQUIRY: 'AFFILIATE_BOOKING_INQUIRY',
  AFFILIATE_CUSTOMER_BOOKING_INQUIRY: 'AFFILIATE_CUSTOMER_BOOKING_INQUIRY',
  AFFILIATE_INQUIRY_CANCELLATION: 'AFFILIATE_INQUIRY_CANCELLATION',
  AFFILIATE_CUSTOMER_INQUIRY_CANCELLATION: 'AFFILIATE_CUSTOMER_INQUIRY_CANCELLATION',
  AFFILIATE_BOOKING_CANCELLATION: 'AFFILIATE_BOOKING_CANCELLATION',
  AFFILIATE_CUSTOMER_BOOKING_CANCELLATION: 'AFFILIATE_CUSTOMER_BOOKING_CANCELLATION',
  AFFILIATE_BOOKING_CONFIRMED: 'AFFILIATE_BOOKING_CONFIRMED',
  AFFILIATE_CUSTOMER_BOOKING_CONFIRMED: 'AFFILIATE_CUSTOMER_BOOKING_CONFIRMED',
  AFFILIATE_PAYMENT: 'AFFILIATE_PAYMENT',
  AFFILIATE_INVOICE: 'AFFILIATE_INVOICE',
  // review email type
  REVIEW_REQUEST: 'REVIEW_REQUEST',
  REVIEW_REJECT: 'REVIEW_REJECT',
  REVIEW_APPROVED: 'REVIEW_APPROVED',
  // user email
  VERIFICATION: 'VERIFICATION',
  RESET_PASSWORD: 'RESET_PASSWORD',
  REGISTERED_FROM_BOOKING: 'REGISTERED_FROM_BOOKING'
}
// review subject email
const SUBJECT = {
  REVIEW_REQUEST: {
    'en': 'Give feedback on Tour',
    'th': 'Give feedback on Tour',
    'ko': 'Give feedback on Tour',
    'zh': 'Give feedback on Tour',
  },
  REVIEW_REJECT: {
    'en': 'Review Rejected',
    'th': 'Review Rejected',
    'ko': 'Review Rejected',
    'zh': 'Review Rejected',
  },
  REVIEW_APPROVED: {
    'en': 'Review Approved',
    'th': 'Review Approved',
    'ko': 'Review Approved',
    'zh': 'Review Approved',
  },
  VERIFICATION: 'Welcome',
  RESET_PASSWORD: 'Reset Password',
  REGISTERED_FROM_BOOKING: 'Reset your password to use your new account'
}
const EMAIL_SUBJECT_TEXT = {
  CUSTOMER_BOOKING_INQUIRY: {
    pre: {
      en: 'Your Booking Request #',
      ko: '더아시아의 #',
      zh: 'The Asia已经收到您订单编号#',
      th: 'The Asia ได้รับแบบฟอร์มการจอง  #',
    },
    post: {
      en: 'with The Asia Has Been Received',
      ko: '예약이 접수되었습니다',
      zh: '的预定申请',
      th: 'แล้ว',
    },
  },
  CUSTOMER_INQUIRY_CANCELLATION: {
    pre: {
      en: 'The Tour #',
      ko: '더아시아의 #',
      zh: '您在The Asia的订单，编号 #',
      th: 'หมายเลขการจองเลขที่  #',
    },
    post: {
      en: ' Requested With The Asia Is Not Available',
      ko: ' 예약을 이용할 수 없습니다.',
      zh: '已确认',
      th: 'กับ The Asia ได้รับการยกเลิกแล้ว',
    },
  },
  CUSTOMER_BOOKING_CANCELLATION: {
    pre: {
      en: 'Your Booking #',
      ko: '더아시아의 #',
      zh: '您在The Asia的订单，编号 #',
      th: 'หมายเลขการจองเลขที่  #',
    },
    post: {
      en: 'with The Asia Has Been Cancelled',
      ko: '예약이 취소되었습니다.',
      zh: '已确认',
      th: 'กับ The Asia ได้รับการยกเลิกแล้ว',
    },
  },
  CUSTOMER_BOOKING_CONFIRMED: {
    pre: {
      en: 'Your Booking #',
      ko: '더아시아의 #',
      zh: '您在The Asia的订单，编号 #',
      th: 'หมายเลขการจองเลขที่  #',
    },
    post: {
      en: 'with The Asia Has Been Confirmed',
      ko: '예약이 확정되었습니다!',
      zh: '已确认',
      th: 'กับ The Asia ได้รับการยืนยันแล้ว',
    },
  },
}

const getCancellationReason = (booking) => {
  const Cancellations = app.models.Cancellations
  const cancellationReasons = Cancellations.find({ where: { booking_id: booking.id } })
  return cancellationReasons
}

const emailSubject = (data, langCode = 'en', type) => {
  const { booking_no = 0, booking_method_id, affiliate_company_name } = data
  const affiliateCompanyText = booking_method_id === 3 && affiliate_company_name
    ? ` with ${affiliate_company_name}`
    : '';
  switch (type) {
    case BOOKING_EMAIL_TYPE.CUSTOMER_BOOKING_INQUIRY:
    case BOOKING_EMAIL_TYPE.CUSTOMER_INQUIRY_CANCELLATION:
    case BOOKING_EMAIL_TYPE.CUSTOMER_BOOKING_CANCELLATION:
    case BOOKING_EMAIL_TYPE.CUSTOMER_BOOKING_CONFIRMED:
      return `${EMAIL_SUBJECT_TEXT[type].pre[langCode]} ${booking_no} ${EMAIL_SUBJECT_TEXT[type].post[langCode]}`
    case BOOKING_EMAIL_TYPE.CUSTOMER_GENERAL:
      return `Your Booking Inquiry ${booking_no}`
    case BOOKING_EMAIL_TYPE.CUSTOMER_SURVEY:
      return `Customer feedback for booking ${booking_no}`
    case BOOKING_EMAIL_TYPE.CUSTOMER_INVOICE:
      return `Customer Invoice for booking ${booking_no}`
    case BOOKING_EMAIL_TYPE.SUPPLIER_BOOKING_INQUIRY:
    case BOOKING_EMAIL_TYPE.SUPPLIER_BOOKING_INQUIRY_WITH_CONFIRM:
      return `The Asia Booking Inquiry ${booking_no}`
    case BOOKING_EMAIL_TYPE.SUPPLIER_BOOKING_CONFIRMED:
      return `Booking # ${booking_no} with The Asia Confirmed`
    case BOOKING_EMAIL_TYPE.SUPPLIER_BOOKING_UNAVAILABLE:
    case BOOKING_EMAIL_TYPE.SUPPLIER_BOOKING_CANCELLATION:
      return `Booking # ${booking_no} with The Asia Cancelled.`

    case BOOKING_EMAIL_TYPE.AFFILIATE_BOOKING_INQUIRY:
    case BOOKING_EMAIL_TYPE.AFFILIATE_CUSTOMER_BOOKING_INQUIRY:
      return `Your Booking Request #${booking_no} has been received`
    case BOOKING_EMAIL_TYPE.AFFILIATE_INQUIRY_CANCELLATION:
    case BOOKING_EMAIL_TYPE.AFFILIATE_CUSTOMER_INQUIRY_CANCELLATION:
      return `The Tour #${booking_no} requested${affiliateCompanyText} is not available`
    case BOOKING_EMAIL_TYPE.AFFILIATE_BOOKING_CANCELLATION:
    case BOOKING_EMAIL_TYPE.AFFILIATE_CUSTOMER_BOOKING_CANCELLATION:
      return `Your Booking #${booking_no}${affiliateCompanyText} has been cancelled`
    case BOOKING_EMAIL_TYPE.AFFILIATE_BOOKING_CONFIRMED:
    case BOOKING_EMAIL_TYPE.AFFILIATE_CUSTOMER_BOOKING_CONFIRMED:
      return `Your Booking #${booking_no}${affiliateCompanyText} has been confirmed`
    case BOOKING_EMAIL_TYPE.AFFILIATE_INVOICE:
      return `Booking # ${booking_no} Invoice`
    case BOOKING_EMAIL_TYPE.AFFILIATE_PAYMENT:
      return `Booking # ${booking_no} Payment link`

    case BOOKING_EMAIL_TYPE.REVIEW_REQUEST:
    case BOOKING_EMAIL_TYPE.REVIEW_REJECT:
    case BOOKING_EMAIL_TYPE.REVIEW_APPROVED:
      return `${SUBJECT[type][langCode]}`
    case BOOKING_EMAIL_TYPE.VERIFICATION:
      return `${SUBJECT.VERIFICATION}`
    case BOOKING_EMAIL_TYPE.RESET_PASSWORD:
      return `${SUBJECT.RESET_PASSWORD}`
    case BOOKING_EMAIL_TYPE.REGISTERED_FROM_BOOKING:
      return `${SUBJECT.REGISTERED_FROM_BOOKING}`
    default:
      return ''
  }
}

const configure_i18n = (directory, lang_code) => {
  i18n.configure({
    locales: [lang_code],
    directory,
  });
  i18n.setLocale(lang_code);
}

const emailHTMLBody = (data, lang_code, email_type) => {
  let directory = ''
  let footer_directory = ''
  let emailData = {}
  let ejsPath = ''
  // let emailDataFieldName
  const keyCustomerBookingOnRequestObj = Object.keys(customerBookingOnRequestObj)
  const keyCustomerBookingInquiryObj = Object.keys(customerBookingInquiryObj)
  const keyCustomerInquiryCancellation = Object.keys(customerInquiryCancellation)
  const keyCustomerBookingCancellation = Object.keys(customerBookingCancellation)
  const keyCustomerBookingConfirmed = Object.keys(customerBookingConfirmed)
  const keyCustomerInvoice = Object.keys(customerInvoice)
  const keyCustomerSurvey = Object.keys(customerSurvey)
  const keySupplierBookingConfirmed = Object.keys(supplierBookingConfirmed)
  const keySupplierBookingCancellation = Object.keys(supplierBookingCancellation)
  const keySupplierBookingUnavailable = Object.keys(supplierBookingUnavailable)
  const keySupplierCanceledBooking = Object.keys(supplierCanceledBooking)
  const keySupplierInquiryConfirm = Object.keys(supplierInquiryConfirm)
  const keyAffiliateInquiry = Object.keys(affilaiteInquiry)
  const keyAffiliateInquiryCancellation = Object.keys(affilaiteInquiryCancellation)
  const keyAffiliateBookingCancellation = Object.keys(affilaiteBookingCancellation)
  const keyAffiliateBookingConfirm = Object.keys(affilaiteBookingConfirmed)
  const keyAffiliateInvoice = Object.keys(affiliateInvoice)
  const keyAffiliatePayment = Object.keys(affiliatePayment)
  const keyFooter = Object.keys(footerLocale)
  // review email locale
  const keysRequest = Object.keys(requestReview);
  const keysReject = Object.keys(rejectReview);
  const keysApprove = Object.keys(approveReview);
  // email user
  const keysReset = Object.keys(resetEmailObj);
  const keysVerify = Object.keys(verifyEmailObj);
  const keysRegisteredBooking = Object.keys(bookingRegisteredEmailObj);

  emailData = Object.assign(data)
  footer_directory = `${__dirname}/locales/footer`;
  configure_i18n(footer_directory, lang_code);
  _.each(keyFooter, (key) => {
    emailData[key] = i18n.__(key);
  });
  switch (email_type) {
    case BOOKING_EMAIL_TYPE.CUSTOMER_BOOKING_INQUIRY:
      directory = `${__dirname}/locales/booking/on_request`;
      // emailData = Object.assign(data)
      configure_i18n(directory, lang_code);
      _.each(keyCustomerBookingOnRequestObj, (key) => {
        emailData[key] = i18n.__(key);
      });
      ejsPath = path.resolve(__dirname, '../views/booking/customer_on_request.ejs')
      break;
    case BOOKING_EMAIL_TYPE.CUSTOMER_GENERAL:
      directory = `${__dirname}/locales/booking/ack`;
      data.product_image = `${data.product_image}?w=267&h=176&fit=crop`
      // emailData = Object.assign(data)
      configure_i18n(directory, lang_code);
      _.each(keyCustomerBookingInquiryObj, (key) => {
        emailData[key] = i18n.__(key);
      });
      ejsPath = path.resolve(__dirname, '../views/booking/customer_acknowledge.ejs')
      break;
    case BOOKING_EMAIL_TYPE.SUPPLIER_BOOKING_CONFIRMED:
      directory = `${__dirname}/locales/booking/supplier_confirm`;
      // emailData = Object.assign(data)
      configure_i18n(directory, lang_code);
      _.each(keySupplierBookingConfirmed, (key) => {
        emailData[key] = i18n.__(key);
      });
      ejsPath = path.resolve(__dirname, '../views/booking/supplier_confirmed.ejs')
      break;
    case BOOKING_EMAIL_TYPE.CUSTOMER_BOOKING_CANCELLATION:
      directory = `${__dirname}/locales/booking/customer_cancellation`;

      // emailData = Object.assign(data)
      configure_i18n(directory, lang_code);
      _.each(keyCustomerBookingCancellation, (key) => {
        emailData[key] = i18n.__(key);
      });

      ejsPath = path.resolve(__dirname, '../views/booking/customer_booking_cancellation.ejs')
      break;
    case BOOKING_EMAIL_TYPE.CUSTOMER_INQUIRY_CANCELLATION:
      directory = `${__dirname}/locales/booking/inquiry_cancellation`;

      // emailData = Object.assign(data)
      configure_i18n(directory, lang_code);
      _.each(keyCustomerInquiryCancellation, (key) => {
        emailData[key] = i18n.__(key);
      });

      ejsPath = path.resolve(__dirname, '../views/booking/customer_inquiry_cancellation.ejs')
      break;
    case BOOKING_EMAIL_TYPE.CUSTOMER_INVOICE:
      directory = `${__dirname}/locales/booking/customer_invoice`;
      // emailData = Object.assign(data)
      configure_i18n(directory, lang_code);
      _.each(keyCustomerInvoice, (key) => {
        emailData[key] = i18n.__(key);
      });

      ejsPath = path.resolve(__dirname, '../views/booking/customer_invoice.ejs')
      break;
    case BOOKING_EMAIL_TYPE.CUSTOMER_SURVEY:
      directory = `${__dirname}/locales/booking/survey`;
      data.feedback_url = `${WEBSITE_URL}/account/reviews?type=addreview&bookingId=${data.booking_id}`
      emailData = Object.assign(data)
      configure_i18n(directory, lang_code);
      _.each(keyCustomerSurvey, (key) => {
        emailData[key] = i18n.__(key);
      });

      ejsPath = path.resolve(__dirname, '../views/booking/customer_survey.ejs')
      break;
    case BOOKING_EMAIL_TYPE.SUPPLIER_BOOKING_INQUIRY:
      directory = `${__dirname}/locales/booking/supplier_inquiry_confirm`;

      // emailData = Object.assign(data)
      configure_i18n(directory, lang_code);
      _.each(keySupplierInquiryConfirm, (key) => {
        emailData[key] = i18n.__(key);
      });

      ejsPath = path.resolve(__dirname, '../views/booking/supplier_inquiry.ejs')
      break;
    case BOOKING_EMAIL_TYPE.SUPPLIER_BOOKING_INQUIRY_WITH_CONFIRM:
      directory = `${__dirname}/locales/booking/supplier_inquiry_confirm`;

      // emailData = Object.assign(data)
      configure_i18n(directory, lang_code);
      _.each(keySupplierInquiryConfirm, (key) => {
        emailData[key] = i18n.__(key);
      });

      emailData['suppliers_app_url'] = isProduction ? 'https://suppliers.theasia.com' : 'https://suppliers.theasiadev.com'
      ejsPath = path.resolve(__dirname, '../views/booking/supplier_inquiry_with_confirm.ejs')
      break;
    case BOOKING_EMAIL_TYPE.CUSTOMER_BOOKING_CONFIRMED:
      directory = `${__dirname}/locales/booking/confirm`;

      // emailData = Object.assign(data)
      configure_i18n(directory, lang_code);
      _.each(keyCustomerBookingConfirmed, (key) => {
        emailData[key] = i18n.__(key);
      });

      ejsPath = path.resolve(__dirname, '../views/booking/customer_confirmed.ejs')
      break;
    case BOOKING_EMAIL_TYPE.SUPPLIER_BOOKING_CANCELLATION:
      directory = `${__dirname}/locales/booking/supplier_cancellation`;
      // emailData = Object.assign(data)
      configure_i18n(directory, lang_code);
      _.each(keySupplierBookingCancellation, (key) => {
        emailData[key] = i18n.__(key);
      });
      ejsPath = path.resolve(__dirname, '../views/booking/supplier_booking_cancellation.ejs')
      break;
    case BOOKING_EMAIL_TYPE.SUPPLIER_BOOKING_UNAVAILABLE:
      directory = `${__dirname}/locales/booking/supplier_booking_unavailable`;
      emailData = Object.assign(data)
      configure_i18n(directory, lang_code);
      _.each(keySupplierBookingUnavailable, (key) => {
        emailData[key] = i18n.__(key);
      });
      ejsPath = path.resolve(__dirname, '../views/booking/supplier_booking_unavailable.ejs')
      break;

    // Affiliate emails
    // TODO: Replace hardcoded language with langid when text has been finalized
    case BOOKING_EMAIL_TYPE.AFFILIATE_BOOKING_INQUIRY:
    case BOOKING_EMAIL_TYPE.AFFILIATE_CUSTOMER_BOOKING_INQUIRY:
      directory = `${__dirname}/locales/booking/affiliate_inquiry`;
      emailData = Object.assign(data)
      configure_i18n(directory, 'en');
      _.each(keyAffiliateInquiry, (key) => {
        emailData[key] = i18n.__(key);
      });
      ejsPath = path.resolve(__dirname, '../views/booking/affiliate_inquiry.ejs')
      break;

    case BOOKING_EMAIL_TYPE.AFFILIATE_INQUIRY_CANCELLATION:
    case BOOKING_EMAIL_TYPE.AFFILIATE_CUSTOMER_INQUIRY_CANCELLATION:
      directory = `${__dirname}/locales/booking/affiliate_inquiry_cancellation`;
      emailData = Object.assign(data)
      configure_i18n(directory, 'en');
      _.each(keyAffiliateInquiryCancellation, (key) => {
        emailData[key] = i18n.__(key);
      });
      ejsPath = path.resolve(__dirname, '../views/booking/affiliate_inquiry_cancellation.ejs')
      break;

    case BOOKING_EMAIL_TYPE.AFFILIATE_BOOKING_CANCELLATION:
    case BOOKING_EMAIL_TYPE.AFFILIATE_CUSTOMER_BOOKING_CANCELLATION:
      directory = `${__dirname}/locales/booking/affiliate_cancellation`;
      emailData = Object.assign(data)
      configure_i18n(directory, 'en');
      _.each(keyAffiliateBookingCancellation, (key) => {
        emailData[key] = i18n.__(key);
      });
      ejsPath = path.resolve(__dirname, '../views/booking/affiliate_cancellation.ejs')
      break;

    case BOOKING_EMAIL_TYPE.AFFILIATE_BOOKING_CONFIRMED:
    case BOOKING_EMAIL_TYPE.AFFILIATE_CUSTOMER_BOOKING_CONFIRMED:
      directory = `${__dirname}/locales/booking/affiliate_confirm`;
      emailData = Object.assign(data)
      configure_i18n(directory, 'en');
      _.each(keyAffiliateBookingConfirm, (key) => {
        emailData[key] = i18n.__(key);
      });
      ejsPath = path.resolve(__dirname, '../views/booking/affiliate_confirm.ejs')
      break;

    case BOOKING_EMAIL_TYPE.AFFILIATE_INVOICE:
      directory = `${__dirname}/locales/booking/affiliate_invoice`;
      emailData = Object.assign(data)
      configure_i18n(directory, 'en');
      _.each(keyAffiliateInvoice, (key) => {
        emailData[key] = i18n.__(key);
      });
      ejsPath = path.resolve(__dirname, '../views/booking/affiliate_invoice.ejs')
      break;
    case BOOKING_EMAIL_TYPE.AFFILIATE_PAYMENT:
      directory = `${__dirname}/locales/booking/affiliate_payment`;
      emailData = Object.assign(data)
      configure_i18n(directory, lang_code);
      _.each(keyAffiliatePayment, (key) => {
        emailData[key] = i18n.__(key);
      });
      ejsPath = path.resolve(__dirname, '../views/booking/affiliate_payment.ejs')
      break;

    // review email call
    case BOOKING_EMAIL_TYPE.REVIEW_REQUEST:

      configure_i18n(directoryRequest, lang_code);
      // console.log('keysReset', keysRequest)
      _.each(keysRequest, (key) => {
        emailData[key] = i18n.__(key);
      });
      // console.log('emailData', emailData);
      emailData.name = data.name;
      emailData.url = data.url;
      emailData.to_email = data.email ? data.email : 'Your Email';
      ejsPath = path.resolve(__dirname, '../../common/views/review/review_request.ejs')
      break;
    case BOOKING_EMAIL_TYPE.REVIEW_REJECT:

      configure_i18n(directoryReject, lang_code);
      // console.log('keysVerify', keysReject)
      _.each(keysReject, (key) => {
        emailData[key] = i18n.__(key);
      });
      emailData.name = data.name;
      emailData.url = data.url;
      emailData.to_email = data.email ? data.email : 'Your Email';
      ejsPath = path.resolve(__dirname, '../../common/views/review/review_reject.ejs')
      break;
    case BOOKING_EMAIL_TYPE.REVIEW_APPROVED:
      configure_i18n(directoryApprove, lang_code);
      // console.log('keysVerify', keysReject)
      _.each(keysApprove, (key) => {
        emailData[key] = i18n.__(key);
      });
      emailData.name = data.name;
      emailData.url = data.url;
      emailData.to_email = data.email ? data.email : 'Your Email';
      // console.log(emailData, 'emaildata')
      ejsPath = path.resolve(__dirname, '../../common/views/review/review_approve.ejs')
      break;
    case BOOKING_EMAIL_TYPE.REGISTERED_FROM_BOOKING:
      directory = `${__dirname}/locales/booking_registered`;
      configure_i18n(directory, lang_code);
      _.each(keysRegisteredBooking, (key) => {
        emailData[key] = i18n.__(key);
      });
      emailData.name = data.name;
      emailData.url = data.url;
      emailData.to_email = data.email ? data.email : 'Your Email';
      ejsPath = path.resolve(__dirname, '../../common/views/reset-password/booking_registered.ejs')
      break;
    case BOOKING_EMAIL_TYPE.RESET_PASSWORD:
      directory = `${__dirname}/locales/reset`;
      configure_i18n(directory, lang_code);
      _.each(keysReset, (key) => {
        emailData[key] = i18n.__(key);
      });
      emailData.name = data.name;
      emailData.url = data.url;
      emailData.to_email = data.email ? data.email : 'Your Email';
      ejsPath = path.resolve(__dirname, '../../common/views/reset-password/reset_password.ejs')
      break;
    case BOOKING_EMAIL_TYPE.VERIFICATION:
      directory = `${__dirname}/locales/verify`;
      configure_i18n(directory, lang_code);
      _.each(keysVerify, (key) => {
        emailData[key] = i18n.__(key);
      });
      emailData.name = data.name;
      emailData.url = data.url;
      emailData.to_email = data.email ? data.email : 'Your Email';
      ejsPath = path.resolve(__dirname, '../../common/views/welcome/welcome.ejs')
      break;
    default: throw new Error('EMAIL TYPE IS NOT MATCH')
  }

  return htmlclean(loopback.template(ejsPath)(emailData)).replace(/\r/g, '').replace(/\t/g, '').replace(/\n/g, '')
}

const getMediaBucketPath = (mediaPath) => {
  const paths = mediaPath ? mediaPath.split('/') : mediaPath;
  if (paths[paths.length - 1] == '/') {
    return mediaPath
  }
  return `${mediaPath}/`;
}

const getPaymentUrl = booking => {
  if (booking.payment_url) return booking.payment_url;
  const payment = booking.payment.find(p => Number(p.payment_status_id) === 0);
  if (!payment || !payment.uuid) return '';
  return `${AAB_PAYMENT_URL}/${payment.uuid}`;
};

const translateBookingEmailField = async (booking, langId, fieldName) => {
  const langVar = {
    code: { 1: 'en', 2: 'ko', 3: 'zh', 4: 'th' },
    single: {
      adult_pax: { 1: 'Adult', 2: '성인', 3: '成人', 4: 'ผู้ใหญ่' },
      child_pax: { 1: 'Child', 2: '어린이', 3: '孩子', 4: 'เด็ก' },
      infant_pax: { 1: 'Infant', 2: '유아', 3: '婴幼儿', 4: 'ทารก' },
    },
    multiple: {
      adult_pax: { 1: 'Adults', 2: '성인', 3: '成人', 4: 'ผู้ใหญ่' },
      child_pax: { 1: 'Children', 2: '어린이', 3: '孩子', 4: 'เด็ก' },
      infant_pax: { 1: 'Infants', 2: '유아', 3: '婴幼儿', 4: 'ทารก' },
    },
  }
  switch (fieldName) {
    case 'meeting_point':
    case 'meeting_time':
    case 'opening_time':
    case 'name':
    case 'supplier_product_name':
    case 'show_time':
    case 'tour_departure':
      if (getSafe(() => booking.sub_product[fieldName])) {
        if (langId == 1) return getSafe(() => booking.sub_product[fieldName]) || ''
        return getSafe(() => booking.sub_product.localization.find(e => e.lang_id == langId)[fieldName]) || getSafe(() => booking.sub_product[fieldName]) || ''
      }
      if (langId == 1) return getSafe(() => booking.tour[fieldName]) || ''
      return getSafe(() => booking.tour.localization.find(e => e.lang_id == langId)[fieldName]) || getSafe(() => booking.tour[fieldName]) || ''
    case 'product_name':
      if (langId == 1) return getSafe(() => booking.tour.name) || ''
      return getSafe(() => booking.tour.localization.find(e => e.lang_id == langId).name) || getSafe(() => booking.tour.name) || ''
    case 'short_description':
      if (langId == 1) return getSafe(() => JSON.parse(booking.sub_product[fieldName]).join(', '))
      return getSafe(() => JSON.parse(booking.sub_product.localization.find(e => e.lang_id == langId)[fieldName]).join(', ')) || getSafe(() => JSON.parse(booking.sub_product[fieldName]).join(', '))
    case 'product_type':
      if (getSafe(() => booking.sub_product.product_features) || '') {
        const subProductFeaturesArray = JSON.parse(booking.sub_product.product_features)
        if (!Array.isArray(subProductFeaturesArray) || subProductFeaturesArray.length < 1) {
          return ''
        }
        const subProductFeatures = parseInt(subProductFeaturesArray[0], 10)
        if (langId == 1) {
          const featureData = await app.models.Features.findOne({ where: { id: subProductFeatures } })
          return featureData.name
        } else {
          const featureLangData = await app.models.FeaturesLang.findOne({ where: { feature_id: subProductFeatures, lang_id: langId } })
          return featureLangData.name
        }
      }
      if (langId == 1) return getSafe(() => booking.tour.features.map(f => f.feature.name).join(', '))
      return getSafe(() => booking.tour.features.map(f => f.feature.localization.find(fl => fl.lang_id == langId).name).join(', ')) || getSafe(() => booking.tour.features.map(f => f.feature.name).join(', '))
    case 'product_image': {
      let productImage = 'https://theasia.imgix.net/emails/images/img2.jpg'
      if (getSafe(() => booking.tour.tour_medias.length && booking.tour.tour_medias[0].details)) {
        const media = booking.tour.tour_medias[0].details
        if (media && media.bucket_path && media.name) {
          productImage = `https://theasia.imgix.net/${getMediaBucketPath(media.bucket_path)}${media.name}`
        }
      }
      return productImage
    }
    case 'font_family_name_link':
      switch (langId) {
        case '1': return ['Raleway:300', 'Open+Sans'];
        case '2': return ['Raleway:300', 'Nanum+Gothic', 'Open+Sans'];
        case '3': return ['Raleway:300', 'Open+Sans'];
        case '4': return ['Raleway:300', 'Prompt', 'Open+Sans'];
        default: return ['Raleway:300', 'Open+Sans'];
      }
    // for fallback font we have add for test it worked in local machine
    // we can change it all after andrew choose all the list
    // font sequence 1. main google font, 2.open sans, 3. mac font, 4. windows font
    case 'font_family_name_name':
      switch (langId) {
        case '1': return 'Raleway, Open Sans, sans-serif';
        case '2': return 'Raleway, Nanum Gothic, Open Sans, sans-serif';
        case '3': return 'Raleway, Open Sans, sans-serif, Apple LiGothic, Microsoft JhengHei';
        case '4': return 'Raleway, Prompt, Open Sans, sans-serif, arial';
        default: return 'Raleway, Open Sans, sans-serif';
      }
    case 'adult_pax':
    case 'child_pax':
    case 'infant_pax':
      if (getSafe(() => booking.tour.product_type) != 1) return ''
      if (getSafe(() => booking.input_details[fieldName]) == 0) return ''
      if (getSafe(() => booking.input_details[fieldName]) == 1) return `${getSafe(() => booking.input_details[fieldName])} x ${getSafe(() => langVar.single[fieldName][langId])} `
      return `${getSafe(() => booking.input_details[fieldName])} x ${getSafe(() => langVar.multiple[fieldName][langId])} `
    case 'vehicle_pax':
      if (getSafe(() => booking.tour.product_type) != 2) return ''
      return `${getSafe(() => booking.input_details.adult_pax)}`
    case 'luggage_pax':
      if (getSafe(() => booking.tour.product_type) != 3) return ''
      return `${getSafe(() => booking.input_details.adult_pax)}`
    case 'sim_pax':
      if (getSafe(() => booking.tour.product_type) != 4) return ''
      return `${getSafe(() => booking.input_details.adult_pax)}`
    case 'cancellation_policy':
      if (langId == 1) return getSafe(() => booking.sub_product[fieldName].name) || fieldName
      return getSafe(() => booking.sub_product[fieldName].localization.find(e => e.lang_id == langId).name) || getSafe(() => booking.sub_product[fieldName].name) || fieldName
      case 'cancellation_policy_description':
      if (langId == 1) return getSafe(() => booking.sub_product.cancellation_policy.description) || ''
      return getSafe(() => booking.sub_product.cancellation_policy.localization.find(e => e.lang_id == langId).description) || getSafe(() => booking.sub_product.cancellation_policy.description) || ''
      case 'cities':
      if (langId == 1) return getSafe(() => booking.tour[fieldName].name) || fieldName
      return getSafe(() => booking.tour[fieldName].localization.find(e => e.lang_id == langId).name) || getSafe(() => booking.tour[fieldName].name) || fieldName
    case 'trip_date':
      moment.locale(langVar.code[langId]);
      return moment(booking.trip_starts).format('LL')
      case 'trip_starts':
      moment.locale(langVar.code[langId]);
      return moment(booking.trip_starts).format('LL')
    case 'trip_ends':
      moment.locale(langVar.code[langId]);
      return moment(booking.trip_ends).format('LL')
    case 'booking_date':
      moment.locale(langVar.code[langId]);
      return moment(booking.created_at).format('LL')
    case 'birthday':
      if (!getSafe(() => booking.bookingUserIdFkeyrel.birthday)) return ''
      moment.locale(langVar.code[langId]);
      return moment(booking.bookingUserIdFkeyrel.birthday).format('LL')
    case 'total':
      return formatCurrency(booking.booking_currency_code, booking.total);
    case 'total_usd':
      return formatCurrency('USD', booking.total / booking.exchange_rate);
    case 'website_url':
      if (langId == 1) return WEBSITE_URL
      return `${WEBSITE_URL}/${langVar.code[langId].toLowerCase()}`
    case 'product_url':
      if (langId == 1) return `${WEBSITE_URL}/discover/${booking.tour.slug}`
      return `${WEBSITE_URL}/${langVar.code[langId].toLowerCase()}/discover/${booking.tour.slug}`
    case 'refund_amount':
      const refund_amount_obj = booking.payment.find((payment_obj) => {
        return payment_obj.payment_status_id === '4'
      })
      return getSafe(() => formatCurrency(booking.booking_currency_code, refund_amount_obj.total_refund)) || 0
    case 'refund_amount_usd':
      const refund_amount_usd_obj = booking.payment.find((payment_obj) => {
        return payment_obj.payment_status_id === '4'
      })
      return getSafe(() => formatCurrency('USD', refund_amount_usd_obj.total_refund / booking.exchange_rate)) || 0
    case 'refund_fee':
      const refund_fee_obj = booking.payment.find((payment_obj) => {
        return payment_obj.payment_status_id === '4'
      })
      return getSafe(() => formatCurrency(booking.booking_currency_code, booking.total - refund_fee_obj.total_refund)) || 0
    case 'refund_fee_usd':
      const refund_fee_usd_obj = booking.payment.find((payment_obj) => {
        return payment_obj.payment_status_id === '4'
      })
      return getSafe(() => formatCurrency('USD', (booking.total - refund_fee_usd_obj.total_refund) / booking.exchange_rate)) || 0
    case 'similar_tours':
      if ((langId == 1) || (!getSafe(() => booking.similarTours))) return getSafe(() => booking.similarTours) || []
      for (let i = 0; i < booking.similarTours.length; i++) {
        booking.similarTours[i].name = getSafe(() => booking.similarTours[i].localization().find(e => e.lang_id == langId).name) || getSafe(() => booking.similarTours[i].name) || []
      }
      return booking.similarTours
    case 'contact_phone_number':
      switch (booking.billingCountryIdFkeyrel.iso_code) {
        case 'US': return 'USA: +1-818-798-3858';
        case 'CN': return 'CHINA: +86-400-842-8820';
        case 'KR': return 'KOREA: +82-70-7488-2237';
        case 'TH': return 'THAILAND: +66-2-104-0808';
        case 'SG': return 'SINGAPORE: +65-3157-0380';
        default: return 'THAILAND: +66-2-104-0808';
      }
    case 'contact_des_phone_number':
      switch (booking.tour.cities.city_country.iso_code) {
        case 'US': return 'USA: +1-818-798-3858';
        case 'CN': return 'CHINA: +86-400-842-8820';
        case 'KR': return 'KOREA: +82-70-7488-2237';
        case 'TH': return 'THAILAND: +66-2-104-0808';
        case 'SG': return 'SINGAPORE: +65-3157-0380';
        default: return 'THAILAND: +66-2-104-0808';
      }
    case 'affiliate_logo': {
      const logo = getSafe(() => booking.bookingUserIdFkeyrel.affiliates.logo)
      return logo ? `https://theasia.imgix.net/${logo}?fit=crop&w=200&h=100` : null
    }
    case 'affiliate_company_name':
      return getSafe(() => booking.bookingUserIdFkeyrel.affiliates.company_name)
    case 'affiliate_address':
      return getSafe(() => booking.bookingUserIdFkeyrel.affiliates.address)
    default: return ''
  }
}

const emailData = async (booking, langId, is_no_reply) => {
  const response = {
    name: `${booking.billing_first_name} ${booking.billing_last_name}`,
    user: booking.bookingUserIdFkeyrel.email,
    to_email: Number(booking.booking_method_id) === 3
    ? booking.booking_email
    : booking.bookingUserIdFkeyrel.email, // for footer use and customer email in content
    birthday: await translateBookingEmailField(booking, langId, 'birthday'),
    supplier: getSafe(() => booking.tour.suppliers.reservation_email) || 'jaebum.kim@theasia.com',
    promocode: booking.promocode || '',
    passport_number: booking.passport_number || '',
    supplier_id: booking.tour.suppliers.id,
    supplier_name: booking.tour.suppliers.name,
    special_request: booking.special_request,
    booking_no: booking.booking_no,
    booking_id: booking.id,
    booking_method_id: Number(booking.booking_method_id),
    supplier_adult_price: formatCurrency(booking.supplier_currency_code, booking.price_details.supplierPrice.adults),
    supplier_child_price: formatCurrency(booking.supplier_currency_code, booking.price_details.supplierPrice.children),
    supplier_infant_price: formatCurrency(booking.supplier_currency_code, booking.price_details.supplierPrice.infants),
    supplier_total: formatCurrency(booking.supplier_currency_code,
                                ((booking.input_details.adult_pax * booking.price_details.supplierPrice.adults)
                              + (booking.input_details.child_pax * booking.price_details.supplierPrice.children)
                              + (booking.input_details.infant_pax * booking.price_details.supplierPrice.infants))),
    similar_tours: await translateBookingEmailField(booking, langId, 'similar_tours'),
    supplier_currency_code: booking.supplier_currency_code || SUPPLIER_CURRENCIES[booking.tour.currency_id] || 'USD', // or USD will send wrong data
    meeting_point: await translateBookingEmailField(booking, langId, 'meeting_point'),
    meeting_time: await translateBookingEmailField(booking, langId, 'meeting_time'),
    opening_time: await translateBookingEmailField(booking, langId, 'opening_time'),
    show_time: await translateBookingEmailField(booking, langId, 'show_time'),
    tour_departure: await translateBookingEmailField(booking, langId, 'tour_departure'),
    product_type: await translateBookingEmailField(booking, langId, 'product_type'),
    product_name: await translateBookingEmailField(booking, langId, 'product_name'),
    sub_product_name: await translateBookingEmailField(booking, langId, 'name'),
    supplier_product_name: await translateBookingEmailField(booking, langId, 'supplier_product_name'),
    product_description: await translateBookingEmailField(booking, langId, 'short_description'),
    product_image: await translateBookingEmailField(booking, langId, 'product_image'),
    category_type: booking.tour.category_type_id,
    total_vehicle: parseInt(booking.input_details.adult_pax, 10),
    total_pax: parseInt(booking.input_details.adult_pax, 10) + parseInt(booking.input_details.child_pax, 10) + parseInt(booking.input_details.infant_pax, 10),
    adult_pax: await translateBookingEmailField(booking, langId, 'adult_pax'),
    child_pax: await translateBookingEmailField(booking, langId, 'child_pax'),
    infant_pax: await translateBookingEmailField(booking, langId, 'infant_pax'),
    vehicle_pax: await translateBookingEmailField(booking, langId, 'vehicle_pax'),
    luggage_pax: await translateBookingEmailField(booking, langId, 'luggage_pax'),
    sim_pax: await translateBookingEmailField(booking, langId, 'sim_pax'),
    adult_price: Number(booking.booking_method_id) === 3
      ? formatCurrency(booking.booking_currency_code, Number(booking.price_details.sellingPrice.adults))
      : formatCurrency(booking.booking_currency_code, Number(Number(booking.price_details.sellingPrice.adults) / Number(booking.supplier_exchange_rate)) * Number(booking.exchange_rate)),
    child_price: Number(booking.booking_method_id) === 3
      ? formatCurrency(booking.booking_currency_code, Number(booking.price_details.sellingPrice.children))
      : formatCurrency(booking.booking_currency_code, Number(Number(booking.price_details.sellingPrice.children) / Number(booking.supplier_exchange_rate)) * Number(booking.exchange_rate)),
    infant_price: Number(booking.booking_method_id) === 3
      ? formatCurrency(booking.booking_currency_code, Number(booking.price_details.sellingPrice.infants))
      : formatCurrency(booking.booking_currency_code, Number(Number(booking.price_details.sellingPrice.infants) / Number(booking.supplier_exchange_rate)) * Number(booking.exchange_rate)),
    cancellation_policy: await translateBookingEmailField(booking, langId, 'cancellation_policy'),
    cancellation_policy_description: await translateBookingEmailField(booking, langId, 'cancellation_policy_description'),
    product_city: await translateBookingEmailField(booking, langId, 'cities'),
    product_city_url: booking.tour.cities.name,
    trip_date: await translateBookingEmailField(booking, langId, 'trip_date'),
    trip_starts: await translateBookingEmailField(booking, langId, 'trip_starts'),
    trip_ends: await translateBookingEmailField(booking, langId, 'trip_ends'),
    drop_off_place: booking.drop_off_place,
    hotel_name: booking.hotel_name,
    pickup_time: booking.pickup_time,
    pickup_place: booking.pickup_place,
    pickup_location_time: booking.pickup_location_time || '',
    selected_time: booking.selected_time || '',
    nationality: booking.nationalityRel.name,
    currency_code: booking.booking_currency_code,
    total: await translateBookingEmailField(booking, langId, 'total'),
    total_usd: await translateBookingEmailField(booking, langId, 'total_usd'),
    refund_amount: await translateBookingEmailField(booking, langId, 'refund_amount'),
    refund_amount_usd: await translateBookingEmailField(booking, langId, 'refund_amount_usd'),
    refund_fee: await translateBookingEmailField(booking, langId, 'refund_fee'),
    refund_fee_usd: await translateBookingEmailField(booking, langId, 'refund_fee_usd'),
    website_url: await translateBookingEmailField(booking, langId, 'website_url'),
    product_url: await translateBookingEmailField(booking, langId, 'product_url'),
    tour_name: booking.tour.name,
    billing_phone: booking.billing_phone,
    flight_number: booking.flight_number,
    booking_date: await translateBookingEmailField(booking, langId, 'booking_date'),
    cancellation_reasons: booking.cancellationReasons,
    lang_id: langId,
    contact_phone_number: await translateBookingEmailField(booking, langId, 'contact_phone_number'),
    contact_des_phone_number: await translateBookingEmailField(booking, langId, 'contact_des_phone_number'),
    font_family_name_link: await translateBookingEmailField(booking, langId, 'font_family_name_link'),
    font_family_name_name: await translateBookingEmailField(booking, langId, 'font_family_name_name'),
    is_no_reply,
    affiliate_logo: await translateBookingEmailField(booking, langId, 'affiliate_logo'),
    affiliate_company_name: await translateBookingEmailField(booking, langId, 'affiliate_company_name'),
    affiliate_address: await translateBookingEmailField(booking, langId, 'affiliate_address'),
    payment_url: getPaymentUrl(booking),
  }
  return response
}

const getEmailData = async (booking, lang_id, is_no_reply) => ({
  ...await emailData(booking, lang_id, is_no_reply),
  supplierData: await emailData(booking, 1, is_no_reply),
})

const getVoucherAttachments = async (booking_id) => {
  const voucherObj = await app.models.Voucher.createVoucherFromHtml(booking_id)
  const voucherBinary = fs.readFileSync(voucherObj.filePath)
  const content = Buffer.from(voucherBinary).toString('base64')
  if (fs.existsSync(voucherObj.filePath)) {
    fs.unlink(voucherObj.filePath, console.error)
  }
  return { content, type: 'application/pdf', filename: `voucher${booking_id}.pdf` }
}

// const getEmailObject = async (booking_id, bookingEmailType, lang_id = undefined, sender_id = 0) => {
  const getEmailObject = async (booking, bookingEmailType, lang_id = undefined, sender_id = 0, is_no_reply = true) => {
    try {
      if (!BOOKING_EMAIL_TYPE[bookingEmailType]) return Promise.resolve(undefined)
      const cancelReason = ['SUPPLIER_BOOKING_CANCELLATION', 'CUSTOMER_BOOKING_CANCELED']
      if (cancelReason.indexOf(bookingEmailType) >= 0) {
        booking.cancellationReasons = await getCancellationReason(booking)
      }
      const Booking = app.models.Booking
      // const booking = (await Booking.findById(booking_id, Booking.defaultFilter)).toObject()
      if (!lang_id) lang_id = booking.bookingUserIdFkeyrel.language_id || 0
      // for every supplier email we will use english only (lang_id = 1)
      const supplierEmailList = ['SUPPLIER_BOOKING_INQUIRY', 'SUPPLIER_BOOKING_CANCELLATION', 'SUPPLIER_BOOKING_CONFIRMED']
      if (supplierEmailList.indexOf(bookingEmailType) >= 0) {
        lang_id = 1
      }
      const langObject = await app.models.Languages.findById(lang_id)
      const data = await getEmailData(booking, lang_id, is_no_reply)
      const emailObject = {
        to: data.user,
        from: noreplyEmail,
        bcc,
        subject: emailSubject(data, langObject.code, bookingEmailType),
        text: emailSubject(data, langObject.code, bookingEmailType),
        html: emailHTMLBody(data, langObject.code, bookingEmailType),
        activityObject: {
          // model_id: booking_id,
          model_id: booking.id,
          user_id: sender_id,
          model_name: 'Booking',
          action_taken: `Send Email to ${BOOKING_EMAIL_READABLE[bookingEmailType]}`,
          action_result: 'Success',
          email_template: bookingEmailType,
        },
      }
      if ((/SUPPLIER/g).test(bookingEmailType)) {
        emailObject.to = data.supplier
        emailObject.from = bizEmail
      }
      // For AAB email to affiliate, use affiliate's email
      if ((/^AFFILIATE(?!_CUSTOMER)/g).test(bookingEmailType) && Number(booking.booking_method_id) === 3) {
        emailObject.to = booking.bookingUserIdFkeyrel.affiliates.email
      }
      // For AAB email to customer, use booking_email instead of user relation from booking
      if ((/^AFFILIATE_CUSTOMER/g).test(bookingEmailType) && Number(booking.booking_method_id) === 3) {
        emailObject.to = booking.booking_email
      }
      if (bookingEmailType === BOOKING_EMAIL_TYPE.CUSTOMER_BOOKING_CONFIRMED) {
        emailObject.attachments = [await getVoucherAttachments(data.booking_id)]
      }
      return Promise.resolve(emailObject)
    } catch (error) {
      console.log(error)
      return Promise.resolve(undefined)
    }
  }

/**
 * Returns pluralized form of name
 * @param {String} name age group name
 * @returns {String|undefined}
 */
const pluralize = (name) => {
  name = name.toLowerCase()
  switch (true) {
    case /^adult/.test(name):
      return 'adults'
    case /^child/.test(name):
      return 'children'
    case /^infant/.test(name):
      return 'infants'
    default:
      return undefined
  }
}

module.exports = {
  BOOKING_EMAIL_READABLE,
  BOOKING_EMAIL_TYPE,
  getEmailObject,
  pluralize,
}
