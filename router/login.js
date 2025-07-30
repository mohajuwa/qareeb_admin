/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */



const express = require("express");
const router = express.Router();
const countryCodes = require('country-codes-list');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { DataFind, DataInsert } = require("../middleware/databse_query");


router.get("/", async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);
        const login_data = await DataFind(`SELECT * FROM tbl_admin`);
        const general = await DataFind(`SELECT * FROM tbl_general_settings`);

        if (login_data == "") {
            const hash = await bcrypt.hash('modwir', 10);
            if (await DataInsert(`tbl_admin`, `name, email, country_code, phone, password, role`, `'admin', 'modwir@modwir.com', '+967', '775992377', '${hash}', '1'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        }
        
        res.render("login", {
            nameCode, CountryCode, general:general[0]
        });
    } catch (error) {
        console.log(error);
    }
});

router.get('/valid_license', async (req, res)=>{
    const general = await DataFind(`SELECT * FROM tbl_general_settings`);
   
    res.render('valid_license',{general:general[0]})
});

router.post("/login", async(req, res)=>{
    try {
        const {email, password} = req.body;

        const login_data = await DataFind(`SELECT * FROM tbl_admin WHERE email = '${email}'`);
        
        if (login_data == "") {
            req.flash('errors', 'Phone No. Not Register');
            return res.redirect("/");
        }
        
        const hash_pass = await bcrypt.compare(password, login_data[0].password);
        
        if (!hash_pass) {
            req.flash('errors', 'Your Password is Wrong');
            return res.redirect("/");
        }

        let lan = req.cookies.zippygolan;
        if (!lan) {
            const lantoken = jwt.sign({lan:"en"}, process.env.jwt_key);
            res.cookie("zippygolan", lantoken);
        }

        const token = jwt.sign({user_id:login_data[0].id, user_email:login_data[0].email, user_role:login_data[0].role}, process.env.jwt_key); 
        res.cookie("zippygo", token, {expires: new Date(Date.now() + 60000 * 60)})

        res.redirect("index");
    } catch (error) {
        console.log(error);
        
    }
})

router.post("/language", async(req, res)=>{
    try {
        const {lan} = req.body;
        const lantoken = jwt.sign({lan:lan}, process.env.jwt_key);
        res.cookie("zippygolan", lantoken);

        res.status(200).json(lantoken);
    } catch (error) {
        console.log(error);
    }
});

router.get("/logout", async(req, res)=>{
    try {
        res.clearCookie("zippygolan")

        res.redirect("/")
    } catch (error) {
        console.log(error);
        
    }
})



module.exports = router;