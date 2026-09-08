import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { BottomNav } from './components/BottomNav';
import { LoginScreen } from './components/LoginScreen';
import { SplashScreen } from './components/SplashScreen';
import { FetchErrorCard } from './components/FetchErrorCard';
import { TournamentProvider } from './context/TournamentContext';
import { FinanceProvider } from './context/FinanceContext';
import { ProfileProvider } from './context/ProfileContext';
import { UserProvider, useUser } from './context/UserContext';
import { BlindsProvider } from './context/BlindsContext';
import { RubyBonusHost } from './components/RubyBonusHost';
import { supabase } from './lib/supabase';
import { clearLegacyIdentityCache } from './lib/session';
import {
  resolveStartupView,
  STARTUP_TIMEOUT_MS,
  startupStageLabel,
  type StartupStage,
} from './lib/startupState';
import { forceFreshPageLoad, loadWithChunkRecovery } from './lib/chunkRecovery';
import { ChunkLoadErrorBoundary } from './components/ChunkLoadErrorBoundary';
import { requestErrorMessage, withRequestDeadline } from './lib/network';
import { AdminRoute } from './components/AdminRoute';
import { lookupSessionAccount, type MappedUser } from './lib/userApi';

const HomePage = lazy(() => loadWithChunkRecovery(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage }))));
const TournamentsPage = lazy(() => loadWithChunkRecovery(() => import('./pages/TournamentsPage').then((module) => ({ default: module.TournamentsPage }))));
const TournamentDetailRoute = lazy(() => loadWithChunkRecovery(() => import('./pages/TournamentDetailRoute').then((module) => ({ default: module.TournamentDetailRoute }))));
const RatingPage = lazy(() => loadWithChunkRecovery(() => import('./pages/RatingPage').then((module) => ({ default: module.RatingPage }))));
const ProfilePage = lazy(() => loadWithChunkRecovery(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage }))));
const SettingsPage = lazy(() => loadWithChunkRecovery(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage }))));
const ShopScreen = lazy(() => loadWithChunkRecovery(() => import('./pages/ShopScreen').then((module) => ({ default: module.ShopScreen }))));
const AboutClubScreen = lazy(() => loadWithChunkRecovery(() => import('./pages/AboutClubScreen').then((module) => ({ default: module.AboutClubScreen }))));
const QnAScreen = lazy(() => loadWithChunkRecovery(() => import('./pages/QnAScreen').then((module) => ({ default: module.QnAScreen }))));
const AchievementsScreen = lazy(() => loadWithChunkRecovery(() => import('./pages/AchievementsScreen').then((module) => ({ default: module.AchievementsScreen }))));
const AdminUsersScreen = lazy(() => loadWithChunkRecovery(() => import('./pages/admin/AdminUsersScreen').then((module) => ({ default: module.AdminUsersScreen }))));
const AdminTournamentsScreen = lazy(() => loadWithChunkRecovery(() => import('./pages/admin/AdminTournamentsScreen').then((module) => ({ default: module.AdminTournamentsScreen }))));
const AdminTournamentEditor = lazy(() => loadWithChunkRecovery(() => import('./pages/admin/AdminTournamentEditor').then((module) => ({ default: module.AdminTournamentEditor }))));
const AdminBlindsSettings = lazy(() => loadWithChunkRecovery(() => import('./pages/admin/AdminBlindsSettings').then((module) => ({ default: module.AdminBlindsSettings }))));
const AdminBlindsTimer = lazy(() => loadWithChunkRecovery(() => import('./pages/admin/AdminBlindsTimer').then((module) => ({ default: module.AdminBlindsTimer }))));
const AdminAchievementsUsers = lazy(() => loadWithChunkRecovery(() => import('./pages/admin/AdminAchievementsUsers').then((module) => ({ default: module.AdminAchievementsUsers }))));
const AdminAchievementsEditor = lazy(() => loadWithChunkRecovery(() => import('./pages/admin/AdminAchievementsEditor').then((module) => ({ default: module.AdminAchievementsEditor }))));
const AdminFinanceScreen = lazy(() => loadWithChunkRecovery(() => import('./pages/admin/AdminFinanceScreen').then((module) => ({ default: module.AdminFinanceScreen }))));
const AdminTournamentFinance = lazy(() => loadWithChunkRecovery(() => import('./pages/admin/AdminTournamentFinance').then((module) => ({ default: module.AdminTournamentFinance }))));
const AdminRubyScreen = lazy(() => loadWithChunkRecovery(() => import('./pages/admin/AdminRubyScreen').then((module) => ({ default: module.AdminRubyScreen }))));
const AdminStatisticScreen = lazy(() => loadWithChunkRecovery(() => import('./pages/admin/AdminStatisticScreen').then((module) => ({ default: module.AdminStatisticScreen }))));
const AdminLogsScreen = lazy(() => loadWithChunkRecovery(() => import('./pages/admin/AdminLogsScreen').then((module) => ({ default: module.AdminLogsScreen }))));

