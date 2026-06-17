import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { AdminPage } from './pages/admin/AdminPage'
import { CashierPage } from './pages/cashier/CashierPage'
import { PaymentDetailPage } from './pages/cashier/PaymentDetailPage'
import { BundleManagePage } from './pages/equipment/BundleManagePage'
import { EditEquipmentPage } from './pages/equipment/EditEquipmentPage'
import { EquipmentFilterPage } from './pages/equipment/EquipmentFilterPage'
import { EquipmentManagePage } from './pages/equipment/EquipmentManagePage'
import { GroupManagePage } from './pages/equipment/GroupManagePage'
import { NewEquipmentPage } from './pages/equipment/NewEquipmentPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { EditOAPage } from './pages/oa/EditOAPage'
import { NewOAPage } from './pages/oa/NewOAPage'
import { OADetailPage } from './pages/oa/OADetailPage'
import { OAListPage } from './pages/oa/OAListPage'
import { EditOrderPage } from './pages/orders/EditOrderPage'
import { NewOrderPage } from './pages/orders/NewOrderPage'
import { OrderDetailPage } from './pages/orders/OrderDetailPage'
import { OrdersPage } from './pages/orders/OrdersPage'
import { ReturnOrderPage } from './pages/orders/ReturnOrderPage'
import { CrewsPage } from './pages/people/CrewsPage'
import { CustomersPage } from './pages/people/CustomersPage'
import { IntroducersPage } from './pages/people/IntroducersPage'
import { PersonHubPage } from './pages/people/PersonHubPage'
import { StatsPage } from './pages/stats/StatsPage'

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<HomePage />} />

                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/orders/new" element={<NewOrderPage />} />
                <Route path="/orders/:id" element={<OrderDetailPage />} />
                <Route path="/orders/:id/edit" element={<EditOrderPage />} />
                <Route path="/orders/:id/return" element={<ReturnOrderPage />} />

                <Route path="/equipment" element={<EquipmentManagePage />} />
                <Route path="/equipment/filter/:filter" element={<EquipmentFilterPage />} />
                <Route path="/equipment/new" element={<NewEquipmentPage />} />
                <Route path="/equipment/:id/edit" element={<EditEquipmentPage />} />
                <Route path="/equipment/groups" element={<GroupManagePage />} />
                <Route path="/equipment/bundles" element={<BundleManagePage />} />

                <Route path="/oa" element={<OAListPage />} />
                <Route path="/oa/new" element={<NewOAPage />} />
                <Route path="/oa/:id" element={<OADetailPage />} />
                <Route path="/oa/:id/edit" element={<EditOAPage />} />

                <Route path="/cashier" element={<CashierPage />} />
                <Route path="/cashier/:orderId" element={<PaymentDetailPage />} />

                <Route path="/people" element={<PersonHubPage />} />
                <Route path="/people/customers" element={<CustomersPage />} />
                <Route path="/people/crews" element={<CrewsPage />} />
                <Route path="/people/introducers" element={<IntroducersPage />} />

                <Route path="/stats" element={<StatsPage />} />
                <Route path="/admin" element={<AdminPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </DataProvider>
    </AuthProvider>
  )
}
