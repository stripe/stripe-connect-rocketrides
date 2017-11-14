'use strict';

const config = require('../../config');
const stripe = require('stripe')(config.stripe.secretKey);
const request = require('request');
const querystring = require('querystring');
const express = require('express');
const router = express.Router();

// Middleware that requires a logged-in pilot.
function pilotRequired (req, res, next) {
  if (!req.isAuthenticated()) {
    return res.redirect('/pilots/login');
  }
  next();
}

/**
 * GET /pilots/stripe/authorize
 *
 * Redirect to Stripe to set up payments.
 */
router.get('/authorize', pilotRequired, (req, res) => {
  // Generate a random string as state to protect from CSRF and place it in the session.
  req.session.state = Math.random().toString(36).slice(2);
  // Prepare the mandatory Stripe parameters.
  let parameters = {
    client_id: config.stripe.clientId,
    state: req.session.state
  };
  // Optionally, Stripe Connect accepts `first_name`, `last_name`, `email`,
  // and `phone` in the query parameters for them to be autofilled.
  parameters = Object.assign(parameters, {
    'stripe_user[business_type]': req.user.type || 'individual',
    'stripe_user[first_name]': req.user.firstName || undefined,
    'stripe_user[last_name]': req.user.lastName || undefined,
    'stripe_user[email]': req.user.email,
    'stripe_user[business_name]': req.user.businessName || undefined,
  });
  // Redirect to Stripe to start the Connect onboarding.
  res.redirect(config.stripe.authorizeUri + '?' + querystring.stringify(parameters));
});

/**
 * GET /pilots/stripe/token
 *
 * Connect the new Stripe account to the platform account.
 */
router.get('/token', pilotRequired, async (req, res) => {
  // Check the state we got back equals the one we generated before proceeding.
  if (req.session.state != req.query.state) {
    res.redirect('/pilots/signup');
  }
  // Post the authorization code to Stripe to complete the authorization flow.
  request.post(config.stripe.tokenUri, {
    form: {
      grant_type: 'authorization_code',
      client_id: config.stripe.clientId,
      client_secret: config.stripe.secretKey,
      code: req.query.code
    },
    json: true
  }, (err, response, body) => {
    if (err || body.error) {
      console.log('The Stripe onboarding process has not succeeded.');
    } else {
      // Update the model and store the Stripe account ID in the datastore.
      // This Stripe account ID will be used to pay out to the pilot.
      req.user.stripeAccountId = body.stripe_user_id;
      req.user.save();
    }
    // Redirect to the final stage.
    res.redirect('/pilots/signup');
  });
});

/**
 * GET /pilots/stripe/transfers
 *
 * Redirect to Stripe to view transfers and edit payment details.
 */
router.get('/transfers', pilotRequired, async (req, res) => {
  const pilot = req.user;
  // Make sure the logged-in pilot had completed the Stripe onboarding.
  if (!pilot.stripeAccountId) {
    return res.redirect('/pilots/signup');
  }
  try {
    // Generate a unique login link for the associated Stripe account.
    const loginLink = await stripe.accounts.createLoginLink(pilot.stripeAccountId);
    // Retrieve the URL from the response and redirect the user to Stripe.
    return res.redirect(loginLink.url);
  } catch (err) {
    console.log('Failed to create a Stripe login link.');
    return res.redirect('/pilots/signup');
  }
});

/**
 * POST /pilots/stripe/payout
 *
 * Generate an instant payout with Stripe for the available balance.
 */
router.post('/payout', pilotRequired, async (req, res) => {
  const pilot = req.user;
  try {
    // Fetch the account balance for find available funds.
    const balance = await stripe.balance.retrieve({ stripe_account: pilot.stripeAccountId });
    // This demo app only uses USD so we'll just use the first available balance.
    // Note: There are as many balances as currencies used in your application.
    const { amount, currency } = balance.available[0];
    // Create the instant payout.
    const payout = await stripe.payouts.create({
      method: 'instant',
      amount: amount,
      currency: currency,
      statement_descriptor: config.appName
    }, {
      stripe_account: pilot.stripeAccountId
    });
  } catch (err) {
    console.log(err);
  }
  // Redirect to the pilot dashboard.
  res.redirect('/pilots/dashboard');
});

module.exports = router;
