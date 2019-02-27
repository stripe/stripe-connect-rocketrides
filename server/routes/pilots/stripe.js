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
 * Redirect to Stripe to set up payments. This initiates the Express flow and customizes it
 * with some URL parameters.
 */
router.get('/authorize', pilotRequired, (req, res) => {
  // Generate a random string as state to protect from CSRF and place it in the session.
  req.session.state = Math.random().toString(36).slice(2);
  // Prepare the mandatory Stripe parameters.
  let parameters = {
    /* FIXME: Fill in two *required* URL parameters:
    *   - The Connect client application id: `config.stripe.clientId`
    *   - The secret `state` variable generated above
    *   - The redirect URI we'll return to once the Express flow completes:
    *      `config.publicDomain+'/pilots/stripe/token'`
    *   - The following properties of `req.user`: `type`, `businessName`, `firstName`,
    *      `lastName`, `email`
    */
  }
  console.log('Starting Express flow:', parameters)
  // Redirect to Stripe to start the Connect onboarding.
  res.redirect(config.stripe.authorizeUri + '?' + querystring.stringify(parameters));
});

/**
 * GET /pilots/stripe/token
 *
 * Connect the new Stripe account to the platform account. This route is the
 * redirect URI called by the Express flow once the user completes it.
 * We confirm it's a valid request, authorize it with Stripe, save the new pilot to our database,
 * and then redirect the user to the Rocket Rides dashboard as they're now logged in.
 */
router.get('/token', pilotRequired, async (req, res) => {
  // Check that the state token we got back from Express is the exact one we generated before proceeding.
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
    req.flash('showBanner', 'true');
    res.redirect('/pilots/dashboard');
  });
});

/**
 * GET /pilots/stripe/dashboard
 *
 * Redirect to the pilots' Stripe Express dashboard to view payouts and edit account details.
 */
router.get('/dashboard', pilotRequired, async (req, res) => {
  const pilot = req.user;
  // Make sure the logged-in pilot had completed the Stripe onboarding.
  if (!pilot.stripeAccountId) {
    return res.redirect('/pilots/signup');
  }
  try {
    // Generate a unique login link for the associated Stripe account.
    // FIXME: Produce a login link that is generated for `pilot.stripeAccountId`.

    // Directly link to the account tab
    if (req.query.account) {
      loginLink.url = loginLink.url + '#/account'
    }
    // Retrieve the URL from the response and redirect the user to Stripe.
    return res.redirect(loginLink.url);
  } catch (err) {
    console.log(err);
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
    const stripePilot = await stripe.accounts.retrieve(pilot.stripeAccountId)
    // Fetch the account balance for find available funds.
    const balance = await stripe.balance.retrieve({ stripe_account: pilot.stripeAccountId });
    // This demo app only uses USD so we'll just use the first available balance.
    // Note: There are as many balances as currencies used in your application.
    const { amount, currency } = balance.available[0];
    // Create the instant payout.
    const payout = await stripe.payouts.create({
      /* FIXME: Create an instant payout using the following parameters: 
      * `amount`, `currency`, a statement description of `config.appName`,
      * and the destination account `pilot.stripeAccountId`
      */
    });
  } catch (err) {
    console.log(err);
  }
  res.redirect('/pilots/dashboard');
});

module.exports = router;
