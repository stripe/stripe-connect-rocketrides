'use strict';

const config = require('../../config');
const express = require('express');
const router = express.Router();

/**
 * GET /api/settings
 *
 * Return settings for the app: specifically here the
 * Stripe publishable key to tokenize from a client app.
 */
router.get('/', (req, res, next) => {
  res.status(200).json({
    stripe_publishable_key: config.stripe.publishableKey,
  });
});

module.exports = router;
