/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */



const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
let Excel = require('exceljs');
const { DataFind } = require("../middleware/databse_query");




async function DailyReport(where) {
    const all = await DataFind(`SELECT
                                    COUNT(*) AS today,
                                    COALESCE(SUM(CASE WHEN status = '1' THEN 1 ELSE 0 END), 0) AS accept,
                                    COALESCE(SUM(CASE WHEN status = '2' THEN 1 ELSE 0 END), 0) AS iamhere,
                                    COALESCE(SUM(CASE WHEN status = '3' THEN 1 ELSE 0 END), 0) AS enterotp,
                                    COALESCE(SUM(CASE WHEN status = '4' THEN 1 ELSE 0 END), 0) AS cancel,
                                    COALESCE(SUM(CASE WHEN status = '5' THEN 1 ELSE 0 END), 0) AS start,
                                    COALESCE(SUM(CASE WHEN status = '6' THEN 1 ELSE 0 END), 0) AS end,
                                    COALESCE(SUM(CASE WHEN status = '7' THEN 1 ELSE 0 END), 0) AS ridecomplete,
                                    COALESCE(SUM(CASE WHEN status = '8' THEN 1 ELSE 0 END), 0) AS complete
                                FROM tbl_cart_vehicle ${where}`);

    const com = await DataFind(`SELECT
                                    COUNT(*) AS today,
                                    COALESCE(SUM(CASE WHEN status = '1' THEN 1 ELSE 0 END), 0) AS accept,
                                    COALESCE(SUM(CASE WHEN status = '2' THEN 1 ELSE 0 END), 0) AS iamhere,
                                    COALESCE(SUM(CASE WHEN status = '3' THEN 1 ELSE 0 END), 0) AS enterotp,
                                    COALESCE(SUM(CASE WHEN status = '4' THEN 1 ELSE 0 END), 0) AS cancel,
                                    COALESCE(SUM(CASE WHEN status = '5' THEN 1 ELSE 0 END), 0) AS start,
                                    COALESCE(SUM(CASE WHEN status = '6' THEN 1 ELSE 0 END), 0) AS end,
                                    COALESCE(SUM(CASE WHEN status = '7' THEN 1 ELSE 0 END), 0) AS ridecomplete,
                                    COALESCE(SUM(CASE WHEN status = '8' THEN 1 ELSE 0 END), 0) AS complete
                                FROM tbl_order_vehicle ${where}`);
    
    let allstatus = [{ total: parseFloat(all[0].today) + parseFloat(com[0].today) }, { accept: parseFloat(all[0].accept) + parseFloat(com[0].accept) }, 
                    { iamhere: parseFloat(all[0].iamhere) + parseFloat(com[0].iamhere) }, { enterotp: parseFloat(all[0].enterotp) + parseFloat(com[0].enterotp) }, 
                    { cancel: parseFloat(all[0].cancel) + parseFloat(com[0].cancel) }, { start: parseFloat(all[0].start) + parseFloat(com[0].start) }, 
                    { end: parseFloat(all[0].end) + parseFloat(com[0].end) }, { ridecomplete: parseFloat(all[0].ridecomplete) + parseFloat(com[0].ridecomplete) }, 
                    { complete: parseFloat(all[0].complete) + parseFloat(com[0].complete) }];
    return allstatus;
}

router.get("/vehicle_daily", auth, async(req, res)=>{
    try {
        const driver = await DataFind(`SELECT * FROM tbl_driver ORDER BY id DESC`);
        let today = new Date().toISOString().split("T")[0];
        let daily_list = await DailyReport(`WHERE start_time LIKE '%${today}%'`);
        
        res.render("report_vehicle_daily", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, driver, daily_list, today
        })
    } catch (error) {
        console.log(error);
    }
})

router.post("/daily_data", auth, async(req, res)=>{
    try {
        let {date, sid} = req.body;

        let where = "", daily_list = "";
        if (date && sid) {
            where = `WHERE start_time LIKE '%${date}%' AND d_id = "${sid}"`;
            daily_list = await DailyReport(where);

        } else if (date) {
            where = `WHERE start_time LIKE '%${date}%'`;
            daily_list = await DailyReport(where);
            
        } else if(sid) {
            where = `WHERE d_id = "${sid}"`;
            daily_list = await DailyReport(where);
        }

        res.send({ daily_list });
    } catch (error) {
        console.log(error);
    }
});





