/* Swim Quest: ajustes finales de Pera + restricción mariposa/suave. */
(function(){
  'use strict';
  const PEAR_ANGER_KEY='SWIM_QUEST_PEAR_ANGER_COUNT';
  const PEAR_NEW_LINES=[
    {speaker:'👤 TÚ',text:'Pera, a veces siento que el Pez es mejor que yo en todo.'},
    {speaker:'🍐 PERA',text:'¿El Pez? Amigo, el Pez y tú cumplen funciones completamente distintas. Que él parezca mejor en algo no significa que sea mejor que tú como persona.'},
    {speaker:'👤 TÚ',text:'Pero en natación se nota. Nada mejor, sabe más cosas y parece tener todo bajo control.'},
    {speaker:'🍐 PERA',text:'Entonces en natación quizá tenga una ventaja en algunas cosas. Eso es un dato concreto, no una sentencia sobre tu valor. Una persona puede destacar muchísimo en un área y aun así ser normal en otras.'},
    {speaker:'👤 TÚ',text:'Supongo que estoy comparando una parte de mí con todo lo que veo del otro.'},
    {speaker:'🍐 PERA',text:'Exactamente. Tú ves tu esfuerzo, tus dudas, tus errores y tus días malos desde dentro. Del otro muchas veces ves el resultado final. Así cualquiera parece perfecto.'},
    {speaker:'👤 TÚ',text:'¿Y si de verdad alguien es mejor que yo en algo que me importa mucho?'},
    {speaker:'🍐 PERA',text:'Puede pasar. Y no convierte esa diferencia en una derrota personal. Tal vez esa persona te gane nadando, pero quizá tú tengas más paciencia, seas mejor explicando algo, tengas más creatividad, seas más observador o se te dé mejor otra cosa que todavía ni has descubierto.'},
    {speaker:'🍐 PERA',text:'No necesitas demostrar que eres mejor que todos. Necesitas construir una versión de ti que conozcas y respetes. El Pez tiene su camino. Tú tienes el tuyo.'},
    {speaker:'👤 TÚ',text:'Entonces compararme con él para decidir cuánto valgo no tiene mucho sentido.'},
    {speaker:'🍐 PERA',text:'Ninguno. Puedes admirarlo, aprender de él y reconocer lo que hace bien sin convertirlo en una medida para castigarte. La admiración construye; la comparación constante te roba perspectiva.'}
  ];

  function localDay(){
    const d=new Date();
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'')||fallback}catch(e){return fallback}}
  function writeJson(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch(e){}}

  // El contador independiente permite 25 aperturas antes de activar el enfado.
  // En la visita 26 dejamos el contador interno justo en 25 para que el código original
  // entre en su estado de enfado tanto en la versión vieja como en la versión parcheada.
  setTimeout(()=>{
    if(typeof window.openPearScene==='function' && !window.__swqPearWrapped){
      const originalOpen=window.openPearScene;
      window.openPearScene=function(){
        const today=localDay();
        let anger=readJson(PEAR_ANGER_KEY,{date:today,count:0});
        if(!anger||anger.date!==today)anger={date:today,count:0};
        anger.count=Number(anger.count||0)+1;
        writeJson(PEAR_ANGER_KEY,anger);
        try{
          writeJson('SWIM_QUEST_PEAR_VISITS',{date:today,count:anger.count<=25?0:25,lockDate:''});
        }catch(e){}
        return originalOpen.apply(this,arguments);
      };
      window.__swqPearWrapped=true;
    }
  },0);

  function patchPearVisuals(){
    document.querySelectorAll('.pear-scene').forEach(scene=>{
      Object.assign(scene.style,{
        overflowY:'auto',
        overflowX:'hidden',
        alignItems:'flex-start',
        justifyContent:'flex-start',
        padding:'14px 10px 120px',
        WebkitOverflowScrolling:'touch',
        touchAction:'pan-y',
        overscrollBehaviorY:'contain'
      });
      scene.querySelectorAll('.pear-shine').forEach(x=>x.remove());
      const stage=scene.querySelector('.pear-stage');
      if(stage)Object.assign(stage.style,{minHeight:'0',height:'auto',justifyContent:'flex-start',width:'100%',padding:'12px 0 28px'});
      const grid=scene.querySelector('.pear-topic-grid');
      if(grid)grid.style.paddingBottom='24px';
    });
  }

  function createEnvyButton(){
    const grid=document.querySelector('#pearScene .pear-topic-grid');
    if(!grid||grid.querySelector('[data-swq-envy-topic]'))return;
    const b=document.createElement('button');
    b.className='pear-topic-btn';
    b.setAttribute('data-swq-envy-topic','1');
    b.innerHTML='<b>"Siento envidia de alguien que parece mejor que yo"</b><span>Comparaciones, natación y aprender a valorar tu propio camino</span>';
    b.addEventListener('click',startEnvyConversation);
    grid.appendChild(b);
  }

  let envyIndex=0;
  function startEnvyConversation(){envyIndex=0;renderEnvyLine();}
  function renderEnvyLine(){
    const old=document.getElementById('pearScene');if(old)old.remove();
    const item=PEAR_NEW_LINES[envyIndex];
    const scene=document.createElement('div');scene.id='pearScene';scene.className='pear-scene';
    scene.innerHTML=`<div class="pear-stage"><div class="pear-emoji">🍐</div><div class="pear-speaker">${escapeHtml(item.speaker)}</div><div class="pear-text">${escapeHtml(item.text)}</div><button class="pear-next" id="swqEnvyNext">${envyIndex<PEAR_NEW_LINES.length-1?'Siguiente':'Terminar'}</button><button class="pear-close" id="swqEnvyClose">Salir</button></div>`;
    document.body.appendChild(scene);patchPearVisuals();
    document.getElementById('swqEnvyNext')?.addEventListener('click',()=>{if(envyIndex<PEAR_NEW_LINES.length-1){envyIndex++;renderEnvyLine();}else{window.closePearScene?.();}});
    document.getElementById('swqEnvyClose')?.addEventListener('click',()=>window.closePearScene?.());
  }
  function escapeHtml(v){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}

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
  document.addEventListener('change',e=>{if(e.target?.matches?.('select.draftInput[data-k="style"],select.draftInput[data-k="intensity"]'))setTimeout(enforceButterfly,0);},true);
  const oldSave=window.saveTraining;
  if(oldSave&&!window.__swqSaveWrapped){window.saveTraining=function(){enforceButterfly();return oldSave.apply(this,arguments)};window.__swqSaveWrapped=true;}

  const observer=new MutationObserver(()=>{patchPearVisuals();createEnvyButton();enforceButterfly();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>{patchPearVisuals();createEnvyButton();enforceButterfly();},250);
})();
