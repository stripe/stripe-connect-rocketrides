'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');
const Ride = require('./ride');

// Define the Pilot schema.
const PilotSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    validate: {
      // Custom validator to check if the email was already used.
      validator: PilotEmailValiidator,
      message: 'This email already exists. Please try to log in instead.',
    }
  },
  password: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: 'individual',
    enum: ['individual', 'company']
  },
  firstName: String,
  lastName: String,
  address: String,
  postalCode: String,
  city: String,
  state: { type: String}, 
  country: { type: String, default: 'US' },
  created: { type: Date, default: Date.now },
  rocket: {
    model: String,
    license: String,
    color: String
  },
  businessName: String,
  // Stripe account ID to send payments obtained with Stripe Connect.
  stripeAccountId: String,
});

// Check the email addess to make sure it's unique (no existing pilot with that address).
function PilotEmailValiidator(email) {
  const Pilot = mongoose.model('Pilot');
  // Asynchronously resolve a promise to validate whether an email already exists
  return new Promise((resolve, reject) => {
    // Only check model updates for new pilots (or if the email address is updated).
    if (this.isNew || this.isModified('email')) {
      // Try to find a matching pilot
      Pilot.findOne({email}).exec((err, pilot) => {
        // Handle errors
        if (err) {
          console.log(err);
          resolve(false);
          return;
        }
        // Validate depending on whether a matching pilot exists.
        if (pilot) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    } else {
      resolve(true);
    }
  });
}

// Return a pilot name for display.
PilotSchema.methods.displayName = function() {
  if (this.type === 'company') {
    return this.businessName;
  } else {
    return `${this.firstName} ${this.lastName}`;
  }
};

// List rides of the past week for the pilot.
PilotSchema.methods.listRecentRides = function() {
  const weekAgo = Date.now() - (7*24*60*60*1000);
  return Ride.find({ pilot: this, created: { $gte: weekAgo } })
    .populate('passenger')
    .sort({ created: -1 })
    .exec();
};

// Generate a password hash (with an auto-generated salt for simplicity here).
PilotSchema.methods.generateHash = function(password) {
  return bcrypt.hashSync(password, 8);
};

// Check if the password is valid by comparing with the stored hash.
PilotSchema.methods.validatePassword = function(password) {
  return bcrypt.compareSync(password, this.password);
};

// Get the first fully onboarded pilot.
PilotSchema.statics.getFirstOnboarded = function() {
  return Pilot.findOne({ stripeAccountId: { $ne: null } })
    .sort({ created: 1 })
    .exec();
};

// Get the latest fully onboarded pilot.
PilotSchema.statics.getLatestOnboarded = function() {
  return Pilot.findOne({ stripeAccountId: { $ne: null } })
    .sort({ created: -1 })
    .exec();
};

// Pre-save hook to define some default properties for pilots.
PilotSchema.pre('save', function(next) {
  // Make sure certain fields are blank depending on the pilot type.
  if (this.isModified('type')) {
    if (this.type === 'individual') {
      this.businessName = null;
    } else {
      this.firstName = null;
      this.lastName = null;
    }
  }
  // Make sure the password is hashed before being stored.
  if (this.isModified('password')) {
    this.password = this.generateHash(this.password);
  }
  next();
});

const Pilot = mongoose.model('Pilot', PilotSchema);

module.exports = Pilot;
