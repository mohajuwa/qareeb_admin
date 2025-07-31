require("dotenv").config();
const express = require("express");
const compression = require('compression'); // Add this package
const helmet = require('helmet'); // Add this package for security
const app = express();

// PERFORMANCE: Use uppercase PORT (fixed your bug)
const port = process.env.PORT || 8000;

const {connection} = require("./middleware/db");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const path = require("path");
const cookieParser = require("cookie-parser"); 
const flash = require("connect-flash");
const session = require("express-session");
const { publicsocket } = require("./public/publicsocket");

// PERFORMANCE: Security and compression middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable if needed for your app
    crossOriginEmbedderPolicy: false
}));
app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
    }
}));

// PERFORMANCE: Trust proxy for better performance
app.set('trust proxy', 1);

// PERFORMANCE: Optimized session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'keyboard cat ultra secure key 2024',
    resave: false,
    saveUninitialized: false, // Don't save empty sessions
    rolling: true, // Reset expiry on activity
    cookie: {
        maxAge: 1000 * 60 * 30, // 30 minutes instead of 1 minute
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // HTTPS in production
        sameSite: 'strict'
    },
    name: 'qareeb_session' // Custom session name
}));

// PERFORMANCE: Database query caching and error handling
let cachedScriptFile = null;
let lastCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

app.use((req, res, next) => {
    const now = Date.now();
    
    // Use cached data if available and not expired
    if (cachedScriptFile !== null && (now - lastCacheTime) < CACHE_DURATION) {
        res.locals.scriptFile = cachedScriptFile;
        return next();
    }
    
    connection.query("SELECT data FROM tbl_zippygo_validate LIMIT 1", (err, results) => {
        if (err) {
            console.error('❌ DB Query Error:', err);
            // Use cached data or empty string as fallback
            res.locals.scriptFile = cachedScriptFile || '';
            return next(); // Continue instead of crashing
        }
        
        if (results && results[0] && results[0].data) {
            cachedScriptFile = results[0].data;
            lastCacheTime = now;
            res.locals.scriptFile = cachedScriptFile;
        } else {
            res.locals.scriptFile = cachedScriptFile || '';
        }
        next();
    });
});

app.use(flash());

// PERFORMANCE: EJS optimizations
app.set('view engine', 'ejs');
app.set("views", path.join(__dirname, 'views'));
app.set('view cache', process.env.NODE_ENV === 'production'); // Cache views in production

// PERFORMANCE: Static file serving with caching
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0, // 1 day cache in production
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        if (path.endsWith('.js') || path.endsWith('.css')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year for JS/CSS
        }
    }
}));

// PERFORMANCE: Optimized body parsing
app.use(bodyParser.urlencoded({
    extended: false,
    limit: '10mb',
    parameterLimit: 1000
}));
app.use(bodyParser.json({
    limit: '10mb'
}));
app.use(express.json({
    limit: '10mb'
}));
app.use(cookieParser());

// Flash messages middleware
app.use(function (req, res, next) {
    res.locals.success = req.flash("success");
    res.locals.errors = req.flash("errors");
    next();
});

// PERFORMANCE: Request logging in development only
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
        next();
    });
}

// ============= Mobile API Routes ================ //
app.use("/customer", require("./route_mobile/customer_api"));
app.use("/driver", require("./route_mobile/driver_api"));
app.use("/chat", require("./route_mobile/chat"));
app.use("/payment", require("./route_mobile/payment"));

// ============= Web Routes ================ //
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

// PERFORMANCE: HTTP server optimization
const http = require("http");
const httpServer = http.createServer(app);

// Optimize server settings
httpServer.keepAliveTimeout = 65000; // Slightly higher than load balancer
httpServer.headersTimeout = 66000; // Slightly higher than keepAliveTimeout

