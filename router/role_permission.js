/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */



const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const countryCodes = require('country-codes-list');
const bcrypt = require('bcrypt');
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/databse_query");





router.get("/add", auth, async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);
        
        res.render("add_role_permission", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, nameCode, CountryCode
        })
    } catch (error) {
        console.log(error);
    }
})

router.post("/check_data", auth, async(req, res)=>{
    try {
        const { email } = req.body;
        
        const check = await DataFind(`SELECT * FROM tbl_admin WHERE email = '${email}'`);
        
        if (check == "") res.send({status:true});
        else res.send({status:false});
    } catch (error) {
        console.log(error);
    }
})



router.post("/add_role", auth, async(req, res)=>{
    try {
        const { name, email, country_code, phone, status, password,  cusview, cusadd, cusedit, driview, driadd, driedit, vehpview, vehpadd, vehpedit, docseview, docseadd, docseedit, 
        defnoview, defnoadd, defnoedit, vehiview, vehiadd, vehiedit, outcatview, outcatadd, outcatedit, olistview, olistadd, olistedit, outseview, outseedit, renliview, renliadd, 
        renliedit, renseview, renseedit, packcatview, packcatadd, packcatedit, pacsetview, pacsetedit, rcanrview, rcanradd, rcanredit, rrlisview, rrlisadd, rrlisedit, vehrepview, 
        vehrepedit, outrepoview, outrepoedit, renrepopview, renrepopedit, packrepopview, packrepopedit, coupview, coupadd, coupedit, payliview, payliedit, paylview, payledit, 
        faqliview, faqliadd, faqliedit, senotiview, senotiadd, senotiedit, pagliview, pagliedit, zoneview, zoneadd, zoneedit, settview, settedit} = req.body;


        const phash = await bcrypt.hash(password, 10);

        if (await DataInsert(`tbl_admin`, `name, email, country_code, phone, password, role`, `'${name}', '${email}', '${country_code}', '${phone}', '${phash}', '2'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        if (await DataInsert(`tbl_role_permission`,
            `name, email, country_code, phone, status, customer, driver, vehicle_pre, doc_setting, def_notification, vehicle, out_category, out_list, out_setting, rental_list, 
            rental_setting, pack_category, pack_setting, ride_cancel_reason, ride_review_list, vehicle_report, outstation_report, rental_report, package_report, coupon, payment_list, 
            payout_list, faq_list, send_notification, page_list, zone, setting`,
            
            `'${name}', '${email}', '${country_code}', '${phone}', '${status}', 
            '${cusview == "on" ? "1" : "0"},${cusadd == "on" ? "1" : "0"},${cusedit == "on" ? "1" : "0"}', 
            '${driview == "on" ? "1" : "0"},${driadd == "on" ? "1" : "0"},${driedit == "on" ? "1" : "0"}', 
            '${vehpview == "on" ? "1" : "0"},${vehpadd == "on" ? "1" : "0"},${vehpedit == "on" ? "1" : "0"}', 
            '${docseview == "on" ? "1" : "0"},${docseadd == "on" ? "1" : "0"},${docseedit == "on" ? "1" : "0"}', 
            '${defnoview == "on" ? "1" : "0"},${defnoadd == "on" ? "1" : "0"},${defnoedit == "on" ? "1" : "0"}', 
            '${vehiview == "on" ? "1" : "0"},${vehiadd == "on" ? "1" : "0"},${vehiedit == "on" ? "1" : "0"}', 
            '${outcatview == "on" ? "1" : "0"},${outcatadd == "on" ? "1" : "0"},${outcatedit == "on" ? "1" : "0"}', 
            '${olistview == "on" ? "1" : "0"},${olistadd == "on" ? "1" : "0"},${olistedit == "on" ? "1" : "0"}', 
            '${outseview == "on" ? "1" : "0"},${outseedit == "on" ? "1" : "0"}', 
            '${renliview == "on" ? "1" : "0"},${renliadd == "on" ? "1" : "0"},${renliedit == "on" ? "1" : "0"}', 
            '${renseview == "on" ? "1" : "0"},${renseedit == "on" ? "1" : "0"}', 
            '${packcatview == "on" ? "1" : "0"},${packcatadd == "on" ? "1" : "0"},${packcatedit == "on" ? "1" : "0"}', 
            '${pacsetview == "on" ? "1" : "0"},${pacsetedit == "on" ? "1" : "0"}', 
            '${rcanrview == "on" ? "1" : "0"},${rcanradd == "on" ? "1" : "0"},${rcanredit == "on" ? "1" : "0"}', 
            '${rrlisview == "on" ? "1" : "0"},${rrlisadd == "on" ? "1" : "0"},${rrlisedit == "on" ? "1" : "0"}', 
            '${vehrepview == "on" ? "1" : "0"},${vehrepedit == "on" ? "1" : "0"}', 
            '${outrepoview == "on" ? "1" : "0"},${outrepoedit == "on" ? "1" : "0"}', 
            '${renrepopview == "on" ? "1" : "0"},${renrepopedit == "on" ? "1" : "0"}', 
            '${packrepopview == "on" ? "1" : "0"},${packrepopedit == "on" ? "1" : "0"}', 
            '${coupview == "on" ? "1" : "0"},${coupadd == "on" ? "1" : "0"},${coupedit == "on" ? "1" : "0"}', 
            '${payliview == "on" ? "1" : "0"},${payliedit == "on" ? "1" : "0"}', 
            '${paylview == "on" ? "1" : "0"},${payledit == "on" ? "1" : "0"}', 
            '${faqliview == "on" ? "1" : "0"},${faqliadd == "on" ? "1" : "0"},${faqliedit == "on" ? "1" : "0"}', 
            '${senotiview == "on" ? "1" : "0"},${senotiadd == "on" ? "1" : "0"},${senotiedit == "on" ? "1" : "0"}', 
            '${pagliview == "on" ? "1" : "0"},${pagliedit == "on" ? "1" : "0"}', 
            '${zoneview == "on" ? "1" : "0"},${zoneadd == "on" ? "1" : "0"},${zoneedit == "on" ? "1" : "0"}', 
            '${settview == "on" ? "1" : "0"},${settedit == "on" ? "1" : "0"}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Role Add successfully');
        res.redirect("/role/list");
    } catch (error) {
        console.log(error);
    }
});





router.get("/list", auth, async(req, res)=>{
    try {
        const role_data = await DataFind(`SELECT id, name, email, country_code, phone, status FROM tbl_role_permission ORDER BY id DESC`);
        
        res.render("role_permission", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, role_data
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
        const role_data = await DataFind(`SELECT * FROM tbl_role_permission WHERE id = '${req.params.id}'`);
        
        let index = 0;
        let role = Object.keys(role_data[0]).reduce((key, i) => {
            let rval = role_data[0][i];
            if (index > 5) rval = rval.split(",");
            key[i] = rval;
            index++;
            return key;
        }, {});
        
        res.render("edit_role_permission", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, nameCode, CountryCode, role
        })
    } catch (error) {
        console.log(error);
    }
})

router.post("/edit_role/:id", auth, async(req, res)=>{
    try {
        const { name, email, country_code, phone, status, password,  cusview, cusadd, cusedit, driview, driadd, driedit, vehpview, vehpadd, vehpedit, docseview, docseadd, docseedit, 
        defnoview, defnoadd, defnoedit, vehiview, vehiadd, vehiedit, outcatview, outcatadd, outcatedit, olistview, olistadd, olistedit, outseview, outseedit, renliview, renliadd, 
        renliedit, renseview, renseedit, packcatview, packcatadd, packcatedit, pacsetview, pacsetedit, rcanrview, rcanradd, rcanredit, rrlisview, rrlisadd, rrlisedit, vehrepview, 
        vehrepedit, outrepoview, outrepoedit, renrepopview, renrepopedit, packrepopview, packrepopedit, coupview, coupadd, coupedit, payliview, payliedit, paylview, payledit, 
        faqliview, faqliadd, faqliedit, senotiview, senotiadd, senotiedit, pagliview, pagliedit, zoneview, zoneadd, zoneedit, settview, settedit} = req.body;

        const role_data = await DataFind(`SELECT * FROM tbl_role_permission WHERE id = '${req.params.id}'`);
        
        if (role_data != "") {
            const admin = await DataFind(`SELECT * FROM tbl_admin WHERE country_code = '${role_data[0].country_code}' AND phone = '${role_data[0].phone}'`);
            
            let hase = ""
            if (password) hase = await bcrypt.hash(password, 10);
            else hase = admin[0].password
    
            if (await DataUpdate(`tbl_admin`, `name = '${name}', email = '${email}', country_code = '${country_code}', phone = '${phone}', password = '${hase}'`,
                `country_code = '${role_data[0].country_code}' AND phone = '${role_data[0].phone}'`, req.hostname, req.protocol) == -1) {
            
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }

            if (await DataUpdate(`tbl_role_permission`, `name='${name}', email='${email}', country_code='${country_code}', phone='${phone}', status='${status}',
                customer = '${cusview == "on" ? "1" : "0"},${cusadd == "on" ? "1" : "0"},${cusedit == "on" ? "1" : "0"}',
                driver = '${driview == "on" ? "1" : "0"},${driadd == "on" ? "1" : "0"},${driedit == "on" ? "1" : "0"}',
                vehicle_pre = '${vehpview == "on" ? "1" : "0"},${vehpadd == "on" ? "1" : "0"},${vehpedit == "on" ? "1" : "0"}',
                doc_setting = '${docseview == "on" ? "1" : "0"},${docseadd == "on" ? "1" : "0"},${docseedit == "on" ? "1" : "0"}',
                def_notification = '${defnoview == "on" ? "1" : "0"},${defnoadd == "on" ? "1" : "0"},${defnoedit == "on" ? "1" : "0"}',
                vehicle = '${vehiview == "on" ? "1" : "0"},${vehiadd == "on" ? "1" : "0"},${vehiedit == "on" ? "1" : "0"}',
                out_category = '${outcatview == "on" ? "1" : "0"},${outcatadd == "on" ? "1" : "0"},${outcatedit == "on" ? "1" : "0"}',
                out_list = '${olistview == "on" ? "1" : "0"},${olistadd == "on" ? "1" : "0"},${olistedit == "on" ? "1" : "0"}',
                out_setting = '${outseview == "on" ? "1" : "0"},${outseedit == "on" ? "1" : "0"}',
                rental_list = '${renliview == "on" ? "1" : "0"},${renliadd == "on" ? "1" : "0"},${renliedit == "on" ? "1" : "0"}',
                rental_setting = '${renseview == "on" ? "1" : "0"},${renseedit == "on" ? "1" : "0"}',
                pack_category = '${packcatview == "on" ? "1" : "0"},${packcatadd == "on" ? "1" : "0"},${packcatedit == "on" ? "1" : "0"}',
                pack_setting = '${pacsetview == "on" ? "1" : "0"},${pacsetedit == "on" ? "1" : "0"}',
                ride_cancel_reason = '${rcanrview == "on" ? "1" : "0"},${rcanradd == "on" ? "1" : "0"},${rcanredit == "on" ? "1" : "0"}',
                ride_review_list = '${rrlisview == "on" ? "1" : "0"},${rrlisadd == "on" ? "1" : "0"},${rrlisedit == "on" ? "1" : "0"}',
                vehicle_report = '${vehrepview == "on" ? "1" : "0"},${vehrepedit == "on" ? "1" : "0"}',
                outstation_report = '${outrepoview == "on" ? "1" : "0"},${outrepoedit == "on" ? "1" : "0"}',
                rental_report = '${renrepopview == "on" ? "1" : "0"},${renrepopedit == "on" ? "1" : "0"}',
                package_report = '${packrepopview == "on" ? "1" : "0"},${packrepopedit == "on" ? "1" : "0"}',
                coupon = '${coupview == "on" ? "1" : "0"},${coupadd == "on" ? "1" : "0"},${coupedit == "on" ? "1" : "0"}',
                payment_list = '${payliview == "on" ? "1" : "0"},${payliedit == "on" ? "1" : "0"}',
                payout_list = '${paylview == "on" ? "1" : "0"},${payledit == "on" ? "1" : "0"}',
                faq_list = '${faqliview == "on" ? "1" : "0"},${faqliadd == "on" ? "1" : "0"},${faqliedit == "on" ? "1" : "0"}',
                send_notification = '${senotiview == "on" ? "1" : "0"},${senotiadd == "on" ? "1" : "0"},${senotiedit == "on" ? "1" : "0"}',
                page_list = '${pagliview == "on" ? "1" : "0"},${pagliedit == "on" ? "1" : "0"}',
                zone = '${zoneview == "on" ? "1" : "0"},${zoneadd == "on" ? "1" : "0"},${zoneedit == "on" ? "1" : "0"}',
                setting = '${settview == "on" ? "1" : "0"},${settedit == "on" ? "1" : "0"}'`,
                `id = '${role_data[0].id}'`, req.hostname, req.protocol) == -1) {
                    
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
    
            req.flash('success', 'Role Updated successfully');
        }

        res.redirect("/role/list");
    } catch (error) {
        console.log(error);
    }
});





router.get("/delete/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_role_permission`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {

            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        if (await DataDelete(`tbl_admin`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Role Deleted successfully');
        res.redirect("/role/list");
    } catch (error) {
        console.log(error);
        
    }
})



module.exports = router;