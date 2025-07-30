/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */



const express = require("express");
const router = express.Router();
const multer  = require('multer');
const mysql = require("mysql2");
const bcrypt = require('bcrypt');
const axios = require('axios');
const fs = require('fs-extra');
const path = require("path");
const AllFunction = require("../route_function/function");
const AllChat = require("../route_function/chat_function");
const sendOneNotification = require("../middleware/send");
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

const storage2 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/driver_document");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const driver_doc = multer({storage : storage2});

const storage3 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/cash_proof");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const cash_adjustment = multer({storage : storage3});





router.get("/signup_detail", async(req, res)=>{
    try {
        const zone_data = await DataFind(`SELECT id, name, status FROM tbl_zone WHERE status = "1"`);
        const vehicle_list = await DataFind(`SELECT id, image, name, description FROM tbl_vehicle WHERE status = "1"`);
        const preference_list = await DataFind(`SELECT * FROM tbl_vehicle_preference WHERE status = "1"`);
        let documant_list = await DataFind(`SELECT * FROM tbl_document_setting WHERE status = "1"`);
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data Load Successful', zone_data, vehicle_list, preference_list, documant_list});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

router.post("/driver_document", async(req, res)=>{
    try {
        const {uid} = req.body;

        let doc_list = await DataFind(`SELECT * FROM tbl_document_setting WHERE status = "1"`);

        let check = 0, undocument = 0, uncheck = 0, ucheck = 0, upload_check = "0", dstatus = "0", documant_list = []
        if (doc_list != "") {
            
            let driver = await DataFind(`SELECT * FROM tbl_driver WHERE id = "${uid}"`);
            if(driver == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Driver Not Found!' })
    
            let dlist = doc_list.map(async(dval) => {
                const driverdata = await DataFind(`SELECT * FROM tbl_driver_document WHERE driver_id = "${uid}" AND document_id = '${dval.id}'`);
                if (driverdata == "") {
                    dval.status = "0"
                    dval.approve = "0"
                } else {
                    dval.status = "1"
                    ucheck++
                    if (driverdata[0].status == "1") {
                        dval.approve = "1"
                        check++
                    } else if (driverdata[0].status == "0") {
                        dval.approve = "2"
                        undocument++
                    } else {
                        dval.approve = "0"
                        uncheck++
                    }
                }
                return dval
            })
            documant_list = await Promise.all(dlist);
            
            if (driver[0].approval_status == "0") dstatus = "1"
            if (ucheck != "0") dstatus = "2"
            if (driver[0].approval_status == "1") dstatus = "3"

            if (ucheck == documant_list.length) {
                if (undocument == "0") upload_check = "1"
            }
        }
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data Load Successful', upload_check, driver_status:dstatus, documant_list});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

async function detailcheck(primary_ccode, primary_phoneNo, secound_ccode, secound_phoneNo) {
    let driver, driver1
    if (secound_ccode && secound_phoneNo) {
        driver = await DataFind(`SELECT * FROM tbl_driver WHERE (primary_ccode = '${primary_ccode}' AND primary_phoneNo = '${primary_phoneNo}') OR 
                    (secound_ccode = '${secound_ccode}' AND secound_phoneNo = '${secound_phoneNo}') OR (primary_ccode = '${secound_ccode}' AND primary_phoneNo = '${secound_phoneNo}') OR 
                    (secound_ccode = '${primary_ccode}' AND secound_phoneNo = '${primary_phoneNo}')`);
    
        driver1 = await DataFind(`SELECT * FROM tbl_driver_cart WHERE (primary_ccode = '${primary_ccode}' AND primary_phoneNo = '${primary_phoneNo}') OR 
                    (secound_ccode = '${secound_ccode}' AND secound_phoneNo = '${secound_phoneNo}') OR (primary_ccode = '${secound_ccode}' AND primary_phoneNo = '${secound_phoneNo}') OR 
                    (secound_ccode = '${primary_ccode}' AND secound_phoneNo = '${primary_phoneNo}')`);
                    
    } else {
        driver = await DataFind(`SELECT * FROM tbl_driver WHERE (primary_ccode = '${primary_ccode}' AND primary_phoneNo = '${primary_phoneNo}') OR
                                                                (secound_ccode = '${primary_ccode}' AND secound_phoneNo = '${primary_phoneNo}')`);
    
        driver1 = await DataFind(`SELECT * FROM tbl_driver_cart WHERE (primary_ccode = '${primary_ccode}' AND primary_phoneNo = '${primary_phoneNo}') OR 
                                                                        (secound_ccode = '${primary_ccode}' AND secound_phoneNo = '${primary_phoneNo}')`);
    }
    
    if (driver != "" || driver1 != "") return 1
    else return 0
}

router.post("/signup", upload.single('profile_image'), async(req, res)=>{
    try {
        const {first_name, last_name, email, primary_ccode, primary_phoneNo, secound_ccode, secound_phoneNo, password, nationality, date_of_birth, complete_address, zone, language} = req.body;

        const missingField = ["first_name", "last_name", "email", "primary_ccode", "primary_phoneNo", "password", "nationality", "date_of_birth", 
                                "complete_address", "zone", "language"].find(field => !req.body[field]);

        if(missingField) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' })

        if (primary_phoneNo == secound_phoneNo) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Please Enter different mobile number!', driver_data: [] })

        const general = await DataFind(`SELECT site_currency FROM tbl_general_settings`);
        if(general == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong'});

        let dcheck = await detailcheck(primary_ccode, primary_phoneNo, secound_ccode, secound_phoneNo)
        if (dcheck == "1") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'PhoneNo Already Exists!', general:{site_currency:general[0].site_currency}, driver_data: [] })
        
        const email_ccart = await DataFind(`SELECT * FROM tbl_driver_cart WHERE email = '${email}'`);
        const email_cdriver = await DataFind(`SELECT * FROM tbl_driver WHERE email = '${email}'`);
        if (email_ccart != '' || email_cdriver != '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Email Already Exists!', general:{site_currency:general[0].site_currency}, driver_data: [] });

        let imageUrl = null
        if (req.file) imageUrl = "uploads/driver/" + req.file.filename
        else return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Please Select Profile Image!', driver_data: [] })

        let parts = date_of_birth.split("-");
        let day = parseInt(parts[0], 10), month = parseInt(parts[1], 10) - 1, year = parseInt(parts[2], 10);
        let date = new Date(year, month, day).toISOString().split("T")[0]

        const hash = await bcrypt.hash(password, 10);

        const cartdriver = await DataInsert(`tbl_driver_cart`, `profile_image, first_name, last_name, email, primary_ccode, primary_phoneNo, secound_ccode, secound_phoneNo, 
        password, nationality, date_of_birth, com_address, zone, language, vehicle_image, vehicle, vehicle_number, car_color, passenger_capacity, vehicle_prefrence, iban_number, 
        bank_name, account_hol_name, vat_id, status, approval_status`,
        `'${imageUrl}', '${first_name}', '${last_name}', '${email}', '${primary_ccode}', '${primary_phoneNo}', '${secound_ccode}', '${secound_phoneNo}', '${hash}', '${nationality}', 
        '${date}', '${complete_address}', '${zone}', '${language}', '', '', '', '', '', '', '', '', '', '', '0', '0'`, req.hostname, req.protocol)

        if (cartdriver == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        const new_dri_data = await DataFind(`SELECT * FROM tbl_driver_cart WHERE id = '${cartdriver.insertId}'`);
        
        if (!new_dri_data) return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data Add successful', general:{site_currency:general[0].site_currency}, driver_data: []});
        else return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data Add successful', general:{site_currency:general[0].site_currency}, driver_data: new_dri_data[0]});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

router.post("/add_driver_vehicle", upload.single('vehicle_image'), async(req, res)=>{
    try {
        const {id, vehicle, vehicle_number, car_color, passenger_capacity, vehicle_prefrence} = req.body;

        const missingField = ["id", "vehicle", "vehicle_number", "car_color", "passenger_capacity", "vehicle_prefrence"].find(field => !req.body[field]);
        if(missingField) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' })

        const cart_dri_data = await DataFind(`SELECT * FROM tbl_driver_cart WHERE id = '${id}'`);
        if(cart_dri_data == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data Not Found!' })

        let imageUrl = null
        if (req.file) imageUrl = "uploads/driver/" + req.file.filename
        else return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Please Select Profile Image!', driver_data: [] })

        if (await DataUpdate(`tbl_driver_cart`,
            `vehicle_image = '${imageUrl}', vehicle = '${vehicle}', vehicle_number = '${vehicle_number}', car_color = '${car_color}', passenger_capacity = '${passenger_capacity}', 
            vehicle_prefrence = '${vehicle_prefrence}'`, `id = '${id}'`, req.hostname, req.protocol) == -1) {
    
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        const new_dri_data = await DataFind(`SELECT * FROM tbl_driver_cart WHERE id = '${id}'`);

        if (!new_dri_data) return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data Add successful', driver_data: []});
        else return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data Add successful', driver_data: new_dri_data[0]});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

router.post("/add_driver_bankaccount", async(req, res)=>{
    try {
        const {id, iban_number, bank_name, account_hol_name, vat_id} = req.body;

        const missingField = ["id", "iban_number", "bank_name", "account_hol_name", "vat_id"].find(field => !req.body[field]);
        if(missingField) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' })

        const cart_dri_data = await DataFind(`SELECT * FROM tbl_driver_cart WHERE id = '${id}'`);
        if(cart_dri_data == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data Not Found!' })
        const cd = cart_dri_data[0]

        const valcheck = ["profile_image", "first_name", "last_name", "email", "primary_ccode", "primary_phoneNo", "secound_ccode", "secound_phoneNo", "password", "nationality", 
        "date_of_birth", "com_address", "zone", "language", "vehicle_image", "vehicle", 'vehicle_number', "car_color", "passenger_capacity", "vehicle_prefrence"]
        let check = valcheck.some(item => 
            Object.values(item).some(field => field == "")
        );
        if(check) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });

        let general = await DataFind(`SELECT def_driver FROM tbl_general_settings`), status = "0"
        if (general[0].def_driver == "1") status = "1"
        
        let d = await AllFunction.TodatDate();

        const cartdriver = await DataInsert(`tbl_driver`,
        `profile_image, first_name, last_name, email, primary_ccode, primary_phoneNo, secound_ccode, secound_phoneNo, password, nationality, date_of_birth, com_address, zone, 
        language, vehicle_image, vehicle, vehicle_number, car_color, passenger_capacity, vehicle_prefrence, iban_number, bank_name, account_hol_name, vat_id, status, 
        approval_status, wallet, payout_wallet, tot_payout, tot_cash, latitude, longitude, fstatus, rid_status, check_status, date`,
        `'${cd.profile_image}', '${cd.first_name}', '${cd.last_name}', '${cd.email}', '${cd.primary_ccode}', '${cd.primary_phoneNo}', '${cd.secound_ccode}', '${cd.secound_phoneNo}', 
        '${cd.password}', '${cd.nationality}', '${cd.date_of_birth}', '${cd.com_address}', '${cd.zone}', '${cd.language}', '${cd.vehicle_image}', '${cd.vehicle}', 
        '${cd.vehicle_number}', '${cd.car_color}', '${cd.passenger_capacity}', '${cd.vehicle_prefrence}',
        '${iban_number}', '${bank_name}', '${account_hol_name}', '${vat_id}', '${status}', '0', '0', '0', '0', '0', '', '', '0', '0', '0', '${d.date}'`, req.hostname, req.protocol)

        if (cartdriver == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        if (await DataDelete(`tbl_driver_cart`, `id = '${cd.id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        const new_dri_data = await DataFind(`SELECT * FROM tbl_driver WHERE id = '${cartdriver.insertId}'`);

        if (!new_dri_data) {
            console.log(111);
            return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data Add successful', driver_data: []});
        } else { 
            console.log(222);
            delete new_dri_data[0].wallet; delete new_dri_data[0].latitude; delete new_dri_data[0].longitude; delete new_dri_data[0].fstatus
            return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data Add successful', driver_data: new_dri_data[0]})
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.post("/add_documentdata", driver_doc.fields([{name: 'frontimg', maxCount: 1}, {name: 'backimg', maxCount: 1}]), async(req, res)=>{
    try {
        const {id, doc_id, fname} = req.body;

        const missingField = ["id", "doc_id"].find(field => !req.body[field]);
        if(missingField) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });
        
        const ddcheck = await DataFind(`SELECT * FROM tbl_driver_document WHERE driver_id = '${id}' AND document_id = '${doc_id}'`);
        if(ddcheck != "") {
            if (ddcheck[0].status == "" || ddcheck[0].status == "1") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Document Already Uploaded!' });
        }

        const driverdoc = await DataFind(`SELECT * FROM tbl_document_setting WHERE id = '${doc_id}'`);
        if(driverdoc == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Document not found!' });

        let docimg = "", name = ""
        if (driverdoc[0].require_image_side == "1") {

            if (req.files &&req.files.frontimg) docimg = "uploads/driver_document/" + req.files.frontimg[0].filename
            else return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Please select Image' })

        } else if (driverdoc[0].require_image_side == "2") {

            if (req.files && req.files.backimg) docimg = "uploads/driver_document/" + req.files.backimg[0].filename
            else return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Please select Image' })

        } else if (driverdoc[0].require_image_side == "3") {

            if (req.files && req.files.frontimg && req.files.backimg) docimg = "uploads/driver_document/" + req.files.frontimg[0].filename + "&!" + "uploads/driver_document/" + req.files.backimg[0].filename
            else return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Please select Image' })
        }

        if (driverdoc[0].input_require == "1") {
            if (fname) name = fname
            else return res.status(200).json({ ResponseCode: 401, Result:false, message: `Please Enter ${driverdoc[0].req_field_name}` })
        }

        if (ddcheck == "") {
            
            if (await DataInsert(`tbl_driver_document`, `driver_id, document_id, image, document_number, status`,
                `'${id}', '${driverdoc[0].id}', '${docimg}', '${name}', ''`, req.hostname, req.protocol) == -1) {
            
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }

        } else if (ddcheck != "" && ddcheck[0].status == "0") {

            if (await DataUpdate(`tbl_driver_document`,
                `driver_id = '${id}', document_id = ${driverdoc[0].id}, image = '${docimg}', document_number = '${name}', status = ''`,
                `id = '${ddcheck[0].id}'`, req.hostname, req.protocol) == -1) {
        

                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
        }

        const driverdata = await DataFind(`SELECT * FROM tbl_driver_document WHERE driver_id = "${id}"`);

        if (await AllFunction.DriverUpdate(driverdoc, driverdata, id, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Document Upload Successful" });
    } catch (error) {
        console.log(error);
        
    }
})





async function LoginDetailCheck(ccode, phone) {
    let driver1 = await DataFind(`SELECT * FROM tbl_driver_cart WHERE primary_ccode = '${ccode}' AND primary_phoneNo = '${phone}' OR 
                                                                    secound_ccode = '${ccode}' AND secound_phoneNo = '${phone}'`);
    
    if (driver1 == "") return { status: "1", data: [] }
    else {
        if (driver1[0].iban_number) {
            return { status: "4", data: driver1[0] }
            
        } else if (driver1[0].vehicle_image) {
            return { status: "3", data: driver1[0] }
            
        } else if (driver1[0].profile_image) {
            return { status: "2", data: driver1[0] }
        }
    }
}

async function LoginDriverDocCheck(dri_data) {
    let doc_list = await DataFind(`SELECT * FROM tbl_document_setting WHERE status = "1"`);

    let ucheck = 0, approve = 0, unapprove = 0, pending = 0
    let dlist = doc_list.map(async(dval) => {
        const driverdata = await DataFind(`SELECT * FROM tbl_driver_document WHERE driver_id = "${dri_data[0].id}" AND document_id = '${dval.id}'`);
        if (driverdata != "") {
            if (driverdata[0].status == "") pending++
            if (driverdata[0].status == "1") approve++
            if (driverdata[0].status == "0")  unapprove++
            ucheck++
        }
        return driverdata[0]
    })
    let documant_list = await Promise.all(dlist);

    return {documant_list, ucheck, approve, unapprove, pending}
}

async function CusCheck(dri_data) {
    let data = await LoginDriverDocCheck(dri_data);
    
    if (data.ucheck == data.documant_list.length) {
        if (data.ucheck == data.pending) return "5";
        else if (data.ucheck == data.approve) return "1";
        return "4"
    }
    if (data.ucheck != data.documant_list.length) return "4";
}

router.post("/customer_check", async(req, res)=>{
    try {
        const {id} = req.body;

        if (id == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong!'});

        let dri_data = await DataFind(`SELECT * FROM tbl_driver WHERE id = '${id}'`);
        if (dri_data == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Driver Not Found!'});

        let document_status = "0", account_status = "0";

        if (dri_data[0].status == "1") account_status = "1"
        document_status = await CusCheck(dri_data)
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Data Load Successful", account_status, document_status });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

async function CusLoginCheck(dri_data) {
    let data = await LoginDriverDocCheck(dri_data)

    if (data.ucheck == data.documant_list.length) {
        if (data.ucheck == data.pending) return "5" 
        else if (data.ucheck == data.unapprove) return "4"
        else if (data.ucheck == data.approve) return "0"
    }
    if (data.ucheck != data.documant_list.length) return "4"
    if (dri_data[0].approval_status == "0") return "4"
}

router.post("/login", async(req, res)=>{
    try {
        const {ccode, phone, password} = req.body;

        const missingField = ["ccode", "phone"].find(field => !req.body[field]);
        if(missingField) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' })

        const general = await DataFind(`SELECT site_currency, one_app_id, one_api_key FROM tbl_general_settings`);
        if(general == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong'});

        let dri_data = await DataFind(`SELECT * FROM tbl_driver
                                        WHERE primary_ccode = '${ccode}' AND primary_phoneNo = '${phone}' OR secound_ccode = '${ccode}' AND secound_phoneNo = '${phone}'`);
        
        if (dri_data == "") {
            let check = await LoginDetailCheck(ccode, phone)
            
            if (check.status != "1") {
                if (password == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Password Not Found!' })
                const hash_pass = await bcrypt.compare(password, check.data.password);
                if (!hash_pass) return res.status(200).json({ ResponseCode: 401, Result:false, message: "Password Not match", general:general[0], status: "6", driver_data: [] });
                return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Please Signup!', general:general[0], status: check.status, driver_data: check.data })
            } else {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Please Signup!', general:general[0], status: check.status, driver_data: check.data })
            }

        } else {

            if (password == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Password Not Found!' })

            const hash_pass = await bcrypt.compare(password, dri_data[0].password);
            if (!hash_pass) return res.status(200).json({ ResponseCode: 401, Result:false, message: "Password Not match", general:general[0], status: "6", driver_data: [] });

            if (dri_data[0].approval_status != "1") {

                let drivercheck = await CusLoginCheck(dri_data)
                
                delete dri_data[0].wallet;
                delete dri_data[0].latitude;
                delete dri_data[0].longitude;
                delete dri_data[0].fstatus;
                return res.status(200).json({ ResponseCode: 401, Result:false, message: "Account Unapproved", general:general[0], status: drivercheck, driver_data: dri_data[0] });
            }
            if (dri_data[0].status != "1") return res.status(200).json({ ResponseCode: 401, Result:false, message: "Account Deactivated", general:general[0], status: "0", driver_data: [] });
    
            if (!hash_pass) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: "Password Not match", general:general[0], status: "6", driver_data: [] });
            } else {
                return res.status(200).json({ ResponseCode: 200, Result:true, message: "Login Sccessful", general:general[0], status: "0", driver_data:dri_data[0] });
            }
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.post("/mobile_check", async(req, res)=>{
    try {
        const {primary_ccode, primary_phoneNo, secound_ccode, secound_phoneNo, password} = req.body;
        
        if(primary_ccode == "" || primary_phoneNo == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' })

        if (primary_phoneNo == secound_phoneNo) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Please Enter different mobile number!' })

        let dri_data
        if (secound_ccode && secound_phoneNo) {
            
            dri_data = await DataFind(`SELECT * FROM tbl_driver
            WHERE (primary_ccode = '${primary_ccode}' AND primary_phoneNo = '${primary_phoneNo}') OR (secound_ccode = '${secound_ccode}' AND secound_phoneNo = '${secound_phoneNo}') 
            OR (primary_ccode = '${secound_ccode}' AND primary_phoneNo = '${secound_phoneNo}') OR (secound_ccode = '${primary_ccode}' AND secound_phoneNo = '${primary_phoneNo}')`);
        } else {
            dri_data = await DataFind(`SELECT * FROM tbl_driver
            WHERE (primary_ccode = '${primary_ccode}' AND primary_phoneNo = '${primary_phoneNo}') OR (secound_ccode = '${primary_ccode}' AND secound_phoneNo = '${primary_phoneNo}')`);
        }

        if (dri_data == "") {
            
            let check = await LoginDetailCheck(primary_ccode, primary_phoneNo)

            if (check.status != "1") {
                if (password == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Password Not Found!' })
                const hash_pass = await bcrypt.compare(password, check.data.password);
                if (!hash_pass) return res.status(200).json({ ResponseCode: 401, Result:false, message: "Password Not match", status: "6", driver_data: [] });
                return res.status(200).json({ ResponseCode: 401, Result:false, message: 'New Number', status: check.status, driver_data: check.data })
            } else {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: 'New Number', status: check.status, driver_data: check.data })
            }
        } else {

            if (password == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Password Not Found!' })

            const hash_pass = await bcrypt.compare(password, dri_data[0].password);
            if (!hash_pass) return res.status(200).json({ ResponseCode: 401, Result:false, message: "Password Not match", status: "6", driver_data: [] });

            if (dri_data[0].approval_status != "1") {

                let drivercheck = await CusLoginCheck(dri_data)

                delete dri_data[0].wallet
                delete dri_data[0].latitude 
                delete dri_data[0].longitude
                delete dri_data[0].fstatus
                return res.status(200).json({ ResponseCode: 401, Result:false, message: "PhoneNo Already Exists!", status: drivercheck, driver_data: dri_data[0] });
            } 

            return res.status(200).json({ ResponseCode: 401, Result:false, message: 'PhoneNo Already Exists!', status: "0", driver_data: []  })
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.post("/forgot_password", async(req, res)=>{
    try {
        const {ccode, phone, password} = req.body;

        if (ccode == "" || phone == "" || password == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong!'});

        const dri_data = await DataFind(`SELECT * FROM tbl_driver  WHERE (primary_ccode = '${ccode}' AND primary_phoneNo = '${phone}') OR 
                                                                            (secound_ccode = '${ccode}' AND secound_phoneNo = '${phone}')`);

        if (dri_data == "") {
            res.status(200).json({ ResponseCode: 401, Result:false, message: "PhoneNo Not Exist" });
        } else {
            const hash = await bcrypt.hash(password, 10);

            if (await DataUpdate(`tbl_driver`, `password = '${hash}'`, `id = '${dri_data[0].id}'`, req.hostname, req.protocol) == -1) {
        
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
            res.status(200).json({ ResponseCode: 200, Result:true, message: 'Password Change successful' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.get("/otp_detail", async(req, res)=>{
    try {
        const general_setting = await DataFind(`SELECT * FROM tbl_general_settings`);

        let sms_type = ""
        if (general_setting[0].sms_type == "1") {
            sms_type = "MSG91"
        } else if (general_setting[0].sms_type == "2") {
            sms_type = "Twilio"
        } else {
            sms_type = "No Auth"
        }

        if (sms_type != "") res.status(200).json({ ResponseCode: 200, Result:true, message: sms_type });
        else res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data Not Found' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.post("/msg91", async(req, res)=>{
    try {
        const {phoneno} = req.body;

        if (phoneno == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong!'});

        const general_setting = await DataFind(`SELECT * FROM tbl_general_settings`);

        let otp_result = await AllFunction.otpGenerate(6)

        let auth_key = general_setting[0].msg_key;
        let template_id = general_setting[0].msg_token;
        
        let pho_no = phoneno;
        const options = {
            method: 'POST',
            url: 'https://control.msg91.com/api/v5/otp?template_id='+ template_id +'&mobile='+ pho_no +'&otp=' + otp_result,
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                authkey: auth_key
            },
            data: {Param1: 'value1'}
        };
    
        axios.request(options)
        .then(function (response) {
            console.log(response.data);
            res.status(200).json({ ResponseCode: 200, Result:true, message: "Otp Send successful", otp: otp_result });
        })
        .catch(function (error) {
            console.error(error);
            res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.post("/twilio", async(req, res)=>{
    try {
        const {phoneno} = req.body;

        if (phoneno == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong!'});

        const general_setting = await DataFind(`SELECT * FROM tbl_general_settings`);

        let otp_result = await AllFunction.otpGenerate(6)

        let accountSid = general_setting[0].twilio_sid;
        let authToken = general_setting[0].twilio_token;
    
        const client = require('twilio')(accountSid, authToken);
    
        client.messages.create({
            body: 'Your '+ general_setting[0].title +' otp is '+ otp_result +'',
            from: general_setting[0].twilio_phoneno,
            to: phoneno
        })
        .then(message => {
            console.log(message.sid);
            res.status(200).json({ ResponseCode: 200, Result:true, message: "Otp Send successful", otp: otp_result });
        })
        .catch((error) => {
            console.log(error);
            res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})






router.post("/update_latlon", async(req, res)=>{
    try {
        const {id, lat, lon, live_status} = req.body;
        if (id == "" || lat == "" || lon == "" || live_status == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong!'});
        
        const fstatus = live_status == "on" ? 1 : 0;

        if (await DataUpdate(`tbl_driver`, `latitude = '${lat}', longitude = '${lon}', fstatus = '${fstatus}'`, `id = '${id}'`, req.hostname, req.protocol) == -1) {
    
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Update Successful" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

router.post("/background_update", async(req, res)=>{
    try {
        const {id} = req.body;
        if ( !id) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong!'});
        
        const driver = await DataFind(`SELECT * FROM tbl_driver WHERE id = '${id}'`);
        if (driver == "") return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Driver Not Found!' });

        return res.status(200).json({ ResponseCode: 401, Result:false, message: "Update Successful" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})







router.post("/check_vehicle_request", async(req, res)=>{
    try {
        const {uid} = req.body;

        const general = await DataFind(`SELECT alert_tone FROM tbl_general_settings`);
        if(!general) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong'});
        
        if(!uid) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });

        let dr = await AllFunction.CustomerReview("rvd");
        let rdata = await DataFind(`SELECT rvd.*, COALESCE(cus.id, "") AS cus_id, COALESCE(cus.name, "") AS name
                                    ${dr.tot_review} ${dr.avgstar}
                                    FROM tbl_request_vehicle AS rvd
                                    JOIN tbl_customer AS cus ON rvd.c_id = cus.id
                                    ${dr.table}
                                    WHERE JSON_CONTAINS(rvd.d_id, '${uid}') AND rvd.status = '0' GROUP BY rvd.id ORDER BY id DESC`);
        
        const v_cart_data = await DataFind(`SELECT rvd.id, rvd.c_id, rvd.d_id, rvd.current_run_time, rvd.pic_lat_long, rvd.drop_lat_long, rvd.pic_address, rvd.drop_address, rvd.price, rvd.tot_km, 
                                            rvd.tot_hour, rvd.tot_minute, rvd.status, rvd.bidding_status, rvd.bidd_auto_status, COALESCE(cus.id, "") AS cus_id, COALESCE(cus.name, "") AS name
                                            ${dr.tot_review} ${dr.avgstar}
                                            FROM tbl_cart_vehicle AS rvd
                                            JOIN tbl_customer AS cus ON rvd.c_id = cus.id
                                            ${dr.table}
                                            WHERE rvd.d_id = '${uid}'
                                            GROUP BY rvd.id, rvd.c_id, rvd.d_id, rvd.current_run_time, rvd.pic_lat_long, rvd.drop_lat_long, rvd.pic_address, rvd.drop_address, rvd.price, rvd.tot_km, 
                                            rvd.tot_hour, rvd.tot_minute, rvd.status, cus.id, cus.name ORDER BY id DESC;`);

        let allrequest = rdata.concat(v_cart_data);
        
        if (allrequest == "" || !allrequest) return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Request Not Found!', general:general[0], request_data:[]});
        let request_data = await AllFunction.DriverRequestData(allrequest);
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Data Load Successful", general:general[0], request_data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})




router.post("/cus_ride_detail", async(req, res)=>{
    try {
        const {uid, request_id} = req.body;

        if(!uid || !request_id) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });

        const data = await AllFunction.DriverNewRequestData(uid, request_id, 0)
        if (data == 1) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });
        if (data == 2) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Request Not Found!' });
        
        const dem_list = await DataFind(`SELECT * FROM tbl_default_notification ORDER BY id DESC`);
        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Data Load Successful", dem_list:dem_list, request_data:data.request_data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.post("/vehicle_bidding", async(req, res)=>{
    try {
        const {uid, c_id, request_id, time} = req.body;

        if(!uid || !c_id || !request_id || !time) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });

        const check = await DataFind(`SELECT * FROM tbl_cart_vehicle WHERE id = '${request_id}' AND c_id = '${c_id}' AND d_id = '${uid}'`);
        if (check == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Request Not Found!' });

        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Time Updated Successful" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.post("/accept_vehicle_ride", async(req, res)=>{
    try {
        const { uid, request_id, lat, lon } = req.body;
        let request = await AllFunction.AcceptVehicleRide(uid, request_id, lat, lon, req.hostname, req.protocol, "0", "", "0");

        if(request == "1") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });
        if(request == "2") return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Request Not Found!' });
        if(request == "3") return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Driver Not Found!' });
        if(request == "databaseerror") return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        if(request != "1" && request != "2" && request != "3" && request != "databaseerror") {
            return res.status(200).json({ ResponseCode: 200, Result:true, message: "Request Accept Successful", requestid:request.requestid });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.get("/vehicle_cancel_reason", async(req, res)=>{
    try {
        const ride_cancel_list = await DataFind(`SELECT id, title FROM tbl_ride_cancel_reason WHERE status = '1'`);
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data Load Successful', ride_cancel_list});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.post("/veh_req_time_set", async(req, res)=>{
    try {
        const {uid, c_id, request_id, time} = req.body;
        
        if(!uid || !c_id || !request_id || !time) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });

        const check = await DataFind(`SELECT * FROM tbl_cart_vehicle WHERE id = '${request_id}' AND c_id = '${c_id}' AND d_id = '${uid}'`);
        if (check == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Request Not Found!' });

        let fulldate = await AllFunction.TodatDate();

        let ntime = check[0].status_time != "" ? `${check[0].status_time}&!!${check[0].status}&0&${time}` : `${check[0].status}&0&${time}`; // status_time
        let current_time = `${fulldate.date}T${fulldate.time}&0&${time}`; // current_run_time

        if (await DataUpdate(`tbl_cart_vehicle`, `tot_hour = '0', tot_minute = '${time}', status_time = '${ntime}', current_run_time = '${current_time}'`, 
            `id = '${check[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Time Updated Successful" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.post("/veh_req_cancel", async(req, res)=>{
    try {
        const {uid, c_id, request_id, cancel_id, lat, lon} = req.body;
        if(!uid || !c_id || !request_id) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });

        let rd = await DataFind(`SELECT * FROM tbl_request_vehicle WHERE id = '${request_id}' AND c_id = '${c_id}' AND JSON_CONTAINS(d_id, '${uid}')`), checkid = 0;
        
        if (rd == "") {
            rd = await DataFind(`SELECT * FROM tbl_cart_vehicle WHERE id = '${request_id}' AND c_id = '${c_id}' AND d_id = '${uid}'`);
            if (rd == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Request Not Found!' });
            checkid = 1;
        }

        if (checkid == "0") {
            let d_id = rd[0].d_id, eidlist, reqmoveid, bprice = rd[0].bidding_d_price, old = ""

            if (typeof d_id == "string") {
                d_id = JSON.parse(d_id);
                eidlist = d_id.filter(item => item != uid);
                reqmoveid = JSON.stringify(eidlist);
            } else {
                eidlist = d_id.filter(item => item != uid);
                reqmoveid = JSON.stringify(eidlist);
            }

            if (rd[0].bidding_status == "1") {
                if (bprice != "") {
                    let pspl = bprice.split("&!!");
                    for (let a = 0; a < pspl.length;) {
                        let sd = pspl[a].split("&");
                        if (parseFloat(sd[1]) != parseFloat(uid)) {
                            old += old == "" ? `${sd[0]}&${sd[1]}&${sd[2]}` : `&&!${sd[0]}&${sd[1]}&${sd[2]}`;
                        }
                        a++;
                    }
                }
                if (await DataUpdate(`tbl_request_vehicle`, `d_id = '${reqmoveid}', bidding_d_price = '${old}'`, `id = '${rd[0].id}'`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
                }
            } else {
                
                if (await DataUpdate(`tbl_request_vehicle`, `d_id = '${reqmoveid}'`, `id = '${rd[0].id}'`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
                }
            }
        }

        if (checkid == "1") {

            if(!cancel_id || !lat || !lon) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });

            let status = "4", fulldate = await AllFunction.TodatDate();
            let updatet = rd[0].status_time_location != "" ? `${rd[0].status_time_location}&!!${status}&${fulldate.date}T${fulldate.time}&${lat}&${lon}` : 
            `${status}&${fulldate.date}T${fulldate.time}&${lat}&${lon}`;

            let espiadd = mysql.escape(rd[0].pic_address), esdroadd = mysql.escape(rd[0].drop_address);
            let setime = rd[0].status_time_location.split("&!!"), starttime = "";

            let stime = setime[0].split("&"), etime = new Date().toISOString();
            if (stime[0] == "1") starttime = await AllFunction.TodatDate(stime[1]);

            if (await DataInsert(`tbl_order_vehicle`, `c_id, d_id, vehicleid, bidding_status, bidd_auto_status, paid_status, price, final_price, paid_amount, coupon_amount, addi_time_price, platform_fee, weather_price, 
                wallet_price, tot_km, tot_hour, tot_minute, status, payment_id, m_role, coupon_id, additional_time, ride_status, start_time, end_time, drop_tot, drop_complete, current_run_time, status_time, 
                status_time_location, status_calculation, pic_lat_long, drop_lat_long, pic_address, drop_address, payment_img, cancel_reason, req_id`,
                `'${rd[0].c_id}', '${rd[0].d_id}', '${rd[0].vehicleid}', '${rd[0].bidding_status}', '${rd[0].bidd_auto_status}', '0', '${rd[0].price}', '${rd[0].final_price}', '0', '${rd[0].coupon_amount}', '${rd[0].addi_time_price}', 
                '${rd[0].platform_fee}', '${rd[0].weather_price}', '0', '${rd[0].tot_km}', '${rd[0].tot_hour}', '${rd[0].tot_minute}', '4', '', '${rd[0].m_role}', '${rd[0].coupon_id}', 
                '${rd[0].additional_time}', '${rd[0].ride_status}', '${stime[1]}', '${etime}', '${rd[0].drop_tot}', '${rd[0].drop_complete}', '${rd[0].current_run_time}', 
                '${rd[0].status_time}', '${updatet}', '', '${rd[0].pic_lat_long}', '${rd[0].drop_lat_long}', ${espiadd}, ${esdroadd}, '', '${cancel_id}', '${rd[0].req_id}'`, 
                req.hostname, req.protocol) == -1) return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });

            if (await DataDelete(`tbl_cart_vehicle`, `id = '${rd[0].id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
            if (await DataUpdate(`tbl_driver`, `rid_status = '0' AND check_status = '0'`, `id = '${uid}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }

            let message1 = `❌ Your Offer has been rejected.`;
            sendOneNotification(message1, 'customer', rd[0].c_id);
            
            const chat = await DataFind(`SELECT * FROM tbl_chat 
                WHERE (sender_id = '${rd[0].c_id}' AND resiver_id = '${rd[0].d_id}') OR (sender_id = '${rd[0].d_id}' AND resiver_id = '${rd[0].c_id}')`);

            for (let i = 0; i < chat.length;) {
                const emessage = mysql.escape(chat[i].message);
                if (await DataInsert(`tbl_chat_save`, `sender_id, resiver_id, date, message`, `'${chat[i].sender_id}', '${chat[i].resiver_id}', '${chat[i].date}', ${emessage}`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
                }
                i++
            }
            if (await DataInsert(`tbl_chat_save`, `sender_id, resiver_id, date, message`, `'${rd[0].d_id}', '${rd[0].c_id}', '${etime}', '${message1}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }

            if (await DataDelete(`tbl_chat`, `(sender_id = '${rd[0].c_id}' AND resiver_id = '${rd[0].d_id}') OR (sender_id = '${rd[0].d_id}' AND resiver_id = '${rd[0].c_id}')`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }

        }
        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Request Cancel Successful" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post("/vehicle_dri_here", async(req, res)=>{
    try {
        const {uid, request_id, lat, lon} = req.body;
        if(!uid || !request_id || !lat || !lon) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });

        const rd = await DataFind(`SELECT cv.*, COALESCE(dri.first_name, '') AS first_name, COALESCE(dri.last_name, '') AS last_name
                                    FROM tbl_cart_vehicle AS cv
                                    JOIN tbl_driver AS dri ON cv.d_id = dri.id
                                    WHERE cv.id = '${request_id}' AND cv.d_id = '${uid}'`);
        const general = await DataFind(`SELECT driver_wait_time FROM tbl_general_settings`);

        if (rd == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Request Not Found!', general:general[0] });

        let fulldate = await AllFunction.TodatDate(), status = "2", time = general[0].driver_wait_time;
        let updatet = rd[0].status_time_location != "" ? `${rd[0].status_time_location}&!!${status}&${fulldate.date}T${fulldate.time}&${lat}&${lon}` : 
                        `${status}&${fulldate.date}T${fulldate.time}&${lat}&${lon}`;

        let ntime = rd[0].status_time != "" ? `${rd[0].status_time}&!!${status}&0&${time}` : `${status}&0&${time}`; // status_time
        let current_time = `${fulldate.date}T${fulldate.time}&0&${time}`; // current_run_time

        if (await DataUpdate(`tbl_cart_vehicle`, `status = '${status}', status_time_location = '${updatet}', tot_hour = '0', tot_minute = '${time}', status_time = '${ntime}', 
            current_run_time = '${current_time}'`, `id = '${rd[0].id}'`, req.hostname, req.protocol) == -1) {

            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        let message = "🚶‍♂️ Captain " + rd[0].first_name +" "+ rd[0].last_name + " is about to arrive." +
                    "Get ready to meet your Captain."
        await AllChat.Chat_Save(uid, uid, rd[0].c_id, message, "driver", req.hostname, req.protocol);
        
        let message1 = `🔑 Start your ride by providing the PIN: ${rd[0].otp}.`;
        sendOneNotification(message1, 'customer', rd[0].c_id);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Request Send Successful", driver_wait_time:time });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

// ============= Vehicle Service OTP Check ================ //

router.post("/vehicle_otp_check", async(req, res)=>{
    try {
        const {uid, request_id, time, otp, lat, lon} = req.body;
        if(!uid || !request_id || !otp || !lat || !lon) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });

        const rd = await DataFind(`SELECT * FROM tbl_cart_vehicle WHERE id = '${request_id}' AND d_id = '${uid}'`);
        if (rd == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Request Not Found!' });

        if (rd[0].otp != otp) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'OTP Not Match!' });
        else {

            let fulldate = await AllFunction.TodatDate(), status = "3";
            let updatet = rd[0].status_time_location != "" ? `${rd[0].status_time_location}&!!${status}&${fulldate.date}T${fulldate.time}&${lat}&${lon}` : 
                        `${status}&${fulldate.date}T${fulldate.time}&${lat}&${lon}`;

            let ntime = rd[0].status_time != "" ? `${rd[0].status_time}&!!${status}&0&${time}` : `${status}&0&${time}`; // status_time
            
            let ceiltime = 0;
            if (time != 0) {
                let minute = await AllFunction.CalculateMinuteToHour(parseFloat(time));
                ceiltime = Math.ceil(minute)
            }
            if (await DataUpdate(`tbl_cart_vehicle`, `additional_time = '${ceiltime}', status_time_location = '${updatet}', status = '${status}', current_run_time = '', 
                status_time = '${ntime}'`, 
                `id = '${rd[0].id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
        }
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: "OTP Match Successful" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.post("/vehicle_ride_start", async(req, res)=>{
    try {
        const {uid, request_id, lat, lon} = req.body;
        if(!uid || !request_id || !lat || !lon) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });

        const rd = await DataFind(`SELECT * FROM tbl_cart_vehicle WHERE id = '${request_id}' AND d_id = '${uid}'`);
        if (rd == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Request Not Found!' });

        if (rd[0].status == "3") {
            if (rd[0].ride_status != "0") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Please Complete Other Stap!' });
        } else if (rd[0].status == "6") {
            if (rd[0].ride_status != "5") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Please Complete Other Stap!' });
        } 
        if (rd[0].status == "0" || rd[0].status == "1" || rd[0].status == "2" || rd[0].status == "4" || rd[0].status == "5" || rd[0].status == "7" || rd[0].status == "8") {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Please Complete Other Stap!' });
        }

        let dlatlon = rd[0].drop_lat_long.split("&!!"), daddress = rd[0].drop_address.split("&!!"), pending_ride = "", drop_list = [], message = "", pickup, drop, drop_latlon;
        
        if (rd[0].drop_complete == "") pending_ride = 0;
        else pending_ride = parseFloat(rd[0].drop_complete) + 1;

        let ccheck = await AllFunction.CheckCurrentLocation(pending_ride, dlatlon, daddress);

        for (let i = 0; i < dlatlon.length;) {
            let checkadd = daddress[i].split("&!"), checkl = dlatlon[i].split("&!"), status = "";

            if (pending_ride == i) {
                status = "2"; 
                message = checkadd[0];
                drop = `${checkl[0]},${checkl[1]}`;
            }
            if (pending_ride > i) status = "3";
            if (pending_ride < i) status = "1";

            if (rd[0].drop_complete != "") {
                if (parseFloat(rd[0].drop_complete) < i) {
                    drop_list.push({ status: status, title: checkadd[0], subtitle: checkadd[1], latitude: checkl[0], longitude: checkl[1] });
                }
            }
            i++
        }

        let fulldate = await AllFunction.TodatDate(), status = "5"
        let updatet = rd[0].status_time_location != "" ? `${rd[0].status_time_location}&!!${status}&${fulldate.date}T${fulldate.time}&${lat}&${lon}` :  
                    `${status}&${fulldate.date}T${fulldate.time}&${lat}&${lon}`;

        if (status == "5" && pending_ride == "0") {
            let pickup_latlon = rd[0].pic_lat_long.split("&!");
            
            pickup = `${pickup_latlon[0]},${pickup_latlon[1]}`;
        
        } else if (status == "6" || status == "7" || pending_ride != "0") {
        
            if (dlatlon.length == "1") drop_latlon = rd[0].pic_lat_long.split("&!");
            else drop_latlon = dlatlon[pending_ride-1] ? dlatlon[pending_ride-1].split("&!") : [ "", ""];
            
            pickup = `${drop_latlon[0]},${drop_latlon[1]}`;
        }

        const general = await DataFind(`SELECT google_map_key FROM tbl_general_settings`);
        let distance = await AllFunction.GetDistance(pickup, drop, general[0].google_map_key);
       
        let spltime = distance.dur.split(" "), tot_hour = 0, tot_min = 0;
        if (spltime.length == "2") {
            tot_min = parseFloat(spltime[0]);
        } else if (spltime.length == "4") {
            tot_hour = parseFloat(spltime[0]); tot_min = parseFloat(spltime[2]);
        }

        let current_time = `${fulldate.date}T${fulldate.time}&0&0&${distance.dis}`;
        
        if (await DataUpdate(`tbl_cart_vehicle`, `tot_hour = '${tot_hour}', tot_minute = '${tot_min}', status = '${status}', ride_status = '${status}', drop_complete = '${pending_ride}', 
            status_time_location = '${updatet}', current_run_time = '${current_time}'`, 
            `id = '${rd[0].id}'`, req.hostname, req.protocol) == -1) {
            
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        let mess = pending_ride == "0" ? "🚦 Your trip has officially started!" : "🚗 " + message + " Started."
        await AllChat.Chat_Save(uid, uid, rd[0].c_id, mess, "driver", req.hostname, req.protocol);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Service Start Successful", status, current_address:ccheck.current_address,
            next_address:ccheck.next_address, drop_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});




router.post("/vehicle_ride_end", async(req, res)=>{
    try {
        const {uid, request_id, lat, lon} = req.body;
        if(!uid || !request_id || !lat || !lon) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });

        const rd = await DataFind(`SELECT * FROM tbl_cart_vehicle WHERE id = '${request_id}' AND d_id = '${uid}'`);
        if (rd == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Request Not Found!' });
        if (rd[0].status != "5" && rd[0].ride_status != "5") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Please Ride Start!' });

        let dlatlon = rd[0].drop_lat_long.split("&!!"), daddress = rd[0].drop_address.split("&!!"), drop_list = [];
        
        let pending_ride = parseFloat(rd[0].drop_complete);
        let ccheck = await AllFunction.CheckCurrentLocation(pending_ride, dlatlon, daddress), message = "", next_message = "";

        for (let i = 0; i < dlatlon.length;) {
            let checkadd = daddress[i].split("&!"), checkl = dlatlon[i].split("&!"), status = ""

            if (pending_ride >= i) status = "3";
            if (pending_ride < i) status = "1";
            if (pending_ride == i) message = checkadd[0];
            if (parseFloat(pending_ride)+1 == i) next_message = checkadd[0];

            if (pending_ride <= i) {
                drop_list.push({ status: status, title: checkadd[0], subtitle: checkadd[1], latitude: checkl[0], longitude: checkl[1] });
            }

            i++
        }

        let fulldate = await AllFunction.TodatDate(), dtot = pending_ride + 1, status = "", ride_status = "";
        if (parseFloat(rd[0].drop_tot) == parseFloat(dtot)) {

            status = "7"; ride_status = "7";
        } else {
            status = "6"; ride_status = "5";
        }

        let updatet = rd[0].status_time_location != "" ? `${rd[0].status_time_location}&!!${status}&${fulldate.date}T${fulldate.time}&${lat}&${lon}` : 
                        `${status}&${fulldate.date}T${fulldate.time}&${lat}&${lon}`;

        let lasttime = rd[0].current_run_time || rd[0].current_run_time != "" ? rd[0].current_run_time.split("&") : "", stime = 0, ntime
        if (lasttime) {
            stime = AllFunction.TwoTimeDifference(lasttime[0]);
            ntime = rd[0].status_time != "" ? `${rd[0].status_time}&!!${status}&${stime.hour}&${stime.minute}` : `${status}&${stime.hour}&${stime.minute}`;
        }
        
        if (await DataUpdate(`tbl_cart_vehicle`, `status = '${status}', ride_status = '${ride_status}', drop_complete = '${pending_ride}', status_time_location = '${updatet}',
            status_time = '${ntime}', current_run_time = ''`, 
            `id = '${rd[0].id}'`, req.hostname, req.protocol) == -1) {
        
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        let mess = parseFloat(rd[0].drop_tot) != parseFloat(dtot) ? "  " + message + " complete. Next stop: " + next_message : "⭐ Your final destination has been reached."
        await AllChat.Chat_Save(uid, uid, rd[0].c_id, mess, "driver", req.hostname, req.protocol);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Ride Complete Successful", status, ride_status, current_address:ccheck.current_address,
            next_address:ccheck.next_address, drop_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});




router.post("/vehicle_price_detail", async(req, res)=>{
    try {
        const {uid, c_id, request_id} = req.body;
        if(!uid || !c_id || !request_id) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });

        const payment_price = await AllFunction.VehiclePaymentCal(uid, c_id, request_id, 1, req.hostname, req.protocol)
        
        if (payment_price == "1") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Request Not Found!' });
        if (payment_price == "2") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Please Complete Other Stap!' });
        if (payment_price == "3" || payment_price == "4") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });

        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Ride Complete Successful", price_list: payment_price.price_list, 
            payment_data: payment_price.payment[0], add_calculate:payment_price.add_calcu, review_list:payment_price.review_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});




router.post("/add_review", async(req, res)=>{
    try {
        const {uid, c_id, request_id, def_review, review, tot_star} = req.body;
        if(!uid || !c_id || !request_id || !tot_star) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });

        const rd = await DataFind(`SELECT * FROM tbl_order_vehicle WHERE id = '${request_id}' AND c_id = '${c_id}' AND d_id = '${uid}'`);
        if(rd == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Request Not Found!'});

        const revi = await DataFind(`SELECT * FROM tbl_review_customer WHERE request_id = '${rd[0].id}' AND customer_id = '${c_id}' AND driver_id = '${uid}'`);
        if(revi != "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Review Found!'});

        let esreview = mysql.escape(review), fulldate = new Date().toISOString();
        if (await DataInsert(`tbl_review_customer`, `customer_id, driver_id, request_id, def_review, review, tot_star, date`,
            `'${c_id}', '${uid}', '${request_id}', '${def_review}', ${esreview}, '${tot_star}', '${fulldate}'`, req.hostname, req.protocol) == -1) {
    
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Review Add Successful"});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





function getLastWeekDates() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysSinceSunday = dayOfWeek;
    const previousSunday = new Date(today);
    previousSunday.setDate(today.getDate() - daysSinceSunday);

    const now = new Date(previousSunday);
    now.setDate(now.getDate() - 6);
    return {start: now.toISOString().split('T')[0], end: previousSunday.toISOString().split('T')[0]};
}

function getLastMonthDates() {
    const now = new Date();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: startOfLastMonth.toISOString().split('T')[0], end: endOfLastMonth.toISOString().split('T')[0] };
}

function getLastYearDates() {
    const now = new Date();
    const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
    const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31);
    
    return { start: startOfLastYear.toISOString().split('T')[0], end: endOfLastYear.toISOString().split('T')[0] };
}

async function getLastYesterdayDates() {
    let a = new Date()
    a.setDate(a.getDate() - 1);
    return a.toISOString().split("T")[0];
}

router.post("/my_earning", async(req, res)=>{
    try {
        const {uid, time} = req.body;
        if(!uid) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });
        
        let ntime = "", where = ""
        if (time == "yesterday") {
            const lyeas = await getLastYesterdayDates();
            where = `start_time = '${lyeas}'`
        } else if (time == "lastweek") {
            const lweek = getLastWeekDates();
            where = `start_time >= '${lweek.start}' AND start_time <= '${lweek.end}'`
        } else if (time == "lastmonth") {
            const lmonth = getLastMonthDates();
            where = `start_time > '${lmonth.start}' AND start_time <= '${lmonth.end}'` 
        } else if (time == "lastyear") {
            const lyear = getLastYearDates();
            where = `start_time > '${lyear.start}' AND start_time <= '${lyear.end}'`
        }

        if (time == "") {
            ntime = `COUNT(*) AS tot_trip,
                    COALESCE(SUM(final_price), 0) AS tot_price,
                    COALESCE(SUM(tot_minute), 0) AS tot_minute`
        } else {
            if (time == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });
            ntime = `COUNT(CASE WHEN ${where} THEN 1 END) AS tot_trip,
                    COALESCE(SUM(CASE WHEN ${where} THEN final_price END), 0) AS tot_price,
                    COALESCE(SUM(CASE WHEN ${where} THEN tot_minute END), 0) AS tot_minute`
        }

        let times = await AllFunction.TodatDate();
        let earnings = await DataFind(`SELECT 
                                            COUNT(CASE WHEN start_time = '${times.date}' THEN 1 END) AS today_trip,
                                            COALESCE(SUM(CASE WHEN start_time = '${times.date}' THEN final_price END), 0) AS today_price,
                                            COALESCE(SUM(CASE WHEN start_time = '${times.date}' THEN tot_minute END), 0) AS today_minute,
                                            ${ntime}
                                        FROM tbl_order_vehicle
                                        WHERE d_id = '${uid}' AND status NOT IN ('4')`);
              
        const tripdata  = await DataFind(`SELECT id, d_id, final_price, tot_km, tot_minute, start_time, pic_address, drop_address FROM tbl_order_vehicle 
                                            WHERE d_id = '${uid}' ORDER BY id DESC LIMIT 10`);

        if(earnings == "" || tripdata == "") return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Driver Not Found!', 
            earnings:{today_trip:0, today_price:0, today_minute:0, tot_trip:0, tot_price:0, tot_minute:0}, ride_data:[] });

        earnings[0].today_minute = await AllFunction.CalculateMinuteToHour(parseFloat(earnings[0].today_minute));
        earnings[0].tot_minute = await AllFunction.CalculateMinuteToHour(parseFloat(earnings[0].tot_minute));

        let r_data = tripdata.map(async(val) => {
            let data = await AllFunction.RideAddress(val, 1);
            let fulldate = await AllFunction.ConvertDateFormat(val.start_time);
            let cminute = await AllFunction.CalculateMinuteToHour(parseFloat(val.tot_minute));
            
            val.pic_address = data.piclatlon; val.drop_address = data.dropdata; val.tot_minute = cminute; val.start_time = fulldate;
            return val;
        })
        let ride_data = await Promise.all(r_data);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Data Load Successful", earnings:earnings[0], ride_data});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





router.post("/ride_history", async(req, res)=>{
    try {
        const {uid} = req.body;
        if(!uid) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });
        
        const tripdata  = await DataFind(`SELECT ov.id, ov.d_id, COALESCE(cus.name, '') AS cus_name, COALESCE(ve.name, '') AS vehicle_name, ov.final_price, ov.tot_km, 
                                        ov.tot_minute, ov.start_time, ov.pic_address, ov.drop_address
                                        FROM tbl_order_vehicle AS ov
                                        LEFT JOIN tbl_customer AS cus ON ov.c_id = cus.id
                                        LEFT JOIN tbl_vehicle AS ve ON ov.vehicleid = ve.id
                                        WHERE ov.d_id = '${uid}' ORDER BY ov.id DESC LIMIT 10`);

        if(tripdata == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Driver Not Found!' });
            
        let r_data = tripdata.map(async (val) => {
            let data = await AllFunction.RideAddress(val, 1)

            let fnd = new Date(val.start_time).toISOString();
            let nd = new Date(val.start_time).toISOString().split("T")[0].split("-");   
            let d = `${nd[2]}/${nd[1]}/${nd[0]}`;
            let cminute = await AllFunction.CalculateMinuteToHour(parseFloat(val.tot_minute));

            val.date = fnd; val.pic_address = data.piclatlon; val.drop_address = data.dropdata; val.tot_minute = cminute; val.start_time = d;
            return val;
        })
        let ride_data = await Promise.all(r_data);

        let rdata = await AllFunction.DateConvertDay(ride_data);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Data Load Successful", ride_data:rdata});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





router.post("/ride_history_detail", async(req, res)=>{
    try {
        const {request_id, uid} = req.body;
        if(!uid) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });
        
        let trdata = await DataFind(`SELECT ov.id, ov.c_id, ov.d_id, ov.status, COALESCE(cus.name, '') AS cus_name, COALESCE(ve.name, '') AS vehicle_name, ov.price, ov.final_price, 
                                    ov.addi_time_price, ov.tot_km, ov.tot_minute, ov.start_time,
                                    CASE WHEN COUNT(revi.id) > 0 THEN 1 ELSE 0 END AS review_check,
                                    ov.pic_address, ov.drop_address, ov.status_time_location
                                    FROM tbl_order_vehicle AS ov
                                    LEFT JOIN tbl_customer AS cus ON ov.c_id = cus.id
                                    LEFT JOIN tbl_vehicle AS ve ON ov.vehicleid = ve.id
                                    LEFT JOIN tbl_review_customer AS revi ON ov.d_id = revi.driver_id AND ov.c_id = revi.customer_id AND ov.id = revi.request_id
                                    WHERE ov.id = '${request_id}' AND ov.d_id = '${uid}' ORDER BY ov.id DESC LIMIT 10`);

        if(trdata == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Driver Not Found!' });
        
        let stime = trdata[0].status_time_location.split("&!!");
        let data = await AllFunction.RideAddress(trdata[0], 2);
            
        let count = 0;
        for (let i = 0; i < stime.length;) {
            let a = stime[i].split("&");
            
            if (parseFloat(a[0]) < 4) {
                let fulldate = await AllFunction.ConvertFullDateFormat(a[1], 2);
                if (parseFloat(a[0]) == 1) data.piclatlon.time = fulldate;
            }
            
            if (trdata[0].status == 4) {
                if (data.dropdata[count]) {
                    data.dropdata[count].time = "";
                }
                count++;
            }
            
            if (parseFloat(a[0]) > 4 && parseFloat(a[0]) < 7) {
            
                let bt = stime[i+1].split("&");
                if (data.drop_tot != 1 ) {

                    if (parseFloat(a[0]) == 5 && parseFloat(bt[0]) == 6) {
                        data.dropdata[count].time = await AllFunction.ConvertFullDateFormat(bt[1], 2);
                        count++;
                    }
                    if (parseFloat(a[0]) == 5 && parseFloat(bt[0]) == 7) {
                        data.dropdata[count].time = await AllFunction.ConvertFullDateFormat(bt[1], 2);
                        count++;
                    }
                }
                if (data.drop_tot == 1 ) {
                    let fulld = await AllFunction.ConvertFullDateFormat(bt[1], 2);
                    
                    if (parseFloat(a[0]) == 5 && parseFloat(bt[0]) == 7) data.dropdata[0].time = fulld;
                }
            }
            i++;
        }

        if (trdata[0].status == 4) {
            for (let a = 0; a < data.dropdata.length;) {
                data.dropdata[a].time = "";
                a++;
            }
        }

        let nd = new Date(trdata[0].start_time).toISOString().split("T")[0].split("-");
        let d = `${nd[2]}/${nd[1]}/${nd[0]}`, cminute = await AllFunction.CalculateMinuteToHour(parseFloat(trdata[0].tot_minute));
        let price =  parseFloat(trdata[0].price) + parseFloat(trdata[0].addi_time_price);

        trdata[0].pic_address = data.piclatlon; trdata[0].drop_address = data.dropdata; trdata[0].start_time = d; trdata[0].tot_minute = cminute; trdata[0].price = price;
        delete trdata[0].status_time_location; delete trdata[0].addi_time_price;

        if (trdata[0].review_check == "0") {
            const review_list = await DataFind(`SELECT * FROM tbl_ride_review_reason WHERE status = '1'`);
            trdata[0].review_list = review_list;
        } else trdata[0].review_list = [];

        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Data Load Successful", history_data:trdata[0]});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});




router.post("/rating_data", async(req, res)=>{
    try {
        const {uid} = req.body;
        if(!uid) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });

        let r = await DataFind(`SELECT rd.id, rd.request_id, rd.review, rd.tot_star, rd.date, 
                                COALESCE(cus.name, '') AS cus_name,
                                COALESCE(GROUP_CONCAT(rrv.title SEPARATOR '&&!'), '') AS def_title
                                FROM tbl_review_driver AS rd
                                LEFT JOIN tbl_customer AS cus ON rd.customer_id = cus.id
                                LEFT JOIN tbl_ride_review_reason AS rrv ON FIND_IN_SET(rrv.id, rd.def_review) > 0
                                WHERE rd.driver_id = '${uid}' GROUP BY rd.id ORDER BY rd.id DESC;`);

        if(r == "") return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Review Not Found!', review_data:[] });

        let d = r.map(async (val) => {
            val.def_title = val.def_title != "" ? val.def_title.split("&&!") : [];

            const date = new Date(val.date);
            const formattedDate = date.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
            val.date = formattedDate;
            return val;
        })

        let review_data = await Promise.all(d);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Data Load Successful", review_data});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post("/Profile_data", async(req, res)=>{
    try {
        const {uid} = req.body;
        if(!uid) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });
        
        const d = await DataFind(`SELECT dri.*, COALESCE(tbl_vehicle.name, "") AS vname, COALESCE(GROUP_CONCAT(DISTINCT dz.name SEPARATOR ', '), '') AS zone_name, 
                                COALESCE(GROUP_CONCAT(DISTINCT vr.name SEPARATOR ', '), '') AS prefrence_name
                                FROM tbl_driver AS dri
                                JOIN tbl_vehicle ON dri.vehicle = tbl_vehicle.id
                                LEFT JOIN tbl_zone AS dz ON FIND_IN_SET(dz.id, dri.zone) > 0
                                LEFT JOIN tbl_vehicle_preference AS vr ON FIND_IN_SET(vr.id, dri.vehicle_prefrence) > 0
                                WHERE dri.id = '${uid}'
                                GROUP BY dri.id;`);

        if(d == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Driver Not Found!' });

        d.map(async(val) =>{
            let ln = val.language != "" ? val.language.split(",") : [], lang = "";
            ln.map(val => lang += lang == "" ? val : ", " + val);
            val.language = lang;

            const date = new Date(val.date);
            const options = { day: '2-digit', month: 'short', year: 'numeric' };
            const formattedDate = date.toLocaleDateString('en-GB', options);
            val.date = formattedDate
        })

        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Data Load Successful", profile_data:d[0]});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





router.post("/edit_profile", upload.single('profile_image'), async(req, res)=>{
    try {
        const {uid, first_name, last_name} = req.body;
        if(!uid || !first_name || !last_name) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });
        
        let driver = await DataFind(`SELECT * FROM tbl_driver WHERE id = '${uid}'`);
        if (driver == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Driver Not Found!' });

        let imageUrl = "";
        if (req.file) {
            const folder_path = path.resolve(__dirname, "../public/" + driver[0].profile_image);

            fs.remove(folder_path, (err) => {
                    if (err) {
                    console.error('Error deleting file:');
                    return;
                }
                console.log('Image deleted successfully.');
            });

            imageUrl = "uploads/driver/" + req.file.filename;
        } else {
            imageUrl = driver[0].profile_image;
        }

        if (await DataUpdate(`tbl_driver`, ` profile_image = '${imageUrl}', first_name = '${first_name}', last_name = '${last_name}'`,
            `id = '${driver[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Profile Update Successful" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post("/wallet_payout", async(req, res)=>{
    try {
        const {uid, first_name, last_name} = req.body;
        if(!uid || !first_name || !last_name) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });
        
        let driver = await DataFind(`SELECT * FROM tbl_driver WHERE id = '${uid}'`);
        if (driver == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Driver Not Found!' });

        let imageUrl = "";
        if (req.file) {
            const folder_path = path.resolve(__dirname, "../public/" + driver[0].profile_image);

            fs.remove(folder_path, (err) => {
                    if (err) {
                    console.error('Error deleting file:');
                    return;
                }
                console.log('Image deleted successfully.');
            });

            imageUrl = "uploads/driver/" + req.file.filename;
        } else {
            imageUrl = driver[0].profile_image;
        }

        if (await DataUpdate(`tbl_driver`, ` profile_image = '${imageUrl}', first_name = '${first_name}', last_name = '${last_name}'`,
            `id = '${driver[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Profile Update Successful" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post("/wallet_data", async(req, res)=>{
    try {
        const {uid} = req.body;
        if(!uid) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });
        
        const driver = await DataFind(`SELECT wallet, payout_wallet FROM tbl_driver WHERE id = '${uid}'`);
        if(driver == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Driver Not Found!' });
        let wallet_amount = driver[0].wallet ? parseFloat(driver[0].wallet) : 0;
        let Withdraw_amount = driver[0].payout_wallet ? parseFloat(driver[0].payout_wallet) : 0;

        const walletd = await DataFind(`SELECT td.id, td.payment_id, td.amount, td.date, td.status, td.type, COALESCE(pd.name, '') AS p_name, 
                                        COALESCE(ov.platform_fee, '') AS platform_fee, COALESCE(ov.paid_amount, '') AS paid_amount, COALESCE(ov.wallet_price, '') AS wallet_price
                                        FROM tbl_transaction_driver AS td
                                        LEFT JOIN tbl_order_vehicle AS ov ON td.payment_id = ov.id AND td.status = '1'
                                        LEFT JOIN tbl_payment_detail AS pd ON ov.payment_id = pd.id AND td.status = '1'
                                        WHERE td.d_id = '${uid}' AND td.status = '1' ORDER BY td.id DESC`);

        let wdata = await AllFunction.DateConvertDay(walletd);

        const general_setting = await DataFind(`SELECT s_min_withdraw FROM tbl_general_settings`);
        if(wdata == "" || !wdata) return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data Not Found!', wallet_amount, Withdraw_amount, 
        minimum_wi_amount: general_setting[0].s_min_withdraw, wallet_data:[] });
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Data Load Successful", wallet_amount, Withdraw_amount, minimum_wi_amount: general_setting[0].s_min_withdraw, 
        wallet_data:wdata });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/Wallet_withdraw", async(req, res)=>{
    try {
        const { id, Withdraw_amount, payment_type, upi_id, paypal_id, bank_no, bank_ifsc, bank_type } = req.body;
        if (id == "" || Withdraw_amount == "" || payment_type == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });
        
        const driver = await DataFind(`SELECT id, wallet, tot_payout, payout_wallet FROM tbl_driver WHERE id = '${id}'`);
        if (driver == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User Not Found!'});

        const general_setting = await DataFind(`SELECT s_min_withdraw FROM tbl_general_settings`);

        if (parseFloat(driver[0].payout_wallet) >= parseFloat(general_setting[0].s_min_withdraw)) {
            const date = new Date().toISOString();

            if (parseFloat(Withdraw_amount) >= parseFloat(general_setting[0].s_min_withdraw) && parseFloat(Withdraw_amount) <= parseFloat(driver[0].payout_wallet)) {
                let check = 0, wid;
                if (payment_type == "UPI") {
                    if (upi_id == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });
                    check = 1;

                    wid = await DataInsert(`tbl_wallet_withdraw`, `image, driver_id, date, amount, p_type, status, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                        `'', '${id}', '${date}', '${Withdraw_amount}', '1', '0', '${upi_id}', '', '', '', ''`, req.hostname, req.protocol)
                    
                } else if (payment_type == "Paypal") {
                    if (paypal_id == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });
                    check = 1;

                    wid = await DataInsert(`tbl_wallet_withdraw`, `image, driver_id, date, amount, p_type, status, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                        `'', '${id}', '${date}', '${Withdraw_amount}', '2', '0', '', '${paypal_id}', '', '', ''`, req.hostname, req.protocol)
                                    
                } else if (payment_type == "BANK Transfer") {
                    if (bank_no == "" || bank_ifsc == "" || bank_type == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });
                    check = 1;

                    wid = await DataInsert(`tbl_wallet_withdraw`, `image, driver_id, date, amount, p_type, status, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                        `'', '${id}', '${date}', '${Withdraw_amount}', '3', '0', '', '', '${bank_no}', '${bank_ifsc}', '${bank_type}'`, req.hostname, req.protocol)

                }
                if (wid == -1) return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });

                if (check == "1") {
                    let total = parseFloat((parseFloat(driver[0].payout_wallet) - parseFloat(Withdraw_amount)).toFixed(2));
                    let tot_payout = parseFloat((parseFloat(driver[0].tot_payout) + parseFloat(Withdraw_amount)).toFixed(2));

                    if (await DataUpdate(`tbl_driver`, `payout_wallet = '${total}', tot_payout = '${tot_payout}'`, `id = '${driver[0].id}'`, req.hostname, req.protocol) == -1) {
                        return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
                    }

                    if (await DataInsert(`tbl_transaction_driver`, `d_id, payment_id, amount, date, status, type`,
                        `${id}, '', '${Withdraw_amount}', '${date}', '2', '${wid.insertId}'`, req.hostname, req.protocol) == -1) {
                        return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
                    }
                }

                return res.status(200).json({ ResponseCode: 200, Result:true, message: "Wallet Withdraw Request Add Successfully" });
            }
            return res.status(200).json({ ResponseCode: 401, Result:false, message: `Minimum Withdrawn Amount ${general_setting[0].s_min_withdraw}` });
        } else {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: `Minimum Withdrawn Amount ${general_setting[0].s_min_withdraw}` });
        }
    } catch (error) {
        console.log(error);
    }
});

router.post("/wallet_payout_data", async(req, res)=>{
    try {
        const { id } = req.body;
        if (!id) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });
        
        const driver = await DataFind(`SELECT id, wallet, tot_payout FROM tbl_driver WHERE id = '${id}'`);
        if (driver == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User Not Found!'});

        const payout_data = await DataFind(`SELECT * FROM tbl_wallet_withdraw WHERE driver_id = '${id}' ORDER BY id DESC`);
        payout_data.map(val => {
            const date = new Date(val.date).toISOString().split("T")[0];
            val.date = date;
        })
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Data Load Successful", tot_payout: driver[0].tot_payout, payout_data });
    } catch (error) {
        console.log(error);
    }
});

router.post("/add_cash", cash_adjustment.single('image'), async(req, res)=>{
    try {
        const { id, cash_amount, payment_type } = req.body;
        if (!id || !cash_amount || !payment_type) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });
        
        const driver = await DataFind(`SELECT dri.id, dri.tot_cash, COALESCE(SUM(cadj.amount), 0) AS tot_pendinga
                                        FROM tbl_driver AS dri
                                        LEFT JOIN tbl_cash_adjust AS cadj ON cadj.driver_id = dri.id AND cadj.status = '0'
                                        WHERE dri.id = '${id}' GROUP BY dri.id;`);

        if (driver == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User Not Found!'});
        let tot_cash = parseFloat((parseFloat(driver[0].tot_cash) - parseFloat(driver[0].tot_pendinga)).toFixed(2));

        if ( parseFloat(tot_cash) >= parseFloat(cash_amount)) {

            const imageUrl = req.file ? "uploads/cash_proof/" + req.file.filename : null;
            const date = new Date().toISOString();

            if (await DataInsert(`tbl_cash_adjust`, `driver_id, prof_image, amount, date, payment_type, status`,
                `${id}, '${imageUrl}', '${cash_amount}', '${date}', '${payment_type}', '0'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
            return res.status(200).json({ ResponseCode: 200, Result:true, message: "Cash Adjust Successful" });
        }
        
        return res.status(200).json({ ResponseCode: 401, Result:false, message: "Amount is Not Adjustable" });
    } catch (error) {
        console.log(error);
    }
});

router.post("/cash_adjust_data", async(req, res)=>{
    try {
        const { id } = req.body;
        if (!id) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });
        
        const driver = await DataFind(`SELECT dri.id, dri.tot_cash, COALESCE(SUM(cadj.amount), 0) AS tot_pendinga
                                        FROM tbl_driver AS dri
                                        LEFT JOIN tbl_cash_adjust AS cadj ON cadj.driver_id = dri.id AND cadj.status = '0'
                                        WHERE dri.id = '${id}' GROUP BY dri.id;`);
        
        if (driver == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User Not Found!'});

        const all_cash_data = await DataFind(`SELECT * FROM tbl_cash_adjust WHERE driver_id = '${id}' ORDER BY id DESC`);
        let cash_data = await AllFunction.DateConvertDay(all_cash_data);

        let tot_cash = parseFloat((parseFloat(driver[0].tot_cash) - parseFloat(driver[0].tot_pendinga)).toFixed(2));
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Data Load Successful", tot_cash: tot_cash, cash_data });
    } catch (error) {
        console.log(error);
    }
});

router.post("/cash_data", async(req, res)=>{
    try {
        const {uid} = req.body;
        if(!uid) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });

        const walletd = await DataFind(`SELECT td.id, td.payment_id, td.amount, td.date, td.status, td.type, COALESCE(pd.name, '') AS p_name, 
                                        COALESCE(ov.platform_fee, '') AS platform_fee, COALESCE(ov.paid_amount, '') AS paid_amount, COALESCE(ov.wallet_price, '') AS wallet_price
                                        FROM tbl_transaction_driver AS td
                                        LEFT JOIN tbl_order_vehicle AS ov ON td.payment_id = ov.id AND td.status = '1'
                                        LEFT JOIN tbl_payment_detail AS pd ON ov.payment_id = pd.id AND td.status = '1'
                                        WHERE td.d_id = '${uid}' AND ov.payment_id = '9' ORDER BY td.id DESC`);

        let all_data = [], tot_cash_amount = 0;

        walletd.forEach(item => {
            const dateString = new Date(item.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            
            let existingDateEntry = all_data.find(entry => entry.date === dateString), pname = ""
            
            if (!existingDateEntry) {
                existingDateEntry = {
                    date: dateString,
                    detail: []
                };
                all_data.push(existingDateEntry);
            }
            item.date = new Date(item.date).toISOString().split("T")[0];
            tot_cash_amount += parseFloat(item.paid_amount)

            if (item.paid_amount != "0") pname = `${item.p_name}`
            if (item.wallet_price != "0") pname = pname != "" ? `${pname},Wallet` : `Wallet`;
            item.p_name = pname
            existingDateEntry.detail.push(item);
        });

        if(all_data == "" || !all_data) return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data Not Found!', tot_cash_amount: parseFloat(parseFloat(tot_cash_amount).toFixed(2)), 
        wallet_data:[] });

        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Data Load Successful", tot_cash_amount: parseFloat(parseFloat(tot_cash_amount).toFixed(2)), 
        wallet_data:all_data });
    } catch (error) {
        console.log(error);
    }
});

router.post("/send_default_notification", async(req, res)=>{
    try {
        const { uid, mid, request_id } = req.body;
        if (!uid || !mid || !request_id) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });
        
        const rd = await DataFind(`SELECT * FROM tbl_cart_vehicle WHERE id = '${request_id}' AND d_id = '${uid}'`);
        if (rd == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Request Not Found!'});

        const dem_list = await DataFind(`SELECT * FROM tbl_default_notification WHERE id = '${mid}'`);
        if (dem_list == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Notification Not Found!'});
        
        sendOneNotification(dem_list[0].title, 'customer', rd[0].c_id);
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Nofitication Send Suucessful" });
    } catch (error) {
        console.log(error); 
    }
});



router.post("/notification", async(req, res)=>{
    try {
        const {uid} = req.body;
        if(!uid) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong'});

        const ndata = await DataFind(`SELECT noti.id, noti.image, noti.title, noti.description, noti.date
                                        FROM tbl_send_notification AS noti
                                        LEFT JOIN tbl_driver AS dri ON noti.driver = dri.id
                                        WHERE noti.driver = 'All' OR dri.id = '${uid}' ORDER BY noti.id DESC`);
        
        ndata.map(val => {
            const date = new Date(val.date);
            const formattedDate = date.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
            val.date = formattedDate;
            return val;
        })
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Data Not Found!", ndata});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})


router.post("/account_deactive", async(req, res)=>{
    try {
        const {id} = req.body;

        const driver_list = await DataFind(`SELECT id FROM tbl_driver WHERE id = '${id}'`);      
        if (driver_list == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'ID Not Found!'});

        if (await DataUpdate(`tbl_driver`, `status = '0'`, `id = '${id}'`, req.hostname, req.protocol) == -1) {
    
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Account Deactivate Successful" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})









module.exports = router;