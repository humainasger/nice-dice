// Sound effects through jsfxr: eight short synth sounds (roll, buy, level, combo, ascend, charm,
// luck, trophy) from hand-tuned parameters, rendered once into AudioBuffers on one AudioContext
// and played through a master gain. play() is silent until unlockAudio() has run on a user
// gesture (installAudioUnlock wires that to the first pointer or key event), honours
// settings.sound and drops repeats of the same sound inside 50 ms. Nothing here touches the game
// state; src/ui calls play() next to the dispatch that earned the sound.
import { sfxr, type SfxrParams } from 'jsfxr'
import { store } from './store'

export type SoundName = 'roll' | 'buy' | 'level' | 'combo' | 'ascend' | 'charm' | 'luck' | 'trophy'

export const SOUND_NAMES: readonly SoundName[] = ['roll', 'buy', 'level', 'combo', 'ascend', 'charm', 'luck', 'trophy']

export interface PlayOptions {
  /** Combo hand rank, 1 (pair) to 7 (five of a kind); the pitch rises with it. Ignored by the other sounds. */
  readonly rank?: number
}

/** Repeats of one sound inside this window are dropped (a Max buy fires one level sound, not fifty). */
export const THROTTLE_MS = 50
/** Highest combo rank with its own pitch; higher ranks reuse it. */
export const COMBO_RANKS = 7
const MASTER_GAIN = 0.7
const SAMPLE_RATE = 44100

// Envelope times are slider values: seconds = v * v * 100000 / 44100, so sustain 0.1 is 23 ms and
// decay 0.3 is 204 ms. Every sound below stays under 300 ms.
const BASE: SfxrParams = {
  oldParams: true,
  wave_type: 0,
  p_env_attack: 0,
  p_env_sustain: 0.1,
  p_env_punch: 0,
  p_env_decay: 0.25,
  p_base_freq: 0.3,
  p_freq_limit: 0,
  p_freq_ramp: 0,
  p_freq_dramp: 0,
  p_vib_strength: 0,
  p_vib_speed: 0,
  p_arp_mod: 0,
  p_arp_speed: 0,
  p_duty: 0,
  p_duty_ramp: 0,
  p_repeat_speed: 0,
  p_pha_offset: 0,
  p_pha_ramp: 0,
  p_lpf_freq: 1,
  p_lpf_ramp: 0,
  p_lpf_resonance: 0,
  p_hpf_freq: 0,
  p_hpf_ramp: 0,
  sound_vol: 0.22,
  sample_rate: SAMPLE_RATE,
  sample_size: 8,
}

function def(patch: Partial<SfxrParams>): SfxrParams {
  return { ...BASE, ...patch }
}

/** Hand-tuned definitions. Combo is a function of rank, see comboDef. */
const SOUNDS: Record<Exclude<SoundName, 'combo'>, SfxrParams> = {
  // Dice on felt: a filtered noise rattle that repeats twice, about 190 ms.
  roll: def({
    wave_type: 3,
    p_base_freq: 0.3,
    p_env_sustain: 0.06,
    p_env_decay: 0.28,
    p_env_punch: 0.15,
    p_repeat_speed: 0.72,
    p_lpf_freq: 0.55,
    p_lpf_ramp: -0.2,
    p_hpf_freq: 0.15,
    sound_vol: 0.18,
  }),
  // A coin: sawtooth with a quick upward arpeggio, about 165 ms.
  buy: def({
    wave_type: 1,
    p_base_freq: 0.48,
    p_env_sustain: 0.07,
    p_env_decay: 0.26,
    p_env_punch: 0.45,
    p_arp_speed: 0.56,
    p_arp_mod: 0.33,
  }),
  // A soft tick for a level, about 60 ms, so bulk buys stay light.
  level: def({
    wave_type: 0,
    p_base_freq: 0.52,
    p_duty: 0.35,
    p_env_sustain: 0.04,
    p_env_decay: 0.16,
    p_env_punch: 0.2,
    sound_vol: 0.16,
  }),
  // Rising sweep with a little vibrato, about 260 ms.
  ascend: def({
    wave_type: 0,
    p_base_freq: 0.22,
    p_freq_ramp: 0.28,
    p_duty: 0.2,
    p_env_sustain: 0.16,
    p_env_decay: 0.3,
    p_env_punch: 0.25,
    p_vib_strength: 0.15,
    p_vib_speed: 0.4,
  }),
  // Two-note sine chime, about 230 ms.
  charm: def({
    wave_type: 2,
    p_base_freq: 0.56,
    p_arp_mod: 0.42,
    p_arp_speed: 0.62,
    p_env_sustain: 0.1,
    p_env_decay: 0.3,
    p_env_punch: 0.1,
  }),
  // Shimmer: a high sine with vibrato and a slow rise, about 250 ms.
  luck: def({
    wave_type: 2,
    p_base_freq: 0.62,
    p_freq_ramp: 0.12,
    p_vib_strength: 0.35,
    p_vib_speed: 0.55,
    p_env_sustain: 0.14,
    p_env_decay: 0.3,
    p_hpf_freq: 0.1,
  }),
  // A small fanfare: square arpeggio that repeats, about 240 ms.
  trophy: def({
    wave_type: 0,
    p_base_freq: 0.4,
    p_duty: 0.2,
    p_arp_mod: 0.5,
    p_arp_speed: 0.42,
    p_repeat_speed: 0.62,
    p_env_sustain: 0.12,
    p_env_decay: 0.3,
    p_env_punch: 0.3,
  }),
}

