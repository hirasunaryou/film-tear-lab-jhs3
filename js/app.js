'use strict';

const canvas = document.getElementById('sim');
const ctx = canvas.getContext('2d');

const W = 1000, H = 620;
const FILM = {x:55, y:88, w:890, h:420};
const CENTER = 302;
const START_X = 178;
const END_X = 910;

const $ = id => document.getElementById(id);
const ui = {
  autoMode:$('autoMode'), manualMode:$('manualMode'),
  start:$('start'), pause:$('pause'), oneStep:$('oneStep'), reset:$('reset'),
  speed:$('speed'), tough:$('tough'), returnForce:$('returnForce'), disorder:$('disorder'),
  speedOut:$('speedOut'), toughOut:$('toughOut'), returnOut:$('returnOut'), disorderOut:$('disorderOut'),
  stress:$('stress'), arrows:$('arrows'), slow:$('slow'),
  energyFill:$('energyFill'), energyValue:$('energyValue'),
  lengthValue:$('lengthValue'), ampValue:$('ampValue'), breakValue:$('breakValue'),
  stateText:$('stateText'), canvasHint:$('canvasHint')
};

let mode = 'auto';
let running = false;
let dragging = false;
let lastTime = performance.now();
let logicalScale = {x:1,y:1};

let crack, tip, finger, targetFingerX, energy, yVelocity, breaks, maxAmp;
let flash, finished, lastFingerX, fingerVelocity, centerCrossings;

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function valueLabel(v, kind){
  const n=+v;
  if(kind==='speed') return (n<35?'ゆっくり':n<70?'ふつう':'速い')+' '+n;
  if(kind==='tough') return (n<35?'破れやすい':n<70?'ふつう':'破れにくい')+' '+n;
  if(kind==='return') return (n<35?'弱い':n<70?'ふつう':'強い')+' '+n;
  return (n<20?'少ない':n<50?'中くらい':'多い')+' '+n;
}
function updateLabels(){
  ui.speedOut.textContent=valueLabel(ui.speed.value,'speed');
  ui.toughOut.textContent=valueLabel(ui.tough.value,'tough');
  ui.returnOut.textContent=valueLabel(ui.returnForce.value,'return');
  ui.disorderOut.textContent=valueLabel(ui.disorder.value,'disorder');
}
['speed','tough','returnForce','disorder'].forEach(k=>{
  ui[k].addEventListener('input',updateLabels);
});

function threshold(){
  return 68 + (+ui.tough.value)*0.82;
}
function reset(){
  running=false; dragging=false; finished=false;
  crack=[{x:86,y:CENTER},{x:126,y:CENTER},{x:START_X,y:CENTER}];
  tip={x:START_X,y:CENTER};
  finger={x:126,y:CENTER+3};
  targetFingerX=126;
  energy=0;
  // A tiny initial asymmetry. Real films are never perfectly symmetric.
  yVelocity=0.73 + (Math.random()-.5)*0.18;
  breaks=0; maxAmp=0; flash=0; fingerVelocity=0; lastFingerX=finger.x;
  centerCrossings=[];
  ui.canvasHint.classList.remove('hide');
  ui.canvasHint.textContent = mode==='auto' ? '「スタート」を押してください' : '青い指を右へスライド';
  updateReadout();
  draw();
}
function setMode(next){
  mode=next;
  ui.autoMode.classList.toggle('active',mode==='auto');
  ui.manualMode.classList.toggle('active',mode==='manual');
  reset();
}
ui.autoMode.onclick=()=>setMode('auto');
ui.manualMode.onclick=()=>setMode('manual');

function updateReadout(){
  const ratio=clamp(energy/threshold(),0,1);
  ui.energyFill.style.width=(ratio*100).toFixed(0)+'%';
  ui.energyValue.textContent=Math.round(ratio*100)+'%';
  ui.lengthValue.textContent=Math.max(0,Math.round(tip.x-START_X));
  ui.ampValue.textContent=Math.round(maxAmp);
  ui.breakValue.textContent=breaks;
}
function stateMessage(){
  const r=energy/threshold();
  const offset=tip.y-CENTER;
  if(finished) return 'フィルムの端まで破れました。条件を1つ変えて、波形を比べてみましょう。';
  if(flash>.02) return 'パチッ！　限界を超え、新しい「破れの先端」ができました。';
  if(r>.78) return 'もうすぐ限界です。切り込みの先端に、変形エネルギーが集まっています。';
  if(Math.abs(offset)>18){
    return offset>0
      ? '先端が下側へ寄ったので、上側へ戻そうとする働きが強くなっています。'
      : '先端が上側へ寄ったので、下側へ戻そうとする働きが強くなっています。';
  }
  return mode==='manual'
    ? '青い指を右へ動かすと、フィルムに変形エネルギーがたまります。'
    : '指が進み、フィルムに変形エネルギーがたまっています。';
}

