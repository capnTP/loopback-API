const app = require('../../server/index')
const loopback = require('loopback')
const path = require('path')
const i18n = require('i18n')
const htmlclean = require('htmlclean');
const fs = require('fs');
const _ = require('lodash')

const approveObj = JSON.parse(fs.readFileSync(`${__dirname}/locales/affiliate_approve/en.json`, 'utf8'));
const rejectObj = JSON.parse(fs.readFileSync(`${__dirname}/locales/affiliate_reject/en.json`, 'utf8'));
const acctUpdatesObj = JSON.parse(fs.readFileSync(`${__dirname}/locales/affiliate_acctUpdates/en.json`, 'utf8'));
const billingUpdatesObj = JSON.parse(fs.readFileSync(`${__dirname}/locales/affiliate_billingInfoUpdates/en.json`, 'utf8'));
const footerLocale = JSON.parse(fs.readFileSync(`${__dirname}/locales/footer/en.json`, 'utf8'));

const { constants: { isProduction, noreplyEmail } } = require('../utility');

let bcc = isProduction ? ['vishal.sharma@theasia.com'] : ['vishal.sharma@theasia.com'];
bcc = process.env.NODE_ENV === 'local'
  ? process.env.BCC_EMAILS.split(',') || ['vishal.sharma@theasia.com']
  : ['vishal.sharma@theasia.com']

const AFFILIATE_EMAIL_TYPE = {
    AFFILIATE_ONAPPROVE: 'AFFILIATE_ONAPPROVE',
    AFFILIATE_ONREJECT: 'AFFILIATE_ONREJECT',
    AFFILIATE_ACCTUPDATES: 'AFFILIATE_ACCTUPDATES',
    AFFILIATE_BILLINGINFOUPDATES: 'AFFILIATE_BILLINGINFOUPDATES',
}

const SUBJECT = {
    AFFILIATE_ONAPPROVE: 'The Asia Affiliate: Congratulation! Your Account Has Been Verified.',
    AFFILIATE_ONREJECT: 'The Asia Affiliate: Sorry, Your Account Has Been Rejected.',
    AFFILIATE_ACCTUPDATES: 'Notification on your Affiliate Account Changes',
    AFFILIATE_BILLINGINFOUPDATES: 'Notification on your Billing/Company Account Changes',
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
    const keysAffiliateOnApprove = Object.keys(approveObj);
    const keysAffiliateOnReject = Object.keys(rejectObj);
    const keysAffiliateOnUpdates = Object.keys(acctUpdatesObj);
    const keysAffiliateOnBillingUpdates = Object.keys(billingUpdatesObj);
    const keyFooter = Object.keys(footerLocale);

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
        case AFFILIATE_EMAIL_TYPE.AFFILIATE_ONAPPROVE:
          directory = `${__dirname}/locales/affiliate_approve`;
          configure_i18n(directory, lang_code);
          _.each(keysAffiliateOnApprove, (key) => {
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
          ejsPath = path.resolve(__dirname, '../../common/views/affiliate/affiliate_approve.ejs')
          break;
        case AFFILIATE_EMAIL_TYPE.AFFILIATE_ONREJECT:
          directory = `${__dirname}/locales/affiliate_reject`;
          configure_i18n(directory, lang_code);
          _.each(keysAffiliateOnReject, (key) => {
          emailData[key] = i18n.__(key);
          });
          emailData.name = data.name;
          emailData.affiliate_name = data.affiliate_name;
          // emailData.url = data.url;
          emailData.to_email = data.email ? data.email : 'Your Email';
          emailData.font_family_name_link = font_family_name_link;
          emailData.font_family_name_name = font_family_name_name;
          emailData.is_no_reply = true;
          emailData.website_url = 'https://www.theasia.com';
          ejsPath = path.resolve(__dirname, '../../common/views/affiliate/affiliate_reject.ejs')
          break;
        case AFFILIATE_EMAIL_TYPE.AFFILIATE_ACCTUPDATES:
          directory = `${__dirname}/locales/affiliate_acctUpdates`;
          configure_i18n(directory, lang_code);
          _.each(keysAffiliateOnUpdates, (key) => {
          emailData[key] = i18n.__(key);
          });
          emailData.name = data.name;
          emailData.affiliate_name = data.affiliate_name;
          // emailData.url = data.url;
          emailData.to_email = data.email ? data.email : 'Your Email';
          emailData.font_family_name_link = font_family_name_link;
          emailData.font_family_name_name = font_family_name_name;
          emailData.is_no_reply = true;
          emailData.website_url = 'https://www.theasia.com';
          ejsPath = path.resolve(__dirname, '../../common/views/affiliate/acctUpdates_notification.ejs')
          break;
        case AFFILIATE_EMAIL_TYPE.AFFILIATE_BILLINGINFOUPDATES:
          directory = `${__dirname}/locales/affiliate_billingInfoUpdates`;
          configure_i18n(directory, lang_code);
          _.each(keysAffiliateOnBillingUpdates, (key) => {
          emailData[key] = i18n.__(key);
          });
          emailData.name = data.name;
          emailData.affiliate_name = data.affiliate_name;
          // emailData.url = data.url;
          emailData.to_email = data.email ? data.email : 'Your Email';
          emailData.font_family_name_link = font_family_name_link;
          emailData.font_family_name_name = font_family_name_name;
          emailData.is_no_reply = true;
          emailData.website_url = 'https://www.theasia.com';
          ejsPath = path.resolve(__dirname, '../../common/views/affiliate/billingInfoUpdates_notification.ejs')
          break;
        default: throw new Error('EMAIL TYPE IS NOT MATCH')
    }
    return htmlclean(loopback.template(ejsPath)(emailData)).replace(/\r/g, '').replace(/\t/g, '').replace(/\n/g, '')
}

const getEmailObject = async (affiliate_id, affiliateEmailType, lang_id = 1, sender_id, url) => {
    try {
      if (!AFFILIATE_EMAIL_TYPE[affiliateEmailType]) return Promise.resolve(undefined)
      const [langObject, affiliate] = await Promise.all([
        app.models.Languages.findById(lang_id),
        app.models.Affiliates.findById(affiliate_id),
      ])
    //   const affiliate = await app.models.Affiliates.findById(user.affiliate_id);
      let data = {};
      if (affiliateEmailType === 'AFFILIATE_ONAPPROVE') {
        data = { name: affiliate.first_name, url, email: affiliate.email, affiliate_name: affiliate.company_name }
      }
      else if (affiliateEmailType === 'AFFILIATE_ONREJECT') {
        data = { name: affiliate.first_name, email: affiliate.email, affiliate_name: affiliate.company_name }
      }
      else {
        data = { name: affiliate.first_name, url, email: affiliate.email, affiliate_name: affiliate.company_name }
      }
      const emailObject = {
        to: isProduction ? affiliate.email : 'test1@mail.theasiadev.com',
        from: noreplyEmail,
        subject: SUBJECT[affiliateEmailType],
        bcc,
        html: emailHTMLBody(data, langObject.code, affiliateEmailType),
        activityObject: {
          model_id: affiliate_id,
          user_id: sender_id,
          model_name: 'Affiliates',
          action_taken: `Send Email to ${SUBJECT[affiliateEmailType]}`,
          action_result: 'Success',
          email_template: affiliateEmailType,
        },
      }
      return Promise.resolve(emailObject)
    } catch (error) {
      console.log(error)
      return Promise.resolve(undefined)
    }
  }
  
  module.exports = {
    AFFILIATE_EMAIL_TYPE,
    getEmailObject,
  }