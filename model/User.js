'use strict';

var AWS = require("aws-sdk");
var credentials = require('../secret/aws-credentials.json');

AWS.config.update({region : 'us-east-1', accessKeyId: credentials.aws.accessKey, secretAccessKey: credentials.aws.secret});

var db = new AWS.DynamoDB();

//represents a user
class User {
    //constructs a new user given an id and display name
    constructor(username, password, email) {
        this._username = username;
        this._password = password;
        this._email = email;
    }
    
    //returns the user's display name
    get username() {
        return this.username;
    }
    
    get testUser() {
       return new User("testerNumber1", "password", "test@app.com"); 
    }

    //save the user back to the database
    save() {

        var params = {
            TableName:"User",
            Item: {
                "username": this._username,
                "password" : this._password,
                "info": this._email
            }
        };
       

        console.log("Adding a new user to db...");
        
        docClient.put(params, function(err, data) {
            if (err) {
                console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
            } else {
                console.log("Added item:", JSON.stringify(data, null, 2));
            }
        });        
    }
    
    hashPassword() {
        
    }
    
    findOrCreate(email, next) {
        //find the user
        db.getItem(params, function(err, data) {
            if (err) {
                console.log(err);
                done(null, false);
                
            } else {
                
            //If no user was returned from the query, fail local auth
            if (Object.keys(data).length == 0) {
                
                    return done(null, false);
                    
                } else {

                        var userObject = { 
                            username : data.Item.username.S,
                            email : data.Item.email.S 
                        }    

                        console.log('Local Stratgey: ' + JSON.stringify(userObject));
                        done(null, JSON.stringify(userObject)); 
                }
            }
        }); 
            
    };
}

//export the User class
module.exports = User;