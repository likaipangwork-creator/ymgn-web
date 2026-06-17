import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EquipmentPicker } from '../../components/EquipmentPicker'
import { PageToolbar } from '../../components/PageToolbar'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import type { Customer, OrderEquipmentLineItem, RentalOrder } from '../../types/models'
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

export function NewOrderPage() {
  const navigate = useNavigate()
  const { username } = useAuth()
  const { customers, crews, introducers, saveOrder, reserveEquipment } = useData()

  const [customerId, setCustomerId] = useState('')
  const [crewName, setCrewName] = useState('')
  const [introducerName, setIntroducerName] = useState('')
  const [rentDateStr, setRentDateStr] = useState(toDateInputValue(new Date()))
  const [rentalDays, setRentalDays] = useState(1)
  const [totalPrice, setTotalPrice] = useState(0)
  const [deposit, setDeposit] = useState(0)
  const [orderNote, setOrderNote] = useState('')
  const [equipmentItems, setEquipmentItems] = useState<OrderEquipmentLineItem[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const endDateStr = useMemo(() => {
    const rent = new Date(rentDateStr)
    return toDateInputValue(addDays(rent, Math.max(1, rentalDays)))
  }, [rentDateStr, rentalDays])

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

    const rentDate = new Date(rentDateStr)
    const endDate = new Date(endDateStr)

    const order: RentalOrder = {
      id: crypto.randomUUID(),
      customer: selectedCustomer,
      equipmentItems,
      rentalDays: Math.max(1, rentalDays),
      totalPrice,
      deposit,
      rentDate,
      endDate,
      isReturned: false,
      returnDate: null,
      confirmBy: username,
      returnNote: '',
      modifyUser: null,
      modifyDate: null,
      payStatus: '待付款',
      payTime: null,
      cameraCrewName: crewName,
      introducerName: introducerName,
      orderNote,
    }

    setSaving(true)
    try {
      const reserved = await reserveEquipment(order)
      if (!reserved) {
        setError('器材库存不足，请调整选择')
        return
      }
      const ok = await saveOrder(order)
      if (!ok) {
        setError('保存失败，请重试')
        return
      }
      navigate(`/orders/${order.id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="stack">
      <PageToolbar backTo="/orders" title="新建订单" />

      <section className="panel form-stack">
        <label>
          客户
          <select className="form-input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">请选择客户</option>
            {customers.map((c: Customer) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.phone ? `(${c.phone})` : ''}
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
            <input
              type="date"
              className="form-input"
              value={rentDateStr}
              onChange={(e) => setRentDateStr(e.target.value)}
            />
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
        <p className="muted">结束日期：{endDateStr}</p>

        <div className="form-row">
          <label>
            总金额（元）
            <input
              type="number"
              min={0}
              className="form-input"
              value={totalPrice}
              onChange={(e) => setTotalPrice(Number.parseFloat(e.target.value) || 0)}
            />
          </label>
          <label>
            押金（元）
            <input
              type="number"
              min={0}
              className="form-input"
              value={deposit}
              onChange={(e) => setDeposit(Number.parseFloat(e.target.value) || 0)}
            />
          </label>
        </div>

        <label>
          订单备注
          <textarea className="form-input" rows={2} value={orderNote} onChange={(e) => setOrderNote(e.target.value)} />
        </label>

        <div>
          <div className="panel-header-row">
            <h3>器材</h3>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowPicker(true)}>
              选择器材
            </button>
          </div>
          {equipmentItems.length > 0 ? (
            <ul className="simple-list">
              {equipmentItems.map((item) => (
                <li key={item.equipment.id}>{orderEquipmentLineItemDisplayName(item)}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">尚未选择器材</p>
          )}
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void handleSave()}>
          {saving ? '保存中…' : '保存订单'}
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
