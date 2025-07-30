/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */



const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const countryCodes = require('country-codes-list');
const mysql = require("mysql2");
const bcrypt = require('bcrypt');
const { DataFind, DataUpdate } = require("../middleware/databse_query");


router.get("/index", auth, async(req, res)=>{
    try {
        const all = await DataFind(`SELECT
                                        COUNT(*) AS total,
                                        COALESCE(SUM(CASE WHEN status = '1' THEN 1 ELSE 0 END), 0) AS accept,
                                        COALESCE(SUM(CASE WHEN status = '2' THEN 1 ELSE 0 END), 0) AS iamhere,
                                        COALESCE(SUM(CASE WHEN status = '3' THEN 1 ELSE 0 END), 0) AS enterotp,
                                        COALESCE(SUM(CASE WHEN status = '4' THEN 1 ELSE 0 END), 0) AS cancel,
                                        COALESCE(SUM(CASE WHEN status = '5' THEN 1 ELSE 0 END), 0) AS start,
                                        COALESCE(SUM(CASE WHEN status = '6' THEN 1 ELSE 0 END), 0) AS end,
                                        COALESCE(SUM(CASE WHEN status = '7' THEN 1 ELSE 0 END), 0) AS ridecomplete,
                                        COALESCE(SUM(CASE WHEN status = '8' THEN 1 ELSE 0 END), 0) AS complete
                                    FROM tbl_cart_vehicle`);       

        const com = await DataFind(`SELECT
                                        COUNT(*) AS total,
                                        COALESCE(SUM(CASE WHEN status = '1' THEN 1 ELSE 0 END), 0) AS accept,
                                        COALESCE(SUM(CASE WHEN status = '2' THEN 1 ELSE 0 END), 0) AS iamhere,
                                        COALESCE(SUM(CASE WHEN status = '3' THEN 1 ELSE 0 END), 0) AS enterotp,
                                        COALESCE(SUM(CASE WHEN status = '4' THEN 1 ELSE 0 END), 0) AS cancel,
                                        COALESCE(SUM(CASE WHEN status = '5' THEN 1 ELSE 0 END), 0) AS start,
                                        COALESCE(SUM(CASE WHEN status = '6' THEN 1 ELSE 0 END), 0) AS end,
                                        COALESCE(SUM(CASE WHEN status = '7' THEN 1 ELSE 0 END), 0) AS ridecomplete,
                                        COALESCE(SUM(CASE WHEN status = '8' THEN 1 ELSE 0 END), 0) AS complete
                                    FROM tbl_order_vehicle`);

        let allstatus = [{ total: parseFloat(all[0].total) + parseFloat(com[0].total) }, { accept: parseFloat(all[0].accept) + parseFloat(com[0].accept) }, 
        { iamhere: parseFloat(all[0].iamhere) + parseFloat(com[0].iamhere) }, { enterotp: parseFloat(all[0].enterotp) + parseFloat(com[0].enterotp) }, 
        { cancel: parseFloat(all[0].cancel) + parseFloat(com[0].cancel) }, { start: parseFloat(all[0].start) + parseFloat(com[0].start) }, 
        { end: parseFloat(all[0].end) + parseFloat(com[0].end) }, { ridecomplete: parseFloat(all[0].ridecomplete) + parseFloat(com[0].ridecomplete) }, 
        { complete: parseFloat(all[0].complete) + parseFloat(com[0].complete) }];
        
        const tot_zone = await DataFind(`SELECT COUNT(*) AS total_zone FROM tbl_zone`);

        const tot_vehicle = await DataFind(`SELECT COUNT(*) AS total_vehicle FROM tbl_vehicle`);

        const tot_payment = await DataFind(`SELECT COUNT(*) AS total_payment FROM tbl_payment_detail`);

        const driver = await DataFind(`SELECT
                                        COUNT(*) AS total_driver,
                                        COALESCE(SUM(CASE WHEN status = '0' THEN 1 ELSE 0 END), 0) AS unappro,
                                        COALESCE(SUM(CASE WHEN status = '1' THEN 1 ELSE 0 END), 0) AS appro,
                                        COALESCE(SUM(CASE WHEN fstatus = '0' THEN 1 ELSE 0 END), 0) AS unverifi,
                                        COALESCE(SUM(CASE WHEN fstatus = '1' THEN 1 ELSE 0 END), 0) AS verifi
                                    FROM tbl_driver`);

        const customer = await DataFind(`SELECT
                                        COUNT(*) AS total_customer,
                                        COALESCE(SUM(CASE WHEN status = '0' THEN 1 ELSE 0 END), 0) AS unappro,
                                        COALESCE(SUM(CASE WHEN status = '1' THEN 1 ELSE 0 END), 0) AS appro
                                    FROM tbl_customer`);
        
        res.render("index", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, allstatus, tot_zone, tot_vehicle, tot_payment, driver, customer
        })
    } catch (error) {
        console.log(error);
    }
})

