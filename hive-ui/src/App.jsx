import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import { AdminModeProvider } from './components/WithId'
import Landing from './pages/Landing'
import Cockpit from './pages/Cockpit'
import Screener from './pages/Screener'
import Map from './pages/Map'
import Report from './pages/Report'
import Dashboard from './pages/Dashboard'
import Jurisdictions from './pages/Jurisdictions'
import JurisdictionForm from './pages/JurisdictionForm'
import Calculator from './pages/Calculator'
import Admin from './pages/Admin'

function App() {
  return (
    <AdminModeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Landing />} />
            <Route path="cockpit" element={<Cockpit />} />
            <Route path="screener" element={<Screener />} />
            <Route path="map" element={<Map />} />
            <Route path="report" element={<Report />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="jurisdictions" element={<Jurisdictions />} />
            <Route path="jurisdiction/new" element={<JurisdictionForm />} />
            <Route path="jurisdiction/:id" element={<JurisdictionForm />} />
            <Route path="calculator" element={<Calculator />} />
            <Route path="admin" element={<Admin />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AdminModeProvider>
  )
}

export default App
