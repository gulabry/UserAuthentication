'use strict';

var AWS = require('aws-sdk');
var express = require('express');  
var morgan = require('morgan');
var bodyParser = require('body-parser');
var session = require('express-session');
var credentials = require('./secret/aws-credentials.json');
var uuid = require('node-uuid');
var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;

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
app.use(morgan('combined'))

//Configure Passport
passport.use(new FacebookStrategy({
    clientID: credentials.facebook.clientId,
    clientSecret: credentials.facebook.clientSecret,
    callbackURL: "http://localhost:8080/secure.html"
  },
  function(accessToken, refreshToken, profile, cb) {
      
      
      console.log(profile);
      cb(null, profile);
    // User.findOrCreate({ facebookId: profile.id }, function (err, user) {
    //   return cb(err, user);
    // });
  }
));

database.listTables(function (err, data)
{
   console.log('Tables:', data);
});