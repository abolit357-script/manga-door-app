/**
 * Synthesizes a subtle wooden/hinge creak via Web Audio API when sound is enabled.
 * Uses no external audio files and safely handles restricted/unavailable audio contexts.
 */
export function playDoorCreak() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    const filter = ctx.createBiquadFilter()
    const master = ctx.createGain()

    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(145, now)
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.55)
    osc.frequency.exponentialRampToValueAtTime(125, now + 1.35)

    // Subtle stick-slip flutter
    lfo.type = 'sine'
    lfo.frequency.setValueAtTime(22, now)
    lfo.frequency.linearRampToValueAtTime(11, now + 1.35)
    lfoGain.gain.setValueAtTime(18, now)
    lfo.connect(lfoGain)
    lfoGain.connect(osc.frequency)

    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(620, now)
    filter.frequency.linearRampToValueAtTime(880, now + 0.6)
    filter.frequency.linearRampToValueAtTime(420, now + 1.35)
    filter.Q.setValueAtTime(5.5, now)

    master.gain.setValueAtTime(0.0001, now)
    master.gain.linearRampToValueAtTime(0.045, now + 0.14)
    master.gain.exponentialRampToValueAtTime(0.018, now + 0.85)
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.4)

    osc.connect(filter)
    filter.connect(master)
    master.connect(ctx.destination)

    osc.start(now)
    lfo.start(now)
    osc.stop(now + 1.42)
    lfo.stop(now + 1.42)

    window.setTimeout(() => {
      ctx.close().catch(() => {})
    }, 1600)
  } catch {
    // Ignore audio context failures gracefully
  }
}
