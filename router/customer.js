/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */



const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const mysql = require("mysql2");
const countryCodes = require('country-codes-list');
const bcrypt = require('bcrypt');
const AllFunction = require("../route_function/function")
const AllChat = require("../route_function/chat_function");
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/databse_query");

router.get("/add", auth, async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);
        
        res.render("add_customer", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, nameCode, CountryCode
        })
    } catch (error) {
        console.log(error);
    }
})

router.post("/check_derail", auth, async(req, res)=>{
    try {
        const {ccode, phone } = req.body;

        const customer = await DataFind(`SELECT * FROM tbl_customer WHERE country_code = '${ccode}' AND phone = '${phone}'`);

        if (customer == "") return res.send({status:true});
        else return res.send({status:false});
    } catch (error) {
        console.log(error);
    }
});

router.post("/add_customer", auth, async(req, res)=>{
    try {
        const {name, email, country_code, phone, password, status } = req.body;

        let esname = mysql.escape(name);
        const statuss = status == "on" ? 1 : 0;
        const hash = await bcrypt.hash(password, 10);
        let otp_result = await AllFunction.otpGenerate(6);
        
        const date = new Date().toISOString().split('T');
        if (await DataInsert(`tbl_customer`,
            `profile_image, name, email, country_code, phone, password, status, referral_code, wallet, date`,

            `'', ${esname}, '${email}', '${country_code}', '${phone}', '${hash}', '${statuss}', '${otp_result}', '0', '${date}'`, req.hostname, req.protocol) == -1) {
            
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Customer Add successfully');
        res.redirect("/customer/list");
    } catch (error) {
        console.log(error);
    }
});

router.get("/list", auth, async(req, res)=>{
    try {
        const customer_list = await DataFind(`SELECT * FROM tbl_customer ORDER BY id DESC`);
        
        res.render("customer", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, customer_list
        })
    } catch (error) {
        console.log(error);
    }
})

router.get("/edit/:id", auth, async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);
        const customer = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${req.params.id}'`);
        
        res.render("edit_customer", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, customer:customer[0], nameCode, CountryCode
        })
    } catch (error) {
        console.log(error);
    }
})

