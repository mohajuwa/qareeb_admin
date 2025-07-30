/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */

const mysql = require("mysql2");
const sendOneNotification = require("../middleware/send");
const { DataFind, DataInsert, DataUpdate } = require("../middleware/databse_query");



// ============= Chat ================ //

async function formatAMPM(date) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
    const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
    return `${formattedHours}:${formattedMinutes} ${ampm}`;
}

async function ChatTime(utime) {
    const currentTime = new Date();
    const storyTime = new Date(utime);

    const timeDifference = currentTime - storyTime;
    const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
    const hours = Math.floor(timeDifference / (1000 * 60 * 60));
    const minutes = Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60));
    
    let dtime = 0;
    if (hours == "0" && minutes == "0") {
        const seconds = Math.floor((timeDifference % (1000 * 60)) / 1000);
        if (seconds == "0") dtime = `1s`;
        else dtime = `${seconds}s`;
    } else if (hours == "0" && minutes != "0") {
        dtime = `${minutes}m`;
    } else if (days == "0" && hours != "0" && minutes != "0") {
        dtime = `${hours}h`;
    } else {
        dtime = `${days}d`;
    }
    return dtime;
}

async function unreadcheck(sender, receiver, status) {
    const sitter = await DataFind(`SELECT * FROM tbl_chat_new
                                    WHERE (sender = '${sender}' AND receiver = '${receiver}') OR (sender = '${receiver}' AND receiver = '${sender}')`);

    let check = 0;
    if (sitter != "") {
        if (status == "customer") {
            check = sitter[0].dcheck == "1" ? 1 : 0;
        } 
        if (status == "driver") {
            check = sitter[0].ccheck == "1" ? 1 : 0;
        }
        return check;
    }

    
    return check;
}



async function ChatList() {
    let chat_data = await DataFind(`SELECT t1.*, COALESCE(dri.profile_image) AS profile_image, COALESCE(dri.first_name) AS dfirst_name, COALESCE(dri.last_name) AS dlast_name
                                    FROM tbl_chat_save t1
                                    LEFT JOIN tbl_driver AS dri ON t1.sender_id = dri.id
                                    INNER JOIN (
                                        SELECT MAX(id) as min_id
                                        FROM tbl_chat_save
                                        GROUP BY sender_id, resiver_id
                                    ) t2 ON t1.id = t2.min_id
                                    ORDER BY t1.id DESC;`);

    let chatListPromises = chat_data.map(async (cdata) => {
        cdata.date = await ChatTime(cdata.date);

        if (cdata.message.length > 29) {
            cdata.message = cdata.message.slice(0, 30) + '...';
        }  
        return cdata;
    });
    
    let chat_list = await Promise.all(chatListPromises);

    return chat_list;
}


async function CustomerChatList(id) {
    let chat_data = await DataFind(`SELECT t1.*, COALESCE(dri.profile_image) AS profile_image, COALESCE(dri.first_name) AS dfirst_name, COALESCE(dri.last_name) AS dlast_name
                                    FROM tbl_chat_save t1
                                    LEFT JOIN tbl_driver AS dri ON t1.sender_id = dri.id
                                    INNER JOIN (
                                        SELECT MAX(id) as min_id
                                        FROM tbl_chat_save
                                        GROUP BY sender_id, resiver_id
                                    ) t2 ON t1.id = t2.min_id
                                    WHERE t1.sender_id = '${id}' OR t1.resiver_id = '${id}'
                                    ORDER BY t1.id DESC;`);

    let chatListPromises = chat_data.map(async (cdata) => {
        cdata.date = await ChatTime(cdata.date);

        if (cdata.message.length > 29) {
            cdata.message = cdata.message.slice(0, 30) + '...';
        }  
        return cdata;
    });
    
    let chat_list = await Promise.all(chatListPromises);

    return chat_list;
}


