const AllFunction = require("../route_function/function")
const AllChat = require("../route_function/chat_function")
const schedule = require('node-schedule');
// const { AddDriveLocation, RemoveDriveLocation, UpdateDriveLocation } = require("./js/map_driver_location");
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/databse_query");
let activeSchedules = [];

function publicsocket (io) {

io.on('connection', (socket) => {
    // console.log('Socket connected:', socket.id);

    // // Customer Home
    socket.on('home', async (message) => {
        // console.log('home');
        
        socket.broadcast.emit('home', message);
    })
    

    // // Home Map
    socket.on('homemap', async (homemessage) => {
        try {
            console.log("homemap");
            console.log(homemessage);
            
            const hostname = socket.request.headers.host;
            const protocol = socket.request.connection.encrypted ? 'https' : 'http';

            const {uid, lat, long, status} = homemessage;
            const missingField = await AllFunction.CheckSocketData(homemessage, ["uid", "lat", "long", "status"]);

            const dri = await DataFind(`SELECT dr.id, dr.zone, COALESCE(ve.map_img, '') AS image, COALESCE(ve.name, '') AS name, COALESCE(ve.description, '') AS description, 
                                        COALESCE(dr.latitude, '') AS latitude, COALESCE(dr.longitude, '') AS longitude, dr.fstatus, dr.rid_status, dr.check_status
                                        FROM tbl_driver AS dr
                                        JOIN tbl_vehicle AS ve ON dr.vehicle = ve.id
                                        WHERE dr.id = '${uid}' AND dr.status = '1'`);

            // const dri = await DataFind(`SELECT id, profile_image, , fstatus, rid_status, check_status FROM tbl_driver WHERE id = '${uid}' AND status = '1'`);

            if(!missingField && dri != "") {
                let check_status = "0", homemap = 0, vdriloc = 0;
                
                if (dri[0].rid_status == "0") homemap = 1;
                if (dri[0].rid_status == "1") {
                    if (dri[0].check_status == "0") homemap = 1;
                    else homemap = 0;
                    check_status = "1"; vdriloc = 1;
                }
                
                if (await DataUpdate(`tbl_driver`, `latitude = '${lat}', longitude = '${long}', fstatus = '${status == "on" ? 1 : 0}', check_status = '${check_status}'`,
                    `id = '${dri[0].id}'`, hostname, protocol) == -1) {
                    return socket.emit('database_error', { ResponseCode: 401, Result: false, message: process.env.dataerror});
                }

                if (homemap == "1") {
                    // console.log("homemap 111");
                    // console.log(homemessage);

                    let zsplir = dri[0].zone.split(",");

                    let id_lidt = zsplir.map(val => {return parseFloat(val)});
                    let data = {id: dri[0].id, image: dri[0].image, name: dri[0].name, description: dri[0].description, latitude: dri[0].latitude, longitude: dri[0].longitude, zone_list:id_lidt}
                    // console.log(data);
                    
                    if (dri[0].fstatus == "0" && status == "on") {
                        console.log("Driver_location_On");
                        socket.broadcast.emit('Driver_location_On', data);
                    }
                    else if (dri[0].fstatus == "1") {
                        if (status == "off") {
                            console.log("Drive_location_Off");
                            socket.broadcast.emit('Drive_location_Off', data);
                        }
                        if (status == "on") {
                            console.log("Driver_location_Update");
                            socket.broadcast.emit('Driver_location_Update', data);
                        }
                    }
                }

                if (vdriloc == 1) {
                    let ddata = await AllFunction.SendDriverLatLong(uid);
                    // console.log(ddata);
                    if (ddata.driver != "" && ddata.data != "") {
                        // console.log("homemap 222");
                        let d = ddata.data
                        for (let i = 0; i < d.length;) {
                            // console.log(111);
                            
                            socket.broadcast.emit(`V_Driver_Location${d[i].c_id}`, {d_id : uid, driver_location:ddata.driver[0]});
                            i++
                        }
                    }
                }
            }
        } catch (error) {
            console.error(error);
            return socket.emit('database_error', { ResponseCode: 401, Result: false, message: process.env.dataerror});
        }
    })



    // // Send Vehicle Ride Request 
    socket.on('vehiclerequest', (homemessage) => {
        console.log("vehiclerequest");
        console.log(homemessage);
        
        socket.broadcast.emit('vehiclerequest', homemessage)
    })

    // // Send Vehicle Bidding Request
    socket.on('Vehicle_Bidding', async (homemessage) => {
        console.log("Vehicle_Bidding");
        console.log(homemessage);
        
        const {uid, request_id, c_id, price, status} = homemessage;

        const hostname = socket.request.headers.host;
        const protocol = socket.request.connection.encrypted ? 'https' : 'http';

        if (status == "1") {
            console.log("status");
            
            let ddata = await AllFunction.VehicleBidding(uid, request_id, price, 1, hostname, protocol);
            console.log(ddata);
    
            if (ddata != false) {
                socket.broadcast.emit(`Vehicle_Bidding${c_id}`, ddata);
                
                if (parseFloat(ddata.off_ex_time) > 0) {
                    
                    let addtime = parseFloat(ddata.off_ex_time);
                    let job = schedule.scheduleJob(new Date(Date.now() + parseFloat(addtime) * 1000), async function() {
                        console.log("Remove List Run");
                        console.log("Remove List Run");
                        console.log("Remove List Run");
        
                        let checkdata = 0;
                        activeSchedules.forEach(val => {
                            if (val.request_id == request_id && val.d_id == uid  && val.c_id == c_id) checkdata++
                        })
                        
                        if (checkdata > 0) {
                            console.log(111);
                            let ddatas = await AllFunction.VehicleBidding(uid, request_id, price, 2, hostname, protocol);
                            console.log(222);
                            console.log(ddatas);

                            
                            if (ddatas != false) {
                                let dlidt = ddatas.nid_list, req_id = ddatas.request_id;
                                
                                socket.broadcast.emit(`Vehicle_Bidding${ddatas.c_id}`, { bidding_list: ddatas.bidding_list, off_ex_time: ddatas.off_ex_time });
                                console.log(dlidt);

                               
                            }
                        }
                        
                    });
        
                    activeSchedules.push({ request_id, d_id: uid, c_id, job });
                }
    
                console.log("activeSchedules");
                console.log("activeSchedules");
                console.log("activeSchedules");
            }
        }

        if (status == "2") {
            console.log("Vehicle_Bidding");
            console.log(homemessage);

            let ndata = [];
            activeSchedules.forEach(val => {
                if (val.request_id == request_id && val.d_id == uid  && val.c_id == c_id) val.job.cancel();
                else ndata.push();
            })
            activeSchedules = ndata;

            let remove = await AllFunction.VehicleBidding(uid, request_id, price, 3, hostname, protocol);
            console.log(remove);
            console.log(remove.c_id);
            console.log("Vehicle_Bidding");
            
            if (remove != false) {
                socket.broadcast.emit(`Vehicle_Bidding${remove.c_id}`, { bidding_list: remove.bidding_list, off_ex_time: remove.off_ex_time });
            }
        }
    })

    

    // // Vehicle Request TimeOut 
    socket.on('Accept_Bidding', async(homemessage) => {
        console.log("Accept_Bidding");
        console.log(homemessage);
        
        const { uid, d_id, price, request_id } = homemessage;
        const missingField = await AllFunction.CheckSocketData(homemessage, ["uid", "d_id", "price", "request_id"]);
        
        if (!missingField) {

            const rd = await DataFind(`SELECT * FROM tbl_request_vehicle WHERE id = '${request_id}' AND JSON_CONTAINS(d_id, '${d_id}')`);
            if (rd != "") {

                let ndata = [];
                activeSchedules.forEach(val => {
                    if (val.request_id == request_id) val.job.cancel();
                    else ndata.push();
                })
                activeSchedules = ndata;

                const hostname = socket.request.headers.host;
                const protocol = socket.request.connection.encrypted ? 'https' : 'http';

                const accept = await AllFunction.AcceptVehicleRide(d_id, request_id, "0", "0", hostname, protocol, price, rd);

                if(accept != "1" && accept != "2" && accept != "3" && accept != "databaseerror") {
                    let idl = accept.reqmoveid
                    if (typeof idl == "string") idl = JSON.parse(accept.reqmoveid);
                    socket.broadcast.emit('AcceRemoveOther', { requestid: accept.requestid, driverid: idl});
                    socket.broadcast.emit(`Accept_Bidding${d_id}`, {requestid:accept.requestid});
                }
            }
        }
    })


    
    // // Vehicle Bidding Decline
    socket.on('Bidding_decline', async(homemessage) => {
        console.log("Bidding_decline");
        console.log(homemessage);

        const { uid, id, request_id } = homemessage;
        const missingField = await AllFunction.CheckSocketData(homemessage, ["uid", "id", "request_id"]);

        if (!missingField) {
            const hostname = socket.request.headers.host;
            const protocol = socket.request.connection.encrypted ? 'https' : 'http';
    
            const accept = await AllFunction.VehicleBidding(id, request_id, "0", 4, hostname, protocol);
    
            if (accept != false) {
                
                
                let ndata = [];
                console.log("Bidding_decline");
                console.log("Bidding_decline");
                console.log("Bidding_decline");
                console.log(activeSchedules);
                activeSchedules.forEach(val => {
                    console.log(val);
                    
                    if (val.request_id == request_id && val.d_id == id  && val.c_id == uid) {
                        console.log("Bidding_decline");
                        console.log("Bidding_decline");
                        console.log("Bidding_decline");
                        console.log("Bidding_decline");
                        console.log("Bidding_decline");
                        console.log("Bidding_decline");
                        val.job.cancel();
                    }
                    else ndata.push();
                })
                activeSchedules = ndata;

                socket.emit(`Vehicle_Bidding${uid}`, accept);
                socket.broadcast.emit(`Bidding_decline${id}`, {request_id: request_id});
            }
        }
    })



    // // Vehicle Request TimeOut 
    socket.on('RequestTimeOut', (homemessage) => {
        socket.broadcast.emit('RequestTimeOut', homemessage);
    })

    // // Accept Vehicle Ride Request   { uid: '14', request_id: '27', c_id: '20' }
    socket.on('acceptvehrequest', async (homemessage) => {
        console.log("acceptvehrequest");
        console.log(homemessage);

        const {uid, request_id, c_id} = homemessage;

        let ddata = await AllFunction.SendDriverLatLong(homemessage.uid);
        // console.log(ddata);

        const rd = await DataFind(`SELECT id, driver_id_list FROM tbl_cart_vehicle WHERE id = '${request_id}' AND c_id = '${c_id}' AND d_id = '${uid}'`);
        if (rd != "") {
            let idlist = rd[0].driver_id_list
            if (typeof idlist == "string") idlist = JSON.parse(idlist);
            socket.broadcast.emit('AcceRemoveOther', { requestid:request_id, driverid: idlist});
        }

        socket.broadcast.emit(`acceptvehrequest${c_id}`, homemessage);

        if (ddata.driver != "" && ddata.data != "") {
            let d = ddata.data;
            // console.log(1111111111111);
            // console.log(`V_Driver_Location${homemessage.c_id}`);
            for (let i = 0; i < d.length;) {
                socket.broadcast.emit(`V_Driver_Location${d[i].c_id}`, {d_id : homemessage.uid, driver_location:ddata.driver[0]});
                i++;
            }
        }
    })

    // // Accept Vehicle Ride Request AND Remove other driver
    socket.on('AcceRemoveOther', (homemessage) => {
        
        
        socket.broadcast.emit('AcceRemoveOther', homemessage);
    })

    // // Vehicle Ride Time Update
    socket.on('Vehicle_Time_update', async (homemessage) => {
        const hostname = socket.request.headers.host;
        const protocol = socket.request.connection.encrypted ? 'https' : 'http';

        let date = await AllFunction.TimeUpdate(homemessage, hostname, protocol)
        if (date === true) socket.broadcast.emit(`Vehicle_Time_update${homemessage.c_id}`, homemessage);
    })

    // // Vehicle Ride Time Over Request
    socket.on('Vehicle_Time_Request', async (homemessage) => {
       

        socket.broadcast.emit(`Vehicle_Time_Request${homemessage.d_id}`, homemessage);
    })

    // // Driver Request Accept And Cancel
    socket.on('Vehicle_Accept_Cancel', async(homemessage) => {
        console.log("Vehicle_Accept_Cancel");
        console.log(homemessage);
        const {uid, request_id, c_id} = homemessage;

        const missingField = await AllFunction.CheckSocketData(homemessage, ["uid", "request_id", "c_id"]);
        if (!missingField) socket.broadcast.emit(`Vehicle_Accept_Cancel${c_id}`, { request_id, d_id: uid });
    })

    // // Rider Pick Customer
    socket.on('Vehicle_D_IAmHere', (homemessage) => {
        socket.broadcast.emit('Vehicle_D_IAmHere', homemessage);
    })

    // // Rider Cancel
    socket.on('Vehicle_Ride_Cancel', (homemessage) => {
        socket.broadcast.emit('Vehicle_Ride_Cancel', homemessage);
    })

    // // Rider OTP
    socket.on('Vehicle_Ride_OTP', (homemessage) => {
        socket.broadcast.emit('Vehicle_Ride_OTP', homemessage);
    })



    // // Rider Start And End   { uid: '14', request_id: '27', c_id: '20' }
    socket.on('Vehicle_Ride_Start_End', async (homemessage) => {
        const {uid, c_id, request_id} = homemessage;

        // uid, d_id, request_id
        let dropdata = await AllFunction.VehicleRideStartEndData(uid, c_id, request_id);
        let ddata = await AllFunction.SendDriverLatLong(uid);
        // console.log(ddata);

        socket.broadcast.emit(`Vehicle_Ride_Start_End${c_id}`, dropdata);

        if (ddata.driver != "" && ddata.data != "") {
            let d = ddata.data;
            for (let i = 0; i < d.length;) {
                console.log("V_Driver_Location");
                socket.broadcast.emit(`V_Driver_Location${d[i].c_id}`, {d_id : homemessage.uid, driver_location:ddata.driver[0]});
                i++;
            }
        }

        if (dropdata.status == "7") {

            const hostname = socket.request.headers.host;
            const protocol = socket.request.connection.encrypted ? 'https' : 'http';
            const payment_price = await AllFunction.VehiclePaymentCal(uid, c_id, request_id, 2, hostname, protocol);

            console.log("Vehicle_Ride_Start_End");
            console.log(payment_price);
            
            if (payment_price == "1" || !payment_price) socket.broadcast.emit(`Vehicle_Ride_Payment${c_id}`, { ResponseCode: 401, Result:false, message: 'Request Not Found!' });
            if (payment_price == "2") socket.broadcast.emit(`Vehicle_Ride_Payment${c_id}`, { ResponseCode: 401, Result:false, message: 'Please Complete Other Stap!' });
            if (payment_price == "3" || payment_price == "4") socket.broadcast.emit(`Vehicle_Ride_Payment${c_id}`, { ResponseCode: 401, Result:false, message: 'Something went wrong' });

            if (payment_price != "1" || payment_price != "2"|| payment_price != "3") socket.broadcast.emit(`Vehicle_Ride_Payment${c_id}`, 
            {ResponseCode: 200, Result:true, message: "Ride Complete Successful", price_list: payment_price.price_list, payment_data: payment_price.payment, 
            review_list:payment_price.review_list});
        }

        

       
    })

    // // Dorp Location
    socket.on('drop_location_list', async (homemessage) => {
        
        const {d_id, c_id, r_id} = homemessage;

        let dropdata = await AllFunction.VehicleRideStartEndData(d_id, c_id, r_id);
       
         
        socket.emit(`drop_location${c_id}`, dropdata);
    })


    // // Payment Method Change
    socket.on('Vehicle_P_Change', async (homemessage) => {
        const payment = await DataFind(`SELECT id, image, name FROM tbl_payment_detail WHERE id = '${homemessage.payment_id}' AND status = '1'`);
        
        if (payment != "") {
            await DataUpdate(`tbl_cart_vehicle`, `payment_id = '${payment[0].id}'`, `d_id = '${homemessage.d_id}' AND c_id = '${homemessage.userid}'`,
            socket.request.headers.host, socket.request.connection.encrypted ? 'https' : 'http');

            socket.broadcast.emit(`Vehicle_P_Change${homemessage.d_id}`, {payment_data:payment[0]});
        }
    })

    // // Payment Successful And Complete Ride
    socket.on('Vehicle_Ride_Complete', async (homemessage) => {

        socket.broadcast.emit(`Vehicle_Ride_Complete${homemessage.d_id}`, homemessage);
    })






    

    // // Save Chat
    socket.on('Send_Chat', async (homemessage) => {
        // status :- customer, driver

        console.log("Send_Chat");
        console.log(homemessage);
        
        const {sender_id, recevier_id, message, status} = homemessage;

        const hostname = socket.request.headers.host;
        const protocol = socket.request.connection.encrypted ? 'https' : 'http';
        let save_chat = await AllChat.Chat_Save(sender_id, sender_id, recevier_id, message, status, hostname, protocol);
        
        if (save_chat != false) {
           
            
            socket.broadcast.emit(`New_Chat${recevier_id}`, { new_date: save_chat.today_date, id: save_chat.id, sender_id, message, date: save_chat.date });
        }
    })





});

}




module.exports = { publicsocket };