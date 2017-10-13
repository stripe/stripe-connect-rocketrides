'use strict';

const config = require('../../config');
const stripe = require('stripe')(config.stripe.secretKey);
const express = require('express');
const router = express.Router();
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const Pilot = require('../../models/pilot');
const Ride = require('../../models/ride');
const Passenger = require('../../models/passenger');

// Middleware that requires a logged-in pilot.
function pilotRequired (req, res, next) {
  if (!req.isAuthenticated()) {
    return res.redirect('/pilots/login');
  }
  next();
}

/**
 * GET /pilots/dashboard
 *
 * Show the Dashboard for the logged-in pilot with the overview,
 * their ride history, and the ability to simulate a test ride.
 *
 * Use the `pilotRequired` middleware to ensure that only logged-in
 * pilots can access this route.
 */
router.get('/dashboard', pilotRequired, async (req, res) => {
  const pilot = req.user;
  // Retrieve the balance from Stripe.
  const balance = await stripe.balance.retrieve({ stripe_account: pilot.stripeAccountId });
  // Fetch the pilot's recent rides.
  const rides = await pilot.listRecentRides();
  const ridesTotalAmount = rides.reduce((a, b) => { return a + b.amountForPilot(); }, 0);
  // There are as maybe balances as currencies used.
  // This demo app only uses USD so we'll just use the first object.
  res.render('dashboard', {
    pilot: pilot,
    balanceAvailable: balance.available[0].amount,
    balancePending: balance.pending[0].amount,
    ridesTotalAmount: ridesTotalAmount,
    rides: rides
  });
});

/**
 * POST /pilots/rides
 *
 * Generate a test ride with sample data for the logged-in pilot.
 */
router.post('/rides', pilotRequired, async (req, res) => {
  const pilot = req.user;
  // Find a random passenger.
  const passenger = await Passenger.getRandom();
  // Create a new ride for the pilot and this random passenger.
  // Generate a random amount between $10 and $100 for this ride.
  const ride = new Ride({
    pilot: pilot.id,
    passenger: passenger.id,
    amount: getRandomInt(1000, 10000)
  });
  // Save the ride.
  await ride.save();
  try {
    // Get a test source and pass any requested trigger for testing bahaviors.
    const source = getTestSource(req.body.trigger);
    // Create a charge and set its destination to the pilot's account.
    const charge = await stripe.charges.create({
      source: source,
      amount: ride.amount,
      currency: ride.currency,
      description: config.appName,
      statement_descriptor: config.appName,
      // The destination parameter directs the funds.
      destination: {
        // Send the amount for the pilot after collecting a 20% platform fee.
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
    console.log(err);
    // Return a 402 Payment Required error code.
    res.sendStatus(402);
    next(`Error adding token to customer: ${err.message}`);
  }
  res.redirect('/pilots/dashboard');
});

/**
 * GET /pilots/signup
 *
 * Display the signup form on the right step depending on the current completion.
 */
router.get('/signup', (req, res) => {
  let step = 'account';
  // Naive way to check which step we're on via presence of profile data.
  if (req.user) {
    if (
      req.user.type === 'individual' ?
        !req.user.firstName || !req.user.lastName :
        !req.user.businessName
    ) {
      step = 'profile';
    } else if (!req.user.stripeAccountId) {
      step = 'payments'
    } else {
      step = 'done';
    }
  }
  res.render('signup', { step: step });
});

/**
 * POST /pilots/signup
 *
 * Create a user and update profile information during the pilot onboarding process.
 */
router.post('/signup', (req, res, next) => {
  const body = Object.assign({}, req.body, {
    // Use `type` instead of `pilot-type` for saving to the DB.
    type: req.body['pilot-type'],
    'pilot-type': undefined,
  });

  // Check if we have a logged-in pilot.
  let pilot = req.user;
  if (!pilot) {
    // Try to create and save a new pilot.
    pilot = new Pilot(body);
    pilot.save((err, pilot) => {
      if (err) {
        // Show an error message to the user.
        const errors = Object.keys(err.errors).map(field => err.errors[field].message);
        res.render('signup', { step: 'account', error: errors[0] });
      } else {
        // Sign in and redirect to continue the signup process.
        req.logIn(pilot, error => {
          if (err) next(err);
          return res.redirect('/pilots/signup');
        });
      }
    });
  } else {
    // Try to update the logged-in pilot with the newly entered profile data.
    pilot.set(body);
    pilot.save((err, pilot) => {
      if (err) next(err);
      return res.redirect('/pilots/signup');
    });
  }
});

/**
 * GET /pilots/login
 *
 * Simple pilot login.
 */
router.get('/login', (req, res) => {
  res.render('login');
});

/**
 * GET /pilots/login
 *
 * Simple pilot login.
 */
router.post('/login',
  passport.authenticate('pilot-login', {
    successRedirect: '/pilots/dashboard',
    failureRedirect: '/pilots/login'
  })
);

/**
 * GET /pilots/logout
 *
 * Delete the pilot from the session.
 */
router.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

// Serialize pilots sessions for Passport.
passport.serializeUser((user, callback) => {
  callback(null, user.id);
});
passport.deserializeUser((id, callback) => {
  Pilot.findById(id, (err, pilot) => {
    callback(err, pilot);
  });
});

// Define the login strategy for pilots based on email and password.
passport.use('pilot-login', new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
}, function(email, password, done) {
  Pilot.findOne({
    email: email
  }, function(err, user) {
    if (err) return done(err);
    if (!user) {
      return done(null, false, { message: 'Unknown user' });
    }
    if (!user.validatePassword(password)) {
      return done(null, false, { message: 'Invalid password' });
    }
    return done(null, user);
  });
}));

// Function that returns a test card token for Stripe.
function getTestSource(trigger) {
  // Important: We're using static tokens based on specific test card numbers
  // to trigger a special behavior. This is NOT how you would create real payments!
  // You should use Stripe Elements or Stripe iOS/Android SDKs to tokenize card numbers.
  // Use a static token based on a test card.
  var source = 'tok_visa';
  // Change the test card token if a specific trigger is requested.
  if (trigger === 'immediate-balance') {
    source = 'tok_bypassPending';
  } else if (trigger === 'account-verification') {
    source = 'tok_visa_triggerVerification';
  } else if (trigger === 'payout-limit') {
    source = 'tok_visa_triggerTransferBlock';
  }
  return source;
}

// Return a random int between two numbers.
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = router;
