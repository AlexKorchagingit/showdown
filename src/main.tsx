import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { applyAchievementEpochReset } from './lib/achievementStorage';
import { recoverFromChunkLoadError } from './lib/chunkRecovery';

window.addEventListener('vite:preloadError', (event) => {
  const preloadError = event as Event & { payload?: unknown };
  if (recoverFromChunkLoadError(preloadError.payload, __APP_BUILD_ID__)) {
    event.preventDefault();
  }
});

applyAchievementEpochReset();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>
);
