"use strict";

/* ============================================================================
 * render.js — view layer. Rebuilds the board, bank, player HUD, banner, and
 * ledger from `G`/`UI` on every state change. All functions read state and
 * write DOM (via innerHTML); they never mutate the game model.
 * ==========================================================================*/

/* ---------- rendering ---------- */

// Full re-render. Snapshots scroll position first (a full innerHTML rebuild
// otherwise makes iOS Safari jump to the top), refreshes every panel, toggles
// the your-turn HUD, tracks board card ids for deal-in animation, then restores scroll.
function render(){
  if(!G) return;
  const _scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  renderNobles(); renderTiers(); renderBank(); renderTakeTray();
  renderBanner(); renderPlayers(); renderLog();
  const gh=document.getElementById("gemHud"), hc=document.getElementById("hudControls");
  const yourTurn = !me().isAI && !G.over;
  const watching = G.mode==="watch";
  const dock = window.matchMedia("(min-width:1200px)").matches;
  if(UI._lastCurrent !== G.current){ UI._lastCurrent = G.current; if(yourTurn) document.body.classList.remove("gems-hidden"); }
  if(gh) gh.classList.toggle("show", yourTurn || watching || dock);
  if(hc) hc.classList.toggle("hidden", !yourTurn);
  document.body.classList.toggle("watching", watching);
  document.body.classList.toggle("dock-bank", dock);
  // On wide screens the bank docks beside the development cards (inside the
  // board) in every mode; otherwise it floats at body level as before. The
  // take/clear controls ride along as their own board cell below the bank, so
  // they sit outside #gemHud and never distort the gem column or the card grid.
  if(gh){
    const board=document.querySelector(".board");
    const bank=document.getElementById("bank");
    if(dock && board){
      if(gh.parentElement!==board) board.appendChild(gh);
      if(hc && hc.parentElement!==board) board.appendChild(hc);
    } else {
      if(gh.parentElement && gh.parentElement!==document.body) document.body.appendChild(gh);
      if(hc && hc.parentElement!==gh && bank) gh.insertBefore(hc, bank);
    }
  }
  layoutPlayers();
  syncHudSpace();
  syncBankHeight();
  syncPauseUI();
  // Remember which cards are on the board so newly dealt ones can animate in.
  const ids=new Set();
  [1,2,3].forEach(t=>G.board[t].forEach(c=>{ if(c) ids.add(c.id); }));
  G.players[localSeat()].reserved.forEach(c=>ids.add(c.id));
  PREV_CARD_IDS=ids;
  restoreScroll(_scrollY);
}

// Restore window scroll to `y` after a rebuild (immediately and on the next
// frame, to beat Safari's post-innerHTML scroll reset). No-op at the top.
function restoreScroll(y){
  if(!y) return;
  const fix=()=>{ if(Math.abs((window.pageYOffset||0)-y)>1) window.scrollTo(0,y); };
  fix();
  if(typeof requestAnimationFrame==="function") requestAnimationFrame(fix);
}

// Small HTML builders: a gem token and a cost/requirement dot.
function gem(cls,extra=""){ return `<div class="gem g-${cls}" ${extra}></div>`; }
function dot(color,n){ return `<span class="dot" style="background:var(--${color})">${n!=null?`<span class="dv">${n}</span>`:""}</span>`; }

// Render the row of patron tiles with their bonus requirements.
function renderNobles(){
  const el=document.getElementById("nobles");
  el.innerHTML=G.nobles.map(n=>{
    const chips=Object.entries(n.req).map(([ci,req])=>dot(KEYS[ci],req)).join("");
    return `<div class="noble"><div class="np">3<small>prestige</small></div><div class="req">${chips}</div></div>`;
  }).join("");
}

// Render the three tier rows: each deck (with its blind-reserve menu when
// selected) followed by its four face-up card slots.
function renderTiers(){
  const el=document.getElementById("tiers");
  const p=me();
  el.innerHTML=[3,2,1].map(t=>{
    const dsel = sameLoc(UI.selectedCard,{deck:t});
    const canRes = humanControls() && p.reserved.length<3 && G.decks[t].length>0;
    const dmenu = (dsel && humanControls())
      ? `<div class="deck-menu"><button class="mbtn res" data-action="hold-deck" data-tier="${t}" ${canRes?"":"disabled"}>Hold</button></div>` : "";
    const deck=`<div class="deck t${t} ${dsel?"sel":""}" data-action="deck" data-tier="${t}"><div class="dlabel">Tier</div><div class="dnum">${t}</div><div class="dleft">${G.decks[t].length} left</div>${dmenu}</div>`;
    const cards=G.board[t].map((c,idx)=> c?cardHTML(c,{tier:t,idx}):`<div class="card empty" aria-hidden="true"></div>`).join("");
    return `<div class="tier-row">${deck}<div class="cards">${cards}</div></div>`;
  }).join("");
}

