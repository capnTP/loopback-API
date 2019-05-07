module.exports = function (Newsletter) {
  Newsletter.beforeRemote('create', (ctx, user, next) => {
    const email = ctx.args && ctx.args.data ? ctx.args.data.email : '';
    Newsletter.app.models.Users.findOne({ where: { email } }, (err, registeredUser) => {
      if (registeredUser && registeredUser.id) {
        ctx.args.data.user_id = registeredUser.id;
        next();
      }
      else {
        ctx.args.data.user_id = 0;
        next();
      }
    });
  });

  // connect user with newsletter
   Newsletter.updateNewsletterUserConnection = async () => {
    const Users = Newsletter.app.models.Users;
    const filter = {
      where: {
        user_id: 0
      }
    };
    try {
      let count = 0;
      const userList = await Newsletter.find(filter);
      if (userList && userList.length) {
        await Promise.all(userList.map(async (user) => {
           const registeredUser = await Users.findOne({
              where: {
                email: user.email
              }
            });
          if (registeredUser && user.user_id == 0) {
            count++;
           await user.updateAttributes({ user_id: registeredUser.id })
          }
        }));
      }
      return Promise.resolve({ count, message: `${count} newsletter list updated` })
    }
    catch (e) {
      return Promise.resolve({ count: 0, message: e.message })
    }
  };

  Newsletter.remoteMethod('updateNewsletterUserConnection', {
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/updateNewsLetterlist',
      verb: 'post',
    },
  });
};
