import Foundation
import Vision
import ImageIO

struct Input: Decodable { let images: [String]; let orientations: [Int]? }
struct Box: Codable { let x: Double; let y: Double; let width: Double; let height: Double }
struct Line: Codable { let text: String; let confidence: Float; let box: Box }
struct Frame: Codable { let path: String; let orientation: Int; let width: Int; let height: Int; let lines: [Line]; let error: String? }
struct Output: Codable { let method: String; let frames: [Frame] }
func box(_ r: CGRect) -> Box { Box(x: r.minX, y: 1-r.maxY, width: r.width, height: r.height) }

do {
  let data = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
  let input = try JSONDecoder().decode(Input.self, from: data)
  var output: [Frame] = []
  for file in input.images {
    guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: file) as CFURL, nil), let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { throw NSError(domain: "ArkOCR", code: 1, userInfo: [NSLocalizedDescriptionKey: "Cannot decode \(file)"]) }
    for value in input.orientations ?? [1] {
      let orientation = CGImagePropertyOrientation(rawValue: UInt32(value)) ?? .up
      let rotated = [5,6,7,8].contains(value)
      let width = rotated ? image.height : image.width, height = rotated ? image.width : image.height
      do {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false
        request.recognitionLanguages = ["en-US"]
        request.minimumTextHeight = 0.008
        try VNImageRequestHandler(cgImage: image, orientation: orientation, options: [:]).perform([request])
        let lines = (request.results ?? []).compactMap { observation -> Line? in
          guard let candidate = observation.topCandidates(1).first else { return nil }
          return Line(text: candidate.string, confidence: candidate.confidence, box: box(observation.boundingBox))
        }
        output.append(Frame(path: file, orientation: value, width: width, height: height, lines: lines, error: nil))
      } catch {
        output.append(Frame(path: file, orientation: value, width: width, height: height, lines: [], error: error.localizedDescription))
      }
    }
  }
  let encoded = try JSONEncoder().encode(Output(method: "Apple Vision VNRecognizeTextRequest accurate; no expected-word dictionary or language correction", frames: output))
  FileHandle.standardOutput.write(encoded)
} catch {
  FileHandle.standardError.write(Data("Ark OCR failed: \(error.localizedDescription)\n".utf8))
  exit(1)
}
