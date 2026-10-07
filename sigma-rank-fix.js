/* Aqualithium · Sigma + rank level balance · 2026-10-07 */
(function(){
  'use strict';
  if(window.__SWQ_SIGMA_RANK_PATCH_20261007__) return;
  window.__SWQ_SIGMA_RANK_PATCH_20261007__=true;

  /* Todos los rangos: requisito de NIVEL reducido un pequeño 5%.
     Se ejecuta una sola vez y conserva metros/entrenamientos/recompensas. */
  try{
    if(Array.isArray(window.RANKS)){
      window.RANKS.forEach(r=>{
        const lv=Number(r?.lv);
        if(Number.isFinite(lv)&&lv>0&&!r.__sigmaLvBalanced){
          r.lv=Math.max(1,Math.floor(lv*0.95));
          r.__sigmaLvBalanced=true;
        }
      });
    }
  }catch(e){ console.warn('SWQ Sigma rank balance',e); }

  const SIGMA_KEY='Sigma';

  function ensureSigma(){
    try{
      if(typeof THEMES!=='undefined' && !THEMES[SIGMA_KEY]){
        THEMES[SIGMA_KEY]={
          a:'#d8e2e8',
          b:'#6f7d88',
          emoji:'🗿',
          desc:'Lluvia de moáis con rayas horizontales a toda velocidad.'
        };
      }
      if(typeof SHOP!=='undefined' && Array.isArray(SHOP) && !SHOP.some(x=>x.id==='theme_Sigma')){
        SHOP.push({
          id:'theme_Sigma',
          icon:'🗿',
          name:'Sigma',
          price:750,
          desc:'Lluvia de moáis y rayas horizontales rápidas.',
          buy:()=>{ S.purchases=S.purchases||{}; S.purchases.theme_Sigma=true; }
        });
      }
    }catch(e){ console.warn('SWQ Sigma registration',e); }
  }

  function sigmaCSS(){
    if(document.getElementById('swq-sigma-style')) return;
    const s=document.createElement('style');
    s.id='swq-sigma-style';
    s.textContent=`
body.theme-sigma{
  --a:#d8e2e8!important;
  --b:#66737e!important;
  background:#070b0f!important;
  overflow-x:hidden!important;
}
body.theme-sigma::before{
  content:"";
  position:fixed;
  inset:-25%;
  z-index:-3;
  pointer-events:none;
  background:
    repeating-linear-gradient(
      90deg,
      rgba(255,255,255,.055) 0 2px,
      transparent 2px 28px,
      rgba(130,150,165,.08) 28px 31px,
      transparent 31px 58px
    );
  background-size:220px 100%;
  animation:swqSigmaLines .42s linear infinite;
  opacity:.95;
}
body.theme-sigma::after{
  content:"";
  position:fixed;
  inset:0;
  z-index:-2;
  pointer-events:none;
  background:
    repeating-linear-gradient(
      90deg,
      transparent 0 16px,
      rgba(255,255,255,.13) 16px 19px,
      transparent 19px 82px
    );
  animation:swqSigmaLines2 .68s linear infinite;
  mix-blend-mode:screen;
  opacity:.62;
}
@keyframes swqSigmaLines{
  from{background-position:0 0}
  to{background-position:-220px 0}
}
@keyframes swqSigmaLines2{
  from{background-position:0 0}
  to{background-position:330px 0}
}
body.theme-sigma .card,
body.theme-sigma .hero,
body.theme-sigma .nav{
  background:linear-gradient(180deg,rgba(13,18,23,.94),rgba(5,8,11,.97))!important;
  border-color:rgba(190,210,220,.22)!important;
}
body.theme-sigma .btn.primary{
  background:linear-gradient(135deg,#eef5f8,#707d87)!important;
  color:#081015!important;
}
body.theme-sigma .logo{
  background:linear-gradient(135deg,#f2f6f8,#65727d)!important;
  box-shadow:0 0 28px rgba(220,235,245,.18)!important;
}
.swq-sigma-moai-layer{
  position:fixed;
  inset:0;
  z-index:3;
  pointer-events:none;
  overflow:hidden;
}
.swq-sigma-moai{
  position:absolute;
  top:-12vh;
  font-size:clamp(20px,4vw,38px);
  line-height:1;
  opacity:.88;
  filter:drop-shadow(0 4px 5px rgba(0,0,0,.5));
  animation:swqSigmaMoaiFall var(--moai-dur,4.2s) linear forwards;
  will-change:transform;
}
@keyframes swqSigmaMoaiFall{
  from{transform:translate3d(0,-12vh,0) rotate(0deg)}
  to{transform:translate3d(var(--moai-drift,0px),112vh,0) rotate(var(--moai-spin,180deg))}
}
`;
    document.head.appendChild(s);
  }

  let moaiLayer=null;
  let moaiTimer=null;

  function clearMoai(){
    if(moaiTimer){clearInterval(moaiTimer);moaiTimer=null;}
    if(moaiLayer){moaiLayer.remove();moaiLayer=null;}
  }

  function spawnMoai(){
    if(!moaiLayer) return;
    const el=document.createElement('span');
    el.className='swq-sigma-moai';
    el.textContent='🗿';
    el.style.left=(Math.random()*100)+'vw';
    el.style.setProperty('--moai-dur',(2.5+Math.random()*2.8).toFixed(2)+'s');
    el.style.setProperty('--moai-drift',((Math.random()-.5)*120).toFixed(0)+'px');
    el.style.setProperty('--moai-spin',((Math.random()>.5?1:-1)*(90+Math.random()*300)).toFixed(0)+'deg');
    el.style.fontSize=(20+Math.random()*24).toFixed(0)+'px';
    el.style.opacity=(.55+Math.random()*.4).toFixed(2);
    moaiLayer.appendChild(el);
    setTimeout(()=>el.remove(),6000);
  }

  function syncSigma(){
    ensureSigma();
    sigmaCSS();
    const active=!!(typeof S!=='undefined' && S?.settings?.theme===SIGMA_KEY);
    if(!active){
      clearMoai();
      return;
    }
    if(!moaiLayer){
      moaiLayer=document.createElement('div');
      moaiLayer.className='swq-sigma-moai-layer';
      moaiLayer.id='swqSigmaMoaiLayer';
      document.body.appendChild(moaiLayer);
      for(let i=0;i<12;i++) setTimeout(spawnMoai,i*90);
      moaiTimer=setInterval(spawnMoai,260);
    }
  }

  ensureSigma();
  sigmaCSS();

  /* render() is the common path after changing themes/settings. */
  try{
    if(typeof render==='function'&&!window.__SWQ_SIGMA_RENDER_WRAP__){
      const baseRender=render;
      render=function(){
        const out=baseRender.apply(this,arguments);
        setTimeout(syncSigma,0);
        return out;
      };
      window.__SWQ_SIGMA_RENDER_WRAP__=true;
    }
  }catch(e){ console.warn('SWQ Sigma render wrapper',e); }

  setTimeout(syncSigma,0);
  setTimeout(()=>{try{if(typeof render==='function')render()}catch(e){}},120);
})();