// Build one development card's markup, including its buy/hold menu when selected
// and the deal-in class when it wasn't on the board last render.
function cardHTML(c,loc){
  const p=me();
  const afford = humanControls() && affordPlan(p,c).ok;
  const sel = sameLoc(UI.selectedCard,loc);
  const cost=KEYS.filter(k=>c.cost[k]).map(k=>dot(k,c.cost[k])).join("");
  let menu="";
  if(sel && humanControls()){
    const canBuy=affordPlan(p,c).ok;
    const canRes=loc.reserved==null && p.reserved.length<3;
    menu=`<div class="menu">
      <button class="mbtn buy" data-action="buy" ${canBuy?"":"disabled"}>Buy</button>
      ${loc.reserved==null?`<button class="mbtn res" data-action="reserve" ${canRes?"":"disabled"}>Hold</button>`:""}
    </div>`;
  }
  const dataloc = loc.reserved!=null?`data-reserved="${loc.reserved}"`:`data-tier="${loc.tier}" data-idx="${loc.idx}"`;
  const isNew = !PREV_CARD_IDS.has(c.id);
  return `<div class="card ${sel?"sel":""} ${afford?"afford":""} ${isNew?"card-enter":""}" data-action="card" data-cid="${c.id}" ${dataloc}>
    <div class="card-band g-${c.color}">${c.points?`<span class="card-pts">${c.points}</span>`:""}</div>
    <div class="card-body"><div class="cost">${cost}</div></div>${menu}
  </div>`;
}

// Render the six bank piles with counts and current selection; gold and
// off-turn/empty piles are disabled.
function renderBank(){
  const el=document.getElementById("bank");
  const inDiscard = !me().isAI && UI.phase==="discard";
  el.innerHTML=ALL.map(k=>{
    const n=G.bank[k];
    const selN=UI.sel[k]||0;
    const dis = k==="gold" || (!humanControls()) || n<1;
    return `<div class="token ${n<1?"empty":""}" data-color="${k}">
      <div class="gem g-${k} ${dis?"disabled":""}" data-action="bank" data-color="${k}"></div>
      <div class="cnt"><b>${n}</b>${selN?`<i class="selc"> · +${selN}</i>`:""}</div>
      <div class="lbl">${NAME[k]}</div>
    </div>`;
  }).join("");
}

// Render the contextual tray beneath the bank: discard prompt while over the
// cap, buy panel for a selected reserved card, or the take/clear buttons.
function renderTakeTray(){
  const el=document.getElementById("takeTray"); if(!el) return;
  if(!me().isAI && UI.phase==="discard"){
    const p=me();
    const chips=ALL.filter(k=>p.tokens[k]).map(k=>`<div class="gem g-${k}" data-action="discard" data-color="${k}" title="discard"></div>`).join("");
    el.innerHTML=`<span class="take-note">Return to 10 (${totalTokens(p)}/10)</span><div class="take-chips">${chips}</div>`;
    return;
  }
  if(!humanControls()){ el.innerHTML=""; return; }
  const loc=UI.selectedCard;
  if(loc && loc.reserved!=null){
    const p=me(), card=p.reserved[loc.reserved];
    if(card){
      const cost=KEYS.filter(k=>card.cost[k]).map(k=>dot(k,card.cost[k])).join("");
      const canBuy=affordPlan(p,card).ok;
      el.innerHTML=`<span class="take-note">Reserved ${NAME[card.color]}${card.points?` <b>+${card.points}</b>`:""}</span>
        <span class="res-cost">${cost}</span>
        <button class="gbtn" data-action="buy" ${canBuy?"":"disabled"}>Buy</button>
        <button class="gbtn ghost" data-action="clear-sel">Cancel</button>`;
      return;
    }
  }
  const has=selCount()>0;
  const sel=UI.sel, cols=Object.keys(sel).filter(k=>sel[k]>0);
  // Take is only offered for a legal selection: 2 of one colour, or 3 different colours.
  const canTake=(cols.length===1&&sel[cols[0]]===2)||(cols.length===3&&cols.every(k=>sel[k]===1));
  el.innerHTML=`<button class="gbtn" data-action="confirm-take" ${canTake?"":"disabled"}>Take</button>
    <button class="gbtn ghost" data-action="clear-take" ${has?"":"disabled"}>Clear</button>`;
}

