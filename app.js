/* Doah Play v0.3 - offline-first, no analytics, original audio and artwork. */
'use strict';
const $ = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>[...root.querySelectorAll(s)];
const views=$$('.view');
const mainAudio=$('#mainMusic'), storyAudio=$('#storyMusic');
let view='home', soundEnabled=localStorage.getItem('doah-sound')!=='off';
let volume=Number(localStorage.getItem('doah-volume')||18)/100;
let limit=Number(localStorage.getItem('doah-minutes')??'10');
let startAt=Date.now(), parentUnlocked=false, toastTimer=0;
let voiceTimer=0, voiceToken=0, audioCtx=null;
mainAudio.volume=volume;storyAudio.volume=volume*.78;
$('#soundButton').setAttribute('aria-pressed',String(soundEnabled));
$('#soundButton').innerHTML=soundEnabled?'♫ <span>음악</span>':'♪ <span>꺼짐</span>';
$('#timeLimit').value=String(limit); $('#musicVolume').value=String(Math.round(volume*100));
function notify(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2200)}
function duckAudio(on){mainAudio.volume=volume*(on?.36:1);storyAudio.volume=volume*(on?.26:.78)}
function playForView(){
  if(!soundEnabled){mainAudio.pause();storyAudio.pause();return}
  if(document.hidden){mainAudio.pause();storyAudio.pause();return}
  if(view==='books'){
    mainAudio.pause();storyAudio.src=`story-${page+1}.mp3`;storyAudio.loop=true;storyAudio.volume=volume*.78;
    storyAudio.play().catch(()=>{});
  }else{
    storyAudio.pause(); mainAudio.loop=true;mainAudio.volume=volume;
    mainAudio.play().catch(()=>{ /* mobile browsers require a touch first */ });
  }
}
function audioUnlock(){
  if(!audioCtx){try{audioCtx=new (window.AudioContext||window.webkitAudioContext)()}catch(_){}}
  if(audioCtx?.state==='suspended')audioCtx.resume().catch(()=>{});
}
function beep(freq=620,duration=.15,kind='sine',gain=.07,when=0){
  if(!audioCtx||!soundEnabled)return;
  const time=audioCtx.currentTime+when;
  const oscillator=audioCtx.createOscillator(),g=audioCtx.createGain();
  oscillator.type=kind;oscillator.frequency.setValueAtTime(freq,time);
  g.gain.setValueAtTime(.00001,time);g.gain.exponentialRampToValueAtTime(gain,time+.025);
  g.gain.exponentialRampToValueAtTime(.00001,time+duration);
  oscillator.connect(g).connect(audioCtx.destination);oscillator.start(time);oscillator.stop(time+duration+.01);
}
function wrongJingle(){ // three falling notes: a gentle "띠리리링" correction signal
  [784,659,523,392].forEach((v,i)=>beep(v,.18,'sine',.05,i*.12));
}
function goodChime(){[523,659,784,1046].forEach((v,i)=>beep(v,.21,'sine',.045,i*.12))}
function stopVoice(){voiceToken++;clearTimeout(voiceTimer);if('speechSynthesis'in window)window.speechSynthesis.cancel();duckAudio(false);unlockWord()}
function bestVoice(lang){
  const arr=window.speechSynthesis?.getVoices?.()||[];
  const candidates=arr.filter(v=>v.lang?.toLowerCase().startsWith(lang.toLowerCase().slice(0,2)));
  return candidates.find(v=>/Google|Samantha|Yuna|Heami|Seoyeon|Sora|Daniel|Microsoft/i.test(v.name))||candidates[0]||null;
}
function talk(text,lang='ko-KR',finish=null){
  voiceToken++;const token=voiceToken;clearTimeout(voiceTimer);
  if(!('speechSynthesis'in window)){finish?.();return}
  const synth=window.speechSynthesis;
  synth.cancel();duckAudio(true);
  const u=new SpeechSynthesisUtterance(text);u.lang=lang;u.rate=lang==='en-US'?.96:.84;u.pitch=1.1;u.volume=.93;
  const best=bestVoice(lang);if(best)u.voice=best;
  let done=false;
  const complete=()=>{if(done||token!==voiceToken)return;done=true;clearTimeout(voiceTimer);duckAudio(false);finish?.()};
  u.onend=complete;u.onerror=complete;
  // Some mobile engines never call onend. Release the card even when TTS is unavailable.
  const fallback=Math.max(1800,Math.min(22000,lang==='en-US'?text.length*115+1100:text.length*190+1500));
  voiceTimer=setTimeout(complete,fallback);
  try{synth.speak(u)}catch(_){complete()}
}
function show(next){
  if(next==='settings'&&!parentUnlocked){askParent();return}
  stopVoice();view=next;views.forEach(el=>el.classList.toggle('is-active',el.id===next));
  $('#homeButton').hidden=next==='home';
  if(next==='draw')requestAnimationFrame(sizeCanvas);
  if(next==='puzzle')renderPuzzle();
  if(next==='words')renderWord();
  if(next==='books'){renderBook();playForView();readPage();}
  else playForView();
  window.scrollTo({top:0,behavior:'instant'});
}
$$('[data-open]').forEach(el=>el.addEventListener('click',()=>{audioUnlock();show(el.dataset.open)}));
$('#homeButton').addEventListener('click',()=>{audioUnlock();show('home')});
function askParent(){
  audioUnlock();const ans=window.prompt('부모님 전용이에요. 6 + 7 = ?');
  if(ans===null)return;
  if(ans.trim()==='13'){parentUnlocked=true;$('#pauseOverlay').hidden=true;show('settings')}
  else notify('부모님과 함께해 주세요.');
}
$('#parentsButton').addEventListener('click',askParent);
$('#pauseParent').addEventListener('click',askParent);
$('#soundButton').addEventListener('click',()=>{
  audioUnlock();soundEnabled=!soundEnabled;localStorage.setItem('doah-sound',soundEnabled?'on':'off');
  $('#soundButton').setAttribute('aria-pressed',String(soundEnabled));
  $('#soundButton').innerHTML=soundEnabled?'♫ <span>음악</span>':'♪ <span>꺼짐</span>';
  playForView();notify(soundEnabled?'음악이 켜졌어요 ♪':'음악을 껐어요');
});
$('#musicVolume').addEventListener('input',e=>{volume=Number(e.target.value)/100;localStorage.setItem('doah-volume',String(e.target.value));duckAudio(false)});
$('#timeLimit').addEventListener('change',e=>{limit=Number(e.target.value);localStorage.setItem('doah-minutes',String(limit))});
$('#restartSession').addEventListener('click',()=>{limit=Number($('#timeLimit').value);localStorage.setItem('doah-minutes',String(limit));startAt=Date.now();parentUnlocked=false;$('#pauseOverlay').hidden=true;show('home')});
setInterval(()=>{
  const remain=limit?Math.max(0,limit*60-Math.floor((Date.now()-startAt)/1000)):0;
  $('#timerStatus').textContent=limit?`${Math.ceil(remain/60)}분 남았어요`:'함께 놀아요';
  if(limit&&remain===0&&view!=='settings'&&$('#pauseOverlay').hidden){stopVoice();mainAudio.pause();storyAudio.pause();$('#pauseOverlay').hidden=false}
},1000);
document.addEventListener('visibilitychange',()=>{if(document.hidden){mainAudio.pause();storyAudio.pause();stopVoice()}else if(!$('#pauseOverlay').hidden){}else playForView()});
// --- Drawing ---
const paint=$('#paintCanvas'),paintCtx=paint.getContext('2d');
let ink='#ee7599',mode='free',drawing=false,strokes=[],activeStroke=null;
const palette=['#f27c96','#f3aa48','#f4d86d','#84c995','#79abed','#a28be2','#54475e'];
$('#colorButtons').innerHTML=palette.map((c,i)=>`<button class="swatch ${i===0?'selected':''}" data-color="${c}" aria-label="${['분홍','주황','노랑','초록','파랑','보라','검정'][i]}" style="background:${c}"></button>`).join('');
$('#colorButtons').addEventListener('click',e=>{const b=e.target.closest('[data-color]');if(!b)return;ink=b.dataset.color;$$('.swatch').forEach(v=>v.classList.toggle('selected',v===b))});
function sizeCanvas(){const b=paint.getBoundingClientRect();if(b.width<1)return;const dpi=Math.min(devicePixelRatio||1,3);paint.width=Math.round(b.width*dpi);paint.height=Math.round(b.height*dpi);paintCtx.setTransform(dpi,0,0,dpi,0,0);redraw()}
function redraw(){const w=paint.clientWidth,h=paint.clientHeight;paintCtx.clearRect(0,0,w,h);paintCtx.fillStyle='#fffefa';paintCtx.fillRect(0,0,w,h);for(const stroke of strokes.concat(activeStroke?[activeStroke]:[])){const pts=stroke.points;if(!pts.length)continue;paintCtx.beginPath();paintCtx.strokeStyle=stroke.color;paintCtx.lineWidth=9;paintCtx.lineCap='round';paintCtx.lineJoin='round';paintCtx.moveTo(pts[0][0]*w,pts[0][1]*h);for(let i=1;i<pts.length;i++)paintCtx.lineTo(pts[i][0]*w,pts[i][1]*h);if(pts.length===1)paintCtx.lineTo(pts[0][0]*w+.1,pts[0][1]*h+.1);paintCtx.stroke()}}
function normalizedPoint(e){const r=paint.getBoundingClientRect();return [(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height]}
paint.addEventListener('pointerdown',e=>{audioUnlock();e.preventDefault();drawing=true;paint.setPointerCapture(e.pointerId);activeStroke={color:ink,points:[normalizedPoint(e)]};redraw()});
paint.addEventListener('pointermove',e=>{if(!drawing||!activeStroke)return;activeStroke.points.push(normalizedPoint(e));redraw()});
function finishStroke(){if(!drawing)return;drawing=false;if(activeStroke){strokes.push(activeStroke);activeStroke=null;redraw()}}
paint.addEventListener('pointerup',finishStroke);paint.addEventListener('pointercancel',finishStroke);
$('#clearButton').addEventListener('click',()=>{strokes=[];activeStroke=null;redraw()});
$('#undoButton').addEventListener('click',()=>{strokes.pop();redraw()});
const guides={line:'M 85 210 L 515 210',circle:'M 430 210 A 130 130 0 1 1 170 210 A 130 130 0 1 1 430 210',wave:'M 65 225 C 140 70 205 355 300 215 S 460 70 535 215',zigzag:'M 65 315 L 166 90 L 260 315 L 354 90 L 448 315 L 535 90'};
$('#drawModes').addEventListener('click',e=>{const b=e.target.closest('[data-trace]');if(!b)return;mode=b.dataset.trace;$$('#drawModes button').forEach(v=>v.classList.toggle('is-selected',v===b));$('#traceOverlay').innerHTML=guides[mode]?`<path d="${guides[mode]}" fill="none" stroke="#c5b5e1" stroke-width="13" stroke-linecap="round" stroke-dasharray="14 19"/>`:'';strokes=[];redraw()});
window.addEventListener('resize',()=>{if(view==='draw')sizeCanvas()});
// --- Eight-piece picture puzzles. Pointer Events work on both Safari/iPad and Android Chrome. ---
const puzzleImages=['pororo-snow.jpg','pororo-picnic.jpg','pororo-ocean.jpg'];
let scene=0,solvedPieces=new Set(),selectedPiece=null,drag=null,suppressPieceClick=false;
function positionFor(id){return `${Math.floor(id%4)*100/3}% ${Math.floor(id/4)*100}%`}
function setPuzzleFeedback(msg){$('#puzzleFeedback').textContent=msg}
function shuffle(v){for(let i=v.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[v[i],v[j]]=[v[j],v[i]]}return v}
function renderPuzzle(){
  solvedPieces.clear();selectedPiece=null;drag=null;$('#dragGhost').style.display='none';
  $$('#puzzleScenes button').forEach(b=>b.classList.toggle('is-selected',Number(b.dataset.scene)===scene));
  const img=puzzleImages[scene];
  $('#puzzleBoard').innerHTML=Array.from({length:8},(_,id)=>`<div class="puzzle-slot" data-slot="${id}" aria-label="그림의 ${id+1}번째 칸" style="background-image:url('${img}');background-position:${positionFor(id)}"></div>`).join('');
  $('#puzzleTray').innerHTML=shuffle([...Array(8).keys()]).map(id=>`<button type="button" class="puzzle-tile" data-piece="${id}" aria-label="${id+1}번째 퍼즐 조각" style="background-image:url('${img}');background-position:${positionFor(id)}"></button>`).join('');
  $('#puzzleCount').textContent='0 / 8개';setPuzzleFeedback('조각을 쏙! 알맞은 곳에 놓아 주세요.');
}
function selectPiece(id){selectedPiece=id;$$('.puzzle-tile').forEach(el=>el.classList.toggle('selected',Number(el.dataset.piece)===id))}
function placePiece(id,slot){
  if(id==null||solvedPieces.has(id))return;
  const target=$(`[data-slot="${slot}"]`);
  if(!target||target.classList.contains('filled'))return;
  if(id!==slot){
    target.classList.remove('wrong');void target.offsetWidth;target.classList.add('wrong');
    wrongJingle();setPuzzleFeedback('띠리리링~ 다른 자리예요! 다시 해볼까요?');
    setTimeout(()=>target.classList.remove('wrong'),520);return false;
  }
  goodChime();solvedPieces.add(id);target.classList.add('filled');
  $(`[data-piece="${id}"]`)?.remove();selectedPiece=null;
  $('#puzzleCount').textContent=`${solvedPieces.size} / 8개`;
  setPuzzleFeedback(solvedPieces.size===8?'짜잔! 퍼즐을 완성했어요! ⭐':'정답이에요! 참 잘했어요!');
  if(solvedPieces.size===8){beep(1174,.26,'sine',.05,.5);notify('퍼즐 완성! 다른 그림도 맞춰볼까요?')}
  return true;
}
$('#puzzleScenes').addEventListener('click',e=>{const b=e.target.closest('[data-scene]');if(!b)return;audioUnlock();scene=Number(b.dataset.scene);renderPuzzle()});
$('#newPuzzle').addEventListener('click',()=>renderPuzzle());
$('#puzzleHint').addEventListener('click',()=>{
  const id=selectedPiece??[...Array(8).keys()].find(x=>!solvedPieces.has(x));
  const el=$(`[data-slot="${id}"]`);if(!el)return;el.classList.add('hinted');setTimeout(()=>el.classList.remove('hinted'),1250);notify('반짝이는 곳을 찾아보세요!');
});
$('#puzzleBoard').addEventListener('click',e=>{const cell=e.target.closest('[data-slot]');if(cell&&selectedPiece!==null){audioUnlock();placePiece(selectedPiece,Number(cell.dataset.slot))}});
const tray=$('#puzzleTray'),ghost=$('#dragGhost');
tray.addEventListener('pointerdown',e=>{
  const piece=e.target.closest('[data-piece]');if(!piece||solvedPieces.has(Number(piece.dataset.piece)))return;
  audioUnlock();e.preventDefault();
  const rect=piece.getBoundingClientRect();
  drag={id:Number(piece.dataset.piece),node:piece,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,rect,active:false,pointerId:e.pointerId};
  piece.setPointerCapture(e.pointerId);
});
tray.addEventListener('pointermove',e=>{
  if(!drag||drag.pointerId!==e.pointerId)return;
  drag.x=e.clientX;drag.y=e.clientY;
  if(!drag.active&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>8){
    drag.active=true;drag.node.classList.add('dragging');
    ghost.className='';ghost.style.display='block';ghost.style.width=drag.rect.width+'px';ghost.style.height=drag.rect.height+'px';
    ghost.style.backgroundImage=`url('${puzzleImages[scene]}')`;ghost.style.backgroundPosition=positionFor(drag.id);
  }
  if(!drag.active)return;
  ghost.style.left=(e.clientX-drag.rect.width/2)+'px';ghost.style.top=(e.clientY-drag.rect.height/2)+'px';
  $$('.puzzle-slot').forEach(el=>el.classList.remove('hovered'));
  const slot=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('[data-slot]');
  if(slot&&!slot.classList.contains('filled'))slot.classList.add('hovered');
});
function endDrag(e){
  if(!drag||drag.pointerId!==e.pointerId)return;
  const d=drag;drag=null;
  $$('.puzzle-slot').forEach(el=>el.classList.remove('hovered'));
  d.node.classList.remove('dragging');
  if(!d.active){selectPiece(d.id);return}
  suppressPieceClick=true;setTimeout(()=>{suppressPieceClick=false},150);
  const slot=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('[data-slot]');
  let ok=false;if(slot)ok=placePiece(d.id,Number(slot.dataset.slot))===true;
  if(!ok){ // visibly glide back to the original tray position
    ghost.classList.add('returning');ghost.style.left=d.rect.left+'px';ghost.style.top=d.rect.top+'px';
    setTimeout(()=>{ghost.style.display='none';ghost.className=''},310);
  }else{ghost.style.display='none';ghost.className=''}
}
tray.addEventListener('pointerup',endDrag);tray.addEventListener('pointercancel',endDrag);
tray.addEventListener('click',e=>{if(suppressPieceClick)return;const b=e.target.closest('[data-piece]');if(b)selectPiece(Number(b.dataset.piece))});
// --- Large bilingual interactive cards ---
const WORDS=[
  ['🐻','곰','Bear','곰이 꿀을 먹어요.','The bear eats honey.','animal'],
  ['🐶','강아지','Dog','강아지가 꼬리를 흔들어요.','The dog wags its tail.','animal'],
  ['🐱','고양이','Cat','고양이가 야옹 하고 울어요.','The cat says meow.','animal'],
  ['🐷','돼지','Pig','돼지가 꿀꿀 인사해요.','The pig says oink.','animal'],
  ['🐰','토끼','Rabbit','토끼가 깡충깡충 뛰어요.','The rabbit hops.','animal'],
  ['🐘','코끼리','Elephant','코끼리가 코를 흔들어요.','The elephant swings its trunk.','animal'],
  ['🦁','사자','Lion','사자가 어흥 하고 울어요.','The lion roars.','animal'],
  ['🐸','개구리','Frog','개구리가 폴짝 뛰어요.','The frog jumps.','animal'],
  ['🐧','펭귄','Penguin','펭귄이 뒤뚱뒤뚱 걸어요.','The penguin waddles.','animal'],
  ['🦊','여우','Fox','여우가 숲속을 걸어요.','The fox walks in the forest.','animal'],
  ['🍎','사과','Apple','빨간 사과가 맛있어요.','The red apple is tasty.','food'],
  ['🍌','바나나','Banana','노란 바나나를 먹어요.','I eat a yellow banana.','food'],
  ['🍓','딸기','Strawberry','달콤한 딸기가 있어요.','The strawberry is sweet.','food'],
  ['🍇','포도','Grapes','포도가 송이송이 열렸어요.','The grapes grow in bunches.','food'],
  ['🍉','수박','Watermelon','수박을 냠냠 먹어요.','I eat yummy watermelon.','food'],
  ['🥕','당근','Carrot','토끼가 당근을 좋아해요.','The rabbit likes carrots.','food'],
  ['🍞','빵','Bread','따뜻한 빵 냄새가 나요.','The bread smells good.','food'],
  ['🥛','우유','Milk','하얀 우유를 마셔요.','I drink a cup of milk.','food'],
  ['🚗','자동차','Car','자동차가 부릉부릉 달려요.','The car goes vroom.','world'],
  ['🚂','기차','Train','기차가 칙칙폭폭 달려요.','The train goes choo-choo.','world'],
  ['🌞','해','Sun','해님이 반짝반짝 빛나요.','The sun shines brightly.','world'],
  ['🌙','달','Moon','밤하늘에 달이 떠요.','The moon is in the night sky.','world'],
  ['🌳','나무','Tree','커다란 나무가 흔들려요.','The big tree sways.','world'],
  ['🏡','집','House','우리 집은 참 포근해요.','Our house feels cozy.','world']
];
let wordFilter='all',wordPosition=0,wordStage=0,wordBusy=false,swipeStart=null,swipeSuppressed=false;
const stageLabels=['한국어','English','한국어 문장','English sentence'];
function filteredWords(){return WORDS.filter(w=>wordFilter==='all'||w[5]===wordFilter)}
function currentWord(){return filteredWords()[wordPosition%filteredWords().length]}
function unlockWord(){wordBusy=false;const btn=$('#wordCard');if(btn){btn.disabled=false;btn.classList.remove('busy')}$('#prevWord').disabled=false;$('#nextWord').disabled=false;}
function renderWord(){
  const w=currentWord(),list=filteredWords();if(!w)return;
  $('#wordEmoji').textContent=w[0];$('#wordKorean').textContent=w[1];$('#wordEnglish').textContent=w[2];
  $('#wordNumber').textContent=`${wordPosition+1} / ${list.length}`;
  $('#wordStep').textContent=wordStage===0?'그림을 톡! 눌러보세요.':`다음은 ${stageLabels[wordStage]} ♪`;
  $$('#readProgress span').forEach((el,i)=>{el.classList.toggle('done',i<wordStage);el.classList.remove('speaking')});
}
function speakWordStage(){
  if(wordBusy||view!=='words')return;audioUnlock();
  const w=currentWord(),stage=wordStage;
  const spoken=[w[1],w[2],w[3],w[4]][stage],lang=stage%2?'en-US':'ko-KR';
  wordBusy=true;$('#wordCard').disabled=true;$('#wordCard').classList.add('busy');
  $('#prevWord').disabled=true;$('#nextWord').disabled=true;
  $('#wordStep').textContent=`${stageLabels[stage]} 읽는 중...`;
  $$('#readProgress span').forEach((el,i)=>el.classList.toggle('speaking',i===stage));
  talk(spoken,lang,()=>{
    unlockWord();wordStage=(stage+1)%4;
    $$('#readProgress span').forEach((el,i)=>{el.classList.remove('speaking');el.classList.toggle('done',i<wordStage)});
    $('#wordStep').textContent=wordStage===0?'다시 처음부터 읽어볼까요?':`다음은 ${stageLabels[wordStage]} ♪`;
  });
}
$('#wordCard').addEventListener('click',()=>{if(swipeSuppressed){swipeSuppressed=false;return}if(!wordBusy)speakWordStage()});
function stepWord(delta){
  if(wordBusy)return;const c=$('#wordCard');c.classList.add(delta>0?'swipe-out-left':'swipe-out-right');
  setTimeout(()=>{wordPosition=(wordPosition+delta+filteredWords().length)%filteredWords().length;wordStage=0;renderWord();c.classList.remove('swipe-out-left','swipe-out-right')},210);
}
$('#prevWord').addEventListener('click',()=>stepWord(-1));$('#nextWord').addEventListener('click',()=>stepWord(1));
$('#wordFilters').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;stopVoice();wordFilter=b.dataset.filter;wordPosition=0;wordStage=0;$$('#wordFilters button').forEach(el=>el.classList.toggle('is-selected',el===b));renderWord()});
$('#wordCard').addEventListener('pointerdown',e=>{if(wordBusy)return;swipeStart={x:e.clientX,y:e.clientY}});
$('#wordCard').addEventListener('pointerup',e=>{if(wordBusy||!swipeStart)return;const dx=e.clientX-swipeStart.x,dy=e.clientY-swipeStart.y;swipeStart=null;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.3){swipeSuppressed=true;stepWord(dx<0?1:-1);setTimeout(()=>swipeSuppressed=false,380)}});
$('#wordCard').addEventListener('pointercancel',()=>swipeStart=null);
// --- Interactive original adaptation of the public domain folk tale "The Three Little Pigs" ---
const STORY=[
 {title:'엄마 돼지의 부탁',music:1,pigs:3,house:'none',wolf:false,light:'day',text:'옛날 옛날, 푸른 언덕에 아기돼지 삼형제가 살았어요. 어느 날 엄마 돼지가 말했지요. “꿀꿀, 얘들아! 이제 너희 집을 만들어 보렴.” 돼지들은 “네에! 씩씩하게 지을게요!” 하고 꿀꿀 인사했답니다.'},
 {title:'첫째의 폭신한 짚집',music:2,pigs:1,house:'straw',wolf:false,light:'day',text:'첫째 돼지는 노란 짚을 한 아름 모았어요. “사각사각, 금방 만들 수 있겠다!” 첫째는 짚을 얹고 또 얹어 폭신한 집을 만들었지요. “와아, 내 집 완성! 꿀꿀!” 하고 깡충 뛰었어요.'},
 {title:'둘째의 나뭇가지 집',music:3,pigs:1,house:'wood',wolf:false,light:'day',text:'둘째 돼지는 숲에서 길쭉한 나뭇가지를 모았어요. “톡톡, 딱딱! 튼튼하게 묶어야지.” 가지를 하나씩 쌓으니 멋진 집이 생겼어요. 둘째는 “야호! 내 집도 완성이야!” 하고 손뼉을 쳤어요.'},
 {title:'셋째의 튼튼한 벽돌집',music:4,pigs:1,house:'brick',wolf:false,light:'day',text:'셋째 돼지는 빨간 벽돌을 한 장씩 옮겼어요. “영차, 영차! 천천히, 튼튼하게 쌓을 거야.” 하나, 둘, 셋! 벽돌을 차곡차곡 올려 단단한 집을 만들었답니다. “이제 바람이 불어도 괜찮아!” 하며 흐뭇하게 웃었어요.'},
 {title:'늑대가 짚집에 왔어요',music:5,pigs:1,house:'straw',wolf:true,light:'wind',text:'그때 숲속에서 늑대가 성큼성큼 다가왔어요. “후우우! 문을 열어라!” 첫째 돼지는 “안 돼요, 안 돼요!” 하고 외쳤지요. 늑대가 후우욱 바람을 불자 짚집이 팔랑팔랑 흩날렸어요. 첫째는 얼른 동생에게 달려갔어요.'},
 {title:'나뭇가지 집도 흔들흔들',music:6,pigs:2,house:'wood',wolf:true,light:'wind',text:'늑대는 둘째 돼지의 집까지 쿵쿵 따라왔어요. “크앙! 이번에도 후우우!” 나뭇가지 집이 덜컹덜컹 흔들렸지요. “앗, 안 되겠다!” 두 돼지는 손을 꼭 잡고 셋째의 벽돌집으로 달려갔어요.'},
 {title:'벽돌집은 끄떡없어요!',music:7,pigs:3,house:'brick',wolf:true,light:'sunset',text:'셋째는 형들을 벽돌집 안으로 얼른 들여보냈어요. 늑대가 “후우우우! 후우우우!” 힘껏 불었지만 집은 끄떡도 하지 않았지요. “어라? 왜 안 움직이지?” 늑대는 깜짝 놀랐어요. 결국 늑대는 터덜터덜 숲으로 돌아갔답니다.'},
 {title:'삼형제는 함께 웃었어요',music:8,pigs:3,house:'brick',wolf:false,light:'gold',text:'아기돼지 삼형제는 창문을 열고 바깥을 살펴보았어요. “와아! 이제 모두 안전해!” “꿀꿀, 꿀꿀!” 돼지들은 손을 잡고 빙글빙글 춤을 추었지요. 그리고 서로를 도우며 행복하게 오래오래 살았답니다.'}
];
let page=0,storyPageToken=0;
function p(n){return Number(n).toFixed(1)}
function svgCloud(x,y,s=1){return `<g class="cloud" transform="translate(${x} ${y}) scale(${s})" opacity=".87"><ellipse cx="0" cy="13" rx="52" ry="20" fill="white"/><circle cx="-22" cy="-2" r="25" fill="white"/><circle cx="14" cy="-13" r="29" fill="white"/><circle cx="40" cy="6" r="22" fill="white"/></g>`}
function svgTree(x,y,s=1){return `<g transform="translate(${x} ${y}) scale(${s})"><g class="tree" data-action="tree" role="button" aria-label="나무 흔들기"><rect x="-15" y="-110" width="30" height="160" rx="12" fill="#b57955"/><path d="M0-25 L-45-95 M0-72 L45-135" stroke="#b57955" stroke-width="15" stroke-linecap="round"/><circle cx="-47" cy="-132" r="56" fill="#71bf81"/><circle cx="42" cy="-145" r="62" fill="#6bbb7a"/><circle cy="-190" r="61" fill="#8bd59a"/><circle class="leaf" cx="-78" cy="-145" r="11" fill="#b1d978"/><circle class="leaf" cx="-18" cy="-213" r="12" fill="#c3db68"/><circle class="leaf" cx="69" cy="-174" r="10" fill="#b3d975"/><circle class="leaf" cx="30" cy="-109" r="11" fill="#bcdd80"/><circle cx="0" cy="-100" r="85" fill="transparent"/></g></g>`}
function svgPig(x,y,scale=1,shirt='#ffa4ba',alt=false){return `<g transform="translate(${x} ${y}) scale(${scale})"><g class="pig ${alt?'alt':''}" data-action="pig" role="button" aria-label="돼지 꿀꿀 소리"><ellipse cy="14" rx="50" ry="59" fill="${shirt}"/><ellipse cy="-79" rx="71" ry="69" fill="#ffc0ce" stroke="#e998ae" stroke-width="4"/><path d="M-48-119 L-66-168 Q-43-178 -17-138 M44-120 L63-171 Q84-164 59-125" fill="#f8a6be" stroke="#e998ae" stroke-width="4"/><ellipse cy="-60" rx="33" ry="22" fill="#f193ae"/><ellipse cx="-10" cy="-59" rx="5" ry="8" fill="#cb6689"/><ellipse cx="10" cy="-59" rx="5" ry="8" fill="#cb6689"/><circle cx="-29" cy="-92" r="7" fill="#453447"/><circle cx="29" cy="-92" r="7" fill="#453447"/><circle cx="-31" cy="-95" r="2.5" fill="white"/><circle cx="27" cy="-95" r="2.5" fill="white"/><path d="M-14-36 Q0-25 15-36" fill="none" stroke="#bc657f" stroke-width="4" stroke-linecap="round"/><ellipse cx="-44" cy="60" rx="22" ry="13" fill="#d9869f"/><ellipse cx="41" cy="60" rx="22" ry="13" fill="#d9869f"/><path d="M-39-2 L-75 25 M39-2 L73 17" stroke="#f4a5b6" stroke-width="17" stroke-linecap="round"/><ellipse cy="-58" rx="72" ry="113" fill="transparent"/></g></g>`}
function svgWolf(x,y,scale=1){return `<g transform="translate(${x} ${y}) scale(${scale})"><g class="wolf" data-action="wolf" role="button" aria-label="늑대 크앙 소리"><ellipse cy="12" rx="54" ry="72" fill="#949bb2"/><path d="M-70-80 L-75-166 L-17-130 L56-168 L73-67" fill="#7f849d"/><path d="M-68-86 Q0-168 72-86 Q83 6 0 2 Q-83 0 -68-86" fill="#969db4"/><path d="M-54-86 L-54-135 L-21-115 M43-115 L56-140 L57-85" fill="#f6b0ba"/><ellipse cx="-23" cy="-81" rx="10" ry="13" fill="#3c4259"/><ellipse cx="26" cy="-81" rx="10" ry="13" fill="#3c4259"/><ellipse cy="-45" rx="37" ry="29" fill="#e5d6db"/><ellipse cy="-55" rx="15" ry="11" fill="#434455"/><path d="M-10-27 Q0-17 13-29" stroke="#525067" stroke-width="4" fill="none"/><path d="M-47 10 L-73 60 M47 10 L72 60" stroke="#838a9f" stroke-width="18" stroke-linecap="round"/><ellipse cx="-30" cy="80" rx="27" ry="15" fill="#676f89"/><ellipse cx="32" cy="80" rx="27" ry="15" fill="#676f89"/><circle cy="-75" r="84" fill="transparent"/></g></g>`}
function svgHouse(type,x=300,y=370,scale=1){
  if(type==='none')return '';
  const straw=type==='straw',wood=type==='wood';
  const fill=straw?'#ffe18b':wood?'#dfaf73':'#e7a99a';
  const lines=straw?Array.from({length:11},(_,i)=>`<path d="M${8+i*23} 60 L${26+i*23} 286" stroke="#cbb25f" stroke-width="4" opacity=".5"/>`).join(''):wood?Array.from({length:11},(_,i)=>`<path d="M0 ${65+i*19} H270" stroke="#9e6f52" stroke-width="8" opacity=".65"/>`).join(''):Array.from({length:9},(_,i)=>`<path d="M0 ${70+i*25} H270 M${i%2?0:24} ${82+i*25} h15 M${i%2?155:185} ${82+i*25} h15" stroke="#b36b61" stroke-width="3" opacity=".7"/>`).join('');
  const roof=straw?'#dfbd5b':wood?'#96644d':'#a95868';
  return `<g transform="translate(${x} ${y}) scale(${scale})"><g class="house ${page===4||page===5?'is-shaky':''}" data-action="house" role="button" aria-label="집 흔들기"><rect x="0" y="50" width="270" height="235" rx="8" fill="${fill}" stroke="#c68c84" stroke-width="5"/>${lines}<path d="M-26 61 L136 -62 L296 61 Z" fill="${roof}" stroke="${wood?'#855b4e':'#bd8a65'}" stroke-width="10" stroke-linejoin="round"/><path d="M111 284 V170 Q111 142 138 142 Q167 142 167 170 V284" fill="#946b63" stroke="#835b5c" stroke-width="7"/><circle cx="153" cy="216" r="5" fill="#ffdf88"/><rect x="29" y="95" width="65" height="67" rx="6" fill="#d4f1ff" stroke="#fff" stroke-width="8"/><path d="M61 95 V162 M29 128 H94" stroke="#fff" stroke-width="5"/><g class="window" data-action="window" role="button" aria-label="창문 열기"><rect x="174" y="95" width="68" height="68" rx="5" fill="#b0dcf0" stroke="#fff" stroke-width="8"/><path d="M208 95 V163 M174 129 H242" stroke="white" stroke-width="5"/><rect x="158" y="77" width="102" height="112" fill="transparent"/></g></g></g>`;
}
function generateScene(pageObj){
  const c=pageObj.light;
  const sky=c==='sunset'?'#f6c3a4':c==='gold'?'#ffe4ac':c==='wind'?'#dceaf0':'#d7edff';
  const sun=c==='sunset'?'#fa9d70':'#ffe38c';
  const house=pageObj.house;
  let pigs='';
  if(pageObj.pigs===3){pigs=svgPig(124,437,.65,'#e8b8ef')+svgPig(215,452,.58,'#a4c6f3',true)+svgPig(296,441,.68,'#ffb98e')}
  else if(pageObj.pigs===2){pigs=svgPig(150,442,.65,'#a4c6f3')+svgPig(245,442,.65,'#e8b8ef',true)}
  else{pigs=svgPig(156,445,.78,page===1?'#e8b8ef':page===2?'#a4c6f3':'#ffb98e')}
  let hX=380,hY=155,hScale=.9;
  if(page===0){hX=455;hY=210;hScale=.7}
  const houseSvg=svgHouse(house,hX,hY,hScale);
  let wolf=pageObj.wolf?svgWolf(768,433,.72):'';
  return `<svg viewBox="0 0 900 520" role="img" aria-label="움직이는 아기돼지 삼형제 장면 ${page+1}">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${sky}"/><stop offset="1" stop-color="#fff9e5"/></linearGradient></defs>
    <rect width="900" height="520" fill="url(#sky)"/>
    <circle cx="727" cy="85" r="54" fill="${sun}" opacity=".85"/>
    ${svgCloud(190,83,.85)}${svgCloud(480,60,.7)}
    <path d="M0 315 Q170 225 345 320 Q580 224 900 314 V520 H0Z" fill="#b4dca2"/>
    <path d="M0 378 Q225 306 490 400 Q690 340 900 378 V520 H0Z" fill="#85c990"/>
    ${svgTree(76,397,.75)}${svgTree(852,414,.67)}
    <path d="M0 468 Q170 420 370 473 Q570 444 900 476 V520 H0Z" fill="#83bc82" opacity=".75"/>
    <g opacity=".9"><circle cx="388" cy="469" r="7" fill="#fff9db"/><circle cx="394" cy="468" r="4" fill="#f6b7c0"/><circle cx="616" cy="478" r="7" fill="#fff9db"/><circle cx="120" cy="478" r="6" fill="#ffdaaa"/></g>
    ${houseSvg}
    ${pigs}
    ${wolf}
    ${c==='wind'?`<g stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".65"><path d="M650 175 q80-25 180 0"/><path d="M615 205 q130 20 225-12"/></g>`:''}
  </svg>`;
}
function renderBook(){
  storyPageToken++;const item=STORY[page];
  $('#storyStage').innerHTML=generateScene(item);
  $('#pageHeading').textContent=item.title;
  $('#storyText').textContent=item.text;
  $('#pageNumber').textContent=`${page+1} / ${STORY.length}`;
  $('#bookProgress').textContent=STORY.map((_,i)=>i===page?'●':'○').join(' ');
  $('#prevPage').disabled=page===0;$('#nextPage').disabled=page===STORY.length-1;
  $('#speechHint').textContent='페이지가 바뀌면 자동으로 읽어요. 한 페이지 약 25초 동안 천천히 살펴보세요.';
}
function readPage(){
  if(view!=='books')return;
  const token=storyPageToken;$('#speechHint').textContent='이야기를 읽고 있어요 ♪';
  talk(STORY[page].text,'ko-KR',()=>{if(view==='books'&&token===storyPageToken)$('#speechHint').textContent='그림을 콕콕 눌러보고, 준비되면 다음 장으로 넘겨요!'});
}
function toPage(delta){
  const next=Math.max(0,Math.min(STORY.length-1,page+delta));if(next===page)return;
  stopVoice();audioUnlock();page=next;renderBook();playForView();readPage();
}
$('#prevPage').addEventListener('click',()=>toPage(-1));$('#nextPage').addEventListener('click',()=>toPage(1));
$('#readPageButton').addEventListener('click',()=>{audioUnlock();readPage()});
$('#storyStage').addEventListener('click',e=>{
  const object=e.target.closest('[data-action]');if(!object)return;audioUnlock();
  const action=object.dataset.action;
  if(action==='pig'){
    beep(435,.11,'triangle',.055);beep(390,.13,'triangle',.045,.11);
    talk('꿀꿀! 안녕, 도아야!', 'ko-KR');notify('꿀꿀! 아기돼지가 인사해요');
  }
  else if(action==='wolf'){
    $('#storyOverlay').innerHTML='<span class="wolf-jump">🐺</span>';
    $('#storyOverlay').classList.add('active');
    beep(150,.4,'sawtooth',.025);beep(115,.32,'triangle',.025,.16);
    talk('크앙! 후우우!', 'ko-KR');notify('늑대가 커졌다가 작아져요!');
    setTimeout(()=>{$('#storyOverlay').classList.remove('active');$('#storyOverlay').innerHTML=''},950);
  }
  else if(action==='window'){
    object.classList.add('open');beep(640,.12,'sine',.04);talk('달칵, 창문이 열렸어요!', 'ko-KR');
    setTimeout(()=>object.classList.remove('open'),2100);
  }
  else if(action==='tree'){
    object.classList.add('rustle');$$('.leaf',object).forEach(leaf=>leaf.classList.add('falling'));
    beep(690,.12,'triangle',.03);beep(500,.19,'triangle',.023,.1);
    talk('사르르, 나뭇잎이 떨어져요!', 'ko-KR');
    setTimeout(()=>{object.classList.remove('rustle');$$('.leaf',object).forEach(leaf=>leaf.classList.remove('falling'))},1700);
  }
  else if(action==='house'){
    object.classList.add('rustle');beep(520,.1,'triangle',.04);setTimeout(()=>object.classList.remove('rustle'),850);
  }
});
// First tap anywhere (even on home) is a legal user gesture to unlock media on mobile.
document.addEventListener('pointerdown',()=>{audioUnlock();if(view!=='books'&&soundEnabled&&mainAudio.paused&&$('#pauseOverlay').hidden){mainAudio.play().catch(()=>{})}},{passive:true});
window.speechSynthesis?.addEventListener?.('voiceschanged',()=>{});
if('serviceWorker'in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}))}
$('#pauseOverlay').hidden=true;
renderWord();renderPuzzle();renderBook();
