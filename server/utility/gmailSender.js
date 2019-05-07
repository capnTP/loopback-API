const nodemailer = require('nodemailer');

const user = 'vishal.sharma@theasia.com';
const refreshToken = '1/6J3VmkAJoGaZhRG6-qxAxRNYRZ47aGCdvt2Sg5aEncQ';
const clientId = '905274823447-v59u6c71pc05ie3g80cnotol69pm03iv.apps.googleusercontent.com';
const clientSecret = 'vnqKJmcpIfHmCh4gT1Zd6g8F';

const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    type: 'OAuth2',
    clientId,
    clientSecret,
    user,
    refreshToken,
  },
});

module.exports.send = mailOptions => transporter.sendMail(mailOptions)

// transporter.on('token', token => {
//   // console.log(token)
//   console.log('new token', { token })
//   globalToken = token
// })

// // setup e-mail data with unicode symbols
// let mailOptions = {
//   from: user, // sender address
//   to: email_to, // list of receivers
//   subject: 'Hello ✔', // Subject line
//   text: 'Hello world ?', // plaintext body
//   html: '<b>Hello world ?</b>', // html body
// };

// // send mail with defined transport object
// transporter.sendMail(mailOptions).then((info)=>console.log(info.response)).catch(console.log)
