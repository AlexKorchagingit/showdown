import { asset } from './assets';

const LEVEL_CHANGE_SRC = () => asset('/sounds/blinds-up.mp3');

let primed: HTMLAudioElement | null = null;

function source(): HTMLAudioElement {
  if (!primed) primed = new Audio(LEVEL_CHANGE_SRC());
  return primed;
}

/** Prime the audio element after a user gesture so the level-change cue can play. */
export function unlockBlindsAudio() {
  const audio = source();
  audio.volume = 0.01;
  void audio
    .play()
    .then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 1;
    })
    .catch(() => {
      /* autoplay blocked until the next gesture */
    });
}

/** Plays once when the clock hits 00:00 and blinds auto-advance. */
export function playLevelUp() {
  const audio = source();
  audio.pause();
  audio.currentTime = 0;
  audio.volume = 1;
  void audio.play().catch(() => {
    const fallback = new Audio(LEVEL_CHANGE_SRC());
    fallback.volume = 1;
    void fallback.play().catch(() => {});
  });
}