const NAV_HEIGHT = '5rem';
const HIDE_NAV_PATH = /^\/(tournaments\/[^/]+|settings|shop|about|qa|achievements(?:\/[^/]+)?|admin\/.+)$/;
const shellClass = 'w-full min-h-screen bg-black flex justify-center';
const columnClass = 'relative w-full max-w-[480px] overflow-hidden shadow-2xl';

function StartupScreenFallback({ deadlineAt }: { deadlineAt: number }) {
  const [timedOut, setTimedOut] = useState(() => Date.now() >= deadlineAt);

  useEffect(() => {
    const remaining = Math.max(0, deadlineAt - Date.now());
    setTimedOut(remaining === 0);
    if (remaining === 0) return;
    const timer = window.setTimeout(() => setTimedOut(true), remaining);
    return () => window.clearTimeout(timer);
  }, [deadlineAt]);

  if (timedOut) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[#0A0908]">
        <FetchErrorCard
          message="Экран не открылся за 10 секунд. Проверьте интернет и повторите загрузку."
          onRetry={() => forceFreshPageLoad()}
        />
      </div>
    );
  }

  return <SplashScreen label={startupStageLabel('screen')} />;
}

function AppLayout({ startupDeadlineAt }: { startupDeadlineAt: number }) {
  const { email } = useUser();
  const location = useLocation();
  const hideNav = HIDE_NAV_PATH.test(location.pathname);
  const isBlindsTimer = location.pathname === '/admin/blinds/timer';

  const contentPaddingBottom = hideNav
    ? 'env(safe-area-inset-bottom, 0px)'
    : `calc(env(safe-area-inset-bottom, 0px) + ${NAV_HEIGHT})`;

  if (isBlindsTimer) {
    return (
      <AdminRoute>
        <div className="w-full h-[100dvh] overflow-hidden bg-[#0A0908]">
          <AdminBlindsTimer />
          <RubyBonusHost />
        </div>
      </AdminRoute>
    );
  }

  return (
    <div className={columnClass} style={{ height: '100dvh' }}>
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ paddingBottom: contentPaddingBottom }}
      >
        <div className="h-full">
          <ChunkLoadErrorBoundary>
            <Suspense fallback={<StartupScreenFallback deadlineAt={startupDeadlineAt} />}>
              <Routes>
            <Route path="/"                  element={<HomePage />} />
            <Route path="/tournaments"       element={<TournamentsPage />} />
            <Route path="/tournaments/:id"   element={<TournamentDetailRoute />} />
            <Route path="/rating"            element={<RatingPage />} />
            <Route path="/profile"           element={<ProfilePage />} />
            <Route path="/profile/:playerId" element={<ProfilePage />} />
            <Route path="/settings"          element={<SettingsPage userEmail={email} />} />
            <Route path="/shop"              element={<ShopScreen />} />
            <Route path="/about"             element={<AboutClubScreen />} />
            <Route path="/qa"                element={<QnAScreen />} />
            <Route path="/achievements"      element={<AchievementsScreen />} />
            <Route path="/achievements/:playerId" element={<AchievementsScreen />} />
            <Route element={<AdminRoute />}>
              <Route path="/admin/tournaments"     element={<AdminTournamentsScreen />} />
              <Route path="/admin/tournaments/:id" element={<AdminTournamentEditor />} />
              <Route path="/admin/blinds"          element={<Navigate to="/admin/blinds/settings" replace />} />
              <Route path="/admin/blinds/settings" element={<AdminBlindsSettings />} />
              <Route path="/admin/blinds/timer"    element={<AdminBlindsTimer />} />
              <Route path="/admin/finance"         element={<AdminFinanceScreen />} />
              <Route path="/admin/finance/tournaments/:id" element={<AdminTournamentFinance />} />
              <Route path="/admin/ruby"            element={<AdminRubyScreen />} />
              <Route path="/admin/statistic"       element={<AdminStatisticScreen />} />
              <Route path="/admin/achievements/users"      element={<AdminAchievementsUsers />} />
              <Route path="/admin/achievements/edit/:userId" element={<AdminAchievementsEditor />} />
              <Route path="/admin/*" element={<Navigate to="/profile" replace />} />
            </Route>
            <Route element={<AdminRoute requiredRole="superadmin" />}>
              <Route path="/admin/users" element={<AdminUsersScreen />} />
              <Route path="/admin/logs" element={<AdminLogsScreen />} />
            </Route>
            <Route path="*"                  element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ChunkLoadErrorBoundary>
        </div>
      </div>

      {!hideNav && <BottomNav />}
      <RubyBonusHost />
    </div>
  );
}

function SplashShell({ stage = 'application' }: { stage?: StartupStage }) {
  return (
    <div className={shellClass}>
      <div className={columnClass} style={{ height: '100dvh' }}>
        <SplashScreen label={startupStageLabel(stage)} />
      </div>
    </div>
  );
}

