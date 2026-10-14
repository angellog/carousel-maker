// Subject cutout with Apple's on-device Vision model (macOS 14+). Free, offline.
//
// Writes the photo's foreground subject(s) as a PNG with a transparent background,
// same pixel size as the input, so it can sit exactly on top of the original photo.
// Styles like Sun-Faded / Sky-Blue use it to put the headline BEHIND the subject:
//   layer 1 = photo, layer 2 = headline, layer 3 = this cutout.
//
// Usage (via cutout.py, which compiles this once):
//   cutout <in.jpg|png> <out.png> [--mask]     --mask writes the alpha mask instead
import AppKit
import CoreImage
import Vision

let args = CommandLine.arguments
guard args.count >= 3 else {
    FileHandle.standardError.write("usage: cutout <in> <out.png> [--mask]\n".data(using: .utf8)!)
    exit(2)
}
let inURL = URL(fileURLWithPath: args[1]), outURL = URL(fileURLWithPath: args[2])
let maskOnly = args.contains("--mask")

guard let ci = CIImage(contentsOf: inURL, options: [.applyOrientationProperty: true]) else {
    FileHandle.standardError.write("cannot read \(args[1])\n".data(using: .utf8)!); exit(1)
}
let handler = VNImageRequestHandler(ciImage: ci)
let req = VNGenerateForegroundInstanceMaskRequest()
do { try handler.perform([req]) } catch {
    FileHandle.standardError.write("vision failed: \(error)\n".data(using: .utf8)!); exit(1)
}
guard let obs = req.results?.first, !obs.allInstances.isEmpty else {
    FileHandle.standardError.write("no foreground subject found\n".data(using: .utf8)!); exit(3)
}
let buf: CVPixelBuffer
do {
    buf = maskOnly
        ? try obs.generateScaledMaskForImage(forInstances: obs.allInstances, from: handler)
        : try obs.generateMaskedImage(ofInstances: obs.allInstances, from: handler, croppedToInstancesExtent: false)
} catch {
    FileHandle.standardError.write("mask failed: \(error)\n".data(using: .utf8)!); exit(1)
}
let ctx = CIContext()
let img = CIImage(cvPixelBuffer: buf)
let cs = CGColorSpace(name: CGColorSpace.sRGB)!
do {
    try ctx.writePNGRepresentation(of: img, to: outURL, format: maskOnly ? .L8 : .RGBA8, colorSpace: cs)
} catch {
    FileHandle.standardError.write("write failed: \(error)\n".data(using: .utf8)!); exit(1)
}
print("\(outURL.path)  (\(obs.allInstances.count) subject(s))")
