const app = require('../../server/index')
const loopback = require('loopback')
const path = require('path')
const i18n = require('i18n')
const htmlclean = require('htmlclean');
const fs = require('fs');
const _ = require('lodash')

const requestReview = JSON.parse(fs.readFileSync(`${__dirname}/locales/review/request/en.json`, 'utf8'));
const rejectReview = JSON.parse(fs.readFileSync(`${__dirname}/locales/review/reject/en.json`, 'utf8'));
const approveReview = JSON.parse(fs.readFileSync(`${__dirname}/locales/review/approve/en.json`, 'utf8'));
const reminderReview = JSON.parse(fs.readFileSync(`${__dirname}/locales/review/reminder/en.json`, 'utf8'));
const footerLocale = JSON.parse(fs.readFileSync(`${__dirname}/locales/footer/en.json`, 'utf8'))
const directoryReject = `${__dirname}/locales/review/reject`;
const directoryRequest = `${__dirname}/locales/review/request`;
const directoryApprove = `${__dirname}/locales/review/approve`;
const directoryReminder = `${__dirname}/locales/review/reminder`;

const { constants: { isProduction, noreplyEmail } } = require('../utility')

const bcc = isProduction ? ['vishal.sharma@theasia.com', 'jaebum.kim@theasia.com'] : ['vishal.sharma@theasia.com', 'therachart.wicheanrat@theasia.com']
const REVIEW_EMAIL_TYPE = {
  REVIEW_REQUEST: 'REVIEW_REQUEST',
  REVIEW_REJECT: 'REVIEW_REJECT',
  REVIEW_APPROVED: 'REVIEW_APPROVED',
  REVIEW_REMINDER: 'REVIEW_REMINDER'
}

const WEBSITE_URL = isProduction ? 'https://www.theasia.com' : 'https://www.theasiadev.com'

const SUBJECT = {
  REVIEW_REQUEST: {
    'en': 'TheAsia.com - Review Your Last Trip With Us',
    'th': 'TheAsia.com - ความคิดเห็นของคุณ มีความสำคัญกับเราอย่างยิ่ง',
    'ko': 'TheAsia.com - 여행 후기를 작성해주세요',
    'zh': 'TheAsia.com - 请点评您的上一个旅程',
  },
  REVIEW_REJECT: {
    'en': 'TheAsia.com - Thank you for your feedback!',
    'th': 'TheAsia.com - ความคิดเห็นของคุณถูกปฎิเสธ',
    'ko': 'TheAsia.com - 여행 후기가 거부되었습니다',
    'zh': 'TheAsia.com - 您的点评未能成功发布',
  },
  REVIEW_APPROVED: {
    'en': 'TheAsia.com - Thank you for your feedback!',
    'th': 'TheAsia.com - ความคิดเห็นของคุณได้รับการอนุมัติ',
    'ko': 'TheAsia.com - 여행 후기가 승인되었습니다',
    'zh': 'TheAsia.com - 您的点评已成功发布',
  },
  REVIEW_REMINDER: {
    'en': 'TheAsia.com - We’d love to hear from you!',
    'th': 'TheAsia.com - เราต้องการความคิดเห็นของคุณ!',
    'ko': 'TheAsia.com - 고객님의 의견을 듣고 싶습니다!',
    'zh': 'TheAsia.com - 期待您的意见',
  }
}

const configure_i18n = (directory, lang_code) => {
  i18n.configure({
    locales: [lang_code],
    directory,
  });
  i18n.setLocale(lang_code);
}

const getMediaBucketPath = (mediaPath) => {
  const paths = mediaPath ? mediaPath.split('/') : mediaPath;
  if (paths[paths.length - 1] == '/') {
    return mediaPath
  }
  return `${mediaPath}/`;
}

