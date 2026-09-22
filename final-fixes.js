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
  let roadTimer=null,planeTimer=null,helicopterTimer=null,roadLayer=null;
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
.swq-road-car{animation:swqCarDrive var(--dur,5.5s) linear forwards!important;transform:translateZ(0)!important}.swq-road-car.reverse{animation-name:swqCarDrive!important;transform:none!important}.swq-road-car.fast{font-size:36px}
.swq-road-plane{font-size:22px;animation:swqPlaneFly var(--dur,8s) linear forwards!important;opacity:.82;text-shadow:0 0 7px rgba(156,207,255,.55);will-change:transform}
.swq-road-helicopter{position:absolute;font-size:25px;animation:swqPlaneFly var(--dur,10s) linear forwards!important;opacity:.98;text-shadow:0 0 9px rgba(170,220,255,.65);will-change:transform}
@keyframes swqRoadHelicopterRide{from{transform:translateX(-18vw) translateY(0)}to{transform:translateX(118vw) translateY(-4vh)}}
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
    if(roadTimer){clearInterval(roadTimer);roadTimer=null}
    if(planeTimer){clearInterval(planeTimer);planeTimer=null}
    if(helicopterTimer){clearInterval(helicopterTimer);helicopterTimer=null}
    if(roadLayer){roadLayer.remove();roadLayer=null}
  }
  function spawnRoadCar(){
    if(S.settings.theme!=='Carretera'||!roadLayer)return;
    const el=document.createElement('span');el.className='swq-road-car'+(Math.random()<.3?' fast':'');
    el.textContent=['🚗','🚙','🚕','🚌'][Math.floor(Math.random()*4)];
    el.style.setProperty('--dur',(4.5+Math.random()*4.5)+'s');el.style.top=(61+Math.random()*27)+'%';
    el.style.filter='drop-shadow(0 3px 8px rgba(0,0,0,.8)) brightness(1)';
    roadLayer.appendChild(el);setTimeout(()=>el.remove(),10000);
  }
  function spawnRoadPlane(){
    if(S.settings.theme!=='Carretera'||!roadLayer)return;
    const el=document.createElement('span');el.className='swq-road-plane';
    el.textContent=Math.random()<.60?'✈️':'🛫';
    el.style.top=(10+Math.random()*25)+'%';el.style.setProperty('--dur',(7.0+Math.random()*5.5)+'s');
    roadLayer.appendChild(el);setTimeout(()=>el.remove(),17000);
  }
  function spawnRoadHelicopter(){
    if(S.settings.theme!=='Carretera'||!roadLayer)return;
    const el=document.createElement('span');el.className='swq-road-helicopter';
    el.textContent='🚁';
    el.style.top=(9+Math.random()*25)+'%';
    el.style.setProperty('--dur',(8.5+Math.random()*3.5)+'s');
    roadLayer.appendChild(el);setTimeout(()=>el.remove(),15000);
  }
  function syncRoadTheme(){
    if(S.settings.theme==='Carretera'){
      createRoadLayer();
      if(!roadTimer)roadTimer=setInterval(()=>{if(!document.hidden){spawnRoadCar();if(Math.random()<.12)spawnRoadCar()}},1700);
      if(!planeTimer)planeTimer=setInterval(()=>{if(!document.hidden&&Math.random()<.35)spawnRoadPlane()},17000);
      if(!helicopterTimer){
        if(!document.hidden)setTimeout(()=>{if(S.settings.theme==='Carretera')spawnRoadHelicopter();},1200);
        helicopterTimer=setInterval(()=>{if(!document.hidden)spawnRoadHelicopter()},10000);
      }
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
      const gemDescs={xp500:'Gema de XP. Otorga 650 XP.',xp1500:'Gema de XP. Otorga 1.950 XP.',xpJuan:'Gema de XP especial. Otorga 13.000 XP.' };
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
      /* Migración segura: no entrega retroactivamente todas las recompensas de rangos ya alcanzados.
         A partir de aquí, solo el siguiente rango nuevo podrá cobrar su recompensa. */
      if(!S.__swqRankRewardsBaselineV2){
        const reached=currentRank().i;
        const claimed=new Set(S.rankRewardsClaimed);
        SWQ_RANK_REWARDS.forEach(reward=>{
          const ri=RANKS.findIndex(r=>r.c===reward.c);
          if(ri>=0&&ri<=reached)claimed.add(reward.c);
        });
        S.rankRewardsClaimed=[...claimed];
        S.__swqRankRewardsBaselineV2=true;
      }
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

      /* Cursor de alto nivel: las recompensas solo se cobran al cruzar rangos nuevos. */
      const currentIdx=Math.max(0,currentRank().i);
      let cursor=Number.isFinite(Number(S.__swqRankRewardHighWater))
        ?Math.max(-1,Number(S.__swqRankRewardHighWater))
        :currentIdx;

      if(!Number.isFinite(Number(S.__swqRankRewardHighWater))){
        /* Migración segura: una partida ya existente no recibe recompensas retroactivas. */
        S.__swqRankRewardHighWater=currentIdx;
      }

      const claimed=new Set(Array.isArray(S.rankRewardsClaimed)?S.rankRewardsClaimed:[]);
      let changed=false,events=[];

      /* Repara listas incompletas provenientes de local/cloud sin volver a pagar. */
      for(const reward of SWQ_RANK_REWARDS){
        const ri=RANKS.findIndex(r=>r.c===reward.c);
        if(ri>=0&&ri<=cursor&&!claimed.has(reward.c)){
          claimed.add(reward.c);
          changed=true;
        }
      }

      if(currentIdx>cursor){
        for(let ri=cursor+1;ri<=currentIdx;ri++){
          const reward=SWQ_RANK_REWARDS.find(x=>RANKS.findIndex(r=>r.c===x.c)===ri);
          if(!reward)continue;
          if(claimed.has(reward.c))continue;

          claimed.add(reward.c);
          changed=true;

          if(reward.coins){
            S.rankRewardCoins+=reward.coins;
            S.coins+=reward.coins;
            events.push('+'+fmt(reward.coins)+' 🪙');
          }
          if(reward.xp){
            S.rankRewardXP+=reward.xp;
            S.xp+=reward.xp;
            S.level=levelFromXP(S.xp);
            events.push('+'+fmt(reward.xp)+' XP');
          }
          if(reward.give){
            swqGiveConsumable(reward.give,1);
            const it=SWQ_CONSUMABLES[reward.give];
            if(it)events.push(it.icon+' '+it.name);
          }
          if(reward.giveMany)reward.giveMany.forEach(k=>{
            swqGiveConsumable(k,1);
            const it=SWQ_CONSUMABLES[k];
            if(it)events.push(it.icon+' '+it.name);
          });
          if(reward.randomConsumable){
            const k=swqRewardRandomConsumable();
            events.push('🎁 '+(k==='recuperador'?'Recuperador de racha':SWQ_CONSUMABLES[k].name));
          }
          if(reward.unlockStyle){
            swqUnlockStyle(reward.unlockStyle);
            const it=SWQ_NEW_STYLES[reward.unlockStyle];
            if(it)events.push('🎨 '+it.name+' disponible en la tienda');
          }
          if(reward.unlockConsumable){
            S.shopUnlocks[reward.unlockConsumable]=true;
            events.push('🔁 Ficha de Repetición disponible en la tienda');
          }
        }
      }

      S.__swqRankRewardHighWater=Math.max(
        Number(S.__swqRankRewardHighWater)||-1,
        currentIdx
      );
      S.rankRewardsClaimed=[...claimed];
      S.level=levelFromXP(S.xp);

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
        if(!Number.isFinite(Number(S.__swqRankRewardHighWater))){
          S.__swqRankRewardHighWater=before;
        }else{
          S.__swqRankRewardHighWater=Math.min(Number(S.__swqRankRewardHighWater),before);
        }
        const result=baseGainXPV9.apply(this,arguments);
        const after=currentRank().i;
        const info=swqGrantRankMilestones(false);
        if(after>before&&info.changed){
          S.__swqLastRankRewardEvents=info.events||[];
          toast('🏆 Nuevo rango: '+currentRank().r.n+' · recompensa(s) añadida(s) al inventario.',4200);
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
        /* Las recompensas ya se aplican una sola vez en gainXP/rank-reward.
           Este recálculo no debe volver a sumarlas. */
        const out=baseRebuildProfileV9.apply(this,arguments);
        S.level=levelFromXP(S.xp);save();return out;
      };
      window.__swqRebuildProfileV9Wrapped=true;
    }
    const baseRecalcAllV9=recalcAll;
    if(!window.__swqRecalcAllV9Wrapped){
      recalcAll=function(){
        /* Igual que rebuildProfile: recalcular estadísticas no vuelve a pagar
           recompensas de rango ni cristales usados anteriormente. */
        const out=baseRecalcAllV9.apply(this,arguments);
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

  /* Música: Absolute Cinema — versión 2026-09-20.
     Composición original con tres actos, más espacio entre notas y cierre luminoso. */
  const cinemaTrack={
    name:'Absolute Cinema',
    emoji:'🎬',
    notes:[
      /* Acto I · misterio */
      440.00,415.30,392.00,349.23,369.99,415.30,466.16,392.00,
      329.63,369.99,392.00,440.00,415.30,392.00,349.23,329.63,
      293.66,329.63,369.99,392.00,440.00,415.30,392.00,369.99,
      349.23,329.63,293.66,329.63,369.99,415.30,466.16,493.88,

      523.25,493.88,466.16,440.00,415.30,392.00,369.99,349.23,
      329.63,349.23,369.99,415.30,440.00,466.16,493.88,523.25,

      /* Acto II · ascenso */
      587.33,523.25,493.88,523.25,587.33,659.25,622.25,587.33,
      523.25,493.88,523.25,587.33,659.25,698.46,659.25,622.25,
      587.33,622.25,659.25,739.99,783.99,739.99,698.46,659.25,
      622.25,659.25,739.99,830.61,880.00,830.61,783.99,739.99,

      698.46,739.99,783.99,880.00,987.77,880.00,830.61,783.99,
      739.99,783.99,830.61,987.77,1046.50,987.77,880.00,830.61,

      /* Acto III · clímax y resolución */
      987.77,1046.50,1174.66,1318.51,1174.66,1108.73,987.77,1046.50,
      1174.66,1318.51,1567.98,1396.91,1318.51,1174.66,1046.50,987.77,
      1108.73,1174.66,1396.91,1567.98,1760.00,1567.98,1396.91,1318.51,
      1174.66,1318.51,1567.98,1975.53,1760.00,1567.98,1396.91,1318.51,

      1174.66,1396.91,1567.98,1760.00,2093.00,1975.53,1760.00,1567.98,
      1396.91,1567.98,1760.00,2093.00,2349.32,2093.00,1975.53,1760.00,

      /* Coda */
      1567.98,1396.91,1318.51,1174.66,1046.50,1108.73,1318.51,1396.91,
      1567.98,1760.00,1567.98,1396.91,1318.51,1174.66,987.77,880.00,
      783.99,830.61,987.77,1174.66,1046.50,987.77,880.00,739.99,
      659.25,698.46,783.99,880.00,783.99,698.46,659.25,587.33
    ],
    bass:[
      55.00,65.41,73.42,82.41,61.74,73.42,49.00,58.27,
      55.00,65.41,73.42,82.41,49.00,58.27,61.74,73.42,
      65.41,73.42,82.41,98.00,73.42,61.74,55.00,49.00,
      65.41,73.42,98.00,110.00,82.41,73.42,61.74,55.00,
      73.42,82.41,98.00,110.00,98.00,82.41,73.42,65.41,
      82.41,98.00,110.00,123.47,110.00,98.00,82.41,73.42
    ],
    tempo:320,
    type:'triangle',
    accent:5
  };

  /* Cosmos: conserva su base grave/espacial y añade destellos agudos sin volverla chillona. */
  try{
    if(typeof MUSIC_TRACKS!=='undefined'&&MUSIC_TRACKS.cosmos){
      MUSIC_TRACKS.cosmos.notes=[
        174.61,196.00,220.00,261.63,293.66,329.63,392.00,523.25,
        392.00,329.63,293.66,440.00,523.25,587.33,523.25,392.00,
        220.00,246.94,293.66,329.63,392.00,440.00,523.25,659.25,
        523.25,440.00,392.00,523.25,659.25,698.46,659.25,523.25
      ];
      MUSIC_TRACKS.cosmos.bass=[87.31,98.00,110.00,130.81];
      MUSIC_TRACKS.cosmos.tempo=585;
      MUSIC_TRACKS.cosmos.type='triangle';
      MUSIC_TRACKS.cosmos.accent=3;
    }
  }catch(e){console.warn('SWQ Cosmos music patch',e)}
  try{
    if(typeof MUSIC_TRACKS!=='undefined')MUSIC_TRACKS.absoluteCinema=cinemaTrack;
    const id='music5';
    if(typeof SHOP_PERMANENT_IDS!=='undefined')SHOP_PERMANENT_IDS.add(id);
    if(typeof SHOP!=='undefined'){
      const absoluteCinemaShop=SHOP.find(x=>x.id===id);
      if(absoluteCinemaShop){
        absoluteCinemaShop.icon='🎬';
        absoluteCinemaShop.name='Absolute Cinema';
        absoluteCinemaShop.price=750;
        absoluteCinemaShop.desc='Obra maestra original: misterio, ascenso, clímax y resolución con graves profundos y agudos cinematográficos.';
        absoluteCinemaShop.buy=()=>{S.purchases.music5=true;};
      }else{
        SHOP.push({id,icon:'🎬',name:'Absolute Cinema',price:750,desc:'Obra maestra original: misterio, ascenso, clímax y resolución con graves profundos y agudos cinematográficos.',buy:()=>{S.purchases.music5=true;}});
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

/* === SWQ Solar orange-yellow 2026-09-20 === */
(function(){
  'use strict';
  try{
    if(typeof THEMES!=='undefined'&&THEMES.Solar){
      THEMES.Solar.a='#ffe36a';
      THEMES.Solar.b='#f28c18';
      THEMES.Solar.desc='Amarillo solar intenso con naranja cálido y pulsos de luz.';
    }
    const st=document.createElement('style');
    st.id='swq-solar-orange-yellow-20260920';
    st.textContent=[
      'body.theme-solar{background:radial-gradient(circle at 50% -12%,#fff6a8 0,#ffd84d 22%,#f5a623 48%,#c85b16 72%,#32130a 100%)!important;color:#fff9df!important}',
      'body.theme-solar .card{background:linear-gradient(180deg,rgba(72,43,9,.95),rgba(28,14,6,.98))!important;border-color:rgba(255,221,95,.34)!important}',
      'body.theme-solar .btn{background:linear-gradient(135deg,#ffe66b,#ffc12f 48%,#f58b18)!important;border-color:#ffeaa0!important;color:#241506!important;box-shadow:0 8px 26px rgba(255,190,40,.18)!important}',
      'body.theme-solar .btn.primary{background:linear-gradient(135deg,#fff09a,#ffd23f 52%,#f07817)!important}',
      'body.theme-solar .nav{background:rgba(39,19,5,.94)!important;border-top-color:rgba(255,220,90,.3)!important}',
      'body.theme-solar .nav button.active{background:linear-gradient(135deg,rgba(255,229,102,.24),rgba(245,126,23,.16))!important;box-shadow:inset 0 0 0 1px rgba(255,226,110,.28),0 0 18px rgba(255,194,40,.12)!important}'
    ].join('');
    document.head.appendChild(st);
  }catch(e){}
})();

/* === SWQ Carbon solid particles 2026-09-20 === */
(function(){
  'use strict';
  try{
    const st=document.createElement('style');
    st.id='swq-carbon-solid-particles-20260920';
    st.textContent=[
      '.swq-carbon-ember{opacity:1!important;background:linear-gradient(180deg,#fff4a8 0,#efc548 58%,#a97816 100%)!important;box-shadow:0 0 11px rgba(255,205,70,.78),inset 0 1px 0 rgba(255,255,255,.5)!important}',
      '.swq-carbon-ember::before,.swq-carbon-ember::after{opacity:1!important}',
      'body.theme-carbon .theme-particle.abyss{opacity:.95!important}',
      'body.theme-carbon .theme-particle.goldbar{opacity:1!important}'
    ].join('');
    document.head.appendChild(st);
  }catch(e){}
})();

/* === SWQ stable styles random-basic gender pera 2026-09-20 === */
(function(){
  'use strict';
  if(window.__SWQ_STABLE_STYLE_GENDER_PEAR_20260920__)return;
  window.__SWQ_STABLE_STYLE_GENDER_PEAR_20260920__=true;

  const RANDOM_STYLE_ID='theme_RandomBasic';
  const RANDOM_THEME='RandomBasic';
  let randomBasicDice=false;
  let randomBasicDiceTimer=null;

  function ensureRandomBasic(){
    try{
      if(typeof THEMES!=='undefined'){
        THEMES[RANDOM_THEME]=THEMES[RANDOM_THEME]||{
          a:'#42b3ff',b:'#1d2a53',emoji:'🎲',
          desc:'Estilo básico sin efectos: cambia de color al entrar al juego. A veces aparece en blanco y negro con dados.'
        };
        THEMES[RANDOM_THEME].emoji='🎲';
        THEMES[RANDOM_THEME].desc='Estilo básico sin efectos: cada entrada cambia el color. A veces aparece en blanco y negro con dados cayendo.';
      }
      if(typeof SHOP!=='undefined'){
        let it=SHOP.find(x=>x.id===RANDOM_STYLE_ID);
        if(!it){
          it={id:RANDOM_STYLE_ID,icon:'🎲',name:'Aleatorio Básico',price:210,
            desc:'Muy básico y sin efectos. Cada vez que entras al juego obtiene un color distinto. A veces sale blanco y negro con dados.',
            buy:()=>{S.purchases[RANDOM_STYLE_ID]=true;}};
          SHOP.push(it);
        }else{
          it.icon='🎲';it.name='Aleatorio Básico';it.price=210;
          it.desc='Muy básico y sin efectos. Cada vez que entras al juego obtiene un color distinto. A veces sale blanco y negro con dados.';
          it.buy=()=>{S.purchases[RANDOM_STYLE_ID]=true;};
        }
      }
      S.purchases=S.purchases||{};
      if(S.purchases[RANDOM_STYLE_ID]===true)S.shopUnlocks=S.shopUnlocks||{};
    }catch(e){}
  }

  const RANDOM_PALETTES=[
    ['#55d6ff','#1767d9'],['#6ee7a8','#16704d'],['#ffd54a','#d88900'],['#ff9b73','#d84a20'],
    ['#c99cff','#7130c9'],['#ff8fc5','#c74682'],['#78a9ff','#304fbe'],['#e8f4ff','#7b8ea8'],
    ['#7cf2e1','#178f83']
  ];

  function pickRandomBasicColor(){
    const variants=[...RANDOM_PALETTES.map((pair,i)=>({pair,i,dice:false})),{pair:['#f8f8f8','#111111'],i:RANDOM_PALETTES.length,dice:true}];
    const previous=Number(localStorage.getItem('SWQ_RANDOM_BASIC_VARIANT'));
    const candidates=variants.filter(v=>v.i!==previous);
    const chosen=candidates[Math.floor(Math.random()*candidates.length)];
    localStorage.setItem('SWQ_RANDOM_BASIC_VARIANT',String(chosen.i));
    randomBasicDice=chosen.dice;
    return chosen.pair;
  }

  function applyRandomBasicEntryColor(force=false){
    try{
      ensureRandomBasic();
      if(S.settings.theme!==RANDOM_THEME)return;
      if(!force&&window.__SWQ_RANDOM_BASIC_SESSION_COLOR__)return;
      const [a,b]=pickRandomBasicColor();
      THEMES[RANDOM_THEME].a=a;
      THEMES[RANDOM_THEME].b=b;
      document.documentElement.style.setProperty('--a',a);
      document.documentElement.style.setProperty('--b',b);
      window.__SWQ_RANDOM_BASIC_SESSION_COLOR__=true;
      if(typeof applyTheme==='function')applyTheme();
      syncRandomBasicDice();
      save();
    }catch(e){}
  }

  function syncRandomBasicDice(){
    clearInterval(randomBasicDiceTimer);
    randomBasicDiceTimer=null;
    const old=document.getElementById('swqRandomBasicDiceLayer');if(old)old.remove();
    if(S.settings.theme!==RANDOM_THEME||!randomBasicDice)return;
    let host=document.getElementById('swqRandomBasicDiceLayer');
    if(!host){
      host=document.createElement('div');host.id='swqRandomBasicDiceLayer';
      document.body.appendChild(host);
    }
    const spawn=()=>{
      if(S.settings.theme!==RANDOM_THEME||!randomBasicDice){clearInterval(randomBasicDiceTimer);return;}
      const d=document.createElement('span');d.className='swq-random-die';
      d.textContent=['⚀','⚁','⚂','⚃','⚄','⚅'][Math.floor(Math.random()*6)];
      d.style.left=(4+Math.random()*92)+'%';
      d.style.setProperty('--fallDur',(4.5+Math.random()*2.5)+'s');
      d.style.setProperty('--drift',(-45+Math.random()*90)+'px');
      host.appendChild(d);setTimeout(()=>d.remove(),8000);
    };
    spawn();randomBasicDiceTimer=setInterval(spawn,1150);
  }

  function stableEquipTheme(theme){
    try{
      ensureRandomBasic();
      const purchased=(theme==='Aqua'||!!S.purchases?.['theme_'+theme]);
      if(!THEMES?.[theme]){toast('⚠️ Ese estilo no existe.');return;}
      if(!purchased){toast('🔒 Ese estilo todavía no está desbloqueado.');return;}
      S.settings.theme=theme;
      if(theme===RANDOM_THEME){
        window.__SWQ_RANDOM_BASIC_SESSION_COLOR__=false;
        applyRandomBasicEntryColor(true);
      }else{
        applyTheme();
        randomBasicDice=false;
        syncRandomBasicDice();
      }
      try{eclipseCartoonStars();}catch(e){}
      save();
      render();
    }catch(e){console.warn('SWQ stable equipTheme',e)}
  }
  window.equipTheme=stableEquipTheme;
  try{equipTheme=stableEquipTheme;}catch(e){}

  function patchOnboardingGender(){
    try{
      const base=window.onboarding;
      if(typeof base!=='function'||window.__SWQ_ONBOARDING_GENDER_FINAL__)return;
      window.onboarding=function(){
        let html=base.apply(this,arguments);
        const desired='<div class="field"><label>Género</label><select id="onGender" onchange="document.getElementById(\'onOtherGenderWrap\').style.display=this.value===\'Otro\'?\'block\':\'none\'"><option>Masculino</option><option>Femenino</option><option>Prefiero no decirlo</option><option>Otro</option></select><div id="onOtherGenderWrap" style="display:none;margin-top:7px"><input id="onOtherGender" maxlength="40" placeholder="Escribe tu género"></div></div>';
        html=html.replace(/<div class="field"><label>Género<\/label><select id="onGender">[\s\S]*?<\/select><\/div>/,desired);
        return html;
      };
      window.__SWQ_ONBOARDING_GENDER_FINAL__=true;
    }catch(e){}
  }

  function patchCreateProfileGender(){
    try{
      const base=window.createProfile;
      if(typeof base!=='function'||window.__SWQ_CREATE_PROFILE_GENDER_FINAL__)return;
      window.createProfile=function(){
        const sel=document.getElementById('onGender'),other=document.getElementById('onOtherGender');
        if(sel?.value==='Otro'){
          const custom=String(other?.value||'').trim();
          if(!custom){toast('Escribe qué género quieres mostrar en tu perfil.');return;}
          const old=sel.value;
          sel.value='Otro: '+custom.slice(0,40);
          try{return base.apply(this,arguments);}finally{sel.value=old;}
        }
        return base.apply(this,arguments);
      };
      window.__SWQ_CREATE_PROFILE_GENDER_FINAL__=true;
    }catch(e){}
  }

  function patchPearDialogues(){
    try{
      if(typeof PEAR_TOPIC_DIALOGUES==='undefined'||!Array.isArray(PEAR_TOPIC_DIALOGUES))return;
      const generic={
        tema1:['💭 Siento que últimamente no estoy avanzando como quisiera.','💭 Me preocupa que mis resultados estén empeorando.','💭 A veces hago esfuerzo y aun así no noto la mejora.','💭 Me cuesta saber si lo que estoy haciendo está funcionando.','💭 Tengo miedo de perder el progreso que ya había construido.','💭 Necesito encontrar una forma más tranquila de medir mi avance.','💭 Supongo que puedo seguir intentando sin exigir que todo mejore de inmediato.'],
        tema2:['💭 Me da miedo equivocarme cuando algo me importa.','💭 Siento mucha presión por hacerlo bien.','💭 A veces imagino todos los errores posibles antes de empezar.','💭 Me preocupa cómo reaccionarán los demás si algo sale mal.','💭 Quiero poder seguir adelante aunque tenga nervios.','💭 Quizá no necesito hacerlo perfecto para que valga la pena.','💭 Me gustaría confiar más en lo que ya practiqué.'],
        tema3:['💭 Una mala etapa me hace pensar que quizá no sirvo para esto.','💭 Cuando algo sale mal, me cuesta no convertirlo en una etiqueta sobre mí.','💭 A veces siento que mis esfuerzos no son suficientes.','💭 Me preocupa quedarme atrás y no encontrar una forma de cambiarlo.','💭 Quiero separar un resultado malo de lo que valgo como persona.','💭 Me cuesta recordar todo lo que sí he conseguido cuando estoy frustrado.','💭 Quizá necesito juzgarme menos por un solo resultado.'],
        tema4:['💭 Veo que otras personas avanzan y me cuesta no compararme.','💭 A veces siento que estoy quedándome atrás.','💭 Me fijo demasiado en resultados ajenos y eso me hace dudar de mí.','💭 Sé que no conozco todo el camino de las demás personas, pero aun así me comparo.','💭 Quiero aprender a admirar los logros ajenos sin convertirlos en una medida de mi valor.','💭 Tal vez debería mirar más mi propio progreso.','💭 Puedo aprender de otras personas sin necesitar ser igual que ellas.'],
        tema5:['💭 Ya no siento la misma emoción que al principio.','💭 A veces sigo por costumbre y no sé qué quiero realmente.','💭 Me pregunto si todavía disfruto esto de la misma manera.','💭 Me da miedo cambiar de rumbo después de haber invertido tanto tiempo.','💭 No quiero que una actividad se convierta en toda mi identidad.','💭 Quizá necesito permitirme evaluar qué quiero seguir haciendo.','💭 Puedo cambiar de objetivo sin borrar lo que aprendí.'],
        tema6:['💭 A veces escondo que estoy cansado o preocupado para que todo parezca normal.','💭 Me cuesta decir cuando algo me está superando.','💭 Temo que los demás interpreten mis límites como una debilidad.','💭 A veces acumulo demasiado antes de hablar.','💭 Quiero encontrar una forma de pedir apoyo cuando lo necesito.','💭 Reconocer cómo me siento puede ser una forma de cuidarme.'],
        tema7:['💭 Me pongo nervioso cuando las cosas no salen como las había imaginado.','💭 Quiero controlar todos los detalles para sentirme seguro.','💭 Un pequeño cambio puede hacer que pierda la calma más de lo que quisiera.','💭 Sé que no puedo controlar todo, aunque todavía me cuesta aceptarlo.','💭 Quiero aprender a adaptarme sin sentir que todo está perdido.','💭 Quizá ser flexible también sea una forma de tener control sobre mi respuesta.','💭 El agua va a cambiar de todas formas; puedo aprender a moverme con ella.'],
        tema8:['💭 A veces siento que mi esfuerzo pasa desapercibido.','💭 Me gustaría que alguien reconociera el trabajo que hay detrás de mis resultados.','💭 Cuando nadie nota una mejora, me cuesta sentir que contó.','💭 A veces busco mostrar lo que hago para sentir que tiene más valor.','💭 No quiero depender de la aprobación para saber que algo fue importante.','💭 Mi esfuerzo puede tener significado aunque nadie lo vea.'],
        tema9:['💭 A veces siento que otra persona parece mejor que yo.','💭 Me cuesta no comparar mis resultados con los de otras personas.','💭 Sé que solo veo una parte de la historia de los demás.','💭 Quiero aprender de quienes admiro sin convertirme en una copia.','💭 Una diferencia en una habilidad no tiene por qué definir mi valor.','💭 Puedo reconocer que alguien destaca en algo y seguir construyendo mi propio camino.'],
        tema10:['💭 Antes de competir me pongo nervioso y temo olvidar lo que practiqué.','💭 Siento que mis nervios pueden afectar mi rendimiento.','💭 Quiero aprender a competir sin necesitar que desaparezcan todos los nervios.','💭 Me ayuda recordar las partes sencillas de la rutina que ya conozco.'],
        tema11:['💭 A veces siento culpa cuando descanso.','💭 Me preocupa que descansar signifique estar perdiendo progreso.','💭 Compararme con quien entrenó mientras yo descansaba me hace sentir atrás.','💭 Quiero entender mejor qué lugar ocupa el descanso en mi proceso.','💭 Quizá descansar también puede ser una decisión responsable.','💭 No necesito llenar cada día para demostrar que me estoy esforzando.'],
        tema12:['💭 Una relación terminó y todavía me cuesta dejar de pensar en ello.','💭 A veces estoy bien y luego vuelve el recuerdo.','💭 Me gustaría avanzar sin fingir que nada de lo vivido importó.','💭 Algunos días se sienten más pesados que otros.','💭 No necesito olvidar de golpe para poder seguir adelante.','💭 Puedo aceptar lo que siento y volver poco a poco a mi propia vida.']
      };
      for(const d of PEAR_TOPIC_DIALOGUES){
        const arr=generic[d.id];
        if(!arr||!Array.isArray(d.lines))continue;
        let j=0;
        for(const line of d.lines){
          if(line?.speaker==='👤 TÚ'){
            line.speaker='💭 TÚ PIENSAS';
            line.text=arr[j%arr.length];
            j++;
          }else if(line?.text){
            line.text=String(line.text)
              .replace(/Mateo/g,'otra persona')
              .replace(/Juan/g,'otra persona')
              .replace(/el sábado/g,'en una próxima competencia')
              .replace(/carril tres/g,'un carril')
              .replace(/carril cuatro/g,'otro carril')
              .replace(/hombro derecho/g,'el cuerpo');
          }
        }
      }
    }catch(e){console.warn('SWQ generalized Pera',e)}
  }

  function applyRandomBasicCSS(){
    if(document.getElementById('swq-random-basic-css'))return;
    const st=document.createElement('style');st.id='swq-random-basic-css';
    st.textContent=[
      'body.theme-randombasic{background:linear-gradient(180deg,var(--a),var(--b))!important;color:#fff!important}',
      'body.theme-randombasic .card{background:rgba(8,15,24,.84)!important;border-color:rgba(255,255,255,.2)!important;box-shadow:none!important}',
      'body.theme-randombasic .btn{background:var(--a)!important;color:#08111c!important;border-color:rgba(255,255,255,.35)!important;box-shadow:none!important;animation:none!important}',
      'body.theme-randombasic .btn.primary{background:var(--b)!important;color:#fff!important}',
      'body.theme-randombasic .nav{background:rgba(7,10,14,.96)!important;border-top-color:rgba(255,255,255,.18)!important}',
      '#swqRandomBasicDiceLayer{position:fixed;inset:0;z-index:43;pointer-events:none;overflow:hidden}',
      '.swq-random-die{position:absolute;top:-34px;font-size:28px;color:#111;text-shadow:0 1px 0 #fff;animation:swqRandomDieFall var(--fallDur,5s) linear forwards;will-change:transform,opacity}',
      '@keyframes swqRandomDieFall{0%{opacity:0;transform:translate3d(0,-12px,0) rotate(0deg)}10%{opacity:1}100%{opacity:1;transform:translate3d(var(--drift,0px),112vh,0) rotate(360deg)}}'
    ].join('');
    document.head.appendChild(st);
  }

  ensureRandomBasic();
  patchOnboardingGender();
  patchCreateProfileGender();
  patchPearDialogues();
  applyRandomBasicCSS();
  if(S.settings.theme===RANDOM_THEME)applyRandomBasicEntryColor(false);

  const observer=new MutationObserver(()=>{
    try{ensureRandomBasic();patchOnboardingGender();patchCreateProfileGender();patchPearDialogues();}catch(e){}
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  let lastTheme=S.settings.theme;
  setInterval(()=>{
    try{
      ensureRandomBasic();
      if(S.settings.theme!==lastTheme){
        lastTheme=S.settings.theme;
        if(S.settings.theme===RANDOM_THEME){
          window.__SWQ_RANDOM_BASIC_SESSION_COLOR__=false;
          applyRandomBasicEntryColor(true);
        }else{
          randomBasicDice=false;syncRandomBasicDice();
        }
      }
    }catch(e){}
  },1800);
})();

/* === SWQ road direction + helicopter visual layer 2026-09-20 === */
(function(){
  'use strict';
  try{
    const st=document.createElement('style');st.id='swq-road-cars-one-direction-20260920';
    st.textContent=[
      '.swq-road-car.reverse{animation-name:swqCarDrive!important;transform:none!important}',
      '.swq-road-helicopter{position:absolute;display:block;will-change:transform,opacity;pointer-events:none;animation:swqPlaneFly var(--dur,10s) linear forwards!important}',
      'body.theme-carretera .swq-road-helicopter{filter:drop-shadow(0 0 8px rgba(170,220,255,.62))}'
    ].join('');
    document.head.appendChild(st);
  }catch(e){}
})();

/* === SWQ MASTER STABILITY PATCH 2026-09-20 === */
(function(){
  'use strict';
  if(window.__SWQ_MASTER_STABILITY_20260920__)return;
  window.__SWQ_MASTER_STABILITY_20260920__=true;

  /* SOLAR: yellow-orange, with yellow clearly dominant. */
  try{
    if(typeof THEMES!=='undefined'&&THEMES.Solar){
      THEMES.Solar.a='#ffe86a';
      THEMES.Solar.b='#f28b16';
      THEMES.Solar.desc='Amarillo solar intenso con naranja cálido y pulsos de luz.';
    }
    const st=document.createElement('style');st.id='swq-master-solar-20260920';
    st.textContent='body.theme-solar{background:radial-gradient(circle at 50% -18%,#fff8a8 0,#ffe85b 24%,#ffc226 48%,#f28b16 70%,#8e3c0c 100%)!important;color:#fffbe8!important}'+
      'body.theme-solar .card,body.theme-solar .list-item,body.theme-solar .series,body.theme-solar .stat{background:linear-gradient(180deg,rgba(74,45,7,.94),rgba(30,15,5,.98))!important;border-color:rgba(255,228,101,.38)!important}'+
      'body.theme-solar .btn{background:linear-gradient(135deg,#fff19a 0,#ffe15a 45%,#ffbd22 74%,#f28b16 100%)!important;border-color:#fff0a2!important;color:#2a1704!important}'+
      'body.theme-solar .btn.primary{background:linear-gradient(135deg,#fff7b4,#ffe14d 48%,#f7a915)!important}'+
      'body.theme-solar .nav{background:rgba(49,25,4,.95)!important;border-top-color:rgba(255,224,93,.34)!important}';
    document.head.appendChild(st);
  }catch(e){}

  /* CARBON: falling particles are solid, not washed out by the base animation. */
  try{
    const st=document.createElement('style');st.id='swq-master-carbon-20260920';
    st.textContent='.swq-carbon-solid{opacity:1!important}'+
      'body.theme-carbon .theme-particle.goldbar{opacity:1!important;animation:swqCarbonSolidGold 5.5s linear forwards!important;background:linear-gradient(180deg,#fff7b0 0,#f0c63e 48%,#9b6c10 100%)!important;border-color:#fff2a0!important;box-shadow:inset 0 2px 0 rgba(255,255,255,.72),0 0 13px rgba(255,204,68,.62)!important}'+
      'body.theme-carbon .theme-particle.abyss{opacity:1!important;animation:swqCarbonSolidDot 4.8s linear forwards!important;background:#58dfd6!important;box-shadow:0 0 9px #58dfd6!important}';
    document.head.appendChild(st);
    const anim=document.createElement('style');
    anim.textContent='@keyframes swqCarbonSolidGold{0%{opacity:1;transform:translateY(-20px) rotate(0)}100%{opacity:1;transform:translateY(112vh) rotate(240deg)}}@keyframes swqCarbonSolidDot{0%{opacity:1;transform:translate3d(0,18px,0) scale(.5) rotate(0)}100%{opacity:1;transform:translate3d(var(--dx),-90px,0) scale(1.15) rotate(160deg)}}';
    document.head.appendChild(anim);
  }catch(e){}

  /* RANDOM BASIC STYLE: 210 coins, no normal effects, new color every full entry. */
  const RANDOM_THEME='RandomBasic',RANDOM_ID='theme_RandomBasic';
  let masterDice=false,masterDiceTimer=null;
  const RANDOM_COLORS=[
    ['#57d8ff','#2069d7'],['#7be7aa','#17734e'],['#ffe05b','#d98d00'],['#ff9b72','#d84c20'],
    ['#c99dff','#7135cb'],['#ff91c5','#bf417d'],['#7ca9ff','#3151b9'],['#edf7ff','#788ca4'],['#7cf2e1','#178f83']
  ];
  function ensureRandomBasic(){
    try{
      if(typeof THEMES==='undefined'||typeof SHOP==='undefined')return;
      THEMES[RANDOM_THEME]=THEMES[RANDOM_THEME]||{a:'#57d8ff',b:'#2069d7',emoji:'🎲',desc:''};
      THEMES[RANDOM_THEME].emoji='🎲';
      THEMES[RANDOM_THEME].desc='Estilo muy básico y sin efectos. Cada vez que entras al juego cambia de color. A veces aparece blanco y negro con dados cayendo.';
      let it=SHOP.find(x=>x.id===RANDOM_ID);
      if(!it)SHOP.push({id:RANDOM_ID,icon:'🎲',name:'Aleatorio Básico',price:210,desc:THEMES[RANDOM_THEME].desc,buy:()=>{S.purchases[RANDOM_ID]=true;}});
      else{it.icon='🎲';it.name='Aleatorio Básico';it.price=210;it.desc=THEMES[RANDOM_THEME].desc;it.buy=()=>{S.purchases[RANDOM_ID]=true;};}
    }catch(e){}
  }
  function clearMasterDice(){if(masterDiceTimer){clearInterval(masterDiceTimer);masterDiceTimer=null}document.getElementById('swq-master-dice')?.remove();}
  function startMasterDice(){
    clearMasterDice();
    if(S.settings.theme!==RANDOM_THEME||!masterDice)return;
    const host=document.createElement('div');host.id='swq-master-dice';
    Object.assign(host.style,{position:'fixed',inset:'0',zIndex:'45',pointerEvents:'none',overflow:'hidden'});
    document.body.appendChild(host);
    const spawn=()=>{
      if(S.settings.theme!==RANDOM_THEME||!masterDice){clearMasterDice();return}
      const d=document.createElement('span');d.textContent=['⚀','⚁','⚂','⚃','⚄','⚅'][Math.floor(Math.random()*6)];
      Object.assign(d.style,{position:'absolute',top:'-34px',left:(4+Math.random()*92)+'%',fontSize:'28px',color:'#111',fontWeight:'900',textShadow:'0 1px 0 #fff',animation:'swqMasterDiceFall 5.8s linear forwards'});
      d.style.setProperty('--drift',(-45+Math.random()*90)+'px');
      host.appendChild(d);setTimeout(()=>d.remove(),8500);
    };
    spawn();masterDiceTimer=setInterval(spawn,1150);
  }
  function chooseRandomBasic(){
    const variants=RANDOM_COLORS.map((pair,i)=>({pair,i,dice:false}));
    variants.push({pair:['#ffffff','#121212'],i:variants.length,dice:true});
    const prev=Number(localStorage.getItem('SWQ_RANDOM_BASIC_MASTER_VARIANT'));
    const available=variants.filter(x=>x.i!==prev);
    const chosen=available[Math.floor(Math.random()*available.length)];
    localStorage.setItem('SWQ_RANDOM_BASIC_MASTER_VARIANT',String(chosen.i));
    return chosen;
  }
  function applyRandomBasic(){
    ensureRandomBasic();
    if(S.settings.theme!==RANDOM_THEME)return;
    const chosen=chooseRandomBasic();
    THEMES[RANDOM_THEME].a=chosen.pair[0];THEMES[RANDOM_THEME].b=chosen.pair[1];
    masterDice=chosen.dice;
    document.documentElement.style.setProperty('--a',chosen.pair[0]);
    document.documentElement.style.setProperty('--b',chosen.pair[1]);
    window.__SWQ_RANDOM_BASIC_SESSION_COLOR__=true;
    clearMasterDice();
    if(typeof applyTheme==='function')applyTheme();
    startMasterDice();
  }
  try{const css=document.createElement('style');css.id='swq-master-random-basic-css';css.textContent='body.theme-randombasic{background:linear-gradient(180deg,var(--a),var(--b))!important;color:#fff!important}body.theme-randombasic .card{background:rgba(8,15,24,.84)!important;border-color:rgba(255,255,255,.20)!important;box-shadow:none!important}body.theme-randombasic .btn{background:var(--a)!important;color:#08111c!important;border-color:rgba(255,255,255,.35)!important;box-shadow:none!important;animation:none!important}body.theme-randombasic .btn.primary{background:var(--b)!important;color:#fff!important}@keyframes swqMasterDiceFall{0%{opacity:0;transform:translate3d(0,-12px,0) rotate(0deg)}10%{opacity:1}100%{opacity:1;transform:translate3d(var(--drift,0px),112vh,0) rotate(360deg)}}';document.head.appendChild(css)}catch(e){}

  /* CARRETERA: independent visible traffic layer, all cars left-to-right, helicopters guaranteed. */
  let masterRoadTimer=null,masterPlaneTimer=null,masterHeliTimer=null,masterRoadLayer=null;
  function clearMasterRoad(){
    if(masterRoadTimer){clearInterval(masterRoadTimer);masterRoadTimer=null}
    if(masterPlaneTimer){clearInterval(masterPlaneTimer);masterPlaneTimer=null}
    if(masterHeliTimer){clearInterval(masterHeliTimer);masterHeliTimer=null}
    document.getElementById('swqMasterRoadLayer')?.remove();masterRoadLayer=null;
  }
  function makeMasterRoad(){
    let host=document.getElementById('swqMasterRoadLayer');
    if(host)return host;
    host=document.createElement('div');host.id='swqMasterRoadLayer';
    host.innerHTML='<div class="swq-road-stars"></div><div class="swq-road-city"></div><div class="swq-road"></div><div class="swq-road-light l1"></div><div class="swq-road-light l2"></div><div class="swq-road-light l3"></div><div class="swq-road-light l4"></div>';
    Object.assign(host.style,{position:'fixed',inset:'0',zIndex:'1',pointerEvents:'none',overflow:'hidden'});
    document.body.appendChild(host);masterRoadLayer=host;return host;
  }
  function spawnMasterCar(){
    if(S.settings.theme!=='Carretera'||!masterRoadLayer)return;
    const el=document.createElement('span');el.className='swq-master-road-car swq-road-car';
    el.textContent=['🚗','🚙','🚕','🚌'][Math.floor(Math.random()*4)];
    el.style.top=(61+Math.random()*27)+'%';el.style.setProperty('--dur',(4.6+Math.random()*4.2)+'s');
    el.style.animation='swqMasterCarRide var(--dur,6s) linear forwards';
    el.style.animationName='swqMasterCarRide';el.style.transform='none';
    masterRoadLayer.appendChild(el);setTimeout(()=>el.remove(),10500);
  }
  function spawnMasterPlane(){
    if(S.settings.theme!=='Carretera'||!masterRoadLayer)return;
    const el=document.createElement('span');el.className='swq-master-road-plane';el.textContent=Math.random()<.6?'✈️':'🛫';
    el.style.top=(10+Math.random()*25)+'%';el.style.setProperty('--dur',(7+Math.random()*5)+'s');
    el.style.animation='swqMasterPlaneRide var(--dur,9s) linear forwards';masterRoadLayer.appendChild(el);setTimeout(()=>el.remove(),17000);
  }
  function spawnMasterHeli(){
    if(S.settings.theme!=='Carretera'||!masterRoadLayer)return;
    const el=document.createElement('span');el.className='swq-master-road-heli';el.textContent='🚁';
    el.style.top=(9+Math.random()*28)+'%';el.style.setProperty('--dur',(8.5+Math.random()*3.2)+'s');
    el.style.animation='swqMasterHeliRide var(--dur,10s) linear forwards';masterRoadLayer.appendChild(el);setTimeout(()=>el.remove(),15000);
  }
  function syncMasterRoad(){
    if(S.settings.theme!=='Carretera'){clearMasterRoad();return}
    const old=document.getElementById('swqRoadLayer');if(old)old.remove();
    const host=makeMasterRoad();
    if(!masterRoadTimer)masterRoadTimer=setInterval(()=>{if(!document.hidden){spawnMasterCar();if(Math.random()<.15)spawnMasterCar()}},1450);
    if(!masterPlaneTimer)masterPlaneTimer=setInterval(()=>{if(!document.hidden&&Math.random()<.30)spawnMasterPlane()},15000);
    if(!masterHeliTimer)masterHeliTimer=setInterval(()=>{if(!document.hidden)spawnMasterHeli()},8500);
    if(!host.querySelector('.swq-master-road-heli')&&!document.hidden)setTimeout(()=>{if(S.settings.theme==='Carretera')spawnMasterHeli()},650);
  }
  try{
    const css=document.createElement('style');css.id='swq-master-carretera-css';
    css.textContent='@keyframes swqMasterCarRide{from{transform:translateX(-18vw)}to{transform:translateX(118vw) translateY(-3vh)}}@keyframes swqMasterPlaneRide{from{transform:translateX(-18vw) translateY(0) scale(.85)}to{transform:translateX(118vw) translateY(-7vh) scale(1.05)}}@keyframes swqMasterHeliRide{from{transform:translateX(-18vw) translateY(0)}to{transform:translateX(118vw) translateY(-4vh)}}.swq-master-road-car{position:absolute;font-size:30px;white-space:nowrap;filter:drop-shadow(0 4px 8px rgba(0,0,0,.7));will-change:transform}.swq-master-road-plane{position:absolute;font-size:22px;opacity:.82;filter:drop-shadow(0 4px 8px rgba(0,0,0,.7));white-space:nowrap}.swq-master-road-heli{position:absolute;font-size:27px;opacity:1;filter:drop-shadow(0 0 9px rgba(170,220,255,.65));white-space:nowrap}';
    document.head.appendChild(css);
  }catch(e){}

  /* Pera: every user-side line becomes an internal thought, never invented speech. */
  function generalizePera(){
    try{
      if(typeof PEAR_TOPIC_DIALOGUES==='undefined'||!Array.isArray(PEAR_TOPIC_DIALOGUES))return;
      const pool=['💭 A veces me preocupa no estar avanzando como quisiera.','💭 Me cuesta no comparar mi progreso con lo que veo en otras personas.','💭 A veces siento presión por hacerlo bien.','💭 Me preocupa equivocarme en algo que me importa.','💭 Cuando algo sale mal, puedo pensar que es peor de lo que realmente es.','💭 Quiero mejorar sin sentir que tengo que ser perfecto.','💭 A veces me cuesta reconocer todo lo que sí he conseguido.','💭 Me pregunto si estoy tomando el camino correcto.','💭 Quiero aprender de otras personas sin convertirme en una copia.','💭 A veces me gustaría tener más confianza en mi propio progreso.','💭 Me cuesta saber cuánto de lo que siento viene de compararme.','💭 Quizá puedo seguir avanzando aunque hoy no vea una mejora.'];
      const clean=t=>String(t||'').replace(/\b(Juan|Mateo|Valeria)\b/gi,'otra persona').replace(/\b(carril\s+(tres|cuatro|1|2|3|4))\b/gi,'un carril').replace(/\b(el\s+sábado|este sábado|el domingo)\b/gi,'una próxima competencia');
      let n=0;
      for(const d of PEAR_TOPIC_DIALOGUES){
        if(!Array.isArray(d.lines))continue;
        for(const line of d.lines){
          if(!line)continue;
          if(line.speaker==='👤 TÚ'){line.speaker='💭 TÚ PIENSAS';line.text=pool[n++%pool.length]}
          else if(line.text)line.text=clean(line.text);
        }
      }
    }catch(e){}
  }

  /* GENDER: onboarding + real account creation, with custom text only for Otro. */
  function ensureGenderUIs(){
    try{
      const sel=document.getElementById('onGender');
      if(sel){
        const vals=['Masculino','Femenino','Prefiero no decirlo','Otro'];
        sel.innerHTML=vals.map(v=>'<option>'+v+'</option>').join('');
        let wrap=document.getElementById('onOtherGenderWrap');
        if(!wrap){wrap=document.createElement('div');wrap.id='onOtherGenderWrap';wrap.style.cssText='display:none;margin-top:7px';wrap.innerHTML='<input id="onOtherGender" maxlength="40" placeholder="Escribe tu género">';sel.parentNode.appendChild(wrap)}
        wrap.style.display=sel.value==='Otro'?'block':'none';
        sel.onchange=()=>{wrap.style.display=sel.value==='Otro'?'block':'none'};
      }
      const email=document.getElementById('authEmail');
      const name=document.getElementById('authUserName');
      if(name&&email&&!document.getElementById('authGender')){
        const row=document.createElement('div');row.className='field';row.innerHTML='<label>Género</label><select id="authGender"><option>Masculino</option><option>Femenino</option><option>Prefiero no decirlo</option><option>Otro</option></select><div id="authOtherGenderWrap" style="display:none;margin-top:7px"><input id="authOtherGender" maxlength="40" placeholder="Escribe tu género"></div>';
        name.parentNode.insertBefore(row,email);
        const gs=document.getElementById('authGender'),gw=document.getElementById('authOtherGenderWrap');gs.onchange=()=>{gw.style.display=gs.value==='Otro'?'block':'none'};
      }
    }catch(e){}
  }
  function readGender(id){
    const sel=document.getElementById(id);
    if(!sel)return 'Prefiero no decirlo';
    if(sel.value!=='Otro')return sel.value;
    const input=document.getElementById(id==='onGender'?'onOtherGender':'authOtherGender');
    return 'Otro: '+String(input?.value||'').trim().slice(0,40);
  }
  try{
    const originalCreate=window.createProfile;
    if(typeof originalCreate==='function'&&!window.__SWQ_MASTER_CREATE_PROFILE_GENDER__){
      window.createProfile=function(){
        ensureGenderUIs();
        const sel=document.getElementById('onGender');
        if(sel&&sel.value==='Otro'&&!String(document.getElementById('onOtherGender')?.value||'').trim()){toast('Escribe tu género para continuar.');return}
        const gender=readGender('onGender');
        if(sel){const old=sel.value;sel.value=gender;try{return originalCreate.apply(this,arguments)}finally{sel.value=old}}
        return originalCreate.apply(this,arguments);
      };
      window.__SWQ_MASTER_CREATE_PROFILE_GENDER__=true;
    }
  }catch(e){}
  try{
    const originalAuth=window.authModal;
    if(typeof originalAuth==='function'&&!window.__SWQ_MASTER_AUTH_MODAL_GENDER__){
      window.authModal=function(){const out=originalAuth.apply(this,arguments);setTimeout(ensureGenderUIs,0);return out};
      window.__SWQ_MASTER_AUTH_MODAL_GENDER__=true;
    }
  }catch(e){}
  try{
    const originalSignup=window.signUpReal;
    if(typeof originalSignup==='function'&&!window.__SWQ_MASTER_SIGNUP_GENDER__){
      window.signUpReal=async function(){
        ensureGenderUIs();
        const sel=document.getElementById('authGender');
        if(sel?.value==='Otro'&&!String(document.getElementById('authOtherGender')?.value||'').trim()){toast('Escribe tu género para continuar.');return}
        const gender=readGender('authGender');window.__SWQ_PENDING_SIGNUP_GENDER__=gender;
        let restore=null;
        try{
          if(typeof supabaseClient!=='undefined'&&supabaseClient?.auth?.signUp){
            const auth=supabaseClient.auth,baseSignUp=auth.signUp;
            auth.signUp=function(args){const next={...(args||{}),options:{...(args?.options||{}),data:{...(args?.options?.data||{}),gender}}};return baseSignUp.call(auth,next)};
            restore=()=>{auth.signUp=baseSignUp};
          }
          const out=await originalSignup.apply(this,arguments);
          if(S.profile){S.profile.gender=gender;save();}
          return out;
        }catch(e){throw e}finally{try{if(restore)restore()}catch(e){}}
      };
      window.__SWQ_MASTER_SIGNUP_GENDER__=true;
    }
  }catch(e){}

  /* ONE authoritative theme switch + modal. */
  function applyThemeMaster(k){
    try{
      ensureRandomBasic();
      if(!THEMES?.[k]){toast('⚠️ Ese estilo no existe.');return}
      if(k!=='Aqua'&&!S.purchases?.['theme_'+k]){toast('🔒 Ese estilo todavía no está desbloqueado.');return}
      S.settings.theme=k;
      if(k===RANDOM_THEME){window.__SWQ_RANDOM_BASIC_SESSION_COLOR__=false;applyRandomBasic();}
      else{masterDice=false;clearMasterDice();if(typeof applyTheme==='function')applyTheme();}
      save();closeModal();render();syncMasterRoad();
    }catch(e){console.warn('SWQ master theme switch',e)}
  }
  function openThemeMaster(){
    ensureRandomBasic();
    const themes=['Aqua',...Object.keys(THEMES||{})].filter((k,i,a)=>a.indexOf(k)===i&&THEMES[k]&&(k==='Aqua'||S.purchases?.['theme_'+k]));
    modal('<div class="kicker">🎨 PERSONALIZACIÓN</div><h2>Cambiar estilo</h2><p class="sub">Elige un estilo desbloqueado.</p><div class="grid g2" style="margin-top:10px">'+themes.map(k=>'<button type="button" class="btn '+(S.settings.theme===k?'primary':'secondary')+' swq-master-theme-choice" data-k="'+esc(k)+'" style="min-height:54px;text-align:left">'+esc(THEMES[k]?.emoji||'🎨')+' '+esc(typeof swqThemeName==='function'?swqThemeName(k):k)+(S.settings.theme===k?' · ACTUAL':'')+'</button>').join('')+'</div><button type="button" id="swq-master-theme-close" class="btn secondary" style="margin-top:10px">Cerrar</button>');
    document.querySelectorAll('.swq-master-theme-choice').forEach(b=>b.addEventListener('click',()=>applyThemeMaster(b.dataset.k)));
    document.getElementById('swq-master-theme-close')?.addEventListener('click',closeModal);
  }
  window.swqQuickTheme=openThemeMaster;
  window.swqApplyQuickTheme=applyThemeMaster;
  window.equipTheme=applyThemeMaster;

  /* Reapply non-destructively after renders and on entry. */
  const oldRender=window.render;
  if(typeof oldRender==='function'&&!window.__SWQ_MASTER_RENDER_WRAP__){
    window.render=function(){
      const out=oldRender.apply(this,arguments);
      try{ensureRandomBasic();ensureGenderUIs();generalizePera();if(S.settings.theme===RANDOM_THEME&&!window.__SWQ_RANDOM_BASIC_SESSION_COLOR__)applyRandomBasic();syncMasterRoad();}catch(e){}
      return out;
    };
    window.__SWQ_MASTER_RENDER_WRAP__=true;
  }
  try{ensureRandomBasic();ensureGenderUIs();generalizePera();if(S.settings.theme===RANDOM_THEME)applyRandomBasic();syncMasterRoad()}catch(e){}
  const observer=new MutationObserver(()=>{try{ensureGenderUIs();generalizePera();}catch(e){}});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setInterval(()=>{try{ensureRandomBasic();ensureGenderUIs();generalizePera();syncMasterRoad()}catch(e){}},5000);
})();
/* === SWQ PEAR FLOAT + XP TEXT + CINEMA CALM + COACH + FISH SECRET 2026-09-20 === */
(function(){
  'use strict';
  if(window.__SWQ_FINAL_20260920_SECRET_UPDATE__)return;
  window.__SWQ_FINAL_20260920_SECRET_UPDATE__=true;

  /* Pera: when Banana exists, her floating bubbles are anchored above Banana. */
  try{
    if(typeof startPearFloatingPhrases==='function'&&!window.__SWQ_PEAR_FLOAT_ABOVE_BANANA__){
      startPearFloatingPhrases=function(){
        if(typeof pearFloatTimer!=='undefined'&&pearFloatTimer)clearInterval(pearFloatTimer);
        pearFloatTimer=setInterval(()=>{
          if(!S.purchases?.pear||document.hidden)return;
          const pear=$("pearPet"),banana=$("bananaPet");
          if(!pear)return;
          const b=document.createElement('div');
          b.className='pear-floating-phrase';
          b.textContent=PEAR_FLOAT_PHRASES[Math.floor(Math.random()*PEAR_FLOAT_PHRASES.length)];
          document.body.appendChild(b);

          const target=(banana&&banana.classList.contains('visible'))?banana:pear;
          const r=target.getBoundingClientRect();
          const right=Math.max(8,window.innerWidth-r.right+8);
          const top=Math.max(8,r.top-b.offsetHeight-10);
          b.style.position='fixed';
          b.style.right=right+'px';
          b.style.top=top+'px';
          b.style.zIndex='60';
          setTimeout(()=>b.remove(),3600);
        },12000);
      };
      window.__SWQ_PEAR_FLOAT_ABOVE_BANANA__=true;
    }
    const st=document.createElement('style');
    st.id='swq-pear-float-above-banana-20260920';
    st.textContent='.pear-floating-phrase{z-index:60!important}';
    document.head.appendChild(st);
  }catch(e){}

  /* XP consumables: descriptions contain only the useful effect, never old-vs-new comparisons. */
  function cleanXPConsumableDescriptions(){
    try{
      const descs={
        xp500:'Gema de XP. Otorga 650 XP.',
        xp1500:'Gema de XP. Otorga 1.950 XP.',
        xpJuan:'Gema de XP especial. Otorga 13.000 XP.'
      };
      for(const [id,desc] of Object.entries(descs)){
        const it=SHOP?.find?.(x=>x.id===id);
        if(it)it.desc=desc;
      }
    }catch(e){}
  }
  cleanXPConsumableDescriptions();

  /* Absolute Cinema: slower and softer, with more breathing room and a calmer atmosphere.
     Original composition; this only changes its musical character and timing. */
  try{
    if(typeof MUSIC_TRACKS!=='undefined'&&MUSIC_TRACKS.absoluteCinema){
      const t=MUSIC_TRACKS.absoluteCinema;
      t.tempo=500;
      t.type='sine';
      t.accent=8;
      t.notes=[
        440.00,415.30,392.00,369.99,349.23,369.99,392.00,415.30,
        392.00,369.99,349.23,329.63,349.23,369.99,392.00,440.00,
        493.88,440.00,415.30,392.00,369.99,349.23,329.63,349.23,
        369.99,392.00,415.30,440.00,493.88,523.25,493.88,440.00,

        392.00,415.30,440.00,493.88,523.25,587.33,523.25,493.88,
        440.00,415.30,392.00,415.30,440.00,493.88,523.25,587.33,
        659.25,587.33,523.25,493.88,440.00,493.88,523.25,587.33,
        659.25,698.46,659.25,587.33,523.25,493.88,440.00,392.00,

        440.00,493.88,523.25,587.33,659.25,698.46,659.25,587.33,
        523.25,587.33,659.25,739.99,698.46,659.25,587.33,523.25,
        493.88,523.25,587.33,659.25,739.99,783.99,739.99,698.46,
        659.25,698.46,739.99,830.61,783.99,739.99,698.46,659.25,

        587.33,659.25,739.99,830.61,880.00,830.61,783.99,739.99,
        698.46,739.99,830.61,987.77,880.00,830.61,783.99,739.99,
        698.46,783.99,880.00,987.77,1046.50,987.77,880.00,783.99,
        739.99,830.61,987.77,1108.73,1046.50,987.77,880.00,830.61,

        783.99,739.99,698.46,659.25,587.33,523.25,587.33,659.25,
        698.46,739.99,830.61,783.99,739.99,698.46,659.25,587.33,
        523.25,587.33,659.25,698.46,739.99,698.46,659.25,587.33,
        523.25,493.88,440.00,415.30,440.00,493.88,523.25,587.33
      ];
      t.bass=[
        55.00,61.74,65.41,73.42,49.00,55.00,58.27,65.41,
        61.74,73.42,82.41,65.41,55.00,58.27,61.74,73.42,
        65.41,73.42,82.41,98.00,73.42,65.41,55.00,49.00,
        61.74,73.42,82.41,98.00,82.41,73.42,65.41,55.00
      ];
    }
  }catch(e){console.warn('SWQ calm Absolute Cinema',e)}

  /* Final completion: Pera and Pez both congratulate the player upon reaching Coach Mati. */
  function coachMatiCelebration(){
    S.secret=S.secret||{};
    const seen=!!S.secret.coachMatiCelebrationSeen;
    S.secret.coachMatiCelebrationSeen=true;
    try{save();}catch(e){}
    modal(
      '<div class="reveal" style="text-align:center">'+
      '<div style="font-size:58px">🍐</div>'+
      '<div class="kicker">🍐 PERA</div>'+
      '<h1>Lo lograste.</h1>'+
      '<p class="sub" style="font-size:16px;line-height:1.55">Llegaste hasta Coach Mati. Todo ese historial de sesiones, metros, días buenos y días complicados terminó formando algo enorme. No fue una sola sesión: fue la suma de todas.</p>'+
      '<button class="btn primary" style="margin-top:14px" onclick="window.swqCoachFishCelebration()">Siguiente → 🐟</button>'+
      '</div>'
    );
  }
  window.swqCoachMatiCelebration=coachMatiCelebration;
  window.swqCoachFishCelebration=function(){
    modal(
      '<div class="reveal" style="text-align:center">'+
      '<div style="font-size:58px">🐟</div>'+
      '<div class="kicker">🐟 PEZ</div>'+
      '<h1>Coach Mati.</h1>'+
      '<p class="sub" style="font-size:16px;line-height:1.55">No soy bueno para discursos largos.</p>'+
      '<p class="sub" style="font-size:16px;line-height:1.55">Pero... lo hiciste.</p>'+
      '<p class="sub" style="font-size:16px;line-height:1.55">Nadaste. Volviste. Seguiste.</p>'+
      '<p class="sub" style="font-size:16px;line-height:1.55">Eso basta.</p>'+
      '<button class="btn primary" style="margin-top:14px" onclick="closeModal()">🌊 Continuar</button>'+
      '</div>'
    );
  };

  try{
    if(typeof rankReveal==='function'&&!window.__SWQ_COACH_RANK_WRAP__){
      const baseRankReveal=rankReveal;
      rankReveal=function(r){
        const wasCoach=r?.c==='coach';
        const out=baseRankReveal.apply(this,arguments);
        if(wasCoach){
          const btn=document.querySelector('.rank-promo .btn.primary');
          if(btn){
            btn.onclick=function(){closeModal();setTimeout(()=>coachMatiCelebration(),180)};
          }
          if(S.secret?.coachMatiCelebrationSeen){
            /* The achievement remains unlocked, but the final congratulations are only shown once. */
            btn.onclick=function(){closeModal()};
          }
        }
        return out;
      };
      window.__SWQ_COACH_RANK_WRAP__=true;
    }
  }catch(e){}

  /* Secret Fish conversation: 1 coin, short phrases, one topic not used by Pera,
     and a two-way A/B branch with different conclusions. */
  S.secret=S.secret||{};
  if(typeof S.secret.fishConversationPurchased!=='boolean')S.secret.fishConversationPurchased=false;
  if(typeof S.secret.fishConversationPath!=='string')S.secret.fishConversationPath='';
  if(typeof S.secret.fishConversationSeen!=='boolean')S.secret.fishConversationSeen=false;

  const FISH_SECRET_ID='fishConversationSecret';

  function fishConversationModal(step){
    const commonButton=label=>'<button class="btn secondary" style="margin-top:9px" onclick="closeModal()">Cerrar</button>';
    const screens={
      intro:
        '<div class="reveal">'+
        '<div class="kicker">🐟 CONVERSACIÓN SECRETA</div>'+
        '<h2>El Pez habla distinto</h2>'+
        '<p class="sub">🐟 No soy bueno para conversar.</p>'+
        '<p class="sub">🐟 Pera sabe llenar silencios.</p>'+
        '<p class="sub">🐟 Yo solo recuerdo frases cortas.</p>'+
        '<p class="sub">🐟 Esta es una de las pocas cosas que puedo contar.</p>'+
        '<div class="card" style="margin-top:10px;background:#0b2235"><div class="kicker">🐟 TEMA</div><div class="sub">¿Qué haces con un momento sencillo que algún día podrías extrañar?</div></div>'+
        '<p class="sub" style="margin-top:10px">Elige una respuesta.</p>'+
        '<div class="grid g2" style="margin-top:9px">'+
        '<button class="btn primary" onclick="window.swqFishSecretChoice(\'A\')">A · Guardaría uno para siempre.</button>'+
        '<button class="btn secondary" onclick="window.swqFishSecretChoice(\'B\')">B · Dejaría espacio para los siguientes.</button>'+
        '</div>'+commonButton('Cerrar')+
        '</div>',
      A:
        '<div class="reveal">'+
        '<div style="font-size:48px;text-align:center">🐟</div><div class="kicker">PEZ</div>'+
        '<p class="sub">🐟 Buena respuesta.</p><p class="sub">🐟 Yo no guardo muchos.</p><p class="sub">🐟 Pero recuerdo uno: luz sobre el agua.</p>'+
        '<p class="sub">🐟 Nadie dijo nada. No pasó nada grande.</p><p class="sub">🐟 Por eso quizá lo recuerdo.</p>'+
        '<p class="sub">🐟 Lo pequeño también puede quedarse.</p>'+
        '<div class="card" style="margin-top:10px"><b>Conclusión A</b><div class="sub" style="margin-top:5px">No necesitas que un momento sea extraordinario para que merezca un lugar en tu memoria.</div></div>'+
        '<button class="btn primary" style="margin-top:12px" onclick="closeModal()">🌊 Entendido</button>'+
        '</div>',
      B:
        '<div class="reveal">'+
        '<div style="font-size:48px;text-align:center">🐟</div><div class="kicker">PEZ</div>'+
        '<p class="sub">🐟 También sirve.</p><p class="sub">🐟 Yo dejo ir casi todo.</p><p class="sub">🐟 El agua no guarda huellas mucho tiempo.</p>'+
        '<p class="sub">🐟 A veces olvidar abre espacio.</p><p class="sub">🐟 Luego aparece algo nuevo.</p>'+
        '<p class="sub">🐟 Y quizá eso también sea recordar.</p>'+
        '<div class="card" style="margin-top:10px"><b>Conclusión B</b><div class="sub" style="margin-top:5px">Dejar ir un momento no lo convierte en inútil; a veces simplemente prepara espacio para lo que viene.</div></div>'+
        '<button class="btn primary" style="margin-top:12px" onclick="closeModal()">🌊 Entendido</button>'+
        '</div>'
    };
    modal(screens[step]||screens.intro);
  }
  window.swqFishSecretChoice=function(path){
    S.secret.fishConversationPath=path;
    S.secret.fishConversationSeen=true;
    save();
    fishConversationModal(path);
  };
  window.swqOpenFishSecret=function(){
    if(!S.secret.fishConversationPurchased){toast('🐟 Primero compra la conversación secreta.');return}
    fishConversationModal('intro');
  };
  window.swqBuyFishSecretConversation=function(){
    if(S.secret.fishConversationPurchased){fishConversationModal('intro');return}
    if(Number(S.coins||0)<1){toast('🪙 Te falta 1 moneda.');return}
    S.coins-=1;
    S.secret.fishConversationPurchased=true;
    save();
    tone('coin');
    closeModal();
    render();
    setTimeout(()=>fishConversationModal('intro'),180);
  };

  function injectFishSecretOffer(){
    try{
      const grid=document.querySelector('.fish-shop-grid');
      if(!grid)return;
      document.getElementById('swqFishSecretConversationCard')?.remove();
      const purchased=!!S.secret.fishConversationPurchased;
      const card=document.createElement('div');
      card.id='swqFishSecretConversationCard';
      card.className='fish-shop-card';
      card.innerHTML=
        '<div style="font-size:42px">💬</div>'+
        '<h3>Conversación secreta</h3>'+
        '<div class="sub">El Pez tiene una conversación que nunca le contó a la Pera. Solo frases cortas, recuerdos y una decisión con dos caminos.</div>'+
        '<button class="btn primary" style="margin-top:8px">'+(purchased?'💬 Hablar · Gratis':'💬 Comprar · 1 🪙')+'</button>';
      card.querySelector('button').onclick=purchased?window.swqOpenFishSecret:window.swqBuyFishSecretConversation;
      grid.appendChild(card);
    }catch(e){}
  }

  try{
    if(typeof openFishShop==='function'&&!window.__SWQ_FISH_SHOP_SECRET_WRAP__){
      const baseOpenFishShop=openFishShop;
      openFishShop=function(){
        const out=baseOpenFishShop.apply(this,arguments);
        setTimeout(injectFishSecretOffer,30);
        return out;
      };
      window.openFishShop=openFishShop;
      window.__SWQ_FISH_SHOP_SECRET_WRAP__=true;
    }
  }catch(e){}

  /* Reinforce on shop refreshes, keeping all existing shop cards untouched. */
  const fixTimer=setInterval(()=>{
    try{
      cleanXPConsumableDescriptions();
      if(document.querySelector('.fish-shop-grid'))injectFishSecretOffer();
    }catch(e){}
  },2500);
})();


/* === SWQ FINAL 5X2 PATCH v2 2026-09-20 === */
(function(){
  'use strict';
  if(window.__SWQ_FINAL_5X2_PATCH_V2__)return;
  window.__SWQ_FINAL_5X2_PATCH_V2__=true;

  /* Absolute Cinema: keep the calm 500ms pulse, lift the beginning a little,
     and deliberately settle into a lower register at the end. */
  try{
    const t=MUSIC_TRACKS?.absoluteCinema;
    if(t){
      t.tempo=500;t.type='sine';t.accent=8;
      if(Array.isArray(t.notes)){
        t.notes=t.notes.map((n,i)=>{
          const f=i<24?Math.pow(2,2/12):i>=144?Math.pow(2,-5/12):1;
          return Math.round(n*f*100)/100;
        });
      }
    }
  }catch(e){console.warn('SWQ Cinema arc v2',e)}

  /* Random Basic: dice are no longer tied to the black/white variant. */
  let diceTimer=null;
  function stopDice(){
    if(diceTimer){clearInterval(diceTimer);diceTimer=null}
    document.getElementById('swqRandomDiceAlways')?.remove();
    document.getElementById('swq-master-dice')?.remove();
    document.getElementById('swqRandomBasicDiceLayer')?.remove();
  }
  function startDice(){
    if(S.settings.theme!=='RandomBasic'){stopDice();return}
    if(diceTimer&&document.getElementById('swqRandomDiceAlways'))return;
    stopDice();
    const host=document.createElement('div');host.id='swqRandomDiceAlways';
    Object.assign(host.style,{position:'fixed',inset:'0',zIndex:'45',pointerEvents:'none',overflow:'hidden'});
    document.body.appendChild(host);
    const spawn=()=>{
      if(S.settings.theme!=='RandomBasic'){stopDice();return}
      const d=document.createElement('span');
      d.textContent=['⚀','⚁','⚂','⚃','⚄','⚅'][Math.floor(Math.random()*6)];
      Object.assign(d.style,{position:'absolute',top:'-35px',left:(3+Math.random()*94)+'%',fontSize:(25+Math.random()*10)+'px',color:'#111',fontWeight:'900',textShadow:'0 1px 0 #fff',animation:'swqDiceAlwaysFall 5.5s linear forwards'});
      d.style.setProperty('--drift',(-60+Math.random()*120)+'px');
      host.appendChild(d);setTimeout(()=>d.remove(),8000);
    };
    spawn();diceTimer=setInterval(spawn,1050);
  }
  try{
    const st=document.createElement('style');st.id='swq-dice-always-css';
    st.textContent='@keyframes swqDiceAlwaysFall{0%{opacity:0;transform:translate3d(0,-10px,0) rotate(0deg)}10%{opacity:1}100%{opacity:1;transform:translate3d(var(--drift,0px),112vh,0) rotate(360deg)}}';
    document.head.appendChild(st);
  }catch(e){}

  /* Style button: same interaction pattern as Change Music, but style-only. */
  function ownedStyles(){
    const out=['Aqua'];
    try{for(const k of Object.keys(THEMES||{})){if(k!=='Aqua'&&S.purchases?.['theme_'+k])out.push(k)}}catch(e){}
    return [...new Set(out)];
  }
  function applyStyle(k){
    if(!THEMES?.[k])return;
    if(k!=='Aqua'&&!S.purchases?.['theme_'+k]){toast('🔒 Ese estilo todavía no está desbloqueado.');return}
    S.settings.theme=k;
    save();
    if(typeof applyTheme==='function')applyTheme();
    closeModal();render();
    if(k==='RandomBasic'){window.__SWQ_RANDOM_BASIC_SESSION_COLOR__=false;setTimeout(startDice,70)}
    else stopDice();
  }
  window.swqQuickTheme=function(){
    const opts=ownedStyles().map(k=>'<option value="'+esc(k)+'" '+(S.settings.theme===k?'selected':'')+'>'+esc(THEMES[k]?.emoji||'🎨')+' '+esc(typeof swqThemeName==='function'?swqThemeName(k):k)+'</option>').join('');
    modal('<div class="kicker">🎨 ESTILO</div><h2>Elegir estilo</h2><div class="field" style="margin-top:10px"><select id="swqStyleV2" style="width:100%">'+opts+'</select></div><button type="button" id="swqStyleV2Apply" class="btn primary" style="margin-top:8px">Usar estilo</button><button type="button" class="btn secondary" style="margin-top:8px" onclick="closeModal()">Cerrar</button>');
    document.getElementById('swqStyleV2Apply')?.addEventListener('click',()=>applyStyle(document.getElementById('swqStyleV2')?.value||'Aqua'));
  };
  window.swqApplyQuickTheme=applyStyle;
  window.equipTheme=applyStyle;
  try{equipTheme=applyStyle}catch(e){}

  /* Fish secret: 5 deterministic A/B questions = exactly 32 deterministic endings.
     Each screen is a dedicated scene like Pera: one fish message + two responses. */
  S.secret=S.secret||{};
  if(typeof S.secret.fishConversationPurchased!=='boolean')S.secret.fishConversationPurchased=false;
  if(typeof S.secret.fishConversationPath!=='string')S.secret.fishConversationPath='';
  if(typeof S.secret.fishConversationSeen!=='boolean')S.secret.fishConversationSeen=false;

  const questions=[
    {t:'🐟 Si tu plan cambia de repente, ¿qué haces?',a:'A · Ajusto el plan y sigo.',b:'B · Intento mantenerlo como estaba.'},
    {t:'🐟 Haces algo bien y casi nadie lo nota. ¿Qué te importa más?',a:'A · Saber que avancé, aunque sea poco.',b:'B · Que el avance se note de verdad.'},
    {t:'🐟 Alguien avanza más rápido que tú. ¿Qué aparece primero en tu cabeza?',a:'A · Puedo aprender algo de esa persona.',b:'B · Tengo que alcanzarla.'},
    {t:'🐟 Una sesión sale mal. ¿Qué haces después?',a:'A · La analizo y vuelvo a intentarlo.',b:'B · Me alejo un rato antes de volver.'},
    {t:'🐟 Llegas a algo que buscaste durante mucho tiempo. ¿Qué haces con ese momento?',a:'A · Lo disfruto y agradezco el camino.',b:'B · Pienso en demostrar que lo merecía.'}
  ];

  const reactionsA=[
    '🐟 Entonces sabes cambiar sin perderte.',
    '🐟 Entiendo. No todos miran el progreso del mismo modo.',
    '🐟 Eso suena a curiosidad, no solo a prisa.',
    '🐟 Está bien. A veces volver empieza por entender.',
    '🐟 Supongo que sabes reconocer un momento cuando llega.'
  ];
  const reactionsB=[
    '🐟 Entonces el plan también significa algo para ti.',
    '🐟 Entiendo. Quieres que el esfuerzo tenga una señal visible.',
    '🐟 Ah. Entonces no te gusta quedarte detrás.',
    '🐟 Está bien. Algunos necesitan distancia antes de volver.',
    '🐟 Entiendo. También quieres que quede claro que te lo ganaste.'
  ];

  const endings=[
    '00000','00001','00010','00011','00100','00101','00110','00111',
    '01000','01001','01010','01011','01100','01101','01110','01111',
    '10000','10001','10010','10011','10100','10101','10110','10111',
    '11000','11001','11010','11011','11100','11101','11110','11111'
  ];

  const endingText={};
  const planA='flexible con los cambios';const planB='fiel a tus planes';
  const progressA='valoras los avances pequeños';const progressB='necesitas señales visibles de progreso';
  const rivalA='aprendes de quien va delante';const rivalB='quieres alcanzarlo';
  const failA='conviertes el error en información';const failB='necesitas distancia antes de regresar';
  const finishA='puedes disfrutar la meta por lo que significa';const finishB='quieres demostrar que la meta fue merecida';

  endings.forEach((code)=>{
    const bits=[...code].map(x=>x==='1');
    const attrs=[
      bits[0]?planB:planA,
      bits[1]?progressB:progressA,
      bits[2]?rivalB:rivalA,
      bits[3]?failB:failA,
      bits[4]?finishB:finishA
    ];
    const thought=
      'Pienso que eres alguien '+attrs[0]+', que '+attrs[1]+', que '+attrs[2]+', que '+attrs[3]+' y que, al llegar a algo importante, '+attrs[4]+'.';
    const final=
      'Después de escucharte cinco veces, esto es lo que me queda: '+attrs[0]+'. '+attrs[1].charAt(0).toUpperCase()+attrs[1].slice(1)+'. '+attrs[2].charAt(0).toUpperCase()+attrs[2].slice(1)+'. '+attrs[3].charAt(0).toUpperCase()+attrs[3].slice(1)+'. Y '+attrs[4]+'. '+(
        bits.filter(Boolean).length>=3
        ?'No creo que tengas que cambiar quién eres; solo recordar cuándo empujar y cuándo respirar.'
        :'No me parece que necesites convertir todo en una prueba; también cuenta saber por qué sigues nadando.'
      );
    endingText[code]={thought,final};
  });

  let path='',step=0;
  function fishMusicStop(){
    if(window.__swqFishV2Timer){clearInterval(window.__swqFishV2Timer);window.__swqFishV2Timer=null}
    if(window.__swqFishV2Ctx){try{window.__swqFishV2Ctx.close()}catch(e){}window.__swqFishV2Ctx=null}
  }
  function fishMusicStart(){
    try{
      fishMusicStop();const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
      const c=new AC(),notes=[146.83,174.61,196,220,196,174.61,164.81,146.83];let i=0;window.__swqFishV2Ctx=c;
      window.__swqFishV2Timer=setInterval(()=>{
        const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=notes[i++%notes.length];
        g.gain.setValueAtTime(.0001,c.currentTime);g.gain.exponentialRampToValueAtTime(.032,c.currentTime+.03);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.45);
        o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+.47);
      },560);
    }catch(e){}
  }
  function closeFishScene(){
    fishMusicStop();document.getElementById('swqFishSecretSceneV2')?.remove();
    if(S.settings.music&&typeof restartAmbient==='function')restartAmbient();
  }
  function renderFishScene(){
    const old=document.getElementById('swqFishSecretSceneV2');if(old)old.remove();
    const q=questions[step];if(!q)return;
    const scene=document.createElement('div');scene.id='swqFishSecretSceneV2';scene.className='swq-fish-v2-scene';
    scene.innerHTML='<div class="swq-fish-v2-glow"></div><div class="swq-fish-v2-bubbles"><i></i><i></i><i></i><i></i><i></i></div><div class="swq-fish-v2-stage"><div class="swq-fish-v2-fish">🐟</div><div class="swq-fish-v2-speaker">🐟 PEZ</div><div class="swq-fish-v2-text">'+esc(q.t)+'</div><div class="swq-fish-v2-choices"><button class="swq-fish-v2-choice" data-c="A" type="button">'+esc(q.a)+'</button><button class="swq-fish-v2-choice" data-c="B" type="button">'+esc(q.b)+'</button></div><button class="swq-fish-v2-exit" type="button">Salir</button></div>';
    document.body.appendChild(scene);
    scene.querySelectorAll('.swq-fish-v2-choice').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.c)));
    scene.querySelector('.swq-fish-v2-exit')?.addEventListener('click',closeFishScene);
    fishMusicStart();
  }
  function choose(c){
    if(c!=='A'&&c!=='B')return;
    path+=c;S.secret.fishConversationPath=path;S.secret.fishConversationSeen=true;save();
    if(step<questions.length-1){step++;renderFishScene();return}
    showEnding();
  }
  function showEnding(){
    const e=endingText[path];if(!e){closeFishScene();return}
    fishMusicStop();
    const scene=document.getElementById('swqFishSecretSceneV2');if(!scene)return;
    scene.innerHTML='<div class="swq-fish-v2-glow"></div><div class="swq-fish-v2-stage final"><div class="swq-fish-v2-fish">🐟</div><div class="swq-fish-v2-speaker">🐟 PEZ</div><div class="swq-fish-v2-text">'+esc(e.final)+'</div><div class="swq-fish-v2-thought"><div class="kicker">🐟 LO QUE PIENSO DE TI</div><div>'+esc(e.thought)+'</div></div><button class="swq-fish-v2-done" type="button">Terminar conversación</button></div>';
    scene.querySelector('.swq-fish-v2-done')?.addEventListener('click',()=>{save();closeFishScene()});
    fishMusicStart();
  }
  window.swqOpenFishSecret=function(){
    if(!S.secret.fishConversationPurchased){toast('🐟 Primero compra la conversación secreta.');return}
    path='';step=0;S.secret.fishConversationPath='';save();
    if(typeof ambientStop==='function')ambientStop();
    renderFishScene();
  };
  window.swqBuyFishSecretConversation=function(){
    if(S.secret.fishConversationPurchased){window.swqOpenFishSecret();return}
    if(Number(S.coins||0)<1){toast('🪙 Te falta 1 moneda.');return}
    S.coins-=1;S.secret.fishConversationPurchased=true;S.secret.fishConversationPath='';S.secret.fishConversationSeen=false;save();
    if(typeof tone==='function')tone('coin');closeModal();render();setTimeout(window.swqOpenFishSecret,180);
  };
  try{
    const wrap=()=>{const card=document.getElementById('swqFishSecretConversationCard');if(!card)return;const b=card.querySelector('button');if(!b)return;const owned=!!S.secret.fishConversationPurchased;b.textContent=owned?'💬 Hablar · Gratis':'💬 Comprar · 1 🪙';b.onclick=owned?window.swqOpenFishSecret:window.swqBuyFishSecretConversation;};
    setInterval(wrap,1200);setTimeout(wrap,50);
  }catch(e){}

  try{
    const css=document.createElement('style');css.id='swq-fish-v2-css';
    css.textContent=
      '.swq-fish-v2-scene{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(circle at 50% 20%,#165071 0,#09283e 38%,#03111c 100%);color:#eafaff;overflow:hidden}'+
      '.swq-fish-v2-stage{width:min(760px,100%);min-height:82vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;position:relative;z-index:2}.swq-fish-v2-stage.final{max-width:820px}'+
      '.swq-fish-v2-fish{font-size:96px;filter:drop-shadow(0 8px 20px rgba(66,221,255,.3));animation:swqFishFloatV2 3.2s ease-in-out infinite}.swq-fish-v2-speaker{margin:12px 0 8px;color:#82eaff;font-weight:1000;letter-spacing:1px}'+
      '.swq-fish-v2-text{width:min(720px,100%);min-height:190px;display:flex;align-items:center;justify-content:center;font-size:20px;line-height:1.7;text-shadow:0 2px 10px rgba(0,0,0,.28)}'+
      '.swq-fish-v2-choices{width:min(720px,100%);display:grid;grid-template-columns:1fr 1fr;gap:10px}.swq-fish-v2-choice{min-height:62px;border-radius:18px;border:1px solid rgba(126,232,255,.35);background:rgba(8,31,49,.9);color:#effcff;font-size:15px;font-weight:1000;padding:10px 14px}.swq-fish-v2-choice:first-child{background:linear-gradient(135deg,#1e799f,#0a344b)}.swq-fish-v2-choice:last-child{background:linear-gradient(135deg,#274f80,#0b2138)}'+
      '.swq-fish-v2-exit{margin-top:12px;border:1px solid rgba(126,232,255,.2);background:none;color:#9ccada;border-radius:14px;padding:8px 14px;font-size:12px}.swq-fish-v2-thought{width:min(700px,100%);margin-top:10px;padding:14px 16px;border-radius:18px;border:1px solid rgba(126,232,255,.22);background:rgba(5,24,39,.7);line-height:1.55;color:#d0edf5}.swq-fish-v2-done{margin-top:16px;min-height:52px;border:0;border-radius:17px;padding:12px 22px;background:#1e799f;color:#fff;font-weight:1000}'+
      '.swq-fish-v2-glow{position:absolute;width:340px;height:340px;border-radius:50%;left:50%;top:32%;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(72,221,255,.15),transparent 68%);filter:blur(8px)}.swq-fish-v2-bubbles i{position:absolute;bottom:-40px;width:9px;height:9px;border:1px solid rgba(180,240,255,.35);border-radius:50%;animation:swqFishBubbleV2 7s linear infinite;opacity:.5}.swq-fish-v2-bubbles i:nth-child(1){left:12%;animation-delay:-1s}.swq-fish-v2-bubbles i:nth-child(2){left:29%;width:13px;height:13px;animation-delay:-5s}.swq-fish-v2-bubbles i:nth-child(3){left:54%;animation-delay:-3s}.swq-fish-v2-bubbles i:nth-child(4){left:75%;width:14px;height:14px;animation-delay:-6s}.swq-fish-v2-bubbles i:nth-child(5){left:88%;animation-delay:-2s}'+
      '@keyframes swqFishFloatV2{50%{transform:translateY(-8px) rotate(-2deg) scale(1.03)}}@keyframes swqFishBubbleV2{0%{transform:translateY(0);opacity:0}15%{opacity:.5}100%{transform:translateY(-110vh) translateX(18px);opacity:0}}@media(max-width:640px){.swq-fish-v2-choices{grid-template-columns:1fr}.swq-fish-v2-text{font-size:18px;min-height:170px}.swq-fish-v2-fish{font-size:78px}}';
    document.head.appendChild(css);
  }catch(e){}

  setInterval(()=>{try{if(S.settings.theme==='RandomBasic')startDice();else stopDice()}catch(e){}},3000);
  try{if(S.settings.theme==='RandomBasic')startDice();}catch(e){}
})();



/* === SWQ FINAL STYLE SELECT + FISH POSITION 2026-09-20 === */
(function(){
  'use strict';
  if(window.__SWQ_FINAL_STYLE_SELECT_FISH_POS__)return;
  window.__SWQ_FINAL_STYLE_SELECT_FISH_POS__=true;

  /* Pez Motivador: slightly higher on the profile, without changing its layout size. */
  try{
    const st=document.createElement('style');
    st.id='swq-final-fish-position-css';
    st.textContent='.profile-fish{transform:translateY(-9px)!important}';
    document.head.appendChild(st);
  }catch(e){}

  function ownedStylesFinal(){
    const out=['Aqua'];
    try{
      for(const k of Object.keys(THEMES||{})){
        if(k!=='Aqua'&&S.purchases?.['theme_'+k])out.push(k);
      }
    }catch(e){}
    return [...new Set(out)];
  }
  function applyStyleFinal(k){
    try{
      if(!THEMES?.[k])return;
      if(k!=='Aqua'&&!S.purchases?.['theme_'+k]){
        toast('🔒 Ese estilo todavía no está desbloqueado.');
        return;
      }
      S.settings.theme=k;
      save();
      if(typeof applyTheme==='function')applyTheme();
      closeModal();
      render();
    }catch(e){console.warn('SWQ final style select apply',e)}
  }

  /* Exact same simple interaction pattern as music: one select, one apply button. */
  window.swqQuickTheme=function(){
    try{
      const opts=ownedStylesFinal().map(k=>
        '<option value="'+esc(k)+'" '+(S.settings.theme===k?'selected':'')+'>'+
        esc(THEMES[k]?.emoji||'🎨')+' '+
        esc(typeof swqThemeName==='function'?swqThemeName(k):k)+
        '</option>'
      ).join('');
      modal(
        '<div class="kicker">🎨 ESTILO</div>'+
        '<h2>Elegir estilo</h2>'+
        '<div class="field" style="margin-top:10px">'+
          '<select id="swqFinalStyleSelect" style="width:100%">'+opts+'</select>'+
        '</div>'+
        '<button type="button" id="swqFinalStyleApply" class="btn primary" style="margin-top:8px">Usar estilo</button>'+
        '<button type="button" class="btn secondary" style="margin-top:8px" onclick="closeModal()">Cerrar</button>'
      );
      document.getElementById('swqFinalStyleApply')?.addEventListener('click',()=>{
        applyStyleFinal(document.getElementById('swqFinalStyleSelect')?.value||'Aqua');
      });
    }catch(e){console.warn('SWQ final style select modal',e)}
  };
  window.swqApplyQuickTheme=applyStyleFinal;
  window.equipTheme=applyStyleFinal;
  try{equipTheme=applyStyleFinal}catch(e){}
})();



/* === SWQ FINAL FISH CONVO + STYLE BUTTON REBIND v3 2026-09-20 === */
(function(){
  'use strict';
  if(window.__SWQ_FINAL_FISH_STYLE_V3__)return;
  window.__SWQ_FINAL_FISH_STYLE_V3__=true;

  /* Pez Motivador: lift the profile card a little without changing its size. */
  try{
    const st=document.createElement('style');
    st.id='swq-fish-motivator-position-v3';
    st.textContent='.profile-fish{margin-top:0!important}';
    document.head.appendChild(st);
  }catch(e){}

  /* Rebind the actual profile button to the final simple style selector.
     The old button was created with a lexical reference to the previous grid menu. */
  function rebindStyleButton(){
    try{
      const b=document.getElementById('swqQuickThemeButton');
      if(!b)return;
      b.onclick=function(ev){
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        return window.swqQuickTheme();
      };
      b.textContent='🎨 Cambiar estilo';
    }catch(e){}
  }
  rebindStyleButton();
  setInterval(rebindStyleButton,900);

  /* New fish conversation: one question specifically asks how the player manages
     to have this kind of conversation, because the fish doesn't know how. */
  const FISH_V3_QUESTIONS=[
    {t:'🐟 Si tu plan cambia de repente, ¿qué haces?',a:'A · Ajusto el plan y sigo.',b:'B · Intento mantenerlo como estaba.'},
    {t:'🐟 Haces algo bien y casi nadie lo nota. ¿Qué te importa más?',a:'A · Saber que avancé, aunque sea poco.',b:'B · Que el avance se note de verdad.'},
    {t:'🐟 Alguien avanza más rápido que tú. ¿Qué aparece primero en tu cabeza?',a:'A · Puedo aprender algo de esa persona.',b:'B · Tengo que alcanzarla.'},
    {t:'🐟 No sé hacer estas conversaciones. Tú sí pareces saber cómo seguirlas... ¿cómo lo haces?',a:'A · Digo lo que pienso y sigo el hilo.',b:'B · Pienso mi respuesta antes de decirla.'},
    {t:'🐟 Llegas a algo que buscaste durante mucho tiempo. ¿Qué haces con ese momento?',a:'A · Lo disfruto y agradezco el camino.',b:'B · Pienso en demostrar que lo merecía.'}
  ];

  const v3Endings={};
  const v3EndingsKeys=[
    '00000','00001','00010','00011','00100','00101','00110','00111',
    '01000','01001','01010','01011','01100','01101','01110','01111',
    '10000','10001','10010','10011','10100','10101','10110','10111',
    '11000','11001','11010','11011','11100','11101','11110','11111'
  ];
  const a0='adaptable cuando el camino cambia';
  const b0='te aferras bastante a lo que habías planeado';
  const a1='valoras un progreso aunque nadie lo vea';
  const b1='quieres señales claras de que el progreso existe';
  const a2='miras a quien va delante para aprender';
  const b2='quieres alcanzarlo';
  const a3='hablas desde lo que piensas y dejas que la conversación avance';
  const b3='prefieres ordenar tus ideas antes de hablar';
  const a4='puedes disfrutar una meta por lo que significa';
  const b4='quieres demostrar que la meta fue merecida';

  v3EndingsKeys.forEach(code=>{
    const bits=[...code].map(x=>x==='1');
    const attrs=[bits[0]?b0:a0,bits[1]?b1:a1,bits[2]?b2:a2,bits[3]?b3:a3,bits[4]?b4:a4];
    const thought='Pienso que eres alguien '+attrs[0]+', que '+attrs[1]+', que '+attrs[2]+', que '+attrs[3]+' y que, cuando consigues algo importante, '+attrs[4]+'.';
    const final='Después de estas cinco preguntas, entiendo esto de ti: '+attrs[0]+'. '+attrs[1].charAt(0).toUpperCase()+attrs[1].slice(1)+'. '+attrs[2].charAt(0).toUpperCase()+attrs[2].slice(1)+'. '+attrs[3].charAt(0).toUpperCase()+attrs[3].slice(1)+'. Y '+attrs[4]+'.';
    v3Endings[code]={final,thought};
  });

  let v3Path='',v3Step=0,v3Final=null;
  function v3FishMusicStop(){
    if(window.__swqFishV3Timer){clearInterval(window.__swqFishV3Timer);window.__swqFishV3Timer=null}
    if(window.__swqFishV3Ctx){try{window.__swqFishV3Ctx.close()}catch(e){}window.__swqFishV3Ctx=null}
  }
  function v3FishMusicStart(){
    try{
      v3FishMusicStop();
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
      const ctx=new AC();const notes=[146.83,174.61,196,220,196,174.61,164.81,146.83];let i=0;
      window.__swqFishV3Ctx=ctx;
      window.__swqFishV3Timer=setInterval(()=>{
        const o=ctx.createOscillator(),g=ctx.createGain();
        o.type='sine';o.frequency.value=notes[i++%notes.length];
        g.gain.setValueAtTime(.0001,ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(.032,ctx.currentTime+.03);
        g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.45);
        o.connect(g).connect(ctx.destination);o.start();o.stop(ctx.currentTime+.47);
      },560);
    }catch(e){}
  }
  function v3CloseFishScene(){
    v3FishMusicStop();
    document.getElementById('swqFishSecretSceneV3')?.remove();
    if(S.settings.music&&typeof restartAmbient==='function')restartAmbient();
  }
  function v3RenderQuestion(){
    const old=document.getElementById('swqFishSecretSceneV3');if(old)old.remove();
    const q=FISH_V3_QUESTIONS[v3Step];if(!q)return;
    const scene=document.createElement('div');
    scene.id='swqFishSecretSceneV3';
    scene.className='swq-fish-v3-scene';
    scene.innerHTML=
      '<div class="swq-fish-v3-glow"></div><div class="swq-fish-v3-bubbles"><i></i><i></i><i></i><i></i><i></i></div>'+
      '<div class="swq-fish-v3-stage">'+
        '<div class="swq-fish-v3-fish">🐟</div>'+
        '<div class="swq-fish-v3-speaker">🐟 PEZ</div>'+
        '<div class="swq-fish-v3-text">'+esc(q.t)+'</div>'+
        '<div class="swq-fish-v3-choices"><button class="swq-fish-v3-choice" data-c="A" type="button">'+esc(q.a)+'</button><button class="swq-fish-v3-choice" data-c="B" type="button">'+esc(q.b)+'</button></div>'+
        '<button class="swq-fish-v3-exit" type="button">Salir</button>'+
      '</div>';
    document.body.appendChild(scene);
    scene.querySelectorAll('.swq-fish-v3-choice').forEach(b=>b.addEventListener('click',()=>v3Choose(b.dataset.c)));
    scene.querySelector('.swq-fish-v3-exit')?.addEventListener('click',v3CloseFishScene);
    v3FishMusicStart();
  }
  function v3Choose(c){
    if(c!=='A'&&c!=='B')return;
    v3Path+=c;
    S.secret.fishConversationPath=v3Path;
    S.secret.fishConversationSeen=true;
    save();
    if(v3Step<FISH_V3_QUESTIONS.length-1){v3Step++;v3RenderQuestion();return}
    v3Final=v3Endings[v3Path]||null;
    v3RenderConclusion();
  }
  function v3RenderConclusion(){
    const scene=document.getElementById('swqFishSecretSceneV3');if(!scene||!v3Final)return;
    v3FishMusicStop();
    scene.innerHTML=
      '<div class="swq-fish-v3-glow"></div><div class="swq-fish-v3-stage final">'+
      '<div class="swq-fish-v3-fish">🐟</div>'+
      '<div class="swq-fish-v3-speaker">🐟 PEZ</div>'+
      '<div class="kicker">🌊 CONCLUSIÓN</div>'+
      '<div class="swq-fish-v3-text finaltext">'+esc(v3Final.final)+'</div>'+
      '<button class="swq-fish-v3-next" type="button">¿Y qué piensas de mí?</button>'+
      '</div>';
    scene.querySelector('.swq-fish-v3-next')?.addEventListener('click',v3RenderThought);
    v3FishMusicStart();
  }
  function v3RenderThought(){
    const scene=document.getElementById('swqFishSecretSceneV3');if(!scene||!v3Final)return;
    scene.innerHTML=
      '<div class="swq-fish-v3-glow"></div><div class="swq-fish-v3-stage final">'+
      '<div class="swq-fish-v3-fish">🐟</div>'+
      '<div class="swq-fish-v3-speaker">🐟 PEZ</div>'+
      '<div class="kicker">🐟 LO QUE PIENSO DE TI</div>'+
      '<div class="swq-fish-v3-thought">'+esc(v3Final.thought)+'</div>'+
      '<button class="swq-fish-v3-done" type="button">Terminar conversación</button>'+
      '</div>';
    scene.querySelector('.swq-fish-v3-done')?.addEventListener('click',()=>{save();v3CloseFishScene()});
    v3FishMusicStart();
  }
  window.swqOpenFishSecret=function(){
    if(!S.secret.fishConversationPurchased){toast('🐟 Primero compra la conversación secreta.');return}
    v3Path='';v3Step=0;v3Final=null;
    S.secret.fishConversationPath='';
    save();
    if(typeof ambientStop==='function')ambientStop();
    v3RenderQuestion();
  };
  window.swqBuyFishSecretConversation=function(){
    if(S.secret.fishConversationPurchased){window.swqOpenFishSecret();return}
    if(Number(S.coins||0)<1){toast('🪙 Te falta 1 moneda.');return}
    S.coins-=1;
    S.secret.fishConversationPurchased=true;
    S.secret.fishConversationPath='';
    S.secret.fishConversationSeen=false;
    save();
    if(typeof tone==='function')tone('coin');
    closeModal();render();
    setTimeout(window.swqOpenFishSecret,180);
  };

  try{
    const css=document.createElement('style');css.id='swq-fish-v3-css';
    css.textContent=
      '.swq-fish-v3-scene{position:fixed;inset:0;z-index:1300;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(circle at 50% 20%,#165071 0,#09283e 38%,#03111c 100%);color:#eafaff;overflow:hidden}'+
      '.swq-fish-v3-stage{width:min(760px,100%);min-height:82vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;position:relative;z-index:2}.swq-fish-v3-stage.final{max-width:820px}'+
      '.swq-fish-v3-fish{font-size:96px;filter:drop-shadow(0 8px 20px rgba(66,221,255,.3));animation:swqFishV3Float 3.2s ease-in-out infinite}.swq-fish-v3-speaker{margin:12px 0 8px;color:#82eaff;font-weight:1000;letter-spacing:1px}'+
      '.swq-fish-v3-text{width:min(720px,100%);min-height:190px;display:flex;align-items:center;justify-content:center;font-size:20px;line-height:1.7;text-shadow:0 2px 10px rgba(0,0,0,.28)}'+
      '.swq-fish-v3-text.finaltext{min-height:170px}.swq-fish-v3-choices{width:min(720px,100%);display:grid;grid-template-columns:1fr 1fr;gap:10px}.swq-fish-v3-choice{min-height:62px;border-radius:18px;border:1px solid rgba(126,232,255,.35);background:rgba(8,31,49,.9);color:#effcff;font-size:15px;font-weight:1000;padding:10px 14px}.swq-fish-v3-choice:first-child{background:linear-gradient(135deg,#1e799f,#0a344b)}.swq-fish-v3-choice:last-child{background:linear-gradient(135deg,#274f80,#0b2138)}'+
      '.swq-fish-v3-exit{margin-top:12px;border:1px solid rgba(126,232,255,.2);background:none;color:#9ccada;border-radius:14px;padding:8px 14px;font-size:12px}.swq-fish-v3-thought{width:min(700px,100%);min-height:120px;display:flex;align-items:center;justify-content:center;padding:14px 16px;border-radius:18px;border:1px solid rgba(126,232,255,.22);background:rgba(5,24,39,.7);line-height:1.6;color:#d0edf5;font-size:18px}.swq-fish-v3-next,.swq-fish-v3-done{margin-top:16px;min-height:52px;border:0;border-radius:17px;padding:12px 22px;background:#1e799f;color:#fff;font-weight:1000}'+
      '.swq-fish-v3-glow{position:absolute;width:340px;height:340px;border-radius:50%;left:50%;top:32%;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(72,221,255,.15),transparent 68%);filter:blur(8px)}.swq-fish-v3-bubbles i{position:absolute;bottom:-40px;width:9px;height:9px;border:1px solid rgba(180,240,255,.35);border-radius:50%;animation:swqFishV3Bubble 7s linear infinite;opacity:.5}.swq-fish-v3-bubbles i:nth-child(1){left:12%;animation-delay:-1s}.swq-fish-v3-bubbles i:nth-child(2){left:29%;width:13px;height:13px;animation-delay:-5s}.swq-fish-v3-bubbles i:nth-child(3){left:54%;animation-delay:-3s}.swq-fish-v3-bubbles i:nth-child(4){left:75%;width:14px;height:14px;animation-delay:-6s}.swq-fish-v3-bubbles i:nth-child(5){left:88%;animation-delay:-2s}'+
      '@keyframes swqFishV3Float{50%{transform:translateY(-8px) rotate(-2deg) scale(1.03)}}@keyframes swqFishV3Bubble{0%{transform:translateY(0);opacity:0}15%{opacity:.5}100%{transform:translateY(-110vh) translateX(18px);opacity:0}}@media(max-width:640px){.swq-fish-v3-choices{grid-template-columns:1fr}.swq-fish-v3-text{font-size:18px;min-height:170px}.swq-fish-v3-fish{font-size:78px}}';
    document.head.appendChild(css);
  }catch(e){}
})();



/* === SWQ FINAL ROAD + STYLE + FISH V4 2026-09-20 === */
(function(){
  'use strict';
  if(window.__SWQ_FINAL_ROAD_STYLE_FISH_V4__)return;
  window.__SWQ_FINAL_ROAD_STYLE_FISH_V4__=true;

  /* Pez Motivador: a small upward nudge, preserving the card dimensions and click area. */
  try{
    const st=document.createElement('style');
    st.id='swq-final-fish-position-v4';
    st.textContent='.profile-fish{position:relative!important;top:-10px!important;margin-top:10px!important}.profile-fish:active{top:-10px!important}';
    document.head.appendChild(st);
  }catch(e){}

  /* STYLE: one simple selector + one Apply button, exactly like the music picker. */
  function styleKeysV4(){
    const out=['Aqua'];
    try{
      Object.keys(THEMES||{}).forEach(k=>{
        if(k!=='Aqua'&&S.purchases?.['theme_'+k]&&!out.includes(k))out.push(k);
      });
    }catch(e){}
    return out.filter(k=>THEMES?.[k]);
  }
  function applyStyleV4(k){
    try{
      if(!THEMES?.[k])return;
      if(k!=='Aqua'&&!S.purchases?.['theme_'+k]){
        toast('🔒 Ese estilo todavía no está desbloqueado.');
        return;
      }
      S.settings.theme=k;
      save();
      if(typeof applyTheme==='function')applyTheme();
      closeModal();
      render();
      /* The random style still gets its color change and permanent dice. */
      if(k==='RandomBasic'){
        window.__SWQ_RANDOM_BASIC_SESSION_COLOR__=false;
        try{if(typeof applyRandomBasic==='function')applyRandomBasic();}catch(e){}
        setTimeout(()=>{try{if(typeof startDice==='function')startDice();}catch(e){}},70);
      }
    }catch(e){console.warn('SWQ V4 style apply',e)}
  }
  window.swqQuickTheme=function(){
    try{
      const opts=styleKeysV4().map(k=>
        '<option value="'+esc(k)+'" '+(S.settings.theme===k?'selected':'')+'>'+
        esc(THEMES[k]?.emoji||'🎨')+' '+esc(typeof swqThemeName==='function'?swqThemeName(k):k)+
        '</option>'
      ).join('');
      modal(
        '<div class="kicker">🎨 ESTILO</div>'+
        '<h2>Elegir estilo</h2>'+
        '<div class="field" style="margin-top:10px">'+
          '<select id="swqStyleV4Select" style="width:100%">'+opts+'</select>'+
        '</div>'+
        '<button type="button" id="swqStyleV4Apply" class="btn primary" style="margin-top:8px">Usar estilo</button>'+
        '<button type="button" class="btn secondary" style="margin-top:8px" onclick="closeModal()">Cerrar</button>'
      );
      document.getElementById('swqStyleV4Apply')?.addEventListener('click',()=>{
        applyStyleV4(document.getElementById('swqStyleV4Select')?.value||'Aqua');
      });
    }catch(e){console.warn('SWQ V4 style modal',e)}
  };
  window.swqApplyQuickTheme=applyStyleV4;
  window.equipTheme=applyStyleV4;
  try{equipTheme=applyStyleV4}catch(e){}

  /* Rebind repeatedly because profile() can recreate its button after render. */
  function rebindStyleV4(){
    try{
      const b=document.getElementById('swqQuickThemeButton');
      if(!b)return;
      b.onclick=function(ev){
        ev?.preventDefault?.();ev?.stopPropagation?.();
        window.swqQuickTheme();
      };
      b.textContent='🎨 Cambiar estilo';
      b.removeAttribute('data-old-style-handler');
    }catch(e){}
  }
  rebindStyleV4();
  setInterval(rebindStyleV4,700);

  /* CARRETERA V4
     Use one isolated traffic layer. Motion and facing are separate transforms,
     preventing the old animation/emoji-direction conflict. */
  let roadV4Timer=null,heliV4Timer=null,planeV4Timer=null,roadV4Layer=null;
  function roadV4Clear(){
    if(roadV4Timer){clearInterval(roadV4Timer);roadV4Timer=null}
    if(heliV4Timer){clearInterval(heliV4Timer);heliV4Timer=null}
    if(planeV4Timer){clearInterval(planeV4Timer);planeV4Timer=null}
    document.getElementById('swqRoadV4Layer')?.remove();
    roadV4Layer=null;
  }
  function roadV4Ensure(){
    if(roadV4Layer&&roadV4Layer.isConnected)return roadV4Layer;
    roadV4Layer=document.createElement('div');
    roadV4Layer.id='swqRoadV4Layer';
    Object.assign(roadV4Layer.style,{position:'fixed',inset:'0',zIndex:'1',pointerEvents:'none',overflow:'hidden'});
    roadV4Layer.innerHTML='<div class="swq-road-v4-stars"></div><div class="swq-road-v4-city"></div><div class="swq-road-v4-road"></div>';
    document.body.appendChild(roadV4Layer);
    return roadV4Layer;
  }
  function roadV4Car(){
    if(S.settings.theme!=='Carretera')return;
    const host=roadV4Ensure();
    const outer=document.createElement('span');
    outer.className='swq-road-v4-car';
    const inner=document.createElement('span');
    inner.textContent=['🚗','🚙','🚕','🚌'][Math.floor(Math.random()*4)];
    inner.className='swq-road-v4-car-face';
    outer.appendChild(inner);
    outer.style.top=(66+Math.random()*20)+'%';
    outer.style.setProperty('--v4dur',(5.0+Math.random()*3.2)+'s');
    outer.style.setProperty('--v4size',(25+Math.random()*8)+'px');
    host.appendChild(outer);
    setTimeout(()=>outer.remove(),9500);
  }
  function roadV4Heli(){
    if(S.settings.theme!=='Carretera')return;
    const host=roadV4Ensure();
    const outer=document.createElement('span');
    outer.className='swq-road-v4-heli';
    const inner=document.createElement('span');
    inner.textContent='🚁';
    inner.className='swq-road-v4-heli-face';
    outer.appendChild(inner);
    /* Clearly above the road traffic. */
    outer.style.top=(5+Math.random()*13)+'%';
    outer.style.setProperty('--v4hdur',(8.5+Math.random()*3.0)+'s');
    host.appendChild(outer);
    setTimeout(()=>outer.remove(),14500);
  }
  function roadV4Plane(){
    if(S.settings.theme!=='Carretera')return;
    const host=roadV4Ensure();
    const outer=document.createElement('span');
    outer.className='swq-road-v4-plane';
    const inner=document.createElement('span');
    inner.textContent=Math.random()<.65?'✈️':'🛫';
    inner.className='swq-road-v4-plane-face';
    outer.appendChild(inner);
    outer.style.top=(18+Math.random()*19)+'%';
    outer.style.setProperty('--v4pdur',(8+Math.random()*4)+'s');
    host.appendChild(outer);
    setTimeout(()=>outer.remove(),15000);
  }
  function roadV4Sync(){
    if(S.settings.theme!=='Carretera'){
      roadV4Clear();
      return;
    }
    /* Kill only the two old DOM layers, not user data or settings. */
    document.getElementById('swqMasterRoadLayer')?.remove();
    document.getElementById('swqRoadLayer')?.remove();
    const host=roadV4Ensure();
    if(!host.querySelector('.swq-road-v4-car')){roadV4Car();roadV4Car();}
    if(!host.querySelector('.swq-road-v4-heli'))roadV4Heli();
    if(!host.querySelector('.swq-road-v4-plane'))roadV4Plane();
    if(!roadV4Timer)roadV4Timer=setInterval(()=>{
      if(!document.hidden&&S.settings.theme==='Carretera'){
        roadV4Car();
        if(Math.random()<.28)roadV4Car();
      }
    },1150);
    if(!heliV4Timer)heliV4Timer=setInterval(()=>{
      if(!document.hidden&&S.settings.theme==='Carretera')roadV4Heli();
    },7000);
    if(!planeV4Timer)planeV4Timer=setInterval(()=>{
      if(!document.hidden&&S.settings.theme==='Carretera'&&Math.random()<.6)roadV4Plane();
    },10500);
  }
  try{
    const css=document.createElement('style');
    css.id='swq-road-v4-css';
    css.textContent=
      '.swq-road-v4-stars{position:absolute;inset:0;background:radial-gradient(circle at 12% 12%,rgba(255,255,255,.8) 0 1px,transparent 2px),radial-gradient(circle at 64% 8%,rgba(255,255,255,.6) 0 1px,transparent 2px),radial-gradient(circle at 86% 21%,rgba(255,255,255,.7) 0 1px,transparent 2px);opacity:.55}'+
      '.swq-road-v4-city{position:absolute;left:0;right:0;top:44%;height:18%;background:linear-gradient(180deg,transparent 0,rgba(13,25,42,.18) 22%,rgba(9,16,28,.68) 100%);box-shadow:inset 0 -18px 30px rgba(255,193,67,.05)}'+
      '.swq-road-v4-road{position:absolute;left:0;right:0;top:64%;height:38%;background:linear-gradient(180deg,rgba(11,18,27,.15),rgba(3,7,12,.94));border-top:2px solid rgba(255,205,92,.25)}'+
      '.swq-road-v4-road:before{content:\"\";position:absolute;left:0;right:0;top:48%;height:5px;background:repeating-linear-gradient(90deg,#ffd45f 0 70px,transparent 70px 125px);opacity:.8}'+
      '.swq-road-v4-car{position:absolute;left:-12vw;top:0;font-size:var(--v4size,30px);animation:swqRoadV4Car var(--v4dur,6s) linear forwards;will-change:transform;white-space:nowrap;filter:drop-shadow(0 4px 8px rgba(0,0,0,.8))}'+
      '.swq-road-v4-car-face{display:inline-block;transform:scaleX(-1);filter:drop-shadow(0 1px 2px rgba(255,255,255,.14))}'+
      '.swq-road-v4-heli{position:absolute;left:-12vw;top:0;font-size:31px;animation:swqRoadV4Heli var(--v4hdur,10s) linear forwards;will-change:transform;white-space:nowrap;filter:drop-shadow(0 0 10px rgba(160,220,255,.75))}'+
      '.swq-road-v4-heli-face{display:inline-block;transform:scaleX(1)}'+
      '.swq-road-v4-plane{position:absolute;left:-12vw;top:0;font-size:23px;animation:swqRoadV4Plane var(--v4pdur,10s) linear forwards;will-change:transform;white-space:nowrap;filter:drop-shadow(0 0 8px rgba(160,210,255,.62))}'+
      '.swq-road-v4-plane-face{display:inline-block;transform:scaleX(1)}'+
      '@keyframes swqRoadV4Car{from{transform:translate3d(-12vw,0,0)}to{transform:translate3d(120vw,-3vh,0)}}'+
      '@keyframes swqRoadV4Heli{from{transform:translate3d(-12vw,0,0)}to{transform:translate3d(120vw,-3vh,0)}}'+
      '@keyframes swqRoadV4Plane{from{transform:translate3d(-12vw,0,0) scale(.88)}to{transform:translate3d(120vw,-7vh,0) scale(1.05)}}';
    document.head.appendChild(css);
  }catch(e){}

  roadV4Sync();
  setInterval(roadV4Sync,1000);

  /* Make the new fish scene authoritative after every older fish patch. */
  if(typeof window.swqOpenFishSecret==='function'){
    /* V3 already provides: 5 questions, 32 endings, the “how do you converse?” question,
       a separate conclusion screen, then a separate “what I think of you” screen. */
  }
})();



/* === SWQ CLICK + CARRETERA OVERLAY V6 2026-09-20 === */
(function(){
  'use strict';
  if(window.__SWQ_CLICK_ROAD_V6__)return;
  window.__SWQ_CLICK_ROAD_V6__=true;

  /* FISH: decorative layers never capture clicks; choices remain above them. */
  try{
    const st=document.createElement('style');
    st.id='swq-fish-click-v6-css';
    st.textContent=
      '.swq-fish-v3-scene{pointer-events:auto!important}'+
      '.swq-fish-v3-stage{pointer-events:auto!important;z-index:20!important}'+
      '.swq-fish-v3-choice,.swq-fish-v3-exit,.swq-fish-v3-next,.swq-fish-v3-done{position:relative!important;z-index:30!important;pointer-events:auto!important;touch-action:manipulation!important}'+
      '.swq-fish-v3-glow,.swq-fish-v3-bubbles,.swq-fish-v3-bubbles i{pointer-events:none!important}';
    document.head.appendChild(st);
  }catch(e){}

  /* CARRETERA: traffic is visually above the app controls, but never blocks their clicks. */
  function liftRoadLayer(){
    try{
      const layer=document.getElementById('swqRoadV4Layer');
      if(!layer)return;
      layer.style.zIndex='40';
      layer.style.pointerEvents='none';
      layer.querySelectorAll('.swq-road-v4-car,.swq-road-v4-heli,.swq-road-v4-plane').forEach(el=>{
        el.style.pointerEvents='none';
        el.style.zIndex='41';
      });
    }catch(e){}
  }
  liftRoadLayer();
  setInterval(liftRoadLayer,600);

  /* Helicopter should face the direction of travel: right. */
  try{
    const st=document.createElement('style');
    st.id='swq-road-v6-orientation-css';
    st.textContent='.swq-road-v4-heli-face{transform:scaleX(-1)!important}';
    document.head.appendChild(st);
  }catch(e){}

  try{
    const obs=new MutationObserver(()=>{try{liftRoadLayer()}catch(e){}});
    obs.observe(document.body,{childList:true});
  }catch(e){}
})();


/* === SWQ SIMPLE STYLE + FISH CLICK FIX 2026-09-20 === */
(function(){
  'use strict';
  if(window.__SWQ_SIMPLE_STYLE_FISH_FIX_20260920__)return;
  window.__SWQ_SIMPLE_STYLE_FISH_FIX_20260920__=true;

  /* PEZ MOTIVADOR: noticeably higher, without shrinking the card or changing its size. */
  try{
    const st=document.createElement('style');
    st.id='swq-simple-fish-position-css';
    st.textContent='.profile-fish{position:relative!important;top:-22px!important;margin-top:0!important}.profile-fish:active{top:-22px!important}';
    document.head.appendChild(st);
  }catch(e){}

  /* ESTILO: one native selector, one apply button, no dependency on modal(). */
  function swqSimpleOwnedThemes(){
    const out=['Aqua'];
    try{
      if(typeof THEMES!=='undefined'){
        Object.keys(THEMES).forEach(k=>{
          if(k!=='Aqua'&&S.purchases?.['theme_'+k])out.push(k);
        });
      }
    }catch(e){}
    return [...new Set(out)].filter(k=>typeof THEMES!=='undefined'&&THEMES[k]);
  }

  function swqSimpleThemeName(k){
    try{
      if(typeof swqThemeName==='function')return swqThemeName(k);
    }catch(e){}
    return k.replace(/([a-z])([A-Z])/g,'$1 $2');
  }

  function swqSimpleApplyTheme(k){
    try{
      if(typeof THEMES==='undefined'||!THEMES[k])return;
      if(k!=='Aqua'&&!S.purchases?.['theme_'+k]){
        toast('🔒 Ese estilo todavía no está desbloqueado.');
        return;
      }
      S.settings.theme=k;
      save();
      if(typeof applyTheme==='function')applyTheme();
      try{closeModal();}catch(e){}
      document.getElementById('swqSimpleThemeOverlay')?.remove();
      render();
      if(k==='RandomBasic'){
        try{if(typeof applyRandomBasic==='function')applyRandomBasic();}catch(e){}
        setTimeout(()=>{try{if(typeof startDice==='function')startDice();}catch(e){}},60);
      }
    }catch(e){console.warn('SWQ simple theme apply',e)}
  }

  function swqSimpleCloseTheme(){
    document.getElementById('swqSimpleThemeOverlay')?.remove();
  }

  function swqSimpleOpenTheme(){
    try{
      document.getElementById('swqSimpleThemeOverlay')?.remove();
      const keys=swqSimpleOwnedThemes();
      const overlay=document.createElement('div');
      overlay.id='swqSimpleThemeOverlay';
      overlay.style.cssText='position:fixed;inset:0;z-index:2500;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(2,9,16,.76);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);box-sizing:border-box';
      const panel=document.createElement('div');
      panel.style.cssText='width:min(430px,100%);max-height:88vh;overflow:auto;padding:18px;border:1px solid rgba(126,232,255,.24);border-radius:22px;background:linear-gradient(160deg,rgba(10,31,47,.98),rgba(4,14,23,.99));box-shadow:0 24px 70px rgba(0,0,0,.55);color:#effcff';
      panel.innerHTML=
        '<div class="kicker">🎨 ESTILO</div>'+
        '<h2 style="margin:4px 0 8px">Cambiar estilo</h2>'+
        '<div class="sub">Selecciona un estilo desbloqueado y aplícalo.</div>'+
        '<div style="margin-top:12px">'+
          '<select id="swqSimpleThemeSelect" style="width:100%;min-height:48px;padding:10px;border-radius:14px;background:#091b2a;color:#effcff;border:1px solid rgba(126,232,255,.28);font-size:15px"></select>'+
        '</div>'+
        '<button type="button" id="swqSimpleThemeApply" class="btn primary" style="width:100%;margin-top:10px">Aplicar estilo</button>'+
        '<button type="button" id="swqSimpleThemeClose" class="btn secondary" style="width:100%;margin-top:8px">Cerrar</button>';
      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      const select=panel.querySelector('#swqSimpleThemeSelect');
      keys.forEach(k=>{
        const o=document.createElement('option');
        o.value=k;
        o.textContent=(THEMES[k]?.emoji||'🎨')+' '+swqSimpleThemeName(k);
        if(S.settings.theme===k)o.selected=true;
        select.appendChild(o);
      });
      panel.querySelector('#swqSimpleThemeApply')?.addEventListener('click',()=>swqSimpleApplyTheme(select.value||'Aqua'));
      panel.querySelector('#swqSimpleThemeClose')?.addEventListener('click',swqSimpleCloseTheme);
      overlay.addEventListener('click',e=>{if(e.target===overlay)swqSimpleCloseTheme()});
    }catch(e){console.warn('SWQ simple theme open',e)}
  }

  window.swqQuickTheme=swqSimpleOpenTheme;
  window.swqApplyQuickTheme=swqSimpleApplyTheme;

  /* Keep every rendered profile button pointing at the same simple selector. */
  function swqSimpleRebindThemeButton(){
    try{
      const b=document.getElementById('swqQuickThemeButton');
      if(!b)return;
      b.onclick=function(ev){
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        swqSimpleOpenTheme();
      };
    }catch(e){}
  }
  swqSimpleRebindThemeButton();
  setInterval(swqSimpleRebindThemeButton,1000);

  /* PEZ: the existing scene already contains the correct 5-question / 32-ending flow.
     This bridge makes the A/B choice work even when another click listener interferes.
     It calls the original button handler directly, then blocks the outer click so it cannot fire twice. */
  function swqPatchFishChoiceClicks(){
    const scene=document.getElementById('swqFishSecretSceneV3');
    if(!scene||scene.__swqFishChoiceBridge)return;
    scene.__swqFishChoiceBridge=true;
    scene.addEventListener('click',function(ev){
      const btn=ev.target?.closest?.('.swq-fish-v3-choice');
      if(!btn)return;
      if(scene.__swqFishBridgeBusy)return;
      scene.__swqFishBridgeBusy=true;
      try{btn.click();}catch(e){console.warn('SWQ fish choice bridge',e)}
      scene.__swqFishBridgeBusy=false;
      ev.preventDefault();
      ev.stopImmediatePropagation();
    },true);
  }

  try{
    const originalOpenFish=window.swqOpenFishSecret;
    if(typeof originalOpenFish==='function'&&!window.__swqFishOpenBridge20260920){
      window.swqOpenFishSecret=function(){
        const result=originalOpenFish.apply(this,arguments);
        swqPatchFishChoiceClicks();
        setTimeout(swqPatchFishChoiceClicks,0);
        return result;
      };
      window.__swqFishOpenBridge20260920=true;
    }
    swqPatchFishChoiceClicks();
    setInterval(swqPatchFishChoiceClicks,250);
  }catch(e){console.warn('SWQ fish bridge install',e)}
})();


/* === SWQ PROFILE FISH LAYOUT + FISH CONVO V4 2026-09-20 === */
(function(){
  'use strict';
  if(window.__SWQ_PROFILE_FISH_LAYOUT_V4__)return;
  window.__SWQ_PROFILE_FISH_LAYOUT_V4__=true;

  /* PERFIL: el Pez vuelve al flujo normal del documento y queda debajo del bloque anterior. */
  try{
    const st=document.createElement('style');
    st.id='swq-profile-fish-layout-v4-css';
    st.textContent=
      '.profile-fish{position:relative!important;top:0!important;bottom:auto!important;left:auto!important;right:auto!important;transform:none!important;clear:both!important;margin:10px 0 0!important;display:flex!important;box-sizing:border-box!important;z-index:1!important}'+
      '.profile-fish:active{top:0!important;transform:scale(.985)!important}';
    document.head.appendChild(st);
  }catch(e){}

  /* PEZ: conversación nueva, simple y con una altura que siempre cabe en móvil. */
  const Q=[
    {t:'Si tu plan cambia de repente, ¿qué haces?',a:'A · Ajusto el plan y sigo.',b:'B · Intento mantenerlo como estaba.'},
    {t:'Haces algo bien y casi nadie lo nota. ¿Qué te importa más?',a:'A · Saber que avancé, aunque sea poco.',b:'B · Que el avance se note de verdad.'},
    {t:'Alguien avanza más rápido que tú. ¿Qué aparece primero en tu cabeza?',a:'A · Puedo aprender algo de esa persona.',b:'B · Tengo que alcanzarla.'},
    {t:'No sé hacer estas conversaciones. Tú sí pareces saber cómo seguirlas... ¿cómo lo haces?',a:'A · Digo lo que pienso y sigo el hilo.',b:'B · Pienso mi respuesta antes de decirla.'},
    {t:'Llegas a algo que buscaste durante mucho tiempo. ¿Qué haces con ese momento?',a:'A · Lo disfruto y agradezco el camino.',b:'B · Pienso en demostrar que lo merecía.'}
  ];

  function makeEnding(code){
    const b=[...code].map(x=>x==='1');
    const traits=[
      b[0]?'prefieres mantener tu plan incluso cuando cambia el escenario':'sabes adaptarte cuando el camino cambia',
      b[1]?'te importa que tu progreso también sea reconocido':'valorás el progreso aunque nadie lo vea',
      b[2]?'quieres alcanzar a quien va delante':'puedes mirar a quien va delante para aprender',
      b[3]?'piensas antes de hablar y ordenas tus ideas':'hablas desde lo que piensas y dejas que la conversación avance',
      b[4]?'quieres demostrar que merecías esa meta':'puedes disfrutar una meta por lo que significa'
    ];
    const conclusion='Después de estas cinco preguntas, creo que '+traits[0]+'. También '+traits[1]+'. Cuando ves a alguien avanzar, '+traits[2]+'. En una conversación, '+traits[3]+'. Y cuando consigues algo importante, '+traits[4]+'.';
    const thought='🐟 Lo que pienso de ti: creo que eres alguien '+traits[0]+', '+traits[1]+' y '+traits[2]+'. Además, '+traits[3]+'. Eso me dice que no eres una persona de una sola forma: según la situación, sabes cambiar de manera de pensar.';
    return {conclusion,thought};
  }

  const ENDINGS={};
  for(let n=0;n<32;n++){
    const code=n.toString(2).padStart(5,'0');
    ENDINGS[code]=makeEnding(code);
  }

  let path='',step=0,ending=null;
  function close(){
    try{if(window.__swqFishV4Ctx){window.__swqFishV4Ctx.close();window.__swqFishV4Ctx=null}}catch(e){}
    if(window.__swqFishV4Timer){clearInterval(window.__swqFishV4Timer);window.__swqFishV4Timer=null}
    document.getElementById('swqFishSecretSceneV4')?.remove();
    if(S.settings.music&&typeof restartAmbient==='function')restartAmbient();
  }
  function fishSound(){
    try{
      if(window.__swqFishV4Timer){clearInterval(window.__swqFishV4Timer);window.__swqFishV4Timer=null}
      if(window.__swqFishV4Ctx){try{window.__swqFishV4Ctx.close()}catch(e){}}
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
      const ctx=new AC();window.__swqFishV4Ctx=ctx;const notes=[146.83,174.61,196,220];let i=0;
      window.__swqFishV4Timer=setInterval(()=>{
        try{
          const o=ctx.createOscillator(),g=ctx.createGain();
          o.type='sine';o.frequency.value=notes[i++%notes.length];
          g.gain.setValueAtTime(.0001,ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(.022,ctx.currentTime+.03);
          g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.30);
          o.connect(g).connect(ctx.destination);o.start();o.stop(ctx.currentTime+.32);
        }catch(e){}
      },620);
    }catch(e){}
  }
  function sceneBase(inner){
    const old=document.getElementById('swqFishSecretSceneV4');if(old)old.remove();
    const scene=document.createElement('div');
    scene.id='swqFishSecretSceneV4';
    scene.className='swq-fish-v4-scene';
    scene.innerHTML='<div class="swq-fish-v4-stage">'+inner+'</div>';
    document.body.appendChild(scene);
    return scene;
  }
  function renderQuestion(){
    const q=Q[step];
    const scene=sceneBase(
      '<div class="swq-fish-v4-fish">🐟</div>'+
      '<div class="swq-fish-v4-title">🐟 PEZ</div>'+ 
      '<div class="swq-fish-v4-step">Pregunta '+(step+1)+' de '+Q.length+'</div>'+ 
      '<div class="swq-fish-v4-question">'+esc(q.t)+'</div>'+ 
      '<div class="swq-fish-v4-choices">'+
        '<button type="button" class="swq-fish-v4-choice a" data-answer="A">'+esc(q.a)+'</button>'+ 
        '<button type="button" class="swq-fish-v4-choice b" data-answer="B">'+esc(q.b)+'</button>'+ 
      '</div>'+ 
      '<button type="button" class="swq-fish-v4-exit">Salir</button>'
    );
    scene.querySelectorAll('.swq-fish-v4-choice').forEach(btn=>btn.addEventListener('click',function(){choose(this.dataset.answer)}));
    scene.querySelector('.swq-fish-v4-exit')?.addEventListener('click',close);
    fishSound();
  }
  function choose(answer){
    if(answer!=='A'&&answer!=='B')return;
    path+=answer;
    S.secret.fishConversationPath=path;
    S.secret.fishConversationSeen=true;
    save();
    if(step<Q.length-1){step++;renderQuestion();return}
    ending=ENDINGS[path]||makeEnding(path);
    renderConclusion();
  }
  function renderConclusion(){
    const scene=sceneBase(
      '<div class="swq-fish-v4-fish">🐟</div>'+ 
      '<div class="swq-fish-v4-title">🐟 PEZ</div>'+ 
      '<div class="swq-fish-v4-heading">🌊 CONCLUSIÓN</div>'+ 
      '<div class="swq-fish-v4-copy">'+esc(ending.conclusion)+'</div>'+ 
      '<button type="button" class="swq-fish-v4-next">¿Qué piensas de mí?</button>'+ 
      '<button type="button" class="swq-fish-v4-exit">Salir</button>'
    );
    scene.querySelector('.swq-fish-v4-next')?.addEventListener('click',renderThought);
    scene.querySelector('.swq-fish-v4-exit')?.addEventListener('click',close);
    fishSound();
  }
  function renderThought(){
    const scene=sceneBase(
      '<div class="swq-fish-v4-fish">🐟</div>'+ 
      '<div class="swq-fish-v4-title">🐟 PEZ</div>'+ 
      '<div class="swq-fish-v4-heading">🐟 LO QUE PIENSO DE TI</div>'+ 
      '<div class="swq-fish-v4-thought">'+esc(ending.thought)+'</div>'+ 
      '<button type="button" class="swq-fish-v4-next">Terminar conversación</button>'
    );
    scene.querySelector('.swq-fish-v4-next')?.addEventListener('click',()=>{save();close()});
    fishSound();
  }
  window.swqOpenFishSecret=function(){
    if(!S.secret.fishConversationPurchased){toast('🐟 Primero compra la conversación secreta.');return}
    path='';step=0;ending=null;
    S.secret.fishConversationPath='';
    save();
    if(typeof ambientStop==='function')ambientStop();
    renderQuestion();
  };

  try{
    const st=document.createElement('style');
    st.id='swq-fish-v4-css';
    st.textContent=
      '.swq-fish-v4-scene{position:fixed!important;inset:0!important;z-index:3000!important;display:flex!important;align-items:flex-start!important;justify-content:center!important;overflow-y:auto!important;overflow-x:hidden!important;padding:14px!important;box-sizing:border-box!important;background:radial-gradient(circle at 50% 14%,#165071 0,#09283e 40%,#03111c 100%)!important;color:#eafaff!important;pointer-events:auto!important}'+
      '.swq-fish-v4-stage{width:min(760px,100%)!important;min-height:0!important;height:auto!important;max-height:none!important;margin:auto!important;padding:8px 0 24px!important;box-sizing:border-box!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:flex-start!important;text-align:center!important;position:relative!important;z-index:10!important}'+
      '.swq-fish-v4-fish{font-size:78px!important;line-height:1!important;margin:2px 0 6px!important;filter:drop-shadow(0 8px 20px rgba(66,221,255,.3))!important;animation:swqFishV4Float 3.2s ease-in-out infinite!important}'+
      '.swq-fish-v4-title{color:#82eaff!important;font-weight:1000!important;letter-spacing:1px!important;font-size:14px!important;margin-bottom:3px!important}'+
      '.swq-fish-v4-step{font-size:12px!important;color:#9bcbd9!important;margin-bottom:10px!important}'+
      '.swq-fish-v4-question{width:min(700px,100%)!important;min-height:0!important;padding:18px 10px!important;box-sizing:border-box!important;font-size:21px!important;line-height:1.45!important;font-weight:900!important;text-shadow:0 2px 10px rgba(0,0,0,.25)!important}'+
      '.swq-fish-v4-choices{width:min(700px,100%)!important;display:grid!important;grid-template-columns:1fr 1fr!important;gap:10px!important;margin-top:4px!important;position:relative!important;z-index:50!important}'+
      '.swq-fish-v4-choice{min-height:64px!important;border-radius:18px!important;border:1px solid rgba(126,232,255,.35)!important;color:#effcff!important;font-size:15px!important;font-weight:1000!important;padding:11px 14px!important;box-sizing:border-box!important;cursor:pointer!important;pointer-events:auto!important;touch-action:manipulation!important;position:relative!important;z-index:60!important}'+
      '.swq-fish-v4-choice.a{background:linear-gradient(135deg,#1e799f,#0a344b)!important}.swq-fish-v4-choice.b{background:linear-gradient(135deg,#274f80,#0b2138)!important}'+
      '.swq-fish-v4-exit{margin-top:12px!important;border:1px solid rgba(126,232,255,.2)!important;background:rgba(0,0,0,.12)!important;color:#9ccada!important;border-radius:14px!important;padding:8px 14px!important;font-size:12px!important;cursor:pointer!important;position:relative!important;z-index:60!important;pointer-events:auto!important}'+
      '.swq-fish-v4-heading{margin-top:8px!important;color:#8ceaff!important;font-size:15px!important;font-weight:1000!important;letter-spacing:.8px!important}'+
      '.swq-fish-v4-copy,.swq-fish-v4-thought{width:min(700px,100%)!important;box-sizing:border-box!important;margin-top:12px!important;padding:16px!important;border-radius:18px!important;background:rgba(5,24,39,.72)!important;border:1px solid rgba(126,232,255,.22)!important;color:#dff7ff!important;line-height:1.6!important;font-size:18px!important}'+
      '.swq-fish-v4-next{margin-top:16px!important;min-height:52px!important;border:0!important;border-radius:17px!important;padding:12px 22px!important;background:#1e799f!important;color:#fff!important;font-weight:1000!important;cursor:pointer!important;pointer-events:auto!important;touch-action:manipulation!important;position:relative!important;z-index:60!important}'+
      '@keyframes swqFishV4Float{50%{transform:translateY(-7px) rotate(-2deg) scale(1.03)}}'+
      '@media(max-width:640px){.swq-fish-v4-stage{padding-top:2px!important}.swq-fish-v4-fish{font-size:66px!important}.swq-fish-v4-question{font-size:18px!important;padding:12px 6px!important}.swq-fish-v4-choices{grid-template-columns:1fr!important}.swq-fish-v4-choice{min-height:58px!important}.swq-fish-v4-copy,.swq-fish-v4-thought{font-size:16px!important}}';
    document.head.appendChild(st);
  }catch(e){}
})();

/* === SWQ RANK REWARDS FIX + RANDOM STYLE ON ENTRY 2026-09-22 === */
(function(){
  'use strict';
  if(window.__SWQ_RANK_RANDOM_STYLE_FIX_20260922__)return;
  window.__SWQ_RANK_RANDOM_STYLE_FIX_20260922__=true;

  try{
    S.settings=S.settings||{};
    if(typeof S.settings.randomStyleOnStart!=='boolean')S.settings.randomStyleOnStart=false;
    save();
  }catch(e){}

  /* Los contadores antiguos ya no participan en pagos automáticos. */
  try{
    if(Number.isFinite(Number(S.rankRewardCoins)))S.rankRewardCoins=0;
    if(Number.isFinite(Number(S.rankRewardXP)))S.rankRewardXP=0;
    save();
  }catch(e){}

  function ownedThemes(){
    const out=['Aqua'];
    try{
      Object.keys(THEMES||{}).forEach(k=>{
        if(k!=='Aqua'&&S.purchases?.['theme_'+k])out.push(k);
      });
    }catch(e){}
    return [...new Set(out)].filter(k=>THEMES&&THEMES[k]);
  }

  function setRandomStyleEnabled(enabled){
    S.settings.randomStyleOnStart=!!enabled;
    save();
    toast(enabled?'🎲 Estilo aleatorio al entrar: ACTIVADO':'🎲 Estilo aleatorio al entrar: DESACTIVADO',2400);
  }

  function renderRandomToggle(){
    try{
      const host=document.createElement('div');
      host.style.cssText='margin-top:12px;padding:10px 12px;border:1px solid rgba(126,232,255,.16);border-radius:14px;background:rgba(255,255,255,.035)';
      host.innerHTML=
        '<label style="display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer">'+
          '<span><b>🎲 Estilo aleatorio al entrar</b><span style="display:block;font-size:12px;opacity:.72;margin-top:2px">Elige automáticamente otro estilo que ya hayas comprado cada vez que abras el juego.</span></span>'+
          '<input id="swqRandomStyleToggle" type="checkbox" style="width:20px;height:20px;accent-color:#42ddff;flex:0 0 auto" '+(S.settings.randomStyleOnStart?'checked':'')+'>'+
        '</label>';
      const cb=host.querySelector('#swqRandomStyleToggle');
      cb?.addEventListener('change',()=>setRandomStyleEnabled(cb.checked));
      return host;
    }catch(e){return null}
  }

  function addThemeWindowToggle(){
    const overlay=document.getElementById('swqSimpleThemeOverlay');
    if(!overlay||overlay.querySelector('#swqRandomStyleToggle'))return;
    const panel=overlay.querySelector('div');
    if(!panel)return;
    const apply=panel.querySelector('#swqSimpleThemeApply');
    const block=renderRandomToggle();
    if(block)panel.insertBefore(block,apply||null);
  }

  /* El botón real del perfil abre la función local swqSimpleOpenTheme directamente.
     Observamos el DOM para añadir el interruptor también en ese camino. */
  try{
    const obs=new MutationObserver(()=>{try{addThemeWindowToggle()}catch(e){}});
    obs.observe(document.body,{childList:true,subtree:true});
    setInterval(()=>{try{addThemeWindowToggle()}catch(e){}},500);
  }catch(e){}
  
  try{
    if(typeof window.swqQuickTheme==='function'&&!window.__swqRandomStyleThemeWrap20260922){
      const baseQuickTheme=window.swqQuickTheme;
      window.swqQuickTheme=function(){
        const out=baseQuickTheme.apply(this,arguments);
        setTimeout(addThemeWindowToggle,0);
        return out;
      };
      window.__swqRandomStyleThemeWrap20260922=true;
    }
  }catch(e){console.warn('SWQ random style selector',e)}

  try{
    if(typeof window.settings==='function'&&!window.__swqRandomStyleSettingsWrap20260922){
      const baseSettings=window.settings;
      window.settings=function(){
        const out=baseSettings.apply(this,arguments);
        setTimeout(()=>{
          try{
            const modal=document.querySelector('#modal');
            if(!modal||modal.querySelector('#swqRandomStyleToggle'))return;
            const host=renderRandomToggle();
            const music=modal.querySelector('#sMusic');
            const parent=music?.closest?.('.checkrow');
            if(host){
              if(parent&&parent.parentNode)parent.parentNode.insertBefore(host,parent.nextSibling);
              else modal.querySelector('.field')?.after(host);
            }
          }catch(e){}
        },0);
        return out;
      };
      window.__swqRandomStyleSettingsWrap20260922=true;
    }
  }catch(e){}

  try{
    if(typeof window.saveSettings==='function'&&!window.__swqRandomStyleSaveWrap20260922){
      const baseSaveSettings=window.saveSettings;
      window.saveSettings=function(){
        const cb=document.getElementById('swqRandomStyleToggle');
        if(cb)S.settings.randomStyleOnStart=!!cb.checked;
        return baseSaveSettings.apply(this,arguments);
      };
      window.__swqRandomStyleSaveWrap20260922=true;
    }
  }catch(e){}

  let entryApplied=false;
  function applyRandomStyleOnEntry(){
    if(entryApplied)return;
    entryApplied=true;
    try{
      if(!S.settings.randomStyleOnStart)return;
      const keys=ownedThemes();
      if(keys.length<=1)return;
      const current=S.settings.theme;
      const choices=keys.filter(k=>k!==current);
      const next=choices[Math.floor(Math.random()*choices.length)]||keys[0];
      if(!THEMES[next])return;
      S.settings.theme=next;
      save();
      if(typeof applyTheme==='function')applyTheme();
      if(next==='RandomBasic'){
        try{if(typeof applyRandomBasic==='function')applyRandomBasic();}catch(e){}
        setTimeout(()=>{try{if(typeof startDice==='function')startDice();}catch(e){}},80);
      }
    }catch(e){console.warn('SWQ random style on entry',e)}
  }

  setTimeout(applyRandomStyleOnEntry,420);
  window.swqSetRandomStyleOnStart=setRandomStyleEnabled;
})();

/* === SWQ RANK REWARD GUARD + RANDOM START STYLE 2026-09-22 === */
(function(){
  'use strict';
  if(window.__SWQ_RANK_REWARD_GUARD_RANDOM_STYLE_20260922__)return;
  window.__SWQ_RANK_REWARD_GUARD_RANDOM_STYLE_20260922__=true;

  function ensureRandomThemeSetting(){
    if(!S.settings)S.settings={};
    if(typeof S.settings.randomThemeOnStart!=='boolean')S.settings.randomThemeOnStart=false;
  }

  /* Guarda el cursor de recompensas también en la partida sincronizada. */
  try{
    if(typeof cloudGameState==='function'&&!window.__swqCloudRankCursorWrapped){
      const baseCloudGameState=cloudGameState;
      cloudGameState=function(){
        const out=baseCloudGameState.apply(this,arguments)||{};
        out.rankRewardHighWater=Number.isFinite(Number(S.__swqRankRewardHighWater))
          ?Number(S.__swqRankRewardHighWater)
          :Math.max(0,currentRank().i);
        return out;
      };
      window.__swqCloudRankCursorWrapped=true;
    }
    if(typeof applyCloudGameState==='function'&&!window.__swqCloudRankCursorApplyWrapped){
      const baseApplyCloudGameState=applyCloudGameState;
      applyCloudGameState=function(gs){
        const localCursor=Number.isFinite(Number(S.__swqRankRewardHighWater))
          ?Number(S.__swqRankRewardHighWater)
          :-1;
        const remoteCursor=Number.isFinite(Number(gs?.rankRewardHighWater))
          ?Number(gs.rankRewardHighWater)
          :-1;
        const remoteHasCursor=remoteCursor>=0;
        const out=baseApplyCloudGameState.apply(this,arguments);
        const nowRank=Math.max(0,currentRank().i);

        let merged=Math.max(localCursor,remoteCursor);
        if(!remoteHasCursor)merged=Math.max(merged,nowRank);
        merged=Math.min(Math.max(0,merged),nowRank);

        S.__swqRankRewardHighWater=merged;
        const set=new Set(Array.isArray(S.rankRewardsClaimed)?S.rankRewardsClaimed:[]);
        if(typeof SWQ_RANK_REWARDS!=='undefined'){
          SWQ_RANK_REWARDS.forEach(reward=>{
            const ri=RANKS.findIndex(r=>r.c===reward.c);
            if(ri>=0&&ri<=merged)set.add(reward.c);
          });
        }
        S.rankRewardsClaimed=[...set];
        save();
        return out;
      };
      window.__swqCloudRankCursorApplyWrapped=true;
    }
  }catch(e){console.warn('SWQ rank cloud cursor',e)}

  try{
    if(!Number.isFinite(Number(S.__swqRankRewardHighWater))){
      S.__swqRankRewardHighWater=Math.max(0,currentRank().i);
    }
    const cursor=Math.max(0,Number(S.__swqRankRewardHighWater)||0);
    const set=new Set(Array.isArray(S.rankRewardsClaimed)?S.rankRewardsClaimed:[]);
    if(typeof SWQ_RANK_REWARDS!=='undefined'){
      SWQ_RANK_REWARDS.forEach(reward=>{
        const ri=RANKS.findIndex(r=>r.c===reward.c);
        if(ri>=0&&ri<=cursor)set.add(reward.c);
      });
      S.rankRewardsClaimed=[...set];
    }
    save();
  }catch(e){}

  /* ===== Estilo aleatorio al entrar ===== */
  function ownedTheme(k){
    if(k==='Aqua')return true;
    return !!(S.purchases?.['theme_'+k]||S.shopUnlocks?.['theme_'+k]);
  }
  function ownedThemes(){
    const out=[];
    try{
      Object.keys(THEMES||{}).forEach(k=>{
        if(THEMES[k]&&ownedTheme(k))out.push(k);
      });
    }catch(e){}
    return [...new Set(out)];
  }
  function applyRandomStartTheme(){
    ensureRandomThemeSetting();
    if(!S.profile||!S.settings.randomThemeOnStart)return false;
    const owned=ownedThemes();
    if(owned.length<2)return false;
    const previous=String(S.settings.theme||'Aqua');
    const options=owned.filter(k=>k!==previous);
    if(!options.length)return false;
    const next=options[Math.floor(Math.random()*options.length)];
    S.settings.theme=next;
    save();
    try{
      applyTheme();
      if(next==='RandomBasic'){
        try{if(typeof applyRandomBasic==='function')applyRandomBasic();}catch(e){}
        setTimeout(()=>{try{if(typeof startDice==='function')startDice();}catch(e){}},80);
      }
    }catch(e){console.warn('SWQ random start theme apply',e)}
    return next;
  }

  function injectStyleWindowSwitch(){
    try{
      const overlay=document.getElementById('swqSimpleThemeOverlay');
      if(!overlay)return false;
      const applyBtn=overlay.querySelector('#swqSimpleThemeApply');
      if(!applyBtn||overlay.querySelector('#swqRandomThemeSwitch'))return true;
      ensureRandomThemeSetting();

      const row=document.createElement('label');
      row.id='swqRandomThemeSwitch';
      row.style.cssText='display:flex;align-items:center;gap:8px;margin-top:10px;padding:9px 10px;border:1px solid rgba(126,232,255,.18);border-radius:12px;background:rgba(126,232,255,.045);font-size:12px;font-weight:800;line-height:1.25;cursor:pointer';
      row.innerHTML='<input id="swqRandomThemeToggle" type="checkbox" style="width:auto;flex:0 0 auto;margin:0" '+(S.settings.randomThemeOnStart?'checked':'')+'><span>🎲 Estilo aleatorio al entrar<small style="display:block;opacity:.68;font-weight:500;margin-top:2px">En cada nueva apertura usa otro estilo que ya tengas.</small></span>';
      applyBtn.parentNode.insertBefore(row,applyBtn);

      row.querySelector('#swqRandomThemeToggle')?.addEventListener('change',e=>{
        S.settings.randomThemeOnStart=!!e.target.checked;
        save();
        toast(S.settings.randomThemeOnStart?'🎲 Estilo aleatorio activado.':'🎨 Estilo aleatorio desactivado.',2600);
      });
      return true;
    }catch(e){console.warn('SWQ random style window switch',e);return false}
  }

  try{
    ensureRandomThemeSetting();
    if(typeof window.swqQuickTheme==='function'&&!window.__swqRandomQuickThemeWrapped){
      const baseQuickTheme=window.swqQuickTheme;
      window.swqQuickTheme=function(){
        const out=baseQuickTheme.apply(this,arguments);
        setTimeout(injectStyleWindowSwitch,0);
        setTimeout(injectStyleWindowSwitch,80);
        return out;
      };
      window.__swqRandomQuickThemeWrapped=true;
    }

    if(typeof settings==='function'&&!window.__swqRandomSettingsWrapped){
      const baseSettings=settings;
      settings=function(){
        const out=baseSettings.apply(this,arguments);
        setTimeout(()=>{
          try{
            ensureRandomThemeSetting();
            const modalRoot=document.querySelector('#modal .modal');
            if(!modalRoot||modalRoot.querySelector('#swqRandomThemeSettingsRow'))return;
            const row=document.createElement('label');
            row.id='swqRandomThemeSettingsRow';
            row.style.cssText='display:flex;align-items:center;gap:8px;margin:9px 0;padding:9px 10px;border:1px solid rgba(126,232,255,.18);border-radius:12px;background:rgba(126,232,255,.04);font-size:12px;font-weight:800;line-height:1.25;cursor:pointer';
            row.innerHTML='<input id="swqRandomThemeSettingsToggle" type="checkbox" style="width:auto;flex:0 0 auto;margin:0" '+(S.settings.randomThemeOnStart?'checked':'')+'><span>🎲 Estilo aleatorio al entrar<small style="display:block;opacity:.68;font-weight:500;margin-top:2px">Usa únicamente estilos que ya tengas.</small></span>';
            const saveButton=[...modalRoot.querySelectorAll('button')].find(b=>b.textContent.trim()==='Guardar');
            if(saveButton)modalRoot.insertBefore(row,saveButton);else modalRoot.appendChild(row);
            row.querySelector('#swqRandomThemeSettingsToggle')?.addEventListener('change',e=>{
              S.settings.randomThemeOnStart=!!e.target.checked;
              save();
              toast(S.settings.randomThemeOnStart?'🎲 Estilo aleatorio activado.':'🎨 Estilo aleatorio desactivado.',2600);
            });
          }catch(e){console.warn('SWQ random settings switch',e)}
        },0);
        return out;
      };
      window.__swqRandomSettingsWrapped=true;
    }

    if(typeof saveSettings==='function'&&!window.__swqRandomSaveSettingsWrapped){
      const baseSaveSettings=saveSettings;
      saveSettings=function(){
        const toggle=document.getElementById('swqRandomThemeSettingsToggle');
        if(toggle)S.settings.randomThemeOnStart=!!toggle.checked;
        return baseSaveSettings.apply(this,arguments);
      };
      window.__swqRandomSaveSettingsWrapped=true;
    }
  }catch(e){console.warn('SWQ random style UI',e)}

  /* Solo corre una vez por carga; nunca cambia el estilo durante una sesión. */
  setTimeout(()=>{
    try{
      const next=applyRandomStartTheme();
      if(next&&typeof render==='function')render();
    }catch(e){console.warn('SWQ random style startup',e)}
  },220);
})();


/* === SWQ AUTHORITATIVE RANK REWARD GUARD + RANDOM PURCHASED STYLE 2026-09-22 v20 === */
(function(){
  'use strict';
  if(window.__SWQ_AUTH_V20__)return;
  window.__SWQ_AUTH_V20__=true;

  /* ===== RANGOS: no volver a cobrar rangos anteriores ===== */
  try{
    const currentIdx=Math.max(0,currentRank().i);

    /*
      La versión anterior podía conservar un cursor menor que el rango real.
      En una partida ya existente no podemos reconstruir de forma fiable qué
      recompensas antiguas fueron cobradas, así que este parche fija el punto
      de partida en el rango actual: desde ahora solo se pagan rangos nuevos.
    */
    const claimed=new Set(Array.isArray(S.rankRewardsClaimed)?S.rankRewardsClaimed:[]);
    if(typeof SWQ_RANK_REWARDS!=='undefined'){
      SWQ_RANK_REWARDS.forEach(reward=>{
        const ri=RANKS.findIndex(r=>r.c===reward.c);
        if(ri>=0&&ri<=currentIdx)claimed.add(reward.c);
      });
    }
    S.rankRewardsClaimed=[...claimed];
    S.__swqRankRewardHighWater=currentIdx;
    S.rankRewardCoins=0;
    S.rankRewardXP=0;
    S.__swqRankRewardGuardV3=true;
    save();
  }catch(e){console.warn('SWQ reward guard v20',e)}

  /*
    Punto importante: al empezar un nuevo gainXP, el cursor debe ser exactamente
    el rango anterior, nunca uno menor. Así un salto normal 3 -> 4 entrega solo
    la recompensa de 4; un salto 3 -> 5 entrega 4 y 5, y nada anterior.
  */
  try{
    if(typeof gainXP==='function'&&!window.__swqGainXPAuthV20){
      const baseGainXPAuthV20=gainXP;
      gainXP=function(amount){
        try{
          S.__swqRankRewardHighWater=Math.max(-1,currentRank().i);
        }catch(e){}
        return baseGainXPAuthV20.apply(this,arguments);
      };
      window.__swqGainXPAuthV20=true;
    }
  }catch(e){console.warn('SWQ gainXP reward guard v20',e)}

  /* ===== ESTILO ALEATORIO: únicamente estilos comprados ===== */
  try{
    if(!S.settings)S.settings={};
    S.settings.randomThemeOnStart=!!S.settings.randomThemeOnStart;

    /* Desactiva el sistema anterior para que no pueda cambiar dos veces al abrir. */
    S.settings.randomStyleOnStart=false;

    function boughtThemesV20(){
      const out=['Aqua'];
      try{
        Object.keys(THEMES||{}).forEach(k=>{
          if(k==='Aqua')return;
          if(S.purchases?.['theme_'+k]===true)out.push(k);
        });
      }catch(e){}
      return [...new Set(out)].filter(k=>THEMES&&THEMES[k]);
    }

    function applyRandomPurchasedStyleV20(){
      try{
        if(!S.settings.randomThemeOnStart)return false;
        const owned=boughtThemesV20();
        if(owned.length<2)return false;

        const current=String(S.settings.theme||'Aqua');
        const choices=owned.filter(k=>k!==current);
        if(!choices.length)return false;

        const next=choices[Math.floor(Math.random()*choices.length)];
        if(!THEMES[next])return false;

        S.settings.theme=next;
        S.settings.randomStyleOnStart=false;
        save();
        if(typeof applyTheme==='function')applyTheme();

        if(next==='RandomBasic'){
          try{if(typeof applyRandomBasic==='function')applyRandomBasic();}catch(e){}
          setTimeout(()=>{try{if(typeof startDice==='function')startDice();}catch(e){}},80);
        }
        return true;
      }catch(e){
        console.warn('SWQ purchased random style v20',e);
        return false;
      }
    }

    function hideOldRandomStyleUIV20(){
      document.querySelectorAll('#swqRandomStyleToggle,#swqRandomStyleSettingsToggle').forEach(el=>{
        const host=el.closest('label')||el.parentElement;
        if(host)host.style.display='none';
      });
    }

    function syncRandomStyleSettingV20(checked){
      S.settings.randomThemeOnStart=!!checked;
      S.settings.randomStyleOnStart=false;
      save();
      toast(S.settings.randomThemeOnStart?'🎲 Estilo aleatorio activado.':'🎨 Estilo aleatorio desactivado.',2200);
    }

    function injectRandomStyleWindowV20(){
      try{
        hideOldRandomStyleUIV20();

        const overlay=document.getElementById('swqSimpleThemeOverlay');
        if(overlay){
          const applyBtn=overlay.querySelector('#swqSimpleThemeApply');
          if(applyBtn&&!overlay.querySelector('#swqRandomThemeSwitchV20')){
            const row=document.createElement('label');
            row.id='swqRandomThemeSwitchV20';
            row.style.cssText='display:flex;align-items:center;gap:8px;margin:8px 0 0;padding:8px 10px;border:1px solid rgba(126,232,255,.16);border-radius:11px;background:rgba(126,232,255,.035);font-size:12px;font-weight:800;line-height:1.2;cursor:pointer';
            row.innerHTML='<input id="swqRandomThemeToggleV20" type="checkbox" style="width:auto;flex:0 0 auto;margin:0" '+(S.settings.randomThemeOnStart?'checked':'')+'><span>🎲 Aleatorio al entrar<small style="display:block;opacity:.66;font-weight:500;margin-top:2px">Solo estilos que ya compraste.</small></span>';
            applyBtn.parentNode.insertBefore(row,applyBtn);
            row.querySelector('#swqRandomThemeToggleV20')?.addEventListener('change',e=>syncRandomStyleSettingV20(e.target.checked));
          }
        }

        const modalRoot=document.querySelector('#modal .modal');
        if(modalRoot){
          const old=modalRoot.querySelector('#swqRandomThemeSettingsRow');
          const saveButton=[...modalRoot.querySelectorAll('button')].find(b=>b.textContent.trim()==='Guardar');
          if(!modalRoot.querySelector('#swqRandomThemeSettingsRowV20')){
            const row=document.createElement('label');
            row.id='swqRandomThemeSettingsRowV20';
            row.style.cssText='display:flex;align-items:center;gap:8px;margin:9px 0;padding:8px 10px;border:1px solid rgba(126,232,255,.16);border-radius:11px;background:rgba(126,232,255,.035);font-size:12px;font-weight:800;line-height:1.2;cursor:pointer';
            row.innerHTML='<input id="swqRandomThemeSettingsToggleV20" type="checkbox" style="width:auto;flex:0 0 auto;margin:0" '+(S.settings.randomThemeOnStart?'checked':'')+'><span>🎲 Aleatorio al entrar<small style="display:block;opacity:.66;font-weight:500;margin-top:2px">Solo estilos que ya compraste.</small></span>';
            if(saveButton)modalRoot.insertBefore(row,saveButton);else modalRoot.appendChild(row);
            row.querySelector('#swqRandomThemeSettingsToggleV20')?.addEventListener('change',e=>syncRandomStyleSettingV20(e.target.checked));
          }else{
            const cb=modalRoot.querySelector('#swqRandomThemeSettingsToggleV20');
            if(cb&&cb.checked!==!!S.settings.randomThemeOnStart)cb.checked=!!S.settings.randomThemeOnStart;
          }
          if(old)old.style.display='none';
        }
      }catch(e){}
    }

    /* Mantiene un solo interruptor visible aunque los parches anteriores reconstruyan el modal. */
    try{
      const obs=new MutationObserver(()=>injectRandomStyleWindowV20());
      obs.observe(document.body,{childList:true,subtree:true});
      setInterval(injectRandomStyleWindowV20,700);
    }catch(e){}

    let applied=false,tries=0;
    function tryApplyOnceV20(){
      if(applied)return;
      tries++;
      try{
        if(!S.settings.randomThemeOnStart)return;
        if(!S.profile||typeof currentRank!=='function')return;
        if(applyRandomPurchasedStyleV20())applied=true;
      }catch(e){}
      if(!applied&&tries<15)setTimeout(tryApplyOnceV20,500);
    }

    /* Después de una sincronización de cuenta también puede haber llegado el perfil. */
    if(typeof applyCloudGameState==='function'&&!window.__swqRandomCloudV20){
      const baseCloudRandomV20=applyCloudGameState;
      applyCloudGameState=function(gs){
        const out=baseCloudRandomV20.apply(this,arguments);
        setTimeout(tryApplyOnceV20,120);
        return out;
      };
      window.__swqRandomCloudV20=true;
    }

    setTimeout(tryApplyOnceV20,260);
    setTimeout(injectRandomStyleWindowV20,300);
    S.settings.randomStyleOnStart=false;
    save();
  }catch(e){console.warn('SWQ random purchase style v20',e)}
})();
