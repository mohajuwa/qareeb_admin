/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */



const express = require("express");
const router = express.Router();
const axios = require('axios');
const { DataFind } = require("../middleware/databse_query");




async function ManagePayment(wamount, final_amount) {
    let price = 0;
    
    if (parseFloat(wamount) != 0) {
        if (parseFloat(wamount) < parseFloat(final_amount)) {
            price = parseFloat((parseFloat(final_amount) - parseFloat(wamount)).toFixed(2));
        } else price = parseFloat(final_amount);
    } else price = parseFloat(final_amount);
    
    return price
}



const paypal = require('paypal-rest-sdk');

router.get('/paypal-payment', async(req, res) => {
    try {
        const { amount, uid, request_id } = req.query;
        if ( !amount || !uid || !request_id) return res.status(200).json({ message: 'Data Not Found!', status:false});
    
        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '2'`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        let rd, finalamount = 0
        if (request_id != "0") {
            rd = await DataFind(`SELECT * FROM tbl_cart_vehicle WHERE id = '${request_id}' AND c_id = '${uid}'`);
            if (rd == "") return res.status(200).json({ message: 'Request Not Found!', status:false});
    
            finalamount = await ManagePayment(amount, rd[0].final_price);
        } else finalamount = parseFloat(amount);

        let pkey = payment_detail[0].attribute.split(",");
        if (pkey == "" || pkey == undefined) return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const admin_data = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${uid}'`);
        if (admin_data == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        paypal.configure({
            mode: pkey[2],
            client_id: pkey[0],
            client_secret: pkey[1]
        });
      
        const paymentData = {
            intent: 'sale',
            payer: {
                payment_method: 'paypal',
                payer_info: {
                    email: admin_data[0].email,
                    first_name: admin_data[0].name
                }
            },
            redirect_urls: {
                return_url: req.protocol + req.hostname + "/payment/paypal-success",
                cancel_url: req.protocol + req.hostname + "/payment/paypal-success"
            },
            transactions: [{
                amount: {
                    total: finalamount,
                    currency: 'USD'
                },
                description: "This is the payment description."
            }]
        };
      
        paypal.payment.create(paymentData, function (error, payment) {
            if (error) {
                res.redirect({ message: 'Paypal Payment URL Not Generated!', status: false });
            } else {
                const approvalUrl = payment.links.find(link => link.rel === 'approval_url').href;
                console.log(approvalUrl);
                res.redirect(approvalUrl);
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
  


router.get('/paypal-success', (req, res) => {
    try {
        const { paymentId, PayerID } = req.query;
        
        const executePaymentData = {
            payer_id: PayerID
        };
        
        paypal.payment.execute(paymentId, executePaymentData, (error, payment) => {
            if (error) {
                return res.status(200).send({ message: 'Paypal Payment Cancel', status: false });
            } else {
                return res.status(200).send({ message: 'Paypal Payment Successful', status: true });
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





router.get('/strip-payment', async(req, res)=>{
    try {
        const { amount, uid, request_id } = req.query;
        if ( !amount || !uid || !request_id) return res.status(200).json({ message: 'Data Not Found!', status:false});
    
        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '3'`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        
        let rd, finalamount = 0
        if (request_id != "0") {
            rd = await DataFind(`SELECT * FROM tbl_cart_vehicle WHERE id = '${request_id}' AND c_id = '${uid}'`);
            if (rd == "") return res.status(200).json({ message: 'Request Not Found!', status:false});
    
            finalamount = await ManagePayment(amount, rd[0].final_price);
        } else finalamount = parseFloat(amount);

        let pkey = payment_detail[0].attribute.split(",");
        if (pkey == "" || pkey == undefined) return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const admin_data = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${uid}'`);
        if (admin_data == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const stripe = require('stripe')(pkey[1]);

        const dynamicPrice = Math.round(finalamount * 100);

        const price = await stripe.prices.create({
            unit_amount: dynamicPrice,
            currency: 'inr',
            product_data: {
                name: admin_data[0].name,
            },
        });

        const priceId = price.id;
        stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: "payment",
        line_items: [{
            price: priceId,
            quantity: 1,
        }],
        
        success_url: req.protocol + req.hostname + "/payment/strip-success?payment_intent={CHECKOUT_SESSION_ID}",
        cancel_url: req.protocol + req.hostname + "/payment/strip-cencal?payment_intent={CHECKOUT_SESSION_ID}",

        customer_email: "customer@example.com",
    
        billing_address_collection: 'required',

        }).then(session => {
            console.log('session data '+ session.url);
            res.redirect(session.url);
        }).catch(error => {
            console.error("Error creating Stripe Checkout session:", error);
            res.redirect({ message: 'Stripe Payment URL Not Generated!', status: false });

        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/strip-success", async(req, res)=>{
    try {
        const { payment_intent } = req.query;
        
        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '3'`);
        let pkey = payment_detail[0].attribute.split(",");

        const stripe = require('stripe')(pkey[1]);
        
        const session = await stripe.checkout.sessions.retrieve(payment_intent);
        const payment_intenta = session.payment_intent;

        let check = await stripe.paymentIntents.retrieve(payment_intenta);

        if (check.status == "succeeded") {   
            return res.status(200).send({ message: 'Stripe Payment Successful', status: true });
        } else {
            return res.status(200).send({ message: 'Stripe Payment Cancel!', status: false });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/strip-cencal", async(req, res)=>{
    try {
        const { payment_intent } = req.query;

        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '3'`);
        let pkey = payment_detail[0].attribute.split(",");
        const stripe = require('stripe')(pkey[1]);
        
        const session = await stripe.checkout.sessions.retrieve(payment_intent);

        const payment_intent_id = session.payment_intent;
        
        await stripe.paymentIntents.retrieve(payment_intent_id).catch(error => {
            return res.status(200).send({ message: 'Stripe Payment Cancel!', status: false });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





router.get("/paystack-payment", async(req, res)=>{
    try {
        const { amount, uid, request_id } = req.query;
        if ( !amount || !uid || !request_id) return res.status(200).json({ message: 'Data Not Found!', status:false});

        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '4'`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        let rd, finalamount = 0
        if (request_id != "0") {
            rd = await DataFind(`SELECT * FROM tbl_cart_vehicle WHERE id = '${request_id}' AND c_id = '${uid}'`);
            if (rd == "") return res.status(200).json({ message: 'Request Not Found!', status:false});
    
            finalamount = await ManagePayment(amount, rd[0].final_price);
        } else finalamount = parseFloat(amount);

        let pkey = payment_detail[0].attribute.split(",");
        if (pkey == "" || pkey == undefined) return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const admin_data = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${uid}'`);
        if (admin_data == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const paystack = require('paystack')(pkey[1]);

        const options = {
            amount: finalamount * 100, 
            email: admin_data[0].email,
            name: admin_data[0].name,
            phone: admin_data[0].country_code + ' ' + admin_data[0].phone,
            callback_url: req.protocol + req.hostname + "/payment/paystack-check",
            metadata: {
                custom_fields: [
                    {
                        display_name: 'Order ID',
                        variable_name: 'order_id',
                        value: '12345'
                    }
                ]
            }
        };

        paystack.transaction.initialize(options, (error, body) => {
            if (!error) {
                const authorization_url = body.data.authorization_url;
                console.log('reference id:', body.data.reference);
                res.redirect(authorization_url);
            } else {
                res.redirect({ message: 'Stripe Payment URL Not Generated!', status: false });
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/paystack-check", async(req, res)=>{
    try {
        const reference = req.query.reference;

        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '4'`);
        let pkey = payment_detail[0].attribute.split(",");
        
        const paystackVerifyUrl = `https://api.paystack.co/transaction/verify/${reference}`;

        const headers = {
          'accept': 'application/json',
          'Authorization': `Bearer ${pkey[1]}`,
          'cache-control': 'no-cache'
        };

        axios
            .get(paystackVerifyUrl, { headers })
            .then((response) => {
            const data = response.data;
            if (data.status === true && data.data.status === 'success') {
                return res.status(200).send({ message: 'Paystack Payment Successful', status: true });

            } else {
                console.log('Transaction was Cancelled');
                return res.status(200).send({ message: 'Paystack Payment Cancel!', status: false });
                
            }
            }).catch((error) => {
                console.error('Error:', error);
                return res.status(200).send({ message: 'An error occurred!', status: false });
            });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





router.get("/flutterwave-payment", async(req, res)=>{
    try {
        const { amount, uid, request_id } = req.query;
        if ( !amount || !uid || !request_id) return res.status(200).json({ message: 'Data Not Found!', status:false});

        let rd, finalamount = 0
        if (request_id != "0") {
            rd = await DataFind(`SELECT * FROM tbl_cart_vehicle WHERE id = '${request_id}' AND c_id = '${uid}'`);
            if (rd == "") return res.status(200).json({ message: 'Request Not Found!', status:false});
    
            finalamount = await ManagePayment(amount, rd[0].final_price);
        } else finalamount = parseFloat(amount);

        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '5'`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        let pkey = payment_detail[0].attribute.split(",");
        if (pkey == "" || pkey == undefined) return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const admin_data = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${uid}'`);
        if (admin_data == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const general_setting = await DataFind(`SELECT * FROM tbl_general_settings`);

        await axios.post("https://api.flutterwave.com/v3/payments", {
            tx_ref: Date.now(),
            amount: finalamount,
            currency: "NGN",
            redirect_url: req.protocol + req.hostname + "/payment/flutterwave-check",
            customer: {
                email: admin_data[0].email,
                phonenumber: admin_data[0].country_code + ' ' + admin_data[0].phone,
                name: admin_data[0].name
            },
            customizations: {
                title: general_setting[0].title,
                logo: req.protocol + req.hostname + general_setting[0].dark_image
            }
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer FLWSECK_TEST-c659ffd76304fff90fc4b67ae735b126-X`
            }

        }).then(session => {
            console.log(session.data.data.link);
            res.redirect(session.data.data.link);
        }).catch(error => {
            console.error("Error creating FlutterWave Checkout session:", error);
            res.redirect({ message: 'FlutterWave Payment URL Not Generated!', status: false });
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.get("/flutterwave-check", async(req, res)=>{
    try {
        const tx_id = req.query.transaction_id;
        const status = req.query.status;

        if (status === 'successful') {

            const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '5'`);
            if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});
            
            let pkey = payment_detail[0].attribute.split(",");
            if (pkey == "" || pkey == undefined) return res.status(200).json({ message: 'Something Went Wrong!', status:false});


            await axios.get(`https://api.flutterwave.com/v3/transactions/${tx_id}/verify`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${pkey[0]}`
                }
            }).then(response => {
                if (response.data.data.status === 'successful') {
                    console.log("Flutterwave Payment Successful!");
                    return res.status(200).send({ message: 'Flutterwave Payment Successful', status: true });
                } else {
                    console.log("Flutterwave Payment Failed!");
                    return res.status(200).send({ message: 'Flutterwave Payment Failed!', status: false });
                }
                
            }).catch(error => {
                console.log("Flutterwave Payment Failed!", error);
                return res.status(200).send({ message: 'Flutterwave Payment Failed!', status: false });
            });
        } else {
            console.log("Transaction status not successful!");
            return res.status(200).send({ message: 'Transaction not successful!', status: false });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





const crypto = require("crypto");

router.get("/senangpay-payment", async(req, res)=>{
    try {
        const { amount, uid, request_id } = req.query;
        if ( !amount || !uid || !request_id) return res.status(200).json({ message: 'Data Not Found!', status:false});

        let rd, finalamount = 0
        if (request_id != "0") {
            rd = await DataFind(`SELECT * FROM tbl_cart_vehicle WHERE id = '${request_id}' AND c_id = '${uid}'`);
            if (rd == "") return res.status(200).json({ message: 'Request Not Found!', status:false});
    
            finalamount = await ManagePayment(amount, rd[0].final_price);
        } else finalamount = parseFloat(amount);

        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '6'`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        let pkey = payment_detail[0].attribute.split(",");
        if (pkey == "" || pkey == undefined) return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const admin_data = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${uid}'`);
        if (admin_data == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const MERCHANT_ID = pkey[0];
        const SECRET_KEY = pkey[1];
        
        const data = `${MERCHANT_ID}${Date.now()}${finalamount}${SECRET_KEY}`;
        const hash = crypto.createHash('sha256').update(data).digest('hex');
        
        let am = parseFloat(finalamount).toFixed(2);
       
        const detail = {
            'detail': 'Shopping_cart_id_' + Date.now()+1,
            'amount': am,
            'order_id': Date.now(),
            'order_number': Date.now(),
            'name': admin_data[0].name,
            'email': admin_data[0].email,
            'phone': admin_data[0].phone,
            'hash': hash,
            'callback_url': req.protocol + req.hostname + "/payment/senangpay-success"
        };

        const paymentLink = `https://app.senangpay.my/payment/?${new URLSearchParams(detail).toString()}`;

        let action = "https://sandbox.senangpay.my/payment/"+ MERCHANT_ID +""; // // Sanbox
        // let action = "https://app.senangpay.my/payment/"+MERCHANT_ID+""; // // Live

        if (paymentLink) {
            console.log(paymentLink);
            res.redirect(paymentLink);
        } else {
            console.error("Error creating SenangPay Checkout session:", error);
            res.redirect({ message: 'SenangPay Payment URL Not Generated!', status: false });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/senangpay-success", async(req, res)=>{
    try {
        
        return res.status(200).send({ message: 'Senangpay Payment Successful', status: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





router.get("/payfast-payment", async(req, res)=>{
    try {
        const { amount, uid, request_id } = req.query;
        if ( !amount || !uid || !request_id) return res.status(200).json({ message: 'Data Not Found!', status:false});

        let rd, finalamount = 0
        if (request_id != "0") {
            rd = await DataFind(`SELECT * FROM tbl_cart_vehicle WHERE id = '${request_id}' AND c_id = '${uid}'`);
            if (rd == "") return res.status(200).json({ message: 'Request Not Found!', status:false});
    
            finalamount = await ManagePayment(amount, rd[0].final_price);
        } else finalamount = parseFloat(amount);

        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '7'`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        let pkey = payment_detail[0].attribute.split(",");
        if (pkey == "" || pkey == undefined) return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const admin_data = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${uid}'`);
        if (admin_data == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        
        console.log(pkey);

        const detail = {
            merchant_id: pkey[1],
            merchant_key: pkey[0],
            amount: finalamount,
            item_name: admin_data[0].name,
            email_address: admin_data[0].email,
            return_url: req.protocol + req.hostname + "/payment/payfast-success",
            cancel_url: req.protocol + req.hostname + "/payment/payfast-cancel",
        };
        
        // let action = "https://www.payfast.co.za/eng/process/"; // // live
        let action = "https://sandbox.payfast.co.za/eng/process/"; // // sendbox

        const paymentLink = `${action}?${new URLSearchParams(detail).toString()}`;
        
        if (paymentLink) {
            console.log(paymentLink);
            res.redirect(paymentLink);
        } else {
            console.error("Error creating FlutterWave Checkout session:", error);
            res.redirect({ message: 'Payfast Payment URL Not Generated!', status: false });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/payfast-success", async(req, res)=>{
    try {
        console.log("payfast successful");

        return res.status(200).send({ message: 'PayFast Payment Successful', status: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/payfast-cancel", async(req, res)=>{
    try {
        console.log("payfast cancel");
        
        return res.status(200).send({ message: 'PayFast Payment Failed!', status: false });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





const { Snap } = require('midtrans-client');

router.get("/midtrans-payment", async(req, res)=>{
    try {
        const { amount, uid, request_id } = req.query;
        if ( !amount || !uid || !request_id) return res.status(200).json({ message: 'Data Not Found!', status:false});

        let rd, finalamount = 0
        if (request_id != "0") {
            rd = await DataFind(`SELECT * FROM tbl_cart_vehicle WHERE id = '${request_id}' AND c_id = '${uid}'`);
            if (rd == "") return res.status(200).json({ message: 'Request Not Found!', status:false});
    
            finalamount = await ManagePayment(amount, rd[0].final_price);
        } else finalamount = parseFloat(amount);

        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '8'`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        let pkey = payment_detail[0].attribute.split(",");
        if (pkey == "" || pkey == undefined) return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const admin_data = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${uid}'`);
        if (admin_data == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const snap = new Snap({
            isProduction: false,
            serverKey: pkey[1],
            clientKey: pkey[0]
        });

        let am = parseFloat(finalamount);
        if (isNaN(am)) {
            return res.status(200).json({ message: 'Invalid amount!', status:false});
        }

        const isInteger = Number.isInteger(am);
        if (!isInteger) {
            am = Math.floor(am);
        }
        
        // Create a transaction
        const transactionDetails = {
            locale: "en",
            transaction_details: {
                order_id: `ORDER-${Date.now()}`,
                gross_amount: am.toString()
            },
            customer_details: {
            first_name: admin_data[0].name,
            email: admin_data[0].email,
            phone: admin_data[0].phone
            },
            credit_card: {
                secure: true
            },
            finish_payment_return_url: req.protocol + req.hostname + "/payment/midtrans-success",
            error_payment_return_url: req.protocol + req.hostname + "/payment/midtrans-cancel"
        };
        
        snap.createTransaction(transactionDetails)
        .then(transactionToken => {
            res.redirect(transactionToken.redirect_url);
        }).catch(error => {
            console.error("Error creating Midtrans Checkout session:", error.data);
            res.redirect({ message: 'Midtrans Payment URL Not Generated!', status: false });
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/midtrans-success", async(req, res)=>{
    try {
        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '8'`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        let pkey = payment_detail[0].attribute.split(",");
        if (pkey == "" || pkey == undefined) return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const orderId = req.query.order_id;

        const snap = new Snap({
            isProduction: false,
            serverKey: pkey[1],
            clientKey: pkey[0]
        });
    
        const transactionStatus = await snap.transaction.status(orderId);

        if (transactionStatus.transaction_status === 'settlement') {        
            res.status(200).json({ status: 'success' });
        } else {
            res.status(400).json({ status: 'failed', message: 'Payment was not successful' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/midtrans-cancel", async(req, res)=>{
    try {
        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '8'`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        
        let pkey = payment_detail[0].attribute.split(",");
        if (pkey == "" || pkey == undefined) return res.status(200).json({ message: 'Something Went Wrong!', status:false});
    
        const orderId = req.query.order_id;
    
        const snap = new Snap({
            isProduction: false,
            serverKey: pkey[1],
            clientKey: pkey[0]
        });
        
        const transactionStatus = await snap.transaction.status(orderId);
    
        if (transactionStatus.transaction_status === 'settlement') {
            res.status(200).json({ status: 'success' });
        } else {
            res.status(400).json({ status: 'failed', message: 'Payment was not successful' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



module.exports = router;