/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */



const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const multer  = require('multer');
const mysql = require("mysql2");
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/databse_query");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/rental");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const upload = multer({storage : storage});

const storage2 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/module_setting");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const msetting = multer({storage : storage2});


router.get("/list", auth, auth, async(req, res)=>{
    try {
        const rental_list = await DataFind(`SELECT * FROM tbl_rental`);
        
        res.render("rental", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, rental_list
        })
    } catch (error) {
        console.log(error);
    }
})

router.get("/add", auth, auth, async(req, res)=>{
    try {
        const vehicle_list = await DataFind(`SELECT * FROM tbl_vehicle WHERE status = "1"`);

        res.render("add_rental", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, vehicle_list
        })
    } catch (error) {
        console.log(error);
    }
})

router.post("/add_rental", auth, upload.single('image'), async(req, res)=>{
    try {
        const {name, per_hour_charge, per_hour_discount, num_of_hour, per_hour_km_charge, after_min_charge, after_km_charge, comission_rate, comission_type, extra_charge, vehicle, 
                bidding, whether_charge, status, minimum_fare, maximum_fare} = req.body;

        const imageUrl = req.file ? "uploads/rental/" + req.file.filename : null;
        const offer = bidding == "on" ? 1 : 0;
        const minfare = bidding == "on" ? minimum_fare : "";
        const maxifare = bidding == "on" ? maximum_fare : "";
        const crate = comission_type == "on" ? '%' : 'FIX';
        const ctype = whether_charge == "on" ? 1 : 0;
        const statuss = status == "on" ? 1 : 0;
        let esname = mysql.escape(name)

        if (await DataInsert(`tbl_rental`,
            `image, name, per_hour_charge, per_hour_discount, num_of_hour, per_hour_km_charge, after_min_charge, after_km_charge, comission_rate, comission_type, extra_charge, 
            vehicle, bidding, minimum_fare, maximum_fare, whether_charge, status`,
            `'${imageUrl}', ${esname}, '${per_hour_charge}', '${per_hour_discount}', '${num_of_hour}', '${per_hour_km_charge}', '${after_min_charge}', '${after_km_charge}', 
            '${comission_rate}', '${crate}', '${extra_charge}', '${vehicle}', '${offer}', '${minfare}', '${maxifare}', '${ctype}', '${statuss}'`, req.hostname, req.protocol) == -1) {
    
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Rental Add successfully');
        res.redirect("/rental/list");
    } catch (error) {
        console.log(error);
        
    }
})

router.get("/edit/:id", auth, auth, async(req, res)=>{
    try {
        const vehicle_list = await DataFind(`SELECT * FROM tbl_vehicle WHERE status = "1"`);
        const rental_list = await DataFind(`SELECT * FROM tbl_rental WHERE id = '${req.params.id}'`);
        let vehicle = !rental_list[0].vehicle || rental_list[0].vehicle == "" ? '' : rental_list[0].vehicle.split(",")

        res.render("edit_rental", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, vehicle_list, rental:rental_list[0], vehicle
        })
    } catch (error) {
        console.log(error);
    }
})

router.post("/edit_rental/:id", auth, upload.single('image'), async(req, res)=>{
    try {
        const {name, per_hour_charge, per_hour_discount, num_of_hour, per_hour_km_charge, after_min_charge, after_km_charge, comission_rate, comission_type, extra_charge, vehicle, 
            bidding, whether_charge, status, minimum_fare, maximum_fare} = req.body;

        let imageUrl;
        if (req.file) {
            imageUrl = "uploads/rental/" + req.file.filename
        } else {
            const category = await DataFind(`SELECT image FROM tbl_rental WHERE id = '${req.params.id}'`);
            imageUrl = category[0].image
        }

        const offer = bidding == "on" ? 1 : 0;
        const minfare = bidding == "on" ? minimum_fare : "";
        const maxifare = bidding == "on" ? maximum_fare : "";
        const crate = comission_type == "on" ? '%' : 'FIX';
        const ctype = whether_charge == "on" ? 1 : 0;
        const statuss = status == "on" ? 1 : 0;
        let esname = mysql.escape(name)

        if (await DataUpdate(`tbl_rental`,
            `image = '${imageUrl}', name = ${esname}, per_hour_charge = '${per_hour_charge}', per_hour_discount = '${per_hour_discount}', num_of_hour = '${num_of_hour}', 
            per_hour_km_charge = '${per_hour_km_charge}', after_min_charge = '${after_min_charge}', after_km_charge = '${after_km_charge}', comission_rate = '${comission_rate}', 
            comission_type = '${crate}', extra_charge = '${extra_charge}', vehicle = '${vehicle}', bidding = '${offer}', minimum_fare = '${minfare}', maximum_fare = '${maxifare}', 
            whether_charge = '${ctype}', status = '${statuss}'`,
            `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
    
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Rental Updated successfully');
        res.redirect("/rental/list");
    } catch (error) {
        console.log(error);
    }
})

router.get("/delete/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_rental`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Rental Deleted successfully');
        res.redirect("/rental/list");
    } catch (error) {
        console.log(error);
        
    }
})



router.get("/setting", auth, async(req, res)=>{
    try {
        const msetting = await DataFind(`SELECT * FROM tbl_module_setting WHERE id = '2'`);
        
        res.render("rental_setting", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, msetting
        })
    } catch (error) {
        console.log(error);
    }
})

router.post("/edit_rental_setting", auth, msetting.single('image'), async(req, res)=>{
    try {
        const {name, description} = req.body;

        let imageUrl;
        if (req.file) {
            imageUrl = "uploads/module_setting/" + req.file.filename
        } else {
            const Vehicle = await DataFind(`SELECT image FROM tbl_module_setting WHERE id = '2'`);
            imageUrl = Vehicle[0].image
        }

        let estitle = mysql.escape(name)
        let descri = mysql.escape(description)
        
        if (await DataUpdate(`tbl_module_setting`, `image = '${imageUrl}', name = ${estitle}, description = ${descri}`,
            `id = '2'`, req.hostname, req.protocol) == -1) {
                
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Vehicle Setting Updated successfully');
        res.redirect("/rental/setting");
    } catch (error) {
        console.log(error);
        
    }
})




module.exports = router;