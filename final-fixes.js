/* Swim Quest · actualización 2026-09-17
   - Deduplicación local/remota de entrenamientos.
   - Dificultad basada principalmente en % de la media semanal.
   - Nuevo nivel Brutal.
   - Promedio semanal visible en Perfil.
   - Panel de marcas 25/50/100/200 m.
   - Logro «Eres raro..» por 5.000 m de espalda.
   - Retro 80s blanco/negro con texto blanco.
   - Carretera nocturna con más autos y aviones.
   - Diálogo de Pera sobre compararse con otra persona.
*/
(function(){
  'use strict';
  if(window.__SWQ_FINAL_FIXES_20260917__)return;
  window.__SWQ_FINAL_FIXES_20260917__=true;

  const VERSION='20260917-1';
  let updatingProfilePanel=false;
  let roadTimer=null,planeTimer=null,roadLayer=null;
  let timeCategory=localStorage.getItem('SWIM_QUEST_TIME_CATEGORY')||'50';
  if(!['25','50','100','200'].includes(timeCategory))timeCategory='50';
  const PEAR_ANGER_KEY='SWIM_QUEST_PEAR_ANGER_COUNT';
  function localJsonRead(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'')||fallback}catch(e){return fallback}}
  function localJsonWrite(key,val){try{localStorage.setItem(key,JSON.stringify(val))}catch(e){}}

  function enforceButterfly(){
    document.querySelectorAll('select.draftInput[data-k="style"]').forEach(styleSel=>{
      const series=styleSel.closest('.series');
      const intensity=series?.querySelector('select.draftInput[data-k="intensity"]');
      if(!intensity)return;
      const butterfly=styleSel.value==='mariposa';
      [...intensity.options].forEach(o=>{o.disabled=butterfly&&o.value==='suave';});
      if(butterfly&&intensity.value==='suave'){
        intensity.value='normal';
        intensity.dispatchEvent(new Event('change',{bubbles:true}));
      }
    });
  }

  function patchPearMobile(){
    document.querySelectorAll('.pear-scene').forEach(scene=>{
      Object.assign(scene.style,{overflowY:'auto',overflowX:'hidden',alignItems:'flex-start',justifyContent:'flex-start',padding:'14px 10px 120px',WebkitOverflowScrolling:'touch',touchAction:'pan-y',overscrollBehaviorY:'contain'});
      scene.querySelectorAll('.pear-shine').forEach(x=>x.remove());
      const stage=scene.querySelector('.pear-stage');
      if(stage)Object.assign(stage.style,{minHeight:'0',height:'auto',justifyContent:'flex-start',width:'100%',padding:'12px 0 28px'});
      const grid=scene.querySelector('.pear-topic-grid');
      if(grid)grid.style.paddingBottom='24px';
    });
  }

  setTimeout(()=>{
    try{
      if(typeof window.openPearScene==='function'&&!window.__swqPearWrapped20260917){
        const originalOpenPear=window.openPearScene;
        window.openPearScene=function(){
          const today=dayKey();
          let x=localJsonRead(PEAR_ANGER_KEY,{date:today,count:0});
          if(x.date!==today)x={date:today,count:0};
          x.count=Number(x.count||0)+1;
          localJsonWrite(PEAR_ANGER_KEY,x);
          localJsonWrite('SWIM_QUEST_PEAR_VISITS',{date:today,count:x.count<=25?0:25,lockDate:''});
          return originalOpenPear.apply(this,arguments);
        };
        window.__swqPearWrapped20260917=true;
      }
    }catch(e){}
  },40);

  function dayKey(){
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function weekKeySafe(){
    try{return typeof weekKey==='function'?weekKey():dayKey().slice(0,7)}catch(e){return dayKey().slice(0,7)}
  }
  function esc2(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function num(v){const n=Number(v);return Number.isFinite(n)?n:0;}
  function workoutMeters(e){return (e?.series||[]).reduce((a,s)=>a+num(s.distance)*num(s.reps),0);}
  function normalizedSeries(e){return (e?.series||[]).map(s=>({
    distance:num(s.distance),reps:num(s.reps),style:String(s.style||''),intensity:String(s.intensity||''),time:num(s.time),exercise:String(s.exercise||''),corrective:!!s.corrective
  }));}
  function workoutSignature(e){
    return [String(e?.date||''),String(e?.name||''),String(e?.durationMin||0),workoutMeters(e),JSON.stringify(normalizedSeries(e))].join('|');
  }
  function clientIdOf(e){return String(e?.clientId||e?.client_id||e?.details?.client_id||'').trim();}

  function updateWeeklyAverage(force){
    if(!S?.profile)return 1000;
    const wk=weekKeySafe();
    const storedWeek=String(S.profile.avgMetersWeek||'');
    const hasAvg=Number.isFinite(Number(S.profile.avgMeters))&&Number(S.profile.avgMeters)>0;
    if(!force&&storedWeek===wk&&hasAvg)return Math.max(100,Number(S.profile.avgMeters));
    const arr=(S.trainings||[]).filter(e=>workoutMeters(e)>0);
    const avg=arr.length?Math.round(arr.reduce((a,e)=>a+workoutMeters(e),0)/arr.length):1000;
    const next=Math.max(100,avg);
    const changed=Number(S.profile.avgMeters)!==next||storedWeek!==wk;
    S.profile.avgMeters=next;
    S.profile.avgMetersWeek=wk;
    if(changed){try{save();}catch(e){}}
    return next;
  }

  function difficultyByPercent(e,avgOverride){
    const meters=workoutMeters(e);
    if(meters<=0)return {...DIFFICULTIES[0],percent:0,base:Math.max(100,num(avgOverride)||num(S.profile?.avgMeters)||1000)};
    const base=Math.max(100,num(avgOverride)||num(S.profile?.avgMeters)||1000);
    const percent=(meters/base)*100;
    let key='facil';
    if(percent<=19)key='facil';
    else if(percent<=49)key='normal';
    else if(percent<=110)key='brutal';
    else if(percent<450)key='demoniaco';
    else key='masoquista';
    const d=DIFFICULTIES.find(x=>x.key===key)||DIFFICULTIES[0];
    return {...d,percent,base,points:Math.round(meters)};
  }

  try{
    const intenseIndex=DIFFICULTIES.findIndex(x=>x.key==='intenso');
    if(intenseIndex>=0)DIFFICULTIES[intenseIndex]={key:'brutal',name:'Brutal',icon:'🟣',desc:'Entre 50% y 110% de lo que sueles nadar por clase.'};
    const maso=DIFFICULTIES.find(x=>x.key==='masoquista');
    if(maso)maso.desc='450% o más de lo que sueles nadar por clase.';
    const demon=DIFFICULTIES.find(x=>x.key==='demoniaco');
    if(demon)demon.desc='Desde 111% de tu referencia semanal; 450% o más es Masoquista.';
    difficultyInfo=difficultyByPercent;
    difficultyLabel=function(e){const d=typeof e==='string'?difficultyForKey(e):difficultyByPercent(e,S?.profile?.avgMeters);return `${d.icon} ${d.name}`;};
    difficultyCounts=function(arr){return Object.fromEntries(DIFFICULTIES.map(d=>[d.key,(arr||[]).filter(e=>difficultyByPercent(e,S?.profile?.avgMeters).key===d.key).length]));};
  }catch(e){console.warn('SWQ difficulty patch',e)}

  function repaintStoredDifficulties(){
    updateWeeklyAverage(false);
    let changed=false;
    for(const e of (S.trainings||[])){
      const k=difficultyByPercent(e,S.profile?.avgMeters).key;
      if(e.difficulty!==k){e.difficulty=k;changed=true;}
    }
    if(changed){try{save();}catch(e){}}
    return changed;
  }

  function dedupeLocalTrainings(){
    if(!Array.isArray(S.trainings)||!S.trainings.length)return false;
    const seenClient=new Set(),seenCloudSig=new Set(),out=[];let changed=false;
    const sorted=[...S.trainings].sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.id||'').localeCompare(String(b.id||'')));
    for(const e of sorted){
      const cid=clientIdOf(e),sig=workoutSignature(e),cloud=String(e.id||'').startsWith('cloud_');
      if(cid&&seenClient.has(cid)){changed=true;continue;}
      if(cid)seenClient.add(cid);
      if(cloud&&seenCloudSig.has(sig)){changed=true;continue;}
      if(cloud)seenCloudSig.add(sig);
      out.push(e);
    }
    if(changed){
      out.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.id||'').localeCompare(String(b.id||'')));
      out.forEach((e,i)=>e.number=i+1);
      S.trainings=out;S.nextTrainingNumber=out.length+1;
      try{save();}catch(e){}
    }
    return changed;
  }

  let lastRemoteRepair=0;
  async function dedupeRemoteTrainings(){
    if(!supabaseClient||!authUser)return false;
    if(Date.now()-lastRemoteRepair<12000)return false;
    lastRemoteRepair=Date.now();
    try{
      const r=await supabaseClient.from('workouts').select('id,client_id,workout_date,name,meters,xp_earned,coins_earned,details,created_at').eq('user_id',authUser.id).order('created_at',{ascending:true});
      if(r.error||!Array.isArray(r.data))return false;
      const seenClient=new Set(),seenSig=new Map(),dupes=[];
      for(const w of r.data){
        const cid=String(w.client_id||w.details?.client_id||'').trim();
        const e={date:w.workout_date,name:w.name||'',durationMin:num(w.details?.durationMin),series:Array.isArray(w.details?.series)?w.details.series:[]};
        const sig=workoutSignature(e);
        if(cid&&seenClient.has(cid)){dupes.push(w.id);continue;}
        if(cid)seenClient.add(cid);
        const prev=seenSig.get(sig);
        if(prev){
          const a=new Date(prev.created_at||0).getTime(),b=new Date(w.created_at||0).getTime();
          if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(b-a)<=10*60*1000){dupes.push(w.id);continue;}
        }else seenSig.set(sig,w);
      }
      for(const id of dupes){
        try{await supabaseClient.from('workouts').delete().eq('user_id',authUser.id).eq('id',id);}catch(e){console.warn('SWQ duplicate delete',e)}
      }
      return dupes.length>0;
    }catch(e){console.warn('SWQ remote dedupe',e);return false;}
  }

  function validBackMeters(){
    return (S.trainings||[]).reduce((sum,e)=>sum+(e.series||[]).reduce((a,s)=>a+(s.style==='espalda'?num(s.distance)*num(s.reps):0),0),0);
  }

  function patchAchievementRules(){
    try{
      const rare=ACHIEVEMENTS.find(a=>a.id==='counter2'||/mar empieza|oc[eé]ano empieza/i.test(a.title||''));
      if(rare){
        rare.id='counter2';rare.icon='🌙';rare.title='Eres raro..';rare.desc='Nada 5.000 metros de espalda acumulados.';rare.ok=()=>validBackMeters()>=5000;
      }
      const demon=ACHIEVEMENTS.find(a=>a.id==='demon');if(demon)demon.ok=()=>S.trainings.some(e=>difficultyByPercent(e,S.profile?.avgMeters).key==='demoniaco');
      const maso=ACHIEVEMENTS.find(a=>a.id==='maso');if(maso){maso.title='Masoquista';maso.desc='Completa un entrenamiento de 450% o más de tu promedio semanal.';maso.ok=()=>S.trainings.some(e=>difficultyByPercent(e,S.profile?.avgMeters).key==='masoquista');}
    }catch(e){console.warn('SWQ achievement patch',e)}
  }

  function repairAchievements(){
    if(!Array.isArray(S.achievements))S.achievements=[];
    const before=[...S.achievements],seen=new Set(),keep=[];let changed=false;
    for(const id of before){
      if(seen.has(id))continue;seen.add(id);
      const a=ACHIEVEMENTS.find(x=>x.id===id);
      if(!a||a.secret){keep.push(id);continue;}
      let ok=true;try{ok=!!a.ok();}catch(e){ok=true;}
      if(ok)keep.push(id);else changed=true;
    }
    if(changed){S.achievements=keep;try{save();}catch(e){}}
    return changed;
  }

  function injectMainCSS(){
    if(document.getElementById('swq-main-fixes-'+VERSION))return;
    const s=document.createElement('style');s.id='swq-main-fixes-'+VERSION;s.textContent=`
body.theme-retro80s{background:radial-gradient(circle at 50% 0,#4a4a4a 0,#202020 36%,#050505 82%,#000 100%)!important;color:#fff!important;filter:none!important}
body.theme-retro80s .card,body.theme-retro80s .hero,body.theme-retro80s .list-item,body.theme-retro80s .series,body.theme-retro80s .shop-item,body.theme-retro80s .stat{background:linear-gradient(180deg,#292929,#0b0b0b)!important;border-color:#9b9b9b!important;color:#fff!important;box-shadow:inset 0 0 18px rgba(255,255,255,.045),0 8px 24px rgba(0,0,0,.5)!important}
body.theme-retro80s h1,body.theme-retro80s h2,body.theme-retro80s h3,body.theme-retro80s p,body.theme-retro80s label,body.theme-retro80s .sub,body.theme-retro80s .kicker,body.theme-retro80s .stat,body.theme-retro80s .pill,body.theme-retro80s .training-name,body.theme-retro80s .meter-value,body.theme-retro80s .meter-label,body.theme-retro80s .sectionTitle,body.theme-retro80s .difficulty-legend-row,body.theme-retro80s .style-legend-row,body.theme-retro80s .list-item span,body.theme-retro80s .list-item b{color:#fff!important;text-shadow:0 0 5px rgba(255,255,255,.32),0 1px 0 #000!important}
body.theme-retro80s .btn,body.theme-retro80s .btn.primary,body.theme-retro80s .btn.secondary{background:linear-gradient(180deg,#323232,#111)!important;border-color:#aaa!important;color:#fff!important;text-shadow:0 0 6px rgba(255,255,255,.34)!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18),0 4px 0 #000!important}
body.theme-retro80s .nav{background:rgba(8,8,8,.97)!important;border-top-color:#777!important}
body.theme-retro80s .nav button,body.theme-retro80s .nav button.active{color:#fff!important;text-shadow:0 0 6px rgba(255,255,255,.3)!important}
body.theme-retro80s .nav button.active{background:#333!important;box-shadow:inset 0 0 0 1px #aaa,0 0 14px rgba(255,255,255,.12)!important}
body.theme-retro80s input,body.theme-retro80s select,body.theme-retro80s textarea{background:#0d0d0d!important;color:#fff!important;border-color:#777!important}
body.theme-retro80s input::placeholder,body.theme-retro80s textarea::placeholder{color:#bbb!important}
body.theme-retro80s .wallet{background:#000!important;color:#fff!important;border-color:#aaa!important}
body.theme-retro80s::after{background:repeating-linear-gradient(0deg,rgba(255,255,255,.055) 0 1px,transparent 1px 4px)!important;mix-blend-mode:screen!important;opacity:.42!important}
body.theme-retro80s .primary{color:#fff!important}
.difficulty-brutal{color:#c98cff!important;box-shadow:0 0 22px rgba(201,140,255,.20)!important}
body.theme-carretera{background:linear-gradient(180deg,#06111e 0%,#101827 48%,#050608 100%)!important;color:#f7fbff!important;overflow-x:hidden!important}
body.theme-carretera .card{background:linear-gradient(180deg,rgba(15,25,39,.96),rgba(5,9,15,.98));border-color:rgba(255,206,73,.22);box-shadow:0 16px 44px rgba(0,0,0,.35),inset 0 0 24px rgba(255,206,73,.025)}
body.theme-carretera .hero{background:linear-gradient(145deg,rgba(22,37,58,.98),rgba(6,10,17,.99));border-color:rgba(255,206,73,.32)}
body.theme-carretera .btn.primary{background:linear-gradient(135deg,#ffd34d,#ff8a36);color:#17100a;border-color:#ffe28a;box-shadow:0 10px 32px rgba(255,174,55,.18)}
body.theme-carretera .nav{background:rgba(3,6,11,.96);border-top-color:rgba(255,206,73,.22)}
body.theme-carretera .nav button.active{background:linear-gradient(180deg,rgba(255,211,77,.20),rgba(255,138,54,.12));box-shadow:inset 0 0 0 1px rgba(255,211,77,.27),0 0 20px rgba(255,180,55,.08)}
.swq-road-layer{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
body.theme-carretera .app{position:relative;z-index:2}
.swq-road-stars{position:absolute;inset:0;background-image:radial-gradient(circle,rgba(255,255,255,.75) 0 1px,transparent 1.6px);background-size:87px 71px;opacity:.28}
.swq-road-city{position:absolute;left:0;right:0;bottom:34%;height:24%;background:linear-gradient(180deg,transparent,#080d16 82%);opacity:.9}
.swq-road-city::before{content:"▮ ▮▮ ▮ ▮▮▮ ▮ ▮▮ ▮▮ ▮ ▮▮▮ ▮";position:absolute;left:2%;right:2%;bottom:3px;color:#182233;font-size:clamp(28px,5vw,62px);letter-spacing:7px;white-space:nowrap;text-shadow:0 0 10px rgba(255,197,65,.10);overflow:hidden}
.swq-road{position:absolute;left:-8%;right:-8%;bottom:-3%;height:42%;background:linear-gradient(180deg,#151a21,#080b10 68%,#030406);clip-path:polygon(27% 0,73% 0,100% 100%,0 100%);border-top:2px solid rgba(255,215,96,.15);box-shadow:inset 0 30px 55px rgba(0,0,0,.55)}
.swq-road::after{content:"";position:absolute;left:49.3%;top:0;width:1.4%;height:100%;background:repeating-linear-gradient(180deg,rgba(255,233,150,.9) 0 36px,transparent 36px 76px);filter:drop-shadow(0 0 7px rgba(255,214,81,.45));transform:skewX(-1deg)}
.swq-road-light{position:absolute;top:59%;width:2px;height:25%;background:linear-gradient(#ffe79e,transparent);box-shadow:0 0 12px rgba(255,213,81,.55)}
.swq-road-light.l1{left:13%}.swq-road-light.l2{right:13%}.swq-road-light.l3{left:30%;top:67%;height:16%}.swq-road-light.l4{right:30%;top:67%;height:16%}
.swq-road-car,.swq-road-plane{position:absolute;will-change:transform;filter:drop-shadow(0 4px 8px rgba(0,0,0,.7));font-size:30px;white-space:nowrap}
.swq-road-car{animation:swqCarDrive var(--dur,5.5s) linear forwards}.swq-road-car.reverse{animation-name:swqCarDriveReverse}.swq-road-car.fast{font-size:36px}
.swq-road-plane{font-size:22px;animation:swqPlaneFly var(--dur,8s) linear forwards;opacity:.75;text-shadow:0 0 7px rgba(156,207,255,.55)}
@keyframes swqCarDrive{from{transform:translateX(-18vw)}to{transform:translateX(118vw) translateY(-3vh)}}
@keyframes swqCarDriveReverse{from{transform:translateX(118vw) scaleX(-1)}to{transform:translateX(-18vw) scaleX(-1)}}
@keyframes swqPlaneFly{from{transform:translateX(-15vw) translateY(0) scale(.85)}to{transform:translateX(118vw) translateY(-7vh) scale(1.05)}}
.swq-time-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:9px}
.swq-time-tab{min-height:40px;border:1px solid #294867;border-radius:11px;background:#0b1725;color:#91abc1;font-weight:1000}.swq-time-tab.active{background:linear-gradient(135deg,#42ddff,#765cff);color:#06111e;border-color:#8eeeff;box-shadow:0 0 18px rgba(66,221,255,.18)}
.swq-time-best{margin-top:9px;padding:10px 11px;border:1px solid rgba(255,214,86,.25);border-radius:13px;background:linear-gradient(135deg,rgba(255,214,86,.09),rgba(66,221,255,.04))}
.swq-time-row{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid rgba(41,72,103,.55)}.swq-time-row:last-child{border-bottom:0}.swq-time-value{font-size:20px;font-weight:1000}
@media(max-width:560px){.swq-time-tabs{gap:5px}.swq-time-tab{font-size:12px}.swq-road-car{font-size:25px}.swq-road-car.fast{font-size:30px}.swq-road-plane{font-size:18px}}
`;
    document.head.appendChild(s);
  }

  function ensureCarreteraTheme(){
    try{
      if(typeof THEMES!=='undefined'&&!THEMES.Carretera)THEMES.Carretera={a:'#ffd34d',b:'#2f74ff',emoji:'🚗',desc:'Autopista nocturna con tráfico, luces de ciudad y aviones cruzando el cielo.'};
      if(typeof SHOP!=='undefined'&&!SHOP.some(x=>x.id==='theme_Carretera'))SHOP.push({id:'theme_Carretera',icon:'🚗',name:'Carretera Nocturna',price:450,desc:'Autopista nocturna con autos, luces y aviones pasando ocasionalmente.',buy:()=>S.purchases.theme_Carretera=true});
    }catch(e){console.warn('SWQ Carretera theme',e)}
  }
  function createRoadLayer(){
    if(roadLayer&&roadLayer.isConnected)return;
    roadLayer=document.createElement('div');roadLayer.id='swqRoadLayer';roadLayer.className='swq-road-layer';
    roadLayer.innerHTML='<div class="swq-road-stars"></div><div class="swq-road-city"></div><div class="swq-road"></div><div class="swq-road-light l1"></div><div class="swq-road-light l2"></div><div class="swq-road-light l3"></div><div class="swq-road-light l4"></div>';
    document.body.appendChild(roadLayer);
  }
  function clearRoadLayer(){
    if(roadTimer){clearInterval(roadTimer);roadTimer=null}if(planeTimer){clearInterval(planeTimer);planeTimer=null}
    if(roadLayer){roadLayer.remove();roadLayer=null}
  }
  function spawnRoadCar(){
    if(S.settings.theme!=='Carretera'||!roadLayer)return;
    const el=document.createElement('span');el.className='swq-road-car'+(Math.random()<.3?' fast':'');
    el.textContent=['🚗','🚙','🚕','🚌'][Math.floor(Math.random()*4)];
    const reverse=Math.random()<.28;if(reverse)el.classList.add('reverse');
    el.style.setProperty('--dur',(4.5+Math.random()*4.5)+'s');el.style.top=(61+Math.random()*27)+'%';
    el.style.filter=`drop-shadow(0 3px 8px rgba(0,0,0,.8)) ${reverse?'brightness(.8)':'brightness(1)'}`;
    roadLayer.appendChild(el);setTimeout(()=>el.remove(),10000);
  }
  function spawnRoadPlane(){
    if(S.settings.theme!=='Carretera'||!roadLayer)return;
    const el=document.createElement('span');el.className='swq-road-plane';el.textContent=Math.random()<.5?'✈️':'🛫';
    el.style.top=(10+Math.random()*25)+'%';el.style.setProperty('--dur',(8+Math.random()*7)+'s');
    roadLayer.appendChild(el);setTimeout(()=>el.remove(),17000);
  }
  function syncRoadTheme(){
    if(S.settings.theme==='Carretera'){
      createRoadLayer();
      if(!roadTimer)roadTimer=setInterval(()=>{if(!document.hidden){spawnRoadCar();if(Math.random()<.24)spawnRoadCar()}},1250);
      if(!planeTimer)planeTimer=setInterval(()=>{if(!document.hidden&&Math.random()<.75)spawnRoadPlane()},4500);
    }else clearRoadLayer();
  }

  const TIME_STYLES=[['crol','🌊','Crol'],['espalda','🌙','Espalda'],['pecho','🐸','Pecho'],['mariposa','🦋','Mariposa']];
  function recordsForDistance(dist){
    const out={};
    for(const [key,icon,name] of TIME_STYLES){
      let best=null;
      for(const e of (S.trainings||[]))for(const s of (e.series||[])){
        const d=num(s.distance),reps=num(s.reps),t=num(s.time);
        if(s.style!==key||d!==dist||reps!==1||t<=0)continue;
        if(best===null||t<best.time)best={time:t,date:e.date};
      }
      out[key]=best?{...best,icon,name}:null;
    }
    return out;
  }
  function bestAllTime(){
    let best=null;
    for(const dist of [25,50,100,200]){
      const r=recordsForDistance(dist);
      for(const [key,val] of Object.entries(r))if(val&&(!best||val.time<best.time))best={style:key,distance:dist,...val};
    }
    return best;
  }
  window.swqSetTimeCategory=function(dist){
    timeCategory=String(dist);localStorage.setItem('SWIM_QUEST_TIME_CATEGORY',timeCategory);renderTimePanel();
  };
  function renderTimePanel(){
    const card=document.getElementById('swqProfileTimes');if(!card||updatingProfilePanel)return;
    const dist=Number(timeCategory);const data=recordsForDistance(dist);const overall=bestAllTime();
    updatingProfilePanel=true;
    card.innerHTML=`<div class="sectionTitle">⏱️ TIEMPOS POR DISTANCIA</div><div class="sub" style="margin-top:4px">Tu mejor tiempo registrado por estilo. Selecciona una modalidad para ver ${dist} m.</div>
      <div class="swq-time-tabs">${[25,50,100,200].map(x=>`<button class="swq-time-tab ${x===dist?'active':''}" onclick="swqSetTimeCategory(${x})">${x} m</button>`).join('')}</div>
      ${overall?`<div class="swq-time-best"><div class="kicker">🏆 MEJOR MARCA GENERAL</div><b>${overall.icon} ${overall.name} · ${overall.distance} m</b><div class="swq-time-value">${overall.time.toFixed(2)} s</div></div>`:`<div class="swq-time-best"><div class="kicker">🏆 MEJOR MARCA GENERAL</div><div class="sub">Todavía no hay tiempos registrados.</div></div>`}
      <div style="margin-top:5px">${TIME_STYLES.map(([key,icon,name])=>{const v=data[key];return `<div class="swq-time-row"><div><b>${icon} ${name}</b><div class="sub">${v?'Récord en '+dist+' m · '+labelDate(v.date):'Sin tiempo registrado en '+dist+' m'}</div></div><div class="swq-time-value">${v?v.time.toFixed(2)+' s':'—'}</div></div>`}).join('')}</div>
      <div class="sub" style="margin-top:8px">También se muestran 25 m, 50 m, 100 m y 200 m aunque todavía no tengas marca en todas.</div>`;
    updatingProfilePanel=false;
  }
  function injectProfilePanel(){
    if(!S?.profile)return;
    ensureCarreteraTheme();
    const root=document.getElementById('screen');if(!root)return;
    const title=[...root.querySelectorAll('.sectionTitle')].find(x=>x.textContent.trim().includes('Marcas personales'));
    const card=title?.closest('.card');
    if(!card)return;
    const isNew=card.id!=='swqProfileTimes';
    if(isNew)card.id='swqProfileTimes';
    if(isNew)renderTimePanel();
    const firstCard=root.querySelector('.card');
    if(firstCard&&!document.getElementById('swqAverageCard')){
      const avg=updateWeeklyAverage(false);
      const averageCard=document.createElement('div');averageCard.id='swqAverageCard';averageCard.className='card';averageCard.style.marginTop='10px';
      averageCard.innerHTML=`<div class="sectionTitle">🏊 TU REFERENCIA HABITUAL</div><div class="row" style="margin-top:7px"><div><div class="sub">Cuántos metros sueles nadar por clase</div><div class="big" style="font-size:31px">${fmt(avg)} m</div><div class="sub">Promedio de todos tus entrenamientos · se actualiza cada semana.</div></div><span class="pill">📊 Media semanal</span></div>`;
      firstCard.insertAdjacentElement('afterend',averageCard);
    }
  }

  const PEAR_NEW_LINES=[
    {speaker:'👤 TÚ',text:'Pera, a veces siento que otra persona es mejor que yo en todo.'},
    {speaker:'🍐 PERA',text:'¿Otra persona? Que alguien parezca mejor que tú en muchas cosas no significa que sea mejor que tú como persona. Y, además, ustedes tienen funciones y caminos distintos.'},
    {speaker:'👤 TÚ',text:'Pero en natación quizá sí sea mejor. Nada más rápido, parece saber más y todo le sale con facilidad.'},
    {speaker:'🍐 PERA',text:'Entonces en natación puede que tenga ventaja en algunas cosas. Eso es un dato concreto sobre una habilidad, no una sentencia sobre tu valor completo.'},
    {speaker:'👤 TÚ',text:'Supongo que comparo mis dudas y mis errores con lo que veo que la otra persona hace bien.'},
    {speaker:'🍐 PERA',text:'Exactamente. Tú ves todo lo que ocurre dentro de tu cabeza: los nervios, los días malos y cada error. De la otra persona muchas veces solo ves el resultado que sale bien. Así cualquiera parece perfecto.'},
    {speaker:'👤 TÚ',text:'¿Y si realmente es mejor que yo en algo que me importa mucho?'},
    {speaker:'🍐 PERA',text:'Puede pasar. Y eso tampoco significa que seas peor en todo. Tal vez esa persona te supere nadando, pero tú tengas más paciencia, seas mejor explicando, tengas más creatividad, seas más observador o destaques en otra cosa que todavía estás descubriendo.'},
    {speaker:'🍐 PERA',text:'No necesitas encontrar una categoría donde seas superior para compensar la que perdiste. Una diferencia de habilidad no es una diferencia de valor.'},
    {speaker:'👤 TÚ',text:'Entonces admirar a esa persona no tiene que convertirse en envidia.'},
    {speaker:'🍐 PERA',text:'Exacto. Puedes reconocer lo que hace bien, aprender de ello y seguir construyendo tu propio camino. No conviertas a otra persona en la regla con la que decides cuánto vales.'},
    {speaker:'🍐 PERA',text:'Tú no eres una copia peor de nadie. Eres una persona distinta, con cosas que otros tienen y cosas que ellos todavía no tienen. La comparación puede enseñarte; no debería definirte.'}
  ];
  function patchPearDialogue(){
    try{
      if(typeof PEAR_TOPIC_DIALOGUES!=='undefined'){
        let idx=PEAR_TOPIC_DIALOGUES.findIndex(x=>/envidia|parece mejor|compar/i.test(x.title||''));
        if(idx<0){idx=PEAR_TOPIC_DIALOGUES.length;PEAR_TOPIC_DIALOGUES.push({id:'tema9',title:'Siento envidia de otra persona que parece mejor que yo',lines:PEAR_NEW_LINES});}
        else{PEAR_TOPIC_DIALOGUES[idx].title='Siento envidia de otra persona que parece mejor que yo';PEAR_TOPIC_DIALOGUES[idx].lines=PEAR_NEW_LINES;}
      }
    }catch(e){console.warn('SWQ Pera',e)}
  }

  async function repairAll(){
    try{patchAchievementRules();patchPearDialogue();updateWeeklyAverage(false);const localChanged=dedupeLocalTrainings();repaintStoredDifficulties();repairAchievements();
      await dedupeRemoteTrainings();
      if(localChanged)render();
    }catch(e){console.warn('SWQ repairAll',e)}
  }

  function onRenderMutation(){
    try{injectProfilePanel();syncRoadTheme();patchPearMobile();enforceButterfly();}catch(e){}
  }

  injectMainCSS();
  patchAchievementRules();
  patchPearDialogue();
  ensureCarreteraTheme();
  try{if(S?.settings?.theme==='Carretera'&&typeof applyTheme==='function')applyTheme();}catch(e){}
  try{updateWeeklyAverage(false);repaintStoredDifficulties();repairAchievements();enforceButterfly();patchPearMobile();}catch(e){console.warn('SWQ startup repair',e)}

  try{
    const originalSaveTraining=window.saveTraining;
    if(originalSaveTraining&&!window.__swqSaveTrainingWrap){
      window.saveTraining=function(){
        try{enforceButterfly();}catch(e){}
        const result=originalSaveTraining.apply(this,arguments);
        setTimeout(()=>{
          try{updateWeeklyAverage(false);repaintStoredDifficulties();dedupeLocalTrainings();patchAchievementRules();repairAchievements();syncRoadTheme();if(authUser)syncProfileToCloud();render();}catch(e){console.warn('SWQ post-save',e)}
        },80);
        return result;
      };
      window.__swqSaveTrainingWrap=true;
    }
  }catch(e){console.warn('SWQ save wrapper',e)}

  document.addEventListener('change',e=>{if(e.target?.matches?.('select.draftInput[data-k="style"],select.draftInput[data-k="intensity"]'))setTimeout(enforceButterfly,0);},true);
  enforceButterfly();

  setTimeout(()=>{repairAll();syncRoadTheme();onRenderMutation();},700);
  setTimeout(()=>{repairAll();syncRoadTheme();onRenderMutation();},1800);

  const observer=new MutationObserver(()=>onRenderMutation());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setInterval(()=>{
    try{
      const before=(S.trainings||[]).length;
      const changed=dedupeLocalTrainings();
      if(changed||before!==(S.trainings||[]).length){repairAchievements();render();}
      if(authUser)dedupeRemoteTrainings();
      syncRoadTheme();patchAchievementRules();patchPearDialogue();
    }catch(e){}
  },6500);
})();
