import { SUPER_ADMIN_USERNAME, usernameFromAuthUser } from '../lib/auth'
import { toISOString } from '../lib/dates'
import {
  bundleAddAvailability as computeBundleAddAvailability,
  equipmentsOrderedLikeManagement as orderEquipmentsLikeManagement,
  equipmentsOrderedLikeManagementAll as orderEquipmentsLikeManagementAll,
  equipmentsWithRecalculatedUsage,
  inventoryStats as computeInventoryStats,
  maintenanceQuantity as computeMaintenanceQuantity,
  rentableStock as computeRentableStock,
  validateMaintenanceEquipmentItems as computeValidateMaintenanceItems,
} from '../lib/inventory'
import {
  appAdminFromRow,
  appAdminToRow,
  appUserFromRow,
  cameraCrewFromRow,
  cameraCrewToRow,
  customerFromRow,
  customerToRow,
  equipmentBundleFromRow,
  equipmentBundleToRow,
  equipmentFromRow,
  equipmentGroupFromRow,
  equipmentGroupToRow,
  equipmentToRow,
  introducerFromRow,
  introducerToRow,
  oaReportFromRow,
  oaReportToRow,
  paymentRecordFromRow,
  paymentRecordToRow,
  rentalOrderFromRow,
  rentalOrderToRow,
  type AppAdminRow,
  type AppUserRow,
  type CameraCrewRow,
  type CustomerRow,
  type EquipmentBundleRow,
  type EquipmentGroupRow,
  type EquipmentRow,
  type IntroducerRow,
  type OAReportRow,
  type PaymentRecordRow,
  type RentalOrderRow,
} from '../lib/mappers'
import { equipmentMatchesSearch as searchEquipmentMatches } from '../lib/search'
import { supabase } from '../lib/supabase'
import type {
  AppAdmin,
  AppUser,
  CameraCrew,
  Customer,
  EquCategory,
  Equipment,
  EquipmentBundle,
  EquipmentGroup,
  EquipmentInventoryStats,
  Introducer,
  OAMaintenanceEquipmentItem,
  OAReport,
  OAReportCategory,
  OAProcurementSubType,
  PayStatus,
  PaymentRecord,
  RentalOrder,
} from '../types/models'
import {
  bundleCodeForBundle,
  orderEquipmentQuantityMap,
  packageCodeForGroup,
} from '../types/models'

type Listener = () => void

const LS_KEYS = {
  paymentRecords: (orderId: string) => `payment_records_${orderId}`,
  equipmentBundles: 'equipment_bundles_local',
  equipmentBundleNotes: 'equipment_bundle_notes_local',
  localAppAdmins: 'app_admin_usernames_local',
  removedAppAdmins: 'removed_app_admin_usernames',
  deletedGroupIds: 'deleted_equipment_group_ids',
  groupCategoryOverrides: 'equipment_group_category_overrides',
  groupSortOrders: 'equipment_group_sort_orders',
  groupPackageCodes: 'equipment_group_package_codes',
  equipmentSortOrders: 'equipment_sort_orders',
  photoShareCodes: 'equipment_photo_share_codes_v1',
  equipmentDBSupportsSortOrder: 'equipment_db_supports_sort_order',
  equipmentDBSupportsPhotoShareCode: 'equipment_db_supports_photo_share_code',
  equipmentGroupsDBSupportsCategory: 'equipment_groups_db_supports_category',
  equipmentGroupsDBSupportsParentId: 'equipment_groups_db_supports_parent_id',
  equipmentGroupsDBSupportsPackageCode: 'equipment_groups_db_supports_package_code',
  equipmentBundlesDBSupportsNote: 'equipment_bundles_db_supports_note',
} as const

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

function readBool(key: string, defaultValue: boolean): boolean {
  const raw = localStorage.getItem(key)
  if (raw == null) return defaultValue
  return raw === 'true'
}

function writeBool(key: string, value: boolean): void {
  localStorage.setItem(key, String(value))
}

function isMissingColumnError(error: unknown, column: string): boolean {
  const text = String(error)
  return text.includes('PGRST204') && text.includes(column)
}

export class DataStore {
  equipments: Equipment[] = []
  equipmentGroups: EquipmentGroup[] = []
  equipmentBundles: EquipmentBundle[] = []
  customers: Customer[] = []
  orders: RentalOrder[] = []
  oaReports: OAReport[] = []
  crews: CameraCrew[] = []
  introducers: Introducer[] = []
  appAdmins: AppAdmin[] = []
  appUsers: AppUser[] = []
  isSyncing = false
  lastSyncTime: Date | null = null
  syncProgress = ''
  loadError: string | null = null
  /** 每次 notify 递增，供 React 订阅刷新 */
  revision = 0

  private listeners = new Set<Listener>()
  private autoRefreshTimer: ReturnType<typeof setInterval> | null = null
  private initialLoadInFlight: Promise<void> | null = null

