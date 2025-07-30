/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */



const geolib = require('geolib');
const axios = require('axios');
const sendOneNotification = require("../middleware/send");
const AllChat = require("../route_function/chat_function");
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/databse_query");




async function otpGenerate(len) {
    let otp_result = '';
    let char = '0123456789';
    let charlen = char.length;
    for (let i = 0; i < len; i++) {
        otp_result += char.charAt(Math.floor(Math.random() * charlen));
    }
    return otp_result;
}




async function DriverUpdate(documant_list, driverdata, id, hostname, protocol) {
    let fcount = 0, scount = 0
    for (let d = 0; d < documant_list.length;) {
        fcount++
        for (let e = 0; e < driverdata.length;) {

            if (documant_list[d].id == driverdata[e].document_id) {
                if (driverdata[e].status == "1") scount++
            }
            e++
        }
        d++
    }

    const gsetting = await DataFind(`SELECT def_driver FROM tbl_general_settings`);
    if (gsetting[0].def_driver == "1") {
        
        const driverdoc = await DataFind(`SELECT * FROM tbl_document_setting`);
        if (driverdoc.length == driverdata.length) {
            
            if (await DataUpdate(`tbl_driver`, ` approval_status = '1'`, `id = '${id}'`, hostname, protocol) == -1) {
                return -1
            }
            
            for (let i = 0; i < driverdata.length;) {
                if (await DataUpdate(`tbl_driver_document`, `status = '1'`, `id = '${driverdata[i].id}'`, hostname, protocol) == -1) {
                    return -1
                }
                i++
            }
        }
    } else {
        if (fcount == scount) {
            if (await DataUpdate(`tbl_driver`, ` approval_status = '1'`, `id = '${id}'`, hostname, protocol) == -1) {
                return -1
            }
        } else {
            if (await DataUpdate(`tbl_driver`, ` approval_status = '0'`, `id = '${id}'`, hostname, protocol) == -1) {
                return -1
            }
        }
    }

    return 1
}


async function ZoneLatlon(pickup_lat_lon, drop_lat_lon, lat_lon_list) {
    let totalzone = []
    let splpi = pickup_lat_lon.split(",")
    totalzone.push({ latitude: Number(splpi[0]), longitude: Number(splpi[1]) });

    let spldrop = drop_lat_lon.split(",")
    totalzone.push({ latitude: Number(spldrop[0]), longitude: Number(spldrop[1]) });

    if (lat_lon_list != "") {
        for (let i = 0; i < lat_lon_list.length;) {
            totalzone.push({ latitude: Number(lat_lon_list[i].lat), longitude: Number(lat_lon_list[i].long) });
            i++
        }
    }
    return totalzone
}




async function ZoneData() {
    const zone_data = await DataFind(`SELECT * FROM tbl_zone`);
    let all_zone = []
    for (let i = 0; i < zone_data.length;){
        let aplz = zone_data[i].lat_lon.split(',');
        let all_lat = [];
        for (let a = 0; a < aplz.length; ){
            let [latitude, longitude] = aplz[a].split(':').map(Number);
            all_lat.push({ latitude, longitude });
            a++;
        }
        all_zone.push(all_lat)
        i++;
    }
    return {all_zone, zone_data}
}




async function CheckZone(convertzone, zone, zalldata) {
    const zone_data = zalldata
    let all_zone = zone, zoneresult = [], zid = [], uzone = 0;
    
    for (let a = 0; a < convertzone.length;) {
        let tcount = 0, ucheck = 0
        
        for (let b = 0; b < all_zone.length;) {
        
            let count = geolib.isPointInPolygon(convertzone[a], all_zone[b]);
            
            if (count === true) {
                tcount++
                if (zid.includes(zone_data[b].id) === false) zid.push(zone_data[b].id);
            }
            else ucheck++;
            b++;
        }
        
        if (tcount == "0") uzone++
        zoneresult.push({ zone: a +1, status: tcount > 0 ? 1 : 0 });
        
        a++
    }

    let zdata = [zr={zr:zoneresult}, zc={zc:uzone}, zid={zid:zid}]
    return zdata;
}



async function RadiusCheck(point, otherlatlon, radius) {
    let isWithinRadius = geolib.isPointWithinRadius(
        otherlatlon, point, radius
    );
    if (isWithinRadius === true) return 1
    else return 0
}



