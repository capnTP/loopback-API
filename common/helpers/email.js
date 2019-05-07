const fs = require('fs');

const sgMail = require('@sendgrid/mail');

const app = require('../../server/index');
const gmailSender = require('../../server/utility/gmailSender');
const {
  download,
  constants: { isProduction, developmentEmail },
} = require('../utility');
const logger = require('../utility').loggerBuilder('Helper.Email');
const configCredential = require('../../server/config/env-service');

sgMail.setApiKey(configCredential.sendgrid);

const supplierExcludeIdList = [20, 130, 138];
const excludeEmailList = [];

const base64_encode = file => {
  // read binary data
  const binary = fs.readFileSync(file);
  // convert binary data to base64 encoded string
  return new Buffer(binary).toString('base64');
};

const attachmentsFromURLs = async urls =>
  Promise.all(
    urls.map(async url => {
      let fileObj = await download(url);
      const filePath = `downloads/tmp/${fileObj.filename}`;
      fileObj = { ...fileObj, content: base64_encode(filePath) };
      fs.unlinkSync(filePath);
      return fileObj;
    }),
  );

const isEmailExcluded = async email => {
  if (excludeEmailList.length === 0) {
    const suppliers = await app.models.Suppliers.find({
      where: { id: { inq: supplierExcludeIdList } },
    });
    excludeEmailList.push(suppliers.map(s => s.reservation_email));
  }
  return excludeEmailList.includes(email);
};

const send = emailObjects =>
  Promise.all(
    emailObjects.map(async emailObject => {
      try {
        if (!isProduction) emailObject.to = developmentEmail; // all email will send to test1@mail.theasiadev.com if not production process
        const emailSender = (await isEmailExcluded(emailObject.to)) ? gmailSender : sgMail;
        const activityObject = { ...emailObject.activityObject };
        delete emailObject.activityObject;
        const createActivity = async (isSuccess = true) => {
          try {
            if (!activityObject)
              return Promise.resolve({
                status: false,
                message: 'Activity Creation Failed for Email',
              });
            if (!isSuccess) activityObject.action_result = 'Error';

            const activity = await app.models.Activity.create(activityObject);
            const emailActivity = await app.models.EmailActivity.create({
              ...activityObject,
              from: emailObject.from,
              to: emailObject.to,
              email_data: emailObject.html,
              subject: emailObject.subject,
              activity_id: activity.id,
            });
            return Promise.resolve([activity, emailActivity]);
          } catch (error) {
            logger.error('createActivity');
            return Promise.reject(error);
          }
        };

        try {
          const emailSendResult = await emailSender.send(emailObject);
          createActivity();
          return Promise.resolve(emailSendResult);
        } catch (error) {
          createActivity(false);
          return Promise.resolve(error);
        }
      } catch (error) {
        logger.error('send', error);
        return Promise.reject(error);
      }
    }),
  );

module.exports = {
  send,
  attachmentsFromURLs,
};
