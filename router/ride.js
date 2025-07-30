/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */



const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { DataFind } = require("../middleware/databse_query");
const AllFunction = require("../route_function/function");

async function StatusTimeTitle(status, lan) {
    let ttitle = ''
    if (status == "0") ttitle = `${lan.New} ${lan.Ride} ${lan.Request}`;
    else if (status == "1") ttitle = `${lan.Accepted}`;
    else if (status == "2") ttitle = `${lan.Arrived_at_the_location}`;
    else if (status == "3") ttitle = `${lan.Confirm} ${lan.Ride}`;
    else if (status == "4") ttitle = `${lan.Canceled}`;
    else if (status == "5") ttitle = `${lan.Ride} ${lan.Start}`;
    else if (status == "6") ttitle = `${lan.Ride} ${lan.End}`;
    else if (status == "7") ttitle = `${lan.Waiting} ${lan.Payment}`;
    else if (status == "8") ttitle = `${lan.Complete}`;
    return ttitle
}

router.get("/new", auth, auth, async(req, res)=>{
    try {
        const rd = await DataFind(`SELECT cv.id, cv.c_id, cv.d_id, cv.price, cv.pic_address, cv.drop_address, cv.id AS req_id,
                                    COALESCE(cus.name, '') AS cname
                                    FROM tbl_request_vehicle AS cv
                                    LEFT JOIN tbl_customer AS cus ON cv.c_id = cus.id
                                    ORDER BY cv.id DESC`);

        let rides = rd.map(async(rval) => {
            let RideAddress = await AllFunction.RideAddress(rval, 2);
            rval.pic_address = RideAddress.piclatlon.title;
            rval.drop_address = RideAddress.dropdata[0].title;
            return rval;
        })
        const user_data = await Promise.all(rides);

        res.render("ride_new_list", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, rd:user_data
        });
    } catch (error) {
        console.log(error);
    }
})

async function NewRideDataFind(id, lan) {
    const rd = await DataFind(`SELECT cv.id, cv.c_id, cv.d_id, cv.price, cv.tot_km, cv.status, cv.start_time, cv.tot_minute, cv.pic_address, cv.id AS req_id,
                                cv.drop_address, COALESCE(cus.name, '') AS cname, COALESCE(cus.email, '') AS cemail, COALESCE(cus.country_code, '') AS cccode, 
                                COALESCE(cus.phone, '') AS cphone, 
                                COALESCE(vei.name, '') AS vehicle_name, COALESCE(pay.name, '') AS pay_name, COUNT(ordl.id) AS tot_order
                                FROM tbl_request_vehicle AS cv
                                LEFT JOIN tbl_customer AS cus ON cv.c_id = cus.id
                                LEFT JOIN tbl_vehicle AS vei ON cv.vehicleid = vei.id
                                LEFT JOIN tbl_payment_detail AS pay ON cv.payment_id = pay.id
                                LEFT JOIN tbl_order_vehicle AS ordl ON cv.c_id = ordl.c_id
                                WHERE cv.id = '${id}'
                                GROUP BY cv.id, cv.c_id, cv.d_id, cv.price, cv.tot_km, cv.status, cv.start_time, cv.tot_minute, cv.pic_address, cv.drop_address, cus.name, cus.email, 
                                cus.country_code, cus.phone, vei.name, pay.name
                                ORDER BY cv.id DESC`);

    if (rd != "") {
        let RideAddress = await AllFunction.RideAddress(rd[0], 2);
        rd[0].pic_address = RideAddress.piclatlon;
        rd[0].drop_address = RideAddress.dropdata;

        if (rd[0].start_time != '' ) {
            let date = new Date(rd[0].start_time);
            const formattedDate = date.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
            rd[0].start_time = formattedDate;
        }
        rd[0].end_time = '-';
        rd[0].status_time = rd[0].tot_minute;
        
        rd[0].platform_fee = 0;
        rd[0].driver_fee = 0;
        rd[0].bidding_status = 0;
        rd[0].drop_complete = '';

        let firsttime = []

        if (rd[0].start_time != '' ) {
            const formattedDate = new Date(rd[0].start_time).toISOString().replace('T', ' ').slice(0, 19);
            let ttitle = await StatusTimeTitle(rd[0].status, lan);
    
            firsttime.push({status:rd[0].status, time:formattedDate, lat:0, lon:0, title:ttitle });
        }

        rd[0].first_stime = firsttime;
        rd[0].second_stime = [];
        
        rd[0].dfname = 'No driver'; rd[0].dlname = 'available'; rd[0].demail = 'No driver available'; rd[0].dpcode = 'No driver'; rd[0].dpnumber = 'available'; rd[0].dscode = 'No driver'; 
        rd[0].dsnumber = 'available';
        
        for (let i = 0; i < RideAddress.dropdata.length;) {
            if (rd[0].drop_complete != "") {
            if (rd[0].drop_complete < i) rd[0].drop_address[i].status = 'border-success';
            if (rd[0].drop_complete == i) rd[0].drop_address[i].status = 'border-warning';
            } else rd[0].drop_address[i].status = '';
            i++;
        }
    } else return false;
    return rd;
}

