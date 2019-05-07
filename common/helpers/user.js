const app = require('../../server/index')
const loopback = require('loopback')
const path = require('path')
const i18n = require('i18n')
const htmlclean = require('htmlclean');
const fs = require('fs');
const _ = require('lodash')

const resetEmailObj = JSON.parse(fs.readFileSync(`${__dirname}/locales/reset/en.json`, 'utf8'));
const verifyEmailObj = JSON.parse(fs.readFileSync(`${__dirname}/locales/verify/en.json`, 'utf8'));
const bookingRegisteredEmailObj = JSON.parse(fs.readFileSync(`${__dirname}/locales/booking_registered/en.json`, 'utf8'));
const affiliateRegistration = JSON.parse(fs.readFileSync(`${__dirname}/locales/affiliate_registration/en.json`, 'utf8'));
const affiliatePasswordReset = JSON.parse(fs.readFileSync(`${__dirname}/locales/affiliate_passwordUpdates/en.json`, 'utf8'));
const supplierRegistration = JSON.parse(fs.readFileSync(`${__dirname}/locales/supplier_registration/en.json`, 'utf8'));
// const suppliers = JSON.parse(fs.readFileSync(`${__dirname}/locales/suppliers/en.json`, 'utf8'));
const footerLocale = JSON.parse(fs.readFileSync(`${__dirname}/locales/footer/en.json`, 'utf8'))

const { constants: { isProduction, noreplyEmail } } = require('../utility')

const bcc = isProduction ? ['vishal.sharma@theasia.com'] : ['vishal.sharma@theasia.com'];
const USER_EMAIL_TYPE = {
  VERIFICATION: 'VERIFICATION',
  RESET_PASSWORD: 'RESET_PASSWORD',
  REGISTERED_FROM_BOOKING: 'REGISTERED_FROM_BOOKING',
  AFFILIATE_REGISTRATION: 'AFFILIATE_REGISTRATION',
  AFFILIATE_PASSWORDRESET: 'AFFILIATE_PASSWORDRESET',
  SUPPLIER_REGISTRATION: 'SUPPLIER_REGISTRATION'
}

