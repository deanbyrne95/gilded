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
function tutorialHTML(){
  return `<div class="eyebrow">How to play</div>
  <h2>Gilded</h2>
  <p>You're a Renaissance gem merchant building an empire. Buy development cards, earn prestige, and be the first to <b>${WIN} points</b>.</p>

  <h3>Your turn — do exactly one thing</h3>
  <ul>
    <li><b>Take 3 gems</b> of different colours (one each).</li>
    <li><b>Take 2 gems</b> of the same colour — only if that pile has 4 or more.</li>
    <li><b>Reserve a card</b> to save it for later and grab a ${ig("gold")} <b>gold</b> (wild) token. You may hold up to 3.</li>
    <li><b>Buy a card</b> from the table or from your reserve.</li>
  </ul>
  <p>Gold ${ig("gold")} counts as any colour when buying. You can never end a turn holding more than 10 tokens.</p>

  <h3>Cards are permanent discounts</h3>
  <p>Every card you buy gives a coloured bonus. A ${ig("green")} card means every future purchase costs one less ${ig("green")}. Stack these and expensive cards become cheap. The big number in the corner is prestige.</p>

  <h3>Patrons</h3>
  <p>The tiles up top are patrons, worth <b>3</b> prestige each. When your <i>card bonuses</i> meet a patron's requirement (tokens don't count), they visit you automatically — no action needed.</p>

  <h3>Winning</h3>
  <p>The moment anyone reaches <b>${WIN}</b>, the round is played out so everyone has had the same number of turns. Highest prestige wins; ties go to whoever owns fewer cards.</p>

  <div class="foot"><button class="gbtn" data-action="${landing?'open-mainmenu':'close-modal'}">${landing?'Back to menu':'Got it'}</button></div>`;
}
function openTutorial(){ openModal(tutorialHTML(), !landing); }

// Start-game menu state. `ngForce` blocks cancel (forced on first load);
// `pendingMainMenu` opens the main menu right after the tutorial is dismissed;
// `landing` is true while the full-screen main menu (and its sub-modals) is the
// active pre-game flow, so those sub-modals return here rather than a blank board.
let ngForce=false, pendingMainMenu=false, landing=false;

// The full-screen landing menu: the game's front door before a game is chosen.
function mainMenuHTML(){
  return `<div class="mm">
    <div class="mm-hero">
      <div class="eyebrow">A Gem Merchant's Game</div>
      <h1 class="mm-title">Gilded</h1>
      <p class="mm-tag">Build your Renaissance empire — first to <b>${WIN}</b> prestige wins.</p>
    </div>
    <div class="mm-menu">
      <button class="mm-item" data-action="open-newgame"><span class="mm-i-t">New Game</span><span class="mm-i-s">Vs AI, pass-and-play, or watch</span></button>
      <button class="mm-item" data-action="load-game" data-from="main" ${hasSave()?'':'disabled'}><span class="mm-i-t">Load Game</span><span class="mm-i-s">${hasSave()?'Continue a saved game':'No saved games yet'}</span></button>
      <button class="mm-item" data-action="open-tutorial"><span class="mm-i-t">How to Play</span><span class="mm-i-s">Learn the rules</span></button>
      <button class="mm-item" data-action="open-settings"><span class="mm-i-t">Settings</span><span class="mm-i-s">${SET_TABS.map(t=>t[1]).join(', ')}</span></button>
    </div>
  </div>`;
}
function openMainMenu(){ landing=true; ngForce=false; document.body.classList.add("pre-game"); if(typeof Music!=="undefined") Music.setMode("menu"); openModal(mainMenuHTML(), false, "mainmenu"); }

