const UserHelper = require('../../helpers/user');
const AffiliateHelper = require('../../helpers/affiliate');
const EmailHelper = require('../../helpers/email');
const { newLoopbackError, HTTPStatusCode: { SERVER_ERROR } } = require('../../utility')
const { s3, uploadToS3 } = require('../../helpers/aws');
const hostConfig = require('../../../server/config/config.json')
const moment = require('moment');
// const _ = require('lodash');

const { FORBIDDEN } = SERVER_ERROR
let WEBSITE_URL = 'https://affiliates.theasiadev.com';
if (process.env.NODE_ENV === 'production') {
  WEBSITE_URL = 'https://affiliates.theasia.com';
} else if (process.env.NODE_ENV === 'development') {
  WEBSITE_URL = 'https://affiliates.theasiadev.com';
}

function sendAffiliateRegistrationEmail(user, token) {
  const url = `${WEBSITE_URL}/reset-password?access_token=${token.id}`;
  return UserHelper.getEmailObject(user.id, UserHelper.USER_EMAIL_TYPE.AFFILIATE_REGISTRATION, 1, 0, url)
    .then(emailObject => EmailHelper.send([emailObject]));
}

function sendAcctVerificationEmail(affiliate, verified) {
  if (verified) {
    const url = `${WEBSITE_URL}`;
    return AffiliateHelper.getEmailObject(affiliate.id, AffiliateHelper.AFFILIATE_EMAIL_TYPE.AFFILIATE_ONAPPROVE, 1, 0, url)
      .then(emailObject => EmailHelper.send([emailObject]));
  }
  return AffiliateHelper.getEmailObject(affiliate.id, AffiliateHelper.AFFILIATE_EMAIL_TYPE.AFFILIATE_ONREJECT, 1, 0, '')
      .then(emailObject => EmailHelper.send([emailObject]));
}

function sendOnAcctUpdatesEmail(affiliate) {
  return AffiliateHelper.getEmailObject(affiliate.id, AffiliateHelper.AFFILIATE_EMAIL_TYPE.AFFILIATE_ACCTUPDATES, 1, 0, '')
      .then(emailObject => EmailHelper.send([emailObject]));
}

function sendOnBillingUpdatesEmail(affiliate) {
  return AffiliateHelper.getEmailObject(affiliate.id, AffiliateHelper.AFFILIATE_EMAIL_TYPE.AFFILIATE_BILLINGINFOUPDATES, 1, 0, '')
      .then(emailObject => EmailHelper.send([emailObject]));
}

function passwordGenerator(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyz!@#$%^&*()-+<>ABCDEFGHIJKLMNOP1234567890';
  let pass = '';
  for (let x = 0; x < length; x++) {
    const i = Math.floor(Math.random() * chars.length);
    pass += chars.charAt(i);
  }
  return pass;
}

function formatFilename(companyName) {
  const date = moment().format('YYYYMMDD');
  const randomString = Math.random().toString(36).substring(2, 7);
  const cleanFilename = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const newFilename = `${date}-${randomString}-${cleanFilename}`;
  return newFilename.substring(0, 60);
}

let folderBucket;
let key;
let configHost;
if (process.env.NODE_ENV == 'production') {
  folderBucket = 'theasia-cloud'
  key = 'affiliates/company_logo/'
  configHost = hostConfig.production
} else {
  folderBucket = 'theasia-cloud'
  key = 'sandbox/affiliates/company_logo/'
  configHost = hostConfig.development
}

