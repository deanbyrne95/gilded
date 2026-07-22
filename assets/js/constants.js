"use strict";

/* ============================================================================
 * constants.js — static game data, deck/noble generation, and game bootstrap.
 * Defines the gem palette, card cost patterns, noble requirements, the mutable
 * game state (`G`, `UI`), and `startGame`, which assembles a fresh match.
 * ==========================================================================*/

/* ---------- constants & data ---------- */

// The five payable gem colours (token/bonus keys), in fixed index order 0..4.
const KEYS = ["white","blue","green","red","black"];
// All six token colours, including the "gold" wild.
const ALL  = ["white","blue","green","red","black","gold"];
// Display names for each colour.
const NAME = {white:"Diamond",blue:"Sapphire",green:"Emerald",red:"Ruby",black:"Onyx",gold:"Gold"};

// Correct indefinite article ("a"/"an") for a noun, based on its first letter.
const article = s => /^[aeiou]/i.test(s||"") ? "an" : "a";

// Prestige target to win; overridden by settings in applySettings().
let WIN = 15;

// Single-letter gem glyphs and Roman tier numerals, used in labels.
const GLET = {white:"D",blue:"S",green:"E",red:"R",black:"O",gold:"G"};
const ROMAN = {1:"I",2:"II",3:"III"};

// Render a payment map ({colour:count}) as a human-readable "2 Ruby, 1 Onyx" string.
function costText(pay){
  return ALL.filter(k=>pay[k]).map(k=>`<b>${pay[k]}</b> ${NAME[k]}`).join(", ");
}

// Cost patterns per tier. `p` is the card's prestige; index 0 of `c` is the
// card's OWN colour, and the remaining entries rotate through the other colours.
const PAT = {
  1:[ {p:0,c:[0,1,1,1,1]},{p:0,c:[0,2,0,2,0]},{p:0,c:[0,0,3,0,0]},{p:0,c:[0,2,2,0,1]},
      {p:0,c:[0,0,1,2,2]},{p:0,c:[3,1,0,0,1]},{p:0,c:[0,0,2,1,0]},{p:1,c:[0,4,0,0,0]} ],
  2:[ {p:1,c:[0,0,3,2,2]},{p:1,c:[0,3,0,3,0]},{p:2,c:[0,0,0,5,0]},
      {p:2,c:[5,3,0,0,0]},{p:3,c:[6,0,0,0,0]},{p:1,c:[0,2,2,3,0]} ],
  3:[ {p:3,c:[0,3,3,5,3]},{p:4,c:[0,0,0,7,3]},{p:4,c:[0,6,3,3,0]},{p:5,c:[0,0,0,7,0]} ],
};

// Patron (noble) requirements: each entry maps colour-index -> required bonus count.
const NOBLE_REQS = [
  {0:4,1:4},{1:4,2:4},{2:4,3:4},{3:4,4:4},{4:4,0:4},
  {0:3,1:3,2:3},{1:3,2:3,3:3},{2:3,3:3,4:3},{3:3,4:3,0:3},{4:3,0:3,1:3},
];

// Monotonic id source for cards.
let ID = 0;

// Build and shuffle a full deck for one tier by expanding each cost pattern
// across all five colours (rotating the pattern to each colour's own index).
function buildDeck(tier){
  const out=[];
  PAT[tier].forEach(pat=>{
    KEYS.forEach((color,ci)=>{
      const cost={};
      pat.c.forEach((amt,i)=>{
        if(amt>0){ const k=KEYS[(ci+i)%5]; cost[k]=(cost[k]||0)+amt; }
      });
      out.push({id:++ID, tier, color, points:pat.p, cost});
    });
  });
  return shuffle(out);
}

// Draw `n` random patrons for this match.
function buildNobles(n){
  const pool = shuffle(NOBLE_REQS.map((r,i)=>({id:"N"+i, points:3, req:r})));
  return pool.slice(0,n);
}

