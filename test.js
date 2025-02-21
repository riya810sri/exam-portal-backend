const mailSender = require('./utils/emailUtils');
const email = "abhishekfbg864@gmail.com";
const sub = "testing";
const text = "welcome";

const res = mailSender(email,sub,text);
console.log(res);