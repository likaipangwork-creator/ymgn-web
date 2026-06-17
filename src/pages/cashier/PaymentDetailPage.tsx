import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { PageToolbar } from '../../components/PageToolbar'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { formatChineseDateTime } from '../../lib/dates'
import type { PaymentRecord } from '../../types/models'

export function PaymentDetailPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const {
    orders,
    getPaymentRecords,
    totalPaidAmount,
    resolvedPayStatus,
    savePaymentRecord,
    saveOrder,
  } = useData()

  const order = orders.find((o) => o.id === orderId)
  const [amount, setAmount] = useState('')
  const [payType, setPayType] = useState('现金')
  const [payNote, setPayNote] = useState('')
  const [totalPrice, setTotalPrice] = useState(order?.totalPrice ?? 0)
  const [orderNote, setOrderNote] = useState(order?.orderNote ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isAdmin) return <Navigate to="/" replace />

  if (!order) {
    return (
      <div className="stack">
        <PageToolbar backTo="/cashier" title="收款详情" />
        <p className="muted page-center">订单不存在</p>
      </div>
    )
  }

  const records = getPaymentRecords(order.id)
  const paid = totalPaidAmount(order.id)
  const status = resolvedPayStatus(order, paid)
  const remaining = Math.max(0, totalPrice - paid)

  const handleAddPayment = async () => {
    const value = Number.parseFloat(amount)
    if (!value || value <= 0) {
      setError('请输入有效金额')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const record: PaymentRecord = {
        id: crypto.randomUUID(),
        amount: value,
        time: new Date(),
        type: payType,
        note: payNote.trim() || null,
      }
      const ok = await savePaymentRecord(order.id, record)
      if (!ok) {
        setError('记录付款失败')
        return
      }
      setAmount('')
      setPayNote('')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveOrder = async () => {
    setSaving(true)
    setError(null)
    try {
      const updated = { ...order, totalPrice, orderNote }
      const ok = await saveOrder(updated)
      if (!ok) setError('保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="stack">
      <PageToolbar backTo="/cashier" title="收款详情" />

      <section className="panel detail-section">
        <h3>{order.customer.name}</h3>
        <p className="muted">{formatChineseDateTime(order.rentDate)}</p>
        <div className="stats-row">
          <span>应付 ¥{Math.round(totalPrice)}</span>
          <span>已付 ¥{Math.round(paid)}</span>
          <span>待付 ¥{Math.round(remaining)}</span>
          <span className={`badge ${status === '已付款' ? 'badge--ok' : 'badge--warn'}`}>{status}</span>
        </div>
      </section>

      <section className="panel form-stack">
        <h3>修改订单</h3>
        <label>
          订单总额
          <input
            type="number"
            min={0}
            className="form-input"
            value={totalPrice}
            onChange={(e) => setTotalPrice(Number.parseFloat(e.target.value) || 0)}
          />
        </label>
        <label>
          订单备注
          <textarea className="form-input" rows={2} value={orderNote} onChange={(e) => setOrderNote(e.target.value)} />
        </label>
        <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => void handleSaveOrder()}>
          保存订单信息
        </button>
      </section>

      <section className="panel form-stack">
        <h3>记录付款</h3>
        <label>
          金额
          <input type="number" min={0} className="form-input" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label>
          方式
          <select className="form-input" value={payType} onChange={(e) => setPayType(e.target.value)}>
            <option value="现金">现金</option>
            <option value="微信">微信</option>
            <option value="支付宝">支付宝</option>
            <option value="银行转账">银行转账</option>
            <option value="其他">其他</option>
          </select>
        </label>
        <label>
          备注
          <input className="form-input" value={payNote} onChange={(e) => setPayNote(e.target.value)} />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void handleAddPayment()}>
          添加付款记录
        </button>
      </section>

      <section className="panel">
        <h3>付款记录</h3>
        {records.length === 0 ? (
          <p className="muted">暂无付款记录</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>金额</th>
                <th>方式</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{formatChineseDateTime(r.time)}</td>
                  <td>¥{Math.round(r.amount)}</td>
                  <td>{r.type}</td>
                  <td>{r.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <button type="button" className="btn btn-ghost" onClick={() => navigate('/cashier')}>
        返回收银台
      </button>
    </div>
  )
}
