import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/banks" element={<Banks />} />
          <Route path="/bills" element={<Bills />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/vendors" element={<Vendors />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/financials" element={<Financials />} />
          <Route path="/accounting" element={<Accounting />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/budget" element={<Budget />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/integrations/callback/:provider" element={<IntegrationCallback />} />
          <Route path="/sync-history" element={<SyncHistory />} />
          <Route path="/reconciliation" element={<Reconciliation />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