router.get("/ndetail/:id", auth, auth, async(req, res)=>{
    try {
        const rd = await NewRideDataFind(req.params.id, req.lan.ld);
        
        if (rd == false) {
            req.flash('errors', 'Data not available');
            return res.redirect("back")
        }
        
        res.render("ride_detail", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, rd:rd[0]
        });
    } catch (error) {
        console.log(error);
    }
})





router.get("/running", auth, auth, async(req, res)=>{
    try {
        const rd = await DataFind(`SELECT cv.id, cv.c_id, cv.d_id, cv.price, cv.pic_address, cv.drop_address,
                                    COALESCE(cus.name, '') AS cname, COALESCE(dri.first_name, '') AS dfname, COALESCE(dri.last_name, '') AS dlname
                                    FROM tbl_cart_vehicle AS cv
                                    LEFT JOIN tbl_customer AS cus ON cv.c_id = cus.id
                                    LEFT JOIN tbl_driver AS dri ON cv.d_id = dri.id 
                                    ORDER BY cv.id DESC`);
        
        let rides = rd.map(async(rval) => {
            let RideAddress = await AllFunction.RideAddress(rval, 2);
            rval.pic_address = RideAddress.piclatlon.title;
            rval.drop_address = RideAddress.dropdata[0].title;
            return rval;
        })
        const user_data = await Promise.all(rides);

        res.render("ride_running_list", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, rd:user_data
        });
    } catch (error) {
        console.log(error);
    }
})

