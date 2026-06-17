import type {
  BundleAddAvailability,
  EquCategory,
  Equipment,
  EquipmentBundle,
  EquipmentGroup,
  EquipmentInventoryStats,
  OAMaintenanceEquipmentItem,
  OAReport,
  OrderEquipmentLineItem,
} from '../types/models'
import { EQU_CATEGORIES } from '../types/models'
import { normalizeEntityId } from './ids'

export function maintenanceQuantity(
  equipmentId: string,
  oaReports: OAReport[],
  excludingReportId?: string | null
): number {
  let total = 0
  for (const report of oaReports) {
    if (excludingReportId && report.id === excludingReportId) continue
    if (
      report.category !== '维修' ||
      report.status !== '已通过' ||
      report.isExecuted
    ) {
      continue
    }
    const item = report.maintenanceEquipmentItems.find(
      (row) => row.equipmentId === equipmentId
    )
    if (item) total += item.quantity
  }
  return total
}

export function rentableStock(
  equipment: Equipment,
  oaReports: OAReport[],
  excludingReportId?: string | null
): number {
  return Math.max(
    0,
    equipment.stock -
      equipment.usedCount -
      maintenanceQuantity(equipment.id, oaReports, excludingReportId)
  )
}

export function maintenanceBlockedUnits(
  equipment: Equipment,
  oaReports: OAReport[],
  excludingReportId?: string | null
): number {
  return maintenanceQuantity(equipment.id, oaReports, excludingReportId)
}

export function inventoryStats(
  equipments: Equipment[],
  oaReports: OAReport[]
): EquipmentInventoryStats {
  return {
    totalUnits: equipments.reduce((sum, eq) => sum + eq.stock, 0),
    availableUnits: equipments.reduce(
      (sum, eq) => sum + rentableStock(eq, oaReports),
      0
    ),
    rentedUnits: equipments.reduce((sum, eq) => sum + eq.usedCount, 0),
    maintenanceUnits: equipments.reduce(
      (sum, eq) => sum + maintenanceBlockedUnits(eq, oaReports),
      0
    ),
  }
}

function rootEquipmentGroups(
  equipmentGroups: EquipmentGroup[],
  category: EquCategory
): EquipmentGroup[] {
  return equipmentGroups
    .filter((g) => g.parentId == null && g.category === category)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-CN'))
}

function childEquipmentGroups(
  equipmentGroups: EquipmentGroup[],
  parentId: string,
  category: EquCategory
): EquipmentGroup[] {
  return equipmentGroups
    .filter((g) => g.parentId === parentId && g.category === category)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-CN'))
}

function groupMatchesCategory(
  equipmentGroups: EquipmentGroup[],
  groupId: string,
  category: EquCategory
): boolean {
  return equipmentGroups.find((g) => g.id === groupId)?.category === category
}

