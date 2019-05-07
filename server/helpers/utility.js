// Utilty helper library
exports.randomInt = function(min,max){
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

exports.str_hyphenate = function(str) {
    return str.split(' ').join('-');
}