async function RunningRideDataFind(id, lan) {
    const rd = await DataFind(`SELECT cv.id, cv.c_id, cv.d_id, cv.price, cv.platform_fee, (cv.price + cv.addi_time_price + cv.weather_price) AS driver_fee, cv.bidding_status, cv.tot_km, 
                                cv.status, cv.start_time, cv.status_time, cv.drop_complete, cv.status_time_location, cv.pic_address, 
                                cv.drop_address, COALESCE(cus.name, '') AS cname, COALESCE(cus.email, '') AS cemail, COALESCE(cus.country_code, '') AS cccode, COALESCE(cus.phone, '') AS cphone, 
                                COALESCE(dri.first_name, '') AS dfname, COALESCE(dri.last_name, '') AS dlname, COALESCE(dri.email, '') AS demail, COALESCE(dri.primary_ccode, '') AS dpcode,
                                COALESCE(dri.primary_phoneNo, '') AS dpnumber, COALESCE(dri.secound_ccode, '') AS dscode, COALESCE(dri.secound_phoneNo, '') AS dsnumber,
                                COALESCE(vei.name, '') AS vehicle_name, COALESCE(pay.name, '') AS pay_name, COUNT(ordl.id) AS tot_order
                                FROM tbl_cart_vehicle AS cv
                                LEFT JOIN tbl_customer AS cus ON cv.c_id = cus.id
                                LEFT JOIN tbl_driver AS dri ON cv.d_id = dri.id
                                LEFT JOIN tbl_vehicle AS vei ON cv.vehicleid = vei.id
                                LEFT JOIN tbl_payment_detail AS pay ON cv.payment_id = pay.id
                                LEFT JOIN tbl_order_vehicle AS ordl ON cv.c_id = ordl.c_id
                                WHERE cv.id = '${id}'
                                GROUP BY cv.id, cv.c_id, cv.d_id, cv.bidding_status, cv.price, cv.platform_fee, cv.addi_time_price, cv.weather_price, cv.tot_km, cv.status, cv.start_time, 
                                cv.status_time, cv.drop_complete, cv.pic_address, cv.drop_address, cus.name, cus.email, cus.country_code, cus.phone, dri.first_name, dri.last_name, 
                                dri.email, dri.primary_ccode, dri.primary_phoneNo, dri.secound_ccode, dri.secound_phoneNo, vei.name, pay.name
                                ORDER BY cv.id DESC`);

    if (rd != "") {
        let RideAddress = await AllFunction.RideAddress(rd[0], 2);
        rd[0].pic_address = RideAddress.piclatlon;
        rd[0].drop_address = RideAddress.dropdata;
        let date = new Date(rd[0].start_time);
        const formattedDate = date.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        rd[0].start_time = formattedDate;
        rd[0].end_time = '-';
        rd[0].status_time = await AllFunction.CalculateMinuteToHour(rd[0].status_time.split("&!!")[0].split("&")[2]);

        let firsttime = [], condate = [], addcheck = 0, dropcnum = Number(rd[0].drop_complete); 
        if (rd[0].status_time_location != '') {
            let spltime = rd[0].status_time_location.split("&!!");

            for (let a = 0; a < spltime.length;) {
                let sd = spltime[a].split("&"), ttitle = '', addtitle = '', addsubtitle = '';
                const formattedDate = new Date(sd[1]).toISOString().replace('T', ' ').slice(0, 19);

                ttitle = await StatusTimeTitle(sd[0], lan);
                
                if (sd[0] == "5" || sd[0] == "6") {
                    addtitle = rd[0].drop_address[addcheck].title
                    addsubtitle = rd[0].drop_address[addcheck].subtitle
                }

                let shown = addcheck
                if (sd[0] == "5") {
                    ttitle = `${shown+1} ${ttitle}`;
                } else if (sd[0] == "6") {
                    addcheck++;
                    ttitle = `${addcheck} ${ttitle}`;
                } else ttitle = ttitle;

                
                if (a == 0) firsttime.push({status:sd[0], time:formattedDate, lat:sd[2], lon:sd[3], title: ttitle, addtit: addtitle, addubtit: addsubtitle })
                else condate.push({status:sd[0], time:formattedDate, title:ttitle, addtit: addtitle, addubtit: addsubtitle })   
                a++
            }
        }
        rd[0].first_stime = firsttime;
        rd[0].second_stime = condate;

        for (let i = 0; i < RideAddress.dropdata.length;) {
            if (rd[0].drop_complete != "") {
                if (Number(rd[0].drop_complete) > i) rd[0].drop_address[i].status = 'border-success';
                else if (Number(rd[0].drop_complete) == i) rd[0].drop_address[i].status = 'border-warning';
                else rd[0].drop_address[i].status = '';
            } else rd[0].drop_address[i].status = '';
            i++;
        }
    } else return false;
    return rd;
}

router.get("/rdetail/:id", auth, auth, async(req, res)=>{
    try {
        const rd = await RunningRideDataFind(req.params.id, req.lan.ld);

        if (rd == false) {
            req.flash('errors', 'Data not available');
            return res.redirect("back")
        }
        
        res.render("ride_detail", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, rd:rd[0]
        });
    } catch (error) {
        console.log(error);
    }
})



