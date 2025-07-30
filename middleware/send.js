const axios = require('axios');
const { DataFind } = require("./databse_query");

const sendOneNotification = async (text, type, id, data) => {
    const general_setting = await DataFind(`SELECT * FROM tbl_general_settings`)
    const app_id = general_setting[0].one_app_id;
    const api_key = general_setting[0].one_api_key;

    let message

    if (data === undefined) {
        message = {
            app_id: app_id,
            contents: { "en": text },
            headings: { "en": general_setting[0].title },
            included_segments: ["Subscribed Users"],
            filters: [
                { "field": "tag", "key": "subscription_user_Type", "relation": "=", "value": type },
                { "operator": "AND" },
                { "field": "tag", "key": "Login_ID", "relation": "=", "value": id }
            ]
        };
        
    } else {
        message = {
            app_id: app_id,
            contents: { "en": data.description }, // en-GB
            headings: { "en": data.title },
            included_segments: ["Subscribed Users"],
            filters: [
                { "field": "tag", "key": "subscription_user_Type", "relation": "=", "value": type },
                { "operator": "AND" },
                { "field": "tag", "key": "Login_ID", "relation": "=", "value": id }
            ],
            big_picture: data.imageUrl // Only Live Url Work
        };
    }


    axios.post('https://onesignal.com/api/v1/notifications', message, {
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization': `Basic ${api_key}`
        }
    })
    .then(response => {
        console.log('Notification send successfully');
    })
    .catch(error => {
        console.error(error.response.data);
    });
}



module.exports = sendOneNotification;