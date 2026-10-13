export const ROUND_TYPES = ['sprint','door','puzzle','connect'];
export const DURATIONS = [120,90,90,90];
export const normalize = value => String(value).normalize('NFKC').toLocaleLowerCase('nl').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").replace(/[-–—]/g,' ').replace(/[.,!?;:]/g,'').replace(/\s+/g,' ').trim();
export function shuffle(items,rng=Math.random) { const a=[...items]; for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a; }
const inputForm=value=>normalize(value).replace(/^(?:ik denk (?:vooral )?aan|denk (?:ook )?aan|bijvoorbeeld|zoals)\s+/,'').replace(/^(?:de|het|een)\s+/,'');
const compact=value=>value.replace(/\s/g,'');
function spellingDistance(a,b){
  const shortest=Math.min(a.length,b.length),limit=shortest>=10?2:shortest>=4?1:0;
  if(!limit||Math.abs(a.length-b.length)>limit)return Infinity;
  // Wait for a typing pause before accepting a nearly complete word.
  // A short initial fragment remains a fragment, even when unique.
  if((a.startsWith(b)||b.startsWith(a))&&(shortest<5||Math.abs(a.length-b.length)>1))return Infinity;
  const rows=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
  for(let i=0;i<=a.length;i++)rows[i][0]=i;for(let j=0;j<=b.length;j++)rows[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
    rows[i][j]=Math.min(rows[i-1][j]+1,rows[i][j-1]+1,rows[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
    if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])rows[i][j]=Math.min(rows[i][j],rows[i-2][j-2]+1);
  }
  const distance=rows[a.length][b.length];return distance<=limit?distance:Infinity;
}
export function matchAnswer(text,answers,found=[],allowSameAnswerPrefix=false,allowTypos=false) {
  const value=inputForm(text),joined=compact(value); if(!value)return {kind:'none'};
  let candidates=answers.filter(a=>a.aliases.some(v=>inputForm(v)===value));
  if(!candidates.length&&joined.length>=5)candidates=answers.filter(a=>a.aliases.some(v=>compact(inputForm(v))===joined));
  if(!candidates.length&&allowTypos){const scores=answers.map(a=>({answer:a,distance:Math.min(...a.aliases.map(v=>spellingDistance(joined,compact(inputForm(v)))))}));const best=Math.min(...scores.map(s=>s.distance));if(Number.isFinite(best))candidates=scores.filter(s=>s.distance===best).map(s=>s.answer);}
  if(candidates.length!==1)return {kind:candidates.length?'ambiguous':'none'};
  const a=candidates[0];
  if(!allowSameAnswerPrefix&&answers.some(other=>other.aliases.some(v=>compact(inputForm(v)).startsWith(joined)&&compact(inputForm(v))!==joined)))return {kind:'prefix',answer:a};
  return {kind:found.includes(a.id)?'duplicate':'correct',answer:a};
}
export function roundPoints(found,total){return Math.round(120*Math.min(found,total)/total);}
function pick(items,recent,rng){const fresh=items.filter(x=>!recent.includes(x.id));if(fresh.length)return shuffle(fresh,rng)[0];const oldest=Math.max(...items.map(x=>recent.indexOf(x.id)));return shuffle(items.filter(x=>recent.indexOf(x.id)===oldest),rng)[0];}
function balanced(items,count,rng){
  const courses=[...new Set(items.map(x=>x.source.course))];let out=[];
  for(const c of courses)out.push(...shuffle(items.filter(x=>x.source.course===c),rng).slice(0,Math.floor(count/courses.length)));
  out.push(...shuffle(items.filter(x=>!out.some(y=>y.id===x.id)),rng).slice(0,count-out.length));return shuffle(out,rng);
}
function connectionPairs(items,count,recent,rng){
 const courses=[...new Set(items.map(x=>x.source.course))],target=Math.floor(count/courses.length);
 const compatible=(p,chosen)=>chosen.every(x=>normalize(x.label)!==normalize(p.label)&&normalize(x.definition)!==normalize(p.definition)&&!x.conflictIds?.includes(p.id)&&!p.conflictIds?.includes(x.id));
 for(let attempt=0;attempt<24;attempt++){
  const ordered=shuffle(items,rng).sort((a,b)=>{const ai=recent.indexOf(a.id),bi=recent.indexOf(b.id);return ai===-1&&bi!==-1?-1:bi===-1&&ai!==-1?1:bi-ai;}),chosen=[];
  for(const course of shuffle(courses,rng))for(const p of ordered.filter(x=>x.source.course===course)){if(chosen.filter(x=>x.source.course===course).length>=target)break;if(compatible(p,chosen))chosen.push(p);}
  for(const p of ordered){if(chosen.length===count)break;if(!chosen.includes(p)&&compatible(p,chosen))chosen.push(p);}
  if(chosen.length===count)return shuffle(chosen,rng);
 }
 throw new Error('Deze bank heeft onvoldoende eenduidige connecties.');
}
export function createGame(bank,week,timed=true,recent=[],rng=Math.random,now=Date.now()) {
  const pool=bank.terms.filter(x=>week===0||x.week===week);
  const quizPool=bank.sprints.filter(x=>week===0||x.week===week);
  const fresh=quizPool.filter(x=>!recent.includes(x.id));
  const questions=balanced(fresh.length>=6?fresh:quizPool,6,rng).map((q,i)=>({...q,
    entry:q.entryMode==='choice'?'choice':i===1||i===4?'input':'choice',options:shuffle([q.answer,...shuffle(q.distractors.filter(x=>normalize(x)!==normalize(q.answer)),rng).slice(0,3)],rng)}));
  const door=pick(bank.doors.filter(x=>week===0||x.week===week),recent,rng);
  const puzzle=pick(bank.puzzles.filter(x=>week===0||x.week===week),recent,rng);
  const pairs=connectionPairs(pool,6,recent,rng);
  const rounds=[{type:'sprint',questions,index:0,results:[],answered:false},
    {type:'door',question:door,found:[]},
    {type:'puzzle',question:puzzle,found:[],selected:[],candidate:null,mistakes:0,
      cards:shuffle(puzzle.groups.flatMap(g=>g.cards.map((text,i)=>({id:g.id+'-c'+i,group:g.id,text}))),rng)},
    {type:'connect',pairs,found:[],left:null,mistakes:0,rightOrder:shuffle(pairs.map(p=>p.id),rng)}]
    .map((r,i)=>({...r,seconds:DURATIONS[i],score:0,deadline:null}));
  return {id:'game-'+now+'-'+Math.floor(rng()*1e9),version:bank.version,week,timed,round:0,status:'intro',rounds,createdAt:now};
}
export function startRound(game,now=Date.now()){
  if(game.status!=='intro')return false;game.status='active';game.rounds[game.round].deadline=game.timed?now+game.rounds[game.round].seconds*1000:null;return true;
}
export function remaining(game,now=Date.now()) {const r=game.rounds[game.round];const at=r.feedbackStartedAt??(now+(game.serverOffset||0));return !game.timed?null:r.deadline==null?r.seconds:Math.max(0,Math.ceil((r.deadline-at)/1000));}
export function finishRound(game){if(game.status!=='active')return false;game.status='review';return true;}
export function expire(game,now=Date.now()){if(game.status==='active'&&game.timed&&remaining(game,now)===0){finishRound(game);return true;}return false;}
export function nextRound(game){if(game.status!=='review')return false;if(game.round===3)game.status='finished';else{game.round++;game.status='intro';}return true;}
export function answerDoor(game,text,now=Date.now(),allowSameAnswerPrefix=false,allowTypos=false){
  if(expire(game,now)||game.status!=='active')return {kind:'closed'};
  const r=game.rounds[game.round];if(r.type!=='door')return {kind:'closed'};
  const match=matchAnswer(text,r.question.answers,r.found,allowSameAnswerPrefix,allowTypos);
  if(match.kind==='correct'){r.found.push(match.answer.id);r.score=roundPoints(r.found.length,r.question.goal);if(r.found.length>=r.question.goal)finishRound(game);}
  return match;
}
export function answerSprint(game,text,now=Date.now()){
  if(expire(game,now)||game.status!=='active')return {kind:'closed'};
  const r=game.rounds[game.round];if(r.type!=='sprint'||r.answered)return {kind:'closed'};
  const q=r.questions[r.index];const correct=q.entry==='choice'?normalize(text)===normalize(q.answer):matchAnswer(text,[{id:q.id,aliases:q.aliases}],[],true,true).kind==='correct';
  r.results.push({id:q.id,correct,given:text});r.answered=true;r.feedbackStartedAt=now;r.score=roundPoints(r.results.filter(x=>x.correct).length,r.questions.length);
  return {kind:correct?'correct':'wrong',answer:q.answer};
}
export function advanceSprint(game,now=Date.now()){const r=game.rounds[game.round];if(game.status!=='active'||r.type!=='sprint'||!r.answered)return false;
  if(game.timed&&r.feedbackStartedAt!=null&&r.deadline!=null)r.deadline+=Math.max(0,now-r.feedbackStartedAt);
  r.feedbackStartedAt=null;
  if(r.index===r.questions.length-1)finishRound(game);else{r.index++;r.answered=false;}return true;}
