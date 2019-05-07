const loopback = require('loopback');
const app = require('../../../server/index');
const CryptoJS = require("crypto-js");

const config = require('../../../server/config.json');
const roles = require('../../../server/utility/roles');
const https = require('https');
const _ = require('lodash');
const request = require('request-promise')
const { newLoopbackClientError, newLoopbackServerError } = require('../../../server/utility/javascriptWraper')
const { newLoopbackError, HTTPStatusCode: { UNAUTHORIZED, SERVER_ERROR }, getSafe } = require('../../utility');
const UserHelper = require('../../helpers/user')
const EmailHelper = require('../../helpers/email')
const { getPaymentMethodsFromSDK } = require('../../helpers/ingenico')
const ingenicoHelper =require('../../helpers/ingenico');

let WEBSITE_URL = 'http://localhost:3000';
let AFFILIATES_URL = 'http://localhost:3000'
let SUPPLIERS_URL = 'http://localhostL3000'
if (process.env.SERVER_TYPE === 'production') {
  WEBSITE_URL = 'https://www.theasia.com';
  AFFILIATES_URL = 'https://affiliates.theasia.com'
  SUPPLIERS_URL = 'https://supplier.theasia.com'
} else if (process.env.SERVER_TYPE === 'development') {
  WEBSITE_URL = 'https://www.theasiadev.com';
  AFFILIATES_URL = 'https://affiliates.theasiadev.com'
  SUPPLIERS_URL = 'https://supplier.theasiadev.com'
}
// Override with env variables if exists
WEBSITE_URL = process.env.WEBSITE_URL || WEBSITE_URL
AFFILIATES_URL = process.env.AFFILIATES_URL || AFFILIATES_URL
SUPPLIERS_URL = process.env.SUPPLIERS_URL || SUPPLIERS_URL

