const unit = require('.');

describe('safeGet', () => {
  it('should return expected result', () => {
    /** Should not throw error */
    expect(unit.safeGet(() => ''.bbb.ccc)).toBe(null);

    const obj1 = { aaa: { bbb: { ccc: 'ddd' } } };
    expect(unit.safeGet(() => obj1.aaa.bbb.ccc)).toBe('ddd');
  });
});