// Markup for the start-game menu, reflecting the current SETTINGS. Shows mode
// cards (Vs AI / Vs Player / Online), the relevant sub-options, and — for AI —
// a Load button. `force` hides the Cancel button.
function newGameHTML(force){
  const mode = SETTINGS.mode || "ai";
  const opp = SETTINGS.opponents || 1;
  const lvl = SETTINGS.aiLevel || "normal";
  const humans = SETTINGS.humans || 2;
  const watchers = SETTINGS.watchers || 2;
  const modeBtn=(m,label,sub,dis)=>`<button class="mode-card${mode===m&&!dis?' sel':''}${dis?' disabled':''}" ${dis?'disabled aria-disabled="true"':`data-action="ng-mode" data-mode="${m}"`}><span class="mc-t">${label}</span><span class="mc-s">${sub}</span></button>`;
  const seg=(act,val,cur,label)=>`<button class="seg ${String(val)===String(cur)?'on':''}" data-action="${act}" data-v="${val}">${label}</button>`;
  let sub;
  if(mode==="hotseat"){
    sub=`<div class="set-row"><div class="set-label">Players<span class="set-hint">pass the device between turns</span></div><div class="seg-group">
        ${seg('ng-players',2,humans,'2')}${seg('ng-players',3,humans,'3')}${seg('ng-players',4,humans,'4')}</div></div>`;
  } else if(mode==="watch"){
    sub=`<div class="set-row"><div class="set-label">Merchants<span class="set-hint">computer players to watch</span></div><div class="seg-group">
        ${seg('ng-watchers',2,watchers,'2')}${seg('ng-watchers',3,watchers,'3')}${seg('ng-watchers',4,watchers,'4')}</div></div>
      <div class="set-row"><div class="set-label">Difficulty<span class="set-hint">how sharply they play</span></div><div class="seg-group">
        ${seg('ng-ai-level','easy',lvl,'Easy')}${seg('ng-ai-level','normal',lvl,'Normal')}${seg('ng-ai-level','hard',lvl,'Hard')}</div></div>`;
  } else {
    sub=`<div class="set-row"><div class="set-label">Rivals</div><div class="seg-group">
        ${seg('ng-ai-count',1,opp,'1')}${seg('ng-ai-count',2,opp,'2')}${seg('ng-ai-count',3,opp,'3')}</div></div>
      <div class="set-row"><div class="set-label">Difficulty<span class="set-hint">how sharply rivals play</span></div><div class="seg-group">
        ${seg('ng-ai-level','easy',lvl,'Easy')}${seg('ng-ai-level','normal',lvl,'Normal')}${seg('ng-ai-level','hard',lvl,'Hard')}</div></div>
      <div class="ng-load"><button class="gbtn ghost" data-action="load-game" data-from="newgame" ${hasSave()?'':'disabled'}>${hasSave()?'Load a saved game…':'No saved games yet'}</button></div>`;
  }
  const cancel = force ? '' : (landing
    ? `<button class="gbtn ghost" data-action="open-mainmenu">Back</button>`
    : `<button class="gbtn ghost" data-action="close-modal">Cancel</button>`);
  return `<div class="eyebrow">New game</div><h2>Choose your game</h2>
  <div class="mode-cards">
    ${modeBtn('ai','Vs AI','Play computer merchants')}
    ${modeBtn('hotseat','Vs Player','Local pass-and-play')}
    ${modeBtn('watch','Watch','Spectate AI vs AI')}
    ${modeBtn('online','Online','Coming soon',true)}
  </div>
  ${sub}
  <div class="foot">${cancel}<button class="gbtn" data-action="start-game">Start game</button></div>`;
}
function openNewGame(force){ ngForce=!!force; openModal(newGameHTML(!!force), (force||landing)?false:!!G); }
function ngRerender(){ openModal(newGameHTML(ngForce), (ngForce||landing)?false:!!G); }

