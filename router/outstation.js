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
        cb(null, "./public/uploads/outstation_setting");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const upload = multer({storage : storage});

const storage1 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/outstation");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const oustation = multer({storage : storage1});

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
        const outstation_category = await DataFind(`SELECT * FROM tbl_outstation_category ORDER BY id DESC`);
        
        res.render("outstation_category", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, outstation_category
        })
    } catch (error) {
        console.log(error);
    }
})

router.get("/add_category", auth, async(req, res)=>{
    try {
        
        res.render("add_outstation_category", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        })
    } catch (error) {
        console.log(error);
    }
})

router.post("/add_categorydata", auth, upload.single('image'), async(req, res)=>{
    try {
        const {title, description} = req.body;

        const imageUrl = req.file ? "uploads/outstation_setting/" + req.file.filename : null;

        let estitle = mysql.escape(title), esdes = mysql.escape(description)

        if (await DataInsert(`tbl_outstation_category`,
            `image, title, description`,
            `'${imageUrl}', ${estitle}, ${esdes}`, req.hostname, req.protocol) == -1) {
    
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Category Add successfully');
        res.redirect("/outstation/category");
    } catch (error) {
        console.log(error);
    }
})

router.get("/edit_category/:id", auth, async(req, res)=>{
    try {
        const out_category = await DataFind(`SELECT * FROM tbl_outstation_category WHERE id = '${req.params.id}'`);
        
        res.render("edit_outstation_category", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, out_category:out_category[0]
        })
    } catch (error) {
        console.log(error);
    }
})

router.post("/edit_categorydata/:id", auth, upload.single('image'), async(req, res)=>{
    try {
        const {title, description} = req.body;

        let imageUrl;
        if (req.file) {
            imageUrl = "uploads/outstation_setting/" + req.file.filename
        } else {
            const category = await DataFind(`SELECT image FROM tbl_outstation_category WHERE id = '${req.params.id}'`);
            imageUrl = category[0].image
        }

        let estitle = mysql.escape(title), esdes = mysql.escape(description)

        if (await DataUpdate(`tbl_outstation_category`, `image = '${imageUrl}', title = ${estitle}, description = ${esdes}`,
            `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
    
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Category Updated successfully');
        res.redirect("/outstation/category");
    } catch (error) {
        console.log(error);
        
    }
})

router.get("/delete_category/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_outstation_category`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Category Deleted successfully');
        res.redirect("/outstation/category");
    } catch (error) {
        console.log(error);
        
    }
})




router.get("/add", auth, async(req, res)=>{
    try {
        const vehicle_list = await DataFind(`SELECT * FROM tbl_vehicle WHERE status = "1"`);
        const outstation_category = await DataFind(`SELECT * FROM tbl_outstation_category`);

        res.render("add_outstation", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, outstation_category, vehicle_list
        })
    } catch (error) {
        console.log(error);
    }
})

router.post("/add_outstation", auth, oustation.single('image'), async(req, res)=>{
    try {
        const {name, min_km_distance, min_km_price, after_km_price, comission_rate, comission_type, extra_charge, bidding, whether_charge, status, vehicle, passenger_status, 
            tot_passenger, per_person_price, today_price, tomorrow_price, day_after_price, outstation_category, minimum_fare, maximum_fare} = req.body;

        const imageUrl = req.file ? "uploads/outstation/" + req.file.filename : null;
        const offer = bidding == "on" ? 1 : 0;
        const minfare = bidding == "on" ? minimum_fare : "";
        const maxifare = bidding == "on" ? maximum_fare : "";
        const crate = comission_type == "on" ? '%' : 'FIX';
        const ctype = whether_charge == "on" ? 1 : 0;
        const statuss = status == "on" ? 1 : 0;
        const pstatus = passenger_status == "on" ? 1 : 0;
        let esname = mysql.escape(name)

        let tot_passen = passenger_status == "on" ? tot_passenger : 0;
        let tot_person_p = passenger_status == "on" ? per_person_price : 0;

        if (await DataInsert(`tbl_outstation`,
            `image, name, min_km_distance, min_km_price, after_km_price, comission_rate, comission_type, extra_charge, bidding, minimum_fare, maximum_fare, whether_charge, status, vehicle, passenger_status, 
            tot_passenger, per_person_price, today_price, tomorrow_price, day_after_price, outstation_category`,
            `'${imageUrl}', ${esname}, '${min_km_distance}', '${min_km_price}', '${after_km_price}', '${comission_rate}', '${crate}', '${extra_charge}', '${offer}', '${minfare}', 
            '${maxifare}', '${ctype}', '${statuss}', '${vehicle}', '${pstatus}', '${tot_passen}', '${tot_person_p}', '${today_price}', '${tomorrow_price}', '${day_after_price}', 
            '${outstation_category}'`
            , req.hostname, req.protocol) == -1) {
    
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Outstation Add successfully');
        res.redirect("/outstation/list");
    } catch (error) {
        console.log(error);
    }
});

router.get("/list", auth, async(req, res)=>{
    try {
        const oustation_list = await DataFind(`SELECT tbl_outstation.*, COALESCE(tbl_outstation_category.title, '') AS out_category
                                                FROM tbl_outstation
                                                JOIN tbl_outstation_category on tbl_outstation.outstation_category = tbl_outstation_category.id ORDER BY id DESC`);
        
        res.render("outstation", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, oustation_list
        })
    } catch (error) {
        console.log(error);
    }
})

router.get("/edit/:id", auth, async(req, res)=>{
    try {
        const oustation_list = await DataFind(`SELECT * FROM tbl_outstation WHERE id = '${req.params.id}'`);
        const vehicle_list = await DataFind(`SELECT * FROM tbl_vehicle WHERE status = "1"`);
        const outstation_category = await DataFind(`SELECT * FROM tbl_outstation_category`);
        
        let vehicle = !oustation_list[0].vehicle || oustation_list[0].vehicle == "" ? '' : oustation_list[0].vehicle.split(",")
        
        res.render("edit_outstation", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, oustation:oustation_list[0], vehicle_list, outstation_category, 
            vehicle
        })
    } catch (error) {
        console.log(error);
    }
})

