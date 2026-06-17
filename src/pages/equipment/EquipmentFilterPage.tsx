import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { PageToolbar } from '../../components/PageToolbar'
import { useData } from '../../context/DataContext'
import type { Equipment } from '../../types/models'

const FILTER_LABELS: Record<string, string> = {
  rentable: '可租器材',
  rented: '已租出器材',
  maintenance: '维护中器材',
}

export function EquipmentFilterPage() {
  const { filter = 'rentable' } = useParams<{ filter: string }>()
  const dm = useData()
  const title = FILTER_LABELS[filter] ?? '器材筛选'

  const items = useMemo(() => {
    const all = dm.equipments
    switch (filter) {
      case 'rentable':
        return all.filter((eq) => dm.rentableStock(eq) > 0)
      case 'rented':
        return all.filter((eq) => eq.usedCount > 0)
      case 'maintenance':
        return all.filter((eq) => dm.maintenanceQuantity(eq.id) > 0)
      default:
        return all
    }
  }, [dm, filter])

  const sorted = useMemo(
    () => dm.equipmentsOrderedLikeManagementAll(items),
    [dm, items]
  )

  return (
    <div className="stack">
      <PageToolbar backTo="/equipment" title={title} />

      <p className="muted">共 {sorted.length} 种器材</p>

      <div className="card-list">
        {sorted.map((eq: Equipment) => (
          <article key={eq.id} className="data-card">
            <div className="data-card__header">
              <h3>{eq.name}</h3>
              <span className="badge">{eq.category}</span>
            </div>
            <p className="muted">{dm.equipmentGroupLabel(eq)}</p>
            <div className="stats-row">
              <span>库存 {eq.stock}</span>
              <span className="accent">可租 {dm.rentableStock(eq)}</span>
              <span>已租 {eq.usedCount}</span>
              {dm.maintenanceQuantity(eq.id) > 0 ? (
                <span>维护 {dm.maintenanceQuantity(eq.id)}</span>
              ) : null}
            </div>
          </article>
        ))}
        {sorted.length === 0 ? <p className="muted page-center">暂无数据</p> : null}
      </div>
    </div>
  )
}
