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
        cb(null, "./public/uploads/vehicle");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const upload = multer({storage : storage});

const storage1 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/module_setting");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const msetting = multer({storage : storage1});



router.get("/add", auth, async(req, res)=>{
    try {

        res.render("add_vehicle", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        })
    } catch (error) {
        console.log(error);
    }
})

router.post("/add_vehicle", auth, upload.fields([{name: 'image', maxCount: 1}, {name: 'map_image', maxCount: 1}]), async(req, res)=>{
    try {
        const {name, description, min_km_distance, min_km_price, after_km_price, comission_rate, comission_type, extra_charge, passenger_capacity, bidding, whether_charge, status, minimum_fare, 
        maximum_fare} = req.body;

        const imageUrl = req.files.image ? "uploads/vehicle/" + req.files.image[0].filename : null;
        const mapimg = req.files.map_image ? "uploads/vehicle/" + req.files.map_image[0].filename : null;

        const offer = bidding == "on" ? 1 : 0;
        const minfare = bidding == "on" ? minimum_fare : "";
        const maxifare = bidding == "on" ? maximum_fare : "";
        const crate = comission_type == "on" ? '%' : 'FIX';
        const ctype = whether_charge == "on" ? 1 : 0;
        const statuss = status == "on" ? 1 : 0;
        let esname = mysql.escape(name);
        let descri = mysql.escape(description);

        if (await DataInsert(`tbl_vehicle`,
            `image, map_img, name, description, min_km_distance, min_km_price, after_km_price, comission_rate, comission_type, extra_charge, passenger_capacity, bidding, 
            whether_charge, status, minimum_fare, maximum_fare`,
            `'${imageUrl}', '${mapimg}', ${esname}, ${descri}, '${min_km_distance}', '${min_km_price}', '${after_km_price}', '${comission_rate}', '${crate}', '${extra_charge}', '${passenger_capacity}', 
            '${offer}', '${ctype}', '${statuss}', '${minfare}', '${maxifare}'`, req.hostname, req.protocol) == -1) {
    
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Vehicle Add successfully');
        res.redirect("/vehicle/list");
    } catch (error) {
        console.log(error);
        
    }
})

router.get("/list", auth, async(req, res)=>{
    try {
        const vehicle_list = await DataFind(`SELECT * FROM tbl_vehicle`);
        
        res.render("vehicle", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, vehicle_list
        })
    } catch (error) {
        console.log(error);
        
    }
})

router.get("/edit/:id", auth, async(req, res)=>{
    try {
        const vehicle_list = await DataFind(`SELECT * FROM tbl_vehicle WHERE id = '${req.params.id}'`);
        
        res.render("edit_vehicle", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, vehicle:vehicle_list[0]
        })
    } catch (error) {
        console.log(error);
        
    }
})

router.post("/edit_vehicle/:id", auth, upload.fields([{name: 'image', maxCount: 1}, {name: 'map_image', maxCount: 1}]), async(req, res)=>{
    try {
        const {name, description, min_km_distance, min_km_price, after_km_price, comission_rate, comission_type, extra_charge, passenger_capacity, bidding, whether_charge, status, minimum_fare, 
        maximum_fare} = req.body;

        const Vehicle = await DataFind(`SELECT image, map_img FROM tbl_vehicle WHERE id = '${req.params.id}'`);
        
        const imageUrl = req.files.image ? "uploads/vehicle/" + req.files.image[0].filename : Vehicle[0].image;
        const mapimg = req.files.map_image ? "uploads/vehicle/" + req.files.map_image[0].filename : Vehicle[0].map_img;        

        const offer = bidding == "on" ? 1 : 0;
        const minfare = bidding == "on" ? minimum_fare : "";
        const maxifare = bidding == "on" ? maximum_fare : "";
        const crate = comission_type == "on" ? '%' : 'FIX';
        const ctype = whether_charge == "on" ? 1 : 0;
        const statuss = status == "on" ? 1 : 0;
        let esname = mysql.escape(name);
        let descri = mysql.escape(description);

        if (await DataUpdate(`tbl_vehicle`,
            `image = '${imageUrl}', map_img = '${mapimg}', name = ${esname}, description = ${descri}, min_km_distance = '${min_km_distance}', min_km_price = '${min_km_price}', after_km_price = '${after_km_price}', comission_rate = '${comission_rate}', 
            comission_type = '${crate}', extra_charge = '${extra_charge}', passenger_capacity = '${passenger_capacity}', bidding = '${offer}', whether_charge = '${ctype}', status = '${statuss}', 
            minimum_fare = '${minfare}', maximum_fare = '${maxifare}'`,
            `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
    
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Vehicle Updated successfully');
        res.redirect("/vehicle/list");
    } catch (error) {
        console.log(error);
        
    }
})

router.get("/delete/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_vehicle`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Vehicle Deleted successfully');
        res.redirect("/vehicle/list");
    } catch (error) {
        console.log(error);
        
    }
})



module.exports = router;