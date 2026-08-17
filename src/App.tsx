import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { BottomNav } from './components/BottomNav';
import { LoginScreen } from './components/LoginScreen';
import { SplashScreen } from './components/SplashScreen';
import { HomePage } from './pages/HomePage';
import { TournamentsPage } from './pages/TournamentsPage';
import { TournamentDetailRoute } from './pages/TournamentDetailRoute';
import { RatingPage } from './pages/RatingPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { ShopScreen } from './pages/ShopScreen';
import { AboutClubScreen } from './pages/AboutClubScreen';
import { QnAScreen } from './pages/QnAScreen';
import { AchievementsScreen } from './pages/AchievementsScreen';
import { AdminUsersScreen } from './pages/admin/AdminUsersScreen';
import { AdminTournamentsScreen } from './pages/admin/AdminTournamentsScreen';
import { AdminTournamentEditor } from './pages/admin/AdminTournamentEditor';
import { AdminBlindsSettings } from './pages/admin/AdminBlindsSettings';
import { AdminBlindsTimer } from './pages/admin/AdminBlindsTimer';
import { AdminAchievementsUsers } from './pages/admin/AdminAchievementsUsers';
import { AdminAchievementsEditor } from './pages/admin/AdminAchievementsEditor';
import { AdminFinanceScreen } from './pages/admin/AdminFinanceScreen';
import { AdminTournamentFinance } from './pages/admin/AdminTournamentFinance';
import { AdminRubyScreen } from './pages/admin/AdminRubyScreen';
import { AdminStatisticScreen } from './pages/admin/AdminStatisticScreen';
import { TournamentProvider } from './context/TournamentContext';
import { FinanceProvider } from './context/FinanceContext';
import { ProfileProvider } from './context/ProfileContext';
import { UserProvider } from './context/UserContext';
import { BlindsProvider } from './context/BlindsContext';
import { RubyBonusHost } from './components/RubyBonusHost';

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

  const contentPaddingBottom = hideNav
    ? 'env(safe-area-inset-bottom, 0px)'
    : `calc(env(safe-area-inset-bottom, 0px) + ${NAV_HEIGHT})`;

  return (
    <div className={columnClass} style={{ height: '100dvh' }}>
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ paddingBottom: contentPaddingBottom }}
      >
        <div className="h-full">
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
            <Route path="/admin/achievements/users"      element={<AdminAchievementsUsers />} />
            <Route path="/admin/achievements/edit/:userId" element={<AdminAchievementsEditor />} />
            <Route path="*"                  element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>

      {!hideNav && <BottomNav />}
      <RubyBonusHost />
    </div>
  );
}

export default function App() {
  const [userEmail, setUserEmail] = useState(
    () => localStorage.getItem('userEmail') || '',
  );
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!localStorage.getItem('userEmail'),
  );
  const [showSplash, setShowSplash] = useState(
    () => !!localStorage.getItem('userEmail'),
  );

  useEffect(() => {
    try {
      WebApp.ready();
      WebApp.expand();
      WebApp.setHeaderColor('#110b09');
      WebApp.setBackgroundColor('#110b09');
    } catch { /* Outside Telegram */ }
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

  const handleLogin = (email: string) => {
    localStorage.setItem('userEmail', email);
    setUserEmail(email);
    setIsAuthenticated(true);
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

  if (showSplash) {
    return (
      <div className={shellClass}>
        <div className={columnClass} style={{ height: '100dvh' }}>
          <SplashScreen />
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <UserProvider email={userEmail}>
        <ProfileProvider>
          <TournamentProvider>
            <FinanceProvider>
              <BlindsProvider>
                <AppLayout userEmail={userEmail} />
              </BlindsProvider>
            </FinanceProvider>
          </TournamentProvider>
        </ProfileProvider>
      </UserProvider>
    </div>
  );
}
