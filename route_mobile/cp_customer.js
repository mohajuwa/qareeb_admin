/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */



const express = require("express");
const router = express.Router();
const multer = require('multer');
const mysql = require("mysql2");
const bcrypt = require('bcrypt');
const axios = require('axios');
const AllFunction = require("../route_function/function");
const sendOneNotification = require("../middleware/send");
const { checkedit } = require("../public/js/editor/ckeditor/adapters/check");
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/databse_query");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/payment_proof");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const upload = multer({ storage: storage });

const storage1 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/customer_profile");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const customer_profile = multer({ storage: storage1 });



router.post("/signup", async (req, res) => {
    try {
        const { name, email, ccode, phone, password, referral_code } = req.body;

        const missingField = ["name", "email", "ccode", "phone", 'password'].find(field => !req.body[field]);
        if (missingField) return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' })

        const cus_data = await DataFind(`SELECT * FROM tbl_customer WHERE country_code = '${ccode}' AND phone = '${phone}'`);
        const general = await DataFind(`SELECT refer_credit, one_app_id, one_api_key FROM tbl_general_settings`);
        let generald = { one_app_id: general[0].one_app_id, one_api_key: general[0].one_api_key }
        if (cus_data != "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'PhoneNo Already Exists!', general: generald })

        let esname = mysql.escape(name);
        const hash = await bcrypt.hash(password, 10);
        let otp_result = await AllFunction.otpGenerate(6);

        if (referral_code != "") {
            const referal_customer = await DataFind(`SELECT id, wallet FROM tbl_customer WHERE referral_code = '${referral_code}'`);
            if (referal_customer != "") {
                let amount = parseFloat(referal_customer[0].wallet) + parseFloat(general[0].refer_credit);

                if (await DataUpdate(`tbl_customer`, `wallet = '${amount}'`, `id = '${referal_customer[0].id}'`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ message: process.env.dataerror, status: false });
                }

                let fulldate = await AllFunction.TodatDate();
                if (await DataInsert(`tbl_transaction_customer`, `c_id, payment_id, amount, date, status, type`,
                    `${referal_customer[0].id}, '0', '${general[0].refer_credit}', '${fulldate.date}T${fulldate.time}', '1', ''`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ ResponseCode: 401, Result: false, message: process.env.dataerror });
                }
            }
        }

        const date = new Date().toISOString().split('T');
        if (await DataInsert(`tbl_customer`, `profile_image, name, email, country_code, phone, password, status, referral_code, wallet, date`,
            `'', ${esname}, '${email}', '${ccode}', '${phone}', '${hash}', '1', '${otp_result}', '0', '${date}'`, req.hostname, req.protocol) == -1) {

            return res.status(200).json({ ResponseCode: 401, Result: false, message: process.env.dataerror });
        }
        const new_cus_data = await DataFind(`SELECT * FROM tbl_customer WHERE country_code = '${ccode}' AND phone = '${phone}'`);

        return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Signup successful', general: generald, customer_data: new_cus_data[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.post("/edit_customer", customer_profile.single("profile_img"), async (req, res) => {
    try {
        const { id, name, email, password } = req.body;

        const missingField = ["id", "name", "email"].find(field => !req.body[field]);
        if (missingField) return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        let esname = mysql.escape(name), pass, imageUrl = "";
        const passw = await DataFind(`SELECT profile_image, password FROM tbl_customer WHERE id = '${id}'`);
        if (!password) pass = passw[0].password
        else pass = await bcrypt.hash(password, 10);

        imageUrl = req.file ? "uploads/customer_profile/" + req.file.filename : passw[0].profile_image;

        if (await DataUpdate(`tbl_customer`, `profile_image = '${imageUrl}', name = ${esname}, email = '${email}', password = '${pass}'`, `id = '${id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        const customer_data = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${id}'`);

        return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Profile Update Successful', customer_data: customer_data[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.post("/login", async (req, res) => {
    try {
        const { ccode, phone, password } = req.body;

        const missingField = ["ccode", "phone", 'password'].find(field => !req.body[field]);
        if (missingField) return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' })

        const general = await DataFind(`SELECT one_app_id, one_api_key FROM tbl_general_settings`);
        const cus_data = await DataFind(`SELECT * FROM tbl_customer WHERE country_code = '${ccode}' AND phone = '${phone}'`);

        if (cus_data == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: "PhoneNo Not Exists!", general: general[0] });

        if (cus_data[0].status != "1") return res.status(200).json({ ResponseCode: 401, Result: false, message: "Account Deactivated", general: general[0] });

        const hash_pass = await bcrypt.compare(password, cus_data[0].password);

        if (!hash_pass) {
            return res.status(200).json({ ResponseCode: 401, Result: false, message: "Password Not match", general: general[0] });
        } else {
            return res.status(200).json({ ResponseCode: 200, Result: true, message: "Login Sccessful", general: general[0], customer_data: cus_data[0] });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.post("/mobile_check", async (req, res) => {
    try {
        const { ccode, phone } = req.body;

        if (ccode == "" || phone == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        const cus_data = await DataFind(`SELECT * FROM tbl_customer WHERE country_code = '${ccode}' AND phone = '${phone}'`);

        if (cus_data == "") return res.status(200).json({ ResponseCode: 200, Result: true, message: "New Number" });
        else return res.status(200).json({ ResponseCode: 401, Result: false, message: "PhoneNo Already Exist" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.post("/forgot_password", async (req, res) => {
    try {
        const { ccode, phone, password } = req.body;

        if (ccode == "" || phone == "" || password == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong!' });

        const cus_data = await DataFind(`SELECT * FROM tbl_customer WHERE country_code = '${ccode}' AND phone = '${phone}'`);

        if (cus_data == "") {
            res.status(200).json({ ResponseCode: 401, Result: false, message: "PhoneNo Not Exist" });
        } else {
            const hash = await bcrypt.hash(password, 10);

            if (await DataUpdate(`tbl_customer`, `password = '${hash}'`, `id = '${cus_data[0].id}'`, req.hostname, req.protocol) == -1) {

                return res.status(200).json({ ResponseCode: 401, Result: false, message: process.env.dataerror });
            }
            res.status(200).json({ ResponseCode: 200, Result: true, message: 'Password Change successful' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.get("/otp_detail", async (req, res) => {
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

        if (sms_type != "") res.status(200).json({ ResponseCode: 200, Result: true, message: sms_type });
        else res.status(200).json({ ResponseCode: 401, Result: false, message: 'Data Not Found' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.post("/msg91", async (req, res) => {
    try {
        const { phoneno } = req.body;

        if (phoneno == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong!' });

        const general_setting = await DataFind(`SELECT * FROM tbl_general_settings`);

        let otp_result = await AllFunction.otpGenerate(6)

        let auth_key = general_setting[0].msg_key;
        let template_id = general_setting[0].msg_token;

        let pho_no = phoneno;
        const options = {
            method: 'POST',
            url: 'https://control.msg91.com/api/v5/otp?template_id=' + template_id + '&mobile=' + pho_no + '&otp=' + otp_result,
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                authkey: auth_key
            },
            data: { Param1: 'value1' }
        };

        axios.request(options)
            .then(function (response) {
                console.log(response.data);
                res.status(200).json({ ResponseCode: 200, Result: true, message: "Otp Send successful", otp: otp_result });
            })
            .catch(function (error) {
                console.error(error);
                res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });
            });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.post("/twilio", async (req, res) => {
    try {
        const { phoneno } = req.body;

        if (phoneno == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong!' });

        const general_setting = await DataFind(`SELECT * FROM tbl_general_settings`);

        let otp_result = await AllFunction.otpGenerate(6)

        let accountSid = general_setting[0].twilio_sid;
        let authToken = general_setting[0].twilio_token;

        const client = require('twilio')(accountSid, authToken);

        client.messages.create({
            body: 'Your ' + general_setting[0].title + ' otp is ' + otp_result + '',
            from: general_setting[0].twilio_phoneno,
            to: phoneno
        })
            .then(message => {
                console.log(message.sid);
                res.status(200).json({ ResponseCode: 200, Result: true, message: "Otp Send successful", otp: otp_result });
            })
            .catch((error) => {
                console.log(error);
                res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });
            });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.post("/home", async (req, res) => {
    try {
        const { uid, lat, lon } = req.body;

        if (uid == "" || lat == "" || lon == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        const general = await DataFind(`SELECT site_currency, offer_expire_time FROM tbl_general_settings`);
        if (general == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        let vehicle_list = await DataFind(`SELECT id, image, name, description, bidding FROM tbl_vehicle WHERE status = '1'`);
        vehicle_list.map(vvel => { vvel.role = "1" });

        let module_setting = await DataFind(`SELECT * FROM tbl_module_setting`);
        module_setting.map(ovel => {
            ovel.bidding = "0"
            ovel.role = (parseFloat(ovel.id) + parseFloat(1)).toString()
        });

        let package_list = await DataFind(`SELECT id, image, name, description FROM tbl_package`);
        package_list.map(rvel => {
            rvel.bidding = "0"
            rvel.role = "4"
        });

        const category_list = [...vehicle_list];

        let dr = await AllFunction.CustomerReview("cus");
        const cus_rating = await DataFind(`SELECT cus.id ${dr.tot_review} ${dr.avgstar}
                                        FROM tbl_customer AS cus
                                        ${dr.outtable}
                                        WHERE cus.id = '${uid}' GROUP BY cus.id ORDER BY id DESC`);

        let rdata = await DataFind(`SELECT veh.*, COALESCE(vec.minimum_fare, '') as minimum_fare, COALESCE(vec.maximum_fare, '') as maximum_fare
                                    FROM tbl_request_vehicle AS veh
                                    JOIN tbl_vehicle AS vec ON veh.vehicleid = vec.id
                                    WHERE c_id = '${uid}' ORDER BY id DESC LIMIT 1`);

        if (rdata != '') {
            let rd = await AllFunction.VehicleAllRide(rdata[0], 2);

            let pickapp = { title: rd.piclatlon.title, subtitle: rd.piclatlon.subtitle }, picklat = { latitude: rd.piclatlon.latitude, longitude: rd.piclatlon.longitude };
            let drop_add = { title: '', subtitle: '' }, drop_latlon = { latitude: '', longitude: '' }, daddlist = [], dlatlist = [];
            for (let i = 0; i < rd.dropdata.length;) {
                if (i == 0) {
                    drop_add = { title: rd.dropdata[i].title, subtitle: rd.dropdata[i].subtitle };
                    drop_latlon = { latitude: rd.dropdata[i].latitude, longitude: rd.dropdata[i].longitude };
                } else {
                    daddlist.push({ title: rd.dropdata[i].title, subtitle: rd.dropdata[i].subtitle });
                    dlatlist.push({ latitude: rd.dropdata[i].latitude, longitude: rd.dropdata[i].longitude });
                }
                i++;
            }

            if (typeof rdata[0].d_id == "string") rdata[0].d_id = JSON.parse(rdata[0].d_id);
            let runtime = await AllFunction.CurrentDatetoOldDateS(rdata[0].start_time, general[0].offer_expire_time);

            rdata[0].pick_add = pickapp; rdata[0].pick_latlon = picklat; rdata[0].drop_add = drop_add; rdata[0].drop_latlon = drop_latlon; rdata[0].drop_add_list = daddlist; rdata[0].drop_latlon_list = dlatlist;
            rdata[0].bidding_run_status = rdata[0].bidding_d_price != '' ? 1 : 0; rdata[0].increased_time = runtime > 0 ? runtime : 0;
            rdata[0].price = Number(rdata[0].price); rdata[0].tot_km = Number(rdata[0].tot_km);

            delete rdata[0].pic_lat_long; delete rdata[0].drop_lat_long; delete rdata[0].pic_address; delete rdata[0].drop_address; delete rdata[0].status_time_location;
            delete rdata[0].bidding_d_price;
        }

        return res.status(200).json({
            ResponseCode: 200, Result: true, message: "Data Load successful", general: { site_currency: general[0].site_currency }, cus_rating: cus_rating[0],
            category_list, runnig_ride: rdata
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})




router.post("/vehicle_information", async (req, res) => {
    try {
        const { vehicle_id } = req.body;

        if (vehicle_id == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        const vehicle_list = await DataFind(`SELECT id, image, name, description, passenger_capacity FROM tbl_vehicle WHERE id = '${vehicle_id}' AND status = '1'`);

        if (vehicle_list != "") return res.status(200).json({ ResponseCode: 200, Result: true, message: "Data Load successful", vehicle: vehicle_list[0] });
        else return res.status(200).json({ ResponseCode: 401, Result: false, message: "Vehicle Not Found!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})




router.post("/home_wallet", async (req, res) => {
    try {
        const { uid } = req.body;
        if (uid == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        const driver = await DataFind(`SELECT wallet FROM tbl_customer WHERE id = '${uid}'`);
        if (driver == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Driver Not Found!' });

        let walletp = "0";
        if (typeof parseFloat(driver[0].wallet) == "Number" || driver[0].wallet) {
            walletp = driver[0].wallet
        } else walletp = "0"

        return res.status(200).json({ ResponseCode: 200, Result: true, message: "Data Load successful", wallet_amount: driver[0].wallet });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

router.post("/home_mape", async (req, res) => {
    try {
        const { mid, lat, lon } = req.body;

        // Log the incoming request for debugging
        console.log("HomeMap API Request:", { mid, lat, lon });

        if (!lat || !lon) {
            console.log("Missing lat or lon");
            return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Missing latitude or longitude' });
        }

        // Validate coordinates
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lon);

        if (isNaN(latitude) || isNaN(longitude)) {
            console.log("Invalid coordinates");
            return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Invalid coordinates' });
        }

        console.log("Processing coordinates:", { latitude, longitude });

        const general = await DataFind(`SELECT site_currency, vehicle_radius FROM tbl_general_settings`);
        if (!general || general.length === 0) {
            console.log("General settings not found");
            return res.status(200).json({ ResponseCode: 401, Result: false, message: 'General settings not found' });
        }

        let convertzone = [{ latitude: latitude, longitude: longitude }];
        console.log("Convert zone:", convertzone);

        try {
            let dzone = await AllFunction.ZoneData();
            let zonecheck = await AllFunction.CheckZone(convertzone, dzone.all_zone, dzone.zone_data);
            console.log("Zone check result:", zonecheck);

            if (zonecheck[1].zc != "0") {
                console.log("Location not in zone");
                return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Location is not in the zone!' });
            }
        } catch (zoneError) {
            console.error("Zone processing error:", zoneError);
            return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Zone processing failed' });
        }

        let v_id;
        if (!mid || mid === "" || mid === null) {
            console.log("No mid provided, getting default vehicle");
            let vehicle_list = await DataFind(`SELECT id, image, name, description, bidding FROM tbl_vehicle WHERE status = '1' ORDER BY id LIMIT 1`);
            if (!vehicle_list || vehicle_list.length === 0) {
                console.log("No vehicles found");
                return res.status(200).json({ ResponseCode: 401, Result: false, message: 'No vehicles available' });
            }
            v_id = vehicle_list[0].id;
        } else {
            v_id = mid.toString(); // Convert to string safely
        }

        console.log("Using vehicle ID:", v_id);

        // Get zone IDs safely
        let zoneIds;
        try {
            let dzone = await AllFunction.ZoneData();
            let zonecheck = await AllFunction.CheckZone(convertzone, dzone.all_zone, dzone.zone_data);
            zoneIds = zonecheck[2].zid.join(',');
        } catch (error) {
            console.error("Error getting zone IDs:", error);
            zoneIds = "1"; // Fallback zone ID
        }

        console.log("Zone IDs:", zoneIds);

        const driver = await DataFind(`SELECT dr.id, COALESCE(ve.map_img, '') AS image, COALESCE(ve.name, '') AS name, COALESCE(ve.description, '') AS description,
                                        COALESCE(dr.latitude, '') AS latitude, COALESCE(dr.longitude, '') AS longitude
                                        FROM tbl_driver AS dr
                                        JOIN tbl_vehicle AS ve ON dr.vehicle = ve.id AND ve.id = '${v_id}'
                                        WHERE dr.zone IN (${zoneIds}) AND dr.fstatus = '1' AND dr.status = '1' AND dr.approval_status = '1' AND dr.latitude != '' AND dr.longitude != ''`);

        console.log("Found drivers:", driver?.length || 0);

        if (!driver || driver.length === 0) {
            console.log("No drivers found");
            return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Driver not found!', driverid: [], list: [] });
        }

        let list = [], point = { latitude: latitude, longitude: longitude }, driverid = [];

        for (let i = 0; i < driver.length; i++) {
            try {
                let dlotlon = {
                    latitude: parseFloat(driver[i].latitude),
                    longitude: parseFloat(driver[i].longitude)
                };

                if (isNaN(dlotlon.latitude) || isNaN(dlotlon.longitude)) {
                    console.log(`Invalid driver coordinates for driver ${driver[i].id}`);
                    continue;
                }

                let distance = await AllFunction.RadiusCheck(point, dlotlon, Number(parseFloat(general[0].vehicle_radius) * 1000));

                if (distance == 1) {
                    driverid.push(driver[i].id);
                    list.push(driver[i]);
                }
            } catch (driverError) {
                console.error(`Error processing driver ${driver[i].id}:`, driverError);
                continue;
            }
        }

        console.log("Final result:", {
            driversFound: list.length,
            driverIds: driverid.length
        });

        return res.status(200).json({
            ResponseCode: 200,
            Result: true,
            message: "Data Load successful",
            zone_id: zoneIds.split(',')[0],
            driverid,
            list
        });

    } catch (error) {
        console.error('HomeMap API Error Details:', {
            message: error.message,
            stack: error.stack,
            requestBody: req.body
        });

        res.status(500).json({
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Server error occurred'
        });
    }
});



router.post("/calculate", async (req, res) => {
    try {
        const { uid, mid, mrole, pickup_lat_lon, drop_lat_lon, drop_lat_lon_list } = req.body;

        console.log("🚀 API called with:", { uid, mid, mrole, pickup_lat_lon, drop_lat_lon });

        const missingField = ["uid", "mid", "mrole", "pickup_lat_lon", "drop_lat_lon"].find(field => !req.body[field]);
        if (missingField) {
            console.log("❌ Missing field:", missingField);
            return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });
        }

        if (mrole == "1") {
            console.log("🔍 Looking for vehicle ID:", mid);

            let vehicle = await DataFind(`SELECT * FROM tbl_vehicle WHERE status = '1' AND id = '${mid}'`);
            console.log("🚗 Vehicle result type:", typeof vehicle);
            console.log("🚗 Vehicle result:", vehicle);

            // Check different empty conditions
            if (vehicle == "") {
                console.log("❌ Vehicle check failed: vehicle == ''");
                return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Vehicle Not Found!' });
            }

            if (!vehicle) {
                console.log("❌ Vehicle check failed: !vehicle");
                return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Vehicle Not Found!' });
            }

            if (Array.isArray(vehicle) && vehicle.length === 0) {
                console.log("❌ Vehicle check failed: empty array");
                return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Vehicle Not Found!' });
            }

            console.log("✅ Vehicle found:", vehicle[0]?.name);

            let convertzone = await AllFunction.ZoneLatlon(pickup_lat_lon, drop_lat_lon, drop_lat_lon_list);
            console.log("📍 Converted zones:", convertzone);

            let dzone = await AllFunction.ZoneData();
            console.log("🗺️ Zone data length:", dzone.all_zone.length);

            let zonecheck = await AllFunction.CheckZone(convertzone, dzone.all_zone, dzone.zone_data);
            console.log("🎯 Zone check - outside zone count:", zonecheck[1].zc);

            const general = await DataFind(`SELECT * FROM tbl_general_settings`);
            console.log("⚙️ General settings type:", typeof general);

            if (general == "") {
                console.log("❌ General settings check failed: general == ''");
                return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });
            }

            console.log("✅ All initial checks passed - proceeding to zone validation");

            if (zonecheck[1].zc != "0") {
                console.log("❌ Address not in zone");
                return res.status(200).json({
                    ResponseCode: 401,
                    Result: false,
                    message: 'Address is not in the zone! calculate post',
                    offer_expire_time: general[0].offer_expire_time,
                    zoneresult: zonecheck[0].zr,
                    tot_km: 0,
                    drop_price: 0,
                    tot_hour: 0,
                    tot_minute: 0,
                    tot_second: 0,
                    driver_id: [],
                    vehicle: []
                });
            }

            console.log("🎉 SUCCESS: Address is in zone! Starting distance calculation...");

            // Return success for now to see if we reach this point
            return res.status(200).json({
                ResponseCode: 200,
                Result: true,
                message: 'Debug: Reached distance calculation phase',
                vehicle: vehicle[0],
                zone_info: {
                    total_zones: dzone.all_zone.length,
                    coordinates_checked: convertzone.length,
                    zone_results: zonecheck[0].zr
                }
            });
        }

        return res.status(200).json({ ResponseCode: 200, Result: true, message: "Non-vehicle mode successful" });
    } catch (error) {
        console.error("💥 API Error:", error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
});





router.post("/module_calculate", async (req, res) => {
    try {
        const { uid, mid, mrole, pickup_lat_lon, drop_lat_lon, drop_lat_lon_list } = req.body;

        const missingField = ["uid", 'mid', 'mrole', 'pickup_lat_lon', 'drop_lat_lon'].find(field => !req.body[field]);
        if (missingField) return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        let convertzone = await AllFunction.ZoneLatlon(pickup_lat_lon, drop_lat_lon, drop_lat_lon_list);

        let dzone = await AllFunction.ZoneData();
        let zonecheck = await AllFunction.CheckZone(convertzone, dzone.all_zone, dzone.zone_data);

        if (zonecheck[1].zc != "0") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Address is not in the zone! module_calculate' });

        const vehicle = await DataFind(`SELECT * FROM tbl_vehicle WHERE status = '1' AND bidding = '0'`);
        if (vehicle == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Vehicle Not Found!' });

        let zoneresult = zonecheck[0].zr, dhour = 0, dtime = 0;

        const general = await DataFind(`SELECT * FROM tbl_general_settings`);
        if (general == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        let cal = 0, hour = 0, time = 0, totmin = 0;
        for (let a = 1; a < zoneresult.length;) {

            let pickup = `${convertzone[a - 1].latitude},${convertzone[a - 1].longitude}`;
            let drop = `${convertzone[a].latitude},${convertzone[a].longitude}`;

            let distance = await AllFunction.GetDistance(pickup, drop, general[0].google_map_key);

            cal += parseFloat(distance.dis)

            let spltime = distance.dur.split(" ");
            if (spltime.length == "2") {
                dhour = 0; dtime = parseFloat(spltime[0]);
            } else if (spltime.length == "4") {
                dhour = parseFloat(spltime[0]); dtime = parseFloat(spltime[2]);
            }

            totmin += parseFloat(dhour) * 60 + parseFloat(dtime);
            hour += parseFloat(dhour); time += dtime;
            a++;
        }
        if (cal == "0") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        let hou_min = await AllFunction.MinuteToHour(totmin);

        let caldriver = [];
        for (let c = 0; c < vehicle.length;) {
            let drop_price, add_distance, veh = "", addtime = "";

            let vehcal = await Vehicle_calculate(0, 0, pickup_lat_lon, drop_lat_lon, drop_lat_lon_list, 2, convertzone, zonecheck, vehicle[c].id);

            if (vehcal != 3) {
                addtime = await AllFunction.AddDateMinute(parseFloat(vehcal.minkm) + parseFloat(totmin)); veh = vehcal.minkm;
            }

            if (cal <= vehicle[c].min_km_distance) {
                drop_price = parseFloat(cal) * parseFloat(vehicle[c].min_km_price);
            } else {
                add_distance = parseFloat(cal) - parseFloat(Number(vehicle[c].min_km_distance));
                drop_price = (parseFloat(vehicle[c].min_km_distance) * parseFloat(vehicle[c].min_km_price) + (parseFloat(add_distance) * parseFloat(vehicle[c].after_km_price)));
            }

            caldriver.push({
                ...vehicle[c], dri_pic_time: veh, dri_pic_drop: addtime, drop_price: parseFloat(parseFloat(drop_price).toFixed(2)), drop_hour: hou_min.hour, drop_time: hou_min.minute,
                drop_km: parseFloat(parseFloat(cal).toFixed(2))
            });
            c++;
        }

        return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Address calculate successful', caldriver });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})




async function Vehicle_calculate(uid, mid, pickup_lat_lon, drop_lat_lon, drop_lat_lon_list, status, czone, zcheck, vid) {
    let convertzone, zonecheck, v_id;

    if (status == 1) {
        convertzone = await AllFunction.ZoneLatlon(pickup_lat_lon, drop_lat_lon, drop_lat_lon_list);

        let dzone = await AllFunction.ZoneData();

        zonecheck = await AllFunction.CheckZone(convertzone, dzone.all_zone, dzone.zone_data);

        if (zonecheck[1].zc != "0") return 1;

        if (mid == "") {
            let vehicle_list = await DataFind(`SELECT id, image, name, description, bidding FROM tbl_vehicle WHERE status = '1'`);
            v_id = vehicle_list[0].id;
        } else v_id = mid;

    } else {
        convertzone = czone; zonecheck = zcheck; v_id = vid;
    }

    const general = await DataFind(`SELECT * FROM tbl_general_settings`);
    if (general == "") return 2;

    const driver = await DataFind(`SELECT dr.id, COALESCE(ve.map_img, '') AS image, COALESCE(ve.name, '') AS name, COALESCE(ve.description, '') AS description,
                                    COALESCE(dr.latitude, '') AS latitude, COALESCE(dr.longitude, '') AS longitude
                                    FROM tbl_driver AS dr
                                    JOIN tbl_vehicle AS ve ON dr.vehicle = ve.id
                                    WHERE dr.vehicle = '${v_id}'
                                    AND dr.latitude NOT IN ('') AND dr.longitude NOT IN ('')`);

    // // new
    // const driver = await DataFind(`SELECT dr.id, COALESCE(ve.map_img, '') AS image, COALESCE(ve.name, '') AS name, COALESCE(ve.description, '') AS description,
    //                                 COALESCE(dr.latitude, '') AS latitude, COALESCE(dr.longitude, '') AS longitude
    //                                 FROM tbl_driver AS dr
    //                                 JOIN tbl_vehicle AS ve ON dr.vehicle = ve.id
    //                                 WHERE dr.vehicle = '${v_id}' AND dr.zone IN (${zonecheck[2].zid}) AND dr.fstatus = '1' AND dr.status = '1' AND dr.approval_status = '1'
    //                                 AND dr.latitude NOT IN ('') AND dr.longitude NOT IN ('')`);

    // //
    // const driver = await DataFind(`SELECT dr.id, COALESCE(ve.map_img, '') AS image, COALESCE(ve.name, '') AS name, COALESCE(ve.description, '') AS description,
    //                                 COALESCE(dr.latitude, '') AS latitude, COALESCE(dr.longitude, '') AS longitude
    //                                 FROM tbl_driver AS dr
    //                                 JOIN tbl_vehicle AS ve ON dr.vehicle = ve.id
    //                                 WHERE dr.vehicle = '${v_id}' AND dr.zone IN (${zonecheck[2].zid}) AND dr.fstatus = '1' AND dr.status = '1' AND dr.approval_status = '1'
    //                                 AND dr.rid_status = '0' AND dr.latitude NOT IN ('') AND dr.longitude NOT IN ('')`);

    if (driver == "") return 3;

    let dkm = 0, dtime = 0;
    let cpickup = `${convertzone[0].latitude},${convertzone[0].longitude}`;
    let caldriver = [], driver_id = [], minkm = 0, point = { latitude: Number(convertzone[0].latitude), longitude: Number(convertzone[0].longitude) };
    for (let i = 0; i < driver.length;) {

        let dlotlon = { latitude: Number(driver[i].latitude), longitude: Number(driver[i].longitude) };
        let distance = await AllFunction.RadiusCheck(point, dlotlon, Number(parseFloat(general[0].vehicle_radius) * parseFloat(1000)));

        if (distance == 1) {

            if (status == "2") {

                let driverl = `${driver[i].latitude},${driver[i].longitude}`;
                let dstance = await AllFunction.GetDistance(driverl, cpickup, general[0].google_map_key);
                dkm = (Math.round(parseFloat(distance.dis)));

                let spltime = dstance.dur.split(" ");
                if (spltime.length == "2") dtime = parseFloat(spltime[0]);
                else dtime = (parseFloat(spltime[0]) * 60) + parseFloat(spltime[2]);

                if (minkm == 0) minkm = dtime;
                if (parseFloat(minkm) > parseFloat(dtime)) minkm = dtime;

            }
            driver_id.push(driver[i].id);
            caldriver.push({ id: driver[i].id, image: driver[i].image, name: driver[i].name, description: driver[i].description, latitude: driver[i].latitude, longitude: driver[i].longitude });
        }
        i++;
    }

    if (status == "1") return { driver_id, caldriver };
    else return { minkm: minkm, driver_id: driver_id };
}



router.post("/vehicle_calculate", async (req, res) => {
    try {
        const { uid, mid, pickup_lat_lon, drop_lat_lon, drop_lat_lon_list } = req.body;

        const missingField = ["uid", 'mid', 'pickup_lat_lon', 'drop_lat_lon'].find(field => !req.body[field]);
        if (missingField) return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        let caldata = await Vehicle_calculate(uid, mid, pickup_lat_lon, drop_lat_lon, drop_lat_lon_list, 1)
        if (caldata == "1") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Address is not in the zone! vehicle_calculate' });
        if (caldata == "2") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });
        if (caldata == "3") return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Driver not found!', driver_id: [], caldriver: [] });
        if (caldata == "4") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Vehicle Not Found!' });
        if (caldata == "5") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Address calculate successful', driver_id: caldata.driver_id, caldriver: caldata.caldriver });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post("/add_vehicle_request", async (req, res) => {
    try {
        const { uid, driverid, vehicle_id, price, tot_km, tot_hour, tot_minute, payment_id, m_role, coupon_id, bidd_auto_status, pickup, drop, droplist, pickupadd, dropadd, droplistadd } = req.body;

        const missingField = await AllFunction.CheckBodyData(req, ["uid", "driverid", "vehicle_id", "price", "tot_km", "tot_hour", "tot_minute", "payment_id", "m_role",
            "pickup", "drop", "pickupadd", "dropadd"]);
        if (missingField) return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        let convertz = await AllFunction.ZoneLatlon(pickup, drop, droplist), bid_d = [];

        let pic = "", dropdata = "", picadd = "", dropad = "", id = 0, alcount = 0, drocount = 2, senddataJson = JSON.stringify(driverid),
            tkm = parseFloat(parseFloat(tot_km).toFixed(2));

        for (let i = 0; i < convertz.length;) {
            if (i == "0") pic = convertz[i].latitude + "&!" + convertz[i].longitude
            else dropdata += dropdata == "" ? convertz[i].latitude + "&!" + convertz[i].longitude : "&!!" + convertz[i].latitude + "&!" + convertz[i].longitude;
            alcount++;
            i++;
        }

        picadd = pickupadd.title + "&!" + pickupadd.subt; dropad = dropadd.title + "&!" + dropadd.subt;
        if (droplistadd && droplistadd != "") {
            for (let a = 0; a < droplistadd.length;) {
                dropad += dropad == "" ? droplistadd[a].title + "&!" + droplistadd[a].subt : "&!!" + droplistadd[a].title + "&!" + droplistadd[a].subt;
                drocount++;
                a++;
            }
        }
        if (alcount != drocount) return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        const general = await DataFind(`SELECT default_payment FROM tbl_general_settings`);
        let payment = payment_id == "0" ? general[0].default_payment : payment_id;

        const data = await DataFind(`SELECT * FROM tbl_request_vehicle WHERE c_id = '${uid}'`);

        const vehicle_list = await DataFind(`SELECT * FROM tbl_vehicle WHERE id = '${vehicle_id}' AND status = '1'`);

        for (let i = 0; i < driverid.length;) {
            sendOneNotification("New ride request received! Ready to go!", 'driver', driverid[i]);
            i++;
        }

        let date = new Date().toISOString(), bidd_auto_st = bidd_auto_status == "true" ? '1' : '0';

        id = await DataInsert(`tbl_request_vehicle`, `c_id, d_id, bidding_d_price, bidding_status, bidd_auto_status, pic_lat_long, drop_lat_long, pic_address, drop_address, price,
            tot_km, tot_hour, tot_minute, vehicleid, payment_id, status, status_time_location, m_role, coupon_id, start_time`,
            `'${uid}', '${senddataJson}', '', '${vehicle_list[0].bidding}', '${bidd_auto_st}', '${pic}', '${dropdata}', '${picadd}', '${dropad}', '${price}',
            '${tkm}', '${tot_hour}', '${tot_minute}', '${vehicle_id}', '${payment}', '0', '', '${m_role}', '${coupon_id}', '${date}'`, req.hostname, req.protocol);

        if (id == -1) return res.status(200).json({ ResponseCode: 401, Result: false, message: process.env.dataerror });
        return res.status(200).json({ ResponseCode: 200, Result: true, message: `We’ve sent ${driverid.length} captain requests; they’ll confirm shortly.`, id: id.insertId });


    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

router.get("/vehicle_cancel_reason", async (req, res) => {
    try {
        const ride_cancel_list = await DataFind(`SELECT id, title FROM tbl_ride_cancel_reason WHERE status = '1'`);

        return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Data Load Successful', ride_cancel_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

router.get("/review_data", async (req, res) => {
    try {
        const review_list = await DataFind(`SELECT * FROM tbl_ride_review_reason WHERE status = '1'`);

        return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Data Load Successful', review_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

router.post("/vehicle_live_location", async (req, res) => {
    try {
        const { uid, d_id } = req.body;

        if (!uid || !d_id) return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        const data = await DataFind(`SELECT * FROM tbl_cart_vehicle WHERE c_id = '${uid}' AND d_id = '${d_id}'`);
        if (data == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Request Not Found!' });

        const driver = await DataFind(`SELECT dr.id, COALESCE(ve.map_img, '') AS image, COALESCE(ve.name, '') AS name, COALESCE(ve.description, '') AS description,
                                        COALESCE(dr.latitude, '') AS latitude, COALESCE(dr.longitude, '') AS longitude
                                        FROM tbl_driver AS dr
                                        JOIN tbl_vehicle AS ve ON dr.vehicle = ve.id AND ve.id = dr.vehicle
                                        WHERE dr.id = '${data[0].d_id}' AND dr.fstatus = '1' AND dr.status = '1' AND dr.approval_status = '1' AND dr.latitude NOT IN ('') AND dr.longitude NOT IN ('')`);

        return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Data Load Successful', driver_location: driver[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

router.post("/timeout_vehicle_request", async (req, res) => {
    try {
        const { request_id, uid } = req.body;

        if (!request_id || !uid) return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        const data = await DataFind(`SELECT * FROM tbl_request_vehicle WHERE c_id = '${uid}'`);
        if (data == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Request Not Found!' });

        if (await DataUpdate(`tbl_request_vehicle`, `d_id = '[]', status = '0'`, `c_id = '${uid}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result: false, message: process.env.dataerror });
        }

        let array = data[0].d_id
        if (typeof array == "string") array = JSON.parse(array);

        return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Request Out successful', id: data[0].id, driverid: array });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

router.post("/resend_vehicle_request", async (req, res) => {
    try {
        const { uid, driverid } = req.body;

        if (!uid || !driverid) return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        const data = await DataFind(`SELECT * FROM tbl_request_vehicle WHERE c_id = '${uid}'`);
        if (data == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Request Not Found!' });

        let pl = data[0].pic_lat_long.split("&!"), dl = data[0].drop_lat_long.split("&!!"), drop_lat_lon = "", drop_lat_lon_list = []
        for (let i = 0; i < dl.length;) {
            let dspl = dl[i].split("&!");
            if (i == "0") drop_lat_lon = `${dspl[0]},${dspl[1]}`;
            else {
                drop_lat_lon_list.push({ "lat": dspl[0], "long": dspl[1] });
            }
            i++;
        }

        let caldata = await Vehicle_calculate(uid, data[0].vehicleid, `${pl[0]},${pl[1]}`, drop_lat_lon, drop_lat_lon_list, 1);
        if (caldata == "1") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Address is not in the zone! resend_vehicle_request' });
        if (caldata == "2") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });
        if (caldata == "3") return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Driver not found!', driver_id: [], caldriver: [] });
        if (caldata == "4") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Vehicle Not Found!' });
        if (caldata == "5") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        let d_id = caldata.driver_id, senddataJson;
        if (typeof d_id == "string") {
            d_id = JSON.parse(d_id);
            senddataJson = JSON.stringify(d_id);
        } else senddataJson = JSON.stringify(d_id);

        if (await DataUpdate(`tbl_request_vehicle`, `d_id = '${senddataJson}', bidding_d_price = '', status = '0'`, `c_id = '${uid}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result: false, message: process.env.dataerror });
        }
        return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Request Resend successful', id: data[0].id, driver_list: JSON.parse(senddataJson) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

router.post("/remove_vehicle_request", async (req, res) => {
    try {
        const { uid } = req.body;

        if (!uid) return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        const data = await DataFind(`SELECT * FROM tbl_request_vehicle WHERE c_id = '${uid}'`);
        if (data == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Request Not Found!' });

        if (await DataDelete(`tbl_request_vehicle`, `c_id = '${uid}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result: false, message: process.env.dataerror });
        }

        let array = data[0].d_id;
        if (typeof array == "string") array = JSON.parse(array);

        return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Request Cancel successful', id: data[0].id, driver_list: array });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

router.post("/vehicle_ride_cancel", async (req, res) => {
    try {
        const { uid, request_id, cancel_id, lat, lon } = req.body;
        if (!uid || !request_id || !cancel_id || !lat || !lon) return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        let rd, indata, fulldate = await AllFunction.TodatDate(), status = "3", driver_list = [];
        rd = await DataFind(`SELECT * FROM tbl_request_vehicle WHERE id = '${request_id}' AND c_id = '${uid}'`);

        if (rd == "") {

            rd = await DataFind(`SELECT * FROM tbl_cart_vehicle WHERE id = '${request_id}' AND c_id = '${uid}'`);
            if (rd == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Request Not Found!' });

            let updatet = rd[0].status_time_location != "" ? `${rd[0].status_time_location}&!!${status}&${fulldate.date}T${fulldate.time}&${lat}&${lon}` :
                `${status}&${fulldate.date}T${fulldate.time}&${lat}&${lon}`;

            let espiadd = mysql.escape(rd[0].pic_address), esdroadd = mysql.escape(rd[0].drop_address);
            driver_list = [parseFloat(rd[0].d_id)];

            let setime = rd[0].status_time_location.split("&!!"), starttime = "";

            let stime = setime[0].split("&"), etime = new Date().toISOString();
            if (stime[0] == "1") starttime = await AllFunction.TodatDate(stime[1]);

            indata = await DataInsert(`tbl_order_vehicle`, `c_id, d_id, vehicleid, bidding_status, bidd_auto_status, paid_status, price, final_price, paid_amount, coupon_amount, addi_time_price, platform_fee,
                weather_price, wallet_price, tot_km, tot_hour, tot_minute, status, payment_id, m_role, coupon_id, additional_time, ride_status, start_time, end_time, drop_tot,
                drop_complete, current_run_time, status_time, status_time_location, status_calculation, pic_lat_long, drop_lat_long, pic_address, drop_address, payment_img,
                cancel_reason, req_id`,
                `'${rd[0].c_id}', '${rd[0].d_id}', '${rd[0].vehicleid}', '${rd[0].bidding_status}', '${rd[0].bidd_auto_status}', '0', '${rd[0].price}', '${rd[0].final_price}', '0', '${rd[0].coupon_amount}', '${rd[0].addi_time_price}',
                '${rd[0].platform_fee}', '${rd[0].weather_price}', '0', '${rd[0].tot_km}', '${rd[0].tot_hour}', '${rd[0].tot_minute}', '4', '', '${rd[0].m_role}',
                '${rd[0].coupon_id}', '${rd[0].additional_time}', '${rd[0].ride_status}', '${stime[1]}', '${etime}', '${rd[0].drop_tot}', '${rd[0].drop_complete}', '${rd[0].current_run_time}',
                '${rd[0].status_time}', '${updatet}', '', '${rd[0].pic_lat_long}', '${rd[0].drop_lat_long}', ${espiadd}, ${esdroadd}, '', '${cancel_id}', '${rd[0].id}'`,
                req.hostname, req.protocol);

            if (indata == -1) return res.status(200).json({ ResponseCode: 401, Result: false, message: process.env.dataerror });

            if (await DataDelete(`tbl_cart_vehicle`, `id = '${rd[0].id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result: false, message: process.env.dataerror });
            }

            if (await DataUpdate(`tbl_driver`, `rid_status = '0' AND check_status = '0'`, `id = '${rd[0].d_id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result: false, message: process.env.dataerror });
            }

        } else {

            let updatet = rd[0].status_time_location != "" ? `${rd[0].status_time_location}&!!${status}&${fulldate.date}T${fulldate.time}&${lat}&${lon}` :
                `${status}&${fulldate.date}T${fulldate.time}&${lat}&${lon}`;

            let dropcount = rd[0].drop_lat_long.split("&!!").length, espiadd = mysql.escape(rd[0].pic_address), esdroadd = mysql.escape(rd[0].drop_address)
            driver_list = rd[0].d_id;
            if (typeof rd[0].d_id == "string") driver_list = JSON.parse(rd[0].d_id);

            indata = await DataInsert(`tbl_order_vehicle`, `c_id, d_id, vehicleid, bidding_status, bidd_auto_status, paid_status, price, final_price, paid_amount, coupon_amount,
                addi_time_price, platform_fee, weather_price, wallet_price, tot_km, tot_hour, tot_minute, status, payment_id, m_role, coupon_id, additional_time, ride_status,
                start_time, end_time, drop_tot, drop_complete, current_run_time, status_time, status_time_location, status_calculation, pic_lat_long, drop_lat_long, pic_address,
                drop_address, payment_img, cancel_reason, req_id`,
                `'${rd[0].c_id}', '${rd[0].d_id}', '${rd[0].vehicleid}', '${rd[0].bidding_status}', '${rd[0].bidd_auto_status}', '0', '${rd[0].price}', '0', '0', '0', '0', '0', '0',
                '0', '${rd[0].tot_km}', '${rd[0].tot_hour}', '${rd[0].tot_minute}', '4', '${rd[0].payment_id}', '${rd[0].m_role}', '', '${rd[0].additional_time}', '0', '', '',
                '${dropcount}', '' , '', '', '${updatet}', '', '${rd[0].pic_lat_long}', '${rd[0].drop_lat_long}', ${espiadd}, ${esdroadd}, '', '${cancel_id}', '${rd[0].id}'`,
                req.hostname, req.protocol);

            if (indata == -1) return res.status(200).json({ ResponseCode: 401, Result: false, message: process.env.dataerror });

            if (await DataDelete(`tbl_request_vehicle`, `id = '${rd[0].id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result: false, message: process.env.dataerror });
            }
        }

        return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Request Cancel successful', driverid: driver_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})


router.post("/vehicle_ride_addstatus", async (req, res) => {
    try {
        const { uid, d_id, request_id } = req.body;
        if (!uid || !d_id || !request_id) return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        const rd = await DataFind(`SELECT * FROM tbl_cart_vehicle WHERE id = '${request_id}' AND c_id = '${uid}' AND d_id = '${d_id}'`);
        if (rd == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Request Not Found!' });

        if (rd[0].status == "3") {
            if (rd[0].ride_status != "0") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Please Complete Other Stap!' });
        } else if (rd[0].status == "6") {
            if (rd[0].ride_status != "6") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Please Complete Other Stap!' });
        }
        if (rd[0].status == "0" || rd[0].status == "1" || rd[0].status == "2" || rd[0].status == "4" || rd[0].status == "5" || rd[0].status == "7" || rd[0].status == "8") {
            return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Please Complete Other Stap!' });
        }

        let dlatlon = rd[0].drop_lat_long.split("&!!"), daddress = rd[0].drop_address.split("&!!"), pending_ride = "", drop_list = [];

        if (rd[0].drop_complete == "") pending_ride = 0;
        else pending_ride = parseFloat(rd[0].drop_complete) + 1;

        let ccheck = await AllFunction.CheckCurrentLocation(pending_ride, dlatlon, daddress);

        for (let i = 0; i < dlatlon.length;) {
            let checkadd = daddress[i].split("&!"), checkl = dlatlon[i].split("&!"), status = "";

            if (pending_ride == i) status = "2";
            if (pending_ride > i) status = "3";
            if (pending_ride < i) status = "1";

            drop_list.push({ status: status, title: checkadd[0], subtitle: checkadd[1], latitude: checkl[0], longitude: checkl[1] });
            i++;
        }

        return res.status(200).json({
            ResponseCode: 200, Result: true, message: "Service Start Successful", current_address: ccheck.current_address,
            next_address: ccheck.next_address, drop_list
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})





router.post("/vehicle_driver_detail", async (req, res) => {
    try {
        const { uid, d_id, request_id } = req.body;

        if (!uid || !d_id) return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        let dr = await AllFunction.DriverReview("cve");
        let rd = await DataFind(`SELECT cve.id, cve.c_id, cve.d_id, cve.price, cve.tot_km, cve.status, cve.otp, cve.tot_hour, cve.tot_minute,
                                COALESCE(dr.profile_image, "") AS profile_image, COALESCE(dr.vehicle_image, "") AS vehicle_image, COALESCE(dr.first_name, "") AS first_name,
                                COALESCE(dr.last_name, "") AS last_name, COALESCE(dr.primary_ccode, "") AS primary_ccode, COALESCE(dr.primary_phoneNo, "") AS primary_phoneNo,
                                COALESCE(dr.language, "") AS language, COALESCE(dr.vehicle_number, "") AS vehicle_number, COALESCE(dr.car_color, "") AS car_color,
                                COALESCE(dr.passenger_capacity, "") AS passenger_capacity, COALESCE(GROUP_CONCAT(DISTINCT vr.name SEPARATOR ','), '') AS prefrence_name,
                                COALESCE(dr.date, "") AS join_date, COALESCE(dr.latitude, "") AS latitude, COALESCE(dr.longitude, "") AS longitude, COALESCE(vec.map_img, "") AS map_img,
                                COALESCE(vec.name, "") AS car_name
                                ${dr.tot_review} ${dr.avgstar}, COALESCE(COUNT(DISTINCT ov.id), 0) AS tot_complete_order
                                FROM tbl_cart_vehicle AS cve
                                JOIN tbl_driver AS dr ON cve.d_id = dr.id
                                JOIN tbl_vehicle AS vec ON dr.vehicle = vec.id
                                LEFT JOIN tbl_vehicle_preference AS vr ON FIND_IN_SET(vr.id, dr.vehicle_prefrence) > 0
                                LEFT JOIN tbl_order_vehicle AS ov ON cve.d_id = ov.d_id
                                ${dr.table}
                                WHERE ${request_id != "" ? `cve.id = '${request_id}' AND` : ``}  cve.c_id = '${uid}' AND cve.d_id = '${d_id}' GROUP BY cve.id`);

        if (rd != "") {
            rd[0].rating = parseFloat(rd[0].avg_star); rd[0].tot_review = parseFloat(rd[0].tot_review); rd[0].tot_hour = parseFloat(rd[0].tot_hour); rd[0].tot_minute = parseFloat(rd[0].tot_minute)
            delete rd[0].avg_star
            return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Driver Data Load Successful', accepted_d_detail: rd[0] });
        } else {
            return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Data Not Found!', accepted_d_detail: [] });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.post("/driver_profile_detail", async (req, res) => {
    try {
        const { d_id } = req.body;
        if (!d_id) return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        let dr = await AllFunction.DriverReview("dr");
        let rd = await DataFind(`SELECT dr.profile_image, dr.vehicle_image, dr.first_name, dr.last_name, dr.primary_ccode, dr.primary_phoneNo, dr.language, dr.vehicle_number, dr.car_color,
                                dr.passenger_capacity, dr.date AS join_date,
                                COALESCE(GROUP_CONCAT(DISTINCT vr.name SEPARATOR ','), '') AS prefrence_name, COALESCE(vec.name, "") AS car_name
                                ${dr.tot_review} ${dr.avgstar}, COALESCE(COUNT(DISTINCT ov.id), 0) AS tot_complete_order
                                FROM tbl_driver AS dr
                                JOIN tbl_vehicle AS vec ON dr.vehicle = vec.id
                                LEFT JOIN tbl_vehicle_preference AS vr ON FIND_IN_SET(vr.id, dr.vehicle_prefrence) > 0
                                LEFT JOIN tbl_order_vehicle AS ov ON dr.id = dr.id
                                ${dr.outtable}
                                WHERE dr.id = '${d_id}' GROUP BY dr.id`);

        if (rd != "") {
            rd[0].rating = parseFloat(rd[0].avg_star); rd[0].tot_review = parseFloat(rd[0].tot_review);
            delete rd[0].avg_star
            return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Driver Data Load Successful', d_detail: rd[0] });
        } else {
            return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Data Not Found!', d_detail: [] });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})





router.post("/vehicle_ride_complete", upload.single('payment_img'), async (req, res) => {
    try {
        const { uid, d_id, request_id, wallet, payment_id } = req.body;
        if (!uid || !d_id || !request_id || !wallet) return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        const rd = await DataFind(`SELECT * FROM tbl_cart_vehicle WHERE c_id = '${uid}' AND d_id = '${d_id}'`);

        const dr = await DataFind(`SELECT * FROM tbl_driver WHERE id = '${rd[0].d_id}'`);
        if (rd == "" || dr == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Request Not Found!' });
        if (parseFloat(rd[0].status) < 7) return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Please Complete Other Step!' });

        const customer = await DataFind(`SELECT * FROM tbl_customer WHERE status = 1 AND id = '${uid}'`);
        if (customer == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Customer not found!' });

        let espiadd = mysql.escape(rd[0].pic_address), esdroadd = mysql.escape(rd[0].drop_address);

        let setime = rd[0].status_time_location.split("&!!"), starttime = "", end_time = "", imageUrl = "", paid_amount = 0, paid_status = 0
        let stime = setime[0].split("&"), etime = setime[setime.length - 1].split("&");

        if (rd[0].payment_id == "10" || rd[0].payment_id == "11") {

            if (!req.file) return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Please Upload Image!' });
            imageUrl = req.file ? "uploads/payment_proof/" + req.file.filename : null;
        }

        paid_amount = 0; paid_status = 1, fullwallet = parseFloat(dr[0].wallet), cash = 0, tot_cash = 0, payout_wallet = 0, fulldate = await AllFunction.TodatDate();

        const nwallet_amount = parseFloat((parseFloat(rd[0].price) + parseFloat(rd[0].addi_time_price) + parseFloat(rd[0].weather_price)).toFixed(2));

        if (parseFloat(wallet) != 0) {
            if (parseFloat(rd[0].final_price) > parseFloat(wallet)) {
                paid_amount = parseFloat((parseFloat(rd[0].final_price) - parseFloat(wallet)).toFixed(2));

                if (parseFloat(rd[0].platform_fee) > parseFloat(paid_amount) && payment_id == "9") {
                    cash = parseFloat((parseFloat(rd[0].platform_fee) - parseFloat(paid_amount)).toFixed(2));
                }
            }

            let cdata = customer[0].wallet, wamount = 0;
            if (cdata || cdata != "0" || cdata != "NaN") wamount = cdata;
            let wallet_amount = parseFloat((parseFloat(wamount) - parseFloat(wallet)).toFixed(2));

            if (await DataUpdate(`tbl_customer`, `wallet = '${wallet_amount}'`, `id = '${uid}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result: false, message: process.env.dataerror });
            }

            if (payment_id == "9") {
                fullwallet = parseFloat((parseFloat(dr[0].wallet) + parseFloat(nwallet_amount)).toFixed(2));
                payout_wallet = parseFloat((parseFloat(dr[0].payout_wallet) + parseFloat(wallet)).toFixed(2));
            }

        } else {
            paid_amount = parseFloat(rd[0].final_price);
            if (payment_id != "9") fullwallet = parseFloat((parseFloat(dr[0].wallet) + parseFloat(nwallet_amount)).toFixed(2));
        }

        if (payment_id == "9") {
            if (wallet == 0) payout_wallet = parseFloat(dr[0].payout_wallet);
            if (cash == 0) tot_cash = parseFloat((parseFloat(dr[0].tot_cash) + parseFloat(rd[0].platform_fee)).toFixed(2));
            else tot_cash = parseFloat((parseFloat(dr[0].tot_cash) + parseFloat(cash)).toFixed(2));
        } else {
            payout_wallet = parseFloat((parseFloat(dr[0].payout_wallet) + parseFloat(nwallet_amount)).toFixed(2));
            tot_cash = parseFloat(dr[0].tot_cash);
        }

        if (await DataUpdate(`tbl_driver`, `wallet = '${fullwallet}', payout_wallet = '${payout_wallet}', tot_cash = '${tot_cash}', rid_status = '0' AND check_status = '0'`,
            `id = '${rd[0].d_id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result: false, message: process.env.dataerror });
        }

        let updatet = rd[0].status_time_location != "" ? `${rd[0].status_time_location}&!!8&${fulldate.date}T${fulldate.time}&0&0` :
            `8&${fulldate.date}T${fulldate.time}&0&0`;

        let insertid = await DataInsert(`tbl_order_vehicle`, `c_id, d_id, vehicleid, bidding_status, bidd_auto_status, paid_status, price, final_price, paid_amount, coupon_amount,
            addi_time_price, platform_fee, weather_price, wallet_price, tot_km, tot_hour, tot_minute, status, payment_id, m_role, coupon_id, additional_time, ride_status, start_time,
            end_time, drop_tot, drop_complete, current_run_time, status_time, status_time_location, status_calculation, pic_lat_long, drop_lat_long, pic_address, drop_address,
            payment_img, cancel_reason, req_id`,
            `'${rd[0].c_id}', '${rd[0].d_id}', '${rd[0].vehicleid}', '${rd[0].bidding_status}', '${rd[0].bidd_auto_status}', '${paid_status}', '${rd[0].price}', '${rd[0].final_price}',
            '${paid_amount}', '${rd[0].coupon_amount}', '${rd[0].addi_time_price}', '${rd[0].platform_fee}', '${rd[0].weather_price}', '${wallet}', '${rd[0].tot_km}', '${rd[0].tot_hour}',
            '${rd[0].tot_minute}', '8', '${payment_id}', '${rd[0].m_role}', '${rd[0].coupon_id}', '${rd[0].additional_time}', '${rd[0].ride_status}', '${stime[1]}', '${etime[1]}',
            '${rd[0].drop_tot}', '${rd[0].drop_complete}', '${rd[0].current_run_time}', '${rd[0].status_time}', '${updatet}', '${rd[0].status_calculation}',
            '${rd[0].pic_lat_long}', '${rd[0].drop_lat_long}', ${espiadd}, ${esdroadd}, '${imageUrl}', '', '${rd[0].id}'`, req.hostname, req.protocol);

        if (insertid == -1) return res.status(200).json({ ResponseCode: 401, Result: false, message: process.env.dataerror });

        if (await DataDelete(`tbl_cart_vehicle`, `id = '${rd[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result: false, message: process.env.dataerror });
        }

        if (parseFloat(wallet) != 0) {
            if (await DataInsert(`tbl_transaction_customer`, `c_id, payment_id, amount, date, status, type`,
                `${uid}, '${rd[0].payment_id}', '${wallet}', '${fulldate.date}T${fulldate.time}', '2', '${insertid.insertId}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result: false, message: process.env.dataerror });
            }
        }

        if (await DataInsert(`tbl_transaction_driver`, `d_id, payment_id, amount, date, status, type`,
            `${rd[0].d_id}, '${insertid.insertId}', '${nwallet_amount}', '${fulldate.date}T${fulldate.time}', '1', ''`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result: false, message: process.env.dataerror });
        }

        const chat = await DataFind(`SELECT * FROM tbl_chat
                                WHERE (sender_id = '${rd[0].c_id}' AND resiver_id = '${rd[0].d_id}') OR (sender_id = '${rd[0].d_id}' AND resiver_id = '${rd[0].c_id}')`);

        for (let i = 0; i < chat.length;) {
            const emessage = mysql.escape(chat[i].message);
            if (await DataInsert(`tbl_chat_save`, `sender_id, resiver_id, date, message`, `'${chat[i].sender_id}', '${chat[i].resiver_id}', '${chat[i].date}', ${emessage}`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result: false, message: process.env.dataerror });
            }
            i++
        }

        if (await DataDelete(`tbl_chat`, `(sender_id = '${rd[0].c_id}' AND resiver_id = '${rd[0].d_id}') OR (sender_id = '${rd[0].d_id}' AND resiver_id = '${rd[0].c_id}')`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result: false, message: process.env.dataerror });
        }

        const review_list = await DataFind(`SELECT * FROM tbl_ride_review_reason WHERE status = '1'`);

        return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Ride Complete Successful', request_id: insertid.insertId, review_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

router.post("/tbl_review", async (req, res) => {
    try {
        const { uid, d_id, request_id, def_review, review, tot_star } = req.body;
        if (!uid || !d_id || !request_id || !tot_star) return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        const rd = await DataFind(`SELECT * FROM tbl_order_vehicle WHERE id = '${request_id}' AND c_id = '${uid}' AND d_id = '${d_id}'`);
        if (rd == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Request Not Found!' });

        const revi = await DataFind(`SELECT * FROM tbl_review_driver WHERE request_id = '${rd[0].id}' AND customer_id = '${uid}' AND driver_id = '${d_id}'`);
        if (revi != "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Review Found!' });

        let esreview = mysql.escape(review), fulldate = new Date().toISOString();
        if (await DataInsert(`tbl_review_driver`, `driver_id, customer_id, request_id, def_review, review, tot_star, date`,
            `'${d_id}', '${uid}', '${rd[0].id}', '${def_review}', ${esreview}, '${tot_star}', '${fulldate}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result: false, message: process.env.dataerror });
        }
        return res.status(200).json({ ResponseCode: 200, Result: true, message: "Review Add Successful" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





async function JsonConvert(idlist) {
    let d_id_list = []
    if (idlist) {
        if (typeof idlist == "string") {
            d_id_list = JSON.parse(idlist);
        } else d_id_list = idlist
    }
    return { d_id_list }
}

async function AllServiceData(status, where, tblname, field, otp) {
    let data = [];
    if (status == "1") {
        data = await DataFind(`SELECT cv.id, cv.d_id, cv.price, cv.status, cv.tot_hour, cv.tot_minute, cv.status_time_location, cv.pic_lat_long, cv.drop_lat_long, cv.pic_address,
                                cv.drop_address, cv.m_role, COALESCE(vd.name, '') AS vehicle_name, COALESCE(pd.name, '') AS p_name
                                FROM ${tblname} AS cv
                                JOIN tbl_payment_detail AS pd ON cv.payment_id = pd.id
                                JOIN tbl_vehicle AS vd ON cv.vehicleid = vd.id
                                ${where} ORDER BY id DESC`);
    } else {
        let dr = await AllFunction.DriverReview("cv");

        data = await DataFind(`SELECT cv.id, cv.d_id, cv.price, cv.status, cv.price, cv.final_price, cv.paid_amount, cv.coupon_amount, cv.addi_time_price, cv.platform_fee,
                                cv.weather_price, cv.wallet_price, cv.additional_time, cv.tot_hour, cv.tot_minute, cv.coupon_id, cv.status_time_location, cv.pic_lat_long,
                                cv.drop_lat_long, cv.pic_address, cv.drop_address, cv.m_role, cv.current_run_time, COALESCE(vd.name, '') AS vehicle_name, COALESCE(pd.name, '') AS p_name,
                                COALESCE(dr.profile_image, "") AS profile_image, COALESCE(dr.vehicle_image, "") AS vehicle_image, COALESCE(dr.first_name, "") AS first_name,
                                COALESCE(dr.last_name, "") AS last_name, COALESCE(dr.primary_ccode, "") AS primary_ccode, COALESCE(dr.primary_phoneNo, "") AS primary_phoneNo,
                                COALESCE(dr.language, "") AS language, COALESCE(dr.vehicle_number, "") AS vehicle_number, COALESCE(dr.car_color, "") AS car_color
                                ${dr.tot_review}, COALESCE(vd.comission_rate, '') AS comission_rate,
                                COALESCE(vd.comission_type, '') AS comission_type
                                ${dr.avgstar} ${field} ${otp}, COALESCE(dr.latitude, '') AS latitude, COALESCE(dr.longitude, '') AS longitude, COALESCE(vd.map_img, '') AS map_img
                                FROM ${tblname} AS cv
                                LEFT JOIN tbl_payment_detail AS pd ON cv.payment_id = pd.id
                                LEFT JOIN tbl_vehicle AS vd ON cv.vehicleid = vd.id
                                LEFT JOIN tbl_driver AS dr ON cv.d_id = dr.id
                                ${dr.table}
                                ${where} GROUP BY cv.id, vd.name, pd.name, dr.id ORDER BY id DESC`);
    }
    return data
}

router.post("/all_service_request", async (req, res) => {
    try {
        const { uid, status } = req.body;
        if (!uid) return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        const customer = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${uid}'`);
        if (customer == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Customer Not Found!' });

        const general = await DataFind(`SELECT driver_wait_time FROM tbl_general_settings`);
        if (general == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        let Reuqest_list = [], totrequest = [];

        if (status == "upcoming") {
            let pen_req_request = await AllServiceData(1, `WHERE cv.c_id = '${uid}'`, `tbl_request_vehicle`, 0);

            let first_list = pen_req_request.map(async (val) => {
                let idlist = await JsonConvert(val.d_id);
                val.driver_id_list = idlist ? idlist.d_id_list : []; val.d_id = "0";

                let otherdata = {
                    "final_price": 0, "paid_amount": 0, "coupon_amount": 0, "addi_time_price": 0, "platform_fee": 0, "weather_price": 0, "wallet_price": 0,
                    "additional_time": 0, "coupon_id": "", "current_run_time": "", "profile_image": "", "vehicle_image": "", "first_name": "", "last_name": "", "primary_ccode": "",
                    "primary_phoneNo": "", "language": "", "vehicle_number": "", "car_color": "", "tot_review": 0, "comission_rate": "", "comission_type": "", "avg_star": 0.0, "otp": "",
                    "latitude": "", "longitude": "", "map_img": ""
                }
                val = { ...val, ...otherdata };
                return val;
            });
            let flist = await Promise.all(first_list);

            let pen_card_request = await AllServiceData(2, `WHERE cv.c_id = '${uid}'`, `tbl_cart_vehicle`, ', cv.driver_id_list', ', cv.otp');

            let secound_list = pen_card_request.map(async (val) => {
                let idlist = await JsonConvert(val.driver_id_list);
                val.driver_id_list = idlist ? idlist.d_id_list : [];
                return val;
            })
            let slist = await Promise.all(secound_list);

            totrequest = flist.concat(slist);

        } else if (status == "completed") totrequest = await AllServiceData(2, `WHERE cv.c_id = '${uid}' AND cv.status = '8'`, `tbl_order_vehicle`, '', '');
        else if (status == "cancelled") totrequest = await AllServiceData(2, `WHERE cv.c_id = '${uid}' AND cv.status = '4'`, `tbl_order_vehicle`, '', '');

        if (status == "completed" || status == "cancelled") {
            let com_list = totrequest.map(async (val) => {
                val.driver_id_list = []; val.otp = "";
                return val
            })
            let slist = await Promise.all(com_list);
            totrequest = slist
        }

        if (totrequest != "") {
            Reuqest_list = await AllFunction.AllVehicleFormate(totrequest, 1);

            return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Data Load Successful', driver_wait_time: parseFloat(general[0].driver_wait_time), Reuqest_list: Reuqest_list });
        } else {
            return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Request Not Found!', driver_wait_time: parseFloat(general[0].driver_wait_time), Reuqest_list: [] });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





router.post("/all_ride_detail", async (req, res) => {
    try {
        const { uid, request_id, status } = req.body;
        if (!uid || !request_id || !status) return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });
        let Reuqest_list = [], review_check = 0;

        if (status == "complete") {

            let mapdata = await DataFind(`SELECT cv.id, cv.c_id, cv.d_id, cv.price, cv.final_price, cv.paid_amount, cv.coupon_amount, cv.addi_time_price, cv.platform_fee, cv.weather_price,
                                        cv.wallet_price, cv.additional_time, cv.status, cv.tot_km, cv.tot_hour, cv.tot_minute, cv.status_time_location, cv.pic_lat_long, cv.drop_lat_long,
                                        cv.pic_address, cv.drop_address, cv.m_role, cv.coupon_id, COALESCE(vd.name, '') AS vehicle_name, COALESCE(vd.comission_rate, '') AS comission_rate,
                                        COALESCE(vd.comission_type, '') AS comission_type, COALESCE(dr.profile_image, '') AS profile_image,
                                        COALESCE(pd.image, '') AS p_image, COALESCE(pd.name, '') AS p_name,
                                        CASE WHEN COUNT(revi.id) > 0 THEN '1' ELSE '0' END AS review_check
                                        FROM tbl_order_vehicle AS cv
                                        LEFT JOIN tbl_driver AS dr ON cv.d_id = dr.id
                                        LEFT JOIN tbl_payment_detail AS pd ON cv.payment_id = pd.id
                                        LEFT JOIN tbl_vehicle AS vd ON cv.vehicleid = vd.id
                                        LEFT JOIN tbl_review_driver AS revi ON cv.d_id = revi.driver_id AND cv.c_id = revi.customer_id AND cv.id = revi.request_id
                                        WHERE cv.id = '${request_id}' AND cv.c_id = '${uid}' AND cv.status NOT IN ('4')
                                        GROUP BY cv.id ORDER BY cv.id DESC;`);

            if (mapdata != "") {
                const review = await DataFind(`SELECT * FROM tbl_review_driver WHERE request_id = '${mapdata[0].id}' AND driver_id = '${mapdata[0].d_id}' AND
                                                customer_id = '${mapdata[0].c_id}'`);
                if (review != "") review_check = 1;
                mapdata[0].c_title = ""; mapdata[0].addi_time = parseFloat(mapdata[0].additional_time);

                mapdata[0].price = parseFloat(mapdata[0].price); mapdata[0].tot_km = parseFloat(mapdata[0].tot_km); mapdata[0].review_check = review_check; mapdata[0].review_check = review_check;
                Reuqest_list = await AllFunction.AllVehicleFormate(mapdata, 2);

                delete Reuqest_list[0].tot_drop; delete Reuqest_list[0].comission_rate; delete Reuqest_list[0].comission_type; delete Reuqest_list[0].additional_time;
                return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Data Load Successful', Reuqest_list: Reuqest_list[0] });
            } else {
                return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Request Not Found!', Reuqest_list: [] });
            }
        }

        if (status == "cancel") {
            let mapdata = await DataFind(`SELECT cv.id, cv.c_id, cv.d_id, cv.price, cv.final_price, cv.paid_amount, cv.coupon_amount, cv.addi_time_price, cv.platform_fee, cv.weather_price,
                                cv.wallet_price, cv.additional_time, cv.status, cv.tot_km, cv.tot_hour, cv.tot_minute, cv.status_time_location, cv.pic_lat_long, cv.drop_lat_long, cv.pic_address,
                                cv.drop_address, cv.m_role, cv.coupon_id, COALESCE(vd.name, '') AS vehicle_name, COALESCE(vd.comission_rate, '') AS comission_rate,
                                COALESCE(vd.comission_type, '') AS comission_type, COALESCE(pd.image, '') AS p_image, COALESCE(pd.name, '') AS p_name,
                                COALESCE(rcr.title, '') AS c_title, CASE WHEN COUNT(revi.id) > 0 THEN '1' ELSE '0' END AS review_check
                                FROM tbl_order_vehicle AS cv
                                LEFT JOIN tbl_payment_detail AS pd ON cv.payment_id = pd.id
                                LEFT JOIN tbl_vehicle AS vd ON cv.vehicleid = vd.id
                                LEFT JOIN tbl_ride_cancel_reason AS rcr ON cv.cancel_reason = rcr.id
                                LEFT JOIN tbl_review_driver AS revi ON cv.d_id = revi.driver_id AND cv.c_id = revi.customer_id AND cv.id = revi.request_id
                                WHERE cv.id = '${request_id}' AND cv.c_id = '${uid}' AND cv.status IN ('4') GROUP BY cv.id ORDER BY id DESC`);

            if (mapdata != "") {
                mapdata[0].price = parseFloat(mapdata[0].price); mapdata[0].tot_km = parseFloat(mapdata[0].tot_km); mapdata[0].addi_time = parseFloat(mapdata[0].additional_time);

                mapdata[0].review_check = review_check;
                Reuqest_list = await AllFunction.AllVehicleFormate(mapdata, 2);

                delete Reuqest_list[0].tot_drop; delete Reuqest_list[0].comission_rate; delete Reuqest_list[0].comission_type; delete Reuqest_list[0].additional_time;
                return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Data Load Successful', Reuqest_list: Reuqest_list[0] });
            } else {
                return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Request Not Found!', Reuqest_list: [] });
            }
        }
        return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Request Not Found!', Reuqest_list: [] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});








router.get("/coupon_payment", async (req, res) => {
    try {
        let fulldate = await AllFunction.TodatDate();
        let coupon_list = await DataFind(`SELECT * FROM tbl_coupon WHERE start_date <= '${fulldate.date}' AND end_date >= '${fulldate.date}'`);
        coupon_list.map(cval => {
            let st = new Date(cval.start_date).toISOString().split("T")
            cval.start_date = `${st[0]} ${st[1]}`

            let en = new Date(cval.end_date).toISOString().split("T")
            cval.end_date = `${en[0]} ${en[1]}`
        })

        let payment_list = await DataFind(`SELECT * FROM tbl_payment_detail`);

        let spldata = payment_list[10].attribute.split(",")
        let bank_data = [{ bank_name: spldata[0] }, { holder_name: spldata[1] }, { account_no: spldata[2] }, { iafc_code: spldata[3] }, { swift_code: spldata[4] }]

        const general = await DataFind(`SELECT default_payment FROM tbl_general_settings`);

        return res.status(200).json({ ResponseCode: 200, Result: true, message: "Data Load successful", default_payment: general[0].default_payment, coupon_list, payment_list, bank_data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.post("/all_data", async (req, res) => {
    try {
        const { mrole } = req.body;

        if (mrole == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        let module_data = []
        if (mrole == "2") module_data = await DataFind(`SELECT * FROM tbl_outstation WHERE status = 1`);

        if (mrole == "3") module_data = await DataFind(`SELECT * FROM tbl_rental WHERE status = 1`);

        if (mrole == "4") module_data = await DataFind(`SELECT * FROM tbl_package`);

        if (module_data != "") return res.status(200).json({ ResponseCode: 200, Result: true, message: "Data Load successful", module_data });
        else return res.status(200).json({ ResponseCode: 401, Result: false, message: "Data not find", module_data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.post("/module_data", async (req, res) => {
    try {
        const { mid, mrole } = req.body;

        if (mid == "" || mrole == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        let module_data = []
        if (mrole == "2") module_data = await DataFind(`SELECT * FROM tbl_outstation WHERE status = 1 AND id = '${mid}'`);

        if (mrole == "3") module_data = await DataFind(`SELECT * FROM tbl_rental WHERE status = 1 AND id = '${mid}'`);

        if (mrole == "4") module_data = await DataFind(`SELECT * FROM tbl_package`);

        if (module_data != "") return res.status(200).json({ ResponseCode: 200, Result: true, message: "Data Load successful", module_data });
        else return res.status(200).json({ ResponseCode: 401, Result: false, message: "Data not find", module_data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.post("/add_wallet", async (req, res) => {
    try {
        const { uid, payment_id, amount } = req.body;

        const missingField = await AllFunction.CheckBodyData(req, ["uid", "payment_id", "amount"]);
        if (missingField) return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        let customer = await DataFind(`SELECT * FROM tbl_customer WHERE status = 1 AND id = '${uid}'`);
        if (customer == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Customer not found!' });

        let fulldate = await AllFunction.TodatDate();

        if (await DataInsert(`tbl_transaction_customer`, `c_id, payment_id, amount, date, status, type`,
            `${uid}, '${payment_id}', '${amount}', '${fulldate.date}T${fulldate.time}', '1', ''`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result: false, message: process.env.dataerror });
        }

        let cdata = customer[0].wallet, wamount = 0
        if (cdata || cdata != "0" || cdata != "NaN") wamount = cdata;

        let wallet_amount = parseFloat(wamount) + parseFloat(amount)

        if (await DataUpdate(`tbl_customer`, ` wallet = '${wallet_amount}'`, `id = '${uid}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result: false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result: true, message: "Wallet Add successful" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.post("/wallet", async (req, res) => {
    try {
        const { uid } = req.body;
        if (!uid) return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        const customer = await DataFind(`SELECT * FROM tbl_customer WHERE status = 1 AND id = '${uid}'`);
        if (customer == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Customer not found!' });

        let wallet_data = await DataFind(`SELECT dt.*, COALESCE(pd.name, '') AS pname
                                        FROM tbl_transaction_customer AS dt
                                        LEFT JOIN tbl_payment_detail AS pd ON dt.payment_id = pd.id
                                        WHERE dt.c_id = '${uid}' AND wallet_status = '1'`);

        let wdata = wallet_data.map(async (wval) => {
            const date = new Date(wval.date);
            const formattedDate = date.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
            wval.date = formattedDate;
            if (wval.payment_id == "0") wval.pname = "Referred"
            return wval;
        });
        let fulldata = await Promise.all(wdata);

        return res.status(200).json({ ResponseCode: 200, Result: true, message: "Wallet Add successful", wallet_amount: customer[0].wallet, wallet_data: fulldata });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.get("/faq_data", async (req, res) => {
    try {
        const faq_list = await DataFind(`SELECT * FROM tbl_list_faq`);

        return res.status(200).json({ ResponseCode: 200, Result: true, message: "Wallet Add successful", faq_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.get("/pages_data", async (req, res) => {
    try {
        const pages_list = await DataFind(`SELECT * FROM tbl_list_pages`);

        return res.status(200).json({ ResponseCode: 200, Result: true, message: "Wallet Add successful", pages_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.post("/refer_and_earn", async (req, res) => {
    try {
        const { uid } = req.body;
        if (!uid) return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        const customer = await DataFind(`SELECT id, referral_code FROM tbl_customer WHERE id = '${uid}'`);
        const general = await DataFind(`SELECT refer_credit, signup_credit FROM tbl_general_settings`);

        if (customer != "" || general != "") {
            let refer_data = { referral_code: customer[0].referral_code, refer_credit: general[0].refer_credit, signup_credit: general[0].signup_credit }
            return res.status(200).json({ ResponseCode: 200, Result: true, message: "Data Load successful", refer_data });
        } else return res.status(200).json({ ResponseCode: 200, Result: true, message: "Data Not Found!", refer_data: { referral_code: "", refer_credit: "", signup_credit: "" } });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.post("/notification", async (req, res) => {
    try {
        const { uid } = req.body;
        if (!uid) return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Something went wrong' });

        const ndata = await DataFind(`SELECT noti.id, noti.image, noti.title, noti.description, noti.date
                                        FROM tbl_send_notification AS noti
                                        LEFT JOIN tbl_customer AS cus ON noti.customer = cus.id
                                        WHERE noti.customer = 'All' OR cus.id = '${uid}' ORDER BY noti.id DESC`);

        ndata.map(val => {
            const date = new Date(val.date);
            const formattedDate = date.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
            val.date = formattedDate;
            return val;
        });

        return res.status(200).json({ ResponseCode: 200, Result: true, message: "Data Not Found!", ndata });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



router.post("/account_deactive", async (req, res) => {
    try {
        const { id } = req.body;

        const driver_list = await DataFind(`SELECT id FROM tbl_customer WHERE id = '${id}'`);
        if (driver_list == "") return res.status(200).json({ ResponseCode: 401, Result: false, message: 'ID Not Found!' });

        if (await DataUpdate(`tbl_customer`, `status = '0'`, `id = '${id}'`, req.hostname, req.protocol) == -1) {

            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        return res.status(200).json({ ResponseCode: 200, Result: true, message: "Account Deactivate Successful" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})






module.exports = router;