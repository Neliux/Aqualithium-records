/* Aqualithium · actualización 2026-09-19 v9
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
  if(window.__SWQ_FINAL_FIXES_20260919_1__)return;
  if(typeof window.render!=='function'){
    console.warn('Aqualithium final-fixes: interfaz base aún no está lista; se omite esta carga.');
    return;
  }
  window.__SWQ_FINAL_FIXES_20260919_1__=true;

  const VERSION='20260919-11';
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
    /* Entrenamientos guardados quedan congelados. Solo un alta nueva o una edición calcula su dificultad. */
    return false;
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
    const before=[...S.achievements],seen=new Set(),keep=[];
    for(const id of before){
      if(seen.has(id))continue;
      seen.add(id);
      /* Achievement unlocks are permanent; rule updates never erase prior progress. */
      keep.push(id);
    }
    if(keep.length!==before.length){
      S.achievements=keep;
      try{save();}catch(e){}
      return true;
    }
    return false;
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
.swq-road-plane{font-size:22px;animation:swqPlaneFly var(--dur,8s) linear forwards;opacity:.75;text-shadow:0 0 7px rgba(156,207,255,.55);will-change:transform}.swq-road-plane.reverse{animation-name:swqPlaneFlyReverse}
@keyframes swqCarDrive{from{transform:translateX(-18vw)}to{transform:translateX(118vw) translateY(-3vh)}}
@keyframes swqCarDriveReverse{from{transform:translateX(118vw) scaleX(-1)}to{transform:translateX(-18vw) scaleX(-1)}}
@keyframes swqPlaneFly{from{transform:translateX(-15vw) translateY(0) scale(.85) scaleX(1)}to{transform:translateX(118vw) translateY(-7vh) scale(1.05) scaleX(1)}}@keyframes swqPlaneFlyReverse{from{transform:translateX(118vw) translateY(0) scale(.9) scaleX(-1)}to{transform:translateX(-15vw) translateY(-7vh) scale(1.05) scaleX(-1)}}
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
    const reverse=Math.random()<.28;
    const el=document.createElement('span');el.className='swq-road-plane'+(reverse?' reverse':'');
    el.textContent=Math.random()<.60?'🚁':(Math.random()<.5?'✈️':'🛫');
    el.style.top=(10+Math.random()*25)+'%';el.style.setProperty('--dur',(7.0+Math.random()*5.5)+'s');
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
      if(typeof SHOP!=='undefined'&&!SHOP.some(x=>x.id==='fichaNadador'))SHOP.push({id:'fichaNadador',icon:'🎟️',name:'Ficha del Nadador',price:260,desc:'Consumible. +45% de monedas en tu siguiente entrenamiento.',buy:()=>{swqEnsureConsumables();S.consumables.fichaNadador=(S.consumables.fichaNadador||0)+1;}});
    }catch(e){console.warn('SWQ new shop items',e)}
  }
  function swqPatchCloroAndTrainingXP(){
    try{
      swqEnsureConsumables();

      if(!window.__swqTrainingRewardsPatched20260918_7){
        const baseTrainingXP=trainingXP;
        const baseDraftXP=(typeof draftXP==='function')?draftXP:null;

        /* Global training XP reward: +25% versus the previous live reward formula. */
        trainingXP=function(e,state=null){
          const raw=Math.max(0,Number(baseTrainingXP(e,state))||0);
          return Math.round(raw*1.25);
        };

        /* Global training coins: +15% versus the previous live coin formula.
           Uses the pre-boost XP formula so the +25% XP bonus does not accidentally compound into coins. */
        trainingCoins=function(e){
          const rawXp=Math.max(0,Number(baseTrainingXP(e,null))||0);
          return Math.max(25,Math.round(rawXp*.132*trainingCoinMultiplier()*1.15));
        };

        /* Preview must match the real next-training reward. */
        if(baseDraftXP){
          draftXP=function(){
            const hasCloro=Number(S.consumables?.cloroPremium||0)>0;
            let raw=Math.max(0,Number(baseDraftXP())||0);
            if(hasCloro)raw/=1.20; /* remove legacy +20% preview multiplier */
            return Math.round(raw*1.25*(hasCloro?1.70:1));
          };

          draftCoins=function(){
            const hasCloro=Number(S.consumables?.cloroPremium||0)>0;
            const hasTicket=Number(S.consumables?.fichaNadador||0)>0;
            let raw=Math.max(0,Number(baseDraftXP())||0);
            if(hasCloro)raw/=1.20;
            const coins=Math.max(25,Math.round(raw*.132*trainingCoinMultiplier()*1.15));
            return hasTicket?Math.max(25,Math.round(coins*1.45)):coins;
          };
        }

        window.__swqTrainingRewardsPatched20260918_7=true;
      }

      if(!window.__swqSaveTrainingBoosts20260918_7){
        const previousSaveTraining=window.saveTraining;
        if(typeof previousSaveTraining==='function'){
          window.saveTraining=function(){
            swqEnsureConsumables();
            const hadCloro=Number(S.consumables.cloroPremium||0)>0;
            const hadCoin=Number(S.consumables.fichaNadador||0)>0;
            const beforeCount=Array.isArray(S.trainings)?S.trainings.length:0;
            const oldCloro=Number(S.consumables.cloroPremium||0);
            const oldCoin=Number(S.consumables.fichaNadador||0);

            /* Suppress the legacy one-session boosts while the clean calculation runs. */
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

                /* Add the +70% Cloro multiplier on top of the new global +25% XP reward. */
                const baseXp=Math.max(0,Number(e.xp)||0);
                const desiredXp=Math.round(baseXp*(hadCloro?1.70:1));
                const extraXp=Math.max(0,desiredXp-baseXp);
                e.xp=desiredXp;
                if(extraXp>0&&typeof gainXP==='function')gainXP(extraXp);

                /* Add the +45% ticket multiplier on top of the new global +15% coin reward. */
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
          window.__swqSaveTrainingBoosts20260918_7=true;
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
      if(window.__swqEntityBudget20260918_7)return;
      const caps={Leviatan:8,Ajedrez:8,Impacto:5,Bomba:5,CobaltoCobre:7,Carretera:5,CianNeon:6,Eclipse:6,Bee:6,Glacial:7};
      const originalSpawn=spawnThemeParticle;
      spawnThemeParticle=function(){
        const host=document.getElementById('themeParticles');
        const theme=S?.settings?.theme;
        const cap=caps[theme]||10;
        if(host&&host.childElementCount>=cap)return;
        return originalSpawn.apply(this,arguments);
      };
      window.__swqEntityBudget20260918_7=true;
    }catch(e){console.warn('SWQ entity budget',e)}
  }

  function swqDiagnostics(){
    try{
      const issues=[];
      if(typeof trainingXP!=='function')issues.push('trainingXP');
      if(typeof trainingCoins!=='function')issues.push('trainingCoins');
      if(typeof saveTraining!=='function')issues.push('saveTraining');
      if(!Array.isArray(SHOP))issues.push('SHOP');
      if(!Array.isArray(ACHIEVEMENTS))issues.push('ACHIEVEMENTS');
      if(typeof THEMES?.Ajedrez==='undefined')issues.push('Ajedrez');
      const bee=ACHIEVEMENTS.find(a=>a.id==='whoLeftThis');
      if(!bee||bee.reward?.theme!=='Bee'||typeof bee.ok!=='function')issues.push('Bee achievement');
      if(issues.length)console.warn('SWQ diagnostics',issues);
      return issues;
    }catch(e){console.warn('SWQ diagnostics failed',e);return ['diagnostics'];}
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

  /* === UPDATE 2026-09-19 v9: progression, inventory, five new styles, Pera rank dialogues === */
  try{
    if(window.__swqUpdate20260919_1__)throw new Error('__SWQ_ALREADY_APPLIED__');
    window.__swqUpdate20260919_1__=true;

    const SWQ_NEW_STYLES={
      Prisma:{rank:'venus',rankIndex:9,price:950,icon:'🌈',name:'Prisma',desc:'Fondo oscuro con una franja de luz prismática muy discreta que se desplaza lentamente.'},
      Saturno:{rank:'saturno',rankIndex:12,price:1100,icon:'🪐',name:'Saturno',desc:'Fondo oscuro, planeta central y anillos orbitantes con partículas mínimas.'},
      Tinta:{rank:'neptuno',rankIndex:14,price:1300,icon:'🖋️',name:'Tinta',desc:'Azul petróleo y negro con una nube de tinta que se mueve suavemente.'},
      MareaLunar:{rank:'leviatan',rankIndex:19,price:1600,icon:'🌙',name:'Marea Lunar',desc:'Océano oscuro, luna tenue y una onda horizontal lenta.'},
      Pizarra:{rank:'poseidon',rankIndex:20,price:1900,icon:'◼️',name:'Pizarra',desc:'Grafito oscuro con cuadrícula tenue y bordes limpios, casi estático.'}
    };
    const SWQ_CONSUMABLES={
      cloroPremium:{name:'Cloro Premium',icon:'🧴',desc:'+70% de XP en el próximo entrenamiento.',kind:'next'},
      fichaNadador:{name:'Ficha del Nadador',icon:'🎟️',desc:'+45% de monedas en el próximo entrenamiento.',kind:'next'},
      xp500:{name:'Cristal XP 500',icon:'💠',desc:'+500 XP al usarlo.',kind:'instant'},
      xp1500:{name:'Cristal XP 1500',icon:'🔷',desc:'+1.500 XP al usarlo.',kind:'instant'},
      xpJuan:{name:'Cristal de Ascensión',icon:'🔮',desc:'+13.000 XP al usarlo.',kind:'instant'},
      rouletteNormal:{name:'Ruleta Normal',icon:'🎰',desc:'Se guarda y se abre manualmente.',kind:'roulette'},
      rouletteVip:{name:'Ruleta VIP',icon:'👑',desc:'Se guarda y se abre manualmente.',kind:'roulette'},
      fichaRepeticion:{name:'Ficha de Repetición',icon:'🔁',desc:'Permite reclamar una segunda recompensa diaria.',kind:'daily'}
    };

    const SWQ_RANK_REWARDS=[
      {c:'bronce',coins:100},
      {c:'plata',coins:200},
      {c:'oro',coins:350},
      {c:'platino',coins:500,xp:250},
      {c:'diamante',coins:700,xp:400},
      {c:'esmeralda',coins:900,xp:600,give:'cloroPremium'},
      {c:'zafiro',coins:1100,xp:800,give:'fichaNadador'},
      {c:'amatista',coins:1350,xp:1000,give:'cloroPremium'},
      {c:'mercurio',coins:1600,xp:1250},
      {c:'venus',coins:1900,xp:1500,unlockStyle:'Prisma'},
      {c:'marte',coins:2250,xp:1750,randomConsumable:true},
      {c:'jupiter',coins:2600,xp:2000},
      {c:'saturno',coins:3000,xp:2300,unlockStyle:'Saturno'},
      {c:'urano',coins:3500,xp:2700,give:'fichaNadador'},
      {c:'neptuno',coins:4000,xp:3100,unlockStyle:'Tinta'},
      {c:'orca',coins:4500,xp:3500,give:'cloroPremium'},
      {c:'tiburon',coins:5000,xp:4000},
      {c:'kraken',coins:6000,xp:5000,randomConsumable:true},
      {c:'megalodon',coins:7500,xp:6000,giveMany:['cloroPremium','fichaNadador']},
      {c:'leviatan',coins:9000,xp:7500,unlockStyle:'MareaLunar'},
      {c:'poseidon',coins:12000,xp:10000,unlockStyle:'Pizarra',unlockConsumable:'fichaRepeticion',pear:'poseidon'},
      {c:'coach',coins:20000,xp:15000,giveMany:['cloroPremium','fichaNadador'],pear:'coach'}
    ];

    function swqEnsureV9State(){
      S.consumables=S.consumables||{};
      S.inventory=S.inventory||{};
      S.activeConsumables=S.activeConsumables||{};
      S.shopUnlocks=S.shopUnlocks||{};
      S.rankRewardsClaimed=Array.isArray(S.rankRewardsClaimed)?S.rankRewardsClaimed:[];
      if(!Number.isFinite(Number(S.rankRewardCoins)))S.rankRewardCoins=0;
      if(!Number.isFinite(Number(S.rankRewardXP)))S.rankRewardXP=0;
      if(!Number.isFinite(Number(S.itemBonusCoins)))S.itemBonusCoins=0;
      if(!Number.isFinite(Number(S.itemBonusXP)))S.itemBonusXP=0;
      S.dailyReward=S.dailyReward||{date:'',claimed:false,coins:0,xp:0,kind:'coinsxp',themeKey:''};
      if(!S.__swqLegacyConsumablesMigrated){
        ['cloroPremium','fichaNadador'].forEach(k=>{
          const old=Number(S.consumables[k]||0);
          if(old>0){S.inventory[k]=Math.max(0,Number(S.inventory[k]||0)+old);S.consumables[k]=0;}
          else if(!Number.isFinite(Number(S.consumables[k])))S.consumables[k]=0;
        });
        S.__swqLegacyConsumablesMigrated=true;
      }
      if(!Number.isFinite(Number(S.dailyReward.repeatUsed)))S.dailyReward.repeatUsed=0;

      Object.keys(SWQ_CONSUMABLES).forEach(k=>{
        if(!Number.isFinite(Number(S.inventory[k])))S.inventory[k]=0;
      });
      ['cloroPremium','fichaNadador'].forEach(k=>{
        if(!Number.isFinite(Number(S.activeConsumables[k])))S.activeConsumables[k]=0;
      });



      for(const key of Object.keys(SWQ_NEW_STYLES)){
        const t=SWQ_NEW_STYLES[key];
        if(typeof THEMES[key]==='undefined'){
          THEMES[key]={a:'#7fc7ff',b:'#1f2a5f',emoji:t.icon,desc:t.desc};
        }
        const id='theme_'+key;
        let it=SHOP?.find?.(x=>x.id===id);
        if(!it){
          SHOP.push({id,icon:t.icon,name:t.name,price:t.price,desc:t.desc,buy:()=>{S.purchases[id]=true;}});
        }else{
          it.icon=t.icon;it.name=t.name;it.price=t.price;it.desc=t.desc;
        }
      }

      const repId='fichaRepeticion';
      let rep=SHOP?.find?.(x=>x.id===repId);
      if(!rep){
        SHOP.push({id:repId,icon:'🔁',name:'Ficha de Repetición',price:750,desc:'Consumible. Úsala después de cobrar la recompensa diaria para poder reclamar una segunda vez ese mismo día.',buy:()=>{S.inventory.fichaRepeticion++;}});
      }else{
        rep.icon='🔁';rep.name='Ficha de Repetición';rep.price=750;rep.desc='Consumible. Úsala después de cobrar la recompensa diaria para poder reclamar una segunda vez ese mismo día.';
      }

      if(typeof SHOP!=='undefined'){
        const patchItem=(id,fn)=>{const x=SHOP.find(i=>i.id===id);if(x)fn(x);};
        patchItem('cloroPremium',x=>{x.desc='Consumible. +70% de XP en el próximo entrenamiento. Se guarda en el inventario.';x.buy=()=>{S.inventory.cloroPremium++;};});
        patchItem('fichaNadador',x=>{x.desc='Consumible. +45% de monedas en el próximo entrenamiento. Se guarda en el inventario.';x.buy=()=>{S.inventory.fichaNadador++;};});
        patchItem('xp500',x=>{x.desc='Consumible. Se guarda en el inventario y otorga 500 XP al usarlo.';x.buy=()=>{S.inventory.xp500++;};});
        patchItem('xp1500',x=>{x.desc='Consumible. Se guarda en el inventario y otorga 1.500 XP al usarlo.';x.buy=()=>{S.inventory.xp1500++;};});
        patchItem('xpJuan',x=>{x.name='Cristal de Ascensión';x.desc='Consumible. Se guarda en el inventario y otorga 13.000 XP al usarlo.';x.buy=()=>{S.inventory.xpJuan++;};});
        patchItem('rouletteNormal',x=>{x.desc='Consumible. Se guarda en el inventario y se abre cuando tú decidas.';x.buy=()=>{S.inventory.rouletteNormal++;};});
        patchItem('rouletteVip',x=>{x.desc='Consumible. Se guarda en el inventario y se abre cuando tú decidas.';x.buy=()=>{S.inventory.rouletteVip++;};});
      }

      const rankIndex=currentRank().i;
      for(const key of Object.keys(SWQ_NEW_STYLES)){
        if(rankIndex>=SWQ_NEW_STYLES[key].rankIndex)S.shopUnlocks['theme_'+key]=true;
      }
      if(rankIndex>=RANKS.findIndex(r=>r.c==='poseidon'))S.shopUnlocks.fichaRepeticion=true;
    }

    function swqInventoryCount(k){return Math.max(0,Number(S.inventory?.[k]||0));}
    function swqGiveConsumable(k,n=1){
      swqEnsureV9State();
      S.inventory[k]=Math.max(0,Number(S.inventory[k]||0)+Math.max(0,Number(n)||0));
    }

    function swqRewardRandomConsumable(){
      const pool=['cloroPremium','fichaNadador','recuperador'];
      const k=pool[Math.floor(Math.random()*pool.length)];
      if(k==='recuperador')S.shield=Math.max(0,Number(S.shield||0)+1);
      else swqGiveConsumable(k,1);
      return k;
    }

    function swqUnlockStyle(key){
      swqEnsureV9State();
      if(SWQ_NEW_STYLES[key])S.shopUnlocks['theme_'+key]=true;
    }

    function swqGrantRankMilestones(showToast=false){
      swqEnsureV9State();
      let changed=false,events=[];
      let guard=0;
      while(guard++<30){
        const idx=currentRank().i;
        let next=null;
        for(const reward of SWQ_RANK_REWARDS){
          const ri=RANKS.findIndex(r=>r.c===reward.c);
          if(ri<=idx&&!S.rankRewardsClaimed.includes(reward.c)){next=reward;break;}
        }
        if(!next)break;
        S.rankRewardsClaimed.push(next.c);
        changed=true;
        if(next.coins){S.rankRewardCoins+=next.coins;S.coins+=next.coins;events.push('+'+fmt(next.coins)+' 🪙');}
        if(next.xp){S.rankRewardXP+=next.xp;S.xp+=next.xp;S.level=levelFromXP(S.xp);events.push('+'+fmt(next.xp)+' XP');}
        if(next.give){swqGiveConsumable(next.give,1);events.push(SWQ_CONSUMABLES[next.give].icon+' '+SWQ_CONSUMABLES[next.give].name);}
        if(next.giveMany)next.giveMany.forEach(k=>{swqGiveConsumable(k,1);events.push(SWQ_CONSUMABLES[k].icon+' '+SWQ_CONSUMABLES[k].name);});
        if(next.randomConsumable){const k=swqRewardRandomConsumable();events.push('🎁 '+(k==='recuperador'?'Recuperador de racha':SWQ_CONSUMABLES[k].name));}
        if(next.unlockStyle){swqUnlockStyle(next.unlockStyle);events.push('🎨 '+SWQ_NEW_STYLES[next.unlockStyle].name+' disponible en la tienda');}
        if(next.unlockConsumable){S.shopUnlocks[next.unlockConsumable]=true;events.push('🔁 Ficha de Repetición disponible en la tienda');}
        S.level=levelFromXP(S.xp);
      }
      swqEnsureV9State();
      if(changed)save();
      if(changed&&showToast)toast('🎁 Recompensas de rango actualizadas: '+events.join(' · '),5000);
      return {changed,events};
    }

    function swqRankRewardLabel(){
      const out=[];
      const rewards=arguments.length?arguments[0]:null;
      const list=rewards||[];
      for(const r of list)out.push('<div class="pill" style="margin-top:6px">'+esc(r)+'</div>');
      return out.join('');
    }

    if(!window.__swqRankRevealV9Wrapped){
      const baseRankRevealV9=rankReveal;
      rankReveal=function(r){
        try{
          swqEnsureV9State();
          const queued=Array.isArray(S.__swqLastRankRewardEvents)?S.__swqLastRankRewardEvents.slice():[];
          const rewardResult=swqGrantRankMilestones(false);
          const events=Array.isArray(rewardResult?.events)&&rewardResult.events.length
            ? rewardResult.events
            : queued;
          S.__swqLastRankRewardEvents=[];
          baseRankRevealV9.apply(this,arguments);
          setTimeout(()=>{
            try{
              const host=document.querySelector('#modal .rank-promo');
              if(!host||host.querySelector('.swq-rank-reward'))return;
              const reward=SWQ_RANK_REWARDS.find(x=>x.c===r?.c);
              const fallback=[];
              if(reward?.coins)fallback.push('+'+fmt(reward.coins)+' 🪙');
              if(reward?.xp)fallback.push('+'+fmt(reward.xp)+' XP');
              if(reward?.give){
                const it=SWQ_CONSUMABLES[reward.give];
                if(it)fallback.push(it.icon+' '+it.name);
              }
              if(reward?.giveMany)reward.giveMany.forEach(k=>{
                const it=SWQ_CONSUMABLES[k];
                if(it)fallback.push(it.icon+' '+it.name);
              });
              if(reward?.randomConsumable)fallback.push('🎁 Consumible aleatorio');
              if(reward?.unlockStyle){
                const it=SWQ_NEW_STYLES[reward.unlockStyle];
                if(it)fallback.push('🎨 '+it.name+' disponible en la tienda');
              }
              if(reward?.unlockConsumable)fallback.push('🔁 Ficha de Repetición disponible en la tienda');
              if(reward?.pear==='poseidon')fallback.push('🍐 Nuevo diálogo especial de Pera');
              if(reward?.pear==='coach')fallback.push('🍐 Diálogo final especial de Pera');
              const list=events.length?events:fallback;
              if(!list.length)return;
              const btn=host.querySelector('button.btn.primary');
              const box=document.createElement('div');
              box.className='swq-rank-reward';
              box.innerHTML='<div class="kicker">🎁 RECOMPENSA DEL RANGO</div>'+swqRankRewardLabel(list);
              if(btn)host.insertBefore(box,btn);else host.appendChild(box);
            }catch(e){console.warn('SWQ rank reward card',e)}
          },80);
        }catch(e){
          console.warn("SWQ rank reward reveal",e);
          return baseRankRevealV9.apply(this,arguments);
        }
      };
      window.__swqRankRevealV9Wrapped=true;
    }

    function swqInstallV9CSS(){
      if(document.getElementById('swq-v9-css'))return;
      const s=document.createElement('style');s.id='swq-v9-css';
      s.textContent=[
        '.swq-inventory-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}',
        '.swq-inventory-item{padding:10px;border:1px solid #294867;border-radius:14px;background:linear-gradient(145deg,#0d2237,#07121f)}',
        '.swq-inventory-item .count{font-size:17px;font-weight:1000;margin-top:2px}',
        '.swq-inventory-item .btn{margin-top:7px;min-height:39px;font-size:11px}',
        '.swq-inventory-active{border-color:rgba(97,239,170,.45);box-shadow:0 0 18px rgba(97,239,170,.07)}',
        '.swq-rank-reward{margin-top:11px;padding:11px;border-radius:15px;background:linear-gradient(145deg,rgba(66,221,255,.10),rgba(118,92,255,.08));border:1px solid rgba(97,212,255,.28)}',
        '.swq-locked-shop{opacity:.62;filter:saturate(.65)}',
        '.swq-use-note{font-size:10px;color:var(--muted);margin-top:5px;line-height:1.35}',
        '@media(max-width:560px){.swq-inventory-grid{grid-template-columns:1fr}}',

        'body.theme-leviatan #swqLeviatanLayer{position:fixed!important;inset:0!important;z-index:46!important;pointer-events:none!important;overflow:hidden!important}',
        '.swq-lev-front-fish{position:absolute;font-size:22px;filter:drop-shadow(0 0 9px rgba(130,246,255,.55));animation:swqLevFrontFish 7.8s linear forwards}',
        '@keyframes swqLevFrontFish{0%{opacity:0;transform:translateX(-18vw) scaleX(-1) translateY(0)}10%{opacity:.88}50%{opacity:.92;transform:translateX(48vw) scaleX(-1) translateY(var(--bob,0px))}100%{opacity:0;transform:translateX(118vw) scaleX(-1) translateY(calc(var(--bob,0px)*-.7))}}',

        'body.theme-ajedrez{background-color:#090914!important;background-image:linear-gradient(45deg,#14142c 25%,transparent 25%,transparent 75%,#14142c 75%),linear-gradient(45deg,#14142c 25%,transparent 25%,transparent 75%,#14142c 75%)!important;background-size:56px 56px!important;background-position:0 0,28px 28px!important}',
        'body.theme-ajedrez .swq-chess-layer{z-index:45!important}',
        '.swq-chess-layer .swq-chess-board-glow,.swq-chess-layer .swq-chess-scan{display:none!important}',
        '.swq-chess-fall{font-size:clamp(18px,3.6vw,32px)!important;text-shadow:0 0 9px rgba(120,226,255,.46),0 0 17px rgba(255,95,194,.20)!important}',
        '.swq-chess-burst-layer{z-index:120!important}',

        'body.theme-bee #themeParticles{z-index:45!important}',
        '.swq-bee-honey{position:absolute;top:-28px;font-size:18px;animation:swqBeeHoney 5.8s linear forwards;filter:drop-shadow(0 0 8px rgba(255,212,59,.42))}',
        '.swq-bee-fly{position:absolute;top:var(--top,25%);font-size:20px;animation:swqBeeFly var(--dur,6.8s) linear forwards;filter:drop-shadow(0 3px 7px rgba(255,211,50,.40))}',
        '@keyframes swqBeeHoney{0%{opacity:0;transform:translateY(-20px) rotate(-6deg)}10%{opacity:.85}100%{opacity:0;transform:translateY(112vh) rotate(18deg)}}',
        '@keyframes swqBeeFly{0%{opacity:0;transform:translateX(-14vw) translateY(0) rotate(-4deg)}12%{opacity:.9}50%{transform:translateX(50vw) translateY(12px) rotate(5deg)}100%{opacity:0;transform:translateX(118vw) translateY(-10px) rotate(-2deg)}}',

        'body.theme-carbon{background:radial-gradient(circle at 50% -10%,#3c3212 0,#171719 38%,#050607 100%)!important;color:#fffbe8!important}',
        'body.theme-carbon .card{background:linear-gradient(180deg,rgba(35,34,30,.97),rgba(10,10,10,.99));border-color:rgba(255,214,86,.26);box-shadow:inset 0 0 24px rgba(255,214,86,.035),0 15px 42px rgba(0,0,0,.42)}',
        'body.theme-carbon .hero{background:linear-gradient(145deg,rgba(61,52,24,.96),rgba(10,10,9,.99));border-color:rgba(255,221,103,.34)}',
        'body.theme-carbon .btn.primary{background:linear-gradient(135deg,#e5bd4d,#655017);color:#fff8d8;border-color:#f6d96d}',
        '.swq-carbon-ember{position:absolute;top:-20px;width:5px;height:12px;border-radius:999px;background:linear-gradient(#fff7b3,#d8a72f,transparent);box-shadow:0 0 9px rgba(255,198,64,.65);animation:swqCarbonFall var(--dur,5.8s) linear forwards}',
        '@keyframes swqCarbonFall{0%{opacity:0;transform:translateY(-18px) rotate(0)}10%{opacity:.72}100%{opacity:0;transform:translateY(112vh) rotate(180deg)}}',

        'body.theme-prisma{background:radial-gradient(circle at 12% 0,#1a2d4f 0,#08111f 35%,#03060d 100%)!important;color:#eef9ff}',
        'body.theme-prisma::before{content:"";position:fixed;inset:-20%;z-index:-2;pointer-events:none;background:linear-gradient(118deg,transparent 43%,rgba(103,245,255,.16) 48%,rgba(166,109,255,.16) 51%,rgba(255,111,186,.12) 54%,transparent 59%);background-size:180% 180%;animation:swqPrisma 11s linear infinite}',
        'body.theme-prisma::after{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(circle at 82% 70%,rgba(66,221,255,.08),transparent 24%)}',
        '@keyframes swqPrisma{from{transform:translateX(-8%) rotate(-1deg)}to{transform:translateX(8%) rotate(1deg)}}',
        'body.theme-saturno{background:radial-gradient(circle at 50% 18%,#1b2340 0,#070b17 45%,#02030a 100%)!important;color:#edf5ff}',
        'body.theme-saturno::before{content:"";position:fixed;width:min(34vw,250px);height:min(34vw,250px);left:50%;top:23%;transform:translate(-50%,-50%);z-index:-1;pointer-events:none;border-radius:50%;background:radial-gradient(circle at 35% 28%,#cbd4c7 0 6%,#7e8b79 7% 22%,#3f4a45 23% 70%,#182025 71% 100%);box-shadow:0 0 55px rgba(155,196,209,.12)}',
        'body.theme-saturno::after{content:"";position:fixed;width:min(54vw,380px);height:min(17vw,100px);left:50%;top:23%;transform:translate(-50%,-50%) rotate(-12deg);z-index:-1;pointer-events:none;border:3px solid rgba(225,231,201,.48);border-radius:50%;box-shadow:0 0 20px rgba(229,220,168,.10);animation:swqSaturnRing 9s linear infinite}',
        '@keyframes swqSaturnRing{to{transform:translate(-50%,-50%) rotate(348deg)}}',
        'body.theme-tinta{background:radial-gradient(circle at 50% 0,#183d4a 0,#07121a 42%,#020609 100%)!important;color:#edfaff}',
        'body.theme-tinta::after{content:"";position:fixed;width:min(74vw,560px);height:min(42vw,300px);left:50%;top:38%;transform:translate(-50%,-50%);z-index:-1;pointer-events:none;border-radius:52% 48% 46% 54%;background:radial-gradient(circle at 48% 45%,rgba(32,105,119,.34),rgba(17,55,68,.22) 44%,transparent 72%);filter:blur(5px);animation:swqInk 11s ease-in-out infinite alternate}',
        '@keyframes swqInk{to{transform:translate(-45%,-46%) scale(1.05)}}',
        'body.theme-marealunar{background:radial-gradient(circle at 50% 0,#172942 0,#07111f 42%,#02050b 100%)!important;color:#edf8ff}',
        'body.theme-marealunar::before{content:"";position:fixed;width:86px;height:86px;right:14%;top:13%;z-index:-1;pointer-events:none;border-radius:50%;background:radial-gradient(circle at 34% 30%,#ffffff,#c7d8e6 40%,#71869d 78%,#2b3a4b 100%);box-shadow:0 0 35px rgba(199,219,255,.18)}',
        'body.theme-marealunar::after{content:"";position:fixed;left:-10%;right:-10%;bottom:13%;height:110px;z-index:-1;pointer-events:none;border-top:2px solid rgba(130,209,255,.15);border-radius:50%;animation:swqMoonWave 8s ease-in-out infinite}',
        '@keyframes swqMoonWave{50%{transform:translateY(-9px) scaleX(1.03)}}',
        'body.theme-pizarra{background-color:#0d1014!important;background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)!important;background-size:34px 34px!important;color:#f2f4f5}',
        'body.theme-pizarra .card{background:linear-gradient(180deg,rgba(27,31,36,.97),rgba(10,12,15,.99));border-color:rgba(221,228,232,.15)}',
        'body.theme-pizarra .btn{background:linear-gradient(145deg,#22272d,#111419)!important;border-color:rgba(224,231,235,.18)!important;color:#f4f6f8!important}',
        'body.theme-pizarra .btn.primary{background:linear-gradient(135deg,#c6cdd2,#626c74)!important;color:#0c1013!important;border-color:#e7ecef!important}'
      ].join('');
      document.head.appendChild(s);
    }

    function swqSyncLeviatanV9(){
      let layer=document.getElementById('swqLeviatanLayer');
      if(S.settings.theme!=='Leviatan'){if(layer)layer.remove();return;}
      if(!layer){
        layer=document.createElement('div');layer.id='swqLeviatanLayer';layer.className='swq-lev-layer';document.body.appendChild(layer);
      }
      while(layer.querySelectorAll('.swq-lev-front-fish').length>2)layer.querySelector('.swq-lev-front-fish')?.remove();
      if(!layer.querySelector('.swq-lev-front-fish')&&Math.random()<0.8){
        const f=document.createElement('span');f.className='swq-lev-front-fish';f.textContent=Math.random()<0.5?'🐟':'🐠';
        f.style.top=(28+Math.random()*48)+'%';f.style.setProperty('--bob',(-22+Math.random()*44)+'px');layer.appendChild(f);setTimeout(()=>f.remove(),8200);
      }
    }

    function swqSyncChessV9(){
      let layer=document.getElementById('swqChessLayer'),burst=document.getElementById('swqChessBurstLayer');
      if(S.settings.theme==='Ajedrez'){
        if(!layer){layer=document.createElement('div');layer.id='swqChessLayer';layer.className='swq-chess-layer';document.body.appendChild(layer);}
        const pieces=['♟','♞','♜','♝','♛','♚'];let current=layer.querySelectorAll('.swq-chess-fall');
        while(current.length>5){current[0].remove();current=layer.querySelectorAll('.swq-chess-fall');}
        if(current.length<5)for(let i=current.length;i<5;i++){const p=document.createElement('span');p.className='swq-chess-fall';p.textContent=pieces[i%pieces.length];p.style.left=(4+Math.random()*92)+'%';p.style.setProperty('--dx',(-60+Math.random()*120)+'px');p.style.setProperty('--d',(8+Math.random()*5)+'s');p.style.setProperty('--delay',(-Math.random()*9)+'s');layer.appendChild(p);}
        if(!burst){burst=document.createElement('div');burst.id='swqChessBurstLayer';burst.className='swq-chess-burst-layer';document.body.appendChild(burst);}
      }else{if(layer)layer.remove();if(burst)burst.remove();}
    }

    function swqSpawnBeeV9(){
      const host=document.getElementById('themeParticles');if(!host||S.settings.theme!=='Bee')return;
      if(host.querySelectorAll('.swq-bee-honey,.swq-bee-fly').length>=6)return;
      const el=document.createElement('span');
      if(Math.random()<0.55){el.className='swq-bee-honey';el.textContent='🍯';el.style.left=(5+Math.random()*90)+'%';}
      else{el.className='swq-bee-fly';el.textContent='🐝';el.style.left='-12vw';el.style.setProperty('--top',(18+Math.random()*60)+'%');el.style.setProperty('--dur',(6+Math.random()*2)+'s');}
      host.appendChild(el);setTimeout(()=>el.remove(),9000);
    }

    function swqSpawnCarbonV9(){
      const host=document.getElementById('themeParticles');if(!host||S.settings.theme!=='Carbon')return;
      if(host.querySelectorAll('.swq-carbon-ember').length>=6)return;
      const el=document.createElement('span');el.className='swq-carbon-ember';el.style.left=(6+Math.random()*88)+'%';el.style.setProperty('--dur',(5+Math.random()*3)+'s');host.appendChild(el);setTimeout(()=>el.remove(),8500);
    }

    function swqInventoryHTML(){
      swqEnsureV9State();
      const keys=Object.keys(SWQ_CONSUMABLES).filter(k=>swqInventoryCount(k)>0||Number(S.activeConsumables[k]||0)>0);
      const shield=Number(S.shield||0),rows=[];
      for(const k of keys){
        const d=SWQ_CONSUMABLES[k],count=swqInventoryCount(k),active=Number(S.activeConsumables[k]||0)>0;
        let button='';
        if(d.kind==='next')button=active?'<div class="pill swq-inventory-active" style="margin-top:7px">✅ Preparado para el próximo entrenamiento</div>':'<button class="btn secondary" onclick="swqUseConsumable(\''+k+'\')">Usar en próximo</button>';
        else if(d.kind==='instant')button='<button class="btn primary" onclick="swqUseConsumable(\''+k+'\')">Usar ahora</button>';
        else if(d.kind==='roulette')button='<button class="btn primary" onclick="swqUseConsumable(\''+k+'\')">Abrir ahora</button>';
        else if(d.kind==='daily')button='<button class="btn primary" onclick="swqUseConsumable(\''+k+'\')">Activar para hoy</button>';
        rows.push('<div class="swq-inventory-item"><div>'+d.icon+' <b>'+esc(d.name)+'</b></div><div class="count">×'+fmt(count)+'</div><div class="swq-use-note">'+esc(d.desc)+'</div>'+button+'</div>');
      }
      if(shield>0)rows.push('<div class="swq-inventory-item"><div>🛡️ <b>Recuperador de racha</b></div><div class="count">×'+fmt(shield)+'</div><div class="swq-use-note">Se conserva hasta que una revisión semanal necesite proteger tu racha.</div></div>');
      if(!rows.length)return '<div class="card" style="margin-top:10px"><div class="sectionTitle">🎒 INVENTARIO DE CONSUMIBLES</div><div class="sub" style="margin-top:6px">No tienes consumibles guardados. Los que compres o recibas aparecerán aquí y no se usarán automáticamente.</div></div>';
      return '<div class="card" style="margin-top:10px"><div class="sectionTitle">🎒 INVENTARIO DE CONSUMIBLES</div><div class="sub" style="margin-top:5px">Guarda tus consumibles y decide cuándo utilizarlos. Comprar un objeto nunca lo consume.</div><div class="swq-inventory-grid">'+rows.join('')+'</div></div>';
    }

    function swqOpenStoredRoulette(k){
      swqEnsureV9State();
      if(swqInventoryCount(k)<=0){toast('🎁 No tienes ese consumible.');return;}
      S.inventory[k]--;save();
      try{openShopRoulette(k==='rouletteVip'?'vip':'normal');}catch(e){console.warn('SWQ stored roulette',e);toast('No se pudo abrir la ruleta.');}
      render();
    }

    function swqUseConsumable(k){
      swqEnsureV9State();
      if(k==='cloroPremium'||k==='fichaNadador'){
        if(swqInventoryCount(k)<=0){toast('🎒 No tienes '+SWQ_CONSUMABLES[k].name+'.');return;}
        if(Number(S.activeConsumables[k]||0)>0){toast('✅ Ya está preparado para el próximo entrenamiento.');return;}
        S.inventory[k]--;S.activeConsumables[k]=1;
        S.consumables[k]=1;save();render();
        toast(SWQ_CONSUMABLES[k].icon+' '+SWQ_CONSUMABLES[k].name+' preparado para tu próximo entrenamiento.',3500);return;
      }
      if(k==='xp500'||k==='xp1500'||k==='xpJuan'){
        if(swqInventoryCount(k)<=0){toast('🎒 No tienes ese cristal.');return;}
        const bonus=k==='xp500'?500:k==='xp1500'?1500:13000;S.inventory[k]--;S.itemBonusXP+=bonus;gainXP(bonus);save();render();
        toast(SWQ_CONSUMABLES[k].icon+' '+SWQ_CONSUMABLES[k].name+' utilizado.',3000);return;
      }
      if(k==='rouletteNormal'||k==='rouletteVip'){swqOpenStoredRoulette(k);return;}
      if(k==='fichaRepeticion'){
        const day=localDateKey(),d=S.dailyReward||{};
        if(swqInventoryCount(k)<=0){toast('🎒 No tienes ninguna Ficha de Repetición.');return;}
        if(d.date!==day||!d.claimed){toast('🎁 Primero cobra la recompensa diaria de hoy.');return;}
        if(Number(d.repeatUsed||0)>0){toast('🔁 Ya utilizaste la repetición de hoy.');return;}
        S.inventory[k]--;d.repeatUsed=1;
        const themes=['Cosmos','Abismo','Solar','Glacial','Esmeralda','Leviatan','Sangriento','Rosadito','CianNeon','Carbon','Eclipse','Carretera','CobaltoCobre'].filter(x=>!S.purchases['theme_'+x]);
        if(themes.length&&Math.random()<.04){d.kind='theme';d.themeKey=themes[Math.floor(Math.random()*themes.length)];d.coins=0;d.xp=0;d.claimed=false;}
        else{d.kind='coinsxp';d.themeKey='';d.coins=20+Math.floor(Math.random()*131);d.xp=10+Math.floor(Math.random()*91);d.claimed=false;}
        save();claimDailyReward();toast('🔁 Nueva tirada diaria obtenida.',3500);return;
      }
    }
    window.swqUseConsumable=swqUseConsumable;

    const baseNonAchievementThemes=nonAchievementThemesForRoulette;
    nonAchievementThemesForRoulette=function(){return baseNonAchievementThemes().filter(k=>!SWQ_NEW_STYLES[k]);};

    const baseBuyV9=buy;
    if(!window.__swqBuyV9Wrapped){
      buy=function(id){
        if(SWQ_NEW_STYLES[id?.replace?.(/^theme_/,'')]){
          const key=id.replace(/^theme_/,'');
          if(!S.shopUnlocks?.[id]){toast('🔒 '+SWQ_NEW_STYLES[key].name+' se desbloquea al llegar a '+(RANKS.find(r=>r.c===SWQ_NEW_STYLES[key].rank)?.n||'un rango superior')+'.');return;}
        }
        if(id==='fichaRepeticion'&&!S.shopUnlocks?.fichaRepeticion){toast('🔒 La Ficha de Repetición se desbloquea al llegar a Poseidón.');return;}
        return baseBuyV9.apply(this,arguments);
      };
      window.__swqBuyV9Wrapped=true;
    }

    const baseGainXPV9=gainXP;
    if(!window.__swqGainXPV9Wrapped){
      gainXP=function(amount){
        const before=currentRank().i;
        const result=baseGainXPV9.apply(this,arguments);
        const after=currentRank().i;
        if(after>before){
          const info=swqGrantRankMilestones(false);
          if(info.changed){S.__swqLastRankRewardEvents=info.events||[];toast('🏆 Nuevo rango: '+currentRank().r.n+' · recompensas añadidas a tu inventario.',4200);}
        }
        swqEnsureV9State();
        return result;
      };
      window.__swqGainXPV9Wrapped=true;
    }

    function swqShowRankRewardCard(info,r,attempt=0){
      const host=document.querySelector('#modal .rank-promo');
      if(!host){
        if(attempt<5)setTimeout(()=>swqShowRankRewardCard(info,r,attempt+1),70);
        return;
      }
      if(host.querySelector('.swq-rank-reward'))return;
      const reward=SWQ_RANK_REWARDS.find(x=>x.c===r?.c);
      const fallback=[];
      if(reward?.coins)fallback.push('+'+fmt(reward.coins)+' 🪙');
      if(reward?.xp)fallback.push('+'+fmt(reward.xp)+' XP');
      if(reward?.give){
        const it=SWQ_CONSUMABLES[reward.give];
        if(it)fallback.push(it.icon+' '+it.name);
      }
      if(reward?.giveMany)reward.giveMany.forEach(k=>{
        const it=SWQ_CONSUMABLES[k];
        if(it)fallback.push(it.icon+' '+it.name);
      });
      if(reward?.randomConsumable)fallback.push('🎁 Consumible aleatorio');
      if(reward?.unlockStyle){
        const it=SWQ_NEW_STYLES[reward.unlockStyle];
        if(it)fallback.push('🎨 '+it.name+' disponible en la tienda');
      }
      if(reward?.unlockConsumable)fallback.push('🔁 Ficha de Repetición disponible en la tienda');
      if(reward?.pear==='poseidon')fallback.push('🍐 Nuevo diálogo especial de Pera');
      if(reward?.pear==='coach')fallback.push('🍐 Diálogo final especial de Pera');
      const list=Array.isArray(info?.events)&&info.events.length?info.events:fallback;
      if(!list.length)return;
      const btn=host.querySelector('button.btn.primary');
      const box=document.createElement('div');box.className='swq-rank-reward';
      box.innerHTML='<div class="kicker">🎁 RECOMPENSA DEL RANGO</div>'+swqRankRewardLabel(list);
      if(btn)host.insertBefore(box,btn);else host.appendChild(box);
    }

    const baseRankRevealV9=rankReveal;
    if(!window.__swqRankRevealV9Wrapped){
      rankReveal=function(r){swqEnsureV9State();const queued={events:Array.isArray(S.__swqLastRankRewardEvents)?S.__swqLastRankRewardEvents.slice():[]};const info=swqGrantRankMilestones(false);const merged={events:info.events?.length?info.events:queued.events};S.__swqLastRankRewardEvents=[];baseRankRevealV9.apply(this,arguments);setTimeout(()=>swqShowRankRewardCard(merged,r),80);};
      window.__swqRankRevealV9Wrapped=true;
    }

    const baseProfileV9=profile;
    if(!window.__swqProfileV9Wrapped){
      profile=function(){swqEnsureV9State();return baseProfileV9.apply(this,arguments)+swqInventoryHTML();};
      window.__swqProfileV9Wrapped=true;
    }

    const baseHomeV9=home;
    if(!window.__swqHomeV9Wrapped){
      home=function(){const html=baseHomeV9.apply(this,arguments);return html.replace(/<div class="update-note">[\s\S]*?<\/div>/,'<div class="update-note">🛠️ Última actualización: progresión por rangos, inventario de consumibles, cinco estilos nuevos, conversaciones especiales de Pera y refinamientos visuales de Ajedrez, Leviatán, Abeja y Carbón.</div>');};
      window.__swqHomeV9Wrapped=true;
    }

    if(!window.__swqInstructionsV9Wrapped){
      instructions=function(){
        modal('<div class="kicker">📖 INSTRUCCIONES</div><h2>Cómo funciona Aqualithium</h2><div class="list">'+
          '<div class="list-item"><b>🏊 Entrena</b><div class="sub">Registra distancia, repeticiones, estilo, intensidad, correctivo y tiempo opcional. La dificultad se calcula automáticamente usando tu carga de entrenamiento y tu referencia.</div></div>'+
          '<div class="list-item"><b>⭐ XP y 🪙 monedas</b><div class="sub">Los metros son la base; el estilo, la intensidad, los correctivos y los tiempos también influyen. Los entrenamientos tienen +25% de XP global y +15% de monedas global respecto de la fórmula anterior. Cloro Premium y Ficha del Nadador se aplican únicamente cuando tú los preparas desde el inventario.</div></div>'+
          '<div class="list-item"><b>🎒 Inventario</b><div class="sub">Los consumibles no se gastan al comprarlos. Se guardan en Perfil. Desde allí puedes preparar Cloro Premium o Ficha del Nadador para el siguiente entrenamiento, usar cristales XP, abrir ruletas o activar una Ficha de Repetición.</div></div>'+
          '<div class="list-item"><b>🏆 Rangos</b><div class="sub">Los 22 rangos conservan su progresión actual. Al alcanzar uno, recibes su recompensa una sola vez: monedas, XP y algunos consumibles; ciertos rangos desbloquean contenido nuevo para comprar en la tienda.</div></div>'+
          '<div class="list-item"><b>🎨 Cinco estilos nuevos</b><div class="sub">Prisma se desbloquea en Venus, Saturno en Saturno, Tinta en Neptuno, Marea Lunar en Leviatán y Pizarra en Poseidón. Se desbloquean en la tienda por rango y después se compran con monedas; nunca se regalan.</div></div>'+
          '<div class="list-item"><b>🍐 Pera</b><div class="sub">Al llegar a Poseidón aparece una conversación nueva llamada “Felicidades”. Al llegar a Coach Mati esa misma conversación cambia a “...” y contiene el cierre sobre disciplina, constancia y qué hacer después del último rango.</div></div>'+
          '<div class="list-item"><b>🎮 Atrapa Burbujas</b><div class="sub">Hay cuatro dificultades. Extremo dura menos pero ahora paga mejor que antes. Tienes un máximo de cinco partidas con recompensa por día.</div></div>'+
          '<div class="list-item"><b>📱 App</b><div class="sub">La página sigue funcionando como PWA, con navegación inferior, guardado local y sincronización cuando tienes una cuenta conectada.</div></div>'+
          '</div><div class="card" style="margin-top:10px;background:#0c2238"><b>💙 Recuerda:</b><div class="sub" style="margin-top:5px">La recompensa acompaña el camino, pero la constancia se construye sesión a sesión. No necesitas que cada entrenamiento sea perfecto.</div></div>'+
          (S.tutorialRewardClaimed?'<div class="list-item" style="margin-top:10px">✅ Recompensa de instrucciones ya reclamada.</div>':'<button class="btn primary" style="margin-top:10px" onclick="claimTutorialReward()">🎁 Terminé de leer · reclamar 100 🪙</button>')+
          '<button class="btn secondary" style="margin-top:8px" onclick="closeModal()">Cerrar</button>');
      };
      window.__swqInstructionsV9Wrapped=true;
    }

    const baseShopV9=shop;
    if(!window.__swqShopV9Wrapped){
      shop=function(){
        let html=baseShopV9.apply(this,arguments);
        for(const key of Object.keys(SWQ_NEW_STYLES)){
          const id='theme_'+key;
          if(!S.shopUnlocks?.[id]&&!S.purchases?.[id]){
            const safe=id;
            const re=new RegExp("<button class=\\\"btn primary\\\" style=\\\"margin-top:10px\\\" onclick=\\\"buy\\('"+safe+"'\\)\\\">[^<]*</button>");
            const rankName=RANKS.find(r=>r.c===SWQ_NEW_STYLES[key].rank)?.n||'un rango superior';
            html=html.replace(re,'<div class="pill swq-locked-shop" style="margin-top:10px">🔒 Se desbloquea en '+esc(rankName)+'</div>');
          }
        }
        if(!S.shopUnlocks?.fichaRepeticion&&!S.purchases?.fichaRepeticion){
          html=html.replace('onclick="buy(\'fichaRepeticion\')"','onclick="toast(\'🔒 La Ficha de Repetición se desbloquea en Poseidón.\')"');
        }
        return html;
      };
      window.__swqShopV9Wrapped=true;
    }

    const SWQ_POSEIDON_PEAR=[
      {speaker:'👤 TÚ',text:'Pera, acabo de llegar a Poseidón y no sé muy bien qué debería sentir. Durante muchísimo tiempo este nombre parecía lejano, y ahora está ahí mismo delante de mí.'},
      {speaker:'🍐 PERA',text:'Entonces deja que te felicite de verdad, porque llegar hasta aquí no fue simplemente llenar una barra de experiencia. Hubo sesiones buenas, sesiones normales, días en los que tenías energía y otros en los que seguramente habrías preferido estar haciendo cualquier otra cosa.'},
      {speaker:'👤 TÚ',text:'Lo curioso es que cuando veía los primeros rangos pensaba que cada uno era enorme, pero ahora parecen pequeños pasos que quedaron muy atrás.'},
      {speaker:'🍐 PERA',text:'Así funciona el progreso cuando se acumula durante mucho tiempo: mientras avanzas miras principalmente el siguiente obstáculo, pero cuando te das la vuelta descubres una distancia enorme que construiste casi sin darte cuenta.'},
      {speaker:'👤 TÚ',text:'También hubo entrenamientos que salieron mal y momentos en los que pensé que estaba empeorando.'},
      {speaker:'🍐 PERA',text:'Y ninguno de esos días logró borrar los demás. Una sesión mala puede enseñarte algo sobre tu energía, tu técnica o tu estado de ese día, pero no tiene derecho a escribir por sí sola toda la historia de tu progreso.'},
      {speaker:'👤 TÚ',text:'Entonces supongo que llegar a un rango alto no significa que ahora tenga que ser perfecto.'},
      {speaker:'🍐 PERA',text:'Exactamente. Poseidón no te está pidiendo perfección; te está recordando que pudiste mantener un proceso durante mucho tiempo, incluso cuando el entusiasmo inicial no estaba presente.'},
      {speaker:'👤 TÚ',text:'Eso me hace pensar que la disciplina no es simplemente obligarme a entrenar siempre.'},
      {speaker:'🍐 PERA',text:'No. La disciplina también es saber cuándo continuar, cuándo ajustar el esfuerzo, cuándo descansar y, sobre todo, cómo volver después de que una parte de tu rutina se desordenó.'},
      {speaker:'👤 TÚ',text:'Me gusta más esa idea, porque así no siento que descansar sea automáticamente fracasar.'},
      {speaker:'🍐 PERA',text:'Descansar de forma adecuada no elimina lo que ya construiste. Lo importante es que el descanso no se convierta accidentalmente en abandonar todo el proceso porque una semana no salió como querías.'},
      {speaker:'👤 TÚ',text:'Creo que antes necesitaba ver una recompensa para sentir que realmente estaba avanzando.'},
      {speaker:'🍐 PERA',text:'Las recompensas son divertidas y pueden darte dirección, pero no deberían ser la única prueba de que algo valió la pena. Llegará un momento en el que tendrás que seguir sin que aparezca un rango nuevo después.'},
      {speaker:'👤 TÚ',text:'¿Y eso es lo que viene después de Poseidón?'},
      {speaker:'🍐 PERA',text:'Podría ser. Pero todavía existe Coach Mati, así que no te voy a adelantar todo. Solo quiero que disfrutes este momento y entiendas lo que realmente significa haber llegado hasta aquí.'},
      {speaker:'👤 TÚ',text:'Gracias, Pera. Creo que necesitaba escuchar eso más que una pantalla llena de números.'},
      {speaker:'🍐 PERA',text:'De nada. Hoy no quiero que pienses solamente en cuánto falta. Mira también cuánto ya hiciste. Felicidades por Poseidón.'}
    ];
    const SWQ_COACH_PEAR=[
      {speaker:'🍐 PERA',text:'...'},
      {speaker:'👤 TÚ',text:'¿Pera? ¿Por qué tu conversación de Felicidades ahora se llama solamente “...”?'},
      {speaker:'🍐 PERA',text:'Porque este es uno de esos momentos en los que siento que cualquier discurso enorme tendría menos valor que una pausa. Llegaste a Coach Mati, y por primera vez no existe otro nombre encima de este.'},
      {speaker:'👤 TÚ',text:'Cuando empecé, Coach Mati parecía algo casi imposible. Pensaba en el último rango como si fuera una meta gigantesca que resolvería todo.'},
      {speaker:'🍐 PERA',text:'Y ahora estás aquí, quizá esperando una sensación gigantesca que te diga que terminaste algo importante. Pero mira alrededor: sigues siendo tú, seguimos dentro del mismo juego y mañana seguirá existiendo una piscina, una rutina y decisiones que nadie puede tomar por ti.'},
      {speaker:'👤 TÚ',text:'Entonces el último rango no significa que se acabó todo.'},
      {speaker:'🍐 PERA',text:'Significa que se acabó la lista. Y hay una diferencia enorme entre terminar una lista y terminar un camino.'},
      {speaker:'👤 TÚ',text:'Creo que por fin entiendo algo que me dijiste en Poseidón: las recompensas sirven para acompañar el camino, pero no pueden ser la razón por la que sigo.'},
      {speaker:'🍐 PERA',text:'Exactamente. La verdadera constancia aparece cuando ya no hay una recompensa nueva esperándote y aun así eres capaz de decidir qué quieres seguir construyendo.'},
      {speaker:'👤 TÚ',text:'También aprendí que perder el ritmo no borra todo lo anterior.'},
      {speaker:'🍐 PERA',text:'Y eso quizá sea una de las cosas más importantes que puedes llevarte de todo este sistema. La constancia no significa nunca desordenarte; significa aprender a reorganizarte y volver cuando sea necesario.'},
      {speaker:'👤 TÚ',text:'Si una semana sale mal, vuelvo. Si una sesión sale mal, aprendo. Si pierdo la motivación, intento entender por qué.'},
      {speaker:'🍐 PERA',text:'Eso es. Ya no estás buscando una fórmula perfecta que garantice que nunca tendrás un día malo. Estás aprendiendo una habilidad mucho más útil: continuar sin convertir cada error en una sentencia sobre ti mismo.'},
      {speaker:'👤 TÚ',text:'Supongo que ahora puedo perseguir otras cosas sin sentir que tengo que subir de rango para justificarlo.'},
      {speaker:'🍐 PERA',text:'Claro. Puedes perseguir mejores marcas, disfrutar una sesión tranquila, aprender una técnica, completar una misión, probar un estilo nuevo o simplemente registrar un entrenamiento porque te apetecía nadar. Ya no necesitas un número superior para darle significado a lo que haces.'},
      {speaker:'👤 TÚ',text:'Entonces Coach Mati no es exactamente el final.'},
      {speaker:'🍐 PERA',text:'Es el final de la progresión de rangos. La historia, en cambio, sigue mientras tú quieras escribirla.'},
      {speaker:'👤 TÚ',text:'Y si algún día vuelvo a sentir que estoy retrocediendo...'},
      {speaker:'🍐 PERA',text:'Recuerda todo lo que tardó en construirse este momento. Una mala temporada no puede borrar meses o años de decisiones. Puedes detenerte, ajustar algo, pedir ayuda, descansar, cambiar de objetivo y volver a empezar desde donde estés.'},
      {speaker:'👤 TÚ',text:'Me gusta pensar que la palabra más importante de todo esto no es “ganar”, sino “volver”.'},
      {speaker:'🍐 PERA',text:'A mí también. Porque volver significa que todavía eliges seguir construyendo algo.'},
      {speaker:'👤 TÚ',text:'Gracias por estar durante todo el camino, incluso cuando yo estaba obsesionado con mirar números y pensar en el siguiente rango.'},
      {speaker:'🍐 PERA',text:'Gracias a ti por volver tantas veces. Y ahora sí voy a decirlo una última vez: no necesitas otro rango para demostrar que avanzaste. Llegaste hasta aquí. Ahora decide qué quieres hacer con todo lo que aprendiste.'},
      {speaker:'👤 TÚ',text:'¿Y tú qué vas a hacer?'},
      {speaker:'🍐 PERA',text:'Yo voy a seguir aquí. Soy una pera. Tengo un trabajo bastante específico.'},
      {speaker:'👤 TÚ',text:'Eso fue sorprendentemente profundo para una fruta.'},
      {speaker:'🍐 PERA',text:'He tenido 21 rangos para prepararme. Déjame disfrutar mi momento.'}
    ];

    function swqSyncPearRankTopic(){
      if(typeof PEAR_TOPIC_DIALOGUES==='undefined'||!Array.isArray(PEAR_TOPIC_DIALOGUES))return;
      const idx=currentRank().i,poseidonIdx=RANKS.findIndex(r=>r.c==='poseidon'),coach=RANKS.findIndex(r=>r.c==='coach');
      let pos=PEAR_TOPIC_DIALOGUES.findIndex(x=>x.id==='rank_felicidades');
      if(idx<poseidonIdx){if(pos>=0)PEAR_TOPIC_DIALOGUES.splice(pos,1);return;}
      const targetTitle=idx>=coach?'...':'Felicidades',targetLines=idx>=coach?SWQ_COACH_PEAR:SWQ_POSEIDON_PEAR;
      if(pos<0)PEAR_TOPIC_DIALOGUES.push({id:'rank_felicidades',title:targetTitle,lines:targetLines});
      else{PEAR_TOPIC_DIALOGUES[pos].title=targetTitle;PEAR_TOPIC_DIALOGUES[pos].lines=targetLines;}
    }
    const basePearTopicMenuV9=pearTopicMenu;
    if(!window.__swqPearTopicMenuV9Wrapped){pearTopicMenu=function(){swqSyncPearRankTopic();return basePearTopicMenuV9.apply(this,arguments);};window.__swqPearTopicMenuV9Wrapped=true;}
    const baseOpenPearV9=openPearScene;
    if(!window.__swqOpenPearV9Wrapped){openPearScene=function(){swqEnsureV9State();swqSyncPearRankTopic();return baseOpenPearV9.apply(this,arguments);};window.__swqOpenPearV9Wrapped=true;}

    const baseSaveTrainingV9=saveTraining;
    if(!window.__swqSaveTrainingV9Wrapped){
      saveTraining=function(){
        swqEnsureV9State();
        const cloroActive=Number(S.activeConsumables.cloroPremium||0)>0,fichaActive=Number(S.activeConsumables.fichaNadador||0)>0;
        const beforeCount=Array.isArray(S.trainings)?S.trainings.length:0;
        S.consumables.cloroPremium=cloroActive?1:0;S.consumables.fichaNadador=fichaActive?1:0;
        try{
          const out=baseSaveTrainingV9.apply(this,arguments);
          setTimeout(()=>{
            const succeeded=Array.isArray(S.trainings)&&S.trainings.length>beforeCount;
            if(cloroActive){if(!succeeded)S.inventory.cloroPremium++;S.activeConsumables.cloroPremium=0;}
            if(fichaActive){if(!succeeded)S.inventory.fichaNadador++;S.activeConsumables.fichaNadador=0;}
            S.consumables.cloroPremium=0;S.consumables.fichaNadador=0;save();
            if(!succeeded)render();
          },120);
          return out;
        }catch(e){
          if(cloroActive){S.inventory.cloroPremium++;S.activeConsumables.cloroPremium=0;}
          if(fichaActive){S.inventory.fichaNadador++;S.activeConsumables.fichaNadador=0;}
          S.consumables.cloroPremium=0;S.consumables.fichaNadador=0;save();
          throw e;
        }
      };
      window.__swqSaveTrainingV9Wrapped=true;
    }

    const baseClaimDailyRewardV9=claimDailyReward;
    if(!window.__swqDailyRepeatV9Wrapped){claimDailyReward=function(){swqEnsureV9State();return baseClaimDailyRewardV9.apply(this,arguments);};window.__swqDailyRepeatV9Wrapped=true;}

    if(typeof MINI_LEVELS!=='undefined'&&MINI_LEVELS.extremo){MINI_LEVELS.extremo.rewardMax=75;MINI_LEVELS.extremo.desc='Muy poco tiempo y mucho movimiento. Es la dificultad con la recompensa máxima.';}

    const baseSpawnThemeParticleV9=spawnThemeParticle;
    if(!window.__swqSpawnThemeParticleV9Wrapped){
      spawnThemeParticle=function(){if(S.settings.theme==='Bee'){swqSpawnBeeV9();return;}if(S.settings.theme==='Carbon'){swqSpawnCarbonV9();return;}return baseSpawnThemeParticleV9.apply(this,arguments);};
      window.__swqSpawnThemeParticleV9Wrapped=true;
    }

    swqSyncLeviatan=swqSyncLeviatanV9;swqSyncChess=swqSyncChessV9;

    const baseRebuildProfileV9=rebuildProfile;
    if(!window.__swqRebuildProfileV9Wrapped){
      rebuildProfile=function(){
        const out=baseRebuildProfileV9.apply(this,arguments);
        S.xp+=Number(S.rankRewardXP||0)+Number(S.itemBonusXP||0);
        S.coins+=Number(S.rankRewardCoins||0)+Number(S.itemBonusCoins||0);
        S.level=levelFromXP(S.xp);save();return out;
      };
      window.__swqRebuildProfileV9Wrapped=true;
    }
    const baseRecalcAllV9=recalcAll;
    if(!window.__swqRecalcAllV9Wrapped){
      recalcAll=function(){
        const out=baseRecalcAllV9.apply(this,arguments);
        S.xp+=Number(S.rankRewardXP||0)+Number(S.itemBonusXP||0);
        S.coins+=Number(S.rankRewardCoins||0)+Number(S.itemBonusCoins||0);
        S.level=levelFromXP(S.xp);save();return out;
      };
      window.__swqRecalcAllV9Wrapped=true;
    }

    const baseEquipThemeV9=equipTheme;
    equipTheme=function(theme){if(SWQ_NEW_STYLES[theme]&&!S.purchases['theme_'+theme]){toast('🔒 Compra primero el estilo '+SWQ_NEW_STYLES[theme].name+' en la tienda.');return;}return baseEquipThemeV9.apply(this,arguments);};

    swqEnsureV9State();swqInstallV9CSS();
    const swqInitialRewards=swqGrantRankMilestones(false);
    if(swqInitialRewards.changed)toast('🎁 Se añadieron tus recompensas de rango al nuevo sistema de inventario.',4500);
    if(typeof applyTheme==='function')try{applyTheme();}catch(e){}
    try{swqSyncLeviatan();}catch(e){}
    try{swqSyncChess();}catch(e){}
    setInterval(()=>{try{swqEnsureV9State();swqSyncPearRankTopic();swqSyncLeviatan();swqSyncChess();if(S.settings.theme==='Bee')swqSpawnBeeV9();if(S.settings.theme==='Carbon')swqSpawnCarbonV9();}catch(e){}},5200);

    let swqCloudSyncAttempts=0;
    const swqCloudSyncTimer=setInterval(()=>{
      try{
        swqCloudSyncAttempts++;
        if(authUser&&S.remote?.userId){swqEnsureV9State();swqGrantRankMilestones(false);save();if(typeof syncProfileToCloud==='function')syncProfileToCloud();clearInterval(swqCloudSyncTimer);}
        else if(swqCloudSyncAttempts>=12)clearInterval(swqCloudSyncTimer);
      }catch(e){if(swqCloudSyncAttempts>=12)clearInterval(swqCloudSyncTimer);}
    },1000);

    try{save();render();}catch(e){console.warn('SWQ v9 render',e);}
  }catch(e){
    if(String(e?.message||e)!=='__SWQ_ALREADY_APPLIED__')console.warn('SWQ update v9',e);
  }

})();

/* === SWQ VISUAL REPAIR 2026-09-19 === */
(function(){
  'use strict';
  if(window.__SWQ_VISUAL_REPAIR_20260919__)return;
  window.__SWQ_VISUAL_REPAIR_20260919__=true;

  const VIS_VERSION='20260919-3';

  function swqVRRemove(id){
    const el=document.getElementById(id);
    if(el)el.remove();
  }

  function swqVRStyle(){
    if(document.getElementById('swq-visual-repair-css'))return;
    const s=document.createElement('style');
    s.id='swq-visual-repair-css';
    s.textContent=[
      /* Base layers */
      '#swqBeeFX,#swqCarbonFX,#swqLeviatanFX,#swqChessFX{position:fixed;inset:0;pointer-events:none;overflow:hidden}',
      '#swqBeeFX{z-index:48}',
      '#swqCarbonFX{z-index:47}',
      '#swqLeviatanFX{z-index:46}',
      '#swqChessFX{z-index:45}',
      '.swq-vr-bee,.swq-vr-honey,.swq-vr-ember,.swq-vr-fish,.swq-vr-piece{position:absolute;display:block;pointer-events:none;will-change:transform,opacity;user-select:none;-webkit-user-select:none;font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif}',
      
      /* Abeja */
      'body.theme-bee{background:radial-gradient(circle at 50% -10%,#fff6b8 0,#ffe26a 18%,#292715 48%,#070706 100%)!important;color:#fffdf0!important;overflow-x:hidden!important}',
      'body.theme-bee::before{content:"";position:fixed;inset:0;z-index:-3;pointer-events:none;background:repeating-linear-gradient(135deg,rgba(255,214,59,.08) 0 12px,transparent 12px 24px),radial-gradient(circle at 80% 18%,rgba(255,219,72,.14),transparent 25%)}',
      'body.theme-bee::after{content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;background:radial-gradient(circle at 20% 72%,rgba(255,255,255,.07),transparent 23%),linear-gradient(180deg,transparent 0 72%,rgba(0,0,0,.18) 100%)}',
      'body.theme-bee .app{position:relative;z-index:2}',
      'body.theme-bee #themeParticles{display:none!important}',
      'body.theme-bee .card{background:linear-gradient(180deg,rgba(48,45,24,.97),rgba(14,14,11,.99))!important;border-color:rgba(255,215,72,.46)!important;box-shadow:inset 0 0 24px rgba(255,215,72,.05),0 16px 42px rgba(0,0,0,.4)!important}',
      'body.theme-bee .hero{background:linear-gradient(145deg,rgba(76,67,25,.98),rgba(16,16,11,.99))!important;border-color:rgba(255,225,100,.5)!important}',
      'body.theme-bee .btn{background:linear-gradient(145deg,#332f17,#10100d)!important;border-color:rgba(255,215,72,.40)!important;color:#fff8d8!important}',
      'body.theme-bee .btn.primary{background:linear-gradient(135deg,#ffe778,#d29a13,#40330a)!important;color:#171208!important;border-color:#fff2ae!important}',
      '.swq-vr-bee{left:-70px;font-size:24px;filter:drop-shadow(0 3px 7px rgba(255,210,52,.42))}',
      '.swq-vr-honey{top:-55px;font-size:22px;filter:drop-shadow(0 3px 7px rgba(255,204,44,.35))}',
      '@keyframes swqVrBeeFly{0%{opacity:0;transform:translate3d(0,0,0) rotate(-7deg) scale(.82)}10%{opacity:.94}42%{transform:translate3d(45vw,var(--dy),0) rotate(7deg) scale(1.02)}72%{transform:translate3d(82vw,calc(var(--dy) * .55),0) rotate(-5deg) scale(.95)}100%{opacity:0;transform:translate3d(118vw,calc(var(--dy) * .2),0) rotate(4deg) scale(.82)}}',
      '@keyframes swqVrHoneyFall{0%{opacity:0;transform:translate3d(0,-20px,0) rotate(-8deg)}12%{opacity:.88}55%{transform:translate3d(var(--dx),52vh,0) rotate(10deg)}100%{opacity:0;transform:translate3d(calc(var(--dx) * .7),112vh,0) rotate(-14deg)}}',
      
      /* Carbón */
      'body.theme-carbon{background:radial-gradient(circle at 50% -12%,#4a3b14 0,#23221f 22%,#111214 53%,#050607 100%)!important;color:#f7f4e7!important;overflow-x:hidden!important}',
      'body.theme-carbon::before{content:"";position:fixed;inset:0;z-index:-3;pointer-events:none;background:radial-gradient(circle at 22% 25%,rgba(255,218,91,.10),transparent 16%),radial-gradient(circle at 80% 34%,rgba(255,180,42,.07),transparent 18%),linear-gradient(135deg,rgba(255,255,255,.018),transparent 32%,rgba(255,196,62,.02) 60%,transparent 80%)}',
      'body.theme-carbon::after{content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;background:repeating-linear-gradient(115deg,rgba(255,214,86,.025) 0 1px,transparent 1px 38px)}',
      'body.theme-carbon .app{position:relative;z-index:2}',
      'body.theme-carbon #themeParticles{display:none!important}',
      'body.theme-carbon .card{background:linear-gradient(180deg,rgba(38,37,33,.97),rgba(11,12,13,.995))!important;border-color:rgba(255,214,86,.29)!important;box-shadow:inset 0 0 28px rgba(255,214,86,.035),0 17px 46px rgba(0,0,0,.5)!important}',
      'body.theme-carbon .hero{background:linear-gradient(145deg,rgba(70,58,23,.95),rgba(12,12,11,.995))!important;border-color:rgba(255,223,101,.36)!important}',
      'body.theme-carbon .btn{background:linear-gradient(145deg,#303136,#111214)!important;border-color:rgba(255,214,86,.34)!important;color:#f7f2dd!important}',
      'body.theme-carbon .btn.primary{background:linear-gradient(135deg,#e7c653,#8d7620,#40370f)!important;color:#fff7d8!important;border-color:#f6dc7a!important}',
      'body.theme-carbon .nav{background:rgba(7,8,9,.97)!important;border-top-color:rgba(255,214,86,.20)!important}',
      '.swq-vr-ember{top:-24px;width:4px;height:15px;border-radius:99px;background:linear-gradient(#fff9bf,#d9a830,transparent);box-shadow:0 0 10px rgba(255,201,71,.6)}',
      '@keyframes swqVrEmber{0%{opacity:0;transform:translate3d(0,-14px,0) rotate(0)}12%{opacity:.75}100%{opacity:0;transform:translate3d(var(--dx),112vh,0) rotate(220deg)}}',
      
      /* Leviatán */
      'body.theme-leviatan{background:radial-gradient(circle at 50% 0,#164958 0,#0b2938 30%,#061824 62%,#02070c 100%)!important;color:#edfffb!important;overflow-x:hidden!important}',
      'body.theme-leviatan::before{content:"";position:fixed;inset:-8%;z-index:-4;pointer-events:none;background:radial-gradient(ellipse at 50% 18%,rgba(102,255,237,.13),transparent 32%),linear-gradient(165deg,transparent 0 38%,rgba(71,217,203,.08) 39% 42%,transparent 43% 100%);animation:swqVrOceanLight 12s ease-in-out infinite alternate}',
      'body.theme-leviatan::after{content:"";position:fixed;left:-10%;right:-10%;bottom:5%;height:42%;z-index:-3;pointer-events:none;border-top:1px solid rgba(146,255,242,.12);border-radius:50%;background:repeating-linear-gradient(171deg,transparent 0 28px,rgba(119,241,225,.055) 28px 30px,transparent 30px 58px);opacity:.82;animation:swqVrWave 9s ease-in-out infinite}',
      '@keyframes swqVrOceanLight{from{transform:translateX(-1.5%) rotate(-.5deg)}to{transform:translateX(1.5%) rotate(.5deg)}}',
      '@keyframes swqVrWave{50%{transform:translateY(-12px) scaleX(1.02);opacity:.98}}',
      'body.theme-leviatan .app{position:relative;z-index:2}',
      'body.theme-leviatan #themeParticles{display:none!important}',
      'body.theme-leviatan #leviathanEvent{display:none!important}',
      'body.theme-leviatan .card{background:linear-gradient(180deg,rgba(10,35,45,.95),rgba(4,15,23,.985))!important;border-color:rgba(103,240,223,.24)!important;box-shadow:inset 0 0 30px rgba(74,226,207,.035),0 17px 48px rgba(0,0,0,.45)!important}',
      'body.theme-leviatan .hero{background:linear-gradient(145deg,rgba(17,64,73,.96),rgba(4,19,28,.995))!important;border-color:rgba(119,255,235,.32)!important}',
      'body.theme-leviatan .btn{background:linear-gradient(145deg,#123d49,#071821)!important;border-color:rgba(106,244,222,.32)!important;color:#e7fffb!important}',
      'body.theme-leviatan .btn.primary{background:linear-gradient(135deg,#63f1df,#238f9b,#123e4c)!important;color:#031116!important;border-color:#b6fff5!important;box-shadow:0 0 24px rgba(91,242,219,.15)!important}',
      'body.theme-leviatan .nav{background:rgba(2,12,18,.97)!important;border-top-color:rgba(103,240,223,.2)!important}',
      '.swq-vr-fish{left:-90px;font-size:28px;filter:drop-shadow(0 0 10px rgba(113,246,235,.52))}',
      '@keyframes swqVrFishSwim{0%{opacity:0;transform:translate3d(0,0,0) scaleX(-1)}10%{opacity:.92}48%{transform:translate3d(48vw,var(--bob),0) scaleX(-1)}100%{opacity:0;transform:translate3d(118vw,calc(var(--bob) * .55),0) scaleX(-1)}}',
      
      /* Ajedrez */
      'body.theme-ajedrez{background-color:#08080f!important;background-image:linear-gradient(45deg,#17172a 25%,transparent 25% 75%,#17172a 75%),linear-gradient(45deg,#17172a 25%,transparent 25% 75%,#17172a 75%),radial-gradient(circle at 50% 0,rgba(92,207,255,.10),transparent 28%)!important;background-size:64px 64px,64px 64px,100% 100%!important;background-position:0 0,32px 32px,0 0!important;color:#f5f7ff!important;overflow-x:hidden!important}',
      'body.theme-ajedrez::before,body.theme-ajedrez::after{content:none!important;display:none!important}',
      'body.theme-ajedrez .app{position:relative;z-index:2;background:transparent!important}',
      'body.theme-ajedrez #themeParticles{display:none!important}',
      'body.theme-ajedrez .topbar{background:linear-gradient(180deg,rgba(8,8,16,.96),rgba(8,8,16,.70),transparent)!important;border-bottom-color:rgba(134,222,255,.20)!important}',
      'body.theme-ajedrez .card,body.theme-ajedrez .hero,body.theme-ajedrez .stat,body.theme-ajedrez .list-item,body.theme-ajedrez .series,body.theme-ajedrez .shop-item{background:linear-gradient(145deg,rgba(18,19,38,.96),rgba(7,8,17,.97))!important;border-color:rgba(137,219,255,.25)!important;box-shadow:inset 0 0 22px rgba(93,206,255,.035),0 16px 42px rgba(0,0,0,.48)!important}',
      'body.theme-ajedrez .btn{background:linear-gradient(145deg,#202345,#0d0e1c)!important;color:#f5f7ff!important;border-color:rgba(127,222,255,.35)!important;box-shadow:0 8px 22px rgba(0,0,0,.3)!important}',
      'body.theme-ajedrez .btn.primary{background:linear-gradient(135deg,#74e8ff,#8670ff)!important;color:#080a16!important;border-color:#d7fbff!important}',
      'body.theme-ajedrez .nav{z-index:70!important;background:rgba(6,7,14,.97)!important;border-top-color:rgba(129,222,255,.22)!important}',
      '.swq-vr-piece{font-size:clamp(20px,4vw,34px);color:#e9f7ff;text-shadow:0 0 8px rgba(123,226,255,.42),0 0 16px rgba(255,103,202,.16)}',
      '@keyframes swqVrChessFall{0%{opacity:0;transform:translate3d(0,-12vh,0) rotate(-10deg)}10%{opacity:.9}100%{opacity:0;transform:translate3d(var(--dx),112vh,0) rotate(18deg)}}'
    ].join('');
    document.head.appendChild(s);
  }

  function swqVREnsureLayer(id,cls){
    let el=document.getElementById(id);
    if(!el){
      el=document.createElement('div');
      el.id=id;
      el.className=cls;
      document.body.appendChild(el);
    }
    return el;
  }

  function swqVRSpawnBee(){
    const layer=swqVREnsureLayer('swqBeeFX','swq-bee-fx');
    const n=layer.querySelectorAll('.swq-vr-bee,.swq-vr-honey').length;
    if(n>=5)return;
    const now=Date.now();
    const last=Number(layer.dataset.lastSpawn||0);
    if(now-last<1350)return;
    layer.dataset.lastSpawn=String(now);
    const el=document.createElement('span');
    if(Math.random()<0.58){
      el.className='swq-vr-honey';
      el.textContent='🍯';
      el.style.left=(8+Math.random()*84)+'%';
      el.style.setProperty('--dx',((Math.random()-.5)*90)+'px');
      el.style.animation='swqVrHoneyFall '+(5.8+Math.random()*1.7)+'s linear forwards';
      setTimeout(()=>el.remove(),8000);
    }else{
      el.className='swq-vr-bee';
      el.textContent='🐝';
      el.style.top=(18+Math.random()*62)+'%';
      el.style.setProperty('--dy',(-24+Math.random()*48)+'px');
      el.style.animation='swqVrBeeFly '+(6.2+Math.random()*1.8)+'s linear forwards';
      setTimeout(()=>el.remove(),9000);
    }
    layer.appendChild(el);
  }

  function swqVRSpawnCarbon(){
    const layer=swqVREnsureLayer('swqCarbonFX','swq-carbon-fx');
    const n=layer.querySelectorAll('.swq-vr-ember').length;
    if(n>=5)return;
    const now=Date.now(),last=Number(layer.dataset.lastSpawn||0);
    if(now-last<1450)return;
    layer.dataset.lastSpawn=String(now);
    const el=document.createElement('span');
    el.className='swq-vr-ember';
    el.style.left=(6+Math.random()*88)+'%';
    el.style.setProperty('--dx',((-45+Math.random()*90))+'px');
    el.style.animation='swqVrEmber '+(5.2+Math.random()*2.2)+'s linear forwards';
    layer.appendChild(el);
    setTimeout(()=>el.remove(),8500);
  }

  function swqVRSpawnFish(){
    const layer=swqVREnsureLayer('swqLeviatanFX','swq-leviatan-fx');
    const n=layer.querySelectorAll('.swq-vr-fish').length;
    if(n>=2)return;
    const now=Date.now(),last=Number(layer.dataset.lastSpawn||0);
    if(now-last<3900)return;
    layer.dataset.lastSpawn=String(now);
    const el=document.createElement('span');
    el.className='swq-vr-fish';
    el.textContent=Math.random()<.5?'🐟':'🐠';
    el.style.top=(24+Math.random()*52)+'%';
    el.style.setProperty('--bob',((-26+Math.random()*52))+'px');
    el.style.animation='swqVrFishSwim '+(7.2+Math.random()*1.6)+'s linear forwards';
    layer.appendChild(el);
    setTimeout(()=>el.remove(),10000);
  }

  function swqVRSyncChess(){
    const theme=S?.settings?.theme;
    if(theme!=='Ajedrez'){swqVRRemove('swqChessFX');return;}
    const layer=swqVREnsureLayer('swqChessFX','swq-chess-fx');
    const pieces=['♟','♞','♜','♝','♛','♚'];
    let nodes=[...layer.querySelectorAll('.swq-vr-piece')];
    while(nodes.length>6){nodes.shift()?.remove();nodes=[...layer.querySelectorAll('.swq-vr-piece')];}
    while(nodes.length<6){
      const el=document.createElement('span');
      el.className='swq-vr-piece';
      el.textContent=pieces[nodes.length%pieces.length];
      el.style.left=(5+Math.random()*90)+'%';
      el.style.setProperty('--dx',((-55+Math.random()*110))+'px');
      el.style.animation='swqVrChessFall '+(7.5+Math.random()*3.5)+'s linear '+(-Math.random()*8)+'s both';
      layer.appendChild(el);
      nodes=[...layer.querySelectorAll('.swq-vr-piece')];
    }
  }

  function swqVRSyncTheme(){
    const theme=S?.settings?.theme;
    if(theme==='Bee'){
      swqVRSpawnBee();
      swqVRRemove('swqBeeFX')||false;
      /* recreate after cleanup only when the theme is still Bee */
      const layer=swqVREnsureLayer('swqBeeFX','swq-bee-fx');
      if(!layer.dataset.ready)layer.dataset.ready='1';
      swqVRSpawnBee();
    }else{
      swqVRRemove('swqBeeFX');
    }
    if(theme==='Carbon'){swqVRSpawnCarbon();}else swqVRRemove('swqCarbonFX');
    if(theme==='Leviatan'){swqVRSpawnFish();}else swqVRRemove('swqLeviatanFX');
    swqVRSyncChess();
  }

  function swqVRSyncThemeFixed(){
    const theme=S?.settings?.theme;
    if(theme==='Bee'){
      const layer=swqVREnsureLayer('swqBeeFX','swq-bee-fx');
      swqVRSpawnBeeLayer(layer);
    }else swqVRRemove('swqBeeFX');
    if(theme==='Carbon'){swqVRSpawnCarbon();}
    else swqVRRemove('swqCarbonFX');
    if(theme==='Leviatan'){swqVRSpawnFish();}
    else swqVRRemove('swqLeviatanFX');
    swqVRSyncChess();
  }

  function swqVRSpawnBeeLayer(layer){
    const n=layer.querySelectorAll('.swq-vr-bee,.swq-vr-honey').length;
    if(n>=5)return;
    const now=Date.now(),last=Number(layer.dataset.lastSpawn||0);
    if(now-last<1350)return;
    layer.dataset.lastSpawn=String(now);
    const el=document.createElement('span');
    if(Math.random()<0.58){
      el.className='swq-vr-honey';
      el.textContent='🍯';
      el.style.left=(8+Math.random()*84)+'%';
      el.style.setProperty('--dx',((Math.random()-.5)*90)+'px');
      el.style.animation='swqVrHoneyFall '+(5.8+Math.random()*1.7)+'s linear forwards';
      layer.appendChild(el);
      setTimeout(()=>el.remove(),8000);
    }else{
      const rightToLeft=Math.random()<0.75;
      el.className='swq-vr-bee '+(rightToLeft?'swq-vr-bee-rtl':'swq-vr-bee-ltr');
      el.textContent='🐝';
      el.style.top=(18+Math.random()*62)+'%';
      el.style.setProperty('--dy',(-24+Math.random()*48)+'px');
      el.style.animation=(rightToLeft?'swqVrBeeFlyReverse':'swqVrBeeFlyForward')+' '+(4.4+Math.random()*1.6)+'s linear forwards';
      layer.appendChild(el);
      setTimeout(()=>el.remove(),7200);
    }
  }

  swqVRStyle();

  try{
    const baseSpawnThemeParticleVR=spawnThemeParticle;
    spawnThemeParticle=function(){
      const theme=S?.settings?.theme;
      if(theme==='Bee'){swqVRSpawnBeeLayer(swqVREnsureLayer('swqBeeFX','swq-bee-fx'));return;}
      if(theme==='Carbon'){swqVRSpawnCarbon();return;}
      return baseSpawnThemeParticleVR.apply(this,arguments);
    };
  }catch(e){}

  try{
    const baseApplyThemeVR=applyTheme;
    applyTheme=function(){
      const out=baseApplyThemeVR.apply(this,arguments);
      swqVRSyncThemeFixed();
      return out;
    };
  }catch(e){}

  setInterval(()=>{try{swqVRSyncThemeFixed();}catch(e){}},1100);
  try{swqVRSyncThemeFixed();}catch(e){}
})();


/* === SWQ SAFE REPAIR 2026-09-19 === */
(function(){
  'use strict';
  if(window.__SWQ_SAFE_REPAIR_20260919__)return;
  window.__SWQ_SAFE_REPAIR_20260919__=true;

  /* Daily reward boost: prioritizes XP and never rewrites an already claimed reward. */
  try{
    const baseDailyRewardInfo=dailyRewardInfo;
    dailyRewardInfo=function(){
      const out=baseDailyRewardInfo.apply(this,arguments);
      try{
        const d=S.dailyReward||{};
        const today=typeof localDateKey==='function'?localDateKey():'';
        if(d.date===today&&d.kind==='coinsxp'&&!d.claimed&&!d.__swqDailyBoost20260919){
          d.coins=60+Math.floor(Math.random()*181);
          d.xp=250+Math.floor(Math.random()*551);
          d.__swqDailyBoost20260919=true;
          save();
        }
        if(d.kind==='coinsxp'&&out?.reward){
          out.reward={...out.reward,coins:Number(d.coins||0),xp:Number(d.xp||0),kind:'coinsxp',themeKey:'',label:`${fmt(d.coins)} 🪙 + ${fmt(d.xp)} XP`};
        }
      }catch(e){}
      return out;
    };
  }catch(e){console.warn('SWQ daily reward repair',e)}

  /* Bee: reverse only the custom foreground bee layer from the stable visual patch. */
  try{
    const style=document.getElementById('swq-visual-repair-css');
    if(style){
      style.textContent += [
        '.swq-vr-bee-rtl{left:auto!important;right:-70px!important}',
        '.swq-vr-bee-ltr{left:-70px!important;right:auto!important}',
        '@keyframes swqVrBeeFlyReverse{0%{opacity:0;transform:translate3d(0,0,0) scaleX(-1) rotate(7deg)}10%{opacity:.94}42%{transform:translate3d(-45vw,var(--dy),0) scaleX(-1) rotate(-7deg)}72%{transform:translate3d(-82vw,calc(var(--dy) * .55),0) scaleX(-1) rotate(5deg)}100%{opacity:0;transform:translate3d(-118vw,calc(var(--dy) * .2),0) scaleX(-1) rotate(-4deg)}}',
        '@keyframes swqVrBeeFlyForward{0%{opacity:0;transform:translate3d(0,0,0) scaleX(1) rotate(-7deg)}10%{opacity:.94}42%{transform:translate3d(45vw,var(--dy),0) scaleX(1) rotate(7deg)}72%{transform:translate3d(82vw,calc(var(--dy) * .55),0) scaleX(1) rotate(-5deg)}100%{opacity:0;transform:translate3d(118vw,calc(var(--dy) * .2),0) scaleX(1) rotate(4deg)}}',
        '.swq-vr-bee{left:auto!important;right:auto!important}',
        '.swq-vr-bee-rtl{animation-name:swqVrBeeFlyReverse!important}',
        '.swq-vr-bee-ltr{animation-name:swqVrBeeFlyForward!important}'
      ].join('');
    }
  }catch(e){console.warn('SWQ Bee repair',e)}

  try{save();render();}catch(e){}
})();


/* === SWQ BALANCE REPAIR 2026-09-20 === */
(function(){
  'use strict';
  if(window.__SWQ_BALANCE_REPAIR_20260920__)return;
  window.__SWQ_BALANCE_REPAIR_20260920__=true;

  /* Daily reward: intentionally below the normal roulette. Already-claimed rewards are never changed. */
  try{
    const previousDailyRewardInfo=dailyRewardInfo;
    dailyRewardInfo=function(){
      const out=previousDailyRewardInfo.apply(this,arguments);
      try{
        const d=S.dailyReward||{};
        const today=typeof localDateKey==='function'?localDateKey():'';
        if(d.date===today&&d.kind==='coinsxp'&&!d.claimed&&!d.__swqDailyNerf20260920){
          d.coins=20+Math.floor(Math.random()*41); // 20–60
          d.xp=40+Math.floor(Math.random()*111);   // 40–150
          d.__swqDailyNerf20260920=true;
          save();
        }
        if(d.kind==='coinsxp'&&out?.reward){
          out.reward={
            ...out.reward,
            coins:Number(d.coins||0),
            xp:Number(d.xp||0),
            kind:'coinsxp',
            themeKey:'',
            label:`${fmt(d.coins)} 🪙 + ${fmt(d.xp)} XP`
          };
        }
      }catch(e){}
      return out;
    };
  }catch(e){console.warn('SWQ daily balance repair',e)}

  /* Extreme bubbles: shorter window, faster spawns/expiration, and a larger reward cap. */
  try{
    if(typeof MINI_LEVELS!=='undefined'&&MINI_LEVELS.extremo){
      MINI_LEVELS.extremo.time=18;
      MINI_LEVELS.extremo.lifetime=520;
      MINI_LEVELS.extremo.spawn=250;
      MINI_LEVELS.extremo.rewardMax=90;
      MINI_LEVELS.extremo.desc='Solo 18 s. Las burbujas aparecen y desaparecen todavía más rápido, pero cada partida puede pagar hasta 90 🪙.';
    }
  }catch(e){console.warn('SWQ extreme balance repair',e)}

  /* Extreme mode also awards extra score per bubble, compensating for the shorter round. */
  try{
    if(!window.__swqExtremeScoreBonus20260920){
      document.addEventListener('click',function(e){
        try{
          if(typeof miniGameDifficulty==='undefined'||miniGameDifficulty!=='extremo')return;
          if(typeof miniGameRunning==='undefined'||!miniGameRunning)return;
          const bubble=e.target?.closest?.('.mini-bubble');
          if(!bubble)return;
          miniGameScore+=2;
          const scoreEl=$('miniScore');
          if(scoreEl)scoreEl.textContent=miniGameScore;
        }catch(err){}
      },true);
      window.__swqExtremeScoreBonus20260920=true;
    }
  }catch(e){console.warn('SWQ extreme score repair',e)}

  try{save();render();}catch(e){}
})();


/* === SWQ PEAR EX DUMP 2026-09-20 === */
(function(){
  'use strict';
  if(window.__SWQ_PEAR_EX_DUMP_20260920__)return;
  window.__SWQ_PEAR_EX_DUMP_20260920__=true;

  /* Restore the requested 22 s round for Extreme while keeping its faster spawn/lifetime settings. */
  try{
    if(typeof MINI_LEVELS!=='undefined'&&MINI_LEVELS.extremo){
      MINI_LEVELS.extremo.time=22;
    }
  }catch(e){console.warn('SWQ extreme duration restore',e)}

  const SWQ_EX_PEAR_TOPIC={
    id:'tema12',
    title:'Mi ex me dejó',
    lines:[
      {speaker:'👤 TÚ',text:'Pera... mi ex me dejó y todavía me cuesta dejar de pensar en eso.'},
      {speaker:'🍐 PERA',text:'Ah. El famoso “me dejaron y ahora mi cerebro decidió repetir la película 400 veces”. Qué gran función de la mente humana.'},
      {speaker:'👤 TÚ',text:'A veces estoy bien y de repente recuerdo todo otra vez.'},
      {speaker:'🍐 PERA',text:'Normal. Superarlo no es borrar a alguien con una goma de borrar. Es ir haciendo que ocupe menos espacio en tu cabeza.'},
      {speaker:'👤 TÚ',text:'¿Y cómo hago para avanzar?'},
      {speaker:'🍐 PERA',text:'Como en natación: no pasas una piscina mirando fijamente el muro de salida. Respiras, haces tu brazada y sigues hacia el otro extremo.'},
      {speaker:'👤 TÚ',text:'Pero todavía hay días en los que me siento bastante mal.'},
      {speaker:'🍐 PERA',text:'Pues algunos días nadas suave. No tienes que romper tu récord emocional todos los días, campeón.'},
      {speaker:'👤 TÚ',text:'Eso sonó sorprendentemente útil para una pera.'},
      {speaker:'🍐 PERA',text:'Tengo mucha experiencia. He sobrevivido a una tienda, a una banana y ahora a tus problemas amorosos. Soy prácticamente Coach Mati con semillas.'},
      {speaker:'👤 TÚ',text:'Entonces supongo que tengo que dejar de mirar hacia atrás todo el tiempo.'},
      {speaker:'🍐 PERA',text:'Exacto. Mira el carril que tienes delante. Puedes extrañar a alguien y aun así seguir avanzando.'},
      {speaker:'👤 TÚ',text:'¿Y si vuelvo a pensar en mi ex mañana?'},
      {speaker:'🍐 PERA',text:'Respiras, lo notas y vuelves a nadar. Un pensamiento no tiene por qué convertirse en una vuelta completa.'},
      {speaker:'👤 TÚ',text:'Creo que necesitaba escuchar eso.'},
      {speaker:'🍐 PERA',text:'Entonces quédate con esto: no necesitas olvidar de golpe. Solo necesitas seguir avanzando, una brazada a la vez.'}
    ]
  };

  try{
    if(typeof PEAR_TOPIC_DIALOGUES!=='undefined'&&Array.isArray(PEAR_TOPIC_DIALOGUES)){
      const i=PEAR_TOPIC_DIALOGUES.findIndex(x=>x.id===SWQ_EX_PEAR_TOPIC.id);
      if(i<0)PEAR_TOPIC_DIALOGUES.push(SWQ_EX_PEAR_TOPIC);
      else PEAR_TOPIC_DIALOGUES[i]=SWQ_EX_PEAR_TOPIC;
    }
  }catch(e){console.warn('SWQ Pera ex dialogue',e)}

  try{save();render();}catch(e){}
})();

/* === SWQ ACCOUNT TERMS 2026-09-20 === */
(function(){
  'use strict';
  if(window.__SWQ_ACCOUNT_TERMS_20260920__)return;
  window.__SWQ_ACCOUNT_TERMS_20260920__=true;

  function swqPasswordStrength(password){
    const p=String(password||'');
    let score=0;
    if(p.length>=8)score++;
    if(p.length>=12)score++;
    if(/[a-z]/.test(p)&&/[A-Z]/.test(p))score++;
    if(/\d/.test(p))score++;
    if(/[^A-Za-z0-9]/.test(p))score++;
    return score;
  }
  function swqPasswordLabel(password){
    const s=swqPasswordStrength(password);
    if(!password)return {text:'Usa 8 caracteres o más.',cls:'pw-empty'};
    if(s<=1)return {text:'Contraseña débil',cls:'pw-bad'};
    if(s<=3)return {text:'Contraseña aceptable',cls:'pw-mid'};
    return {text:'Contraseña fuerte',cls:'pw-good'};
  }
  function swqTermsButton(){
    return '<button class="btn secondary" style="margin-top:8px" onclick="conditionsOfUse()">📜 Condiciones de uso</button>';
  }

  window.conditionsOfUse=function(){
    modal(
      '<div class="kicker">📜 CONDICIONES DE USO</div>'+
      '<h2>Antes de usar Swim Quest</h2>'+
      '<div class="sub" style="margin-bottom:10px">Estas reglas explican cómo usar el juego, las cuentas y los datos de forma responsable.</div>'+
      '<div class="list">'+
        '<div class="list-item"><b>1. Honestidad</b><div class="sub">Los registros dependen de ti. Introduce metros, tiempos, estilos y resultados de forma honesta. Swim Quest no puede saber si un dato es real: depende de tu honestidad.</div></div>'+
        '<div class="list-item"><b>2. Juego limpio</b><div class="sub">No intentes explotar errores para conseguir monedas, XP, rangos, objetos o ventajas. Si encuentras un fallo, lo correcto es avisar y no convertirlo en una máquina de monedas.</div></div>'+
        '<div class="list-item"><b>3. Tu cuenta</b><div class="sub">Mantén tu correo y contraseña bajo tu control. No compartas tu contraseña. La autenticación y las contraseñas se gestionan mediante Supabase; Swim Quest no guarda tu contraseña en el progreso local.</div></div>'+
        '<div class="list-item"><b>4. Datos y sincronización</b><div class="sub">Sin cuenta, el progreso se guarda localmente. Con cuenta, parte del progreso se sincroniza con Supabase. Ningún sistema online puede prometer que jamás habrá errores o interrupciones, así que las copias de seguridad siguen siendo buena idea.</div></div>'+
        '<div class="list-item"><b>5. Redes y otros jugadores</b><div class="sub">No uses las funciones sociales para acosar, amenazar, suplantar a otra persona, compartir información privada o molestar deliberadamente.</div></div>'+
        '<div class="list-item"><b>6. Contenido y propiedad</b><div class="sub">No presentes como tuyo el código, arte, textos o sistemas de Swim Quest que pertenecen al proyecto. Tampoco subas contenido de otras personas como si fuera tuyo.</div></div>'+
        '<div class="list-item"><b>7. Entrenamiento</b><div class="sub">Swim Quest es un registro y un juego, no un médico ni un entrenador personal. Usa criterio y sigue las indicaciones de tu familia, entrenador y profesionales que correspondan.</div></div>'+
        '<div class="list-item"><b>8. Cambios del juego</b><div class="sub">Los precios, rangos, recompensas, música, misiones y sistemas pueden cambiar para equilibrar el juego o corregir errores. Tu progreso no es un contrato mágico con la pera.</div></div>'+
        '<div class="list-item"><b>9. Servicios externos</b><div class="sub">Algunas funciones dependen de servicios como Supabase, el navegador y el correo electrónico. Si uno de ellos falla, algunas funciones online pueden dejar de funcionar temporalmente.</div></div>'+
        '<div class="list-item"><b>10. Seguridad</b><div class="sub">Usa una contraseña que no reutilices en otros sitios. Si recibes un correo de recuperación que no solicitaste, no compartas enlaces o códigos con nadie.</div></div>'+
        '<div class="list-item"><b>11. No hagas trampas... demasiado creativas</b><div class="sub">Registrar “50 m” después de sentarte en el borde cuenta como una interpretación muy libre de la natación. La Pera no lo considera récord.</div></div>'+
        '<div class="list-item"><b>12. Humor</b><div class="sub">Algunas condiciones contienen bromas. No cambian las reglas reales y no pretenden atacar a ninguna persona o grupo.</div></div>'+
        '<div class="list-item"><b>13. Responsabilidad</b><div class="sub">Usas Swim Quest bajo tu propia responsabilidad. El proyecto se ofrece como una herramienta de registro y entretenimiento y puede contener errores.</div></div>'+
        '<div class="list-item"><b>14. Aceptación</b><div class="sub">Al usar Swim Quest aceptas estas condiciones. Si no estás de acuerdo, puedes cerrar la aplicación y no usar sus funciones.</div></div>'+
      '</div>'+
      '<button class="btn primary" style="margin-top:10px" onclick="closeModal()">Entendido</button>'
    );
  };

  try{
    if(typeof onboarding==='function'&&!window.__swqOnboardingTerms20260920){
      const baseOnboarding=onboarding;
      onboarding=function(){
        let html=baseOnboarding.apply(this,arguments);
        const extra=[
          'No binario','Género fluido','Agénero','Bigénero','Demigénero',
          'Andrógino','Neutrois','Género no conforme','En cuestionamiento','Helicoptero se batalla'
        ].map(x=>'<option>'+x+'</option>').join('');
        html=html.replace('<option>Otro</option>','<option>Otro</option>'+extra);
        html=html.replace('<button class="btn primary" onclick="createProfile()">Comenzar →</button>','<button class="btn secondary" onclick="conditionsOfUse()">📜 Condiciones de uso</button><button class="btn primary" style="margin-top:8px" onclick="createProfile()">Comenzar →</button>');
        return html;
      };
      window.__swqOnboardingTerms20260920=true;
    }
  }catch(e){console.warn('SWQ onboarding terms',e)}

  try{
    if(typeof home==='function'&&!window.__swqHomeTerms20260920){
      const baseHome=home;
      home=function(){
        return baseHome.apply(this,arguments)+'<div class="list-item" style="margin-top:10px"><div class="row"><span><b>📜 Condiciones</b><div class="sub">Reglas de uso, cuentas y juego limpio.</div></span><button class="btn secondary" style="width:auto" onclick="conditionsOfUse()">Leer</button></div></div>';
      };
      window.__swqHomeTerms20260920=true;
    }
  }catch(e){console.warn('SWQ home terms',e)}

  try{
    if(typeof profile==='function'&&!window.__swqProfileTerms20260920){
      const baseProfile=profile;
      profile=function(){
        let html=baseProfile.apply(this,arguments);
        html+='<div class="list-item" style="margin-top:10px"><div class="row"><span><b>📜 Condiciones de uso</b><div class="sub">Reglas de cuentas, datos y juego limpio.</div></span><button class="btn secondary" style="width:auto" onclick="conditionsOfUse()">Leer</button></div></div>';
        if(authUser)html+='<div class="list-item" style="margin-top:8px"><div class="row"><span><b>🔐 Seguridad de cuenta</b><div class="sub">Cambia tu contraseña cuando lo necesites.</div></span><button class="btn secondary" style="width:auto" onclick="changeAccountPassword()">Cambiar</button></div></div>';
        return html;
      };
      window.__swqProfileTerms20260920=true;
    }
  }catch(e){console.warn('SWQ profile terms',e)}

  try{
    if(typeof shop==='function'&&!window.__swqShopText20260920){
      const baseShop=shop;
      shop=function(){
        return baseShop.apply(this,arguments).replace('Todo está organizado para que encuentres rápido lo que buscas.','');
      };
      window.__swqShopText20260920=true;
    }
  }catch(e){}

  try{
    const css=document.createElement('style');
    css.id='swq-terms-account-css';
    css.textContent=[
      '.brand>.sub{display:none!important}',
      '.swq-pw-hint{font-size:10px;margin-top:5px;min-height:15px;color:var(--muted)}',
      '.swq-pw-hint.pw-bad{color:#ff7d94}.swq-pw-hint.pw-mid{color:#ffd166}.swq-pw-hint.pw-good{color:#61efaa}'
    ].join('');
    document.head.appendChild(css);
  }catch(e){}

  try{
    if(typeof authModal==='function'&&!window.__swqAuthModal20260920){
      const baseAuthModal=authModal;
      authModal=function(mode){
        const out=baseAuthModal.apply(this,arguments);
        const signup=mode==='signup';
        setTimeout(()=>{
          const host=document.querySelector('#modal .modal');
          const input=document.getElementById('authPassword');
          if(input){
            input.minLength=8;
            input.autocomplete=signup?'new-password':'current-password';
            let hint=document.getElementById('swqPwHint');
            if(!hint){
              hint=document.createElement('div');
              hint.id='swqPwHint';
              hint.className='swq-pw-hint';
              input.parentElement?.appendChild(hint);
            }
            const paint=()=>{
              const info=swqPasswordLabel(input.value);
              hint.textContent=info.text;
              hint.className='swq-pw-hint '+info.cls;
            };
            input.addEventListener('input',paint);
            paint();
          }
          if(host){
            const buttons=[...host.querySelectorAll('button')];
            if(signup&&!host.querySelector('[data-terms-account]')){
              const b=document.createElement('button');
              b.className='btn secondary';
              b.style.marginTop='8px';
              b.dataset.termsAccount='1';
              b.textContent='📜 Leer condiciones de uso';
              b.onclick=conditionsOfUse;
              const close=buttons.find(x=>x.textContent.trim()==='Cerrar');
              close?host.insertBefore(b,close):host.appendChild(b);
            }
            if(!signup&&!host.querySelector('[data-resend-confirm]')){
              const b=document.createElement('button');
              b.className='btn secondary';
              b.style.marginTop='8px';
              b.dataset.resendConfirm='1';
              b.textContent='📩 Reenviar confirmación';
              b.onclick=resendSignupConfirmation;
              const close=buttons.find(x=>x.textContent.trim()==='Cerrar');
              close?host.insertBefore(b,close):host.appendChild(b);
            }
          }
        },0);
        return out;
      };
      window.__swqAuthModal20260920=true;
    }
  }catch(e){console.warn('SWQ auth modal',e)}

  window.resendSignupConfirmation=async function(){
    if(!supabaseReady()){toast('Supabase todavía no está disponible.');return}
    const email=document.getElementById('authEmail')?.value.trim();
    if(!email){toast('Introduce tu correo primero.');return}
    try{
      const {error}=await supabaseClient.auth.resend({
        type:'signup',
        email,
        options:{emailRedirectTo:window.location.origin+window.location.pathname}
      });
      if(error)throw error;
      toast('📩 Correo de confirmación reenviado.',4200);
    }catch(e){toast('❌ No se pudo reenviar el correo.',4200)}
  };

  window.changeAccountPassword=function(){
    if(!authUser||!supabaseReady()){toast('Inicia sesión para cambiar la contraseña.');return}
    modal(
      '<div class="kicker">🔐 SEGURIDAD</div>'+
      '<h2>Cambiar contraseña</h2>'+
      '<div class="field"><label>Nueva contraseña</label><input id="accountNewPassword" type="password" minlength="8" autocomplete="new-password" placeholder="Mínimo 8 caracteres"><div id="accountPwHint" class="swq-pw-hint pw-empty">Usa 8 caracteres o más.</div></div>'+
      '<div class="field"><label>Repetir contraseña</label><input id="accountNewPassword2" type="password" minlength="8" autocomplete="new-password"></div>'+
      '<button class="btn primary" onclick="saveAccountPassword()">Guardar contraseña</button>'+
      '<button class="btn secondary" style="margin-top:8px" onclick="closeModal()">Cerrar</button>'
    );
    const input=document.getElementById('accountNewPassword');
    if(input)input.addEventListener('input',()=>{
      const info=swqPasswordLabel(input.value);
      const h=document.getElementById('accountPwHint');
      if(h){h.textContent=info.text;h.className='swq-pw-hint '+info.cls;}
    });
  };
  window.saveAccountPassword=async function(){
    const a=document.getElementById('accountNewPassword')?.value||'';
    const b=document.getElementById('accountNewPassword2')?.value||'';
    if(a.length<8||swqPasswordStrength(a)<2||a!==b){toast('Usa una contraseña de al menos 8 caracteres y confirma que coincida.',4200);return}
    if(!supabaseReady()||!authUser){toast('Tu sesión ya no está disponible.');return}
    try{
      const {error}=await supabaseClient.auth.updateUser({password:a});
      if(error)throw error;
      closeModal();
      toast('✅ Contraseña actualizada.',4200);
    }catch(e){toast('❌ No se pudo actualizar la contraseña.',4200)}
  };

  try{
    if(typeof signUpReal==='function'&&!window.__swqSignupStrength20260920){
      const baseSignUp=signUpReal;
      signUpReal=async function(){
        const pw=document.getElementById('authPassword')?.value||'';
        if(pw.length<8||swqPasswordStrength(pw)<2){toast('Usa una contraseña de al menos 8 caracteres con mejor variedad.',4200);return}
        return baseSignUp.apply(this,arguments);
      };
      window.__swqSignupStrength20260920=true;
    }
  }catch(e){}

  try{
    if(typeof changeRecoveredPassword==='function'&&!window.__swqRecoveryStrength20260920){
      const baseRecovery=changeRecoveredPassword;
      changeRecoveredPassword=async function(){
        const pw=document.getElementById('newPassword')?.value||'';
        if(pw.length<8||swqPasswordStrength(pw)<2){toast('Usa una contraseña de al menos 8 caracteres.',4200);return}
        return baseRecovery.apply(this,arguments);
      };
      window.__swqRecoveryStrength20260920=true;
    }
  }catch(e){}

  /* New original horror-chiptune music: high register, tense intervals, no copied FNAF melody. */
  try{
    if(typeof MUSIC_TRACKS!=='undefined'){
      MUSIC_TRACKS.frecuenciaPerdida={
        name:'FNAF reference',
        emoji:'🕯️',
        notes:[659.25,622.25,659.25,783.99,698.46,659.25,587.33,523.25,659.25,698.46,830.61,783.99],
        bass:[82.41,77.78,87.31,73.42],
        tempo:430,
        type:'triangle',
        accent:3
      };
    }
    if(typeof SHOP!=='undefined'&&!SHOP.some(x=>x.id==='music4')){
      SHOP.push({
        id:'music4',
        icon:'🕯️',
        name:'FNAF reference',
        price:330,
        desc:'Música original de terror con tono agudo y ambiente de videojuego de supervivencia.',
        buy:()=>S.purchases.music4=true
      });
    }
    if(typeof SHOP_PERMANENT_IDS!=='undefined')SHOP_PERMANENT_IDS.add('music4');
  }catch(e){console.warn('SWQ music4',e)}

  try{
    if(typeof shopMusicCandidates==='function'&&!window.__swqMusic4Candidates20260920){
      const baseShopMusic=shopMusicCandidates;
      shopMusicCandidates=function(){
        const list=baseShopMusic.apply(this,arguments);
        if(!list.some(x=>x.id==='music4')&&!S.purchases.music4&&MUSIC_TRACKS.frecuenciaPerdida)list.push({id:'music4',key:'frecuenciaPerdida'});
        return list;
      };
      window.__swqMusic4Candidates20260920=true;
    }
  }catch(e){}

  try{
    if(typeof buy==='function'&&!window.__swqMusic4Buy20260920){
      const baseBuy=buy;
      buy=function(id){
        if(id==='music4'&&S.purchases.music4){toast('✅ Ya tienes esta música.');return}
        return baseBuy.apply(this,arguments);
      };
      window.__swqMusic4Buy20260920=true;
    }
  }catch(e){}

  try{save();render();}catch(e){}
})();

/* === SWQ THEME BUTTON FIX 2026-09-20 === */
(function(){
  'use strict';
  if(window.__SWQ_THEME_BUTTON_FIX_20260920__)return;
  window.__SWQ_THEME_BUTTON_FIX_20260920__=true;

  try{
    if(typeof swqApplyQuickTheme==='function')window.swqApplyQuickTheme=swqApplyQuickTheme;
    if(typeof swqQuickTheme==='function')window.swqQuickTheme=swqQuickTheme;
  }catch(e){}

  try{
    if(typeof profile==='function'&&!window.__swqProfileThemeButton20260920){
      const baseProfileThemeFix=profile;
      profile=function(){
        let html=baseProfileThemeFix.apply(this,arguments);
        if(!html.includes('swqQuickThemeButton')){
          html+='<div class="list-item swq-theme-entry" style="margin-top:10px"><div class="row"><span><b>🎨 Estilo</b><div class="sub">Cambia el estilo visual sin salir del perfil.</div></span><button id="swqQuickThemeButton" class="btn secondary" style="width:auto" type="button" onclick="window.swqQuickTheme()">Cambiar</button></div></div>';
        }
        return html;
      };
      window.__swqProfileThemeButton20260920=true;
    }
  }catch(e){console.warn('SWQ profile theme button',e)}

  try{
    if(typeof swqQuickTheme==='function'&&!window.__swqQuickThemeGlobal20260920){
      window.swqQuickTheme=swqQuickTheme;
      window.__swqQuickThemeGlobal20260920=true;
    }
    if(typeof swqApplyQuickTheme==='function'&&!window.__swqApplyQuickThemeGlobal20260920){
      window.swqApplyQuickTheme=swqApplyQuickTheme;
      window.__swqApplyQuickThemeGlobal20260920=true;
    }
  }catch(e){console.warn('SWQ theme globals',e)}
})();

/* === SWQ THEME MUSIC UI FIX 2026-09-20 === */
(function(){
  'use strict';
  if(window.__SWQ_THEME_MUSIC_UI_FIX_20260920__)return;
  window.__SWQ_THEME_MUSIC_UI_FIX_20260920__=true;

  function swqOwnedMusicKeys(){
    const out=[];
    try{
      if(typeof MUSIC_TRACKS!=='undefined'){
        for(const [k,v] of Object.entries(MUSIC_TRACKS)){
          const owned=k==='aqua'
            ||(k==='marea'&&!!S.purchases?.music1)
            ||(k==='cosmos'&&!!S.purchases?.music2)
            ||(k==='pixel'&&!!S.purchases?.music3)
            ||(k==='frecuenciaPerdida'&&!!S.purchases?.music4);
          if(owned)out.push([k,v]);
        }
      }
    }catch(e){}
    return out;
  }

  function swqOwnedThemeKeys(){
    const out=['Aqua'];
    try{
      if(typeof THEMES!=='undefined'){
        Object.keys(THEMES).forEach(k=>{if(k!=='Aqua'&&S.purchases?.['theme_'+k])out.push(k)});
      }
    }catch(e){}
    return [...new Set(out)];
  }

  function swqApplyThemeDirect(k){
    try{
      if(typeof THEMES==='undefined'||!THEMES[k])return;
      if(k!=='Aqua'&&!S.purchases?.['theme_'+k]){toast('🔒 Ese estilo todavía no está desbloqueado.');return}
      S.settings.theme=k;
      save();
      if(typeof applyTheme==='function')applyTheme();
      closeModal();
      render();
    }catch(e){console.warn('SWQ direct theme',e)}
  }

  function swqApplyMusicDirect(k){
    try{
      if(typeof MUSIC_TRACKS==='undefined'||!MUSIC_TRACKS[k])return;
      const owned=swqOwnedMusicKeys().some(([id])=>id===k);
      if(!owned){toast('🔒 Esa música todavía no está desbloqueada.');return}
      S.settings.musicTrack=k;
      save();
      if(S.settings.music&&typeof restartAmbient==='function')restartAmbient();
      toast('🎵 '+(MUSIC_TRACKS[k]?.name||'Música')+' equipada.');
      swqOpenThemeMusicModal('music');
    }catch(e){console.warn('SWQ direct music',e)}
  }

  function swqOpenThemeMusicModal(tab='theme'){
    try{
      const themes=swqOwnedThemeKeys();
      const music=swqOwnedMusicKeys();
      const themeButtons=themes.map(k=>{
        const active=S.settings.theme===k;
        const emoji=THEMES[k]?.emoji||'🎨';
        const name=(typeof swqThemeName==='function'?swqThemeName(k):k);
        return '<button type="button" class="btn '+(active?'primary':'secondary')+' swq-theme-choice" data-swq-theme="'+esc(k)+'" style="min-height:54px;text-align:left">'+esc(emoji)+' '+esc(name)+(active?' · ACTUAL':'')+'</button>';
      }).join('');
      const musicOptions=music.map(([k,v])=>'<option value="'+esc(k)+'" '+(S.settings.musicTrack===k?'selected':'')+'>'+esc(v.emoji||'🎵')+' '+esc(v.name||k)+'</option>').join('');

      modal(
        '<div class="kicker">🎨 PERSONALIZACIÓN</div>'+
        '<h2 style="margin-bottom:8px">Estilo y música</h2>'+
        '<div class="grid g2" style="margin-top:4px">'+
          '<button type="button" id="swqThemeTab" class="btn '+(tab==='theme'?'primary':'secondary')+'">🎨 Estilo</button>'+
          '<button type="button" id="swqMusicTab" class="btn '+(tab==='music'?'primary':'secondary')+'">🎵 Música</button>'+
        '</div>'+
        '<div id="swqThemePanel" style="'+(tab==='theme'?'':'display:none;')+'">'+
          '<div class="sub" style="margin:9px 0 8px">Elige un estilo desbloqueado.</div>'+
          '<div class="grid g2">'+themeButtons+'</div>'+
        '</div>'+
        '<div id="swqMusicPanel" style="'+(tab==='music'?'':'display:none;')+'">'+
          '<div class="field" style="margin-top:10px"><label>Música equipada</label><select id="swqMusicSelect" style="width:100%">'+musicOptions+'</select></div>'+
          '<label class="checkrow" style="margin:8px 0"><input id="swqMusicEnabled" type="checkbox" '+(S.settings.music?'checked':'')+'> 🎵 Música activa</label>'+
          '<button type="button" id="swqApplyMusicBtn" class="btn primary" style="margin-top:8px">Usar música</button>'+
        '</div>'+
        '<button type="button" id="swqCloseThemeMusic" class="btn secondary" style="margin-top:10px">Cerrar</button>'
      );

      document.getElementById('swqThemeTab')?.addEventListener('click',()=>swqOpenThemeMusicModal('theme'));
      document.getElementById('swqMusicTab')?.addEventListener('click',()=>swqOpenThemeMusicModal('music'));
      document.getElementById('swqCloseThemeMusic')?.addEventListener('click',()=>closeModal());

      document.querySelectorAll('#swqThemePanel .swq-theme-choice').forEach(btn=>{
        btn.addEventListener('click',()=>swqApplyThemeDirect(btn.dataset.swqTheme||'Aqua'));
      });

      document.getElementById('swqApplyMusicBtn')?.addEventListener('click',()=>{
        const key=document.getElementById('swqMusicSelect')?.value||'aqua';
        const enabled=!!document.getElementById('swqMusicEnabled')?.checked;
        S.settings.music=enabled;
        swqApplyMusicDirect(key);
        save();
        if(!enabled&&typeof ambientStop==='function')ambientStop();
      });
    }catch(e){console.warn('SWQ theme/music modal',e)}
  }

  window.swqQuickTheme=()=>swqOpenThemeMusicModal('theme');
  window.swqQuickMusic=()=>swqOpenThemeMusicModal('music');
  window.swqApplyQuickTheme=swqApplyThemeDirect;

  try{
    if(typeof profile==='function'&&!window.__swqProfileThemeMusic20260920){
      const baseProfileThemeMusic=profile;
      profile=function(){
        let html=baseProfileThemeMusic.apply(this,arguments);
        html=html.replace("<div class=\"list-item swq-theme-entry\" style=\"margin-top:10px\"><div class=\"row\"><span><b>🎨 Estilo</b><div class=\"sub\">Cambia el estilo visual sin salir del perfil.</div></span><button id=\"swqQuickThemeButton\" class=\"btn secondary\" style=\"width:auto\" type=\"button\" onclick=\"window.swqQuickTheme()\">Cambiar</button></div></div>",'');

        const controls=
          '<div class="card swq-theme-music-card" style="margin-top:10px">'+
            '<div class="sectionTitle">🎨 PERSONALIZA</div>'+
            '<div class="grid g2" style="margin-top:8px">'+
              '<button type="button" id="swqQuickThemeButton" class="btn secondary" onclick="window.swqQuickTheme()">🎨 Cambiar estilo</button>'+
              '<button type="button" id="swqQuickMusicButton" class="btn secondary" onclick="window.swqQuickMusic()">🎵 Cambiar música</button>'+
            '</div>'+
          '</div>';
        return controls+html;
      };
      window.__swqProfileThemeMusic20260920=true;
      window.__swqRemoveLegacyThemeEntry20260920=true;
    }
  }catch(e){console.warn('SWQ profile theme/music placement',e)}

  try{
    if(typeof MUSIC_TRACKS!=='undefined'&&MUSIC_TRACKS.frecuenciaPerdida){
      MUSIC_TRACKS.frecuenciaPerdida={
        name:'FNAF reference',
        emoji:'🕯️',
        /* Original horror/game-music phrase: tense chromatic motion and a high register,
           without reproducing the melody of any FNAF soundtrack. */
        notes:[
          659.25,622.25,659.25,783.99,698.46,659.25,587.33,523.25,
          587.33,622.25,659.25,523.25,466.16,523.25,587.33,698.46,
          783.99,739.99,698.46,659.25,622.25,587.33,523.25,493.88,
          523.25,659.25,739.99,830.61,783.99,698.46,622.25,659.25
        ],
        bass:[82.41,77.78,87.31,73.42,69.3,77.78,82.41,65.41],
        tempo:300,
        type:'triangle',
        accent:4
      };
    }
  }catch(e){console.warn('SWQ FNAF reference melody',e)}
})();

/* === SWQ RESTORE + DIFFICULTY LOCK + CINEMA MUSIC 2026-09-20 === */
(function(){
  'use strict';
  if(window.__SWQ_RESTORE_DIFFICULTY_CINEMA_20260920__)return;
  window.__SWQ_RESTORE_DIFFICULTY_CINEMA_20260920__=true;

  const RANGE_STYLES={
    Prisma:{rank:'venus',rankIndex:9,price:950,icon:'🌈',name:'Prisma',desc:'Fondo oscuro con una franja de luz prismática que se desplaza lentamente.'},
    Saturno:{rank:'saturno',rankIndex:12,price:1100,icon:'🪐',name:'Saturno',desc:'Fondo oscuro, planeta central y anillos orbitantes.'},
    Tinta:{rank:'neptuno',rankIndex:14,price:1300,icon:'🖋️',name:'Tinta',desc:'Azul petróleo y negro con una nube de tinta en movimiento.'},
    MareaLunar:{rank:'leviatan',rankIndex:19,price:1600,icon:'🌙',name:'Marea Lunar',desc:'Océano oscuro, luna tenue y una onda horizontal lenta.'},
    Pizarra:{rank:'poseidon',rankIndex:20,price:1900,icon:'◼️',name:'Pizarra',desc:'Grafito oscuro con cuadrícula tenue y bordes limpios.'}
  };

  function repairRangeStyles(){
    try{
      S.purchases=S.purchases||{};
      S.shopUnlocks=S.shopUnlocks||{};
      if(typeof THEMES!=='undefined')Object.entries(RANGE_STYLES).forEach(([key,t])=>{
        if(!THEMES[key])THEMES[key]={a:'#7fc7ff',b:'#1f2a5f',emoji:t.icon,desc:t.desc};
        const id='theme_'+key;
        let it=SHOP?.find?.(x=>x.id===id);
        if(!it){
          it={id,icon:t.icon,name:t.name,price:t.price,desc:t.desc,buy:()=>{S.purchases[id]=true;}};
          SHOP.push(it);
        }else{
          it.icon=t.icon;it.name=t.name;it.price=t.price;it.desc=t.desc;
        }
        if(currentRank().i>=t.rankIndex)S.shopUnlocks[id]=true;
        if(S.settings?.theme===key)S.purchases[id]=true;
      });
      const poseidonIndex=RANKS.findIndex(r=>r.c==='poseidon');
      if(currentRank().i>=poseidonIndex)S.shopUnlocks.fichaRepeticion=true;
      let rep=SHOP?.find?.(x=>x.id==='fichaRepeticion');
      if(!rep){
        rep={id:'fichaRepeticion',icon:'🔁',name:'Ficha de Repetición',price:750,desc:'Permite reclamar una segunda recompensa diaria.',buy:()=>{S.inventory.fichaRepeticion=(Number(S.inventory.fichaRepeticion)||0)+1;}};
        SHOP.push(rep);
      }
      if(SHOP_PERMANENT_IDS?.has?.('fichaRepeticion'))SHOP_PERMANENT_IDS.delete('fichaRepeticion');
      if(!Number.isFinite(Number(S.inventory?.fichaRepeticion)))S.inventory.fichaRepeticion=0;
    }catch(e){console.warn('SWQ restore range shop',e)}
  }

  /* Difficulty is calculated only when a workout is created or edited.
     Stored workouts retain their category forever afterwards. */
  function calcDifficultyLocked(e,avgOverride){
    const stored=String(e?.difficulty||'').trim();
    if(stored){
      const normalized=stored==='intenso'?'brutal':stored;
      const d=typeof difficultyForKey==='function'?difficultyForKey(normalized):DIFFICULTIES.find(x=>x.key===normalized);
      if(d&&d.key!=='facil'||normalized==='facil'){
        const meters=(e.series||[]).reduce((a,s)=>a+(Number(s.distance)||0)*(Number(s.reps)||0),0);
        const base=Math.max(100,Number(avgOverride)||Number(S.profile?.avgMeters)||1000);
        const points=(e.series||[]).reduce((a,s)=>a+(typeof difficultySeriesPoints==='function'?difficultySeriesPoints(s):(Number(s.distance)||0)*(Number(s.reps)||0)),0);
        const timed=(e.series||[]).filter(s=>Number(s.time)>0).length;
        const timedRatio=(e.series||[]).length?timed/(e.series||[]).length:0;
        const pct=meters>0?(points/base)*100*(1+Math.min(.12,timedRatio*.08)):0;
        return {...d,percent:pct,base,points:Math.round(points)};
      }
    }

    const series=Array.isArray(e?.series)?e.series:[];
    const meters=series.reduce((a,s)=>a+(Number(s.distance)||0)*(Number(s.reps)||0),0);
    if(meters<=0)return {...DIFFICULTIES[0],percent:0,base:Math.max(100,Number(avgOverride)||Number(S.profile?.avgMeters)||1000),points:0};
    const base=Math.max(100,Number(avgOverride)||Number(S.profile?.avgMeters)||1000);
    const points=series.reduce((a,s)=>a+(typeof difficultySeriesPoints==='function'?difficultySeriesPoints(s):(Number(s.distance)||0)*(Number(s.reps)||0)),0);
    const timed=series.filter(s=>Number(s.time)>0).length;
    const timedRatio=series.length?timed/series.length:0;
    const percent=(points/base)*100*(1+Math.min(.12,timedRatio*.08));
    let key='facil';
    if(percent<=19)key='facil';
    else if(percent<=49)key='normal';
    else if(percent<=110)key='brutal';
    else if(percent<450)key='demoniaco';
    else key='masoquista';
    const d=difficultyForKey(key);
    return {...d,percent,base,points:Math.round(points)};
  }

  try{
    difficultyInfo=calcDifficultyLocked;
    difficultyLabel=function(e){
      const d=typeof e==='string'?difficultyForKey(e):calcDifficultyLocked(e,S?.profile?.avgMeters);
      return d.icon+' '+d.name;
    };
    difficultyCounts=function(arr){
      return Object.fromEntries(DIFFICULTIES.map(d=>[d.key,(arr||[]).filter(e=>{
        const k=String(e?.difficulty||'intenso')==='intenso'?'brutal':String(e?.difficulty||'');
        return k===d.key;
      }).length]));
    };
  }catch(e){console.warn('SWQ frozen difficulties',e)}

  function freezeMissingDifficulties(){
    let changed=false;
    try{
      for(const e of (S.trainings||[])){
        if(e.difficulty==='intenso'){e.difficulty='brutal';changed=true;continue;}
        if(!e.difficulty){
          e.difficulty=calcDifficultyLocked({...e,difficulty:''},S.profile?.avgMeters).key;
          changed=true;
        }
      }
      if(changed)save();
    }catch(e){console.warn('SWQ freeze missing difficulty',e)}
    return changed;
  }

  function wrapRebuildWithoutDifficulty(){
    try{
      if(typeof rebuildProfile==='function'&&!window.__swqFrozenRebuild20260920){
        const base=rebuildProfile;
        rebuildProfile=function(){
          const snapshot=(S.trainings||[]).map(e=>[e,e.difficulty]);
          const out=base.apply(this,arguments);
          snapshot.forEach(([e,d])=>{if(d)e.difficulty=d;});
          save();
          return out;
        };
        window.__swqFrozenRebuild20260920=true;
      }
      if(typeof recalcAll==='function'&&!window.__swqFrozenRecalc20260920){
        const base=recalcAll;
        recalcAll=function(){
          const snapshot=(S.trainings||[]).map(e=>[e,e.difficulty]);
          const out=base.apply(this,arguments);
          snapshot.forEach(([e,d])=>{if(d)e.difficulty=d;});
          save();
          return out;
        };
        window.__swqFrozenRecalc20260920=true;
      }
    }catch(e){console.warn('SWQ frozen rebuild',e)}
  }

  function stableDifficultyDonut(arr){
    const counts=difficultyCounts(arr),entries=Object.entries(counts).filter(([,v])=>v>0);
    if(!entries.length)return '<div class="empty">Registra entrenamientos para ver la distribución.</div>';
    const total=entries.reduce((a,[,v])=>a+v,0);
    const palette={facil:'#61efaa',normal:'#42ddff',brutal:'#b78cff',demoniaco:'#ff6b86',masoquista:'#555a63',intenso:'#b78cff'};
    let angle=0;
    const stops=entries.map(([k,v])=>{
      const start=angle;angle+=v/total*360;
      return (palette[k]||'#778899')+' '+start.toFixed(3)+'deg '+angle.toFixed(3)+'deg';
    });
    const rows=entries.map(([k,v])=>{
      const d=difficultyForKey(k==='intenso'?'brutal':k);
      const pct=(v/total*100);
      return '<div class="difficulty-legend-row"><span><i style="background:'+((palette[k]||'#778899'))+'"></i>'+d.icon+' '+d.name+'</span><b>'+v+' · '+pct.toFixed(0)+'%</b></div>';
    }).join('');
    return '<div class="difficulty-donut-wrap swq-stable-difficulty-wheel"><div class="difficulty-donut" style="background:conic-gradient('+stops.join(',')+')"><div class="difficulty-donut-hole"><b>'+fmt(total)+'</b><span>sesiones</span></div></div><div class="difficulty-donut-legend">'+rows+'</div></div>';
  }
  try{difficultyDonut=stableDifficultyDonut;}catch(e){}

  /* Restore five range styles and Repetition item after account/cloud restores. */
  repairRangeStyles();
  freezeMissingDifficulties();
  wrapRebuildWithoutDifficulty();

  /* Leviathan: moving rainbow buttons + more persistent fish. */
  function leviathanFishSync(){
    let layer=document.getElementById('swqLeviatanLayer');
    if(S.settings.theme!=='Leviatan'){if(layer)layer.remove();return;}
    if(!layer){
      layer=document.createElement('div');layer.id='swqLeviatanLayer';layer.className='swq-lev-layer';document.body.appendChild(layer);
    }
    layer.style.pointerEvents='none';
    layer.style.position='fixed';
    layer.style.inset='0';
    layer.style.zIndex='46';
    layer.style.overflow='hidden';
    const fish=layer.querySelectorAll('.swq-lev-front-fish');
    if(fish.length<5){
      const f=document.createElement('span');
      f.className='swq-lev-front-fish';
      f.textContent=['🐟','🐠','🐡','🐟','🐠'][Math.floor(Math.random()*5)];
      f.style.top=(16+Math.random()*68)+'%';
      f.style.left='-15vw';
      f.style.setProperty('--bob',(-28+Math.random()*56)+'px');
      f.style.setProperty('--fishDur',(12+Math.random()*5)+'s');
      layer.appendChild(f);
      setTimeout(()=>f.remove(),18000);
    }
  }
  window.swqSyncLeviatan=leviathanFishSync;

  const cinemaTrack={
    name:'Absolute Cinema',
    emoji:'🎬',
    /* 192-note original cinematic mystery composition.
       Three movements: suspense, ascent and bright final resolution.
       No copied soundtrack melody. */
    notes:[
      880.00,830.61,783.99,739.99,698.46,659.25,739.99,830.61,
      987.77,880.00,783.99,659.25,622.25,698.46,783.99,880.00,

      1046.50,987.77,880.00,783.99,698.46,659.25,739.99,830.61,
      987.77,1108.73,987.77,880.00,783.99,739.99,659.25,587.33,

      523.25,587.33,659.25,739.99,830.61,987.77,880.00,783.99,
      698.46,739.99,830.61,987.77,1174.66,1046.50,987.77,880.00,

      783.99,659.25,587.33,698.46,830.61,987.77,1318.51,1174.66,
      1046.50,987.77,880.00,783.99,698.46,659.25,739.99,830.61,

      659.25,739.99,830.61,987.77,1174.66,1318.51,1174.66,1046.50,
      987.77,880.00,987.77,1108.73,1318.51,1396.91,1318.51,1174.66,

      987.77,1108.73,1318.51,1567.98,1396.91,1318.51,1174.66,1046.50,
      987.77,1046.50,1174.66,1318.51,1567.98,1760.00,1567.98,1396.91,

      1174.66,1318.51,1567.98,1760.00,1975.53,1760.00,1567.98,1396.91,
      1318.51,1567.98,1760.00,2093.00,1975.53,1760.00,1567.98,1396.91,

      1318.51,1174.66,1046.50,1174.66,1396.91,1567.98,1760.00,1567.98,
      1396.91,1318.51,1174.66,987.77,1108.73,1318.51,1567.98,1760.00,

      1567.98,1396.91,1174.66,1046.50,987.77,1108.73,1318.51,1567.98,
      1760.00,1975.53,2093.00,2349.32,2093.00,1975.53,1760.00,1567.98,

      1396.91,1567.98,1760.00,1975.53,1760.00,1567.98,1396.91,1318.51,
      1174.66,1046.50,987.77,880.00,987.77,1174.66,1396.91,1567.98,

      1318.51,1174.66,1046.50,987.77,880.00,739.99,830.61,987.77,
      1174.66,1396.91,1318.51,1174.66,987.77,880.00,830.61,783.99
    ],
    bass:[
      55.00,65.41,73.42,82.41,61.74,73.42,49.00,58.27,
      65.41,73.42,55.00,41.20,49.00,58.27,65.41,73.42,
      55.00,41.20,46.25,55.00,61.74,73.42,49.00,41.20,
      65.41,73.42,82.41,98.00,73.42,61.74,55.00,49.00,
      41.20,49.00,55.00,65.41,73.42,82.41,61.74,55.00
    ],
    tempo:270,
    type:'sine',
    accent:6
  };
  try{
    if(typeof MUSIC_TRACKS!=='undefined'){
      MUSIC_TRACKS.absoluteCinema=cinemaTrack;
    }
    const id='music5';
    if(typeof SHOP_PERMANENT_IDS!=='undefined')SHOP_PERMANENT_IDS.add(id);
    if(typeof SHOP!=='undefined'){
      const absoluteCinemaShop=SHOP.find(x=>x.id===id);
      if(absoluteCinemaShop){
        absoluteCinemaShop.icon='🎬';
        absoluteCinemaShop.name='Absolute Cinema';
        absoluteCinemaShop.price=1000;
        absoluteCinemaShop.desc='Obra maestra original: melodía larga de misterio, tonos agudos, graves y ambiente cinematográfico.';
        absoluteCinemaShop.buy=()=>{S.purchases.music5=true;};
      }else{
        SHOP.push({id,icon:'🎬',name:'Absolute Cinema',price:1000,desc:'Obra maestra original: melodía larga de misterio, tonos agudos, graves y ambiente cinematográfico.',buy:()=>{S.purchases.music5=true;}});
      }
    }
    S.purchases=S.purchases||{};
  }catch(e){console.warn('SWQ Absolute Cinema',e)}

  function musicOwned5(){
    return !!S.purchases?.music5;
  }
  window.swqQuickMusic=function(){
    const owned=[];
    try{
      Object.entries(MUSIC_TRACKS||{}).forEach(([k,v])=>{
        let ok=k==='aqua'||(k==='marea'&&S.purchases?.music1)||(k==='cosmos'&&S.purchases?.music2)||(k==='pixel'&&S.purchases?.music3)||(k==='frecuenciaPerdida'&&S.purchases?.music4)||(k==='absoluteCinema'&&musicOwned5());
        if(ok)owned.push([k,v]);
      });
    }catch(e){}
    const opts=owned.map(([k,v])=>'<option value="'+esc(k)+'" '+(S.settings.musicTrack===k?'selected':'')+'>'+esc(v.emoji||'🎵')+' '+esc(v.name||k)+'</option>').join('');
    modal('<div class="kicker">🎵 MÚSICA</div><h2>Elegir música</h2><div class="field" style="margin-top:10px"><select id="swqMusic5Select" style="width:100%">'+opts+'</select></div><label class="checkrow" style="margin:8px 0"><input id="swqMusic5Enabled" type="checkbox" '+(S.settings.music?'checked':'')+'> 🎵 Música activa</label><button type="button" id="swqMusic5Apply" class="btn primary" style="margin-top:8px">Usar música</button><button type="button" class="btn secondary" style="margin-top:8px" onclick="window.swqQuickTheme()">🎨 Volver a estilos</button><button type="button" class="btn secondary" style="margin-top:8px" onclick="closeModal()">Cerrar</button>');
    document.getElementById('swqMusic5Apply')?.addEventListener('click',()=>{
      const key=document.getElementById('swqMusic5Select')?.value||'aqua';
      S.settings.music=!!document.getElementById('swqMusic5Enabled')?.checked;
      S.settings.musicTrack=key;save();
      if(S.settings.music)restartAmbient();else ambientStop();
      toast('🎵 '+(MUSIC_TRACKS[key]?.name||'Música')+' equipada.');
    });
  };

  window.swqQuickTheme=function(){
    repairRangeStyles();
    const keys=['Aqua',...Object.keys(RANGE_STYLES).filter(k=>S.purchases?.['theme_'+k]),...Object.keys(THEMES||{}).filter(k=>k!=='Aqua'&&!RANGE_STYLES[k]&&S.purchases?.['theme_'+k])];
    const unique=[...new Set(keys)].filter(k=>THEMES[k]);
    const buttons=unique.map(k=>'<button type="button" class="btn '+(S.settings.theme===k?'primary':'secondary')+'" data-swq-safe-theme="'+esc(k)+'" style="min-height:54px;text-align:left">'+esc(THEMES[k]?.emoji||'🎨')+' '+esc((typeof swqThemeName==='function'?swqThemeName(k):k))+(S.settings.theme===k?' · ACTUAL':'')+'</button>').join('');
    modal('<div class="kicker">🎨 PERSONALIZACIÓN</div><h2>Estilo y música</h2><div class="grid g2" style="margin-top:4px"><button type="button" id="swqSafeStyleTab" class="btn primary">🎨 Estilo</button><button type="button" id="swqSafeMusicTab" class="btn secondary">🎵 Música</button></div><div id="swqSafeStylePanel"><div class="sub" style="margin:9px 0 8px">Estilos desbloqueados.</div><div class="grid g2">'+buttons+'</div></div><button type="button" class="btn secondary" style="margin-top:10px" id="swqSafeThemeClose">Cerrar</button>');
    document.getElementById('swqSafeStyleTab')?.addEventListener('click',()=>window.swqQuickTheme());
    document.getElementById('swqSafeMusicTab')?.addEventListener('click',()=>window.swqQuickMusic());
    document.querySelectorAll('[data-swq-safe-theme]').forEach(b=>b.addEventListener('click',()=>{
      const k=b.dataset.swqSafeTheme;
      if(k&&THEMES[k]&&(k==='Aqua'||S.purchases?.['theme_'+k])){
        S.settings.theme=k;save();applyTheme();closeModal();render();
      }
    }));
    document.getElementById('swqSafeThemeClose')?.addEventListener('click',closeModal);
  };

  /* Styles and fish should visibly survive renders. */
  const style=document.createElement('style');
  style.textContent=
    'body.theme-leviatan .btn:not(.danger){background:linear-gradient(90deg,#ff5c5c,#ffd166,#61efaa,#42ddff,#8b66ff,#ff5c9d,#ff5c5c)!important;background-size:400% 100%!important;animation:swqLeviButtonFlow 4.2s linear infinite!important;color:#05131c!important;text-shadow:0 1px 1px rgba(255,255,255,.35)}'+
    '@keyframes swqLeviButtonFlow{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}'+
    '.swq-lev-front-fish{position:absolute;top:var(--top,40%);left:-15vw;font-size:26px;filter:drop-shadow(0 0 9px rgba(130,246,255,.60));animation:swqLevFishLong var(--fishDur,14s) linear forwards!important;will-change:transform,opacity}'+
    '@keyframes swqLevFishLong{0%{opacity:0;transform:translate3d(-3vw,0,0) scaleX(1) rotate(-2deg)}8%{opacity:.92}50%{transform:translate3d(52vw,var(--bob,0px),0) scaleX(-1) rotate(2deg)}100%{opacity:0;transform:translate3d(124vw,calc(var(--bob,0px)*-.65),0) scaleX(-1) rotate(-1deg)}}'+
    '.swq-stable-difficulty-wheel .difficulty-donut{width:min(210px,58vw);height:min(210px,58vw);flex:0 0 auto}'+
    '.swq-stable-difficulty-wheel .difficulty-donut-legend{width:100%;max-width:420px}';
  document.head.appendChild(style);

  /* Re-apply repairs after cloud/account synchronization without changing stored difficulties. */
  let lastStableRepair=0;
  const stableRepair=()=>{
    if(Date.now()-lastStableRepair<2500)return;
    lastStableRepair=Date.now();
    try{repairRangeStyles();freezeMissingDifficulties();wrapRebuildWithoutDifficulty();if(S.settings.theme==='Leviatan')leviathanFishSync();}catch(e){}
  };
  setTimeout(stableRepair,300);
  setTimeout(stableRepair,1400);
  setInterval(stableRepair,5500);

  try{save();render();}catch(e){}
})();

/* === SWQ DIFFICULTY SNAPSHOT V2 2026-09-20 === */
(function(){
  'use strict';
  if(window.__SWQ_DIFFICULTY_SNAPSHOT_V2_20260920__)return;
  window.__SWQ_DIFFICULTY_SNAPSHOT_V2_20260920__=true;

  function normalizeDifficultyKey(k){return String(k||'').trim()==='intenso'?'brutal':String(k||'').trim();}
  function freshDifficulty(e){
    const copy={...(e||{}),difficulty:''};
    return calcDifficultyLocked(copy,S?.profile?.avgMeters);
  }
  function attachSnapshot(e){
    if(!e)return;
    const d=freshDifficulty(e);
    e.difficulty=normalizeDifficultyKey(d.key);
    e.difficultyPercent=Number(d.percent)||0;
    e.difficultyBase=Number(d.base)||Math.max(100,Number(S.profile?.avgMeters)||1000);
    e.difficultyPoints=Number(d.points)||0;
  }

  try{
    if(typeof DIFFICULTIES!=='undefined'){
      const labels={
        facil:'0–19% de tu referencia',
        normal:'20–49% de tu referencia',
        brutal:'50–110% de tu referencia',
        demoniaco:'111–449% de tu referencia',
        masoquista:'450% o más de tu referencia'
      };
      DIFFICULTIES.forEach(d=>{if(labels[d.key])d.desc=labels[d.key]+'; metros, tiempos y carga del entrenamiento influyen.';});
    }
  }catch(e){}

  try{
    if(typeof difficultyInfo==='function'){
      const baseDifficultyInfoV2=difficultyInfo;
      difficultyInfo=function(e,avg){
        const stored=normalizeDifficultyKey(e?.difficulty);
        if(stored){
          const d=difficultyForKey(stored);
          return {...d,
            percent:Number.isFinite(Number(e?.difficultyPercent))?Number(e.difficultyPercent):0,
            base:Number.isFinite(Number(e?.difficultyBase))?Number(e.difficultyBase):Math.max(100,Number(avg)||Number(S.profile?.avgMeters)||1000),
            points:Number.isFinite(Number(e?.difficultyPoints))?Number(e.difficultyPoints):0
          };
        }
        return baseDifficultyInfoV2.apply(this,arguments);
      };
      difficultyLabel=function(e){
        const d=typeof e==='string'?difficultyForKey(normalizeDifficultyKey(e)):difficultyInfo(e,S?.profile?.avgMeters);
        return d.icon+' '+d.name;
      };
      difficultyCounts=function(arr){
        return Object.fromEntries(DIFFICULTIES.map(d=>[d.key,(arr||[]).filter(e=>normalizeDifficultyKey(e?.difficulty)===d.key).length]));
      };
    }
  }catch(e){console.warn('SWQ difficulty snapshot binding',e)}

  try{
    for(const e of (S.trainings||[])){
      if(!e.difficulty||e.difficulty==='intenso'||!Number.isFinite(Number(e.difficultyPercent))){
        attachSnapshot(e);
      }else{
        e.difficulty=normalizeDifficultyKey(e.difficulty);
      }
    }
    save();
  }catch(e){console.warn('SWQ difficulty snapshots',e)}

  try{
    if(typeof window.saveTraining==='function'&&!window.__swqSaveTrainingSnapshotV2){
      const baseSave=window.saveTraining;
      window.saveTraining=function(){
        const before=new Set((S.trainings||[]).map(e=>e.id));
        const out=baseSave.apply(this,arguments);
        try{
          const added=(S.trainings||[]).find(e=>!before.has(e.id));
          if(added){attachSnapshot(added);save();}
        }catch(e){}
        return out;
      };
      window.__swqSaveTrainingSnapshotV2=true;
    }
  }catch(e){console.warn('SWQ save difficulty snapshot',e)}

  try{
    if(typeof commitEdit==='function'&&!window.__swqCommitEditFreshDifficultyV2){
      const baseEdit=commitEdit;
      window.commitEdit=function(id){
        const e=S.trainings.find(x=>x.id===id);
        const old=e?{difficulty:e.difficulty,difficultyPercent:e.difficultyPercent,difficultyBase:e.difficultyBase,difficultyPoints:e.difficultyPoints}:null;
        if(e){
          delete e.difficulty;
          delete e.difficultyPercent;
          delete e.difficultyBase;
          delete e.difficultyPoints;
        }
        try{
          const out=baseEdit.apply(this,arguments);
          if(e){
            attachSnapshot(e);
            save();
          }
          return out;
        }catch(err){
          if(e&&old){
            Object.assign(e,old);
            save();
          }
          throw err;
        }
      };
      window.__swqCommitEditFreshDifficultyV2=true;
    }
  }catch(e){console.warn('SWQ edit difficulty snapshot',e)}

  try{
    const style=document.createElement('style');
    style.textContent='.swq-stable-difficulty-wheel .difficulty-legend-row{font-variant-numeric:tabular-nums}.swq-stable-difficulty-wheel .difficulty-donut-legend b{white-space:nowrap}';
    document.head.appendChild(style);
  }catch(e){}
})();
