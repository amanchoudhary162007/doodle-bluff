const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const rooms = new Map();
const words = [
  'ink pot','pencil','umbrella','toothbrush','teapot','key','hourglass','kite','crown','treasure chest',
  'ice cream','pizza','popcorn','watermelon','cupcake','taco','banana','sushi','donut','lemon',
  'cat','penguin','giraffe','octopus','turtle','frog','hedgehog','flamingo','unicorn','dinosaur',
  'Spider-Man','Batman','Superman','Wonder Woman','Iron Man','Captain America','Black Panther','The Flash',
  'rocket','rainbow','castle','volcano','spaceship','snowman','lighthouse','windmill','telescope','robot',
  'ghost','pirate','wizard','mermaid','vampire','dragon','cowboy','astronaut','detective','superhero',
  'sunglasses','backpack','roller skate','record player','alarm clock','rubber duck','magic wand','traffic cone'
];
const wordBanks={
  'Mixed bag':words,
  'All categories':words,
  'Everyday objects':['ink pot','pencil','umbrella','toothbrush','teapot','key','hourglass','kite','crown','treasure chest','rocket','castle','volcano','spaceship','snowman','lighthouse','windmill','telescope','robot','sunglasses','backpack','roller skate','record player','alarm clock','rubber duck','magic wand','traffic cone','bicycle','ladder','camera','suitcase','book','scissors','flashlight','candle','globe','hammer','coin','chair','glasses'],
  'Food':['ice cream','pizza','popcorn','watermelon','cupcake','taco','banana','sushi','donut','lemon','cheese','burger','hot dog','carrot','strawberry','coffee','cake','pretzel','grapes','apple','toast','pancakes','chocolate','pineapple','sandwich','cookie','corn','egg','soup','cherries'],
  'Animals':['cat','penguin','giraffe','octopus','turtle','frog','hedgehog','flamingo','unicorn','dinosaur','whale','eagle','fox','bear','owl','shark','butterfly','horse','duck','koala','bee','lion','elephant','kangaroo','snake','rabbit','monkey','parrot','crab','dolphin'],
  'Heroes & fantasy':['Spider-Man','Batman','Superman','Wonder Woman','Iron Man','Captain America','Black Panther','The Flash','ghost','pirate','wizard','mermaid','vampire','dragon','cowboy','astronaut','detective','superhero','knight','fairy','genie','ninja','witch','sorcerer','robot hero','alien'],
  'Places & landmarks':['lighthouse','windmill','castle','volcano','airport','library','aquarium','museum','campsite','island','bridge','pyramid','train station','bakery','treehouse','stadium','space station','waterfall','city park','hot air balloon'],
  'Sports & movement':['tennis racket','skateboard','football','basketball','yo-yo','jump rope','ice skates','surfboard','bowling ball','trophy','goalkeeper','karate','roller coaster','hula hoop','scooter','badminton','climbing wall','marathon','juggling','sailboat'],
  'Nature & weather':['rainbow','snowflake','tornado','lightning','cactus','sunflower','mushroom','mountain','ocean wave','campfire','cave','palm tree','icicle','sand dune','rain cloud','volcanic eruption','pond','pine cone','comet','moon'],
  'Music & sound':['guitar','drum kit','piano','trumpet','microphone','headphones','tambourine','violin','maracas','record player','music box','concert stage','accordion','flute','kazoo','speaker','metronome','xylophone','singing bird','alarm clock'],
  'Jobs & roles':['chef','firefighter','pilot','doctor','teacher','detective','mail carrier','photographer','astronaut','gardener','magician','lifeguard','scientist','construction worker','bus driver','artist','baker','veterinarian','news reporter','librarian'],
  'Transport & travel':['bicycle','submarine','helicopter','sailboat','hot air balloon','tractor','tram','canoe','rocket ship','suitcase','compass','traffic light','cable car','motorcycle','scooter','train','spaceship','camping tent','map','parachute'],
  'Home & school':['bookshelf','lunchbox','backpack','alarm clock','toaster','watering can','desk lamp','glue stick','blackboard','cushion','washing machine','paintbrush','stapler','pillow fort','lunch tray','doorbell','calendar','slippers','magnifying glass','paper airplane'],
  'Celebrations & events':['birthday cake','party hat','balloons','gift box','fireworks','lantern','parade float','confetti','wedding ring','jack-o-lantern','snow globe','piñata','medal','invitation card','candles','graduation cap','bonfire','costume mask','party popper','holiday wreath'],
  'Spirituality':['Krishna','Radha-Krishna','Gaura-Nitai','Jagannath','Baladeva','Subhadra','Chaitanya Mahaprabhu','Nityananda Prabhu','Srila Prabhupada','Panca-tattva','Narasimhadeva','Radha-Govinda','Bhagavad-gita','Srimad Bhagavatam','Caitanya-caritamrita','Hare Krishna mantra','japa beads','tulasi beads','tulasi plant','mridanga drum','kartals','harmonium','Vaishnava tilaka','conch shell','peacock feather','Krishna flute','Govardhan Hill','Vrindavan','Mayapur','Jagannath Puri','Ratha-yatra','Janmashtami','Gaura Purnima','Govardhan Puja','kirtan','sankirtan','arati lamp','prasadam plate','temple altar','lotus flower','sacred cow','butter pot','temple bell','ghee lamp','japa bag','temple chariot','Radha-kunda','Yamuna River','Ganga River','six Goswamis','Hare Krishna temple','devotional books','mridanga','hand cymbals','garland offering','sandalwood tilaka','congregational chanting','Bhagavatam book','Govardhan shila','Krishna crown','dancing kirtan','temple conch','incense offering']
};
wordBanks['All categories']=[...new Set([...words,...Object.entries(wordBanks).filter(([name])=>name!=='All categories').flatMap(([,bank])=>bank)])];
const clean = s => String(s || '').trim().slice(0, 32);
const code = () => Math.random().toString(36).slice(2, 6).toUpperCase();
const uid = () => Math.random().toString(36).slice(2, 10);
function send(res, status, body) { res.writeHead(status, { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*', 'Cache-Control':'no-store' }); res.end(JSON.stringify(body)); }
function snapshot(room, viewer) {
  const phase = room.phase;
  const publicPlayer = p => ({ id:p.id, name:p.name, score:p.score, connected:p.connected, isDrawer:p.id===room.drawerId });
  const players = room.players.map(publicPlayer);
  const mine = room.players.find(p=>p.id===viewer);
  const myEntry = room.entries.find(e=>e.playerId===viewer);
  return {
    code:room.code, phase, players, hostId:room.hostId, viewerId:viewer, drawerId:room.drawerId,
    round:room.round, totalRounds:room.totalRounds, timeLimit:room.timeLimit, genre:room.genre, fakeAllowed:room.players.length>=3, secondsLeft:phase==='drawing'?Math.max(0,Math.ceil((room.endsAt-Date.now())/1000)):0,
    prompt: viewer===room.drawerId && phase==='drawing' ? room.prompt : null,
    wordPattern: phase==='drawing' && room.prompt ? room.prompt.split(' ').map(word=>'_ '.repeat([...word].length).trim()).join('   ') : null,
    wordLength: phase==='drawing' && room.prompt ? [...room.prompt.replace(/\s/g,'')].length : 0,
    wordCount: phase==='drawing' && room.prompt ? room.prompt.trim().split(/\s+/).length : 0,
    options: viewer===room.drawerId && phase==='choose' ? room.options : null,
    entries: phase==='results' ? room.entries.map(e=>({name:room.players.find(p=>p.id===e.playerId)?.name||'Player', text:e.text, kind:e.kind, correct:e.correct, fooled:e.fooled})) : [],
    mySubmitted: {real:false,fake:room.entries.some(e=>e.playerId===viewer&&e.kind==='fake')}, hasGuessedCorrect:room.entries.some(e=>e.playerId===viewer&&e.correct),
    strokes:room.strokes, messages:room.messages.slice(-45), results:room.roundResults||null,
    message:room.message||null, isHost:viewer===room.hostId, myName:mine?.name||''
  };
}
function broadcast(room) { for (const [res, viewer] of [...room.listeners]) { if (res.destroyed) { room.listeners.delete(res); continue; } res.write(`data: ${JSON.stringify(snapshot(room,viewer))}\n\n`); } }
function addMessage(room, name, text, type='chat') { room.messages.push({name,text,type,at:Date.now()}); room.messages=room.messages.slice(-80); }
function endRound(room) {
  if(room.phase!=='drawing') return;
  const answer=room.prompt.toLowerCase();
  const guessers=[];
  for(const player of room.players.filter(x=>x.id!==room.drawerId)) {
    const entry=room.entries.filter(e=>e.playerId===player.id&&e.kind==='real'&&e.text.toLowerCase()===answer).sort((a,b)=>a.at-b.at)[0];
    if(entry)guessers.push(entry);
  }
  guessers.forEach(e=>{const interval=Math.max(1,room.timeLimit/10);const elapsed=Math.max(0,room.timeLimit-Math.ceil((room.endsAt-e.at)/1000));const speedStep=Math.floor(elapsed/interval);const pts=Math.max(10,100-speedStep*10);const p=room.players.find(x=>x.id===e.playerId);if(p)p.score+=pts;e.correct=true;e.points=pts;e.drawerPoints=Math.max(10,60-speedStep*5);});
  const fakes=room.entries.filter(e=>e.kind==='fake'&&!e.correct);
  const fooled=new Map();
  for(const e of room.entries.filter(x=>x.kind==='real'&&!x.correct)) {
    const matching=fakes.find(f=>f.playerId!==e.playerId&&f.text.toLowerCase()===e.text.toLowerCase());
    if(matching&&!fooled.has(matching.playerId))fooled.set(matching.playerId,1);
  }
  for(const [pid,count] of fooled) { const p=room.players.find(x=>x.id===pid); if(p)p.score+=25*count; }
  const drawer=room.players.find(p=>p.id===room.drawerId); const drawerPoints=guessers.reduce((sum,e)=>sum+e.drawerPoints,0); if(drawer) drawer.score+=drawerPoints;
  room.entries.forEach(e=>e.fooled=fooled.get(e.playerId)||0);
  room.roundResults={answer:room.prompt, drawerName:drawer?.name, drawerPoints, guessed:guessers.length, fooled:Object.fromEntries(fooled), scores:room.players.map(p=>({name:p.name,score:p.score,roundPoints:p.score-(room.roundStartScores?.[p.id]||0),fooledPoints:(fooled.get(p.id)||0)*25,isDrawer:p.id===room.drawerId}))};
  room.phase='results'; room.message='Round complete';
  broadcast(room);
}
function startRound(room) {
  if(room.round>=room.totalRounds) { room.phase='finished'; room.message='Game over'; broadcast(room); return; }
  room.round++; room.roundStartScores=Object.fromEntries(room.players.map(p=>[p.id,p.score])); room.drawerId=room.players[(room.round-1)%room.players.length].id;
  const bank=wordBanks[room.genre]||words;room.options=[...bank].sort(()=>Math.random()-.5).slice(0,3);room.prompt=null;room.strokes=[];room.entries=[];room.roundResults=null;room.phase='choose';room.message='Drawer is choosing a word';broadcast(room);
}
async function body(req) { let s=''; for await (const chunk of req) s+=chunk; try{return JSON.parse(s||'{}')}catch{return {}} }
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'});return res.end();}
  if(url.pathname.startsWith('/api/')){
    const data=req.method==='POST'?await body(req):{}; let room=rooms.get(String(data.code||url.searchParams.get('code')||'').toUpperCase());
    if(url.pathname==='/api/create'&&req.method==='POST'){
      let c=code();while(rooms.has(c))c=code();room={code:c,players:[],hostId:null,phase:'lobby',round:0,totalRounds:4,roundsPerPlayer:2,timeLimit:60,genre:'Mixed bag',drawerId:null,options:[],prompt:null,endsAt:0,strokes:[],entries:[],messages:[],listeners:new Set()};rooms.set(c,room);
      const p={id:uid(),name:clean(data.name)||'Host',score:0,connected:true};room.players.push(p);room.hostId=p.id;return send(res,200,{code:c,id:p.id});
    }
    if(url.pathname==='/api/join'&&req.method==='POST'){
      if(!room)return send(res,404,{error:'Room not found. Check the code and try again.'});if(room.phase!=='lobby')return send(res,409,{error:'That game has already started.'});if(room.players.length>=8)return send(res,409,{error:'This room is full.'});
      const p={id:uid(),name:clean(data.name)||'Player',score:0,connected:true};room.players.push(p);addMessage(room,p.name,'joined the room','system');broadcast(room);return send(res,200,{code:room.code,id:p.id});
    }
    if(!room)return send(res,404,{error:'Room not found.'});
    if(url.pathname==='/api/state')return send(res,200,snapshot(room,url.searchParams.get('id')));
    if(url.pathname==='/api/events'){
      const viewer=url.searchParams.get('id');res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','Access-Control-Allow-Origin':'*'});res.write(`data: ${JSON.stringify(snapshot(room,viewer))}\n\n`);room.listeners.add([res,viewer]);req.on('close',()=>{for(const item of room.listeners)if(item[0]===res)room.listeners.delete(item);});return;
    }
    if(url.pathname==='/api/action'){
      const p=room.players.find(x=>x.id===data.id);if(!p)return send(res,401,{error:'Player not found.'});
      if(data.action==='start'){
        if(p.id!==room.hostId)return send(res,403,{error:'Only the host can start.'});if(room.players.length<2)return send(res,400,{error:'Invite at least one other player first.'});room.roundsPerPlayer=Math.max(1,Math.min(8,Number(data.rounds)||2));room.totalRounds=room.players.length*room.roundsPerPlayer;room.timeLimit=[30,45,60,90].includes(Number(data.timeLimit))?Number(data.timeLimit):60;room.genre=Object.hasOwn(wordBanks,data.genre)?data.genre:'Mixed bag';room.round=0;room.players.forEach(x=>x.score=0);startRound(room);
      } else if(data.action==='choose'){
        if(room.phase!=='choose'||p.id!==room.drawerId||!room.options.includes(data.word))return send(res,400,{error:'That word is not available.'});room.prompt=data.word;room.phase='drawing';room.endsAt=Date.now()+room.timeLimit*1000;addMessage(room,'Game','The drawing round has started','system');broadcast(room);
      } else if(data.action==='stroke'){
        if(room.phase!=='drawing'||p.id!==room.drawerId)return send(res,403,{error:'Only the drawer can draw.'});room.strokes.push(data.stroke);room.strokes=room.strokes.slice(-350);broadcast(room);
      } else if(data.action==='clear'){
        if(p.id!==room.drawerId)return send(res,403,{error:'Only the drawer can clear the board.'});room.strokes=[];broadcast(room);
      } else if(data.action==='replaceBoard'){
        if(p.id!==room.drawerId)return send(res,403,{error:'Only the drawer can edit the board.'});room.strokes=(Array.isArray(data.strokes)?data.strokes:[]).slice(-350);broadcast(room);
      } else if(data.action==='answer'){
        if(room.phase!=='drawing'||p.id===room.drawerId)return send(res,400,{error:'You cannot submit an answer now.'});const kind=data.kind==='fake'?'fake':'real';if(kind==='fake'&&room.players.length<3)return send(res,400,{error:'Fake answers are available with 3 or more players.'});const text=clean(data.text);if(text.length<1)return send(res,400,{error:'Type an answer first.'});
        if(kind==='fake'&&room.entries.some(e=>e.playerId===p.id&&e.kind==='fake'))return send(res,409,{error:'You already used your fake answer.'});if(kind==='real'&&room.entries.some(e=>e.playerId===p.id&&e.correct))return send(res,409,{error:'You already guessed the word correctly.'});const correct=kind==='real'&&text.toLowerCase()===room.prompt.toLowerCase();room.entries.push({playerId:p.id,name:p.name,text,kind,at:Date.now(),correct});if(correct){addMessage(room,p.name,'guessed it!','correct');const guessers=room.players.filter(x=>x.id!==room.drawerId);if(guessers.every(x=>room.entries.some(e=>e.playerId===x.id&&e.correct)))endRound(room)}else if(kind==='fake')addMessage(room,p.name,'planted a fake answer','system');else addMessage(room,p.name,text,'guess');if(room.phase==='drawing')broadcast(room);
      } else if(data.action==='chat'){
        const text=clean(data.text);if(text)addMessage(room,p.name,text);broadcast(room);
      } else if(data.action==='next'){
        if(p.id!==room.hostId||room.phase!=='results')return send(res,403,{error:'The host advances the game.'});startRound(room);
      } else if(data.action==='playAgain'){
        if(p.id!==room.hostId||room.phase!=='finished')return send(res,403,{error:'Only the host can restart.'});room.round=0;room.phase='lobby';room.players.forEach(x=>x.score=0);room.message='Ready for another game';broadcast(room);
      } else if(data.action==='leave'){
        const departing=p.name,wasHost=p.id===room.hostId,wasDrawer=p.id===room.drawerId;room.players=room.players.filter(x=>x.id!==p.id);room.entries=room.entries.filter(x=>x.playerId!==p.id);addMessage(room,departing,'left the room','system');
        if(wasHost&&room.players.length)room.hostId=room.players[0].id;
        if(room.players.length===0){rooms.delete(room.code);return send(res,200,{ok:true,left:true});}
        room.totalRounds=room.players.length*room.roundsPerPlayer;
        if(room.players.length<2){room.phase='lobby';room.round=0;room.drawerId=null;room.strokes=[];room.entries=[];room.roundResults=null;room.message='Waiting for another player';}
        else if(wasDrawer&&(room.phase==='choose'||room.phase==='drawing')){room.message=`${departing} left; skipping to the next turn`;startRound(room);}
        if(room.roundResults)room.roundResults.scores=room.players.map(x=>({name:x.name,score:x.score,roundPoints:room.roundResults.scores.find(y=>y.name===x.name)?.roundPoints||0,fooledPoints:room.roundResults.scores.find(y=>y.name===x.name)?.fooledPoints||0,isDrawer:x.id===room.drawerId}));
        broadcast(room);
      } else return send(res,400,{error:'Unknown action.'});
      return send(res,200,{ok:true});
    }
    return send(res,404,{error:'Unknown endpoint.'});
  }
  let pathname=decodeURIComponent(url.pathname);if(pathname==='/')pathname='/index.html';const file=path.join(ROOT,'public',pathname.replace(/^\/+/,''));if(!file.startsWith(path.join(ROOT,'public')))return send(res,403,{error:'Forbidden'});
  fs.readFile(file,(err,content)=>{if(err){res.writeHead(404);return res.end('Not found');}const ext=path.extname(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'}[ext]||'application/octet-stream'),'Cache-Control':'no-cache'});res.end(content);});
});
setInterval(()=>{for(const room of rooms.values())if(room.phase==='drawing'){if(Date.now()>=room.endsAt)endRound(room);else broadcast(room);}},1000);
server.listen(PORT,'0.0.0.0',()=>console.log(`Doodle Bluff ready at http://localhost:${PORT}`));