router.post("/edit_outstation/:id", auth, oustation.single('image'), async(req, res)=>{
    try {
        const {name, min_km_distance, min_km_price, after_km_price, comission_rate, comission_type, extra_charge, bidding, whether_charge, status, vehicle, passenger_status, 
            tot_passenger, per_person_price, today_price, tomorrow_price, day_after_price, outstation_category, minimum_fare, maximum_fare} = req.body;

        let imageUrl;
        if (req.file) {
            imageUrl = "uploads/outstation/" + req.file.filename
        } else {
            const category = await DataFind(`SELECT image FROM tbl_outstation WHERE id = '${req.params.id}'`);
            imageUrl = category[0].image
        }

        const offer = bidding == "on" ? 1 : 0;
        const minfare = bidding == "on" ? minimum_fare : "";
        const maxifare = bidding == "on" ? maximum_fare : "";
        const crate = comission_type == "on" ? '%' : 'FIX';
        const ctype = whether_charge == "on" ? 1 : 0;
        const statuss = status == "on" ? 1 : 0;
        const pstatus = passenger_status == "on" ? 1 : 0;
        let esname = mysql.escape(name)

        let tot_passen = passenger_status == "on" ? tot_passenger : 0;
        let tot_person_p = passenger_status == "on" ? per_person_price : 0;

        if (await DataUpdate(`tbl_outstation`,
            `image = '${imageUrl}', name = ${esname}, min_km_distance = '${min_km_distance}', min_km_price = '${min_km_price}', after_km_price = '${after_km_price}', comission_rate = '${comission_rate}', 
            comission_type = '${crate}', extra_charge = '${extra_charge}', bidding = '${offer}', minimum_fare = '${minfare}', maximum_fare = '${maxifare}', whether_charge = '${ctype}', status = '${statuss}', vehicle = '${vehicle}',
            passenger_status = '${pstatus}', tot_passenger = '${tot_passen}', per_person_price = '${tot_person_p}', today_price = '${today_price}', tomorrow_price = '${tomorrow_price}', 
            day_after_price = '${day_after_price}', outstation_category = '${outstation_category}'`,
            `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
    
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Outstation Updated successfully');
        res.redirect("/outstation/list");
    } catch (error) {
        console.log(error);
    }
})

router.get("/delete/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_outstation`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Outstation Deleted successfully');
        res.redirect("/outstation/list");
    } catch (error) {
        console.log(error);
        
    }
})



router.get("/setting", auth, async(req, res)=>{
    try {
        const msetting = await DataFind(`SELECT * FROM tbl_module_setting WHERE id = '1'`);
        
        res.render("outstation_setting", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, msetting
        })
    } catch (error) {
        console.log(error);
    }
})

router.post("/edit_outstation_setting", auth, msetting.single('image'), async(req, res)=>{
    try {
        const {name, description} = req.body;

        let imageUrl;
        if (req.file) {
            imageUrl = "uploads/module_setting/" + req.file.filename
        } else {
            const Vehicle = await DataFind(`SELECT image FROM tbl_module_setting WHERE id = '1'`);
            imageUrl = Vehicle[0].image
        }

        let estitle = mysql.escape(name)
        let descri = mysql.escape(description)

        if (await DataUpdate(`tbl_module_setting`, `image = '${imageUrl}', name = ${estitle}, description = ${descri}`,
            `id = '1'`, req.hostname, req.protocol) == -1) {
    
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Vehicle Setting Updated successfully');
        res.redirect("/outstation/setting");
    } catch (error) {
        console.log(error);
        
    }
})




module.exports = router;