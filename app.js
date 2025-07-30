require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.port || 8000
const {connection} = require("./middleware/db");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const path = require("path");
const cookieParser = require("cookie-parser"); 
const flash = require("connect-flash");
const session = require("express-session");
const { publicsocket } = require("./public/publicsocket")



app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
    cookie: {maxAge: 1000 * 60 }
}))
app.use((req, res, next) => {
  connection.query("SELECT data FROM tbl_zippygo_validate", (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return next(err);
    }
    const scriptFile = results[0].data; // Get the script file data

    // Set the scriptFile variable in res.locals
    res.locals.scriptFile = scriptFile;
    next();
  });
});




app.use(flash());

app.set('view engine', 'ejs');
app.set("views", path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.urlencoded({extended : false}));
app.use(bodyParser.json());
app.use(express.json());
app.use(cookieParser());

app.use(function (req, res, next) {
    res.locals.success = req.flash("success");
    res.locals.errors = req.flash("errors");
    next();
});



// ============= Mobile ================ //
app.use("/customer", require("./route_mobile/customer_api"));
app.use("/driver", require("./route_mobile/driver_api"));
app.use("/chat", require("./route_mobile/chat"));
app.use("/payment", require("./route_mobile/payment"));



// ============= Web ================ //
app.use("/", require("./router/login"));
app.use("/", require("./router/index"));
app.use("/settings", require("./router/settings"));
app.use("/vehicle", require("./router/vehicle"));
app.use("/zone", require("./router/zone"));
app.use("/outstation", require("./router/outstation"));
app.use("/rental", require("./router/rental"));
app.use("/package", require("./router/package"));
app.use("/customer", require("./router/customer"));
app.use("/driver", require("./router/driver"));
app.use("/coupon", require("./router/coupon"));
app.use("/report", require("./router/report"));
app.use("/role", require("./router/role_permission"));
app.use("/rides", require("./router/ride"));


const http = require("http");
const httpServer = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(httpServer, 
    
);

publicsocket(io);



httpServer.listen(port, ()=>{
    console.log(`Server running on port ${port}`);
});