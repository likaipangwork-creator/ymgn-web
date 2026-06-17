import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface QRCodeDisplayProps {
  value: string
  size?: number
  label?: string
}

export function QRCodeDisplay({ value, size = 160, label }: QRCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!value.trim()) {
      setDataUrl(null)
      return
    }
    let cancelled = false
    void QRCode.toDataURL(value, { width: size, margin: 2 }).then((url) => {
      if (!cancelled) setDataUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [value, size])

  if (!value.trim()) return null

  return (
    <div className="qrcode-display">
      {label ? <p className="muted">{label}</p> : null}
      {dataUrl ? (
        <img src={dataUrl} alt={`二维码：${value}`} width={size} height={size} />
      ) : (
        <p className="muted">生成中…</p>
      )}
      <p className="qrcode-value">{value}</p>
    </div>
  )
}