// Start the game described by the current start-menu selections.
function startFromMenu(){
  const mode=SETTINGS.mode||"ai";
  ngForce=false; landing=false; document.body.classList.remove("pre-game"); closeModal();
  if(mode==="hotseat") startGame({mode:"hotseat", humans:SETTINGS.humans||2});
  else if(mode==="watch") startGame({mode:"watch", players:SETTINGS.watchers||2, level:SETTINGS.aiLevel||"normal"});
  else startGame({mode:"ai", opponents:SETTINGS.opponents||1, level:SETTINGS.aiLevel||"normal"});
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
  const tt=document.getElementById('themeToggle');
  if(tt){ const light=SETTINGS.theme==='light';
    tt.innerHTML = light ? '<span aria-hidden="true">\u2600</span> Light' : '<span aria-hidden="true">\u263E</span> Dark';
    tt.setAttribute('aria-pressed', light?'true':'false');
  }
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

// Load saved sessions, one-time migrating any legacy single `gilded_save`.
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
  return list;
}
function hasSave(){ return loadSessions().length>0; }

// Persist the live game: update its existing slot, or add a new one and evict
// the oldest when over the cap. Finished games are never stored — any existing
// slot is dropped instead. Returns true if a session was evicted.
function persistSession(){
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
  if(G && G.over){ flash("This game is finished — nothing to save."); return; }
  try{ const evicted=persistSession(); flash(evicted ? "Game saved — the oldest session was replaced." : "Game saved on this device."); }
  catch(e){ flash("Couldn't save (storage unavailable here)."); }
}

// Silent autosave after each round and at game end (same slot).
function autoSave(){ if(!G) return; try{ persistSession(); }catch(e){} }

// Load a saved session into the live game and resume it.
function loadSession(id){
  const s=loadSessions().find(x=>x.id===id); if(!s||!s.data||!s.data.G) return;
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
  syncHeaderActions();
}

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
      else inner = `<span class="sc lead">${nm} ${verb} · ${m.leaderVP} VP</span>`;
      board = `<div class="sess-scores">${inner}</div>`;
    }
    return `<div class="sess">
      <div class="sess-info"><div class="sess-name">${s.name}</div>${board}<div class="sess-sub">${stage} · ${when}</div></div>
      <div class="sess-acts">
        <button class="gbtn" data-action="load-session" data-id="${s.id}">Load</button>
        <button class="gbtn ghost sess-del" data-action="del-session" data-id="${s.id}">Delete</button>
      </div></div>`;
  }).join("") : `<p class="sess-empty">No saved sessions yet. Use “Save game” during play to store one.</p>`;
  let footBtn;
  if(from==='newgame') footBtn=`<button class="gbtn ghost" data-action="back-newgame">Back</button>`;
  else if(from==='menu') footBtn=`<button class="gbtn ghost" data-action="open-menu">Back</button>`;
  else if(from==='main') footBtn=`<button class="gbtn ghost" data-action="open-mainmenu">Back</button>`;
  else footBtn=`<button class="gbtn ghost" data-action="close-modal">Close</button>`;
  return `<div class="eyebrow">Saved sessions</div><h2>Load a game</h2>
    <p class="sess-cap">Up to ${MAX_SESSIONS} games are kept — saving a new one replaces the oldest.</p>
    <div class="sess-list">${rows}</div>
    <div class="foot">${footBtn}</div>`;
}
function openSessions(from){ sessionsFrom=from||'header'; const forced=(from==='newgame'&&ngForce)||from==='main'||landing; openModal(sessionsHTML(sessionsFrom), !forced); }

// Markup for the compact menu (small screens / overflow), with an optional note.
function menuHTML(note){
  return `<div class="eyebrow">Menu</div><h2>Gilded</h2>
  ${note?`<p style="color:var(--gilt-soft)">${note}</p>`:""}
  <div class="menu-list">
    <button class="menu-item" data-action="open-newgame">New game</button>
    <button class="menu-item" data-action="save-game">Save game</button>
    <button class="menu-item" data-action="load-game" data-from="menu" ${hasSave()?"":"disabled"}>Load game${hasSave()?"":" — none saved"}</button>
    <button class="menu-item" data-action="settings-from-menu">Settings</button>
    <button class="menu-item" data-action="open-tutorial">How to play</button>
    ${(G && !landing)?`<button class="menu-item leave" data-action="return-mainmenu">Return to main menu</button>`:""}
  </div>
  <div class="foot"><button class="gbtn ghost" data-action="close-modal">Close</button></div>`;
}
// Opening the in-game menu pauses the game (freezes the AI and dims the board);
// closing any modal resumes it. There is no separate pause button — the menu is
// the pause.
function openMenu(note){ openModal(menuHTML(note), true); paused=true; syncPauseUI(); }

