// apiAi.js

// Import packages
var request = require('request')

// Configure access token
var accessToken = process.env.CLIENT_ACCESS_TOKEN
var botBaseUrl = 'https://api.api.ai/v1/query?v=20150910'

// Send a POST request to API.AI
function post (data) {
  // Gotta stringify our data blob to ensure safe delivery
  var stringified = JSON.stringify(data)
  // Define our request options
  var options = {
    url: botBaseUrl,
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: stringified
  }
  // Make our request
  request.post(options, function (err, res, bod) {
    // Handle any errors if they occur
    if (err) {
      console.error(err)
    }
  })
}

// Build data blob for event POST requests
function buildEventBlob (eventName, eventData, contexts, timezone, sessionId) {
  var blob = {
    event: {
      name: eventName,
      data: eventData
    },
    contexts: contexts,
    timezone: timezone,
    sessionId: sessionId,
    lang: 'en'
  }
  return blob
}

// Build data blob for query POST requests
function buildQueryBlob (query, contexts, timezone, sessionId) {
  var blob = {
    query: [query],
    contexts: contexts,
    timezone: timezone,
    sessionId: sessionId,
    lang: 'en'
  }
  return blob
}

module.exports = {
  post: post,
  buildEventBlob: buildEventBlob,
  buildQueryBlob: buildQueryBlob
}
