"use strict";

/* ============================================================================
 * animations.js — non-essential visual effects and the reserved-card tooltip.
 * All effects are guarded by `REDUCE` (prefers-reduced-motion) and fail safely
 * when elements are missing, so gameplay never depends on them.
 * ==========================================================================*/

/* ---------- fx / animations ---------- */

// Respect the OS "reduce motion" setting: when true, effects are skipped.
const REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Card ids present on the board last render, so newly dealt cards can animate in.
let PREV_CARD_IDS = new Set();

// DOM lookup helpers for effect targets.
function fxLayer(){ return document.getElementById('fxLayer'); }
function centerOf(el){ const r=el.getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2}; }
function elBank(color){ return document.querySelector(`#bank [data-color="${color}"]`); }
function elPlayer(i){ return document.querySelector(`#players .pchip[data-pi="${i}"]`); }
function elCardById(id){ return document.querySelector(`.card[data-cid="${id}"]`); }

/* reserved-card hover tooltip */

// Hide the reserved-card tooltip.
function hideRtip(){ const t=document.getElementById('rtip'); if(t) t.hidden=true; }

// Show the reserved-card tooltip for `el`, populated from its data-* attributes
// (colour, tier, prestige, encoded cost, ready flag) and positioned above it
// (flipping below and clamping horizontally to stay on-screen).
function showRtip(el){
  const t=document.getElementById('rtip'); if(!t) return;
  const color=el.dataset.color, tier=el.dataset.tier, pts=+el.dataset.points||0;
  const cost=(el.dataset.cost||"").split(",").filter(Boolean)
    .map(s=>{ const[k,n]=s.split(":"); return dot(k,+n); }).join("");
  const ready = el.dataset.ready==="1";
  t.innerHTML =
    `<div class="rtip-head"><span class="rtip-swatch" style="background:var(--${color})"></span>`+
    `<span class="rtip-name">${NAME[color]}</span>`+
    (pts?`<span class="rtip-pts">${pts} <small>prestige</small></span>`:"")+`</div>`+
    `<div class="rtip-tier">Tier ${ROMAN[tier]} development</div>`+
    `<div class="rtip-cost-lbl">Cost</div>`+
    `<div class="rtip-cost">${cost||'<span class="rtip-free">Free</span>'}</div>`+
    (ready?`<div class="rtip-ready">✓ Ready to buy</div>`:"");
  t.hidden=false;
  const r=el.getBoundingClientRect(), tr=t.getBoundingClientRect();
  let left=r.left+r.width/2-tr.width/2;
  left=Math.max(6, Math.min(left, window.innerWidth-tr.width-6));
  let top=r.top-tr.height-8;
  if(top<6) top=r.bottom+8;
  t.style.left=left+'px'; t.style.top=top+'px';
}

// Delegated hover handling for reserved cards; also hide the tooltip on scroll.
document.addEventListener('mouseover',e=>{ const c=e.target.closest&&e.target.closest('.rcard[data-color]'); if(c) showRtip(c); });
document.addEventListener('mouseout',e=>{ const c=e.target.closest&&e.target.closest('.rcard[data-color]'); if(c) hideRtip(); });
window.addEventListener('scroll', hideRtip, true);

// Animate a single gem flying from `from` to `to`, then remove it.
function flyGem(color, from, to, delay=0){
  if(REDUCE||!from||!to) return; const L=fxLayer(); if(!L) return;
  const a=centerOf(from), b=centerOf(to);
  const g=document.createElement('div');
  g.className='fly-gem g-'+color;
  g.style.left=(a.x-13)+'px'; g.style.top=(a.y-13)+'px'; g.style.transitionDelay=delay+'ms';
  L.appendChild(g);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    g.style.transform=`translate(${b.x-a.x}px, ${b.y-a.y}px) scale(.45)`; g.style.opacity='0.15';
  }));
  setTimeout(()=>g.remove(), 750+delay);
}