// Render the goal banner: prestige target plus leader / final-round / game-over status.
function renderBanner(){
  const el=document.getElementById("goalBanner"); if(!el) return;
  const leader=G.players.reduce((a,b)=> b.points>a.points?b:a, G.players[0]);
  let tag;
  if(G.over){ tag=`<span class="gb-tag">The books are closed</span>`; }
  else if(paused){ tag=`<span class="gb-final">&#9208; Paused</span>`; }
  else if(G.finalRound){ tag=`<span class="gb-final">&#9670; Final round — last turns!</span>`; }
  else {
    tag = leader.points>0 ? `<span class="gb-tag">Leader <b>${leader.name}</b> · ${leader.points}</span>`
                          : `<span class="gb-tag">No prestige yet</span>`;
  }
  el.innerHTML=`<div class="gb-main">First to ${WIN} prestige</div><div class="gb-sep"></div>${tag}`;
}

// Reserve bottom padding equal to the fixed HUD's height so it never covers
// content, and expose the HUD and header extents (--hud-h / --hdr-h) so toasts
// can float inside the page content, clear of both.
function syncHudSpace(){
  const hud=document.getElementById("hud"), wrap=document.querySelector(".wrap");
  if(!hud||!wrap) return;
  requestAnimationFrame(()=>{
    const h=hud.offsetHeight;
    wrap.style.paddingBottom=(h+16)+"px";
    document.documentElement.style.setProperty("--hud-h", h+"px");
    const bar=document.querySelector(".topbar");
    if(bar){ const r=bar.getBoundingClientRect(); const y=(window.pageYOffset||0);
      document.documentElement.style.setProperty("--hdr-h", Math.round(r.top+y+r.height)+"px"); }
  });
}

// When the bank is docked beside the board, stretch the gem column to the same
// height as the development-card stack (tiers 1-3) so the gems distribute evenly
// down that span, with the take/clear controls sitting below.
function syncBankHeight(){
  const bank=document.getElementById("bank"), tiers=document.getElementById("tiers");
  if(!bank||!tiers) return;
  requestAnimationFrame(()=>{
    bank.style.height = document.body.classList.contains("dock-bank")
      ? tiers.offsetHeight + "px" : "";
  });
}

// Render every player chip: colour holdings (bonus + tokens + live selection),
// gold, patron count, prestige, and the reserved-card strip (own cards face-up,
// rivals' blind reserves hidden). Marks the starter and the active player.
function renderPlayers(){
  const el=document.getElementById("players"); if(!el) return;
  hideRtip();
  const seat = localSeat();
  const chips=G.players.map((p,i)=>{
    const hold=KEYS.map(k=>{
      const b=p.bonus[k], t=p.tokens[k];
      const sel=(i===seat && humanControls() && UI.sel[k]) ? UI.sel[k] : 0;
      const cls = sel ? "tk tk-add" : (t?"tk":"tk tk0");
      return `<span class="cg"><span class="bon g-${k}">${b?`<b>${b}</b>`:""}</span><span class="${cls}">${t+sel}</span></span>`;
    }).join("");
    const gg=p.tokens.gold;
    const gold=`<span class="cg"><span class="gem g-gold"></span><span class="tk${gg?"":" tk0"}">${gg}</span></span>`;
    const patronIco=`<svg class="pc-ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 7.5l4.2 3.4L12 4l4.8 6.9L21 7.5 19.3 19H4.7L3 7.5z"/></svg>`;
    const mine = i===seat;
    const role = mine ? "you" : "opp";
    let resStrip="";
    if(p.reserved.length){
      const selIdx = mine && UI.selectedCard && UI.selectedCard.reserved!=null ? UI.selectedCard.reserved : -1;
      const items = p.reserved.map((c,idx)=>{
        if(!mine && c.blind) return `<span class="rcard back" title="Hidden — reserved from the deck"></span>`;
        const buyable = mine && affordPlan(p,c).ok;
        const cls = `rcard g-${c.color}`+(idx===selIdx?" sel":"")+(buyable?" buyable":"");
        const attr = mine ? ` data-action="card" data-reserved="${idx}"` : "";
        const costEnc = KEYS.filter(k=>c.cost[k]).map(k=>k+":"+c.cost[k]).join(",");
        const aria = `Reserved ${NAME[c.color]}${c.points?`, ${c.points} prestige`:""}, tier ${ROMAN[c.tier]}${buyable?", ready to buy":""}`;
        return `<span class="${cls}"${attr} data-color="${c.color}" data-tier="${c.tier}" data-points="${c.points||0}" data-cost="${costEnc}" data-ready="${buyable?1:0}" aria-label="${aria}">${c.points||""}</span>`;
      }).join("");
      resStrip = `<div class="pc-res${mine?" mine":""}" title="Reserved cards">${items}</div>`;
    }
    return `<div class="pchip ${role} ${i===G.current&&!G.over?"active":""}" data-pi="${i}">
      <div class="pc-top"><span class="pc-name">${p.name}</span>${(i===G.starter&&!G.over)?`<span class="pc-first" title="Started the game">1st</span>`:""}${(i===G.current&&!G.over&&p.isAI)?`<span class="pc-think" aria-label="thinking"><i></i><i></i><i></i></span>`:""}<span class="pc-vp${p._vpGain?" bump":""}"><span class="pc-pat" title="Patrons">${patronIco}${p.nobles.length}</span>${p.points}<small> VP</small></span></div>
      <div class="pc-hold">${hold}${gold}</div>${resStrip}
    </div>`;
  }).join("");
  const nav=`<button class="pchip-nav" data-action="cycle-opp" hidden aria-label="Show next player"><span class="nav-chev" aria-hidden="true">&rsaquo;</span><span class="nav-count"></span></button>`;
  el.innerHTML=chips+nav;
  // Fire prestige-gain flourishes on the freshly rendered chips, then clear the
  // one-shot flags set when points changed (buyCard / awardNoble).
  G.players.forEach((p,i)=>{ if(p._buyFloat){ prestigeFloat(i,p._buyFloat); p._buyFloat=0; } p._vpGain=0; });
  if(!G.over) UI.oppView=G.current;      // keep the active player's chip in view
  layoutPlayers();
}

