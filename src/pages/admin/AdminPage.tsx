import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { PageToolbar } from '../../components/PageToolbar'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { createAccountAsSuperAdmin } from '../../lib/createAccount'
import { SUPER_ADMIN_USERNAME } from '../../lib/auth'
import { appUserRole } from '../../types/models'

export function AdminPage() {
  const { isSuperAdmin, refreshAdmins } = useAuth()
  const {
    appAdmins,
    appUsers,
    loadAdminManagementData,
    addAppAdmin,
    removeAppAdmin,
    deleteAppUser,
    appAdminUsernames,
  } = useData()

  const [newAdminUsername, setNewAdminUsername] = useState('')
  const [newAccountUsername, setNewAccountUsername] = useState('')
  const [newAccountPassword, setNewAccountPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isSuperAdmin) void loadAdminManagementData()
  }, [isSuperAdmin, loadAdminManagementData])

  const adminSet = useMemo(() => new Set(appAdminUsernames()), [appAdminUsernames, appAdmins])

  const sortedUsers = useMemo(
    () =>
      [...appUsers].sort((a, b) => {
        const order = { 超级管理员: 0, 管理员: 1, 普通用户: 2 }
        const ra = appUserRole(a, adminSet, SUPER_ADMIN_USERNAME)
        const rb = appUserRole(b, adminSet, SUPER_ADMIN_USERNAME)
        const diff = order[ra] - order[rb]
        if (diff !== 0) return diff
        return a.username.localeCompare(b.username, 'zh-CN')
      }),
    [appUsers, adminSet]
  )

  if (!isSuperAdmin) return <Navigate to="/" replace />

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <PageToolbar
        title="管理员管理"
        actions={
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void loadAdminManagementData()}>
            刷新
          </button>
        }
      />

      <section className="panel">
        <p className="muted">
          仅「{SUPER_ADMIN_USERNAME}」可注册、删除账号并管理权限。登录页已关闭自助注册，新用户须在此创建账号。
        </p>
      </section>

      <section className="panel form-stack">
        <h3>注册新账号</h3>
        <label>
          用户名（支持中文）
          <input className="form-input" value={newAccountUsername} onChange={(e) => setNewAccountUsername(e.target.value)} />
        </label>
        <label>
          初始密码（至少 6 位）
          <input
            type="password"
            className="form-input"
            value={newAccountPassword}
            onChange={(e) => setNewAccountPassword(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || newAccountUsername.trim().length === 0 || newAccountPassword.length < 6}
          onClick={() =>
            void run(async () => {
              const err = await createAccountAsSuperAdmin(newAccountUsername, newAccountPassword)
              if (err) setError(err)
              else {
                setNewAccountUsername('')
                setNewAccountPassword('')
                await loadAdminManagementData()
              }
            })
          }
        >
          创建账号
        </button>
      </section>

      <section className="panel form-stack">
        <h3>手动添加管理员</h3>
        <div className="form-row">
          <input
            className="form-input"
            placeholder="用户名（须与登录名一致）"
            value={newAdminUsername}
            onChange={(e) => setNewAdminUsername(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !newAdminUsername.trim()}
            onClick={() =>
              void run(async () => {
                const err = await addAppAdmin(newAdminUsername.trim(), SUPER_ADMIN_USERNAME)
                if (err) setError(err)
                else {
                  setNewAdminUsername('')
                  await refreshAdmins()
                }
              })
            }
          >
            添加
          </button>
        </div>
      </section>

      <section className="panel">
        <h3>当前管理员（{appAdmins.length}）</h3>
        <p>超级管理员：{SUPER_ADMIN_USERNAME}</p>
        <ul className="simple-list">
          {appAdmins.map((admin) => (
            <li key={admin.id} className="admin-row">
              <span>
                {admin.username}
                {admin.createdBy ? <span className="muted"> · 设置人：{admin.createdBy}</span> : null}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-danger-text"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const err = await removeAppAdmin(admin.username)
                    if (err) setError(err)
                    else await refreshAdmins()
                  })
                }
              >
                移除
              </button>
            </li>
          ))}
          {appAdmins.length === 0 ? <li className="muted">暂无其他管理员</li> : null}
        </ul>
      </section>

      <section className="panel">
        <h3>全部账号（{appUsers.length}）</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>用户名</th>
              <th>角色</th>
              <th>邮箱</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((user) => {
              const role = appUserRole(user, adminSet, SUPER_ADMIN_USERNAME)
              const isSuper = user.username === SUPER_ADMIN_USERNAME
              return (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>{role}</td>
                  <td>{user.email}</td>
                  <td>
                    {!isSuper ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-danger-text"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            const err = await deleteAppUser(user.id, user.username)
                            if (err) setError(err)
                            else await refreshAdmins()
                          })
                        }
                      >
                        删除
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {appUsers.length === 0 ? <p className="muted">暂无账号数据</p> : null}
      </section>

      {error ? <p className="error-text">{error}</p> : null}
    </div>
  )
}
