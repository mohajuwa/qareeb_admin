/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */



const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/databse_query");



router.get("/list", auth, async(req, res)=>{
    try {
        const coupon_list = await DataFind(`SELECT * FROM tbl_coupon`);
        
        res.render("coupon", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, coupon_list
        })
    } catch (error) {
        console.log(error);
    }
})

router.post("/add_coupon", auth, async(req, res)=>{
    try {
        const {title, sub_title, code, start_date, end_date, min_amount, discount_amount} = req.body;
        
        if (await DataInsert(`tbl_coupon`, `title, sub_title, code, start_date, end_date, min_amount, discount_amount`,
            `'${title}', '${sub_title}', '${code}', '${start_date}', '${end_date}', '${min_amount}', '${discount_amount}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Coupon Add successfully');
        res.redirect("/coupon/list");
    } catch (error) {
        console.log(error);
    }
})

router.post("/edit_coupon/:id", auth, async(req, res)=>{
    try {
        const {title, sub_title, code, start_date, end_date, min_amount, discount_amount} = req.body;

        if (await DataUpdate(`tbl_coupon`,
            `title = '${title}', sub_title = '${sub_title}', code = '${code}', start_date = '${start_date}', end_date = '${end_date}', min_amount = '${min_amount}', 
            discount_amount = '${discount_amount}'`,
            `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Coupon Updated successfully');
        res.redirect("/coupon/list");
    } catch (error) {
        console.log(error);
        
    }
})

router.get("/delete/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_coupon`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Coupon Deleted successfully');
        res.redirect("/coupon/list");
    } catch (error) {
        console.log(error);
        
    }
})


module.exports = router;