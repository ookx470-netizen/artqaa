import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { Shell, Protected } from '@/components/shell';
import { LoginPage, RegisterPage } from '@/pages/auth';
import { DashboardPage, WalletPage, ProfilePage } from '@/pages/member';
import { DepositsPage } from '@/pages/deposits';
import { PlansPage, AboutPage } from '@/pages/public';
import { TeamPage } from '@/pages/team';
import { AdminPage } from '@/pages/admin';
import { TasksPage } from '@/pages/tasks';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: (count, err) => {
        const s = (err as { status?: number })?.status;
        if (s === 401 || s === 403 || s === 404) return false;
        return count < 2;
      },
    },
  },
});

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/plans">{() => <Shell><PlansPage /></Shell>}</Route>
        <Route path="/about">{() => <Shell><AboutPage /></Shell>}</Route>
        <Route path="/dashboard">{() => <Protected><DashboardPage /></Protected>}</Route>
        <Route path="/tasks">{() => <Protected><TasksPage /></Protected>}</Route>
        <Route path="/deposits">{() => <Protected><DepositsPage /></Protected>}</Route>
        <Route path="/wallet">{() => <Protected><WalletPage /></Protected>}</Route>
        <Route path="/profile">{() => <Protected><ProfilePage /></Protected>}</Route>
        <Route path="/team">{() => <Protected><TeamPage /></Protected>}</Route>
        <Route path="/admin">{() => <Protected admin><AdminPage /></Protected>}</Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