router.get("/profile", auth, async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);

        const admin = await DataFind(`SELECT * FROM tbl_admin WHERE id = '${req.user.user_id}'`);

        res.render("profile", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, nameCode, CountryCode, admin:admin[0]
        })
    } catch (error) {
        console.log(error);
    }
})

router.post("/check_admin", auth, async(req, res)=>{
    try {
        const { email } = req.body;
        
        const check = await DataFind(`SELECT * FROM tbl_admin WHERE email = '${email}'`);
        
        if (check == "") res.send({status:true});
        else res.send({status:false});
    } catch (error) {
        console.log(error);
    }
})

async function EditRoldedata(esname, email, country_code, phone, pass, pass, id, hostname, protocol) {
    if (await DataUpdate(`tbl_admin`,
        `name = ${esname}, email = '${email}', country_code = '${country_code}', phone = '${phone}', password = '${pass}'`,
        `id = '${id}'`, hostname, protocol) == -1) {

        return -1
    }
    return 1
}

router.post("/edit_admin/:id", auth, async(req, res)=>{
    try {
        const {name, email, country_code, phone, password } = req.body;

        let esname = mysql.escape(name), pass = "";
        const passw = await DataFind(`SELECT * FROM tbl_admin WHERE id = '${req.params.id}'`);
        
        if (passw != "") {
            if (!password) pass = passw[0].password;
            else pass = await bcrypt.hash(password, 10);
            
            if (passw[0].role == '2') {
                
                const role_data = await DataFind(`SELECT * FROM tbl_role_permission WHERE email = '${passw[0].email}' AND country_code = '${passw[0].country_code}' AND phone = '${passw[0].phone}'`);
                if (role_data != '') {
                    
                    if (await EditRoldedata(esname, email, country_code, phone, pass, pass, req.params.id, req.hostname, req.protocol) == -1) {
                        req.flash('errors', process.env.dataerror);
                        return res.redirect("/valid_license");
                    }

                    if (await DataUpdate(`tbl_role_permission`, `name = ${esname}, email = '${email}', country_code = '${country_code}', phone = '${phone}'`,
                        `id = '${role_data[0].id}'`, req.hostname, req.protocol) == -1) {
                            
                        req.flash('errors', process.env.dataerror);
                        return res.redirect("/valid_license");
                    }
                }
            } else {
                if (await EditRoldedata(esname, email, country_code, phone, pass, pass, req.params.id, req.hostname, req.protocol) == -1) {
                    req.flash('errors', process.env.dataerror);
                    return res.redirect("/valid_license");
                }
            }

            req.flash('success', 'Data Updated successfully');
        }

        res.redirect("/index");
    } catch (error) {
        console.log(error);
    }
})

router.get("/valid_license", async(req, res)=>{
    try {
        
        res.render("valid_licence")
    } catch (error) {
        console.log(error);
    }
})




module.exports = router;