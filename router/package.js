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
        cb(null, "./public/uploads/category");
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



router.get("/category", auth, async(req, res)=>{
    try {
        const package_category = await DataFind(`SELECT * FROM tbl_package_category ORDER BY id DESC`);
        
        res.render("package_category", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, package_category
        })
    } catch (error) {
        console.log(error);
    }
})

router.get("/add_category", auth, async(req, res)=>{
    try {
        
        res.render("add_package_category", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        })
    } catch (error) {
        console.log(error);
    }
})

router.post("/add_categorydata", auth, upload.single('image'), async(req, res)=>{
    try {
        const {name, status} = req.body;

        const imageUrl = req.file ? "uploads/category/" + req.file.filename : null;
        const statuss = status == "on" ? 1 : 0;
        let esname = mysql.escape(name)

        if (await DataInsert(`tbl_package_category`, `image, name, status`,
            `'${imageUrl}', ${esname}, ${statuss}`, req.hostname, req.protocol) == -1) {
    
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Category Add successfully');
        res.redirect("/package/category");
    } catch (error) {
        console.log(error);
    }
})

router.get("/edit_category/:id", auth, async(req, res)=>{
    try {
        const package_category = await DataFind(`SELECT * FROM tbl_package_category WHERE id = '${req.params.id}'`);
        
        res.render("edit_package_category", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, category:package_category[0]
        })
    } catch (error) {
        console.log(error);
    }
})

router.post("/edit_categorydata/:id", auth, upload.single('image'), async(req, res)=>{
    try {
        const {name, status} = req.body;

        let imageUrl;
        if (req.file) {
            imageUrl = "uploads/category/" + req.file.filename
        } else {
            const category = await DataFind(`SELECT image FROM tbl_package_category WHERE id = '${req.params.id}'`);
            imageUrl = category[0].image
        }
        let esname = mysql.escape(name)
        const statuss = status == "on" ? 1 : 0;

        if (await DataUpdate(`tbl_package_category`, `image = '${imageUrl}', name = ${esname}, status = ${statuss}`,
            `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
    
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Category Updated successfully');
        res.redirect("/package/category");
    } catch (error) {
        console.log(error);
        
    }
})

router.get("/delete_category/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_package_category`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Category Deleted successfully');
        res.redirect("/package/category");
    } catch (error) {
        console.log(error);
        
    }
})



router.get("/list", auth, async(req, res)=>{
    try {
        const package_list = await DataFind(`SELECT * FROM tbl_package`);
        
        res.render("package_setting", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, package:package_list[0]
        })
    } catch (error) {
        console.log(error);
    }
})



router.post("/edit_package", auth, msetting.single('image'), async(req, res)=>{
    try {
        const {name, description, up_to_km, up_to_fee, addi_km_rate, per_kg_price, num_of_kg, radius_km, comission_rate, comission_type, extra_charge, bidding, whether_charge, status, 
        minimum_fare, maximum_fare} = req.body;

        const oustation_list = await DataFind(`SELECT * FROM tbl_package`);

        let imageUrl;
        if (req.file) {
            imageUrl = "uploads/module_setting/" + req.file.filename
        } else {
            imageUrl = oustation_list[0].image
        }

        let estitle = mysql.escape(name)
        let descri = mysql.escape(description)
        const offer = bidding == "on" ? 1 : 0;
        const minfare = bidding == "on" ? minimum_fare : "";
        const maxifare = bidding == "on" ? maximum_fare : "";
        const crate = comission_type == "on" ? '%' : 'FIX';
        const ctype = whether_charge == "on" ? 1 : 0;
        const statuss = status == "on" ? 1 : 0;

        if (oustation_list == "") {
            if (await DataInsert(`tbl_package`,
                `image, name, description, up_to_km, up_to_fee, addi_km_rate, per_kg_price, num_of_kg, radius_km, comission_rate, comission_type, extra_charge, bidding, 
                minimum_fare, maximum_fare, whether_charge, status`,
                `'${imageUrl}', ${estitle}, ${descri}, '${up_to_km}', '${up_to_fee}', '${addi_km_rate}', '${per_kg_price}', '${num_of_kg}', '${radius_km}', '${comission_rate}', 
                '${crate}', '${extra_charge}', '${offer}', '${minfare}', '${maxifare}', '${ctype}', '${statuss}'`
                , req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
            
        } else {

            if (await DataUpdate(`tbl_package`,
                `image = '${imageUrl}', name = ${estitle}, description = ${descri}, up_to_km = '${up_to_km}', up_to_fee = ${up_to_fee}, addi_km_rate = '${addi_km_rate}', 
                per_kg_price = '${per_kg_price}', num_of_kg = '${num_of_kg}', radius_km = '${radius_km}', comission_rate = '${comission_rate}', comission_type = '${crate}', 
                extra_charge = '${extra_charge}', bidding = '${offer}', minimum_fare = '${minfare}', maximum_fare = '${maxifare}', whether_charge = '${ctype}', status = '${statuss}'`,
                `id = '${oustation_list[0].id}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        }

        req.flash('success', 'Package Updated successfully');
        res.redirect("/package/list");
    } catch (error) {
        console.log(error);
    }
})





module.exports = router;