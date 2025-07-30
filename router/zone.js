/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */



const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/databse_query");



router.get("/list", auth, async(req, res)=>{
    try {
        const zone_data = await DataFind(`SELECT * FROM tbl_zone`);
        
        res.render("zone", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, zone_data
        })
    } catch (error) {
        console.log(error);
    }
})

router.post("/add_zone", auth, async(req, res)=>{
    try {
        const {name, status, zone_lat_lon} = req.body;

        console.log(req.body);
        const all_lat_lon = zone_lat_lon.split(',');
        let zone_leg = all_lat_lon.length;

        let latitude = [];
        let longitiude = [];
        let lat_log = [];

        for (let i = 0; i < zone_leg;) {

            if ((i%2) == 0) {
                latitude.push(all_lat_lon[i]);
            } else {
                longitiude.push(all_lat_lon[i]);
            }
            i++;
        }

        for (let a = 0; a < latitude.length;) {
            lat_log.push(latitude[a] +':'+longitiude[a]);
            a++;
        }

        let zone = lat_log.toString();

        if (await DataInsert(`tbl_zone`, `name, status, lat_lon`, `'${name}', '${status}', '${zone}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Zone Add successfully');
        res.redirect("/zone/list");
    } catch (error) {
        console.log(error);
    }
})

router.get("/edit/:id", auth, async(req, res)=>{
    try {
        const zone_data = await DataFind(`SELECT * FROM tbl_zone where id = '${req.params.id}'`);

        res.render("edit_zone", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, zone_data
        })
    } catch (error) {
        console.log(error);
    }
})

router.post("/edit_zone", auth, async(req, res)=>{
    try {
        const {zone_id, name, status, zone_lat_lon} = req.body;

        if (zone_lat_lon == "") {
            if (await DataUpdate(`tbl_zone`, `name = '${name}', status = '${status}'`, `id = '${zone_id}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
            
        } else {

            const all_lat_lon = zone_lat_lon.split(',');
            let zone_leg = all_lat_lon.length;

            let latitude = [];
            let longitiude = [];

            let lat_log = [];

            for (let i = 0; i < zone_leg;) {

                if ((i%2) == 0) {
                    latitude.push(all_lat_lon[i]);
                } else {
                    longitiude.push(all_lat_lon[i]);
                }
                i++;
            }

            for (let a = 0; a < latitude.length;) {
                lat_log.push(latitude[a] +':'+longitiude[a]);
                a++;
            }

            let zone = lat_log.toString();

            if (await DataUpdate(`tbl_zone`, `name = '${name}', status = '${status}', lat_lon = '${zone}'`, `id = '${zone_id}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        }
        
        req.flash('success', 'Zone Updated successfully');
        res.redirect("/zone/list");
    } catch (error) {
        console.log(error);
    }
})

router.get("/delete/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_zone`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Zone Deleted successfully');
        res.redirect("/zone/list");
    } catch (error) {
        console.log(error);
    }
})


router.get("/live_driver", auth, async(req, res)=>{
    try {
        const zone_data = await DataFind(`SELECT * FROM tbl_zone`);
        const vehicle = await DataFind(`SELECT * FROM tbl_vehicle WHERE status = '1'`);

        const dri = await DataFind(`SELECT dr.id, dr.latitude, dr.longitude, 
                                        COALESCE(ve.map_img, '') AS image, COALESCE(ve.name, '') AS name, COALESCE(ve.description, '') AS description
                                        FROM tbl_driver AS dr
                                        JOIN tbl_vehicle AS ve ON dr.vehicle = ve.id
                                        WHERE dr.zone IN (${zone_data[0].id}) AND dr.fstatus = '1' AND dr.status = '1' AND dr.approval_status = '1' AND dr.latitude NOT IN ('') AND dr.longitude NOT IN ('')`);  

        res.render("zone_driver_location", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, zone_data, vehicle
        })
    } catch (error) {
        console.log(error);
    }
})

router.post("/change_location", auth, async(req, res)=>{
    try {
        const {zid, vid} = req.body;
        
        const zone_data = await DataFind(`SELECT * FROM tbl_zone ${ zid != "0" ? `WHERE id = '${zid}'` : '' }`);
        
        const dri = await DataFind(`SELECT dr.id, dr.vehicle, dr.first_name, dr.last_name, dr.latitude, dr.longitude, dr.primary_ccode, dr.primary_phoneNo, dr.secound_ccode, 
                                    dr.secound_phoneNo, COALESCE(ve.map_img, '') AS image, COALESCE(ve.name, '') AS vehicle_name, COUNT(ord.id) AS tot_ride, 
                                    COALESCE(GROUP_CONCAT(DISTINCT dz.name SEPARATOR ', '), '') AS zone_name
                                    FROM tbl_driver AS dr
                                    LEFT JOIN tbl_vehicle AS ve ON dr.vehicle = ve.id
                                    LEFT JOIN tbl_order_vehicle AS ord ON dr.id = ord.d_id
                                    LEFT JOIN tbl_zone AS dz ON FIND_IN_SET(dz.id, dr.zone) > 0
                                    WHERE dr.zone IN (${zone_data[0].id}) ${ vid != "0" ? `AND dr.vehicle = '${vid}'` : '' }
                                    GROUP BY dr.id, dr.vehicle, dr.first_name, dr.last_name, dr.latitude, dr.longitude, ve.map_img;`);  

        let zdata = zone_data[0];
        
        res.send({status:true, data:zdata, dri, zone: zone_data[0].id})
    } catch (error) {
        console.log(error);
    }
})



module.exports = router;