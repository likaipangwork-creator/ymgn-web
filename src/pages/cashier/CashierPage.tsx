import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { PageToolbar } from '../../components/PageToolbar'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { formatChineseDateTime } from '../../lib/dates'
import type { PayStatus } from '../../types/models'
import { orderEquipmentLineItemDisplayName } from '../../types/models'

export function CashierPage() {
  const { isAdmin } = useAuth()
  const { orders, resolvedPayStatus, totalPaidAmount } = useData()
  const [year, setYear] = useState(new Date().getFullYear())
  const [payFilter, setPayFilter] = useState<'全部' | PayStatus>('全部')
  const [search, setSearch] = useState('')

  if (!isAdmin) return <Navigate to="/" replace />

  const years = useMemo(() => {
    const set = new Set(orders.map((o) => o.rentDate.getFullYear()))
    set.add(new Date().getFullYear())
    return [...set].sort((a, b) => b - a)
  }, [orders])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orders.filter((order) => {
      if (order.rentDate.getFullYear() !== year) return false
      const paid = totalPaidAmount(order.id)
      const status = resolvedPayStatus(order, paid)
      if (payFilter !== '全部' && status !== payFilter) return false
      if (!q) return true
      return (
        order.customer.name.toLowerCase().includes(q) ||
        order.customer.phone.toLowerCase().includes(q)
      )
    })
  }, [orders, year, payFilter, search, totalPaidAmount, resolvedPayStatus])

  return (
    <div className="stack">
      <PageToolbar title="收银台" />

      <section className="panel">
        <div className="form-row">
          <label>
            年份
            <select className="form-input" value={year} onChange={(e) => setYear(Number.parseInt(e.target.value, 10))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y} 年
                </option>
              ))}
            </select>
          </label>
        </div>
        <input
          className="search-input"
          placeholder="搜索客户姓名或电话"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="filter-row">
          {(['全部', '待付款', '已付款'] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={`chip ${payFilter === p ? 'chip--active' : ''}`}
              onClick={() => setPayFilter(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <p className="muted">共 {filtered.length} 单</p>
      </section>

      <div className="card-list">
        {filtered.map((order) => {
          const paid = totalPaidAmount(order.id)
          const status = resolvedPayStatus(order, paid)
          return (
            <Link key={order.id} to={`/cashier/${order.id}`} className="data-card menu-card">
              <div className="data-card__header">
                <h3>{order.customer.name}</h3>
                <span className={`badge ${status === '已付款' ? 'badge--ok' : 'badge--warn'}`}>{status}</span>
              </div>
              <p className="muted">{formatChineseDateTime(order.rentDate)}</p>
              <div className="stats-row">
                <span>总额 ¥{Math.round(order.totalPrice)}</span>
                <span>已付 ¥{Math.round(paid)}</span>
              </div>
              <p className="muted">
                {order.equipmentItems.map(orderEquipmentLineItemDisplayName).join('、')}
              </p>
            </Link>
          )
        })}
        {filtered.length === 0 ? <p className="muted page-center">暂无订单</p> : null}
      </div>
    </div>
  )
}
