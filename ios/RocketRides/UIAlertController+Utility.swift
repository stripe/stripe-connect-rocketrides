//
//  UIAlertController+Utility.swift
//  RocketRides
//
//  Created by Joey Dong on 7/26/17.
//  Copyright © 2017 Romain Huet. All rights reserved.
//

import UIKit

extension UIAlertController {

    /// Initialize an alert view titled "Oops" with `message` and single "OK" action with no handler
    convenience init(message: String?) {
        self.init(title: "Oops", message: message, preferredStyle: .alert)

        let dismissAction = UIAlertAction(title: "OK", style: .default)
        addAction(dismissAction)

        preferredAction = dismissAction
    }

    /// Initialize an alert view titled "Oops" with `message` and "Retry" / "Skip" actions
    convenience init(message: String?, retryHandler: @escaping (UIAlertAction) -> Void) {
        self.init(title: "Oops", message: message, preferredStyle: .alert)

        let retryAction = UIAlertAction(title: "Retry", style: .default, handler: retryHandler)
        addAction(retryAction)

        let skipAction = UIAlertAction(title: "Skip", style: .default)
        addAction(skipAction)

        preferredAction = skipAction
    }

}
