//
//  LocationSearchViewController.swift
//  RocketRides
//
//  Created by Romain Huet on 5/26/16.
//  Copyright © 2016 Romain Huet. All rights reserved.
//

import UIKit
import MapKit

protocol LocationSearchViewControllerDelegate: class {
    func searchCenterCoordinate(for locationSearchViewController: LocationSearchViewController) -> CLLocationCoordinate2D?
    func locationSearchViewController(_ locationSearchViewController: LocationSearchViewController, didSelectItem item: MKMapItem)
}

class LocationSearchViewController: UIViewController, UITableViewDataSource, UITableViewDelegate, UISearchBarDelegate {

    weak var delegate: LocationSearchViewControllerDelegate?

    private var mapItems = [MKMapItem]()
    private var currentLocalSearch: MKLocalSearch?

    @IBOutlet var searchBar: UISearchBar!
    @IBOutlet var tableView: UITableView!

    override func viewDidLoad() {
        super.viewDidLoad()

        // Customize search bar styling
        searchBar.setImage(#imageLiteral(resourceName: "Search"), for: .search, state: .normal)
        searchBar.setBackgroundImage(clearImagePixel(), for: .any, barMetrics: .default)

        let searchBarFont = UIFont.systemFont(ofSize: 17.0)
        UITextField.appearance(whenContainedInInstancesOf: [UISearchBar.self]).font = searchBarFont
        UITextField.appearance(whenContainedInInstancesOf: [UISearchBar.self]).defaultTextAttributes = [
            NSAttributedString.Key.font: searchBarFont,
            NSAttributedString.Key.foregroundColor: UIColor.riderDarkBlueColor
        ]
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)

        // Show keyboard in sync with presentation animation
        searchBar.becomeFirstResponder()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)

        // Hide keyboard in sync with dismiss animation
        searchBar.resignFirstResponder()
    }

    private func clearImagePixel() -> UIImage? {
        UIGraphicsBeginImageContext(CGSize(width: 1.0, height: 1.0))
        defer {
            UIGraphicsEndImageContext()
        }

        guard let context = UIGraphicsGetCurrentContext() else {
            return nil
        }

        context.setFillColor(UIColor.clear.cgColor)
        context.fill(CGRect(x: 0.0, y: 0.0, width: 1.0, height: 1.0))

        return UIGraphicsGetImageFromCurrentImageContext()
    }

    private func localityText(placemark: CLPlacemark) -> String {
        var localityComponents = [String]()

        if let subThoroughfare = placemark.subThoroughfare {
            localityComponents.append(subThoroughfare)
        }

        if let thoroughfare = placemark.thoroughfare {
            localityComponents.append(thoroughfare)
        }

        if let locality = placemark.locality {
            localityComponents.append(locality)
        }

        if let administrativeArea = placemark.administrativeArea {
            localityComponents.append(administrativeArea)
        }

        if let postalCode = placemark.postalCode {
            localityComponents.append(postalCode)
        }

        return localityComponents.joined(separator: " ")
    }

    // MARK: UITableViewDataSource

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return mapItems.count
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "LocationSearchViewCell", for: indexPath)

        guard let locationSearchViewCell = cell as? LocationSearchViewCell else {
            print("[ERROR]: Unexpected cell class: \(cell)")
            return cell
        }

        let item = mapItems[indexPath.row]

        locationSearchViewCell.nameLabel.text = item.name
        locationSearchViewCell.localityLabel.text = localityText(placemark: item.placemark)

        return locationSearchViewCell
    }

    // MARK: UITableViewDelegate

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        delegate?.locationSearchViewController(self, didSelectItem: mapItems[indexPath.row])
    }

    // MARK: UISearchBarDelegate

    func searchBar(_ searchBar: UISearchBar, textDidChange searchText: String) {
        // Cancel any existing searches
        currentLocalSearch?.cancel()

        // Determine search query
        guard let searchQuery = searchBar.text, !searchQuery.isEmpty else {
            // Show no results for empty query
            mapItems = []
            tableView.reloadData()
            return
        }

        // Setup search request
        let searchRequest = MKLocalSearch.Request()

        searchRequest.naturalLanguageQuery = searchQuery

        if let centerCoordinate = delegate?.searchCenterCoordinate(for: self) {
            // Attach region to search request
            let distance: CLLocationDistance = 100 // 100km
            searchRequest.region = MKCoordinateRegion(center: centerCoordinate, latitudinalMeters: distance, longitudinalMeters: distance)
        }

        // Perform new search request
        let localSearch = MKLocalSearch(request: searchRequest)

        localSearch.start { [weak self] (response, error) in
            guard let strongSelf = self else {
                // View controller was deallocated
                return
            }

            guard error == nil else {
                print("[ERROR] Search error: \(String(describing: error))")
                strongSelf.mapItems = []
                strongSelf.tableView.reloadData()
                return
            }

            guard let response = response else {
                print("[ERROR] Missing response: \(localSearch)")
                strongSelf.mapItems = []
                strongSelf.tableView.reloadData()
                return
            }

            // Display search results
            strongSelf.mapItems = response.mapItems
            strongSelf.tableView.reloadData()
        }

        currentLocalSearch = localSearch
    }

    func searchBarCancelButtonClicked(_ searchBar: UISearchBar) {
        dismiss(animated: true, completion: nil)
    }

}
