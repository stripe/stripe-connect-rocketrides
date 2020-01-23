//
//  RideRequestViewController.swift
//  RocketRides
//
//  Created by Romain Huet on 5/26/16.
//  Copyright © 2016 Romain Huet. All rights reserved.
//

import UIKit
import MapKit
import Stripe

class RideRequestViewController: UIViewController, STPPaymentContextDelegate, LocationSearchViewControllerDelegate, MKMapViewDelegate {

    // Controllers

    private let customerContext: STPCustomerContext
    private let paymentContext: STPPaymentContext

    private let locationManager = CLLocationManager()

    // State

    private var pickupPlacemark: MKPlacemark? {
        didSet {
            reloadMapViewContent()
            reloadPriceButtonContent()
            reloadRequestRideButton()
        }
    }
    private var destinationPlacemark: MKPlacemark? {
        didSet {
            reloadMapViewContent()
            reloadDestinationButtonContent()
            reloadPriceButtonContent()
            reloadRequestRideButton()
        }
    }

    private enum RideRequestState {
        case none
        case requesting
        case active(Ride)
    }
    private var rideRequestState: RideRequestState = .none {
        didSet {
            reloadRequestRideButton()
        }
    }

    private var price = 0 {
        didSet {
            // Forward value to payment context
            paymentContext.paymentAmount = price
        }
    }

    // Views

    @IBOutlet var mapView: MKMapView!

    @IBOutlet var inputContainerView: UIView!
    @IBOutlet var destinationButton: UIButton!
    @IBOutlet var paymentButton: UIButton!
    @IBOutlet var priceButton: UIButton!

    @IBOutlet var rideDetailsView: UIView!
    @IBOutlet var pilotView: UIView!
    @IBOutlet var pilotViewNameLabel: UILabel!
    @IBOutlet var vehicleView: UIView!
    @IBOutlet var vehicleViewModelLabel: UILabel!
    @IBOutlet var vehicleViewLicenseLabel: UILabel!

    @IBOutlet var requestRideButton: UIButton!

    // MARK: Init

    required init?(coder aDecoder: NSCoder) {
        customerContext = STPCustomerContext(keyProvider: MainAPIClient.shared)
        paymentContext = STPPaymentContext(customerContext: customerContext)

        super.init(coder: aDecoder)

        paymentContext.delegate = self
        paymentContext.hostViewController = self
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()

        // Layout map view to fill screen
        mapView.frame = view.bounds

        // Apply corner radius and shadow styling to floating views
        let cornerRadius: CGFloat = 5.0

        inputContainerView.layoutCornerRadiusAndShadow(cornerRadius: cornerRadius)
        destinationButton.layoutCornerRadiusMask(corners: [.topLeft, .topRight], cornerRadius: cornerRadius)
        paymentButton.layoutCornerRadiusMask(corners: .bottomLeft, cornerRadius: cornerRadius)
        priceButton.layoutCornerRadiusMask(corners: .bottomRight, cornerRadius: cornerRadius)

        rideDetailsView.layoutCornerRadiusAndShadow(cornerRadius: cornerRadius)
        pilotView.layoutCornerRadiusMask(corners: [.topLeft, .bottomLeft], cornerRadius: cornerRadius)
        vehicleView.layoutCornerRadiusMask(corners: [.topRight, .bottomRight], cornerRadius: cornerRadius)

        requestRideButton.layoutCornerRadiusAndShadow(cornerRadius: cornerRadius)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)

