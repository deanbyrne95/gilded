"use strict";

/* ============================================================================
 * audio.js — lightweight sound effects, synthesised live with the Web Audio API
 * (no asset files). Cues are short tone sequences with a soft envelope. The
 * AudioContext is created eagerly at load so it is ready the instant the user
 * first interacts — browsers still block *sound* until that first gesture, but
 * this way even the very first click plays (no dropped-first-sound latency).
 * Respects the Sound-effects / Volume settings.
 * ==========================================================================*/

const Sfx = (function(){
  let ctx=null, master=null;

  // Read prefs defensively — SETTINGS is defined in ui.js and may load later.
  function vol(){ const v=(typeof SETTINGS!=="undefined" && SETTINGS.volume!=null)?+SETTINGS.volume:0.6; return Math.max(0,Math.min(1,v)); }
  function enabled(){ return typeof SETTINGS==="undefined" || SETTINGS.sound!==false; }

  function ensure(){
    if(ctx) return ctx;
    try{
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = vol();
      master.connect(ctx.destination);
    }catch(e){ ctx=null; master=null; }
    return ctx;
  }

  // Kick the context alive on a user gesture (no-op once running). Also plays a
  // one-sample silent buffer, which is what actually unlocks audio on iOS.
  function unlock(){
    const c=ensure(); if(!c) return;
    if(c.state==="suspended"){ try{ c.resume(); }catch(e){} }
    try{ const b=c.createBufferSource(); b.buffer=c.createBuffer(1,1,c.sampleRate); b.connect(c.destination); b.start(0); }catch(e){}
  }

  // Re-apply the current volume to the live master gain.
  function setVolume(){ if(ctx && master){ try{ master.gain.setTargetAtTime(vol(), ctx.currentTime, 0.015); }catch(e){ master.gain.value=vol(); } } }

  // One oscillator with a quick attack and exponential decay.
  function tone(freq,t0,dur,type,peak,attack){
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type=type||"sine"; o.frequency.setValueAtTime(freq,t0);
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(peak||0.28,t0+(attack||0.012));
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0+dur+0.03);
  }

  // A glassy "tink" — a fast-attack fundamental plus inharmonic partials, so it
  // rings like a small gem/crystal rather than a plain beep.
  function ting(t0,freq,peak,dur){
    const D=dur||0.4, p=peak||0.22;
    tone(freq,     t0, D,      "sine", p,      0.003);
    tone(freq*2.01,t0, D*0.7,  "sine", p*0.45, 0.003);
    tone(freq*3.4, t0, D*0.4,  "sine", p*0.2,  0.003);
  }

  // Reusable white-noise buffer (for card flicks and the settle thud).
  let noiseBuf=null;
  function noiseBuffer(){
    if(noiseBuf) return noiseBuf;
    const len=Math.floor(ctx.sampleRate*0.5);
    noiseBuf=ctx.createBuffer(1,len,ctx.sampleRate);
    const data=noiseBuf.getChannelData(0);
    for(let i=0;i<len;i++) data[i]=Math.random()*2-1;
    return noiseBuf;
  }
  // A filtered noise burst; returns the filter so callers can sweep it.
  function noise(t0,dur,ftype,freq,q,peak){
    const src=ctx.createBufferSource(); src.buffer=noiseBuffer();
    const f=ctx.createBiquadFilter(); f.type=ftype||"bandpass";
    f.frequency.setValueAtTime(freq||2000,t0); if(q!=null) f.Q.value=q;
    const g=ctx.createGain();
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(peak||0.3,t0+0.005);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0+dur+0.03);
    return f;
  }

  function play(fn){
    if(!enabled()) return;
    const c=ensure(); if(!c) return;
    if(c.state==="suspended"){ try{ c.resume(); }catch(e){} }
    try{ fn(c.currentTime+0.001); }catch(e){}
  }

  // Named cues, sound-designed to evoke the action rather than beep generically.
  const CUES={
    // gems picked up — a couple of bright glass tinkles
    take:(t)=>{ ting(t,1760,0.20,0.34); ting(t+0.07,2093,0.17,0.30); },
    // a card bought — a handful of gems tumbling down onto a pile, then a settle
    buy:(t)=>{
      noise(t+0.02,0.13,"lowpass",320,1,0.22);                 // soft settle thud
      const notes=[2093,1760,1976,1568,1318,1760,1174];
      for(let i=0;i<notes.length;i++)
        ting(t+0.01+i*0.045+Math.random()*0.012, notes[i]*(0.97+Math.random()*0.06), 0.13, 0.22);
    },
    // a card reserved — a paper flick (bandpass noise sweeping down) then a tap
    reserve:(t)=>{
      const f=noise(t,0.20,"bandpass",2800,0.6,0.34);
      f.frequency.setValueAtTime(3200,t);
      f.frequency.exponentialRampToValueAtTime(700,t+0.18);
      tone(180,t+0.14,0.12,"sine",0.18,0.004);                 // card lands
    },
    // a patron visits — a bright two-note bell
    noble:(t)=>{ ting(t,1046,0.26,0.6); ting(t+0.12,1568,0.22,0.7); },
    // victory — a rising fanfare with a sparkle tail
    win:(t)=>{
      [523,659,784,1046].forEach((f,i)=> tone(f,t+i*0.14,0.30,"triangle",0.3,0.01));
      ting(t+0.5,1568,0.20,0.8); ting(t+0.62,2093,0.17,0.9);
    },
    // single tinkle (volume preview)
    gem:(t)=>{ ting(t,1760,0.20,0.34); },
    // soft, subtle UI tick for menu/header buttons
    click:(t)=>{ tone(1050,t,0.030,"triangle",0.09,0.001); noise(t,0.022,"highpass",2600,0.4,0.06); },
    error:(t)=>{ tone(160,t,0.20,"sawtooth",0.18,0.01); tone(150,t+0.05,0.18,"sawtooth",0.14,0.01); },
  };
  function cue(name){ const fn=CUES[name]; if(fn) play(fn); }

  return { cue, unlock, setVolume, ensure };
})();

