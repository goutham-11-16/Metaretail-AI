import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { CamerasPage } from './pages/CamerasPage';
import { ProductsPage } from './pages/ProductsPage';
import { ZonesPage } from './pages/ZonesPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { InteractionsPage } from './pages/InteractionsPage';
import { AlertsPage } from './pages/AlertsPage';
import { EventLogPage } from './pages/EventLogPage';
import { SettingsPage } from './pages/SettingsPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { FloorplanPage } from './pages/FloorplanPage';
import { PlanogramPage } from './pages/PlanogramPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="cameras" element={<CamerasPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="floorplan" element={<FloorplanPage />} />
          <Route path="planogram" element={<PlanogramPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="zones" element={<ZonesPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="interactions" element={<InteractionsPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="events" element={<EventLogPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
