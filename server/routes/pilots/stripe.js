'use strict';

const config = require('../../config');
const stripe = require('stripe')(config.stripe.secretKey);
const request = require('request-promise-native');
const querystring = require('querystring');
const express = require('express');
const router = express.Router();

// Middleware that requires a logged-in pilot
function pilotRequired(req, res, next) {
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
 router.get('/authorize', pilotRequired, async (req, res) => {
  // Generate a random string as `state` to protect from CSRF and include it in the session
  req.session.state = Math.random()
    .toString(36)
    .slice(2);

  try {
    let accountId = req.user.stripeAccountId;

    // Create a Stripe account for this user if one does not exist already
    if (accountId == undefined) {
      // Define the parameters to create a new Stripe account with
      let accountParams = {
        type: 'express',
        country: req.user.country || undefined,
        email: req.user.email || undefined,
        business_type: req.user.type || 'individual', 
      }
  
      // Companies and invididuals require different parameters
      if (accountParams.business_type === 'company') {
        accountParams = Object.assign(accountParams, {
          company: {
            name: req.user.businessName || undefined
          }
        });
      } else {
        accountParams = Object.assign(accountParams, {
          individual: {
            first_name: req.user.firstName || undefined,
            last_name: req.user.lastName || undefined,
            email: req.user.email || undefined
          }
        });
      }
  
      const account = await stripe.accounts.create(accountParams);
      accountId = account.id;

      // Update the model and store the Stripe account ID in the datastore:
      // this Stripe account ID will be used to issue payouts to the pilot
      req.user.stripeAccountId = accountId;
      await req.user.save();
    }

    // Create an account link for the user's Stripe account
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: config.publicDomain + '/pilots/stripe/authorize',
      return_url: config.publicDomain + '/pilots/stripe/onboarded',
      type: 'account_onboarding'
    });

    // Redirect to Stripe to start the Express onboarding flow
    res.redirect(accountLink.url);
  } catch (err) {
    console.log('Failed to create a Stripe account.');
    console.log(err);
    res.redirect('/pilots/signup');
  }
});

/**
 * GET /pilots/stripe/onboarded
 *
 * Return endpoint from Stripe onboarding, checks if onboarding has been completed
 */
router.get('/onboarded', pilotRequired, async (req, res) => {
  try {
    // Retrieve the user's Stripe account and check if they have finished onboarding
    const account = await stripe.account.retrieve(req.user.stripeAccountId);
    if (account.details_submitted) {
      req.user.onboardingComplete = true;
      await req.user.save();

      // Redirect to the Rocket Rides dashboard
      req.flash('showBanner', 'true');
      res.redirect('/pilots/dashboard');
    } else {
      console.log('The onboarding process was not completed.');
      res.redirect('/pilots/signup');
    }
  } catch (err) {
    console.log(err);
    res.redirect('/pilots/signup');
  }
})

/**
 * GET /pilots/stripe/dashboard
 *
 * Redirect to the pilots' Stripe Express dashboard to view payouts and edit account details.
 */
router.get('/dashboard', pilotRequired, async (req, res) => {
  const pilot = req.user;
  // Make sure the logged-in pilot completed the Express onboarding
  if (!pilot.onboardingComplete) {
    return res.redirect('/pilots/signup');
  }
  try {
    // Generate a unique login link for the associated Stripe account to access their Express dashboard
    const loginLink = await stripe.accounts.createLoginLink(
      pilot.stripeAccountId, {
        redirect_url: config.publicDomain + '/pilots/dashboard'
      }
    );
    // Directly link to the account tab
    if (req.query.account) {
      loginLink.url = loginLink.url + '#/account';
    }
    // Retrieve the URL from the response and redirect the user to Stripe
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
 * Generate a payout with Stripe for the available balance.
 */
router.post('/payout', pilotRequired, async (req, res) => {
  const pilot = req.user;
  try {
    // Fetch the account balance to determine the available funds
    const balance = await stripe.balance.retrieve({
      stripe_account: pilot.stripeAccountId,
    });
    // This demo app only uses USD so we'll just use the first available balance
    // (Note: there is one balance for each currency used in your application)
    const {amount, currency} = balance.available[0];
    // Create a payout
    const payout = await stripe.payouts.create({
      amount: amount,
      currency: currency,
      statement_descriptor: config.appName,
    }, {stripe_account: pilot.stripeAccountId });
  } catch (err) {
    console.log(err);
  }
  res.redirect('/pilots/dashboard');
});

module.exports = router;
