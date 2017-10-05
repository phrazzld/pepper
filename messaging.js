// messaging.js

// Twilio config
var twilioClient = require('twilio')(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

// Message delay config
var messageDelay = 750

// messages is an array of text message content to send
function sendText (toNumber, fromNumber, messages) {
  var messageContent
  if (messages.length > 0) {
    messageContent = messages.shift().speech
    if (messageContent) {
      twilioClient.messages
        .create({
          to: toNumber,
          from: fromNumber,
          body: messageContent
        })
        .then(function (message) {
          setTimeout(sendText, messageDelay, toNumber, fromNumber, messages)
        })
    } else {
      console.log('No message content')
    }
  } else {
    console.log('No more messages')
  }
}

module.exports = {
  sendText: sendText
}
