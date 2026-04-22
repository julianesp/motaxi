// Utilidad para reproducir sonidos de notificación en la PWA
// Usa Web Audio API para generar sonidos sin archivos externos

export function playNotificationSound(type: 'offer' | 'accepted' | 'alert' = 'offer') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();

    if (type === 'offer') {
      // Dos tonos ascendentes: nueva oferta de conductor
      const schedule = [
        { time: 0, freq: 520 },
        { time: 0.18, freq: 780 },
      ];
      schedule.forEach(({ time, freq }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, ctx.currentTime + time);
        gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + 0.22);
        osc.start(ctx.currentTime + time);
        osc.stop(ctx.currentTime + time + 0.25);
      });
    } else if (type === 'accepted') {
      // Tres tonos ascendentes de celebración: viaje aceptado
      const schedule = [
        { time: 0, freq: 440 },
        { time: 0.14, freq: 550 },
        { time: 0.28, freq: 660 },
      ];
      schedule.forEach(({ time, freq }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, ctx.currentTime + time);
        gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + 0.2);
        osc.start(ctx.currentTime + time);
        osc.stop(ctx.currentTime + time + 0.22);
      });
    } else if (type === 'alert') {
      // Tono corto urgente
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch {
    // Silenciar errores (modo privado, política del navegador, etc.)
  }
}
