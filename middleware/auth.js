const jwt = require('jsonwebtoken');
const { DataFind } = require("../middleware/databse_query");
const langlist = require("../public/language/language.json")

const auth = async(req, res, next) => {
    try {
        const token = req.cookies.zippygo;

        if (!token) {
            req.flash("errors", 'Unauthorized acces detected. please log in to proceed.')
            return res.redirect("/")
        }

        const decode = await jwt.verify(token, process.env.jwt_key)
        if (decode.user_role == "2") {
            const admin = await DataFind(`SELECT country_code, phone FROM tbl_admin WHERE id = "${decode.user_id}"`)
            const role_data = await DataFind(`SELECT * FROM tbl_role_permission WHERE country_code = '${admin[0].country_code}' AND phone = '${admin[0].phone}'`)
            
            let index = 0
            let role = Object.keys(role_data[0]).reduce((key, i) => {
                let rval = role_data[0][i];
                if (index > 5) rval = rval.split(",")
                    key[i] = rval
                index++
                return key
            }, {});
            
            req.per = role
            decode.user_role = "1"
        } else req.per = "1"
        req.user = decode

        const general = await DataFind(`SELECT * FROM tbl_general_settings`);
        req.general = general[0]

        req.notification = 1;



        const lan = req.cookies.zippygolan;
        
        if (!lan) {
            req.lan = {ld: langlist.en, lname:language.lang}
        } else {
            let language = await jwt.verify(lan, process.env.jwt_key);
            
            if (language.lan == "en") {
                req.lan = {ld: langlist.en, lname:language.lang}
            } else if(language.lan == "in") {
                req.lan = {ld: langlist.in, lname:language.lang}
            } else if(language.lan == "de") {
                req.lan = {ld: langlist.de, lname:language.lang}
            } else if(language.lan == "pt") {
                req.lan = {ld: langlist.pt, lname:language.lang}
            } else if(language.lan == "es") {
                req.lan = {ld: langlist.es, lname:language.lang}
            } else if(language.lan == "fr") {
                req.lan = {ld: langlist.fr, lname:language.lang}
            } else if(language.lan == "cn") {
                req.lan = {ld: langlist.cn, lname:language.lang}
            } else if(language.lan == "ae") {
                req.lan = {ld: langlist.ae, lname:language.lang}
            }
        }

        next()
    } catch (error) {
        console.log(error);
    }
}



module.exports = auth;