/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */



const express = require("express");
const router = express.Router();
const AllChat = require("../route_function/chat_function");




router.post("/save", async(req, res)=>{
    try {
        const {uid, sender_id, recevier_id, message, status} = req.body;
        if (!uid || !sender_id || !recevier_id  || !message || !status ) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data Not Found!'});

        let save_chat = await AllChat.Chat_Save(uid, sender_id, recevier_id, message, status, req.hostname, req.protocol);
        if (save_chat === false) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data Not Found!'});

        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Data Load Successful", save_chat});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post("/chat_user", async(req, res)=>{
    try {
        const {uid, status} = req.body;
        if (!uid || !status ) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data Not Found!'});

        let cu_list = await AllChat.ChatList(uid, status);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Data Load Successful", char_user:cu_list});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post("/chat_list", async(req, res)=>{
    try {
        const {uid, sender_id, recevier_id, status} = req.body;
        if (!uid || !sender_id || !recevier_id || !status ) return res.status(200).json({ ResponseCode: 401, status:false, message: 'Data Not Found!'});

        let chat_list = await AllChat.AllChat(uid, sender_id, recevier_id, status, 'tbl_chat', 1);
        let user = chat_list.user_data != undefined ? chat_list.user_data : { id: 0, name: "" };

        if (chat_list.user_data != "" && chat_list.chat_list != "") {
            return res.status(200).json({ ResponseCode: 200, Result:true, message: "Data Load Successful", user_data: user   , 
                chat_list:chat_list.chat_list});
        } else return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Chat not found!', user_data:user, chat_list: []});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



module.exports = router;