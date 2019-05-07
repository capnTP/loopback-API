const unit = require('.');

const mock_money_lib = value => ({
  from() {
    return {
      to() {
        return value + 1;
      },
    };
  },
});

describe('convert', () => {
  it('should return expected result', () => {
    expect(unit.convert('', 1000, 'usd', 'krw')).toBe(0);
    expect(unit.convert(mock_money_lib, 0, 'usd', 'krw')).toBe(0);
    expect(unit.convert(mock_money_lib, 100, 'usd', 'usd')).toBe(100);
    expect(unit.convert(mock_money_lib, 100, 'krw', 'usd')).toBe(101);
  });
});
