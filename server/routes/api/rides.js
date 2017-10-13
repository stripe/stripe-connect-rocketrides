'use strict';

const config = require('../../config');
const stripe = require('stripe')(config.stripe.secretKey);
const express = require('express');
const router = express.Router();
const Pilot = require('../../models/pilot');
const Passenger = require('../../models/passenger');
const Ride = require('../../models/ride');

// Note: For this demo, we're making the assumption that we're
// going to always authenticate with the latest passenger.
// Of course, in a production app, you would typically have a
// user authentication system for passengers as well.

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

  try {
    // For the purpose of this demo, let's assume we are automatically
    // matching with the first fully onboarded pilot rather than using their location.
    const pilot = await Pilot.getFirstOnboarded();
    // Find the latest passenger (see note above).
    const passenger = await Passenger.getLatest();
    // Create a new ride.
    const ride = new Ride({
      pilot: pilot.id,
      passenger: passenger.id,
      amount: amount,
      currency: currency
    });
    // Save the ride.
    await ride.save();

    // Create a charge and set its destination to the pilot's account.
    const charge = await stripe.charges.create({
      source: source,
      amount: ride.amount,
      currency: ride.currency,
      customer: passenger.stripeCustomerId,
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

    // Return the ride info.
    res.send({
      pilot_name: pilot.displayName(),
      pilot_vehicle: pilot.rocket.model,
      pilot_license: pilot.rocket.license,
    });
  } catch (err) {
    res.sendStatus(500);
    next(`Error adding token to customer: ${err.message}`);
  }
});

module.exports = router;
