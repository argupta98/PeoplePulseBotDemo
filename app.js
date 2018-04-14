var restify = require('restify');
var builder = require('botbuilder');
var fileSystem = require('fs');
var inMemoryStorage = new builder.MemoryBotStorage();

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

// prompt user for satisfaction data
var bot = new builder.UniversalBot(connector, [
	function(session){
		session.beginDialog('promptSatisfactionRating');
	},
    function(session, result){
    	session.userData.profile = result.response;
    	session.send("Thanks for your time!")

    	//write data to file in tab delimited format
      	fileSystem.appendFile("./ClientData.xls", 
    		` \n ${Date()} \t ${session.userData.profile.name} \t ${session.userData.profile.rating} \t `+
    		`${session.userData.profile.dissatisfied} \t ${session.userData.profile.reason} \t ${session.userData.profile.comments}`, 
    		function(err, file){
    		if(err) throw err;
    		console.log("Saved data!");
    	})
    	session.endDialog();
    }]

).set('storage', inMemoryStorage);

//Dialog to see hoe the User feels about their company
bot.dialog('promptSatisfactionRating', [
    function (session) {
    	session.dialogData.profile = {};
        builder.Prompts.text(session, "Hi! My name is Pheobe! What's yours?");
    },
    function (session, result) {
    	session.dialogData.profile.name = result.response;
    	session.send(`Hi ${result.response}!`);
    	builder.Prompts.text(session, 
    		"How would you rate working at your company from 0-10?");
    },
    function(session, result){
    	session.dialogData.profile.rating = result.response;
    	session.beginDialog('decideWhyDissatisfied', session.dialogData.profile);
    },
    function(session, result){
    	session.dialogData.profile.dissatisfied = result.response.dissatisfied;
    	session.dialogData.profile.reason = result.response.reason;
    	builder.Prompts.text(session, "Thanks for the feedback! Do you have anything else on your mind?");
    },
    function(session, result){
    	session.dialogData.profile.comments = result.response;
        session.endDialogWithResult({ response: session.dialogData.profile });
    }
]);

//Dialog to check if user is dissatisfied
bot.dialog('decideWhyDissatisfied', [
    function (session, args, next) {
    	session.dialogData.subProfile = {};
    	if(parseInt(args.rating,10) < 7){
    		builder.Prompts.text(session, "Would you say that you are dissatisfied working at your company?");
    	}
    	else{
    		//if they answer higher than a 6 just move on
    		session.dialogData.subProfile.dissatisfied = false;
    		next();
    	}
    },
    function (session, result, next) {
    	if(result.response){
    		//Check if they are acctually dissatified
    		//TODO: Add intent recognition for free-form responses
    		if(result.response == "yes"){
    			session.dialogData.subProfile.dissatisfied = true;
	    		builder.Prompts.text(session, "I'm sorry to hear that :( May I ask why?");
    		}
    		//Case they are not dissatisfied
	    	else{
	    		session.dialogData.subProfile.dissatisfied = false;
	    		next();
	    	}
	    }
	    //They already rate company > 6
	    else{
	    	next();
	    }
    },
    function(session, result){
    	//get the response data
    	if(result.response){
    		session.dialogData.subProfile.reason = result.response;
    	}
    	else{
    		session.dialogData.subProfile.reason = "n/a";
    	}
    	session.endDialogWithResult({ response: session.dialogData.subProfile })
    }
]);