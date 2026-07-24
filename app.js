const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const NOTES=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const SCALES={minor:[0,2,3,5,7,8,10],major:[0,2,4,5,7,9,11],dorian:[0,2,3,5,7,9,10],pentatonic:[0,3,5,7,10],phrygian:[0,1,3,5,7,8,10]};
const KEYMAP=["a","w","s","e","d","f","t","g","y","h","u","j","k"];
const TRACKS=[
 {id:"lead",name:"LEAD",type:"melodic",color:"#d7ff57",desc:"Main synth melody"},
 {id:"bass",name:"BASS",type:"melodic",color:"#68d4ff",desc:"Independent bassline"},
 {id:"kick",name:"KICK",type:"drum",color:"#ff7446",desc:"Low drum pattern"},
 {id:"snare",name:"SNARE",type:"drum",color:"#ffcf66",desc:"Backbeat pattern"},
 {id:"hat",name:"HATS",type:"drum",color:"#c58cff",desc:"Hi-hat pattern"},
 {id:"perc",name:"PERC",type:"drum",color:"#72efb3",desc:"Extra percussion"}
];
let selected="lead", playing=false, schedulerStep=0, playheadStep=0, nextTime=0, timer=null, audio=null, patchNo=1;
let state={name:"STATIC PRESSURE",bpm:118,root:6,scale:"minor",fx:{filter:true,delay:true,chorus:false,crush:false},tracks:{}};
function blankTrack(t){return {muted:false,solo:false,volume:t.type==="drum"?.72:.65,tone:t.id==="bass"?.28:.55,decay:t.type==="drum"?.28:.6,steps:Array.from({length:16},(_,i)=>t.type==="melodic"?{on:false,midi:60,vel:.7}:{on:false,vel:.75})}}
TRACKS.forEach(t=>state.tracks[t.id]=blankTrack(t));
function toast(s){const e=$("#toast");e.textContent=s;e.classList.add("show");clearTimeout(e.t);e.t=setTimeout(()=>e.classList.remove("show"),1300)}
function noteName(m){return NOTES[m%12]+(Math.floor(m/12)-1)}
function freq(m){return 440*Math.pow(2,(m-69)/12)}
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return Math.abs(h)}
function rand(seed){let x=seed||1;return()=>((x=Math.imul(1664525,x)+1013904223>>>0)/4294967296)}
function profile(prompt){
 const p=prompt.toLowerCase(),out={tags:[],density:.5,tempo:null,scale:null,root:null,dark:false,bright:false,ambient:false,techno:false,glitch:false,heavy:false,minimal:false};
 const hit=(words,key,label)=>{if(words.some(w=>p.includes(w))){out[key]=true;out.tags.push(label)}};
 hit(["ambient","drifting","ethereal","spacious"],"ambient","AMBIENT");hit(["techno","club","four on the floor"],"techno","TECHNO");hit(["dark","ominous","brooding","tense"],"dark","DARK");hit(["bright","happy","shimmering"],"bright","BRIGHT");hit(["glitch","broken","stutter"],"glitch","GLITCH");hit(["heavy","massive","deep bass"],"heavy","HEAVY");hit(["minimal","sparse"],"minimal","MINIMAL");
 let m=p.match(/\b([4-9]\d|1\d\d)\s*bpm\b/);if(m){out.tempo=+m[1];out.tags.push(m[1]+" BPM")}
 for(const s of Object.keys(SCALES))if(p.includes(s)){out.scale=s;out.tags.push(s.toUpperCase())}
 const roots={"c":0,"c#":1,"db":1,"d":2,"d#":3,"eb":3,"e":4,"f":5,"f#":6,"gb":6,"g":7,"g#":8,"ab":8,"a":9,"a#":10,"bb":10,"b":11};
 m=p.match(/\b(?:in|key of)\s+(c#|db|d#|eb|f#|gb|g#|ab|a#|bb|c|d|e|f|g|a|b)\b/);if(m){out.root=roots[m[1]];out.tags.push("KEY "+m[1].toUpperCase())}
 if(!out.tags.length)out.tags=["OPEN INTERPRETATION"];return out;
}
function generate(prompt){
 const pr=profile(prompt),r=rand(hash(prompt||"patchlab"));state.name=["STATIC","NEON","DUST","LUNAR","BROKEN","VELVET"][Math.floor(r()*6)]+" "+["PRESSURE","MEMORY","SIGNAL","RITUAL","MACHINE","CURRENT"][Math.floor(r()*6)];
 state.bpm=pr.tempo||(pr.ambient?68:pr.techno?126:96+Math.floor(r()*34));state.root=pr.root??Math.floor(r()*12);state.scale=pr.scale||(pr.dark?"phrygian":pr.bright?"major":pr.ambient?"pentatonic":"minor");
 const scale=SCALES[state.scale],base=48+state.root,density=pr.minimal?.25:pr.glitch?.7:.52;
 state.tracks.lead.steps.forEach((s,i)=>{s.on=r()<density&&(pr.ambient?i%4===0||i===10:true);s.midi=base+scale[(i*2+Math.floor(r()*3))%scale.length]+(r()>.55?12:0);s.vel=.45+r()*.45});
 state.tracks.bass.steps.forEach((s,i)=>{s.on=pr.techno?i%4===0:r()<(pr.minimal?.25:.48);s.midi=36+state.root+scale[Math.floor(r()*Math.min(4,scale.length))];s.vel=.55+r()*.35});
 state.tracks.kick.steps.forEach((s,i)=>s.on=pr.techno?i%4===0:[0,4,8,12].includes(i)||(r()<.12));
 state.tracks.snare.steps.forEach((s,i)=>s.on=[4,12].includes(i)||(pr.glitch&&r()<.15));
 state.tracks.hat.steps.forEach((s,i)=>s.on=pr.minimal?i%4===2:i%2===0||(pr.glitch&&r()<.5));
 state.tracks.perc.steps.forEach((s,i)=>s.on=r()<(pr.glitch?.35:.12));
 state.tracks.bass.tone=pr.heavy?.18:.3;state.tracks.lead.tone=pr.dark?.3:pr.bright?.78:.55;
 state.fx.delay=pr.ambient||!pr.techno;state.fx.chorus=pr.ambient||pr.bright;state.fx.crush=pr.glitch;state.fx.filter=true;
 $("#promptTags").innerHTML=pr.tags.map(x=>`<span class="tag on">${x}</span>`).join("");syncControls();renderAll();toast("MULTITRACK PERFORMANCE GENERATED");
}
function syncControls(){$("#bpm").value=state.bpm;$("#root").value=state.root;$("#scale").value=state.scale;$("#patchName").textContent=state.name;$$(".fx").forEach(b=>b.classList.toggle("active",state.fx[b.dataset.fx]))}
function renderTracks(){
 $("#trackButtons").innerHTML=TRACKS.map(t=>{const tr=state.tracks[t.id];return `<button class="track-item ${selected===t.id?"selected":""}" data-track="${t.id}"><i class="track-color" style="background:${t.color}"></i><span><b>${t.name}</b><small>${t.desc}</small></span><span class="track-badges">${tr.muted?"M":""}${tr.solo?"S":""}</span></button>`}).join("");
 $$("[data-track]").forEach(b=>b.onclick=()=>{selected=b.dataset.track;renderAll()})
}
function renderEditor(){
 const meta=TRACKS.find(t=>t.id===selected),tr=state.tracks[selected];$("#editorTitle").textContent=meta.name;$("#editorType").textContent=meta.type==="melodic"?"MELODIC SEQUENCER":"DRUM SEQUENCER";$("#editorHelp").textContent=meta.type==="melodic"?"Click to toggle. Drag vertically to transpose the note.":"Click steps to build this instrument's rhythm.";$("#muteBtn").classList.toggle("active",tr.muted);$("#soloBtn").classList.toggle("active",tr.solo);$("#trackVolume").value=tr.volume;
 $("#stepNumbers").innerHTML=Array.from({length:16},(_,i)=>`<div>${i+1}</div>`).join("");
 if(meta.type==="melodic"){
  $("#trackEditor").className="track-editor melodic-grid";$("#trackEditor").innerHTML=tr.steps.map((s,i)=>`<div class="melodic-step ${s.on?"active":""} ${i===playheadStep&&playing?"current":""}" data-step="${i}"><span class="note">${noteName(s.midi)}</span><div class="bar" style="height:${Math.round(s.vel*88)}%"></div></div>`).join("");
  $$(".melodic-step").forEach(el=>{let y,start;el.onpointerdown=e=>{y=e.clientY;start=tr.steps[+el.dataset.step].midi;el.setPointerCapture(e.pointerId)};el.onpointermove=e=>{if(y==null||Math.abs(e.clientY-y)<8)return;const s=tr.steps[+el.dataset.step];s.midi=Math.max(28,Math.min(88,start+Math.round((y-e.clientY)/12)));el.querySelector(".note").textContent=noteName(s.midi)};el.onpointerup=e=>{const s=tr.steps[+el.dataset.step];if(Math.abs(e.clientY-y)<8)s.on=!s.on;y=null;renderAll()}})
 }else{
  $("#trackEditor").className="track-editor drum-grid";$("#trackEditor").innerHTML=tr.steps.map((s,i)=>`<div class="drum-step ${s.on?"active":""} ${i===playheadStep&&playing?"current":""}" data-step="${i}"></div>`).join("");$$(".drum-step").forEach(el=>el.onclick=()=>{tr.steps[+el.dataset.step].on=!tr.steps[+el.dataset.step].on;renderAll()})
 }
 renderSoundControls()
}
function renderSoundControls(){
 const tr=state.tracks[selected],meta=TRACKS.find(t=>t.id===selected);$("#soundControls").innerHTML=`<div class="sound-control"><label>${meta.type==="melodic"?"TONE":"PITCH"} <input id="toneCtl" type="range" min="0" max="1" step=".01" value="${tr.tone}"></label></div><div class="sound-control"><label>DECAY <input id="decayCtl" type="range" min=".05" max="1.5" step=".01" value="${tr.decay}"></label></div>`;$("#toneCtl").oninput=e=>tr.tone=+e.target.value;$("#decayCtl").oninput=e=>tr.decay=+e.target.value
}
function renderArrangement(){
 $("#arrangement").innerHTML=TRACKS.map(t=>{const tr=state.tracks[t.id];return `<div class="arrange-row"><div class="arrange-name">${t.name}<small>${tr.muted?"MUTED":tr.solo?"SOLO":t.desc}</small></div><div class="arrange-steps">${tr.steps.map((s,i)=>`<div class="arrange-step ${s.on?"active":""} ${i===playheadStep&&playing?"current":""}" data-arr-track="${t.id}" data-arr-step="${i}" style="--track-color:${t.color}"></div>`).join("")}</div></div>`}).join("");$$("[data-arr-track]").forEach(el=>el.onclick=()=>{const id=el.dataset.arrTrack;state.tracks[id].steps[+el.dataset.arrStep].on=!state.tracks[id].steps[+el.dataset.arrStep].on;selected=id;renderAll()})
}
function renderAll(){renderTracks();renderEditor();renderArrangement();syncControls()}
function initAudio(){
 if(audio)return;const ctx=new(window.AudioContext||window.webkitAudioContext)(),master=ctx.createGain(),filter=ctx.createBiquadFilter(),delay=ctx.createDelay(1),feed=ctx.createGain(),wet=ctx.createGain(),dry=ctx.createGain(),analyser=ctx.createAnalyser(),dest=ctx.createMediaStreamDestination();
 filter.type="lowpass";filter.frequency.value=+$("#cutoff").value;delay.delayTime.value=.28;feed.gain.value=.35;wet.gain.value=+$("#delayMix").value;dry.gain.value=.85;master.gain.value=.72;analyser.fftSize=1024;
 filter.connect(dry);filter.connect(delay);delay.connect(feed);feed.connect(delay);delay.connect(wet);dry.connect(master);wet.connect(master);master.connect(analyser);master.connect(dest);analyser.connect(ctx.destination);audio={ctx,master,filter,delay,feed,wet,dry,analyser,dest};drawScope()
}
function audible(id){const solos=TRACKS.some(t=>state.tracks[t.id].solo);const tr=state.tracks[id];return !tr.muted&&(!solos||tr.solo)}
function synth(id,midi,time,vel=.7){
 if(!audible(id))return;initAudio();const tr=state.tracks[id],o=audio.ctx.createOscillator(),g=audio.ctx.createGain();o.type=id==="bass"?"square":tr.tone>.66?"sawtooth":tr.tone>.33?"triangle":"sine";o.frequency.value=freq(midi);g.gain.setValueAtTime(.0001,time);g.gain.exponentialRampToValueAtTime(Math.max(.001,tr.volume*vel*.18),time+.01);g.gain.exponentialRampToValueAtTime(.0001,time+tr.decay);o.connect(g);g.connect(audio.filter);o.start(time);o.stop(time+tr.decay+.05)
}
function drum(id,time){
 if(!audible(id))return;initAudio();const tr=state.tracks[id],ctx=audio.ctx,g=ctx.createGain();
 if(id==="kick"){const o=ctx.createOscillator();o.frequency.setValueAtTime(150-tr.tone*45,time);o.frequency.exponentialRampToValueAtTime(40,time+.16);g.gain.setValueAtTime(tr.volume*.65,time);g.gain.exponentialRampToValueAtTime(.001,time+tr.decay);o.connect(g);g.connect(audio.master);o.start(time);o.stop(time+tr.decay)}
 else{const len=Math.floor(ctx.sampleRate*(id==="hat"?.05:tr.decay)),b=ctx.createBuffer(1,len,ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;const s=ctx.createBufferSource(),f=ctx.createBiquadFilter();s.buffer=b;f.type=id==="snare"?"bandpass":"highpass";f.frequency.value=id==="snare"?1700:id==="perc"?3200:6500;g.gain.setValueAtTime(tr.volume*(id==="hat"?.16:.32),time);g.gain.exponentialRampToValueAtTime(.001,time+Math.max(.04,tr.decay));s.connect(f);f.connect(g);g.connect(audio.master);s.start(time)}
}
function schedule(step,time){
 TRACKS.forEach(t=>{
  const s=state.tracks[t.id].steps[step];
  if(!s.on)return;
  t.type==="melodic"?synth(t.id,s.midi,time,s.vel):drum(t.id,time)
 });
 const delay=Math.max(0,(time-audio.ctx.currentTime)*1000);
 setTimeout(()=>{
  if(!playing)return;
  playheadStep=step;
  renderEditor();
  renderArrangement()
 },delay)
}
function scheduler(){
 while(nextTime<audio.ctx.currentTime+.1){
  const stepToSchedule=schedulerStep;
  schedule(stepToSchedule,nextTime);
  nextTime+=60/state.bpm/4;
  schedulerStep=(schedulerStep+1)%16
 }
}
function play(){
 initAudio();
 audio.ctx.resume();
 if(playing)return;
 playing=true;
 schedulerStep=0;
 playheadStep=0;
 nextTime=audio.ctx.currentTime+.05;
 timer=setInterval(scheduler,25);
 scheduler();
 $("#playState").textContent="PLAYING";
 $("#playBtn").textContent="❚❚"
}
function stop(){
 playing=false;
 clearInterval(timer);
 timer=null;
 schedulerStep=0;
 playheadStep=0;
 $("#playState").textContent="STOPPED";
 $("#playBtn").textContent="▶";
 renderAll()
}
function randomizeTrack(){const meta=TRACKS.find(t=>t.id===selected),tr=state.tracks[selected],scale=SCALES[state.scale];tr.steps.forEach((s,i)=>{s.on=Math.random()<(meta.type==="drum"?.4:.55);if(meta.type==="melodic")s.midi=(selected==="bass"?36:48)+state.root+scale[Math.floor(Math.random()*scale.length)]+(selected==="lead"&&Math.random()>.5?12:0)});renderAll();toast(selected.toUpperCase()+" RANDOMIZED")}
function mutate(){const tr=state.tracks[selected],meta=TRACKS.find(t=>t.id===selected);tr.steps.forEach(s=>{if(Math.random()<.22){if(Math.random()<.6)s.on=!s.on;else if(meta.type==="melodic")s.midi+=Math.random()>.5?2:-2}});renderAll();toast(selected.toUpperCase()+" MUTATED")}
function shift(dir){const tr=state.tracks[selected];tr.steps=dir<0?[...tr.steps.slice(1),tr.steps[0]]:[tr.steps.at(-1),...tr.steps.slice(0,-1)];renderAll()}
function keyboard(){const ms=[60,61,62,63,64,65,66,67,68,69,70,71,72];$("#keyboard").innerHTML=ms.map((m,i)=>`<button class="key ${NOTES[m%12].includes("#")?"black":""}" data-midi="${m}">${KEYMAP[i].toUpperCase()}</button>`).join("");$$(".key").forEach(k=>{k.onpointerdown=()=>{k.classList.add("down");synth(selected==="bass"?"bass":"lead",+k.dataset.midi,audio?.ctx.currentTime||0,.85)};k.onpointerup=()=>k.classList.remove("down")})}
function drawScope(){const c=$("#scope"),x=c.getContext("2d"),d=new Uint8Array(audio.analyser.frequencyBinCount);(function loop(){requestAnimationFrame(loop);audio.analyser.getByteTimeDomainData(d);x.clearRect(0,0,c.width,c.height);x.strokeStyle="#d7ff57";x.beginPath();d.forEach((v,i)=>{const px=i/(d.length-1)*c.width,py=v/255*c.height;i?x.lineTo(px,py):x.moveTo(px,py)});x.stroke()})()}
function exportPatch(){const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="patchlab-"+state.name.toLowerCase().replace(/\s+/g,"-")+".json";a.click();URL.revokeObjectURL(a.href)}
function populate(){$("#root").innerHTML=NOTES.map((n,i)=>`<option value="${i}">${n}</option>`).join("");$("#scale").innerHTML=Object.keys(SCALES).map(s=>`<option>${s}</option>`).join("")}
$("#enableAudio").onclick=()=>{initAudio();audio.ctx.resume().then(()=>{$("#audioGate").classList.add("hidden");toast("AUDIO ENABLED")})};
$("#generateBtn").onclick=()=>generate($("#promptInput").value||"dark driving techno with a tense lead");
$("#playBtn").onclick=()=>playing?stop():play();$("#stopBtn").onclick=stop;$("#randomizeBtn").onclick=randomizeTrack;$("#mutateBtn").onclick=mutate;
$("#muteBtn").onclick=()=>{state.tracks[selected].muted=!state.tracks[selected].muted;renderAll()};$("#soloBtn").onclick=()=>{state.tracks[selected].solo=!state.tracks[selected].solo;renderAll()};
$("#trackVolume").oninput=e=>state.tracks[selected].volume=+e.target.value;$("#clearTrackBtn").onclick=()=>{state.tracks[selected].steps.forEach(s=>s.on=false);renderAll()};$("#shiftLeftBtn").onclick=()=>shift(-1);$("#shiftRightBtn").onclick=()=>shift(1);
$("#bpm").onchange=e=>state.bpm=Math.max(45,Math.min(190,+e.target.value));$("#root").onchange=e=>{const old=state.root;state.root=+e.target.value;["lead","bass"].forEach(id=>state.tracks[id].steps.forEach(s=>s.midi+=state.root-old));renderAll()};$("#scale").onchange=e=>state.scale=e.target.value;
$$(".fx").forEach(b=>b.onclick=()=>{state.fx[b.dataset.fx]=!state.fx[b.dataset.fx];b.classList.toggle("active",state.fx[b.dataset.fx]);if(audio){audio.wet.gain.value=state.fx.delay?+$("#delayMix").value:0;audio.filter.frequency.value=state.fx.filter?+$("#cutoff").value:18000}});
$("#cutoff").oninput=e=>audio&&(audio.filter.frequency.value=+e.target.value);$("#delayMix").oninput=e=>audio&&(audio.wet.gain.value=state.fx.delay?+e.target.value:0);
$("#saveBtn").onclick=()=>{localStorage.setItem("patchlab-v1",JSON.stringify(state));toast("SAVED LOCALLY")};$("#exportBtn").onclick=exportPatch;
document.addEventListener("keydown",e=>{const i=KEYMAP.indexOf(e.key.toLowerCase());if(i>=0&&!e.repeat)synth(selected==="bass"?"bass":"lead",60+i,audio?.ctx.currentTime||0,.8)});
populate();keyboard();generate("dark driving techno in F# minor at 126 BPM with heavy bass and syncopated hats");
