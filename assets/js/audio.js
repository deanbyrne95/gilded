"use strict";

/* ============================================================================
 * audio.js — sound effects played from bundled, recorded CC0 samples (Kenney
 * audio packs) via the Web Audio API, plus the background-music player. Samples
 * are decoded once into AudioBuffers; gems keep a per-colour "voice" by pitch-
 * shifting a glass sample. The AudioContext is created eagerly at load so it is
 * ready the instant the user first interacts — browsers still block *sound*
 * until that first gesture, but this way even the very first click plays.
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
      decodeAll();
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

  // ---- Recorded-sample playback -------------------------------------------
  // Real one-shot samples (Kenney CC0 packs) are bundled as base64 data URIs in
  // window.GILDED_SFX (assets/js/sfx.js) and decoded once into AudioBuffers,
  // so cues are actual recordings rather than synthesised tones.
  const SAMPLES=Object.create(null);
  let decoding=false;

  function b64ToBuf(uri){
    const b64=String(uri).split(",")[1]||"";
    const bin=atob(b64), n=bin.length, bytes=new Uint8Array(n);
    for(let i=0;i<n;i++) bytes[i]=bin.charCodeAt(i);
    return bytes.buffer;
  }
  // Decode every bundled sample into an AudioBuffer (idempotent). decodeAudioData
  // works while the context is suspended, so this can run before any gesture.
  function decodeAll(){
    if(decoding || !ctx) return; decoding=true;
    const src=(typeof window!=="undefined" && window.GILDED_SFX)||{};
    for(const name in src){
      let ab; try{ ab=b64ToBuf(src[name]); }catch(e){ continue; }
      const store=(b)=>{ if(b) SAMPLES[name]=b; };
      try{
        const p=ctx.decodeAudioData(ab, store, ()=>{});
        if(p && p.then) p.then(store, ()=>{});
      }catch(e){}
    }
  }

  // Play a decoded sample: pitch via `rate`, level via `gain`, starting at `t0`.
  function playBuf(name,t0,o){
    o=o||{}; const buf=SAMPLES[name]; if(!buf) return;
    const s=ctx.createBufferSource(); s.buffer=buf;
    s.playbackRate.value=o.rate||1;
    const g=ctx.createGain(); g.gain.value=(o.gain!=null?o.gain:1);
    s.connect(g); g.connect(master);
    s.start(t0!=null?t0:ctx.currentTime+0.001);
    s.onended=()=>{ try{ s.disconnect(); g.disconnect(); }catch(e){} };
    return s;
  }

  // Per-colour gem pitch: one glass sample, gently shifted so each stone keeps
  // its own voice (darker lower, Gold brightest). A modest spread — wide pitch-
  // shifting a single sample sounds artificial, so we keep it subtle.
  const GEM_RATE={ black:0.90, red:0.96, green:1.00, blue:1.06, white:1.12, gold:1.19 };
  function gemRate(c){ return GEM_RATE[c] || 1.0; }
  // A tiny random detune (±1.5%) so repeated clinks feel organic, not identical.
  function detune(){ return 0.985+Math.random()*0.03; }
  // The two "lose" fanfares alternate on each defeat so it isn't the same flub twice.
  let loseAlt=0;

  // Named cues, built from recorded samples. Some accept an options object `o`
  // (the gem colour, or a take plan of {colour:count}).
  const CUES={
    // a single gem lifted from the bank — one glass clink at that gem's pitch
    pick:(t,o)=>{ playBuf("glass", t, {rate:gemRate(o&&o.color)*detune(), gain:0.85}); },
    // a gem promoted to a double take — a quick paired clink of the same stone
    pickDouble:(t,o)=>{ const r=gemRate(o&&o.color); playBuf("glass",t,{rate:r*detune(),gain:0.8}); playBuf("glass",t+0.085,{rate:r*detune(),gain:0.72}); },
    // a gem put back — a softer, slightly lower clink
    deselect:(t,o)=>{ playBuf("glass", t, {rate:gemRate(o&&o.color)*0.9*detune(), gain:0.5}); },
    // gems taken on a turn — a scoop, then each chosen stone as a staggered clink
    // at its own pitch (so count *and* colours are audible), then a pouch settle.
    take:(t,o)=>{
      const seq=[];
      if(o&&typeof o==="object"){ for(const k in o){ const n=o[k]|0; for(let i=0;i<n;i++) seq.push(k); } }
      if(!seq.length){ seq.push("white","blue"); }              // fallback (e.g. previews)
      playBuf("scoop", t, {gain:0.5});
      seq.forEach((k,i)=> playBuf("glass", t+0.05+i*0.08, {rate:gemRate(k)*detune(), gain:0.78}));
      playBuf("settle", t+0.06+seq.length*0.08, {gain:0.6});
    },
    // a card selected/deselected on the board — a light paper flick
    cardTap:(t)=>{ playBuf("cardSlide", t, {rate:1.14, gain:0.4}); },
    // a card bought — the card slapped down while gems are paid out
    buy:(t)=>{ playBuf("cardPlace", t, {gain:0.85}); playBuf("coins", t+0.06, {gain:0.5}); },
    // a card reserved — slid out of the row, then tapped into the reserve
    reserve:(t)=>{ playBuf("cardSlide", t, {gain:0.8}); playBuf("cardPlace", t+0.16, {rate:1.05, gain:0.55}); },
    // a patron visits — a short, regal trumpet flourish
    noble:(t)=>{ playBuf("noble", t, {gain:0.85}); },
    // you win the match — a triumphant trumpet fanfare
    win:(t)=>{ playBuf("win", t, {gain:0.9}); },
    // you lose the match — a deflating trumpet, alternating between two takes
    lose:(t)=>{ playBuf((loseAlt++ % 2) ? "loseB" : "loseA", t, {gain:0.85}); },
    // single gem clink (volume preview)
    gem:(t)=>{ playBuf("glass", t, {rate:gemRate("white"), gain:0.85}); },
    // soft, subtle UI tick for menu/header buttons
    click:(t)=>{ playBuf("click", t, {gain:0.5}); },
    // an invalid action
    error:(t)=>{ playBuf("error", t, {gain:0.6}); },
  };
  function cue(name,opts){
    if(!enabled()) return;
    const c=ensure(); if(!c) return;
    if(c.state==="suspended"){ try{ c.resume(); }catch(e){} }
    const fn=CUES[name]; if(fn){ try{ fn(c.currentTime+0.001, opts); }catch(e){} }
  }

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
  // Hard ceiling on the actual playback volume: the Settings slider runs 0–100%
  // of THIS value, so even at 100% the music stays a comfortable background bed
  // rather than blasting at full scale. Tuned low so a mid-slider (50%) setting
  // lands at a gentle listening level, leaving fine control across the range.
  const MUSIC_CEILING=0.1;
  let el=null, on=false;

  function mvol(){ const v=(typeof SETTINGS!=="undefined"&&SETTINGS.musicVol!=null)?+SETTINGS.musicVol:0.5; return Math.max(0,Math.min(1,v))*MUSIC_CEILING; }
  function wanted(){ return typeof SETTINGS!=="undefined" && SETTINGS.music!==false; }

  // The track is bundled as an inline base64 data URI (assets/js/music.js ->
  // window.GILDED_MUSIC), which plays even from a file:// page, where browsers
  // refuse to load a separate <audio> file as a subresource.
  function srcUrl(){ return (typeof window!=="undefined" && window.GILDED_MUSIC) || ""; }

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
    el.addEventListener("error",()=>{ try{ console.warn("[Gilded] music failed to load:", el.error&&el.error.message); }catch(e){} });
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