// Leave the current game for the main menu. In-progress games are autosaved to
// their slot first, so they can be resumed later via Load Game.
function returnToMainMenu(){ autoSave(); openMainMenu(); }

// Markup for the settings modal (win target and colour-vision mode).
// Settings modal — organised into tabs (Gameplay / Visual / Alerts / Audio).
// `settingsTab` is preserved across re-renders so changing a control keeps you
// on the same tab.
let settingsTab='gameplay';
const SET_TABS=[['gameplay','Gameplay'],['visual','Visual'],['alerts','Alerts'],['audio','Audio'],['controls','Controls']];
function settingsHTML(fromMenu){
  const maxVP=SETTINGS.maxVP||15, cvd=SETTINGS.cvd||'off';
  const tpos=SETTINGS.toastPos||'br', tms=SETTINGS.toastMs||3000, theme=SETTINGS.theme||'dark';
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
    gameplay:`${row('Prestige to win','first to this many points wins',
        seg('max','10',maxVP,'10')+seg('max','15',maxVP,'15')+seg('max','20',maxVP,'20'))}
      <p class="set-note">Applies to the current game and to new games.</p>`,
    visual:`${row('Theme','light or dark table',
        seg('theme','dark',theme,'Dark')+seg('theme','light',theme,'Light'))}
      ${row('Colour-vision mode','recolours gems for clarity',
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
  const tab = panels[settingsTab] ? settingsTab : 'gameplay';
  const tabs = SET_TABS.map(([id,label])=>`<button class="set-tab ${id===tab?'on':''}" data-action="set-tab" data-v="${id}" role="tab" aria-selected="${id===tab}">${label}</button>`).join("");
  let foot;
  if(landing) foot=`<button class="gbtn" data-action="open-mainmenu">Back to menu</button>`;
  else { const back=fromMenu?`<button class="gbtn ghost" data-action="open-menu">Back</button>`:'';
    foot=`${back}<button class="gbtn" data-action="close-modal">${fromMenu?'Done':'Close'}</button>`; }
  return `<div class="eyebrow">Settings</div><h2>Settings</h2>
  <div class="set-tabs" role="tablist">${tabs}</div>
  <div class="set-panel" role="tabpanel">${panels[tab]}</div>
  <p class="set-foot-note">Settings are saved on this device.</p>
  <div class="foot">${foot}</div>`;
}
let settingsFromMenu=false;
function openSettings(fromMenu){ if(fromMenu!==undefined) settingsFromMenu=fromMenu; openModal(settingsHTML(settingsFromMenu), !landing); }

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
  const btn=document.getElementById('menuBtn');
  if(btn){ btn.classList.toggle('on', on);
    btn.innerHTML = on ? '&#9776; Paused' : '&#9776; Menu';
    btn.setAttribute('aria-pressed', on?'true':'false'); }
  document.body.classList.toggle('paused', on);
}

// Settings segment handlers: change win target / colour-vision mode live.
function setTab(v){ settingsTab=v; openSettings(); }
function setMax(v){ SETTINGS.maxVP=+v; saveSettings(); applySettings(); if(G) renderBanner(); openSettings(); }
function setCVD(v){ SETTINGS.cvd=v; saveSettings(); applySettings(); openSettings(); }
function setTheme(v){ SETTINGS.theme=v; saveSettings(); applySettings(); openSettings(); }
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
