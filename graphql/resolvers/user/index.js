const { THE_ASIA_API } = require('../../config');
const reference = require('../../reference');
const objectHelper = require('../../helpers/object');
const axios = require('../../axios')

const USER_API = `${THE_ASIA_API}/Users`;
const LOGIN_API = `${USER_API}/crmLogin`;
const SUPPLIER_LOGIN_API = `${USER_API}/supplierLogin`;
const AFFILIATE_LOGIN_API = `${USER_API}/affiliateLogin`;
const LOGOUT_API = `${USER_API}/logout`;
const ROLES_API = `${THE_ASIA_API}/RoleTypes`;

const setAccessToken = (userInfo, context) => {
  // eslint-disable-next-line no-param-reassign
  context.user = userInfo;
};

const deleteAccessToken = (accessToken, context) => {
  if (context.user.id === accessToken) {
    // eslint-disable-next-line no-param-reassign
    delete context.user;
  }
};

const mutations = {
  setAccessToken(root, { accessToken }, context) {
    setAccessToken(accessToken, context);
  },
  async saveUserCardData(root, { access_token, input }) {
    const { cardType, cipher, makeDefault } = input;
    const token = await reference.app.models.AccessToken.findById(access_token);

    return axios({
      method: 'POST',
      url: `${USER_API}/${token.userId}/paymentCards`,
      params: {
        access_token,
      },
      data: {
        cardType,
        cipher,
        makeDefault,
      },
    })
      .then(res => res.data)
      .catch(err => err);
  },
  updateUserCard(root, { id, input }, { accessToken }) {
    if (!accessToken.userId) throw new Error('Unauthorized');

    return axios
      .put(`${USER_API}/${accessToken.userId}/paymentCards/${id}?access_token=${accessToken.id}`, input)
      .then(res => res.data)
      .catch(err => console.log(err.response.data.error.detail));
  },
  deleteUserCard(root, arg, { accessToken }) {
    if (!accessToken.userId) throw new Error('Unauthorized');

    return axios
      .delete(`${USER_API}/${accessToken.userId}/paymentCards/${arg.id}?access_token=${accessToken.id}`)
      .then(res => res.data)
      .catch(err => console.log(err.response.data.error.detail));
  },
  registerUser(root, { input }) {
    return axios
      .post(USER_API, {
        ...input,
      })
      .then(res => res.data)
      .catch(err => err);
  },
  loginUser(root, { input }, context) {
    return axios
      .post(LOGIN_API, {
        ...input,
      })
      .then(res => {
        setAccessToken(res.data, context);
        return res.data;
      })
      .catch(error => console.log(error));
  },
  loginAffiliate(root, { input }, context) {
    return axios
      .post(AFFILIATE_LOGIN_API, {
        ...input,
      })
      .then(res => {
        // console.log(res, 'console.log')
        setAccessToken(res.data, context);
        return res.data;
      })
      .catch(error => {
        console.log(error);
        return error;
      });
  },
  loginSupplier(root, { input }, context) {
    return axios
      .post(SUPPLIER_LOGIN_API, {
        ...input,
      })
      .then(res => {
        // console.log(res, 'console.log')
        setAccessToken(res.data, context);
        return res.data;
      })
      .catch(error => {
        console.log(error);
        return error;
      });
  },
  logoutUser(root, { accessToken }, context) {
    // need to recheck this one
    const ENDPOINT = `${LOGOUT_API}?access_token=${accessToken}`;
    return axios.post(ENDPOINT).then(() => {
      deleteAccessToken(accessToken, context);
      return 'Success';
    });
  },
  updatePassword(root, arg) {
    const { access_token, password } = arg;

    if (!access_token) {
      throw new Error('Access token can not be empty');
    }

    if (!password) {
      throw new Error('Password can not be empty');
    }

    return axios({
      method: 'POST',
      url: `${USER_API}/update_password`,
      params: {
        access_token,
      },
      data: {
        password,
        code: 'hg123bb&&*^%**567743345hfjdh&&&',
      },
    }).then(res => {
      const status = objectHelper.safeGet(() => res.data.status) || false;

      if (status === false) {
        const message = objectHelper.safeGet(() => res.data.message) || '';
        throw new Error(message);
      }
      return res.data;
    });
  },
  getUserInfo(root, params) {
    // console.log('params', params);
    return axios
      .get(`${USER_API}/${params.id}`)
      .then(res => res.data)
      .catch(err => err);
  },
};
const resolvers = {
  Profile: {
    avatar(data) {
      // console.log('in server: ', data);
    },
  },
  User: {
    email_verified(user) {
      return user.emailVerified || false;
    },
    name(user) {
      return `${user.first_name} ${user.last_name}`.trim();
    },
    email(user) {
      return user.email;
    },
    country(user) {
      return {
        id: user.country_id,
      };
    },
    supplier(user) {
      return {
        id: user.supplier_id,
      };
    },
    role(user) {
      if (user.roleTypes === 'undefined') {
        return {
          id: 1,
          name: 'user',
        };
      }
      return user.roleTypes;
    },
  },
};

const query = {
  profile: (root, data, context) => {
    if (!context.user.userId) return null;
    axios.defaults.headers.common.Authorization = context.user.id;
    return axios
      .get(`${USER_API}/${context.user.userId}`)
      .then(res => res.data)
      .catch(error => Promise.reject(error));
  },
  user: (root, { id }, context) => {
    axios.defaults.headers.common.Authorization = context.user.id;
    return axios
      .get(`${USER_API}/${id}`)
      .then(res => res.data)
      .catch(error => Promise.reject(error));
  },
  users: (root, data, context) => {
    axios.defaults.headers.common.Authorization = context.user.id;
    const userId = parseInt(context.user.userId, 10);
    return axios
      .post(`${USER_API}/usersList`, { userId })
      .then(res => res.data)
      .catch(err => err);
  },
  userCards: async (root, params, { accessToken: { userId }}) => {
    if (!userId) throw new Error('Unauthorized')

    return reference.app.models.UserCardData.find({ where: { user_id: userId } });
  },
  roles: (root, data, context) => {
    axios.defaults.headers.common.Authorization = context.user.id;
    return axios.get(ROLES_API).then(res => res.data);
  },
  searchUsers: (root, { text }) => {
    if (!text) return [];
    const filter = encodeURIComponent(
      JSON.stringify({
        where: {
          or: [
            {
              first_name: {
                ilike: `%${text}%`,
              },
            },
            {
              last_name: {
                ilike: `%${text}%`,
              },
            },
            {
              email: {
                ilike: `%${text}%`,
              },
            },
          ],
        },
      }),
    );
    return axios
      .get(`${USER_API}?filter=${filter}`)
      .then(res => res.data)
      .catch(err => err);
  },
  getUserByToken(root, { token }) {
    return axios
      .get(`${USER_API}/findByToken?access_token=${token}`)
      .then(res => res.data)
      .catch(err => err);
  },
  getUser(
    root,
    data,
    {
      accessToken: { userId, id },
    },
  ) {
    if (!userId) throw new Error('Unauthorized');

    const filter = {
      include: ['affiliates'],
    };

    return axios({
      method: 'GET',
      url: `${USER_API}/${userId}?filter=${encodeURIComponent(JSON.stringify(filter))}`,
      headers: {
        Authorization: id,
      },
    })
      .then(res => res.data)
      .catch(err => err);
  },
};

module.exports = { query, resolvers, mutations };
