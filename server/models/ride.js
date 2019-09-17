'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Use native promises.
mongoose.Promise = global.Promise;

// Define the Ride schema.
const RideSchema = new Schema({
  pilot: { type : Schema.ObjectId, ref : 'Pilot', required: true },
  passenger: { type : Schema.ObjectId, ref : 'Passenger', required: true },
  origin: { type: [Number], index: '2d', sparse: true, default: [37.7765030, -122.3920385] },
  destination: { type: [Number], index: '2d', sparse: true, default: [37.8199286, -122.4782551] },
  pickupTime: { type: Date, default: Date.now },
  dropoffTime: { type: Date, default: new Date((new Date).getTime() + Math.floor(10 * Math.random()) * 60000) },
  amount: Number,
  currency: { type: String, default: 'usd' },
  created: { type: Date, default: Date.now },

  // Stripe Payment Intent ID corresponding to this ride.
  stripePaymentIntentId: String
});

// Return the ride amount for the pilot after collecting 20% platform fees.
RideSchema.methods.amountForPilot = function() {
  return parseInt(this.amount * 0.8);
};

const Ride = mongoose.model('Ride', RideSchema);

module.exports = Ride;
