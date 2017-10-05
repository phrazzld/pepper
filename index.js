// index.js

var express = require('express')
var app = express()

// Imported packages
var sanitizer = require('express-sanitizer')
var bodyParser = require('body-parser')
var moment = require('moment-timezone')
var mongoose = require('mongoose')
mongoose.Promise = global.Promise
var User = require('./models/user')

// Application modules
var config = require('./config')
var messaging = require('./messaging')
var apiAi = require('./apiAi')

// Connect mongoose to mongo
mongoose.connect(config.mongoUrl)
mongoose.connection
  .once('open', function () {
    console.log('Mongoose successfully connected to Mongo')
  })
  .on('error', function (err) {
    console.error('Mongoose/ Mongo connection error: ', err)
  })

// Enable body-parser and express-sanitizer on our app
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(sanitizer())

// Make sure our requests go through
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST')
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, Access-Control-Alow-Credentials'
  )
  res.header('Access-Control-Allow-Credentials', 'true')
  next()
})

// Twilio webhook endpoint
app.post('/twilio', function (req, res) {
  console.log('Hit Twilio hook')
  // Pull phone number and message
  var userPhone = req.body.From
  var userMessage = req.body.Body
  // Set sessionId and other API.AI values
  var sessionId = userPhone.substring(1)
  var timezone = 'America/Los_Angeles'
  var contexts = []
  var blob
  User.findOne({ phone: userPhone })
    .then(function (user) {
      if (user) {
        // User exists, process request
        console.log('Found user with phone number ' + userPhone)
        blob = apiAi.buildQueryBlob(userMessage, contexts, timezone, sessionId)
        apiAi.post(blob)
      } else {
        // Create new user, then process request
        console.log('Creating user with phone number ' + userPhone)
        User.create({ phone: userPhone })
          .then(function (user) {
            console.log('New user successfully created')
            blob = apiAi.buildEventBlob('newUser', user, contexts, timezone, sessionId)
            apiAi.post(blob)
          })
          .catch(function (reason) {
            console.log('Problem creating new user')
            console.error(reason)
          })
      }
    })
  res.send('Success')
})

// API.AI webhook endpoint
app.post('/apiai', function (req, res) {
  console.log('Hit API.AI hook')
  console.log(req.body)
  var apiAiMessages = req.body.result.fulfillment.messages
  var userPhone = '+' + req.body.sessionId
  messaging.sendText(userPhone, config.pepperPhone, apiAiMessages)
  res.send('Success')
})

// Start listening for events on our port
app.listen(config.port, function (req, res) {
  console.log('Port ' + config.port + ': "Whirrr..."')
})
