module.exports = {
  convert(money, price, from, to) {
    if (!money || !price) {
      return 0;
    }

    if (from === to) {
      return price;
    }

    try {
      return money(price)
        .from(from)
        .to(to);
    } catch (e) {
      return price;
    }
  },
};
