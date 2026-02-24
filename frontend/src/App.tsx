import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Banks from "./pages/Banks";
import Bills from "./pages/Bills";
import Invoices from "./pages/Invoices";
import Vendors from "./pages/Vendors";
import Customers from "./pages/Customers";
import Financials from "./pages/Financials";
import Accounting from "./pages/Accounting";
import Documents from "./pages/Documents";
import Budget from "./pages/Budget";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Integrations from "./pages/Integrations";
import IntegrationCallback from "./pages/IntegrationCallback";
import SyncHistory from "./pages/SyncHistory";
import Reconciliation from "./pages/Reconciliation";
import PayablesReceivables from "./pages/PayablesReceivables";
import Ledger from "./pages/Ledger";
import Admin from "./pages/Admin";
import InvoiceFormPage from "./pages/InvoiceFormPage";
import AdminUserDashboard from "./pages/AdminUserDashboard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,       // 5 min — skip refetch on navigation
      gcTime: 10 * 60 * 1000,         // 10 min — keep cache in memory
      refetchOnWindowFocus: false,     // don't refetch when switching browser tabs
      retry: 1,                       // only retry once on network failure
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
          <Route path="/" element={<P><Index /></P>} />
          <Route path="/banks" element={<P><Banks /></P>} />
          <Route path="/bills" element={<P><Bills /></P>} />
          <Route path="/invoices" element={<P><Invoices /></P>} />
          <Route path="/invoices/new" element={<P><InvoiceFormPage /></P>} />
          <Route path="/invoices/:id/edit" element={<P><InvoiceFormPage /></P>} />
          <Route path="/vendors" element={<P><Vendors /></P>} />
          <Route path="/customers" element={<P><Customers /></P>} />
          <Route path="/financials" element={<P><Financials /></P>} />
          <Route path="/accounting" element={<P><Accounting /></P>} />
          <Route path="/documents" element={<P><Documents /></P>} />
          <Route path="/budget" element={<P><Budget /></P>} />
          <Route path="/settings" element={<P><Settings /></P>} />
          <Route path="/integrations" element={<P><Integrations /></P>} />
          <Route path="/integrations/callback/:provider" element={<IntegrationCallback />} />
          <Route path="/sync-history" element={<P><SyncHistory /></P>} />
          <Route path="/reconciliation" element={<P><Reconciliation /></P>} />
          <Route path="/payables-receivables" element={<P><PayablesReceivables /></P>} />
          <Route path="/ledger" element={<P><Ledger /></P>} />
          <Route path="/admin" element={<P><Admin /></P>} />
          <Route path="/admin/user/:userId" element={<P><AdminUserDashboard /></P>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
