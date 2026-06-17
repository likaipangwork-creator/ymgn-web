import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageToolbar } from '../../components/PageToolbar'
import { PasswordModal } from '../../components/PasswordModal'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { requirePasswordForAction } from '../../lib/password'
import type { Equipment } from '../../types/models'

type Segment = '摄影' | '灯光' | '套餐' | '全部'

export function EquipmentManagePage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const {
    equipments,
    equipmentBundles,
    equipmentsMatchingSearch,
    equipmentsOrderedLikeManagement,
    equipmentsOrderedLikeManagementAll,
    inventoryStats,
    equipmentGroupLabel,
    rentableStock,
    maintenanceQuantity,
    deleteEquipment,
  } = useData()
  const [segment, setSegment] = useState<Segment>('摄影')
  const [search, setSearch] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Equipment | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [passwordAction, setPasswordAction] = useState<'delete' | 'edit' | null>(null)
  const [editTarget, setEditTarget] = useState<Equipment | null>(null)

  const filtered = useMemo(() => equipmentsMatchingSearch(search), [equipmentsMatchingSearch, search, equipments])

  const segmentEquipments = useMemo(() => {
    switch (segment) {
      case '摄影':
        return equipmentsOrderedLikeManagement('摄影器材', filtered)
      case '灯光':
        return equipmentsOrderedLikeManagement('灯光器材', filtered)
      case '套餐': {
        const bundleIds = new Set(equipmentBundles.flatMap((b) => b.equipmentIds))
        return filtered.filter((eq) => bundleIds.has(eq.id))
      }
      default:
        return equipmentsOrderedLikeManagementAll(filtered)
    }
  }, [
    filtered,
    segment,
    equipmentBundles,
    equipmentsOrderedLikeManagement,
    equipmentsOrderedLikeManagementAll,
  ])

  const stats = useMemo(() => inventoryStats(segmentEquipments), [inventoryStats, segmentEquipments])

  const grouped = useMemo(() => {
    const batches: { label: string; items: Equipment[] }[] = []
    for (const eq of segmentEquipments) {
      const label = equipmentGroupLabel(eq)
      const last = batches[batches.length - 1]
      if (last && last.label === label) last.items.push(eq)
      else batches.push({ label, items: [eq] })
    }
    return batches
  }, [segmentEquipments, equipmentGroupLabel])

  const requestDelete = (eq: Equipment) => {
    if (requirePasswordForAction(isAdmin)) {
      setPendingDelete(eq)
      setPasswordAction('delete')
      setShowPassword(true)
      return
    }
    setPendingDelete(eq)
  }

  const requestEdit = (eq: Equipment) => {
    if (requirePasswordForAction(isAdmin)) {
      setEditTarget(eq)
      setPasswordAction('edit')
      setShowPassword(true)
      return
    }
    navigate(`/equipment/${eq.id}/edit`)
  }

  const handlePasswordConfirm = () => {
    setShowPassword(false)
    if (passwordAction === 'edit' && editTarget) {
      navigate(`/equipment/${editTarget.id}/edit`)
    } else if (passwordAction === 'delete' && pendingDelete) {
      /* show confirm dialog */
    }
    setPasswordAction(null)
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    await deleteEquipment(pendingDelete.id)
    setPendingDelete(null)
  }

  return (
    <div className="stack">
      <PageToolbar
        title="器材库存管理"
        actions={
          <>
            <Link to="/equipment/groups" className="btn btn-ghost btn-sm">
              分组
            </Link>
            <Link to="/equipment/bundles" className="btn btn-ghost btn-sm">
              套餐
            </Link>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/equipment/new')}>
              新建
            </button>
          </>
        }
      />

      <input
        className="search-input"
        placeholder="搜索器材名称、条码…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="tab-bar">
        {(['摄影', '灯光', '套餐', '全部'] as Segment[]).map((s) => (
          <button
            key={s}
            type="button"
            className={`tab-bar__item ${segment === s ? 'tab-bar__item--active' : ''}`}
            onClick={() => setSegment(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <section className="stats-cards">
        <div className="stat-card">
          <span className="muted">全部器材</span>
          <strong>{stats.totalUnits} 件</strong>
        </div>
        <Link to="/equipment/filter/rentable" className="stat-card stat-card--link">
          <span className="muted">可租</span>
          <strong className="accent">{stats.availableUnits} 件</strong>
        </Link>
        <Link to="/equipment/filter/rented" className="stat-card stat-card--link">
          <span className="muted">已租出</span>
          <strong>{stats.rentedUnits} 件</strong>
        </Link>
        <Link to="/equipment/filter/maintenance" className="stat-card stat-card--link">
          <span className="muted">维护中</span>
          <strong>{stats.maintenanceUnits} 件</strong>
        </Link>
      </section>

      {grouped.map((batch) => (
        <section key={batch.label} className="catalog-group">
          {batch.label !== '未分组' ? <h3 className="catalog-group__title">{batch.label}</h3> : null}
          <div className="card-list">
            {batch.items.map((eq) => {
              const rentable = rentableStock(eq)
              const maintenance = maintenanceQuantity(eq.id)
              return (
                <article key={eq.id} className="data-card">
                  <div className="data-card__header">
                    <h3>{eq.name}</h3>
                    <span className="badge">{eq.category}</span>
                  </div>
                  <p className="muted">条码：{eq.barcode || '—'}</p>
                  <div className="stats-row">
                    <span>库存 {eq.stock}</span>
                    <span className="accent">可租 {rentable}</span>
                    <span>已租 {eq.usedCount}</span>
                    {maintenance > 0 ? <span>维护 {maintenance}</span> : null}
                  </div>
                  <div className="inline-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => requestEdit(eq)}>
                      编辑
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm btn-danger-text" onClick={() => requestDelete(eq)}>
                      删除
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ))}

      {segmentEquipments.length === 0 ? <p className="muted page-center">暂无器材</p> : null}

      {pendingDelete && !showPassword ? (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>确认删除</h3>
            <p>确定删除「{pendingDelete.name}」吗？</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setPendingDelete(null)}>
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
        onConfirm={handlePasswordConfirm}
        onCancel={() => {
          setShowPassword(false)
          setPasswordAction(null)
          setPendingDelete(null)
          setEditTarget(null)
        }}
      />
    </div>
  )
}