router.get("/completed", auth, auth, async(req, res)=>{
    try {
        const rd = await DataFind(`SELECT cv.id, cv.c_id, cv.d_id, cv.price, cv.pic_address, cv.drop_address,
                                    COALESCE(cus.name, '') AS cname, COALESCE(dri.first_name, '') AS dfname, COALESCE(dri.last_name, '') AS dlname
                                    FROM tbl_order_vehicle AS cv
                                    LEFT JOIN tbl_customer AS cus ON cv.c_id = cus.id
                                    LEFT JOIN tbl_driver AS dri ON cv.d_id = dri.id
                                    WHERE cv.status = '8'
                                    ORDER BY cv.id DESC`);
        
        let rides = rd.map(async(rval) => {
            let RideAddress = await AllFunction.RideAddress(rval, 2);
            rval.pic_address = RideAddress.piclatlon.title;
            rval.drop_address = RideAddress.dropdata[0].title;
            return rval;
        })
        const user_data = await Promise.all(rides);

        res.render("ride_complete_list", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, rd:user_data
        });
    } catch (error) {
        console.log(error);
    }
})

async function CompletedRideDataFind(id, where, lan) {
    const rd = await DataFind(`SELECT cv.id, cv.c_id, cv.d_id, cv.price, cv.final_price, cv.coupon_amount, cv.addi_time_price, cv.platform_fee, cv.weather_price, 
                                (cv.price + cv.addi_time_price + cv.weather_price) AS driver_fee, cv.price AS fprice,
                                cv.bidding_status, cv.tot_km, cv.status, cv.start_time, cv.end_time, cv.tot_minute, cv.drop_complete, cv.status_time_location, cv.pic_address, cv.drop_address, 
                                COALESCE(cus.name, '') AS cname, COALESCE(cus.email, '') AS cemail, COALESCE(cus.country_code, '') AS cccode, COALESCE(cus.phone, '') AS cphone, 
                                COALESCE(dri.first_name, '') AS dfname, COALESCE(dri.last_name, '') AS dlname, COALESCE(dri.email, '') AS demail, COALESCE(dri.primary_ccode, '') AS dpcode,
                                COALESCE(dri.primary_phoneNo, '') AS dpnumber, COALESCE(dri.secound_ccode, '') AS dscode, COALESCE(dri.secound_phoneNo, '') AS dsnumber,
                                COALESCE(vei.name, '') AS vehicle_name, COALESCE(pay.name, '') AS pay_name, COUNT(*) AS tot_order
                                FROM tbl_order_vehicle AS cv
                                LEFT JOIN tbl_customer AS cus ON cv.c_id = cus.id
                                LEFT JOIN tbl_driver AS dri ON cv.d_id = dri.id
                                LEFT JOIN tbl_vehicle AS vei ON cv.vehicleid = vei.id
                                LEFT JOIN tbl_payment_detail AS pay ON cv.payment_id = pay.id
                                WHERE cv.id = '${id}' ${where}
                                GROUP BY cv.id, cv.c_id, cv.d_id, cv.bidding_status, cv.price, cv.final_price, cv.coupon_amount, cv.addi_time_price, cv.platform_fee, cv.weather_price, 
                                cv.tot_km, cv.status, cv.start_time, cv.end_time, cv.tot_minute, cv.drop_complete, cv.pic_address, cv.drop_address, cus.name, cus.email, cus.country_code, 
                                cus.phone, dri.first_name, dri.last_name, dri.email, dri.primary_ccode, dri.primary_phoneNo, dri.secound_ccode, dri.secound_phoneNo, vei.name, pay.name
                                ORDER BY cv.id DESC`);

    if (rd != "") {
        let RideAddress = await AllFunction.RideAddress(rd[0], 2);
        rd[0].pic_address = RideAddress.piclatlon;
        rd[0].drop_address = RideAddress.dropdata;

        let sdate = new Date(rd[0].start_time), edate = new Date(rd[0].end_time);
        const sformattedDate = sdate.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        rd[0].start_time = sformattedDate;
        
        const eformattedDate = edate.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        rd[0].end_time = eformattedDate;

        let firsttime = [], condate = [], addcheck = 0;
        if (rd[0].status_time_location != '') {
            let spltime = rd[0].status_time_location.split("&!!");
            
            for (let a = 0; a < spltime.length;) {
                let sd = spltime[a].split("&"), ttitle = '', addtitle = '', addsubtitle = '';
                const formattedDate = new Date(sd[1]).toISOString().replace('T', ' ').slice(0, 19);

                ttitle = await StatusTimeTitle(sd[0], lan);
                
                if (sd[0] == "5" || sd[0] == "6") {
                    addtitle = rd[0].drop_address[addcheck].title
                    addsubtitle = rd[0].drop_address[addcheck].subtitle
                }

                let shown = addcheck
                if (sd[0] == "5") {
                    ttitle = `${shown+1} ${ttitle}`;
                } else if (sd[0] == "6") {
                    addcheck++;
                    ttitle = `${addcheck} ${ttitle}`;
                } else ttitle = ttitle;

                
                if (a == 0) firsttime.push({status:sd[0], time:formattedDate, lat:sd[2], lon:sd[3], title: ttitle, addtit: addtitle, addubtit: addsubtitle })
                else condate.push({status:sd[0], time:formattedDate, title:ttitle, addtit: addtitle, addubtit: addsubtitle })   
                a++
            }
        }
        rd[0].first_stime = firsttime;
        rd[0].second_stime = condate;

        for (let i = 0; i < RideAddress.dropdata.length;) {
            if (rd[0].status == "8") {
                rd[0].drop_address[i].status = rd[0].status == '8' ? 'border-success' : '';
            } else {
                if (rd[0].drop_complete != "") {
                    if (rd[0].drop_complete < i) rd[0].drop_address[i].status = 'border-success';
                    if (rd[0].drop_complete == i) rd[0].drop_address[i].status = 'border-warning';
                } else rd[0].drop_address[i].status = '';
            }
            i++;
        }
        
        rd[0].status_time = await AllFunction.CalculateMinuteToHour(rd[0].tot_minute);

    } else return false;
    return rd;
}

