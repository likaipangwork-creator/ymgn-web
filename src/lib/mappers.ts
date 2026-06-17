import { parseSupabaseDate, toISOString } from './dates'
import { normalizeEntityId } from './ids'
import type {
  AppAdmin,
  AppUser,
  CameraCrew,
  Customer,
  EquCategory,
  Equipment,
  EquipmentBundle,
  EquipmentGroup,
  Introducer,
  OAMaintenanceEquipmentItem,
  OAReport,
  OAReportCategory,
  OAProcurementSubType,
  OAReportStatus,
  OrderEquipmentLineItem,
  PayStatus,
  PaymentRecord,
  RentalOrder,
} from '../types/models'
import {
  bundleCodeForBundle,
  groupedOrderEquipmentLineItems,
  packageCodeForGroup,
} from '../types/models'

// ── DB row types (snake_case from Supabase) ──────────────────────────────────

export interface EquipmentGroupRow {
  id: string
  name: string
  sort_order?: number | null
  is_default?: boolean | null
  parent_id?: string | null
  category?: string | null
  package_code?: string | null
}

export interface EquipmentBundleRow {
  id: string
  name: string
  note?: string | null
  package_code?: string | null
  equipment_ids?: string[] | null
  sort_order?: number | null
}

export interface EquipmentRow {
  id: string
  name: string
  stock: number
  used_count?: number | null
  category: string
  barcode: string
  group_id?: string | null
  sort_order?: number | null
  photo_share_code?: string | null
}

export interface CustomerRow {
  id: string
  name: string
  phone: string
  note: string
}

export interface RentalOrderEquipmentItemRow {
  equipment_id: string
  equipment_name: string
  quantity: number
}

export interface RentalOrderRow {
  id: string
  customer: CustomerRow
  equipments?: EquipmentRow[] | null
  equipment_items?: RentalOrderEquipmentItemRow[] | null
  rental_days?: number | null
  total_price?: number | null
  deposit?: number | null
  rent_date?: string | null
  end_date?: string | null
  is_returned?: boolean | null
  return_date?: string | null
  confirm_by?: string | null
  return_note?: string | null
  create_user?: string | null
  modify_user?: string | null
  modify_date?: string | null
  pay_status?: string | null
  pay_time?: string | null
  camera_crew_name?: string | null
  introducer_name?: string | null
  order_note?: string | null
}

export interface CameraCrewRow {
  id: string
  name: string
  phone: string
  note: string
}

export interface IntroducerRow {
  id: string
  name: string
  phone: string
  note: string
}

export interface OAMaintenanceEquipmentItemRow {
  equipment_id: string
  quantity: number
}

export interface OAReportRow {
  id: string
  category: string
  procurement_sub_type?: string | null
  title: string
  detail: string
  submitter_username: string
  executor_username?: string | null
  status: string
  approved_by?: string | null
  created_at?: string | null
  approved_at?: string | null
  is_executed?: boolean | null
  executed_at?: string | null
  executed_by?: string | null
  maintenance_equipment_ids?: string | null
}

export interface AppAdminRow {
  id: string
  username: string
  created_by?: string | null
  created_at?: string | null
}

export interface AppUserRow {
  id: string
  username: string
  email: string
  registered_at?: string | null
  last_login_at?: string | null
}

