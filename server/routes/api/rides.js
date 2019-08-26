'use strict';

const config = require('../../config');
const stripe = require('stripe')(config.stripe.secretKey);
const express = require('express');
const router = express.Router();
const Pilot = require('../../models/pilot');
const Passenger = require('../../models/passenger');
const Ride = require('../../models/ride');

/* For this demo, we assume that we're always authenticating the
 * latest passenger. In a production app, you would also typically
 * have a user authentication system for passengers.
 */

/**
 * POST /api/rides
 *
 * Create a new ride with the corresponding parameters.
 */
router.post('/', async (req, res, next) => {
  /* Important: For this demo, we're trusting the `amount` and `currency`
   * coming from the client request.
   * A real application should absolutely ensure the `amount` and `currency`
   * are securely computed on the backend to make sure the user can't change
   * the payment amount from their web browser or client-side environment.
   */
  const {paymentMethod, amount, currency} = req.body;

  try {
    // For the purpose of this demo, we'll assume we are automatically
    // matched with the first fully-onboarded pilot rather than using their location.
    const pilot = await Pilot.getFirstOnboarded();
    // Find the latest passenger (see note above)
    const passenger = await Passenger.getLatest();

    if(!pilot || !passenger) {
      throw `Could not get ${!pilot ? "pilot" : "passenger"} details.`
    }

    // Create a new ride
    const ride = new Ride({
      pilot: pilot.id,
      passenger: passenger.id,
      amount: amount,
      currency: currency,
    });
    // Save the ride
    await ride.save();

    // Create a Payment Intent and set its destination to the pilot's account
    const paymentIntent = await stripe.paymentIntents.create({
      amount: ride.amount,
      currency: ride.currency,
      description: config.appName,
      statement_descriptor: config.appName,
      // The destination parameter directs the transfer of funds from platform to pilot
      transfer_data: {
        // Send the amount for the pilot after collecting a 20% platform fee:
        // the `amountForPilot` method simply computes `ride.amount * 0.8`
        amount: ride.amountForPilot(),
        // The destination of this Payment Intent is the pilot's Stripe account
        destination: pilot.stripeAccountId,
      },
    });

    // Add the Stripe Payment Intent reference to the ride and save it
    ride.stripePaymentIntentId = paymentIntent.id;
    ride.save();

    // Return the ride info
    res.send({
      pilot_name: pilot.displayName(),
      pilot_vehicle: pilot.rocket.model,
      pilot_license: pilot.rocket.license,
    });
  } catch (err) {
    res.sendStatus(500);
    next(`Error adding token to customer: ${err.message || err}`);
  }
});

module.exports = router;
