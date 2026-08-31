import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
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
import { AuditLogProvider } from './context/AuditLogContext';
import { BlindsProvider } from './context/BlindsContext';
import { RubyBonusHost } from './components/RubyBonusHost';
import { endLocalSession, readSessionEmail } from './lib/session';
import { resolveStartupView } from './lib/startupState';
import { loadWithChunkRecovery } from './lib/chunkRecovery';
import { ChunkLoadErrorBoundary } from './components/ChunkLoadErrorBoundary';

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
const SPLASH_MS = 2000;

const shellClass = 'w-full min-h-screen bg-black flex justify-center';
const columnClass = 'relative w-full max-w-[480px] overflow-hidden shadow-2xl';

interface AppLayoutProps {
  userEmail: string;
}

function AppLayout({ userEmail }: AppLayoutProps) {
  const location = useLocation();
  const hideNav = HIDE_NAV_PATH.test(location.pathname);
  const isBlindsTimer = location.pathname === '/admin/blinds/timer';

  const contentPaddingBottom = hideNav
    ? 'env(safe-area-inset-bottom, 0px)'
    : `calc(env(safe-area-inset-bottom, 0px) + ${NAV_HEIGHT})`;

  if (isBlindsTimer) {
    return (
      <div className="w-full h-[100dvh] overflow-hidden bg-[#0A0908]">
        <AdminBlindsTimer />
        <RubyBonusHost />
      </div>
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
            <Suspense fallback={<SplashScreen />}>
              <Routes>
            <Route path="/"                  element={<HomePage />} />
            <Route path="/tournaments"       element={<TournamentsPage />} />
            <Route path="/tournaments/:id"   element={<TournamentDetailRoute />} />
            <Route path="/rating"            element={<RatingPage />} />
            <Route path="/profile"           element={<ProfilePage />} />
            <Route path="/profile/:playerId" element={<ProfilePage />} />
            <Route path="/settings"          element={<SettingsPage userEmail={userEmail} />} />
            <Route path="/shop"              element={<ShopScreen />} />
            <Route path="/about"             element={<AboutClubScreen />} />
            <Route path="/qa"                element={<QnAScreen />} />
            <Route path="/achievements"      element={<AchievementsScreen />} />
            <Route path="/achievements/:playerId" element={<AchievementsScreen />} />
            <Route path="/admin/users"           element={<AdminUsersScreen />} />
            <Route path="/admin/tournaments"     element={<AdminTournamentsScreen />} />
            <Route path="/admin/tournaments/:id" element={<AdminTournamentEditor />} />
            <Route path="/admin/blinds"          element={<Navigate to="/admin/blinds/settings" replace />} />
            <Route path="/admin/blinds/settings" element={<AdminBlindsSettings />} />
            <Route path="/admin/blinds/timer"    element={<AdminBlindsTimer />} />
            <Route path="/admin/finance"         element={<AdminFinanceScreen />} />
            <Route path="/admin/finance/tournaments/:id" element={<AdminTournamentFinance />} />
            <Route path="/admin/ruby"            element={<AdminRubyScreen />} />
            <Route path="/admin/statistic"       element={<AdminStatisticScreen />} />
            <Route path="/admin/logs"            element={<AdminLogsScreen />} />
            <Route path="/admin/achievements/users"      element={<AdminAchievementsUsers />} />
            <Route path="/admin/achievements/edit/:userId" element={<AdminAchievementsEditor />} />
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

function SplashShell() {
  return (
    <div className={shellClass}>
      <div className={columnClass} style={{ height: '100dvh' }}>
        <SplashScreen />
      </div>
    </div>
  );
}

function AuthenticatedApp({
  userEmail,
  showSplash,
}: {
  userEmail: string;
  showSplash: boolean;
}) {
  const navigate = useNavigate();
  const { account, isLoading, refreshAccount } = useUser();
  const startupView = resolveStartupView({
    showSplash,
    isLoading,
    hasAccount: Boolean(account),
  });
  const landedHomeRef = useRef(false);

  useEffect(() => {
    if (!account || startupView !== 'ready') return;
    if (landedHomeRef.current) return;
    landedHomeRef.current = true;
    navigate('/', { replace: true });
  }, [account, startupView, navigate]);

  if (startupView === 'loading') {
    return <SplashShell />;
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
      <AuditLogProvider>
        <ProfileProvider>
          <TournamentProvider>
            <FinanceProvider>
              <BlindsProvider>
                <AppLayout userEmail={userEmail} />
              </BlindsProvider>
            </FinanceProvider>
          </TournamentProvider>
        </ProfileProvider>
      </AuditLogProvider>
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
  const [userEmail, setUserEmail] = useState(
    () => readSessionEmail(),
  );
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(readSessionEmail()),
  );
  const [showSplash, setShowSplash] = useState(
    () => Boolean(readSessionEmail()),
  );

  useEffect(() => {
    bootTelegramWebApp();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowSplash(false);
      return;
    }

    setShowSplash(true);
    const timer = setTimeout(() => setShowSplash(false), SPLASH_MS);
    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  const handleLogin = useCallback((nextEmail: string) => {
    setUserEmail(nextEmail.trim().toLowerCase());
    setIsAuthenticated(true);
    navigate('/', { replace: true });
  }, [navigate]);

  const handleAccountInvalid = () => {
    endLocalSession(userEmail);
    setUserEmail('');
    setIsAuthenticated(false);
    navigate('/', { replace: true });
  };

  if (!isAuthenticated) {
    return (
      <div className={shellClass}>
        <div className={`${columnClass} h-screen`}>
          <LoginScreen onLogin={handleLogin} />
        </div>
      </div>
    );
  }

  return (
    <UserProvider email={userEmail} onAccountInvalid={handleAccountInvalid}>
      <AuthenticatedApp userEmail={userEmail} showSplash={showSplash} />
    </UserProvider>
  );
}
