/**
 * AccessToken instance
 * @typedef {Object} AccessToken 
 * @property {string} id
 * @property {string} userId
 */

/**
 * 
 * @param {Express} app
 * @param {AccessToken|string} authUser 
 * @returns {Promise<{ id: string, userId: string }>}
 */
async function getAccessToken(app, authUser) {
  if (!authUser) return null
  if (authUser.id) {
    return app.models.AccessToken.findById(authUser.id)
  }
  if (typeof authUser === 'string') {
    return app.models.AccessToken.findById(authUser)
  }
  return null
}

async function validateToken(accessToken) {
  return new Promise((resolve) => {
    if (!accessToken) return resolve(false)
    accessToken.validate((err, isValid) => {
      if (err) {
        console.error('Validate access token error:', err)
        return resolve(false)
      }
      return resolve(isValid)
    })
  })
}

module.exports = {
  getAccessToken,
  validateToken,
};
