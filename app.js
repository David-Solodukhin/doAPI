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


////newevent&body=&title=&type=&members=&uni=&time=

var eArgs = [
    "&time=", "&uni=", "&body=", "&members=", "&title=", "&type"];
var NEWEVENTARGS = eArgs.length; //6
var EIDLENGTH = 4;

var qTypes = {
    nEvent: "newevent",
    uMembers: "updatemembers",
    uViews: "updateviews",
    sPop: "sortpop",
    sWord: "sortword",
    sTime: "sorttime"
};


app.get('/:tokenstring', function (request, response, next) {
    var apiCode = request.originalUrl.substring(1);
    if (apiCode.toLowerCase().substring(0,qTypes.uViews.length) == qTypes.uViews){
        //Sample Query: updateviews&eID=1234
        //Another sample: updateMembers&eID=1234&email=dave@gatech.edu
        //newevent&title=&body=&type=&members=&uni=
        //response.render('index', {val: "",title: apiCode});
        //abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&'*+-/=?^_`{|}~.

        //this query has a secret eID and no user input so no need for sanitization
        var eID = apiCode.substring(apiCode.indexOf('&eID=')+6, apiCode.indexOf("&",apiCode.indexOf('&eID=')+6)!=-1 ?(apiCode.indexOf("&", apiCode.indexOf('eID')+6)):apiCode.length);
        connection.query("update events set views = views + 1 where eID =" + "'" + eID + "'", 0, function (err2, result2) {
        console.log(err2);
        if (err2 != undefined) {
            //response.render('index', {val: err2});
            response.json(err2);
        }
        });
    } else if (apiCode.toLowerCase().substring(0,qTypes.uMembers.length) == qTypes.uMembers) {
        //Another sample: updateMembers&eID=1234&email=dave@gatech.edu&remove
        // updateMembers&eID=1234&email=hello&eID=1234@gatech.edu&remove <--why we need to sanitize
        //only argument with user input in this update members query is the email so sanitization is required for this input first before any other params are parsed
        //email logic rules: since registered emails are only .edu, we look for this server address(lastindexof since only input) and simply remove the whole email from the query string.
        ////var email = apiCode.substring(apiCode.indexOf("&email=")+8, apiCode.indexOf("&",apiCode.indexOf('&email=')+8)!=-1 ?(apiCode.indexOf("&", apiCode.indexOf('&email')+8)):apiCode.length);
        var email = apiCode.substring(apiCode.toLowerCase().indexOf("&email=") + 8, apiCode.toLowerCase().lastIndexOf(".edu") + 5);
        apiCode = apiCode.replace(email, ""); //removes any intermediate queries inside email
        //eID = apiCode.substring(apiCode.indexOf('eID')+4, apiCode.indexOf("&",apiCode.indexOf('eID')+4)!=-1 ?(apiCode.indexOf("&", apiCode.indexOf('eID')+4)):apiCode.length);
        eID = apiCode.substring(apiCode.toLowerCase().indexOf("&eid=") + 6, apiCode.toLowerCase().indexOf("&eid=") + 6 + EIDLENGTH + 1);
        var remove = apiCode.toLowerCase().includes('&remove');
        if (remove) {
            connection.query("update events set members = replace(members, concat('|',?), '') where eID =" + "'" + eID + "'", email, function (err2, result2) {
                console.log(err2);
                if (err2 != undefined) {
                    //response.render('index', {val: err2});
                    response.json(err2);
                }
            });
        } else {
            connection.query("update events set members = replace(members, concat('|',?), '') where eID =" + "'" + eID + "'", email, function (err2, result2) {
                connection.query("update events set members = concat(members,concat('|',?)) where eID =" + "'" + eID + "'", email, function (err2, result2) {
                });
                //response.render('index', {val: err2});
                response.json(err2);
            });

        }




        //return;
    } else if (apiCode.toLowerCase().substring(0,qTypes.nEvent.length) == qTypes.nEvent) {
        var pre = apiCode.substring("newevent".length + 1).split("&");
        var body = ""; //can't really parse this query cause everything is dependent on user input so just reject if incorrect amount of each required param
                       // also users with emails that have a param in them won't be able to create an event but that's ok since their emails are rare
        var title = "";
        var type = 0;
        if (pre.length != NEWEVENTARGS) {
            //bad
        }
        for (var i = 0; i < NEWEVENTARGS.length; i++) {
            if (apiCode.toLowerCase().indexOf(eArgs[i]) != apiCode.toLowerCase().lastIndexOf(eArgs[i])) {
                response.json("Error, query has multiple parameters of the same type (injection?)");
                return;
            }
        }
        //newevent&title=&body=doop&title=florb&type=&members=&uni=
        //newevent&title=[zzzz&uni=EM]&body=test&uni=GT
        //RULE FOR EVEN ACCEPTING QUERY: ALL USER INPUT PARAMETERS MUST BE placed together and at the end of the query
        //logic: since body, title and members can be modified, find first of these params, then remove any mentions of the param from the entire query string. rinse and repeat


        /*var tI = apiCode.toLowerCase().indexOf("&title="); //LITERAL ERROR CHECKING NOT POSSIBLE WITH CURRENT QUERY FORMATION AND PARAMETERS: JUST SEND ERROR IF MULTIPLE PARAMS DETECTED
        var bI = apiCode.toLowerCase().indexOf("&body=");
        var mI = apiCode.toLowerCase().indexOf("&members=");
        var fParam = Math.min(tI, bI, mI);
        if (fParam == tI) {
            apiCode = apiCode.substring(0,tI + 8) + apiCode.substring(tI + 8).replace(/&title=/ig, ''); //remove any further instances of &title= param
            //title = apiCode.substring(tI, )
        } else if (fParam = bI) {

        } else {

        }
        */
        title  = apiCode.substring(apiCode.toLowerCase().indexOf('&title=')+8, apiCode.indexOf("&",apiCode.toLowerCase().indexOf('&title=')+8)!=-1 ?(apiCode.indexOf("&", apiCode.toLowerCase().indexOf('&title=')+8)):apiCode.length);
        body  = apiCode.substring(apiCode.toLowerCase().indexOf('&body=')+7, apiCode.indexOf("&",apiCode.toLowerCase().indexOf('&body=')+7)!=-1 ?(apiCode.indexOf("&", apiCode.toLowerCase().indexOf('&body=')+7)):apiCode.length);
        type  = apiCode.substring(apiCode.toLowerCase().indexOf('&type=')+7,apiCode.toLowerCase().indexOf('&type=') + 9); //1 digit int

        var members = apiCode.substring(apiCode.toLowerCase().indexOf('&members=')+10, apiCode.indexOf("&",apiCode.toLowerCase().indexOf('&members')+10)!=-1 ?(apiCode.indexOf("&", apiCode.toLowerCase().indexOf('&members')+10)):apiCode.length);
        var uni = apiCode.substring(apiCode.toLowerCase().indexOf('&uni=')+6, apiCode.indexOf("&",apiCode.toLowerCase().indexOf('&uni=')+6)!=-1 ?(apiCode.indexOf("&", apiCode.toLowerCase().indexOf('&uni=')+6)):apiCode.length);
        var time = apiCode.substring(apiCode.toLowerCase().indexOf('&time=')+6, apiCode.indexOf("&",apiCode.toLowerCase().indexOf('&time=')+6)!=-1 ?(apiCode.indexOf("&", apiCode.toLowerCase().indexOf('&time=')+6)):apiCode.length);
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
    } else if (apiCode.toLowerCase().substring(0,qTypes.sPop.length) == qTypes.sPop) { //sortPop&page=&time=&uni=
        time = apiCode.substring(apiCode.indexOf("&time")+6,apiCode.indexOf("&",apiCode.indexOf("&time")+6 )!=-1 ? apiCode.indexOf("&", apiCode.indexOf("&time")+6): apiCode.length );
        uni = apiCode.substring(apiCode.indexOf("&uni")+5,apiCode.indexOf("&",apiCode.indexOf("&uni")+5 )!=-1 ? apiCode.indexOf("&", apiCode.indexOf("&uni")+5): apiCode.length );
        var offset = apiCode.substring(apiCode.indexOf("&page")+6,apiCode.indexOf("&",apiCode.indexOf("&page")+6 )!=-1 ? apiCode.indexOf("&", apiCode.indexOf("&page")+6): apiCode.length ) * 5;

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
    } else if (apiCode.toLowerCase().substring(0,qTypes.sWord.length) == qTypes.sWord) {
        //return 5 rows that fit the word and are popular
        apiCode=decodeURIComponent(apiCode);
        //time = apiCode.substring(apiCode.indexOf("&time")+6,apiCode.indexOf("&",apiCode.indexOf("&time")+6 )!=-1 ? apiCode.indexOf("&", apiCode.indexOf("&time")+6): apiCode.length );
        uni = apiCode.substring(apiCode.indexOf("&uni")+5,apiCode.indexOf("&",apiCode.indexOf("&uni")+5 )!=-1 ? apiCode.indexOf("&", apiCode.indexOf("&uni")+5): apiCode.length );
        offset = apiCode.substring(apiCode.indexOf("&page")+6,apiCode.indexOf("&",apiCode.indexOf("&page")+6 )!=-1 ? apiCode.indexOf("&", apiCode.indexOf("&page")+6): apiCode.length ) * 5;
        var keyWord = '%'+apiCode.substring(apiCode.indexOf("&word")+6,apiCode.indexOf("&",apiCode.indexOf("&word")+6 )!=-1 ? apiCode.indexOf("&", apiCode.indexOf("&word")+6): apiCode.length )+'%';
        testQuery2 = connection.query("select * from events where uni = ? AND title LIKE ? OR body LIKE ? ORDER BY time DESC LIMIT ?, 5", [ uni, keyWord, keyWord, offset ], function (err, result) {
            console.log(err);
            console.log(testQuery2.sql);
            //response.render('index', {val: err});
            var json = JSON.stringify(result);
            response.json(result);
            //console.log(json);
        });
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
