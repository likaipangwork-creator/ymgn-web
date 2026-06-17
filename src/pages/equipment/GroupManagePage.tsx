import { useMemo, useState } from 'react'
import { PageToolbar } from '../../components/PageToolbar'
import { QRCodeDisplay } from '../../components/QRCodeDisplay'
import { useData } from '../../context/DataContext'
import type { EquCategory, EquipmentGroup } from '../../types/models'
import { EQU_CATEGORIES } from '../../types/models'

export function GroupManagePage() {
  const { equipmentGroups, createEquipmentGroup, updateEquipmentGroup, deleteEquipmentGroup, groupDisplayPath } =
    useData()
  const [category, setCategory] = useState<EquCategory>('摄影器材')
  const [newName, setNewName] = useState('')
  const [parentId, setParentId] = useState<string>('')

  const tree = useMemo(() => {
    const roots = equipmentGroups
      .filter((g) => g.category === category && g.parentId == null)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-CN'))

    const childrenOf = (pid: string): EquipmentGroup[] =>
      equipmentGroups
        .filter((g) => g.parentId === pid && g.category === category)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-CN'))

    const flatten = (groups: EquipmentGroup[], depth: number): { group: EquipmentGroup; depth: number }[] => {
      const result: { group: EquipmentGroup; depth: number }[] = []
      for (const g of groups) {
        result.push({ group: g, depth })
        result.push(...flatten(childrenOf(g.id), depth + 1))
      }
      return result
    }

    return flatten(roots, 0)
  }, [equipmentGroups, category])

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    await createEquipmentGroup(name, category, parentId || null)
    setNewName('')
    setParentId('')
  }

  return (
    <div className="stack">
      <PageToolbar backTo="/equipment" title="分组管理" />

      <div className="tab-bar">
        {EQU_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className={`tab-bar__item ${category === c ? 'tab-bar__item--active' : ''}`}
            onClick={() => setCategory(c)}
          >
            {c.replace('器材', '')}
          </button>
        ))}
      </div>

      <section className="panel form-stack">
        <h3>新建分组</h3>
        <label>
          分组名称
          <input className="form-input" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </label>
        <label>
          父分组
          <select className="form-input" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">无（顶级）</option>
            {tree.map(({ group, depth }) => (
              <option key={group.id} value={group.id}>
                {'　'.repeat(depth) + group.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-primary" onClick={() => void handleCreate()}>
          创建
        </button>
      </section>

      <div className="card-list">
        {tree.map(({ group, depth }) => (
          <article key={group.id} className="data-card">
            <div className="data-card__header">
              <h3>{'　'.repeat(depth)}{group.name}</h3>
              {!group.isDefault ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-danger-text"
                  onClick={() => void deleteEquipmentGroup(group.id)}
                >
                  删除
                </button>
              ) : null}
            </div>
            <p className="muted">{groupDisplayPath(group)}</p>
            <p className="muted">套餐码：{group.packageCode}</p>
            <QRCodeDisplay value={group.packageCode} size={120} />
            {!group.isDefault ? (
              <label>
                重命名
                <input
                  className="form-input"
                  defaultValue={group.name}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v && v !== group.name) void updateEquipmentGroup({ ...group, name: v })
                  }}
                />
              </label>
            ) : null}
          </article>
        ))}
        {tree.length === 0 ? <p className="muted page-center">暂无分组</p> : null}
      </div>
    </div>
  )
}