// Global convenience wrapper used across the game; never throws.
function sfx(name){ try{ Sfx.cue(name); }catch(e){} }

// Create the AudioContext eagerly (it starts suspended until a gesture), so the
// first sound isn't lost to context-startup latency. Harmless if unsupported.
try{ Sfx.ensure(); }catch(e){}

/* ---------------------------------------------------------------------------
 * Music — an upbeat, generative medieval folk-dance loop in the spirit of the
 * Gwent theme from The Witcher 3: ~112 BPM in D minor / Dorian, driven by a
 * frame-drum groove, a "boom-chuck" bass-and-lute accompaniment, a hurdy-gurdy
 * open-fifth drone, and a lively vibrato fiddle. It runs as a three-section
 * form (A–B–C, 24 bars ≈ 52 s) with a dynamic drop and section-end fills, so it
 * doesn't feel repetitive too soon. Shares the Sfx AudioContext but mixes
 * through its own gain so music and effects have independent volumes. No audio
 * files — everything is synthesised live.
 * ------------------------------------------------------------------------- */
const Music = (function(){
  let mg=null, timer=null, on=false, idx=0, _nb=null;

  // Note table (Hz) for readability. D minor / Dorian palette.
  const N={ A3:220.00,C4:261.63,Cs4:277.18,D4:293.66,E4:329.63,F4:349.23,
            G4:392.00,A4:440.00,Bb4:466.16,B4:493.88,C5:523.25,Cs5:554.37,
            D5:587.33,E5:659.25,F5:698.46,G5:783.99,A5:880.00 };

  // Sustained open-fifth hurdy-gurdy drone (D2 + A2) under the whole tune.
  const DRONE=[73.42,110.00];

  // ---- Three-section form (A–B–C, 24 bars ≈ 52 s) so it doesn't loop too soon.
  // Each bar carries a lute chord + a bass root (both in octave 2/4 registers).
  // Section A — home: i – ♭VII – i – V(maj) (Dm–C–Dm–A), the infectious hook.
  const CH_A=[
    {l:[N.D4,N.F4,N.A4], b:73.42},   // Dm
    {l:[N.C4,N.E4,N.G4], b:65.41},   // C
    {l:[N.D4,N.F4,N.A4], b:73.42},   // Dm
    {l:[N.A3,N.Cs4,N.E4],b:110.00},  // A (major V)
    {l:[N.D4,N.F4,N.A4], b:73.42},   // Dm
    {l:[N.C4,N.E4,N.G4], b:65.41},   // C
    {l:[N.D4,N.F4,N.A4], b:73.42},   // Dm
    {l:[N.A3,N.Cs4,N.E4],b:110.00},  // A (major V)
  ];
  // Section B — brighter lift toward the relative major (F), with a ♭VI (Bb).
  const CH_B=[
    {l:[N.C4,N.F4,N.A4], b:87.31},   // F
    {l:[N.C4,N.E4,N.G4], b:65.41},   // C
    {l:[N.D4,N.F4,N.A4], b:73.42},   // Dm
    {l:[N.D4,N.F4,N.Bb4],b:116.54},  // Bb (♭VI)
    {l:[N.C4,N.F4,N.A4], b:87.31},   // F
    {l:[N.C4,N.E4,N.G4], b:65.41},   // C
    {l:[N.A3,N.Cs4,N.E4],b:110.00},  // A (major V)
    {l:[N.A3,N.Cs4,N.E4],b:110.00},  // A
  ];
  // Section C — a stripped "call" that builds back to a high peak and turnaround.
  const CH_C=[
    {l:[N.D4,N.F4,N.A4], b:73.42},   // Dm
    {l:[N.D4,N.F4,N.A4], b:73.42},   // Dm
    {l:[N.C4,N.F4,N.A4], b:87.31},   // F
    {l:[N.C4,N.E4,N.G4], b:65.41},   // C
    {l:[N.D4,N.F4,N.A4], b:73.42},   // Dm
    {l:[N.D4,N.F4,N.Bb4],b:116.54},  // Bb
    {l:[N.A3,N.Cs4,N.E4],b:110.00},  // A
    {l:[N.A3,N.Cs4,N.E4],b:110.00},  // A
  ];
  const CH=CH_A.concat(CH_B,CH_C);

  // Fiddle line — one array of 8 eighth-note slots per bar (0 = rest). Three
  // distinct 8-bar melodies keep it fresh; A's bars 1 & 5 share a punchy motif
  // so the ear still latches onto a recognisable hook.
  const MEL=[
    // A (home hook)
    [N.A4,0,   N.D5,0,   N.A4,N.F4,N.A4,0   ],
    [N.G4,0,   N.C5,0,   N.D5,N.C5,N.A4,0   ],
    [N.D5,0,   N.F5,N.E5,N.D5,0,   N.A4,0   ],
    [N.E5,0,   N.D5,0,   N.Cs5,0,  N.A4,0   ],
    [N.A4,0,   N.D5,0,   N.A4,N.F4,N.A4,0   ],
    [N.G4,0,   N.C5,0,   N.E5,N.D5,N.C5,0   ],
    [N.F5,N.E5,N.D5,N.C5,N.D5,0,   N.E5,0   ],
    [N.D5,0,   0,   0,   N.A4,0,   N.D5,0   ],
    // B (lyrical, longer notes, brighter)
    [N.A4,0,   0,   0,   N.C5,0,   N.D5,0   ],
    [N.C5,0,   0,   0,   N.Bb4,0,  N.G4,0   ],
    [N.A4,0,   N.D5,0,   N.F5,0,   N.E5,0   ],
    [N.D5,0,   0,   0,   N.C5,0,   N.A4,0   ],
    [N.A4,0,   0,   0,   N.C5,0,   N.D5,0   ],
    [N.E5,0,   N.D5,0,   N.C5,0,   N.Bb4,0  ],
    [N.A4,0,   N.Cs5,0,  N.E5,0,   N.Cs5,0  ],
    [N.E5,0,   N.D5,0,   N.Cs5,0,  N.A4,0   ],
    // C (call-and-build up to a high peak)
    [N.A4,0,   N.A4,0,   N.A4,0,   N.C5,0   ],
    [N.D5,0,   N.C5,0,   N.A4,0,   N.F4,0   ],
    [N.C5,0,   N.C5,0,   N.D5,0,   N.C5,0   ],
    [N.G4,0,   N.Bb4,0,  N.C5,0,   0,   0   ],
    [N.D5,0,   N.E5,0,   N.F5,0,   N.E5,0   ],
    [N.D5,0,   N.C5,0,   N.Bb4,0,  N.A4,0   ],
    [N.Cs5,0,  N.E5,0,   N.A5,0,   N.E5,0   ], // peak (high A5)
    [N.E5,0,   N.Cs5,0,  N.A4,0,   0,   0   ], // resolve, breathe before loop
  ];
  const BARS=CH.length;

  // Frame-drum groove (per bar, 8 eighths): 2=low "dum", 1=high "tek", 0.5=ghost.
  const DR=[2,0.5,1,0.5,2,0.5,1,2];
  const DR_FILL=[2,1,2,1,2,1,1,1];   // busier turnaround at each section's end
  // Drop the drums for section C's first four bars, then bring them back — a
  // dynamic dip that resets the ear and makes the build land harder.
  function drumsOn(b){ return !(b>=16 && b<=19); }

  function mvol(){ const v=(typeof SETTINGS!=="undefined"&&SETTINGS.musicVol!=null)?+SETTINGS.musicVol:0.25; return Math.max(0,Math.min(1,v)); }
  function wanted(){ return typeof SETTINGS!=="undefined" && SETTINGS.music!==false; }
  function ctx(){ return Sfx.ensure(); }
  function ensureGain(c){ if(mg) return mg; mg=c.createGain(); mg.gain.value=mvol(); mg.connect(c.destination); return mg; }
  function nbuf(c){ if(_nb) return _nb; const len=(c.sampleRate*0.3)|0; _nb=c.createBuffer(1,len,c.sampleRate); const d=_nb.getChannelData(0); for(let i=0;i<len;i++) d[i]=Math.random()*2-1; return _nb; }

  // Plucked lute string — bright, fast attack, quick decay, filter closing as it
  // rings so the note darkens like a real plucked string.
  function pluck(c,freq,t0,dur,peak){
    const o=c.createOscillator(), o2=c.createOscillator(), g=c.createGain(), f=c.createBiquadFilter();
    o.type="sawtooth"; o.frequency.setValueAtTime(freq,t0);
    o2.type="triangle"; o2.frequency.setValueAtTime(freq*2,t0);
    f.type="lowpass"; f.frequency.setValueAtTime(2600,t0);
    f.frequency.exponentialRampToValueAtTime(650,t0+dur*0.9);
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(peak||0.06,t0+0.006);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(mg);
    o.start(t0); o2.start(t0); o.stop(t0+dur+0.05); o2.stop(t0+dur+0.05);
  }
  // Rolled lute chord — the offbeat "chuck" of the boom-chuck groove.
  function strum(c,tones,t0,peak){ tones.forEach((fr,i)=> pluck(c,fr,t0+i*0.012,0.42,peak||0.055)); }

  // Round bass note on the beat — the "boom".
  function bass(c,freq,t0,peak){
    const o=c.createOscillator(), g=c.createGain(), f=c.createBiquadFilter();
    o.type="triangle"; o.frequency.setValueAtTime(freq,t0);
    f.type="lowpass"; f.frequency.setValueAtTime(420,t0);
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(peak||0.16,t0+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+0.4);
    o.connect(f); f.connect(g); g.connect(mg);
    o.start(t0); o.stop(t0+0.45);
  }

  // Sustained hurdy-gurdy drone reed — gentle swell, dark and quiet.
  function drone(c,freq,t0,dur,peak){
    const o=c.createOscillator(), g=c.createGain(), f=c.createBiquadFilter();
    o.type="sawtooth"; o.frequency.setValueAtTime(freq,t0);
    f.type="lowpass"; f.frequency.setValueAtTime(460,t0);
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(peak||0.035,t0+0.4);
    g.gain.setValueAtTime(peak||0.035,t0+dur*0.8);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    o.connect(f); f.connect(g); g.connect(mg);
    o.start(t0); o.stop(t0+dur+0.05);
  }

  // Bowed fiddle lead — sawtooth with a light vibrato LFO and a bowed attack;
  // this carries the catchy melodic hook and sits on top of the mix.
  function fiddle(c,freq,t0,dur,peak){
    if(!freq) return;
    const o=c.createOscillator(), g=c.createGain(), f=c.createBiquadFilter();
    const lfo=c.createOscillator(), lg=c.createGain();
    o.type="sawtooth"; o.frequency.setValueAtTime(freq,t0);
    lfo.type="sine"; lfo.frequency.setValueAtTime(5.5,t0); lg.gain.setValueAtTime(freq*0.008,t0);
    lfo.connect(lg); lg.connect(o.frequency);
    f.type="lowpass"; f.frequency.setValueAtTime(2700,t0);
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(peak||0.15,t0+0.03);
    g.gain.setValueAtTime(peak||0.15,t0+dur*0.7);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    o.connect(f); f.connect(g); g.connect(mg);
    o.start(t0); lfo.start(t0); o.stop(t0+dur+0.05); lfo.stop(t0+dur+0.05);
  }

  // Frame drum — a pitched membrane body (fast downward glide) plus a noise slap.
  function drum(c,t0,code){
    if(!code) return;
    if(code===2){                               // low "dum"
      const o=c.createOscillator(), g=c.createGain();
      o.type="sine"; o.frequency.setValueAtTime(170,t0); o.frequency.exponentialRampToValueAtTime(58,t0+0.12);
      g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(0.3,t0+0.005); g.gain.exponentialRampToValueAtTime(0.0001,t0+0.22);
      o.connect(g); g.connect(mg); o.start(t0); o.stop(t0+0.26);
      const s=c.createBufferSource(); s.buffer=nbuf(c); const f=c.createBiquadFilter(); f.type="lowpass"; f.frequency.value=1200; const sg=c.createGain();
      sg.gain.setValueAtTime(0.12,t0); sg.gain.exponentialRampToValueAtTime(0.0001,t0+0.05); s.connect(f); f.connect(sg); sg.connect(mg); s.start(t0); s.stop(t0+0.06);
    } else if(code===1){                        // high "tek"
      const o=c.createOscillator(), g=c.createGain();
      o.type="sine"; o.frequency.setValueAtTime(340,t0); o.frequency.exponentialRampToValueAtTime(190,t0+0.05);
      g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(0.14,t0+0.004); g.gain.exponentialRampToValueAtTime(0.0001,t0+0.08);
      o.connect(g); g.connect(mg); o.start(t0); o.stop(t0+0.1);
      const s=c.createBufferSource(); s.buffer=nbuf(c); const f=c.createBiquadFilter(); f.type="highpass"; f.frequency.value=2500; const sg=c.createGain();
      sg.gain.setValueAtTime(0.1,t0); sg.gain.exponentialRampToValueAtTime(0.0001,t0+0.04); s.connect(f); f.connect(sg); sg.connect(mg); s.start(t0); s.stop(t0+0.05);
    } else {                                    // ghost tap (0.5)
      const s=c.createBufferSource(); s.buffer=nbuf(c); const f=c.createBiquadFilter(); f.type="bandpass"; f.frequency.value=1800; const sg=c.createGain();
      sg.gain.setValueAtTime(0.05,t0); sg.gain.exponentialRampToValueAtTime(0.0001,t0+0.03); s.connect(f); f.connect(sg); sg.connect(mg); s.start(t0); s.stop(t0+0.04);
    }
  }

  function scheduleBar(){
    if(!on) return;
    const c=ctx(); if(!c){ on=false; return; }
    if(c.state==="suspended"){ try{ c.resume(); }catch(e){} }
    ensureGain(c);
    const b=idx%BARS, ch=CH[b], mel=MEL[b];
    const E=0.27, bar=8*E;                       // eighth note; ~112 BPM
    const t=c.currentTime+0.06;
    DRONE.forEach(fr=> drone(c, fr, t, bar*1.02, 0.035));   // hurdy-gurdy pedal
    const kit=drumsOn(b), pat=(b%8===7)?DR_FILL:DR;         // fill each section end
    for(let i=0;i<8;i++){
      const tt=t+i*E;
      if(kit) drum(c, tt, pat[i]);               // frame-drum groove (drops in C)
      if(i%2===0) bass(c, ch.b, tt);             // "boom" on the beat
      else strum(c, ch.l, tt);                   // "chuck" on the offbeat
      const m=mel[i]; if(m) fiddle(c, m, tt, E*1.7, 0.15);   // fiddle line
    }
    idx++;
    timer=setTimeout(scheduleBar, bar*1000);
  }
  function start(){
    if(on || !wanted()) return;
    const c=ctx(); if(!c) return;
    if(c.state==="suspended"){ try{ c.resume(); }catch(e){} }
    ensureGain(c); mg.gain.setTargetAtTime(mvol(), c.currentTime, 0.1);
    on=true; idx=0; scheduleBar();
  }
  function stop(){ on=false; if(timer){ clearTimeout(timer); timer=null; } if(mg && ctx()){ try{ mg.gain.setTargetAtTime(0.0001, ctx().currentTime, 0.2); }catch(e){} } }
  function setVolume(){ if(mg && ctx()){ try{ mg.gain.setTargetAtTime(mvol(), ctx().currentTime, 0.05); }catch(e){} } }
  function toggle(){ if(wanted()) start(); else stop(); }
  return { start, stop, setVolume, toggle };
})();
