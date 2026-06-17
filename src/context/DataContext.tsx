import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import { dataStore, DataStore } from '../services/dataStore'
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
import type { BundleAddAvailability } from '../types/models'

export interface DataContextValue {
  store: DataStore
  equipments: Equipment[]
  equipmentGroups: EquipmentGroup[]
  equipmentBundles: EquipmentBundle[]
  customers: Customer[]
  orders: RentalOrder[]
  oaReports: OAReport[]
  crews: CameraCrew[]
  introducers: Introducer[]
  appAdmins: AppAdmin[]
  appUsers: AppUser[]
  isSyncing: boolean
  lastSyncTime: Date | null
  syncProgress: string
  loadError: string | null
  initialLoad: () => Promise<void>
  fullRefresh: () => Promise<void>
  syncData: () => Promise<void>
  loadEquipments: () => Promise<void>
  saveEquipments: (items: Equipment[]) => Promise<boolean>
  addEquipment: (equipment: Equipment) => Promise<void>
  updateEquipment: (equipment: Equipment) => Promise<void>
  deleteEquipment: (id: string) => Promise<void>
  moveEquipmentToGroup: (equipmentId: string, groupId: string | null) => Promise<void>
  loadEquipmentGroups: () => Promise<void>
  saveEquipmentGroups: (groups?: EquipmentGroup[]) => Promise<void>
  createEquipmentGroup: (
    name: string,
    category: EquCategory,
    parentId?: string | null
  ) => Promise<EquipmentGroup | null>
  updateEquipmentGroup: (group: EquipmentGroup) => Promise<void>
  deleteEquipmentGroup: (id: string) => Promise<void>
  loadEquipmentBundles: () => Promise<void>
  saveEquipmentBundle: (bundle: EquipmentBundle) => Promise<boolean>
  createEquipmentBundle: (
    name: string,
    note?: string,
    equipmentIds?: string[]
  ) => Promise<EquipmentBundle | null>
  updateEquipmentBundle: (bundle: EquipmentBundle) => Promise<boolean>
  deleteEquipmentBundle: (id: string) => Promise<void>
  loadCustomers: () => Promise<void>
  saveCustomer: (customer: Customer) => Promise<void>
  deleteCustomer: (id: string) => Promise<void>
  loadCrews: () => Promise<void>
  saveCrew: (crew: CameraCrew) => Promise<void>
  deleteCrew: (id: string) => Promise<void>
  loadIntroducers: () => Promise<void>
  saveIntroducer: (introducer: Introducer) => Promise<void>
  deleteIntroducer: (id: string) => Promise<void>
  loadOrders: () => Promise<void>
  saveOrder: (order: RentalOrder) => Promise<boolean>
  saveOrders: (orders: RentalOrder[], reloadFromCloud?: boolean) => Promise<boolean>
  deleteOrder: (id: string) => Promise<void>
  reserveEquipment: (order: RentalOrder) => Promise<boolean>
  releaseEquipment: (order: RentalOrder) => Promise<void>
  updateEquipmentForOrder: (oldOrder: RentalOrder, newOrder: RentalOrder) => Promise<boolean>
  loadOAReports: () => Promise<void>
  submitOAReport: (params: {
    category: OAReportCategory
    procurementSubType: OAProcurementSubType | null
    title: string
    detail: string
    submitterUsername: string
    executorUsername: string
    maintenanceEquipmentItems: OAMaintenanceEquipmentItem[]
    autoApproveIfSuperAdmin: boolean
  }) => Promise<string | null>
  approveOAReport: (id: string, approverUsername: string) => Promise<string | null>
  rejectOAReport: (id: string, approverUsername: string) => Promise<string | null>
  confirmOAReportExecuted: (id: string, operatorUsername: string) => Promise<string | null>
  updateOAReport: (params: {
    id: string
    editorUsername: string
    category: OAReportCategory
    procurementSubType: OAProcurementSubType | null
    title: string
    detail: string
    executorUsername: string
    maintenanceEquipmentItems: OAMaintenanceEquipmentItem[]
  }) => Promise<string | null>
  deleteOAReport: (id: string, operatorUsername: string) => Promise<string | null>
  loadAppAdmins: () => Promise<void>
  loadAppUsers: () => Promise<void>
  loadAdminManagementData: () => Promise<void>
  addAppAdmin: (username: string, createdBy: string) => Promise<string | null>
  removeAppAdmin: (username: string) => Promise<string | null>
  deleteAppUser: (id: string, username: string) => Promise<string | null>
  isAdminUsername: (username: string) => boolean
  appAdminUsernames: () => string[]
  getPaymentRecords: (orderId: string) => PaymentRecord[]
  totalPaidAmount: (orderId: string) => number
  resolvedPayStatus: (order: RentalOrder, totalPaid?: number) => PayStatus
  savePaymentRecord: (orderId: string, record: PaymentRecord) => Promise<boolean>
  maintenanceQuantity: (equipmentId: string, excludingReportId?: string | null) => number
  rentableStock: (equipment: Equipment, excludingReportId?: string | null) => number
  inventoryStats: (forEquipments?: Equipment[]) => EquipmentInventoryStats
  bundleAddAvailability: (
    bundleId: string,
    selectedQuantities?: Record<string, number>,
    extraReserved?: Record<string, number>,
    equipmentById?: Record<string, Equipment>
  ) => BundleAddAvailability
  equipmentsOrderedLikeManagement: (category: EquCategory, pool: Equipment[]) => Equipment[]
  equipmentsOrderedLikeManagementAll: (pool: Equipment[]) => Equipment[]
  equipmentsMatchingSearch: (searchText: string, pool?: Equipment[]) => Equipment[]
  equipmentGroupLabel: (equipment: Equipment) => string
  groupDisplayPath: (group: EquipmentGroup) => string
}

