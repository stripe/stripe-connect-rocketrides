'use strict';

const config = require('../../config');
const stripe = require('stripe')(config.stripe.secretKey);
const express = require('express');
const router = express.Router();
const Pilot = require('../../models/pilot');
const Passenger = require('../../models/passenger');
const Ride = require('../../models/ride');

/**
 * POST /api/rides
 *
 * Create a new ride with the corresponding parameters.
 */
router.post('/', async (req, res, next) => {
  // Important: For this demo, we're trusting the `amount` and `currency`
  // coming from the client request.
  // A real application should absolutely have the `amount` and `currency`
  // securely computed on the backend to make sure the user can't change
  // the payment amount from their web browser or client-side environment.
  const { source, amount, currency } = req.body;

  // For the purpose of this demo, let's assume we are automatically
  // matching with the most recent pilot rather than using their location.
  const pilot = await Pilot.getLatest();
  // Find a random passenger.
  const passenger = await Passenger.getRandom();
  // Create a new ride.
  const ride = new Ride({
    pilot: pilot.id,
    passenger: passenger.id,
    amount: amount,
    currency: currency
  });
  // Save the ride.
  await ride.save();
  try {
    // Create a charge and set its destination to the pilot's account.
    const charge = await stripe.charges.create({
      source: source,
      amount: ride.amount,
      currency: ride.currency,
      description: config.appName,
      statement_descriptor: config.appName,
      destination: {
        // Send the amount for the pilot after collecting 20% platform fees.
        // Typically, the `amountForPilot` method simply computes `ride.amount * 0.8`.
        amount: ride.amountForPilot(),
        // The destination of this charge is the pilot's Stripe account.
        account: pilot.stripeAccountId
      }
    });
    // Add the Stripe charge reference to the ride and save it.
    ride.stripeChargeId = charge.id;
    ride.save();
  } catch (err) {
    // Return a 402 Payment Required error code.
    res.sendStatus(402);
    next(`Error adding token to customer: ${err.message}`);
  }
  // Return an 200 OK success code.
  res.sendStatus(200);
});

module.exports = router;
