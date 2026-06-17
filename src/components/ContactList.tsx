import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { requirePasswordForAction } from '../lib/password'
import { PasswordModal } from './PasswordModal'

export interface ContactItem {
  id: string
  name: string
  phone: string
  note: string
}

interface ContactListProps {
  title: string
  items: ContactItem[]
  emptyText?: string
  onSave: (item: ContactItem) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onNew?: () => ContactItem
}

export function ContactList({
  title,
  items,
  emptyText = '暂无数据',
  onSave,
  onDelete,
  onNew,
}: ContactListProps) {
  const { isAdmin } = useAuth()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<ContactItem | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ContactItem | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [passwordAction, setPasswordAction] = useState<'delete' | 'edit' | null>(null)
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.phone.toLowerCase().includes(q) ||
        item.note.toLowerCase().includes(q)
    )
  }, [items, search])

  const startNew = () => {
    const item = onNew?.() ?? {
      id: crypto.randomUUID(),
      name: '',
      phone: '',
      note: '',
    }
    setEditing(item)
    setShowForm(true)
  }

  const startEdit = (item: ContactItem) => {
    if (requirePasswordForAction(isAdmin)) {
      setEditing(item)
      setPasswordAction('edit')
      setShowPassword(true)
      return
    }
    setEditing({ ...item })
    setShowForm(true)
  }

  const startDelete = (item: ContactItem) => {
    if (requirePasswordForAction(isAdmin)) {
      setPendingDelete(item)
      setPasswordAction('delete')
      setShowPassword(true)
      return
    }
    setPendingDelete(item)
  }

  const handlePasswordConfirm = () => {
    setShowPassword(false)
    if (passwordAction === 'edit' && editing) {
      setShowForm(true)
    } else if (passwordAction === 'delete' && pendingDelete) {
      void confirmDelete()
    }
    setPasswordAction(null)
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    await onDelete(pendingDelete.id)
    setPendingDelete(null)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing?.name.trim()) return
    setSaving(true)
    try {
      await onSave({ ...editing, name: editing.name.trim() })
      setShowForm(false)
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-header-row">
          <div>
            <h2>{title}</h2>
            <p className="muted">共 {filtered.length} 条</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={startNew}>
            新建
          </button>
        </div>
        <input
          className="search-input"
          placeholder="搜索姓名、电话或备注"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </section>

      <div className="card-list">
        {filtered.map((item) => (
          <article key={item.id} className="data-card">
            <div className="data-card__header">
              <h3>{item.name}</h3>
              <div className="inline-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(item)}>
                  编辑
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-danger-text"
                  onClick={() => startDelete(item)}
                >
                  删除
                </button>
              </div>
            </div>
            <p className="muted">电话：{item.phone || '—'}</p>
            {item.note ? <p>{item.note}</p> : null}
          </article>
        ))}
        {filtered.length === 0 ? <p className="muted page-center">{emptyText}</p> : null}
      </div>

      {showForm && editing ? (
        <div className="modal-overlay" role="presentation" onClick={() => setShowForm(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{items.some((i) => i.id === editing.id) ? '编辑' : '新建'}</h3>
            <form className="form-stack" onSubmit={(e) => void handleSave(e)}>
              <label>
                姓名
                <input
                  className="form-input"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  required
                />
              </label>
              <label>
                电话
                <input
                  className="form-input"
                  value={editing.phone}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                />
              </label>
              <label>
                备注
                <textarea
                  className="form-input"
                  rows={3}
                  value={editing.note}
                  onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? '保存中…' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {pendingDelete && !showPassword ? (
        <div className="modal-overlay" role="presentation">
          <div className="modal-card">
            <h3>确认删除</h3>
            <p>确定删除「{pendingDelete.name}」吗？</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setPendingDelete(null)}>
                取消
              </button>
              <button type="button" className="btn btn-primary btn-danger" onClick={() => void confirmDelete()}>
                删除
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PasswordModal
        open={showPassword}
        onConfirm={handlePasswordConfirm}
        onCancel={() => {
          setShowPassword(false)
          setPasswordAction(null)
          setPendingDelete(null)
          setEditing(null)
        }}
      />
    </div>
  )
}
