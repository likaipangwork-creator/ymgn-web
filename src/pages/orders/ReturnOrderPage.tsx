import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageToolbar } from '../../components/PageToolbar'
import { useData } from '../../context/DataContext'

export function ReturnOrderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { orders, releaseEquipment, saveOrder } = useData()
  const order = orders.find((o) => o.id === id)
  const [returnNote, setReturnNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (!order) {
    return (
      <div className="stack">
        <PageToolbar backTo="/orders" title="确认归还" />
        <p className="muted page-center">订单不存在</p>
      </div>
    )
  }

  if (order.isReturned) {
    return (
      <div className="stack">
        <PageToolbar backTo={`/orders/${id}`} title="确认归还" />
        <p className="muted page-center">该订单已归还</p>
      </div>
    )
  }

  const handleReturn = async () => {
    setSaving(true)
    setError(null)
    try {
      await releaseEquipment(order)
      const updated = {
        ...order,
        isReturned: true,
        returnDate: new Date(),
        returnNote,
      }
      const ok = await saveOrder(updated)
      if (!ok) {
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
      <PageToolbar backTo={`/orders/${id}`} title="确认归还" />

      <section className="panel form-stack">
        <p>
          确认归还客户 <strong>{order.customer.name}</strong> 的订单？
        </p>
        <p className="muted">归还后将释放器材库存。</p>

        <label>
          归还备注
          <textarea className="form-input" rows={3} value={returnNote} onChange={(e) => setReturnNote(e.target.value)} />
        </label>

        {error ? <p className="error-text">{error}</p> : null}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate(`/orders/${id}`)}>
            取消
          </button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void handleReturn()}>
            {saving ? '处理中…' : '确认归还'}
          </button>
        </div>
      </section>
    </div>
  )
}
