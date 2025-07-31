const https = require('https');
const querystring = require('querystring');

// بياناتك من MSG91
const AUTH_KEY = '462381AIhJTI19kB68899e8dP1'; // استبدله بالمفتاح الحقيقي
const TO_MOBILE = '967775607018'; // رقمك باليمن
const SENDER_ID = 'TESTIN'; // تأكد إنه مفعل أو مقبول
const COUNTRY_CODE = '967';
const ROUTE = '4'; // للإشعارات أو OTP، لا تستخدم 1 أو 2 بدون تأكيد

function sendOtpSMS() {
    const otp = Math.floor(100000 + Math.random() * 900000);
    console.log("Generated OTP:", otp);

    const message = `رمزك هو: ${otp}`;
    const queryParams = querystring.stringify({
        mobiles: TO_MOBILE,
        authkey: AUTH_KEY,
        route: ROUTE,
        sender: SENDER_ID,
        message: message,
        country: COUNTRY_CODE,
    });

    const url = `https://api.msg91.com/api/sendhttp.php?${queryParams}`;

    https.get(url, (res) => {
        let data = '';

        res.on('data', chunk => {
            data += chunk;
        });

        res.on('end', () => {
            console.log("MSG91 Response:", data);
        });
    }).on('error', (e) => {
        console.error("Error sending SMS:", e);
    });
}

sendOtpSMS();
