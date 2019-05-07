const UserHelper = require('../../helpers/user');
const EmailHelper = require('../../helpers/email');
const { newLoopbackError, HTTPStatusCode: { SERVER_ERROR } } = require('../../utility')
const { s3, uploadToS3 } = require('../../helpers/aws');
const hostConfig = require('../../../server/config/config.json')
const moment = require('moment');

const { FORBIDDEN } = SERVER_ERROR;

const defaultFilter = {
  include: [
    'supplier_currency',
    'supplier_country',
   ]
}

let WEBSITE_URL = 'http://localhost:3000';
if (process.env.NODE_ENV === 'production') {
  WEBSITE_URL = 'https://www.theasia.com';
} else if (process.env.NODE_ENV === 'development') {
  WEBSITE_URL = 'https://www.theasiadev.com';
}

function sendSupplierRegistrationEmail(user, token) {
  const url = `${WEBSITE_URL}/reset-password?access_token=${token.id}`;
  return UserHelper.getEmailObject(user.id, UserHelper.USER_EMAIL_TYPE.SUPPLIER_REGISTRATION, 1, 0, url)
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
  key = 'supplier/company_logo/'
  configHost = hostConfig.production
} else {
  folderBucket = 'theasia-cloud'
  key = 'sandbox/supplier/company_logo/'
  configHost = hostConfig.development
}

module.exports = function (Suppliers) {
  Suppliers.defaultFilter = defaultFilter;
  Suppliers.validatesUniquenessOf('reservation_email');
  Suppliers.beforeRemote('create', async (ctx, instance, next) => {
    const inputs = ctx.args.data;
    const { Users } = Suppliers.app.models;
    if (inputs.reservation_email) {
      const user = await Users.findOne({ where: { reservation_email: inputs.reservation_email } })
      if (user && user.supplier_id > 0) {
       return next(newLoopbackError(FORBIDDEN, 'SUPPLIER_ALREADY_REGISTERED'))
      }
    }
    if (inputs.logo) {
      const filename = formatFilename(inputs.company_name);
      const base64Data = new Buffer(inputs.logo.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      const type = inputs.logo.split(';')[0].split('/')[1];

      const res = await uploadToS3(folderBucket, `${key}${filename}`, base64Data, `image/${type}`, 'base64', 'public-read');
      if (res) ctx.args.data.logo = `${key}${filename}`;
      else ctx.args.data.logo = null;
    }
    next();
  });

  Suppliers.beforeRemote('prototype.patchAttributes', async (ctx, instance, next) => {
    if (ctx.args.data.logo) {
      const supplier = ctx.instance;
      const input = ctx.args.data;
      const params = { Bucket: folderBucket, Key: supplier.logo };
      if (input.logo === 'remove') {
        const result = await s3.deleteObject(params).promise();
        if (result) console.log(result);
        else console.log('Cannot delete an s3 obj...');
        ctx.args.data.logo = null;
      } else if (input.logo !== supplier.logo) {
        const filename = formatFilename(input.company_name || supplier.company_name);
        const base64Data = new Buffer(input.logo.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const type = input.logo.split(';')[0].split('/')[1];

        const res = await uploadToS3(folderBucket, `${key}${filename}`, base64Data, `image/${type}`, 'base64', 'public-read');
        if (res) {
          input.logo = `${key}${filename}`;
          if (supplier.logo) {
            const result = await s3.deleteObject(params).promise();
            if (result) console.log(result);
            else console.log('Cannot delete an s3 obj...');
          }
        }
        else input.logo = supplier.logo;
      }
    }
    next();
  });
  Suppliers.beforeRemote('deleteById', async (ctx, instance, next) => {
    // console.log(ctx.args.id);
    const supplier = await Suppliers.findById(ctx.args.id);
    const { Users, SuppliersBillingAcctounts } = Suppliers.app.models;
    // console.log(affiliate);
    if (supplier.logo) {
      const params = { Bucket: folderBucket, Key: supplier.logo };
      const result = await s3.deleteObject(params).promise();
      if (result) console.log(result);
      else console.log('Cannot delete an s3 obj...');
    }
    Users.destroyById(supplier.user_id);
    SuppliersBillingAcctounts.destroyAll({ affiliateId: supplier.id });
    next();
  });
  // Affiliates.observe('before save', async (ctx) => {
  // });
  Suppliers.observe('after save', async (ctx) => {
    try {
      const { Users } = Suppliers.app.models;
      const {
        id: supplier_id,
        reservation_email,
        name,
        business_phone_number: phone,
        country_id
      } = ctx.instance;
      console.log('Is new instance:', ctx.isNewInstance)
      if (ctx.isNewInstance) {
        const password = passwordGenerator(18);
        const data = {
          email: reservation_email,
          first_name: name,
          password,
          supplier_id,
          phone,
          country_id
        }
        const filter = {
          where: {
            email: reservation_email
          }
        };
        let registration_successful = false;
        const user = await Users.findOne(filter);
        if (user) {
          if (user.supplier_id == 0) {
            const result = await user.updateAttributes({
              supplier_id
            })
            if (result) {
              registration_successful = true;
            }
          }
          else {
           return Promise.reject(newLoopbackError(FORBIDDEN, 'SUPPLIER_ALREADY_REGISTERED'));
          }
        }
        else {
          const created = await Users.create(filter, data);
          if (created) {
             registration_successful = true;
          }
        }
        if (registration_successful) {
          await Suppliers.app.models.UserRole.create({
            user_id: user.id,
            role_type_id: 2
          });
          const token = await user.createAccessToken(2678400);
          const emailRes = await sendSupplierRegistrationEmail(user, token);
          if (!emailRes) console.log('Sending email failed...');
          await ctx.instance.updateAttributes({ user_id: user.id });
          // console.log('User ID updated for affiliate!');
        }
      }
    } catch (error) {
      console.log('Supplier after save error:', error)
      return Promise.reject(newLoopbackError(SERVER_ERROR, 'SERVER_ERROR', error.message))
    }
  });

  Suppliers.autocomplete = (query, cb) => {
    if (!query || query.length < 1) {
      return cb(null, [])
    }
    let sql = `SELECT main.suppliers.reservation_email as email,main.suppliers.name as name,main.suppliers.id as id from main.suppliers where (LOWER(suppliers.reservation_email) LIKE LOWER('%${query}%') ) or (LOWER(suppliers.name) LIKE LOWER('%${query}%') ) limit 6`;
      const connector = Suppliers.app.dataSources.theasia.connector;
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

  Suppliers.remoteMethod('autocomplete', {
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