export interface PaymentRecordRow {
  id: string
  order_id: string
  amount: number
  pay_time: string
  pay_type: string
  note?: string | null
  created_at?: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseEquCategory(raw: string | null | undefined): EquCategory {
  return raw === '灯光器材' ? '灯光器材' : '摄影器材'
}

function parseGroupId(groupIdString: string | null | undefined): string | null {
  if (!groupIdString || groupIdString === '') return null
  return normalizeEntityId(groupIdString)
}

function encodeMaintenanceEquipment(items: OAMaintenanceEquipmentItem[]): string {
  const payload = items
    .filter((item) => item.quantity > 0)
    .map((item) => ({ equipment_id: item.equipmentId, quantity: item.quantity }))
  return JSON.stringify(payload)
}

function decodeMaintenanceEquipment(raw: string | null | undefined): OAMaintenanceEquipmentItem[] {
  if (!raw || raw === '') return []
  try {
    const data = JSON.parse(raw) as unknown
    if (Array.isArray(data)) {
      if (data.length > 0 && typeof data[0] === 'string') {
        const counts = new Map<string, number>()
        for (const value of data) {
          if (typeof value !== 'string') continue
          counts.set(value, (counts.get(value) ?? 0) + 1)
        }
        return [...counts.entries()].map(([equipmentId, quantity]) => ({
          equipmentId,
          quantity,
        }))
      }
      return data
        .map((row) => {
          const item = row as OAMaintenanceEquipmentItemRow
          if (!item.equipment_id || item.quantity <= 0) return null
          return { equipmentId: item.equipment_id, quantity: item.quantity }
        })
        .filter((item): item is OAMaintenanceEquipmentItem => item != null)
    }
  } catch {
    return []
  }
  return []
}

function parsePayStatus(raw: string | null | undefined): PayStatus {
  if (raw === '已付款') return '已付款'
  return '待付款'
}

// ── Equipment ────────────────────────────────────────────────────────────────

export function equipmentFromRow(row: EquipmentRow): Equipment {
  const shareCode = row.photo_share_code?.trim()
  return {
    id: normalizeEntityId(row.id),
    name: row.name.trim(),
    stock: row.stock,
    usedCount: row.used_count ?? 0,
    category: parseEquCategory(row.category),
    barcode: row.barcode,
    groupId: parseGroupId(row.group_id),
    sortOrder: row.sort_order ?? 0,
    photoShareCode: shareCode ? shareCode : null,
  }
}

export function equipmentToRow(equipment: Equipment): EquipmentRow {
  return {
    id: equipment.id,
    name: equipment.name,
    stock: equipment.stock,
    used_count: equipment.usedCount,
    category: equipment.category,
    barcode: equipment.barcode,
    group_id: equipment.groupId,
    sort_order: equipment.sortOrder,
    photo_share_code: equipment.photoShareCode,
  }
}

// ── Equipment groups ───────────────────────────────────────────────────────────

export function equipmentGroupFromRow(row: EquipmentGroupRow): EquipmentGroup {
  const groupId = row.id
  const packageCode =
    row.package_code && row.package_code !== ''
      ? row.package_code
      : packageCodeForGroup(groupId)
  return {
    id: groupId,
    name: row.name,
    sortOrder: row.sort_order ?? 0,
    isDefault: row.is_default ?? false,
    parentId: row.parent_id && row.parent_id !== '' ? row.parent_id : null,
    category: parseEquCategory(row.category),
    packageCode,
  }
}

export function equipmentGroupToRow(group: EquipmentGroup): EquipmentGroupRow {
  return {
    id: group.id,
    name: group.name,
    sort_order: group.sortOrder,
    is_default: group.isDefault,
    parent_id: group.parentId,
    category: group.category,
    package_code: group.packageCode || null,
  }
}

// ── Equipment bundles ──────────────────────────────────────────────────────────

export function equipmentBundleFromRow(row: EquipmentBundleRow): EquipmentBundle {
  const packageCode =
    row.package_code && row.package_code !== ''
      ? row.package_code
      : bundleCodeForBundle(row.id)
  return {
    id: row.id,
    name: row.name,
    note: row.note ?? '',
    packageCode,
    equipmentIds: row.equipment_ids ?? [],
    sortOrder: row.sort_order ?? 0,
  }
}

export function equipmentBundleToRow(bundle: EquipmentBundle): EquipmentBundleRow {
  return {
    id: bundle.id,
    name: bundle.name,
    note: bundle.note,
    package_code: bundle.packageCode,
    equipment_ids: bundle.equipmentIds,
    sort_order: bundle.sortOrder,
  }
}

// ── Customers / crews / introducers ──────────────────────────────────────────

export function customerFromRow(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    note: row.note,
  }
}