  private equipmentDBSupportsSortOrder = readBool(
    LS_KEYS.equipmentDBSupportsSortOrder,
    true
  )
  private equipmentDBSupportsPhotoShareCode = readBool(
    LS_KEYS.equipmentDBSupportsPhotoShareCode,
    true
  )
  private equipmentGroupsDBSupportsCategory = readBool(
    LS_KEYS.equipmentGroupsDBSupportsCategory,
    true
  )
  private equipmentBundlesDBSupportsNote = readBool(
    LS_KEYS.equipmentBundlesDBSupportsNote,
    true
  )

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    this.revision += 1
    for (const listener of this.listeners) listener()
  }

  private setSyncing(value: boolean): void {
    this.isSyncing = value
    this.notify()
  }

  startAutoRefresh(intervalMs = 60_000): void {
    this.stopAutoRefresh()
    this.autoRefreshTimer = setInterval(() => {
      void this.syncData()
    }, intervalMs)
  }

  stopAutoRefresh(): void {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer)
      this.autoRefreshTimer = null
    }
  }

  /** 退出登录时清空内存数据，避免下一账号看到残留 */
  clearAll(): void {
    this.stopAutoRefresh()
    this.equipments = []
    this.equipmentGroups = []
    this.equipmentBundles = []
    this.customers = []
    this.orders = []
    this.oaReports = []
    this.crews = []
    this.introducers = []
    this.appAdmins = []
    this.appUsers = []
    this.isSyncing = false
    this.lastSyncTime = null
    this.syncProgress = ''
    this.loadError = null
    this.initialLoadInFlight = null
    this.notify()
  }

  // ── Load orchestration ─────────────────────────────────────────────────────

  async initialLoad(): Promise<void> {
    if (this.initialLoadInFlight) return this.initialLoadInFlight
    this.initialLoadInFlight = this.performInitialLoad()
    try {
      await this.initialLoadInFlight
    } finally {
      this.initialLoadInFlight = null
    }
  }

  private async performInitialLoad(): Promise<void> {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      this.loadError = '未检测到登录会话，请重新登录后再同步'
      this.notify()
      return
    }

    this.setSyncing(true)
    this.loadError = null
    const loadErrors: string[] = []
    try {
      await this.loadEquipmentGroups()
      if (this.equipmentGroups.length === 0) {
        const groupProbe = await supabase.from('equipment_groups').select('id', { count: 'exact', head: true })
        if (groupProbe.error) loadErrors.push(`分组: ${groupProbe.error.message}`)
      }
      await this.migrateLegacyPackageCodesIfNeeded()
      await this.loadEquipmentBundles()
      await this.migrateLegacyBundleCodesIfNeeded()
      await Promise.all([
        this.loadCustomers(),
        this.loadOrders(),
        this.loadOAReports(),
        this.loadCrews(),
        this.loadIntroducers(),
      ])
      await this.loadPaymentRecordsForAllOrders()
      const loaded = await this.fetchEquipmentsFromCloud()
      if (loaded) {
        this.commitEquipments(loaded)
      } else {
        loadErrors.push('器材列表加载失败')
        await this.updateEquipmentUsage()
      }
      await this.probeEquipmentGroupsSchema()
      await this.probeEquipmentsSchema()
      await this.migrateLegacyGroupCategoriesIfNeeded()
      await this.loadAppAdmins()
      this.lastSyncTime = new Date()

      if (import.meta.env.DEV) {
        console.info('[dataStore] 加载完成', {
          equipments: this.equipments.length,
          orders: this.orders.length,
          customers: this.customers.length,
          groups: this.equipmentGroups.length,
        })
      }

      if (
        this.equipments.length === 0 &&
        this.orders.length === 0 &&
        this.customers.length === 0
      ) {
        const detail = loadErrors.length > 0 ? `（${loadErrors.join('；')}）` : ''
        this.loadError =
          `未拉取到业务数据${detail}。请点右上角「同步」重试，或退出后重新登录。`
      } else if (loadErrors.length > 0) {
        this.loadError = `部分数据加载失败：${loadErrors.join('；')}`
      }
      this.notify()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.loadError = `数据加载失败：${message}`
      this.notify()
    } finally {
      this.setSyncing(false)
    }
  }

  async syncData(): Promise<void> {
    if (this.isSyncing) return
    this.setSyncing(true)
    try {
      await Promise.all([
        this.loadOrders(),
        this.loadOAReports(),
        this.loadPaymentRecordsForAllOrders(),
        this.loadEquipmentBundles(),
      ])
      await this.updateEquipmentUsage()
      this.lastSyncTime = new Date()
    } finally {
      this.setSyncing(false)
    }
  }

  async fullRefresh(): Promise<void> {
    if (this.isSyncing) return
    this.setSyncing(true)
    try {
      await this.loadEquipmentGroups()
      await this.migrateLegacyPackageCodesIfNeeded()
      await this.loadEquipmentBundles()
      await this.migrateLegacyBundleCodesIfNeeded()
      await this.loadCustomers()
      await this.loadOrders()
      await this.loadOAReports()
      await this.loadCrews()
      await this.loadIntroducers()
      await this.loadPaymentRecordsForAllOrders()
      const loaded = await this.fetchEquipmentsFromCloud()
      if (loaded) {
        this.commitEquipments(loaded)
      } else {
        await this.updateEquipmentUsage()
      }
      await this.probeEquipmentGroupsSchema()
      await this.probeEquipmentsSchema()
      await this.migrateLegacyGroupCategoriesIfNeeded()
      await this.loadAppAdmins()
      this.lastSyncTime = new Date()
    } finally {
      this.setSyncing(false)
    }
  }

  // ── Inventory helpers (delegate to pure lib) ─────────────────────────────

  maintenanceQuantity(equipmentId: string, excludingReportId?: string | null): number {
    return computeMaintenanceQuantity(equipmentId, this.oaReports, excludingReportId)
  }

  rentableStock(equipment: Equipment, excludingReportId?: string | null): number {
    return computeRentableStock(equipment, this.oaReports, excludingReportId)
  }

  inventoryStats(forEquipments?: Equipment[]): EquipmentInventoryStats {
    return computeInventoryStats(forEquipments ?? this.equipments, this.oaReports)
  }

  validateMaintenanceEquipmentItems(
    items: OAMaintenanceEquipmentItem[],
    excludingReportId?: string | null
  ): string | null {
    return computeValidateMaintenanceItems(
      items,
      this.equipments,
      this.oaReports,
      excludingReportId
    )
  }

  bundleAddAvailability(
    bundleId: string,
    selectedQuantities: Record<string, number> = {},
    extraReserved: Record<string, number> = {},
    equipmentById: Record<string, Equipment> = {}
  ) {
    return computeBundleAddAvailability(
      bundleId,
      this.equipmentBundles,
      this.equipments,
      this.oaReports,
      selectedQuantities,
      extraReserved,
      equipmentById
    )
  }

  equipmentsOrderedLikeManagement(
    category: EquCategory,
    pool: Equipment[]
  ): Equipment[] {
    return orderEquipmentsLikeManagement(category, pool, this.equipmentGroups)
  }

  equipmentsOrderedLikeManagementAll(pool: Equipment[]): Equipment[] {
    return orderEquipmentsLikeManagementAll(pool, this.equipmentGroups)
  }

  equipment(forId: string): Equipment | undefined {
    return this.equipments.find((eq) => eq.id === forId)
  }

  // ── Equipment groups ─────────────────────────────────────────────────────

  async loadEquipmentGroups(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('equipment_groups')
        .select('*')
        .order('sort_order', { ascending: true })
      if (error) throw error
      let groups = ((data ?? []) as EquipmentGroupRow[]).map(equipmentGroupFromRow)
      const tombstones = new Set(readJson<string[]>(LS_KEYS.deletedGroupIds, []))
      if (tombstones.size > 0) {
        groups = groups.filter((g) => !tombstones.has(g.id))
      }
      this.equipmentGroups = groups
      this.applyLocalGroupCategoryOverrides()
      this.applyLocalGroupSortOrders()
      this.applyLocalGroupPackageCodes()
      this.notify()
    } catch (error) {
      console.error('加载器材分组失败', error)
    }
  }

  async saveEquipmentGroups(groups?: EquipmentGroup[]): Promise<void> {
    const targets = groups ?? this.equipmentGroups
    if (targets.length === 0) return
    for (const group of targets) {
      await this.upsertEquipmentGroup(group)
    }
    this.notify()
  }

  private async upsertEquipmentGroup(group: EquipmentGroup): Promise<void> {
    this.persistGroupCategory(group.id, group.category)
    if (group.packageCode) this.persistGroupPackageCode(group.id, group.packageCode)
    try {
      const payload = equipmentGroupToRow(group)
      const { error } = await supabase.from('equipment_groups').upsert(payload)
      if (error) throw error
    } catch (error) {
      if (isMissingColumnError(error, 'category') && this.equipmentGroupsDBSupportsCategory) {
        this.equipmentGroupsDBSupportsCategory = false
        writeBool(LS_KEYS.equipmentGroupsDBSupportsCategory, false)
        await this.upsertEquipmentGroup(group)
        return
      }
      console.error('保存分组失败', error)
    }
  }

  async createEquipmentGroup(
    name: string,
    category: EquCategory,
    parentId: string | null = null
  ): Promise<EquipmentGroup | null> {
    let resolvedCategory = category
    if (parentId) {
      const parent = this.equipmentGroups.find((g) => g.id === parentId)
      if (parent) resolvedCategory = parent.category
    }
    const siblings = this.equipmentGroups.filter(
      (g) => g.parentId === parentId && g.category === resolvedCategory
    )
    const newGroup: EquipmentGroup = {
      id: crypto.randomUUID(),
      name,
      sortOrder: siblings.length,
      isDefault: false,
      parentId,
      category: resolvedCategory,
      packageCode: '',
    }
    newGroup.packageCode = packageCodeForGroup(newGroup.id)
    this.equipmentGroups.push(newGroup)
    this.persistGroupCategory(newGroup.id, newGroup.category)
    this.persistGroupPackageCode(newGroup.id, newGroup.packageCode)
    await this.saveEquipmentGroups([newGroup])
    this.notify()
    return newGroup
  }

  async updateEquipmentGroup(group: EquipmentGroup): Promise<void> {
    const index = this.equipmentGroups.findIndex((g) => g.id === group.id)
    if (index < 0) return
    this.equipmentGroups[index] = group
    await this.saveEquipmentGroups([group])
    this.notify()
  }

  async deleteEquipmentGroup(id: string): Promise<void> {
    const deletedGroup = this.equipmentGroups.find((g) => g.id === id)
    if (!deletedGroup) return
    const deletedParentId = deletedGroup.parentId

    for (const group of this.equipmentGroups) {
      if (group.parentId === id) group.parentId = deletedParentId
    }

    const equipmentsToUpdate: Equipment[] = []
    for (const eq of this.equipments) {
      if (eq.groupId === id) {
        eq.groupId = null
        equipmentsToUpdate.push(eq)
      }
    }
    for (const equipment of equipmentsToUpdate) {
      await this.saveSingleEquipment(equipment)
    }

    try {
      await supabase.from('equipment_groups').delete().eq('id', id)
    } catch (error) {
      console.error('云端删除文件夹失败', error)
    }

    const tombstones = new Set(readJson<string[]>(LS_KEYS.deletedGroupIds, []))
    tombstones.add(id)
    writeJson(LS_KEYS.deletedGroupIds, [...tombstones])
    this.removeLocalGroupCategoryOverride(id)
    this.equipmentGroups = this.equipmentGroups.filter((g) => g.id !== id)
    this.notify()
  }

  async migrateLegacyPackageCodesIfNeeded(): Promise<void> {
    const changed: EquipmentGroup[] = []
    for (const group of this.equipmentGroups) {
      if (!group.packageCode) {
        group.packageCode = packageCodeForGroup(group.id)
        this.persistGroupPackageCode(group.id, group.packageCode)
        changed.push(group)
      }
    }
    if (changed.length > 0) await this.saveEquipmentGroups(changed)
  }

  // ── Equipment bundles ──────────────────────────────────────────────────────

  async loadEquipmentBundles(): Promise<void> {
    const local = readJson<EquipmentBundle[]>(LS_KEYS.equipmentBundles, [])
    try {
      const { data, error } = await supabase
        .from('equipment_bundles')
        .select('*')
        .order('sort_order', { ascending: true })
      if (error) throw error
      const cloud = ((data ?? []) as EquipmentBundleRow[]).map(equipmentBundleFromRow)
      if (cloud.length === 0 && local.length > 0) {
        this.equipmentBundles = local
        this.applyLocalEquipmentBundleNotes()
        this.persistLocalEquipmentBundles()
        for (const bundle of this.equipmentBundles) {
          await this.saveEquipmentBundleToCloud(bundle)
        }
      } else {
        this.equipmentBundles = cloud
        this.applyLocalEquipmentBundleNotes()
        this.persistLocalEquipmentBundles()
      }
      this.notify()
    } catch (error) {
      console.error('加载自定义套餐失败', error)
      if (local.length > 0) {
        this.equipmentBundles = local
        this.applyLocalEquipmentBundleNotes()
        this.notify()
      }
    }
  }

  async saveEquipmentBundle(bundle: EquipmentBundle): Promise<boolean> {
    const index = this.equipmentBundles.findIndex((b) => b.id === bundle.id)
    if (index >= 0) this.equipmentBundles[index] = bundle
    else this.equipmentBundles.push(bundle)
    this.persistLocalEquipmentBundles()
    const ok = await this.saveEquipmentBundleToCloud(bundle)
    this.notify()
    return ok
  }

  async createEquipmentBundle(
    name: string,
    note = '',
    equipmentIds: string[] = []
  ): Promise<EquipmentBundle | null> {
    const trimmed = name.trim()
    if (!trimmed) return null
    const bundle: EquipmentBundle = {
      id: crypto.randomUUID(),
      name: trimmed,
      note: note.trim(),
      packageCode: '',
      equipmentIds,
      sortOrder: this.equipmentBundles.length,
    }
    bundle.packageCode = bundleCodeForBundle(bundle.id)
    this.equipmentBundles.push(bundle)
    this.persistLocalEquipmentBundles()
    await this.saveEquipmentBundleToCloud(bundle)
    this.notify()
    return bundle
  }

  async updateEquipmentBundle(bundle: EquipmentBundle): Promise<boolean> {
    const index = this.equipmentBundles.findIndex((b) => b.id === bundle.id)
    if (index < 0) return false
    this.equipmentBundles[index] = bundle
    this.persistLocalEquipmentBundles()
    const ok = await this.saveEquipmentBundleToCloud(bundle)
    this.notify()
    return ok
  }

  async deleteEquipmentBundle(id: string): Promise<void> {
    this.equipmentBundles = this.equipmentBundles.filter((b) => b.id !== id)
    this.persistLocalEquipmentBundles()
    try {
      await supabase.from('equipment_bundles').delete().eq('id', id)
    } catch (error) {
      console.error('删除套餐失败', error)
    }
    this.notify()
  }

  async migrateLegacyBundleCodesIfNeeded(): Promise<void> {
    const changed: EquipmentBundle[] = []
    for (const bundle of this.equipmentBundles) {
      if (!bundle.packageCode) {
        bundle.packageCode = bundleCodeForBundle(bundle.id)
        changed.push(bundle)
      }
    }
    if (changed.length > 0) {
      this.persistLocalEquipmentBundles()
      for (const bundle of changed) await this.saveEquipmentBundleToCloud(bundle)
    }
  }

  private async saveEquipmentBundleToCloud(bundle: EquipmentBundle): Promise<boolean> {
    try {
      const payload = equipmentBundleToRow(bundle)
      const { error } = await supabase
        .from('equipment_bundles')
        .upsert(payload, { onConflict: 'id' })
      if (error) throw error
      return true
    } catch (error) {
      if (isMissingColumnError(error, 'note') && this.equipmentBundlesDBSupportsNote) {
        this.equipmentBundlesDBSupportsNote = false
        writeBool(LS_KEYS.equipmentBundlesDBSupportsNote, false)
        return this.saveEquipmentBundleToCloud(bundle)
      }
      console.error('保存套餐失败', error)
      return false
    }
  }

  // ── Equipments ─────────────────────────────────────────────────────────────

  private async fetchEquipmentsFromCloud(): Promise<Equipment[] | null> {
    try {
      let query = supabase.from('equipments').select('*')
      if (this.equipmentDBSupportsSortOrder) {
        query = query.order('sort_order', { ascending: true }).order('name', { ascending: true })
      } else {
        query = query.order('name', { ascending: true })
      }
      const { data, error } = await query
      if (error) throw error
      return ((data ?? []) as EquipmentRow[]).map(equipmentFromRow)
    } catch (error) {
      if (isMissingColumnError(error, 'sort_order') && this.equipmentDBSupportsSortOrder) {
        this.equipmentDBSupportsSortOrder = false
        writeBool(LS_KEYS.equipmentDBSupportsSortOrder, false)
        return this.fetchEquipmentsFromCloud()
      }
      if (
        isMissingColumnError(error, 'photo_share_code') &&
        this.equipmentDBSupportsPhotoShareCode
      ) {
        this.equipmentDBSupportsPhotoShareCode = false
        writeBool(LS_KEYS.equipmentDBSupportsPhotoShareCode, false)
        return this.fetchEquipmentsFromCloud()
      }
      console.error('加载器材失败', error)
      return null
    }
  }

  private commitEquipments(loaded: Equipment[]): void {
    this.equipments = equipmentsWithRecalculatedUsage(loaded, this.orders)
    this.applyLocalEquipmentSortOrders()
    this.mergeLocalPhotoShareCodes()
    this.persistLocalPhotoShareCodes()
    this.notify()
  }

  async loadEquipments(): Promise<void> {
    const loaded = await this.fetchEquipmentsFromCloud()
    if (loaded) this.commitEquipments(loaded)
  }

  async saveSingleEquipment(equipment: Equipment): Promise<void> {
    try {
      const payload = equipmentToRow(equipment)
      const { error } = await supabase.from('equipments').upsert(payload)
      if (error) throw error
      this.persistLocalPhotoShareCodes()
    } catch (error) {
      this.persistLocalPhotoShareCodes()
      if (isMissingColumnError(error, 'sort_order') && this.equipmentDBSupportsSortOrder) {
        this.equipmentDBSupportsSortOrder = false
        writeBool(LS_KEYS.equipmentDBSupportsSortOrder, false)
        await this.saveSingleEquipment(equipment)
        return
      }
      console.error('保存器材失败', error)
    }
  }

  async saveEquipments(items: Equipment[]): Promise<boolean> {
    if (items.length === 0) return true
    if (items.length === 1) {
      await this.saveSingleEquipment(items[0])
      this.notify()
      return true
    }
    try {
      const payloads = items.map(equipmentToRow)
      const { error } = await supabase.from('equipments').upsert(payloads)
      if (error) throw error
      this.persistLocalPhotoShareCodes()
      this.notify()
      return true
    } catch (error) {
      console.error('批量保存器材失败', error)
      for (const item of items) await this.saveSingleEquipment(item)
      this.notify()
      return true
    }
  }

  async addEquipment(equipment: Equipment): Promise<void> {
    const newEquipment: Equipment = {
      ...equipment,
      id: crypto.randomUUID(),
      sortOrder: this.nextEquipmentSortOrder(equipment.category, equipment.groupId),
    }
    await this.saveSingleEquipment(newEquipment)
    await this.loadEquipments()
  }

  async updateEquipment(equipment: Equipment): Promise<void> {
    const index = this.equipments.findIndex((eq) => eq.id === equipment.id)
    if (index < 0) return
    this.equipments[index] = equipment
    await this.saveSingleEquipment(equipment)
    this.notify()
  }

  async deleteEquipment(id: string): Promise<void> {
    try {
      await supabase.from('equipments').delete().eq('id', id)
    } catch (error) {
      console.error('删除器材失败', error)
    }
    this.equipments = this.equipments.filter((eq) => eq.id !== id)
    this.notify()
  }

  async moveEquipmentToGroup(equipmentId: string, groupId: string | null): Promise<void> {
    const index = this.equipments.findIndex((eq) => eq.id === equipmentId)
    if (index < 0) return
    if (groupId) {
      const group = this.equipmentGroups.find((g) => g.id === groupId)
      if (group && this.equipments[index].category !== group.category) return
    }
    this.equipments[index].groupId = groupId
    this.equipments[index].sortOrder = this.nextEquipmentSortOrder(
      this.equipments[index].category,
      groupId
    )
    await this.saveSingleEquipment(this.equipments[index])
    await this.loadEquipments()
  }

  async updateEquipmentUsage(): Promise<void> {
    this.equipments = equipmentsWithRecalculatedUsage(this.equipments, this.orders)
    this.notify()
  }

  async reserveEquipment(order: RentalOrder): Promise<boolean> {
    for (const item of order.equipmentItems) {
      const index = this.equipments.findIndex((eq) => eq.id === item.equipment.id)
      if (index < 0) return false
      if (this.rentableStock(this.equipments[index]) < item.quantity) return false
    }
    const updated: Equipment[] = []
    for (const item of order.equipmentItems) {
      const index = this.equipments.findIndex((eq) => eq.id === item.equipment.id)
      if (index >= 0) {
        this.equipments[index].usedCount += item.quantity
        updated.push(this.equipments[index])
      }
    }
    if (updated.length === 0) return true
    const saved = await this.saveEquipments(updated)
    return saved
  }

  async releaseEquipment(order: RentalOrder): Promise<void> {
    const updated: Equipment[] = []
    for (const item of order.equipmentItems) {
      const index = this.equipments.findIndex((eq) => eq.id === item.equipment.id)
      if (index >= 0) {
        this.equipments[index].usedCount = Math.max(
          0,
          this.equipments[index].usedCount - item.quantity
        )
        updated.push(this.equipments[index])
      }
    }
    if (updated.length > 0) await this.saveEquipments(updated)
  }

  async updateEquipmentForOrder(
    oldOrder: RentalOrder,
    newOrder: RentalOrder
  ): Promise<boolean> {
    const oldMap = orderEquipmentQuantityMap(oldOrder.equipmentItems)
    const newMap = orderEquipmentQuantityMap(newOrder.equipmentItems)
    const allIds = new Set([...oldMap.keys(), ...newMap.keys()])

    for (const id of allIds) {
      const delta = (newMap.get(id) ?? 0) - (oldMap.get(id) ?? 0)
      if (delta <= 0) continue
      const index = this.equipments.findIndex((eq) => eq.id === id)
      if (index < 0) return false
      if (this.rentableStock(this.equipments[index]) < delta) return false
    }

    const changed: Equipment[] = []
    const rollback: [number, number][] = []

    for (const id of allIds) {
      const delta = (newMap.get(id) ?? 0) - (oldMap.get(id) ?? 0)
      if (delta === 0) continue
      const index = this.equipments.findIndex((eq) => eq.id === id)
      if (index < 0) continue
      rollback.push([index, this.equipments[index].usedCount])
      this.equipments[index].usedCount = Math.max(
        0,
        this.equipments[index].usedCount + delta
      )
      changed.push(this.equipments[index])
    }

    if (changed.length === 0) return true
    const saved = await this.saveEquipments(changed)
    if (!saved) {
      for (const [index, usedCount] of rollback) {
        this.equipments[index].usedCount = usedCount
      }
      return false
    }
    return true
  }

  // ── Customers / crews / introducers ────────────────────────────────────────

  async loadCustomers(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw error
      this.customers = ((data ?? []) as CustomerRow[]).map(customerFromRow)
      this.notify()
    } catch (error) {
      console.error('加载客户失败', error)
    }
  }

  async saveCustomer(customer: Customer): Promise<void> {
    const index = this.customers.findIndex((c) => c.id === customer.id)
    if (index >= 0) this.customers[index] = customer
    else this.customers.push(customer)
    try {
      await supabase.from('customers').upsert(customerToRow(customer))
    } catch (error) {
      console.error('保存客户失败', error)
    }
    this.notify()
  }

  async deleteCustomer(id: string): Promise<void> {
    try {
      await supabase.from('customers').delete().eq('id', id)
    } catch (error) {
      console.error('删除客户失败', error)
    }
    this.customers = this.customers.filter((c) => c.id !== id)
    this.notify()
  }

  async loadCrews(): Promise<void> {
    try {
      const { data, error } = await supabase.from('camera_crews').select('*')
      if (error) throw error
      this.crews = ((data ?? []) as CameraCrewRow[]).map(cameraCrewFromRow)
      this.notify()
    } catch (error) {
      console.error('加载跟机员失败', error)
    }
  }

  async saveCrew(crew: CameraCrew): Promise<void> {
    const index = this.crews.findIndex((c) => c.id === crew.id)
    if (index >= 0) this.crews[index] = crew
    else this.crews.push(crew)
    try {
      await supabase.from('camera_crews').upsert(cameraCrewToRow(crew))
    } catch (error) {
      console.error('保存跟机员失败', error)
    }
    this.notify()
  }

  async deleteCrew(id: string): Promise<void> {
    try {
      await supabase.from('camera_crews').delete().eq('id', id)
    } catch (error) {
      console.error('删除跟机员失败', error)
    }
    this.crews = this.crews.filter((c) => c.id !== id)
    this.notify()
  }

  async loadIntroducers(): Promise<void> {
    try {
      const { data, error } = await supabase.from('introducers').select('*')
      if (error) throw error
      this.introducers = ((data ?? []) as IntroducerRow[]).map(introducerFromRow)
      this.notify()
    } catch (error) {
      console.error('加载介绍人失败', error)
    }
  }

  async saveIntroducer(introducer: Introducer): Promise<void> {
    const index = this.introducers.findIndex((i) => i.id === introducer.id)
    if (index >= 0) this.introducers[index] = introducer
    else this.introducers.push(introducer)
    try {
      await supabase.from('introducers').upsert(introducerToRow(introducer))
    } catch (error) {
      console.error('保存介绍人失败', error)
    }
    this.notify()
  }

  async deleteIntroducer(id: string): Promise<void> {
    try {
      await supabase.from('introducers').delete().eq('id', id)
    } catch (error) {
      console.error('删除介绍人失败', error)
    }
    this.introducers = this.introducers.filter((i) => i.id !== id)
    this.notify()
  }

  // ── Orders ─────────────────────────────────────────────────────────────────

  async loadOrders(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const { data, error } = await supabase
        .from('rental_orders')
        .select('*')
        .gte('rent_date', thirtyDaysAgo.toISOString())
        .order('rent_date', { ascending: false })
        .limit(200)
      if (error) throw error
      this.orders = ((data ?? []) as RentalOrderRow[]).map(rentalOrderFromRow)
      this.notify()
    } catch (error) {
      console.error('加载订单失败', error)
    }
  }

  async saveOrder(order: RentalOrder): Promise<boolean> {
    return this.saveOrders([order])
  }

  async saveOrders(
    ordersToSave: RentalOrder[],
    reloadFromCloud = true
  ): Promise<boolean> {
    const currentUser = await this.getCurrentUsername()
    const now = new Date()
    let allSuccess = true

    for (const order of ordersToSave) {
      try {
        const row = rentalOrderToRow(order)
        row.modify_user = currentUser
        row.modify_date = toISOString(now)
        const { error } = await supabase.from('rental_orders').upsert(row)
        if (error) throw error
      } catch (error) {
        console.error('保存订单失败', error)
        allSuccess = false
      }
    }

    if (allSuccess) {
      for (const order of ordersToSave) {
        const idx = this.orders.findIndex((o) => o.id === order.id)
        if (idx >= 0) {
          this.orders[idx].modifyUser = currentUser
          this.orders[idx].modifyDate = now
        }
      }
      await this.updateEquipmentUsage()
      if (reloadFromCloud) await this.loadOrders()
    }
    this.notify()
    return allSuccess
  }

  async deleteOrder(id: string): Promise<void> {
    try {
      await supabase.from('rental_orders').delete().eq('id', id)
    } catch (error) {
      console.error('删除订单失败', error)
    }
    this.orders = this.orders.filter((o) => o.id !== id)
    this.notify()
  }

  // ── OA reports ─────────────────────────────────────────────────────────────

  async loadOAReports(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('oa_reports')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      this.oaReports = ((data ?? []) as OAReportRow[]).map(oaReportFromRow)
      this.notify()
    } catch (error) {
      console.error('加载 OA 提报失败', error)
    }
  }

  async submitOAReport(params: {
    category: OAReportCategory
    procurementSubType: OAProcurementSubType | null
    title: string
    detail: string
    submitterUsername: string
    executorUsername: string
    maintenanceEquipmentItems: OAMaintenanceEquipmentItem[]
    autoApproveIfSuperAdmin: boolean
  }): Promise<string | null> {
    const trimmedTitle = params.title.trim()
    const trimmedDetail = params.detail.trim()
    const trimmedExecutor = params.executorUsername.trim()
    if (!trimmedTitle) return '请填写标题'
    if (!trimmedDetail) return '请填写申报内容'
    if (!trimmedExecutor) return '请填写执行人'
    if (params.category === '采购' && !params.procurementSubType) {
      return '请选择采购类型'
    }
    if (params.category === '维修') {
      const err = this.validateMaintenanceEquipmentItems(params.maintenanceEquipmentItems)
      if (err) return err
    }

    const report: OAReport = {
      id: crypto.randomUUID(),
      category: params.category,
      procurementSubType:
        params.category === '采购' ? params.procurementSubType : null,
      title: trimmedTitle,
      detail: trimmedDetail,
      submitterUsername: params.submitterUsername,
      executorUsername: trimmedExecutor,
      createdAt: new Date(),
      status: '审核中',
      approvedBy: null,
      approvedAt: null,
      isExecuted: false,
      executedAt: null,
      executedBy: null,
      maintenanceEquipmentItems:
        params.category === '维修'
          ? params.maintenanceEquipmentItems.filter((item) => item.quantity > 0)
          : [],
    }

    if (params.autoApproveIfSuperAdmin) {
      report.status = '已通过'
      report.approvedBy = params.submitterUsername
      report.approvedAt = new Date()
    }

    try {
      const { error } = await supabase.from('oa_reports').upsert(oaReportToRow(report))
      if (error) throw error
      const index = this.oaReports.findIndex((r) => r.id === report.id)
      if (index >= 0) this.oaReports[index] = report
      else this.oaReports.unshift(report)
      this.oaReports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      this.notify()
      return null
    } catch (error) {
      return `提交失败：${error instanceof Error ? error.message : String(error)}`
    }
  }

  async approveOAReport(id: string, approverUsername: string): Promise<string | null> {
    if (approverUsername !== SUPER_ADMIN_USERNAME) return '仅超级管理员可审批'
    const index = this.oaReports.findIndex((r) => r.id === id)
    if (index < 0) return '申报不存在'
    if (this.oaReports[index].status !== '审核中') return '该申报已处理'

    const report = { ...this.oaReports[index] }
    report.status = '已通过'
    report.approvedBy = approverUsername
    report.approvedAt = new Date()

    try {
      const { error } = await supabase.from('oa_reports').upsert(oaReportToRow(report))
      if (error) throw error
      this.oaReports[index] = report
      this.notify()
      return null
    } catch (error) {
      return `审批失败：${error instanceof Error ? error.message : String(error)}`
    }
  }

  async rejectOAReport(id: string, approverUsername: string): Promise<string | null> {
    if (approverUsername !== SUPER_ADMIN_USERNAME) return '仅超级管理员可审批'
    const index = this.oaReports.findIndex((r) => r.id === id)
    if (index < 0) return '申报不存在'
    if (this.oaReports[index].status !== '审核中') return '该申报已处理'

    const report = { ...this.oaReports[index] }
    report.status = '未通过'
    report.approvedBy = approverUsername
    report.approvedAt = new Date()

    try {
      const { error } = await supabase.from('oa_reports').upsert(oaReportToRow(report))
      if (error) throw error
      this.oaReports[index] = report
      this.notify()
      return null
    } catch (error) {
      return `审批失败：${error instanceof Error ? error.message : String(error)}`
    }
  }

  async confirmOAReportExecuted(
    id: string,
    operatorUsername: string
  ): Promise<string | null> {
    const index = this.oaReports.findIndex((r) => r.id === id)
    if (index < 0) return '申报不存在'
    if (this.oaReports[index].status !== '已通过') return '仅已通过的申报可确认执行'
    if (this.oaReports[index].isExecuted) return '该申报已完成执行'

    const report = { ...this.oaReports[index] }
    report.isExecuted = true
    report.executedAt = new Date()
    report.executedBy = operatorUsername

    try {
      const { error } = await supabase.from('oa_reports').upsert(oaReportToRow(report))
      if (error) throw error
      this.oaReports[index] = report
      this.notify()
      return null
    } catch (error) {
      return `确认执行失败：${error instanceof Error ? error.message : String(error)}`
    }
  }

  async updateOAReport(params: {
    id: string
    editorUsername: string
    category: OAReportCategory
    procurementSubType: OAProcurementSubType | null
    title: string
    detail: string
    executorUsername: string
    maintenanceEquipmentItems: OAMaintenanceEquipmentItem[]
  }): Promise<string | null> {
    if (params.editorUsername !== SUPER_ADMIN_USERNAME) return '仅超级管理员可编辑'
    const index = this.oaReports.findIndex((r) => r.id === params.id)
    if (index < 0) return '申报不存在'

    const trimmedTitle = params.title.trim()
    const trimmedDetail = params.detail.trim()
    const trimmedExecutor = params.executorUsername.trim()
    if (!trimmedTitle) return '请填写标题'
    if (!trimmedDetail) return '请填写申报内容'
    if (!trimmedExecutor) return '请填写执行人'
    if (params.category === '采购' && !params.procurementSubType) return '请选择采购类型'
    if (params.category === '维修') {
      const err = this.validateMaintenanceEquipmentItems(
        params.maintenanceEquipmentItems,
        params.id
      )
      if (err) return err
    }

    const report = { ...this.oaReports[index] }
    report.category = params.category
    report.procurementSubType =
      params.category === '采购' ? params.procurementSubType : null
    report.title = trimmedTitle
    report.detail = trimmedDetail
    report.executorUsername = trimmedExecutor
    report.maintenanceEquipmentItems =
      params.category === '维修'
        ? params.maintenanceEquipmentItems.filter((item) => item.quantity > 0)
        : []

    try {
      const { error } = await supabase.from('oa_reports').upsert(oaReportToRow(report))
      if (error) throw error
      this.oaReports[index] = report
      this.oaReports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      this.notify()
      return null
    } catch (error) {
      return `保存失败：${error instanceof Error ? error.message : String(error)}`
    }
  }

  async deleteOAReport(id: string, operatorUsername: string): Promise<string | null> {
    if (operatorUsername !== SUPER_ADMIN_USERNAME) return '仅超级管理员可删除'
    if (!this.oaReports.some((r) => r.id === id)) return '申报不存在'
    try {
      const { error } = await supabase.from('oa_reports').delete().eq('id', id)
      if (error) throw error
      this.oaReports = this.oaReports.filter((r) => r.id !== id)
      this.notify()
      return null
    } catch (error) {
      return `删除失败：${error instanceof Error ? error.message : String(error)}`
    }
  }

  // ── Payment records ────────────────────────────────────────────────────────

  getPaymentRecords(orderId: string): PaymentRecord[] {
    return readJson<PaymentRecord[]>(LS_KEYS.paymentRecords(orderId), []).map((r) => ({
      ...r,
      time: r.time instanceof Date ? r.time : new Date(r.time as unknown as string),
    }))
  }

  totalPaidAmount(orderId: string): number {
    return this.getPaymentRecords(orderId).reduce((sum, r) => sum + r.amount, 0)
  }

  resolvedPayStatus(order: RentalOrder, totalPaid?: number): PayStatus {
    if (order.totalPrice <= 0) return '待付款'
    const paid = totalPaid ?? this.totalPaidAmount(order.id)
    return paid >= order.totalPrice - 0.01 ? '已付款' : '待付款'
  }

  async loadPaymentRecordsForOrder(orderId: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('payment_records')
        .select('*')
        .eq('order_id', orderId)
        .order('pay_time', { ascending: false })
      if (error) throw error
      const records = ((data ?? []) as PaymentRecordRow[]).map(paymentRecordFromRow)
      writeJson(LS_KEYS.paymentRecords(orderId), records)
    } catch (error) {
      console.error('同步付款记录失败', error)
    }
  }

  async loadPaymentRecordsForAllOrders(): Promise<void> {
    await Promise.all(this.orders.map((order) => this.loadPaymentRecordsForOrder(order.id)))
  }

  async savePaymentRecord(orderId: string, record: PaymentRecord): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('payment_records')
        .insert(paymentRecordToRow(record, orderId))
      if (error) throw error

      const records = this.getPaymentRecords(orderId)
      records.push(record)
      writeJson(LS_KEYS.paymentRecords(orderId), records)

      const orderIndex = this.orders.findIndex((o) => o.id === orderId)
      if (orderIndex >= 0) {
        const order = this.orders[orderIndex]
        const newTotalPaid = this.totalPaidAmount(orderId)
        const reachedFull = newTotalPaid >= order.totalPrice - 0.01
        if (reachedFull) {
          this.orders[orderIndex].payStatus = '已付款'
          this.orders[orderIndex].payTime = new Date()
          await this.saveOrders([this.orders[orderIndex]], false)
        } else if (this.orders[orderIndex].payStatus === '已付款') {
          this.orders[orderIndex].payStatus = '待付款'
          await this.saveOrders([this.orders[orderIndex]], false)
        }
      }
      this.notify()
      return true
    } catch (error) {
      console.error('保存付款记录失败', error)
      return false
    }
  }

  // ── Admin management ───────────────────────────────────────────────────────

  isAdminUsername(username: string): boolean {
    return username === SUPER_ADMIN_USERNAME || this.appAdmins.some((a) => a.username === username)
  }

  appAdminUsernames(): string[] {
    const names = new Set(this.appAdmins.map((a) => a.username))
    names.add(SUPER_ADMIN_USERNAME)
    return [...names].sort()
  }

  async loadAppAdmins(): Promise<void> {
    const tombstones = new Set(readJson<string[]>(LS_KEYS.removedAppAdmins, []))
    try {
      const { data, error } = await supabase
        .from('app_admins')
        .select('*')
        .order('username', { ascending: true })
      if (error) throw error
      let admins = ((data ?? []) as AppAdminRow[]).map(appAdminFromRow)
      if (!admins.some((a) => a.username === SUPER_ADMIN_USERNAME)) {
        const superAdmin: AppAdmin = {
          id: crypto.randomUUID(),
          username: SUPER_ADMIN_USERNAME,
          createdBy: 'system',
          createdAt: null,
        }
        const err = await this.saveAppAdmin(superAdmin)
        if (!err) admins.unshift(superAdmin)
      }
      for (const name of tombstones) {
        if (admins.some((a) => a.username === name)) {
          await this.deleteAppAdminFromCloud(name)
        }
      }
      admins = admins.filter((a) => !tombstones.has(a.username))
      admins.sort((a, b) => a.username.localeCompare(b.username, 'zh-CN'))
      this.appAdmins = admins.filter((a) => a.username !== SUPER_ADMIN_USERNAME)
      this.persistLocalAppAdmins()
      this.notify()
    } catch (error) {
      console.warn('加载管理员列表失败，使用本机缓存', error)
      this.loadLocalAppAdmins()
      this.appAdmins = this.appAdmins.filter((a) => !tombstones.has(a.username))
      this.notify()
    }
  }

  async loadAppUsers(): Promise<void> {
    try {
      const { data, error } = await supabase.rpc('list_all_app_users_for_admin')
      if (error) throw error
      this.appUsers = ((data ?? []) as AppUserRow[]).map(appUserFromRow)
      this.notify()
      return
    } catch (error) {
      console.warn('RPC 加载账号失败，尝试 app_users 表', error)
    }
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .order('username', { ascending: true })
      if (error) throw error
      this.appUsers = ((data ?? []) as AppUserRow[]).map(appUserFromRow)
      this.notify()
    } catch (error) {
      console.error('加载账号列表失败', error)
    }
  }

  async loadAdminManagementData(): Promise<void> {
    await this.loadAppAdmins()
    await this.loadAppUsers()
  }

  async addAppAdmin(username: string, createdBy: string): Promise<string | null> {
    const trimmed = username.trim()
    if (!trimmed) return '用户名不能为空'
    if (trimmed === SUPER_ADMIN_USERNAME) return '超级管理员无需重复添加'
    if (this.isAdminUsername(trimmed)) return '该用户已是管理员'

    const admin: AppAdmin = {
      id: crypto.randomUUID(),
      username: trimmed,
      createdBy,
      createdAt: new Date(),
    }
    const err = await this.saveAppAdmin(admin)
    if (err) return err

    const tombstones = new Set(readJson<string[]>(LS_KEYS.removedAppAdmins, []))
    tombstones.delete(trimmed)
    writeJson(LS_KEYS.removedAppAdmins, [...tombstones])

    this.appAdmins.push(admin)
    this.appAdmins.sort((a, b) => a.username.localeCompare(b.username, 'zh-CN'))
    this.persistLocalAppAdmins()
    this.notify()
    return null
  }

  async removeAppAdmin(username: string): Promise<string | null> {
    if (username === SUPER_ADMIN_USERNAME) return '不能移除超级管理员'
    if (!this.isAdminUsername(username)) return '该用户不是管理员'

    const tombstones = new Set(readJson<string[]>(LS_KEYS.removedAppAdmins, []))
    tombstones.add(username)
    writeJson(LS_KEYS.removedAppAdmins, [...tombstones])

    this.appAdmins = this.appAdmins.filter((a) => a.username !== username)
    this.persistLocalAppAdmins()
    this.notify()

    const err = await this.deleteAppAdminFromCloud(username)
    if (err) return err

    tombstones.delete(username)
    writeJson(LS_KEYS.removedAppAdmins, [...tombstones])
    return null
  }

  async deleteAppUser(id: string, username: string): Promise<string | null> {
    if (username === SUPER_ADMIN_USERNAME) return '不能删除超级管理员'
    try {
      const { error } = await supabase.rpc('delete_app_user_for_admin', {
        target_user_id: id,
      })
      if (error) throw error
      await this.removeAppAdmin(username)
      this.appUsers = this.appUsers.filter((u) => u.id !== id)
      this.notify()
      return null
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (
        message.includes('delete_app_user_for_admin') ||
        message.includes('Could not find the function')
      ) {
        return '删除失败：请在 Supabase 执行 supabase_delete_app_user_for_admin.sql'
      }
      return message
    }
  }

  private async saveAppAdmin(admin: AppAdmin): Promise<string | null> {
    try {
      const { error } = await supabase
        .from('app_admins')
        .upsert(appAdminToRow(admin), { onConflict: 'username' })
      if (error) throw error
      return null
    } catch (error) {
      return `同步失败：${error instanceof Error ? error.message : String(error)}`
    }
  }

  private async deleteAppAdminFromCloud(username: string): Promise<string | null> {
    try {
      const { error } = await supabase.from('app_admins').delete().eq('username', username)
      if (error) throw error
      return null
    } catch (error) {
      return `同步失败：${error instanceof Error ? error.message : String(error)}`
    }
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  equipmentGroupLabel(equipment: Equipment): string {
    if (!equipment.groupId) return '未分组'
    return this.equipmentGroups.find((g) => g.id === equipment.groupId)?.name ?? '未分组'
  }

  equipmentMatchesSearch(equipment: Equipment, query: string): boolean {
    const groupLabel = this.equipmentGroupLabel(equipment)
    let groupDisplayPath: string | undefined
    if (equipment.groupId) {
      const group = this.equipmentGroups.find((g) => g.id === equipment.groupId)
      if (group) groupDisplayPath = this.groupDisplayPath(group)
    }
    return searchEquipmentMatches(equipment, query, { groupLabel, groupDisplayPath })
  }

  equipmentsMatchingSearch(searchText: string, pool?: Equipment[]): Equipment[] {
    const source = pool ?? this.equipments
    const trimmed = searchText.trim()
    if (!trimmed) return source
    return source.filter((eq) => this.equipmentMatchesSearch(eq, trimmed))
  }

  groupDisplayPath(group: EquipmentGroup): string {
    const parts = [group.name]
    let current = group
    while (current.parentId) {
      const parent = this.equipmentGroups.find(
        (g) => g.id === current.parentId && g.category === group.category
      )
      if (!parent) break
      parts.unshift(parent.name)
      current = parent
    }
    return parts.join(' / ')
  }

  // ── Schema probes / migrations ─────────────────────────────────────────────

  async probeEquipmentsSchema(): Promise<void> {
    try {
      const { error } = await supabase
        .from('equipments')
        .select('id,sort_order')
        .limit(1)
      if (!error) {
        this.equipmentDBSupportsSortOrder = true
        writeBool(LS_KEYS.equipmentDBSupportsSortOrder, true)
      }
    } catch {
      this.equipmentDBSupportsSortOrder = false
      writeBool(LS_KEYS.equipmentDBSupportsSortOrder, false)
    }
    try {
      const { error } = await supabase
        .from('equipments')
        .select('id,photo_share_code')
        .limit(1)
      if (!error) {
        this.equipmentDBSupportsPhotoShareCode = true
        writeBool(LS_KEYS.equipmentDBSupportsPhotoShareCode, true)
      }
    } catch {
      this.equipmentDBSupportsPhotoShareCode = false
      writeBool(LS_KEYS.equipmentDBSupportsPhotoShareCode, false)
    }
  }

  async probeEquipmentGroupsSchema(): Promise<void> {
    try {
      const { error } = await supabase
        .from('equipment_groups')
        .select('id,category,parent_id,package_code')
        .limit(1)
      if (!error) {
        this.equipmentGroupsDBSupportsCategory = true
        writeBool(LS_KEYS.equipmentGroupsDBSupportsCategory, true)
        writeBool(LS_KEYS.equipmentGroupsDBSupportsParentId, true)
        writeBool(LS_KEYS.equipmentGroupsDBSupportsPackageCode, true)
      }
    } catch {
      // columns may be missing — local overrides handle it
    }
  }

  async migrateLegacyGroupCategoriesIfNeeded(): Promise<void> {
    const overrides = readJson<Record<string, string>>(LS_KEYS.groupCategoryOverrides, {})
    const changed: EquipmentGroup[] = []

    for (const group of this.equipmentGroups) {
      if (overrides[group.id]) continue
      const inGroup = this.equipments.filter((eq) => eq.groupId === group.id)
      if (inGroup.length === 0) continue
      const hasPhoto = inGroup.some((eq) => eq.category === '摄影器材')
      const hasLight = inGroup.some((eq) => eq.category === '灯光器材')
      let inferred: EquCategory | null = null
      if (hasPhoto && !hasLight) inferred = '摄影器材'
      else if (hasLight && !hasPhoto) inferred = '灯光器材'
      if (inferred && group.category !== inferred) {
        group.category = inferred
        this.persistGroupCategory(group.id, inferred)
        changed.push(group)
      }
    }

    if (changed.length > 0 && this.equipmentGroupsDBSupportsCategory) {
      await this.saveEquipmentGroups(changed)
    }
    this.notify()
  }

  // ── Private local persistence ──────────────────────────────────────────────

  private nextEquipmentSortOrder(
    category: EquCategory,
    groupId: string | null
  ): number {
    const siblings = this.equipments.filter(
      (eq) => eq.category === category && eq.groupId === groupId
    )
    const max = siblings.reduce((m, eq) => Math.max(m, eq.sortOrder), -1)
    return max + 1
  }

  private persistGroupCategory(groupId: string, category: EquCategory): void {
    const dict = readJson<Record<string, string>>(LS_KEYS.groupCategoryOverrides, {})
    dict[groupId] = category
    writeJson(LS_KEYS.groupCategoryOverrides, dict)
  }

  private removeLocalGroupCategoryOverride(groupId: string): void {
    const dict = readJson<Record<string, string>>(LS_KEYS.groupCategoryOverrides, {})
    delete dict[groupId]
    writeJson(LS_KEYS.groupCategoryOverrides, dict)
  }

  private applyLocalGroupCategoryOverrides(): void {
    const overrides = readJson<Record<string, string>>(LS_KEYS.groupCategoryOverrides, {})
    for (const group of this.equipmentGroups) {
      const raw = overrides[group.id]
      if (raw === '摄影器材' || raw === '灯光器材') group.category = raw
    }
  }

  private persistGroupPackageCode(groupId: string, code: string): void {
    const dict = readJson<Record<string, string>>(LS_KEYS.groupPackageCodes, {})
    dict[groupId] = code
    writeJson(LS_KEYS.groupPackageCodes, dict)
  }

  private applyLocalGroupPackageCodes(): void {
    const codes = readJson<Record<string, string>>(LS_KEYS.groupPackageCodes, {})
    for (const group of this.equipmentGroups) {
      const code = codes[group.id]
      if (code) group.packageCode = code
    }
  }

  private applyLocalGroupSortOrders(): void {
    const orders = readJson<Record<string, number>>(LS_KEYS.groupSortOrders, {})
    for (const group of this.equipmentGroups) {
      if (orders[group.id] != null) group.sortOrder = orders[group.id]
    }
  }

  private applyLocalEquipmentSortOrders(): void {
    const orders = readJson<Record<string, number>>(LS_KEYS.equipmentSortOrders, {})
    for (const eq of this.equipments) {
      if (orders[eq.id] != null) eq.sortOrder = orders[eq.id]
    }
  }

  private persistLocalEquipmentBundles(): void {
    writeJson(LS_KEYS.equipmentBundles, this.equipmentBundles)
    const notes: Record<string, string> = {}
    for (const bundle of this.equipmentBundles) {
      if (bundle.note) notes[bundle.id] = bundle.note
    }
    writeJson(LS_KEYS.equipmentBundleNotes, notes)
  }

  private applyLocalEquipmentBundleNotes(): void {
    const notes = readJson<Record<string, string>>(LS_KEYS.equipmentBundleNotes, {})
    for (const bundle of this.equipmentBundles) {
      if (!bundle.note && notes[bundle.id]) bundle.note = notes[bundle.id]
    }
  }

  private persistLocalPhotoShareCodes(): void {
    const map = readJson<Record<string, string>>(LS_KEYS.photoShareCodes, {})
    for (const eq of this.equipments) {
      if (eq.photoShareCode?.trim()) map[eq.id] = eq.photoShareCode.trim()
      else delete map[eq.id]
    }
    writeJson(LS_KEYS.photoShareCodes, map)
  }

  private mergeLocalPhotoShareCodes(): boolean {
    const map = readJson<Record<string, string>>(LS_KEYS.photoShareCodes, {})
    let didRestore = false
    for (const eq of this.equipments) {
      if (eq.photoShareCode?.trim()) continue
      const code = map[eq.id]
      if (code) {
        eq.photoShareCode = code
        didRestore = true
      }
    }
    return didRestore
  }

  private persistLocalAppAdmins(): void {
    writeJson(
      LS_KEYS.localAppAdmins,
      this.appAdmins.map((a) => a.username)
    )
  }

  private loadLocalAppAdmins(): void {
    const names = readJson<string[]>(LS_KEYS.localAppAdmins, [])
    this.appAdmins = names
      .filter((n) => n !== SUPER_ADMIN_USERNAME)
      .map((username) => ({
        id: crypto.randomUUID(),
        username,
        createdBy: null,
        createdAt: null,
      }))
  }

  async getCurrentUsername(): Promise<string> {
    try {
      const { data } = await supabase.auth.getSession()
      const user = data.session?.user
      if (!user) return '未知用户'
      return usernameFromAuthUser(user)
    } catch {
      return '未知用户'
    }
  }
}

export const dataStore = new DataStore()
