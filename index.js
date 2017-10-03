// index.js

var express = require('express')
var app = express()

// Packages
var sanitizer = require('express-sanitizer')
var bodyParser = require('body-parser')
var moment = require('moment-timezone')
var request = require('request')
var mongoose = require('mongoose')
mongoose.Promise = global.Promise
var User = require('./models/user')

// Twilio config
var twilioClient = require('twilio')(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

// API.AI config
var accessToken = process.env.CLIENT_ACCESS_TOKEN

// Application modules
var config = require('./config')

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
  var userPhoneNumber = req.body.From
  var userMessage = req.body.Body
  // Set sessionId
  var sessionId = userPhoneNumber.substring(1)
  var blob = {
    query: [userMessage],
    contexts: [],
    lang: 'en',
    timezone: 'America/Los_Angeles',
    sessionId: sessionId
  }
  var opts = {
    url: 'https://api.api.ai/v1/query?v=20150910',
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(blob)
  }
  User.findOne({ phone: userPhoneNumber })
    .then(function (user) {
      if (user) {
        // User exists, process request
        console.log('Found user with phone number ' + userPhoneNumber)
        request.post(opts, function (err, response, body) {
          if (err) {
            console.log('Error posting to API.AI')
            console.error(err)
          }
        })
      } else {
        // Create new user, then process request
        console.log('Creating user with phone number ' + userPhoneNumber)
        User.create({ phone: userPhoneNumber })
          .then(function (user) {
            request.post(opts, function (err, response, body) {
              if (err) {
                console.log('Error posting to API.AI')
                console.error(err)
              }
            })
          })
      }
    })
  res.send('Success')
})

// API.AI webhook endpoint
app.post('/apiai', function (req, res) {
  console.log('Hit API.AI hook')
  console.log(req.body)
  twilioClient.messages
    .create({
      to: '+' + req.body.sessionId,
      from: '+14159682217',
      body: req.body.result.fulfillment.speech
    })
  res.send('Success')
})

// Start listening for events on our port
app.listen(config.port, function (req, res) {
  console.log('Port ' + config.port + ': "Whirrr..."')
})
