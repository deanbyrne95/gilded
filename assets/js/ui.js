"use strict";

/* ============================================================================
 * ui.js — modals and chrome: tutorial, start-game menu, settings, the menu,
 * theme, header layout, and the saved-session system (persist / autosave /
 * load / delete, capped at MAX_SESSIONS in localStorage).
 * ==========================================================================*/

/* ---------- modals ---------- */

// Shared modal scaffold. `dismiss` controls whether clicking the backdrop closes it.
const scrim=document.getElementById("scrim");
const modalEl=document.getElementById("modal");
function openModal(html,dismiss=true,cls=""){ modalEl.className="modal"+(cls?" "+cls:""); modalEl.innerHTML=html; scrim.classList.add("show"); scrim.dataset.dismiss=dismiss?"1":"0"; haltAI(); focusModal(); }
// Move focus into the freshly opened modal so keyboard users land on a control
// (and Enter/arrow keys work immediately). Prefers a [data-autofocus] target,
// then the first enabled button. The focus ring only shows for keyboard users.
function focusModal(){ try{ const f=modalEl.querySelector('[data-autofocus]:not([disabled]),button:not([disabled])'); if(f) f.focus({preventScroll:true}); }catch(e){} }
function closeModal(){ scrim.classList.remove("show"); paused=false; resumeAI(); syncPauseUI(); }

// Inline gem glyph for use inside prose.
function ig(c){ return `<span class="inline-gem g-${c}"></span>`; }