router.get("/ride_payment", auth, async(req, res)=>{
    try {
        const rd = await DataFind(`SELECT cv.id, cv.c_id, cv.d_id, cv.price, cv.start_time, COALESCE(cus.name, '') AS cname, COALESCE(dri.first_name, '') AS dfname,
                                    COALESCE(dri.last_name, '') AS dlname, COALESCE(pay.name, '') AS pay_name
                                    FROM tbl_order_vehicle AS cv
                                    LEFT JOIN tbl_customer AS cus ON cv.c_id = cus.id
                                    LEFT JOIN tbl_driver AS dri ON cv.d_id = dri.id
                                    LEFT JOIN tbl_payment_detail AS pay ON cv.payment_id = pay.id
                                    WHERE cv.status = '8'
                                    ORDER BY cv.id DESC`);

        rd.map(rdval => {
            let sdate = new Date(rdval.start_time);
            const sformattedDate = sdate.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
            rdval.start_time = sformattedDate;
        });
        
        res.render("report_ride_payment", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, rd
        });
    } catch (error) {
        console.log(error);
    }
});

async function PaymentData(where) {
    const rd = await DataFind(`SELECT cv.id, cv.c_id, cv.d_id, cv.price, cv.start_time, COALESCE(cus.name, '') AS cname, COALESCE(dri.first_name, '') AS dfname,
                                    COALESCE(dri.last_name, '') AS dlname, COALESCE(pay.name, '') AS pay_name
                                    FROM tbl_order_vehicle AS cv
                                    LEFT JOIN tbl_customer AS cus ON cv.c_id = cus.id
                                    LEFT JOIN tbl_driver AS dri ON cv.d_id = dri.id
                                    LEFT JOIN tbl_payment_detail AS pay ON cv.payment_id = pay.id
                                    ${where}
                                    ORDER BY cv.id DESC`);

    rd.map(rdval => {
        let sdate = new Date(rdval.start_time);
        const sformattedDate = sdate.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        rdval.start_time = sformattedDate;
    });
    return rd;
}

async function PaymentDataWhere(sdate, edate) {
    let where = "", pay_list = "";
    if (sdate && edate) {
        where = `WHERE cv.start_time >= '${sdate}' AND cv.end_time <= "${edate}" AND cv.status = "8"`;
        pay_list = await PaymentData(where);

    } else if (sdate) {
        where = `WHERE cv.start_time >= '${sdate}' AND cv.status = "8"`;
        pay_list = await PaymentData(where);
        
    } else if(edate) {
        where = `WHERE cv.end_time <= "${edate}" AND cv.status = "8"`;
        pay_list = await PaymentData(where);
    } else {
        where = ``;
        pay_list = await PaymentData(where);
    }
    
    return pay_list
}

router.post("/rpaymentd", auth, async(req, res)=>{
    try {
        let {sdate, edate} = req.body;

        const data = await PaymentDataWhere(sdate, edate);
        let wdata = req.lan.ld.Wallet;
        
        res.send({ data, wdata });
    } catch (error) {
        console.log(error);
    }
});

router.get("/down_rpaymentd/:id", auth, async(req, res)=>{
    try {
        const sdate = req.params.id.split("&")[0];
        const edate = req.params.id.split("&")[1];

        const {site_currency, currency_placement, thousands_separator} = req.general;
        
        const data = await PaymentDataWhere(sdate, edate);
        data.map(pval => {
            let p = pval.price;
            let num_parts = p.toString().split(".");
            let sprated = num_parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousands_separator);

            if (currency_placement == "0") p = `${site_currency} ${sprated}`
            if (currency_placement == "1") p = `${sprated} ${site_currency}`

            pval.id = `#${pval.id}`
            pval.price = p
            pval.dfname = `${pval.dfname} ${pval.dlname}`
            pval.pay_name = pval.pay_name && pval.pay_name.trim() !== '' ? pval.pay_name : 'Wallet'
        })

        let workbook = new Excel.Workbook();
        let worksheet = workbook.addWorksheet("paymentreport");

        worksheet.columns = [
            { header: 'Rider', key: 'cname', width: 35},
            { header: 'Driver', key: 'dfname', width: 35},
            { header: 'Ride', key: 'id', width: 30},
            { header: 'Payment Type', key: 'pay_name', width: 35},
            { header: 'Amount', key: 'price', width: 30},
            { header: 'Date', key: 'start_time', width: 40},
      
        ];
        data.forEach(function(row){ worksheet.addRow(row); })
        
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=" + "paymentreport.xlsx"
        );

        return workbook.xlsx.write(res).then(function () {
            res.status(200).end
        });
    } catch (error) {
        console.log(error);
    }
});





module.exports = router;