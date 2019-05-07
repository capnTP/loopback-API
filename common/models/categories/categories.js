const _ = require('lodash')

module.exports = function (Categories) {
 Categories.beforeRemote('find', (ctx, c, next) => {
        if (ctx.args.filter) {
            ctx.args.filter.include = {
                relation: 'localization'
            };
        }
        else {
            ctx.args.filter = {
                include: {
                    relation: 'localization'
                }
            }
        }
        next();
    });
    Categories.beforeRemote('findById', (ctx, c, next) => {
        if (ctx.args.filter) {
            ctx.args.filter.include = {
                relation: 'localization'
            };
        }
        else {
            ctx.args.filter = {
                include: {
                    relation: 'localization'
                }
            }
        }
        next();
    });

    Categories.updateTourCount = async () => {
      const ToursCategories = Categories.app.models.ToursCategories;
      const CategoryType = Categories.app.models.CategoryType;
      const categories = await Categories.find();
      await Promise.all(categories.map(async (category) => {
        let count = 0;
         count = await ToursCategories.count({ category_id: category.id })
         if (count)
         { return category.updateAttributes({ count }); }
         else {
           return true;
         }
      }));
       //  await CategoryType.updateTourCount();
    };

    Categories.remoteMethod('updateTourCount', {
      returns: {
        arg: 'response',
        type: 'string',
        root: true,
      },
      http: {
        path: '/updateTourCount',
        verb: 'get',
      },
    });
};