const emailHTMLBody = (data, lang_code, email_type, reviewData) => {
  const directory = ''
  let footer_directory = ''
  const emailData = {}
  let ejsPath = ''
  const keysRequest = Object.keys(requestReview);
  const keysReject = Object.keys(rejectReview);
  const keysApprove = Object.keys(approveReview);
  const keysReminder = Object.keys(reminderReview);
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
    case REVIEW_EMAIL_TYPE.REVIEW_REQUEST:
      configure_i18n(directoryRequest, lang_code);
      _.each(keysRequest, (key) => {
        emailData[key] = i18n.__(key);
      });
      emailData.name = data.name;
      emailData.url = data.url;
      emailData.to_email = data.email ? data.email : 'Your Email';
      emailData.font_family_name_link = font_family_name_link
      emailData.font_family_name_name = font_family_name_name
      emailData.is_no_reply = true
      if (data.booking) {
        emailData.tour_name = data.booking.tour.name
        emailData.product_image = 'https://theasia.imgix.net/emails/images/img2.jpg'
        const media = data.booking.tour.tour_medias[0].details
        if (media && media.bucket_path && media.name) {
          emailData.product_image = `https://theasia.imgix.net/${getMediaBucketPath(media.bucket_path)}${media.name}`
        }
        emailData.tour_location = data.booking.tour.location
        emailData.tour_rating = Math.ceil(parseFloat(data.booking.tour.rating))
      }
      ejsPath = path.resolve(__dirname, '../../common/views/review/review_request.ejs')
      break;
    case REVIEW_EMAIL_TYPE.REVIEW_REJECT:

      configure_i18n(directoryReject, lang_code);
      // console.log('keysVerify', keysReject)
      _.each(keysReject, (key) => {
        emailData[key] = i18n.__(key);
      });
      emailData.name = data.name;
      emailData.url = data.url;
      emailData.to_email = data.email ? data.email : 'Your Email';
      emailData.font_family_name_link = font_family_name_link
      emailData.font_family_name_name = font_family_name_name
      emailData.is_no_reply = true
      emailData.review_comment = reviewData.comment
      emailData.reviewer_name = reviewData.reviewer_name
      ejsPath = path.resolve(__dirname, '../../common/views/review/review_reject.ejs')
      break;
    case REVIEW_EMAIL_TYPE.REVIEW_APPROVED:
      configure_i18n(directoryApprove, lang_code);
      // console.log('keysVerify', keysReject)
      _.each(keysApprove, (key) => {
        emailData[key] = i18n.__(key);
      });
      emailData.name = data.name;
      emailData.url = data.url;
      emailData.to_email = data.email ? data.email : 'Your Email';
      emailData.font_family_name_link = font_family_name_link
      emailData.font_family_name_name = font_family_name_name
      emailData.reviewer_name = reviewData.reviewer_name
      emailData.is_no_reply = true
      ejsPath = path.resolve(__dirname, '../../common/views/review/review_approve.ejs')
      break;
     case REVIEW_EMAIL_TYPE.REVIEW_REMINDER:
      configure_i18n(directoryReminder, lang_code);
      _.each(keysReminder, (key) => {
        emailData[key] = i18n.__(key);
      });
      emailData.name = data.name;
      emailData.url = data.url;
      emailData.to_email = data.email ? data.email : 'Your Email';
      emailData.font_family_name_link = font_family_name_link
      emailData.font_family_name_name = font_family_name_name
      emailData.is_no_reply = true
      ejsPath = path.resolve(__dirname, '../../common/views/review/review_reminder.ejs')
      break;
      default: throw new Error('EMAIL TYPE IS NOT MATCH')
  }

  return htmlclean(loopback.template(ejsPath)(emailData)).replace(/\r/g, '').replace(/\t/g, '').replace(/\n/g, '')
}

const getEmailObject = async (user_id, reviewEmailType, lang_id, sender_id, url, reviewData = null, bookingData = null) => {
  // if (!lang_id) {
  //   lang_id = 1
  // }
  try {
    //  console.log('getEmailObject inside', user_id, reviewEmailType, lang_id = 1, sender_id, url)
    if (!REVIEW_EMAIL_TYPE[reviewEmailType]) return Promise.resolve(undefined)
    const [langObject, user] = await Promise.all([
      app.models.Languages.findById(lang_id),
      app.models.Users.findById(user_id),
    ])
    const data = { name: user.first_name, url, email: user.email }
    if (bookingData !== null) {
      console.log(bookingData)
      data.booking = bookingData
    }
    // console.log('sending to', user.email, langObject.code);
    // console.log('SUBJECT[reviewEmailType]', SUBJECT[reviewEmailType]);
    const subjects = SUBJECT[reviewEmailType];
    const emailObject = {
      to: isProduction ? user.email : 'test1@mail.theasiadev.com',
      from: noreplyEmail,
      subject: subjects[langObject.code],
      bcc,
      html: emailHTMLBody(data, langObject.code, reviewEmailType, reviewData),
      activityObject: {
        model_id: user_id,
        user_id: sender_id,
        model_name: 'Users',
        action_taken: `Send Email to ${subjects[langObject.code]}`,
        action_result: 'Success',
        email_template: reviewEmailType,
      },
    }
    return Promise.resolve(emailObject)
  } catch (error) {
    return Promise.resolve(undefined)
  }
}

module.exports = {
  REVIEW_EMAIL_TYPE,
  getEmailObject,
}
