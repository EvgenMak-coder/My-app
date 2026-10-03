import type { ElementKey } from '../theme/appearance'
import { rand } from './util'

/**
 * Звук стихий. Файлов нет — всё синтезируется на лету через Web Audio:
 * гроза (дождь и гром), пламя (огонь и далёкая битва), тень (тревожный космический гул).
 * У крови звука нет.
 */

type SoundEvent = 'thunder' | 'flare'

interface Scene {
  onEvent?(event: SoundEvent): void
  stop(): void
}

type AudioCtor = typeof AudioContext

class Soundscape {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private reverb!: ConvolverNode
  private white!: AudioBuffer
  private brown!: AudioBuffer
  private scene: Scene | null = null
  private sceneKey: ElementKey | null = null
  private enabled = false
  private volume = 0.6
  private element: ElementKey = 'ember'
  /** фон рисуется и сам сообщает о молниях; иначе гром планируем сами */
  private visuals = true

  /** Вызывать прямо из обработчика нажатия: браузеры разрешают звук только после жеста. */
  unlock(): void {
    this.ensureContext()
    void this.ctx?.resume()
  }

  configure(options: { enabled: boolean; volume: number; element: ElementKey }): void {
    this.enabled = options.enabled
    this.volume = options.volume
    this.element = options.element
    if (!this.enabled) {
      this.setScene(null)
      void this.ctx?.suspend()
      return
    }
    this.ensureContext()
    if (!this.ctx) return
    this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.1)
    if (!document.hidden) void this.ctx.resume()
    this.setScene(this.element)
  }

  setVisuals(active: boolean): void {
    if (this.visuals === active) return
    this.visuals = active
    // сцену пересобираем: от этого зависит, кто запускает гром
    if (this.scene) {
      const key = this.sceneKey
      this.setScene(null)
      this.setScene(key)
    }
  }

  trigger(event: SoundEvent): void {
    if (this.enabled && this.ctx?.state === 'running') this.scene?.onEvent?.(event)
  }

  private ensureContext(): void {
    if (this.ctx) return
    const Ctor: AudioCtor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor()
    this.ctx = ctx

    // iPhone: без этого боковой переключатель беззвучного режима глушит весь звук страницы
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession
    if (session) session.type = 'playback'

    // компрессор не даёт сумме слоёв хрипеть на пиках
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -14
    limiter.ratio.value = 6
    limiter.connect(ctx.destination)
    this.master = ctx.createGain()
    this.master.gain.value = this.volume
    this.master.connect(limiter)

    this.white = this.noiseBuffer(false)
    this.brown = this.noiseBuffer(true)

    // простая реверберация: затухающий шум вместо записи настоящего зала
    this.reverb = ctx.createConvolver()
    const length = Math.floor(ctx.sampleRate * 2.8)
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate)
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel)
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.6)
    }
    this.reverb.buffer = impulse
    const wet = ctx.createGain()
    wet.gain.value = 0.55
    this.reverb.connect(wet).connect(this.master)

    // если звук включён с прошлого раза, он оживёт при первом же касании
    const wake = () => {
      if (!this.enabled || document.hidden) return
      if (session) session.type = 'playback'
      void ctx.resume().then(() => {
        // возвращаемся плавно, а не на полной громкости сразу
        this.master.gain.cancelScheduledValues(ctx.currentTime)
        this.master.gain.setTargetAtTime(this.volume, ctx.currentTime, 0.4)
      })
    }
    // Свернули приложение: iPhone замораживает страницу, а звук в режиме «playback» продолжает идти
    // и зацикливает последний обрывок — получается писк. Поэтому глушим мгновенно, без таймеров
    // (они в фоне уже не сработают), и отдаём звуковой канал системе.
    const sleep = () => {
      this.master.gain.cancelScheduledValues(ctx.currentTime)
      this.master.gain.value = 0
      if (session) session.type = 'ambient'
      void ctx.suspend()
    }
    window.addEventListener('pointerdown', wake)
    window.addEventListener('keydown', wake)
    window.addEventListener('pagehide', sleep)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) sleep()
      else wake()
    })
  }

  private noiseBuffer(brown: boolean): AudioBuffer {
    const ctx = this.ctx!
    const length = ctx.sampleRate * 3
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1
      if (brown) {
        last = (last + 0.02 * white) / 1.02
        data[i] = last * 3.5
      } else {
        data[i] = white
      }
    }
    return buffer
  }

  private setScene(key: ElementKey | null): void {
    if (key === this.sceneKey && (this.scene || key === null)) return
    this.scene?.stop()
    this.scene = null
    this.sceneKey = key
    if (!key || !this.ctx || !this.enabled) return
    if (key === 'storm') this.scene = this.storm()
    else if (key === 'ember') this.scene = this.fire()
    else if (key === 'shadow') this.scene = this.shadow()
  }

  // ---------- общие кирпичики ----------

  /** Основа сцены: общий выход с плавным появлением и учёт всего, что нужно остановить. */
  private stage() {
    const ctx = this.ctx!
    const out = ctx.createGain()
    out.gain.value = 0
    out.gain.linearRampToValueAtTime(1, ctx.currentTime + 2)
    out.connect(this.master)
    const send = ctx.createGain()
    send.connect(this.reverb)
    out.connect(ctx.createGain()) // держит узел живым до остановки

    const sources: AudioScheduledSourceNode[] = []
    const timers = new Set<number>()
    let stopped = false

    const loop = (buffer: AudioBuffer): AudioBufferSourceNode => {
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.loop = true
      src.start(0, Math.random() * 2)
      sources.push(src)
      return src
    }
    const osc = (type: OscillatorType, frequency: number): OscillatorNode => {
      const node = ctx.createOscillator()
      node.type = type
      node.frequency.value = frequency
      node.start()
      sources.push(node)
      return node
    }
    /** Повторяет действие через случайные паузы, пока сцена жива. */
    const every = (minMs: number, maxMs: number, action: () => void) => {
      const tick = () => {
        if (stopped) return
        if (ctx.state === 'running') action()
        const id = window.setTimeout(() => {
          timers.delete(id)
          tick()
        }, rand(minMs, maxMs))
        timers.add(id)
      }
      const id = window.setTimeout(() => {
        timers.delete(id)
        tick()
      }, rand(minMs, maxMs))
      timers.add(id)
    }
    const stop = () => {
      stopped = true
      timers.forEach((id) => clearTimeout(id))
      out.gain.cancelScheduledValues(ctx.currentTime)
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.25)
      window.setTimeout(() => {
        sources.forEach((s) => {
          try {
            s.stop()
          } catch {
            // уже остановлен
          }
        })
        out.disconnect()
        send.disconnect()
      }, 1200)
    }
    return { ctx, out, send, loop, osc, every, stop }
  }

  /** Короткий шумовой всплеск: щелчок, удар, треск. */
  private burst(
    target: AudioNode,
    options: { buffer: AudioBuffer; type: BiquadFilterType; frequency: number; q?: number; gain: number; attack?: number; decay: number; at?: number },
  ): void {
    const ctx = this.ctx!
    const t = options.at ?? ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = options.buffer
    src.playbackRate.value = rand(0.7, 1.5)
    const filter = ctx.createBiquadFilter()
    filter.type = options.type
    filter.frequency.value = options.frequency
    filter.Q.value = options.q ?? 1
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.linearRampToValueAtTime(options.gain, t + (options.attack ?? 0.002))
    gain.gain.exponentialRampToValueAtTime(0.0001, t + (options.attack ?? 0.002) + options.decay)
    src.connect(filter).connect(gain).connect(target)
    src.start(t, Math.random() * 2)
    src.stop(t + (options.attack ?? 0.002) + options.decay + 0.05)
  }

  // ---------- гроза ----------

  private storm(): Scene {
    const s = this.stage()
    const { ctx } = s

    // дождь: шипение с порывами
    const rain = ctx.createBiquadFilter()
    rain.type = 'highpass'
    rain.frequency.value = 1100
    const rainTop = ctx.createBiquadFilter()
    rainTop.type = 'lowpass'
    rainTop.frequency.value = 7500
    const rainGain = ctx.createGain()
    rainGain.gain.value = 0.13
    s.loop(this.white).connect(rain).connect(rainTop).connect(rainGain).connect(s.out)
    const gust = s.osc('sine', 0.09)
    const gustDepth = ctx.createGain()
    gustDepth.gain.value = 0.05
    gust.connect(gustDepth).connect(rainGain.gain)

    // ветер и далёкий гул
    const wind = ctx.createBiquadFilter()
    wind.type = 'lowpass'
    wind.frequency.value = 190
    const windGain = ctx.createGain()
    windGain.gain.value = 0.3
    s.loop(this.brown).connect(wind).connect(windGain).connect(s.out)

    const thunder = (delay: number) => {
      const t = ctx.currentTime + delay
      const length = rand(2.6, 5)
      const near = Math.random() < 0.45

      const src = ctx.createBufferSource()
      src.buffer = this.brown
      src.loop = true
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(rand(500, 1100), t)
      filter.frequency.exponentialRampToValueAtTime(70, t + length)
      const gain = ctx.createGain()
      const peak = near ? rand(1.3, 1.9) : rand(0.6, 1)
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.linearRampToValueAtTime(peak, t + 0.07)
      // раскаты: несколько неровных волн, каждая тише предыдущей
      const rolls = Math.floor(rand(4, 8))
      for (let i = 1; i <= rolls; i++) {
        gain.gain.linearRampToValueAtTime(peak * Math.pow(0.72, i) * rand(0.5, 1.2), t + (length * i) / (rolls + 1))
      }
      gain.gain.linearRampToValueAtTime(0.0001, t + length)
      src.connect(filter).connect(gain)
      gain.connect(s.out)
      gain.connect(s.send)
      src.start(t, Math.random() * 2)
      src.stop(t + length + 0.2)

      // близкий удар начинается с сухого треска
      if (near) {
        this.burst(s.out, { buffer: this.white, type: 'highpass', frequency: 1400, gain: 0.55, attack: 0.004, decay: 0.3, at: t })
      }
    }

    // пока фон рисуется, гром приходит вслед за его молниями; иначе гремим сами
    if (!this.visuals) s.every(4000, 11000, () => thunder(0))

    return {
      onEvent: (event) => {
        if (event === 'thunder') thunder(rand(0.15, 1.4))
      },
      stop: s.stop,
    }
  }

  // ---------- пламя и битва ----------

  private fire(): Scene {
    const s = this.stage()
    const { ctx } = s

    // гул огня
    const roar = ctx.createBiquadFilter()
    roar.type = 'lowpass'
    roar.frequency.value = 480
    const roarGain = ctx.createGain()
    roarGain.gain.value = 0.42
    s.loop(this.brown).connect(roar).connect(roarGain).connect(s.out)
    const breath = s.osc('sine', 0.13)
    const breathDepth = ctx.createGain()
    breathDepth.gain.value = 0.12
    breath.connect(breathDepth).connect(roarGain.gain)

    // треск поленьев
    s.every(25, 150, () => {
      this.burst(s.out, {
        buffer: this.white,
        type: 'bandpass',
        frequency: rand(900, 5200),
        q: 2,
        gain: Math.pow(Math.random(), 2) * 0.4 + 0.03,
        decay: rand(0.008, 0.05),
      })
    })

    // шум далёкой толпы
    const crowd = ctx.createBiquadFilter()
    crowd.type = 'bandpass'
    crowd.frequency.value = 620
    crowd.Q.value = 0.7
    const crowdGain = ctx.createGain()
    crowdGain.gain.value = 0.05
    s.loop(this.white).connect(crowd).connect(crowdGain)
    crowdGain.connect(s.out)
    crowdGain.connect(s.send)
    const surge = s.osc('sine', 0.07)
    const surgeDepth = ctx.createGain()
    surgeDepth.gain.value = 0.03
    surge.connect(surgeDepth).connect(crowdGain.gain)

    // боевые барабаны: такт из четырёх ударов, иногда пауза
    const drum = (at: number, strength: number) => {
      const o = ctx.createOscillator()
      o.frequency.setValueAtTime(92, at)
      o.frequency.exponentialRampToValueAtTime(36, at + 0.35)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, at)
      g.gain.linearRampToValueAtTime(0.5 * strength, at + 0.008)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.6)
      o.connect(g)
      g.connect(s.out)
      g.connect(s.send)
      o.start(at)
      o.stop(at + 0.7)
      this.burst(s.send, { buffer: this.brown, type: 'lowpass', frequency: 240, gain: 0.5 * strength, decay: 0.18, at })
    }
    s.every(3600, 3600, () => {
      if (Math.random() < 0.3) return
      const t = ctx.currentTime + 0.05
      drum(t, 1)
      drum(t + 0.9, 0.7)
      drum(t + 1.8, 1)
      drum(t + 2.25, 0.6)
    })

    // лязг клинков вдалеке
    const clang = (at: number) => {
      const base = rand(1400, 2600)
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null
      if (pan) pan.pan.value = rand(-0.8, 0.8)
      const mix = ctx.createGain()
      mix.gain.value = rand(0.35, 0.9)
      const length = rand(0.25, 0.7)
      ;[1, 1.52, 2.31, 2.9, 3.67].forEach((ratio, i) => {
        const o = ctx.createOscillator()
        o.frequency.value = base * ratio
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.045 / (i + 1), at)
        g.gain.exponentialRampToValueAtTime(0.0001, at + length / (1 + i * 0.3))
        o.connect(g).connect(mix)
        o.start(at)
        o.stop(at + length + 0.05)
      })
      this.burst(mix, { buffer: this.white, type: 'highpass', frequency: 3200, gain: 0.12, decay: 0.02, at })
      const tail = pan ? mix.connect(pan) : mix
      tail.connect(s.out)
      tail.connect(s.send)
    }
    s.every(1800, 6000, () => {
      let at = ctx.currentTime + 0.05
      const hits = Math.floor(rand(1, 4))
      for (let i = 0; i < hits; i++) {
        clang(at)
        at += rand(0.12, 0.4)
      }
    })

    // всплеск пламени на экране — короткий выдох огня
    const whoosh = () => {
      const t = ctx.currentTime
      const src = ctx.createBufferSource()
      src.buffer = this.brown
      src.loop = true
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.Q.value = 0.8
      filter.frequency.setValueAtTime(220, t)
      filter.frequency.exponentialRampToValueAtTime(950, t + 0.35)
      filter.frequency.exponentialRampToValueAtTime(260, t + 1)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(0.5, t + 0.3)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1)
      src.connect(filter).connect(g).connect(s.out)
      src.start(t, Math.random() * 2)
      src.stop(t + 1.2)
    }

    return {
      onEvent: (event) => {
        if (event === 'flare') whoosh()
      },
      stop: s.stop,
    }
  }

  // ---------- тень ----------

  private shadow(): Scene {
    const s = this.stage()
    const { ctx } = s

    // низкий гул: ля плюс малая секунда и тритон — интервалы, которые не дают расслабиться
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 260
    filter.Q.value = 4
    const drone = ctx.createGain()
    drone.gain.value = 0.2
    filter.connect(drone)
    drone.connect(s.out)
    drone.connect(s.send)
    const voices: [OscillatorType, number, number][] = [
      ['sawtooth', 55, 1],
      ['sawtooth', 55.45, 1],
      ['sawtooth', 58.27, 0.35],
      ['sawtooth', 77.78, 0.25],
      ['sine', 27.5, 1.6],
    ]
    for (const [type, frequency, level] of voices) {
      const g = ctx.createGain()
      g.gain.value = level
      s.osc(type, frequency).connect(g).connect(filter)
    }
    const sweep = s.osc('sine', 0.04)
    const sweepDepth = ctx.createGain()
    sweepDepth.gain.value = 140
    sweep.connect(sweepDepth).connect(filter.frequency)

    // высокие «звёздные» голоса с эхом, медленно плывут по высоте
    const delay = ctx.createDelay(1)
    delay.delayTime.value = 0.37
    const feedback = ctx.createGain()
    feedback.gain.value = 0.55
    delay.connect(feedback).connect(delay)
    delay.connect(s.send)
    delay.connect(s.out)
    ;[
      [880, 0.21],
      [932.3, 0.31],
      [1318.5, 0.17],
    ].forEach(([frequency, rate]) => {
      const voice = s.osc('sine', frequency)
      const g = ctx.createGain()
      g.gain.value = 0.009
      const tremolo = s.osc('sine', rate)
      const tremoloDepth = ctx.createGain()
      tremoloDepth.gain.value = 0.008
      tremolo.connect(tremoloDepth).connect(g.gain)
      const drift = s.osc('sine', rate * 0.13)
      const driftDepth = ctx.createGain()
      driftDepth.gain.value = 9
      drift.connect(driftDepth).connect(voice.frequency)
      voice.connect(g).connect(delay)
    })

    // глухой двойной удар, как сердце
    const beat = (at: number, level: number) => {
      const o = ctx.createOscillator()
      o.frequency.setValueAtTime(48, at)
      o.frequency.exponentialRampToValueAtTime(30, at + 0.4)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, at)
      g.gain.linearRampToValueAtTime(level, at + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.55)
      o.connect(g).connect(s.out)
      o.start(at)
      o.stop(at + 0.6)
    }
    s.every(3200, 3200, () => {
      const t = ctx.currentTime + 0.05
      beat(t, 0.5)
      beat(t + 0.28, 0.3)
    })

    // редкий шёпот: шум, проплывающий по частотам
    s.every(9000, 20000, () => {
      const t = ctx.currentTime
      const src = ctx.createBufferSource()
      src.buffer = this.white
      src.loop = true
      const band = ctx.createBiquadFilter()
      band.type = 'bandpass'
      band.Q.value = 6
      band.frequency.setValueAtTime(400, t)
      band.frequency.exponentialRampToValueAtTime(2400, t + 3)
      band.frequency.exponentialRampToValueAtTime(600, t + 6)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(0.05, t + 2.5)
      g.gain.linearRampToValueAtTime(0.0001, t + 6)
      src.connect(band).connect(g).connect(s.send)
      src.start(t, Math.random() * 2)
      src.stop(t + 6.2)
    })

    return { stop: s.stop }
  }
}

export const soundscape = new Soundscape()