async function GetDistance(pickup, drop, google_map_key) {
    
    const apiKey = google_map_key;
    const origin = pickup;
    const destination = drop; 

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?units=metric&origins=${origin}&destinations=${destination}&key=${apiKey}`;
    
    try {
        const response = await axios.get(url);
        const data = await response.data;
        
        if (data.status === 'OK' && data.rows && data.rows.length > 0 && data.rows[0].elements && data.rows[0].elements.length > 0) {
            const element = data.rows[0].elements[0];
            if (element.status === 'OK') {
                
                const distance = element.distance.text;
                const duration = element.duration.text;
                let dspl = distance.split(" "), kmcal = 0;
                
                if (dspl[1].match("km", "i") == null) kmcal = (parseFloat(dspl[0]) / 1000).toFixed(2);
                else kmcal = parseFloat(parseFloat(dspl[0]).toFixed(2));

                return { status: 1, dis:parseFloat(kmcal), dur:duration}
            } else {
                console.log('Error in fetching data:', element.status);
                return { status: 0, dis:0, dur:"0 min"}
            }
        } else {
            console.log('Invalid response structure or status:', data.status);
            return { status: 0, dis:0, dur:"0 min"};
        }
    } catch (error) {
        console.error('Error fetching the distance:', error);
        return { status: 0, dis:0, dur:"0 min"};
    }
}




async function AddDateMinute(minute) {
    let currentTime = new Date();
    currentTime.setMinutes(currentTime.getMinutes() + minute);
    
    let hours = currentTime.getHours(), minutes = currentTime.getMinutes();
    let ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;

    let formattedTime = hours + ':' + minutes + ' ' + ampm;
    return formattedTime
}


async function ConvertDateFormat(time) {
    const date = new Date(time);
    const options = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    const formattedDate = date.toLocaleString('en-US', options);

    const dateParts = formattedDate.split(", ");
    const timePart = dateParts[1].trim();
    const [monthDay, ndate] = dateParts[0].split(" ");
    
    const finalOutput = `${ndate} ${monthDay}, ${timePart}`;
    return finalOutput
}



async function ConvertFullDateFormat(time) {
    const date = new Date(time);
    const options = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    const formattedDate = date.toLocaleString('en-US', options);
    const d = formattedDate.split(", ");
    let fd = d[0].split(" ");
    const finalOutput = `${fd[1]} ${fd[0]} ${d[1]}, ${d[2]}`;
    return finalOutput
}




async function TodatDate(ndate) {
    let date
    if (ndate) date = new Date(ndate).toISOString().split("T");
    else date = new Date().toISOString().split("T");
    return {date:date[0], time:date[1]}
}




async function convertSeconds(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    return { hours: hours, minutes: minutes, seconds: remainingSeconds };
}

async function FirstTime(hour, minute, secound, nhour, nminute, nsecond) {
    let totalSeconds = hour * 3600 + minute * 60 + secound;
    let nTotalSeconds = nhour * 3600 + nminute * 60 + nsecond;
    let newTotalSeconds = totalSeconds - nTotalSeconds;
    
    let newHour = Math.floor(newTotalSeconds / 3600);
    newTotalSeconds %= 3600;
    let newMinute = Math.floor(newTotalSeconds / 60);
    let newSecond = newTotalSeconds % 60;

    return { newHour, newMinute, newSecond }
}

async function SecoundTime(ntime, oldtime) {
    let currentTime = new Date(ntime);
    let OldTime = new Date(oldtime);

    let timeDifference = currentTime - OldTime;

    let differenceInSeconds = Math.floor(timeDifference / 1000);
    let differenceInMinutes = Math.floor(differenceInSeconds / 60);

    let hour = Math.floor(differenceInMinutes / 60);
    let minute = differenceInMinutes % 60;
    let second = differenceInSeconds % 60;

    return { hour, minute, second }
}

async function TwoTimeDifference(data, status) {
    let OldTime = new Date(data);
    if (status == "1") OldTime.setHours(OldTime.getHours() + 1);
    
    let currentTime = new Date();

    let timeDifference = currentTime - OldTime;
    let differenceInSeconds = Math.floor(timeDifference / 1000);
    let differenceInMinutes = Math.floor(differenceInSeconds / 60);

    let hour = Math.floor(differenceInMinutes / 60);
    let minute = differenceInMinutes % 60;
    let second = differenceInSeconds % 60;

    return { hour, minute, second }
}

async function CurrentDatetoOldDateS(ndate, deff_sec) {
    
    let currunt = new Date(ndate), old = new Date();
    old.setSeconds(old.getSeconds() - parseFloat(deff_sec));

    let newtime = await AllFunction.SecoundTime(currunt, old);

    let toth = parseFloat(newtime.hour) * 60 * 60;
    let totm = parseFloat(newtime.minute) * 60;
    let tots = parseFloat(toth) + parseFloat(totm) + parseFloat(newtime.second);
    return tots
}

async function TimeDistance(rdata) {
    let spltime = "", run_time = { hour: 0, minute: 0, second: 0, status: 0 }
    const general = await DataFind(`SELECT driver_wait_time FROM tbl_general_settings`);

    if (rdata.current_run_time && rdata.current_run_time != "") {
        spltime = rdata.current_run_time.split("&")

        let ctime = await TwoTimeDifference(spltime[0], 2);
    
        if (ctime.hour != "NaN" && ctime.minute != "NaN" && ctime.second != "NaN") {
            
            if (rdata.status == "1" || rdata.status == "5") {
                
                let newtime = await FirstTime(rdata.tot_hour, rdata.tot_minute, 0, ctime.hour, ctime.minute, ctime.second);
                
                if (newtime.newHour > -1 && newtime.newMinute > -1 && newtime.newSecond > -1) {   
                    run_time.hour = newtime.newHour; run_time.minute = newtime.newMinute; run_time.second = newtime.newSecond; run_time.status = 1;
                }
                
            } else if (rdata.status == "2") {
    
                if (general[0].driver_wait_time != "0" || general[0].driver_wait_time) {
                    let ntime = new Date();
                    ntime.setMinutes(ntime.getMinutes() - parseFloat(general[0].driver_wait_time));
    
                    let sectime = await SecoundTime(spltime[0], ntime);
                    
                    if (sectime.hour > -1 && sectime.minute > -1 && sectime.second > -1) {
    
                        run_time.hour = sectime.hour; run_time.minute = sectime.minute; run_time.second = sectime.second; run_time.status = 1;
                    } else {
                        let newtime = await FirstTime(ctime.hour, ctime.minute, ctime.second, 0, parseFloat(general[0].driver_wait_time), 0);
                        
                        if (newtime.newHour > -1 && newtime.newMinute > -1 && newtime.newSecond > -1) {   
                            run_time.hour = newtime.newHour; run_time.minute = newtime.newMinute; run_time.second = newtime.newSecond;
                        }
                    }
                }

            } else {
                run_time.hour = ctime.hour; run_time.minute = ctime.minute; run_time.second = ctime.second; run_time.status = 0;
            }
        }

    } else if (rdata.status == "3") {
        
        let sta = rdata.status_time_location.split("&!!");
        let f = sta[1].split("&"), s = sta[2].split("&");
        let sectime = await SecoundTime(s[1], f[1]);

        let a = parseFloat(sectime.hour);
        let hourm = a * 60 * 60;
        let   = await CalculateMinuteToHour(sectime.second);
        
        let totm = parseFloat(hourm) + parseFloat(sectime.minute) * parseFloat(60) + parseFloat(sectime.second);

        let nextmin = 0, st = 0, driwait = parseFloat(general[0].driver_wait_time) * parseFloat(60);
        if (driwait >= totm) {
            nextmin = parseFloat(driwait) - parseFloat(totm); st = 2;
        } else {
            nextmin = parseFloat(totm) - parseFloat(driwait); st = 3;
        }
        const result = await convertSeconds(nextmin);
        run_time.hour = result.hours; run_time.minute = result.minutes; run_time.second = result.seconds; run_time.status = st;
    }
    return run_time;
}




async function DriverRequestData(rdata) {
    let request_data = []
    const general = await DataFind(`SELECT dri_offer_increment, offer_expire_time, offer_time FROM tbl_general_settings`);
    for (let i = 0; i < rdata.length;) {
        let piclatlon, drolatlon = [], picadd, dropadd = [], run_time = { hour: 0, minute: 0, second: 0, status: 0 }, timecal = 0, status = 0

        let plos = rdata[i].pic_lat_long.split("&!"), pads = rdata[i].pic_address.split("&!")
        piclatlon = { latitude: plos[0], longitude: plos[1] }; picadd = { title: pads[0], subtitle: pads[1] }
        
        let platlon = rdata[i].drop_lat_long.split("&!!"), dradd = rdata[i].drop_address.split("&!!")
        for (let a = 0; a < platlon.length;) {

            let lspl = platlon[a].split("&!"), addspl = dradd[a].split("&!")

            if (parseFloat(rdata[i].status) > 4) {
                if (parseFloat(rdata[i].drop_complete) <= a) drolatlon.push({ latitude: lspl[0], longitude: lspl[1] });
            } else {
                drolatlon.push({ latitude: lspl[0], longitude: lspl[1] });
            }
            dropadd.push({ title: addspl[0], subtitle: addspl[1] });
            a++;
        }

        let per_km_price = "0";
        if (parseFloat(rdata[i].price) != 0 && parseFloat(rdata[i].tot_km) != 0) per_km_price = (parseFloat(rdata[i].price) / parseFloat(rdata[i].tot_km)).toFixed(2);
        
        if (rdata[i].current_run_time && rdata[i].current_run_time != "") run_time = await TimeDistance(rdata[i]);
            
        status = run_time.status;
        if (run_time.hour != 0 && run_time.minute != 0 && run_time.second != 0) {

            timecal = (parseFloat(run_time.hour) * 3600) + (parseFloat(run_time.minute) * 60) + parseFloat(run_time.second);

        } else if (run_time.hour == 0 && run_time.minute != 0 && run_time.second != 0) {

            timecal = (run_time.minute * 60) + run_time.second;

        } else if (run_time.hour == 0 && run_time.minute == 0 && run_time.second != 0) {

            timecal =  run_time.second;
            
        } else if (run_time.hour == 0 && run_time.minute == 0 && run_time.second == 0) {

            timecal = 0;

        } else timecal = 0;
        
        let timed = {run_time: timecal ? timecal : 0, status:status};

        let df = parseFloat(general[0].dri_offer_increment), dprice = [];
        if (rdata[i].bidding_status == "1") {
            for (let b = 1; b < df+1;) {
                let dp = parseFloat(rdata[i].price) + b
                dprice.push(dp);
                b++;
            }
        }
        
        request_data.push({id:rdata[i].id, c_id:rdata[i].c_id, name:rdata[i].name, country_code:rdata[i].country_code, phone:rdata[i].phone, rating:parseFloat(rdata[i].avg_star), 
        review:rdata[i].tot_review, price: parseFloat(rdata[i].price), per_km_price, tot_km:rdata[i].tot_km, tot_hour:rdata[i].tot_hour, tot_minute:rdata[i].tot_minute, status:rdata[i].status, 
        bidding_status:rdata[i].bidding_status, bidd_auto_status: rdata[i].bidd_auto_status, ride_expire_time: parseFloat(general[0].offer_expire_time), bidd_ex_time: parseFloat(general[0].offer_time), 
        dri_offer_limite:dprice, running_time:timed, pick_latlon:piclatlon, drop_latlon:drolatlon, pick_add:picadd, drop_add:dropadd});

        i++
    }
    return request_data
}

async function CheckBodyData(req, Data) {
    const missingField = Data.find(field => !req.body[field] || req.body[field] === null || req.body[field] === "null" || req.body[field] === undefined || req.body[field] === "undefined");
    return missingField
}


async function CheckSocketData(data, Data) {
    const missingField = Data.find(field => !data[field] || data[field] === null || data[field] === "null" || data[field] === undefined || data[field] === "undefined");
    return missingField
}




async function SendDriverLatLong(uid) {
    let data = await DataFind(`SELECT c_id FROM tbl_cart_vehicle WHERE d_id = '${uid}'`), driver = [];

    if (data != "") {
        driver = await DataFind(`SELECT dr.id, COALESCE(ve.map_img, '') AS image, COALESCE(ve.name, '') AS name, COALESCE(ve.description, '') AS description, 
                                COALESCE(dr.latitude, '') AS latitude, COALESCE(dr.longitude, '') AS longitude
                                FROM tbl_driver AS dr
                                JOIN tbl_vehicle AS ve ON dr.vehicle = ve.id AND ve.id = dr.vehicle
                                WHERE dr.id = '${uid}' AND dr.status = '1' AND dr.approval_status = '1' AND dr.latitude NOT IN ('') AND dr.longitude NOT IN ('')`);

        if (driver != "") return {driver, data};
    } else return { driver:[], data: [] }
}




async function CheckCurrentLocation(pending_ride, dlatlon, daddress) {
    let current_address = { title: "", subtitle: "", latitude: "", longitude: "" }, next_address = { title: "", subtitle: "", latitude: "", longitude: "" }, custatus = 0, nstatus = 0;

    if (dlatlon[pending_ride]) {
        let add = daddress[pending_ride].split("&!") , latlon = dlatlon[pending_ride].split("&!");
        current_address = { title: add[0], subtitle: add[1], latitude: latlon[0], longitude: latlon[1] };

        custatus = 1;
    }
    
    if (dlatlon[pending_ride+1]) {
        let nadd = daddress[pending_ride+1].split("&!") , nlatlon = dlatlon[pending_ride+1].split("&!");
        next_address = { title: nadd[0], subtitle: nadd[1], latitude: nlatlon[0], longitude: nlatlon[1] };
        
        nstatus = 1;
    }
    return {current_address, next_address, custatus, nstatus };
}




async function VehicleRideStartEndData(uid, c_id, request_id) {
    const rd = await DataFind(`SELECT * FROM tbl_cart_vehicle WHERE id = '${request_id}' AND c_id = '${c_id}' AND d_id = '${uid}'`);
    if (rd == "") return { ResponseCode: 401, Result:false, message: 'Request Not Found!' };

    let dlatlon = rd[0].drop_lat_long.split("&!!"), daddress = rd[0].drop_address.split("&!!"), pending_ride = "", drop_list = [], splh = rd[0].current_run_time.split("&")
    pending_ride = parseFloat(rd[0].drop_complete);

    let ccheck = await CheckCurrentLocation(pending_ride, dlatlon, daddress), pickup, drop, drop_latlon, tot_hour = rd[0].tot_hour, tot_min = rd[0].tot_minute, tot_km = splh[3];

    for (let i = 0; i < dlatlon.length;) {
        let checkadd = daddress[i].split("&!"), checkl = dlatlon[i].split("&!"), status = "";

        if (pending_ride == i) status = "2";
        if (pending_ride > i) status = "3";
        if (pending_ride < i) status = "1";

        if (parseFloat(rd[0].drop_complete) <= i) drop_list.push({ status: status, title: checkadd[0], subtitle: checkadd[1], latitude: checkl[0], longitude: checkl[1] })
        i++
    }

    return {uid, c_id, request_id, status:rd[0].status, tot_hour, tot_min, tot_second: 0, tot_km: tot_km, current_address:ccheck.current_address, next_address:ccheck.next_address, drop_list}
}



async function VehicleAllRide(rdata, number) {
    let piclatlon, firstdrop = [], dropdata = [], drop_tot = 0;

    let plos = rdata.pic_lat_long.split("&!"), pads = rdata.pic_address.split("&!")
    piclatlon = { title: pads[0], subtitle: pads[1], latitude: plos[0], longitude: plos[1] }

    let platlon = rdata.drop_lat_long.split("&!!"), dradd = rdata.drop_address.split("&!!")
    drop_tot = dradd.length

    for (let a = 0; a < platlon.length;) {
        let lspl = platlon[a].split("&!"), addspl = dradd[a].split("&!")
        if (a == 0) firstdrop.push({ title: addspl[0], subtitle: addspl[1], latitude: lspl[0], longitude: lspl[1] })
        else dropdata.push({ title: addspl[0], subtitle: addspl[1], latitude: lspl[0], longitude: lspl[1] })
        a++ 
    }
    if (number == "1") {
        return {piclatlon, dropdata:firstdrop[0], droplist:dropdata, drop_tot}
    } else if (number == "2")  {
        let data = firstdrop.concat(dropdata)
        return {piclatlon, dropdata:data, drop_tot}
    }
}



async function RideAddress(rdata, number) {
    let piclatlon, pads = rdata.pic_address.split("&!"), dradd = rdata.drop_address.split("&!!"), dropdata = [], drop_tot = 0;
    drop_tot = dradd.length;

    piclatlon = { title: pads[0], subtitle: pads[1] }

    if (number == "1") {
        let addspl = dradd[0].split("&!");
        return {piclatlon, dropdata:{ title: addspl[0], subtitle: addspl[1] }, drop_tot};
    }
    else if (number == "2")  {
        for (let a = 0; a < dradd.length;) {
            let addspl = dradd[a].split("&!");
            dropdata.push({ title: addspl[0], subtitle: addspl[1] });
            a++ 
        }
        return {piclatlon, dropdata, drop_tot};
    }
}



async function DateFormate(fulldate) {
    const date = new Date(fulldate);
    const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    
    const formattedDate = date.toLocaleString('en-US', options);
    return formattedDate
}



async function VehicleBidding(uid, request_id, price, status, hostname, protocol) {
    
    let rd = []
    if (typeof uid == 'object') {
        rd = await DataFind(`SELECT * FROM tbl_request_vehicle WHERE bidding_status = "1" AND id = '${request_id}'`);
    } else {
        rd = await DataFind(`SELECT * FROM tbl_request_vehicle WHERE bidding_status = "1" AND id = '${request_id}' AND JSON_CONTAINS(d_id, '${uid}')`);
    }
    
    if(rd != "") {

        let idlist = rd[0].d_id, bprice = rd[0].bidding_d_price, eidlist = [], driindex = 0;
        if (typeof idlist == "string") eidlist = JSON.parse(idlist);
        else eidlist = idlist;

        driindex = eidlist.indexOf(parseFloat(uid));
        
        let old = "", nid = ``, nprice = [], ndate = new Date().toISOString();

            if (bprice != "") {
                
                let pspl = bprice.split("&&!");
                for (let a = 0; a < pspl.length;) {
                    let sd = pspl[a].split("&");

                    if (status == "1" || status == "3" || status == "4") {
                        
                        if (parseFloat(sd[1]) != parseFloat(uid)) {
                            old += old == "" ? `${sd[0]}&${sd[1]}&${sd[2]}` : `&&!${sd[0]}&${sd[1]}&${sd[2]}`;
                            nid += nid == "" ? `${sd[1]}` : `,${sd[1]}`;
                            nprice.push({ date: sd[0], id: parseFloat(sd[1]), price: parseFloat(sd[2]) });
                        }
                    } else if (status == "2") {
                        old += old == "" ? `${sd[0]}&${sd[1]}&${sd[2]}` : `&&!${sd[0]}&${sd[1]}&${sd[2]}`;
                        nid += nid == "" ? `${sd[1]}` : `,${sd[1]}`;
                        nprice.push({ date: sd[0], id: parseFloat(sd[1]), price: parseFloat(sd[2]) });
                    }
                    a++;
                }
            }

            let data, ids, prices;
            if (status == "1") {
                data = old == "" ? `${ndate}&${uid}&${price}` : `${ndate}&${uid}&${price}&&!${old}`;
                ids = nid == "" ? `${uid}` : `${uid},${nid}`;
                prices = nprice != "" ? [{ date: ndate, id: parseFloat(uid), price: parseFloat(price) }].concat(nprice) : [{ date: ndate, id: parseFloat(uid), price: parseFloat(price) }];
            } else {
                data = old; ids = nid; prices = nprice;
            }

            const general = await DataFind(`SELECT google_map_key, offer_time FROM tbl_general_settings`);
            let dtime = 0, dri_list = [], nid_list = [];
            if (ids != "") {
                
                let dr = await DriverReview("dr");
                let dri = await DataFind(`SELECT dr.id, dr.profile_image, dr.first_name, dr.last_name, dr.latitude, dr.longitude, 
                                        COALESCE(vec.name, "") AS car_name  ${dr.tot_review} ${dr.avgstar}
                                        FROM tbl_driver AS dr
                                        LEFT JOIN tbl_vehicle AS vec ON dr.vehicle = vec.id
                                        ${dr.outtable}
                                        WHERE dr.id IN (${ids}) AND dr.status = '1' AND dr.approval_status = '1' AND dr.latitude NOT IN ('') AND dr.longitude NOT IN ('')
                                        GROUP BY dr.id, dr.profile_image, dr.first_name, dr.last_name, vec.name ORDER BY dr.id DESC`);
                
                let firlat = rd[0].pic_lat_long, drop = "", droadd = "", def = (parseFloat(rd[0].tot_hour) * 60) + parseFloat(rd[0].tot_minute)
        
                if (firlat) {
                    let spl = firlat.split("&!"), das = rd[0].pic_address.split("&!")
                    drop = `${spl[0]},${spl[1]}`, droadd = das[0]

                    for (let i = 0; i < dri.length;) {
                        let dpri = [];
                        for (let b = 0; b < prices.length;) {
                            if (dri[i].id == prices[b].id) dpri.push(prices[b]);
                            b++;
                        }

                        if (status == "1") {
                            const general = await DataFind(`SELECT site_currency, currency_placement FROM tbl_general_settings`);
                            let pricespl = general[0].currency_placement == "1" ? `${price}${general[0].site_currency}` : `${general[0].site_currency}${price}`
                            let notification = `${dri[i].first_name} ${dri[i].last_name} is offering a ride to ${droadd} ${pricespl}`
                            
                            sendOneNotification(notification, 'customer', rd[0].c_id);
                        }
        
                        if (dpri != "") {
    
                            let diff_second = await CurrentDatetoOldDateS(dpri[0].date, general[0].offer_time);
                            if (parseFloat(diff_second) >= 0) {
                                if (parseFloat(diff_second) <= parseFloat(general[0].offer_time)) {
    
                                    let pickup = `${dri[i].latitude},${dri[i].longitude}`;
                                    let distance = await GetDistance(pickup, drop, general[0].google_map_key);
                                
                                    let tot_km = parseFloat((parseFloat(rd[0].tot_km) + parseFloat(distance.dis)).toFixed(2));
                                
                                    let spltime = distance.dur.split(" ");
                                    if (spltime.length == "2") dtime = parseFloat(spltime[0]);
                                    else dtime = (parseFloat(spltime[0]) * 60) + parseFloat(spltime[2]);
                                
                                    let min = parseFloat(def) + parseFloat(dtime);
                                    let tot_min = await CalculateMinuteToHour(min);

                                    dri[i].tot_review = parseFloat((dri[i].tot_review).toFixed(2)); dri[i].avg_star = parseFloat((dri[i].avg_star).toFixed(2));
                                    dri_list.push({ ...dri[i], request_id, price:dpri[0].price, tot_min, tot_km, diff_second });
        
                                } else nid_list.push(dri[i].id);
                            } else nid_list.push(dri[i].id);
                        }
                        i++;
                    }
                } 
            }

            if (status == "1" || status == "2" || status == "4") {
                if (await DataUpdate(`tbl_request_vehicle`, `bidding_d_price = '${data}'`, `id = '${rd[0].id}'`, hostname, protocol) == -1) {
                    return false;
                }
            } else {
                let d_id = rd[0].d_id, eidlist, reqmoveid;

                if (typeof d_id == "string") {
                    d_id = JSON.parse(d_id);
                    eidlist = d_id.filter(item => item != uid);
                    reqmoveid = JSON.stringify(eidlist);
                } else {
                    eidlist = d_id.filter(item => item != uid);
                    reqmoveid = JSON.stringify(eidlist);
                }

                if (await DataUpdate(`tbl_request_vehicle`, `d_id = '${reqmoveid}', bidding_d_price = '${data}'`, `id = '${rd[0].id}'`, hostname, protocol) == -1) {
                    return false;
                }
            }
            
            if (status == "1" || status == "4") return { bidding_list:dri_list, off_ex_time:general[0].offer_time };
            else return { bidding_list:dri_list, off_ex_time:general[0].offer_time, request_id: rd[0].id, c_id: rd[0].c_id, nid_list };

    } return false;
}



async function AcceptVehicleRide(uid, request_id, lat, lon, hostname, protocol, price, ndata) {
    if(!uid || !request_id || !lat || !lon) return 1;

    let rd
    if (ndata != "") rd = ndata;
    else rd = await DataFind(`SELECT * FROM tbl_request_vehicle WHERE id = '${request_id}' AND JSON_CONTAINS(d_id, '${uid}')`);
    if(rd == "") return 2;

    const driver = await DataFind(`SELECT * FROM tbl_driver WHERE id = '${uid}'`);
    if(driver == "") 3;

    let otp = await otpGenerate(4), jsonuid = JSON.stringify([parseFloat(uid)]), requestid = 0;

    if (await DataUpdate(`tbl_request_vehicle`, `d_id = '${jsonuid}'`, `id = '${rd[0].id}'`, hostname, protocol) == -1) return "databaseerror";
    if (await DataUpdate(`tbl_driver`, `rid_status = '1'`, `id = '${driver[0].id}'`, hostname, protocol) == -1) return "databaseerror";
    
    const check = await DataFind(`SELECT * FROM tbl_cart_vehicle WHERE c_id = '${rd[0].c_id}' AND d_id = '${uid}'`);

    let dropcount = rd[0].drop_lat_long.split("&!!").length;
    let fulldate = await TodatDate(), updatet = "", nprice = 0

    if (rd[0].bidding_status == "1") {
        updatet = `0&${rd[0].start_time}&$0&$0&!!1&${fulldate.date}T${fulldate.time}&${driver[0].latitude}&${driver[0].latitude}`;
        if (rd[0].bidd_auto_status == "0") {
            if (price == "0") nprice = rd[0].price;
            else nprice = price;
        } else nprice = rd[0].price;
    } else {
        updatet = `0&${rd[0].start_time}&$0&$0&!!1&${fulldate.date}T${fulldate.time}&${lat}&${lon}`;
        nprice = rd[0].price;
    }

    let ntime = `1&${rd[0].tot_hour}&${rd[0].tot_minute}`; // status_time
    let current_time = `${fulldate.date}T${fulldate.time}&${rd[0].tot_hour}&${rd[0].tot_minute}`; // current_run_time

    let idlist = rd[0].d_id, d_id, eidlist, reqmoveid;
    if (typeof idlist == "string") {
        d_id = JSON.parse(idlist);
        eidlist = d_id.filter(item => item != uid);
        reqmoveid = JSON.stringify(eidlist);
    } else {
        eidlist = idlist.filter(item => item != uid);
        reqmoveid = JSON.stringify(eidlist);
    }
    
        let indata = await DataInsert(`tbl_cart_vehicle`, `c_id, d_id, vehicleid, bidding_status, bidd_auto_status, price, final_price, paid_amount, coupon_amount, addi_time_price, 
            platform_fee, weather_price, wallet_price, tot_km, tot_hour, tot_minute, status, payment_id, m_role, coupon_id, start_time, otp, additional_time, ride_status, drop_tot, 
            drop_complete, current_run_time, status_time, status_time_location, status_calculation, pic_lat_long, drop_lat_long, pic_address, drop_address, driver_id_list, req_id`,
            `'${rd[0].c_id}', '${uid}', '${rd[0].vehicleid}', '${rd[0].bidding_status}', '${rd[0].bidd_auto_status}', '${nprice}', '0', '0', '0', '0', '0', '0', '0', '${rd[0].tot_km}', 
            '${rd[0].tot_hour}', '${rd[0].tot_minute}', '1', '${rd[0].payment_id}', '${rd[0].m_role}', '${rd[0].coupon_id}', '${fulldate.date}T${fulldate.time}', '${otp}', '0', '0', 
            '${dropcount}', '', '${current_time}', '${ntime}', '${updatet}', '', '${rd[0].pic_lat_long}', '${rd[0].drop_lat_long}', '${rd[0].pic_address}', '${rd[0].drop_address}', 
            '${reqmoveid}', '${rd[0].id}'`, hostname, protocol);
            
        if (indata == -1) return "databaseerror";
        
        requestid = indata.insertId;

    if (await DataDelete(`tbl_request_vehicle`, `id = '${rd[0].id}'`, hostname, protocol) == -1) return "databaseerror";

    await AllChat.Chat_Save(uid, uid, rd[0].c_id, "🚗 Your Trip Has Started!", "driver", hostname, protocol);

    let message = "📍 Your Captain is on the way!\n"+
                    "Captain " + driver[0].first_name +" "+ driver[0].last_name + " will arrive shortly."
    await AllChat.Chat_Save(uid, uid, rd[0].c_id, message, "driver", hostname, protocol);
    
    return { requestid: requestid, reqmoveid };
}



async function AllVehicleFormate(com_request, number) {
    let comreq = com_request.map(async(rdata) => {
        
        let data = await VehicleAllRide(rdata, number);
        rdata.price = parseFloat(rdata.price);
        rdata.addi_time = parseFloat(rdata.additional_time);
        
        let spldate = rdata.status_time_location.split("&!!"), starttime = "", run_time = { hour: 0, minute: 0, second: 0, status: 0 };
        
        if (rdata.status != '0') starttime = await DateFormate(spldate[0].split("&")[1]);
        
        run_time = await TimeDistance(rdata);
        
        if (rdata.m_role == "1") rdata.m_role = "Vehicle";
        if (rdata.m_role == "2") rdata.m_role = "Outstation";
        if (rdata.m_role == "3") rdata.m_role = "Rental";
        if (rdata.m_role == "4") rdata.m_role = "Package";

        rdata.start_time = starttime; rdata.tot_drop = data.drop_tot; rdata.run_time = run_time; rdata.pickup = data.piclatlon; rdata.drop = data.dropdata; rdata.drop_list = data.droplist;
        delete rdata.current_run_time; delete rdata.pic_lat_long; delete rdata.drop_lat_long; delete rdata.drop_lat_long; delete rdata.pic_address; delete rdata.drop_address; 
        delete rdata.status_time_location; delete rdata.coupon_id; delete rdata.additional_time; delete rdata.comission_rate; delete rdata.comission_type  
        return rdata
    })
    let complete_request = await Promise.all(comreq);
    return complete_request;
}



async function SetNewTimeFormate(nDate) {
    let currentTime = new Date(nDate);
    
    let hours = currentTime.getHours(), minutes = currentTime.getMinutes();
    let ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;

    let formattedTime = hours + ':' + minutes + ' ' + ampm;
    return formattedTime
}



async function PaymentCalculation(mapdata, status) {
    const general = await DataFind(`SELECT * FROM tbl_general_settings`);
    let mapd = status == "1" ? mapdata[0] : mapdata
    let price = parseFloat(mapd.price), coupon_amount = 0, final_price = parseFloat(mapd.price), platform_fee = 0, addi_time_price = 0, addi_time = 0, weather_price = 0;

    if (parseFloat(general[0].driver_wait_price) != "NaN" && typeof parseFloat(general[0].driver_wait_price) == "number") {
        if (mapd.additional_time ||mapd.additional_time != "0") {
            let totmin = parseFloat(mapd.additional_time);
            
            addi_time_price = parseFloat(totmin) * parseFloat(general[0].driver_wait_price);
            addi_time = totmin;
            final_price += addi_time_price;
        } 
    }

    if (mapd.coupon_id || mapd.coupon_id != "") {
        const coupon = await DataFind(`SELECT * FROM tbl_coupon WHERE id = '${mapd.coupon_id}' `);
        if (coupon != "") {
            if (parseFloat(coupon[0].min_amount) <= parseFloat(mapd.price)) {
                coupon_amount = parseFloat(coupon[0].discount_amount);
                final_price -= parseFloat(coupon[0].discount_amount);
            }
        }
    }

    if (mapd.comission_rate && mapd.comission_type) {
        if (mapd.comission_type == "FIX") {
            platform_fee = parseFloat(mapd.comission_rate); final_price += parseFloat(mapd.comission_rate);
        } else {
            let amount = final_price / parseFloat(mapd.comission_rate);
            platform_fee = amount; 
            final_price += amount;
        }
    }

    let veh_list = await DataFind(`SELECT * FROM tbl_vehicle WHERE id = '${mapd.vehicleid}' AND status = '1'`);
    
    if (veh_list != "") {
        if (veh_list[0].whether_charge == "1") {
            if (parseFloat(general[0].weather_price) != "NaN" && typeof parseFloat(general[0].weather_price) == "number" && parseFloat(general[0].weather_price) != 0 ) {
                if (general[0].weather_type == "FIX") {
                    weather_price = parseFloat(general[0].weather_price); 
                    final_price += parseFloat(general[0].weather_price);
                } else {
                    let wamount = final_price / parseFloat(general[0].weather_price);
                    weather_price = parseFloat((wamount).toFixed(2)); 
                    final_price += wamount;
                }
            }
        }
    }
    let fprice = parseFloat((parseFloat(final_price)).toFixed(2));

    if (status == "1") mapd.coupon_amount = coupon_amount; mapd.platform_fee = platform_fee; mapd.final_price = fprice; mapd.price = parseFloat(mapd.price); 
                        mapd.weather_price = parseFloat(weather_price);

    return { mapdata:mapd, coupon_amount, final_price: fprice, platform_fee, addi_time_price, addi_time, weather_price }
}



async function PriceCalculation(rd, hostname, protocol) {
    const general = await DataFind(`SELECT driver_wait_price, google_map_key FROM tbl_general_settings`);

    let price = parseFloat(rd[0].price), final_price = parseFloat(rd[0].price), coupon_amount = 0, addi_time_price = 0, addi_time = 0, platform_fee = 0, weather_price = 0;

    let cprice = await PaymentCalculation(rd, 1)
    final_price = cprice.final_price; coupon_amount = cprice.coupon_amount; addi_time_price = cprice.addi_time_price; addi_time = cprice.addi_time; platform_fee = cprice.platform_fee; 
    weather_price = cprice.weather_price

    let picadd = [], pads = rd[0].pic_address.split("&!"), splsta = rd[0].status_time_location.split("&!!"), firsttime = "", pickkm = 0, picktime = 0, status_cal = [], cal = 0, 
    savedata = "";
    let dradd = rd[0].drop_address.split("&!!"), totkm = 0, totmin = 0

    picadd.push({ title: pads[0], subtitle: pads[1] });

    for (let b = 0; b < dradd.length;) {
        let addspl = dradd[b].split("&!");
        picadd.push({ title: addspl[0], subtitle: addspl[1] });
        b++ 
    }

    for (let a = 0; a < splsta.length; ) {
        let check = splsta[a].split("&");

        if (parseFloat(check[0]) < 4) {
            
            if (parseFloat(check[0]) == 1) {
                
                let checkn = splsta[a+1].split("&");
                
                let pickup = `${parseFloat(check[2])},${parseFloat(check[3])}`, drop = `${parseFloat(checkn[2])},${parseFloat(checkn[3])}`;
                let ftime = await GetDistance(pickup, drop, general[0].google_map_key);

                if (parseFloat(check[0]) ==  1) firsttime = await SetNewTimeFormate(check[1]);
                pickkm += parseFloat(ftime.dis);

                let spltime = ftime.dur.split(" ");
                if (spltime.length == "2") picktime += parseFloat(spltime[0]);
                else picktime += (parseFloat(spltime[0]) * parseFloat(60)) + parseFloat(spltime[2]);

                status_cal.push({ title: 'Order Accepted', subtitle: "", date: firsttime, tot_km: pickkm, tot_time: picktime } );
                savedata += `Order Accepted&&${firsttime}&${pickkm}&${picktime}`;
                totmin += picktime; 
                totkm += pickkm
            } 


        } else if (parseFloat(check[0]) > 4 && parseFloat(check[0]) < 7) {
            let scheckn = splsta[a+1].split("&");

            if (parseFloat(check[0]) == 5 && parseFloat(scheckn[0]) == 6 || parseFloat(check[0]) == 5 && parseFloat(scheckn[0]) == 7) {

                let spickup = `${parseFloat(check[2])},${parseFloat(check[3])}`, sdrop = `${parseFloat(scheckn[2])},${parseFloat(scheckn[3])}`;
                let time = await GetDistance(spickup, sdrop, general[0].google_map_key);
                let dtime = await SetNewTimeFormate(check[1]), droptime = 0;

                let spltime = time.dur.split(" ");
                if (spltime.length == "2") droptime += parseFloat(spltime[0]);
                else droptime += (parseFloat(spltime[0]) * parseFloat(60)) + parseFloat(spltime[2]);
                totmin += droptime; 
                totkm += time.dis

                if (parseFloat(check[0]) == 5 && parseFloat(scheckn[0]) == 6) {
                    
                    status_cal.push({ title: picadd[cal].title, subtitle: picadd[cal].subtitle, date: dtime, tot_km: time.dis, tot_time: droptime } )
                    savedata += `&!!${picadd[cal].title}&${picadd[cal].subtitle}&${dtime}&${time.dis}&${droptime}`
                }
                if (parseFloat(check[0]) == 5 && parseFloat(scheckn[0]) == 7) {
                    
                    status_cal.push({ title: picadd[cal].title, subtitle: picadd[cal].subtitle, date: dtime, tot_km: time.dis, tot_time: droptime },
                                    { title: picadd[cal + 1].title, subtitle: picadd[cal + 1].subtitle, date: 0, tot_km: 0, tot_time: 0 });

                    savedata += `&!!${picadd[cal].title}&${picadd[cal].subtitle}&${dtime}&${time.dis}&${droptime}`
                    savedata += `&!!${picadd[cal + 1].title}&${picadd[cal + 1].subtitle}&0&0&0`
                }
                cal++;
            }
        }
        a++;
    }

    if (await DataUpdate(`tbl_cart_vehicle`, `final_price = '${final_price}', coupon_amount = '${coupon_amount}', addi_time_price = '${addi_time_price}', 
        platform_fee = '${platform_fee}', weather_price = '${weather_price}', tot_km = '${totkm}', tot_hour = '0', tot_minute = '${totmin}' ,status_calculation = '${savedata}'`, 
    `id = '${rd[0].id}'`, hostname, protocol) == -1) return 4;

    return {price, final_price, coupon_amount, addi_time, addi_time_price, platform_fee, status_cal, weather_price}
}



async function VehiclePaymentCal(uid, c_id, request_id, role, hostname, protocol) {
    let price_list, pa, add_calcu = [];
    const review_list = await DataFind(`SELECT * FROM tbl_ride_review_reason WHERE status = '1'`);

    if (role == "1") {
        const rd = await DataFind(`SELECT veh.*, COALESCE(cus.name, '') AS cname, COALESCE(vdata.comission_rate, '') AS comission_rate, COALESCE(vdata.comission_type, '') AS comission_type 
                            FROM tbl_cart_vehicle AS veh
                            JOIN tbl_customer AS cus ON veh.c_id = cus.id
                            JOIN tbl_vehicle AS vdata ON veh.vehicleid = vdata.id
                            WHERE veh.id = '${request_id}' AND veh.c_id = '${c_id}' AND veh.d_id = '${uid}'`);
        
        if (rd == "") return 1;
        if (parseFloat(rd[0].status) > 7) return 2;
        if (rd[0].final_price == "0" && rd[0].status_calculation == "") {
            pa = await PriceCalculation(rd, hostname, protocol);
            add_calcu = pa.status_cal;
        } else {
            pa = rd[0];
            let timespl = rd[0].status_calculation.split("&!!");
            
            for (let a = 0; a < timespl.length;) {
                let spl = timespl[a].split("&");
                add_calcu.push({ title: spl[0], subtitle: spl[1], date: spl[2], tot_km: spl[3], tot_time: spl[4] });
                a++;
            }
        }

        add_calcu.map(aval => {
            aval.date = (aval.date).toString(); aval.tot_km = (aval.tot_km).toString(); aval.tot_time = (aval.tot_time).toString(); 
            return aval;
        })

        if (pa == 3) return 3;
        if (pa == 4) return 4;

        const payment = await DataFind(`SELECT id, image, name FROM tbl_payment_detail WHERE id = '${rd[0].payment_id}' AND status = '1'`);

        price_list = {cus_name: rd[0].cname, tot_price:parseFloat(pa.price), final_price:pa.final_price, coupon_amount:pa.coupon_amount, addi_time_price:pa.addi_time_price, 
                    platform_fee:pa.platform_fee, weather_price:pa.weather_price, addi_time:pa.addi_time };
        return { price_list, payment, add_calcu, review_list };
    } 

    if (role == "2") {
        const rd = await DataFind(`SELECT veh.*, COALESCE(dri.first_name, '') AS first_name, COALESCE(dri.last_name, '') AS last_name, COALESCE(vdata.comission_rate, '') AS comission_rate,
                            COALESCE(vdata.comission_type, '') AS comission_type 
                            FROM tbl_cart_vehicle AS veh
                            JOIN tbl_driver AS dri ON veh.d_id = dri.id
                            JOIN tbl_vehicle AS vdata ON veh.vehicleid = vdata.id
                            WHERE veh.id = '${request_id}' AND veh.c_id = '${c_id}' AND veh.d_id = '${uid}'`);

        if (rd == "") return 1;
        if (parseFloat(rd[0].status) > 7) return 2;
        if (rd[0].final_price == "0") pa = await PriceCalculation(rd, hostname, protocol);
        else pa = rd[0];

        if (pa == 3) return 3;
        if (pa == 4) return 4;
              
        const payment = await DataFind(`SELECT id, image, name FROM tbl_payment_detail WHERE id = '${rd[0].payment_id}' AND status = '1'`);

        // Customer
        price_list = {first_name: rd[0].first_name, last_name: rd[0].last_name, tot_price:pa.price, final_price:pa.final_price, coupon_amount:pa.coupon_amount, addi_time_price:pa.addi_time_price, 
                    platform_fee:pa.platform_fee, weather_price:pa.weather_price, addi_time:pa.addi_time};
        return { price_list, payment, review_list };
    }

}



// ============= Convert Day  ================ //

async function DateConvertDay(walletd) {
    const all_data = [];
    walletd.forEach(item => {
        const dateString = new Date(item.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        let existingDateEntry = all_data.find(entry => entry.date === dateString);
        
        if (!existingDateEntry) {
            existingDateEntry = {
                date: dateString,
                detail: []
            };
            all_data.push(existingDateEntry);
        }
        item.date = new Date(item.date).toISOString().split("T")[0];
        existingDateEntry.detail.push(item);
    });
    return all_data
}



async function CustomerReview(tname) {
    let tot_review = `, COALESCE(COUNT(DISTINCT cr.id), 0) AS tot_review`
    let avgstar = `, CASE 
                    WHEN COUNT(cr.customer_id) > 0 THEN 
                        CASE
                            WHEN (SUM(cr.tot_star) / COUNT(cr.customer_id)) % 1 >= 0.25 
                                AND (SUM(cr.tot_star) / COUNT(cr.customer_id)) % 1 < 0.75 
                            THEN ROUND((SUM(cr.tot_star) / COUNT(cr.customer_id)) * 2) / 2
                            ELSE ROUND(SUM(cr.tot_star) / COUNT(cr.customer_id))
                        END
                    ELSE 0 
                END AS avg_star`

    let table = `LEFT JOIN tbl_review_customer AS cr ON cr.customer_id = ${tname}.c_id`
    let outtable = `LEFT JOIN tbl_review_customer AS cr ON cr.customer_id = ${tname}.id`
    return { tot_review, avgstar, table, outtable }
}



async function DriverReview(tname) {
    let tot_review = `, COALESCE(COUNT(DISTINCT cr.id), 0) AS tot_review`
    let avgstar = `, CASE 
                    WHEN COUNT(cr.driver_id) > 0 THEN 
                        CASE
                            WHEN (SUM(cr.tot_star) / COUNT(cr.driver_id)) % 1 >= 0.25 
                                AND (SUM(cr.tot_star) / COUNT(cr.driver_id)) % 1 < 0.75 
                            THEN ROUND((SUM(cr.tot_star) / COUNT(cr.driver_id)) * 2) / 2
                            ELSE ROUND(SUM(cr.tot_star) / COUNT(cr.driver_id))
                        END
                    ELSE 0 
                END AS avg_star`

    let table = `LEFT JOIN tbl_review_driver AS cr ON cr.driver_id = ${tname}.d_id`;
    let outtable = `LEFT JOIN tbl_review_driver AS cr ON cr.driver_id = ${tname}.id`;
    return { tot_review, avgstar, table, outtable };
}



async function CalculateMinuteToHour(minute) {
    let a = parseFloat(minute);
    let hour = Math.floor(a / 60);
    let min = a % 60;
    let totm = `${hour}.${min.toString().padStart(2, '0')}`;
    return parseFloat(totm);
}

async function MinuteToHour(minute) {
    let a = parseFloat(minute);
    let hour = Math.floor(a / 60);
    let min = a % 60;
    let totm = `${hour}.${min.toString().padStart(2, '0')}`;
    return {hour: parseFloat(hour), minute: parseFloat(min) };
}




async function TimeUpdate(homemessage, hostname, protocol) {
    const {uid, c_id, request_id, time} = homemessage;
    if(!uid || !c_id || !request_id || !time) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });

    const check = await DataFind(`SELECT * FROM tbl_cart_vehicle WHERE id = '${request_id}' AND c_id = '${c_id}' AND d_id = '${uid}'`);
    if (check == "") return { ResponseCode: 401, Result:false, message: 'Request Not Found!' };

    let fulldate = await AllFunction.TodatDate();

    let ntime = check[0].status_time != "" ? `${check[0].status_time}&!!${check[0].status}&0&${time}` : `${check[0].status}&0&${time}`; // status_time
    let current_time = `${fulldate.date}T${fulldate.time}&0&${time}`; // current_run_time

    if (await DataUpdate(`tbl_cart_vehicle`, `tot_hour = '0', tot_minute = '${time}', status_time = '${ntime}', current_run_time = '${current_time}'`, 
        `id = '${check[0].id}'`, hostname, protocol) == -1) {
        return { ResponseCode: 401, Result:false, message: process.env.dataerror };
    }
    return true;
}



async function DriverNewRequestData(uid, request_id, sttaus) {
    if(!uid || !request_id) 1

    let dr = await AllFunction.CustomerReview("rvd");
    let rdata = await DataFind(`SELECT rvd.*, COALESCE(cus.id, "") AS cus_id, COALESCE(cus.name, "") AS name, COALESCE(cus.country_code, "") AS country_code,
                                COALESCE(cus.phone, "") AS phone ${dr.tot_review} ${dr.avgstar}
                                FROM tbl_request_vehicle AS rvd
                                LEFT JOIN tbl_customer AS cus ON rvd.c_id = cus.id
                                ${dr.table}
                                WHERE rvd.id = '${request_id}' AND JSON_CONTAINS(rvd.d_id, '${uid}') GROUP BY rvd.id ORDER BY id DESC`);

    if (rdata == "") {
        rdata = await DataFind(`SELECT rvd.*, COALESCE(cus.id, "") AS cus_id, COALESCE(cus.name, "") AS name,
                                COALESCE(cus.country_code, "") AS country_code, COALESCE(cus.phone, "") AS phone 
                                ${dr.tot_review} ${dr.avgstar}
                                FROM tbl_cart_vehicle AS rvd
                                LEFT JOIN tbl_customer AS cus ON rvd.c_id = cus.id
                                ${dr.table}
                                WHERE rvd.id = '${request_id}' AND rvd.d_id = '${uid}'
                                GROUP BY rvd.id ORDER BY rvd.id DESC;`);

        if (rdata == "") 2
    }
    
    let request_data = []
    if (sttaus == "0") request_data = await DriverRequestData(rdata);   
    else return 0

    return {request_data:request_data[0]}
}



const AllFunction = { otpGenerate, ZoneLatlon, CheckZone, GetDistance, DriverUpdate, ZoneData, AddDateMinute, TodatDate, RadiusCheck, DriverRequestData, CheckBodyData, 
                    CheckCurrentLocation, CheckSocketData, SendDriverLatLong, VehicleRideStartEndData, VehicleAllRide, DateFormate, AllVehicleFormate, VehiclePaymentCal, 
                    TwoTimeDifference, FirstTime, SecoundTime, SetNewTimeFormate, DateConvertDay, PaymentCalculation, RideAddress, ConvertDateFormat, ConvertFullDateFormat, TimeUpdate,
                    CustomerReview, DriverReview, CalculateMinuteToHour, PriceCalculation, VehicleBidding, MinuteToHour, AcceptVehicleRide, DriverNewRequestData, CurrentDatetoOldDateS }

module.exports = AllFunction