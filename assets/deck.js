/* Palestra COMURT Diamante — motor do deck (sem biblioteca externa, roda offline) */
(function(){
  if(/estatico/.test(location.search)) document.documentElement.classList.add('estatico');
  // modo leve: celular e tablet (o Safari do iPhone fecha a aba se a página pede memória demais)
  const LEVE = /leve/.test(location.search) || matchMedia('(pointer:coarse)').matches || /iPhone|iPad|iPod/.test(navigator.userAgent);
  if(LEVE) document.documentElement.classList.add('leve');
  const stage = document.getElementById('stage');
  const slides = [...document.querySelectorAll('.slide')];
  const progress = document.getElementById('progress');
  const parteEl = document.getElementById('parte');
  const notas = document.getElementById('notas');
  let cur = -1, inicio = Date.now(), inicioSlide = Date.now();

  /* ---------- escala 1600x900 em qualquer tela ---------- */
  function fit(){
    const s = Math.min(innerWidth/1600, innerHeight/900);
    stage.style.transform = `scale(${s})`;
    field.resize();
  }

  /* ---------- palavra por palavra ---------- */
  document.querySelectorAll('.split').forEach(el=>{
    let i = 0;
    const walk = node=>{
      [...node.childNodes].forEach(n=>{
        if(n.nodeType===3){
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(p=>{
            if(!p) return;
            if(/^\s+$/.test(p)){ frag.appendChild(document.createTextNode(' ')); return; }
            const s = document.createElement('span'); s.className='w'; s.style.setProperty('--i', i++); s.textContent=p; frag.appendChild(s);
          });
          n.replaceWith(frag);
        } else if(n.nodeType===1 && n.tagName!=='BR'){
          // elemento inline (em, b): vira uma palavra animada inteira se for curto
          if(n.textContent.trim().split(/\s+/).length<=1){ n.classList.add('w'); n.style.setProperty('--i', i++); }
          else walk(n);
        }
      });
    };
    walk(el);
  });

  /* ---------- geradores de pontos (polaridade etc.) ---------- */
  const rnd=(a,b)=>a+Math.random()*(b-a);
  document.querySelectorAll('[data-dots]').forEach(box=>{
    const n=+box.dataset.dots, tipo=box.dataset.tipo;
    for(let k=0;k<n;k++){
      const d=document.createElement('span'); d.className='dot';
      if(tipo==='pos'){ const s=rnd(18,46); Object.assign(d.style,{width:s+'px',height:s+'px',left:rnd(5,85)+'%',top:rnd(55,85)+'%',animationDuration:rnd(5,9)+'s',animationDelay:-rnd(0,9)+'s'}); }
      if(tipo==='neu'){ const s=rnd(6,12); Object.assign(d.style,{width:s+'px',height:s+'px',animationDuration:rnd(3,6)+'s',animationDelay:-rnd(0,6)+'s'}); d.style.setProperty('--r',rnd(30,110)+'px'); }
      if(tipo==='neg'){ const s=rnd(40,90); Object.assign(d.style,{width:s+'px',height:s+'px',left:rnd(5,70)+'%',top:rnd(10,60)+'%',animationDelay:-rnd(0,5)+'s,'+(-rnd(0,6))+'s'}); }
      if(tipo==='egr'){ const s=rnd(6,12), x=rnd(5,95), y=rnd(5,80); Object.assign(d.style,{width:s+'px',height:s+'px',left:x+'%',top:y+'%',animationDelay:-rnd(0,4.5)+'s'});
        d.style.setProperty('--tx',(50-x)*3.2+'px'); d.style.setProperty('--ty',(40-y)*4.2+'px'); }
      if(tipo==='gota'){ const ang=rnd(0,Math.PI*2), r=rnd(200,260); d.className='gota';
        d.style.setProperty('--x',(280+Math.cos(ang)*r)+'px'); d.style.setProperty('--y',(220+Math.sin(ang)*r*.8)+'px');
        d.style.setProperty('--tx',(-Math.cos(ang)*r)+'px'); d.style.setProperty('--ty',(-Math.sin(ang)*r*.8)+'px'); d.style.setProperty('--dl',-rnd(0,2.4)+'s'); }
      if(tipo==='gotejo'){ d.className='gotejo'; Object.assign(d.style,{left:rnd(0,100)+'%',width:rnd(10,30)+'px',height:rnd(40,120)+'px',animationDuration:rnd(5,11)+'s',animationDelay:-rnd(0,11)+'s',opacity:rnd(.4,.9)}); }
      box.appendChild(d);
    }
  });

  /* ---------- campo de partículas (o "campo" muda com a palestra) ---------- */
  const MODOS = {
    luz:   {n:70, c:[161,135,83], a:.55, s:[1.5,4], vy:-.25, jit:.25, glow:6},
    rosa:  {n:80, c:[226,150,175], a:.7, s:[2,5], vy:-.2, jit:.3, glow:12},
    ouro:  {n:110,c:[226,200,140], a:.8, s:[1.5,4.5], vy:-.35, jit:.3, glow:14},
    neutro:{n:90, c:[170,168,158], a:.35, s:[1.5,3.5], vy:0, jit:.5, glow:0},
    denso: {n:60, c:[120,122,108], a:.28, s:[6,18], vy:.12, jit:.12, glow:0},
    lodo:  {n:45, c:[70,64,48], a:.45, s:[14,34], vy:.22, jit:.06, glow:0},
    limpo: {n:120,c:[226,200,140], a:.85, s:[1.5,4], vy:-.7, jit:.35, glow:16},
    nada:  {n:0, c:[161,135,83], a:0, s:[1,2], vy:0, jit:0, glow:0}
  };
  const field = (()=>{
    const cv=document.getElementById('field'), ctx=cv.getContext('2d');
    cv.width=1600; cv.height=900;
    let P=[], alvo=MODOS.luz, atual=JSON.parse(JSON.stringify(MODOS.luz));
    const novo=()=>({x:rnd(0,1600),y:rnd(0,900),r:rnd(0,1),ph:rnd(0,6.28),life:0});
    for(let i=0;i<atual.n;i++) P.push(novo());
    const lerp=(a,b,t)=>a+(b-a)*t;
    function tick(){
      const t=.012;
      atual.c=atual.c.map((v,i)=>lerp(v,alvo.c[i],t)); atual.a=lerp(atual.a,alvo.a,t);
      atual.s=[lerp(atual.s[0],alvo.s[0],t),lerp(atual.s[1],alvo.s[1],t)];
      atual.vy=lerp(atual.vy,alvo.vy,t); atual.jit=lerp(atual.jit,alvo.jit,t); atual.glow=lerp(atual.glow,alvo.glow,t);
      const nAlvo=LEVE?Math.round(alvo.n*.5):alvo.n;
    if(P.length<nAlvo && Math.random()<.5) P.push(novo());
      if(P.length>nAlvo && Math.random()<.5) P.pop();
      ctx.clearRect(0,0,1600,900);
      const [r,g,b]=atual.c.map(Math.round);
      ctx.shadowColor=`rgba(${r},${g},${b},.9)`; ctx.shadowBlur=LEVE?0:atual.glow;
      for(const p of P){
        p.ph+=.02; p.life=Math.min(1,p.life+.01);
        p.x+=Math.sin(p.ph)*atual.jit; p.y+=atual.vy*(.5+p.r);
        if(p.y<-40){p.y=940;p.x=rnd(0,1600)} if(p.y>940){p.y=-40;p.x=rnd(0,1600)}
        const s=lerp(atual.s[0],atual.s[1],p.r);
        const al=atual.a*p.life*(.55+.45*Math.sin(p.ph*1.3));
        ctx.fillStyle=`rgba(${r},${g},${b},${Math.max(0,al)})`;
        ctx.beginPath(); ctx.arc(p.x,p.y,s,0,6.283); ctx.fill();
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    return {modo(m){alvo=MODOS[m]||MODOS.luz}, resize(){}};
  })();

  /* ---------- navegação ---------- */
  const steps = s=>[...s.querySelectorAll('.step')];
  function aplicaStep(st,on){
    st.classList.toggle('on',on);
    const sl=st.closest('.slide');
    (st.dataset.add||'').split(/\s+/).filter(Boolean).forEach(c=>sl.classList.toggle(c,on));
    if(on && st.dataset.field) field.modo(st.dataset.field);
    if(!on && st.dataset.field) field.modo(sl.dataset.field||'luz');
  }
  function show(n, fromBack){
    n=Math.max(0,Math.min(slides.length-1,n));
    if(n===cur) return;
    const old=slides[cur];
    if(old){
      old.classList.remove('active'); old.classList.add('leaving');
      if(old.dataset.out) old.classList.add('out-'+old.dataset.out);
      setTimeout(()=>{old.classList.remove('leaving','out-up'); if(old!==slides[cur]) limpaClasses(old);},900);
    }
    const s=slides[n]; cur=n;
    // reinicia o estado do slide
    steps(s).forEach(st=>aplicaStep(st,false));
    s.classList.remove('active'); void s.offsetWidth;
    s.className = s.className.replace(/\btr-\S+/g,'').trim();
    s.classList.add('tr-'+(s.dataset.trans||'fade'),'active');
    if(fromBack){ steps(s).forEach(st=>aplicaStep(st,true)); }
    stage.classList.remove('t-noite','t-abismo');
    if(s.dataset.theme && s.dataset.theme!=='papel') stage.classList.add('t-'+s.dataset.theme);
    field.modo(s.dataset.field||'luz');
    if(fromBack){ const on=steps(s).filter(x=>x.dataset.field).pop(); if(on) field.modo(on.dataset.field); }
    progress.style.width=((n)/(slides.length-1)*100)+'%';
    parteEl.textContent=s.dataset.part||'';
    history.replaceState(null,'','#'+(n+1));
    inicioSlide=Date.now(); renderNotas();
  }
  // limpa classes de passo ao sair
  function limpaClasses(s){ steps(s).forEach(st=>(st.dataset.add||'').split(/\s+/).filter(Boolean).forEach(c=>s.classList.remove(c))); }
  function next(){
    const s=slides[cur]; const p=steps(s).find(x=>!x.classList.contains('on'));
    if(p){ aplicaStep(p,true); renderNotas(); return; }
    if(cur<slides.length-1) show(cur+1);
  }
  function prev(){
    const s=slides[cur]; const on=steps(s).filter(x=>x.classList.contains('on'));
    if(on.length){ aplicaStep(on[on.length-1],false); renderNotas(); return; }
    if(cur>0) show(cur-1,true);
  }

  /* ---------- notas do orador ---------- */
  const fmt=ms=>{const s=Math.floor(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
  function renderNotas(){
    if(!notas.classList.contains('on')) return;
    const s=slides[cur], nt=s.querySelector('.notes');
    const st=steps(s), feitos=st.filter(x=>x.classList.contains('on')).length;
    notas.innerHTML=`<div class="meta"><span>Slide ${cur+1}/${slides.length}</span><span>Cliques: ${feitos}/${st.length}</span><span>Total: ${fmt(Date.now()-inicio)}</span><span>Neste slide: ${fmt(Date.now()-inicioSlide)}</span><span>${s.dataset.part||''}</span></div>${nt?nt.innerHTML:'<i>(sem notas)</i>'}`;
  }
  setInterval(renderNotas,1000);

  /* ---------- teclado, clique, toque ---------- */
  let buf='';
  addEventListener('keydown',e=>{
    const k=e.key;
    if(['ArrowRight','PageDown',' ','Enter','ArrowDown'].includes(k)){
      if(k==='Enter' && buf){ show(+buf-1); buf=''; e.preventDefault(); return; }
      e.preventDefault(); next(); return; }
    if(['ArrowLeft','PageUp','Backspace','ArrowUp'].includes(k)){ e.preventDefault(); prev(); return; }
    if(k==='Home'){ show(0); return; }
    if(k==='End'){ show(slides.length-1); return; }
    if(/^[0-9]$/.test(k)){ buf+=k; clearTimeout(window._bt); window._bt=setTimeout(()=>buf='',2000); return; }
    const kl=k.toLowerCase();
    if(kl==='f'){ document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen(); }
    if(kl==='n'){ notas.classList.toggle('on'); renderNotas(); }
    if(kl==='b'||k==='.'){ document.getElementById('preto').classList.toggle('on'); }
    if(kl==='r'){ inicio=Date.now(); inicioSlide=Date.now(); }
  });
  stage.addEventListener('click',e=>{ next(); });
  addEventListener('contextmenu',e=>{ e.preventDefault(); prev(); });
  let tx=null;
  addEventListener('touchstart',e=>{tx=e.touches[0].clientX;document.body.classList.add('toque')},{passive:true});
  addEventListener('touchend',e=>{ if(tx===null) return; const dx=e.changedTouches[0].clientX-tx; if(Math.abs(dx)>50){ dx<0?next():prev(); } tx=null; });
  let mt; addEventListener('mousemove',()=>{document.body.classList.remove('cursor-off');clearTimeout(mt);mt=setTimeout(()=>document.body.classList.add('cursor-off'),2500)});

  // imagens opcionais (biômetro da Claudia): some o placeholder quando a imagem existir
  document.querySelectorAll('img[data-opcional]').forEach(img=>{
    img.addEventListener('load',()=>{ const ph=document.getElementById(img.dataset.opcional); if(ph) ph.style.display='none'; img.style.display='block'; });
    img.addEventListener('error',()=>{ img.style.display='none'; });
  });

  // atalho de conferência: deck.ir(12) abre o slide 12 já com todos os cliques dados
  window.deck={ir(n){show(n-1); steps(slides[cur]).forEach(st=>aplicaStep(st,true));}, total:slides.length};
  addEventListener('resize',fit); fit();
  const h=parseInt(location.hash.slice(1)); show(isNaN(h)?0:h-1);
  if(/todos/.test(location.search)) deck.ir(cur+1);
  const aj=document.getElementById('ajuda'); aj.classList.add('on'); setTimeout(()=>aj.classList.remove('on'),6000);
})();
