import type { Equipment } from '../types/models'

type StockBadgeTone = 'green' | 'red' | 'orange' | 'purple'

function equipmentStockBadge(
  equipment: Equipment,
  rentable: number,
  maintenance: number
): { label: string; tone: StockBadgeTone } {
  const underMaintenance = maintenance > 0
  const availableStock = equipment.stock - equipment.usedCount

  if (underMaintenance && rentable === 0) {
    return { label: '维护中', tone: 'purple' }
  }
  if (availableStock <= 0) {
    return { label: '已租完', tone: 'red' }
  }
  if (equipment.usedCount === 0) {
    return { label: '空闲', tone: 'green' }
  }
  if (availableStock <= Math.max(1, Math.floor(equipment.stock / 4))) {
    return { label: `库存紧张 : ${availableStock}`, tone: 'orange' }
  }
  return { label: `可用 : ${availableStock}`, tone: 'green' }
}

interface EquipmentManageCardProps {
  equipment: Equipment
  rentable: number
  maintenance: number
  onEdit: () => void
  onDelete: () => void
}

export function EquipmentManageCard({
  equipment,
  rentable,
  maintenance,
  onEdit,
  onDelete,
}: EquipmentManageCardProps) {
  const badge = equipmentStockBadge(equipment, rentable, maintenance)
  const underMaintenanceBlocked = maintenance > 0 && rentable === 0
  const rentalRate =
    equipment.stock > 1
      ? Math.round((equipment.usedCount / equipment.stock) * 100)
      : null

  return (
    <article className="equip-manage-card">
      <div className="equip-manage-card__top">
        <h3 className="equip-manage-card__name">{equipment.name}</h3>
        <span className={`equip-stock-badge equip-stock-badge--${badge.tone}`}>{badge.label}</span>
      </div>

      <div className="equip-manage-card__body">
        <div className="equip-manage-card__primary">
          <p className="equip-manage-card__inventory">库存 {equipment.stock} 件</p>
          {underMaintenanceBlocked ? (
            <p className="equip-manage-card__highlight equip-manage-card__highlight--maintenance">
              维护中 {maintenance} 件
            </p>
          ) : (
            <>
              <p className="equip-manage-card__highlight">可租 {rentable} 件</p>
              {maintenance > 0 ? (
                <p className="equip-manage-card__maintenance-note">维护 {maintenance} 件</p>
              ) : null}
            </>
          )}
        </div>

        <div className="equip-manage-card__side">
          <span className="equip-manage-card__rented">已租 {equipment.usedCount}</span>
          {rentalRate != null ? (
            <span className="equip-manage-card__rate">出租率 {rentalRate}%</span>
          ) : null}
        </div>
      </div>

      <div className="equip-manage-card__actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>
          编辑
        </button>
        <button type="button" className="btn btn-ghost btn-sm btn-danger-text" onClick={onDelete}>
          删除
        </button>
      </div>
    </article>
  )
}
