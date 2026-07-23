"use strict";

/* ============================================================================
 * tutorial.js — an interactive, guided "learn by playing" tutorial. It starts a
 * solo, hand-set game (mode "tutorial", see startGame) and walks the player
 * through the core loop with a spotlight overlay + coaching card: take gems, buy
 * a card, reserve a card, and understand patrons. Steps that teach an action gate
 * on the player really doing it (the game calls tutorNotify() from its action
 * handlers); informational steps advance with a button.
 *
 * The overlay is purely visual (pointer-events:none), so the real board stays
 * fully interactive — the tutorial never traps input, it just highlights and
 * waits for the right move.
 * ==========================================================================*/

const Tutor = (function(){
  let active=false, idx=0, steps=[];

  // ---- DOM ------------------------------------------------------------------
  function layer(){ return document.getElementById("tutorLayer"); }
  function spot(){ return document.getElementById("tutorSpot"); }
  function cardEl(){ return document.getElementById("tutorCard"); }

  // The element(s) a step points at (recomputed live, since render() rebuilds
  // DOM). A step's target() may return one element or an array; we keep only the
  // ones that are actually visible (so e.g. the Take controls, which appear only
  // after gems are selected, join the spotlight once they exist).
  function targetEls(step){
    if(!step || !step.target) return [];
    let out; try{ out=step.target(); }catch(e){ return []; }
    if(!out) return [];
    const arr=Array.isArray(out)?out:[out];
    return arr.filter(el=>{
      if(!el) return false;
      const r=el.getBoundingClientRect();
      return r.width>0 && r.height>0;
    });
  }

  // ---- step sequence --------------------------------------------------------
  // Each step: { text, target?(), await?, cta?, onEnter?() }
  //  - target : returns the element to spotlight (omit for a centered card)
  //  - await  : action kind that advances the step ('take'|'buy'|'reserve');
  //             when set, the card shows a hint instead of a Next button
  //  - cta    : label for the advance button on non-gated steps
  function build(){
    return [
      {
        text:`<h3>Welcome to Gilded</h3><p>You're a Renaissance gem merchant. Collect gems, buy development cards for prestige and permanent discounts, and attract patrons. Let's learn by playing — just follow the prompts.</p>`,
        cta:"Begin",
      },
      {
        text:`<h3>The Bank</h3><p>These are the gem piles. On your turn you may <b>take gems</b>. Take <b>3 gems of different colours</b>: tap three piles, then press <b>Take</b>.</p>`,
        target:()=>[document.getElementById("gemHud"), document.getElementById("hudControls")],
        await:"take",
      },
      {
        text:`<h3>Your holdings</h3><p>Here's your player board. Your gems show along the middle; cards, patrons and prestige (VP) gather here as you play.</p>`,
        target:()=>document.querySelector('#players .pchip[data-pi="0"]'),
        cta:"Next",
      },
      {
        text:`<h3>Buy a card</h3><p>Development cards cost gems (shown at their foot) and give <b>prestige</b> plus a permanent colour <b>bonus</b>. The glowing card is affordable — tap it, then press <b>Buy</b>.</p>`,
        target:()=>{ const id=G&&G._tutCardId; return id!=null ? document.querySelector(`.card[data-cid="${id}"]`) : null; },
        await:"buy",
        skipIf:()=> me().cards.length>0,   // already bought one? lesson learned
      },
      {
        text:`<h3>Cards are discounts</h3><p>Nicely done — that card now sits in your holdings. Its colour is a permanent discount: every future purchase costs one less of that colour. Stack bonuses and pricey cards become cheap.</p>`,
        target:()=>document.querySelector('#players .pchip[data-pi="0"] .pc-cards'),
        cta:"Next",
      },
      {
        text:`<h3>Reserve a card</h3><p>Can't afford a card yet? <b>Reserve</b> it to claim it later and take a wild <b>gold</b> token. Tap any card and choose <b>Hold</b>, or tap a deck's <b>Hold</b>. Try reserving one now.</p>`,
        target:()=>document.getElementById("tiers"),
        await:"reserve",
        skipIf:()=> me().reserved.length>0,   // already reserved? lesson learned
      },
      {
        text:`<h3>Patrons</h3><p>These tiles are patrons, each worth <b>3 prestige</b>. When your <b>card bonuses</b> (not your gems) meet a patron's colour requirement, they visit you automatically — no action needed.</p>`,
        target:()=>document.getElementById("nobles"),
        cta:"Next",
      },
      {
        text:`<h3>That's the loop!</h3><p>Take gems → buy cards → earn bonuses and patrons → be first to the prestige target. You're ready to play a real game. Good luck, merchant.</p>`,
        cta:"Start playing",
        onEnter:()=>{},
      },
    ];
  }

  // ---- lifecycle ------------------------------------------------------------
  function begin(){
    steps=build(); idx=0; active=true;
    const l=layer(); if(l) l.hidden=false;
    document.body.classList.add("tutoring");
    show();
  }

  function end(goMenu){
    active=false; steps=[]; idx=0;
    const l=layer(); if(l) l.hidden=true;
    document.body.classList.remove("tutoring");
    if(G) G.tutorial=false;
    if(goMenu && typeof openMainMenu==="function") openMainMenu();
  }

  function next(){
    if(idx>=steps.length-1){ finish(); return; }
    idx++; show();
  }

  function finish(){
    // Leave the practice board and drop the player straight into New Game setup,
    // so "Start playing" actually starts a real game.
    end(false);
    if(typeof openMainMenu==="function") openMainMenu();
    if(typeof openNewGame==="function") openNewGame();
  }

  // Called by the game's action handlers (guarded there by G.tutorial). If the
  // current step is waiting for this action kind, advance.
  function notify(kind){
    if(!active) return;
    const step=steps[idx];
    if(step && step.await===kind){
      // Let the post-action render settle, then advance and reposition.
      requestAnimationFrame(()=>{ if(active) next(); });
    }
  }

  // ---- rendering ------------------------------------------------------------
  function show(){
    if(!active) return;
    const step=steps[idx]; if(!step) return;
    // If the player already did this step's action ahead of the prompt, skip it.
    if(step.skipIf){ let done=false; try{ done=!!step.skipIf(); }catch(e){} if(done){ next(); return; } }
    if(step.onEnter) try{ step.onEnter(); }catch(e){}
    const c=cardEl(); if(!c) return;
    const gated = !!step.await;
    const btn = gated
      ? `<div class="tutor-wait"><span class="tutor-dot"></span> Waiting for your move…</div>`
      : `<button class="gbtn tutor-next" data-action="tutor-next">${step.cta||"Next"}</button>`;
    c.innerHTML =
      `<div class="tutor-progress">Step ${idx+1} of ${steps.length}</div>`+
      `<div class="tutor-text">${step.text}</div>`+
      `<div class="tutor-foot">`+
        `<button class="tutor-skip" data-action="tutor-skip">Skip tutorial</button>`+
        btn+
      `</div>`;
    reposition();
  }

  // Place the spotlight over the current target (if any) and the coaching card
  // clear of it. Called after every render, resize and scroll while active.
  function reposition(){
    if(!active) return;
    const step=steps[idx]; if(!step) return;
    const s=spot(), c=cardEl(), l=layer(); if(!s||!c) return;
    const els=targetEls(step);
    const vh=window.innerHeight;
    if(els.length){
      // Union bounding box over every visible target element, so a spotlight can
      // span e.g. the bank AND the Take controls beside it.
      let top=Infinity, left=Infinity, right=-Infinity, bottom=-Infinity;
      els.forEach(el=>{ const r=el.getBoundingClientRect();
        top=Math.min(top,r.top); left=Math.min(left,r.left);
        right=Math.max(right,r.right); bottom=Math.max(bottom,r.bottom); });
      const pad=8;
      if(l) l.classList.remove("solid");
      s.style.display="block";
      s.style.top=(top-pad)+"px";
      s.style.left=(left-pad)+"px";
      s.style.width=(right-left+pad*2)+"px";
      s.style.height=(bottom-top+pad*2)+"px";
      // Put the card on whichever side has more room (above or below the target).
      const below = vh - bottom, above = top;
      c.classList.remove("at-top","at-bottom");
      if(below>=above){ c.classList.add("at-bottom"); }
      else { c.classList.add("at-top"); }
    } else {
      // No target: dim the whole screen via the layer and centre the card.
      s.style.display="none";
      if(l) l.classList.add("solid");
      c.classList.remove("at-top","at-bottom");
    }
  }

  return { begin, end, next, notify, reposition, isActive:()=>active };
})();

// ---- global glue -----------------------------------------------------------
// Kick off the tutorial: leave any menu, start the solo coached game, then run.
function startTutorial(){
  if(typeof landing!=="undefined") landing=false;
  if(typeof ngForce!=="undefined") ngForce=false;
  document.body.classList.remove("pre-game");
  if(typeof closeModal==="function") closeModal();
  startGame({mode:"tutorial"});
  Tutor.begin();
}
// The game's action handlers call this after a successful move (guarded by
// G.tutorial), so action-gated steps can advance.
function tutorNotify(kind){ try{ if(typeof Tutor!=="undefined") Tutor.notify(kind); }catch(e){} }
// render()/resize/scroll call this so the spotlight tracks the live DOM.
function tutorReposition(){ try{ if(typeof Tutor!=="undefined") Tutor.reposition(); }catch(e){} }
function tutorActive(){ try{ return typeof Tutor!=="undefined" && Tutor.isActive(); }catch(e){ return false; } }
