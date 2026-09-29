// Word-level text recognition for the lyric gates: every recognised line with its box, and a box for
// each word in it. No lyric dictionary or language correction is given to the recogniser, so what it
// returns is what the pixels say. Boxes are normalised with the origin at the top left.
import Foundation
import Vision
import ImageIO

struct Box: Codable { let x: Double; let y: Double; let w: Double; let h: Double }
struct Word: Codable { let text: String; let box: Box }
struct Line: Codable { let text: String; let confidence: Float; let box: Box; let words: [Word] }
struct Frame: Codable { let path: String; let width: Int; let height: Int; let lines: [Line]; let error: String? }

func box(_ r: CGRect) -> Box { Box(x: r.minX, y: 1 - r.maxY, w: r.width, h: r.height) }

let paths = try JSONDecoder().decode([String].self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
var frames: [Frame] = []
for file in paths {
  guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: file) as CFURL, nil), let image = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
    frames.append(Frame(path: file, width: 0, height: 0, lines: [], error: "cannot decode")); continue
  }
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = false
  request.recognitionLanguages = ["en-US"]
  request.minimumTextHeight = 0.012
  do {
    try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
    let lines: [Line] = (request.results ?? []).compactMap { obs in
      guard let c = obs.topCandidates(1).first else { return nil }
      var words: [Word] = []
      let s = c.string
      var i = s.startIndex
      while i < s.endIndex {
        while i < s.endIndex && s[i] == " " { i = s.index(after: i) }
        var j = i
        while j < s.endIndex && s[j] != " " { j = s.index(after: j) }
        if i < j, let r = try? c.boundingBox(for: i..<j) { words.append(Word(text: String(s[i..<j]), box: box(r.boundingBox))) }
        i = j
      }
      return Line(text: s, confidence: c.confidence, box: box(obs.boundingBox), words: words)
    }
    frames.append(Frame(path: file, width: image.width, height: image.height, lines: lines, error: nil))
  } catch {
    frames.append(Frame(path: file, width: image.width, height: image.height, lines: [], error: error.localizedDescription))
  }
}
FileHandle.standardOutput.write(try JSONEncoder().encode(frames))
