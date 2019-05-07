module.exports = (UserSocials) => {
  /**
   * Validation
   */
  UserSocials.validatesPresenceOf('user_id', 'social_id', 'social_type')
  UserSocials.validatesInclusionOf('social_type', { in: ['FACEBOOK', 'GOOGLE'] })
}