function gaussianNoise(){
  return (Math.random()+Math.random()+Math.random()+Math.random()-2);
}

function growCrack(forceOne=false){
  if(finished) return false;
  const speedN=(+ui.speed.value)/100;
  const toughN=(+ui.tough.value)/100;
  const returnN=(+ui.returnForce.value)/100;
  const disorderN=(+ui.disorder.value)/80;

  if(!forceOne && energy < threshold()) return false;

  const dx=4.3 + speedN*2.8 + (1-toughN)*0.8;
  const offset=tip.y-CENTER;

  // A simple under-damped feedback model:
  // when the tip is on one side, the opposite direction becomes favored,
  // but the direction does not switch instantly, so the tip overshoots.
  const spring=0.00018 + returnN*0.00072;
  const damping=0.0010 + (1-speedN)*0.0018;
  yVelocity += (-spring*offset - damping*yVelocity)*dx;
  yVelocity += gaussianNoise()*disorderN*0.055;

  let newY=tip.y+yVelocity*dx;
  const upper=FILM.y+82, lower=FILM.y+FILM.h-78;
  if(newY<upper || newY>lower){
    newY=clamp(newY,upper,lower);
    yVelocity*=-0.55;
  }

  const prevOffset=offset;
  tip={x:Math.min(END_X,tip.x+dx),y:newY};
  crack.push({x:tip.x,y:tip.y});
  breaks++;
  maxAmp=Math.max(maxAmp,Math.abs(tip.y-CENTER));
  flash=.18;

  const newOffset=tip.y-CENTER;
  if(prevOffset!==0 && prevOffset*newOffset<0){
    centerCrossings.push(tip.x);
    if(centerCrossings.length>8) centerCrossings.shift();
  }

  if(!forceOne) energy=Math.max(0,energy-threshold()*(.88+Math.random()*.12));
  if(tip.x>=END_X){
    finished=true; running=false;
  }
  return true;
}

function simulate(dt){
  if(!running || finished) return;
  const slow=ui.slow.checked ? .28 : 1;
  dt*=slow;

  const speedN=(+ui.speed.value)/100;
  if(mode==='auto'){
    targetFingerX += (48+speedN*120)*dt;
    targetFingerX=clamp(targetFingerX,126,END_X-65);
  }
  const follow=Math.min(1,dt*13);
  finger.x += (targetFingerX-finger.x)*follow;
  finger.y = CENTER+3+Math.sin(performance.now()/650)*2.5;

  fingerVelocity=(finger.x-lastFingerX)/Math.max(dt,.001);
  lastFingerX=finger.x;

  const fingerFront=finger.x+76;
  const gap=Math.max(0,fingerFront-tip.x);
  const loading=(gap*24 + Math.max(0,fingerVelocity)*6.5)*(0.78+speedN*.45);
  energy+=loading*dt;
  energy=Math.min(energy,threshold()*1.8);

  let guard=0;
  while(energy>=threshold() && guard<5){
    growCrack(false);
    guard++;
  }
  flash=Math.max(0,flash-dt);
  updateReadout();
  ui.stateText.textContent=stateMessage();
}

