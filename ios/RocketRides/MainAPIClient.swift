//
//  MainAPIClient.swift
//  RocketRides
//
//  Created by Romain Huet on 5/26/16.
//  Copyright © 2016 Romain Huet. All rights reserved.
//

import Alamofire
import Stripe

class MainAPIClient: NSObject, STPCustomerEphemeralKeyProvider {

    static let shared = MainAPIClient()

    var baseURLString = ""

    // MARK: Rocket Rides

    enum RequestRideError: Error {
        case missingBaseURL
        case invalidResponse
    }

    func requestRide(source: String, amount: Int, currency: String, completion: @escaping (Ride?, RequestRideError?) -> Void) {
        let endpoint = "/api/rides"

        guard
            !baseURLString.isEmpty,
            let baseURL = URL(string: baseURLString),
            let url = URL(string: endpoint, relativeTo: baseURL) else {
                completion(nil, .missingBaseURL)
                return
        }

        // Important: For this demo, we're trusting the `amount` and `currency` coming from the client request.
        // A real application should absolutely have the `amount` and `currency` securely computed on the backend
        // to make sure the user can't change the payment amount from their web browser or client-side environment.
        let parameters: [String: Any] = [
            "source": source,
            "amount": amount,
            "currency": currency,
        ]

        Alamofire.request(url, method: .post, parameters: parameters).responseJSON { (response) in
            guard let json = response.result.value as? [String: Any] else {
                completion(nil, .invalidResponse)
                return
            }

            guard let pilotName = json["pilot_name"] as? String,
                let pilotVehicle = json["pilot_vehicle"] as? String,
                let pilotLicense = json["pilot_license"] as? String else {
                    completion(nil, .invalidResponse)
                    return
            }

            completion(Ride(pilotName: pilotName, pilotVehicle: pilotVehicle, pilotLicense: pilotLicense), nil)
        }
    }

    // MARK: STPEphemeralKeyProvider

    enum CustomerKeyError: Error {
        case missingBaseURL
        case invalidResponse
    }

    func createCustomerKey(withAPIVersion apiVersion: String, completion: @escaping STPJSONResponseCompletionBlock) {
        let endpoint = "/api/passengers/me/ephemeral_keys"

        guard
            !baseURLString.isEmpty,
            let baseURL = URL(string: baseURLString),
            let url = URL(string: endpoint, relativeTo: baseURL) else {
                completion(nil, CustomerKeyError.missingBaseURL)
                return
        }

        let parameters: [String: Any] = ["api_version": apiVersion]

        Alamofire.request(url, method: .post, parameters: parameters).responseJSON { (response) in
            guard let json = response.result.value as? [AnyHashable: Any] else {
                completion(nil, CustomerKeyError.invalidResponse)
                return
            }

            completion(json, nil)
        }
    }

}
