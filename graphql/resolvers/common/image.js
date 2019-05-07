const resolve = image =>
  Object.assign({}, image, {
    src: `${image.src}${image.size}`,
    pre: `${image.src}${image.size}`,
  });

module.exports = { resolve };
