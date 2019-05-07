const _ = require('lodash');
const request = require('request');
const {
  newLoopbackError,
  HTTPStatusCode: {
    FORBIDDEN
  },
  constants: {
    isProduction
  },
  loggerBuilder,
  getSafe
} = require('../../utility')

const logger = loggerBuilder('SubProduct')

const sampleValidMapObject = [{
  title: 'string',
  description: 'string',
  latitude: '100.1',
  longitude: '100.1'
}]
const sampleValidItineraryObject = [{
  title: 'string',
  description: 'string',
  time: {
    from: '09:00',
    to: '11:00'
  }
}]
const sampleValidBasePriceObject = {
  adult: {
    walk_in: 0,
    suppliers: 0,
    selling: 0
  },
  child: {
    walk_in: 0,
    suppliers: 0,
    selling: 0
  },
  infant: {
    walk_in: 0,
    suppliers: 0,
    selling: 0
  },
}

const SLACK_URL = isProduction ? 'https://hooks.slack.com/services/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' : 'https://hooks.slack.com/services/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'

const sendErrorToSlack = (errorObj, id) => {
  const objectStatus = {
    message: errorObj.origin ? errorObj.origin.message : errorObj.message,
    status: errorObj.status
  }

  const payload = {
    text: `*:label:Error in Duplicating Sub Product *:scroll:\n
    *Sub Product ID*: ${id}\n
    *Errors* : \`\`\`${objectStatus.message}\`\`\`
    *Status* : \`\`\`${JSON.stringify(objectStatus.status)}\`\`\``,
    username: 'Error Reporter',
    icon_emoji: ':bug:',
  }
  const options = {
    url: SLACK_URL,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
  };

  request.post(options)
}


