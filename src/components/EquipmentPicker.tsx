import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import type { EquCategory, Equipment, OrderEquipmentLineItem } from '../types/models'
import { isBundleCode, isPackageCode, orderEquipmentLineItemDisplayName } from '../types/models'
import { BarcodeScanner } from './BarcodeScanner'

type CatalogTab = '摄影' | '灯光' | '套餐'

interface EquipmentPickerProps {
  open: boolean
  selectedItems: OrderEquipmentLineItem[]
  onChange: (items: OrderEquipmentLineItem[]) => void
  onClose: () => void
  extraReserved?: Record<string, number>
}

function mergeItem(
  items: OrderEquipmentLineItem[],
  equipment: Equipment,
  delta: number
): OrderEquipmentLineItem[] {
  const map = new Map<string, OrderEquipmentLineItem>()
  for (const item of items) {
    map.set(item.equipment.id, { ...item })
  }
  const existing = map.get(equipment.id)
  const nextQty = (existing?.quantity ?? 0) + delta
  if (nextQty <= 0) {
    map.delete(equipment.id)
  } else {
    map.set(equipment.id, { equipment, quantity: nextQty })
  }
  return [...map.values()]
}

export function EquipmentPicker({
  open,
  selectedItems,
  onChange,
  onClose,
  extraReserved = {},
}: EquipmentPickerProps) {
  const dm = useData()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<CatalogTab>('摄影')
  const [tempSelected, setTempSelected] = useState<OrderEquipmentLineItem[]>(selectedItems)
  const [showScanner, setShowScanner] = useState(false)
  const [alertMsg, setAlertMsg] = useState<string | null>(null)

  const filtered = useMemo(
    () => dm.equipmentsMatchingSearch(search),
    [dm, search]
  )

  const photoEquips = useMemo(
    () => dm.equipmentsOrderedLikeManagement('摄影器材', filtered),
    [dm, filtered]
  )
  const lightEquips = useMemo(
    () => dm.equipmentsOrderedLikeManagement('灯光器材', filtered),
    [dm, filtered]
  )
  const bundles = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return dm.equipmentBundles
    return dm.equipmentBundles.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.packageCode.toLowerCase().includes(q) ||
        b.note.toLowerCase().includes(q)
    )
  }, [dm.equipmentBundles, search])

  const totalUnits = tempSelected.reduce((s, i) => s + i.quantity, 0)

  const rentableFor = (equipment: Equipment): number => {
    const selected = tempSelected.find((i) => i.equipment.id === equipment.id)?.quantity ?? 0
    const extra = extraReserved[equipment.id] ?? 0
    return dm.rentableStock(equipment) + selected - extra
  }

  const addOne = (equipment: Equipment) => {
    if (rentableFor(equipment) < 1) {
      setAlertMsg(`「${equipment.name}」库存不足`)
      return
    }
    setTempSelected((prev) => mergeItem(prev, equipment, 1))
  }

  const changeQty = (equipment: Equipment, delta: number) => {
    if (delta > 0 && rentableFor(equipment) < delta) {
      setAlertMsg(`「${equipment.name}」库存不足`)
      return
    }
    setTempSelected((prev) => mergeItem(prev, equipment, delta))
  }

  const handleScan = (code: string) => {
    const normalized = code.trim()
    if (!normalized) return

    if (isBundleCode(normalized)) {
      const bundle = dm.equipmentBundles.find(
        (b) => b.packageCode.toUpperCase() === normalized.toUpperCase()
      )
      if (bundle) {
        const selectedMap = Object.fromEntries(
          tempSelected.map((i) => [i.equipment.id, i.quantity])
        )
        const availability = dm.bundleAddAvailability(
          bundle.id,
          selectedMap,
          extraReserved
        )
        if (!availability.canAdd) {
          setAlertMsg(availability.blockingReason ?? '套餐暂不可添加')
          return
        }
        let next = tempSelected
        for (const eq of availability.equipments) {
          next = mergeItem(next, eq, 1)
        }
        setTempSelected(next)
        return
      }
    }

    if (isPackageCode(normalized)) {
      const group = dm.equipmentGroups.find(
        (g) => g.packageCode.toUpperCase() === normalized.toUpperCase()
      )
      if (group) {
        const inGroup = dm.equipments.filter((eq) => eq.groupId === group.id)
        let next = tempSelected
        for (const eq of inGroup) {
          if (rentableFor(eq) >= 1) next = mergeItem(next, eq, 1)
        }
        setTempSelected(next)
        return
      }
    }

    const found = dm.equipments.find((eq) => eq.barcode === normalized)
    if (found) addOne(found)
    else setAlertMsg(`未找到条码：${normalized}`)
  }

  const addBundle = (bundleId: string) => {
    const selectedMap = Object.fromEntries(
      tempSelected.map((i) => [i.equipment.id, i.quantity])
    )
    const availability = dm.bundleAddAvailability(bundleId, selectedMap, extraReserved)
    if (!availability.canAdd) {
      setAlertMsg(availability.blockingReason ?? '套餐暂不可添加')
      return
    }
    let next = tempSelected
    for (const eq of availability.equipments) {
      next = mergeItem(next, eq, 1)
    }
    setTempSelected(next)
  }

  const renderEquipmentRows = (equipments: Equipment[], category: EquCategory) => {
    const batches: { label: string; items: Equipment[] }[] = []
    for (const eq of equipments) {
      const label = dm.equipmentGroupLabel(eq)
      const last = batches[batches.length - 1]
      if (last && last.label === label) last.items.push(eq)
      else batches.push({ label, items: [eq] })
    }

    return batches.map((batch) => (
      <div key={`${category}-${batch.label}`} className="catalog-group">
        {batch.label !== '未分组' ? <h4 className="catalog-group__title">{batch.label}</h4> : null}
        {batch.items.map((eq) => {
          const qty = tempSelected.find((i) => i.equipment.id === eq.id)?.quantity ?? 0
          const canAdd = rentableFor(eq) > 0
          return (
            <div key={eq.id} className="equipment-picker-row">
              <div>
                <p className="equipment-picker-row__name">{eq.name}</p>
                <p className="muted">
                  可租 {rentableFor(eq)} · 库存 {eq.stock}
                </p>
              </div>
              <div className="qty-control">
                <button
                  type="button"
                  className="qty-btn"
                  disabled={qty <= 0}
                  onClick={() => changeQty(eq, -1)}
                >
                  −
                </button>
                <span className="qty-value">{qty}</span>
                <button
                  type="button"
                  className="qty-btn"
                  disabled={!canAdd}
                  onClick={() => changeQty(eq, 1)}
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
      </div>
    ))
  }

  if (!open) return null

  return (
    <div className="modal-overlay equipment-picker-overlay" role="presentation">
      <div className="modal-card modal-card--full">
        <div className="equipment-picker-header">
          <h3>选择器材</h3>
          <p className="muted">已选 {totalUnits} 件</p>
        </div>

        <input
          className="search-input"
          placeholder="搜索器材、类别或套餐"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <button type="button" className="btn btn-ghost scanner-btn" onClick={() => setShowScanner(true)}>
          📷 扫码添加器材
        </button>

        {tempSelected.length > 0 ? (
          <div className="selected-summary">
            {tempSelected.map((item) => (
              <span key={item.equipment.id} className="badge">
                {orderEquipmentLineItemDisplayName(item)}
              </span>
            ))}
          </div>
        ) : null}

        <div className="tab-bar">
          {(['摄影', '灯光', '套餐'] as CatalogTab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`tab-bar__item ${tab === t ? 'tab-bar__item--active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="equipment-picker-body">
          {tab === '摄影' ? renderEquipmentRows(photoEquips, '摄影器材') : null}
          {tab === '灯光' ? renderEquipmentRows(lightEquips, '灯光器材') : null}
          {tab === '套餐'
            ? bundles.map((bundle) => (
                <div key={bundle.id} className="equipment-picker-row">
                  <div>
                    <p className="equipment-picker-row__name">{bundle.name}</p>
                    <p className="muted">{bundle.packageCode}</p>
                  </div>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => addBundle(bundle.id)}>
                    添加套餐
                  </button>
                </div>
              ))
            : null}
        </div>

        {alertMsg ? (
          <div className="modal-overlay" role="presentation" onClick={() => setAlertMsg(null)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <p>{alertMsg}</p>
              <button type="button" className="btn btn-primary" onClick={() => setAlertMsg(null)}>
                好的
              </button>
            </div>
          </div>
        ) : null}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onChange(tempSelected)
              onClose()
            }}
          >
            确定
          </button>
        </div>

        <BarcodeScanner open={showScanner} onScan={handleScan} onClose={() => setShowScanner(false)} />
      </div>
    </div>
  )
}