async function AllChat(uid, sender_id, recevier_id, status, tbl_name, diff) {
    let user_data = [], chat_list = [];

    if (diff == "1") {
        if (status == "customer") user_data = await DataFind(`SELECT id, profile_image, first_name, last_name FROM tbl_driver WHERE id = '${recevier_id}'`);
        else user_data = await DataFind(`SELECT id, name FROM tbl_customer WHERE id = '${recevier_id}'`);
        
    } else {
         
        if (status == "customer") user_data = await DataFind(`SELECT id, profile_image, first_name, last_name FROM tbl_driver WHERE id = '${sender_id}'`);
        else user_data = await DataFind(`SELECT id, name FROM tbl_customer WHERE id = '${sender_id}'`);
    }


    const chat_data = await DataFind(`SELECT * FROM ${tbl_name} 
                                    WHERE (sender_id = '${sender_id}' AND resiver_id = '${recevier_id}') OR (sender_id = '${recevier_id}' AND resiver_id = '${sender_id}')  `);

    chat_data.forEach(async item => {
        const dateString = new Date(item.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        let existingDateEntry = chat_list.find(entry => entry.date === dateString);
        if (!existingDateEntry) {
            existingDateEntry = {
                date: dateString,
                chat: []
            };
            chat_list.push(existingDateEntry);
        }

        const fdate = await formatAMPM(new Date(item.date));
        existingDateEntry.chat.push({
            id: item.id, date: fdate, message: item.message, status: parseFloat(item.sender_id) == parseFloat(uid) ? 1 : 2
        });
    });
    
    return { user_data:user_data[0], chat_list }
}



async function Chat_Save(uid, sender_id, recevier_id, message, status, hostname, protocol) {
    if (!uid || !sender_id || !recevier_id  || !message || !status ) return false;

    const all_chat = await DataFind(`SELECT * FROM tbl_chat_new WHERE (sender = '${sender_id}' AND receiver = '${recevier_id}') OR (sender = '${recevier_id}' 
                                    AND receiver = '${sender_id}') `);

    let ccheck = 0, dcheck = 0;
    ccheck = status == "customer" ? 1 : 0; dcheck = status == "driver" ? 1 : 0
    if (all_chat != "") {
        if (await DataUpdate(`tbl_chat_new`, `ccheck = '${ccheck}', dcheck = '${dcheck}'`,
            `(sender = '${sender_id}' AND receiver = '${recevier_id}') OR (sender = '${recevier_id}' AND receiver = '${sender_id}')`, hostname, protocol) == -1) {
            
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }

    } else {
        if (await DataInsert(`tbl_chat_new`, `sender, receiver, ccheck, dcheck`, `'${sender_id}', '${recevier_id}', '${ccheck}', '${dcheck}'`, hostname, protocol) == -1) {
        
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }
    }
     
    

    const chat_check = await DataFind(`SELECT * FROM tbl_chat
                                    WHERE (sender_id = '${sender_id}' AND resiver_id = '${recevier_id}') OR (sender_id = '${recevier_id}' AND resiver_id = '${sender_id}') 
                                    ORDER BY id DESC LIMIT 1 `);

    // Message Save
    let ndate = new Date().toISOString();
    let today_date = "", chat_id = 0;
    const emessage = mysql.escape(message);
    if (chat_check == "") {
        const dateString = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        today_date = dateString;

    } else {

        let cdate = new Date(chat_check[0].date), ctoday = new Date();
        cdate.setHours(0, 0, 0, 0);
        ctoday.setHours(0, 0, 0, 0);

        if (cdate.getTime() != ctoday.getTime()) {
            const dateString = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            today_date = dateString;
        }
    }

    chat_id = await DataInsert(`tbl_chat`, `sender_id, resiver_id, date, message`, `'${sender_id}', '${recevier_id}', '${ndate}', ${emessage}`, hostname, protocol);

    if (chat_id == -1) return res.status(200).json({ message: process.env.dataerror, status:false });

    if (status == "driver") {
        sendOneNotification(message, 'customer', recevier_id);
    } else {
        sendOneNotification(message, 'driver', recevier_id);
    }

    return { id:chat_id.insertId, date: await formatAMPM(new Date()), today_date }
}



let chatlist = { formatAMPM, ChatTime, unreadcheck, ChatList, AllChat, Chat_Save, CustomerChatList }
module.exports = chatlist