"use strict";

/* ============================================================================
 * events.js — wiring and startup. A single delegated click handler maps every
 * [data-action] to its function, plus the ledger drawer controls and the boot
 * sequence. Loaded last so all other modules' functions are defined.
 * ==========================================================================*/

/* ---------- event delegation ---------- */

// One click listener for the whole app: find the nearest [data-action] and
// dispatch. Buy/reserve stop propagation so the card's own click doesn't also fire.
document.addEventListener("click",(e)=>{
  const t=e.target.closest("[data-action]"); if(!t) return;
  if(t.matches("input[type=range]")) return;  // volume sliders: see the input listener below
  const a=t.dataset.action;
  // A soft UI tick for menu/header buttons only — board actions keep their own
  // thematic cues, so we skip clicks inside the game view.
  if(t.closest("#modal") || t.closest(".topbar")) sfx("click");
  switch(a){
    case "open-tutorial": openTutorial(); break;
    case "open-newgame": openNewGame(); break;
    case "open-mainmenu": openMainMenu(); break;
    case "return-mainmenu": returnToMainMenu(); break;
    case "close-modal": closeModal(); if(pendingMainMenu){ pendingMainMenu=false; openMainMenu(); } break;
    case "ng-mode": SETTINGS.mode=t.dataset.mode; saveSettings(); ngRerender(); break;
    case "ng-ai-count": SETTINGS.opponents=+t.dataset.v; saveSettings(); ngRerender(); break;
    case "ng-ai-level": SETTINGS.aiLevel=t.dataset.v; saveSettings(); ngRerender(); break;
    case "ng-players": SETTINGS.humans=+t.dataset.v; saveSettings(); ngRerender(); break;
    case "ng-watchers": SETTINGS.watchers=+t.dataset.v; saveSettings(); ngRerender(); break;
    case "start-game": startFromMenu(); break;
    case "bank": onTakeGem(t.dataset.color); break;
    case "deselect": onDeselect(t.dataset.color); break;
    case "confirm-take": confirmTake(); break;
    case "clear-take": clearTake(); break;
    case "clear-sel": UI.selectedCard=null; render(); break;
    case "card": {
      const loc = t.dataset.reserved!=null ? {reserved:+t.dataset.reserved}
                : {tier:+t.dataset.tier, idx:+t.dataset.idx};
      onCardClick(loc); break;
    }
    case "buy": e.stopPropagation(); doBuy(); break;
    case "reserve": e.stopPropagation(); doReserve(); break;
    case "deck": onCardClick({deck:+t.dataset.tier}); break;
    case "hold-deck": e.stopPropagation(); onDeckReserve(+t.dataset.tier); break;
    case "discard": onDiscard(t.dataset.color); break;
    case "pick-noble": { const n=UI._nobleList[+t.dataset.i]; closeModal(); UI._nobleCb(n); break; }
    case "toggle-ledger": toggleLedger(); break;
    case "close-ledger": closeLedger(); break;
    case "cycle-opp": cycleOpp(); break;
    case "toggle-hud": document.body.classList.toggle("gems-hidden"); break;
    case "open-menu": openMenu(); break;
    case "open-settings": openSettings(false); break;
    case "settings-from-menu": openSettings(true); break;
    case "save-game": saveGame(); break;
    case "load-game": openSessions(t.dataset.from||"header"); break;
    case "load-session": loadSession(t.dataset.id); break;
    case "del-session": deleteSession(t.dataset.id); openSessions(sessionsFrom); break;
    case "back-newgame": openNewGame(ngForce); break;
    case "toggle-theme": toggleTheme(); break;
    case "set-tab": setTab(t.dataset.v); break;
    case "set-max": setMax(t.dataset.v); break;
    case "set-cvd": setCVD(t.dataset.v); break;
    case "set-theme": setTheme(t.dataset.v); break;
    case "set-keys": setKeys(t.dataset.v); break;
    case "set-toastpos": setToastPos(t.dataset.v); break;
    case "set-toastms": setToastMs(t.dataset.v); break;
  }
});
// Dismiss a dismissible modal by clicking its backdrop; keep layout in sync on resize.
scrim.addEventListener("click",(e)=>{ if(e.target===scrim && scrim.dataset.dismiss==="1") closeModal(); });
// Volume sliders update live while dragging (no modal re-render, so the drag
// isn't interrupted); a gem tinkle previews the effects level on release.
document.addEventListener("input",(e)=>{
  const t=e.target; if(!t || t.tagName!=="INPUT" || t.type!=="range") return;
  const a=t.dataset.action;
  if(a==="set-master") setMaster(t.value, t);
  else if(a==="set-vol") setVol(t.value, t);
  else if(a==="set-musicvol") setMusicVol(t.value, t);
});
document.addEventListener("change",(e)=>{
  const t=e.target; if(!t || t.tagName!=="INPUT" || t.type!=="range") return;
  const a=t.dataset.action;
  if(a==="set-vol" || a==="set-master"){ Sfx.unlock(); sfx('gem'); }
});
window.addEventListener("resize", ()=>{ syncHudSpace(); layoutHeader(); if(G) layoutPlayers(); });

