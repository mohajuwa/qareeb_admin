// testTwilio.js
const twilio = require('twilio');

require('dotenv').config();

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const TO_MOBILE = process.env.TO_MOBILE;

async function sendTestSMS() {
    try {
        const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        const otp = Math.floor(100000 + Math.random() * 900000);

        console.log("Generated OTP:", otp);

        const message = await client.messages.create({
            body: `Your Qareeb verification code is: ${otp}`,
            from: TWILIO_PHONE_NUMBER,
            to: TO_MOBILE
        });

        console.log("SMS sent!");
        console.log("SID:", message.sid);
        console.log("Status:", message.status);
    } catch (error) {
        console.error("Error sending SMS:");
        console.error("Code:", error.code);
        console.error("Message:", error.message);
    }
}

sendTestSMS();
