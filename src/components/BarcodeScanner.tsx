import { useEffect, useId, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { mapVideoPointToDisplay, supportsMultiQRDetection } from '../lib/scanGeometry'

export interface DetectedQRMarker {
  id: string
  code: string
  x: number
  y: number
}

interface BarcodeScannerProps {
  open: boolean
  onScan: (code: string) => void
  onClose: () => void
  title?: string
  hint?: string
}

const QR_FRAME_SIZE = 260
const DETECT_INTERVAL_MS = 280

export function BarcodeScanner({
  open,
  onScan,
  onClose,
  title = '扫码',
  hint = '对准器材条码或套餐码',
}: BarcodeScannerProps) {
  const instanceId = useId().replace(/:/g, '')
  const containerId = `barcode-scanner-${instanceId}`
  const viewportRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const frozenRef = useRef(false)

  const [error, setError] = useState<string | null>(null)
  const [frozenImage, setFrozenImage] = useState<string | null>(null)
  const [detectedMarkers, setDetectedMarkers] = useState<DetectedQRMarker[]>([])

  const useAdvancedScanner = supportsMultiQRDetection()

  useEffect(() => {
    if (!open) {
      frozenRef.current = false
      setFrozenImage(null)
      setDetectedMarkers([])
      setError(null)
      return
    }

    if (useAdvancedScanner) {
      return startAdvancedScanner()
    }
    return startHtml5Scanner()
  }, [open, useAdvancedScanner, onScan, onClose, containerId])

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  function selectCode(code: string) {
    const normalized = code.trim()
    if (!normalized) return
    onScan(normalized)
    onClose()
  }

  function freezeOnMultiQR(
    video: HTMLVideoElement,
    qrCodes: DetectedBarcode[]
  ) {
    if (frozenRef.current) return
    frozenRef.current = true

    const viewport = viewportRef.current
    const displayWidth = viewport?.clientWidth ?? window.innerWidth
    const displayHeight = viewport?.clientHeight ?? window.innerHeight

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      setFrozenImage(canvas.toDataURL('image/jpeg', 0.92))
    }

    video.pause()
    stopStream()

    const seen = new Set<string>()
    const markers: DetectedQRMarker[] = []
    qrCodes.forEach((qr, index) => {
      const code = qr.rawValue.trim()
      if (!code) return
      const box = qr.boundingBox
      const center = mapVideoPointToDisplay(
        box.x + box.width / 2,
        box.y + box.height / 2,
        video,
        displayWidth,
        displayHeight
      )
      const id = seen.has(code) ? `${code}-${index}` : code
      seen.add(code)
      markers.push({ id, code, x: center.x, y: center.y })
    })
    setDetectedMarkers(markers)
  }

  function startAdvancedScanner() {
    let active = true
    let detectTimer: number | undefined

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (!active) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        const video = videoRef.current
        if (!video) return

        video.srcObject = stream
        await video.play()

        const detector = new BarcodeDetector({
          formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e'],
        })

        const detect = async () => {
          if (!active || frozenRef.current || !videoRef.current) return
          if (videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return

          try {
            const results = await detector.detect(videoRef.current)
            const qrCodes = results.filter((item) => item.format === 'qr_code' && item.rawValue)

            if (qrCodes.length > 1) {
              freezeOnMultiQR(videoRef.current, qrCodes)
              return
            }

            if (qrCodes.length === 1) {
              active = false
              stopStream()
              selectCode(qrCodes[0].rawValue)
              return
            }

            if (results.length === 1 && results[0].rawValue) {
              active = false
              stopStream()
              selectCode(results[0].rawValue)
            }
          } catch {
            /* ignore intermittent detect errors */
          }
        }

        detectTimer = window.setInterval(() => {
          void detect()
        }, DETECT_INTERVAL_MS)
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : '无法启动摄像头')
        }
      }
    })()

    return () => {
      active = false
      if (detectTimer) window.clearInterval(detectTimer)
      stopStream()
      frozenRef.current = false
    }
  }

  function startHtml5Scanner() {
    let active = true
    const scanner = new Html5Qrcode(containerId)
    scannerRef.current = scanner

    void scanner
      .start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: QR_FRAME_SIZE, height: QR_FRAME_SIZE },
          aspectRatio: 1,
        },
        (decoded) => {
          if (!active) return
          active = false
          selectCode(decoded)
          void stopHtml5Scanner()
        },
        () => {}
      )
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : '无法启动摄像头')
        }
      })

    async function stopHtml5Scanner() {
      active = false
      try {
        if (scannerRef.current?.isScanning) {
          await scannerRef.current.stop()
        }
        scannerRef.current?.clear()
      } catch {
        /* ignore stop errors */
      }
      scannerRef.current = null
    }

    return () => {
      void stopHtml5Scanner()
    }
  }

  if (!open) return null

  if (!useAdvancedScanner) {
    return (
      <div className="scanner-fullscreen" role="dialog" aria-modal="true">
        <div className="scanner-fullscreen__panel scanner-fullscreen__panel--fallback">
          <h3>{title}</h3>
          <p className="muted">{hint}</p>
          <div id={containerId} className="scanner-region scanner-region--square" />
          {error ? <p className="error-text">{error}</p> : null}
          <div className="scanner-fullscreen__actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="scanner-fullscreen" role="dialog" aria-modal="true">
      <div ref={viewportRef} className="scanner-fullscreen__viewport">
        {frozenImage ? (
          <img src={frozenImage} alt="" className="scanner-fullscreen__media" />
        ) : (
          <video ref={videoRef} className="scanner-fullscreen__media" playsInline muted />
        )}

        <div className="scanner-fullscreen__cutout" aria-hidden />

        {detectedMarkers.map((marker) => (
          <button
            key={marker.id}
            type="button"
            className="scanner-fullscreen__pick"
            style={{ left: marker.x, top: marker.y }}
            aria-label={`选择二维码 ${marker.code}`}
            onClick={() => selectCode(marker.code)}
          >
            →
          </button>
        ))}

        <div className="scanner-fullscreen__chrome">
          <div className="scanner-fullscreen__header">
            <h3>{title}</h3>
            <p>{hint}</p>
          </div>

          {detectedMarkers.length > 1 ? (
            <p className="scanner-fullscreen__multi-hint">轻触小绿点，选择二维码</p>
          ) : null}

          {error ? <p className="scanner-fullscreen__error">{error}</p> : null}

          <button type="button" className="scanner-fullscreen__cancel" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
