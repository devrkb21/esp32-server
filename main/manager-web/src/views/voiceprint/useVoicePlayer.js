// One recording plays at a time across the page and its sheet. The chat audio is fetched the way
// the legacy dialog did: POST /agent/audio/{audioId} gives a one-time id, /agent/play/{id} streams it.
import { onBeforeUnmount, ref } from 'vue';
import Api from '@/apis/api';

export function useVoicePlayer({ onError } = {}) {
  const playingId = ref('');   // the recording that is sounding now
  const loadingId = ref('');   // the recording whose audio is on its way
  let audio = null;
  let ticket = 0;

  function release() {
    if (audio) {
      audio.onended = null; audio.onerror = null;
      try { audio.pause(); } catch (e) { /* already gone */ }
      audio = null;
    }
  }

  function stop() {
    ticket += 1;
    release();
    playingId.value = '';
    loadingId.value = '';
  }

  function fail() {
    stop();
    if (onError) onError();
  }

  function play(audioId) {
    stop();
    if (!audioId) return;
    const mine = ticket;
    loadingId.value = audioId;
    Api.agent.getAudioId(audioId, (res) => {
      if (mine !== ticket) return; // the owner pressed something else meanwhile
      const key = res && res.data && res.data.data;
      if (!key || typeof key !== 'string') { fail(); return; }
      audio = new Audio(`${Api.getServiceUrl()}/agent/play/${key}`);
      audio.onended = () => { if (mine === ticket) stop(); };
      audio.onerror = () => { if (mine === ticket) fail(); };
      loadingId.value = '';
      playingId.value = audioId;
      const p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(() => { if (mine === ticket) fail(); });
    });
  }

  /** Play this recording, or stop it when it is the one sounding (or loading). */
  function toggle(audioId) {
    if (playingId.value === audioId || loadingId.value === audioId) stop();
    else play(audioId);
  }

  onBeforeUnmount(stop);

  return { playingId, loadingId, toggle, stop };
}
