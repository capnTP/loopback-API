/**
 * Created by ashishmishra on 7/18/2017 AD.
 */

const babelrc = {
    "presets": [
        "es2015",
        "stage-0",
        "react"
    ]
};

const prod = [
        "transform-class-properties"
    ];


const dev =  [
        "transform-runtime",
        "transform-class-properties"
    ];

if(process.env.NODE_ENV==="production" || process.env.NODE_ENV==="development"){
    babelrc.plugins = dev;
}
else{
    babelrc.plugins = dev;
}

module.exports = babelrc;
