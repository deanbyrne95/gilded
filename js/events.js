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
  const a=t.dataset.action;
  switch(a){
    case "open-tutorial": openTutorial(); break;
    case "open-newgame": openNewGame(); break;
    case "close-modal": closeModal(); if(pendingStartMenu){ pendingStartMenu=false; openNewGame(true); } break;
    case "ng-mode": SETTINGS.mode=t.dataset.mode; saveSettings(); ngRerender(); break;
    case "ng-ai-count": SETTINGS.opponents=+t.dataset.v; saveSettings(); ngRerender(); break;
    case "ng-ai-level": SETTINGS.aiLevel=t.dataset.v; saveSettings(); ngRerender(); break;
    case "ng-players": SETTINGS.humans=+t.dataset.v; saveSettings(); ngRerender(); break;
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
    case "set-max": setMax(t.dataset.v); break;
    case "set-cvd": setCVD(t.dataset.v); break;
    case "set-toastpos": setToastPos(t.dataset.v); break;
    case "set-toastms": setToastMs(t.dataset.v); break;
  }
});
// Dismiss a dismissible modal by clicking its backdrop; keep layout in sync on resize.
scrim.addEventListener("click",(e)=>{ if(e.target===scrim && scrim.dataset.dismiss==="1") closeModal(); });
window.addEventListener("resize", ()=>{ syncHudSpace(); layoutHeader(); if(G) layoutPlayers(); });

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
if(!seenTutorial()){ markTutorialSeen(); pendingStartMenu=true; openTutorial(); }
else openNewGame(true);