module.exports = function (SubProducts) {
  // hide delete remote method
  // SubProducts.disableRemoteMethodByName('deleteById');
  SubProducts.disableRemoteMethodByName('prototype.__delete__accessTokens');
  SubProducts.disableRemoteMethodByName('prototype.__destroyById__accessTokens');

  SubProducts.beforeRemote('find', (ctx, products, next) => {
    ctx.args.filter = {
      include: [
        'localization',
        {
          relation: 'cancellation_policy',
          scope: {
            include: 'localization'
          }
        },
      ],
      limit: 40,
      ...ctx.args.filter,
    }
    return next()
  })

  SubProducts.beforeRemote('findById', (ctx, product, next) => {
    ctx.args.filter = {
      include: [
        'localization',
        {
          relation: 'cancellation_policy',
          scope: {
            include: 'localization'
          }
        },
      ],
      limit: 40,
      ...ctx.args.filter,
    }
    return next()
  })

  // valadation map
  // SubProducts.observe('before save', (ctx, next) => {
  //   const newData = ctx.instance || ctx.data
  //   if (!newData || !newData.map || newData.map === '') return next()
  //   try {
  //     const mapsArrays = JSON.parse(newData.map)
  //     if (mapsArrays.length === 0) return next()
  //     const isValid = mapsArrays
  //       .map(mapObject => (mapObject.title != undefined && mapObject.description != undefined && mapObject.latitude != undefined && mapObject.longitude != undefined))
  //       .reduce((acc, cur) => acc && cur)
  //     if (!isValid) return next(newLoopbackError(FORBIDDEN, 'VALIDATION_ERROR', 'SubProducts.map validation error', { map: newData.map, sampleValidMapObject }))
  //   } catch (error) {
  //     return next(newLoopbackError(FORBIDDEN, 'VALIDATION_ERROR', 'SubProducts.map validation error', { map: newData.map, sampleValidMapObject }))
  //   }
  //   return next()
  // })

  // // valadation itinerary
  // SubProducts.observe('before save', (ctx, next) => {
  //   const newData = ctx.instance || ctx.data
  //   if (!newData || !newData.itinerary || newData.itinerary === '') return next()
  //   try {
  //     const itinerarysArrays = JSON.parse(newData.itinerary)
  //     if (itinerarysArrays.length === 0) return next()
  //     const isValid = itinerarysArrays
  //       .map(itineraryObject => (itineraryObject.title != undefined && itineraryObject.description != undefined
  //         && itineraryObject.time != undefined && itineraryObject.time.from != undefined && itineraryObject.time.to != undefined))
  //       .reduce((acc, cur) => acc && cur)
  //     if (!isValid) return next(newLoopbackError(FORBIDDEN, 'VALIDATION_ERROR', 'SubProducts.itinerary validation error', { itinerary: newData.itinerary, sampleValidItineraryObject }))
  //   } catch (error) {
  //     return next(newLoopbackError(FORBIDDEN, 'VALIDATION_ERROR', 'SubProducts.itinerary validation error', { itinerary: newData.itinerary, sampleValidItineraryObject }))
  //   }
  //   return next()
  // })

  // // valadation base price
  // SubProducts.observe('before save', (ctx, next) => {
  //   const newData = ctx.instance || ctx.data
  //   if (!newData || !newData.base_price || newData.base_price === '') return next()
  //   try {
  //     const basePriceObject = typeof newData.base_price === 'string' ? JSON.parse(newData.base_price) : newData.base_price
  //     const isValid = basePriceObject.adult != undefined && basePriceObject.adult.walk_in != undefined && basePriceObject.adult.suppliers != undefined && basePriceObject.adult.selling != undefined
  //     && basePriceObject.child != undefined && basePriceObject.child.walk_in != undefined && basePriceObject.child.suppliers != undefined && basePriceObject.child.selling != undefined
  //     && basePriceObject.infant != undefined && basePriceObject.infant.walk_in != undefined && basePriceObject.infant.suppliers != undefined && basePriceObject.infant.selling != undefined
  //     if (!isValid) return next(newLoopbackError(FORBIDDEN, 'VALIDATION_ERROR', 'SubProducts.basePrice validation error', { base_price: newData.base_price, sampleValidBasePriceObject }))
  //   } catch (error) {
  //     return next(newLoopbackError(FORBIDDEN, 'VALIDATION_ERROR', 'SubProducts.base_price validation error', { base_price: newData.base_price, sampleValidBasePriceObject }))
  //   }
  //   return next()
  // })

  _.mixin({
    absDifference(first, second) {
      return _.union(_.difference(first, second), _.difference(second, first));
    },
  });

  // Add/Remove the entries with same pax details in pricing table
  const makePriceEquilibrium = async (basePrice, sub_product_id) => {
    const { Pricing } = SubProducts.app.models
    const prices = await Pricing.find({ where: { sub_product_id } })
    await Promise.all(prices.map((price) => {
      // shallow clone array to not use the same reference
      // don't need to deep clone because we're not modifying objects inside
      // Clone in order to not directly update pricing before updating through 'updateAttributes'
      let overridePrice = [...price.override_price]
      const basePaxes = _.map(basePrice, 'pax')
      const overridePaxes = _.map(overridePrice, 'pax')
      const paxDifferences = _.absDifference(basePaxes, overridePaxes)
      _.each(paxDifferences, (pax) => {
        if (overridePaxes.includes(pax)) { // removed
          overridePrice = _.reject(overridePrice, { pax })
        } else { // added
          overridePrice.push(_.findWhere(basePrice, { pax }))
        }
      })
      return paxDifferences.length
        ? price.updateAttributes({ override_price: overridePrice })
        : null
    }))
    return Promise.resolve(true)
  }

  SubProducts.observe('before save', async (ctx) => {
    const instance = ctx.instance || ctx.currentInstance
    if (getSafe(() => JSON.parse(ctx.data.base_price))) ctx.data.base_price = JSON.parse(ctx.data.base_price);
    if (!ctx.isNewInstance && 'base_price' in ctx.data) {
      const basePrice = ctx.data.base_price || instance.base_price;
      const subProductId = ctx.data.id || instance.id;
      try {
        await makePriceEquilibrium(basePrice, subProductId)
        return Promise.resolve()
      } catch (error) {
        console.log('SubProducts makePriceEquilibrium error:', error)
        const err = new Error('Failed to Update Override Price, See API logs for details')
        return Promise.reject(err)
      }
    } else {
      return Promise.resolve()
    }
  });

  SubProducts.observe('after save', async (ctx, next) => {
    try {
      const newData = ctx.instance || ctx.data
      if (newData.tour_id) {
        await Promise.all([SubProducts.app.models.Tours.updateMinimumPriceValueOfProduct([newData.tour_id]),
          SubProducts.app.models.Tours.updateDiscountPercentage([newData.tour_id])
        ])
      }
      return Promise.resolve();
    } catch (error) {
      logger.error(error)
      return Promise.resolve()
    }
  });

  const createOverridePrices = async (prices, transaction) => {
    const Pricing = SubProducts.app.models.Pricing;
    const newPrices = await Pricing.create(prices, transaction);
    return newPrices;
  }

  const createLocalizations = async (localizations, transaction) => {
    const SubProductsLang = SubProducts.app.models.SubProductsLang;
    const newLocalization = await SubProductsLang.create(localizations, transaction);
    return newLocalization;
  }

  SubProducts.duplicateIt = async (id, name, cb) => {
    const Pricing = SubProducts.app.models.Pricing;
    const filter = {
      include: ['localization']
    };
    const prices = await Pricing.find({
      where: {
        sub_product_id: parseInt(id, 10)
      }
    });
    let sub_product = await SubProducts.findById(parseInt(id, 10), filter);
    if (sub_product) {
      sub_product = sub_product.toObject();
      const oldLocalization = sub_product.localizations;
      const newName = `${sub_product.name} -(Copy)`;
      delete sub_product.id
      delete sub_product.name;
      delete sub_product.created_at;
      delete sub_product.updated_at;
      delete sub_product.localization;

      sub_product.name = name || newName;
      const tx = await SubProducts.beginTransaction({
        isolationLevel: SubProducts.Transaction.READ_COMMITTED,
        timeout: 10000
      });
      const transaction = {
        transaction: tx
      };
      const newSubProduct = await SubProducts.create(sub_product, transaction);
      if (newSubProduct) {
        const localizations = [];
        _.each(oldLocalization, (localization) => {
          let newLocalization = {};
          delete localization.id;
          delete localization.sub_product_id;
          delete localization.created_at;
          delete localization.updated_at;
          newLocalization = localization;
          newLocalization.sub_product_id = newSubProduct.id
          localizations.push(newLocalization);
        })
        if (localizations && localizations.length) {
          createLocalizations(localizations, transaction);
        }
        if (sub_product.base_price) {
          // add ovveride prices
          const newPrices = []
          _.each(prices, (price) => {
            let newPrice = {};
            delete price.id;
            delete price.sub_product_id;
            delete price.created_at;
            delete price.updated_at;
            newPrice = price;
            newPrice.sub_product_id = newSubProduct.id
            newPrices.push(newPrice);
          })
          if (newPrices.length) {
              createOverridePrices(newPrices, transaction);
          }
        }
        const txnErr = await tx.commit();
        if (txnErr) {
          return {
            status: false,
            message: txnErr.message
          }
        } else {
          return {
            status: true,
            message: 'Sub Product Duplication Successful',
            result: newSubProduct
          }
        }
      } else {
        return {
          status: false,
          message: 'Sub Product Duplication Failed'
        };
      }
    } else {
      return cb(null, {
        status: false,
        message: 'Sub Product not Found'
      });
    }
  }


  SubProducts.remoteMethod('duplicateIt', {
    accepts: [{
      arg: 'id',
      type: 'string',
      required: true,
      description: 'Sub productID',
    },
    {
      arg: 'name',
      type: 'string',
      required: false,
      description: 'Sub product name',
    }],
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/duplicate',
      verb: 'post',
    },
  });


  SubProducts.deleteOverridePrices = (id, cb) => {
    console.log('id', id)
    const Pricing = SubProducts.app.models.Pricing;
    Pricing.find({
      where: {
        sub_product_id: parseInt(id, 10)
      }
    }).then((prices) => {
      if (prices && prices.length) {
        const prmPrice = [];
        let increment = 0
        _.each(prices, (price) => {
          prmPrice.push(Pricing.destroyById(price.id));
          increment++
        })
        if (prices.length === increment) {
          return Promise.all(prmPrice).then((res) => {
            let count = 0;
            _.each(res, (counter) => {
              count += (counter && counter.count ? counter.count : 0);
            })
            cb(null, {
              status: true,
              message: `${count} - Prices deleted`
            })
          }).catch(err => cb(err));
        }
        return cb(null, {
          status: false,
          message: 'Failed to delete'
        });
      }
      return cb(null, {
        status: true,
        message: 'Nothing to delete, All clear, proceed'
      })
    }).catch(err => cb(null, {
      status: false,
      message: err.message
    }));
  }


  SubProducts.remoteMethod('deleteOverridePrices', {
    accepts: [{
      arg: 'id',
      type: 'string',
      required: true,
      description: 'Sub productID',
    }],
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/deleteCalenderPrice',
      verb: 'post',
    },
  });

  SubProducts.migrateProductFeatures = async () => {
    try {
      let countNoMatch = 0
      const noFeatures = []
      const tours = await SubProducts.app.models.Tours.find({
        include: 'features'
      })
      const subProducts = await SubProducts.find()
      await Promise.all(subProducts.map(async (subProduct) => {
        const tourModel = tours.find(t => Number(t.id) === Number(subProduct.tour_id))
        const tour = tourModel.toJSON()
        if (tour) {
          if (tour.features[0]) {
            return subProduct.updateAttributes({
              product_features: `["${Number(tour.features[0].feature_id)}"]`
            })
          } else {
            noFeatures.push(`SubProduct: ${subProduct.id}, Tour: ${tour.id}`)
          }
        } else {
          countNoMatch++
        }
      }))
      logger.info('CountNoMatch:', countNoMatch)
      logger.info('noFeatures:', noFeatures)
      return Promise.resolve('Success')
    } catch (error) {
      logger.error('MigrateProductFeatures', error)
      return Promise.reject(error)
    }
  }

  SubProducts.remoteMethod('migrateProductFeatures', {
    returns: { arg: 'response', type: 'string', root: true },
    http: { path: '/migrateProductFeature', verb: 'get' }
  })
};

