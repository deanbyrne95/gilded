"use strict";

/* ============================================================================
 * ai.js — computer rival logic. A single greedy turn policy (buy > reserve >
 * take gems > pass) tuned by difficulty, plus the heuristics that score cards
 * and choose which gems to collect toward a target.
 * ==========================================================================*/

/* ---------- AI ---------- */

// Randomized "thinking" pause (~1.2–2.1s) so rivals feel deliberate, not instant.
function aiThinkTime(){ return 1200 + Math.random()*900; }

// Schedule the current AI player's turn after a think delay.
function scheduleAI(){ if(G.over) return; setTimeout(aiTurn, aiThinkTime()); }

// Play one AI turn. Priority order, with difficulty tuning the thresholds and
// randomness: (1) buy the best affordable card, (2) reserve a strong card for a
// gold, (3) take gems toward a target card, (4) fallback reserve, else pass.
function aiTurn(){
  const p=me(); if(!p||!p.isAI||G.over) return;
  const lvl = p.level||"normal";

  // 1) Buy the best affordable card (prefer prestige; sometimes a useful 0-pt bonus).
  const buyables=[];
  G.board[1].concat(G.board[2],G.board[3]).forEach(c=>{ if(c && affordPlan(p,c).ok) buyables.push({c,from:{tier:c.tier}}); });
  p.reserved.forEach((c,i)=>{ if(affordPlan(p,c).ok) buyables.push({c,from:{reserved:i}}); });
  if(buyables.length){
    if(lvl==="easy"){ shuffle(buyables); buyables.sort((a,b)=> (b.c.points>0?1:0)-(a.c.points>0?1:0)); }
    else { buyables.sort((a,b)=> aiCardValue(p,b.c)-aiCardValue(p,a.c)); }
    const best=buyables[0];
    const wantBuy = lvl==="easy" ? best.c.points>0 : (best.c.points>0 || aiWants0pt(p,best.c));
    if(wantBuy){
      const bEl=elCardById(best.c.id);
      const plan=affordPlan(p,best.c);
      buyCard(p,best.c,best.from);
      flyCard(bEl, G.current);
      if(best.c.points) floatText('+'+best.c.points+' prestige', bEl);
      const paid=costText(plan.pay);
      finishTurn(p,`<b>${p.name}</b> buys ${article(NAME[best.c.color])} ${NAME[best.c.color]} card${best.c.points?` (<b>+${best.c.points}</b>)`:""} for ${paid||"free"}.`);
      return;
    }
  }

  // Choose a card to work toward: reachable, best value-per-deficit (hard) or nearest (else).
  const targets=G.board[1].concat(G.board[2],G.board[3]).concat(p.reserved).filter(Boolean)
    .map(c=>({c,d:cardDeficit(p,c),v:aiCardValue(p,c)}))
    .filter(t=>t.d>0);
  if(lvl==="hard") targets.sort((a,b)=> ((b.v/(b.d+1)) - (a.v/(a.d+1))) || (a.d-b.d));
  else targets.sort((a,b)=> (a.d-b.d) || (b.v-a.v));
  const target = targets[0] ? targets[0].c : null;

  // 2) Reserve a strong high-tier card (aggressiveness scales with difficulty).
  const resP = lvl==="hard"?0.85 : lvl==="easy"?0 : 0.5;
  if(resP>0 && p.reserved.length<3 && p.tokens.gold===0){
    const minPts = lvl==="hard"?3:4, maxDef = lvl==="hard"?8:6;
    const strong=G.board[3].concat(G.board[2]).find(c=>c && c.points>=minPts && cardDeficit(p,c)>=3 && cardDeficit(p,c)<=maxDef);
    if(strong && G.bank.gold>0 && Math.random()<resP){
      reserveCard(p,strong,{tier:strong.tier});
      // Reserving grants a gold, which may exceed 10 tokens -> auto-discard.
      aiDiscardIfNeeded(p,target);
      finishTurn(p,`<b>${p.name}</b> reserves ${article(NAME[strong.color])} ${NAME[strong.color]} card (tier ${ROMAN[strong.tier]}) and takes a <b>Gold</b>.`);
      return;
    }
  }

  // 3) Take gems toward the target (easy rivals grab gems less purposefully).
  const plan = (lvl==="easy" && Math.random()<0.6) ? aiRandomGems(p) : aiPickGems(p,target);
  if(Object.keys(plan).length){
    animateTake(plan, G.current);
    takeGems(p,plan);
    aiDiscardIfNeeded(p,target);
    const desc=Object.keys(plan).map(k=>`${plan[k]}× ${NAME[k]}`).join(", ");
    finishTurn(p,`<b>${p.name}</b> takes ${desc}.`);
    return;
  }

  // 4) Fallback: reserve any board card for a gold, otherwise pass.
  if(p.reserved.length<3){
    const any=G.board[1].concat(G.board[2],G.board[3]).filter(Boolean)[0];
    if(any){
      const gotGold=G.bank.gold>0; reserveCard(p,any,{tier:any.tier}); aiDiscardIfNeeded(p,target);
      finishTurn(p,`<b>${p.name}</b> reserves ${article(NAME[any.color])} ${NAME[any.color]} card (tier ${ROMAN[any.tier]})${gotGold?" and takes a <b>Gold</b>":""}.`); return;
    }
  }
  finishTurn(p,`<b>${p.name}</b> passes.`);
}

