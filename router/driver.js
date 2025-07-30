/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */



const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const multer  = require('multer');
const { MulterError } = require('multer');
const mysql = require("mysql2");
const countryCodes = require('country-codes-list');
const bcrypt = require('bcrypt');
const AllFunction = require("../route_function/function")
const fs = require('fs-extra');
const path = require("path");
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/databse_query");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/driver");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const upload = multer({storage : storage});

const storage1 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/preference");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const preference = multer({storage : storage1});

const storage2 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/driver_document");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
        cb(null, true);
    } else {
        cb(new Error('Only .jpeg and .png files are allowed!'), false);
    }
};

const driver_doc = multer({
    storage: storage2,
    limits: { fileSize: 1 * 1024 * 1024 },
    fileFilter: fileFilter
});





router.get("/setting", auth, async(req, res)=>{
    try {
        const documant_list = await DataFind(`SELECT * FROM tbl_document_setting`);
        
        res.render("driver_setting", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, documant_list
        })
    } catch (error) {
        console.log(error);
    }
})

router.post("/add_document", auth, async(req, res)=>{
    try {
        const {name, documant_side, require, status, req_field_name} = req.body;

        const required = require == "on" ? 1 : 0;
        const req_name = require == "on" ? mysql.escape(req_field_name) : "";
        const statuss = status == "on" ? 1 : 0;
        let esname = mysql.escape(name)

        if (await DataInsert(`tbl_document_setting`, `name, require_image_side, input_require, status, req_field_name`,
            `${esname}, ${documant_side}, ${required}, '${statuss}', '${req_name}'`, req.hostname, req.protocol) == -1) {
    
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        if (await DataUpdate(`tbl_driver`, `approval_status = '0'`, `1 = 1`, req.hostname, req.protocol) == -1) {
    
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Document Type Add successfully');
        res.redirect("/driver/setting");
    } catch (error) {
        console.log(error);
    }
})

router.post("/edit_document/:id", auth, async(req, res)=>{
    try {
        const {name, documant_side, require, status, req_field_name} = req.body;

        const required = require == "on" ? 1 : 0;
        const req_name = require == "on" ? mysql.escape(req_field_name) : "''";
        const statuss = status == "on" ? 1 : 0;
        let esname = mysql.escape(name)

        if (await DataUpdate(`tbl_document_setting`, `name = ${esname}, require_image_side = ${documant_side}, input_require = ${required}, status = '${statuss}', 
            req_field_name = ${req_name}`,
            `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
    
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Document Type Updated successfully');
        res.redirect("/driver/setting");
    } catch (error) {
        console.log(error);
        
    }
})

router.get("/document_delete/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_document_setting`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Document Type Deleted successfully');
        res.redirect("/driver/setting");
    } catch (error) {
        console.log(error);
        
    }
})





router.get("/preference", auth, async(req, res)=>{
    try {
        const preference_list = await DataFind(`SELECT * FROM tbl_vehicle_preference`);
        
        res.render("vehicle_preference", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, preference_list
        })
    } catch (error) {
        console.log(error);
    }
})

router.post("/add_preference", auth, preference.single('image'), async(req, res)=>{
    try {
        const {name, status} = req.body;

        const imageUrl = req.file ? "uploads/preference/" + req.file.filename : null;
        const statuss = status == "on" ? 1 : 0;
        let esname = mysql.escape(name)

        if (await DataInsert(`tbl_vehicle_preference`, `image, name, status`,
            `'${imageUrl}', ${esname}, '${statuss}'`, req.hostname, req.protocol) == -1) {
    
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Vehicle Preference Add successfully');
        res.redirect("/driver/preference");
    } catch (error) {
        console.log(error);
    }
})

router.post("/edit_preference/:id", auth, preference.single('image'), async(req, res)=>{
    try {
        const {name, status} = req.body;

        let imageUrl;
        if (req.file) {
            imageUrl = "uploads/preference/" + req.file.filename
        } else {
            const category = await DataFind(`SELECT image FROM tbl_vehicle_preference WHERE id = '${req.params.id}'`);
            imageUrl = category[0].image
        }

        const statuss = status == "on" ? 1 : 0;
        let esname = mysql.escape(name);

        if (await DataUpdate(`tbl_vehicle_preference`, `image = '${imageUrl}', name = ${esname}, status = '${statuss}'`,
            `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
    
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Vehicle Preference Updated successfully');
        res.redirect("/driver/preference");
    } catch (error) {
        console.log(error);
        
    }
})

router.get("/delete_preference/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_vehicle_preference`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Vehicle Preference Deleted successfully');
        res.redirect("/driver/preference");
    } catch (error) {
        console.log(error);
        
    }
})




router.get("/add", auth, async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);
        const zone_data = await DataFind(`SELECT * FROM tbl_zone WHERE status = "1"`);
        const vehicle_list = await DataFind(`SELECT * FROM tbl_vehicle WHERE status = "1"`);
        const preference_list = await DataFind(`SELECT * FROM tbl_vehicle_preference WHERE status = "1"`);
        
        res.render("add_driver", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, nameCode, CountryCode, zone_data, vehicle_list, preference_list
        })
    } catch (error) {
        console.log(error);
    }
})

router.post("/check_derail", auth, async(req, res)=>{
    try {
        const { primaryc, primaryphone, secoundc, secoundphone } = req.body;

        const driver = await DataFind(`SELECT * FROM tbl_driver WHERE primary_ccode = '${primaryc}' AND primary_phoneNo = '${primaryphone}' OR
                                            secound_ccode = '${secoundc}' AND secound_phoneNo = '${secoundphone}'`);

        const driver2 = await DataFind(`SELECT * FROM tbl_driver WHERE primary_ccode = '${secoundc}' AND primary_phoneNo = '${secoundphone}' OR
                                            secound_ccode = '${primaryc}' AND secound_phoneNo = '${primaryphone}'`);

        if (driver == "" && driver2 == "") return res.send({status:true})
        else return res.send({status:false})
    } catch (error) {
        console.log(error);
    }
})

router.post("/add_driver", auth, upload.fields([{name: 'profile_image', maxCount: 1}, {name: 'vehicle_image', maxCount: 1}]), async(req, res)=>{
    try {
        const {first_name, last_name, email, primary_ccode, primary_phoneNo, secound_ccode, secound_phoneNo, password, nationality, date_of_birth, com_address, zone, language, 
                vehicle, vehicle_number, car_color, passenger_capacity, vehicle_prefrence, iban_number, bank_name, account_hol_name, vat_id, outstation, rental, package, status} = req.body;
        
        const imageUrl1 = req.files ? "uploads/driver/" + req.files.profile_image[0].filename : null;
        const imageUrl2 = req.files ? "uploads/driver/" + req.files.vehicle_image[0].filename : null;
        const statuss = status == "on" ? 1 : 0;
        const hash = await bcrypt.hash(password, 10);

        let azone = []
        if (typeof zone == "string") azone = [zone];
        else azone = [...zone];

        let d = await AllFunction.TodatDate();
        if (await DataInsert(`tbl_driver`,
            `profile_image, first_name, last_name, email, primary_ccode, primary_phoneNo, secound_ccode, secound_phoneNo, password, nationality, date_of_birth, com_address, zone, language, 
            vehicle_image, vehicle, vehicle_number, car_color, passenger_capacity, vehicle_prefrence, iban_number, bank_name, account_hol_name, vat_id, status, approval_status, 
            wallet, payout_wallet, tot_payout, tot_cash, latitude, longitude, fstatus, rid_status, check_status, date`,
            `'${imageUrl1}', '${first_name}', '${last_name}', '${email}', '${primary_ccode}', '${primary_phoneNo}', '${secound_ccode}', '${secound_phoneNo}', '${hash}', '${nationality}', 
            '${date_of_birth}', '${com_address}', '${azone}', '${language}', '${imageUrl2}', '${vehicle}', '${vehicle_number}', '${car_color}', '${passenger_capacity}', 
            '${vehicle_prefrence}', '${iban_number}', '${bank_name}', '${account_hol_name}', '${vat_id}', '${statuss}', '0', '0', '0', '0', '0', '', '', '0', '0', '${d.date}'`, req.hostname, req.protocol) == -1) {
    
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Driver Add successfully');
        res.redirect("/driver/list");
    } catch (error) {
        console.log(error);
    }
});

function convertSeconds(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    return { hours: hours, minutes: minutes, seconds: remainingSeconds };
}

router.get("/list", auth, async(req, res)=>{
    try {
        const driver_list = await DataFind(`SELECT tbl_driver.*, COALESCE(tbl_vehicle.name, "") AS vname
                                            FROM tbl_driver
                                            JOIN tbl_vehicle ON tbl_driver.vehicle = tbl_vehicle.id ORDER BY id DESC`);      

        res.render("driver", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, driver_list
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
        const driver = await DataFind(`SELECT * FROM tbl_driver WHERE id = '${req.params.id}'`);
        const zone_data = await DataFind(`SELECT * FROM tbl_zone WHERE status = "1"`);
        const vehicle_list = await DataFind(`SELECT * FROM tbl_vehicle WHERE status = "1"`);
        const preference_list = await DataFind(`SELECT * FROM tbl_vehicle_preference WHERE status = "1"`);

        let zone = !driver[0].zone || driver[0].zone == "" ? '' : driver[0].zone.split(",")
        let language = !driver[0].language || driver[0].language == "" ? '' : driver[0].language.split(",")
        let vehicle_prefrence = !driver[0].vehicle_prefrence || driver[0].vehicle_prefrence == "" ? '' : driver[0].vehicle_prefrence.split(",")
        
        res.render("edit_driver", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, driver:driver[0], nameCode, CountryCode, zone_data, 
            vehicle_list, preference_list, zone, language, vehicle_prefrence
        })
    } catch (error) {
        console.log(error);
    }
})

async function DeleteImage(imgpath) {
    const folder_path = path.resolve(__dirname, "../public/" + imgpath);
    fs.remove(folder_path, (err) => {
            if (err) {
            console.error('Error deleting file:');
            return;
        }
        console.log('Image deleted successfully.');
    });
    return true
}

router.post("/edit_driver/:id", auth, upload.fields([{name: 'profile_image', maxCount: 1}, {name: 'vehicle_image', maxCount: 1}]), async(req, res)=>{
    try {
        const {first_name, last_name, email, primary_ccode, primary_phoneNo, secound_ccode, secound_phoneNo, password, nationality, date_of_birth, com_address, zone, language, 
            vehicle, vehicle_number, car_color, passenger_capacity, vehicle_prefrence, iban_number, bank_name, account_hol_name, vat_id, outstation, rental, package, status} = req.body;
        
        const category = await DataFind(`SELECT profile_image, vehicle_image FROM tbl_driver WHERE id = '${req.params.id}'`);
        
        let imageUrl1, imageUrl2, hashpass;
        if (!req.files.profile_image || req.files.profile_image == "") {
            imageUrl1 = category[0].profile_image
        } else {
            await DeleteImage(category[0].profile_image)
            imageUrl1 = "uploads/driver/" + req.files.profile_image[0].filename
        }

        if (!req.files.vehicle_image || req.files.vehicle_image == "") {
            imageUrl2 = category[0].vehicle_image
        } else {
            await DeleteImage(category[0].vehicle_image)
            imageUrl2 = "uploads/driver/" + req.files.vehicle_image[0].filename
        }

        if (password) {
            hashpass = await bcrypt.hash(password, 10);
        } else {
            const hpassword = await DataFind(`SELECT password FROM tbl_driver WHERE id = '${req.params.id}'`);
            hashpass = hpassword[0].password
        }

        let azone = []
        if (typeof zone == "string") {
            azone = [zone];
        } else {
            azone = [...zone];
        }

        const statuss = status == "on" ? 1 : 0;

        if (await DataUpdate(`tbl_driver`,
            `profile_image = '${imageUrl1}', first_name = '${first_name}', last_name = '${last_name}', email = '${email}', primary_ccode = '${primary_ccode}', primary_phoneNo = '${primary_phoneNo}', 
            secound_ccode = '${secound_ccode}', secound_phoneNo = '${secound_phoneNo}', password = '${hashpass}', nationality = '${nationality}', date_of_birth = '${date_of_birth}', 
            com_address = '${com_address}', zone = '${azone}', language = '${language}', vehicle_image = '${imageUrl2}', vehicle = '${vehicle}', vehicle_number = '${vehicle_number}', 
            car_color = '${car_color}', passenger_capacity = '${passenger_capacity}', vehicle_prefrence = '${vehicle_prefrence}', iban_number = '${iban_number}', bank_name = '${bank_name}', 
            account_hol_name = '${account_hol_name}', vat_id = '${vat_id}', status = '${statuss}'`,
            `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
    
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Driver Updated successfully');
        res.redirect("/driver/list");
    } catch (error) {
        console.log(error);
    }
});

router.get("/delete/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_driver`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        if (await DataDelete(`tbl_driver_document`, `driver_id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Driver Deleted successfully');
        res.redirect("/driver/list");
    } catch (error) {
        console.log(error);
        
    }
})




router.get("/document/:id", auth, auth, async(req, res)=>{
    try {
        const driver = await DataFind(`SELECT id, first_name, last_name FROM tbl_driver WHERE id = '${req.params.id}'`);
        const documant_list = await DataFind(`SELECT * FROM tbl_document_setting WHERE status = "1"`);
        let driver_doc = await DataFind(`SELECT dd.*, COALESCE(ds.name, '') AS dname, COALESCE(ds.require_image_side, '') AS imgside, COALESCE(ds.input_require, '') AS impreq,
                                        COALESCE(ds.req_field_name, '') AS inpname
                                        FROM tbl_driver_document AS dd
                                        JOIN tbl_document_setting AS ds ON dd.document_id = ds.id
                                        WHERE driver_id = '${req.params.id}'`);

        driver_doc.map(dval => {
            dval.newimage = dval.image.split("&!")
        })

        let notfield = []
        for (let i = 0; i < documant_list.length;) {
            let check = 0
            for (let a = 0; a < driver_doc.length;) {
                if (documant_list[i].id == driver_doc[a].document_id) {
                    check++
                }
                a++
            }
            if (check == 0) {
                notfield.push(documant_list[i].id)
            }
            i++
        }
        
        res.render("driver_document", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, driver, driver_doc, notfield
        })
    } catch (error) {
        console.log(error);
    }
})

router.get("/add_ddocument/:id", auth, auth, async(req, res)=>{
    try {
        let spldata = req.params.id.split("&")
        const vehicle_list = await DataFind(`SELECT * FROM tbl_vehicle`);
        const documant_list = await DataFind(`SELECT * FROM tbl_document_setting WHERE status = "1" AND id IN (${spldata[1]})`);
        const driver = await DataFind(`SELECT id, first_name, last_name FROM tbl_driver WHERE id = '${spldata[0]}'`);
        
        res.render("add_document", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, vehicle_list, driver, documant_list
        })
    } catch (error) {
        console.log(error);
    }
})




router.post("/add_documentdata/:id", auth, async(req, res, next)=>{
        driver_doc.array('docimage')(req, res, function(err) {
            if (err instanceof MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    req.flash('errors', 'File too large. Maximum size is 1MB.');
                    return res.redirect("/driver/document/" + req.params.id);
                }
                req.flash('errors', 'An error occurred during file upload.');
                return res.redirect("/driver/document/" + req.params.id);
            } else if (err) {
                req.flash('errors', 'An unknown error occurred during file upload.');
                return res.redirect("/driver/document/" + req.params.id);
            }
            next();
        });
    }, async(req, res) => {
    try {
        const {docid, fname, status} = req.body;
        
        let namelist = "", docidd = "", docstatus
        if (typeof docid == "string") {
            docidd = [docid];
            docstatus = [status];
        } else {
            docidd = [...docid];
            docstatus = [...status];
        }
        
        if (fname) {
            if (typeof fname == "string") {
                namelist = [fname];
            } else {
                namelist = [...fname];
            }
        }

        let totimg = []
        for (let a = 0; a < req.files.length;) {
            totimg.push("uploads/driver_document/" + req.files[a].filename)
            a++
        }

        const documant_list = await DataFind(`SELECT * FROM tbl_document_setting WHERE status = "1"`);

        let imgcount = 0, incount = 0, totcount = 0;
        for (let c = 0; c < docidd.length;) {

            for (let i = 0; i < documant_list.length;) {

                if (documant_list[i].id == docidd[c]) {
                    
                    let current = 0, input = "", img = ""
                    if (documant_list[i].require_image_side == "3") {
                        imgcount + 2;
                        current = 2;
                    } else {
                        imgcount + 1;
                        current = 1;
                    }
        
                    if (documant_list[i].input_require == "1") {
                        input = namelist.splice(incount, 1);
                        incount++;
                    }
        
                    let lextimg = totimg.splice(imgcount, current);
                    for (let b = 0; b < lextimg.length; ) {
                        img += img == "" ? lextimg[b] : "&!" + lextimg[b];
                        b++;
                    }
        
                    const statuss = docstatus[totcount] == "1" ? 1 : "";

                    if (await DataInsert(`tbl_driver_document`, `driver_id, document_id, image, document_number, status`,
                        `'${req.params.id}', '${documant_list[i].id}', '${img}', '${input}', '${statuss}'`, req.hostname, req.protocol) == -1) {
            
                        req.flash('errors', process.env.dataerror);
                        return res.redirect("/valid_license");
                    }

                    totcount++
                }
                i++;
            }
            c++;
        }

        const driverdata = await DataFind(`SELECT * FROM tbl_driver_document WHERE driver_id = "${req.params.id}"`);

        if (await AllFunction.DriverUpdate(documant_list, driverdata, req.params.id, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Document Add successfully');
        return res.redirect("/driver/document/" + req.params.id);
    } catch (error) {
        console.log(error);
    }
})

router.post("/edit_documentdata/:id", auth, driver_doc.fields([{name: 'frontimage', maxCount: 1}, {name: 'secoundimage', maxCount: 1}]), async(req, res)=>{
    try {
        const {fname, status} = req.body;
        
        let driver_doc = await DataFind(`SELECT dd.*, ds.*
                                        FROM tbl_driver_document AS dd
                                        LEFT JOIN tbl_document_setting AS ds ON dd.document_id = ds.id
                                        WHERE dd.id = '${req.params.id}'`);

        let img = "", img1 = "", img2 = "", inpout = "";

        if (driver_doc[0].require_image_side == "1") {

            if (!req.files.frontimage || req.files.frontimage == "") img1 = driver_doc[0].image
            else img1 = "uploads/driver_document/" + req.files.frontimage[0].filename
            img = img1

        } else if (driver_doc[0].require_image_side == "2") {

            if (!req.files.secoundimage || req.files.secoundimage == "") img2 = driver_doc[0].image
            else img2 = "uploads/driver_document/" + req.files.secoundimage[0].filename
            img = img2

        } else {

            if (!req.files.frontimage || req.files.frontimage == "") img1 = driver_doc[0].image.split("&!")[0]
            else img1 = "uploads/driver_document/" + req.files.frontimage[0].filename

            if (!req.files.secoundimage || req.files.secoundimage == "") img2 = driver_doc[0].image.split("&!")[1]
            else img2 = "uploads/driver_document/" + req.files.secoundimage[0].filename

            img = img1 + "&!" + img2
        }

        if (driver_doc[0].input_require == "1") {
            inpout = fname
        }
        const statuss = status == "on" ? 1 : 0;       

        if (await DataUpdate(`tbl_driver_document`, `image = '${img}', document_number = '${inpout}', status = '${statuss}'`,
            `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
    
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        const documant_list = await DataFind(`SELECT * FROM tbl_document_setting WHERE status = "1"`);
        const driverdata = await DataFind(`SELECT * FROM tbl_driver_document WHERE driver_id = "${driver_doc[0].driver_id}"`);

        if (await AllFunction.DriverUpdate(documant_list, driverdata, driver_doc[0].driver_id, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Document Updated successfully');
        res.redirect("/driver/document/" + driver_doc[0].driver_id);
    } catch (error) {
        console.log(error);
    }
})

router.get("/delete_documentdata/:id", auth, async(req, res)=>{
    try {
        let driver_doc = await DataFind(`SELECT * FROM tbl_driver_document WHERE id = '${req.params.id}'`);

        if (await DataDelete(`tbl_driver_document`, `id = '${driver_doc[0].id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        const documant_list = await DataFind(`SELECT * FROM tbl_document_setting WHERE status = "1"`);
        const driverdata = await DataFind(`SELECT * FROM tbl_driver_document WHERE driver_id = "${driver_doc[0].driver_id}"`);

        if (await AllFunction.DriverUpdate(documant_list, driverdata, driver_doc[0].driver_id, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Document Deleted successfully');
        res.redirect("/driver/document/" + driver_doc[0].driver_id);
    } catch (error) {
        console.log(error);
    }
})





router.get("/profile/:id", auth, async(req, res)=>{
    try {
        let dr = await AllFunction.DriverReview("dri")
        const driver = await DataFind(`SELECT dri.*, COALESCE(GROUP_CONCAT(DISTINCT dz.name SEPARATOR ', '), '') AS zone_name ${dr.tot_review}, COALESCE(ve.name, '') AS vehicle_name,
                                        COALESCE(GROUP_CONCAT(DISTINCT tvp.name SEPARATOR ', '), '') AS veh_pref_name
                                        ${dr.avgstar}
                                        FROM tbl_driver AS dri
                                        LEFT JOIN tbl_zone AS dz ON FIND_IN_SET(dz.id, dri.zone) > 0
                                        LEFT JOIN tbl_vehicle AS ve ON dri.vehicle = ve.id
                                        LEFT JOIN tbl_vehicle_preference AS tvp ON FIND_IN_SET(tvp.id, dri.vehicle_prefrence) > 0
                                        ${dr.outtable}
                                        WHERE dri.id = '${req.params.id}'
                                        GROUP BY dri.id, ve.name, tvp.name`);
        
        driver.map(async(val) =>{
            let ln = val.language != "" ? val.language.split(",") : [], lang = "";
            ln.map(val => lang += lang == "" ? val : ", " + val);
            val.language = lang;
        });

        res.render("driver_profile", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, driver:driver[0]
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/profile_publish_ride", auth, async(req, res)=>{
    try {
        const {status, drid} = req.body;

        let public = [];
        if (status == "0" || status == "1") {
            
            let pubdata = [];
            if (status == "0") {
                let request = await DataFind(`SELECT id, c_id, d_id, status, pic_address, drop_address, start_time FROM tbl_request_vehicle
                    WHERE JSON_CONTAINS(d_id, '${drid}') ORDER BY id DESC`);
                let req_card = await DataFind(`SELECT id, c_id, d_id, status, pic_address, drop_address, start_time FROM tbl_cart_vehicle
                            WHERE d_id = '${drid}' ORDER BY id DESC`);
                pubdata = request.concat(req_card);
            }
            if (status == "1") {
                pubdata = await DataFind(`SELECT id, c_id, d_id, status, pic_address, drop_address, start_time FROM tbl_order_vehicle WHERE d_id = '${drid}' ORDER BY id DESC`);
            }
            
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

        } else if (status == "2") {

            let walletd = await DataFind(`SELECT trnd.id, trnd.payment_id, trnd.amount, trnd.date, trnd.status, trnd.type, 
                                        COALESCE(paym.name, "") AS pay_name, 
                                        CASE 
                                            WHEN wd.p_type = "1" THEN "UPI"
                                            WHEN wd.p_type = "2" THEN "Paypal"
                                            WHEN wd.p_type = "3" THEN "BANK Transfer"
                                            ELSE COALESCE(wd.p_type, "") 
                                        END AS p_type
                                        FROM tbl_transaction_driver AS trnd 
                                        LEFT JOIN tbl_order_vehicle AS ov ON trnd.payment_id = ov.id AND trnd.status = "1"
                                        LEFT JOIN tbl_payment_detail AS paym ON ov.payment_id = paym.id AND trnd.status = "1"
                                        LEFT JOIN tbl_wallet_withdraw AS wd ON trnd.type = wd.id AND trnd.status = "2"
                                        WHERE trnd.d_id = '${drid}' ORDER BY trnd.id DESC`);

            walletd.map(val => {
                const date = new Date(val.date);
                const formattedDate = date.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
                val.date = formattedDate;
            })
            public = walletd;
        }
        
        res.send({requests:public, lan:req.lan.ld})
    } catch (error) {
        console.log(error);
    }
});



router.get("/cash_adjustment/:id", auth, async(req, res)=>{
    try {
        const driver = await DataFind(`SELECT dri.id, dri.tot_cash, COALESCE(SUM(cadj.amount), 0) AS tot_pendinga
                                        FROM tbl_driver AS dri
                                        LEFT JOIN tbl_cash_adjust AS cadj ON cadj.driver_id = dri.id AND cadj.status = '0'
                                        WHERE dri.id = '${req.params.id}' GROUP BY dri.id;`);
        let tot_cash = 0;
        if (driver != "") tot_cash = parseFloat((parseFloat(driver[0].tot_cash) - parseFloat(driver[0].tot_pendinga)).toFixed(2));

        const cash_list = await DataFind(`SELECT wd.*, COALESCE(dri.email, '') AS dri_email
                                        FROM tbl_cash_adjust AS wd
                                        JOIN tbl_driver AS dri ON wd.driver_id = dri.id
                                        WHERE wd.driver_id = '${req.params.id}' ORDER BY wd.id DESC`);

        cash_list.map(val => {
            const date = new Date(val.date);

            const formattedDate = date.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }); 
            val.date = formattedDate;
            return val;
        });
        
        res.render("driver_cash_adjustment", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, cash_list, driver, tot_cash
        })
    } catch (error) {
        console.log(error);
    }
})

router.post("/update_cash_amount/:id", auth, async(req, res)=>{
    try {
        const {cash_amount} = req.body;

        if (parseFloat(cash_amount) > 0) {
            if (await DataUpdate(`tbl_driver`, `tot_cash = '${cash_amount}'`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        }
        
        req.flash('success', 'Cash Amount Update successfully');
        res.redirect("/driver/cash_adjustment/" + req.params.id);
    } catch (error) {
        console.log(error);
    }
});

router.post("/update_cash_status/:id", auth, async(req, res)=>{
    try {
        const {cash_status} = req.body;
        
        const cash_list = await DataFind(`SELECT cadj.*, COALESCE(dri.tot_cash, 0) as tot_cash
                                            FROM tbl_cash_adjust AS cadj
                                            JOIN tbl_driver AS dri ON cadj.driver_id = dri.id
                                            WHERE cadj.id = '${req.params.id}' GROUP BY cadj.id;`);

        if (cash_list != "") {
            const cash = cash_status == "on" ? 1 : 0;

            let tot_cash = 0, status = 0
            if (cash == 1) {
                tot_cash = parseFloat((parseFloat(cash_list[0].tot_cash) - parseFloat(cash_list[0].amount)).toFixed(2));
                status = 1;
            }
            
            if (cash_list[0].status == "1") {
                tot_cash = parseFloat((parseFloat(cash_list[0].tot_cash) + parseFloat(cash_list[0].amount)).toFixed(2));
                status = 1;
            }

            if (status == 1) {
                if (await DataUpdate(`tbl_driver`, `tot_cash = '${tot_cash}'`, `id = '${cash_list[0].driver_id}'`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
                }
            }
    
            if (await DataUpdate(`tbl_cash_adjust`, `status = '${cash}'`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
            
            req.flash('success', 'Cash Status Update successfully');
            res.redirect("/driver/cash_adjustment/" + cash_list[0].driver_id);
        } else {
            req.flash('errors', 'Data Not Found!');
            res.redirect("/driver/list");
        }
    } catch (error) {
        console.log(error);
    }
});





router.get("/default_message", auth, async(req, res)=>{
    try {
        const dem_list = await DataFind(`SELECT * FROM tbl_default_notification`);
        
        res.render("default_notification", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, dem_list
        })
    } catch (error) {
        console.log(error);
    }
});

router.post("/add_def_noti", auth, async(req, res)=>{
    try {
        const {title} = req.body;

        let esname = mysql.escape(title);
        if (await DataInsert(`tbl_default_notification`, `title`, `${esname}`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Default Notification Add successfully');
        res.redirect("/driver/default_message");
    } catch (error) {
        console.log(error);
    }
});

router.post("/edit_def_noti/:id", auth, async(req, res)=>{
    try {
        const {title} = req.body;

        let esname = mysql.escape(title);
        if (await DataUpdate(`tbl_default_notification`, `title = ${esname}`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Default Notification Updated successfully');
        res.redirect("/driver/default_message");
    } catch (error) {
        console.log(error);
        
    }
})

router.get("/delete_def_noti/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_default_notification`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Default Notification Deleted successfully');
        res.redirect("/driver/default_message");
    } catch (error) {
        console.log(error);
        
    }
})



module.exports = router;