function AuthenticatedApp({
  startupDeadlineAt,
}: {
  startupDeadlineAt: number;
}) {
  const { account, isLoading, refreshAccount } = useUser();
  const startupView = resolveStartupView({
    showSplash: false,
    isLoading,
    hasAccount: Boolean(account),
  });
  if (startupView === 'loading') {
    return <SplashShell stage="account" />;
  }

  if (startupView === 'error') {
    return (
      <div className={shellClass}>
        <div className={`${columnClass} flex min-h-screen items-center justify-center bg-[#0A0908]`}>
          <FetchErrorCard
            message="Не удалось связаться с сервером. Проверьте интернет и попробуйте ещё раз."
            onRetry={() => void refreshAccount()}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <ProfileProvider>
        <TournamentProvider>
          <FinanceProvider>
            <BlindsProvider>
              <AppLayout startupDeadlineAt={startupDeadlineAt} />
            </BlindsProvider>
          </FinanceProvider>
        </TournamentProvider>
      </ProfileProvider>
    </div>
  );
}

function bootTelegramWebApp() {
  try {
    WebApp.ready();
  } catch {
    /* Telegram WebApp is missing in a regular browser */
  }
  try {
    WebApp.expand();
  } catch {
    /* expand() is unsupported outside Telegram */
  }
  try {
    WebApp.setHeaderColor('#110b09');
  } catch {
    /* setHeaderColor is missing or unsupported */
  }
  try {
    WebApp.setBackgroundColor('#110b09');
  } catch {
    /* setBackgroundColor is missing or unsupported */
  }
}

export default function App() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authenticatedAccount, setAuthenticatedAccount] = useState<MappedUser | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState('');
  const [restoreStage, setRestoreStage] = useState<StartupStage>('session');
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [startupDeadlineAt, setStartupDeadlineAt] = useState(
    () => Date.now() + STARTUP_TIMEOUT_MS,
  );

  useEffect(() => {
    let cancelled = false;
    let signedOut = false;
    let attemptActive = true;
    setStartupDeadlineAt(Date.now() + STARTUP_TIMEOUT_MS);
    clearLegacyIdentityCache();
    setRestoring(true);
    setRestoreError('');
    setRestoreStage('session');
    setAuthenticatedAccount(null);
    void (async () => {
      try {
        await withRequestDeadline((async () => {
          const session = await supabase.auth.getSession();
          if (session.error) throw new Error('Session unavailable');
          if (!session.data.session || cancelled || signedOut || !attemptActive) return;

          setRestoreStage('account');
          const account = await lookupSessionAccount();
          if (account.status === 'error') throw new Error(account.message);
          if (account.status !== 'found' || cancelled || signedOut || !attemptActive) return;

          setAuthenticatedAccount(account.user);
          setIsAuthenticated(true);
        })(), STARTUP_TIMEOUT_MS);
      } catch (error) {
        attemptActive = false;
        if (!cancelled) {
          setRestoreError(requestErrorMessage(
            error,
            'Не удалось восстановить сессию. Проверьте связь и повторите попытку.',
          ));
        }
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      // SIGNED_IN is not sufficient: a new user may still need to accept consent
      // and bind/create the club profile. LoginScreen completes that operation.
      if (event === 'SIGNED_OUT') {
        signedOut = true;
        setAuthenticatedAccount(null);
        setIsAuthenticated(false);
      }
    });
    return () => {
      cancelled = true;
      attemptActive = false;
      data.subscription.unsubscribe();
    };
  }, [restoreAttempt]);

  useEffect(() => {
    bootTelegramWebApp();
  }, []);

  const handleLogin = useCallback((account: MappedUser) => {
    setAuthenticatedAccount(account);
    setStartupDeadlineAt(Date.now() + STARTUP_TIMEOUT_MS);
    setIsAuthenticated(true);
    navigate('/', { replace: true });
  }, [navigate]);

  const handleAccountInvalid = () => {
    // UserProvider already ends the Auth session; avoid a second concurrent logout.
    setAuthenticatedAccount(null);
    setIsAuthenticated(false);
    navigate('/', { replace: true });
  };

  if (restoring) return <SplashShell stage={restoreStage} />;
  if (restoreError) return (
    <div className={shellClass}>
      <FetchErrorCard message={restoreError}
        onRetry={() => {
          setStartupDeadlineAt(Date.now() + STARTUP_TIMEOUT_MS);
          setRestoreAttempt((value) => value + 1);
        }} />
    </div>
  );

  if (!isAuthenticated) {
    return (
      <div className={shellClass}>
        <div className={`${columnClass} h-[100dvh]`}>
          <LoginScreen onLogin={handleLogin} />
        </div>
      </div>
    );
  }

  return (
    <UserProvider initialAccount={authenticatedAccount} onAccountInvalid={handleAccountInvalid}>
      <AuthenticatedApp startupDeadlineAt={startupDeadlineAt} />
    </UserProvider>
  );
}
