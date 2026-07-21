"use strict";

/* ============================================================================
 * game.js — core rules engine: state helpers, payment logic, the four legal
 * actions (take gems, buy, reserve, award noble), and turn/round progression.
 * Pure model mutations here; rendering and input live in other modules.
 * ==========================================================================*/

/* ---------- helpers ---------- */

// The player whose turn it currently is.
const me = ()=>G.players[G.current];
// Seat index of the local (non-AI) player to render "you" controls for; 0 as a safe default.
const localSeat = ()=> (G && G.players[G.current] && !G.players[G.current].isAI) ? G.current : 0;
// Whether the local player may act right now (their turn, game live, play/discard phase).
const isMyTurn = ()=> !G.over && !me().isAI && (UI.phase==="play" || UI.phase==="discard");
// Total tokens a player holds (all six colours).
function totalTokens(p){ return ALL.reduce((s,k)=>s+p.tokens[k],0); }
// Count of gems currently selected in the take tray.
function selCount(){ return Object.values(UI.sel).reduce((a,b)=>a+b,0); }

// Compute how player `p` would pay for `card`: spend matching tokens after
// colour bonuses, covering any shortfall with gold. Returns {ok, pay:{...}}.
function affordPlan(p,card){
  const pay={white:0,blue:0,green:0,red:0,black:0,gold:0};
  let goldNeed=0;
  for(const k of KEYS){
    const need=Math.max(0,(card.cost[k]||0)-p.bonus[k]);
    const use=Math.min(need,p.tokens[k]);
    pay[k]=use;
    goldNeed += need-use;
  }
  if(goldNeed<=p.tokens.gold){ pay.gold=goldNeed; return {ok:true,pay}; }
  return {ok:false};
}

// Number of gems still to acquire for `card` after bonuses, tokens and gold —
// i.e. how far the player is from affording it (0 means affordable now).
function cardDeficit(p,card){
  let missing=0;
  for(const k of KEYS) missing+=Math.max(0,(card.cost[k]||0)-p.bonus[k]-p.tokens[k]);
  return Math.max(0,missing-p.tokens.gold);
}

/* ---------- actions ---------- */

// Move a set of tokens ({colour:count}) from the bank to the player.
function takeGems(p,plan){
  for(const k in plan){ p.tokens[k]+=plan[k]; G.bank[k]-=plan[k]; }
}

// Buy `card` (from the board `{tier}` or from reserve `{reserved:idx}`): pay
// tokens back to the bank, grant the bonus/prestige, and refill the board slot.
function buyCard(p,card,from){
  const plan=affordPlan(p,card); if(!plan.ok) return false;
  for(const k of ALL){ if(plan.pay[k]){ p.tokens[k]-=plan.pay[k]; G.bank[k]+=plan.pay[k]; } }
  p.bonus[card.color]++; p.points+=card.points; p.cards.push(card);
  if(from.reserved!=null){
    p.reserved.splice(from.reserved,1);
  } else {
    const arr=G.board[card.tier]; const i=arr.indexOf(card); arr[i]=G.decks[card.tier].pop()||null;
  }
  return true;
}

// Reserve a card (from a face-up board slot or blindly from a `{deck}`) and
// take one gold if any remains. Caps the hold at 3 reserved cards.
function reserveCard(p,card,from){
  if(p.reserved.length>=3) return false;
  if(from.deck){
    const c=G.decks[from.deck].pop(); if(!c) return false;
    c.blind=true; p.reserved.push(c); card=c;
  } else {
    const arr=G.board[card.tier]; const i=arr.indexOf(card);
    card.blind=false; p.reserved.push(card); arr[i]=G.decks[card.tier].pop()||null;
  }
  if(G.bank.gold>0){ G.bank.gold--; p.tokens.gold++; }
  return true;
}

// Patrons whose colour-bonus requirements the player currently satisfies.
function qualifyingNobles(p){
  return G.nobles.filter(n=>Object.entries(n.req).every(([ci,req])=>p.bonus[KEYS[ci]]>=req));
}

// Give patron `n` to player `p` (removes it from the pool, adds its prestige).
function awardNoble(p,n){ const i=G.nobles.indexOf(n); if(i>=0)G.nobles.splice(i,1); p.nobles.push(n); p.points+=n.points; }

/* ---------- turn flow ---------- */

// Conclude the acting player's turn: log the action, resolve any patron visit
// (auto for AI or a single option; prompt a human choosing between two), flag
// the final round when someone reaches WIN, then advance.
function finishTurn(p, actionText){
  log(actionText);
  const q=qualifyingNobles(p);
  const proceed=()=>{
    // Token cap is enforced before this point (AI auto-discards; humans via UI).
    if(p.points>=WIN) G.finalRound=true;
    advance();
  };
  if(q.length===0){ proceed(); return; }
  if(q.length===1 || p.isAI){
    awardNoble(p,q[0]); patronFlourish(G.players.indexOf(p));
    log(`<b>${p.name}</b> is visited by a patron. <b>+3</b> prestige.`); proceed(); return;
  }
  // Human with multiple eligible patrons: let them pick one.
  chooseNoble(q,(n)=>{
    awardNoble(p,n); patronFlourish(G.players.indexOf(p));
    log(`<b>You</b> welcome a patron. <b>+3</b> prestige.`); proceed();
  });
}

// Hand the turn to the next player. A round completes when play wraps back to
// the starter (bump the round counter, autosave); end the game if the final
// round just closed, otherwise re-render and kick off the next AI turn.
function advance(){
  UI.selectedCard=null; UI.sel={};
  const starter = G.starter||0;
  G.current=(G.current+1)%G.players.length;
  const roundDone = (G.current===starter);
  if(roundDone) G.turn++;
  // The game ends once the round in which someone hit WIN returns to the starter.
  if(G.finalRound && roundDone){ endGame(); return; }
  render();
  if(roundDone) autoSave();
  if(!G.over && me().isAI){ scheduleAI(); }
}

// Finish the match: pick the winner (most prestige, ties broken by fewer cards),
// log the closing summary, autosave, and show the winner modal.
function endGame(){
  G.over=true;
  let best=null;
  G.players.forEach(p=>{
    if(!best) best=p;
    else if(p.points>best.points) best=p;
    else if(p.points===best.points && p.cards.length<best.cards.length) best=p;
  });
  const rounds=G.turn||1;
  const verdict = best.name==="You" ? `<b>You win</b>` : `<b>${best.name}</b> wins`;
  log(`<span class="fin">&#9670; The books are closed after ${rounds} round${rounds===1?"":"s"}.</span>`, rounds);
  log(`<span class="fin">${verdict} with <b>${best.points}</b> prestige across <b>${best.cards.length}</b> card${best.cards.length===1?"":"s"}.</span>`, rounds);
  render();
  autoSave();
  showWinner(best);
}
