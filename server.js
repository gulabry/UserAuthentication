'use strict';

var AWS = require('aws-sdk');
var express = require('express');  
var morgan = require('morgan');
var bodyParser = require('body-parser');
var session = require('express-session');
var credentials = require('./secret/aws-credentials.json');
var uuid = require('node-uuid');
var User = require('./model/User');
var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;
var LocalStrategy = require('passport-local').Strategy;

var app = express();

//Connects to AWS Elasticache Endpoint
var redisClient = require('redis').createClient(6379, credentials.aws.elasticacheEndpoint, {no_ready_check: true});
var RedisStore = require('connect-redis')(session);

//Configure AWS
AWS.config.update({region : 'us-east-1', accessKeyId: credentials.aws.accessKey, secretAccessKey: credentials.aws.secret});

//Grab Dynamo Database
var database = new AWS.DynamoDB();
 
//We make a new session but set the client as the Elasticache Server (instead of a local redis server on the EC2)
app.use(session({
    resave : false,
    saveUninitialized: false,
    secret : credentials.app.sessionSecret, //Cookie Secret that identifies session
    store : new RedisStore({client : redisClient})
}));

//Log all requests to application with Morgan
app.use(morgan('dev'))

//parse JSON in the request body
app.use(bodyParser.urlencoded({
  extended: true
}));

//Configure Passport

var localStrategy = new LocalStrategy(function(username, password, done) {
   //code to validate that username and password are valid credentials
   
   //Dynamo DB query syntax
    var params = {
        AttributesToGet : ["email", "username"],
        TableName : "User",
        Key : {
            "username" : {
                "S" : username
            }  
        }
    };

    //find the user
    database.getItem(params, function(err, data) {
        if (err) {
            console.log(err);
            done(null, false);
            
        } else {
           
            var userObject = { 
                username : data.Item.username.S,
                email : data.Item.email.S 
            }
            
            console.log('Local Stratgey: ' + JSON.stringify(userObject));
            
            done(null, JSON.stringify(userObject)); 
        }
    }); 
});

//use the configured local strategy
passport.use(localStrategy);

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

app.use(passport.initialize());
app.use(passport.session());

app.get('/', function(req, res) {
    res.redirect("/index.html");
});

app.post('/signin/local', passport.authenticate('local'), function(req, res) {
    res.redirect('/secure/secure.html');
});
                                                    
//Load static files
app.use(express.static(__dirname + '/static/'));

//If user is logged in or not, redirect or keep walking down middleware chain
app.use(function(req, res, next) {
    
    if (req.isAuthenticated()) {
       return next();
    } 
    
    res.redirect('/');
});
                                                                                  
app.use(express.static(__dirname + '/static/secure/'));

app.listen(80, function() {
    console.log('server is listening..');
});