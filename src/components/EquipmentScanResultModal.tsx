import { useData } from '../context/DataContext'
import type { ScanResolveResult } from '../lib/equipmentScanLookup'
import { EquipmentManageCard } from './EquipmentManageCard'

interface EquipmentScanResultModalProps {
  open: boolean
  result: ScanResolveResult | null
  error: string | null
  onClose: () => void
  onScanAgain: () => void
}

const KIND_LABELS: Record<ScanResolveResult['kind'], string> = {
  barcode: '器材',
  group: '文件夹',
  bundle: '套餐',
}

export function EquipmentScanResultModal({
  open,
  result,
  error,
  onClose,
  onScanAgain,
}: EquipmentScanResultModalProps) {
  const { rentableStock, maintenanceQuantity } = useData()

  if (!open) return null

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-card modal-card--wide scan-result-modal"
        role="dialog"
        aria-labelledby="scan-result-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="scan-result-title">扫码查器材</h3>

        {error ? (
          <p className="error-text">{error}</p>
        ) : result ? (
          <>
            <p className="scan-result-modal__meta">
              {KIND_LABELS[result.kind]} · {result.label}
              <span className="muted">（{result.code}）</span>
            </p>
            {result.equipments.length === 0 ? (
              <p className="muted">该码下暂无器材</p>
            ) : (
              <div className="card-list scan-result-modal__list">
                {result.equipments.map((eq) => (
                  <EquipmentManageCard
                    key={eq.id}
                    equipment={eq}
                    rentable={rentableStock(eq)}
                    maintenance={maintenanceQuantity(eq.id)}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    readOnly
                  />
                ))}
              </div>
            )}
          </>
        ) : null}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            关闭
          </button>
          <button type="button" className="btn btn-primary" onClick={onScanAgain}>
            再扫一次
          </button>
        </div>
      </div>
    </div>
  )
}
