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
function openModal(html,dismiss=true){ modalEl.innerHTML=html; scrim.classList.add("show"); scrim.dataset.dismiss=dismiss?"1":"0"; }
function closeModal(){ scrim.classList.remove("show"); }

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

  <div class="foot"><button class="gbtn" data-action="close-modal">Got it</button></div>`;
}
function openTutorial(){ openModal(tutorialHTML(),true); }

// Start-game menu state. `ngForce` blocks cancel (forced on first load);
// `pendingStartMenu` opens the menu right after the tutorial is dismissed.
let ngForce=false, pendingStartMenu=false;

// Markup for the start-game menu, reflecting the current SETTINGS. Shows mode
// cards (Vs AI / Vs Player / Online), the relevant sub-options, and — for AI —
// a Load button. `force` hides the Cancel button.
function newGameHTML(force){
  const mode = SETTINGS.mode || "ai";
  const opp = SETTINGS.opponents || 1;
  const lvl = SETTINGS.aiLevel || "normal";
  const humans = SETTINGS.humans || 2;
  const modeBtn=(m,label,sub,dis)=>`<button class="mode-card${mode===m&&!dis?' sel':''}${dis?' disabled':''}" ${dis?'disabled aria-disabled="true"':`data-action="ng-mode" data-mode="${m}"`}><span class="mc-t">${label}</span><span class="mc-s">${sub}</span></button>`;
  const seg=(act,val,cur,label)=>`<button class="seg ${String(val)===String(cur)?'on':''}" data-action="${act}" data-v="${val}">${label}</button>`;
  let sub;
  if(mode==="hotseat"){
    sub=`<div class="set-row"><div class="set-label">Players<span class="set-hint">pass the device between turns</span></div><div class="seg-group">
        ${seg('ng-players',2,humans,'2')}${seg('ng-players',3,humans,'3')}${seg('ng-players',4,humans,'4')}</div></div>`;
  } else {
    sub=`<div class="set-row"><div class="set-label">Rivals</div><div class="seg-group">
        ${seg('ng-ai-count',1,opp,'1')}${seg('ng-ai-count',2,opp,'2')}${seg('ng-ai-count',3,opp,'3')}</div></div>
      <div class="set-row"><div class="set-label">Difficulty<span class="set-hint">how sharply rivals play</span></div><div class="seg-group">
        ${seg('ng-ai-level','easy',lvl,'Easy')}${seg('ng-ai-level','normal',lvl,'Normal')}${seg('ng-ai-level','hard',lvl,'Hard')}</div></div>
      <div class="ng-load"><button class="gbtn ghost" data-action="load-game" data-from="newgame" ${hasSave()?'':'disabled'}>${hasSave()?'Load a saved game…':'No saved games yet'}</button></div>`;
  }
  const cancel = force ? '' : `<button class="gbtn ghost" data-action="close-modal">Cancel</button>`;
  return `<div class="eyebrow">New game</div><h2>Choose your game</h2>
  <div class="mode-cards">
    ${modeBtn('ai','Vs AI','Play computer merchants')}
    ${modeBtn('hotseat','Vs Player','Local pass-and-play')}
    ${modeBtn('online','Online','Coming soon',true)}
  </div>
  ${sub}
  <div class="foot">${cancel}<button class="gbtn" data-action="start-game">Start game</button></div>`;
}
function openNewGame(force){ ngForce=!!force; openModal(newGameHTML(!!force), force?false:!!G); }
function ngRerender(){ openModal(newGameHTML(ngForce), ngForce?false:!!G); }

// Start the game described by the current start-menu selections.
function startFromMenu(){
  const mode=SETTINGS.mode||"ai";
  ngForce=false; closeModal();
  if(mode==="hotseat") startGame({mode:"hotseat", humans:SETTINGS.humans||2});
  else startGame({mode:"ai", opponents:SETTINGS.opponents||1, level:SETTINGS.aiLevel||"normal"});
}

/* ---------- menu / settings / save-load ---------- */

// Persisted user preferences (theme, win target, CVD mode, last game setup).
const SETTINGS = (function(){ try{ return JSON.parse(localStorage.getItem('gilded_settings'))||{}; }catch(e){ return {}; } })();
function saveSettings(){ try{ localStorage.setItem('gilded_settings', JSON.stringify(SETTINGS)); }catch(e){} }

// Apply settings to the DOM: theme class, colour-vision palette, win target,
// and the header theme-toggle label/state.
function applySettings(){
  document.body.classList.toggle('light', SETTINGS.theme==='light');
  const cvd=SETTINGS.cvd||'off';
  document.body.classList.toggle('cvd-prot', cvd==='prot');
  document.body.classList.toggle('cvd-deut', cvd==='deut');
  document.body.classList.toggle('cvd-trit', cvd==='trit');
  WIN = SETTINGS.maxVP || 15;
  const tt=document.getElementById('themeToggle');
  if(tt){ const light=SETTINGS.theme==='light';
    tt.innerHTML = light ? '<span aria-hidden="true">\u2600</span> Light' : '<span aria-hidden="true">\u263E</span> Dark';
    tt.setAttribute('aria-pressed', light?'true':'false');
  }
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
  return m.mode==='hotseat' ? `Pass-and-play · ${m.players}P` : `Vs AI · ${LEVEL_LABEL[m.level]||'Normal'}`;
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
// the oldest when over the cap. Returns true if a session was evicted.
function persistSession(){
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

// Manual save (with a confirming toast in the menu).
function saveGame(){
  try{ const evicted=persistSession(); openMenu(evicted ? "Game saved — the oldest session was replaced." : "Game saved on this device."); }
  catch(e){ openMenu("Couldn't save (storage unavailable here)."); }
}

// Silent autosave after each round and at game end (same slot).
function autoSave(){ if(!G) return; try{ persistSession(); }catch(e){} }

// Load a saved session into the live game and resume it.
function loadSession(id){
  const s=loadSessions().find(x=>x.id===id); if(!s||!s.data||!s.data.G) return;
  G=s.data.G; if(s.data.WIN) WIN=s.data.WIN;
  currentSessionId=id; ngForce=false; pendingStartMenu=false;
  UI={sel:{}, selectedCard:null, phase:"play", discardResolve:null, oppView:G.current||0};
  closeModal(); render(); syncHeaderActions();
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
  else footBtn=`<button class="gbtn ghost" data-action="close-modal">Close</button>`;
  return `<div class="eyebrow">Saved sessions</div><h2>Load a game</h2>
    <p class="sess-cap">Up to ${MAX_SESSIONS} games are kept — saving a new one replaces the oldest.</p>
    <div class="sess-list">${rows}</div>
    <div class="foot">${footBtn}</div>`;
}
function openSessions(from){ sessionsFrom=from||'header'; const forced=(from==='newgame'&&ngForce); openModal(sessionsHTML(sessionsFrom), !forced); }

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
  </div>
  <div class="foot"><button class="gbtn ghost" data-action="close-modal">Close</button></div>`;
}
function openMenu(note){ openModal(menuHTML(note), true); }

