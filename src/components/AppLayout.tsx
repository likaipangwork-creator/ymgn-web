import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { formatChineseDateTime } from '../lib/dates'
import { AppIcon } from './AppIcon'

export function AppLayout() {
  const { username, isAdmin, signOut } = useAuth()
  const {
    isSyncing,
    lastSyncTime,
    fullRefresh,
    loadError,
    equipments,
    orders,
    customers,
    inventoryStats,
  } = useData()
  const location = useLocation()
  const equipmentTotalUnits = inventoryStats(equipments).totalUnits
  const dataSummary = `器材 ${equipmentTotalUnits} · 订单 ${orders.length} · 客户 ${customers.length}`

  return (
    <div className="app-shell">
      {loadError ? (
        <div className="load-error-banner" role="alert">
          {loadError}
        </div>
      ) : null}

      <header className="app-header">
        <div className="app-header__brand-row">
          <AppIcon size={40} className="app-logo" />
          <div>
            <p className="app-brand">驿马光年</p>
            <p className="app-subtitle">
              {username} · {isAdmin ? '管理员' : '普通用户'}
            </p>
            <p className="data-summary">{isSyncing ? '正在同步…' : dataSummary}</p>
          </div>
        </div>
        <div className="app-header__actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm sync-btn"
            disabled={isSyncing}
            onClick={() => void fullRefresh()}
            title="手动同步"
          >
            {isSyncing ? '同步中…' : '↻ 同步'}
          </button>
          {lastSyncTime ? (
            <span className="sync-time muted">{formatChineseDateTime(lastSyncTime)}</span>
          ) : null}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void signOut()}>
            退出
          </button>
        </div>
      </header>

      {location.pathname !== '/' ? (
        <div className="breadcrumb">
          <Link to="/">‹ 返回主页</Link>
        </div>
      ) : null}

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
