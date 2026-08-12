import { asset } from './assets';

const WARNING_SRC = () => asset('/sounds/warning.mp3');
const LEVEL_UP_SRC = () => asset('/sounds/level_up.mp3');

/** Prime the audio element after a user gesture so later alerts can play. */
export function unlockBlindsAudio() {
  const audio = new Audio(WARNING_SRC());
  audio.volume = 0.01;
  void audio
    .play()
    .then(() => {
      audio.pause();
      audio.currentTime = 0;
    })
    .catch(() => {
      /* autoplay blocked until the next gesture */
    });
}

/** Three short warning beeps as the clock hits 00:03. */
export function playWarningTriple() {
  const src = WARNING_SRC();
  let remaining = 3;
  const fire = () => {
    const audio = new Audio(src);
    audio.volume = 1;
    void audio.play().catch(() => {});
    remaining -= 1;
    if (remaining <= 0) window.clearInterval(id);
  };
  fire();
  const id = window.setInterval(fire, 420);
}

/** Long gong / siren when a new blind level starts. */
export function playLevelUp() {
  const audio = new Audio(LEVEL_UP_SRC());
  audio.volume = 1;
  void audio.play().catch(() => {});
}
