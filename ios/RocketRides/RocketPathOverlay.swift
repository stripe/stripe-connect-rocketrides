//
//  RocketPathOverlay.swift
//  RocketRides
//
//  Created by Joey Dong on 8/2/17.
//  Copyright © 2017 Romain Huet. All rights reserved.
//

import UIKit
import MapKit

class RocketPathOverlay: NSObject, MKOverlay {

    let startPoint: MKMapPoint
    let endPoint: MKMapPoint

    var coordinate: CLLocationCoordinate2D {
        // Use center of bounding map rect as coordinate
        let centerX = boundingMapRect.origin.x + (boundingMapRect.size.width / 2.0)
        let centerY = boundingMapRect.origin.y + (boundingMapRect.size.height / 2.0)

        return MKCoordinateForMapPoint(MKMapPoint(x: centerX, y: centerY))
    }

    var boundingMapRect: MKMapRect {
        let origin = MKMapPoint(x: min(startPoint.x, endPoint.x), y: min(startPoint.y, endPoint.y))
        let size = MKMapSize(width: max(startPoint.x, endPoint.x) - origin.x, height: max(startPoint.y, endPoint.y) - origin.y)
        let rect = MKMapRect(origin: origin, size: size)

        // Increase rect to accommodate rocket path arc
        return MKMapRectInset(rect, -size.width, -size.height)
    }


    init(start: CLLocationCoordinate2D, end: CLLocationCoordinate2D) {
        self.startPoint = MKMapPointForCoordinate(start)
        self.endPoint = MKMapPointForCoordinate(end)
    }

}

class RocketPathOverlayRenderer: MKOverlayRenderer {

    private let rocketPathOverlay: RocketPathOverlay

    var lineWidth: CGFloat = 10.0
    var strokeColor: UIColor?
    var arcMultiplier: CGFloat = 1.5

    init(rocketPathOverlay: RocketPathOverlay) {
        self.rocketPathOverlay = rocketPathOverlay

        super.init(overlay: rocketPathOverlay)
    }

    override func draw(_ mapRect: MKMapRect, zoomScale: MKZoomScale, in context: CGContext) {
        // Define rocket path
        let startPoint = point(for: rocketPathOverlay.startPoint)
        let endPoint = point(for: rocketPathOverlay.endPoint)

        let controlPointX = (startPoint.x + endPoint.x) / 2.0
        let controlPointY = min(startPoint.y, endPoint.y) - (arcMultiplier * abs(endPoint.y - startPoint.y))

        context.move(to: startPoint)
        context.addQuadCurve(to: endPoint, control: CGPoint(x: controlPointX, y: controlPointY))

        // Draw rocket path
        context.setStrokeColor((strokeColor ?? .black).cgColor)
        context.setLineWidth(lineWidth * (1.0 / zoomScale))
        context.strokePath()
    }

}
