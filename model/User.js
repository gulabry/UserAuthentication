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
}

//export the User class
module.exports = User;