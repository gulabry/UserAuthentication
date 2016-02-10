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
var flash = require('connect-flash');

var app = express();

//Connects to AWS Elasticache Endpoint 

//credentials.aws.elasticacheEndpoint
var redisClient = require('redis').createClient(6379, '127.0.0.1', {no_ready_check: true});
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

app.get('/getCurrentUser', function(req, res) {
    
    if (session.user !== undefined) {
        
        res.send(session.user);
        
    } else {
        
        res.send({username : "User"});  
    }
    
});



//Configure Passport

var localStrategy = new LocalStrategy(function(username, password, done) {
    
   //code to validate that username and password are valid credentials
  
   //Dynamo DB query syntax
    var params = {
        AttributesToGet : ["email", "username", "password"],
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
            
           //If no user was returned from the query, fail local auth
           if (Object.keys(data).length == 0) {
               
                return done(null, false);
                
            } else {

                if (data.Item.password.S === password) {
                    var userObject = { 
                        username : data.Item.username.S,
                        email : data.Item.email.S 
                    }    
                    
                    session.user = userObject;

                    console.log('Local Stratgey: ' + JSON.stringify(userObject));
                    done(null, JSON.stringify(userObject)); 
                } else {
                    console.log("password didn't match");
                    return done(null, false);
                }

            }
        }
    }); 
});

var facebookStrategy = new FacebookStrategy({
    clientID: credentials.facebook.clientId,
    clientSecret: credentials.facebook.clientSecret,
    callbackURL: "http://localhost:8080/signin/facebook/callback"
  }, 
  
  function(accessToken, refreshToken, profile, cb) {
    addUser(profile, cb)
  });
  


//This function only adds new users to Dynamo, however if use exists it overwrites the data
var addUser = function(profile, cb) {
    
    console.log(profile);

            var newUser = {
                "username": {"S": profile.displayName},
                "email": {"S": "test@email.com"},
                "password": {"S": "facebookDisplay"}
            }
            
        database.putItem({
            "TableName": "User",
            "Item": newUser
        }, function (err, data) {
            if (err) {
                console.log(err);
            } else {
            console.log("User added: " + JSON.stringify(newUser));
            
            var formattedUser = {
                username: newUser.username.S,
                email: newUser.email.S,
                password: newUser.password.S 
            }
            
            session.user = formattedUser;
            
                return cb(err, data);
            }
        });
};

//use the configured local strategy
passport.use(localStrategy);
passport.use(facebookStrategy);

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

app.use(passport.initialize());
app.use(passport.session());

//Load static files
app.use(express.static(__dirname + '/static/public'));                                                                                                                         

//Local sign up route, redirects to home if it can't find a user
app.post('/signin/local', function (req, res, next) {
    
  passport.authenticate('local', function(err, user, info) {
    if (err) {
      return next(err); // will generate a 500 error
    }
    // Generate a JSON response reflecting authentication status
    if (!user) {
      return res.redirect('/');
    }
    req.user = user;
    req.login(user, loginErr => {
      if (loginErr) {
        return next(loginErr);
      }
      return res.redirect('/secure.html');
    });      
  })(req, res, next);
    
});

//Facebook sign in route
app.get('/signin/facebook', passport.authenticate('facebook'));

//Facebook sign in callback
app.get('/signin/facebook/callback', passport.authenticate('facebook'), function(req, res) {
    res.redirect('/secure.html');
});

//Logout the current user and move them back to the home page                                                  
app.get('/signout', function(req, res) {
    req.logout();
    session.user = undefined; //reset custom user property
    res.redirect('/');
}); 

//Move the user to the signup page
app.get('/signup', function(req,res) {
   return res.redirect('/signup.html'); 
});


app.get('/secure', authenticate, function (req, res) {
    return res.redirect('/secure.html');
});

app.post('/createUser', function(req, res) {
    
    console.log(req.body);
    
    //if the password and confirm match, add user
    if (req.body.password === req.body.passwordConfirm) {
        
        var params = {
            "TableName": "User",
            "Item": {
                "username": {"S": req.body.username},
                "email": {"S": req.body.email},
                "password": {"S": req.body.password}
            }
        }
        
        database.putItem(params
        , function (err, data) {
            if (err) {
                console.log(err);
            } else {
                console.log("User added: " + JSON.stringify(data));
                    
                var newUser = params.Item;    
                             
                var formattedUser = {
                    username: newUser.username.S,
                    email: newUser.email.S,
                    password: newUser.password.S 
                }
                
                session.user = formattedUser;
                
                // req.user = JSON.stringify(data);
                req.login(data, function(err) {
                    if (err) { return next(err); }
                    return res.redirect('/secure.html');
                });
            }
        });
    } else {
       res.send("Passwords don't match, try again!");
    }
    
});

//If user is logged in or not, redirect or keep walking down middleware chain
function authenticate(req, res, next) {
    
    if (req.isAuthenticated()) {
       return next();
    } 
    
    res.redirect('/');
}; 

app.use(authenticate);

app.use(express.static(__dirname + '/static/secure/'));

app.listen(80, function() {
    console.log('server is listening..');
});