export function selectCard(game,id,now=Date.now()){
  if(expire(game,now)||game.status!=='active')return {kind:'closed'};
  const r=game.rounds[game.round];if(r.type!=='puzzle'||r.candidate)return {kind:'closed'};
  const card=r.cards.find(x=>x.id===id);if(!card||r.found.includes(card.group))return {kind:'closed'};
  r.selected=r.selected.includes(id)?r.selected.filter(x=>x!==id):[...r.selected,id];
  if(r.selected.length<r.question.groupSize)return {kind:'selected'};
  const groups=new Set(r.selected.map(x=>r.cards.find(y=>y.id===x).group));
  if(groups.size===1){r.candidate=card.group;return {kind:'name'};}
  r.selected=[];r.mistakes++;if(r.mistakes>=3)finishRound(game);return {kind:'wrong'};
}
export function nameGroup(game,id,now=Date.now()){
  if(expire(game,now)||game.status!=='active')return {kind:'closed'};
  const r=game.rounds[game.round];if(r.type!=='puzzle'||!r.candidate)return {kind:'closed'};
  const correct=r.candidate===id;
  if(correct){r.found.push(id);r.score=roundPoints(r.found.length,r.question.groups.length);}else{r.mistakes++;}
  r.candidate=null;r.selected=[];if(r.found.length===r.question.groups.length||r.mistakes>=3)finishRound(game);
  return {kind:correct?'correct':'wrong'};
}
export function connect(game,left,right,now=Date.now()){
  if(expire(game,now)||game.status!=='active')return {kind:'closed'};
  const r=game.rounds[game.round];if(r.type!=='connect'||r.found.includes(left)||!r.pairs.some(x=>x.id===left)||!r.pairs.some(x=>x.id===right)||r.found.includes(right))return {kind:'closed'};
  r.left=null;const correct=left===right;if(correct){r.found.push(left);r.score=roundPoints(r.found.length,r.pairs.length);}else{r.mistakes++;}
  if(r.found.length===r.pairs.length||r.mistakes>=6)finishRound(game);return {kind:correct?'correct':'wrong'};
}
export const totalScore=game=>game.rounds.reduce((s,r)=>s+r.score,0);
export function usedIds(game){return game.rounds.flatMap(r=>r.questions?.map(q=>q.id)||r.pairs?.map(p=>p.id)||[r.question.id]);}
