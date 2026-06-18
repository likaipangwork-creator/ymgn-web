interface DetectedBarcode {
  boundingBox: DOMRectReadOnly
  cornerPoints?: ReadonlyArray<{ x: number; y: number }>
  format: string
  rawValue: string
}

interface BarcodeDetectorOptions {
  formats?: string[]
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions)
  detect(image: ImageBitmapSource): Promise<DetectedBarcode[]>
  static getSupportedFormats(): Promise<string[]>
}
