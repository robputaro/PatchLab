const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const NOTES=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const SCALES={minor:[0,2,3,5,7,8,10],major:[0,2,4,5,7,9,11],dorian:[0,2,3,5,7,9,10],pentatonic:[0,3,5,7,10],chromatic:[0,1,2,3,4,5,6,7,8,9,10,11],phrygian:[0,1,3,5,7,8,10]};
const KEYMAP=["a","w","s","e","d","f","t","g","y","h","u","j","k"];
const ROUTE_COLORS=["#d9ff55","#ff7540","#61d4ff","#ec66ff","#ffd166","#7cf29c"];
const COMPATIBLE={
  "lead-out":["filter-in","fx-in","master-in"],
  "bass-out":["filter-in","fx-in","master-in"],
  "lfo-out":["pitch-in","cutoff-in"],
  "fx-out":["master-in"]
};
const DEFAULT_ROUTES=[
  {from:"lead-out",to:"filter-in"},
  {from:"bass-out",to:"filter-in"},
  {from:"lfo-out",to:"cutoff-in"},
  {from:"fx-out",to:"master-in"}
];
let patchCount=1,playing=false,currentStep=0,nextNoteTime=0,timer=null,audio=null,recording=false,recorder=null,chunks=[],selectedJack=null;
let patch={
  id:"001",name:"DUST MEMORY",root:2,scale:"minor",bpm:92,steps:[],
  voices:{lead:true,bass:true,drums:true,drone:false},
  preset:"generative",routes:[...DEFAULT_ROUTES],
  modifiers:{unison:true,sub:false,fm:false,filter:true,keytrack:false,samplehold:false,delay:true,chorus:false,crush:false,saturate:false,limiter:true,wide:false,duck:false},
  promptProfile:{}
};