// Markup for the how-to-play tutorial.
// The how-to-play body (no chrome), shared by the standalone tutorial modal and
// the Settings ▸ How to Play tab. It is fully illustrated: the Bank, a sample
// development card, and a sample patron are built from the game's REAL components
// (the same gem/card/patron markup used on the board) so the guide matches play.
function htIcon(name){
  const p={
    bank:'<circle cx="12" cy="12" r="8"/><path d="M12 8.5v7M9.6 10.2a2 2 0 0 1 2-1.7h1a1.8 1.8 0 0 1 .3 3.5l-1.4.4a1.8 1.8 0 0 0 .3 3.5h1a2 2 0 0 0 2-1.7"/>',
    card:'<rect x="7" y="4" width="12" height="16" rx="2"/><path d="M4 7v12a2 2 0 0 0 2 2h9" opacity=".55"/>',
    crown:'<path d="M4 8l3.5 3L12 5l4.5 6L20 8l-1.4 9.5H5.4z"/>',
    turn:'<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8M20 4v4h-4"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 16M4 20v-4h4"/>',
    win:'<path d="M8 4h8v3a4 4 0 0 1-8 0z"/><path d="M8 5H5v1a3 3 0 0 0 3 3M16 5h3v1a3 3 0 0 1-3 3"/><path d="M12 11v4M9 20h6M10 17.5h4"/>',
  }[name]||'';
  return `<svg class="htp-hi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}
function tutorialBodyHTML(){
  // The Bank: every token type as its real faceted gem + name.
  const gemRow = ALL.map(k=>`<span class="htp-tok"><span class="gem g-${k}"></span><small>${NAME[k]}</small></span>`).join("");
  // A sample development card, exactly as it renders on the board: prestige in the
  // coloured band, its purchase cost as gem dots below.
  const sampleCard = `<div class="card htp-demo-card">
    <div class="card-band g-blue"><span class="card-pts">2</span></div>
    <div class="card-body"><div class="cost">${dot('red',3)}${dot('black',2)}</div></div>
  </div>`;
  // A sample patron tile, exactly as it renders on the board.
  const samplePatron = `<div class="noble htp-demo-noble"><div class="np">3<small>prestige</small></div>
    <div class="req">${dot('green',3)}${dot('red',3)}${dot('black',3)}</div></div>`;

  return `<div class="htp">
  <p class="htp-lead">You are a Renaissance gem merchant. Collect gems, buy development cards for their <b>prestige</b> and colour <b>bonuses</b>, attract patrons — and be first to the prestige target (chosen when you start a game).</p>

  <section class="htp-sec">
    <div class="htp-head">${htIcon('bank')}<h3>The Bank</h3></div>
    <div class="htp-body">
      <div class="htp-fig"><div class="htp-gems">${gemRow}</div></div>
      <div class="htp-txt">
        <p>The bank holds five gem colours plus <b>gold</b>. Gold is a wild — it stands in for any colour when buying, and is only gained by reserving.</p>
        <p>On your turn you may <b>take gems</b>: three of different colours, or two of a single colour (only when that pile still has four or more).</p>
      </div>
    </div>
  </section>

  <section class="htp-sec">
    <div class="htp-head">${htIcon('card')}<h3>Development cards</h3></div>
    <div class="htp-body">
      <div class="htp-fig">${sampleCard}</div>
      <div class="htp-txt">
        <p>Buy a card by paying the gem cost shown at its foot (${dot('red',3)} ${dot('black',2)} here). Cards come in three tiers — <b>I</b>, <b>II</b>, <b>III</b> — growing pricier and worth more.</p>
        <p>The corner number is <b>prestige</b>. The band colour is a permanent <b>bonus</b>: this ${ig("blue")} card makes every future purchase cost one less ${ig("blue")}. Stack bonuses and dear cards become cheap.</p>
      </div>
    </div>
  </section>

  <section class="htp-sec">
    <div class="htp-head">${htIcon('crown')}<h3>Patrons</h3></div>
    <div class="htp-body">
      <div class="htp-fig">${samplePatron}</div>
      <div class="htp-txt">
        <p>Patrons are worth <b>3 prestige</b> each. The tile shows what it wants — here <b>3</b> ${ig("green")}, <b>3</b> ${ig("red")} and <b>3</b> ${ig("black")}.</p>
        <p>Requirements are met by your <b>card bonuses</b>, not your gems. When you qualify, the patron visits automatically — no action, no cost.</p>
      </div>
    </div>
  </section>

  <section class="htp-sec">
    <div class="htp-head">${htIcon('turn')}<h3>Your turn — one action</h3></div>
    <div class="htp-body">
      <ul class="htp-actions">
        <li><b>Take 3 gems</b> of different colours.</li>
        <li><b>Take 2 gems</b> of one colour — only if that pile has 4+.</li>
        <li><b>Reserve a card</b> to save it and take a ${ig("gold")} <b>gold</b>. Hold up to 3.</li>
        <li><b>Buy a card</b> from the table or from your reserve.</li>
      </ul>
      <p class="htp-note">You can never end a turn holding more than <b>10</b> tokens — discard the excess if you go over.</p>
    </div>
  </section>

  <section class="htp-sec">
    <div class="htp-head">${htIcon('win')}<h3>Winning</h3></div>
    <div class="htp-body">
      <p>The moment anyone reaches the prestige target, the round is finished so everyone has taken the same number of turns. Highest prestige wins; a tie goes to whoever bought fewer cards.</p>
    </div>
  </section>
</div>`;
}
// `tutorialFrom` remembers the opener ('menu' = in-game pause menu) so the guide
// backs out to the right place. From the main menu it renders as a full-screen
// landing PAGE (not a popup), matching New Game / Settings; elsewhere (first run,
// in-game pause) it is a tidy "tutorial" modal. Esc backs out in every context.
let tutorialFrom=null;
function openTutorial(from){
  tutorialFrom=from||null;
  const act = landing ? 'open-mainmenu' : (tutorialFrom==='menu' ? 'open-menu' : 'close-modal');
  const label = landing ? 'Back to menu' : (tutorialFrom==='menu' ? 'Back' : 'Got it');
  const foot = `<div class="foot"><button class="gbtn" data-action="${act}">${label}</button></div>`;
  if(landing){
    openLandingPage(`<div class="htp-page"><h2 class="htp-page-title">How to Play</h2>${tutorialBodyHTML()}${foot}</div>`);
  } else {
    openModal(`<div class="eyebrow">How to play</div><h2>Gilded</h2>${tutorialBodyHTML()}${foot}`, true, "tutorial");
  }
}

// Start-game menu state. `ngForce` blocks cancel (forced on first load);
// `pendingMainMenu` opens the main menu right after the tutorial is dismissed;
// `landing` is true while the full-screen main menu (and its sub-pages) is the
// active pre-game flow, so those sub-pages return here rather than a blank board.
let ngForce=false, pendingMainMenu=false, landing=false;

// Open a pre-game screen as a "page" that stays inside the main menu: the
// "Gilded" title stays pinned at the top, the section content sits below it, the
// board stays hidden, and it is not backdrop-dismissable.
function openLandingPage(inner){
  document.body.classList.add("pre-game");
  openModal(`<div class="mm-page">
    <div class="mm-hero mm-page-hero">
      <div class="eyebrow">A Gem Merchant's Game</div>
      <h1 class="mm-title">Gilded</h1>
    </div>
    <div class="mm-page-body">${inner}</div>
  </div>`, false, "mainmenu page");
}

// The full-screen landing menu: the game's front door before a game is chosen.
// Inline line-icons for menu cards (dependency-free SVG, inherits the gold via
// currentColor). `iconSvg` is the bare glyph; `mmIcon` wraps it for list rows.
function iconSvg(name){
  const paths = {
    new:      '<path d="M12 5v14M5 12h14"/>',
    load:     '<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.2H19.5A1.5 1.5 0 0 1 21 9.7V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.6l1.5 2.7 3-.6.6 3 2.7 1.5-1.5 2.6 1.5 2.6-2.7 1.5-.6 3-3-.6L12 21.4l-1.5-2.7-3 .6-.6-3L4.2 14.8l1.5-2.6-1.5-2.6 2.7-1.5.6-3 3 .6z"/>',
    resume:   '<path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none"/>',
    save:     '<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M8 3v5h7M8 21v-7h8v7"/>',
    exit:     '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    ai:       '<rect x="6" y="6" width="12" height="12" rx="2"/><circle cx="9.5" cy="10.5" r="1"/><circle cx="14.5" cy="10.5" r="1"/><path d="M9 14.5h6M9 2.5v3M15 2.5v3M9 18.5v3M15 18.5v3M2.5 9h3M2.5 15h3M18.5 9h3M18.5 15h3"/>',
    players:  '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M15.5 5.2a3 3 0 0 1 0 5.6"/><path d="M17 20a6 6 0 0 0-2.8-5.1"/>',
    watch:    '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    online:   '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9s1.3-6.4 3.8-9z"/>',
    help:     '<circle cx="12" cy="12" r="9"/><path d="M9.4 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.4 2.2-2.4 3.9"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>',
    learn:    '<path d="M12 4 22 9 12 14 2 9z"/><path d="M22 9v4.5"/><path d="M6 11.4v3.6c0 1.1 2.7 2.4 6 2.4s6-1.3 6-2.4v-3.6"/>'
  };
  const p = paths[name];
  if(!p) return '';
  return `<svg class="mi-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}
function mmIcon(name){ return `<span class="mm-ic">${iconSvg(name)}</span>`; }
function mainMenuHTML(){
  return `<div class="mm">
    <div class="mm-hero">
      <div class="eyebrow">A Gem Merchant's Game</div>
      <h1 class="mm-title">Gilded</h1>
      <p class="mm-tag">Build your Renaissance empire — outshine your rivals in prestige.</p>
    </div>
    <div class="mm-menu">
      <button class="mm-item" data-action="open-newgame">${mmIcon('new')}<span class="mm-tx"><span class="mm-i-t">New Game</span><span class="mm-i-s">Vs AI, pass-and-play, or watch</span></span></button>
      <button class="mm-item" data-action="load-game" data-from="main" ${hasSave()?'':'disabled'}>${mmIcon('load')}<span class="mm-tx"><span class="mm-i-t">Load Game</span><span class="mm-i-s">${hasSave()?'Continue a saved game':'No saved games yet'}</span></span></button>
      <button class="mm-item" data-action="start-tutorial">${mmIcon('learn')}<span class="mm-tx"><span class="mm-i-t">Play Tutorial</span><span class="mm-i-s">Learn by playing a guided round</span></span></button>
      <button class="mm-item" data-action="open-settings">${mmIcon('settings')}<span class="mm-tx"><span class="mm-i-t">Settings</span><span class="mm-i-s">${SET_TABS.map(t=>t[1]).join(', ')}</span></span></button>
      <button class="mm-item" data-action="open-tutorial">${mmIcon('help')}<span class="mm-tx"><span class="mm-i-t">How to Play</span><span class="mm-i-s">Bank, cards, patrons &amp; winning</span></span></button>
    </div>
  </div>`;
}
function openMainMenu(){ landing=true; ngForce=false; document.body.classList.add("pre-game"); if(typeof Music!=="undefined") Music.setMode("menu"); openModal(mainMenuHTML(), false, "mainmenu"); }

// Markup for the start-game menu, reflecting the current SETTINGS. Shows mode
// New Game is a two-step flow: step 1 picks the mode, step 2 sets that mode's
// options (rivals/players, difficulty, prestige target, names). `ngStep` tracks
// which screen is showing; `ngForce` hides the cancel/back-out on first load.
let ngStep=1;
function escAttr(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function humanNamesFor(n){ const saved=Array.isArray(SETTINGS.humanNames)?SETTINGS.humanNames:[]; const out=[]; for(let i=0;i<n;i++) out.push((saved[i]&&String(saved[i]).trim())||`Player ${i+1}`); return out; }
// Read any name fields currently on screen so a re-render (e.g. changing the
// player count) doesn't discard what's been typed.
function captureNames(){ const els=modalEl.querySelectorAll('.name-input'); if(!els.length) return; const names=SETTINGS.humanNames?SETTINGS.humanNames.slice():[]; els.forEach(el=>{ names[+el.dataset.idx]=el.value; }); SETTINGS.humanNames=names; saveSettings(); }

const seg=(act,val,cur,label)=>`<button class="seg ${String(val)===String(cur)?'on':''}" data-action="${act}" data-v="${val}">${label}</button>`;
function prestigeRow(){
  const win=SETTINGS.maxVP||15;
  return `<div class="set-row"><div class="set-label">Prestige to win<span class="set-hint">points that end the game</span></div><div class="seg-group">
      ${seg('ng-win',10,win,'10')}${seg('ng-win',15,win,'15')}${seg('ng-win',20,win,'20')}</div></div>`;
}

// Step 1 — choose the game mode. Picking a card commits immediately and moves to
// its options (no confirm step); the only button here is Back.
function newGameStep1HTML(){
  const modeBtn=(m,ic,label,sub,dis)=>`<button class="mode-card${dis?' disabled':''}" ${dis?'disabled aria-disabled="true"':`data-action="ng-mode" data-mode="${m}"`}><span class="mc-ic">${iconSvg(ic)}</span><span class="mc-t">${label}</span><span class="mc-s">${sub}</span></button>`;
  const back = ngForce ? '' : `<button class="gbtn ghost" data-action="${landing?'open-mainmenu':'close-modal'}">${landing?'Back':'Cancel'}</button>`;
  return `<div class="eyebrow">New game</div><h2>Choose a mode</h2>
  <div class="mode-cards">
    ${modeBtn('ai','ai','vs AI','Play computer merchants')}
    ${modeBtn('hotseat','players','vs Player','Local pass-and-play')}
    ${modeBtn('watch','watch','Watch','Spectate AI merchants')}
    ${modeBtn('online','online','Online','Coming soon',true)}
  </div>
  ${back?`<div class="foot">${back}</div>`:''}`;
}

// Step 2 — options for the chosen mode.
function newGameStep2HTML(){
  const mode = SETTINGS.mode || "ai";
  const opp = SETTINGS.opponents || 1;
  const lvl = SETTINGS.aiLevel || "normal";
  const humans = SETTINGS.humans || 2;
  const watchers = SETTINGS.watchers || 2;
  let title, sub;
  if(mode==="hotseat"){
    title="vs Player";
    const names=humanNamesFor(humans);
    sub=`<div class="set-row"><div class="set-label">Players<span class="set-hint">pass the device between turns</span></div><div class="seg-group">
        ${seg('ng-players',2,humans,'2')}${seg('ng-players',3,humans,'3')}${seg('ng-players',4,humans,'4')}</div></div>
      <div class="set-row col"><div class="set-label">Names</div><div class="name-grid">
        ${names.map((nm,i)=>`<input class="name-input" data-idx="${i}" type="text" maxlength="16" value="${escAttr(nm)}" aria-label="Player ${i+1} name" placeholder="Player ${i+1}">`).join("")}</div></div>
      ${prestigeRow()}`;
  } else if(mode==="watch"){
    title="Watch";
    sub=`<div class="set-row"><div class="set-label">Merchants<span class="set-hint">computer players to watch</span></div><div class="seg-group">
        ${seg('ng-watchers',2,watchers,'2')}${seg('ng-watchers',3,watchers,'3')}${seg('ng-watchers',4,watchers,'4')}</div></div>
      <div class="set-row"><div class="set-label">Difficulty<span class="set-hint">how sharply they play</span></div><div class="seg-group">
        ${seg('ng-ai-level','easy',lvl,'Easy')}${seg('ng-ai-level','normal',lvl,'Normal')}${seg('ng-ai-level','hard',lvl,'Hard')}</div></div>
      ${prestigeRow()}`;
  } else {
    title="vs AI";
    sub=`<div class="set-row"><div class="set-label">Rivals</div><div class="seg-group">
        ${seg('ng-ai-count',1,opp,'1')}${seg('ng-ai-count',2,opp,'2')}${seg('ng-ai-count',3,opp,'3')}</div></div>
      <div class="set-row"><div class="set-label">Difficulty<span class="set-hint">how sharply rivals play</span></div><div class="seg-group">
        ${seg('ng-ai-level','easy',lvl,'Easy')}${seg('ng-ai-level','normal',lvl,'Normal')}${seg('ng-ai-level','hard',lvl,'Hard')}</div></div>
      ${prestigeRow()}`;
  }
  return `<div class="eyebrow">New game · ${title}</div><h2>Set it up</h2>
  ${sub}
  <div class="foot"><button class="gbtn ghost" data-action="ng-back">Back</button><button class="gbtn" data-action="start-game">Start game</button></div>`;
}

function newGameHTML(){ return ngStep===2 ? newGameStep2HTML() : newGameStep1HTML(); }
// Present the new-game flow: a full page in the landing flow, a dialog in-game.
function ngRender(){ if(landing) openLandingPage(newGameHTML()); else openModal(newGameHTML(), (ngForce)?false:!!G); }
function openNewGame(force){ ngForce=!!force; ngStep=1; ngRender(); }
function ngRerender(){ ngRender(); }
function ngNext(){ ngStep=2; ngRender(); }
function ngBack(){ captureNames(); ngStep=1; ngRender(); }

// Start the game described by the current start-menu selections.
function startFromMenu(){
  captureNames();
  const mode=SETTINGS.mode||"ai";
  const win=SETTINGS.maxVP||15;
  ngForce=false; ngStep=1; landing=false; document.body.classList.remove("pre-game"); closeModal();
  if(mode==="hotseat") startGame({mode:"hotseat", humans:SETTINGS.humans||2, names:humanNamesFor(SETTINGS.humans||2), win});
  else if(mode==="watch") startGame({mode:"watch", players:SETTINGS.watchers||2, level:SETTINGS.aiLevel||"normal", win});
  else startGame({mode:"ai", opponents:SETTINGS.opponents||1, level:SETTINGS.aiLevel||"normal", win});
}

/* ---------- menu / settings / save-load ---------- */

// Persisted user preferences (theme, win target, CVD mode, last game setup).
const SETTINGS = (function(){ try{ return JSON.parse(localStorage.getItem('gilded_settings'))||{}; }catch(e){ return {}; } })();
function saveSettings(){ try{ localStorage.setItem('gilded_settings', JSON.stringify(SETTINGS)); }catch(e){} }
// Migration: the old Sound/Music on-off toggles are gone — audio is now three
// sliders (Master / Effects / Music). A previously muted toggle becomes a 0 slider.
(function migrateAudioSettings(){
  let changed=false;
  if(SETTINGS.sound===false){ SETTINGS.volume=0; changed=true; }
  if(SETTINGS.music===false){ SETTINGS.musicVol=0; changed=true; }
  if('sound' in SETTINGS){ delete SETTINGS.sound; changed=true; }
  if('music' in SETTINGS){ delete SETTINGS.music; changed=true; }
  if(changed) saveSettings();
})();

// Apply settings to the DOM: theme class, colour-vision palette, win target,
// and the header theme-toggle label/state.
function applySettings(){
  document.body.classList.toggle('light', SETTINGS.theme==='light');
  const cvd=SETTINGS.cvd||'off';
  document.body.classList.toggle('cvd-prot', cvd==='prot');
  document.body.classList.toggle('cvd-deut', cvd==='deut');
  document.body.classList.toggle('cvd-trit', cvd==='trit');
  WIN = SETTINGS.maxVP || 15;
  const toasts=document.getElementById('toasts');
  if(toasts) toasts.className='toasts pos-'+(SETTINGS.toastPos||'br');
  // Both theme buttons (in-game header + main-menu float) share the same icon-only
  // round design, so give them the same glyph and pressed state.
  const light=SETTINGS.theme==='light';
  const themeGlyph = light ? '<span aria-hidden="true">\u2600</span>' : '<span aria-hidden="true">\u263E</span>';
  ['themeToggle','themeFloat'].forEach(id=>{ const b=document.getElementById(id);
    if(b){ b.innerHTML=themeGlyph; b.setAttribute('aria-pressed', light?'true':'false'); } });
  if(typeof Sfx!=="undefined") Sfx.setVolume();
  if(typeof Music!=="undefined") Music.setVolume();
}

// Saved-session bookkeeping. `currentSessionId` is the slot the live game
// overwrites; `sessionsFrom` remembers which screen opened the sessions modal.
let currentSessionId=null, sessionsFrom='header';

// Compact summary of a game for the sessions list (mode, progress, per-player
// scores, and the current leader).
function sessionMeta(g){
  const scores=g.players.map(p=>({ name:p.name, vp:p.points||0, cards:(p.cards||[]).length, isAI:!!p.isAI }));
  const top=Math.max(0,...scores.map(s=>s.vp));
  let leader=g.players[0], lv=g.players[0].points;
  g.players.forEach(p=>{ if(p.points>lv){ lv=p.points; leader=p; } });
  return { mode:g.mode||'ai', level:g.level||null, players:g.players.length,
           turn:g.turn||0, over:!!g.over, scores, top, leader:leader.name, leaderVP:lv };
}

// Human-friendly session title (mode + difficulty/player count).
function sessionName(g){
  const m=sessionMeta(g);
  return m.mode==='hotseat' ? `Pass-and-play · ${m.players}P`
       : m.mode==='watch' ? `Watch · ${m.players} AI · ${LEVEL_LABEL[m.level]||'Normal'}`
       : `Vs AI · ${LEVEL_LABEL[m.level]||'Normal'}`;
}

// Read/write the saved-sessions array in localStorage.
function saveSessions(list){ try{ localStorage.setItem('gilded_sessions', JSON.stringify(list)); }catch(e){} }
const MAX_SESSIONS=3;

// Load saved sessions, one-time migrating any legacy single `gilded_save`. Also
// defensively drops any invalid saves that shouldn't exist — tutorial runs or
// solo games (a real game always has 2+ players) — and rewrites the cleaned list,
// so a stray tutorial save (e.g. from before tutorial saving was blocked) can
// never be listed or loaded.
function loadSessions(){
  let list=[];
  try{ list=JSON.parse(localStorage.getItem('gilded_sessions'))||[]; }catch(e){ list=[]; }
  if(!Array.isArray(list)) list=[];
  try{
    const legacy=localStorage.getItem('gilded_save');
    if(legacy){
      const s=JSON.parse(legacy);
      if(s&&s.G) list.unshift({ id:'legacy'+Date.now(), name:sessionName(s.G), savedAt:Date.now(), meta:sessionMeta(s.G), data:{G:s.G, WIN:s.WIN||15} });
      localStorage.removeItem('gilded_save');
      saveSessions(list);
    }
  }catch(e){}
  const isValid=(s)=>{ const g=s&&s.data&&s.data.G; return !!g && !g.tutorial && Array.isArray(g.players) && g.players.length>=2; };
  const cleaned=list.filter(isValid);
  if(cleaned.length!==list.length){ try{ saveSessions(cleaned); }catch(e){} }
  return cleaned;
}
function hasSave(){ return loadSessions().length>0; }

// Persist the live game: update its existing slot, or add a new one and evict
// the oldest when over the cap. Finished games are never stored — any existing
// slot is dropped instead. Returns true if a session was evicted.
function persistSession(){
  // Tutorial games are a disposable practice run — never write them to a save
  // slot, no matter which path asks (autosave, manual save, or leaving to menu).
  if(G && G.tutorial) return false;
  if(G && G.over){ if(currentSessionId) deleteSession(currentSessionId); return false; }
  let list=loadSessions();
  const entry={ id: currentSessionId || ('s'+Date.now()), name: sessionName(G), savedAt: Date.now(), meta: sessionMeta(G), data:{ G:G, WIN:WIN } };
  const idx=list.findIndex(s=>s.id===entry.id);
  let evicted=false;
  if(idx>=0){ list[idx]=entry; }
  else {
    list.unshift(entry);
    if(list.length>MAX_SESSIONS){
      list.sort((a,b)=>(b.savedAt||0)-(a.savedAt||0));
      list=list.slice(0,MAX_SESSIONS);
      evicted=true;
    }
  }
  currentSessionId=entry.id;
  saveSessions(list); syncHeaderActions();
  return evicted;
}

// Manual save: persist silently and confirm with a corner toast, without
// opening (or leaving open) the menu. Dismisses any open modal so a save from
// the in-menu item closes it too.
function saveGame(){
  closeModal();
  if(G && G.tutorial){ flash("The tutorial can't be saved — it's just for practice."); return; }
  if(G && G.over){ flash("This game is finished — nothing to save."); return; }
  try{ const evicted=persistSession(); flash(evicted ? "Game saved — the oldest session was replaced." : "Game saved on this device."); }
  catch(e){ flash("Couldn't save (storage unavailable here)."); }
}

// Silent autosave after each round and at game end (same slot).
function autoSave(){ if(!G) return; try{ persistSession(); }catch(e){} }

// Load a saved session into the live game and resume it.
function loadSession(id){
  const s=loadSessions().find(x=>x.id===id); if(!s||!s.data||!s.data.G) return;
  const g=s.data.G;
  if(g.tutorial || !Array.isArray(g.players) || g.players.length<2){ flash("That save can't be loaded."); return; }
  G=s.data.G; if(s.data.WIN) WIN=s.data.WIN;
  currentSessionId=id; ngForce=false; pendingMainMenu=false; landing=false;
  document.body.classList.remove("pre-game");
  paused=false;
  UI={sel:{}, selectedCard:null, phase:"play", discardResolve:null, oppView:G.current||0};
  closeModal(); render(); syncHeaderActions();
  if(typeof Music!=="undefined") Music.setMode("game");
  if(!G.over && me().isAI) scheduleAI();
}

// Delete a saved session (clearing the active slot if it was the current one).
function deleteSession(id){
  saveSessions(loadSessions().filter(s=>s.id!==id));
  if(currentSessionId===id) currentSessionId=null;
  delConfirmId=null;
  syncHeaderActions();
}
// Inline delete confirmation: which session row is awaiting a Yes/No.
let delConfirmId=null;
function askDeleteSession(id){ delConfirmId=id; sessRerender(); }

// Markup for the saved-sessions list. Renders a per-player scoreboard that
// highlights the leader/winner and describes no-leader and tie states; falls
// back to a compact summary for legacy sessions saved without per-player scores.
function sessionsHTML(from){
  const list=loadSessions();
  const rows = list.length ? list.map(s=>{
    const m=s.meta||{};
    const when=new Date(s.savedAt||Date.now()).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
    const stage = m.over ? 'Finished' : `Turn ${m.turn||0}`;
    let board;
    if(Array.isArray(m.scores) && m.scores.length){
      const top = m.top!=null ? m.top : Math.max(0,...m.scores.map(x=>x.vp));
      let highlight=()=>false, status='';
      if(m.over){
        // Winner: most prestige, ties broken by fewer cards.
        const winner=m.scores.slice().sort((a,b)=> (b.vp-a.vp) || ((a.cards||0)-(b.cards||0)))[0];
        highlight = sc=>sc===winner;
      } else {
        const leaders = m.scores.filter(x=>x.vp===top);
        const noLeader = top===0 || leaders.length===m.scores.length;
        const tiedLead = !noLeader && leaders.length>1;
        status = noLeader ? (top===0 ? 'No points yet' : 'All square')
               : tiedLead ? 'Tied for the lead' : '';
        highlight = sc=>!noLeader && sc.vp===top;
      }
      board = `<div class="sess-scores">` + m.scores.map(sc=>{
        const lead = highlight(sc);
        return `<span class="sc${lead?' lead':''}">${lead?'<span class="sc-mark" aria-hidden="true">&#9670;</span>':''}${sc.name}<b>${sc.vp}</b></span>`;
      }).join("") + (status?`<span class="sess-lead">${status}</span>`:'') + `</div>`;
    } else {
      // Legacy sessions saved before per-player scores existed.
      const nm=m.leader||'—', verb=nm==='You'?'lead':'leads';
      let inner;
      if(m.over) inner = `<span class="sc lead">${nm==='—'?'Finished':nm+' won'}</span>`;
      else if(!m.leaderVP) inner = `<span class="sess-lead">No points yet</span>`;
      else inner = `<span class="sc lead">${nm} ${verb} · ${m.leaderVP} prestige</span>`;
      board = `<div class="sess-scores">${inner}</div>`;
    }
    const acts = (delConfirmId===s.id)
      ? `<div class="sess-acts confirm"><span class="sess-confirm-q">Delete this save?</span>
        <button class="gbtn danger" data-action="del-confirm" data-id="${s.id}">Delete</button>
        <button class="gbtn ghost" data-action="del-cancel">Cancel</button></div>`
      : `<div class="sess-acts">
        <button class="gbtn" data-action="load-session" data-id="${s.id}">Load</button>
        <button class="gbtn ghost sess-del" data-action="del-session" data-id="${s.id}">Delete</button></div>`;
    return `<div class="sess">
      <div class="sess-info"><div class="sess-name">${s.name}</div>${board}<div class="sess-sub">${stage} · ${when}</div></div>
      ${acts}</div>`;
  }).join("") : `<p class="sess-empty">No saved sessions yet. Use “Save game” during play to store one.</p>`;
  let footBtn;
  if(from==='menu') footBtn=`<button class="gbtn ghost" data-action="open-menu">Back</button>`;
  else if(from==='main') footBtn=`<button class="gbtn ghost" data-action="open-mainmenu">Back</button>`;
  else footBtn=`<button class="gbtn ghost" data-action="close-modal">Close</button>`;
  return `<div class="eyebrow">Saved sessions</div><h2>Load a game</h2>
    <p class="sess-cap">Up to ${MAX_SESSIONS} games are kept — saving a new one replaces the oldest.</p>
    <div class="sess-list">${rows}</div>
    <div class="foot">${footBtn}</div>`;
}
// Render the sessions list — a full page in the landing flow, a dialog in-game.
function sessRerender(){ if(landing) openLandingPage(sessionsHTML(sessionsFrom)); else openModal(sessionsHTML(sessionsFrom), true); }
function openSessions(from){ sessionsFrom=from||'header'; delConfirmId=null; sessRerender(); }

// The in-game menu (a.k.a. pause screen). Uses the same card styling as the
// landing main menu for a uniform look: every action is an identical card with a
// title and a one-line hint. "Resume" replaces a separate Close button, and
// "Return to main menu" is styled like the rest (with a subtle caution accent).
function menuHTML(note){
  const items = [
    ['close-modal','Resume','Back to the table','resume',''],
    ['save-game','Save game','Store this game to a slot','save',''],
    ['tutorial-from-menu','How to Play','Bank, cards, patrons &amp; winning','help',''],
    ['settings-from-menu','Settings','Audio, visuals &amp; controls','settings',''],
  ];
  if(G && !landing) items.push(['return-mainmenu','Return to main menu','Autosaves, then leaves the game','exit','mm-item-leave']);
  const list = items.map(([act,t,s,ic,cls])=>
    `<button class="mm-item ${cls}" data-action="${act}">${mmIcon(ic)}<span class="mm-tx"><span class="mm-i-t">${t}</span><span class="mm-i-s">${s}</span></span></button>`).join("");
  return `<h2>Menu</h2>
  ${note?`<p class="menu-note">${note}</p>`:""}
  <div class="mm-menu game-menu">${list}</div>`;
}
// Opening the in-game menu pauses the game (freezes the AI and dims the board);
// closing any modal resumes it. There is no separate pause button — the menu is
// the pause.
function openMenu(note){
  // No pause menu during the tutorial — exit is via the coaching card's Skip.
  if(G && G.tutorial) return;
  openModal(menuHTML(note), true, "gamemenu"); paused=true; syncPauseUI();
}

// Leave the current game for the main menu. In-progress games are autosaved to
// their slot first, so they can be resumed later via Load Game. A tutorial run is
// disposable: end it cleanly (dismiss the coaching overlay, clear the flag) and
// don't save.
function returnToMainMenu(){
  if(G && G.tutorial){ if(typeof Tutor!=="undefined") Tutor.end(false); }
  else autoSave();
  openMainMenu();
}

// Settings — organised into tabs (Visual / Audio / Alerts / Controls).
// `settingsTab` is preserved across re-renders so changing a control keeps you on
// the same tab. How to Play is its own menu entry now, not a settings tab.
let settingsTab='visual';
const SET_TABS=[['visual','Visual'],['audio','Audio'],['alerts','Alerts'],['controls','Controls']];
function settingsHTML(fromMenu){
  const cvd=SETTINGS.cvd||'off';
  const tpos=SETTINGS.toastPos||'br', tms=SETTINGS.toastMs||3000;
  const svol=SETTINGS.volume!=null?String(+SETTINGS.volume):'0.6';
  const mvol=SETTINGS.musicVol!=null?String(+SETTINGS.musicVol):'0.5';
  const mastvol=SETTINGS.masterVol!=null?String(+SETTINGS.masterVol):'1';
  const keysOn=SETTINGS.keys!==false;
  const seg=(name,val,cur,label)=>`<button class="seg ${String(val)===String(cur)?'on':''}" data-action="set-${name}" data-v="${val}">${label}</button>`;
  const row=(label,hint,segs)=>`<div class="set-row"><div class="set-label">${label}${hint?`<span class="set-hint">${hint}</span>`:''}</div><div class="seg-group">${segs}</div></div>`;
  const volRow=(label,hint,action,frac)=>{ const pct=Math.round(Math.max(0,Math.min(1,frac))*100);
    return `<div class="set-row"><div class="set-label">${label}${hint?`<span class="set-hint">${hint}</span>`:''}</div>`
      +`<div class="slider-group"><input type="range" class="vol-slider" min="0" max="100" step="5" value="${pct}" data-action="set-${action}" aria-label="${label}" aria-valuetext="${pct}%"><output class="vol-val">${pct}%</output></div></div>`; };
  const panels={
    visual:`${row('Colour-vision mode','recolours gems for clarity',
        seg('cvd','off',cvd,'Off')+seg('cvd','prot',cvd,'Protanopia')+seg('cvd','deut',cvd,'Deuteranopia')+seg('cvd','trit',cvd,'Tritanopia'))}`,
    alerts:`${row('Alert position','where warnings pop up',
        seg('toastpos','tl',tpos,'Top left')+seg('toastpos','tr',tpos,'Top right')+seg('toastpos','bl',tpos,'Bottom left')+seg('toastpos','br',tpos,'Bottom right'))}
      ${row('Alert timeout','how long alerts stay',
        seg('toastms','2000',tms,'2s')+seg('toastms','3000',tms,'3s')+seg('toastms','5000',tms,'5s'))}`,
    audio:`${volRow('Master volume','overall loudness for the whole game','master',+mastvol)}
      ${volRow('Sound effects','cues for takes, buys &amp; wins','vol',+svol)}
      ${volRow('Music','background soundtrack (menu &amp; in-game)','musicvol',+mvol)}`,
    controls:`${row('Keyboard shortcuts','navigate menus and pause from the keyboard',
        seg('keys','on',keysOn?'on':'off','On')+seg('keys','off',keysOn?'on':'off','Off'))}
      <div class="key-list">
        <div class="key-row"><span class="key-keys"><kbd>Esc</kbd></span><span class="key-desc">In a game: pause and open the menu. In a menu: go back or close it.</span></div>
        <div class="key-row"><span class="key-keys"><kbd>&uarr;</kbd><kbd>&darr;</kbd><kbd>&larr;</kbd><kbd>&rarr;</kbd></span><span class="key-desc">Move between the options in the open menu.</span></div>
        <div class="key-row"><span class="key-keys"><kbd>Enter</kbd><kbd>Space</kbd></span><span class="key-desc">Select the highlighted option.</span></div>
      </div>`,
  };
  const tab = panels[settingsTab] ? settingsTab : 'visual';
  const tabs = SET_TABS.map(([id,label])=>`<button class="set-tab ${id===tab?'on':''}" data-action="set-tab" data-v="${id}" role="tab" aria-selected="${id===tab}">${label}</button>`).join("");
  let foot;
  if(landing) foot=`<button class="gbtn" data-action="open-mainmenu">Back to menu</button>`;
  else { const back=fromMenu?`<button class="gbtn ghost" data-action="open-menu">Back</button>`:'';
    foot=`${back}<button class="gbtn" data-action="close-modal">${fromMenu?'Done':'Close'}</button>`; }
  return `<h2>Settings</h2>
  <div class="set-tabs" role="tablist">${tabs}</div>
  <div class="set-panel" role="tabpanel">${panels[tab]}</div>
  <p class="set-foot-note">Settings are saved on this device.</p>
  <div class="foot">${foot}</div>`;
}
let settingsFromMenu=false;
function openSettings(fromMenu){ if(fromMenu!==undefined) settingsFromMenu=fromMenu; if(landing) openLandingPage(settingsHTML(settingsFromMenu)); else openModal(settingsHTML(settingsFromMenu), true, "settings"); }

// Toggle light/dark theme and persist it.
function toggleTheme(){
  SETTINGS.theme = SETTINGS.theme==='light' ? 'dark' : 'light';
  saveSettings(); applySettings();
}

// The header now carries a single Menu button (plus the theme toggle); it is
// always visible, so there is no inline row to collapse.
function layoutHeader(){}

// Refresh header state. The Menu button hosts every game action now, so this
// just reflects pause state on it.
function syncHeaderActions(){
  syncPauseUI();
}

// Reflect pause state: mark the Menu button and dim the board so a paused game
// reads clearly. Pausing lives inside the menu; opening the menu auto-pauses.
function syncPauseUI(){
  const active = !!G && !G.over;
  const on = !!paused && active;
  const tut = !!(G && G.tutorial);
  const btn=document.getElementById('menuBtn');
  if(btn){ btn.classList.toggle('on', on);
    // Icon-only round button (matches the theme toggle): hamburger normally, a
    // pause glyph when the game is paused; the word lives in the label/title.
    btn.innerHTML = on ? '<span aria-hidden="true">&#10073;&#10073;</span>' : '<span aria-hidden="true">&#9776;</span>';
    btn.setAttribute('aria-label', on ? 'Paused — open menu' : 'Menu');
    btn.setAttribute('title', on ? 'Paused' : 'Menu');
    btn.setAttribute('aria-pressed', on?'true':'false');
    // The tutorial has no pause menu — leaving is via the coaching card's
    // "Skip tutorial". Hide the header Menu button while it runs.
    btn.hidden = tut; }
  document.body.classList.toggle('paused', on);
}

// Settings segment handlers: change win target / colour-vision mode live.
function setTab(v){ settingsTab=v; openSettings(); }
function setCVD(v){ SETTINGS.cvd=v; saveSettings(); applySettings(); openSettings(); }
function setMaster(v, el){ SETTINGS.masterVol=Math.max(0,Math.min(1,(+v)/100)); saveSettings(); Sfx.unlock(); Sfx.setVolume(); Music.start(); Music.setVolume(); updateVolLabel(el); }
function setVol(v, el){ SETTINGS.volume=Math.max(0,Math.min(1,(+v)/100)); saveSettings(); Sfx.unlock(); Sfx.setVolume(); updateVolLabel(el); }
function setMusicVol(v, el){ SETTINGS.musicVol=Math.max(0,Math.min(1,(+v)/100)); saveSettings(); Music.start(); Music.setVolume(); updateVolLabel(el); }
// Live-update a volume slider's "%" read-out without re-rendering the modal
// (re-rendering mid-drag would drop the pointer and interrupt dragging).
function updateVolLabel(el){ if(!el) return; const pct=Math.round(+el.value); const out=el.parentNode&&el.parentNode.querySelector('.vol-val'); if(out) out.textContent=pct+'%'; el.setAttribute('aria-valuetext', pct+'%'); }
function setKeys(v){ SETTINGS.keys=(v==='on'); saveSettings(); openSettings(); }

// Alert (toast) preferences: corner position and on-screen lifetime. Each change
// re-renders the modal and fires a sample toast so the effect is visible at once.
function setToastPos(v){ SETTINGS.toastPos=v; saveSettings(); applySettings(); openSettings(); flash("Alerts will appear here."); }
function setToastMs(v){ SETTINGS.toastMs=+v; saveSettings(); openSettings(); flash(`Alerts stay for ${(+v)/1000}s.`); }

// Prompt a human to choose between two eligible patrons; `cb` receives the pick.
function chooseNoble(list,cb){
  UI._nobleCb=cb;
  const opts=list.map((n,i)=>{
    const chips=Object.entries(n.req).map(([ci,req])=>`${req}${ig(KEYS[ci])}`).join(" ");
    return `<div class="choice" data-action="pick-noble" data-i="${i}"><div class="c">${chips}</div></div>`;
  }).join("");
  UI._nobleList=list;
  openModal(`<div class="eyebrow">Two patrons want to visit</div><h2>Choose one</h2><div class="choices">${opts}</div>`,false);
}

// Show the end-of-game winner modal with the final standings (and confetti on a win).
function showWinner(p){
  const board=G.players.slice().sort((a,b)=> b.points-a.points || a.cards.length-b.cards.length)
    .map(x=>`<p style="text-align:center;margin:2px">${x===p?"👑 ":""}<b>${x.name}</b> — ${x.points} prestige, ${x.cards.length} cards</p>`).join("");
  openModal(`<div class="eyebrow">The books are closed</div>
    <div class="win-name">${p.name==="You"?"You win!":p.name+" wins"}</div>
    ${board}
    <div class="foot"><button class="gbtn" data-action="open-newgame">Play again</button></div>`,false);
  if(p.name==="You") celebrate();
}
