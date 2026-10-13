const BASE=/^(localhost|127\.0\.0\.1)$/.test(location.hostname)?location.origin:'https://cirkelstrijd-minor-ce.fb12.chatgpt.site';
const KEY='shift-duels-v1';
function read(s,f){try{return JSON.parse(localStorage.getItem(KEY+s))??f;}catch{return f;}}
function write(s,v){try{localStorage.setItem(KEY+s,JSON.stringify(v));}catch{throw Error('Je browser kan geen spelgegevens bewaren. Controleer of opslag voor SHIFT is toegestaan.');}}
function token(){let value=read('-player',null);if(!value){value=[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');write('-player',value);}return value;}
export function inviteUrl(id){const url=new URL('./',location.href);url.searchParams.set('duel',id);return url.href;}
function remember(data){const records=read('-list',[]).filter(x=>x.id!==data.id);records.unshift({id:data.id,week:data.week,players:data.players,status:data.status,turn:data.turn,who:data.who,winner:data.winner,expiresAt:data.expiresAt});write('-list',records.slice(0,30));return data;}
async function request(path,body,auth=token()){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);let response,data;
 try{
  try{response=await fetch(BASE+'/api'+path,{method:body?'POST':'GET',headers:{'Authorization':'Bearer '+auth,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:controller.signal});}catch{throw Error('Geen verbinding. Je antwoord blijft bewaard; probeer opnieuw zodra je online bent.');}
  try{data=await response.json();}catch{throw Error('De duelserver antwoordt niet. Je antwoord blijft bewaard; probeer het opnieuw.');}
 }finally{clearTimeout(timeout);}
 if(!response.ok){const e=Error(data.error||'Deze actie lukte niet.');e.status=response.status;e.data=data;throw e;}
 if(data.game){data.game.duelId=data.id;data.game.duelRevision=data.playerRevision;data.game.serverOffset=data.serverNow-Date.now();}
 if(data.action?.viewGame){data.action.viewGame.duelId=data.id;data.action.viewGame.duelRevision=data.playerRevision;data.action.viewGame.serverOffset=data.serverNow-Date.now();}
 return data.id?remember(data):data;
}
export const duels={
 async sync(){const data=await request('/my-duels');write('-list',data.duels);return data.duels;},profile:()=>request('/profile'),leaderboard:()=>request('/leaderboard'),
 async saveProfile(name){const data=await request('/profile',{name});write('-name',data.profile.name);return data;},
 backup:()=>token(),async restore(code){if(read('-pending',null))throw Error('Sla eerst je openstaande duelantwoord op voordat je een andere speler gebruikt.');if(!/^[a-f0-9]{64}$/.test(code))throw Error('Deze herstelcode klopt niet.');const data=await request('/profile',undefined,code);if(!data.profile)throw Error('Er is geen spelersprofiel bij deze herstelcode.');write('-player',code);write('-list',[]);write('-creating',null);write('-name',data.profile.name);const g=JSON.parse(localStorage.getItem('cirkelstrijd-v1-game')||'null');if(g?.duelId)localStorage.removeItem('cirkelstrijd-v1-game');},
 list:()=>read('-list',[]),name:()=>read('-name',''),pending:()=>read('-pending',null),
 async create(name,week,version){write('-name',name);let item=read('-creating',null);if(!item||item.name!==name||item.week!==week||item.version!==version){item={name,week,version,nonce:crypto.randomUUID()};write('-creating',item);}const data=await request('/duels',item);write('-creating',null);return data;},
 async join(id,name){write('-name',name);return request('/duels/'+id+'/join',{name});},
 state:id=>request('/duels/'+id),
 async action(id,revision,round,action){if(this.pending())throw Error('Een eerder antwoord wacht nog op opslag. Kies Opnieuw proberen om dat eerst veilig te bewaren.');const item={duel:id,body:{id:crypto.randomUUID(),revision,round,...action}};write('-pending',item);return this.retry();},
 async retry(){const item=read('-pending',null);if(!item)throw Error('Er staat geen actie klaar.');try{const result=await request('/duels/'+item.duel+'/action',item.body);write('-pending',null);return result;}catch(e){if(e.status&&e.status<500)write('-pending',null);throw e;}}
};
