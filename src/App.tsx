import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import WebApp from '@twa-dev/sdk';
import { BottomNav } from './components/BottomNav';
import { SplashScreen } from './components/SplashScreen';
import { HomePage } from './pages/HomePage';
import { TournamentsPage } from './pages/TournamentsPage';
import { RatingPage } from './pages/RatingPage';
import { ProfilePage } from './pages/ProfilePage';
import { TournamentProvider } from './context/TournamentContext';

const NAV_HEIGHT = '5rem';

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      WebApp.ready();
      WebApp.expand();
      WebApp.setHeaderColor('#110b09');
      WebApp.setBackgroundColor('#110b09');
    } catch { /* Outside Telegram */ }

    // Show splash for 2.2 seconds, then fade out
    const timer = setTimeout(() => setIsReady(true), 2200);
    return () => clearTimeout(timer);
  }, []);

  return (
    // Outer: black background on desktop
    <div className="w-full min-h-screen bg-black flex justify-center">
      {/* Mobile-constrained app column */}
      <TournamentProvider>
        <div
          className="relative w-full max-w-[480px] bg-[#110b09] overflow-hidden shadow-2xl"
          style={{ height: '100dvh' }}
        >
          {/* Splash — AnimatePresence handles the exit fade */}
          <AnimatePresence>
            {!isReady && <SplashScreen key="splash" />}
          </AnimatePresence>

          {/* Page content */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${NAV_HEIGHT})` }}
          >
            <div className="h-full">
              <Routes>
                <Route path="/"            element={<HomePage />} />
                <Route path="/tournaments" element={<TournamentsPage />} />
                <Route path="/rating"      element={<RatingPage />} />
                <Route path="/profile"     element={<ProfilePage />} />
                <Route path="*"            element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </div>

          {/* BottomNav — absolute inside the 480px container */}
          <BottomNav />
        </div>
      </TournamentProvider>
    </div>
  );
}