// Markup for the settings modal (win target and colour-vision mode).
function settingsHTML(fromMenu){
  const maxVP=SETTINGS.maxVP||15, cvd=SETTINGS.cvd||'off';
  const seg=(name,val,cur,label)=>`<button class="seg ${String(val)===String(cur)?'on':''}" data-action="set-${name}" data-v="${val}">${label}</button>`;
  const back=fromMenu?`<button class="gbtn ghost" data-action="open-menu">Back</button>`:'';
  return `<div class="eyebrow">Settings</div><h2>Settings</h2>
  <div class="set-row"><div class="set-label">Prestige to win</div><div class="seg-group">
    ${seg('max','10',maxVP,'10')}${seg('max','15',maxVP,'15')}${seg('max','20',maxVP,'20')}</div></div>
  <div class="set-row"><div class="set-label">Colour-vision mode<span class="set-hint">recolours gems for clarity</span></div><div class="seg-group">
    ${seg('cvd','off',cvd,'Off')}${seg('cvd','prot',cvd,'Protanopia')}${seg('cvd','deut',cvd,'Deuteranopia')}${seg('cvd','trit',cvd,'Tritanopia')}</div></div>
  <p class="set-note">Prestige-to-win applies now and to new games. Settings are saved on this device.</p>
  <div class="foot">${back}<button class="gbtn" data-action="close-modal">${fromMenu?'Done':'Close'}</button></div>`;
}
let settingsFromMenu=false;
function openSettings(fromMenu){ if(fromMenu!==undefined) settingsFromMenu=fromMenu; openModal(settingsHTML(settingsFromMenu), true); }

// Toggle light/dark theme and persist it.
function toggleTheme(){
  SETTINGS.theme = SETTINGS.theme==='light' ? 'dark' : 'light';
  saveSettings(); applySettings();
}

// Show the header actions inline; collapse to a single "Menu" button when they
// can't fit (small screens or long text).
function layoutHeader(){
  const bar=document.querySelector('.topbar');
  const actions=document.getElementById('hdrActions');
  const menuBtn=document.getElementById('menuBtn');
  if(!bar||!actions||!menuBtn) return;
  actions.hidden=false; menuBtn.hidden=true;
  const fits = bar.scrollWidth <= bar.clientWidth + 1;
  actions.hidden = !fits;
  menuBtn.hidden = fits;
}

// Refresh header state: enable/disable Load based on saved games, then re-layout.
function syncHeaderActions(){
  const load=document.getElementById('hdrLoad');
  if(load) load.disabled=!hasSave();
  layoutHeader();
}

// Settings segment handlers: change win target / colour-vision mode live.
function setMax(v){ SETTINGS.maxVP=+v; saveSettings(); applySettings(); if(G) renderBanner(); openSettings(); }
function setCVD(v){ SETTINGS.cvd=v; saveSettings(); applySettings(); openSettings(); }

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
