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
import { TournamentProvider } from './context/TournamentContext';
import { ProfileProvider } from './context/ProfileContext';

const NAV_HEIGHT = '5rem';
const HIDE_NAV_PATH = /^\/(tournaments\/[^/]+|settings)$/;
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
            <Route path="/"                element={<HomePage />} />
            <Route path="/tournaments"     element={<TournamentsPage />} />
            <Route path="/tournaments/:id" element={<TournamentDetailRoute />} />
            <Route path="/rating"          element={<RatingPage />} />
            <Route path="/profile"   element={<ProfilePage />} />
            <Route path="/settings"  element={<SettingsPage userEmail={userEmail} />} />
            <Route path="*"                element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>

      {!hideNav && <BottomNav />}
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
      <TournamentProvider>
        <ProfileProvider>
          <AppLayout userEmail={userEmail} />
        </ProfileProvider>
      </TournamentProvider>
    </div>
  );
}
