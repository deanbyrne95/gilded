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

  // Per-colour gem pitches (a bright, consonant pentatonic so any combination of
  // gems still sounds pleasing). Darker stones ring lower; Diamond is brightest,
  // Gold brightest of all. Used so each gem has its own recognisable voice.
  const GEM_HZ={ black:1046.50, red:1174.66, green:1396.91, blue:1567.98, white:1760.00, gold:2093.00 };
  function gemFreq(c){ return GEM_HZ[c] || 1567.98; }

  // A single, more authentic gemstone "clink": a very short hard-contact noise
  // transient (stone tapping stone) followed by a crystalline body built from
  // *inharmonic* partials with a touch of random detune, so it rings like a cut
  // gem rather than a pure tone. Decays fast and glassy.
  function gemTink(t0,freq,peak,dur){
    const D=dur||0.42, p=peak||0.22, d=1+(Math.random()*0.012-0.006);
    noise(t0,0.016,"highpass",4200,0.7,p*0.55);        // contact transient
    tone(freq*d,      t0, D,      "sine", p,      0.001);
    tone(freq*2.76*d, t0, D*0.55, "sine", p*0.36, 0.001);
    tone(freq*5.40*d, t0, D*0.28, "sine", p*0.15, 0.001);
  }
  // A soft, low settle — gems coming to rest in a hand or leather pouch.
  function pouch(t0,peak){ noise(t0,0.16,"lowpass",300,1,peak||0.13); }

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
  // Some accept an options object `o` (e.g. the gem colour, or a take plan).
  const CUES={
    // a single gem lifted from the bank — one crystalline clink at that gem's pitch
    pick:(t,o)=>{ gemTink(t, gemFreq(o&&o.color), 0.24, 0.42); },
    // a gem promoted to a double take — a quick paired clink of the same stone
    pickDouble:(t,o)=>{ const f=gemFreq(o&&o.color); gemTink(t,f,0.20,0.34); gemTink(t+0.075,f,0.18,0.44); },
    // a gem put back — a softer, slightly muted clink a little lower
    deselect:(t,o)=>{ gemTink(t, gemFreq(o&&o.color)*0.75, 0.15, 0.28); },
    // gems taken on a turn — scoop each chosen stone as a staggered clink at its
    // own pitch (so count *and* colours are audible), then a soft pouch settle.
    take:(t,o)=>{
      const seq=[];
      if(o&&typeof o==="object"){ for(const k in o){ const n=o[k]|0; for(let i=0;i<n;i++) seq.push(k); } }
      if(!seq.length){ seq.push("white","blue"); }              // fallback (e.g. previews)
      seq.forEach((k,i)=> gemTink(t+i*0.062+Math.random()*0.014, gemFreq(k)*(0.99+Math.random()*0.02), 0.21, 0.38));
      pouch(t+seq.length*0.062+0.02, 0.12);
    },
    // a card bought — a handful of gems tumbling down onto a pile, then a settle
    buy:(t)=>{
      pouch(t+0.02,0.20);                                       // soft settle thud
      const notes=["gold","white","blue","green","red","white","black"];
      for(let i=0;i<notes.length;i++)
        gemTink(t+0.01+i*0.045+Math.random()*0.012, gemFreq(notes[i])*(0.98+Math.random()*0.04), 0.13, 0.24);
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
    // single gem clink (volume preview)
    gem:(t)=>{ gemTink(t,gemFreq("white"),0.22,0.42); },
    // soft, subtle UI tick for menu/header buttons
    click:(t)=>{ tone(1050,t,0.030,"triangle",0.09,0.001); noise(t,0.022,"highpass",2600,0.4,0.06); },
    error:(t)=>{ tone(160,t,0.20,"sawtooth",0.18,0.01); tone(150,t+0.05,0.18,"sawtooth",0.14,0.01); },
  };
  function cue(name,opts){ const fn=CUES[name]; if(fn) play((t)=>fn(t,opts)); }

  return { cue, unlock, setVolume, ensure };
})();

// Global convenience wrapper used across the game; never throws.
// `opts` is cue-specific (e.g. { color } for pick/deselect, or a take plan for take).
function sfx(name,opts){ try{ Sfx.cue(name,opts); }catch(e){} }

// Create the AudioContext eagerly (it starts suspended until a gesture), so the
// first sound isn't lost to context-startup latency. Harmless if unsupported.
try{ Sfx.ensure(); }catch(e){}

/* ---------------------------------------------------------------------------
 * Music — plays a bundled, properly-licensed medieval tavern-folk *recording*
 * on a loop, so the game has a realistic acoustic soundtrack (lively strings,
 * hand percussion and winds) rather than synthesised tones. The track is
 * "Lord of the Land" by Kevin MacLeod (incompetech.com), licensed CC BY 3.0 —
 * see README credits. It streams through a single <audio> element, which works
 * from a plain file:// open as well as a web server, respects the Music volume
 * slider, and only begins once the player interacts (browser autoplay policy).
 * Public API is unchanged: start / stop / setVolume / toggle.
 * ------------------------------------------------------------------------- */
const Music = (function(){
  const SRC="assets/audio/lord-of-the-land.mp3";   // http(s) fallback path
  // Hard ceiling on the actual playback volume: the Settings slider runs 0–100%
  // of THIS value, so even at 100% the music stays a comfortable background bed
  // rather than blasting at full scale. Tuned low so a mid-slider (50%) setting
  // lands at a gentle listening level, leaving fine control across the range.
  const MUSIC_CEILING=0.1;
  let el=null, on=false;

  function mvol(){ const v=(typeof SETTINGS!=="undefined"&&SETTINGS.musicVol!=null)?+SETTINGS.musicVol:0.5; return Math.max(0,Math.min(1,v))*MUSIC_CEILING; }
  function wanted(){ return typeof SETTINGS!=="undefined" && SETTINGS.music!==false; }

  // Resolve the track source. Prefer the inline data URI (assets/audio/
  // lord-of-the-land.js), which plays even from a file:// page — where browsers
  // refuse to load a separate <audio> file as a subresource ("Format error").
  // Fall back to the on-disk mp3 when served over http(s).
  function srcUrl(){
    if(typeof window!=="undefined" && window.GILDED_MUSIC) return window.GILDED_MUSIC;
    try{ return new URL(SRC, document.baseURI).href.replace(/^(file:\/\/\/[A-Za-z])%3[Aa]\//,"$1:/"); }
    catch(e){ return SRC; }
  }

  // Lazily create the streaming element so nothing loads until music is wanted.
  function ensure(){
    if(el) return el;
    el=document.createElement("audio");
    el.src=srcUrl();
    el.loop=true;
    el.preload="auto";
    el.volume=mvol();
    el.setAttribute("playsinline","");         // allow inline playback on mobile
    el.style.display="none";
    el.addEventListener("error",()=>{ try{ console.warn("[Gilded] music failed to load:",SRC, el.error&&el.error.message); }catch(e){} });
    try{ (document.body||document.documentElement).appendChild(el); }catch(e){}  // in-DOM helps some browsers
    return el;
  }

  function start(){
    if(!wanted()) return;
    const a=ensure(); a.volume=mvol(); on=true;
    // play() may reject until the first user gesture; armAudio() retries on every
    // pointer/key event, so it starts as soon as the browser allows it.
    const p=a.play();
    if(p&&p.catch) p.catch(()=>{});
  }
  function stop(){ on=false; if(el){ try{ el.pause(); }catch(e){} } }
  function setVolume(){ if(el){ el.volume=mvol(); } }
  function toggle(){ if(wanted()) start(); else stop(); }
  return { start, stop, setVolume, toggle };
})();
