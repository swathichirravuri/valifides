import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ValifidesProvider } from "@/context/ValifidesContext";
import OverviewPage from "./pages/OverviewPage";
import GatewayPage from "./pages/GatewayPage";
import ReplayPage from "./pages/ReplayPage";
import EscalationsPage from "./pages/EscalationsPage";
import EvidencePage from "./pages/EvidencePage";
import RulePackPage from "./pages/RulePackPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ValifidesProvider>
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/gateway" element={<GatewayPage />} />
            <Route path="/replay" element={<ReplayPage />} />
            <Route path="/escalations" element={<EscalationsPage />} />
            <Route path="/evidence" element={<EvidencePage />} />
            <Route path="/rules" element={<RulePackPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ValifidesProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