async function handleLogo(newLogo, companyName, oldLogo = null) {
  if (!!newLogo) {
    const params = { Bucket: folderBucket, Key: oldLogo };
    if (newLogo === 'remove') {
      const res = await s3.deleteObject(params).promise();
      if (!res) console.log('Cannot delete an s3 obj...'); 
      return Promise.resolve(null);
    }
    const filename = formatFilename(companyName);
    const base64Data = new Buffer(newLogo.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    const type = newLogo.split(';')[0].split('/')[1];
    
    if (!!oldLogo) {
      const result = await s3.deleteObject(params).promise();
      if (result) console.log(result);
      else console.log('Cannot delete an s3 obj...');
    }

    const res = await uploadToS3(folderBucket, `${key}${filename}`, base64Data, `image/${type}`, 'base64', 'public-read');
    if (res) return Promise.resolve(`${key}${filename}`);
    else return null; 
  }

  return Promise.reject(new Error('Invalid input...'));
}

module.exports = function (Affiliates) {
  Affiliates.validatesUniquenessOf('email');
  Affiliates.beforeRemote('create', async (ctx, instance, next) => {
    const inputs = ctx.args.data;
      /* Please check this one , IF this work with other logic , I have to put this one to avoid creating affiliates if the  it the user account already exist */
    const { Users } = Affiliates.app.models;
    if (inputs.reservation_email) {
      const user = await Users.findOne({ where: { reservation_email: inputs.reservation_email } })
      if (user && user.supplier_id > 0) {
       return next(newLoopbackError(FORBIDDEN, 'SUPPLIER_ALREADY_REGISTERED'))
      }
    }
    /* End */

    if (!inputs.currency_id || !inputs.language_id) {
      const { nationality } = inputs;
      const { Countries } = Affiliates.app.models;
      const country = await Countries.findById(nationality);

      if (!inputs.currency_id) {
        ctx.args.data.currency_id = country.currency_id || 2;
      }
      if (!inputs.language_id) {
        ctx.args.data.language_id = 1;
        // ctx.args.data.language_id = country.lang_id || 1;
      }
      // console.log('Auto insert language_id and currency_id =>', ctx.args.data);
    }
    if (inputs.logo) {
      try {
        const res = await handleLogo(inputs.logo, inputs.company_name);
        ctx.args.data.logo = res;
      } catch(e) {
        console.log(e);
      }
      // const filename = formatFilename(inputs.company_name);
      // const base64Data = new Buffer(inputs.logo.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      // const type = inputs.logo.split(';')[0].split('/')[1];

      // const res = await uploadToS3(folderBucket, `${key}${filename}`, base64Data, `image/${type}`, 'base64', 'public-read');
      // if (res) ctx.args.data.logo = `${key}${filename}`;
      // else ctx.args.data.logo = null;
    }
    next();
  });
  Affiliates.beforeRemote('prototype.patchAttributes', async (ctx, instance, next) => {
    //affiliate initial screening - first verification process notification
    if (ctx.args.data.status && !!ctx.args.data.acct_confirmation) {
      const affiliate = ctx.instance;
      const input = ctx.args.data;
      try {
        const emailRes = await sendAcctVerificationEmail(affiliate, input.acct_confirmation);
        console.log(emailRes);
      } catch(e) {
        console.log('Cannot send email...', e);
      }
      next();
    }

    //logo replacement & deletion
    if (ctx.args.data.logo) {
      const affiliate = ctx.instance;
      const input = ctx.args.data;
      // const params = { Bucket: folderBucket, Key: affiliate.logo };
      if (input.logo === 'remove') {
        const res = await handleLogo(input.logo, input.company_name || affiliate.company_name, affiliate.logo);
        // const result = await s3.deleteObject(params).promise();
        ctx.args.data.logo = res;
      } else if (input.logo !== affiliate.logo) {
        const res = await handleLogo(input.logo, input.company_name || affiliate.company_name, affiliate.logo);
        // const filename = formatFilename(input.company_name || affiliate.company_name);
        // const base64Data = new Buffer(input.logo.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        // const type = input.logo.split(';')[0].split('/')[1];

        // const res = await uploadToS3(folderBucket, `${key}${filename}`, base64Data, `image/${type}`, 'base64', 'public-read');
        // if (res) {
        input.logo = res || affiliate.logo;
          // if (affiliate.logo) {
          //   const result = await s3.deleteObject(params).promise();
          //   if (result) console.log(result);
          //   else console.log('Cannot delete an s3 obj...');
          // }
        // }
        // else input.logo = affiliate.logo;
      }
    }
    next();
  });
  Affiliates.afterRemote('prototype.patchAttributes', async (ctx, instance, next) => {
    //identify user responsible for update
    if (ctx.req.headers.token && ctx.req.headers.token !== '') {
      const { AccessToken, Users } = Affiliates.app.models;
      const token = await AccessToken.findById(ctx.req.headers.token);
      if (token) {
        const user = await Users.findById(token.userId);
        
        if(user && user.role !== 3) {
          const affiliate = ctx.instance;
          const emailRes = await sendOnAcctUpdatesEmail(affiliate);
          console.log(emailRes);
          if (!emailRes) console.log('Cannot send email...');
        }
      }
    }
    next();
  });

  Affiliates.beforeRemote('deleteById', async (ctx, instance, next) => {
    // console.log(ctx.args.id);
    const affiliate = await Affiliates.findById(ctx.args.id);
    const { Users, AffiliatesBillingAcct, UserRole } = Affiliates.app.models;
    // console.log(affiliate);
    if (affiliate.logo) {
      const params = { Bucket: folderBucket, Key: affiliate.logo };
      const result = await s3.deleteObject(params).promise();
      if (result) console.log(result);
      else console.log('Cannot delete an s3 obj...');
    }
    // Remove affiliate ID from specified user
    const updatedUser = await Users.upsertWithWhere({ email: affiliate.email }, { affiliate_id: 0 });
    if (!updatedUser) throw new Error('Cannot remove affiliate ID from user...');
    console.log(`Remove affiliate_id ${affiliate.id} from user ${updatedUser.id}`);
    // Delete affiliate role from user
    const affiliateRole = await UserRole.findOne({ where: { and: [{ user_id: updatedUser.id }, { role_type_id: 9 }] } });
    if (affiliateRole) affiliateRole.destroy();

    // Users.destroyById(affiliate.user_id);
    AffiliatesBillingAcct.destroyAll({ affiliateId: affiliate.id });
    next();
  });

  //Below combine update affiliateAcct and billingAcct into one company endpoint then send email for affiliate user
  Affiliates.companyInfoUpdates = async function (data, cb) {
    const { affiliateId } = data.company;
    const { AffiliatesBillingAcct } = Affiliates.app.models;
    const acctData = {...data.account};
    const billingData = {...data.company};
    delete billingData.affiliateId;

    try {
      const affiliate = await Affiliates.findById(affiliateId);
      if (!affiliate) throw new Error('Cannot find relevant account...');
      
      if (!!acctData.logo && acctData.logo !== affiliate.logo) {
        const uploadResult = await handleLogo(acctData.logo, acctData.company_name, affiliate.logo);
        
        if (acctData.logo === 'remove')
          acctData.logo = uploadResult;
        else
          acctData.logo = uploadResult || affiliate.logo;
      } else {
        delete acctData.logo;
      }

      const res = await affiliate.updateAttributes(acctData);
      if (!res) throw new Error('Updates Failed...');

      const affiliateAcct = await AffiliatesBillingAcct.upsertWithWhere({ affiliateId }, billingData);
      if (!affiliateAcct) throw new Error('Cannot update billing info');

      const emailRes = await sendOnBillingUpdatesEmail(affiliate);
      console.log(emailRes);
      if (!emailRes) console.log('Cannot send notification email...');
      cb(null, res);
    } catch(e) {
      return cb(e);
    } 
  };
  Affiliates.remoteMethod('companyInfoUpdates', {
    description: 'Billing/Company Updates from user side',
    accepts: [
            { arg: 'data', type: 'object', http: { source: 'body' }, required: true },
    ],
    returns: { arg: 'response', type: 'object', root: true },
    http: { verb: 'put', path: '/companyInfoUpdates' },
  });

  // Affiliates.observe('before save', async (ctx) => {
  //   console.log(ctx);
  // });
  Affiliates.observe('after save', async (ctx) => {
    try {
      const { Users } = Affiliates.app.models;
      const {
        id: affiliate_id,
        email,
        contact_firstname: first_name,
        contact_lastname: last_name,
        contact_number: phone,
        nationality: country_id,
        language_id,
      } = ctx.instance;
      console.log('Is new instance:', ctx.isNewInstance)
      if (ctx.isNewInstance) {
        const password = passwordGenerator(18);
        const data = {
          email,
          first_name,
          last_name,
          password,
          affiliate_id,
          phone,
          country_id,
          language_id,
          role: 9
        }
        const filter = {
          where: {
            email,
            // affiliate_id
          }
        };
        try {
          const [user, created] = await Users.findOrCreate(filter, data);
          if (!user) throw new Error('Failed on user creation...');
          const roleData = {
            user_id: user.id,
            role_type_id: 9
          };
          if (created) {
            const role = await Affiliates.app.models.UserRole.create(roleData);
            if (!role) throw new Error('Cannot set user role.');

            const token = await user.createAccessToken(2678400);
            const emailRes = await sendAffiliateRegistrationEmail(user, token);
            if (!emailRes) console.log('Sending email failed...');

          } else {
            // if (user) {
            const updatedUser = await Users.upsertWithWhere({ email }, { affiliate_id });
            if (!updatedUser) throw new Error('Cannot perform user updates...');
            console.log(`Updating user attribute with affiliate_id ${affiliate_id}`);

            // const [role, created] = await Affiliates.app.models.UserRole.findOrCreate({ 
            //   where: { and: [{user_id: user.id}, {role_type_id: 9}] } 
            // }, roleData);
            const role = await Affiliates.app.models.UserRole.create(roleData);
            if (role) console.log('Affiliate role added.', role)
            else console.log('Unable to create affiliate role profile.')
            // }
          }
        } catch (e) {
          console.log('Error:', e)
        }
        // if (!user) {
        //   return Promise.reject(new Error('Cannot handle user creation!'));
        // }
      } 
      // else {
      //   // const filter = { where: { id: ctx.instance.user_id } };
      //   const data = {
      //     email,
      //     first_name,
      //     last_name,
      //     phone,
      //     country_id,
      //     language_id,
      //   };
      //   const user = await Users.upsertWithWhere({ id: ctx.instance.user_id }, data);
      //   console.log(user)
      // }
    } catch (error) {
      console.log('Affiliates after save error:', error)
      return Promise.reject(newLoopbackError(SERVER_ERROR, 'SERVER_ERROR', error.message))
    }
  });

  Affiliates.autocomplete = (query, cb) => {
    if (!query || query.length < 1) {
      return cb(null, [])
    }
    let sql = `SELECT main.affiliates.email as email,main.affiliates.company_name as company_name,main.affiliates.id as id,main.users.id as userId from main.affiliates, main.users where (users.affiliate_id = affiliates.id) and ((LOWER(affiliates.email) LIKE LOWER('%${query}%') ) or (LOWER(affiliates.company_name) LIKE LOWER('%${query}%') )) limit 6`;
      const connector = Affiliates.app.dataSources.theasia.connector;
      connector.query(sql, [], (queryerr, response) => {
        if (queryerr) {
          return cb(queryerr);
        }
        // console.log(response)
        if (response && response.length) {
          return cb(null, response);
        }
        return cb(null, []);
      })
  };

  Affiliates.remoteMethod('autocomplete', {
    accepts: [{
      arg: 'query',
      type: 'string',
    }],
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/autocomplete',
      verb: 'get',
    },
  });
};
