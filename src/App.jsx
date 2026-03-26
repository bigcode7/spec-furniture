import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig, NO_LAYOUT_PAGES } from './pages.config'
import { Suspense } from 'react'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { GuestGateProvider } from '@/lib/GuestGate';
import { TradePricingProvider } from '@/lib/TradePricingContext';
import AuthModal from '@/components/AuthModal';
import OnboardingFlow from '@/components/OnboardingFlow';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { showOnboarding, completeOnboarding } = useAuth();
  return (
    <TradePricingProvider>
      <OnboardingFlow show={showOnboarding} onComplete={completeOnboarding} />
      <Routes>
        {/* No-layout pages (e.g. Admin) */}
        {Object.entries(NO_LAYOUT_PAGES).map(([path, { component: Comp }]) => (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <Suspense fallback={null}>
                <Comp />
              </Suspense>
            }
          />
        ))}
        <Route path="/" element={
          <LayoutWrapper currentPageName={mainPageKey}>
            <MainPage />
          </LayoutWrapper>
        } />
        {Object.entries(Pages).map(([path, Page]) => (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            }
          />
        ))}
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </TradePricingProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <GuestGateProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
            <AuthModal />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </GuestGateProvider>
    </AuthProvider>
  )
}

export default App