/** Matches iOS DataManager.equipmentsOrderedLikeManagement(category:from:) */
export function equipmentsOrderedLikeManagement(
  category: EquCategory,
  pool: Equipment[],
  equipmentGroups: EquipmentGroup[]
): Equipment[] {
  const filtered = pool.filter((eq) => eq.category === category)
  const result: Equipment[] = []
  const seen = new Set<string>()

  const sortedInGroup = (groupId: string) =>
    filtered
      .filter((eq) => eq.groupId === groupId)
      .sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-CN')
      )

  const appendGroupTree = (groups: EquipmentGroup[]) => {
    for (const group of groups) {
      for (const eq of sortedInGroup(group.id)) {
        if (!seen.has(eq.id)) {
          result.push(eq)
          seen.add(eq.id)
        }
      }
      appendGroupTree(childEquipmentGroups(equipmentGroups, group.id, category))
    }
  }

  appendGroupTree(rootEquipmentGroups(equipmentGroups, category))

  const unknown = filtered
    .filter((eq) => {
      if (!eq.groupId) return false
      return !groupMatchesCategory(equipmentGroups, eq.groupId, category)
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-CN'))

  for (const eq of unknown) {
    if (!seen.has(eq.id)) {
      result.push(eq)
      seen.add(eq.id)
    }
  }

  const ungrouped = filtered
    .filter((eq) => eq.groupId == null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-CN'))

  for (const eq of ungrouped) {
    if (!seen.has(eq.id)) {
      result.push(eq)
      seen.add(eq.id)
    }
  }

  return result
}

export function equipmentsOrderedLikeManagementAll(
  pool: Equipment[],
  equipmentGroups: EquipmentGroup[]
): Equipment[] {
  return EQU_CATEGORIES.flatMap((category) =>
    equipmentsOrderedLikeManagement(category, pool, equipmentGroups)
  )
}

export interface OrderEquipmentFolderBatch {
  id: string
  folderLabel: string
  items: OrderEquipmentLineItem[]
}

export interface OrderEquipmentCategorySection {
  id: string
  categoryTitle: string
  folderBatches: OrderEquipmentFolderBatch[]
}

/** Matches iOS DataManager.orderedEquipmentItemsLikeManagement */
export function enrichOrderEquipmentItems(
  items: OrderEquipmentLineItem[],
  equipments: Equipment[]
): OrderEquipmentLineItem[] {
  if (items.length === 0 || equipments.length === 0) return items
  const byId = new Map(equipments.map((eq) => [eq.id.toLowerCase(), eq]))
  return items.map((item) => {
    const live = byId.get(item.equipment.id.toLowerCase())
    if (!live) return item
    return { ...item, equipment: live }
  })
}

function findEquipmentGroup(
  groupId: string,
  equipmentGroups: EquipmentGroup[]
): EquipmentGroup | undefined {
  const normalized = groupId.toLowerCase()
  return equipmentGroups.find(
    (g) => g.id === groupId || g.id.toLowerCase() === normalized
  )
}

/**
 * 订单详情分组：归并到「大类下的一层文件夹」，不再往下细分。
 * 例：图传/猛犸… →「图传」；配件/电池/… →「电池」
 */
function rollupFolderGroupForEquipment(
  equipment: Equipment,
  equipmentGroups: EquipmentGroup[]
): { id: string; label: string } {
  if (!equipment.groupId) {
    return { id: 'ungrouped', label: '未分组' }
  }
  const group = findEquipmentGroup(equipment.groupId, equipmentGroups)
  if (!group) {
    return { id: 'ungrouped', label: '未分组' }
  }

  if (!group.parentId) {
    return { id: group.id.toLowerCase(), label: group.name }
  }

  const parent = findEquipmentGroup(group.parentId, equipmentGroups)
  if (!parent) {
    return { id: group.id.toLowerCase(), label: group.name }
  }

  // 器材在根文件夹的子级 → 合并到根文件夹（图传类不再细分）
  if (!parent.parentId) {
    return { id: parent.id.toLowerCase(), label: parent.name }
  }

  // 更深层级 → 归并到根文件夹的直接子文件夹（如 配件/电池/… → 电池）
  let current = group
  while (current.parentId) {
    const p = findEquipmentGroup(current.parentId, equipmentGroups)
    if (!p) break
    const grandparent = p.parentId
      ? findEquipmentGroup(p.parentId, equipmentGroups)
      : undefined
    if (grandparent && !grandparent.parentId) {
      return { id: p.id.toLowerCase(), label: p.name }
    }
    if (!p.parentId) {
      return { id: p.id.toLowerCase(), label: p.name }
    }
    current = p
  }

  return { id: group.id.toLowerCase(), label: group.name }
}

export function orderedOrderEquipmentItemsLikeManagement(
  items: OrderEquipmentLineItem[],
  equipmentGroups: EquipmentGroup[]
): OrderEquipmentLineItem[] {
  if (items.length === 0) return items
  const itemMap = new Map(items.map((item) => [item.equipment.id, item]))
  return equipmentsOrderedLikeManagementAll(
    items.map((item) => item.equipment),
    equipmentGroups
  )
    .map((equipment) => itemMap.get(equipment.id))
    .filter((item): item is OrderEquipmentLineItem => item != null)
}

/** Matches iOS DataManager.groupedEquipmentItemsLikeManagement */
export function groupedOrderEquipmentItemsLikeManagement(
  items: OrderEquipmentLineItem[],
  equipmentGroups: EquipmentGroup[],
  equipments: Equipment[] = []
): OrderEquipmentCategorySection[] {
  const resolvedItems = enrichOrderEquipmentItems(items, equipments)
  const sorted = orderedOrderEquipmentItemsLikeManagement(resolvedItems, equipmentGroups)
  const sections: OrderEquipmentCategorySection[] = []

  for (const category of EQU_CATEGORIES) {
    const categoryItems = sorted.filter((item) => item.equipment.category === category)
    if (categoryItems.length === 0) continue

    const batchMap = new Map<string, OrderEquipmentFolderBatch>()
    const batchOrder: string[] = []

    for (const item of categoryItems) {
      const batch = rollupFolderGroupForEquipment(item.equipment, equipmentGroups)
      let folderBatch = batchMap.get(batch.id)
      if (!folderBatch) {
        folderBatch = { id: batch.id, folderLabel: batch.label, items: [] }
        batchMap.set(batch.id, folderBatch)
        batchOrder.push(batch.id)
      }
      folderBatch.items.push(item)
    }

    const folderBatches = batchOrder
      .map((batchId) => batchMap.get(batchId))
      .filter((batch): batch is OrderEquipmentFolderBatch => batch != null)

    sections.push({
      id: category,
      categoryTitle: category,
      folderBatches,
    })
  }

  return sections
}

export function bundleAddAvailability(
  bundleId: string,
  equipmentBundles: EquipmentBundle[],
  equipments: Equipment[],
  oaReports: OAReport[],
  selectedQuantities: Record<string, number> = {},
  extraReserved: Record<string, number> = {},
  equipmentById: Record<string, Equipment> = {}
): BundleAddAvailability {
  const bundle = equipmentBundles.find((b) => b.id === bundleId)
  if (!bundle) {
    return { equipments: [], canAdd: false, blockingReason: '套餐内暂无器材' }
  }

  const items = bundle.equipmentIds
    .map((eid) => equipmentById[eid] ?? equipments.find((eq) => eq.id === eid))
    .filter((eq): eq is Equipment => eq != null)

  if (items.length === 0) {
    return { equipments: [], canAdd: false, blockingReason: '套餐内暂无器材' }
  }

  const blockers: string[] = []
  for (const eq of items) {
    const live = equipmentById[eq.id] ?? eq
    const reserved = extraReserved[eq.id] ?? 0
    const selected = selectedQuantities[eq.id] ?? 0
    const available = rentableStock(live, oaReports) + reserved - selected
    if (available < 1) blockers.push(live.name)
  }

  if (blockers.length === 0) {
    return { equipments: items, canAdd: true, blockingReason: null }
  }

  return {
    equipments: items,
    canAdd: false,
    blockingReason: `库存不足：${blockers.join('、')}`,
  }
}

export function validateMaintenanceEquipmentItems(
  items: OAMaintenanceEquipmentItem[],
  equipments: Equipment[],
  oaReports: OAReport[],
  excludingReportId?: string | null
): string | null {
  const activeItems = items.filter((item) => item.quantity > 0)
  if (activeItems.length === 0) return '请至少选择一件维护器材'

  for (const item of activeItems) {
    const eq = equipments.find((row) => row.id === item.equipmentId)
    if (!eq) continue
    const maxQty = rentableStock(eq, oaReports, excludingReportId)
    if (item.quantity > maxQty) {
      return `「${eq.name}」最多可选 ${maxQty} 件`
    }
  }
  return null
}

export function equipmentsWithRecalculatedUsage(
  source: Equipment[],
  orders: { isReturned: boolean; equipmentItems: { equipment: Equipment; quantity: number }[] }[]
): Equipment[] {
  const items = source.map((eq) => ({ ...eq, usedCount: 0 }))
  const indexById = new Map(items.map((eq, index) => [normalizeEntityId(eq.id), index]))

  for (const order of orders) {
    if (order.isReturned) continue
    for (const item of order.equipmentItems) {
      const index = indexById.get(normalizeEntityId(item.equipment.id))
      if (index !== undefined) {
        items[index].usedCount += item.quantity
      }
    }
  }
  return items
}
