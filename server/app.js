'use strict';

const config = require('./config');
const express = require('express');
const session = require('cookie-session');
const passport = require('passport');
const path = require('path');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const flash = require('express-flash');
const bodyParser = require('body-parser');
const moment = require('moment');

const app = express();
app.set('trust proxy', true);

// MongoDB configuration
const mongoose = require('mongoose');
const connectRetry = function() {
  mongoose.connect(config.mongoUri, {
    useNewUrlParser: true,
    useCreateIndex: true,
    reconnectTries: 30,
    reconnectInterval: 1000,
    poolSize: 500,
  }, (err) => {
    if (err) {
      console.log('Mongoose connection error:', err);
      setTimeout(connectRetry, 5000);
    }
  });
}
connectRetry();

// Set up the view engine
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// Enable sessions using encrypted cookies
app.use(cookieParser(config.secret));
app.use(
  session({
    cookie: {maxAge: 60000},
    secret: config.secret,
    signed: true,
    resave: true,
  })
);
// Set up flash messages
app.use(flash());

// Set up useful middleware
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Passport and restore any existing authentication state
app.use(passport.initialize());
app.use(passport.session());

// Middleware that exposes the pilot object (if any) to views
app.use((req, res, next) => {
  if (req.user) {
    res.locals.pilot = req.user;
  }
  next();
});
app.locals.moment = moment;

// CRUD routes for the pilot signup and dashboard
app.use('/pilots', require('./routes/pilots/pilots'));
app.use('/pilots/stripe', require('./routes/pilots/stripe'));

// API routes for rides and passengers used by the mobile app
app.use('/api/settings', require('./routes/api/settings'));
app.use('/api/rides', require('./routes/api/rides'));
app.use('/api/passengers', require('./routes/api/passengers'));

// Index page for Rocket Rides
app.get('/', (req, res) => {
  res.render('index');
});

// Respond to the Google Cloud health check
app.get('/_ah/health', (req, res) => {
  res.type('text').send('ok');
});

// Catch 404 errors and forward to error handler
app.use((req, res, next) => {
  res.status(404).render('404');
});

// Development error handler: will print stacktrace
if (app.get('env') === 'development') {
  app.use((err, req, res) => {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err,
    });
  });
}

// Production error handler: no stacktraces will be leaked to user
app.use((err, req, res) => {
  console.log(err);
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {},
  });
});

// Start the server on the correct port
const server = app.listen(process.env.PORT || config.port, () => {
  console.log('🚀 Rocket Rides server started:', config.publicDomain);
});