/** The combo sound for a hand rank: base pitch and punch rise with the rank, about 240 ms. */
export function comboDef(rank: number): SfxrParams {
  const r = clampRank(rank)
  return def({
    wave_type: 0,
    p_duty: 0.3,
    p_base_freq: 0.3 + r * 0.045,
    p_arp_mod: 0.35,
    p_arp_speed: 0.5,
    p_env_sustain: 0.12,
    p_env_decay: 0.3,
    p_env_punch: 0.2 + r * 0.05,
  })
}

/** The parameters play() renders for a sound; exported for tests and for tuning in the sfxr.me editor. */
export function soundDef(name: SoundName, rank: number = 1): SfxrParams {
  return name === 'combo' ? comboDef(rank) : SOUNDS[name]
}

function clampRank(rank: number): number {
  if (!Number.isFinite(rank)) return 1
  return Math.min(COMBO_RANKS, Math.max(1, Math.round(rank)))
}

// Playback state. One context and one master gain for the page; buffers render lazily per key.
let context: AudioContext | null = null
let master: GainNode | null = null
let unlocked = false
const buffers = new Map<string, AudioBuffer>()
const lastPlayed = new Map<SoundName, number>()

type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext }

function getContext(): AudioContext | null {
  if (context !== null) return context
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext
  if (Ctor === undefined) return null
  try {
    context = new Ctor()
  } catch {
    return null
  }
  master = context.createGain()
  master.gain.value = MASTER_GAIN
  master.connect(context.destination)
  return context
}

function resume(ctx: AudioContext): void {
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {
      // Still blocked by autoplay policy; the next play() inside a gesture tries again.
    })
  }
}

/**
 * jsfxr draws its noise table from Math.random. Rendering under a seeded generator makes every
 * buffer identical from session to session (the "fixed seed" of the brief). Synchronous, and the
 * original Math.random is back before this returns.
 */
function withSeededRandom<T>(seed: number, render: () => T): T {
  const original = Math.random
  let state = seed >>> 0
  Math.random = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  try {
    return render()
  } finally {
    Math.random = original
  }
}

function bufferKey(name: SoundName, rank: number | undefined): string {
  return name === 'combo' ? `combo:${clampRank(rank ?? 1)}` : name
}

function bufferFor(ctx: AudioContext, name: SoundName, rank: number | undefined): AudioBuffer | null {
  const key = bufferKey(name, rank)
  const cached = buffers.get(key)
  if (cached !== undefined) return cached
  const params = soundDef(name, rank ?? 1)
  // The seed is the key's characters, so each sound has its own fixed noise table.
  let seed = 0x9e3779b9
  for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
  const rendered = withSeededRandom(seed, () => sfxr.toWebAudio(params, ctx).buffer)
  if (rendered === null) return null
  buffers.set(key, rendered)
  return rendered
}

/** Render every sound now so the first play has no hitch. Cheap: 14 buffers of under 300 ms each. */
function warm(ctx: AudioContext): void {
  for (const name of SOUND_NAMES) {
    if (name === 'combo') {
      for (let rank = 1; rank <= COMBO_RANKS; rank++) bufferFor(ctx, name, rank)
    } else {
      bufferFor(ctx, name, undefined)
    }
  }
}

/** True once a user gesture has unlocked playback. */
export function isAudioUnlocked(): boolean {
  return unlocked
}

/**
 * Call on the first user gesture (pointer or key). Creates the AudioContext, resumes it and
 * renders the sounds. Safe to call again. Before this, play() does nothing, so nothing sounds
 * on load or from autosave and offline credit.
 */
export function unlockAudio(): void {
  unlocked = true
  const ctx = getContext()
  if (ctx === null) return
  resume(ctx)
  warm(ctx)
}

const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'keydown', 'touchend'] as const

/**
 * Listen for the first gesture on the window and unlock then. Returns a function that removes the
 * listeners. The module installs this itself in a browser, so importing play() is enough; call it
 * again only if the listeners were removed.
 */
export function installAudioUnlock(target: Window = window): () => void {
  const remove = (): void => {
    for (const type of UNLOCK_EVENTS) target.removeEventListener(type, onGesture, true)
  }
  const onGesture = (): void => {
    remove()
    unlockAudio()
  }
  for (const type of UNLOCK_EVENTS) target.addEventListener(type, onGesture, true)
  return remove
}

/**
 * Play a sound if audio is unlocked, settings.sound is on and the same sound did not play in the
 * last 50 ms. Never throws. opts.rank picks the combo pitch.
 */
export function play(name: SoundName, opts: PlayOptions = {}): void {
  if (!unlocked) return
  if (!store.getState().ui.settings.sound) return
  const now = performance.now()
  const last = lastPlayed.get(name)
  if (last !== undefined && now - last < THROTTLE_MS) return
  lastPlayed.set(name, now)
  const ctx = getContext()
  if (ctx === null || master === null) return
  resume(ctx)
  const buffer = bufferFor(ctx, name, opts.rank)
  if (buffer === null) return
  try {
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(master)
    source.start()
  } catch {
    // A closed context or an exotic browser: stay silent rather than break the roll.
  }
}

/** Drop the rendered buffers and the throttle state (tests, HMR). The context stays. */
export function resetAudioCache(): void {
  buffers.clear()
  lastPlayed.clear()
}

if (typeof window !== 'undefined') installAudioUnlock()