/* ---------- keyboard navigation ---------- */

// Keyboard shortcuts (toggle in Settings ▸ Controls). Esc pauses/opens the menu
// during a game, or goes back/closes a dialog; arrow keys move focus between the
// open menu's options; Enter/Space activate the focused control natively.
document.addEventListener("keydown",(e)=>{
  if(typeof SETTINGS!=="undefined" && SETTINGS.keys===false) return;
  if(e.altKey||e.ctrlKey||e.metaKey) return;
  const tag=(e.target.tagName||"").toLowerCase();
  if(tag==="input"||tag==="textarea"||tag==="select"||e.target.isContentEditable) return;

  const open=scrim.classList.contains("show");

  if(e.key==="Escape"){
    if(open){
      if(scrim.dataset.dismiss==="1"){                 // dismissible dialog → close (mirrors close-modal)
        e.preventDefault(); closeModal();
        if(pendingMainMenu){ pendingMainMenu=false; openMainMenu(); }
      } else if(landing && !modalEl.classList.contains("mainmenu")){ // pre-game sub-modal → back to main menu
        e.preventDefault(); openMainMenu();
      }
      // the non-dismissible main menu itself has no "back" — leave it be
    } else if(G && !G.over){                           // in a live game → pause via the menu
      e.preventDefault(); openMenu();
    }
    return;
  }

  if(!open) return;
  if(e.key!=="ArrowDown" && e.key!=="ArrowUp" && e.key!=="ArrowRight" && e.key!=="ArrowLeft") return;
  const btns=[...modalEl.querySelectorAll("button:not([disabled])")];
  if(!btns.length) return;
  e.preventDefault();
  const i=btns.indexOf(document.activeElement);
  const fwd=(e.key==="ArrowDown"||e.key==="ArrowRight");
  const next = i<0 ? (fwd?0:btns.length-1) : (i+(fwd?1:-1)+btns.length)%btns.length;
  btns[next].focus();
});

/* ---------- ledger drawer ---------- */

// Open/close the sliding ledger drawer, syncing body class and ARIA state.
function toggleLedger(){
  const d=document.getElementById('ledgerDrawer');
  const open=d.classList.toggle('open');
  document.body.classList.toggle('ledger-open', open);
  d.querySelector('.ledger-tab').setAttribute('aria-expanded', open?'true':'false');
}
function closeLedger(){
  const d=document.getElementById('ledgerDrawer');
  d.classList.remove('open'); document.body.classList.remove('ledger-open');
  d.querySelector('.ledger-tab').setAttribute('aria-expanded','false');
}

/* ---------- boot ---------- */

// Remember, per device, that the how-to has been shown (survives refresh;
// degrades safely if storage is blocked).
function seenTutorial(){ try{ return localStorage.getItem('gilded_tutorial_seen')==='1'; }catch(e){ return false; } }
function markTutorialSeen(){ try{ localStorage.setItem('gilded_tutorial_seen','1'); }catch(e){} }

// Startup: apply saved settings, prime a silent game behind the menu, then show
// the tutorial (first visit) or the start-game menu.
applySettings();
startGame(SETTINGS.mode==="hotseat"
  ? {mode:"hotseat", humans:SETTINGS.humans||2}
  : {mode:"ai", opponents:SETTINGS.opponents||1, level:SETTINGS.aiLevel||"normal"}, true);
syncHeaderActions();
// Audio can't legally make sound before a user gesture, but the context is
// created eagerly (audio.js) so the *first* gesture — any pointer/touch/key
// press, including the opening menu click — resumes it and starts the music
// with no dropped first sound. We also try once here in case the browser
// already granted (sticky) activation from the navigation that loaded the page.
function armAudio(){ try{ Sfx.unlock(); Music.start(); }catch(e){} }
armAudio();
["pointerdown","touchstart","keydown","click"].forEach(ev=>
  window.addEventListener(ev, armAudio, true));
if(!seenTutorial()){ markTutorialSeen(); pendingMainMenu=true; openTutorial(); }
else openMainMenu();