        // Request location services authorization
        locationManager.requestWhenInUseAuthorization()
        locationManager.startUpdatingLocation()
    }

    // MARK: Button Handlers

    @IBAction
    private func handleDestinationButtonTapped() {
        guard let locationSearchViewController = storyboard?.instantiateViewController(withIdentifier: "LocationSearchViewController") as? LocationSearchViewController else {
            print("[ERROR] Missing locationSearchViewController: \(String(describing: storyboard))")
            return
        }

        // Assign delegate as self
        locationSearchViewController.delegate = self

        // Present location search view controller
        present(locationSearchViewController, animated: true)
    }

    @IBAction
    private func handlePaymentButtonTapped() {
        presentPaymentMethodsViewController()
    }

    @IBAction
    private func handlePriceButtonTapped() {
        presentPaymentMethodsViewController()
    }

    @IBAction
    private func handleRequestRideButtonTapped() {
        switch rideRequestState {
        case .none:
            // Update to requesting state
            rideRequestState = .requesting

            // Perform payment request
            paymentContext.requestPayment()
        case .requesting:
            // Do nothing
            break
        case .active:
            // Complete the ride
            completeActiveRide()
        }
    }

    // MARK: Helpers

    private func presentPaymentMethodsViewController() {
        guard !STPPaymentConfiguration.shared().publishableKey.isEmpty else {
            // Present error immediately because publishable key needs to be set
            let message = "Please assign a value to `publishableKey` before continuing. See `AppDelegate.swift`."
            present(UIAlertController(message: message), animated: true)
            return
        }

        guard !MainAPIClient.shared.baseURLString.isEmpty else {
            // Present error immediately because base url needs to be set
            let message = "Please assign a value to `MainAPIClient.shared.baseURLString` before continuing. See `AppDelegate.swift`."
            present(UIAlertController(message: message), animated: true)
            return
        }

        // Present the Stripe payment methods view controller to enter payment details
        paymentContext.presentPaymentOptionsViewController()
    }

    private func reloadMapViewContent() {
        // Adjust map view region
        if let pickupLocation = pickupPlacemark?.location, let destinationLocation = destinationPlacemark?.location {
            // Show both pickup and destination locations in map
            let centerLatitude = (pickupLocation.coordinate.latitude + destinationLocation.coordinate.latitude) / 2.0       // Approximation
            let centerLongitude = (pickupLocation.coordinate.longitude + destinationLocation.coordinate.longitude) / 2.0    // Approximation

            let centerCoordinate = CLLocationCoordinate2D(latitude: centerLatitude,longitude: centerLongitude)
            let distance = destinationLocation.distance(from: pickupLocation)

            let region = MKCoordinateRegion(center: centerCoordinate, latitudinalMeters: 1.5 * distance, longitudinalMeters: 1.5 * distance)
            mapView.setRegion(region, animated: true)
        }
        else if let singleLocation = pickupPlacemark?.location ?? destinationPlacemark?.location {
            // Show either pickup or destination location in map
            let distance: CLLocationDistance = 1000.0 // 1km
            let region = MKCoordinateRegion(center: singleLocation.coordinate, latitudinalMeters: distance, longitudinalMeters: distance)
            mapView.setRegion(region, animated: true)
        }
        else {
            // Do nothing
        }

        // Clear existing annotations and overlays in map view
        mapView.removeAnnotations(mapView.annotations)
        mapView.removeOverlays(mapView.overlays)

        // Add destination annotation to map view
        if let destinationPlacemark = destinationPlacemark {
            let destinationAnnotation = MKPointAnnotation()
            destinationAnnotation.title = destinationPlacemark.name
            destinationAnnotation.coordinate = destinationPlacemark.coordinate

            mapView.addAnnotation(destinationAnnotation)
            mapView.selectAnnotation(destinationAnnotation, animated: true)
        }

        // Show rocket path in map view
        if let pickupCoordinate = pickupPlacemark?.coordinate, let destinationCoordinate = destinationPlacemark?.coordinate {
            let rocketPathOverlay = RocketPathOverlay(start: pickupCoordinate, end: destinationCoordinate)
            mapView.addOverlay(rocketPathOverlay, level: .aboveLabels)
        }
    }

    private func reloadDestinationButtonContent() {
        guard let destinationString = destinationPlacemark?.name else {
            // Show default text and color
            destinationButton.setTitle("Destination", for: .normal)
            destinationButton.setTitleColor(.riderGrayColor, for: .normal)
            return
        }

        // Show destination string and darker color
        destinationButton.setTitle(destinationString, for: .normal)
        destinationButton.setTitleColor(.riderDarkBlueColor, for: .normal)
    }

    private func reloadPaymentButtonContent() {
        guard let selectedPaymentMethod = paymentContext.selectedPaymentOption else {
            // Show default image, text, and color
            paymentButton.setImage(#imageLiteral(resourceName: "Payment"), for: .normal)
            paymentButton.setTitle("Payment", for: .normal)
            paymentButton.setTitleColor(.riderGrayColor, for: .normal)
            return
        }

        // Show selected payment method image, label, and darker color
        paymentButton.setImage(selectedPaymentMethod.image, for: .normal)
        paymentButton.setTitle(selectedPaymentMethod.label, for: .normal)
        paymentButton.setTitleColor(.riderDarkBlueColor, for: .normal)
    }

    private func reloadPriceButtonContent() {
        guard let pickupLocation = pickupPlacemark?.location, let destinationLocation = destinationPlacemark?.location else {
            // Show default text and color
            priceButton.setTitle("Price", for: .normal)
            priceButton.setTitleColor(.riderGrayColor, for: .normal)
            return
        }

        // Compute an approximate price based on the distance between $5 and $45
        let distance = destinationLocation.distance(from: pickupLocation)

        price = max(min(Int(distance / 200), 45), 5) * 100

        // Show formatted price text and darker color
        let priceFormatter = NumberFormatter()
        priceFormatter.numberStyle = .currency
        priceFormatter.locale = Locale(identifier: "en_US")

        let priceString = priceFormatter.string(for: price / 100) ?? "ERROR"
        priceButton.setTitle(priceString, for: .normal)
        priceButton.setTitleColor(.riderDarkBlueColor, for: .normal)
    }

    private func reloadRequestRideButton() {
        guard pickupPlacemark != nil && destinationPlacemark != nil && paymentContext.selectedPaymentOption != nil else {
            // Show disabled state
            requestRideButton.backgroundColor = .riderGrayColor
            requestRideButton.setTitle("Request Ride", for: .normal)
            requestRideButton.setTitleColor(.white, for: .normal)
            requestRideButton.setImage(#imageLiteral(resourceName: "Arrow"), for: .normal)
            requestRideButton.isEnabled = false
            return
        }

        switch rideRequestState {
        case .none:
            // Show enabled state
            requestRideButton.backgroundColor = .riderGreenColor
            requestRideButton.setTitle("Request Ride", for: .normal)
            requestRideButton.setTitleColor(.white, for: .normal)
            requestRideButton.setImage(#imageLiteral(resourceName: "Arrow"), for: .normal)
            requestRideButton.isEnabled = true
        case .requesting:
            // Show loading state
            requestRideButton.backgroundColor = .riderGrayColor
            requestRideButton.setTitle("···", for: .normal)
            requestRideButton.setTitleColor(.white, for: .normal)
            requestRideButton.setImage(nil, for: .normal)
            requestRideButton.isEnabled = false
        case .active:
            // Show completion state
            requestRideButton.backgroundColor = .white
            requestRideButton.setTitle("Complete Ride", for: .normal)
            requestRideButton.setTitleColor(.riderDarkBlueColor, for: .normal)
            requestRideButton.setImage(nil, for: .normal)
            requestRideButton.isEnabled = true
        }
    }

    private func animateActiveRide() {
        guard case let .active(ride) = rideRequestState else {
            // Missing active ride
            return
        }

        // Update ride information in ride details view
        pilotViewNameLabel.text = ride.pilotName
        vehicleViewModelLabel.text = ride.pilotVehicle
        vehicleViewLicenseLabel.text = ride.pilotLicense

        // Show ride details view
        rideDetailsView.isHidden = false

        // Animate traveling on rocket path
        let numberOfPoints = 1000
        let animationDuration = 5.0

        guard let rocketPathOverlay = mapView.overlays.first(where: { $0 is RocketPathOverlay}) as? RocketPathOverlay else {
            print("[ERROR] Missing expected `rocketPathOverlay`")
            return
        }

        let rocketRiderAnnotation = MKPointAnnotation()
        mapView.addAnnotation(rocketRiderAnnotation)

        let rocketPathMapPoints = RocketPathOverlayRenderer(rocketPathOverlay: rocketPathOverlay).points(count: numberOfPoints)
        var currentMapPointIdx = 0

        func moveToNextPoint() {
            // Move annotation to latest map point
            let mapPoint = rocketPathMapPoints[currentMapPointIdx]
            rocketRiderAnnotation.coordinate = mapPoint.coordinate

            // Iterate to next map point
            currentMapPointIdx += 1

            if currentMapPointIdx < rocketPathMapPoints.count {
                // Schedule next animation step
                let deadline = DispatchTime.now() + (animationDuration / Double(numberOfPoints))
                DispatchQueue.main.asyncAfter(deadline: deadline) {
                    moveToNextPoint()
                }
            }
            else {
                mapView.removeAnnotation(rocketRiderAnnotation)

                // Complete the ride
                completeActiveRide()
            }
        }

        // Kickoff animation loop
        moveToNextPoint()
    }

    private func completeActiveRide() {
        guard case .active = rideRequestState else {
            // Missing active ride
            return
        }

        // Reset to none state
        rideRequestState = .none

        // Hide ride details view
        rideDetailsView.isHidden = true
    }

    // MARK: STPPaymentContextDelegate

    func paymentContext(_ paymentContext: STPPaymentContext, didFailToLoadWithError error: Error) {
        if let customerKeyError = error as? MainAPIClient.CustomerKeyError {
            switch customerKeyError {
            case .missingBaseURL:
                // Fail silently until base url string is set
                print("[ERROR]: Please assign a value to `MainAPIClient.shared.baseURLString` before continuing. See `AppDelegate.swift`.")
            case .invalidResponse:
                // Use customer key specific error message
                print("[ERROR]: Missing or malformed response when attempting to `MainAPIClient.shared.createCustomerKey`. Please check internet connection and backend response formatting.");

                present(UIAlertController(message: "Could not retrieve customer information", retryHandler: { (action) in
                    // Retry payment context loading
                    paymentContext.retryLoading()
                }), animated: true)
            }
        }
        else {
            // Use generic error message
            print("[ERROR]: Unrecognized error while loading payment context: \(error)");

            present(UIAlertController(message: "Could not retrieve payment information", retryHandler: { (action) in
                // Retry payment context loading
                paymentContext.retryLoading()
            }), animated: true)
        }
    }

    func paymentContextDidChange(_ paymentContext: STPPaymentContext) {
        // Reload related components
        reloadPaymentButtonContent()
        reloadRequestRideButton()
    }

    func paymentContext(_ paymentContext: STPPaymentContext, didCreatePaymentResult paymentResult: STPPaymentResult, completion: @escaping STPPaymentStatusBlock) {
        // Create charge using payment result
        guard let source = paymentResult.paymentMethod?.stripeId else { return }

        MainAPIClient.shared.requestRide(source: source, amount: price, currency: "usd") { [weak self] (ride, error) in
            guard let strongSelf = self else {
                // View controller was deallocated
                return
            }

            guard error == nil else {
                // Error while requesting ride
                completion(.error, error)
                return
            }

            // Save ride info to display after payment finished
            strongSelf.rideRequestState = .active(ride!)
            completion(.success, nil)
        }
    }

    func paymentContext(_ paymentContext: STPPaymentContext, didFinishWith status: STPPaymentStatus, error: Error?) {
        switch status {
        case .success:
            // Animate active ride
            animateActiveRide()
        case .error:
            // Present error to user
            if let requestRideError = error as? MainAPIClient.RequestRideError {
                switch requestRideError {
                case .missingBaseURL:
                    // Fail silently until base url string is set
                    print("[ERROR]: Please assign a value to `MainAPIClient.shared.baseURLString` before continuing. See `AppDelegate.swift`.")
                case .invalidResponse:
                    // Missing response from backend
                    print("[ERROR]: Missing or malformed response when attempting to `MainAPIClient.shared.requestRide`. Please check internet connection and backend response formatting.");
                    present(UIAlertController(message: "Could not request ride"), animated: true)
                }
            }
            else {
                // Use generic error message
                print("[ERROR]: Unrecognized error while finishing payment: \(String(describing: error))");
                present(UIAlertController(message: "Could not request ride"), animated: true)
            }

            // Reset ride request state
            rideRequestState = .none
        case .userCancellation:
            // Reset ride request state
            rideRequestState = .none
        default:
            return
        }
    }

    // MARK: LocationSearchViewControllerDelegate

    func searchCenterCoordinate(for locationSearchViewController: LocationSearchViewController) -> CLLocationCoordinate2D? {
        return pickupPlacemark?.coordinate
    }

    func locationSearchViewController(_ locationSearchViewController: LocationSearchViewController, didSelectItem item: MKMapItem) {
        // Save as destination placemark
        destinationPlacemark = item.placemark

        // Dismiss location search view controller
        dismiss(animated: true)
    }

    // MARK: MKMapViewDelegate

    func mapView(_ mapView: MKMapView, didUpdate userLocation: MKUserLocation) {
        guard let location = userLocation.location else {
            // Missing user location
            return
        }

        // Save as pickup placemark
        pickupPlacemark = MKPlacemark(coordinate: location.coordinate)
    }

    func mapView(_ mapView: MKMapView, didFailToLocateUserWithError error: Error) {
        print("[ERROR]: Failed to locate user: \(error)")

        // Use predefined pickup placemark
        pickupPlacemark = MKPlacemark(coordinate: CLLocationCoordinate2DMake(37.775871, -122.424388))
    }

    func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
        if let rocketPathOverlay = overlay as? RocketPathOverlay {
            // Use styled rocket path overlay renderer
            let renderer = RocketPathOverlayRenderer(rocketPathOverlay: rocketPathOverlay)
            renderer.strokeColor = UIColor.riderBlueColor.withAlphaComponent(0.8)

            return renderer
        }

        // Use default renderer
        return MKOverlayRenderer()
    }

    func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
        if annotation.isKind(of: MKUserLocation.self) {
            // Use default annotation view for self location
            return nil
        }

        if let destinationCoordinate = destinationPlacemark?.coordinate,
            annotation.coordinate.latitude == destinationCoordinate.latitude,
            annotation.coordinate.longitude == destinationCoordinate.longitude {
            // Use blue pin for destination annotation
            let identifier = "bluePinAnnotation"

            let annotationView = mapView.dequeueReusableAnnotationView(withIdentifier: identifier) as? MKPinAnnotationView ?? MKPinAnnotationView(annotation: annotation, reuseIdentifier: identifier)
            annotationView.pinTintColor = .riderBlueColor
            annotationView.canShowCallout = true

            return annotationView
        }
        else {
            // Use rocket annotation
            let identifier = "rocketPointAnnotation"

            let annotationView = mapView.dequeueReusableAnnotationView(withIdentifier: identifier) ?? MKAnnotationView(annotation: annotation, reuseIdentifier: identifier)
            annotationView.image = #imageLiteral(resourceName: "Jetpack")
            if Double((destinationPlacemark?.coordinate.longitude)!) - Double((pickupPlacemark?.coordinate.longitude)!) < 0 {
                annotationView.transform = CGAffineTransform(scaleX: -1, y: 1)
            }

            return annotationView
        }


    }
    
}
