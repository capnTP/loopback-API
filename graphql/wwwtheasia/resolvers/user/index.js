const axios = require('axios');

const ErrorResponse = require('../../shared/error');
const { THE_ASIA_API: BASE_API } = require('../../config');
const logger = require('../../../logger');
const Locale = require('../common/locale');
const axiosInstance = require('../../axios');
const objectHelper = require('../../helpers/object');

const USER_API = `${BASE_API}/Users`;
const LOGIN_API = `${USER_API}/login`;
const LOGOUT_API = `${USER_API}/logout`;
const SOCIAL_LOGIN_API = `${USER_API}/socialLogin`;

const setAccessToken = (userInfo, context) => {
  logger.debug('> setAccessToken', userInfo, context);
  // eslint-disable-next-line no-param-reassign
  context.user = userInfo;

  logger.debug('> setAccessToken succeeded', context);
};

const deleteAccessToken = (accessToken, context) => {
  if (context.user.id === accessToken) {
    // eslint-disable-next-line no-param-reassign
    delete context.user;
  }
};

module.exports = {
  mutations: {
    setAccessToken(root, { accessToken }, context) {
      setAccessToken(accessToken, context);
    },
    registerUser(root, { input }, context) {
      return Locale.resolve(context.locale).then(resLocale =>
        axios
          .post(USER_API, {
            ...input,
            email: input.email.trim(),
            language_id: resLocale.id,
          })
          .then(res => res.data)
          .catch(err => {
            const error = Object.assign({}, err.response.data.error);
            if (typeof err.response.data.error.details === 'undefined') {
              error.details = { messages: '' };
            }
            return new ErrorResponse(error);
          }),
      );
    },
    socialLogin(
      root,
      {
        input: { loginType: type, accessToken: access_token },
      },
      context,
    ) {
      logger.debug('hey,,,', {
        type,
        access_token,
      });
      return Locale.resolve(context.locale).then(resLocale =>
        axios
          .post(SOCIAL_LOGIN_API, {
            access_token,
            type,
            language_id: resLocale.id,
          })
          .then(res => res.data)
          .catch(err => {
            const error = Object.assign({}, err.response.data.error);
            if (typeof err.response.data.error.details === 'undefined') {
              error.details = { messages: '' };
            }
            return new ErrorResponse(error);
          }),
      );
    },
    loginUser(root, { input }, context) {
      logger.debug('> loginUser', input);
      return axios
        .post(LOGIN_API, {
          ...input,
          email: input.email.trim(),
        })
        .then(res => {
          logger.debug('>> successfully login', { data: res.data, context });

          setAccessToken(res.data, context);

          return res.data;
        })
        .catch(err => {
          // TODO wrong password on 401
          logger.debug('> catch', err);

          const error = Object.assign({}, err.response.data.error);
          if (typeof err.response.data.error.details === 'undefined') {
            error.details = { messages: '' };
          }
          return new ErrorResponse(error);
        });
    },
    logoutUser(root, { accessToken }, context) {
      return axios
        .post(LOGOUT_API, {
          accessToken,
        })
        .then(res => {
          delete deleteAccessToken(accessToken, context);
          return res.data;
        })
        .catch(err => err);
    },
    updateUser(root, arg, context) {
      logger.debug('updateUser', { arg, context });

      const { input } = arg;

      return axios
        .patch(`${USER_API}/${context.user.userId}?access_token=${context.user.id}`, {
          ...input,
        })
        .then(res => {
          logger.debug('done');
          return res.data;
        })
        .catch(err => {
          logger.error(err);
          return err;
        });
    },
    resetPassword(root, { input }) {
      return axios
        .post(`${USER_API}/changePassword`, {
          ...input,
        })
        .then(res => res.data)
        .catch(err => err);
    },
    getUserData(root, params, context) {
      logger.debug('params', params);
      axios.defaults.headers.common.Authorization = context.user.id;
      return axios
        .get(`${USER_API}/${params.id}?access_token=${context.user.id}`)
        .then(res => res.data)
        .catch(err => err);
    },
    updatePassword(root, arg) {
      const { accessToken, password } = arg;

      if (!accessToken) {
        throw new Error('Access token can not be empty');
      }

      if (!password) {
        throw new Error('Password can not be empty');
      }

      return axiosInstance
        .request({
          method: 'POST',
          url: '/users/update_password',
          params: {
            access_token: accessToken,
          },
          data: {
            password,
            code: 'hg123bb&&*^%**567743345hfjdh&&&',
          },
        })
        .then(res => {
          const status = objectHelper.safeGet(() => res.data.status) || false;

          if (status === false) {
            const message = objectHelper.safeGet(() => res.data.message) || '';
            throw new Error(message);
          }
        });
    },
  },
  query: {
    async profile(root, args, context) {
      const logHeader = '\ngql.wwwtheasia.query.profile\n';
      logger.debug(logHeader, { args, context }, '\n');
      /**
       * 'args' is not required because we use data from 'context' to query
       * but it is for testing purpose or when we need flexibility
       */
      const { id, token } = args;
      const { user } = context;

      const _id = id || user.userId;
      const _token = token || user.id;

      if (!_id) {
        logger.error(logHeader, 'No id\n', `${__filename}\n`);
        return Promise.reject(new Error('No id'));
      }

      if (!_token) {
        logger.error(logHeader, 'No token\n', `${__filename}\n`);
        return Promise.reject(new Error('No token'));
      }

      axios.defaults.headers.common.Authorization = user.id || _token;

      return axiosInstance.get(`/users/${_id}`).then(res => res.data);
    },
  },
  resolvers: {
    Profile: {
      countryId({ country_id: countryId }) {
        return countryId;
      },
      firstName({ first_name: firstName = '' }) {
        return firstName;
      },
      languageId(root) {
        return root.language_id;
      },
      lastName({ last_name: lastName = '' }) {
        return lastName;
      },
      name({ first_name: firstName = '', last_name: lastName }) {
        return `${firstName} ${lastName}`;
      },
      nationality(root) {
        return axios
          .request({
            baseURL: BASE_API,
            method: 'GET',
            url: `/countries/${root.country_id}`,
          })
          .then(res => res.data);
      },
      newsletter(root) {
        return axiosInstance
          .get('/newsletters/findone', {
            params: {
              filter: {
                where: {
                  email: root.email,
                },
              },
            },
          })
          .then(res => res.data)
          .catch(() => null);
      },
    },
  },
};
