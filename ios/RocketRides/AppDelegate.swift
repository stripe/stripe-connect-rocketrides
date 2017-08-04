//
//  AppDelegate.swift
//  RocketRides
//
//  Created by Romain Huet on 5/26/16.
//  Copyright © 2016 Romain Huet. All rights reserved.
//

import UIKit
import Stripe

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    /**
     Fill in your Stripe publishable key here. This can be either your
     test or live publishable key. The key should begin with "pk_".

     You can find your publishable key in the Stripe Dashboard after you've
     signed up for an account.

     @see https://dashboard.stripe.com/account/apikeys

     If you'd like to use this app with https://rocketrides.io (see below),
     you can use our test publishable key: "pk_test_hnUZptHh36jRUveejCXqRoVu".
     */
    private let publishableKey: String = ""

    /**
     Fill in your backend URL here to try out the full payment experience

     Ex: "http://localhost:3000" if you're running the Node server locally,
     or "https://rocketrides.io" to try the app using our hosted version.
     */
    private let baseURLString: String = ""

    /**
     Optionally, fill in your Apple Merchant identifier here to try out the
     Apple Pay payment experience. We can use the "merchant.xyz" placeholder
     here when testing in the iOS simulator.

     @see https://stripe.com/docs/apple-pay/apps
     */
    private let appleMerchantIdentifier: String = "merchant.xyz"

    override init() {
        super.init()

        // Stripe payment configuration
        STPPaymentConfiguration.shared().companyName = "Rocket Rides"

        if !publishableKey.isEmpty {
            STPPaymentConfiguration.shared().publishableKey = publishableKey
        }

        if !appleMerchantIdentifier.isEmpty {
            STPPaymentConfiguration.shared().appleMerchantIdentifier = appleMerchantIdentifier
        }

        // Stripe theme configuration
        STPTheme.default().primaryBackgroundColor = .riderVeryLightGrayColor
        STPTheme.default().primaryForegroundColor = .riderDarkBlueColor
        STPTheme.default().secondaryForegroundColor = .riderDarkGrayColor
        STPTheme.default().accentColor = .riderGreenColor

        // Main API client configuration
        MainAPIClient.shared.baseURLString = baseURLString
    }

}
