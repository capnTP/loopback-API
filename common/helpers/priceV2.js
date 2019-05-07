const moment = require('moment')
const logger = require('../utility').loggerBuilder('priceV2')

module.exports = {
  format: 'YYYY-MM-DDTHH:mm:ss.SSSSZ',
  getActiveSubProduct(subProducts = []) {
    return subProducts.filter((subproduct) => {
      if (!subproduct.status) return false
      if (!Array.isArray(subproduct.base_price) ||
        subproduct.base_price.length < 1) return false
      return subproduct
    })
  },
  getMinPriceActiveSubProduct(subproducts = []) {
    const activeSubproduct = this.getActiveSubProduct(subproducts)
    if (activeSubproduct.length < 1) return undefined
    return activeSubproduct
      .reduce((acc, cur) => [...acc, ...cur.base_price], [])
      .sort((a, b) => a.sellingPrice.adults - b.sellingPrice.adults)[0]
  },
  getMaxDiscountActiveSubproduct(subproducts = []) {
    const activeSubproduct = this.getActiveSubProduct(subproducts).filter(sp => sp.base_price[0].walkInPrice)
    if (activeSubproduct.length < 1) return 0
    return Math.max(...activeSubproduct
      .reduce((acc, cur) => [...acc, ...cur.base_price], [])
      .map((base_price) => {
        const adultDiscount = Number(base_price.walkInPrice.adults)
          && Number(base_price.walkInPrice.adults) > Number(base_price.sellingPrice.adults)
            ? ((Math.abs(base_price.walkInPrice.adults - base_price.sellingPrice.adults) / base_price.walkInPrice.adults) * 100 || 0)
            : 0
        const childDiscount = Number(base_price.walkInPrice.children)
          && Number(base_price.walkInPrice.children) > Number(base_price.sellingPrice.children)
            ? ((Math.abs(base_price.walkInPrice.children - base_price.sellingPrice.children) / base_price.walkInPrice.children) * 100 || 0)
            : 0
        const infantDiscount = Number(base_price.walkInPrice.infants)
          && Number(base_price.walkInPrice.infants) > Number(base_price.sellingPrice.infants)
            ? ((Math.abs(base_price.walkInPrice.infants - base_price.sellingPrice.infants) / base_price.walkInPrice.infants) * 100 || 0)
            : 0
        return Math.max(adultDiscount, childDiscount, infantDiscount)
      }))
  },
}
