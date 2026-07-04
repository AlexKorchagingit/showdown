import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { BottomNav } from './components/BottomNav';
import { HomePage } from './pages/HomePage';
import { TournamentsPage } from './pages/TournamentsPage';
import { RatingPage } from './pages/RatingPage';
import { ProfilePage } from './pages/ProfilePage';
import { TournamentProvider } from './context/TournamentContext';

// Floating pill nav: 60px height + 12px bottom margin + 8px top buffer = ~5rem
const NAV_HEIGHT = '5rem';

export default function App() {
  useEffect(() => {
    try {
      WebApp.ready();
      WebApp.expand();
      WebApp.setHeaderColor('#0A0908');
      WebApp.setBackgroundColor('#0A0908');
    } catch { /* Outside Telegram */ }
  }, []);

  return (
    <TournamentProvider>
      <div className="relative w-full bg-obsidian" style={{ height: '100dvh' }}>
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
        <BottomNav />
      </div>
    </TournamentProvider>
  );
}
