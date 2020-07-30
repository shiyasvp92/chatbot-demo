const express = require('express');
var bodyParser = require('body-parser')
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const MongoClient = require('mongodb').MongoClient;

var mongoose = require('mongoose');

var User = mongoose.model('User',{
    name : String,
    email : String,
    phone: String,
    fake: Boolean
  })

  
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}))

var dbUrl = 'mongodb+srv://user:RaCjA13RSlo691V2@chatbot.nlzxb.mongodb.net/chatbot'

app.get('/', function(req, res) {
    res.send('I am alive');
});

app.get('/bot', function(req, res) {
    res.render('index.ejs');
});

let user, currentStepQueue, genuine, userSaved, timer = 15 * 1000, queryTimer;

function sendMessage(user, message) {
    io.emit('chat_message', `<strong>${user}: </strong> ${message}`)  
}

function currentStep() {
    const step = currentStepQueue[0];

    if(step && step !== 'query') sendMessage('Agent', `Please enter your ${step}`)
    else if(step === 'query'){
        if(!userSaved) {
            sendMessage('Agent', `Any other queries?`);
            onQueryStep();
        }
        // else confirmMessage();
    }

}

function onInit() {
    user = {
        name: null,
        email: null,
        phone: null,
        fake: false
    };
    currentStepQueue = ['name', 'email', 'phone', 'query'];
    genuine = false;
    userSaved = false;
}

function onMessage(step, message) {
    let fake = false;
    const emailRegex = /([\w\.\-_]+)?\w+@[\w-_]+(\.\w+){1,}/;
    const mobileRegex = /^[6-9](?!\d*(\d)\1{4})\d{9}$/;

    switch (step) {
        case 'email':
            if(!emailRegex.test(message)) fake = true;
            break;
        case 'phone':
            if(!mobileRegex.test(message)) fake = true;
            break;
        case 'query':
            if (message.includes('pricing')) genuine = true;
            else if (message.includes('free')) fake = true;
            break;
    }

    if(step !== 'query') user[step] = message;
    if(fake) user.fake = fake;
}

function saveUser() {
    if(userSaved) return;

    console.log('saving user...');
    if(genuine) user.fake = false;

    var userModel = new User(user);
    userModel.save((err) =>{
        if(err){
            console.log(err);
            sendMessage('System: ', 'Something went wrong');
        }

        confirmMessage();

        sendMessage('Agent: ', 'Thanks for contacting, have a nice day');
        onInit();
    })

    userSaved = true;
}

function confirmMessage() {
    if(user.fake) sendMessage('Agent: ', 'A team member will call you soon');
    else sendMessage('Agent: ', 'A team member will call you in 10 minutes');
}

function onQueryStep() {
    if(!queryTimer) {
        console.log('timer starts...');
        queryTimer = setTimeout(function() {
            user.fake = true;
    
            sendMessage('System: ', 'Time out...')
            console.log('timed out: ', user);
            saveUser();
        }, 20 * 1000)
    }
}

function onCompleteSteps(message) {
    if(queryTimer) clearInterval(queryTimer);

    saveUser();
}

io.sockets.on('connection', function(socket) {
    onInit();
    let messageTimeout = setTimeout(onTimeOut, timer);

    function onTimeOut() {
        user.fake = true;
    }

    function resetTimeout() {
        clearTimeout(messageTimeout);

        if(currentStepQueue.length > 0) messageTimeout = setTimeout(onTimeOut, timer); 
    }

    io.emit('connected', 'Welcome to our chatbot, we will assign you one of our agent soon.');
    
    currentStep();

    socket.on('chat_message', function(message) {

        const step = currentStepQueue.shift();
        if(step) onMessage(step, message);
        if(step === 'query') onCompleteSteps(message);

        sendMessage('You', message)
        currentStep();
        resetTimeout();
    });

});

mongoose.connect(dbUrl ,{} ,(err) => {
    console.log('mongodb connected',err);
  })

const server = http.listen(4400, function() {
    console.log('listening on *: 4400');
})