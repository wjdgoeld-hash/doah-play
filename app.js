/* Doah Play v0.4 - enhanced interactive story art + private voice recordings. */
'use strict';
const $ = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>[...root.querySelectorAll(s)];
const views=$$('.view');
const mainAudio=$('#mainMusic'), storyAudio=$('#storyMusic'), narrationAudio=$('#narrationAudio');
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
function stopVoice(){voiceToken++;clearTimeout(voiceTimer);narrationAudio.pause();if('speechSynthesis'in window)window.speechSynthesis.cancel();duckAudio(false);unlockWord()}
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
// --- Doah Play v0.4 premium interactive storybook (original, generated art) ---
const STORY=[
 {title:'엄마 돼지의 부탁',text:'옛날 옛날, 푸른 언덕에 아기돼지 삼형제가 살았어요. 어느 날 엄마 돼지가 말했어요. “얘들아, 이제 너희만의 집을 만들어 보렴!” 아기돼지들은 씩씩하게 대답했지요. “네, 엄마!”',mood:'봄날의 따뜻한 시작'},
 {title:'첫째의 폭신폭신 짚집',text:'첫째 돼지는 노랗고 폭신한 짚을 발견했어요. 사각사각, 바스락바스락! 짚을 한 아름 모아 집을 뚝딱 지었답니다. “야호! 내 집 완성!” 하지만 바람이 불 때마다 짚집이 살랑살랑 흔들렸어요.',mood:'햇살 아래 즐거운 집짓기'},
 {title:'둘째의 나뭇가지 집',text:'둘째 돼지는 숲에서 길쭉한 나뭇가지를 모았어요. 톡톡, 딱딱, 뚝딱뚝딱! 가지를 세우고 지붕까지 얹으니 집이 완성되었어요. “정말 멋지지?” 그런데 바람이 불자 집이 삐걱삐걱 흔들렸답니다.',mood:'숲속에서 뚝딱뚝딱'},
 {title:'셋째의 단단한 벽돌집',text:'셋째 돼지는 빨갛고 단단한 벽돌을 골랐어요. 영차, 영차! 무거워도 차근차근 쌓아 올렸답니다. 드디어 문과 창문까지 달린 튼튼한 벽돌집이 완성되었어요. 그런데 숲속에서 누군가 슬금슬금 다가오고 있었어요.',mood:'차근차근, 튼튼하게'},
 {title:'늑대와 첫째의 짚집',text:'배고픈 늑대가 첫째 돼지의 짚집에 나타났어요. “어서 문을 열어라!” “절대로 안 열어줄 거예요!” 늑대가 후우우 하고 바람을 불자 짚집이 와르르 무너졌어요. 첫째 돼지는 얼른 둘째의 집으로 달려갔답니다.',mood:'후우우! 바람이 불어요'},
 {title:'늑대와 둘째의 나뭇가지 집',text:'첫째와 둘째 돼지는 나뭇가지 집에 숨었어요. 하지만 늑대가 쿵쿵쿵 따라왔지요. “문을 열어라!” “싫어요!” 늑대가 후우우 하고 바람을 불자 나뭇가지가 우르르 무너졌어요. 두 돼지는 셋째의 벽돌집으로 달려갔어요.',mood:'쿵쿵! 와르르!'},
 {title:'벽돌집은 끄떡없어요!',text:'세 돼지는 튼튼한 벽돌집 안으로 들어갔어요. 늑대가 있는 힘껏 후우우! 불고 또 불었어요. 하지만 벽돌집은 끄떡도 하지 않았지요. “어라? 이럴 리가 없는데!” 늑대는 지쳐서 숲으로 돌아가고 말았답니다.',mood:'튼튼한 벽돌집의 승리'},
 {title:'삼형제의 행복한 하루',text:'늑대가 떠나자 돼지 삼형제는 서로를 꼭 안아주었어요. “우리 함께라서 정말 다행이야!” 서로 돕고, 서두르지 않고 정성껏 하는 것이 중요하다는 걸 배웠답니다. 도아야, 이야기가 재미있었니? 꿀꿀꿀! 끝!',mood:'웃음과 사랑 가득한 집'}
];
const HOTSPOTS=[
 [ ['pig',30,54,50,38,'아기돼지 삼형제'],['tree',81,18,17,47,'나무'],['bird',8,18,18,15,'새'] ],
 [ ['pig',63,56,32,41,'첫째 돼지'],['window',32,44,17,16,'짚집 창문'],['house',19,28,42,48,'짚집'],['flower',8,81,17,13,'꽃'],['tree',84,9,16,40,'나무'] ],
 [ ['pig',54,56,33,40,'둘째 돼지'],['window',20,47,16,15,'나무집 창문'],['house',7,34,46,48,'나뭇가지 집'],['tree',84,15,16,44,'나무'],['bird',57,20,16,14,'새'] ],
 [ ['pig',55,55,35,42,'셋째 돼지'],['window',35,44,17,15,'벽돌집 창문'],['house',12,24,48,50,'벽돌집'],['flower',7,79,18,12,'꽃'],['tree',85,14,15,40,'나무'] ],
 [ ['wolf',14,35,34,43,'늑대'],['pig',73,67,23,26,'첫째 돼지'],['house',53,39,46,50,'무너지는 짚집'],['wind',43,40,22,16,'바람'],['tree',80,8,18,39,'나무'] ],
 [ ['wolf',10,35,34,41,'늑대'],['pig',75,62,24,29,'아기돼지'],['house',50,39,47,49,'흔들리는 나무집'],['wind',40,40,22,18,'바람'],['tree',84,11,15,38,'나무'] ],
 [ ['wolf',66,42,32,43,'늑대'],['pig',22,57,35,34,'아기돼지들'],['window',36,42,18,16,'벽돌집 창문'],['house',11,25,49,60,'튼튼한 벽돌집'],['wind',53,43,18,15,'바람'],['tree',85,15,15,35,'나무'] ],
 [ ['pig',21,52,64,42,'아기돼지 삼형제'],['window',72,28,19,19,'집 안의 창문'],['flower',80,79,14,14,'꽃'],['bird',12,18,15,15,'새'],['teapot',69,69,18,14,'찻주전자'] ]
];
const actionIcons={pig:'🐽',wolf:'🐺',window:'🪟',house:'🏠',wind:'💨',tree:'🍃',flower:'🌸',bird:'🐦',teapot:'🫖'};
let page=0,storyPageToken=0,storyOpenWindow=null,sceneTimer=0;
const storyNarration=$('#narrationAudio');
let narrationSerial=0;
function storyFx(action){
  if(action==='pig'){beep(310,.13,'triangle',.04);beep(365,.16,'triangle',.035,.1)}
  else if(action==='wolf'){beep(180,.33,'sawtooth',.025);beep(150,.22,'triangle',.02,.17)}
  else if(action==='window'){beep(540,.09,'sine',.037);beep(705,.12,'sine',.025,.08)}
  else if(action==='tree'){[950,710,540].forEach((n,i)=>beep(n,.11,'sine',.019,i*.10))}
  else if(action==='wind'){[300,230,160].forEach((n,i)=>beep(n,.25,'triangle',.022,i*.10))}
  else if(action==='house'){beep(260,.12,'triangle',.03);beep(315,.16,'triangle',.02,.13)}
  else{beep(725,.15,'sine',.022);beep(990,.1,'sine',.016,.10)}
}
function closeWindow(){storyOpenWindow?.remove();storyOpenWindow=null}
function closeWolfPeek(){const el=$('#storyOverlay');el.classList.remove('active');el.innerHTML=''}
function makeParticles(kind,x,y,n=10){
  const stage=$('#storyStage'); if(!stage)return;
  const characters=kind==='leaf'?['🍃','🍂','🍁']:kind==='straw'?['〰','🌾','🍂']:kind==='wood'?['🪵','🍂','〰']:kind==='petal'?['🌸','🌼','✨']:['✨','🌟','⭐'];
  for(let i=0;i<n;i++){
    const span=document.createElement('span'); span.className='book-particle';span.textContent=characters[i%characters.length];
    const dx=(Math.random()-.5)*150,dy=(Math.random()-.5)*90;
    span.style.cssText=`left:${x}%;top:${y}%;--dx:${dx}px;--dy:${dy}px;--rot:${(Math.random()-.5)*680}deg;animation-duration:${.9+Math.random()*.8}s`;
    stage.append(span);span.addEventListener('animationend',()=>span.remove(),{once:true});
  }
}
function showActionMessage(text,x=50,y=48){
  const stage=$('#storyStage'); const el=document.createElement('span');el.className='book-action-bubble';el.textContent=text;
  el.style.left=Math.min(76,Math.max(15,x))+'%';el.style.top=Math.min(83,Math.max(12,y))+'%';stage.append(el);
  el.addEventListener('animationend',()=>el.remove(),{once:true});
  $('#bookActionCaption').textContent=text;
}
function insideRoomSvg(kind){
  const palette=kind==='straw'?['#fff1b6','#e8ba77','#ffe7aa']:kind==='wood'?['#ffe5bb','#ac714f','#e9c492']:['#ffe7ca','#b56c59','#f7e5cd'];
  return `<svg viewBox="0 0 360 260" role="img" aria-label="열린 창문 안, 따뜻한 집 안의 식탁과 가구" xmlns="http://www.w3.org/2000/svg">
   <defs><linearGradient id="wallroom" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${palette[0]}"/><stop offset="1" stop-color="${palette[2]}"/></linearGradient></defs>
   <rect width="360" height="260" fill="url(#wallroom)"/><path d="M0 185H360V260H0Z" fill="${palette[1]}" opacity=".42"/>
   <path d="M0 185H360" stroke="#b17b57" stroke-width="7"/>
   <rect x="21" y="34" width="115" height="104" rx="8" fill="#c98d5d"/><rect x="29" y="42" width="99" height="87" rx="3" fill="#fff3ce"/>
   <path d="M79 42V129M29 86H128" stroke="#bd7b45" stroke-width="8"/>
   <path d="M34 125Q68 111 82 125Q111 105 126 120" fill="#9bd7a0"/>
   <rect x="224" y="55" width="112" height="11" rx="4" fill="#875c44"/><rect x="227" y="85" width="104" height="10" rx="4" fill="#875c44"/>
   <rect x="239" y="27" width="24" height="29" rx="5" fill="#93b3d6"/><rect x="271" y="35" width="18" height="20" rx="3" fill="#f08f8e"/><rect x="299" y="35" width="24" height="20" rx="5" fill="#a7c98a"/>
   <path d="M242 85V68Q255 57 267 68V85" fill="#d8925a"/><circle cx="318" cy="79" r="7" fill="#e8d47c"/>
   <rect x="133" y="170" width="154" height="16" rx="6" fill="#926348"/><path d="M150 184V241M271 184V241" stroke="#845c43" stroke-width="13" stroke-linecap="round"/>
   <ellipse cx="210" cy="167" rx="41" ry="12" fill="#fff4df"/><path d="M207 155q-25-4-13-15q-2-15 12-14q17-7 20 17q8 8-1 13" fill="#ebb15d"/><path d="M205 140q10 8 18 2" fill="none" stroke="#cb8e48" stroke-width="3"/>
   <g transform="translate(59,194)"><path d="M0 49V17Q5 0 35 0H75Q100 1 100 17V49" fill="#d79e80" stroke="#a66c62" stroke-width="6"/><rect x="-2" y="28" width="104" height="43" rx="10" fill="#f2c7a6"/><path d="M17 68V80M86 68V80" stroke="#885d45" stroke-width="9"/></g>
   <circle cx="298" cy="148" r="21" fill="#e8bc76"/><path d="M296 129v39" stroke="#c58d47" stroke-width="5"/><circle cx="300" cy="145" r="10" fill="#ffe9aa"/>
   <path d="M178 19l-8 19h16z" fill="#f6e2a2"/><path d="M178 38V51" stroke="#a37656" stroke-width="4"/>
  </svg>`;
}
function openWindow(hotspot){
  if(storyOpenWindow){closeWindow();return}
  const stage=$('#storyStage');const kind=page===1?'straw':page===2||page===5?'wood':'brick';
  const el=document.createElement('div');el.className='window-detail-panel';el.setAttribute('role','dialog');el.setAttribute('aria-label','집 안을 보여주는 열린 창문');
  const x=Number(hotspot.style.left.replace('%','')),y=Number(hotspot.style.top.replace('%',''));
  el.style.left=Math.max(4,Math.min(56,x-4))+'%';el.style.top=Math.max(6,Math.min(57,y-14))+'%';
  el.innerHTML=`<div class="interior-window"><div class="room-scene">${insideRoomSvg(kind)}</div><div class="shutter shutter-left"></div><div class="shutter shutter-right"></div><button class="window-close" type="button" aria-label="창문 닫기">×</button><span class="window-label">달칵! 안에 뭐가 있을까요?</span></div>`;
  stage.append(el);storyOpenWindow=el; requestAnimationFrame(()=>el.classList.add('open'));
  el.querySelector('.window-close').addEventListener('click',e=>{e.stopPropagation();closeWindow();storyFx('window')});
  showActionMessage('달칵! 집 안이 보여요',x,y+4);storyFx('window');
}
function wolfZoom(){
  const overlay=$('#storyOverlay');overlay.innerHTML='<div class="wolf-cameo"><img src="wolf-peek.webp" alt="늑대가 불쑥 나타나요"/><span>크앙! 후우우!</span></div>';
  overlay.classList.add('active');
  const token=storyPageToken;
  setTimeout(()=>{if(token===storyPageToken)closeWolfPeek()},1250);
}
function windAction(){
  const stage=$('#storyStage');const house=stage.querySelector('.story-illustration');
  stage.classList.remove('wind-shake','brick-resists');void stage.offsetWidth;
  stage.classList.add(page===6?'brick-resists':'wind-shake');
  makeParticles(page===4?'straw':page===5?'wood':'leaf',60,50,15);
  showActionMessage(page===6?'튼튼한 벽돌집은 끄떡없어요!':'후우우! 바람이 휘잉!',51,43);
  clearTimeout(sceneTimer);sceneTimer=setTimeout(()=>stage.classList.remove('wind-shake','brick-resists'),1150);
}
function storyTap(action,hotspot){
  audioUnlock();if(action==='window'){openWindow(hotspot);return}
  storyFx(action);
  const x=parseFloat(hotspot.style.left)+4,y=parseFloat(hotspot.style.top)+3;
  if(action==='pig') {showActionMessage('꿀꿀! 안녕, 도아야!',x,y);makeParticles('sparkle',x,y,5)}
  else if(action==='wolf'){wolfZoom();showActionMessage('크앙! 늑대가 나타났어요!',x,y)}
  else if(action==='wind'){windAction()}
  else if(action==='house'){if(page>=4&&page<=6){windAction()}else {showActionMessage('튼튼하게 뚝딱뚝딱!',x,y);makeParticles('sparkle',x,y,7)}}
  else if(action==='tree'){showActionMessage('사르르~ 나뭇잎이 떨어져요',x,y);makeParticles('leaf',x,y,13);hotspot.classList.add('jiggle');setTimeout(()=>hotspot.classList.remove('jiggle'),650)}
  else if(action==='flower'){showActionMessage('꽃이 활짝 피었어요!',x,y);makeParticles('petal',x,y,11)}
  else if(action==='bird'){showActionMessage('짹짹! 새가 노래해요',x,y);makeParticles('sparkle',x,y,8)}
  else if(action==='teapot'){showActionMessage('따뜻한 차가 준비됐어요!',x,y);makeParticles('sparkle',x,y,8)}
}
function renderBook(){
  storyPageToken++;closeWindow();closeWolfPeek();clearTimeout(sceneTimer);
  const item=STORY[page],stage=$('#storyStage');stage.classList.remove('wind-shake','brick-resists');
  stage.innerHTML=`<img class="story-illustration" src="story-art-${page+1}.webp" alt="${item.title}" draggable="false"><span class="story-shimmer" aria-hidden="true"></span>`;
  for(const [action,x,y,w,h,label] of HOTSPOTS[page]){
    const hotspot=document.createElement('button');hotspot.type='button';hotspot.className='story-hotspot';hotspot.setAttribute('aria-label',label+' 눌러보기');
    hotspot.dataset.action=action;hotspot.style.cssText=`left:${x}%;top:${y}%;width:${w}%;height:${h}%;`;
    const marker=document.createElement('span');marker.className='story-hotspot-marker';marker.textContent=actionIcons[action];hotspot.append(marker);stage.append(hotspot);
    hotspot.addEventListener('click',e=>{e.stopPropagation();storyTap(action,hotspot)})
  }
  $('#pageHeading').textContent=item.title;$('#storyText').textContent=item.text;
  $('#pageNumber').textContent=`${page+1} / ${STORY.length}`;
  $('#bookProgress').textContent=STORY.map((_,i)=>i===page?'●':'○').join(' ');
  $('#prevPage').disabled=page===0;$('#nextPage').disabled=page===STORY.length-1;
  $('#bookActionCaption').textContent='✨ 반짝이는 그림을 눌러보세요 · 창문을 열면 집 안이 보여요';
  $('#speechHint').textContent='직접 녹음한 이야기를 들려드릴게요. 다른 그림을 눌러도 낭독은 계속돼요.';
}
function readPage(){
  if(view!=='books')return;
  const token=storyPageToken,serial=++narrationSerial;
  if('speechSynthesis'in window)window.speechSynthesis.cancel();
  storyNarration.pause();storyNarration.src=`narration-${String(page+1).padStart(2,'0')}.mp3`;storyNarration.load();
  $('#speechHint').textContent='🎙 도아를 위한 가족 목소리로 읽어드리고 있어요';
  duckAudio(true);
  storyNarration.onended=()=>{if(view==='books'&&token===storyPageToken&&serial===narrationSerial){duckAudio(false);$('#speechHint').textContent='다 읽었어요! 그림을 눌러보고 다음 장으로 넘겨요.'}};
  storyNarration.onerror=()=>{if(view==='books'&&token===storyPageToken&&serial===narrationSerial){duckAudio(false);$('#speechHint').textContent='녹음 재생에 문제가 있어 다시 읽기를 눌러주세요.'}};
  const p=storyNarration.play();if(p?.catch)p.catch(()=>{if(view==='books'&&token===storyPageToken&&serial===narrationSerial){duckAudio(false);$('#speechHint').textContent='▶ 다시 읽기를 눌러 음성을 시작해 주세요.'}});
}
function toPage(delta){
  const next=Math.max(0,Math.min(STORY.length-1,page+delta));if(next===page)return;
  stopVoice();page=next;renderBook();playForView();readPage();
  // iPad/Android: keep page top near the illustration, preserving direct interaction.
  document.querySelector('.book-heading')?.scrollIntoView({block:'start',behavior:'smooth'});
}
$('#prevPage').addEventListener('click',()=>toPage(-1));$('#nextPage').addEventListener('click',()=>toPage(1));
$('#readPageButton').addEventListener('click',()=>{audioUnlock();readPage()});

// First tap anywhere (even on home) is a legal user gesture to unlock media on mobile.
document.addEventListener('pointerdown',()=>{audioUnlock();if(view!=='books'&&soundEnabled&&mainAudio.paused&&$('#pauseOverlay').hidden){mainAudio.play().catch(()=>{})}},{passive:true});
window.speechSynthesis?.addEventListener?.('voiceschanged',()=>{});
if('serviceWorker'in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}))}
$('#pauseOverlay').hidden=true;
renderWord();renderPuzzle();renderBook();
