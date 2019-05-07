module.exports = function(app) {
    var User = app.models.Users;
    var Role = app.models.Role;
    var RoleMapping = app.models.RoleMapping;
try{
  User.create([
    {username: 'admin', email: 'dev@admin.com', password: 'SuperSuperSecret',language_id: 1},
  ], function(err, users) {
    if (err) 
    {
      if(err.statusCode ==422){
        console.log("user already exists");
      }else
      return err;
    }

    Role.create({
        name: 'admin'
      }, function(err, role) {
        if (err)
        {
          if(err.statusCode ==422){
            console.log("user already exists");
          }else
          return err;
        }
  
        // Make Bob an admin
        role.principals.create({
          principalType: RoleMapping.USER,
          principalId: users[0].id
        }, function(err, principal) {
          if (err) return err;
        });
      });
    });
}catch(err){
console.log("error catched");
}
  
}
