"use strict";

/* ============================================================================
 * interactions.js — human input handlers. Translate clicks on gems and cards
 * into legal actions, enforce selection rules, run the post-action token
 * discard, and drive turn completion for the local player.
 * ==========================================================================*/

/* ---------- human interactions ---------- */

// Tap a bank pile to build a gem selection. Enforces Splendor's take rules:
// up to 3 distinct colours, or 2 of one colour only when that pile has >=4.
// Re-tapping cycles single -> double -> cleared.
function onTakeGem(color){
  if(!humanControls()||color==="gold") return;
  const hadCard = UI.selectedCard!=null; UI.selectedCard=null;
  const cur=UI.sel[color]||0;
  const distinct=Object.keys(UI.sel).filter(k=>UI.sel[k]>0);
  const onlyThis = distinct.length===0 || (distinct.length===1 && distinct[0]===color);

  if(cur===0){
    if(distinct.some(k=>UI.sel[k]===2)) return flash("You're already taking two of one kind.");
    if(distinct.length>=3) return flash("Take at most 3 different gems.");
    if(G.bank[color]<1) return;
    UI.sel[color]=1; sfx("pick",{color});
  } else if(cur===1){
    // Second tap: promote to two-of-a-kind if allowed, otherwise deselect.
    if(onlyThis && G.bank[color]>=4){ UI.sel[color]=2; sfx("pickDouble",{color}); }
    else { delete UI.sel[color]; sfx("deselect",{color}); }
  } else {
    delete UI.sel[color]; sfx("deselect",{color});   // tap a doubled gem to clear it
  }

  if(hadCard){ render(); return; }
  renderBank(); renderTakeTray(); renderPlayers();
  if(typeof tutorReposition==="function") tutorReposition();
}

// Remove one from a selected colour (used by the take-tray minus control).
function onDeselect(color){
  if(!UI.sel[color]) return;
  UI.sel[color]--; if(UI.sel[color]<=0) delete UI.sel[color];
  sfx("deselect",{color});
  renderBank(); renderTakeTray(); renderPlayers();
}

// Commit the current gem selection as this turn's "take gems" action.
function confirmTake(){
  if(!humanControls()) return;
  const total=selCount(); if(total===0) return flash("Select some gems first.");
  const colors=Object.keys(UI.sel).filter(k=>UI.sel[k]>0);
  // A legal take is exactly 3 different colours, or 2 of a single colour — nothing else.
  const isDouble = colors.length===1 && UI.sel[colors[0]]===2;
  const isTriple = colors.length===3 && colors.every(k=>UI.sel[k]===1);
  if(!isDouble && !isTriple) return flash("Take 3 different gems, or 2 of the same colour.");
  const p=me(); const plan={}; colors.forEach(k=>plan[k]=UI.sel[k]);
  animateTake(plan, G.current);
  takeGems(p,plan);
  const desc=colors.map(k=>`${UI.sel[k]}× ${NAME[k]}`).join(", ");
  UI.sel={};
  postAction(p, `<b>You</b> take ${desc}.`);
  tutorNotify("take");
}

// Discard the whole gem selection without acting.
function clearTake(){ UI.sel={}; renderBank(); renderTakeTray(); renderPlayers(); }

// Select/deselect a card (board or reserved). Selecting shows its buy/hold menu
// and clears any pending gem selection; reserved cards reveal the bank HUD.
function onCardClick(loc){
  if(!humanControls()) return;
  UI.selectedCard = sameLoc(UI.selectedCard,loc)?null:loc;
  UI.sel={};
  sfx("cardTap");
  if(UI.selectedCard && UI.selectedCard.reserved!=null) document.body.classList.remove("gems-hidden");
  render();
}

// Buy the selected card if affordable, animate it to the player, and log it.
function doBuy(){
  const loc=UI.selectedCard; if(!loc) return; const p=me();
  const card = loc.reserved!=null ? p.reserved[loc.reserved] : G.board[loc.tier][loc.idx];
  if(!card) return;
  const plan=affordPlan(p,card);
  if(!plan.ok) return flash("You can't afford that yet.");
  const cardEl=elCardById(card.id);
  buyCard(p,card,loc.reserved!=null?{reserved:loc.reserved}:{tier:card.tier});
  flyCard(cardEl, G.current);
  UI.selectedCard=null;
  const paid=costText(plan.pay);
  postAction(p, `<b>You</b> buy ${article(NAME[card.color])} ${NAME[card.color]} card${card.points?` (<b>+${card.points}</b>)`:""} for ${paid||"free"}.`);
  tutorNotify("buy");
}

// Reserve the selected board card (taking a gold if available), then log it.
function doReserve(){
  const loc=UI.selectedCard; if(!loc||loc.reserved!=null) return; const p=me();
  if(p.reserved.length>=3) return flash("You can hold at most 3 reserved cards.");
  const card=G.board[loc.tier][loc.idx];
  const gotGold=G.bank.gold>0;
  const cardEl=elCardById(card.id);
  reserveCard(p,card,{tier:card.tier});
  flyReserve(cardEl, G.current);
  UI.selectedCard=null;
  postAction(p, `<b>You</b> reserve ${article(NAME[card.color])} ${NAME[card.color]} card (tier ${ROMAN[card.tier]})${gotGold?" and take a <b>Gold</b>":""}.`);
  tutorNotify("reserve");
}

// Blindly reserve the top card of a tier's deck (taking a gold if available).
function onDeckReserve(tier){
  if(!humanControls()) return; const p=me();
  if(p.reserved.length>=3) return flash("You can hold at most 3 reserved cards.");
  if(!G.decks[tier].length) return flash("That deck is empty.");
  const gotGold=G.bank.gold>0;
  const deckEl=document.querySelector('.deck[data-tier="'+tier+'"]');
  reserveCard(p,null,{deck:tier});
  const card=p.reserved[p.reserved.length-1];
  flyReserve(deckEl, G.current);
  UI.selectedCard=null;
  postAction(p, `<b>You</b> reserve the top card of tier ${ROMAN[tier]} (${article(NAME[card.color])} ${NAME[card.color]} card)${gotGold?" and take a <b>Gold</b>":""}.`);
  tutorNotify("reserve");
}

// After a human action, enter the discard phase if over the 10-token cap
// (deferring the action text until they're back to 10); otherwise finish.
function postAction(p, text){
  if(totalTokens(p)>10){
    UI.phase="discard";
    render();
    flash(`Return down to 10 tokens — click yours to discard.`);
    UI.pendingText=text;
    return;
  }
  finishTurn(p,text);
}

// Discard one token during the discard phase; once at 10, resume and finish.
function onDiscard(color){
  const p=me();
  if(p.tokens[color]<=0) return;
  p.tokens[color]--; G.bank[color]++;
  if(totalTokens(p)<=10){ UI.phase="play"; const t=UI.pendingText; UI.pendingText=null; finishTurn(p,t); }
  else render();
}

// True when the local player may take a play-phase action.
function humanControls(){ return !G.over && !paused && !me().isAI && UI.phase==="play"; }

// Compare two card locations (board slot / reserved index / deck) for equality.
function sameLoc(a,b){ if(!a||!b)return false; return a.tier===b.tier&&a.idx===b.idx&&a.reserved===b.reserved&&a.deck===b.deck; }