export function customerToRow(customer: Customer): CustomerRow {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    note: customer.note,
  }
}

export function cameraCrewFromRow(row: CameraCrewRow): CameraCrew {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    note: row.note,
  }
}

export function cameraCrewToRow(crew: CameraCrew): CameraCrewRow {
  return {
    id: crew.id,
    name: crew.name,
    phone: crew.phone,
    note: crew.note,
  }
}

export function introducerFromRow(row: IntroducerRow): Introducer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    note: row.note,
  }
}

export function introducerToRow(introducer: Introducer): IntroducerRow {
  return {
    id: introducer.id,
    name: introducer.name,
    phone: introducer.phone,
    note: introducer.note,
  }
}

// ── Rental orders ──────────────────────────────────────────────────────────────

export function rentalOrderFromRow(row: RentalOrderRow): RentalOrder {
  const loadedEquipments = (row.equipments ?? []).map(equipmentFromRow)
  let items: OrderEquipmentLineItem[]

  if (row.equipment_items && row.equipment_items.length > 0) {
    const grouped = new Map<string, OrderEquipmentLineItem>()
    for (const itemRow of row.equipment_items) {
      const equipmentId = normalizeEntityId(itemRow.equipment_id)
      const eq =
        loadedEquipments.find((e) => e.id === equipmentId) ??
        ({
          id: equipmentId,
          name: itemRow.equipment_name,
          stock: Math.max(1, itemRow.quantity),
          usedCount: 0,
          category: '摄影器材' as EquCategory,
          barcode: '',
          groupId: null,
          sortOrder: 0,
          photoShareCode: null,
        } satisfies Equipment)
      const qty = Math.max(1, itemRow.quantity)
      const existing = grouped.get(eq.id)
      if (existing) {
        grouped.set(eq.id, { equipment: eq, quantity: existing.quantity + qty })
      } else {
        grouped.set(eq.id, { equipment: eq, quantity: qty })
      }
    }
    items = [...grouped.values()]
  } else {
    items = groupedOrderEquipmentLineItems(loadedEquipments)
  }

  return {
    id: row.id,
    customer: customerFromRow(row.customer),
    equipmentItems: items,
    rentalDays: row.rental_days ?? 1,
    totalPrice: row.total_price ?? 0,
    deposit: row.deposit ?? 0,
    rentDate: parseSupabaseDate(row.rent_date) ?? new Date(),
    endDate: parseSupabaseDate(row.end_date) ?? new Date(),
    isReturned: row.is_returned ?? false,
    returnDate: parseSupabaseDate(row.return_date),
    confirmBy: row.confirm_by ?? '',
    returnNote: row.return_note ?? '',
    modifyUser: row.modify_user ?? null,
    modifyDate: parseSupabaseDate(row.modify_date),
    payStatus: parsePayStatus(row.pay_status),
    payTime: parseSupabaseDate(row.pay_time),
    cameraCrewName: row.camera_crew_name ?? '',
    introducerName: row.introducer_name ?? '',
    orderNote: row.order_note ?? '',
  }
}

export function rentalOrderToRow(order: RentalOrder): RentalOrderRow {
  return {
    id: order.id,
    customer: customerToRow(order.customer),
    equipments: order.equipmentItems.map((item) => equipmentToRow(item.equipment)),
    equipment_items: order.equipmentItems.map((item) => ({
      equipment_id: item.equipment.id,
      equipment_name: item.equipment.name,
      quantity: item.quantity,
    })),
    rental_days: order.rentalDays,
    total_price: order.totalPrice,
    deposit: order.deposit,
    rent_date: toISOString(order.rentDate),
    end_date: toISOString(order.endDate),
    is_returned: order.isReturned,
    return_date: order.returnDate ? toISOString(order.returnDate) : null,
    confirm_by: order.confirmBy,
    return_note: order.returnNote,
    create_user: 'app_user',
    modify_user: order.modifyUser,
    modify_date: order.modifyDate ? toISOString(order.modifyDate) : null,
    pay_status: order.payStatus,
    pay_time: order.payTime ? toISOString(order.payTime) : null,
    camera_crew_name: order.cameraCrewName,
    introducer_name: order.introducerName,
    order_note: order.orderNote || null,
  }
}