function roundedRectPath(c,x,y,w,h,r){
  r=Math.min(r,w/2,h/2);
  c.beginPath();
  c.moveTo(x+r,y);
  c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);
  c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);
  c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);
  c.closePath();
}
function arrow(x1,y1,x2,y2,color,width=4){
  const a=Math.atan2(y2-y1,x2-x1);
  ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=width;
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2,y2);
  ctx.lineTo(x2-13*Math.cos(a-.45),y2-13*Math.sin(a-.45));
  ctx.lineTo(x2-13*Math.cos(a+.45),y2-13*Math.sin(a+.45));
  ctx.closePath();ctx.fill();
}
function drawFilm(){
  ctx.save();
  ctx.shadowColor='rgba(28,42,58,.20)';ctx.shadowBlur=22;ctx.shadowOffsetY=7;
  ctx.fillStyle='#fbfcfe';
  roundedRectPath(ctx,FILM.x,FILM.y,FILM.w,FILM.h,18);ctx.fill();
  ctx.restore();

  ctx.save();
  roundedRectPath(ctx,FILM.x,FILM.y,FILM.w,FILM.h,18);ctx.clip();
  ctx.strokeStyle='rgba(88,108,130,.10)';ctx.lineWidth=1;
  for(let x=FILM.x+24;x<FILM.x+FILM.w;x+=42){
    ctx.beginPath();ctx.moveTo(x,FILM.y);ctx.lineTo(x,FILM.y+FILM.h);ctx.stroke();
  }
  for(let y=FILM.y+24;y<FILM.y+FILM.h;y+=42){
    ctx.beginPath();ctx.moveTo(FILM.x,y);ctx.lineTo(FILM.x+FILM.w,y);ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle='#5a6978';ctx.font='700 18px sans-serif';
  ctx.fillText('薄いフィルム',FILM.x+24,FILM.y+35);
}
function drawStress(){
  if(!ui.stress.checked) return;
  const offset=tip.y-CENTER;
  const favoredY=tip.y-clamp(offset*1.1,-58,58);
  const g=ctx.createRadialGradient(tip.x,tip.y,4,tip.x,tip.y,76);
  g.addColorStop(0,'rgba(226,60,60,.92)');
  g.addColorStop(.28,'rgba(255,173,50,.50)');
  g.addColorStop(1,'rgba(255,173,50,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(tip.x,tip.y,76,0,Math.PI*2);ctx.fill();

  ctx.save();
  ctx.setLineDash([6,5]);ctx.strokeStyle='rgba(255,142,22,.80)';ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(tip.x+18,favoredY,30,0,Math.PI*2);ctx.stroke();
  ctx.restore();
  ctx.fillStyle='#a85a00';ctx.font='700 14px sans-serif';
  ctx.fillText('次に進みやすい側',tip.x+50,favoredY+5);
}
function drawCrack(){
  ctx.lineCap='round';ctx.lineJoin='round';

  ctx.strokeStyle='rgba(20,29,38,.30)';ctx.lineWidth=11;
  ctx.beginPath();crack.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();

  ctx.strokeStyle='#f8fafc';ctx.lineWidth=5.5;
  ctx.beginPath();crack.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();

  drawStress();

  ctx.fillStyle=flash>0?'#ff1f1f':'#e23c3c';
  ctx.beginPath();ctx.arc(tip.x,tip.y,8+(flash>0?4:0),0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#8d2020';ctx.font='800 15px sans-serif';
  ctx.fillText('破れの先端',tip.x+15,tip.y-13);
}
function drawFinger(){
  const x=finger.x,y=finger.y;
  ctx.save();ctx.translate(x,y);
  ctx.fillStyle='#dce9ff';ctx.strokeStyle='#2458d3';ctx.lineWidth=3;
  roundedRectPath(ctx,-31,-26,82,52,25);ctx.fill();ctx.stroke();
  ctx.fillStyle='#173e9e';ctx.font='800 15px sans-serif';ctx.fillText('指',-3,5);
  ctx.restore();

  if(ui.arrows.checked){
    arrow(x+52,y,tip.x-15,tip.y,'#2458d3',4);
    ctx.fillStyle='#173e9e';ctx.font='800 14px sans-serif';
    ctx.fillText('指からの力',x+48,y-22);
  }
}
function drawSideFeedback(){
  const offset=tip.y-CENTER;
  if(Math.abs(offset)<12) return;
  const targetY=offset>0?tip.y-62:tip.y+62;
  arrow(tip.x+3,tip.y,targetY===tip.y?tip.x:tip.x+8,targetY,'#16855b',3);
  ctx.fillStyle='#126b4c';ctx.font='700 13px sans-serif';
  ctx.fillText('反対側へ戻す働き',tip.x+20,targetY+(offset>0?-3:15));
}
function drawEnergySymbol(){
  const ratio=clamp(energy/threshold(),0,1);
  const x=FILM.x+FILM.w-175,y=FILM.y+26,w=140,h=16;
  ctx.fillStyle='#e5eaf0';roundedRectPath(ctx,x,y,w,h,8);ctx.fill();
  const grad=ctx.createLinearGradient(x,0,x+w,0);
  grad.addColorStop(0,'#49a878');grad.addColorStop(.65,'#ffad32');grad.addColorStop(1,'#e23c3c');
  ctx.fillStyle=grad;roundedRectPath(ctx,x,y,w*ratio,h,8);ctx.fill();
  ctx.strokeStyle='#8d2020';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(x+w,y-4);ctx.lineTo(x+w,y+h+4);ctx.stroke();
  ctx.fillStyle='#5a6978';ctx.font='700 12px sans-serif';
  ctx.fillText('限界',x+w-15,y+h+18);
}
function draw(){
  ctx.save();
  ctx.setTransform(logicalScale.x,0,0,logicalScale.y,0,0);
  ctx.clearRect(0,0,W,H);
  const bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#edf2f7');bg.addColorStop(1,'#dfe6ed');
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  drawFilm();
  drawCrack();
  drawSideFeedback();
  drawFinger();
  drawEnergySymbol();

  ctx.fillStyle='rgba(20,35,50,.88)';ctx.font='800 19px sans-serif';
  ctx.fillText('起きた変化が、次の力のかかり方を変える ＝ フィードバック',75,562);
  ctx.fillStyle='#5b6977';ctx.font='14px sans-serif';
  ctx.fillText('※ 波形は教育用モデルの計算結果です。',75,588);
  ctx.restore();
}
function resizeCanvas(){
  const rect=canvas.getBoundingClientRect();
  const dpr=Math.min(window.devicePixelRatio||1,2.5);
  canvas.width=Math.max(1,Math.round(rect.width*dpr));
  canvas.height=Math.max(1,Math.round(rect.height*dpr));
  logicalScale={x:canvas.width/W,y:canvas.height/H};
  draw();
}
window.addEventListener('resize',resizeCanvas);

function logicalPoint(ev){
  const r=canvas.getBoundingClientRect();
  return {x:(ev.clientX-r.left)*W/r.width,y:(ev.clientY-r.top)*H/r.height};
}
canvas.addEventListener('pointerdown',ev=>{
  if(mode!=='manual') setMode('manual');
  dragging=true;running=true;finished=false;
  canvas.setPointerCapture?.(ev.pointerId);
  const p=logicalPoint(ev);
  targetFingerX=clamp(p.x-15,126,END_X-65);
  ui.canvasHint.classList.add('hide');
  ev.preventDefault();
});
canvas.addEventListener('pointermove',ev=>{
  if(!dragging) return;
  const p=logicalPoint(ev);
  targetFingerX=clamp(p.x-15,126,END_X-65);
  ev.preventDefault();
});
function stopDrag(ev){
  if(!dragging) return;
  dragging=false;running=false;
  try{canvas.releasePointerCapture?.(ev.pointerId)}catch(e){}
}
canvas.addEventListener('pointerup',stopDrag);
canvas.addEventListener('pointercancel',stopDrag);

ui.start.onclick=()=>{
  if(finished) reset();
  running=true;
  ui.canvasHint.classList.add('hide');
};
ui.pause.onclick=()=>{running=false;};
ui.oneStep.onclick=()=>{
  running=false;
  energy=threshold();
  growCrack(true);
  energy=0;
  updateReadout();ui.stateText.textContent=stateMessage();draw();
};
ui.reset.onclick=reset;

document.querySelectorAll('.preset').forEach(btn=>{
  btn.onclick=()=>{
    const p=btn.dataset.preset;
    if(p==='standard'){ui.speed.value=55;ui.tough.value=55;ui.returnForce.value=52;ui.disorder.value=16;}
    if(p==='tough'){ui.speed.value=55;ui.tough.value=88;ui.returnForce.value=52;ui.disorder.value=12;}
    if(p==='uneven'){ui.speed.value=55;ui.tough.value=55;ui.returnForce.value=48;ui.disorder.value=68;}
    updateLabels();reset();
  };
});
document.querySelectorAll('.reveal').forEach(btn=>{
  btn.onclick=()=>{
    const ans=btn.nextElementSibling;
    ans.classList.toggle('show');
    btn.textContent=ans.classList.contains('show')?'考え方を閉じる':'考え方を見る';
  };
});

function loop(now){
  const dt=Math.min(.04,(now-lastTime)/1000);
  lastTime=now;
  simulate(dt);
  draw();
  requestAnimationFrame(loop);
}

updateLabels();
reset();
resizeCanvas();
requestAnimationFrame(loop);

// Works as an ordinary page without this. When hosted over HTTPS, cache it for app-like use.
if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
