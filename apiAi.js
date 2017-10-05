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
  console.log(JSON.stringify(options, null, 2))
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
  console.log(JSON.stringify(blob, null, 2))
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

// Grab values for each key containing the given string
function extractAction (keys, action) {
  return keys.filter(function (k) {
    if (k.indexOf(action) > -1) {
      return k
    }
  })
}

// Handle the parameters returned by API.AI
function handleParameters (params, contexts, user) {
  var paramKeys = Object.keys(params)
  var updates = extractAction(keys, 'updateAttribute')
  handleUpdates(updates, params, user)
}

// Update user given parameters
function handleUpdates (updates, params, user) {
  for (var i = 0; i < updates.length; i++) {
    var attribute = params[updates[i]]
    var value = params['update-' + attribute]
    if (value) {
      update(attribute, value, user)
    }
  }
}

// Update an attribute for a given user
function update (attribute, value, user) {
  user[attribute] = value
  user.save(function (err, user) {
    if (err) {
      console.error(err)
    }
  })
}

module.exports = {
  post: post,
  buildEventBlob: buildEventBlob,
  buildQueryBlob: buildQueryBlob,
  extractAction: extractAction,
  handleParameters: handleParameters,
  handleUpdates: handleUpdates
}
