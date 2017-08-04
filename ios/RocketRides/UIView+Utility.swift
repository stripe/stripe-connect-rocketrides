//
//  UIView+Utility.swift
//  RocketRides
//
//  Created by Joey Dong on 7/25/17.
//  Copyright © 2017 Romain Huet. All rights reserved.
//

import UIKit

extension UIView {

    // Apply clipping mask on certain corners with corner radius
    func layoutCornerRadiusMask(corners: UIRectCorner, cornerRadius: CGFloat) {
        let cornerRadii = CGSize(width: cornerRadius, height: cornerRadius)
        let path = UIBezierPath(roundedRect: bounds, byRoundingCorners: corners, cornerRadii: cornerRadii)

        let mask = CAShapeLayer()
        mask.path = path.cgPath

        layer.mask = mask
    }

    // Apply corner radius and rounded shadow path
    func layoutCornerRadiusAndShadow(cornerRadius: CGFloat) {
        // Apply corner radius for background fill only
        layer.cornerRadius = cornerRadius

        // Apply shadow with rounded path
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOpacity = 0.15
        layer.shadowRadius = 2.0
        layer.shadowOffset = CGSize(width: 0.0, height: 2.0)
        layer.shadowPath = UIBezierPath(roundedRect: bounds, cornerRadius: cornerRadius).cgPath
    }

}

