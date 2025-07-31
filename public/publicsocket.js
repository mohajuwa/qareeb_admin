const AllFunction = require("../route_function/function")
const AllChat = require("../route_function/chat_function")
const schedule = require('node-schedule');
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/databse_query");

// FIXED: Use Map for better memory management and cleanup
let activeSchedules = new Map();
let connectedSockets = new Set();

// FIXED: Add cleanup function to prevent memory leaks
function cleanupSchedules() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (let [key, scheduleData] of activeSchedules) {
        // Remove schedules older than 1 hour
        if (now - scheduleData.createdAt > 3600000) {
            scheduleData.job.cancel();
            expiredKeys.push(key);
        }
    }
    
    expiredKeys.forEach(key => activeSchedules.delete(key));
    console.log(`Cleaned up ${expiredKeys.length} expired schedules`);
}

// FIXED: Run cleanup every 10 minutes
setInterval(cleanupSchedules, 600000);

function publicsocket(io) {
    // FIXED: Add connection limit
    io.engine.generateId = (req) => {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    };

    io.on('connection', (socket) => {
        console.log('Socket connected:', socket.id);
        connectedSockets.add(socket.id);
        
        // FIXED: Limit connections per server
        if (connectedSockets.size > 1000) {
            console.warn('Too many connections, rejecting new connection');
            socket.disconnect();
            return;
        }

        // FIXED: Add disconnect handler to clean up
        socket.on('disconnect', () => {
            console.log('Socket disconnected:', socket.id);
            connectedSockets.delete(socket.id);
            
            // Cancel any schedules associated with this socket
            for (let [key, scheduleData] of activeSchedules) {
                if (scheduleData.socketId === socket.id) {
                    scheduleData.job.cancel();
                    activeSchedules.delete(key);
                }
            }
        });

        // Customer Home
        socket.on('home', async (message) => {
            socket.broadcast.emit('home', message);
        });

        // Home Map
        socket.on('homemap', async (homemessage) => {
            try {
                const hostname = socket.request.headers.host;
                const protocol = socket.request.connection.encrypted ? 'https' : 'http';
                const {uid, lat, long, status} = homemessage;
                
                if (!uid || !lat || !long || !status) {
                    return socket.emit('error', { message: 'Missing required fields' });
                }

                const missingField = await AllFunction.CheckSocketData(homemessage, ["uid", "lat", "long", "status"]);

                const dri = await DataFind(`SELECT dr.id, dr.zone, COALESCE(ve.map_img, '') AS image, COALESCE(ve.name, '') AS name, COALESCE(ve.description, '') AS description, 
                                            COALESCE(dr.latitude, '') AS latitude, COALESCE(dr.longitude, '') AS longitude, dr.fstatus, dr.rid_status, dr.check_status
                                            FROM tbl_driver AS dr
                                            JOIN tbl_vehicle AS ve ON dr.vehicle = ve.id
                                            WHERE dr.id = '${uid}' AND dr.status = '1' LIMIT 1`);

                if (!missingField && dri && dri.length > 0) {
                    let check_status = "0", homemap = 0, vdriloc = 0;
                    
                    if (dri[0].rid_status == "0") homemap = 1;
                    if (dri[0].rid_status == "1") {
                        if (dri[0].check_status == "0") homemap = 1;
                        else homemap = 0;
                        check_status = "1"; 
                        vdriloc = 1;
                    }
                    
                    await DataUpdate(`tbl_driver`, `latitude = '${lat}', longitude = '${long}', fstatus = '${status == "on" ? "1" : "0"}'`, `id = '${uid}'`, hostname, protocol);
                    
                    if (homemap == 1) {
                        socket.broadcast.emit(`V_homemap${uid}`, {
                            driver: dri[0],
                            check_status,
                            vdriloc
                        });
                    }

                    if (vdriloc == 1) {
                        const d = await DataFind(`SELECT c_id FROM tbl_cart_vehicle WHERE d_id = '${uid}' AND status IN ('2', '3') AND DATE(date) = CURDATE() LIMIT 10`);
                        
                        for (let i = 0; i < d.length && i < 10; i++) {
                            socket.broadcast.emit(`V_Driver_Location${d[i].c_id}`, {
                                d_id: uid, 
                                driver_location: dri[0]
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('homemap error:', error);
                socket.emit('database_error', { 
                    ResponseCode: 401, 
                    Result: false, 
                    message: process.env.dataerror || 'Database error occurred' 
                });
            }
        });

        // Send Vehicle Ride Request 
        socket.on('vehiclerequest', (homemessage) => {
            if (homemessage) {
                socket.broadcast.emit('vehiclerequest', homemessage);
            }
        });

        // FIXED: Vehicle Bidding with proper memory management
        socket.on('Vehicle_Bidding', async (homemessage) => {
            try {
                const {uid, request_id, c_id, price, status} = homemessage;
                
                if (!uid || !request_id || !c_id || !price || !status) {
                    return socket.emit('error', { message: 'Missing required fields' });
                }

                const hostname = socket.request.headers.host;
                const protocol = socket.request.connection.encrypted ? 'https' : 'http';

                if (status == "1") {
                    let ddata = await AllFunction.VehicleBidding(uid, request_id, price, 1, hostname, protocol);
                    
                    if (ddata && ddata !== false) {
                        socket.broadcast.emit(`Vehicle_Bidding${c_id}`, ddata);
                        
                        if (parseFloat(ddata.off_ex_time) > 0) {
                            let addtime = parseFloat(ddata.off_ex_time);
                            
                            // FIXED: Create unique key for schedule
                            const scheduleKey = `${request_id}_${uid}_${c_id}`;
                            
                            // FIXED: Cancel existing schedule if exists
                            if (activeSchedules.has(scheduleKey)) {
                                activeSchedules.get(scheduleKey).job.cancel();
                            }
                            
                            let job = schedule.scheduleJob(new Date(Date.now() + addtime * 1000), async function() {
                                try {
                                    if (activeSchedules.has(scheduleKey)) {
                                        let ddatas = await AllFunction.VehicleBidding(uid, request_id, price, 2, hostname, protocol);
                                        
                                        if (ddatas && ddatas !== false) {
                                            let dlidt = ddatas.nid_list, req_id = ddatas.request_id;
                                            socket.broadcast.emit(`Vehicle_Bidding${ddatas.c_id}`, { 
                                                bidding_list: ddatas.bidding_list, 
                                                off_ex_time: ddatas.off_ex_time 
                                            });
                                        }
                                        
                                        // FIXED: Remove from activeSchedules after execution
                                        activeSchedules.delete(scheduleKey);
                                    }
                                } catch (error) {
                                    console.error('Schedule execution error:', error);
                                    activeSchedules.delete(scheduleKey);
                                }
                            });

                            // FIXED: Store with metadata for cleanup
                            activeSchedules.set(scheduleKey, { 
                                job, 
                                request_id, 
                                d_id: uid, 
                                c_id, 
                                socketId: socket.id,
                                createdAt: Date.now()
                            });
                        }
                    }
                }

                if (status == "2") {
                    const scheduleKey = `${request_id}_${uid}_${c_id}`;
                    
                    // FIXED: Properly cancel and remove schedule
                    if (activeSchedules.has(scheduleKey)) {
                        activeSchedules.get(scheduleKey).job.cancel();
                        activeSchedules.delete(scheduleKey);
                    }

                    let remove = await AllFunction.VehicleBidding(uid, request_id, price, 3, hostname, protocol);
                    
                    if (remove && remove !== false) {
                        socket.broadcast.emit(`Vehicle_Bidding${remove.c_id}`, { 
                            bidding_list: remove.bidding_list, 
                            off_ex_time: remove.off_ex_time 
                        });
                    }
                }
            } catch (error) {
                console.error('Vehicle_Bidding error:', error);
                socket.emit('error', { message: 'Bidding error occurred' });
            }
        });

        // Vehicle Request TimeOut 
        socket.on('RequestTimeOut', (homemessage) => {
            socket.broadcast.emit('RequestTimeOut', homemessage);
        });

        // FIXED: Accept Bidding with cleanup
        socket.on('Accept_Bidding', async(homemessage) => {
            try {
                const { uid, d_id, price, request_id } = homemessage;
                
                if (!uid || !d_id || !price || !request_id) {
                    return socket.emit('error', { message: 'Missing required fields' });
                }
                
                const missingField = await AllFunction.CheckSocketData(homemessage, ["uid", "d_id", "price", "request_id"]);
                
                if (!missingField) {
                    const rd = await DataFind(`SELECT * FROM tbl_request_vehicle WHERE id = '${request_id}' AND JSON_CONTAINS(d_id, '${d_id}') LIMIT 1`);
                    
                    if (rd && rd.length > 0) {
                        // FIXED: Cancel all schedules for this request
                        for (let [key, scheduleData] of activeSchedules) {
                            if (scheduleData.request_id === request_id) {
                                scheduleData.job.cancel();
                                activeSchedules.delete(key);
                            }
                        }

                        const hostname = socket.request.headers.host;
                        const protocol = socket.request.connection.encrypted ? 'https' : 'http';
                        
                        let accept = await AllFunction.AcceptBidding(uid, d_id, price, request_id, hostname, protocol);
                        
                        if (accept && accept !== false) {
                            socket.emit(`Vehicle_Bidding${uid}`, accept);
                            socket.broadcast.emit(`Bidding_decline${d_id}`, {request_id: request_id});
                        }
                    }
                }
            } catch (error) {
                console.error('Accept_Bidding error:', error);
                socket.emit('error', { message: 'Accept bidding error occurred' });
            }
        });

        // Accept Vehicle Ride Request   
        socket.on('acceptvehrequest', async (homemessage) => {
            try {
                const {uid, request_id, c_id} = homemessage;
                
                if (!uid || !request_id || !c_id) {
                    return socket.emit('error', { message: 'Missing required fields' });
                }

                let ddata = await AllFunction.SendDriverLatLong(uid);

                const rd = await DataFind(`SELECT id, driver_id_list FROM tbl_cart_vehicle WHERE id = '${request_id}' AND c_id = '${c_id}' AND d_id = '${uid}' LIMIT 1`);
                if (rd && rd.length > 0) {
                    let idlist = rd[0].driver_id_list;
                    if (typeof idlist == "string") idlist = JSON.parse(idlist);
                    socket.broadcast.emit('AcceRemoveOther', { requestid:request_id, driverid: idlist});
                }

                socket.broadcast.emit(`acceptvehrequest${c_id}`, homemessage);

                if (ddata.driver && ddata.driver.length > 0 && ddata.data && ddata.data.length > 0) {
                    let d = ddata.data;
                    for (let i = 0; i < d.length && i < 50; i++) {
                        socket.broadcast.emit(`V_Driver_Location${d[i].c_id}`, {
                            d_id: uid, 
                            driver_location: ddata.driver[0]
                        });
                    }
                }
            } catch (error) {
                console.error('acceptvehrequest error:', error);
                socket.emit('error', { message: 'Accept request error occurred' });
            }
        });

        // Accept Vehicle Ride Request AND Remove other driver
        socket.on('AcceRemoveOther', (homemessage) => {
            socket.broadcast.emit('AcceRemoveOther', homemessage);
        });

        // Vehicle Ride Time Update
        socket.on('Vehicle_Time_update', async (homemessage) => {
            try {
                const hostname = socket.request.headers.host;
                const protocol = socket.request.connection.encrypted ? 'https' : 'http';

                let date = await AllFunction.TimeUpdate(homemessage, hostname, protocol);
                if (date === true) socket.broadcast.emit(`Vehicle_Time_update${homemessage.c_id}`, homemessage);
            } catch (error) {
                console.error('Vehicle_Time_update error:', error);
            }
        });

        // Vehicle Ride Time Over Request
        socket.on('Vehicle_Time_Request', async (homemessage) => {
            socket.broadcast.emit(`Vehicle_Time_Request${homemessage.d_id}`, homemessage);
        });

        // Driver Request Accept And Cancel
        socket.on('Vehicle_Accept_Cancel', async(homemessage) => {
            try {
                const {uid, request_id, c_id} = homemessage;

                const missingField = await AllFunction.CheckSocketData(homemessage, ["uid", "request_id", "c_id"]);
                if (!missingField) socket.broadcast.emit(`Vehicle_Accept_Cancel${c_id}`, { request_id, d_id: uid });
            } catch (error) {
                console.error('Vehicle_Accept_Cancel error:', error);
            }
        });

        // Rider Pick Customer
        socket.on('Vehicle_D_IAmHere', (homemessage) => {
            socket.broadcast.emit('Vehicle_D_IAmHere', homemessage);
        });

        // Rider Cancel
        socket.on('Vehicle_Ride_Cancel', (homemessage) => {
            socket.broadcast.emit('Vehicle_Ride_Cancel', homemessage);
        });

        // Rider OTP
        socket.on('Vehicle_Ride_OTP', (homemessage) => {
            socket.broadcast.emit('Vehicle_Ride_OTP', homemessage);
        });

        // Rider Start And End   
        socket.on('Vehicle_Ride_Start_End', async (homemessage) => {
            try {
                const {uid, c_id, request_id} = homemessage;

                if (!uid || !c_id || !request_id) {
                    return socket.emit('error', { message: 'Missing required fields' });
                }

                let dropdata = await AllFunction.VehicleRideStartEndData(uid, c_id, request_id);
                let ddata = await AllFunction.SendDriverLatLong(uid);

                socket.broadcast.emit(`Vehicle_Ride_Start_End${c_id}`, dropdata);

                if (ddata.driver && ddata.driver.length > 0 && ddata.data && ddata.data.length > 0) {
                    let d = ddata.data;
                    for (let i = 0; i < d.length && i < 50; i++) {
                        socket.broadcast.emit(`V_Driver_Location${d[i].c_id}`, {
                            d_id: uid, 
                            driver_location: ddata.driver[0]
                        });
                    }
                }

                if (dropdata.status == "7") {
                    const hostname = socket.request.headers.host;
                    const protocol = socket.request.connection.encrypted ? 'https' : 'http';
                    const payment_price = await AllFunction.VehiclePaymentCal(uid, c_id, request_id, 2, hostname, protocol);

                    if (payment_price == "1" || !payment_price) {
                        socket.broadcast.emit(`Vehicle_Ride_Payment${c_id}`, { 
                            ResponseCode: 401, 
                            Result: false, 
                            message: 'Request Not Found!' 
                        });
                    } else if (payment_price == "2") {
                        socket.broadcast.emit(`Vehicle_Ride_Payment${c_id}`, { 
                            ResponseCode: 401, 
                            Result: false, 
                            message: 'Please Complete Other Step!' 
                        });
                    } else if (payment_price == "3" || payment_price == "4") {
                        socket.broadcast.emit(`Vehicle_Ride_Payment${c_id}`, { 
                            ResponseCode: 401, 
                            Result: false, 
                            message: 'Something went wrong' 
                        });
                    } else {
                        socket.broadcast.emit(`Vehicle_Ride_Payment${c_id}`, {
                            ResponseCode: 200, 
                            Result: true, 
                            message: "Ride Complete Successful", 
                            price_list: payment_price.price_list, 
                            payment_data: payment_price.payment, 
                            review_list: payment_price.review_list
                        });
                    }
                }
            } catch (error) {
                console.error('Vehicle_Ride_Start_End error:', error);
                socket.emit('error', { message: 'Ride start/end error occurred' });
            }
        });

        // Drop Location
        socket.on('drop_location_list', async (homemessage) => {
            try {
                const {d_id, c_id, r_id} = homemessage;

                if (!d_id || !c_id || !r_id) {
                    return socket.emit('error', { message: 'Missing required fields' });
                }

                let dropdata = await AllFunction.VehicleRideStartEndData(d_id, c_id, r_id);
                socket.emit(`drop_location${c_id}`, dropdata);
            } catch (error) {
                console.error('drop_location_list error:', error);
                socket.emit('error', { message: 'Drop location error occurred' });
            }
        });

        // Payment Method Change
        socket.on('Vehicle_P_Change', async (homemessage) => {
            try {
                if (!homemessage.payment_id || !homemessage.d_id || !homemessage.userid) {
                    return socket.emit('error', { message: 'Missing required fields' });
                }

                const payment = await DataFind(`SELECT id, image, name FROM tbl_payment_detail WHERE id = '${homemessage.payment_id}' AND status = '1' LIMIT 1`);
                
                if (payment && payment.length > 0) {
                    await DataUpdate(`tbl_cart_vehicle`, `payment_id = '${payment[0].id}'`, 
                        `d_id = '${homemessage.d_id}' AND c_id = '${homemessage.userid}'`,
                        socket.request.headers.host, 
                        socket.request.connection.encrypted ? 'https' : 'http');

                    socket.broadcast.emit(`Vehicle_P_Change${homemessage.d_id}`, {payment_data:payment[0]});
                }
            } catch (error) {
                console.error('Vehicle_P_Change error:', error);
                socket.emit('error', { message: 'Payment change error occurred' });
            }
        });

        // Payment Successful And Complete Ride
        socket.on('Vehicle_Ride_Complete', async (homemessage) => {
            if (homemessage && homemessage.d_id) {
                socket.broadcast.emit(`Vehicle_Ride_Complete${homemessage.d_id}`, homemessage);
            }
        });

        // Save Chat
        socket.on('Send_Chat', async (homemessage) => {
            try {
                const {sender_id, recevier_id, message, status} = homemessage;

                if (!sender_id || !recevier_id || !message || !status) {
                    return socket.emit('error', { message: 'Missing required fields' });
                }

                const hostname = socket.request.headers.host;
                const protocol = socket.request.connection.encrypted ? 'https' : 'http';

                let date = await AllChat.Chat_Save(sender_id, sender_id, recevier_id, message, status, hostname, protocol);
                
                if (date && date !== false) {
                    if (status == "customer") {
                        socket.broadcast.emit(`Send_Chat${recevier_id}`, date);
                    } else {
                        socket.broadcast.emit(`Send_Chat${recevier_id}`, date);
                    }
                }
            } catch (error) {
                console.error('Send_Chat error:', error);
                socket.emit('error', { message: 'Chat error occurred' });
            }
        });
    });

    // FIXED: Add server-level error handling
    io.engine.on("connection_error", (err) => {
        console.log('Connection error:', err.req);
        console.log('Error code:', err.code);
        console.log('Error message:', err.message);
        console.log('Error context:', err.context);
    });

    // FIXED: Monitor active connections and schedules
    setInterval(() => {
        console.log(`Active connections: ${connectedSockets.size}, Active schedules: ${activeSchedules.size}`);
        
        // Force cleanup if too many schedules
        if (activeSchedules.size > 1000) {
            console.warn('Too many active schedules, forcing cleanup');
            cleanupSchedules();
        }
    }, 60000); // Every minute
}

module.exports = { publicsocket };