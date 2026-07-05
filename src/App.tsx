import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import WebApp from '@twa-dev/sdk';
import { BottomNav } from './components/BottomNav';
import { LoginScreen } from './components/LoginScreen';
import { SplashScreen } from './components/SplashScreen';
import { HomePage } from './pages/HomePage';
import { TournamentsPage } from './pages/TournamentsPage';
import { TournamentDetailRoute } from './pages/TournamentDetailRoute';
import { RatingPage } from './pages/RatingPage';
import { ProfilePage } from './pages/ProfilePage';
import { TournamentProvider } from './context/TournamentContext';

const NAV_HEIGHT = '5rem';
const LOBBY_PATH = /^\/tournaments\/[^/]+$/;
const SPLASH_MS = 2000;

interface AppLayoutProps {
  userEmail: string;
  isReady: boolean;
}

function AppLayout({ userEmail, isReady }: AppLayoutProps) {
  const location = useLocation();
  const isLobby = LOBBY_PATH.test(location.pathname);

  const contentPaddingBottom = isLobby
    ? 'env(safe-area-inset-bottom, 0px)'
    : `calc(env(safe-area-inset-bottom, 0px) + ${NAV_HEIGHT})`;

  return (
    <div
      className="relative w-full max-w-[480px] bg-[#110b09] overflow-hidden shadow-2xl"
      style={{ height: '100dvh' }}
    >
      <AnimatePresence>
        {!isReady && <SplashScreen key="splash" />}
      </AnimatePresence>

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
            <Route path="/profile"         element={<ProfilePage userEmail={userEmail} />} />
            <Route path="*"                element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>

      {!isLobby && isReady && <BottomNav />}
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
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      WebApp.ready();
      WebApp.expand();
      WebApp.setHeaderColor('#110b09');
      WebApp.setBackgroundColor('#110b09');
    } catch { /* Outside Telegram */ }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    setIsReady(false);
    const timer = setTimeout(() => setIsReady(true), SPLASH_MS);
    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  const handleLogin = (email: string) => {
    localStorage.setItem('userEmail', email);
    setUserEmail(email);
    setIsAuthenticated(true);
  };

  const shellClass = 'w-full min-h-screen bg-black flex justify-center';

  if (!isAuthenticated) {
    return (
      <div className={shellClass}>
        <div
          className="relative w-full max-w-[480px] overflow-hidden shadow-2xl"
          style={{ height: '100dvh' }}
        >
          <LoginScreen onLogin={handleLogin} />
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <TournamentProvider>
        <AppLayout userEmail={userEmail} isReady={isReady} />
      </TournamentProvider>
    </div>
  );
}
