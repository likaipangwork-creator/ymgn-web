import { useMemo, useState } from 'react'
import { BarcodeScanner } from '../components/BarcodeScanner'
import { EquipmentScanResultModal } from '../components/EquipmentScanResultModal'
import { MenuButton } from '../components/MenuButton'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { formatChineseDateTime } from '../lib/dates'
import { resolveEquipmentsByScanCode, type ScanResolveResult } from '../lib/equipmentScanLookup'

export function HomePage() {
  const { isAdmin, isSuperAdmin } = useAuth()
  const {
    isSyncing,
    lastSyncTime,
    fullRefresh,
    equipments,
    equipmentGroups,
    equipmentBundles,
    orders,
    customers,
    inventoryStats,
  } = useData()

  const [showScanner, setShowScanner] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResolveResult | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)

  const equipmentTotalUnits = useMemo(
    () => inventoryStats(equipments).totalUnits,
    [inventoryStats, equipments]
  )

  function handleScan(code: string) {
    const result = resolveEquipmentsByScanCode(code, {
      equipments,
      equipmentGroups,
      equipmentBundles,
    })
    if (result) {
      setScanResult(result)
      setScanError(null)
    } else {
      setScanResult(null)
      setScanError(`未找到条码：${code.trim()}`)
    }
    setShowResult(true)
  }

  function openScanner() {
    setShowScanner(true)
  }

  function closeResult() {
    setShowResult(false)
    setScanResult(null)
    setScanError(null)
  }

  return (
    <div className="stack">
      <section className="stats-strip" aria-label="数据概览">
        <div className="stats-strip__item">
          <span className="stats-strip__value">{equipmentTotalUnits}</span>
          <span className="stats-strip__label">器材</span>
        </div>
        <div className="stats-strip__item">
          <span className="stats-strip__value">{orders.length}</span>
          <span className="stats-strip__label">订单</span>
        </div>
        <div className="stats-strip__item">
          <span className="stats-strip__value">{customers.length}</span>
          <span className="stats-strip__label">客户</span>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header-row">
          <div>
            <h2>功能菜单</h2>
            <p className="muted sync-hint">
              {isSyncing
                ? '正在同步数据…'
                : lastSyncTime
                  ? `最后同步：${formatChineseDateTime(lastSyncTime)}`
                  : '点击同步获取最新数据'}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={isSyncing}
            onClick={() => void fullRefresh()}
          >
            {isSyncing ? '同步中…' : '↻ 同步'}
          </button>
        </div>
      </section>

      <div className="menu-grid">
        <MenuButton
          title="扫码查器材"
          icon="📷"
          subtitle="扫描条码查看库存与出租状态"
          onClick={openScanner}
        />
        <MenuButton title="租赁订单" icon="🛒" to="/orders" subtitle="查看与管理租赁订单" />
        <MenuButton title="OA 提报" icon="📄" to="/oa" subtitle="维修与采购申报" />
        {isAdmin ? (
          <MenuButton title="收银台" icon="💳" to="/cashier" subtitle="收款与订单付款" />
        ) : null}
        <MenuButton title="器材库存管理" icon="📦" to="/equipment" subtitle="库存、分组与套餐" />
        {isAdmin ? (
          <MenuButton title="人员信息" icon="👥" to="/people" subtitle="客户、跟机员、介绍人" />
        ) : null}
        {isAdmin ? (
          <MenuButton title="营业数据统计" icon="📊" to="/stats" subtitle="营收统计与导出" />
        ) : null}
        {isSuperAdmin ? (
          <MenuButton title="管理员管理" icon="🔑" to="/admin" subtitle="账号与权限管理" />
        ) : null}
      </div>

      <BarcodeScanner
        open={showScanner}
        onScan={handleScan}
        onClose={() => setShowScanner(false)}
        title="扫码查器材"
        hint="对准器材条码、文件夹码或套餐码"
      />

      <EquipmentScanResultModal
        open={showResult}
        result={scanResult}
        error={scanError}
        onClose={closeResult}
        onScanAgain={() => {
          closeResult()
          openScanner()
        }}
      />
    </div>
  )
}