function seedHash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return Math.abs(h)}
function noteName(m){return NOTES[m%12]+(Math.floor(m/12)-1)}
function midiFreq(m){return 440*Math.pow(2,(m-69)/12)}
function val(id){return +$("#"+id).value}
function toast(t){let e=$("#toast");e.textContent=t;e.classList.add("show");clearTimeout(e.t);e.t=setTimeout(()=>e.classList.remove("show"),1400)}
function safeName(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
function titleFor(prompt){const a=["DUST","NEON","FROZEN","RUSTED","LUNAR","HIDDEN","BROKEN","VELVET","STATIC","EMBER"],b=["MEMORY","MACHINE","SIGNAL","RITUAL","ORBIT","CURRENT","ECHO","ENGINE","GARDEN","PRESSURE"];let h=seedHash(prompt);return a[h%a.length]+" "+b[(h>>3)%b.length]}
function hasRoute(from,to){return patch.routes.some(r=>r.from===from&&r.to===to)}
function routedFrom(from){return patch.routes.some(r=>r.from===from)}
function routedTo(to){return patch.routes.some(r=>r.to===to)}
function setControl(id,v){const e=$("#"+id);if(e)e.value=v}

function analyzePrompt(raw){
  const p=raw.toLowerCase();
  let profile={tokens:[],preset:patch.preset||"generative",density:.52,brightness:.5,movement:.45,space:.35,aggression:.2,syncopation:.25,tempo:null,scale:null,root:null,drums:true,bass:true,drone:false};
  const apply=(words,fn,label)=>{if(words.some(w=>p.includes(w))){fn();profile.tokens.push(label)}};
  apply(["ambient","drone","ethereal","floating","spacious"],()=>{profile.preset="ambient";profile.density=.28;profile.space=.8;profile.movement=.25;profile.drone=true},"AMBIENT");
  apply(["techno","club","four on the floor","4 on the floor","dancefloor"],()=>{profile.preset="techno";profile.density=.72;profile.aggression=.55;profile.syncopation=.12;profile.tempo=128},"TECHNO");
  apply(["industrial","harsh","metallic","machine","mechanical"],()=>{profile.preset="industrial";profile.aggression=.85;profile.brightness=.35;profile.movement=.65},"INDUSTRIAL");
  apply(["generative","random","evolving","unpredictable"],()=>{profile.preset="generative";profile.movement=.85;profile.syncopation=.65},"GENERATIVE");
  apply(["dark","moody","ominous","brooding"],()=>{profile.brightness=.2;profile.scale="phrygian"},"DARK");
  apply(["bright","shimmering","sparkling","glassy"],()=>{profile.brightness=.85;profile.scale="major"},"BRIGHT");
  apply(["warm","dusty","tape","vintage","lofi","lo-fi"],()=>{profile.brightness=.35;profile.space=.5},"WARM / LO-FI");
  apply(["glitch","glitchy","broken","stuttering","chopped"],()=>{profile.syncopation=.85;profile.density=.65;profile.movement=.75},"GLITCH");
  apply(["minimal","sparse","empty"],()=>{profile.density=.18;profile.space=.6},"MINIMAL");
  apply(["busy","dense","rapid","hyper"],()=>{profile.density=.88;profile.movement=.7},"DENSE");
  apply(["heavy","massive","huge","deep bass","sub bass"],()=>{profile.bass=true;profile.aggression=Math.max(profile.aggression,.65)},"HEAVY");
  apply(["no drums","without drums","drumless"],()=>profile.drums=false,"NO DRUMS");
  apply(["no bass","without bass"],()=>profile.bass=false,"NO BASS");
  apply(["slow"],()=>profile.tempo=65,"SLOW");
  apply(["fast","upbeat"],()=>profile.tempo=145,"FAST");
  const bpm=p.match(/\b([4-9]\d|1\d\d)\s*bpm\b/);if(bpm){profile.tempo=Math.max(45,Math.min(190,+bpm[1]));profile.tokens.push(profile.tempo+" BPM")}
  const roots={"c#":1,"db":1,"d#":3,"eb":3,"f#":6,"gb":6,"g#":8,"ab":8,"a#":10,"bb":10,"c":0,"d":2,"e":4,"f":5,"g":7,"a":9,"b":11};
  const rootMatch=p.match(/\b(?:in|key of)\s+(c#|db|d#|eb|f#|gb|g#|ab|a#|bb|c|d|e|f|g|a|b)\b/);
  if(rootMatch){profile.root=roots[rootMatch[1]];profile.tokens.push("KEY "+rootMatch[1].toUpperCase())}
  for(const s of Object.keys(SCALES)){if(p.includes(s)){profile.scale=s;profile.tokens.push(s.toUpperCase())}}
  if(!profile.tokens.length)profile.tokens=["OPEN INTERPRETATION"];
  return profile;
}
function makePattern(profile,h){
  const root=profile.root??h%12,scaleName=profile.scale||(profile.preset==="ambient"?"pentatonic":profile.preset==="industrial"?"chromatic":profile.preset==="techno"?"minor":"dorian");
  const scale=SCALES[scaleName],base=48+root,steps=[];
  for(let i=0;i<16;i++){
    let active=Math.random()<profile.density;
    if(profile.preset==="techno"&&i%2===0)active=true;
    if(profile.preset==="ambient")active=i%4===0||(i===10&&profile.density>.2);
    if(profile.syncopation>.7&&[3,6,7,11,14,15].includes(i))active=Math.random()<.8;
    const degree=(h+i*7+Math.floor(profile.movement*17*i))%scale.length;
    let octave=(Math.random()<(profile.brightness*.4+.25)?12:0);
    if(profile.aggression>.7&&i%4===0)octave=0;
    steps.push({active,midi:base+scale[degree]+octave,velocity:.4+Math.random()*.5});
  }
  return {steps,root,scaleName};
}
function initPatch(prompt="dusty generative loop"){
  const profile=analyzePrompt(prompt),h=seedHash(prompt),made=makePattern(profile,h);
  patch.id=String(patchCount++).padStart(3,"0");patch.name=titleFor(prompt);patch.promptProfile=profile;patch.preset=profile.preset;
  patch.root=made.root;patch.scale=made.scaleName;patch.steps=made.steps;patch.bpm=profile.tempo??(profile.preset==="ambient"?68+h%14:profile.preset==="techno"?124+h%10:profile.preset==="industrial"?100+h%24:84+h%22);
  patch.voices={lead:true,bass:profile.bass,drums:profile.drums,drone:profile.drone};
  patch.routes=[...DEFAULT_ROUTES];
  patch.modifiers={...patch.modifiers,unison:true,sub:profile.aggression>.55,fm:profile.aggression>.72,filter:true,keytrack:profile.brightness>.68,samplehold:profile.movement>.72,delay:profile.space>.18,chorus:profile.space>.6,crush:profile.syncopation>.72,saturate:profile.aggression>.5,limiter:true,wide:profile.space>.48,duck:profile.preset==="techno"};
  applyProfileSound(profile);syncUI();renderAll();
}
function applyProfileSound(p){
  setControl("waveMorph",p.aggression>.7?2:p.brightness>.7?3:p.preset==="ambient"?1:0);
  setControl("detune",5+p.space*18);setControl("attack",p.preset==="ambient"?.35:p.aggression>.6?.008:.04);setControl("release",.18+p.space*1.8);
  setControl("cutoff",400+p.brightness*5500);setControl("resonance",3+p.aggression*11);setControl("lfoRate",.08+p.movement*4.5);setControl("lfoDepth",180+p.movement*1100);
  setControl("delayTime",.12+p.space*.55);setControl("feedback",.15+p.space*.55);setControl("delayMix",.08+p.space*.58);setControl("drive",p.aggression*.72);
  setControl("swing",p.syncopation*.25);setControl("gate",p.preset==="ambient"?.82:p.aggression>.7?.28:.58);setControl("chaos",p.movement*.52);
}
function syncUI(){
  $("#root").value=patch.root;$("#scale").value=patch.scale;$("#bpm").value=patch.bpm;
  $$(".toggle").forEach(b=>{const on=patch.voices[b.dataset.voice];b.classList.toggle("active",on);b.textContent=on?"ON":"OFF"});
  $$(".modifier").forEach(b=>b.classList.toggle("active",!!patch.modifiers[b.dataset.mod]));
  renderPromptAnalysis();
}
function renderPromptAnalysis(){
  $("#promptAnalysis").innerHTML=(patch.promptProfile.tokens||[]).map(t=>`<span class="prompt-token applied">${t}</span>`).join("");
}
function renderAll(){$("#patchId").textContent=patch.id;$("#patchName").textContent=patch.name;$("#bpm").value=patch.bpm;renderSequencer();renderExplanation();updateVoiceStatus();renderRouting()}
function renderSequencer(){
  $("#stepNumbers").innerHTML=Array.from({length:16},(_,i)=>`<span>${i+1}</span>`).join("");
  $("#sequencer").innerHTML=patch.steps.map((s,i)=>`<div class="step ${s.active?"active":""}" data-i="${i}"><span class="note">${noteName(s.midi)}</span><div class="bar" style="height:${Math.max(8,s.velocity*88)}%"></div><span class="velocity">${Math.round(s.velocity*100)}</span></div>`).join("");
  $$(".step").forEach(el=>{let y,m;el.onpointerdown=e=>{y=e.clientY;m=patch.steps[+el.dataset.i].midi;el.setPointerCapture(e.pointerId)};el.onpointermove=e=>{if(y===undefined||Math.abs(e.clientY-y)<8)return;let i=+el.dataset.i,d=Math.round((y-e.clientY)/14);patch.steps[i].midi=Math.max(36,Math.min(84,m+d));el.querySelector(".note").textContent=noteName(patch.steps[i].midi)};el.onpointerup=e=>{let i=+el.dataset.i;if(Math.abs(e.clientY-y)<8)patch.steps[i].active=!patch.steps[i].active;y=undefined;renderSequencer()}})
}
function renderExplanation(){
  const p=patch.promptProfile,active=patch.steps.filter(s=>s.active).length,routes=patch.routes.length,mods=Object.entries(patch.modifiers).filter(x=>x[1]).map(x=>x[0]).join(", ");
  $("#explanation").textContent=`The prompt was interpreted as ${p.tokens.join(", ").toLowerCase()}. That produced a ${patch.scale} pattern in ${NOTES[patch.root]} at ${patch.bpm} BPM with ${active} active steps. ${routes} signal routes are live. Active layers are ${mods}. Changing or removing a cable alters modulation or which voices reach the filter, effects, and master bus.`;
  $("#dna").innerHTML=[`ROOT ${NOTES[patch.root]}`,patch.scale.toUpperCase(),`${patch.bpm} BPM`,`${active}/16 STEPS`,`${routes} ROUTES`].map(x=>`<span>${x}</span>`).join("");
}
function populateSelectors(){$("#root").innerHTML=NOTES.map((n,i)=>`<option value="${i}">${n}</option>`).join("");$("#scale").innerHTML=Object.keys(SCALES).map(s=>`<option>${s}</option>`).join("")}
function buildKeyboard(){const ms=[60,61,62,63,64,65,66,67,68,69,70,71,72];$("#keyboard").innerHTML=ms.map((m,i)=>`<button class="key ${NOTES[m%12].includes("#")?"black":""}" data-midi="${m}">${KEYMAP[i].toUpperCase()}</button>`).join("");$$(".key").forEach(k=>{k.onpointerdown=()=>{k.classList.add("down");triggerLead(+k.dataset.midi,audio?.ctx?.currentTime||0,.8)};k.onpointerup=()=>k.classList.remove("down")})}

function initAudio(){
  if(audio)return;const ctx=new (window.AudioContext||window.webkitAudioContext)(),master=ctx.createGain(),analyser=ctx.createAnalyser(),mediaDest=ctx.createMediaStreamDestination();
  const filter=ctx.createBiquadFilter(),delay=ctx.createDelay(1.5),feedback=ctx.createGain(),wet=ctx.createGain(),dry=ctx.createGain(),fxIn=ctx.createGain(),direct=ctx.createGain(),chorus=ctx.createDelay(.05),chorusLfo=ctx.createOscillator(),chorusDepth=ctx.createGain(),compressor=ctx.createDynamicsCompressor();
  filter.type="lowpass";analyser.fftSize=1024;chorus.delayTime.value=.018;chorusLfo.frequency.value=.35;chorusDepth.gain.value=.006;chorusLfo.connect(chorusDepth);chorusDepth.connect(chorus.delayTime);chorusLfo.start();
  fxIn.connect(dry);fxIn.connect(delay);delay.connect(feedback);feedback.connect(delay);delay.connect(wet);fxIn.connect(chorus);chorus.connect(wet);dry.connect(master);wet.connect(master);direct.connect(master);
  master.connect(compressor);compressor.connect(analyser);compressor.connect(mediaDest);analyser.connect(ctx.destination);
  const lfo=ctx.createOscillator(),lfoGain=ctx.createGain();lfo.start();
  audio={ctx,master,analyser,mediaDest,filter,delay,feedback,wet,dry,fxIn,direct,lfo,lfoGain,chorus,compressor,drone:null};updateAudioParams();drawScope()
}
function updateAudioParams(){if(!audio)return;let t=audio.ctx.currentTime;audio.master.gain.setTargetAtTime(val("master"),t,.03);audio.filter.frequency.setTargetAtTime(val("cutoff"),t,.03);audio.filter.Q.setTargetAtTime(val("resonance"),t,.03);audio.lfo.frequency.setTargetAtTime(val("lfoRate"),t,.03);audio.lfoGain.gain.setTargetAtTime(val("lfoDepth"),t,.03);audio.delay.delayTime.setTargetAtTime(val("delayTime"),t,.03);audio.feedback.gain.setTargetAtTime(patch.modifiers.delay?val("feedback"):0,t,.03);audio.wet.gain.setTargetAtTime(patch.modifiers.delay||patch.modifiers.chorus?val("delayMix"):0,t,.03);audio.dry.gain.setTargetAtTime(1-val("delayMix")*.25,t,.03);audio.compressor.threshold.value=patch.modifiers.limiter?-18:0}
function destinationFor(source){
  initAudio();
  if(source==="lead-out"||source==="bass-out"){
    if(hasRoute(source,"filter-in"))return audio.filter;
    if(hasRoute(source,"fx-in"))return audio.fxIn;
    if(hasRoute(source,"master-in"))return audio.direct;
    return null;
  }
  return audio.master;
}
function wave(){return ["sawtooth","triangle","square","sine"][Math.round(val("waveMorph"))]}
function shapeGain(g,time,peak,dur){const a=val("attack"),r=val("release");g.gain.setValueAtTime(.0001,time);g.gain.exponentialRampToValueAtTime(Math.max(.001,peak),time+Math.max(.005,a));g.gain.exponentialRampToValueAtTime(.0001,time+a+dur+r)}
function triggerLead(midi,time,velocity=.7){
  initAudio();const dest=destinationFor("lead-out");if(!dest)return;const {ctx}=audio,g=ctx.createGain(),oscs=[],count=patch.modifiers.unison?2:1;
  for(let i=0;i<count;i++){let o=ctx.createOscillator();o.type=wave();o.frequency.value=midiFreq(midi);o.detune.value=i?val("detune"):-val("detune")*.3;o.connect(g);o.start(time);oscs.push(o)}
  if(patch.modifiers.sub){let sub=ctx.createOscillator();sub.type="sine";sub.frequency.value=midiFreq(midi-12);sub.connect(g);sub.start(time);oscs.push(sub)}
  const dur=Math.max(.04,(60/patch.bpm/4)*val("gate")*3);shapeGain(g,time,velocity*val("leadVol")*.17,dur);g.connect(dest);oscs.forEach(o=>o.stop(time+val("attack")+dur+val("release")+.05))
}
function triggerBass(time,step){
  if(!patch.voices.bass||step%4!==0)return;const dest=destinationFor("bass-out");if(!dest)return;const {ctx}=audio,o=ctx.createOscillator(),g=ctx.createGain();o.type=patch.modifiers.saturate?"sawtooth":"square";o.frequency.value=midiFreq(36+patch.root);g.gain.setValueAtTime(.0001,time);g.gain.exponentialRampToValueAtTime(val("bassVol")*.18,time+.01);g.gain.exponentialRampToValueAtTime(.0001,time+.42);o.connect(g);g.connect(dest);o.start(time);o.stop(time+.45)
}
function kick(time){const {ctx,master}=audio,o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(145,time);o.frequency.exponentialRampToValueAtTime(42,time+.16);g.gain.setValueAtTime(val("drumVol")*.55,time);g.gain.exponentialRampToValueAtTime(.001,time+.22);o.connect(g);g.connect(hasRoute("lead-out","fx-in")&&patch.modifiers.duck?audio.fxIn:master);o.start(time);o.stop(time+.23)}
function hat(time){const {ctx,master}=audio,b=ctx.createBuffer(1,ctx.sampleRate*.045,ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(patch.modifiers.crush?(i%4===0?1:0):1);const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=b;f.type="highpass";f.frequency.value=6500;g.gain.setValueAtTime(val("drumVol")*.12,time);g.gain.exponentialRampToValueAtTime(.001,time+.045);s.connect(f);f.connect(g);g.connect(master);s.start(time)}
function scheduleStep(step,time){const s=patch.steps[step],chaos=val("chaos");if(patch.voices.lead&&s.active)triggerLead(s.midi,time,s.velocity*(1+(Math.random()-.5)*chaos*.35));if(patch.voices.drums){if(step%4===0)kick(time);if(step%2===0||Math.random()<chaos*.5)hat(time)}triggerBass(time,step);setTimeout(()=>{$$(".step").forEach(x=>x.classList.remove("playing"));document.querySelector(`.step[data-i="${step}"]`)?.classList.add("playing")},Math.max(0,(time-audio.ctx.currentTime)*1000))}
function scheduler(){while(nextNoteTime<audio.ctx.currentTime+.12){scheduleStep(currentStep,nextNoteTime);let s=60/patch.bpm/4;s*=currentStep%2?1+val("swing"):1-val("swing");nextNoteTime+=s;currentStep=(currentStep+1)%16}}
function start(){initAudio();audio.ctx.resume();if(playing)return;playing=true;currentStep=0;nextNoteTime=audio.ctx.currentTime+.05;timer=setInterval(scheduler,25);$("#playBtn").textContent="■";$("#nowPlaying").textContent="PLAYING";ensureDrone();toast("PERFORMANCE STARTED")}
function stop(){playing=false;clearInterval(timer);timer=null;$("#playBtn").textContent="▶";$("#nowPlaying").textContent="STOPPED";$$(".step").forEach(x=>x.classList.remove("playing"));stopDrone();toast("STOPPED")}
function ensureDrone(){if(!audio||!patch.voices.drone||audio.drone)return;const dest=destinationFor("lead-out")||audio.direct,o=audio.ctx.createOscillator(),g=audio.ctx.createGain();o.type="sine";o.frequency.value=midiFreq(36+patch.root);g.gain.value=val("droneVol")*.12;o.connect(g);g.connect(dest);o.start();audio.drone={o,g}}
function stopDrone(){if(audio?.drone){try{audio.drone.o.stop()}catch{}audio.drone=null}}
function randomize(){patch.steps.forEach(s=>{s.active=Math.random()>.38;s.midi=48+patch.root+SCALES[patch.scale][Math.floor(Math.random()*SCALES[patch.scale].length)]+(Math.random()>.55?12:0);s.velocity=.4+Math.random()*.55});renderAll();toast("SEQUENCE RANDOMIZED")}
function mutate(){patch.steps.forEach(s=>{if(Math.random()<.25){if(Math.random()<.45)s.active=!s.active;else s.midi=Math.max(36,Math.min(84,s.midi+(Math.random()>.5?2:-2)))}});renderAll();toast("PATCH MUTATED")}
function shift(dir){patch.steps=dir<0?[...patch.steps.slice(1),patch.steps[0]]:[patch.steps.at(-1),...patch.steps.slice(0,-1)];renderSequencer()}

function jackClick(jack){
  const id=jack.dataset.jack,isOut=jack.classList.contains("output");
  if(!selectedJack){
    if(!isOut){toast("SELECT AN OUTPUT FIRST");return}
    selectedJack=id;jack.classList.add("selected");$("#routingHint").textContent="NOW SELECT AN INPUT";return;
  }
  if(isOut){$$(".jack").forEach(j=>j.classList.remove("selected"));selectedJack=id;jack.classList.add("selected");return}
  const allowed=COMPATIBLE[selectedJack]||[];
  if(!allowed.includes(id)){toast("INCOMPATIBLE CONNECTION");return}
  const existing=patch.routes.findIndex(r=>r.from===selectedJack&&r.to===id);
  if(existing>=0)patch.routes.splice(existing,1);else patch.routes.push({from:selectedJack,to:id});
  selectedJack=null;$$(".jack").forEach(j=>j.classList.remove("selected"));$("#routingHint").textContent="SELECT AN OUTPUT JACK";renderRouting();restartAudioForRouting();toast(existing>=0?"CABLE REMOVED":"CABLE CONNECTED")
}
function renderRouting(){
  $$(".jack").forEach(j=>j.classList.toggle("connected",patch.routes.some(r=>r.from===j.dataset.jack||r.to===j.dataset.jack)));
  $("#routeStatus").innerHTML=patch.routes.map((r,i)=>`<button class="route-pill" data-route="${i}"><b>${r.from}</b> → ${r.to} ×</button>`).join("")||"<span class='route-pill'>NO ACTIVE ROUTES</span>";
  $$("[data-route]").forEach(b=>b.onclick=()=>{patch.routes.splice(+b.dataset.route,1);renderRouting();restartAudioForRouting();toast("CABLE REMOVED")});
  requestAnimationFrame(drawCables);renderExplanation()
}
function drawCables(){
  const svg=$("#cableLayer"),wrap=document.querySelector(".rack-wrap");if(!svg||!wrap)return;const wr=wrap.getBoundingClientRect();svg.setAttribute("viewBox",`0 0 ${wr.width} ${wr.height}`);svg.innerHTML="";
  patch.routes.forEach((r,i)=>{const a=document.querySelector(`[data-jack="${r.from}"] i`),b=document.querySelector(`[data-jack="${r.to}"] i`);if(!a||!b)return;const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect(),x1=ar.left+ar.width/2-wr.left,y1=ar.top+ar.height/2-wr.top,x2=br.left+br.width/2-wr.left,y2=br.top+br.height/2-wr.top,curve=Math.max(50,Math.abs(x2-x1)*.38),d=`M ${x1} ${y1} C ${x1+curve} ${y1+55}, ${x2-curve} ${y2+55}, ${x2} ${y2}`,color=ROUTE_COLORS[i%ROUTE_COLORS.length];svg.innerHTML+=`<path class="cable-hit" data-cable="${i}" d="${d}"></path><path class="patch-cable" d="${d}" stroke="${color}"></path>`});
  svg.querySelectorAll("[data-cable]").forEach(p=>p.onclick=()=>{patch.routes.splice(+p.dataset.cable,1);renderRouting();restartAudioForRouting();toast("CABLE REMOVED")})
}
function restartAudioForRouting(){if(!audio)return;stopDrone();ensureDrone()}
function updateVoiceStatus(){let n=Object.values(patch.voices).filter(Boolean).length;$("#voiceStatus").textContent=n+" VOICES"}
function exportPatch(){const data={app:"PATCHLAB",version:"0.4",exportedAt:new Date().toISOString(),patch,controls:Object.fromEntries($$(".knob").map(x=>[x.id,x.value]))};const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=safeName(patch.name)+".patchlab.json";a.click();URL.revokeObjectURL(a.href);toast("PATCH EXPORTED")}
function savePatch(){localStorage.setItem("patchlab-last",JSON.stringify({patch,controls:Object.fromEntries($$(".knob").map(x=>[x.id,x.value]))}));toast("PATCH SAVED LOCALLY")}
function startRecording(){initAudio();if(!playing)start();chunks=[];recorder=new MediaRecorder(audio.mediaDest.stream);recorder.ondataavailable=e=>e.data.size&&chunks.push(e.data);recorder.onstop=()=>{let blob=new Blob(chunks,{type:recorder.mimeType}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=safeName(patch.name)+".webm";a.click();URL.revokeObjectURL(a.href);recording=false;$("#recordBtn").classList.remove("recording");$("#recordBtn").textContent="● RECORD AUDIO";toast("AUDIO EXPORTED")};recorder.start();recording=true;$("#recordBtn").classList.add("recording");$("#recordBtn").textContent="■ STOP + EXPORT";toast("RECORDING")}
function drawScope(){const c=$("#scope"),x=c.getContext("2d"),d=new Uint8Array(audio.analyser.frequencyBinCount);(function f(){requestAnimationFrame(f);audio.analyser.getByteTimeDomainData(d);x.clearRect(0,0,c.width,c.height);x.strokeStyle="#d9ff55";x.lineWidth=1.5;x.beginPath();for(let i=0;i<d.length;i++){let px=i/(d.length-1)*c.width,py=d[i]/255*c.height;i?x.lineTo(px,py):x.moveTo(px,py)}x.stroke()})()}

populateSelectors();buildKeyboard();
$$("[data-preset]").forEach(b=>b.onclick=()=>{patch.preset=b.dataset.preset;$$("[data-preset]").forEach(x=>{x.style.background="";x.style.color=""});b.style.background="var(--acid)";b.style.color="#111"});
$("#generateBtn").onclick=()=>{initPatch($("#promptInput").value||"dusty generative loop");document.querySelector(".studio").scrollIntoView({behavior:"smooth"})};
$("#playBtn").onclick=()=>playing?stop():start();$("#randomBtn").onclick=randomize;$("#mutateBtn").onclick=mutate;$("#clearBtn").onclick=()=>{patch.steps.forEach(s=>s.active=false);renderSequencer()};
$("#shiftLeft").onclick=()=>shift(-1);$("#shiftRight").onclick=()=>shift(1);
$("#root").onchange=e=>{let old=patch.root;patch.root=+e.target.value;patch.steps.forEach(s=>s.midi+=patch.root-old);renderAll();stopDrone();ensureDrone()};
$("#scale").onchange=e=>{patch.scale=e.target.value;randomize()};$("#bpm").onchange=e=>{patch.bpm=Math.max(45,Math.min(190,+e.target.value));renderExplanation()};
$$(".toggle").forEach(b=>b.onclick=()=>{let v=b.dataset.voice;patch.voices[v]=!patch.voices[v];b.classList.toggle("active",patch.voices[v]);b.textContent=patch.voices[v]?"ON":"OFF";if(v==="drone"){patch.voices[v]?ensureDrone():stopDrone()}updateVoiceStatus()});
$$(".modifier").forEach(b=>b.onclick=()=>{const m=b.dataset.mod;patch.modifiers[m]=!patch.modifiers[m];b.classList.toggle("active",patch.modifiers[m]);updateAudioParams();renderExplanation();toast(`${m.toUpperCase()} ${patch.modifiers[m]?"ON":"OFF"}`)});
$$(".jack").forEach(j=>j.onclick=()=>jackClick(j));
$$(".knob,#master,#leadVol,#bassVol,#drumVol,#droneVol").forEach(x=>x.oninput=()=>{updateAudioParams();renderExplanation();if(x.id==="droneVol"&&audio?.drone)audio.drone.g.gain.value=val("droneVol")*.12});
$("#exportBtn").onclick=exportPatch;$("#saveBtn").onclick=savePatch;$("#recordBtn").onclick=()=>recording?recorder.stop():startRecording();
document.addEventListener("keydown",e=>{let i=KEYMAP.indexOf(e.key.toLowerCase());if(i>=0&&!e.repeat){document.querySelector(`[data-midi="${60+i}"]`)?.classList.add("down");triggerLead(60+i,audio?.ctx?.currentTime||0,.8)}});
document.addEventListener("keyup",e=>{let i=KEYMAP.indexOf(e.key.toLowerCase());if(i>=0)document.querySelector(`[data-midi="${60+i}"]`)?.classList.remove("down")});
window.addEventListener("resize",drawCables);
initPatch("dusty generative loop");
