import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";
import ControlCenter from "./pages/ControlCenter";
import Reconciliation from "./pages/Reconciliation";
import RevenueIntegrity from "./pages/RevenueIntegrity";
import ExpenseIntegrity from "./pages/ExpenseIntegrity";
import CashLiquidity from "./pages/CashLiquidity";
import FinancialReporting from "./pages/FinancialReporting";
import Integrations from "./pages/Integrations";
import RiskMonitor from "./pages/RiskMonitor";
import ControlSettings from "./pages/ControlSettings";
import InvoiceFormPage from "./pages/InvoiceFormPage";
import { AdminGuard } from "./components/admin/AdminGuard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminUserDetail from "./pages/admin/AdminUserDetail";
import AdminOrgs from "./pages/admin/AdminOrgs";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const P = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<P><Onboarding /></P>} />
          <Route path="/" element={<P><ControlCenter /></P>} />
          <Route path="/reconciliation" element={<P><Reconciliation /></P>} />
          <Route path="/revenue" element={<P><RevenueIntegrity /></P>} />
          <Route path="/revenue/invoices/new" element={<P><InvoiceFormPage /></P>} />
          <Route path="/expenses" element={<P><ExpenseIntegrity /></P>} />
          <Route path="/cash" element={<P><CashLiquidity /></P>} />
          <Route path="/reports" element={<P><FinancialReporting /></P>} />
          <Route path="/integrations" element={<P><Integrations /></P>} />
          <Route path="/risk" element={<P><RiskMonitor /></P>} />
          <Route path="/settings" element={<P><ControlSettings /></P>} />
          {/* Admin routes */}
          <Route path="/admin" element={<P><AdminGuard><AdminDashboard /></AdminGuard></P>} />
          <Route path="/admin/users" element={<P><AdminGuard><AdminUsers /></AdminGuard></P>} />
          <Route path="/admin/users/:userId" element={<P><AdminGuard><AdminUserDetail /></AdminGuard></P>} />
          <Route path="/admin/orgs" element={<P><AdminGuard><AdminOrgs /></AdminGuard></P>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
