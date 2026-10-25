// Ambient types for jsfxr, which ships no .d.ts: the parameter shape and the parts of the sfxr
// namespace that src/app/audio.ts uses. Parameters are on [0, 1] unless marked signed ([-1, 1]).
declare module 'jsfxr' {
  /** 0 square, 1 sawtooth, 2 sine, 3 noise. */
  export type SfxrWave = 0 | 1 | 2 | 3

  export interface SfxrParams {
    oldParams: true
    wave_type: SfxrWave
    p_env_attack: number
    p_env_sustain: number
    p_env_punch: number
    p_env_decay: number
    p_base_freq: number
    p_freq_limit: number
    /** signed */
    p_freq_ramp: number
    /** signed */
    p_freq_dramp: number
    p_vib_strength: number
    p_vib_speed: number
    /** signed */
    p_arp_mod: number
    p_arp_speed: number
    p_duty: number
    /** signed */
    p_duty_ramp: number
    p_repeat_speed: number
    /** signed */
    p_pha_offset: number
    /** signed */
    p_pha_ramp: number
    p_lpf_freq: number
    /** signed */
    p_lpf_ramp: number
    p_lpf_resonance: number
    p_hpf_freq: number
    /** signed */
    p_hpf_ramp: number
    sound_vol: number
    sample_rate: number
    sample_size: 8 | 16
  }

  export interface SfxrAudio {
    play(): unknown
    setVolume(volume: number): SfxrAudio
  }

  export interface Sfxr {
    /** A random sound from a named preset (pickupCoin, powerUp, ...). Not deterministic. */
    generate(preset: string, options?: { sound_vol?: number; sample_rate?: number; sample_size?: 8 | 16 }): SfxrParams
    /** Raw samples as the wav would carry them (8 or 16 bit). */
    toBuffer(def: SfxrParams | string): number[]
    /** A buffer source on the given context holding the rendered sound, not yet connected. */
    toWebAudio(def: SfxrParams | string, context: AudioContext): AudioBufferSourceNode
    toWave(def: SfxrParams | string): { dataURI: string; getAudio(): SfxrAudio }
    toAudio(def: SfxrParams | string): SfxrAudio
    play(def: SfxrParams | string): unknown
    b58encode(def: SfxrParams): string
    b58decode(text: string): SfxrParams
  }

  export const sfxr: Sfxr
}
