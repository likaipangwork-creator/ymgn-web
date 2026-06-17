export type EquCategory = '摄影器材' | '灯光器材'

export const EQU_CATEGORIES: EquCategory[] = ['摄影器材', '灯光器材']

export type PayStatus = '待付款' | '已付款'

export type OAReportCategory = '维修' | '采购'

export type OAProcurementSubType = '愿望单' | '耗材采购'

export type OAReportStatus = '审核中' | '已通过' | '未通过'

export type AppUserRole = '超级管理员' | '管理员' | '普通用户'

export interface OAMaintenanceEquipmentItem {
  equipmentId: string
  quantity: number
}

export interface OAReport {
  id: string
  category: OAReportCategory
  procurementSubType: OAProcurementSubType | null
  title: string
  detail: string
  submitterUsername: string
  executorUsername: string
  createdAt: Date
  status: OAReportStatus
  approvedBy: string | null
  approvedAt: Date | null
  isExecuted: boolean
  executedAt: Date | null
  executedBy: string | null
  maintenanceEquipmentItems: OAMaintenanceEquipmentItem[]
}

export function oaReportCategoryLabel(report: OAReport): string {
  if (report.category === '采购' && report.procurementSubType) {
    return `${report.category} · ${report.procurementSubType}`
  }
  return report.category
}

export function oaReportCardStatusBadgeText(report: OAReport): string {
  if (report.status === '已通过' && report.isExecuted) return '已执行'
  return report.status
}

export function oaReportCardExecutionStatusLabel(report: OAReport): string | null {
  if (report.status === '已通过' && !report.isExecuted) return '待执行'
  return null
}

export function oaReportDetailExecutionStatusLabel(report: OAReport): string {
  if (report.status !== '已通过') return ''
  if (report.isExecuted) {
    const name = report.executedBy?.trim() ?? ''
    return name ? `${name} 已执行` : '已执行'
  }
  return '待执行'
}

export interface AppAdmin {
  id: string
  username: string
  createdBy: string | null
  createdAt: Date | null
}

export interface AppUser {
  id: string
  username: string
  email: string
  registeredAt: Date | null
  lastLoginAt: Date | null
}

export function appUserRole(
  user: AppUser,
  adminUsernames: Set<string>,
  superAdminUsername: string
): AppUserRole {
  if (user.username === superAdminUsername) return '超级管理员'
  if (adminUsernames.has(user.username)) return '管理员'
  return '普通用户'
}

export interface CameraCrew {
  id: string
  name: string
  phone: string
  note: string
}

export interface Introducer {
  id: string
  name: string
  phone: string
  note: string
}

export const PACKAGE_CODE_PREFIX = 'PKG-'
export const BUNDLE_CODE_PREFIX = 'SET-'

export function packageCodeForGroup(id: string): string {
  const raw = id.replace(/-/g, '').slice(0, 8).toUpperCase()
  return `${PACKAGE_CODE_PREFIX}${raw}`
}

export function bundleCodeForBundle(id: string): string {
  const raw = id.replace(/-/g, '').slice(0, 8).toUpperCase()
  return `${BUNDLE_CODE_PREFIX}${raw}`
}

export function isPackageCode(code: string): boolean {
  return code.trim().toUpperCase().startsWith(PACKAGE_CODE_PREFIX)
}

export function isBundleCode(code: string): boolean {
  return code.trim().toUpperCase().startsWith(BUNDLE_CODE_PREFIX)
}

export interface EquipmentBundle {
  id: string
  name: string
  note: string
  packageCode: string
  equipmentIds: string[]
  sortOrder: number
}

export interface BundleAddAvailability {
  equipments: Equipment[]
  canAdd: boolean
  blockingReason: string | null
}

export interface EquipmentGroup {
  id: string
  name: string
  sortOrder: number
  isDefault: boolean
  parentId: string | null
  category: EquCategory
  packageCode: string
}

export interface Equipment {
  id: string
  name: string
  stock: number
  usedCount: number
  category: EquCategory
  barcode: string
  groupId: string | null
  sortOrder: number
  photoShareCode: string | null
}

export function equipmentAvailableStock(equipment: Equipment): number {
  return equipment.stock - equipment.usedCount
}

export interface OrderEquipmentLineItem {
  equipment: Equipment
  quantity: number
}

export function orderEquipmentLineItemDisplayName(item: OrderEquipmentLineItem): string {
  return item.quantity > 1 ? `${item.equipment.name} × ${item.quantity}` : item.equipment.name
}

export function groupedOrderEquipmentLineItems(equipments: Equipment[]): OrderEquipmentLineItem[] {
  const order: string[] = []
  const counts = new Map<string, number>()
  const byId = new Map<string, Equipment>()
  for (const eq of equipments) {
    if (!counts.has(eq.id)) order.push(eq.id)
    counts.set(eq.id, (counts.get(eq.id) ?? 0) + 1)
    byId.set(eq.id, eq)
  }
  return order
    .map((id) => {
      const eq = byId.get(id)
      const count = counts.get(id)
      if (!eq || count == null) return null
      return { equipment: eq, quantity: count }
    })
    .filter((item): item is OrderEquipmentLineItem => item != null)
}

export function orderEquipmentQuantityMap(
  items: OrderEquipmentLineItem[]
): Map<string, number> {
  return new Map(items.map((item) => [item.equipment.id, item.quantity]))
}

export interface Customer {
  id: string
  name: string
  phone: string
  note: string
}

export interface RentalOrder {
  id: string
  customer: Customer
  equipmentItems: OrderEquipmentLineItem[]
  rentalDays: number
  totalPrice: number
  deposit: number
  rentDate: Date
  endDate: Date
  isReturned: boolean
  returnDate: Date | null
  confirmBy: string
  returnNote: string
  modifyUser: string | null
  modifyDate: Date | null
  payStatus: PayStatus
  payTime: Date | null
  cameraCrewName: string
  introducerName: string
  orderNote: string
}

export function rentalOrderTotalEquipmentUnitCount(order: RentalOrder): number {
  return order.equipmentItems.reduce((sum, item) => sum + item.quantity, 0)
}

export interface PaymentRecord {
  id: string
  amount: number
  time: Date
  type: string
  note: string | null
}

export interface EquipmentInventoryStats {
  totalUnits: number
  availableUnits: number
  rentedUnits: number
  maintenanceUnits: number
}
