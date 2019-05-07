module.exports.adminRole = (userId, cb) => {
        var app = require("../index");
        var User = app.models.Users;
        var Role = app.models.Role;
        var RoleMapping = app.models.RoleMapping;
        try {
          //create the admin role
          Role.create({ name: 'admin' }, function (err, role) {
            if (err) {
                cb("There is an error creating admin role");
            } else {
                cb(null,"admin role is Created successfully");
            }
            role.principals.create({
                principalType: RoleMapping.USER,
                principalId: userId
            }, function (err, principal) {
                if (err) {
                    console.log('error', err)
                    cb("There is an error in assigning admin role");
                }
                else {
                    cb(null,"admin role is assigned successfully");
                }
            });
        });            
        } catch (error) {
           cb(null,"There is an error in admin role",error) 
        }

}

module.exports.viewerRole = (userId, cb) => {
    var app = require("../index");
    var User = app.models.Users;
    var Role = app.models.Role;
    var RoleMapping = app.models.RoleMapping;
    try {
     //create the admin role
     Role.create({ name: 'viewer' }, function (err, role) {
        if (err) {
            cb("There is an error creating Viewer role");
        } else {
            cb(null,"Viewer role is Created successfully");
        }
        role.principals.create({
            principalType: RoleMapping.USER,
            principalId: userId
        }, function (err, principal) {
            if (err) {
                cb("There is an error in assigning Creator role");
            }
            else {
                cb(null,"Creator role is assigned successfully");
            }
        });
    });    
    } catch (error) {
        cb(null,"There is an error in admin role") 
    }
}

module.exports.creatorRole = (userId, cb) => {
    var app = require("../index");
    var User = app.models.Users;
    var Role = app.models.Role;
    var RoleMapping = app.models.RoleMapping;
    try {
          //create the admin role
          Role.create({ name: 'creator' }, function (err, role) {
            if (err) {
                cb("There is an error creating Creator role");
            } else {
                cb(null,"Creator role is Creator successfully");
            }
            role.principals.create({
                principalType: RoleMapping.USER,
                principalId: userId
            }, function (err, principal) {
                if (err) {
                    cb("There is an error in assigning Creator role");
                }
                else {
                    cb(null,"Creator role is assigned successfully");
                }
            });
        });  
    } catch (error) {
        cb(null,"There is an error in admin role") 
    }
}


module.exports.editorRole = (userId, cb) => {
    var app = require("../index");
    var User = app.models.Users;
    var Role = app.models.Role;
    var RoleMapping = app.models.RoleMapping;
    try {
    //create the admin role
    Role.create({ name: 'editor' }, function (err, role) {
        if (err) {
            cb("There is an error creating Editor role");
        } else {
            cb(null,"Editor role is created successfully");
        }
        role.principals.create({
            principalType: RoleMapping.USER,
            principalId: userId
        }, function (err, principal) {
            if (err) {
                cb("There is an error in assigning Editor role");
            }
            else {
                cb(null,"Editor role is assigned successfully");
            }
        });
    });        
    } catch (error) {
        cb(null,"There is an error in admin role")         
    }
  }