// ── OA reports ───────────────────────────────────────────────────────────────

export function oaReportFromRow(row: OAReportRow): OAReport {
  const category = (row.category as OAReportCategory) || '维修'
  const subType = row.procurement_sub_type as OAProcurementSubType | null
  const executor = row.executor_username?.trim()
  return {
    id: row.id,
    category,
    procurementSubType: category === '采购' ? subType : null,
    title: row.title,
    detail: row.detail,
    submitterUsername: row.submitter_username,
    executorUsername: executor ? executor : '',
    createdAt: parseSupabaseDate(row.created_at) ?? new Date(),
    status: (row.status as OAReportStatus) || '审核中',
    approvedBy: row.approved_by ?? null,
    approvedAt: parseSupabaseDate(row.approved_at),
    isExecuted: row.is_executed ?? false,
    executedAt: parseSupabaseDate(row.executed_at),
    executedBy: row.executed_by ?? null,
    maintenanceEquipmentItems: decodeMaintenanceEquipment(row.maintenance_equipment_ids),
  }
}

export function oaReportToRow(report: OAReport): OAReportRow {
  return {
    id: report.id,
    category: report.category,
    procurement_sub_type:
      report.category === '采购' ? report.procurementSubType : null,
    title: report.title,
    detail: report.detail,
    submitter_username: report.submitterUsername,
    executor_username: report.executorUsername,
    status: report.status,
    approved_by: report.approvedBy,
    created_at: toISOString(report.createdAt),
    approved_at: report.approvedAt ? toISOString(report.approvedAt) : null,
    is_executed: report.isExecuted,
    executed_at: report.executedAt ? toISOString(report.executedAt) : null,
    executed_by: report.executedBy,
    maintenance_equipment_ids: encodeMaintenanceEquipment(
      report.maintenanceEquipmentItems
    ),
  }
}

// ── Admins / users / payments ────────────────────────────────────────────────

export function appAdminFromRow(row: AppAdminRow): AppAdmin {
  return {
    id: row.id,
    username: row.username,
    createdBy: row.created_by ?? null,
    createdAt: parseSupabaseDate(row.created_at),
  }
}

export function appAdminToRow(admin: AppAdmin): AppAdminRow {
  return {
    id: admin.id,
    username: admin.username,
    created_by: admin.createdBy,
    created_at: admin.createdAt ? toISOString(admin.createdAt) : null,
  }
}

export function appUserFromRow(row: AppUserRow): AppUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    registeredAt: parseSupabaseDate(row.registered_at),
    lastLoginAt: parseSupabaseDate(row.last_login_at),
  }
}

export function appUserToRow(user: AppUser): AppUserRow {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    registered_at: user.registeredAt ? toISOString(user.registeredAt) : null,
    last_login_at: user.lastLoginAt ? toISOString(user.lastLoginAt) : null,
  }
}

export function paymentRecordFromRow(row: PaymentRecordRow): PaymentRecord {
  return {
    id: row.id,
    amount: row.amount,
    time: parseSupabaseDate(row.pay_time) ?? new Date(),
    type: row.pay_type,
    note: row.note ?? null,
  }
}

export function paymentRecordToRow(
  record: PaymentRecord,
  orderId: string
): PaymentRecordRow {
  return {
    id: record.id,
    order_id: orderId,
    amount: record.amount,
    pay_time: toISOString(record.time),
    pay_type: record.type,
    note: record.note,
    created_at: toISOString(new Date()),
  }
}
