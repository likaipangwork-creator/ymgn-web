import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface BarcodeScannerProps {
  open: boolean
  onScan: (code: string) => void
  onClose: () => void
}

export function BarcodeScanner({ open, onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const containerId = 'barcode-scanner-region'

  useEffect(() => {
    if (!open) return

    let active = true
    const scanner = new Html5Qrcode(containerId)
    scannerRef.current = scanner

    void scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => {
          if (!active) return
          onScan(decoded.trim())
          void stopScanner()
          onClose()
        },
        () => {}
      )
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : '无法启动摄像头')
        }
      })

    async function stopScanner() {
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
      void stopScanner()
    }
  }, [open, onScan, onClose])

  if (!open) return null

  return (
    <div className="modal-overlay" role="presentation">
      <div className="modal-card modal-card--wide">
        <h3>扫码</h3>
        <p className="muted">对准器材条码或套餐码</p>
        <div id={containerId} className="scanner-region" />
        {error ? <p className="error-text">{error}</p> : null}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
