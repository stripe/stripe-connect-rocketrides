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

        return MKMapPoint(x: centerX, y: centerY).coordinate
    }

    var boundingMapRect: MKMapRect {
        let origin = MKMapPoint(x: min(startPoint.x, endPoint.x), y: min(startPoint.y, endPoint.y))
        let size = MKMapSize(width: max(startPoint.x, endPoint.x) - origin.x, height: max(startPoint.y, endPoint.y) - origin.y)
        let rect = MKMapRect(origin: origin, size: size)

        // Increase rect to accommodate rocket path arc
        return rect.insetBy(dx: -size.width, dy: -size.height)
    }


    init(start: CLLocationCoordinate2D, end: CLLocationCoordinate2D) {
        self.startPoint = MKMapPoint.init(start)
        self.endPoint = MKMapPoint.init(end)
    }

}

class RocketPathOverlayRenderer: MKOverlayRenderer {

    private let rocketPathOverlay: RocketPathOverlay
    private let thrustMultiplier: CGFloat = 1.5

    var lineWidth: CGFloat = 10.0
    var strokeColor: UIColor?

    init(rocketPathOverlay: RocketPathOverlay) {
        self.rocketPathOverlay = rocketPathOverlay

        super.init(overlay: rocketPathOverlay)
    }

    override func draw(_ mapRect: MKMapRect, zoomScale: MKZoomScale, in context: CGContext) {
        let startPoint = point(for: rocketPathOverlay.startPoint)
        let endPoint = point(for: rocketPathOverlay.endPoint)
        let controlPoint = calculateControlPoint(startPoint: startPoint, endPoint: endPoint)

        // Define and draw rocket path
        context.move(to: startPoint)
        context.addQuadCurve(to: endPoint, control: controlPoint)

        context.setStrokeColor((strokeColor ?? .black).cgColor)
        context.setLineWidth(lineWidth * (1.0 / zoomScale))
        context.strokePath()

        // Define and draw shadow path
        context.move(to: startPoint)
        context.addLine(to: endPoint)

        context.setStrokeColor(UIColor.black.withAlphaComponent(0.1).cgColor)
        context.setLineWidth(lineWidth * (1.0 / zoomScale))
        context.strokePath()
    }

    /// Calculates exactly `count` number of points that exist on the rocket path
    func points(count: Int) -> [MKMapPoint] {
        let startPoint = point(for: rocketPathOverlay.startPoint)
        let endPoint = point(for: rocketPathOverlay.endPoint)
        let controlPoint = calculateControlPoint(startPoint: startPoint, endPoint: endPoint)

        func quadraticBezierPoint(_ t: CGFloat, _ p0: CGFloat, _ p1: CGFloat, _ p2: CGFloat) -> CGFloat {
            // See: https://en.wikipedia.org/wiki/B%C3%A9zier_curve#Quadratic_B.C3.A9zier_curves
            return (pow(1.0 - t, 2.0) * p0) + (2.0 * (1.0 - t) * t * p1) + (pow(t, 2.0) * p2)
        }

        var result = [MKMapPoint]()

        for percentage in stride(from: CGFloat(0.0), through: 1.0, by: 1.0 / CGFloat(count)) {
            let pointX = quadraticBezierPoint(percentage, startPoint.x, controlPoint.x, endPoint.x)
            let pointY = quadraticBezierPoint(percentage, startPoint.y, controlPoint.y, endPoint.y)

            result.append(mapPoint(for: CGPoint(x: pointX, y: pointY)))
        }

        return result
    }

    private func calculateControlPoint(startPoint: CGPoint, endPoint: CGPoint) -> CGPoint {
        let controlPointX = (startPoint.x + endPoint.x) / 2.0
        let controlPointY = min(startPoint.y, endPoint.y) - (thrustMultiplier * abs(endPoint.y - startPoint.y))

        return CGPoint(x: controlPointX, y: controlPointY)
    }

}
