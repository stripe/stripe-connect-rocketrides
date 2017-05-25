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

// STPBackendAPIAdapter: The 3 methods below are required by the Stripe iOS SDK.

/**
 * GET /api/passengers/me
 *
 * Retrieve the logged in customer.
 */
router.get('/me', async (req, res, next) => {
  try {
    // Find the latest passenger (see note above.)
    const passenger = await Passenger.getLatest();
    // Retrieve the Stripe customer object from the API.
    const customer = await stripe.customers.retrieve(passenger.stripeCustomerId);
    // Return the JSON customer for the Stripe SDK.
    res.status(200).json(customer);
  } catch (err) {
    res.sendStatus(404);
    next(`Error fetching customer: ${err.message}`);
  }
});

/**
 * POST /api/passengers/me/sources
 *
 * Add a source to the logged in customer.
 */
router.post('/me/sources', async (req, res, next) => {
  const { source } = req.body;
  try {
    // Find the latest passenger (see note above.)
    const passenger = await Passenger.getLatest();
    // Add the token to the customer's sources.
    await stripe.customers.createSource(passenger.stripeCustomerId, {
      source: source
    });
  } catch (err) {
    res.sendStatus(402);
    next(`Error adding token to customer: ${err.message}`);
  }
  // Return a success code after successfully adding the source.
  res.sendStatus(200);
});

/**
 * POST /api/passengers/me/default_source
 *
 * Select the default source for the logged in customer.
 */
router.post('/me/default_source', async (req, res, next) => {
  const { source } = req.body;
  try {
    // Find the latest passenger (see note above.)
    const passenger = await Passenger.getLatest();
    // Update the customer to set their default source.
    await stripe.customers.update(passenger.stripeCustomerId, {
      default_source: source,
    });
  } catch (err) {
    res.sendStatus(402);
    next(`Error selecting the default source: ${err.message}`);
  }
  // Return a success code after successfully selecting the default source.
  res.sendStatus(200);
});

module.exports = router;
