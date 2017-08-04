'use strict';

const config = require('../../config');
const stripe = require('stripe')(config.stripe.secretKey);
const express = require('express');
const router = express.Router();
const Passenger = require('../../models/passenger');

// Note: For this demo, we're making the assumption that we're
// going to always authenticate with the latest passenger.
// Of course, in a production app, you would typically have a
// user authentication system for passengers as well.

// The methods below are required by the Stripe iOS SDK
// See [STPEphemeralKeyProvider](https://github.com/stripe/stripe-ios/blob/master/Stripe/PublicHeaders/STPEphemeralKeyProvider.h)

/**
 * POST /api/passengers/me/ephemeral_keys
 *
 * Generate an ephemeral key for the logged in customer.
 */
router.post('/me/ephemeral_keys', async (req, res, next) => {
  const apiVersion = req.body['api_version'];
  try {
    // Find the latest passenger (see note above).
    const passenger = await Passenger.getLatest();
    // Create ephemeral key for customer.
    const ephemeralKey = await stripe.ephemeralKeys.create({
      customer: passenger.stripeCustomerId
    }, {
      stripe_version: apiVersion
    });
    // Respond with ephemeral key.
    res.send(ephemeralKey);
  } catch (err) {
    res.sendStatus(500);
    next(`Error creating ephemeral key for customer: ${err.message}`);
  }
});

module.exports = router;
