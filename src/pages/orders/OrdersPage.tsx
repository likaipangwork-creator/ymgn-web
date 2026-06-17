import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageToolbar } from '../../components/PageToolbar'
import { PasswordModal } from '../../components/PasswordModal'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { formatChineseDateTime } from '../../lib/dates'
import { requirePasswordForAction } from '../../lib/password'
import { rentalOrderTotalEquipmentUnitCount } from '../../types/models'

type DateFilter = 'all' | '7' | '30' | '90'

export function OrdersPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { orders, deleteOrder, releaseEquipment } = useData()
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const now = Date.now()
    const days =
      dateFilter === 'all' ? null : Number.parseInt(dateFilter, 10)

    return orders.filter((order) => {
      if (days != null) {
        const diff = now - order.rentDate.getTime()
        if (diff > days * 86400000) return false
      }
      if (!q) return true
      const eqNames = order.equipmentItems.map((i) => i.equipment.name).join(' ')
      return (
        order.customer.name.toLowerCase().includes(q) ||
        order.customer.phone.toLowerCase().includes(q) ||
        order.cameraCrewName.toLowerCase().includes(q) ||
        order.introducerName.toLowerCase().includes(q) ||
        order.orderNote.toLowerCase().includes(q) ||
        eqNames.toLowerCase().includes(q)
      )
    })
  }, [orders, search, dateFilter])

  const requestDelete = (id: string) => {
    if (requirePasswordForAction(isAdmin)) {
      setPendingDeleteId(id)
      setShowPassword(true)
      return
    }
    setPendingDeleteId(id)
  }

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    const order = orders.find((o) => o.id === pendingDeleteId)
    if (order && !order.isReturned) await releaseEquipment(order)
    await deleteOrder(pendingDeleteId)
    setPendingDeleteId(null)
    setShowPassword(false)
  }

  return (
    <div className="stack">
      <PageToolbar
        title="租赁订单"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => navigate('/orders/new')}>
            新建订单
          </button>
        }
      />

      <section className="panel">
        <p className="muted">共 {filtered.length} 单</p>
        <input
          className="search-input"
          placeholder="搜索客户、器材、跟机员…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="filter-row">
          {(
            [
              ['all', '全部'],
              ['7', '近7天'],
              ['30', '近30天'],
              ['90', '近90天'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`chip ${dateFilter === value ? 'chip--active' : ''}`}
              onClick={() => setDateFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <div className="card-list">
        {filtered.map((order) => (
          <article key={order.id} className="data-card data-card--link">
            <Link to={`/orders/${order.id}`} className="data-card__link">
              <div className="data-card__header">
                <h3>{order.customer.name}</h3>
                <span className={`badge ${order.isReturned ? 'badge--ok' : 'badge--warn'}`}>
                  {order.isReturned ? '已归还' : '未归还'}
                </span>
              </div>
              <p className="order-card__meta">
                租赁时间：{formatChineseDateTime(order.rentDate)}
              </p>
              <p className="order-card__meta">
                天数：{order.rentalDays} 天{' '}
                <span className="order-card__sep">｜</span> 器材：
                {rentalOrderTotalEquipmentUnitCount(order)} 件
              </p>
              {order.modifyUser && order.modifyDate ? (
                <p className="order-card__modify">
                  <span className="order-card__modify-icon" aria-hidden>
                    ✎
                  </span>
                  修改：
                  <span className="order-card__modify-user">{order.modifyUser}</span>{' '}
                  {formatChineseDateTime(order.modifyDate)}
                </p>
              ) : null}
            </Link>
            <div className="data-card__footer">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setMenuOpenId(menuOpenId === order.id ? null : order.id)}
              >
                ···
              </button>
              {menuOpenId === order.id ? (
                <div className="context-menu">
                  {!order.isReturned ? (
                    <button type="button" onClick={() => navigate(`/orders/${order.id}/edit`)}>
                      编辑
                    </button>
                  ) : null}
                  <button type="button" className="danger" onClick={() => requestDelete(order.id)}>
                    删除
                  </button>
                </div>
              ) : null}
            </div>
          </article>
        ))}
        {filtered.length === 0 ? <p className="muted page-center">暂无订单</p> : null}
      </div>

      {pendingDeleteId && !showPassword ? (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>确认删除</h3>
            <p>删除后不可恢复，确定删除此订单吗？</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setPendingDeleteId(null)}>
                取消
              </button>
              <button type="button" className="btn btn-primary btn-danger" onClick={() => void confirmDelete()}>
                删除
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PasswordModal
        open={showPassword}
        onConfirm={() => {
          setShowPassword(false)
          if (pendingDeleteId) setPendingDeleteId(pendingDeleteId)
        }}
        onCancel={() => {
          setShowPassword(false)
          setPendingDeleteId(null)
        }}
      />
    </div>
  )
}
