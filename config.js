// config.js

module.exports = {
  mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/pepper',
  port: process.env.PORT || 8080,
  pepperPhone: '+14159682217'
}