// PERFORMANCE: Socket.IO optimization
const { Server } = require("socket.io");
const io = new Server(httpServer, {
    // Connection optimization
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    allowUpgrades: true,
    
    // Transport optimization
    transports: ['websocket', 'polling'],
    
    // CORS configuration
    cors: {
        origin: process.env.ALLOWED_ORIGINS || "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    
    // Performance optimizations
    serveClient: false, // Don't serve client files
    allowEIO3: false, // Disable legacy support
    
    // Connection limits
    maxHttpBufferSize: 1e6, // 1MB max message size
    
    // Compression
    compression: true,
    
    // WebSocket options
    wsEngine: 'ws'
});

// Initialize socket handling
publicsocket(io);

// PERFORMANCE: Comprehensive error handling
process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);
    console.error('Stack:', err.stack);
    
    // In production, don't exit immediately - log and monitor
    if (process.env.NODE_ENV === 'production') {
        console.error('🔄 Application will continue running...');
    } else {
        process.exit(1);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
    
    // In production, don't exit - log and monitor
    if (process.env.NODE_ENV === 'production') {
        console.error('🔄 Application will continue running...');
    }
});

// PERFORMANCE: Graceful shutdown handling
const gracefulShutdown = () => {
    console.log('🛑 Received shutdown signal, closing HTTP server...');
    
    httpServer.close(() => {
        console.log('✅ HTTP server closed');
        
        // Close database connections
        if (connection && connection.end) {
            connection.end(() => {
                console.log('✅ Database connections closed');
                process.exit(0);
            });
        } else {
            process.exit(0);
        }
    });
    
    // Force close after timeout
    setTimeout(() => {
        console.error('⚠️ Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// PERFORMANCE: Server error handling
httpServer.on('error', (err) => {
    console.error('🔥 Server Error:', err);
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use`);
        process.exit(1);
    }
});

// PERFORMANCE: Connection tracking
let activeConnections = 0;
httpServer.on('connection', (socket) => {
    activeConnections++;
    console.log(`📈 Active connections: ${activeConnections}`);
    
    socket.on('close', () => {
        activeConnections--;
        console.log(`📉 Active connections: ${activeConnections}`);
    });
});

// PERFORMANCE: Memory monitoring
const memoryMonitor = () => {
    const used = process.memoryUsage();
    const usage = {
        rss: Math.round(used.rss / 1024 / 1024 * 100) / 100,
        heapTotal: Math.round(used.heapTotal / 1024 / 1024 * 100) / 100,
        heapUsed: Math.round(used.heapUsed / 1024 / 1024 * 100) / 100,
        external: Math.round(used.external / 1024 / 1024 * 100) / 100
    };
    
    console.log(`💾 Memory usage: RSS: ${usage.rss}MB, Heap: ${usage.heapUsed}/${usage.heapTotal}MB, External: ${usage.external}MB`);
    
    // Warn if memory usage is high
    if (usage.heapUsed > 300) {
        console.warn('⚠️ High memory usage detected!');
    }
};

// Monitor memory every 5 minutes
if (process.env.NODE_ENV === 'production') {
    setInterval(memoryMonitor, 5 * 60 * 1000);
}

// PERFORMANCE: Health check endpoint
app.get('/health', (req, res) => {
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    
    res.json({
        status: 'OK',
        uptime: `${Math.floor(uptime / 60)} minutes`,
        memory: {
            rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`
        },
        connections: activeConnections,
        timestamp: new Date().toISOString()
    });
});

// Start server with performance monitoring
httpServer.listen(port, () => {
    console.log('🚀 =================================');
    console.log(`🚀 QAREEB SERVER STARTED`);
    console.log(`🚀 Port: ${port}`);
    console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🚀 Process ID: ${process.pid}`);
    console.log(`🚀 Node.js Version: ${process.version}`);
    console.log(`🚀 Memory Limit: ${process.env.NODE_OPTIONS || 'default'}`);
    console.log('🚀 =================================');
    
    // Initial memory check
    memoryMonitor();
});

// PERFORMANCE: Export for cluster mode
module.exports = app;