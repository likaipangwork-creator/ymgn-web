import type { Equipment, EquipmentBundle, EquipmentGroup } from '../types/models'
import { isBundleCode, isPackageCode } from '../types/models'

export type ScanResolveKind = 'barcode' | 'group' | 'bundle'

export interface ScanResolveResult {
  kind: ScanResolveKind
  label: string
  code: string
  equipments: Equipment[]
}

function normalizeScanCode(code: string): string {
  return code.trim()
}

function findGroupByPackageCode(
  code: string,
  equipmentGroups: EquipmentGroup[]
): EquipmentGroup | undefined {
  const normalized = code.toUpperCase()
  return equipmentGroups.find((g) => g.packageCode.toUpperCase() === normalized)
}

function findBundleByPackageCode(
  code: string,
  equipmentBundles: EquipmentBundle[]
): EquipmentBundle | undefined {
  const normalized = code.toUpperCase()
  return equipmentBundles.find((b) => b.packageCode.toUpperCase() === normalized)
}

/** 与 iOS 扫码解析一致：条码 / PKG 文件夹码 / SET 套餐码 */
export function resolveEquipmentsByScanCode(
  rawCode: string,
  ctx: {
    equipments: Equipment[]
    equipmentGroups: EquipmentGroup[]
    equipmentBundles: EquipmentBundle[]
  }
): ScanResolveResult | null {
  const code = normalizeScanCode(rawCode)
  if (!code) return null

  if (isBundleCode(code)) {
    const bundle = findBundleByPackageCode(code, ctx.equipmentBundles)
    if (!bundle) return null
    const equipments = bundle.equipmentIds
      .map((id) => ctx.equipments.find((eq) => eq.id === id))
      .filter((eq): eq is Equipment => eq != null)
    return {
      kind: 'bundle',
      label: bundle.name,
      code: bundle.packageCode,
      equipments,
    }
  }

  if (isPackageCode(code)) {
    const group = findGroupByPackageCode(code, ctx.equipmentGroups)
    if (!group) return null
    const equipments = ctx.equipments
      .filter((eq) => eq.groupId === group.id)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-CN'))
    return {
      kind: 'group',
      label: group.name,
      code: group.packageCode,
      equipments,
    }
  }

  const equipment = ctx.equipments.find((eq) => eq.barcode === code)
  if (!equipment) return null
  return {
    kind: 'barcode',
    label: equipment.name,
    code: equipment.barcode,
    equipments: [equipment],
  }
}