// Fisher–Yates shuffle returning a new array (does not mutate the input).
function shuffle(a){
  a=a.slice();
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

/* ---------- game state ---------- */

// `G` holds the whole match; `UI` holds transient interaction state. Both are
// reassigned by startGame()/loadSession() rather than mutated wholesale.
let G = null;
let UI = { sel:{}, selectedCard:null, phase:"play", discardResolve:null, oppView:0 };

// Create a blank player record with zeroed tokens and colour bonuses.
function newPlayer(name,isAI){
  return { name, isAI, points:0, cards:[], reserved:[], nobles:[],
    tokens:{white:0,blue:0,green:0,red:0,black:0,gold:0},
    bonus:{white:0,blue:0,green:0,red:0,black:0} };
}

// Rival display names and difficulty labels.
const AI_NAMES=["Aldo","Bianca","Cosimo","Donata"];
const LEVEL_LABEL={easy:"Easy",normal:"Normal",hard:"Hard"};

// Start a fresh match. `opts` selects mode (ai/hotseat), rival count/difficulty
// or human count; `silent` suppresses the opening log lines and AI kickoff
// (used when priming a game behind the start menu). A random player starts.
function startGame(opts, silent){
  if(typeof opts==="number") opts={mode:"ai", opponents:opts};
  opts = opts||{};
  const mode = opts.mode || SETTINGS.mode || "ai";
  let players=[], level=null;

  if(mode==="hotseat"){
    const humans = Math.min(4, Math.max(2, opts.humans || SETTINGS.humans || 2));
    for(let i=0;i<humans;i++) players.push(newPlayer(`Player ${i+1}`, false));
    SETTINGS.humans=humans;
  } else if(mode==="watch"){
    const count = Math.min(4, Math.max(2, opts.players || SETTINGS.watchers || 2));
    level = opts.level || SETTINGS.aiLevel || "normal";
    for(let i=0;i<count;i++){ const ai=newPlayer(AI_NAMES[i], true); ai.level=level; players.push(ai); }
    SETTINGS.watchers=count; SETTINGS.aiLevel=level;
  } else {
    const opponents = Math.min(3, Math.max(1, opts.opponents || SETTINGS.opponents || 1));
    level = opts.level || SETTINGS.aiLevel || "normal";
    players.push(newPlayer("You", false));
    for(let i=0;i<opponents;i++){ const ai=newPlayer(AI_NAMES[i], true); ai.level=level; players.push(ai); }
    SETTINGS.opponents=opponents; SETTINGS.aiLevel=level;
  }
  SETTINGS.mode=mode; saveSettings();

  // Bank size scales with player count; four board cards are dealt per tier.
  const total = players.length;
  const bankPer = total<=2?4 : total===3?5 : 7;
  const bank={white:bankPer,blue:bankPer,green:bankPer,red:bankPer,black:bankPer,gold:5};
  const decks={1:buildDeck(1),2:buildDeck(2),3:buildDeck(3)};
  const board={1:[],2:[],3:[]};
  for(let t=1;t<=3;t++) for(let i=0;i<4;i++) board[t].push(decks[t].pop());

  const starter = Math.floor(Math.random()*total);
  G = { players, current:starter, starter, mode, level, bank, decks, board, nobles:buildNobles(total+1),
        finalRound:false, over:false, turn:0 };
  UI = { sel:{}, selectedCard:null, phase:"play", discardResolve:null, oppView:starter };
  currentSessionId=null;
  paused=false; haltAI();

  if(!silent){
    if(mode==="hotseat") log(`<b>A new game begins.</b> ${total} players, pass-and-play.`);
    else if(mode==="watch") log(`<b>A new game begins.</b> ${total} AI merchants · ${LEVEL_LABEL[level]} rivals. Sit back and watch.`);
    else log(`<b>A new game begins.</b> ${total} merchants · ${LEVEL_LABEL[level]} rivals.`);
    log(`<b>${players[starter].name}</b> ${players[starter].name==="You"?"go":"goes"} first.`);
  }
  render();
  if(!silent && typeof Music!=="undefined") Music.setMode("game");
  if(!silent && !G.over && me().isAI) scheduleAI();
}
