/**
 * General Currency Formatter function
 * @param {string} currencyCode currency code
 * @param {number} amount amount to format
 * @param {boolean?} isNumber For number with decimals, option to return as fixed string
 *  Example:
 *    isNumber = true: 34.30 -> 34.3 (Number)
 *    isNumber = false: 34.30 -> 34.30 (String)
 *  Defaults to `false`
 */
function formatCurrency(currencyCode, amount, isNumber = false) {
  switch (currencyCode) {
    // Rounding up to nearest 100 e.g. 73478 -> 73500
    case 'KRW':
      return Math.ceil(Number(amount) / 100) * 100;
    // VND and IDR not sure but based on klook for now
    // Round up to nearest 1 e.g. 3.49 => 4
    case 'THB':
      return Math.ceil(Number(amount) / 10) * 10;
    // other currencies defaulted to units place
    case 'VND':
    case 'IDR':
    case 'JPY':
    case 'INR':
    case 'MYR':
    case 'PHP':
    case 'CNY':
    case 'EUR':
    case 'USD':
    case 'SGD':
    default:
      return Math.ceil(Number(amount));
  }
}

function limitDecimals(number) {
  if (typeof number !== 'number') return number;
  const string = number.toString();
  return string.includes('.') && string.substring(string.indexOf('.')).length > 4
    ? Number(number.toFixed(2))
    : number;
}

module.exports = {
  formatCurrency,
  limitDecimals,
};