// Fit player chips to the row: show them all when they fit; when too tight, page
// through one full-width chip at a time (including "You") behind the cycle button.
function layoutPlayers(){
  const el=document.getElementById("players"); if(!el) return;
  const nav=el.querySelector(".pchip-nav");
  const chips=[...el.querySelectorAll(".pchip")];
  el.classList.remove("paged","single");
  if(nav) nav.hidden=true;
  chips.forEach(c=>c.hidden=false);
  if(chips.length<=1) return;
  if(el.scrollWidth <= el.clientWidth + 1) return;       // everything fits: show all
  const n=chips.length;
  const view=((UI.oppView||0)%n+n)%n; UI.oppView=view;
  el.classList.add("paged","single");
  chips.forEach((c,idx)=>{ c.hidden = idx!==view; });
  if(nav){ nav.hidden=false; const c=nav.querySelector(".nav-count"); if(c) c.textContent=`${view+1}/${n}`; }
}

// Advance the paged player view to the next chip.
function cycleOpp(){
  const n=G.players.length; if(n<=1) return;
  UI.oppView=(((UI.oppView||0)+1)%n+n)%n;
  layoutPlayers();
}

// Render the ledger newest-first, inserting a "Round N" divider whenever the
// round changes. Tolerates legacy string entries (no round stamp).
function renderLog(){
  const el=document.getElementById("log");
  const items=(G.logs||[]).slice().reverse();
  let html="", lastR=null;
  for(const it of items){
    const isObj = it && typeof it==="object";
    const r = isObj ? it.r : null;
    const s = isObj ? it.s : it;
    if(r!=null && r!==lastR){ html+=`<div class="log-round">Round ${r}</div>`; lastR=r; }
    html+=`<div>${s}</div>`;
  }
  el.innerHTML=html;
}

// Append a round-stamped ledger entry (round defaults to the current one) and
// refresh the log if it's mounted.
function log(s, r){ (G.logs=G.logs||[]).push({ r: (r!=null?r:(G.turn||0)+1), s }); if(document.getElementById("log")) renderLog(); }

// Show a transient toast popup for warnings/hints. It appears in the screen
// corner chosen in Settings (toastPos) and auto-dismisses after toastMs; a
// click dismisses it early. Falls back silently if the host is missing.
function flash(msg){
  const host=document.getElementById("toasts"); if(!host) return;
  const t=document.createElement("div");
  t.className="toast"; t.textContent=msg;
  host.appendChild(t);
  requestAnimationFrame(()=>t.classList.add("show"));
  const ms=(typeof SETTINGS!=="undefined" && SETTINGS.toastMs) || 3000;
  const dismiss=()=>{ t.classList.remove("show"); setTimeout(()=>t.remove(),240); };
  const timer=setTimeout(dismiss, ms);
  t.addEventListener("click",()=>{ clearTimeout(timer); dismiss(); });
}