router.post("/edit_customer/:id", auth, async(req, res)=>{
    try {
        const {name, email, country_code, phone, password, status } = req.body;

        let esname = mysql.escape(name)
        const statuss = status == "on" ? 1 : 0;

        let pass
        if (!password) {
            const passw = await DataFind(`SELECT password FROM tbl_customer WHERE id = '${req.params.id}'`);
            pass = passw[0].password
        } else {
            pass = await bcrypt.hash(password, 10);
        }

        if (await DataUpdate(`tbl_customer`,
            `name = ${esname}, email = '${email}', country_code = '${country_code}', phone = '${phone}', password = '${pass}', status = '${statuss}'`,
            `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
    
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Customer Updated successfully');
        res.redirect("/customer/list");
    } catch (error) {
        console.log(error);
    }
});

router.get("/delete/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_customer`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Customer Deleted successfully');
        res.redirect("/customer/list");
    } catch (error) {
        console.log(error);
        
    }
})

async function CustomerProfile(status, id) {
    let pubdata = [];
    if (status == "0") {
        
        let request = await DataFind(`SELECT id, c_id, d_id, status, pic_address, drop_address, start_time FROM tbl_request_vehicle
            WHERE c_id = '${id}' ORDER BY id DESC`);
        let req_card = await DataFind(`SELECT id, c_id, d_id, status, pic_address, drop_address, start_time FROM tbl_cart_vehicle
                    WHERE c_id = '${id}' ORDER BY id DESC`);
        pubdata = request.concat(req_card);
    } else {
        pubdata = await DataFind(`SELECT id, c_id, d_id, status, pic_address, drop_address, start_time FROM tbl_order_vehicle WHERE c_id = '${id}' ORDER BY id DESC`);
    }
    
    let public = [];
    for (let i = 0; i < pubdata.length;) {
        let pic_add = "", last_drop = "";
        
        let pads = pubdata[i].pic_address.split("&!");
        pic_add = pads[0];
        
        let dradd = pubdata[i].drop_address.split("&!!");
        let dspl = dradd[dradd.length - 1].split("&!");
        last_drop = dspl[0];
        
        const date = new Date(pubdata[i].start_time);
        const formattedDate = date.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        
        pubdata[i].pic_address = pic_add; pubdata[i].drop_address = last_drop; pubdata[i].start_time = formattedDate; public.push(pubdata[i]);
        i++;
    }
    return public
}

router.get("/profile/:id", auth, async(req, res)=>{
    try {
        let dr = await AllFunction.CustomerReview("cus")
        const cus = await DataFind(`SELECT cus.*
                                    ${dr.tot_review} ${dr.avgstar}
                                    FROM tbl_customer AS cus
                                    ${dr.outtable}
                                    WHERE cus.id = ${req.params.id}`);

        const customer = cus[0];
        let public = await CustomerProfile(0, req.params.id);
        
        res.render("customer_profile", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, customer, public
        })
    } catch (error) {
        console.log(error);
    }
})

router.post("/profile_publish_ride", auth, async(req, res)=>{
    try {
        const {status, drid} = req.body;

        let public = [];
        if (status == "0" || status == "1") public = await CustomerProfile(status, drid);
        else if (status == "2") {

            let walletd = await DataFind(`SELECT tc.id, tc.payment_id, tc.amount, tc.date, tc.status, tc.type, 
                                        CASE WHEN tc.status = '1' THEN COALESCE(pd.name, '') ELSE '' END AS payment_name
                                        FROM tbl_transaction_customer AS tc
                                        LEFT JOIN tbl_payment_detail AS pd ON tc.payment_id = pd.id AND tc.status NOT IN ('3')
                                        WHERE tc.c_id = '${drid}' ORDER BY tc.id DESC;`);

            walletd.map(val => {
                const date = new Date(val.date);
                const formattedDate = date.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
                val.date = formattedDate;
            })
            public = walletd;
        }
        res.send({requests:public, lan:req.lan.ld});
    } catch (error) {
        console.log(error);
    }
});



router.get("/chat/:id", auth, async(req, res)=>{
    try {
        const customer = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${req.params.id}'`);
        const pages_list = await DataFind(`SELECT * FROM tbl_list_pages`);
        let chat_list = await AllChat.CustomerChatList(req.params.id);
        
        let user = [], last_data = "", all_chat = [];
        if (chat_list != "") {
            let chatl = await AllChat.AllChat(chat_list[0].sender_id, chat_list[0].sender_id, chat_list[0].resiver_id, 'customer', 'tbl_chat_save');
            user = [chatl.user_data]; all_chat = chatl.chat_list;
            last_data = chatl.chat_list[chatl.chat_list.length - 1].chat[chatl.chat_list[chatl.chat_list.length - 1].chat.length - 1].date;
        }
        
        res.render("chat", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, pages_list, chat_list, all_chat, user, last_data, customer
        })
    } catch (error) {
        console.log(error);
    }
});

router.post("/customer_chat_list", auth, async(req, res)=>{
    try {
        const {sender, reciver} = req.body;
        
        let user = [], last_data = "", all_chat = [];
        if (sender && reciver) {
            let chatl = await AllChat.AllChat(sender, sender, reciver, 'customer', 'tbl_chat_save', 2);
            user = [chatl.user_data]; all_chat = chatl.chat_list;
            last_data = chatl.chat_list[chatl.chat_list.length - 1].chat[chatl.chat_list[chatl.chat_list.length - 1].chat.length - 1].date;
        }
        res.send({ user, last_data, all_chat });
    } catch (error) {
        console.log(error);
    }
});





module.exports = router;