router.get("/codetail/:id", auth, auth, async(req, res)=>{
    try {
        const rd = await CompletedRideDataFind(req.params.id, `AND cv.status = '8'`, req.lan.ld);
        
        if (rd == false) {
            req.flash('errors', 'Data not available');
            return res.redirect("back")
        } else rd[0].price = rd[0].final_price;
        
        res.render("ride_detail", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, rd:rd[0]
        });
    } catch (error) {
        console.log(error);
    }
})





router.get("/cancelled", auth, auth, async(req, res)=>{
    try {
        const rd = await DataFind(`SELECT cv.id, cv.c_id, cv.d_id, cv.price, cv.pic_address, cv.drop_address,
                                    COALESCE(cus.name, '') AS cname, COALESCE(dri.first_name, '') AS dfname, COALESCE(dri.last_name, '') AS dlname
                                    FROM tbl_order_vehicle AS cv
                                    LEFT JOIN tbl_customer AS cus ON cv.c_id = cus.id
                                    LEFT JOIN tbl_driver AS dri ON cv.d_id = dri.id
                                    WHERE cv.status = '4'
                                    ORDER BY cv.id DESC`);
        
        let rides = rd.map(async(rval) => {
            let RideAddress = await AllFunction.RideAddress(rval, 2);
            rval.pic_address = RideAddress.piclatlon.title;
            rval.drop_address = RideAddress.dropdata[0].title;
            return rval;
        })
        const user_data = await Promise.all(rides);

        res.render("ride_cancelled_list", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, rd:user_data
        });
    } catch (error) {
        console.log(error);
    }
});

router.get("/cadetail/:id", auth, auth, async(req, res)=>{
    try {
        const rd = await CompletedRideDataFind(req.params.id, `AND cv.status = '4'`, req.lan.ld);
        
        if (rd == false) {
            req.flash('errors', 'Data not available');
            return res.redirect("back")
        }
        
        res.render("ride_detail", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, rd:rd[0]
        });
    } catch (error) {
        console.log(error);
    }
})





