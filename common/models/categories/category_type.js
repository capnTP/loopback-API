module.exports = function (CategoryType) {
  CategoryType.beforeRemote('find', async (ctx, c, next) => {
    const Cities = CategoryType.app.models.Cities;
        if (ctx.args.filter) {
          if (ctx.args.filter.country_slug) {
             // Not to be used now
          }
          else if (ctx.args.filter.city_slug) {
            const city = await Cities.findOne({ where: { slug: ctx.args.filter.city_slug } });
            const tour_counts = city.tours_count;
            const notIn = [];
            if (tour_counts && tour_counts.total && tour_counts.total.activities == 0) {
              notIn.push(2)
            }
            if (tour_counts && tour_counts.total && tour_counts.total.tours == 0) {
              notIn.push(1)
            }
            if (tour_counts && tour_counts.total && tour_counts.total.experiences == 0) {
              notIn.push(3)
            }
            if (tour_counts && tour_counts.total && tour_counts.total.transportation == 0) {
              notIn.push(4)
            }
            ctx.args.filter.where = {
              id: {
                nin: notIn
              }
            }
          }

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
  CategoryType.beforeRemote('findById', (ctx, c, next) => {
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

    // CategoryType.updateTourCount = async () => {
    //   const Categories = CategoryType.app.models.Categories;
    //   const categorytypes = await CategoryType.find();
    //   await Promise.all(categorytypes.map(async (categoryType) => {
    //     const categories = await Categories.find({ where: { category_type_id: categoryType.id } })
    //      if (categories && categories.length) {
    //        console.log('catgorydata ', categories[0])
    //       const total = await categories.reduce((pre, currenct) => pre + currenct.count, 0);
    //       await categoryType.updateAttributes({ count: total })
    //      }
    //   }));
    // };
};