// Heuristic value of a card: prestige dominates, plus a nudge for bonuses in
// scarce colours and colours that advance patrons, minus a small cost penalty.
function aiCardValue(p,c){
  let v=c.points*10;
  v += (4-Math.min(4,p.bonus[c.color]))*1.4;
  G.nobles.forEach(n=>{ if(n.req[KEYS.indexOf(c.color)]) v+=2; });
  v -= Object.values(c.cost).reduce((a,b)=>a+b,0)*0.15;
  return v;
}

// Whether a 0-prestige card is worth buying for its bonus (helps a patron we're
// chasing, or fills out an early/thin engine); skip once we already hold plenty.
function aiWants0pt(p,c){
  if(p.bonus[c.color]>=3) return false;
  const noble = G.nobles.some(n=>n.req[KEYS.indexOf(c.color)]);
  return noble || p.cards.length<3 || cardDeficit(p,c)===0 && p.cards.length<6;
}

// Grab up to 3 different available colours at random (undirected take).
function aiRandomGems(p){
  const plan={}; let taken=0;
  for(const k of shuffle(KEYS.filter(k=>G.bank[k]>0))){ if(taken>=3) break; plan[k]=1; taken++; }
  return plan;
}

// Choose gems that reduce the deficit toward `target`: take two-of-a-kind for a
// single large need (pile >=4), else spread across the biggest needs, topping
// up with any available colours to reach three.
function aiPickGems(p,target){
  const plan={}; let taken=0;
  const bankColors=KEYS.filter(k=>G.bank[k]>0);
  if(!bankColors.length) return plan;

  // Per-colour deficits toward the target (empty when there is no target).
  let order;
  if(target){
    order = KEYS.map(k=>({k,d:Math.max(0,(target.cost[k]||0)-p.bonus[k]-p.tokens[k])}))
               .filter(x=>x.d>0 && G.bank[x.k]>0).sort((a,b)=>b.d-a.d);
  } else order=[];

  // Two-of-a-kind when a single colour is the only strong need and its pile allows it.
  if(order.length && order[0].d>=2 && G.bank[order[0].k]>=4 && order.length===1){
    plan[order[0].k]=2; return plan;
  }
  for(const x of order){ if(taken>=3) break; plan[x.k]=1; taken++; }

  // Fill remaining picks with any available colours to reach three.
  if(taken<3){
    for(const k of shuffle(bankColors)){ if(taken>=3) break; if(!plan[k]){ plan[k]=1; taken++; } }
  }
  return plan;
}

// Auto-discard down to the 10-token cap, shedding the colour held most (gold last).
function aiDiscardIfNeeded(p){
  while(totalTokens(p)>10){
    let drop=null,mx=-1;
    for(const k of KEYS){ if(p.tokens[k]>mx){mx=p.tokens[k];drop=k;} }
    if(mx<=0) drop="gold";
    p.tokens[drop]--; G.bank[drop]++;
  }
}