module.exports = function (Users) {
    // hide delete remote method
  Users.disableRemoteMethodByName('deleteById');
  Users.disableRemoteMethodByName('prototype.__delete__accessTokens');
  Users.disableRemoteMethodByName('prototype.__destroyById__accessTokens');


  // Users.observe('after save', (ctx, next) => {
  //   if (ctx.isNewInstance && ctx.instance.user_type != 1) {
  //     Users.resetPassword({ email: ctx.instance.email }, (err, resp) => {
  //       if (err) {
  //         next(err);
  //       } else {
  //         next();
  //       }
  //     })
  //   } else {
  //     next();
  //   }
  // });
  Users.beforeRemote('create', (ctx, user, next) => {
    ctx.args.data.user_type = 1;
    next();
  });

  Users.afterRemote('create', (ctx, user, next) => {
    Users.generateVerificationToken(user, (err, token) => {
      if (err) return next(err)
      user.verificationToken = token;
      user.save((save_err) => {
        if (save_err) return next(save_err)
        const url = `${WEBSITE_URL}/verify?access_token=${user.verificationToken}`;
        return UserHelper.getEmailObject(user.id, UserHelper.USER_EMAIL_TYPE.VERIFICATION, user.language_id, 0, url).then(emailObject => EmailHelper.send([emailObject])).then(emailRes => next()).catch(err => next(err))
      });
    });
  });

  Users.beforeRemote('find', (ctx, user, next) => {
    if (ctx.args.filter) {
      ctx.args.filter.include = [{
        relation: 'roleTypes',
      }]
      if (ctx.args.filter.where) {
        ctx.args.filter.where.supplier_id = 0
      } else {
        ctx.arg.filter.where = {
           supplier_id: 0,
        }
      }
    } else {
      ctx.args.filter = {
        include: [{
          relation: 'roleTypes',
        }],
        where: { supplier_id: 0 },
      }
    }


    next();
  });

  Users.isLogin = function (userData, callback) {
    Users.findOne(userData, (error, user) => {
      callback(user);
    });
  };

  Users.onlyAdminValidation = async (user_id) => {
    const loopbackError = newLoopbackError(UNAUTHORIZED, 'Unauthorized', 'Unauthorized')
    try {
      const user = await Users.findById(user_id)
      if (!user || user.role !== 3) return Promise.reject(loopbackError)
      return Promise.resolve()
    } catch (error) {
      console.log('Only admin error:', error)
      return Promise.reject(loopbackError)
    }
  }

  /**
   * Validate request against allow roles
   * @param {Request} req
   * @param {number[]} [role=[3]] Array of role numbers. Defaults to admin
   */
  Users.validateRole = async (req, allowedRoles = [3]) => {
    const loopbackError = newLoopbackError(UNAUTHORIZED, 'Unauthorized', 'Unauthorized')
    try {
      const user_id = getSafe(() => req.accessToken.userId)
      const user = await Users.findById(user_id)
      if (!user || !allowedRoles.includes(user.role)) return Promise.reject(loopbackError)
      return Promise.resolve(user)
    } catch (error) {
      console.log('validate role error:', error)
      return Promise.reject(loopbackError)
    }
  }

  // This is higly insecure
  Users.updatePasswordFromToken = async (access_token, password, code, cb) => {
    const buildError = (code, error) => {
      const err = new Error(error);
      err.statusCode = 400;
      err.code = code;
      return err;
    };
    const AccessToken = Users.app.models.AccessToken;
    // const { Affiliates } = Users.app.models;
    if (code == 'hg123bb&&*^%**567743345hfjdh&&&') {
      const token = await AccessToken.findById(access_token);
      if (token && token.userId) {
        const user = await Users.findById(token.userId);

        const updated = await user.updateAttribute('password', password);
        // check if affiliate user
        const {
          affiliate_id
        } = user;
        if (affiliate_id && affiliate_id > 0) {
          //send password reset notification to affiliate user
          const result = await UserHelper.getEmailObject(user.id, UserHelper.USER_EMAIL_TYPE.AFFILIATE_PASSWORDRESET, 1, 0, '')
            .then(emailObject => EmailHelper.send([emailObject]));
          if (!result) console.log('Cannot send notification email...')
          await AccessToken.destroyAll({
            where: {
              userId: user.id
            }
          });
        }
        return {
          status: true,
          message: 'Password updated'
        };
      } else {
        return {
          status: false,
          message: 'Token Expired or Invalid'
        }
      }

    } else {
      return {
        status: false,
        message: 'Invalid Code'
      }
    }
  }

  Users.remoteMethod('updatePasswordFromToken', {
    isStatic: true,
    accepts: [
        { arg: 'access_token', type: 'string', required: true, http: { source: 'query' } },
        { arg: 'password', type: 'string', required: true },
        { arg: 'code', type: 'string', required: true },
    ],
    http: { path: '/update_password', verb: 'post' },
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
  });

  Users.bookingRegisteredEmail = (info, template, access_token, userType) => {
    Users.findOne({
      where: {
        email: info.email
      }
    }, (err, userObj) => {
      if (err) {
        console.log('Email is not sent', err);
      } else {
        let webUrl = WEBSITE_URL
        if (userType === 'AFFILIATE') webUrl = AFFILIATES_URL
        if (userType === 'SUPPLIER') webUrl = SUPPLIERS_URL
        const url = `${webUrl}/reset-password?access_token=${(info.accessToken && info.accessToken.id) ? info.accessToken.id : access_token}`
        UserHelper.getEmailObject(userObj.id, UserHelper.USER_EMAIL_TYPE[template], userObj.language_id, 0, url)
          .then(emailObject => EmailHelper.send([emailObject]))
      }
    });
  };

    // send password reset link when requested
  Users.on('resetPasswordRequest', (info, cb) => {
    Users.bookingRegisteredEmail(info, UserHelper.USER_EMAIL_TYPE.RESET_PASSWORD);
  });

  /**
   * Copied from User.resetPassword but modify end result
   * to call Users.bookingRegisteredEmail manually without relying on event
   */
  Users.customResetPassword = async (email, userType) => {
    try {
      const user = await Users.findOne({ where: { email } })      
      if (!user) {
        const e = new Error('Email not found')
        e.statusCode = 404
        e.code = 'EMAIL_NOUT_FOUND'
        throw e
      }

      const ttl = Users.settings.resetPasswordTokenTTL || 43200 // default 12 hrs
      const accessToken = await Users.app.models.AccessToken.create({ ttl })

      // Same as what loopback emits to 'restPassRequest'
      const info = { email, accessToken, user }
      return Users.bookingRegisteredEmail(info, UserHelper.USER_EMAIL_TYPE.RESET_PASSWORD, undefined, userType)
    } catch (error) {
      return Promise.reject(error)
    }
  }

  /**
   * @param {string} email
   * @param {'AFFILIATE'|'SUPPLIER'} userType
   */
  Users.forgetPassword = async function (email, userType) {
    if ((userType !== 'AFFILIATE' && userType !== 'SUPPLIER') || !email) {
      return Promise.reject(newLoopbackError(400, 'Bad Request', 'Invalid Request'))
    }

    const user = await Users.findOne({ where: { email }})
    if (!user) return Promise.reject(newLoopbackError(404, 'Not Found', 'Email not found'))

    if (userType === 'AFFILIATE' && (!user.affiliate_id || user.affiliate_id == 0)) {
      return Promise.reject(newLoopbackError(401, 'Unauthorized', 'This user is not an affiliate'))
    }
    if (userType === 'SUPPLIER' && (!user.supplier_id || user.supplier_id == 0)) {
      return Promise.reject(newLoopbackError(401, 'Unauthorized', 'This user is not a supplier'))
    }

    await Users.customResetPassword(email, userType)

    return { success: true }
  };

  Users.sendEmail = function (emailOption, callback) {
    loopback.Email.send(emailOption, (error, result) => {
      if (!error) {
                // the request has been accepted for processing
        callback({ statusCode: 202, message: 'email sent' });
      }
    });
  };

  Users.changePassword = function (ctx, oldPassword, newPassword, callback) {
      // Changing/updating password loopback
      // ctx contains token of whom password is going to be changed (To set userId)
    if (ctx.req.accessToken != undefined && !_.isEmpty(ctx.req.accessToken)) {
      Users.findOne({ where: { id: ctx.req.accessToken.userId } }, (err, _user) => {
        if (err) throw err;
        else {
          try {
            _user.hasPassword(
                oldPassword,
                (err, isMatch) => {
                  if (!isMatch) {
                    callback('current password is invalid', null);
                  } else {
                    _user.updateAttribute('password', newPassword, async (err, nuser) => {
                      if (err) throw error;
                      else {
                        callback(null, 'password reset successfully');
                        const result = await UserHelper.getEmailObject(_user.id, UserHelper.USER_EMAIL_TYPE.AFFILIATE_PASSWORDRESET, 1, 0, '')
                        .then(emailObject => EmailHelper.send([emailObject]));
                        if (!result) console.log('Cannot send notification email...');
                      }
                    });
                  }
                });
          } catch (error) {
            callback('There is an error in resetting password', null);
          }
        }
      });
    } else {
      const err = new Error('Unauthorized Access');
      err.statusCode = 401;
      err.code = 'Unauthorized';
      callback(err, null);
    }
  };

  Users.userRole = function (userId, roleName, callback) {
    if (roleName == 'admin') {
      roles.adminRole(userId, (err, docs) => {
        if (err) {
          throw err;
        } else {
          callback(null, 'Success');
        }
      })
    } else if (roleName == 'viewer') {
      roles.viewerRole(userId, (err, docs) => {
        if (err) {
          throw err;
        } else {
          callback(null, 'Success');
        }
      })
    } else if (roleName == 'creator') {
      roles.creatorRole(userId, (err, docs) => {
        if (err) {
          throw err;
        } else {
          callback(null, 'Success');
        }
      })
    } else if (roleName == 'editor') {
      roles.editorRole(userId, (err, docs) => {
        if (err) {
          throw err;
        } else {
          callback(null, 'Success');
        }
      })
    } else {
      callback(null, 'Please enter correct role');
    }
  };

  const getSocialObject = async (access_token, type) => {
    const CREDENTIAL = {
      FACEBOOK: {
        APP_ID: '182479572492850',
        APP_SECRET: '51e2bf684ea799eb47c174e2d18970f4',
        APP_TOKEN: '182479572492850|txzwymUJLmdWD3f1sRXuIy3Ozh0',
      },
      GOOGLE: {
        APP_ID: '919608037794-abnt0hh9cs1b1uiu73lohm4r0qun4stl.apps.googleusercontent.com',
        APP_SECRET: 'sLwKQYUrQZpcsCQKu_4B9Lgy',
      },
    }
    if (type === 'FACEBOOK') {
      // validate token
      const facebookTokenInfo = (await request.get(`https://graph.facebook.com/debug_token?access_token=${CREDENTIAL.FACEBOOK.APP_TOKEN}&input_token=${access_token}`, { json: true })).data
      if (!facebookTokenInfo.is_valid || facebookTokenInfo.app_id !== CREDENTIAL.FACEBOOK.APP_ID) return Promise.reject(newLoopbackClientError('INVALID_SOCIAL_TOKEN'))
      if (facebookTokenInfo.scopes.indexOf('email') === -1 || facebookTokenInfo.scopes.indexOf('public_profile') === -1) return Promise.reject(newLoopbackClientError('ACCESS_DENY_BY_USER'))
      // get user info
      const facebookUserInfo = await request.get(`https://graph.facebook.com/me?access_token=${access_token}&fields=name,email`, { json: true })
      const { name, email, id: social_id } = facebookUserInfo
      const first_name = name.split(' ')[0] || ''
      const last_name = name.split(' ')[1] || ''

      return { email, social_id, first_name, last_name }
    } else if (type === 'GOOGLE') {
      let googleTokenInfo
      try {
        googleTokenInfo = await request.get(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${access_token}`, { json: true })
      } catch (error) {
        return Promise.reject(newLoopbackClientError('INVALID_SOCIAL_TOKEN')) // TOKEN IS EXPIRE OR INVALID CANNOT GET RESPONSE
      }
      // validate token
      if (googleTokenInfo.issued_to !== CREDENTIAL.GOOGLE.APP_ID) return Promise.reject(newLoopbackClientError('INVALID_SOCIAL_TOKEN'))
      if (googleTokenInfo.scope.split(' ').indexOf('https://www.googleapis.com/auth/plus.me') === -1 || googleTokenInfo.scope.split(' ').indexOf('https://www.googleapis.com/auth/userinfo.email') === -1) return Promise.reject(newLoopbackClientError('ACCESS_DENY_BY_USER'))
      // get user info
      const googleUserInfo = await request.get('https://www.googleapis.com/plus/v1/people/me', { headers: { Authorization: `Bearer ${access_token}` }, json: true })
      const { name: { givenName: first_name, familyName: last_name }, emails: [{ value: email }], id: social_id } = googleUserInfo

      return { email, social_id, first_name, last_name }
    }
  }

  const meargeUserWithSocialId = (user_id, social_id, social_type) => {
    const UserSocials = Users.app.models.UserSocials
    return UserSocials.create({ user_id, social_id, social_type })
  }

  Users.socialLogin = async (access_token, type, lang_id, password) => {
    if (!lang_id) {
      lang_id = 1;
    }
    try {
      if (['FACEBOOK', 'GOOGLE'].indexOf(type) === -1) return Promise.reject(newLoopbackClientError('INVALID_SOCIAL_TYPE'))
      const { email, social_id, first_name, last_name } = await getSocialObject(access_token, type)
      let user = await Users.findOne({ where: { email }, include: { relation: 'userSocials' } })
      const isAlradyMearge = user && user.userSocials().find(element => element.social_type === type) !== undefined
      if (!user) { // create new user
        user = await Users.create({
          email,
          password: `${social_id}${Date.now()}`, // USER CAN RESET AFTER
          emailVerified: true,
          first_name,
          last_name,
          language_id: lang_id,
        })
        await meargeUserWithSocialId(user.id, social_id, type)
      } else if (!isAlradyMearge) { // mearge user with social account <require password if user is not new created>
        // if (!password) return Promise.reject(newLoopbackClientError('PASSWORD_IS_REQUIRE', `password is require for mearge user ${email} with ${String(type).toLowerCase()}`, { email }))
        // if (!await user.hasPassword(password)) return Promise.reject(newLoopbackClientError('PASSWORD_IS_NOT_MATCH'))
        await meargeUserWithSocialId(user.id, social_id, type)
      }
      return Promise.resolve(user.createAccessToken())
    } catch (error) {
      return Promise.reject(error)
    }
  };
  Users.remoteMethod('socialLogin', {
    description: 'Login/Signup with social platform',
    accepts: [
      { arg: 'access_token', type: 'string', required: true },
      { arg: 'type', type: 'string', required: true, description: 'FACEBOOK | GOOGLE' },
      { arg: 'lang_id', type: 'Number', description: 'user language' },
      { arg: 'password', type: 'string', description: 'require if first mearge with new social' },
    ],
    returns: {
      arg: 'accessToken',
      type: 'AccessToken',
      root: true,
      description: 'The response body contains properties of the ' +
        '{{AccessToken}} created on login.\n' +
        'Depending on the value of `include` parameter, ' +
        'the body may contain additional properties:\n\n' +
        '  - `user` - `U+007BUserU+007D` - Data of ' +
        'the currently logged in user. ' +
        '{{(`include=user`)}}\n\n',
    },
    http: { verb: 'post', path: '/socialLogin' },
  });

  Users.remoteMethod('forgetPassword', {
    description: 'Forget Password.',
    accepts: [
      { arg: 'email', type: 'string', required: true },
      { arg: 'userType', type: 'string', description: 'AFFILIATE | SUPPLIER', required: true },
    ],
    returns: { arg: 'response', type: 'Object', root: true },
    http: { verb: 'post', path: '/forget_password' },
  })

  Users.remoteMethod('changePassword', {
    description: 'Changes the Password of user',
    accepts: [{ arg: 'ctx', type: 'object', http: { source: 'context' } },
      { arg: 'oldPassword', type: 'string' },
      { arg: 'newPassword', type: 'string' }],
    returns: { arg: 'response', type: 'string', root: true },
    http: { verb: 'post' },
  });

  Users.remoteMethod('sendEmail', {
    accepts: [{ arg: 'data', type: 'object', http: { source: 'body' } }],
    returns: { arg: 'response', type: 'string', root: true },
    http: {
      path: '/send-email',
      verb: 'post',
    },
  });

  Users.beforeRemote('prototype.patchAttributes', async (ctx, instance, next) => {
    try {
      const user_id = getSafe(() => ctx.req.accessToken.userId)
      if (!user_id) return next(newLoopbackError(UNAUTHORIZED, 'UNAUTHORIZED', 'authorize is required'))
      const user = await Users.findById(user_id)
      if (!user) return next(newLoopbackError(UNAUTHORIZED, 'UNAUTHORIZED', 'authorize is required'))
      if (user.role != 3) return next(newLoopbackError(UNAUTHORIZED, 'UNAUTHORIZED', 'authorize is required'))
      return next()
    } catch (error) {
      console.log(error)
      return next(error)
    }
  })

  Users.remoteMethod('userRole', {
    accepts: [{ arg: 'userId', type: 'string' },
      { arg: 'roleName', type: 'string' }],
    returns: [{ arg: 'userId', type: 'string' },
      { arg: 'roleName', type: 'string' }],
  });

  Users.supplierLogin = function (data, cb) {
    if (data.email && data.password) {
      Users.app.models.Suppliers.findOne({ where: { reservation_email: data.email } }, (err, supplier) => {
        if (!supplier) {
          const error = new Error('Account Not Found');
          return cb(error)
        }
        else if (!supplier.status) {
          const error = new Error('This Account is Pending Approval');
          return cb(error)
        }
        else if (supplier.status == 2) {
          const error = new Error('This Account is Suspended');
          return cb(error)
        }
        else {
          Users.login(data, (error, token) => {
            if (error) {
              cb(error)
            }
            if (token) {
              const result = {
                ttl: token.ttl,
                id: token.id,
                created: token.created,
              };
              const userId = token.userId;
              const AccessToken = Users.app.models.AccessToken;
              const filter = { include: [{ relation: 'roleTypes',
                scope: { fields: ['name'] } }],
              }
              Users.findById(userId, filter, (error, value) => {
                if (value) {
                  result.userId = value.id;
                  result.supplier_id = value.supplier_id;
                  result.email = value.email;
                  result.name = `${value.first_name}${value.last_name}`;
                  Users.app.models.UserRole.find({ where: { user_id: value.id, role_type_id: 2 } }, (err, roleMap) => {
                    if (roleMap && roleMap.length) {
                      cb(null, result);
                    }
                    else {
                      // this needs to be updated later as rejected
                      cb(null, result);
                    }
                  })
                } else {
                  const userNotExist = new Error('User not exists');
                  AccessToken.destroyAll({
                    where: {
                      userId
                    }
                  });
                  cb(userNotExist);
                }
              });
            }
          })
        }
      });
    }
    else {
      const error = new Error('Invalid Params')
      return cb(error);
    }
  }

  Users.remoteMethod('supplierLogin', {
    description: 'Supplier Login',
    accepts: [
            { arg: 'data', type: 'object', http: { source: 'body' }, required: true },
    ],
    returns: { arg: 'response', type: 'object', root: true },
    http: { verb: 'post', path: '/supplierLogin' },
  });

  // login for affiliate applications
  Users.affiliateLogin = async function (data, cb) {
    if (data.email && data.password) {
      const filter = {
        where: { email: data.email },
        include: [{
          relation: 'roleTypes',
          scope: {
            fields: ['name']
          }
        }],
      }

      try {
        const user = await Users.findOne(filter);
        if (!user) throw new Error('No relevant account is found');
        // const userRoles = await Users.app.models.UserRole.find({ where: { user_id: user.id } });
        // if (!userRoles || userRoles.length === 0) throw new Error('Cannot get user permissions.');

        // const affiliateRole = userRoles.find(role => role.role_type_id === 9);
        // if (!affiliateRole) {
        //   const err = new Error('You are not authorized for this application. Please contact our support team');
        //   err.status = '401';
        //   throw err;
        // }

        const { Affiliates } = await Users.app.models;
        const affiliate = await Affiliates.findById(user.affiliate_id);
        // check for authorization from affiliate_id
        if (!affiliate) throw new Error('Your account is not authorized for this application.')
        if (affiliate.status === 0) throw new Error('This account is pending for approval.');
        else if (affiliate.status === 2) throw new Error('This account has been suspended. Please contact our staff, thank you.');

        const session = await Users.login(data);
        session.affiliate_id = affiliate.id;
        // cb(null, session);
        return Promise.resolve(session);
      } catch(e) {
        return Promise.reject(e);
      }
    } else {
      const error = new Error('Invalid Params')
      return Promise.reject(error);
    }
  }

  Users.remoteMethod('affiliateLogin', {
    description: 'Affiliate Login',
    accepts: [
            { arg: 'data', type: 'object', http: { source: 'body' }, required: true },
    ],
    returns: { arg: 'response', type: 'object', root: true },
    http: { verb: 'post', path: '/affiliateLogin' },
  });

  Users.beforeRemote('prototype.__create__paymentCards', async (ctx, instance, next) => {
    try {
      const { id, userId } = ctx.req.accessToken;
      const bytes  = CryptoJS.AES.decrypt(ctx.args.data.cipher, id);
      const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
      // console.log(decryptedData)
      delete ctx.args.data.cipher;
      ctx.args.data = {
        ...ctx.args.data,
        cardNumber: decryptedData.cardNumber,
        cardholderName: decryptedData.cardholderName,
        expiryDate: decryptedData.expiryDate,
      };
      const { UserCardData, Countries, Currencies } = Users.app.models;
      const errMessage = [], keys = ['cardType', 'cardNumber', 'cardholderName', 'expiryDate'];
      keys.map(field => {
        if(ctx.args.data[field] === null || ctx.args.data[field] === undefined || ctx.args.data[field] === '') {
          errMessage.push(field);
        }
      });
      if(errMessage.length !== 0) throw new Error(`Invalid params, ${errMessage.join()} is/are missing.`);
      const { cardType, cardNumber, cardholderName, expiryDate, makeDefault } = ctx.args.data;
      const user = await Users.findById(userId);
      const country = await Countries.findById(user.country_id);
      const currency = await Currencies.findById(country.currency_id);
      const productsList = await ingenicoHelper.getPaymentMethodsFromSDK({
        "countryCode" : country.iso_code || "US",
        "currencyCode" : currency.currency_code || "USD",
        "locale" : "en_US",
        "hide" : [
            "fields"
        ]
      });

      const product = productsList.body.paymentProducts.find(product => {
        return product.displayHints.label.toLowerCase() === cardType.toLowerCase();
      });
      if(!product) throw new Error('Cannot save the following card type');
      const payload = { 
        paymentProductId: product.id,
        card: {
          data: {
            cardWithoutCvv: {
              cardNumber,
              cardholderName,
              expiryDate,
            },
          },
        },
      }
      const randomTag = Math.random().toString(36).substring(2, 7);
      const last_four = cardNumber.substr(cardNumber.length - 4);
      payload.card.alias = `${userId}_${last_four}_${randomTag}`;
      payload.card.customer = {
        billingAddress: {
          countryCode: country.iso_code
        }
      }
      const res = await Users.app.models.Payments.saveCardData(payload.card, 2)

      if (res.status === 201) {
        ctx.args.data = {
          user_id: userId,
          alias: payload.card.alias,
          token: res.body.token,
          last_four,
          card_type: cardType,
          default: makeDefault || false,
        }
        if(ctx.args.data.default) {
          const defaultCard = await UserCardData.findOne({ where: { and: [{user_id: userId}, {default: true}] } });
          if(defaultCard) await defaultCard.updateAttribute('default', false);
        }

        next();
      } else if (res.status === 200) {
        throw new Error('Card already exists.');
      } else {
        throw new Error('Bad request / service unavailable!');
      }
    } catch(e) {
      return next(e);
    }
  });

  Users.beforeRemote('prototype.__destroyById__paymentCards', async (ctx, instance, next) => {
    const { UserCardData } = Users.app.models;
    const card = await UserCardData.findById(ctx.args.fk);
    if(!card)
      return next(newLoopbackError(SERVER_ERROR, 'SERVER_ERROR', 'Cannot find card token...'));
    const res = await ingenicoHelper.deleteTokenFromSDK(null, card.token);
    if (res.status !== 204)
      return next(newLoopbackError(SERVER_ERROR, 'PORTAL_ERROR', 'Failed on token removal...'));

    next();
  });

  Users.beforeRemote('prototype.__updateById__paymentCards', async (ctx, instance, next) => {
    try {
      const { userId } = ctx.req.accessToken;
      const { UserCardData, Countries, Currencies } = Users.app.models;
      if(ctx.args.data.makeDefault && Object.keys(ctx.args.data).length === 1) {
        const defaultCard = await UserCardData.findOne({ where: { and: [{user_id: userId}, {default: true}] } });
        if(defaultCard) await defaultCard.updateAttribute('default', false);
        ctx.args.data = {
          default: true
        };

        return next();
      }

      const errMessage = [], keys = ['cardType', 'cardNumber', 'cardholderName', 'expiryDate'];
      keys.map(field => {
        if(ctx.args.data[field] === null || ctx.args.data[field] === undefined || ctx.args.data[field] === '') {
          errMessage.push(field);
        }
      });
      if(errMessage.length !== 0) throw new Error(`Invalid params, ${errMessage.join()} is/are missing.`);
      const { cardType, cardNumber, cardholderName, expiryDate, makeDefault } = ctx.args.data;
      const user = await Users.findById(userId);
      const country = await Countries.findById(user.country_id);
      const currency = await Currencies.findById(country.currency_id);
      const productsList = await ingenicoHelper.getPaymentMethodsFromSDK({
        "countryCode" : country.iso_code || "US",
        "currencyCode" : currency.currency_code || "USD",
        "locale" : "en_US",
        "hide" : [
            "fields"
        ]
      });
      const card = await UserCardData.findById(ctx.args.fk);
      const product = productsList.body.paymentProducts.find(product => {
        return product.displayHints.label.toLowerCase() === cardType.toLowerCase();
      });

      if(!product) throw new Error('Cannot save the following card type');
      const payload = { 
        paymentProductId: product.id,
        card: {
          data: {
            cardWithoutCvv: {
              cardNumber,
              cardholderName,
              expiryDate,
            },
          },
        },
      };
      const randomTag = Math.random().toString(36).substring(2, 7);
      const last_four = cardNumber.substr(cardNumber.length - 4);
      payload.card.alias = `${userId}_${last_four}_${randomTag}`;
      payload.card.customer = {
        billingAddress: {
          countryCode: country.iso_code
        }
      }

      const res = await ingenicoHelper.updateTokenFromSDK(payload, card.token);
      if(res.status === 204) {
        ctx.args.data = {
          user_id: userId,
          alias: payload.card.alias,
          token: card.token,
          last_four,
          card_type: cardType,
          default: makeDefault || false,
        }
        if(makeDefault) {
          const defaultCard = await UserCardData.findOne({ where: { and: [{user_id: userId}, {default: true}] } });
          if(defaultCard) await defaultCard.updateAttribute('default', false);
        }
        next();
      } else {
        throw new Error('Unable to update card data, please use a valid info.')
      }
    } catch(e) {
      return next(e);
    } 
  });

  Users.crmLogin = function (data, cb) {
    if (data.email && data.password) {
      Users.login(data, (err, token) => {
        if (err) {
          cb(err)
        }
        if (token) {
          const result = {
            ttl: token.ttl,
            id: token.id,
            created: token.created,
          };
          const userId = token.userId;
          const AccessToken = Users.app.models.AccessToken;
          const filter = { include: [{ relation: 'roleTypes',
            scope: { fields: ['name'] } }],
          }
          Users.findById(userId, filter, (err, value) => {
            if (value) {
              result.userId = value.id;
              result.email = value.email;
              result.name = `${value.first_name}${value.last_name}`;

              value.roleTypes((err, role) => {
                if (role) {
                  if (role.name === 'admin' || role.name === 'affiliate') {
                    console.log('allow');
                    cb(null, result);
                  } else {
                    const error = new Error('User not allowed');
                    // AccessToken.destroyAll({
                    //   where: {
                    //     userId
                    //   }
                    // });
                    cb(error);
                  }
                }
              });
            } else {
              const error = new Error('User not exists');
              // AccessToken.destroyAll({
              //   where: {
              //     userId
              //   }
              // });
              cb(error);
            }
          });
        }
      })
    } else {
      const error = new Error('Invalid Params')
      cb(error);
    }
  }

  Users.remoteMethod('crmLogin', {
    description: 'Login in CRM',
    accepts: [
            { arg: 'data', type: 'object', http: { source: 'body' }, required: true },
    ],
    returns: { arg: 'response', type: 'object', root: true },
    http: { verb: 'post', path: '/crmLogin' },
  });

  Users.findByToken = async function (tokenData, cb) {
    if (tokenData) {
      const { AccessToken } = Users.app.models;
      try {
        const token = await AccessToken.findById(tokenData);
        if (!token)
          { throw new Error('Token is invalid'); }

        const user = await Users.findById(token.userId);
        if (!user)
          { throw new Error(`User ${user.id} is not found`); }
        // if (user.affiliate_id) {
        //   const affiliate = await Affiliates.findById(user.affiliate_id);
        //   if (!affiliate)
        //     throw new Error(`Affiliate account ID-${user.affiliate_id} is not found`);
        // return cb(null, user);
        return Promise.resolve(user);
        // } else {
        //   throw new Error(`User ${user.id} does not have affiliate account`);
        // }
      } catch (error) {
        // return cb(error);
        return Promise.reject(error);
      }
    }
  }

  Users.remoteMethod('findByToken', {
    description: 'Fetch user by access token',
    accepts: [
      { arg: 'access_token', type: 'string', required: true },
    ],
    returns: { arg: 'response', type: 'object', root: true },
    http: { verb: 'get', path: '/findByToken' },
  });

  Users.usersList = function (data, cb) {
    if (data.userId) {
      const usersListfilter = {
        include: [
          {
            relation: 'roleTypes',
            scope: {
              fields: ['id', 'name'],
            },
          },
        ],
      }

      Users.findById(data.userId, usersListfilter, (err, res) => {
        if (err) {
          const error = new Error('No User found');
          cb(error);
        }

        res.roleTypes((err, resRole) => {
          if (err) {
            var error = new Error('error');
            cb(error);
          }
          if (resRole.name === 'admin') {
            Users.find(usersListfilter, (err, val) => {
              if (err) {
                const error = new Error('No user/s');
                cb(error);
              }
              cb(null, val)
            })
          } else {
            var error = new Error('Invalid role');
            cb(error);
          }
        })
      })
    } else {
      const error = new Error('No params');
      cb(error);
    }
  };

  Users.remoteMethod('usersList', {
    description: 'get list of users',
    accepts: [{ arg: 'data', type: 'object', http: { source: 'body' }, required: true }],
    returns: { arg: 'response', type: 'object', root: true },
    http: { verb: 'post', path: '/usersList' },
  });

  Users.autocomplete = (query, cb) => {
    if (!query || query.length < 1) {
      return cb(null, [])
    }
    let sql = `SELECT main.users.email as email,main.users.first_name as first_name,main.users.last_name as last_name,main.users.id as id from main.users where  (LOWER(users.email) LIKE LOWER('%${query}%') ) or (LOWER(users.first_name) LIKE LOWER('%${query}%') ) or (LOWER(users.last_name) LIKE LOWER('%${query}%') ) limit 6`;
      const connector = Users.app.dataSources.theasia.connector;
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

  Users.remoteMethod('autocomplete', {
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
}
