import { Navigate } from 'react-router-dom'
import { MenuButton } from '../../components/MenuButton'
import { PageToolbar } from '../../components/PageToolbar'
import { useAuth } from '../../context/AuthContext'

export function PersonHubPage() {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/" replace />

  return (
    <div className="stack">
      <PageToolbar title="人员信息" />
      <div className="menu-grid">
        <MenuButton title="客户信息" icon="👤" to="/people/customers" subtitle="客户档案管理" />
        <MenuButton title="跟机员信息" icon="🎬" to="/people/crews" subtitle="跟机员档案" />
        <MenuButton title="介绍人信息" icon="🤝" to="/people/introducers" subtitle="介绍人档案" />
      </div>
    </div>
  )
}
