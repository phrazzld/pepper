var mongoose = require('mongoose')
var Schema = mongoose.Schema

var UserSchema = new Schema(
  {
    name: {
      type: String,
      trim: true
    },
    phone: {
      type: String,
      required: true
    },
    contacts: {
      type: Array,
      default: new Array()
    }
  }, {
    timestamps: true
  }
)

var User = mongoose.model('User', UserSchema)
module.exports = User
