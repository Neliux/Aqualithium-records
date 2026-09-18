/* Swim Quest · actualización 2026-09-18 v7
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
  if(window.__SWQ_FINAL_FIXES_20260918_6__)return;
  window.__SWQ_FINAL_FIXES_20260918_6__=true;

  const VERSION='20260918-6';
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
      const bee=ACHIEVEMENTS.find(a=>a.id==='whoLeftThis');
      if(bee){
        bee.icon='🐝';
        bee.title='¿Quién dejó esto aquí?';
        bee.desc='Registra una marca de tiempo en 200 m mariposa.';
        bee.reward={...(bee.reward||{}),theme:'Bee',coins:500,xp:900};
        bee.ok=()=>S.trainings.some(e=>(e.series||[]).some(s=>s.style==='mariposa'&&num(s.distance)===200&&num(s.reps)===1&&num(s.time)>0));
      }
      const demon=ACHIEVEMENTS.find(a=>a.id==='demon');
      if(demon)demon.ok=()=>S.trainings.some(e=>difficultyByPercent(e,S.profile?.avgMeters).key==='demoniaco');
      const maso=ACHIEVEMENTS.find(a=>a.id==='maso');
      if(maso){
        maso.title='Masoquista';
        maso.desc='Completa un entrenamiento de 450% o más de tu promedio semanal.';
        maso.ok=()=>S.trainings.some(e=>difficultyByPercent(e,S.profile?.avgMeters).key==='masoquista');
      }
    }catch(e){console.warn('SWQ achievement patch',e)}
  }
  function repairAchievements(){
    if(!Array.isArray(S.achievements))S.achievements=[];
    const before=[...S.achievements],seen=new Set(),keep=[];let changed=false;
    for(const id of before){
      if(seen.has(id))continue;
      seen.add(id);
      /* Unlocked achievements are permanent: changing an achievement's rule must never erase progress. */
      keep.push(id);
    }
    if(keep.length!==before.length){
      changed=true;
      S.achievements=keep;
      try{save();}catch(e){}
    }
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
      if(!roadTimer)roadTimer=setInterval(()=>{if(!document.hidden){spawnRoadCar();if(Math.random()<.10)spawnRoadCar()}},1700);
      if(!planeTimer)planeTimer=setInterval(()=>{if(!document.hidden&&Math.random()<.10)spawnRoadPlane()},24000);
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

  let swqMutationRepairQueued=false;
  function onRenderMutation(){
    if(swqMutationRepairQueued)return;
    swqMutationRepairQueued=true;
    const run=()=>{
      swqMutationRepairQueued=false;
      try{
        injectProfilePanel();
        syncRoadTheme();
        patchPearMobile();
        enforceButterfly();
        swqTrimVisualLayers();
      }catch(e){}
    };
    if(window.requestAnimationFrame)requestAnimationFrame(run);else setTimeout(run,50);
  }

  function swqTrimVisualLayers(){
    try{
      const limits={
        themeParticles:10,
        swqLeviathanLayer:10,
        swqChessLayer:10,
        swqChessBurstLayer:8,
        swqImpactLayer:5
      };
      for(const [id,limit] of Object.entries(limits)){
        const host=document.getElementById(id);
        if(!host)continue;
        while(host.childElementCount>limit)host.firstElementChild?.remove();
      }
    }catch(e){}
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

  /* === UPDATE 2026-09-17 v2: economía, progresión, Pera, Pez, temas y cuentas === */
  function swqEnsureConsumables(){
    S.consumables=S.consumables||{};
    if(!Number.isFinite(Number(S.consumables.cloroPremium)))S.consumables.cloroPremium=0;
    if(!Number.isFinite(Number(S.consumables.fichaNadador)))S.consumables.fichaNadador=0;
  }
  function swqInflateShopPrices(){
    try{
      if(typeof SHOP==='undefined'||!Array.isArray(SHOP))return;
      for(const it of SHOP){
        if(!it||!Number.isFinite(Number(it.price))||Number(it.price)<=0||it.__swqPriceInflated20260917_2)continue;
        it.price=Math.max(1,Math.ceil(Number(it.price)*1.10));
        Object.defineProperty(it,'__swqPriceInflated20260917_2',{value:true,writable:false,enumerable:false});
      }
    }catch(e){console.warn('SWQ economy',e)}
  }
  function swqPatchXPGems(){
    try{
      const gemValues={xp500:650,xp1500:1950,xpJuan:13000};
      const gemNames={xp500:'Cristal XP 650',xp1500:'Cristal XP 1.950',xpJuan:'Cristal de Ascensión · 13.000 XP'};
      const gemDescs={xp500:'Gema de XP. Otorga 650 XP (30% más que antes).',xp1500:'Gema de XP. Otorga 1.950 XP (30% más que antes).',xpJuan:'Gema de XP especial. Otorga 13.000 XP (30% más que antes).' };
      for(const [id,val] of Object.entries(gemValues)){
        const it=SHOP?.find?.(x=>x.id===id);if(!it)continue;
        it.name=gemNames[id];it.desc=gemDescs[id];it.buy=()=>gainXP(val);
      }
    }catch(e){console.warn('SWQ XP gems',e)}
  }
  function swqRemoveBebidaIsotonica(){
    try{
      if(Array.isArray(SHOP))for(let i=SHOP.length-1;i>=0;i--)if(SHOP[i]?.id==='bebidaIsotonica')SHOP.splice(i,1);
      if(S?.consumables)delete S.consumables.bebidaIsotonica;
    }catch(e){console.warn('SWQ remove isotonic',e)}
  }

  function swqPatchCloroShopText(){
    try{
      const it=SHOP?.find?.(x=>x.id==='cloroPremium');
      if(it){it.name='Cloro Premium';it.desc='Consumible. Potencia en un 70% el XP del próximo entrenamiento. El efecto se consume al finalizar esa sesión.';}
    }catch(e){console.warn('SWQ cloro text',e)}
  }

  function swqEnsureNewShopItems(){
    try{
      if(typeof THEMES!=='undefined'&&!THEMES.Impacto)THEMES.Impacto={a:'#ff7a18',b:'#17110d',emoji:'💥',desc:'Impactos naranja, negro y amarillo con destellos y orbes de energía que caen lentamente.'};
      if(typeof SHOP!=='undefined'&&!SHOP.some(x=>x.id==='theme_Impacto'))SHOP.push({id:'theme_Impacto',icon:'💥',name:'Impacto Naranja',price:620,desc:'Estética naranja y negra con destellos, chispas y orbes de energía.',buy:()=>S.purchases.theme_Impacto=true});
      if(typeof SHOP!=='undefined'&&!SHOP.some(x=>x.id==='fichaNadador'))SHOP.push({id:'fichaNadador',icon:'🎟️',name:'Ficha del Nadador',price:260,desc:'Consumible. +30% de monedas en tu siguiente entrenamiento.',buy:()=>{swqEnsureConsumables();S.consumables.fichaNadador=(S.consumables.fichaNadador||0)+1;}});
    }catch(e){console.warn('SWQ new shop items',e)}
  }
  function swqPatchCloroAndTrainingXP(){
    try{
      swqEnsureConsumables();

      if(!window.__swqTrainingRewardsPatched20260918_6){
        const baseTrainingXP=trainingXP;
        trainingXP=function(e,state=null){
          const raw=Math.max(0,Number(baseTrainingXP(e,state))||0);
          return Math.round(raw*1.25);
        };

        trainingCoins=function(e){
          const rawXp=Math.max(0,Number(baseTrainingXP(e,null))||0);
          return Math.max(25,Math.round(rawXp*.132*trainingCoinMultiplier()*1.15));
        };

        if(typeof draftXP==='function'){
          const baseDraftXP=draftXP;
          draftXP=function(){
            const hasCloro=Number(S.consumables?.cloroPremium||0)>0;
            let raw=Math.max(0,Number(baseDraftXP())||0);
            if(hasCloro)raw/=1.20; /* remove the old preview-only Cloro multiplier */
            return Math.round(raw*1.25*(hasCloro?1.70:1));
          };
        }

        if(typeof draftCoins==='function'){
          const baseDraftXP=typeof draftXP==='function'?draftXP:null;
          const baseDraftPreview=typeof baseDraftXP==='function'?baseDraftXP:null;
          draftCoins=function(){
            const hasCloro=Number(S.consumables?.cloroPremium||0)>0;
            const hasTicket=Number(S.consumables?.fichaNadador||0)>0;
            /* Coins are boosted independently by +15%; the new +25% XP boost does not compound into coins. */
            let raw=0;
            try{
              const originalPreview=typeof baseDraftPreview==='function'?baseDraftPreview():0;
              raw=Math.max(0,Number(originalPreview)||0);
            }catch(e){}
            if(hasCloro)raw/=1.25;
            if(hasCloro)raw/=1.70;
            const coinBase=Math.max(25,Math.round(raw*.132*trainingCoinMultiplier()*1.15));
            return hasTicket?Math.max(25,Math.round(coinBase*1.45)):coinBase;
          };
        }

        window.__swqTrainingRewardsPatched20260918_6=true;
      }

      if(!window.__swqSaveTrainingBoosts20260918_6){
        const previousSaveTraining=window.saveTraining;
        if(typeof previousSaveTraining==='function'){
          window.saveTraining=function(){
            swqEnsureConsumables();
            const hadCloro=Number(S.consumables.cloroPremium||0)>0;
            const hadCoin=Number(S.consumables.fichaNadador||0)>0;
            const beforeCount=Array.isArray(S.trainings)?S.trainings.length:0;
            const oldCloro=Number(S.consumables.cloroPremium||0);
            const oldCoin=Number(S.consumables.fichaNadador||0);

            /* Let the underlying save create the workout with the permanent global bonuses only. */
            if(hadCloro)S.consumables.cloroPremium=0;
            if(hadCoin)S.consumables.fichaNadador=0;

            let result;
            try{result=previousSaveTraining.apply(this,arguments);}
            catch(err){
              S.consumables.cloroPremium=oldCloro;
              S.consumables.fichaNadador=oldCoin;
              throw err;
            }

            setTimeout(async()=>{
              try{
                if(!Array.isArray(S.trainings)||S.trainings.length<=beforeCount){
                  S.consumables.cloroPremium=oldCloro;
                  S.consumables.fichaNadador=oldCoin;
                  return;
                }

                const e=S.trainings[S.trainings.length-1];
                const baseXp=Math.max(0,Number(e.xp)||0);
                const desiredXp=Math.round(baseXp*(hadCloro?1.70:1));
                const extraXp=Math.max(0,desiredXp-baseXp);
                e.xp=desiredXp;
                if(extraXp>0&&typeof gainXP==='function')gainXP(extraXp);

                const baseCoins=Math.max(0,Number(e.coins)||0);
                const desiredCoins=hadCoin?Math.round(baseCoins*1.45):baseCoins;
                const extraCoins=Math.max(0,desiredCoins-baseCoins);
                e.coins=desiredCoins;
                if(extraCoins)S.coins+=extraCoins;

                S.consumables.cloroPremium=Math.max(0,oldCloro-(hadCloro?1:0));
                S.consumables.fichaNadador=Math.max(0,oldCoin-(hadCoin?1:0));

                try{save();}catch(e){}
                try{render();}catch(e){}
                if(authUser&&typeof syncTrainingToCloud==='function')try{await syncTrainingToCloud(e);}catch(err){console.warn('SWQ boosted workout sync',err)}
                if(authUser&&typeof syncProfileToCloud==='function')try{await syncProfileToCloud();}catch(err){console.warn('SWQ boosted profile sync',err)}
              }catch(err){console.warn('SWQ training boosts',err)}
            },30);
            return result;
          };
          window.__swqSaveTrainingBoosts20260918_6=true;
        }
      }
    }catch(e){console.warn('SWQ training reward patch',e)}
  }
  function swqPatchProgression(){
    try{
      const levelMap={plata:5,oro:12,platino:20,diamante:30,esmeralda:42,zafiro:56,amatista:72,mercurio:90,venus:112,marte:138,jupiter:168,saturno:205,urano:250,neptuno:305,orca:350,tiburon:410,kraken:500,megalodon:600,leviatan:700,poseidon:820,coach:950};
      for(const r of (RANKS||[]))if(levelMap[r.c])r.lv=levelMap[r.c];
      const needForLevel=lvl=>Math.round((110+lvl*10+Math.pow(lvl,1.18)*4.5)*1.45+Math.max(0,15-lvl)*18);
      levelFromXP=function(xp){let lvl=1,used=0,target=Math.max(0,Number(xp)||0);while(lvl<999){const need=Math.max(1,needForLevel(lvl));if(used+need>target)break;used+=need;lvl++;}return lvl;};
      xpForLevel=function(lvl){let x=0,target=Math.max(1,Math.floor(Number(lvl)||1));for(let i=1;i<target;i++)x+=Math.max(1,needForLevel(i));return x;}; S.level=levelFromXP(S.xp);
    }catch(e){console.warn('SWQ progression',e)}
  }
  const SWQ_EXTRA_FISH_MESSAGES=[
    'No todos los días de piscina tienen que terminar con un récord.','La técnica se construye repitiendo lo básico hasta que deje de sentirse básico.','Un mal tiempo puede ser un dato, no una sentencia sobre tu progreso.','Tu ritmo también importa: nadar siempre al máximo no es la única forma de entrenar.','Una sesión tranquila puede ayudarte a llegar mejor preparado a la siguiente.','Aprender un estilo nuevo suele sentirse raro antes de sentirse natural.','No conviertas una sola marca en la definición de toda tu temporada.','La paciencia también se entrena, aunque no puedas medirla en metros.','Un error técnico te da información que antes no tenías.','Tu entrenamiento de hoy no tiene que parecerse al de hace un mes.','La constancia no significa hacer todo perfecto; significa volver a intentarlo.','Escuchar al cuerpo también forma parte de aprender a entrenar bien.','Cada vuelta puede enseñarte algo distinto si prestas atención.','No todo progreso se ve en el cronómetro: también está en cómo te sientes en el agua.','La confianza crece cuando compruebas que puedes resolver pequeñas dificultades.','No dejes que una práctica floja borre mentalmente todas las buenas.','A veces el mayor avance es entender qué necesitas cambiar.','Compararte con tu marca anterior puede darte contexto sin convertirlo en presión.','Tu estilo favorito no tiene que ser el único que te haga mejorar.','Hay días para apretar el ritmo y días para aprender con calma.'
  ];
  function swqPatchFishMotivation(){
    try{
      if(typeof FISH_MESSAGES!=='undefined'&&Array.isArray(FISH_MESSAGES))for(const msg of SWQ_EXTRA_FISH_MESSAGES)if(!FISH_MESSAGES.includes(msg))FISH_MESSAGES.push(msg);
      if(window.__swqFishMotivation20260917_2)return;
      const previousFishMotivation=window.fishMotivation;if(typeof previousFishMotivation!=='function')return;
      window.fishMotivation=function(){
        const fish=$('profileFish');
        if(fish?.dataset.inviteActive==='1'){clearTimeout(window.__swqFishOfferTimer20260917_2);fish.dataset.inviteActive='0';fish.classList.remove('fish-shop-invite');fish.onclick=window.fishMotivation;openFishShop();return;}
        localStorage.setItem('SWIM_QUEST_FISH_CLICKS',String(Number(localStorage.getItem('SWIM_QUEST_FISH_CLICKS')||0)+1));
        const msg=FISH_MESSAGES[Math.floor(Math.random()*FISH_MESSAGES.length)];
        if(fish){fish.classList.remove('fishTalk');void fish.offsetWidth;fish.classList.add('fishTalk');}
        const bubble=$('fishBubble');
        if(bubble){
          bubble.className='fish-bubble';bubble.innerHTML='<div class="fish-message">'+esc(msg)+'</div>';
          if(Math.random()<0.04){
            clearTimeout(window.__swqFishOfferTimer20260917_2);fish.dataset.inviteActive='1';fish.classList.add('fish-shop-invite');
            bubble.innerHTML='<div class="fish-message">¿TE GUSTARÍA ENTRAR A MI TIENDA?</div>';fish.onclick=window.fishMotivation;
            window.__swqFishOfferTimer20260917_2=setTimeout(()=>{if(fish?.isConnected&&fish.dataset.inviteActive==='1'){fish.dataset.inviteActive='0';fish.classList.remove('fish-shop-invite');fish.onclick=window.fishMotivation;bubble.innerHTML='<div class="fish-message">'+esc(msg)+'</div>'; }},6000);
          }
        }else toast(msg,5100);
      };
      window.__swqFishMotivation20260917_2=true;
    }catch(e){console.warn('SWQ fish',e)}
  }
  const SWQ_EXTRA_PEAR_DIALOGUES=[
    {id:'tema10',title:'Me pongo muy nervioso antes de competir',lines:[
      {speaker:'👤 TÚ',text:'Pera, antes de competir me pongo muy nervioso. Siento que voy a olvidar todo lo que practiqué.'},
      {speaker:'🍐 PERA',text:'Los nervios antes de una competencia son bastante comunes. Tu cuerpo sabe que la situación importa y se prepara para prestar atención.'},
      {speaker:'👤 TÚ',text:'Pero cuando siento el corazón acelerado creo que voy a nadar peor.'},
      {speaker:'🍐 PERA',text:'Sentir nervios no significa que el resultado vaya a salir mal. Puedes notar los nervios y aun así seguir una rutina sencilla que ya conoces.'},
      {speaker:'👤 TÚ',text:'¿Entonces no tengo que intentar hacer desaparecer los nervios?'},
      {speaker:'🍐 PERA',text:'No hace falta. Puedes concentrarte en lo que sí controlas: tu salida, tu respiración, tu técnica y cómo afrontas cada parte de la prueba.'},
      {speaker:'🍐 PERA',text:'No necesitas entrar al agua sintiéndote perfecto. Necesitas entrar sabiendo qué vas a intentar hacer y aceptar que un poco de nervios puede acompañarte.'}
    ]},
    {id:'tema11',title:'Me siento culpable cuando necesito descansar',lines:[
      {speaker:'👤 TÚ',text:'A veces siento culpa cuando descanso. Pienso que si no estoy entrenando, estoy perdiendo tiempo.'},
      {speaker:'🍐 PERA',text:'Descansar no borra lo que ya entrenaste. Forma parte de cómo el cuerpo se recupera después de una sesión y de cómo puedes volver a practicar con atención.'},
      {speaker:'👤 TÚ',text:'Pero otros días veo que alguien entrenó y yo no, y siento que me estoy quedando atrás.'},
      {speaker:'🍐 PERA',text:'Comparar dos calendarios sin conocer todo lo que hay detrás tampoco es justo. Cada nadador tiene horarios, escuela, familia y necesidades distintas.'},
      {speaker:'👤 TÚ',text:'Entonces descansar no significa que me esté esforzando menos.'},
      {speaker:'🍐 PERA',text:'Exacto. El objetivo no es llenar cada hueco del calendario, sino construir una práctica que puedas sostener. A veces progresar también significa saber cuándo recuperar.'},
      {speaker:'🍐 PERA',text:'No tienes que ganarle a tu calendario. Tu entrenamiento debe ayudarte a seguir aprendiendo durante mucho tiempo.'}
    ]}
  ];
  function swqPatchPearExtra(){
    try{if(typeof PEAR_TOPIC_DIALOGUES==='undefined'||!Array.isArray(PEAR_TOPIC_DIALOGUES))return;for(const topic of SWQ_EXTRA_PEAR_DIALOGUES){const idx=PEAR_TOPIC_DIALOGUES.findIndex(x=>x.id===topic.id);if(idx<0)PEAR_TOPIC_DIALOGUES.push(topic);else PEAR_TOPIC_DIALOGUES[idx]=topic;}}
    catch(e){console.warn('SWQ extra Pera',e)}
  }
  function swqPatchThemeText(){
    try{
      if(document.getElementById('swq-update2-css'))return;
      const s=document.createElement('style');s.id='swq-update2-css';
      s.textContent=[
        "body.theme-pera .pear-speaker,body.theme-pera .pear-text,body.theme-pera .pear-next,body.theme-pera .pear-close,body.theme-pera .pear-topic-grid button,body.theme-pera .pear-stage h1,body.theme-pera .pear-stage h2,body.theme-pera .pear-stage p,body.theme-pera .pear-stage .sub{color:#c9ffd1!important;text-shadow:0 0 8px rgba(144,255,170,.24)}",
        "body.theme-pera .pear-next{border-color:#93f5a8!important;background:rgba(88,172,99,.20)!important}",
        "body.theme-pera .pear-topic-grid button{border-color:rgba(147,245,168,.38)!important}",
        "body.theme-leviatan .app{position:relative;z-index:2}",
        ".swq-lev-layer{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}",
        ".swq-lev-bubble{position:absolute;width:var(--s,8px);height:var(--s,8px);border-radius:50%;border:1px solid rgba(194,255,246,.50);background:radial-gradient(circle at 35% 30%,rgba(232,255,252,.92),rgba(107,239,221,.28) 38%,transparent 72%);box-shadow:0 0 12px rgba(99,244,224,.34);animation:swqLevBubble var(--d,9s) ease-in-out infinite}",
        ".swq-lev-glow{position:absolute;width:80px;height:80px;border-radius:50%;background:radial-gradient(circle,rgba(104,255,232,.14),transparent 68%);filter:blur(2px);animation:swqLevGlow 7s ease-in-out infinite alternate}",
        ".swq-lev-wave{position:absolute;left:-10%;width:120%;height:190px;border:1px solid rgba(120,255,238,.10);border-radius:50%;filter:blur(.2px);animation:swqLevWave 11s ease-in-out infinite}",
        "@keyframes swqLevBubble{0%{transform:translate3d(0,18vh,0) scale(.55);opacity:0}15%{opacity:.65}55%{transform:translate3d(var(--x,20px),-32vh,0) scale(1)}100%{transform:translate3d(calc(var(--x,20px)*-1),-78vh,0) scale(.75);opacity:0}}",
        "@keyframes swqLevGlow{from{transform:translate3d(-4vw,0,0) scale(.85);opacity:.22}to{transform:translate3d(7vw,9vh,0) scale(1.25);opacity:.48}}",
        "@keyframes swqLevWave{0%,100%{transform:translateY(5vh) rotate(-1deg);opacity:.22}50%{transform:translateY(-2vh) rotate(2deg);opacity:.42}}",
        "body.theme-carretera .swq-road-car{filter:drop-shadow(0 4px 10px rgba(0,0,0,.78)) brightness(1.08)}",
        "body.theme-impacto{background:radial-gradient(circle at 50% -10%,#3a2114 0,#17100d 38%,#050505 100%)!important;color:#fff6df!important}",
        "body.theme-impacto .app{position:relative;z-index:2}",
        "body.theme-impacto .card{background:linear-gradient(180deg,rgba(38,24,17,.96),rgba(11,9,7,.98));border-color:rgba(255,139,45,.26);box-shadow:0 15px 44px rgba(0,0,0,.40),inset 0 0 22px rgba(255,139,45,.035)}",
        "body.theme-impacto .hero{background:linear-gradient(145deg,rgba(59,31,16,.98),rgba(10,8,6,.99));border-color:rgba(255,174,69,.34)}",
        "body.theme-impacto .btn{background:linear-gradient(145deg,#26201a,#0e0b08)!important;border:1px solid rgba(255,153,48,.44)!important;color:#fff3d8!important;box-shadow:inset 0 0 12px rgba(255,145,45,.08),0 8px 26px rgba(0,0,0,.28)}",
        "body.theme-impacto .btn.primary{background:linear-gradient(135deg,#ff9a24,#e64d15)!important;color:#fff8ea!important;border-color:#ffc86b!important}",
        "body.theme-impacto .nav{background:rgba(7,6,5,.96)!important;border-top-color:rgba(255,144,45,.24)!important}",
        ".swq-impact-layer{position:fixed;inset:0;z-index:1;pointer-events:none;overflow:hidden}",
        ".swq-impact-spark{position:absolute;width:5px;height:5px;border-radius:50%;background:#ffd45c;box-shadow:0 0 9px rgba(255,150,35,.9);animation:swqImpactSpark .62s ease-out forwards}",
        ".swq-impact-orb{position:absolute;width:18px;height:18px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff1a4 0 6%,#ff9c24 22%,#d44512 54%,#0c0907 72%,#000 100%);box-shadow:0 0 22px rgba(255,105,15,.46);animation:swqImpactFall var(--fall,11s) linear forwards}",
        "@keyframes swqImpactSpark{from{transform:translate(0,0) scale(1);opacity:1}to{transform:translate(var(--sx,0),var(--sy,0)) scale(.2);opacity:0}}",
        "@keyframes swqImpactFall{from{transform:translateY(-12vh) rotate(0deg) scale(.78);opacity:0}10%{opacity:.95}88%{transform:translateY(108vh) rotate(300deg) scale(1);opacity:1}100%{transform:translateY(118vh) rotate(360deg) scale(.75);opacity:0}}",
        ".swq-impact-flash{position:fixed;width:68px;height:68px;border-radius:50%;pointer-events:none;z-index:100;background:radial-gradient(circle,#fff7cf 0 9%,#ffc247 20%,#ff6a17 39%,transparent 72%);transform:translate(-50%,-50%) scale(.35);animation:swqImpactFlash .34s ease-out forwards;filter:blur(.1px)}",
        "@keyframes swqImpactFlash{0%{opacity:.95;transform:translate(-50%,-50%) scale(.35)}55%{opacity:.85;transform:translate(-50%,-50%) scale(1.45)}100%{opacity:0;transform:translate(-50%,-50%) scale(2.25)}}"
      ].join("");
      document.head.appendChild(s);
    }catch(e){console.warn('SWQ theme text',e)}
  }
  function swqSyncLeviathan(){
    let layer=document.getElementById('swqLeviathanLayer');
    if(S.settings.theme==='Leviatan'){
      if(layer)return;
      layer=document.createElement('div');layer.id='swqLeviathanLayer';layer.className='swq-lev-layer';
      for(let i=0;i<10;i++){const b=document.createElement('span');b.className='swq-lev-bubble';b.style.left=(Math.random()*100)+'%';b.style.top=(78+Math.random()*24)+'%';b.style.setProperty('--s',(4+Math.random()*12)+'px');b.style.setProperty('--x',(-70+Math.random()*140)+'px');b.style.setProperty('--d',(7+Math.random()*8)+'s');b.style.animationDelay=(-Math.random()*12)+'s';layer.appendChild(b);}
      for(let i=0;i<2;i++){const g=document.createElement('span');g.className='swq-lev-glow';g.style.left=(8+i*26+Math.random()*7)+'%';g.style.top=(8+Math.random()*64)+'%';g.style.animationDelay=(-Math.random()*7)+'s';layer.appendChild(g);}
      for(let i=0;i<1;i++){const w=document.createElement('span');w.className='swq-lev-wave';w.style.top=(40+i*17)+'%';w.style.animationDelay=(-i*2.7)+'s';layer.appendChild(w);}
      document.body.appendChild(layer);
    }else if(layer)layer.remove();
  }
  function swqSpawnImpactBurst(x,y){
    const flash=document.createElement('div');flash.className='swq-impact-flash';flash.style.left=x+'px';flash.style.top=y+'px';document.body.appendChild(flash);setTimeout(()=>flash.remove(),420);
    for(let i=0;i<16;i++){const sp=document.createElement('span');sp.className='swq-impact-spark';const a=(Math.PI*2*i/16)+Math.random()*.2,d=26+Math.random()*58;sp.style.left=x+'px';sp.style.top=y+'px';sp.style.setProperty('--sx',Math.cos(a)*d+'px');sp.style.setProperty('--sy',Math.sin(a)*d+'px');document.body.appendChild(sp);setTimeout(()=>sp.remove(),800);}
  }
  let swqImpactTimer=null;
  function swqSpawnImpactOrb(){
    if(S.settings.theme!=='Impacto'||document.hidden)return;
    const layer=document.getElementById('swqImpactLayer');if(!layer)return;
    const orb=document.createElement('span');orb.className='swq-impact-orb';orb.style.left=(5+Math.random()*90)+'%';orb.style.setProperty('--fall',(10+Math.random()*8)+'s');layer.appendChild(orb);
    const finish=()=>{if(!orb.isConnected)return;const r=orb.getBoundingClientRect();swqSpawnImpactBurst(r.left+r.width/2,Math.min(window.innerHeight-16,r.top+r.height/2));orb.remove();};
    orb.addEventListener('animationend',finish,{once:true});setTimeout(finish,19000);
  }
  function swqSyncImpactTheme(){
    let layer=document.getElementById('swqImpactLayer');
    if(S.settings.theme==='Impacto'){
      if(!layer){layer=document.createElement('div');layer.id='swqImpactLayer';layer.className='swq-impact-layer';document.body.appendChild(layer);}
      if(!swqImpactTimer)swqImpactTimer=setInterval(()=>{if(Math.random()<.55)swqSpawnImpactOrb()},10000);
    }else{
      if(swqImpactTimer){clearInterval(swqImpactTimer);swqImpactTimer=null}
      if(layer)layer.remove();
    }
  }
  /* Global performance budget for styles with many animated entities. */
  function swqInstallEntityBudget(){
    try{
      if(window.__swqEntityBudget20260918_6)return;
      const caps={Leviatan:8,Ajedrez:8,Impacto:5,Bomba:5,CobaltoCobre:7,Carretera:5,CianNeon:6,Eclipse:6,Bee:6,Glacial:7};
      const originalSpawn=spawnThemeParticle;
      spawnThemeParticle=function(){
        const host=document.getElementById('themeParticles');
        const theme=S?.settings?.theme;
        const cap=caps[theme]||10;
        if(host&&host.childElementCount>=cap)return;
        return originalSpawn.apply(this,arguments);
      };
      window.__swqEntityBudget20260918_6=true;
    }catch(e){console.warn('SWQ entity budget',e)}
  }

  function swqThemeName(k){
    try{const it=SHOP?.find?.(x=>x.id==='theme_'+k);return it?.name||k.replace(/([a-z])([A-Z])/g,'$1 $2');}catch(e){return k}
  }
  function swqApplyQuickTheme(k){
    try{
      if(typeof THEMES==='undefined'||!THEMES[k])return;
      if(k!=='Aqua'&&!S.purchases?.['theme_'+k]){toast('🔒 Ese estilo todavía no está desbloqueado.');return;}
      S.settings.theme=k;save();if(typeof applyTheme==='function')applyTheme();closeModal();render();
    }catch(e){console.warn('SWQ quick theme',e)}
  }
  function swqQuickTheme(){
    try{
      const keys=['Aqua',...Object.keys(THEMES).filter(k=>k!=='Aqua'&&S.purchases?.['theme_'+k])];
      const unique=[...new Set(keys)];
      modal('<div class="kicker">🎨 ESTILO</div><h2>Cambiar estilo</h2><p class="sub">Elige un estilo que ya tengas desbloqueado.</p><div class="grid g2" style="margin-top:10px">'+unique.map(k=>'<button class="btn '+(S.settings.theme===k?'primary':'secondary')+'" style="min-height:54px;text-align:left" onclick="swqApplyQuickTheme('+JSON.stringify(k)+')">'+esc(THEMES[k]?.emoji||'🎨')+' '+esc(swqThemeName(k))+(S.settings.theme===k?' · ACTUAL':'')+'</button>').join('')+'</div><button class="btn secondary" style="margin-top:10px" onclick="closeModal()">Cerrar</button>');
    }catch(e){console.warn('SWQ quick theme modal',e)}
  }
  function swqInjectQuickThemeButton(){
    try{
      const root=document.getElementById('screen');if(page!=='profile'||!root||document.getElementById('swqQuickThemeButton'))return;
      const first=root.querySelector('.card');if(!first)return;
      const b=document.createElement('button');b.id='swqQuickThemeButton';b.className='btn secondary swq-quick-theme';b.textContent='🎨 Cambiar estilo';b.onclick=swqQuickTheme;b.style.marginTop='10px';b.style.borderColor='rgba(116,220,255,.42)';b.style.background='linear-gradient(145deg,rgba(23,55,73,.96),rgba(6,16,24,.98))';
      first.appendChild(b);
    }catch(e){}
  }

    function swqInflateSecretShop(){
    try{
      if(typeof buySecret!=='function'||window.__swqSecretPriceWrap20260917_2)return;
      const baseBuySecret=window.buySecret;
      window.buySecret=function(id,price,name){
        if(id==='hitman'){
          if(Number(S.coins||0)<220){toast('🪙 Te faltan 220 monedas.');return;}
          const wasOwned=!!S.purchases.sicario;baseBuySecret(id,price,name);
          if(!wasOwned&&S.purchases.sicario){S.coins=Math.max(0,Number(S.coins||0)-20);try{save();render();}catch(e){}if(authUser&&typeof syncProfileToCloud==='function')syncProfileToCloud();}
          return;
        }
        return baseBuySecret(id,Math.ceil(Number(price||0)*1.10),name);
      };
      window.__swqSecretPriceWrap20260917_2=true;
    }catch(e){console.warn('SWQ secret shop',e)}
  }
  function swqImproveAccountConnection(){
    if(window.__swqAccountRepair20260917_2)return;
    window.__swqAccountRepair20260917_2=true;
    async function verify(tries=3){
      for(let i=0;i<tries;i++){
        try{
          if(!supabaseClient&&typeof initSupabase==='function')await initSupabase();
          if(!supabaseClient)throw new Error('Supabase no disponible');
          const sess=await supabaseClient.auth.getSession();
          if(sess?.data?.session?.user){
            authUser=sess.data.session.user;
            if(typeof syncCurrentAccount==='function')await syncCurrentAccount();
            await new Promise(r=>setTimeout(r,180));
            if(typeof syncCurrentAccount==='function'&&!remoteSyncBusy)await syncCurrentAccount();
            S.level=levelFromXP(S.xp);try{save();}catch(e){} if(authUser&&S.profile&&typeof syncProfileToCloud==='function')await syncProfileToCloud();
            return true;
          }
        }catch(e){if(i===tries-1)console.warn('SWQ account verify',e)}
        await new Promise(r=>setTimeout(r,350*(i+1)));
      }
      return false;
    }
    const baseSignIn=window.signInReal;
    if(typeof baseSignIn==='function')window.signInReal=async function(){const out=await baseSignIn.apply(this,arguments);setTimeout(()=>verify(3),250);return out;};
    const baseSignUp=window.signUpReal;
    if(typeof baseSignUp==='function')window.signUpReal=async function(){const out=await baseSignUp.apply(this,arguments);setTimeout(()=>verify(3),500);return out;};
    window.addEventListener('online',()=>setTimeout(()=>verify(2),200));
    setTimeout(()=>verify(2),1800);
  }
  function swqCarreteraUpdate(){
    try{
      if(S.settings.theme!=='Carretera')return;
      clearRoadLayer();createRoadLayer();
      roadTimer=setInterval(()=>{if(!document.hidden){spawnRoadCar();if(Math.random()<.15)spawnRoadCar();}},1250);
      planeTimer=setInterval(()=>{if(!document.hidden&&Math.random()<.14)spawnRoadPlane()},18000);
    }catch(e){console.warn('SWQ Carretera update',e)}
  }
  function swqInitUpdate2(){
    swqEnsureNewShopItems();swqRemoveBebidaIsotonica();swqEnsureConsumables();swqInflateShopPrices();swqPatchXPGems();swqPatchCloroShopText();swqPatchCloroAndTrainingXP();swqPatchProgression();swqPatchFishMotivation();swqPatchPearExtra();swqPatchThemeText();swqInflateSecretShop();
    if(typeof applyTheme==='function')try{applyTheme();}catch(e){}
    if(S.settings.theme==='Carretera')swqCarreteraUpdate();
    if(typeof document!=='undefined'&&!window.__swqImpactClickHook20260917_2){
      document.addEventListener('click',e=>{
        if(S.settings.theme!=='Impacto')return;
        const btn=e.target?.closest?.('button');if(!btn||btn.disabled)return;
        const r=btn.getBoundingClientRect();swqSpawnImpactBurst(r.left+r.width/2,r.top+r.height/2);
      },true);
      window.__swqImpactClickHook20260917_2=true;
    }
    try{save();}catch(e){}try{render();}catch(e){}
  }
  swqInitUpdate2();setTimeout(swqInitUpdate2,1200);


  /* === UPDATE 2026-09-18 v7: restored full game fixes, chess, ticket 30%, Impacto performance === */
  function swqPatchTicket30(){
    try{
      const it=SHOP?.find?.(x=>x.id==='fichaNadador');
      if(it){
        it.name='Ficha del Nadador';
        it.icon='🎟️';
        it.desc='Consumible. +45% de monedas en tu siguiente entrenamiento.';
      }
    }catch(e){console.warn('SWQ ticket 30',e)}
  }

  function swqEnsureChessTheme(){
    try{
      if(typeof THEMES!=='undefined'&&!THEMES.Ajedrez){
        THEMES.Ajedrez={
          a:'#e8f0ff',b:'#1a1730',emoji:'♟️',
          desc:'Tablero nocturno eléctrico: cuadrícula animada, piezas cayendo, destellos y piezas que salen disparadas al pulsar botones.'
        };
      }
      if(typeof SHOP!=='undefined'&&!SHOP.some(x=>x.id==='theme_Ajedrez')){
        SHOP.push({
          id:'theme_Ajedrez',
          icon:'♟️',
          name:'Ajedrez',
          price:720,
          desc:'Tablero nocturno con piezas cayendo, líneas luminosas y ráfagas de piezas al pulsar botones.',
          buy:()=>{S.purchases.theme_Ajedrez=true;}
        });
      }
    }catch(e){console.warn('SWQ chess theme',e)}
  }

  function swqInjectVisualsV5(){
    if(document.getElementById('swq-v5-visuals'))return;
    const s=document.createElement('style');
    s.id='swq-v5-visuals';
    s.textContent=[
      /* --- Ajedrez: 4 efectos principales --- */
      "body.theme-ajedrez{background-color:#070713!important;background-image:linear-gradient(45deg,rgba(255,255,255,.055) 25%,transparent 25%,transparent 75%,rgba(255,255,255,.055) 75%),linear-gradient(45deg,rgba(255,255,255,.055) 25%,transparent 25%,transparent 75%,rgba(255,255,255,.055) 75%),radial-gradient(circle at 50% 10%,rgba(78,220,255,.16),transparent 26%),radial-gradient(circle at 80% 78%,rgba(255,81,195,.13),transparent 30%),linear-gradient(160deg,#111126,#06060f 55%,#020205)!important;background-size:74px 74px,74px 74px,100% 100%,100% 100%,100% 100%;background-position:0 0,37px 37px,0 0,0 0,0 0!important;color:#f8f8ff!important;overflow-x:hidden!important}",
      "body.theme-ajedrez::before{content:'';position:fixed;inset:-14%;z-index:-2;pointer-events:none;background:repeating-linear-gradient(90deg,rgba(105,221,255,.07) 0 2px,transparent 2px 74px),repeating-linear-gradient(0deg,rgba(255,105,210,.06) 0 2px,transparent 2px 74px);transform:rotate(-8deg) scale(1.16);animation:swqChessGrid 13s linear infinite}",
      "body.theme-ajedrez::after{content:'';position:fixed;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(115deg,transparent 0 42%,rgba(98,235,255,.16) 49%,transparent 57%),linear-gradient(290deg,transparent 0 46%,rgba(255,105,213,.12) 51%,transparent 56%);background-size:260% 260%,220% 220%;animation:swqChessScan 8s linear infinite;mix-blend-mode:screen}",
      "body.theme-ajedrez .app{position:relative;z-index:3}",
      "body.theme-ajedrez .topbar{background:linear-gradient(180deg,rgba(7,7,20,.94),rgba(10,10,28,.74),transparent)!important;border-bottom-color:rgba(118,230,255,.22)!important}",
      "body.theme-ajedrez .wallet,body.theme-ajedrez .card,body.theme-ajedrez .hero,body.theme-ajedrez .stat,body.theme-ajedrez .list-item,body.theme-ajedrez .series,body.theme-ajedrez .shop-item{background:linear-gradient(145deg,rgba(17,19,43,.91),rgba(8,8,21,.90))!important;border-color:rgba(130,228,255,.25)!important;box-shadow:inset 0 0 26px rgba(77,218,255,.045),0 16px 42px rgba(0,0,0,.42),0 0 22px rgba(255,81,191,.035)!important;backdrop-filter:blur(8px)}",
      "body.theme-ajedrez .btn{background:linear-gradient(145deg,rgba(30,34,70,.96),rgba(12,13,31,.98))!important;color:#f7fbff!important;border-color:rgba(118,224,255,.42)!important;box-shadow:inset 0 0 14px rgba(100,219,255,.08),0 7px 23px rgba(0,0,0,.34),0 0 16px rgba(255,87,195,.05)!important;position:relative;overflow:hidden}",
      "body.theme-ajedrez .btn.primary{background:linear-gradient(135deg,#52e9ff,#7e67ff 52%,#ff66c9)!important;color:#080a18!important;border-color:#d2fdff!important;box-shadow:0 0 26px rgba(77,223,255,.20),0 0 34px rgba(255,91,198,.12)!important}",
      "body.theme-ajedrez .nav{background:rgba(5,5,14,.95)!important;border-top-color:rgba(121,225,255,.22)!important;backdrop-filter:blur(10px)}",
      ".swq-chess-layer{position:fixed;inset:0;z-index:1;pointer-events:none;overflow:hidden}",
      ".swq-chess-board-glow{position:absolute;inset:8%;border:1px solid rgba(117,228,255,.16);box-shadow:0 0 90px rgba(86,222,255,.07),inset 0 0 80px rgba(255,89,197,.05);transform:rotate(-3deg);animation:swqChessBoardPulse 5.5s ease-in-out infinite}",
      ".swq-chess-fall{position:absolute;top:-12vh;font-size:clamp(18px,4vw,38px);font-weight:900;color:rgba(239,247,255,.76);text-shadow:0 0 10px rgba(88,228,255,.55),0 0 22px rgba(255,98,199,.25);animation:swqChessFall var(--d,8s) linear infinite;animation-delay:var(--delay,0s);filter:drop-shadow(0 3px 4px rgba(0,0,0,.45))}",
      ".swq-chess-scan{position:absolute;inset:-20%;background:linear-gradient(180deg,transparent 0 44%,rgba(95,234,255,.12) 50%,transparent 56%);filter:blur(2px);animation:swqChessScanBand 6.5s ease-in-out infinite}",
      ".swq-chess-burst-layer{position:fixed;inset:0;z-index:120;pointer-events:none;overflow:hidden}",
      ".swq-chess-burst{position:absolute;font-size:20px;font-weight:900;transform:translate(-50%,-50%) scale(.4);opacity:1;text-shadow:0 0 10px rgba(105,231,255,.95),0 0 22px rgba(255,100,204,.66);animation:swqChessBurst var(--d,.78s) cubic-bezier(.16,.75,.18,1) forwards}",
      ".swq-chess-burst-core{position:absolute;width:22px;height:22px;border-radius:50%;border:2px solid rgba(228,255,255,.80);box-shadow:0 0 20px rgba(90,225,255,.6),0 0 38px rgba(255,88,198,.22);transform:translate(-50%,-50%) scale(.2);animation:swqChessCore .45s ease-out forwards}",
      "@keyframes swqChessGrid{from{transform:rotate(-8deg) translate3d(-2%,0,0) scale(1.16)}to{transform:rotate(-8deg) translate3d(2%,-3%,0) scale(1.18)}}",
      "@keyframes swqChessScan{0%{background-position:-110% 0,110% 100%}100%{background-position:110% 100%,-110% 0}}",
      "@keyframes swqChessBoardPulse{0%,100%{transform:rotate(-3deg) scale(.985);opacity:.46}50%{transform:rotate(-1deg) scale(1.02);opacity:.88}}",
      "@keyframes swqChessFall{0%{transform:translate3d(0,-8vh,0) rotate(-12deg) scale(.72);opacity:0}10%{opacity:.76}52%{transform:translate3d(var(--dx,12px),62vh,0) rotate(170deg) scale(1)}88%{opacity:.48}100%{transform:translate3d(calc(var(--dx,12px)*-1),118vh,0) rotate(330deg) scale(.82);opacity:0}}",
      "@keyframes swqChessScanBand{0%,100%{transform:translateY(-48vh) rotate(-2deg);opacity:.08}50%{transform:translateY(48vh) rotate(2deg);opacity:.62}}",
      "@keyframes swqChessBurst{0%{transform:translate(-50%,-50%) translate3d(0,0,0) rotate(0deg) scale(.35);opacity:1}16%{opacity:1}100%{transform:translate(-50%,-50%) translate3d(var(--dx,0),var(--dy,0),0) rotate(var(--rot,220deg)) scale(.85);opacity:0}}",
      "@keyframes swqChessCore{0%{transform:translate(-50%,-50%) scale(.2);opacity:.9}100%{transform:translate(-50%,-50%) scale(3.2);opacity:0}}",

      /* --- Impacto: efecto extra de onda expansiva --- */
      ".swq-impact-wave{position:fixed;width:86px;height:86px;border:3px solid rgba(255,225,125,.88);border-radius:50%;pointer-events:none;z-index:121;transform:translate(-50%,-50%) scale(.16);box-shadow:0 0 18px rgba(255,120,25,.72),inset 0 0 20px rgba(255,210,95,.22);animation:swqImpactWave .62s cubic-bezier(.12,.72,.18,1) forwards}",
      ".swq-impact-wave.inner{width:38px;height:38px;border-width:2px;border-color:rgba(255,116,35,.94);animation-duration:.42s}",
      ".swq-impact-ray{position:fixed;width:3px;height:54px;border-radius:999px;background:linear-gradient(180deg,#fff7cf,#ff8c1f,transparent);pointer-events:none;z-index:122;transform-origin:50% 100%;animation:swqImpactRay .50s ease-out forwards;filter:drop-shadow(0 0 8px rgba(255,120,25,.78))}",
      "@keyframes swqImpactWave{0%{transform:translate(-50%,-50%) scale(.16);opacity:1}58%{opacity:.74}100%{transform:translate(-50%,-50%) scale(3.15);opacity:0}}",
      "@keyframes swqImpactRay{from{transform:translate(-50%,-100%) rotate(var(--ang,0deg)) scaleY(.35);opacity:1}to{transform:translate(-50%,-100%) rotate(var(--ang,0deg)) translateY(-42px) scaleY(1.35);opacity:0}}"
    ].join('');
    document.head.appendChild(s);
  }

    function swqSyncChess(){
    let layer=document.getElementById('swqChessLayer');
    let burst=document.getElementById('swqChessBurstLayer');
    if(S.settings.theme==='Ajedrez'){
      if(!layer){
        layer=document.createElement('div');
        layer.id='swqChessLayer';
        layer.className='swq-chess-layer';
        const board=document.createElement('div');
        board.className='swq-chess-board-glow';
        layer.appendChild(board);
        const scan=document.createElement('div');
        scan.className='swq-chess-scan';
        layer.appendChild(scan);
        const pieces=['♟','♞','♜','♝','♛','♚'];
        for(let i=0;i<10;i++){
          const p=document.createElement('span');
          p.className='swq-chess-fall';
          p.textContent=pieces[i%pieces.length];
          p.style.left=(2+Math.random()*96)+'%';
          p.style.setProperty('--dx',(-80+Math.random()*160)+'px');
          p.style.setProperty('--d',(7+Math.random()*7)+'s');
          p.style.setProperty('--delay',(-Math.random()*12)+'s');
          layer.appendChild(p);
        }
        document.body.appendChild(layer);
      }
      if(!burst){
        burst=document.createElement('div');
        burst.id='swqChessBurstLayer';
        burst.className='swq-chess-burst-layer';
        document.body.appendChild(burst);
      }
    }else{
      if(layer)layer.remove();
      if(burst)burst.remove();
    }
  }

  function swqSpawnChessBurst(x,y){
    if(S.settings.theme!=='Ajedrez')return;
    swqSyncChess();
    const host=document.getElementById('swqChessBurstLayer');
    if(!host)return;
    const pieces=['♟','♞','♜','♝','♛','♚'];
    const core=document.createElement('span');
    core.className='swq-chess-burst-core';
    core.style.left=x+'px';
    core.style.top=y+'px';
    host.appendChild(core);
    setTimeout(()=>core.remove(),520);
    for(let i=0;i<6;i++){
      const p=document.createElement('span');
      p.className='swq-chess-burst';
      p.textContent=pieces[Math.floor(Math.random()*pieces.length)];
      const a=Math.random()*Math.PI*2;
      const d=42+Math.random()*108;
      p.style.left=x+'px';
      p.style.top=y+'px';
      p.style.setProperty('--dx',Math.cos(a)*d+'px');
      p.style.setProperty('--dy',Math.sin(a)*d+'px');
      p.style.setProperty('--rot',(-220+Math.random()*440)+'deg');
      p.style.setProperty('--d',(0.62+Math.random()*0.45)+'s');
      host.appendChild(p);
      setTimeout(()=>p.remove(),1200);
    }
  }

  function swqSpawnImpactBurst(x,y){
    const flash=document.createElement('div');
    flash.className='swq-impact-flash';
    flash.style.left=x+'px';
    flash.style.top=y+'px';
    document.body.appendChild(flash);
    setTimeout(()=>flash.remove(),440);

    const wave=document.createElement('div');
    wave.className='swq-impact-wave';
    wave.style.left=x+'px';
    wave.style.top=y+'px';
    document.body.appendChild(wave);
    setTimeout(()=>wave.remove(),700);

    const inner=document.createElement('div');
    inner.className='swq-impact-wave inner';
    inner.style.left=x+'px';
    inner.style.top=y+'px';
    document.body.appendChild(inner);
    setTimeout(()=>inner.remove(),520);

    for(let i=0;i<4;i++){
      const ray=document.createElement('span');
      ray.className='swq-impact-ray';
      ray.style.left=x+'px';
      ray.style.top=y+'px';
      ray.style.setProperty('--ang',(i*36+Math.random()*12)+'deg');
      document.body.appendChild(ray);
      setTimeout(()=>ray.remove(),620);
    }

    for(let i=0;i<8;i++){
      const sp=document.createElement('span');
      sp.className='swq-impact-spark';
      const a=(Math.PI*2*i/20)+Math.random()*.18;
      const d=30+Math.random()*78;
      sp.style.left=x+'px';
      sp.style.top=y+'px';
      sp.style.setProperty('--sx',Math.cos(a)*d+'px');
      sp.style.setProperty('--sy',Math.sin(a)*d+'px');
      document.body.appendChild(sp);
      setTimeout(()=>sp.remove(),850);
    }
  }

  function swqApplyQuickTheme(k){
    try{
      if(typeof THEMES==='undefined'||!THEMES[k])return;
      if(k!=='Aqua'&&!S.purchases?.['theme_'+k]){
        toast('🔒 Ese estilo todavía no está desbloqueado.');
        return;
      }
      S.settings.theme=k;
      save();
      if(typeof applyTheme==='function')applyTheme();
      try{eclipseCartoonStars();}catch(e){}
      swqSyncLeviathan();
      swqSyncImpactTheme();
      swqSyncChess();
      closeModal();
      render();
      setTimeout(()=>{try{
        swqSyncLeviathan();
        swqSyncImpactTheme();
        swqSyncChess();
        swqInjectQuickThemeButton();
      }catch(e){}},60);
    }catch(e){console.warn('SWQ quick theme v5',e)}
  }

  function swqInitUpdate3(){
    try{
      swqInstallEntityBudget();
      swqPatchTicket30();
      swqEnsureChessTheme();
      swqInjectVisualsV5();
      swqSyncLeviathan();
      swqSyncImpactTheme();
      swqSyncChess();
      swqPatchTicket30();
      window.swqApplyQuickTheme=swqApplyQuickTheme;
      window.swqQuickTheme=swqQuickTheme;
      if(!window.__swqChessClickHook20260918_2){
        document.addEventListener('click',e=>{
          if(S.settings.theme!=='Ajedrez')return;
          const btn=e.target?.closest?.('button');
          if(!btn||btn.disabled)return;
          const r=btn.getBoundingClientRect();
          swqSpawnChessBurst(r.left+r.width/2,r.top+r.height/2);
        },true);
        window.__swqChessClickHook20260918_2=true;
      }
      if(!window.__swqImpactExtraClickHook20260918_2){
        /* An extra Impacto burst is only for the theme's visual click effect. */
        window.__swqImpactExtraClickHook20260918_2=true;
      }
      swqInjectQuickThemeButton();
      try{render();}catch(e){}
    }catch(e){console.warn('SWQ update3',e)}
  }

  swqInitUpdate3();
  setTimeout(swqInitUpdate3,900);
  setInterval(()=>{try{
    swqPatchTicket30();
    swqEnsureChessTheme();
    swqSyncLeviathan();
    swqSyncImpactTheme();
    swqSyncChess();
    swqInjectQuickThemeButton();
    window.swqApplyQuickTheme=swqApplyQuickTheme;
    window.swqQuickTheme=swqQuickTheme;
  }catch(e){}},5000);

})();