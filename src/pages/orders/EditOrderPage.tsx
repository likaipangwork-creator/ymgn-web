import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { EquipmentPicker } from '../../components/EquipmentPicker'
import { PageToolbar } from '../../components/PageToolbar'
import { useData } from '../../context/DataContext'
import type { OrderEquipmentLineItem, RentalOrder } from '../../types/models'
import { orderEquipmentLineItemDisplayName } from '../../types/models'

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function EditOrderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { orders, customers, crews, introducers, updateEquipmentForOrder, saveOrder } = useData()
  const existing = orders.find((o) => o.id === id)

  const [customerId, setCustomerId] = useState(existing?.customer.id ?? '')
  const [crewName, setCrewName] = useState(existing?.cameraCrewName ?? '')
  const [introducerName, setIntroducerName] = useState(existing?.introducerName ?? '')
  const [rentDateStr, setRentDateStr] = useState(
    existing ? toDateInputValue(existing.rentDate) : toDateInputValue(new Date())
  )
  const [rentalDays, setRentalDays] = useState(existing?.rentalDays ?? 1)
  const [totalPrice, setTotalPrice] = useState(existing?.totalPrice ?? 0)
  const [deposit, setDeposit] = useState(existing?.deposit ?? 0)
  const [orderNote, setOrderNote] = useState(existing?.orderNote ?? '')
  const [equipmentItems, setEquipmentItems] = useState<OrderEquipmentLineItem[]>(
    existing?.equipmentItems ?? []
  )
  const [showPicker, setShowPicker] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const endDateStr = useMemo(() => {
    const rent = new Date(rentDateStr)
    return toDateInputValue(addDays(rent, Math.max(1, rentalDays)))
  }, [rentDateStr, rentalDays])

  if (!existing) {
    return (
      <div className="stack">
        <PageToolbar backTo="/orders" title="编辑订单" />
        <p className="muted page-center">订单不存在</p>
      </div>
    )
  }

  if (existing.isReturned) {
    return (
      <div className="stack">
        <PageToolbar backTo={`/orders/${id}`} title="编辑订单" />
        <p className="muted page-center">已归还订单不可编辑</p>
      </div>
    )
  }

  const selectedCustomer = customers.find((c) => c.id === customerId)

  const handleSave = async () => {
    setError(null)
    if (!selectedCustomer) {
      setError('请选择客户')
      return
    }
    if (equipmentItems.length === 0) {
      setError('请至少选择一件器材')
      return
    }

    const updated: RentalOrder = {
      ...existing,
      customer: selectedCustomer,
      equipmentItems,
      rentalDays: Math.max(1, rentalDays),
      totalPrice,
      deposit,
      rentDate: new Date(rentDateStr),
      endDate: new Date(endDateStr),
      cameraCrewName: crewName,
      introducerName: introducerName,
      orderNote,
    }

    setSaving(true)
    try {
      const ok = await updateEquipmentForOrder(existing, updated)
      if (!ok) {
        setError('器材库存不足，请调整选择')
        return
      }
      const saved = await saveOrder(updated)
      if (!saved) {
        setError('保存失败')
        return
      }
      navigate(`/orders/${id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="stack">
      <PageToolbar backTo={`/orders/${id}`} title="编辑订单" />

      <section className="panel form-stack">
        <label>
          客户
          <select className="form-input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          跟机员
          <select className="form-input" value={crewName} onChange={(e) => setCrewName(e.target.value)}>
            <option value="">无</option>
            {crews.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          介绍人
          <select className="form-input" value={introducerName} onChange={(e) => setIntroducerName(e.target.value)}>
            <option value="">无</option>
            {introducers.map((i) => (
              <option key={i.id} value={i.name}>
                {i.name}
              </option>
            ))}
          </select>
        </label>

        <div className="form-row">
          <label>
            开始日期
            <input type="date" className="form-input" value={rentDateStr} onChange={(e) => setRentDateStr(e.target.value)} />
          </label>
          <label>
            租赁天数
            <input
              type="number"
              min={1}
              className="form-input"
              value={rentalDays}
              onChange={(e) => setRentalDays(Number.parseInt(e.target.value, 10) || 1)}
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            总金额
            <input type="number" min={0} className="form-input" value={totalPrice} onChange={(e) => setTotalPrice(Number.parseFloat(e.target.value) || 0)} />
          </label>
          <label>
            押金
            <input type="number" min={0} className="form-input" value={deposit} onChange={(e) => setDeposit(Number.parseFloat(e.target.value) || 0)} />
          </label>
        </div>

        <label>
          订单备注
          <textarea className="form-input" rows={2} value={orderNote} onChange={(e) => setOrderNote(e.target.value)} />
        </label>

        <div className="panel-header-row">
          <h3>器材</h3>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowPicker(true)}>
            选择器材
          </button>
        </div>
        <ul className="simple-list">
          {equipmentItems.map((item) => (
            <li key={item.equipment.id}>{orderEquipmentLineItemDisplayName(item)}</li>
          ))}
        </ul>

        {error ? <p className="error-text">{error}</p> : null}
        <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void handleSave()}>
          {saving ? '保存中…' : '保存修改'}
        </button>
      </section>

      <EquipmentPicker
        open={showPicker}
        selectedItems={equipmentItems}
        onChange={setEquipmentItems}
        onClose={() => setShowPicker(false)}
      />
    </div>
  )
}