const SUBJECT = {
  VERIFICATION: 'Welcome',
  RESET_PASSWORD: 'Reset Password',
  REGISTERED_FROM_BOOKING: 'Reset your password to use your new account',
  AFFILIATE_REGISTRATION: 'Congratulation! Your affiliate account has been created',
  AFFILIATE_PASSWORDRESET: 'Your password has been reset successfully',
  SUPPLIER_REGISTRATION: 'Registration Successful'
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
  const emailData = {}
  let ejsPath = ''
  const keysReset = Object.keys(resetEmailObj);
  const keysAffiliateRegistration = Object.keys(affiliateRegistration);
  const keysAffiliatePasswordReset = Object.keys(affiliatePasswordReset);
  const keysSupplierRegistration = Object.keys(supplierRegistration);
  const keysVerify = Object.keys(verifyEmailObj);
  const keysRegisteredBooking = Object.keys(bookingRegisteredEmailObj);
  const keyFooter = Object.keys(footerLocale)

  let font_family_name_link
  let font_family_name_name

  switch (lang_code) {
    case '1':
      font_family_name_link = ['Raleway:300', 'Open+Sans'];
      font_family_name_name = 'Raleway, Open Sans, sans-serif';
      break;
    case '2':
      font_family_name_link = ['Raleway:300', 'Nanum+Gothic', 'Open+Sans'];
      font_family_name_name = 'Raleway, Nanum Gothic, Open Sans, sans-serif';
      break;
    case '3':
      font_family_name_link = ['Raleway:300', 'Open+Sans'];
      font_family_name_name = 'Raleway, Open Sans, sans-serif, Apple LiGothic, Microsoft JhengHei';
      break;
    case '4':
      font_family_name_link = ['Raleway:300', 'Prompt', 'Open+Sans'];
      font_family_name_name = 'Raleway, Prompt, Open Sans, sans-serif, arial';
      break;
    default:
      font_family_name_link = ['Raleway:300', 'Open+Sans'];
      font_family_name_name = 'Raleway, Open Sans, sans-serif';
      break;
  }

  footer_directory = `${__dirname}/locales/footer`;
  configure_i18n(footer_directory, lang_code);
  _.each(keyFooter, (key) => {
    emailData[key] = i18n.__(key);
  });
  switch (email_type) {
    case USER_EMAIL_TYPE.REGISTERED_FROM_BOOKING:
      directory = `${__dirname}/locales/booking_registered`;
      configure_i18n(directory, lang_code);
      _.each(keysRegisteredBooking, (key) => {
        emailData[key] = i18n.__(key);
      });
      emailData.name = data.name;
      emailData.url = data.url;
      emailData.to_email = data.email ? data.email : 'Your Email';
      emailData.font_family_name_link = font_family_name_link
      emailData.font_family_name_name = font_family_name_name
      emailData.is_no_reply = true
      ejsPath = path.resolve(__dirname, '../../common/views/reset-password/booking_registered.ejs')
      break;
    case USER_EMAIL_TYPE.RESET_PASSWORD:
      directory = `${__dirname}/locales/reset`;
      configure_i18n(directory, lang_code);
      _.each(keysReset, (key) => {
        emailData[key] = i18n.__(key);
      });
      emailData.name = data.name;
      emailData.url = data.url;
      emailData.to_email = data.email ? data.email : 'Your Email';
      emailData.font_family_name_link = font_family_name_link
      emailData.font_family_name_name = font_family_name_name
      emailData.is_no_reply = true
      ejsPath = path.resolve(__dirname, '../../common/views/reset-password/reset_password.ejs')
      break;
    case USER_EMAIL_TYPE.VERIFICATION:
      directory = `${__dirname}/locales/verify`;
      configure_i18n(directory, lang_code);
      _.each(keysVerify, (key) => {
        emailData[key] = i18n.__(key);
      });
      emailData.name = data.name;
      emailData.url = data.url;
      emailData.to_email = data.email ? data.email : 'Your Email';
      emailData.font_family_name_link = font_family_name_link
      emailData.font_family_name_name = font_family_name_name
      emailData.is_no_reply = true
      emailData.website_url = 'https://www.theasia.com';
      ejsPath = path.resolve(__dirname, '../../common/views/welcome/welcome.ejs')
      break;
    case USER_EMAIL_TYPE.AFFILIATE_REGISTRATION:
      directory = `${__dirname}/locales/affiliate_registration`;
      configure_i18n(directory, lang_code);
      _.each(keysAffiliateRegistration, (key) => {
        emailData[key] = i18n.__(key);
      });
      emailData.name = data.name;
      emailData.affiliate_name = data.affiliate_name;
      emailData.url = data.url;
      emailData.to_email = data.email ? data.email : 'Your Email';
      emailData.font_family_name_link = font_family_name_link;
      emailData.font_family_name_name = font_family_name_name;
      emailData.is_no_reply = true;
      emailData.website_url = 'https://www.theasia.com';
      ejsPath = path.resolve(__dirname, '../../common/views/affiliate/affiliate_registration.ejs')
      break;
    case USER_EMAIL_TYPE.AFFILIATE_PASSWORDRESET:
      directory = `${__dirname}/locales/affiliate_passwordUpdates`;
      configure_i18n(directory, lang_code);
      _.each(keysAffiliatePasswordReset, (key) => {
        emailData[key] = i18n.__(key);
      });
      emailData.name = data.name;
      emailData.affiliate_name = data.affiliate_name;
      emailData.url = data.url;
      emailData.to_email = data.email ? data.email : 'Your Email';
      emailData.font_family_name_link = font_family_name_link;
      emailData.font_family_name_name = font_family_name_name;
      emailData.is_no_reply = true;
      emailData.website_url = 'https://www.theasia.com';
      ejsPath = path.resolve(__dirname, '../../common/views/affiliate/passwordReset_notification.ejs')
      break;
    case USER_EMAIL_TYPE.SUPPLIER_REGISTRATION:
      directory = `${__dirname}/locales/supplier_registration`;
      configure_i18n(directory, lang_code);
      _.each(keysSupplierRegistration, (key) => {
        emailData[key] = i18n.__(key);
      });
      emailData.name = data.name;
      emailData.supplier_name = data.supplier_name;
      emailData.url = data.url;
      emailData.to_email = data.email ? data.email : 'Your Email';
      emailData.font_family_name_link = font_family_name_link;
      emailData.font_family_name_name = font_family_name_name;
      emailData.is_no_reply = true;
      emailData.website_url = 'https://www.theasia.com';
      ejsPath = path.resolve(__dirname, '../../common/views/supplier/supplier_registration.ejs')
      break;
    default: throw new Error('EMAIL TYPE IS NOT MATCH')
  }
  return htmlclean(loopback.template(ejsPath)(emailData)).replace(/\r/g, '').replace(/\t/g, '').replace(/\n/g, '')
}

const getEmailObject = async (user_id, userEmailType, lang_id = 1, sender_id, url) => {
  try {
    if (!USER_EMAIL_TYPE[userEmailType]) return Promise.resolve(undefined)
    const [langObject, user] = await Promise.all([
      app.models.Languages.findById(lang_id),
      app.models.Users.findById(user_id),
    ])
    let data;
    if (userEmailType === 'AFFILIATE_REGISTRATION' || userEmailType === 'AFFILIATE_PASSWORDRESET') {
      const affiliate = await app.models.Affiliates.findById(user.affiliate_id);
      data = { name: user.first_name, url, email: user.email, affiliate_name: affiliate.company_name }
    }
    else if (userEmailType === 'SUPPLIER_REGISTRATION') {
      const supplier = await app.models.Supplier.findById(user.supplier_id);
      data = { name: user.first_name, url, email: user.email, supplier_name: supplier.company_name }
    }
    else {
      data = { name: user.first_name, url, email: user.email }
    }
    const emailObject = {
      to: isProduction ? user.email : 'test1@mail.theasiadev.com',
      from: noreplyEmail,
      subject: SUBJECT[userEmailType],
      bcc,
      html: emailHTMLBody(data, langObject.code, userEmailType),
      activityObject: {
        model_id: user_id,
        user_id: sender_id,
        model_name: 'Users',
        action_taken: `Send Email to ${SUBJECT[userEmailType]}`,
        action_result: 'Success',
        email_template: userEmailType,
      },
    }
    return Promise.resolve(emailObject)
  } catch (error) {
    console.log(error)
    return Promise.resolve(undefined)
  }
}

module.exports = {
  USER_EMAIL_TYPE,
  getEmailObject,
}