const DataContext = createContext<DataContextValue | null>(null)

function buildContextValue(): DataContextValue {
  return {
    store: dataStore,
    equipments: dataStore.equipments,
    equipmentGroups: dataStore.equipmentGroups,
    equipmentBundles: dataStore.equipmentBundles,
    customers: dataStore.customers,
    orders: dataStore.orders,
    oaReports: dataStore.oaReports,
    crews: dataStore.crews,
    introducers: dataStore.introducers,
    appAdmins: dataStore.appAdmins,
    appUsers: dataStore.appUsers,
    isSyncing: dataStore.isSyncing,
    lastSyncTime: dataStore.lastSyncTime,
    syncProgress: dataStore.syncProgress,
    loadError: dataStore.loadError,
    initialLoad: () => dataStore.initialLoad(),
    fullRefresh: () => dataStore.fullRefresh(),
    syncData: () => dataStore.syncData(),
    loadEquipments: () => dataStore.loadEquipments(),
    saveEquipments: (items) => dataStore.saveEquipments(items),
    addEquipment: (equipment) => dataStore.addEquipment(equipment),
    updateEquipment: (equipment) => dataStore.updateEquipment(equipment),
    deleteEquipment: (id) => dataStore.deleteEquipment(id),
    moveEquipmentToGroup: (equipmentId, groupId) =>
      dataStore.moveEquipmentToGroup(equipmentId, groupId),
    loadEquipmentGroups: () => dataStore.loadEquipmentGroups(),
    saveEquipmentGroups: (groups) => dataStore.saveEquipmentGroups(groups),
    createEquipmentGroup: (name, category, parentId) =>
      dataStore.createEquipmentGroup(name, category, parentId ?? null),
    updateEquipmentGroup: (group) => dataStore.updateEquipmentGroup(group),
    deleteEquipmentGroup: (id) => dataStore.deleteEquipmentGroup(id),
    loadEquipmentBundles: () => dataStore.loadEquipmentBundles(),
    saveEquipmentBundle: (bundle) => dataStore.saveEquipmentBundle(bundle),
    createEquipmentBundle: (name, note, equipmentIds) =>
      dataStore.createEquipmentBundle(name, note, equipmentIds),
    updateEquipmentBundle: (bundle) => dataStore.updateEquipmentBundle(bundle),
    deleteEquipmentBundle: (id) => dataStore.deleteEquipmentBundle(id),
    loadCustomers: () => dataStore.loadCustomers(),
    saveCustomer: (customer) => dataStore.saveCustomer(customer),
    deleteCustomer: (id) => dataStore.deleteCustomer(id),
    loadCrews: () => dataStore.loadCrews(),
    saveCrew: (crew) => dataStore.saveCrew(crew),
    deleteCrew: (id) => dataStore.deleteCrew(id),
    loadIntroducers: () => dataStore.loadIntroducers(),
    saveIntroducer: (introducer) => dataStore.saveIntroducer(introducer),
    deleteIntroducer: (id) => dataStore.deleteIntroducer(id),
    loadOrders: () => dataStore.loadOrders(),
    saveOrder: (order) => dataStore.saveOrder(order),
    saveOrders: (orders, reloadFromCloud) => dataStore.saveOrders(orders, reloadFromCloud),
    deleteOrder: (id) => dataStore.deleteOrder(id),
    reserveEquipment: (order) => dataStore.reserveEquipment(order),
    releaseEquipment: (order) => dataStore.releaseEquipment(order),
    updateEquipmentForOrder: (oldOrder, newOrder) =>
      dataStore.updateEquipmentForOrder(oldOrder, newOrder),
    loadOAReports: () => dataStore.loadOAReports(),
    submitOAReport: (params) => dataStore.submitOAReport(params),
    approveOAReport: (id, approver) => dataStore.approveOAReport(id, approver),
    rejectOAReport: (id, approver) => dataStore.rejectOAReport(id, approver),
    confirmOAReportExecuted: (id, operator) =>
      dataStore.confirmOAReportExecuted(id, operator),
    updateOAReport: (params) => dataStore.updateOAReport(params),
    deleteOAReport: (id, operator) => dataStore.deleteOAReport(id, operator),
    loadAppAdmins: () => dataStore.loadAppAdmins(),
    loadAppUsers: () => dataStore.loadAppUsers(),
    loadAdminManagementData: () => dataStore.loadAdminManagementData(),
    addAppAdmin: (username, createdBy) => dataStore.addAppAdmin(username, createdBy),
    removeAppAdmin: (username) => dataStore.removeAppAdmin(username),
    deleteAppUser: (id, username) => dataStore.deleteAppUser(id, username),
    isAdminUsername: (username) => dataStore.isAdminUsername(username),
    appAdminUsernames: () => dataStore.appAdminUsernames(),
    getPaymentRecords: (orderId) => dataStore.getPaymentRecords(orderId),
    totalPaidAmount: (orderId) => dataStore.totalPaidAmount(orderId),
    resolvedPayStatus: (order, totalPaid) => dataStore.resolvedPayStatus(order, totalPaid),
    savePaymentRecord: (orderId, record) => dataStore.savePaymentRecord(orderId, record),
    maintenanceQuantity: (equipmentId, excludingReportId) =>
      dataStore.maintenanceQuantity(equipmentId, excludingReportId),
    rentableStock: (equipment, excludingReportId) =>
      dataStore.rentableStock(equipment, excludingReportId),
    inventoryStats: (forEquipments) => dataStore.inventoryStats(forEquipments),
    bundleAddAvailability: (bundleId, selectedQuantities, extraReserved, equipmentById) =>
      dataStore.bundleAddAvailability(
        bundleId,
        selectedQuantities,
        extraReserved,
        equipmentById
      ),
    equipmentsOrderedLikeManagement: (category, pool) =>
      dataStore.equipmentsOrderedLikeManagement(category, pool),
    equipmentsOrderedLikeManagementAll: (pool) =>
      dataStore.equipmentsOrderedLikeManagementAll(pool),
    equipmentsMatchingSearch: (searchText, pool) =>
      dataStore.equipmentsMatchingSearch(searchText, pool),
    equipmentGroupLabel: (equipment) => dataStore.equipmentGroupLabel(equipment),
    groupDisplayPath: (group) => dataStore.groupDisplayPath(group),
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { session, isLoading: authLoading } = useAuth()
  const [revision, setRevision] = useState(dataStore.revision)

  useEffect(() => {
    return dataStore.subscribe(() => {
      setRevision(dataStore.revision)
    })
  }, [])

  useEffect(() => {
    if (authLoading) return

    if (!session) {
      dataStore.clearAll()
      return
    }

    let cancelled = false

    ;(async () => {
      const {
        data: { session: liveSession },
      } = await supabase.auth.getSession()
      if (cancelled || !liveSession) return

      await dataStore.initialLoad()
      if (!cancelled) dataStore.startAutoRefresh()
    })()

    return () => {
      cancelled = true
      dataStore.stopAutoRefresh()
    }
  }, [session, authLoading])

  // revision 变化时重建 context，确保页面拿到最新数组
  void revision
  const value = buildContextValue()

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
