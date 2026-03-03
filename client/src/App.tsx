import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell.tsx";
import { DeployPage } from "./pages/DeployPage.tsx";
import { HistoryPage } from "./pages/HistoryPage.tsx";

export function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Navigate to="/deploy" replace />} />
          <Route path="/deploy" element={<DeployPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/history/:id" element={<HistoryPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