router.get("/all", auth, auth, async(req, res)=>{
    try {
        const nrd = await DataFind(`SELECT cv.id, cv.c_id, cv.d_id, cv.price, cv.status, cv.start_time, cv.pic_address, cv.drop_address, cv.id AS req_id,
                                    COALESCE(cus.name, '') AS cname, '' AS dfname, '' AS dlname, 0 AS rides
                                    FROM tbl_request_vehicle AS cv
                                    LEFT JOIN tbl_customer AS cus ON cv.c_id = cus.id
                                    ORDER BY cv.id DESC`);

        const crd = await DataFind(`SELECT cv.id, cv.c_id, cv.d_id, cv.price, cv.status, cv.start_time, cv.pic_address, cv.drop_address, cv.req_id,
                                    COALESCE(cus.name, '') AS cname, COALESCE(dri.first_name, '') AS dfname, COALESCE(dri.last_name, '') AS dlname, 1 AS rides
                                    FROM tbl_cart_vehicle AS cv
                                    LEFT JOIN tbl_customer AS cus ON cv.c_id = cus.id
                                    LEFT JOIN tbl_driver AS dri ON cv.d_id = dri.id`);
        
        const rd = await DataFind(`SELECT cv.id, cv.c_id, cv.d_id, cv.price, cv.status, cv.start_time, cv.pic_address, cv.drop_address, cv.req_id,
                                    COALESCE(cus.name, '') AS cname, COALESCE(dri.first_name, '') AS dfname, COALESCE(dri.last_name, '') AS dlname, 2 AS rides
                                    FROM tbl_order_vehicle AS cv
                                    LEFT JOIN tbl_customer AS cus ON cv.c_id = cus.id
                                    LEFT JOIN tbl_driver AS dri ON cv.d_id = dri.id`);
                                    
        const all = nrd.concat(crd, rd);
        const shorted = all.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
        
        let rides = shorted.map(async(rval) => {
            let RideAddress = await AllFunction.RideAddress(rval, 2);
            rval.pic_address = RideAddress.piclatlon.title;
            rval.drop_address = RideAddress.dropdata[0].title;
            
            return rval;
        })
        const user_data = await Promise.all(rides);
        
        res.render("ride_all_list", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, rd:user_data
        });
    } catch (error) {
        console.log(error);
    }
})

router.get("/alldetail", auth, auth, async(req, res)=>{
    try {
        const {u, c, s} = req.query;
        
        let request = [], sta = 1;
        request = await DataFind(`SELECT id FROM tbl_request_vehicle WHERE id = '${u}' AND c_id = '${c}'`);
        
        if (request == "") {
            request = await DataFind(`SELECT id FROM tbl_cart_vehicle WHERE req_id = '${u}' AND c_id = '${c}'`);
           
            sta = 2;
            if (request == "") {
                request = await DataFind(`SELECT id FROM tbl_order_vehicle WHERE req_id = '${u}' AND c_id = '${c}'`);
                sta = 3;
            } 
            if (request == "") {
                req.flash('errors', 'Data not available');
                return res.redirect("back")
            }
        }
        
        let rd = [];
        if (sta == "1") rd = await NewRideDataFind(u, req.lan.ld);
        else if (sta == "2") rd = await RunningRideDataFind(request[0].id, req.lan.ld);
        else if (sta == "3") {
            rd = await CompletedRideDataFind(request[0].id, '', req.lan.ld);
            
            if (rd != false) {
                if (rd[0].status == "8") rd[0].price = rd[0].final_price;
            }
        }

        if (rd == false) {
            req.flash('errors', 'Data not available');
            return res.redirect("back")
        }
        
        res.render("ride_detail", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, rd:rd[0]
        });
    } catch (error) {
        console.log(error);
    }
})





module.exports = router;