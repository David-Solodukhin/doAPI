var express = require('express');
var app = express();
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var mysql = require('mysql');
var server = require("http").Server(app);
var bodyParser = require('body-parser');
var fs = require('fs');
var connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '******',
    database: 'eventapp'
});
connection.connect();

server.listen(8000);

var users = require('./routes/users');


// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'))); //for simple stuff like direct url about.html, etc.

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.get('/:tokenstring', function (request, response, next) {
    var apiCode = request.originalUrl.substring(1);
    if (apiCode.includes("updateviews")) {
        //Sample Query: updateviews&eID=1234
        //Another sample: updateMembers&eID=1234&email=dave@gatech.edu
        //newevent&title=&body=&type=&members=&uni=
        //response.render('index', {val: "",title: apiCode});
        var eID = apiCode.substring(apiCode.indexOf('eID')+4, apiCode.indexOf("&",apiCode.indexOf('eID')+4)!=-1 ?(apiCode.indexOf("&", apiCode.indexOf('eID')+4)):apiCode.length);
        console.log(eID);
        connection.query("update events set views = views + 1 where eID =" + "'" + eID + "'", 0, function (err2, result2) {
        console.log(err2);
        if (err2 == undefined) {
            response.render('index', {val: err2});
        }
        });



        //return;
    } else if (apiCode.includes("updatemembers")) {
        //Sample Query: updateviews&eID=1234
        //Another sample: updateMembers&eID=1234&email=dave@gatech.edu&remove
        eID = apiCode.substring(apiCode.indexOf('eID')+4, apiCode.indexOf("&",apiCode.indexOf('eID')+4)!=-1 ?(apiCode.indexOf("&", apiCode.indexOf('eID')+4)):apiCode.length);
        var email = apiCode.substring(apiCode.indexOf("&email")+7, apiCode.indexOf("&",apiCode.indexOf('&email')+7)!=-1 ?(apiCode.indexOf("&", apiCode.indexOf('&email')+7)):apiCode.length);
        if (apiCode.includes("&remove")) {
            connection.query("update events set members = replace(members, concat('|',?), '') where eID =" + "'" + eID + "'", email, function (err2, result2) {
                console.log(err2);
                if (err2 == undefined) {
                    response.render('index', {val: err2});
                }
            });
        } else {
            connection.query("update events set members = replace(members, concat('|',?), '') where eID =" + "'" + eID + "'", email, function (err2, result2) {
                connection.query("update events set members = concat(members,concat('|',?)) where eID =" + "'" + eID + "'", email, function (err2, result2) {
                });
                response.render('index', {val: err2});
            });

        }




        //return;
    } else if (apiCode.includes("newevent")) {
        var pre = apiCode.substring(9).split("&");
        var title = pre[0].substring(pre[0].indexOf("=")+1);
        var body = pre[1].substring(pre[1].indexOf("=")+1);
        var type = pre[2].substring(pre[2].indexOf("=")+1);
        var members = "|"+pre[3].substring(pre[3].indexOf("=")+1);
        var uni = pre[4].substring(pre[4].indexOf("=")+1);
        var time = pre[5].substring(pre[5].indexOf("=")+1);
        eID = makeId();


        var event = {
            title: title,
            body: body,
            type: type,
            members: members,
            uni: uni,
            eID: eID,
            views: 1,
            time: time,
            going: 1,
            maybe: 0
        };

        connection.query('insert into events set ?', event, function (err, result) {
        console.log(err);
        });
        //whenever each of the following is called, the offset number resets.
    } else if (apiCode.includes("sortpop")) { //sortPop&page=&time=&uni=
        pre = apiCode.substring(8).split("&");
        var offset = pre[0].substring(pre[0].indexOf("=")+1) * 5; //5 is how many events displayed per page
        time = pre[1].substring(pre[1].indexOf("=")+1);
        uni = pre[2].substring(pre[2].indexOf("=")+1);
        var testQuery = connection.query('select * from events where (((maybe * .05) + going) / views) > 0.5 AND ABS(time - ?) < 300 AND uni = ? ORDER BY views DESC, time DESC LIMIT ?, 5', [ time, uni, offset ], function (err, result) {
            //console.log(testQuery);
            console.log(result[0]);
            //response.render('index', {val: err});
            var json = JSON.stringify(result);
            response.json(result);
            //console.log(json);
        });

        //LIMIT 5,10 : offset, number to return
        //Sample query: getPop&page=&time=
        //figure out popularity and return some rows in a json object
    } else if (apiCode.includes("sorttag")) {
        //return 5 rows that fit the tag and are popular
    } else if (apiCode.includes("sorttime")) { //sorttime&page=&time=&uni=
        //return 5 rows that are the newest; sort by time
        time = apiCode.substring(apiCode.indexOf("&time")+6,apiCode.indexOf("&",apiCode.indexOf("&time")+6 )!=-1 ? apiCode.indexOf("&", apiCode.indexOf("&time")+6): apiCode.length );
        uni = apiCode.substring(apiCode.indexOf("&uni")+5,apiCode.indexOf("&",apiCode.indexOf("&uni")+5 )!=-1 ? apiCode.indexOf("&", apiCode.indexOf("&uni")+5): apiCode.length );
        offset = apiCode.substring(apiCode.indexOf("&page")+6,apiCode.indexOf("&",apiCode.indexOf("&page")+6 )!=-1 ? apiCode.indexOf("&", apiCode.indexOf("&page")+6): apiCode.length ) * 5;
            var testQuery2 = connection.query("select * from events where uni = ? AND ABS(time - ?) < 2000 ORDER BY time DESC LIMIT ?, 5", [ uni, time, offset ], function (err, result) {
            console.log(err);
            //console.log(result[0]);
            //response.render('index', {val: err});
            var json = JSON.stringify(result);
            response.json(result);
            //console.log(json);
        });
    }
});
// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

function makeId() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < 5; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    var test = connection.query('select type from events where BINARY eID = ?', text, function (err, result) {
        if (result[0] != undefined) {
            text = makeId();
        }

    });

    return text;
}
module.exports = app;