// Fly a clone of a bought/reserved card into the owning player's chip, then pop
// a ring on arrival. Menus and selection classes are stripped from the ghost.
function flyCard(fromEl, toIndex, delay=0){
  if(REDUCE||!fromEl) return; const L=fxLayer(); if(!L) return;
  const toEl=elPlayer(toIndex); if(!toEl) return;
  const r=fromEl.getBoundingClientRect(); if(!r.width) return;
  const b=centerOf(toEl);
  const ghost=fromEl.cloneNode(true);
  ghost.querySelectorAll('.menu').forEach(n=>n.remove());
  ghost.classList.remove('sel','afford','card-enter');
  ghost.classList.add('fly-card');
  Object.assign(ghost.style,{left:r.left+'px', top:r.top+'px', width:r.width+'px', height:r.height+'px', transitionDelay:delay+'ms'});
  L.appendChild(ghost);
  const dx=b.x-(r.left+r.width/2), dy=b.y-(r.top+r.height/2);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    ghost.style.transform=`translate(${dx}px, ${dy}px) scale(.16) rotate(-6deg)`;
    ghost.style.opacity='0';
  }));
  setTimeout(()=>{ ghost.remove(); const t=elPlayer(toIndex); if(t) ringPop(t); }, 560+delay);
}

// Float a short text label (e.g. "+2 prestige") upward from an element, fading out.
function floatText(text, atEl, delay=0){
  if(REDUCE||!atEl) return; const L=fxLayer(); if(!L) return;
  const c=centerOf(atEl);
  const t=document.createElement('div');
  t.className='float-txt'; t.textContent=text;
  t.style.left=c.x+'px'; t.style.top=c.y+'px'; t.style.transform='translate(-50%,-50%)'; t.style.transitionDelay=delay+'ms';
  L.appendChild(t);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ t.style.transform='translate(-50%,-165%)'; t.style.opacity='0'; }));
  setTimeout(()=>t.remove(), 1150+delay);
}

// Expanding ring pulse centred on an element.
function ringPop(atEl){
  if(REDUCE||!atEl) return; const L=fxLayer(); if(!L) return;
  const c=centerOf(atEl);
  const r=document.createElement('div');
  r.className='fx-ring';
  r.style.left=(c.x-20)+'px'; r.style.top=(c.y-20)+'px'; r.style.opacity='0.9';
  L.appendChild(r);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ r.style.transform='scale(2.6)'; r.style.opacity='0'; }));
  setTimeout(()=>r.remove(), 760);
}

// Fly each taken gem from its bank pile to the player, staggered.
function animateTake(plan, playerIndex){
  if(REDUCE) return; const to=elPlayer(playerIndex); if(!to) return;
  let d=0;
  Object.keys(plan).forEach(k=>{
    const from=elBank(k); if(!from) return;
    for(let n=0;n<plan[k];n++){ flyGem(k, from, to, d); d+=90; }
  });
}

// Celebrate a patron visit on a player chip (ring + floating label).
function patronFlourish(playerIndex){ const el=elPlayer(playerIndex); ringPop(el); floatText('Patron +3', el); }

// Center-screen announcement (e.g. "Final Round"): fades/scales in, holds, then
// auto-dismisses. Shown even under reduce-motion since it conveys game state,
// just with the motion trimmed to a plain fade. Click-through (pointer-events
// none) so it never blocks play.
let announceT=null;
function announce(title, sub){
  const old=document.getElementById('splash'); if(old) old.remove();
  clearTimeout(announceT);
  const s=document.createElement('div');
  s.id='splash'; s.className='splash';
  s.innerHTML=`<div class="splash-card">
    <div class="splash-eyebrow" aria-hidden="true">&#9670;</div>
    <div class="splash-title">${title}</div>
    ${sub?`<div class="splash-sub">${sub}</div>`:''}</div>`;
  document.body.appendChild(s);
  requestAnimationFrame(()=>s.classList.add('show'));
  announceT=setTimeout(()=>{ s.classList.remove('show'); setTimeout(()=>s.remove(),420); }, 2600);
}

// Confetti burst for a human win.
function celebrate(){
  if(REDUCE) return; const L=fxLayer(); if(!L) return;
  const cols=['white','blue','green','red','black','gold'];
  for(let i=0;i<40;i++){
    const c=document.createElement('div');
    c.className='confetti g-'+cols[i%cols.length];
    c.style.left=Math.random()*100+'vw';
    c.style.setProperty('--spin',(Math.random()*720-360)+'deg');
    const dur=2.2+Math.random()*1.8;
    c.style.animation=`conffall ${dur}s ${Math.random()*0.6}s ease-in forwards`;
    L.appendChild(c);
    setTimeout(()=>c.remove(), (dur+1)*1000);
  }
}
