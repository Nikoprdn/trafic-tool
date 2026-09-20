/* ══ SÉCURITÉ : échappement HTML pour toute donnée externe/saisie utilisateur
   insérée via innerHTML (données Worker, noms de fichiers, texte d'incident) ══ */
function escHtml(s){
  if(s===null||s===undefined)return'';
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

/* TABS */
var traficLoaded=false,weatherLoaded=false,antenneLoaded=false;

function switchTab(n){
  document.querySelectorAll('.tab-btn').forEach(function(b){b.classList.remove('active');});
  document.querySelectorAll('.tab-content').forEach(function(c){c.classList.remove('active');});
  var btn=document.getElementById('tab-btn-'+n);
  var tab=document.getElementById('tab-'+n);
  if(btn)btn.classList.add('active');
  if(tab)tab.classList.add('active');
  if(n==='weather'&&!weatherLoaded){wxLoadZone('am');weatherLoaded=true;}
  if(n==='antenne'){if(!antenneLoaded){initNoteAntenne();antenneLoaded=true;}else{naLoadGrilleDuJour();}}
  if(n==='trafic'&&!traficLoaded){loadBoard();loadDis();renderTravelSkeleton();loadTravel();setTimeout(loadA8Traffic,600);traficLoaded=true;}
}


function tick(){var e=document.getElementById('clk');if(e)e.textContent=new Date().toLocaleTimeString('fr-FR',{hour12:false});}
setInterval(tick,1000);tick();

/* == CONVERTISSEUR AUDIO (Outils) == */
(function(){
  var _f=[],_fmt='wav',_ctx=null;
  function gCtx(){if(!_ctx)_ctx=new(window.AudioContext||window.webkitAudioContext)();return _ctx;}
  function sz(b){return b<1048576?(b/1024).toFixed(0)+' Ko':(b/1048576).toFixed(1)+' Mo';}

  window.otSubTab=function(name){
    ['conversion','envois','diffusion'].forEach(function(n){
      var p=document.getElementById('ot-panel-'+n);
      var b=document.getElementById('ot-sub-'+n);
      if(p)p.style.display=(n===name?'':'none');
      if(b)b.classList.toggle('active',n===name);
    });
    if(name==='diffusion'&&typeof window.loadDiffSecours==='function')window.loadDiffSecours();
  };

  window.otFmt=function(f){
    _fmt=f;
    var w=document.getElementById('ot-btn-wav'),m=document.getElementById('ot-btn-mp3');
    if(w){w.style.background=f==='wav'?'rgba(27,94,184,.15)':'transparent';w.style.color=f==='wav'?'#60a5fa':'var(--muted)';w.style.borderBottomColor=f==='wav'?'#60a5fa':'transparent';}
    if(m){m.style.background=f==='mp3'?'rgba(39,174,96,.1)':'transparent';m.style.color=f==='mp3'?'var(--green)':'var(--muted)';m.style.borderBottomColor=f==='mp3'?'var(--green)':'transparent';}
  };

  window.otDrop=function(e){
    e.preventDefault();
    var dz=document.getElementById('ot-dropzone');
    if(dz){dz.style.borderColor='var(--border)';dz.style.background='var(--bg)';}
    otFiles(e.dataTransfer.files);
  };
  window.otFiles=function(fl){
    Array.from(fl).forEach(function(f){
      if(!f.type.startsWith('audio/'))return;
      _f.push({file:f,name:f.name,size:f.size,status:'wait',blobUrl:null,outName:null});
    });
    otRender();
  };
  window.otClear=function(){_f.forEach(function(it){if(it.blobUrl)URL.revokeObjectURL(it.blobUrl);});_f=[];otRender();};
  window.otRm=function(i){if(_f[i]&&_f[i].blobUrl)URL.revokeObjectURL(_f[i].blobUrl);_f.splice(i,1);otRender();};

  function statusChip(it){
    if(it.status==='wait')return '<span style="font-family:\'Share Tech Mono\',monospace;font-size:10px;color:var(--muted);">EN ATTENTE</span>';
    if(it.status==='busy')return '<span style="font-family:\'Share Tech Mono\',monospace;font-size:10px;color:#F5C518;">CONVERSION&hellip;</span>';
    if(it.status==='err')return '<span style="font-family:\'Share Tech Mono\',monospace;font-size:10px;color:var(--red);">ERREUR</span>';
    return '<a href="'+it.blobUrl+'" download="'+escHtml(it.outName)+'" style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--green);text-decoration:none;border:1px solid var(--green);border-radius:5px;padding:4px 12px;">&#11015; '+escHtml(it.outName)+'</a>';
  }

  function otRender(){
    var list=document.getElementById('ot-list');
    var actions=document.getElementById('ot-actions');
    if(!list)return;
    if(!_f.length){list.innerHTML='';if(actions)actions.style.display='none';return;}
    if(actions)actions.style.display='flex';
    list.innerHTML=_f.map(function(it,i){
      return '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:8px;">'
        +'<span style="font-size:16px;">&#127925;</span>'
        +'<div style="flex:1;min-width:0;">'
          +'<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escHtml(it.name)+'</div>'
          +'<div style="font-family:\'Share Tech Mono\',monospace;font-size:10px;color:var(--muted);">'+sz(it.size)+'</div>'
        +'</div>'
        +statusChip(it)
        +'<button onclick="otRm('+i+')" style="background:transparent;border:none;color:var(--muted);cursor:pointer;font-size:16px;padding:2px 6px;">&#10005;</button>'
      +'</div>';
    }).join('');
  }

  /* Encodeur WAV PCM 16-bit, stéréo forcé */
  function encodeWav(audioBuffer){
    var numCh=2,sampleRate=audioBuffer.sampleRate,len=audioBuffer.length;
    var chL=audioBuffer.getChannelData(0);
    var chR=audioBuffer.numberOfChannels>1?audioBuffer.getChannelData(1):chL;
    var bytesPerSample=2,blockAlign=numCh*bytesPerSample;
    var dataSize=len*blockAlign;
    var buf=new ArrayBuffer(44+dataSize),view=new DataView(buf);
    function wStr(o,s){for(var i=0;i<s.length;i++)view.setUint8(o+i,s.charCodeAt(i));}
    wStr(0,'RIFF');view.setUint32(4,36+dataSize,true);wStr(8,'WAVE');
    wStr(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);
    view.setUint16(22,numCh,true);view.setUint32(24,sampleRate,true);
    view.setUint32(28,sampleRate*blockAlign,true);view.setUint16(32,blockAlign,true);
    view.setUint16(34,16,true);wStr(36,'data');view.setUint32(40,dataSize,true);
    var off=44;
    for(var i=0;i<len;i++){
      var l=Math.max(-1,Math.min(1,chL[i])),r=Math.max(-1,Math.min(1,chR[i]));
      view.setInt16(off,l<0?l*0x8000:l*0x7FFF,true);off+=2;
      view.setInt16(off,r<0?r*0x8000:r*0x7FFF,true);off+=2;
    }
    return new Blob([buf],{type:'audio/wav'});
  }

  /* Encodeur MP3 via lamejs (stéréo forcé), chargé depuis CDN */
  function encodeMp3(audioBuffer){
    return new Promise(function(resolve,reject){
      if(typeof lamejs==='undefined'){reject(new Error('lamejs indisponible'));return;}
      try{
        var sampleRate=audioBuffer.sampleRate,len=audioBuffer.length;
        var chL=audioBuffer.getChannelData(0);
        var chR=audioBuffer.numberOfChannels>1?audioBuffer.getChannelData(1):chL;
        function f2i16(f){var s=new Int16Array(f.length);for(var i=0;i<f.length;i++){var v=Math.max(-1,Math.min(1,f[i]));s[i]=v<0?v*0x8000:v*0x7FFF;}return s;}
        var l16=f2i16(chL),r16=f2i16(chR);
        var enc=new lamejs.Mp3Encoder(2,sampleRate,128);
        var chunks=[],block=1152;
        for(var i=0;i<len;i+=block){
          var lc=l16.subarray(i,i+block),rc=r16.subarray(i,i+block);
          var mp3buf=enc.encodeBuffer(lc,rc);
          if(mp3buf.length>0)chunks.push(new Int8Array(mp3buf));
        }
        var end=enc.flush();
        if(end.length>0)chunks.push(new Int8Array(end));
        resolve(new Blob(chunks,{type:'audio/mp3'}));
      }catch(e){reject(e);}
    });
  }

  window.otConvertAll=async function(){
    for(var i=0;i<_f.length;i++){
      var it=_f[i];
      if(it.status==='done')continue;
      it.status='busy';otRender();
      try{
        var arr=await it.file.arrayBuffer();
        var audioBuffer=await gCtx().decodeAudioData(arr);
        var blob=_fmt==='wav'?encodeWav(audioBuffer):await encodeMp3(audioBuffer);
        it.blobUrl=URL.createObjectURL(blob);
        it.outName=it.name.replace(/\.[^.]+$/,'')+'.'+_fmt;
        it.status='done';
      }catch(e){console.warn('Conversion échouée:',it.name,e);it.status='err';}
      otRender();
    }
  };
})();

/* == CARTWALL (Outils > Diffusion) == */
(function(){
  var grid=document.getElementById('cw-grid');
  if(!grid)return;
  var CW_COUNT=16,cells=[],ctxTarget=null;

  var fmt2=function(n){return String(Math.floor(Math.max(0,n))).padStart(2,'0');};
  var fmtTime=function(s){s=Math.max(0,s||0);return fmt2(Math.floor(s/60))+':'+(s%60<10?'0':'')+s.toFixed(1);};
  var fmtDur=function(s){s=Math.max(0,Math.round(s||0));return fmt2(Math.floor(s/60))+':'+fmt2(s%60);};

  function buildEmpty(i){return '<div class="cw-num">'+String(i+1).padStart(2,'0')+'</div><div class="cw-empty-icon">&#8853;</div><div class="cw-empty-lbl">Glisser un son</div><div class="cw-progress"><div class="cw-progress-bar" id="cwp-'+i+'"></div></div>';}
  function buildLoaded(i){var c=cells[i];var d=c.dur>0?fmtDur(c.dur):'--:--';return '<div class="cw-num">'+String(i+1).padStart(2,'0')+'</div><div class="cw-play-indicator">&#9679; AIR</div><div class="cw-title">'+escHtml(c.title)+'</div><div class="cw-timing" id="cwt-'+i+'">'+d+'</div><div class="cw-dur" id="cwd-'+i+'">'+d+'</div><div class="cw-progress"><div class="cw-progress-bar" id="cwp-'+i+'"></div></div>';}

  for(var i=0;i<CW_COUNT;i++){
    (function(i){
      var c={idx:i,el:null,audio:null,file:null,title:null,dur:0,playing:false,raf:null};
      var el=document.createElement('div');
      el.className='cw-cell empty';el.dataset.idx=i;
      el.innerHTML=buildEmpty(i);
      grid.appendChild(el);
      c.el=el;cells.push(c);
      rebind(i);
    })(i);
  }

  function rebind(idx){
    var c=cells[idx],el=c.el;
    el.ondragover=function(e){e.preventDefault();el.classList.add('drag-over');};
    el.ondragleave=function(){el.classList.remove('drag-over');};
    el.ondrop=function(e){e.preventDefault();el.classList.remove('drag-over');var f=e.dataTransfer.files[0];if(f&&f.type.startsWith('audio/'))loadSound(idx,f);};
    el.onclick=function(e){if(e.button!==0)return;if(c.audio)togglePlay(idx);else openPicker(idx);};
    el.oncontextmenu=function(e){e.preventDefault();showCtx(idx,e.clientX,e.clientY);};
  }

  function loadSound(idx,file){
    var c=cells[idx];
    if(c.audio){c.audio.pause();c.audio=null;}
    if(c.raf){cancelAnimationFrame(c.raf);c.raf=null;}
    if(c.file&&c.file.indexOf('blob:')===0)URL.revokeObjectURL(c.file);
    c.file=URL.createObjectURL(file);c.title=file.name.replace(/\.[^/.]+$/,'');c.playing=false;c.dur=0;
    c.el.className='cw-cell loaded';c.el.innerHTML=buildLoaded(idx);rebind(idx);
    var a=new Audio(c.file);a.preload='metadata';c.audio=a;
    a.addEventListener('loadedmetadata',function(){
      c.dur=a.duration||0;
      var t=document.getElementById('cwt-'+idx);if(t)t.textContent=fmtDur(c.dur);
      var d=document.getElementById('cwd-'+idx);if(d)d.textContent=fmtDur(c.dur);
    });
    a.addEventListener('ended',function(){c.playing=false;c.el.classList.remove('playing');c.el.classList.add('loaded');if(c.raf){cancelAnimationFrame(c.raf);c.raf=null;}a.currentTime=0;updateTiming(idx);});
  }

  function togglePlay(idx){
    var c=cells[idx];if(!c.audio)return;
    if(c.playing){
      c.audio.pause();c.audio.currentTime=0;c.playing=false;
      c.el.classList.remove('playing');c.el.classList.add('loaded');
      if(c.raf){cancelAnimationFrame(c.raf);c.raf=null;}updateTiming(idx);
    } else {
      c.audio.currentTime=0;c.audio.play().catch(function(){});
      c.playing=true;c.el.classList.add('playing');c.el.classList.remove('loaded');
      startRaf(idx);
    }
  }

  function startRaf(idx){
    var c=cells[idx];if(c.raf)cancelAnimationFrame(c.raf);
    function tick(){if(!c.playing||!c.audio)return;updateTiming(idx);c.raf=requestAnimationFrame(tick);}
    c.raf=requestAnimationFrame(tick);
  }

  function updateTiming(idx){
    var c=cells[idx];if(!c.audio)return;
    var pos=c.audio.currentTime,dur=c.dur||0,rem=Math.max(0,dur-pos);
    var t=document.getElementById('cwt-'+idx);if(t)t.textContent=fmtTime(c.playing?rem:dur);
    var p=document.getElementById('cwp-'+idx);if(p)p.style.width=dur>0?((pos/dur)*100).toFixed(2)+'%':'0%';
  }

  function deleteSound(idx){
    var c=cells[idx];
    if(c.audio){c.audio.pause();c.audio=null;}
    if(c.raf){cancelAnimationFrame(c.raf);c.raf=null;}
    if(c.file&&c.file.indexOf('blob:')===0)URL.revokeObjectURL(c.file);
    c.file=null;c.title=null;c.dur=0;c.playing=false;
    c.el.className='cw-cell empty';c.el.innerHTML=buildEmpty(idx);rebind(idx);
  }

  function openPicker(idx){
    window._cwPick=idx;
    var inp=document.getElementById('cw-file-input');inp.value='';inp.click();
  }
  document.getElementById('cw-file-input').addEventListener('change',function(){
    if(window._cwPick!==undefined&&this.files[0]){loadSound(window._cwPick,this.files[0]);window._cwPick=undefined;}
  });

  var ctxMenu=document.getElementById('cw-ctx');
  function showCtx(idx,x,y){
    ctxTarget=idx;
    document.getElementById('ctx-delete').style.display=cells[idx].audio?'block':'none';
    ctxMenu.style.left=Math.min(x,window.innerWidth-180)+'px';
    ctxMenu.style.top=Math.min(y,window.innerHeight-100)+'px';
    ctxMenu.classList.add('open');
  }
  document.getElementById('ctx-load').onclick=function(){if(ctxTarget!==null)openPicker(ctxTarget);ctxMenu.classList.remove('open');};
  document.getElementById('ctx-delete').onclick=function(){if(ctxTarget!==null)deleteSound(ctxTarget);ctxMenu.classList.remove('open');};
  document.addEventListener('click',function(e){if(!ctxMenu.contains(e.target))ctxMenu.classList.remove('open');});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')ctxMenu.classList.remove('open');});
})();


/* TRAFIC */
var W='https://sncf-proxy.nicolas7lejeune.workers.dev';var TEST_MODE=false;var TEST_DATA=[{"id":"t1","_trains":["881 134"],"_stops":[{"name":"Cannes"}],"_lines":[],"severity":{"effect":"SIGNIFICANT_DELAYS"},"messages":[{"text":"Retards 20-45 min.","channel":{"types":["web"]}}],"application_periods":[{"begin":"2025-01-01T12:00:00","end":"2099-12-31T23:59:59"}]}];var ORDER=['cannes','nice','monaco','menton'];
function buildTrainRow(t){
  var s=t.statusClass||'ok';
  var bar='<div class="tr-bar '+s+'"></div>';
  var th;
  if(t.delayMin>0&&t.planned&&t.display&&t.planned!==t.display){
    th='<div class="tr-time-wrap"><span class="tr-time-planned">'+t.planned+'</span><span class="tr-time-real">'+t.display+'</span></div>';
  } else {th='<span class="tr-time'+(s==='cancelled'?' cancelled':'')+'">'+t.planned+'</span>';}
  var tc='<div class="tr-tc"><span class="tr-status '+s+'">'+(s==='delayed'?'Retard\u00e9':t.statusLabel)+'</span>'+th+'</div>';
  var dl=t.delayMin>0?' <span style="font-size:11px;color:var(--orange);margin-left:6px;">+'+t.delayMin+'m</span>':'';
  if(s==='cancelled')dl='';
  var dest='<div class="tr-dest"><span class="tr-dname'+(s==='cancelled'?' x':'')+'">'+t.direction+dl+'</span><span class="tr-dsub">'+t.sub+'</span></div>';
  var da='';
  if(t.tripId)    da+=' data-trip="'+encodeURIComponent(t.tripId)+'"';
  if(t.trainNum)  da+=' data-num="'+encodeURIComponent(t.trainNum)+'"';
  if(t.direction) da+=' data-dir="'+encodeURIComponent(t.direction)+'"';
  if(t.delayMin)  da+=' data-delay="'+t.delayMin+'"';
  return'<div class="train-row clickable"'+da+'>'+bar+tc+dest+'</div>';
}
function renderStation(st,el){if(!st||st.error){el.innerHTML='<div class="board-msg board-err">'+(st&&st.error?st.error:'Erreur')+'</div>';return;}if(!st.trains||!st.trains.length){el.innerHTML='<div class="board-msg" style="flex-direction:column;gap:6px;"><span style="font-size:18px;">🌙</span><span style="font-size:13px;letter-spacing:.1em;">FIN DE SERVICE</span></div>';return;}el.innerHTML=st.trains.map(buildTrainRow).join('');setTimeout(attachTrainClicks,50);setTimeout(attachTrainClicks,50);}
function loadBoard(){fetch(W+'/board?count=4').then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}).then(function(d){var u=document.getElementById('last-upd');if(u)u.textContent=new Date().toLocaleTimeString('fr-FR',{hour12:false});ORDER.forEach(function(k){var p=document.getElementById('board-'+k);if(p)renderStation(d[k],p);});}).catch(function(e){ORDER.forEach(function(k){var p=document.getElementById('board-'+k);if(p)p.innerHTML='<div class="board-msg board-err">'+e.message+'</div>';});});}
function hdate(iso){if(!iso)return'';var d=new Date(iso);return isNaN(d)?iso:d.toLocaleString('fr-FR',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}
function renderDis(list,isTest){var el=document.getElementById('dis-body');if(!el)return;var cEl=document.getElementById('dis-count');if(cEl)cEl.textContent=list.length?list.length+' perturbation'+(list.length>1?'s':'')+' active'+(list.length>1?'s':''):'';if(!list.length){el.innerHTML='<div class="no-dis">&#10004; Aucune perturbation active</div>';return;}var bC=function(e){return{NO_SERVICE:'NO_SERVICE',SIGNIFICANT_DELAYS:'SIGNIFICANT_DELAYS',REDUCED_SERVICE:'REDUCED_SERVICE',MODIFIED_SERVICE:'MODIFIED_SERVICE'}[e]||'default';};var bL=function(e){return{NO_SERVICE:'Suppression',SIGNIFICANT_DELAYS:'Retards importants',REDUCED_SERVICE:'Service reduit',MODIFIED_SERVICE:'Parcours modifie'}[e]||(e?e.replace(/_/g,' '):'Perturbation');};var sC=function(d){var e=((d.severity&&d.severity.effect)||'').toUpperCase();return e==='NO_SERVICE'?'severe':e.indexOf('MODIFIED')!==-1||e.indexOf('REDUCED')!==-1?'modified':e.indexOf('DELAY')!==-1?'':'info';};var fP=function(p){if(!p||!p.length)return'';var o=[];p.slice(0,2).forEach(function(x){var f=hdate(x.begin),t=hdate(x.end);if(f&&t)o.push('Du '+f+' au '+t);else if(f)o.push('Depuis '+f);});return o.join(' \u2014 ');};var html='';list.forEach(function(d){var eff=(d.severity&&d.severity.effect)||'';var trains=(d._trains||[]).slice(0,6).join(', ');var stops=(d._stops||[]).slice(0,5).map(function(x){return x.name;}).join(', ');var lines=(d._lines||[]).slice(0,3).join(', ');var msgs=d.messages||[],best=null;var prio=['web','notification','long_sms','sms'];for(var p=0;p<prio.length&&!best;p++)for(var i=0;i<msgs.length;i++){var ch=(msgs[i].channel&&msgs[i].channel.types)||[];if(ch.indexOf(prio[p])!==-1){best=msgs[i];break;}}if(!best&&msgs.length)best=msgs[0];var txt=((best&&best.text)?best.text:'').replace(/\n/g,'<br>').slice(0,500);var per=fP(d.application_periods);var title=trains||stops||lines||'Perturbation reseau';if(title.length>90)title=title.slice(0,87)+'...';var meta=trains&&stops?'<strong>Gares :</strong> '+stops:stops&&!trains?'<strong>Gares :</strong> '+stops:lines?'<strong>Ligne :</strong> '+lines:'';html+='<div class="dis-item '+sC(d)+(isTest?' test-mode':'')+'">'+( isTest?'<div class="dis-test-lbl">&#9670; MODE TEST</div>':'')+'<div class="dis-top"><div><div class="dis-title">'+title+'</div>'+(meta?'<div class="dis-meta">'+meta+'</div>':'')+'</div><span class="dis-badge '+bC(eff)+'">'+bL(eff)+'</span></div>'+(txt?'<div class="dis-txt">'+txt+'</div>':'')+(per?'<div class="dis-per">&#128337; '+per+'</div>':'')+'</div>';});el.innerHTML=html;}
function loadDis(){TEST_MODE=false;var el=document.getElementById('dis-body');if(!el)return;el.innerHTML='<p style="padding:10px 0;font-size:12px;color:var(--muted);font-family:monospace">Chargement...</p>';fetch(W+'/disruptions').then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}).then(function(data){var now=Date.now();var list=(data.disruptions||[]).filter(function(d){if(d.status==='active'||d.status==='future')return true;var p=d.application_periods||[];if(!p.length)return true;for(var i=0;i<p.length;i++){var e=p[i].end?new Date(p[i].end).getTime():Infinity;if(e>=now)return true;}return false;});renderDis(list,false);}).catch(function(e){document.getElementById('dis-body').innerHTML='<div class="no-dis" style="color:#ff8080">Erreur : '+e.message+'</div>';});}


/* TRAVEL */
var TOMTOM_KEY='nFt8c40zRLaLYYghcApBurt0ZyK7FIbA';var WORKER_URL='https://apitom.nicolas7lejeune.workers.dev';
var FONTVIEILLE={"lat": 43.7272, "lon": 7.4142};var ROUTES=[{"from": "Port de Nice", "hint": "Quai des Docks / Moy. Corniche", "lat": 43.7033, "lon": 7.2742, "highway": false}, {"from": "Aéroport de Nice", "hint": "Nice Côte d'Azur", "lat": 43.6584, "lon": 7.2159, "highway": true}, {"from": "Antibes", "hint": "Centre-ville / Port", "lat": 43.5795, "lon": 7.1282, "highway": true}, {"from": "Cannes", "hint": "Palais des Festivals", "lat": 43.5513, "lon": 7.0128, "highway": true}, {"from": "Roquebrune-Cap-Martin", "hint": "Cap Martin", "lat": 43.7651, "lon": 7.4756, "highway": false}, {"from": "Menton", "hint": "Centre-ville", "lat": 43.7765, "lon": 7.4973, "highway": true}];var travelDir='to';
function setTravelDir(dir,btn){travelDir=dir;document.querySelectorAll('.dir-btn').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');var t=document.getElementById('travel-title');if(t)t.innerHTML='&#128663; '+(dir==='to'?'Vers Monaco':'Depuis Monaco');loadTravel();}
function fmtDur(sec){if(sec===null||sec===undefined)return{val:'-',unit:''};var m=Math.round(sec/60);if(m<60)return{val:m,unit:'min'};var h=Math.floor(m/60),r=m%60;return{val:h+'h'+(r<10?'0':'')+r,unit:''};}
function delayCls(noT,withT){
  if(!noT||noT===0)return'g';
  var delta=Math.round((withT-noT)/60);
  if(delta<=0)  return'g';
  if(delta<=10) return'g';
  if(delta<=15) return'y';
  return'r';
}
function fmtDurClean(sec){
  if(sec===null||sec===undefined)return{val:'-',unit:'',cls:'x'};
  var m=Math.round(sec/60);
  if(m<60)return{val:m,unit:'min',cls:'x'};
  var h=Math.floor(m/60),r=m%60;
  return{val:h+'h'+(r<10?'0':'')+r,unit:'',cls:'x'};
}

function callTomTom(oLat,oLon,dLat,dLon,avoid,attempt){
  attempt=attempt||1;
  var av=avoid?'&avoid=motorways':'';
  var url='https://api.tomtom.com/routing/1/calculateRoute/'+oLat+','+oLon+':'+dLat+','+dLon+'/json?traffic=true&travelMode=car&computeTravelTimeFor=all'+av+'&key='+TOMTOM_KEY;
  return fetch(url,{headers:{Accept:'application/json'}}).then(function(r){
    if(r.status===429&&attempt<3)return new Promise(function(res){setTimeout(res,1000*attempt);}).then(function(){return callTomTom(oLat,oLon,dLat,dLon,avoid,attempt+1);});
    if(!r.ok)throw new Error('TomTom '+r.status);
    return r.json();
  }).then(function(d){
    if(!d.routes||!d.routes[0])throw new Error('Pas de route');
    var s=d.routes[0].summary;
    return{duration:s.travelTimeInSeconds,noTrafDuration:s.noTrafficTravelTimeInSeconds||s.travelTimeInSeconds,distance:s.lengthInMeters};
  });
}
function fetchRoute(oLat,oLon,dLat,dLon,avoid){
  return callTomTom(oLat,oLon,dLat,dLon,avoid).catch(function(){
    var url=WORKER_URL+'/travel?orig='+encodeURIComponent(oLat+','+oLon)+'&dest='+encodeURIComponent(dLat+','+dLon)+(avoid?'&avoid=motorways':'');
    return fetch(url).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();})
    .then(function(d){
      if(!d.routes||!d.routes[0])throw new Error('no route');
      var s=d.routes[0].summary;
      return{duration:s.travelTimeInSeconds,noTrafDuration:s.noTrafficTravelTimeInSeconds||s.travelTimeInSeconds,distance:s.lengthInMeters};
    }).catch(function(){return null;});
  });
}
function fetchAllRoutes(isTo){
  var pairs=ROUTES.map(function(r){
    return{
      oLat:isTo?r.lat:FONTVIEILLE.lat, oLon:isTo?r.lon:FONTVIEILLE.lon,
      dLat:isTo?FONTVIEILLE.lat:r.lat, dLon:isTo?FONTVIEILLE.lon:r.lon,
      avoid: !r.highway /* éviter autoroute si pas highway */
    };
  });
  return Promise.all(pairs.map(function(p){
    return fetchRoute(p.oLat,p.oLon,p.dLat,p.dLon,p.avoid);
  })).then(function(results){ return {results:results}; });
}
function renderSkeleton(){
  var g=document.getElementById('travel-grid');if(!g)return;
  var isTo=travelDir==='to';
  var dh=isTo?'<span class="travel-dir-label">Depuis</span><span class="travel-dir-arrow">&#8594;</span><span class="travel-dir-dest">Fontvieille &mdash; Monaco</span>':'<span class="travel-dir-dest">Fontvieille &mdash; Monaco</span><span class="travel-dir-arrow">&#8594;</span><span class="travel-dir-label">Vers</span>';
  g.innerHTML='<div class="travel-dir-header">'+dh+'</div><div class="travel-chips-row" id="travel-chips">'+ROUTES.map(function(r){return'<div class="travel-chip x"><span class="tc-dest">'+r.from+'</span><div class="tc-time"><span style="font-size:28px;color:rgba(255,255,255,.18);">&#8230;</span></div></div>';}).join('')+'</div>';
}
function loadTravel(){
  renderSkeleton();var isTo=travelDir==='to';
  fetchAllRoutes(isTo).then(function(res){
    var rows=ROUTES.map(function(r,i){return{route:r,result:res.results[i],sort:res.results[i]?res.results[i].duration:999999};});
    rows.sort(function(a,b){return a.sort-b.sort;});
    var chips=document.getElementById('travel-chips');
    if(chips)chips.innerHTML=rows.map(function(row){return buildSingleRow(row.route,row.result);}).join('');
    var src=document.getElementById('travel-source');if(src)src.innerHTML='&#128994; TomTom';
    var u=document.getElementById('travel-upd');if(u)u.textContent=new Date().toLocaleTimeString('fr-FR',{hour12:false});
  });
}
var renderTravelSkeleton=renderSkeleton;



function buildSingleRow(route,result){
  var bc='x',col='rgba(255,255,255,.7)';
  if(result){var dc=delayCls(result.noTrafDuration,result.duration);bc=dc;col={g:'var(--green)',y:'var(--yellow)',r:'var(--red)',x:'rgba(255,255,255,.7)'}[dc]||col;}
  var dur=result?fmtDur(result.duration):null;
  var th=dur&&dur.val!=='-'
    ?('<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:42px;font-weight:900;color:'+col+';line-height:1;">'+dur.val+'</span>'+(dur.unit?'<span style="font-size:14px;color:rgba(255,255,255,.35);margin-left:4px;">'+dur.unit+'</span>':''))
    :'<span style="font-size:28px;color:rgba(255,255,255,.2);">\u2014</span>';
  return'<div class="travel-chip '+bc+'"><span class="tc-dest">'+route.from+'</span><div class="tc-time">'+th+'</div>'+(route.highway?'':'<span class="tc-via">Nationale</span>')+'</div>';
}


var renderTravelSkeleton=renderSkeleton;

/* WEATHER */

















/* VIGILANCES */





/* INIT */
/* Lire le paramètre URL ?tab=weather ou ?tab=trafic */

setInterval(function(){if(traficLoaded){loadBoard();if(!TEST_MODE)loadDis();}},60000);
setInterval(function(){if(traficLoaded)loadTravel();},600000);
setInterval(function(){if(traficLoaded)loadA8Traffic();},300000);



function toggleStation(key){var p=document.getElementById('panel-'+key),b=document.getElementById('tog-'+key);if(!p||!b)return;var h=p.classList.toggle('hidden');b.classList.toggle('active',!h);var g=document.getElementById('stations-grid');if(!g)return;var v=Array.from(g.querySelectorAll('.st-panel:not(.hidden)'));v.forEach(function(e,i){e.style.borderRight=i<v.length-1?'1px solid var(--border)':'none';});g.style.gridTemplateColumns='repeat('+Math.max(1,v.length)+',1fr)';}
var _tid=null;
function closeTrainDetail(){var el=document.getElementById('train-detail');if(el)el.classList.remove('open');_tid=null;document.querySelectorAll('.train-row.selected').forEach(function(r){r.classList.remove('selected');});}
function openTrainDetail(tripId,num,dir,row){if(_tid===tripId){closeTrainDetail();return;}_tid=tripId;document.querySelectorAll('.train-row.selected').forEach(function(r){r.classList.remove('selected');});if(row)row.classList.add('selected');var panel=document.getElementById('train-detail'),tl=document.getElementById('td-timeline');if(!panel||!tl)return;var tn=document.getElementById('td-train-num'),tt=document.getElementById('td-title');if(tn)tn.textContent=num||'Train';if(tt)tt.textContent=dir||'';tl.innerHTML='<div class="td-loading">Chargement\u2026</div>';panel.classList.add('open');setTimeout(function(){panel.scrollIntoView({behavior:'smooth',block:'nearest'});},100);var sn=num||(tripId?tripId.split(':').find(function(p){return /^\d{5,6}$/.test(p);})||'':'');var fu=sn?'https://sncf-proxy.nicolas7lejeune.workers.dev/trip-search?num='+encodeURIComponent(sn):(tripId?'https://sncf-proxy.nicolas7lejeune.workers.dev/trip?id='+encodeURIComponent(tripId):null);if(!fu){tl.innerHTML='<div class="td-loading">Num\u00e9ro non disponible</div>';return;}fetch(fu).then(function(r){return r.json();}).then(function(d){if(!d.stops||!d.stops.length){tl.innerHTML='<div class="td-loading">Aucun arr\u00eat</div>';return;}(function(){
  var stops=d.stops;
  var now=new Date();
  var curIdx=-1;
  for(var ci=0;ci<stops.length;ci++){
    var ct=stops[ci].depart||stops[ci].arrival||'';
    if(ct){var ch=parseInt(ct.slice(0,2),10),cm=parseInt(ct.slice(3,5),10);
      var cd=new Date();cd.setHours(ch,cm,0,0);if(cd<=now)curIdx=ci;}
  }
  var nextIdx=(curIdx+1<stops.length)?curIdx+1:-1;
  var nS=stops.length;
  var progPct=curIdx>=0?((curIdx+0.5)/nS*100).toFixed(2)+'%':'0%';
  var html='<div class="td-track"></div>';
  html+='<div class="td-progress" style="width:'+progPct+'"></div>';
  html+=stops.map(function(s,i){
    var isPast=i<curIdx,isCur=i===curIdx,isNext=i===nextIdx;
    var tPlan=s.depart||s.arrival||'';
    var tReal=s.departReal||s.arrivalReal||'';
    var delay=0;
    if(tPlan&&tReal&&tPlan!==tReal){
      var bv=parseInt(tPlan.slice(0,2),10)*60+parseInt(tPlan.slice(3,5),10);
      var rv=parseInt(tReal.slice(0,2),10)*60+parseInt(tReal.slice(3,5),10);
      delay=Math.max(0,rv-bv);
    }
    var hasDelay=delay>0&&!isPast&&tReal;
    var cls='td-stop'+(s.skipped?' skipped':'')+(isCur?' current':isPast?' past':isNext?' next':'')+(hasDelay?' delayed':'');
    /* Horaire : toujours afficher tPlan ; si retard, clignoter tReal en orange */
    var timeHtml='';
    if(tPlan){
      if(hasDelay){
        /* Superposition clignotante : théorique ↔ retard */
        timeHtml='<div class="td-stime"><div class="td-time-wrap">'
          +'<span class="td-time-plan">'+tPlan+'</span>'
          +'<span class="td-time-real">'+tReal+'</span>'
          +'</div></div>';
      } else {
        timeHtml='<div class="td-stime">'+tPlan+'</div>';
      }
    }
    return'<div class="'+cls+'">'
      +'<div class="td-sname">'+s.name+'</div>'
      +'<div class="td-dot"></div>'
      +timeHtml
      +'</div>';
  }).join('');
  tl.innerHTML=html;
})();var cur=tl.querySelector('.current');if(cur)setTimeout(function(){cur.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});},200);}).catch(function(){tl.innerHTML='<div class="td-loading">Impossible de charger</div>';});}
function attachTrainClicks(){document.querySelectorAll('.train-row.clickable').forEach(function(row){if(row._cl)row.removeEventListener('click',row._cl);row._cl=function(){openTrainDetail(row.dataset.trip?decodeURIComponent(row.dataset.trip):null,row.dataset.num?decodeURIComponent(row.dataset.num):'',row.dataset.dir?decodeURIComponent(row.dataset.dir):'',row);};row.addEventListener('click',row._cl);});}
function toggleEditor(){
  var ov=document.getElementById('ed-ov');if(!ov)return;
  var fab=document.getElementById('ed-fab');
  if(ov.classList.contains('open')){
    ov.classList.remove('open');
    if(fab)fab.textContent='Editer';
  } else {
    ov.classList.add('open');
    if(fab)fab.textContent='Fermer';
    var doc=document.getElementById('ed-doc');
    if(doc){doc.focus();try{var s=localStorage.getItem('rm_draft');if(s)doc.innerHTML=s;}catch(e){}}
    setTimeout(edLoadTemplates,50);
  }
}

function closeEditor(){var ov=document.getElementById('ed-ov');if(ov)ov.classList.remove('open');}
function edPrint(){var html=document.getElementById('ed-doc').innerHTML;var w=window.open('','_blank');if(!w)return;w.document.open();w.document.close();var s=w.document.createElement('style');s.textContent='body{font-family:sans-serif;max-width:800px;margin:40px auto;line-height:1.75}';w.document.head.appendChild(s);w.document.body.innerHTML=html;w.focus();setTimeout(function(){w.print();},300);}
function edCopy(){navigator.clipboard.writeText(document.getElementById('ed-doc').innerText).catch(function(){});}
function edSave(){var html=document.getElementById('ed-doc').innerHTML;try{localStorage.setItem('rm_draft',html);}catch(e){}var blob=new Blob(['<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>'+html+'</body></html>'],{type:'text/html;charset=utf-8'});var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download='note_'+new Date().toISOString().slice(0,10)+'.html';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(url);document.body.removeChild(a);},1000);}
function edClear(){if(confirm('Vider ?')){document.getElementById('ed-doc').innerHTML='<p>\u00c9crivez\u2026</p>';try{localStorage.removeItem('rm_draft');}catch(e){}}}
(function(){var doc=document.getElementById('ed-doc');if(!doc)return;doc.addEventListener('input',function(){var t=this.innerText.trim();var wc=t?t.split(/\s+/).length:0;var el=document.getElementById('ed-wc');if(el)el.textContent=wc+' mot'+(wc>1?'s':'')+' \u00b7 '+t.length+' car.';});var m=document.getElementById('ed-modal'),hd=document.getElementById('ed-drag'),ox=0,oy=0,on=false;if(!m||!hd)return;hd.addEventListener('mousedown',function(e){on=true;var ov=document.getElementById('ed-ov');if(ov){var r=ov.getBoundingClientRect();ox=e.clientX-r.left;oy=e.clientY-r.top;}document.addEventListener('mousemove',mv);document.addEventListener('mouseup',mu);});function mv(e){if(!on)return;var ov=document.getElementById('ed-ov');if(ov){ov.style.left=(e.clientX-ox)+'px';ov.style.top=(e.clientY-oy)+'px';ov.style.right='auto';ov.style.bottom='auto';}}function mu(){on=false;document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',mu);}})();
/* ── TEMPLATES ── */
function edLoadTemplates(){
  var list=document.getElementById('ed-tpl-list');
  if(!list)return;
  var tpls=[];try{tpls=JSON.parse(localStorage.getItem('rm_templates')||'[]');}catch(e){}
  list.innerHTML=tpls.map(function(t,i){
    return'<button class="ed-tpl-btn" onclick="edApplyTemplate('+i+')" title="'+t.name+'">'+t.name.slice(0,14)+'</button>';
  }).join('');
}
function edApplyTemplate(i){
  var tpls=[];try{tpls=JSON.parse(localStorage.getItem('rm_templates')||'[]');}catch(e){}
  if(!tpls[i])return;
  var doc=document.getElementById('ed-doc');if(!doc)return;
  var curr=(doc.innerText||'').trim();
  if(curr&&curr!=='Notes…'&&!confirm('Remplacer ?'))return;
  doc.innerHTML=tpls[i].content;
  doc.dispatchEvent(new Event('input'));
}
function edSaveTemplate(){
  var doc=document.getElementById('ed-doc');if(!doc)return;
  var curr=(doc.innerText||'').trim();
  if(!curr||curr==='Notes…'){alert('Rien à sauvegarder.');return;}
  var name=prompt('Nom :','');
  if(!name||!name.trim())return;
  var tpls=[];try{tpls=JSON.parse(localStorage.getItem('rm_templates')||'[]');}catch(e){}
  tpls.push({name:name.trim(),content:doc.innerHTML});
  try{localStorage.setItem('rm_templates',JSON.stringify(tpls));}catch(e){}
  edLoadTemplates();
}

/* ═ A8 Traffic ═ */
var A8_KEY='nFt8c40zRLaLYYghcApBurt0ZyK7FIbA';
var A8_ZOOM='full';
var A8_EXITS=[{"n": 36, "lbl": "St-Tropez / Le Muy", "short": "St-Tropez", "km": 0, "lat": 43.478, "lon": 6.725}, {"n": 37, "lbl": "Puget / Fréjus O.", "short": "Puget", "km": 11, "lat": 43.495, "lon": 6.82}, {"n": 38, "lbl": "Fréjus / St-Raph", "short": "Fréjus", "km": 18, "lat": 43.51, "lon": 6.89}, {"n": 39, "lbl": "Les Adrets", "short": "Les Adrets", "km": 28, "lat": 43.52, "lon": 6.95}, {"n": 40, "lbl": "Mandelieu", "short": "Mandelieu", "km": 38, "lat": 43.538, "lon": 7.01}, {"n": 41, "lbl": "Cannes La Bocca", "short": "Cns Bocca", "km": 44, "lat": 43.553, "lon": 7.04}, {"n": 42, "lbl": "Cannes / Mougins", "short": "Cannes", "km": 48, "lat": 43.568, "lon": 7.07}, {"n": 44, "lbl": "Antibes / Sophia", "short": "Antibes", "km": 56, "lat": 43.59, "lon": 7.12}, {"n": 46, "lbl": "VL Plage", "short": "VL Plage", "km": 64, "lat": 43.62, "lon": 7.16}, {"n": 47, "lbl": "VL Centre", "short": "VL Centre", "km": 67, "lat": 43.635, "lon": 7.18}, {"n": 48, "lbl": "Cagnes Est", "short": "Cagnes Est", "km": 70, "lat": 43.655, "lon": 7.195}, {"n": 49, "lbl": "St-Laurent-du-Var", "short": "St-Laurent", "km": 73, "lat": 43.67, "lon": 7.205}, {"n": 50, "lbl": "Nice Ouest", "short": "Nice O.", "km": 77, "lat": 43.675, "lon": 7.215}, {"n": 51, "lbl": "Nice Aéroport", "short": "Nice Aéro", "km": 80, "lat": 43.665, "lon": 7.235}, {"n": 52, "lbl": "Nice St-Isidore", "short": "N.St-Isid.", "km": 83, "lat": 43.705, "lon": 7.265}, {"n": 54, "lbl": "Nice Nord", "short": "Nice Nord", "km": 86, "lat": 43.72, "lon": 7.285}, {"n": 55, "lbl": "Nice l'Ariane", "short": "Nice Ariane", "km": 89, "lat": 43.73, "lon": 7.31}, {"n": 56, "lbl": "Monaco", "short": "Monaco", "km": 93, "lat": 43.735, "lon": 7.39}, {"n": 57, "lbl": "La Turbie", "short": "La Turbie", "km": 97, "lat": 43.74, "lon": 7.42}, {"n": 58, "lbl": "Roquebrune CM", "short": "Roquebrune", "km": 101, "lat": 43.76, "lon": 7.47}, {"n": 59, "lbl": "Menton", "short": "Menton", "km": 105, "lat": 43.775, "lon": 7.5}, {"n": 0, "lbl": "Frontière italienne", "short": "Frontière", "km": 112, "lat": 43.79, "lon": 7.57}];
var A8_ZOOMS=[{"id": "full", "label": "Vue d\'ensemble", "from": 36, "to": 0}, {"id": "cannes", "label": "Cannes", "from": 36, "to": 44}, {"id": "antibes", "label": "Antibes", "from": 44, "to": 50}, {"id": "nice", "label": "Nice", "from": 50, "to": 56}, {"id": "monaco", "label": "Monaco — Menton", "from": 56, "to": 0}];

/* Sondes perpendiculaires */
var A8_PROBES=(function(){
  var sections=[];
  for(var i=0;i<A8_EXITS.length-1;i++){
    var ex=A8_EXITS[i],nx=A8_EXITS[i+1];
    var mLat=(ex.lat+nx.lat)/2,mLon=(ex.lon+nx.lon)/2;
    var dLat=nx.lat-ex.lat,dLon=nx.lon-ex.lon;
    var len=Math.sqrt(dLat*dLat+dLon*dLon)||1;
    var off=0.0025;
    var pLat=(-dLon/len)*off,pLon=(dLat/len)*off;
    sections.push({
      south:{lat:mLat-pLat,lon:mLon-pLon},
      north:{lat:mLat+pLat,lon:mLon+pLon}
    });
  }
  return sections;
})();

function cls(cur,ff){
  if(!ff||ff===0||cur===0)return'inconnu';
  var r=cur/ff;
  if(r>=0.85)return'fluide';
  if(r>=0.65)return'ralenti';
  if(r>=0.45)return'dense';
  return'bloque';
}
var CLS_LBL={fluide:'Fluide',ralenti:'Ralenti',dense:'Dense',bloque:'Bloqué',inconnu:'N/A'};

function fetchSeg(lat,lon){
  var url='https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/12/json?point='
    +lat.toFixed(4)+','+lon.toFixed(4)+'&unit=KMPH&key='+A8_KEY;
  return fetch(url,{headers:{Accept:'application/json'}})
    .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
    .then(function(d){
      var fd=d.flowSegmentData;
      if(!fd||!fd.currentSpeed)return{cur:0,ff:0};
      return{cur:fd.currentSpeed,ff:fd.freeFlowSpeed||fd.currentSpeed};
    })
    .catch(function(e){console.warn('A8 seg error:',e.message);return{cur:0,ff:0};});
}

function getIdxs(){
  var z=A8_ZOOMS.find(function(z){return z.id===A8_ZOOM;})||A8_ZOOMS[0];
  var r=[];
  for(var i=0;i<A8_EXITS.length-1;i++){
    var n=A8_EXITS[i].n;
    if(z.id==='full'){r.push(i);continue;}
    var ok=z.to===0?(n>0&&n>=z.from):(n>0&&n>=z.from&&n<z.to);
    if(ok)r.push(i);
  }
  return r;
}

function buildZoomBar(wrap){
  var zBar=document.createElement('div');
  zBar.className='a8-zoom-bar';
  zBar.innerHTML='<span class="a8-zoom-lbl">Zone</span>';
  A8_ZOOMS.forEach(function(z){
    var btn=document.createElement('button');
    btn.className='a8-zoom-btn'+(z.id===A8_ZOOM?' active':'');
    btn.textContent=z.label;
    btn.onclick=function(){
      A8_ZOOM=z.id;
      document.querySelectorAll('.a8-zoom-btn').forEach(function(b){b.classList.remove('active');});
      btn.classList.add('active');
      loadA8Traffic();
    };
    zBar.appendChild(btn);
  });
  wrap.appendChild(zBar);
}

function renderRoad(idxs,southData,northData){
  var wrap=document.getElementById('a8-timeline-wrap');
  if(!wrap)return;
  if(!idxs||!idxs.length){wrap.innerHTML='<div class="a8-loading">Aucune section</div>';return;}
  wrap.innerHTML='';
  buildZoomBar(wrap);

  var dirDiv=document.createElement('div');
  dirDiv.className='a8-dir-labels';
  dirDiv.innerHTML='<div class="a8-dir-row"><span class="a8-dir-arrow st">&#8592;</span><span class="a8-dir-name">Vers Saint-Tropez</span></div>'
    +'<div class="a8-dir-row"><span class="a8-dir-arrow it">&#8594;</span><span class="a8-dir-name">Vers Italie</span></div>';
  wrap.appendChild(dirDiv);

  /* Sorties pour cette vue */
  var exits=idxs.map(function(i){return A8_EXITS[i];});
  var lastExit=A8_EXITS[idxs[idxs.length-1]+1];
  if(lastExit)exits.push(lastExit);
  if(exits.length<2){wrap.innerHTML='<div class="a8-loading">Données insuffisantes</div>';return;}
  var km0=exits[0].km, kmTotal=exits[exits.length-1].km-km0||1;

  /* ── Calcul couleur par zone ou par segment ── */
  function zoneOfIdx(idx){
    var n=A8_EXITS[idx].n;
    for(var zi=0;zi<A8_ZOOMS.length;zi++){
      var z=A8_ZOOMS[zi];
      if(z.id==='full')continue;
      if(z.to===0?n>=z.from:(n>=z.from&&n<z.to))return z.id;
    }
    return 'unknown';
  }

  /* Précalculer la couleur de chaque zone */
  var zoneColors={};
  var zoneIds=['cannes','antibes','nice','monaco'];
  zoneIds.forEach(function(zid){
    var zZoom=A8_ZOOMS.find(function(z){return z.id===zid;});
    if(!zZoom)return;
    var zIdxs=[];
    for(var ii=0;ii<A8_EXITS.length-1;ii++){
      var n=A8_EXITS[ii].n;
      var ok=zZoom.to===0?(n>=zZoom.from):(n>=zZoom.from&&n<zZoom.to);
      if(ok)zIdxs.push(ii);
    }
    function avgSpd(data){var v=zIdxs.map(function(k){return data[k]&&data[k].cur>0?data[k].cur:0;}).filter(function(x){return x>0;});return v.length?Math.round(v.reduce(function(a,b){return a+b;},0)/v.length):0;}
    function avgFF(data){var v=zIdxs.map(function(k){return data[k]&&data[k].ff>0?data[k].ff:0;}).filter(function(x){return x>0;});return v.length?Math.round(v.reduce(function(a,b){return a+b;},0)/v.length):90;}
    zoneColors[zid]={
      N:{cl:cls(avgSpd(northData),avgFF(northData)),spd:avgSpd(northData)},
      S:{cl:cls(avgSpd(southData),avgFF(southData)),spd:avgSpd(southData)}
    };
  });

  /* ── Construction des bandes ── */
  var section=document.createElement('div');section.className='a8-road-section';
  var outer=document.createElement('div');outer.className='a8-road-outer';outer.style.cssText='position:relative;';
  var lanes=document.createElement('div');lanes.className='a8-lanes';
  var laneN=document.createElement('div');laneN.className='a8-lane north';
  var laneS=document.createElement('div');laneS.className='a8-lane south';
  var statsN={fluide:0,ralenti:0,dense:0,bloque:0,inconnu:0};
  var statsS={fluide:0,ralenti:0,dense:0,bloque:0,inconnu:0};

  for(var ii=0;ii<idxs.length;ii++){
    var idx=idxs[ii],ex0=A8_EXITS[idx],ex1=A8_EXITS[idx+1];
    if(!ex0||!ex1)continue;
    var w=((ex1.km-ex0.km)/kmTotal*100).toFixed(3)+'%';

    /* En vue full: couleur de la ZONE ; sinon couleur du segment */
    var zid=zoneOfIdx(idx);
    var cN, cS, tipN, tipS;
    if(A8_ZOOM==='full' && zoneColors[zid]){
      cN=zoneColors[zid].N.cl; cS=zoneColors[zid].S.cl;
      var spdN=zoneColors[zid].N.spd, spdS=zoneColors[zid].S.spd;
      tipN=ex1.short+' \u2192 '+ex0.short+' | Zone '+zid+(spdN>0?' \u2014 moy. '+spdN+' km/h':'');
      tipS=ex0.short+' \u2192 '+ex1.short+' | Zone '+zid+(spdS>0?' \u2014 moy. '+spdS+' km/h':'');
    } else {
      var dN=northData[idx]||{cur:0,ff:0},dS=southData[idx]||{cur:0,ff:0};
      cN=cls(dN.cur,dN.ff); cS=cls(dS.cur,dS.ff);
      tipN=ex1.short+' \u2192 '+ex0.short+' | '+CLS_LBL[cN]+(dN.cur>0?' \u2014 '+dN.cur+' km/h':'');
      tipS=ex0.short+' \u2192 '+ex1.short+' | '+CLS_LBL[cS]+(dS.cur>0?' \u2014 '+dS.cur+' km/h':'');
    }
    if(statsN[cN]!==undefined)statsN[cN]++;
    if(statsS[cS]!==undefined)statsS[cS]++;
    var sN=document.createElement('div');sN.className='a8-seg '+cN;sN.style.width=w;sN.setAttribute('data-tip',tipN);
    var sS=document.createElement('div');sS.className='a8-seg '+cS;sS.style.width=w;sS.setAttribute('data-tip',tipS);
    laneN.appendChild(sN);laneS.appendChild(sS);
  }
  lanes.appendChild(laneN);lanes.appendChild(laneS);

  /* ── Overlay sorties (TOUJOURS affiché) ── */
  var overlay=document.createElement('div');
  overlay.style.cssText='position:absolute;top:-10px;bottom:-10px;left:0;right:0;pointer-events:none;z-index:10;';
  exits.forEach(function(ex,i){
    var pct=((ex.km-km0)/kmTotal*100).toFixed(3)+'%';
    var mk=document.createElement('div');
    mk.style.cssText='position:absolute;left:'+pct+';top:0;bottom:0;width:2px;background:rgba(255,255,255,.15);transform:translateX(-50%);';
    overlay.appendChild(mk);
    var badge=document.createElement('div');
    badge.textContent=ex.n||'FR';
    var edgeTx=(i===0)?'translate(0,-50%)':(i===exits.length-1)?'translate(-100%,-50%)':'translate(-50%,-50%)';
    badge.style.cssText='position:absolute;left:'+pct+';top:50%;transform:'+edgeTx+';'
      +'font-family:Share Tech Mono,monospace;font-size:14px;font-weight:800;'
      +'background:var(--panel);border:1.5px solid var(--border);color:rgba(255,255,255,.8);'
      +'padding:2px 5px;border-radius:4px;white-space:nowrap;min-width:22px;text-align:center;z-index:11;';
    if(!ex.n)badge.style.cssText+=';background:rgba(228,3,46,.12);border-color:rgba(228,3,46,.35);color:var(--red);font-size:8px;';
    overlay.appendChild(badge);
  });
  outer.appendChild(lanes);outer.appendChild(overlay);section.appendChild(outer);

  /* ── Noms des sorties (TOUJOURS affiché) ── */
  var namesEl=document.createElement('div');namesEl.className='a8-exit-names';
  exits.forEach(function(ex,i){
    var pct=((ex.km-km0)/kmTotal*100).toFixed(3)+'%';
    var el=document.createElement('div');el.className='a8-exit-name-el';el.style.left=pct;
    if(i===0)el.style.transform='translateX(0)';
    else if(i===exits.length-1)el.style.transform='translateX(-100%)';
    else el.style.transform='translateX(-50%)';
    el.innerHTML='<div class="a8-exit-name-tick"></div><span class="a8-exit-name-lbl">'+ex.short+'</span>';
    namesEl.appendChild(el);
  });
  section.appendChild(namesEl);
  wrap.appendChild(section);

  /* ── Résumé ── */
  function sumPills(st,lbl,ac,arrow){
    var h='<div class="a8-sum-dir"><span class="a8-dir-arrow '+ac+'" style="width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">'+arrow+'</span><span class="a8-sum-label">'+lbl+'</span>';
    if(st.bloque>0)h+='<span class="a8-sum-pill bloque">&#9679; '+st.bloque+' bloqué'+(st.bloque>1?'s':'')+'</span>';
    if(st.dense>0)h+='<span class="a8-sum-pill dense">&#9679; '+st.dense+' dense'+(st.dense>1?'s':'')+'</span>';
    if(st.ralenti>0)h+='<span class="a8-sum-pill ralenti">&#9679; '+st.ralenti+' ralenti'+(st.ralenti>1?'s':'')+'</span>';
    if(!st.bloque&&!st.dense&&!st.ralenti)h+='<span class="a8-sum-pill fluide">Trafic fluide</span>';
    return h+'</div>';
  }
  var sumEl=document.createElement('div');sumEl.className='a8-summary';
  sumEl.innerHTML=sumPills(statsN,'Vers Saint-Tropez','st','&#8592;')+sumPills(statsS,'Vers Italie','it','&#8594;');
  wrap.appendChild(sumEl);
  var u=document.getElementById('a8-upd');if(u)u.textContent=new Date().toLocaleTimeString('fr-FR',{hour12:false});
}
function loadA8Traffic(){
  var wrap=document.getElementById('a8-timeline-wrap');
  if(!wrap)return;
  wrap.innerHTML='<div class="a8-loading">Chargement trafic A8…</div>';
  /* Reconstruire le zoom bar pendant le chargement */
  buildZoomBar(wrap.querySelector('.a8-zoom-bar')||{appendChild:function(){}});

  var idxs=getIdxs();
  if(!idxs.length){wrap.innerHTML='<div class="a8-loading">Zone non disponible</div>';return;}

  var sf=A8_PROBES.map(function(p){return fetchSeg(p.south.lat,p.south.lon);});
  var nf=A8_PROBES.map(function(p){return fetchSeg(p.north.lat,p.north.lon);});
  Promise.all([Promise.all(sf),Promise.all(nf)]).then(function(r){
    function fg(arr){var res=arr.slice(),last={cur:0,ff:0};for(var i=0;i<res.length;i++){if(res[i]&&res[i].cur>0)last=res[i];else if(last.cur>0)res[i]=last;}last={cur:0,ff:0};for(var j=res.length-1;j>=0;j--){if(res[j]&&res[j].cur>0)last=res[j];else if(last.cur>0)res[j]=last;}return res;}
    renderRoad(idxs,fg(r[0]),fg(r[1]));
  }).catch(function(e){
    if(wrap)wrap.innerHTML='<div class="a8-loading" style="color:#ff8080">Erreur: '+e.message+'</div>';
  });
}

/* Charger quand le tab trafic est visible */
function initA8IfVisible(){
  var wrap=document.getElementById('a8-timeline-wrap');
  if(wrap&&wrap.offsetParent!==null){
    loadA8Traffic();
  } else {
    setTimeout(initA8IfVisible,500);
  }
}
document.addEventListener('DOMContentLoaded',function(){setTimeout(initA8IfVisible,800);});
setInterval(function(){
  var wrap=document.getElementById('a8-timeline-wrap');
  if(wrap&&wrap.offsetParent!==null)loadA8Traffic();
},300000);


/* ── Zoom molette A8 ── */
(function(){
  var ZOOM_ORDER=['full','cannes','antibes','nice','monaco'];
  function initWheel(){
    var el=document.getElementById('a8-timeline-wrap');
    if(!el){setTimeout(initWheel,800);return;}
    el.addEventListener('wheel',function(e){
      e.preventDefault();
      if(e.ctrlKey||e.metaKey||Math.abs(e.deltaX)<Math.abs(e.deltaY)){
        /* Zoom in/out */
        var idx=ZOOM_ORDER.indexOf(A8_ZOOM);
        if(e.deltaY<0)idx=Math.max(0,idx-1);
        else idx=Math.min(ZOOM_ORDER.length-1,idx+1);
        if(ZOOM_ORDER[idx]!==A8_ZOOM){
          document.querySelectorAll('.a8-zoom-btn').forEach(function(b){b.classList.toggle('active',b.dataset.zoom===A8_ZOOM);});
          document.querySelectorAll('.a8-zoom-btn').forEach(function(b){b.classList.toggle('active',b.dataset.zoom===A8_ZOOM);});
          document.querySelectorAll('.a8-zoom-btn').forEach(function(b){b.classList.toggle('active',b.dataset.zoom===A8_ZOOM);});
        }
      } else {
        /* Scroll horizontal */
        el.scrollLeft+=e.deltaX;
      }
    },{passive:false});
  }
})();


/* ══ MÉTÉO ══════════════════════════════════════════════════════════════ */

/* ══ WEATHER TOOL ═══════════════════════════════════════════════ */

var wxBulmaLoaded=false;






/* ══ WEATHER TOOL ═══════════════════════════════════════════════════════ */
var WX_ZONES={
  am:{lat:43.7384,lon:7.4246,name:'Monaco',cities:[{name:'Nice',lat:43.7102,lon:7.262},{name:'Cannes',lat:43.5528,lon:7.0174},{name:'Antibes',lat:43.5808,lon:7.1239},{name:'Menton',lat:43.7753,lon:7.5022},{name:'Grasse',lat:43.6581,lon:6.9239},{name:'Juan-les-Pins',lat:43.5667,lon:7.1167}]},
  idf:{lat:48.8566,lon:2.3522,name:'Paris \u2014 \u00cele-de-France',cities:[{name:'Paris',lat:48.8566,lon:2.3522},{name:'Versailles',lat:48.8014,lon:2.1301},{name:'Pontoise',lat:49.0503,lon:2.1006},{name:'Meaux',lat:48.96,lon:2.8883},{name:'Melun',lat:48.5404,lon:2.6568},{name:'Évry',lat:48.6265,lon:2.4271}]}
};
var wxLoaded={am:false,idf:false},wxCurrentZone='am';
var WXCO_DAY={0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',71:'🌨️',73:'🌨️',80:'🌦️',81:'🌧️',82:'⛈️',95:'⛈️'};
var WXCO_NGT={0:'🌙',1:'🌙',2:'☁️',3:'☁️',45:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',71:'🌨️',73:'🌨️',80:'🌧️',81:'🌧️',82:'⛈️',95:'⛈️'};
var WXSH={0:'Ensoleillé',1:'Peu nuageux',2:'Mi-nuageux',3:'Couvert',45:'Brouillard',51:'Bruine légère',61:'Pluie légère',63:'Pluie',65:'Forte pluie',71:'Neige légère',80:'Averses',81:'Averses fortes',95:'Orage'};
function wxIco(c,h){var n=Number(c);var night=(h!==undefined)&&(h>=22||h<6);var map=night?WXCO_NGT:WXCO_DAY;return map[n]||map[Math.floor(n/10)*10]||'🌡️';}
function wxShort(c){var n=Number(c);return WXSH[n]||WXSH[Math.floor(n/10)*10]||'—';}
function wxDir(d){return['N','NE','E','SE','S','SO','O','NO'][Math.round(d/45)%8]||'';}
function wxDayName(off){var d=new Date();d.setDate(d.getDate()+off);return['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'][d.getDay()];}
function wxSetZone(z){
  wxCurrentZone=z;
  document.getElementById('wxz-am').classList.toggle('active',z==='am');
  document.getElementById('wxz-idf').classList.toggle('active',z==='idf');
  document.getElementById('wxzone-am').classList.toggle('active',z==='am');
  document.getElementById('wxzone-idf').classList.toggle('active',z==='idf');
  if(!wxLoaded[z])wxLoadZone(z);
}
function wxLoadAll(){wxLoaded.am=false;wxLoaded.idf=false;wxLoadZone('am');wxLoadZone('idf');}
function wxLoadZone(z){
  wxLoaded[z]=true;
  var zone=WX_ZONES[z];
  fetch('https://api.open-meteo.com/v1/forecast?latitude='+zone.lat+'&longitude='+zone.lon+'&current=temperature_2m,relative_humidity_2m,apparent_temperature,weathercode,windspeed_10m,winddirection_10m,precipitation&hourly=temperature_2m,weathercode,precipitation_probability,windspeed_10m,winddirection_10m&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,windspeed_10m_max,winddirection_10m_dominant,sunrise,sunset&timezone=Europe%2FParis&forecast_days=3')
    .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
    .then(function(d){
      wxRenderHero(z,d.current,d.daily,zone.name);
      wxRenderHourly(z,d.hourly);
      wxPalData[z]=d;wxRender3Days(z,d.daily);
      var u=document.getElementById('wx-upd');
      if(u)u.textContent='Mis à jour '+new Date().toLocaleTimeString('fr-FR',{hour12:false});
    })
    .catch(function(e){
      var el=document.getElementById('wx-'+z+'-hero');
      if(el)el.innerHTML='<div style="padding:32px 40px;color:#E4032E;font-family:\'Barlow Condensed\',sans-serif;font-size:16px;">Erreur : '+e.message+'</div>';
    });
  Promise.allSettled(zone.cities.map(function(city){
    return fetch('https://api.open-meteo.com/v1/forecast?latitude='+city.lat+'&longitude='+city.lon+'&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Europe%2FParis&forecast_days=3')
      .then(function(r){return r.json();}).then(function(d){return{name:city.name,d:d.daily};});
  })).then(function(results){
    var el=document.getElementById('wx-'+z+'-cities');if(!el)return;
    var html='<div class="wx-cities-strip-title">&#127761; Températures — Villes côtières</div><div class="wx-cities-row">';
    results.forEach(function(res){
      if(res.status!=='fulfilled'){html+='<div class="wx-city-tile"><span class="wx-city-tile-name">—</span></div>';return;}
      var v=res.value;
      var t0max=Math.round(v.d.temperature_2m_max[0]),t0min=Math.round(v.d.temperature_2m_min[0]);
      var t1max=v.d.temperature_2m_max[1]!=null?Math.round(v.d.temperature_2m_max[1]):null;
      var t1min=v.d.temperature_2m_min[1]!=null?Math.round(v.d.temperature_2m_min[1]):null;
      html+='<div class="wx-city-tile">';
      html+='<div class="wx-city-tile-name">'+v.name+'</div>';
      html+='<div class="wx-city-tile-icon">'+wxIco(v.d.weathercode[0])+'</div>';
      html+='<div class="wx-city-tile-row">';
      html+='<div class="wx-city-tile-day"><span class="wx-city-tile-dlbl">Auj.</span><span class="wx-city-tile-temps"><span class="wx-city-tile-tmax">'+t0max+'°</span><span class="wx-city-tile-tmin">'+t0min+'°</span></span></div>';
      if(t1max!=null)html+='<div class="wx-city-tile-day"><span class="wx-city-tile-dlbl">Dem.</span><span class="wx-city-tile-temps"><span class="wx-city-tile-tmax">'+t1max+'°</span><span class="wx-city-tile-tmin">'+t1min+'°</span></span></div>';
      html+='</div></div>';
    });
    el.innerHTML=html+'</div>';
  });
}
function wxRenderHero(z,cur,daily,name){
  var el=document.getElementById('wx-'+z+'-hero');if(!el)return;
  var sunrise=daily.sunrise?daily.sunrise[0].slice(11,16):'—';
  var sunset=daily.sunset?daily.sunset[0].slice(11,16):'—';
  el.innerHTML='<div class="wx-hero-main"><div class="wx-hero-icon">'+wxIco(cur.weathercode)+'</div><div class="wx-hero-temp-block"><div class="wx-hero-temp">'+Math.round(cur.temperature_2m)+'<span>°C</span></div><div class="wx-hero-cond">'+wxShort(cur.weathercode)+'</div><div class="wx-hero-loc">'+name+'</div></div></div>'
    +'<div class="wx-hero-divider"></div>'
    +'<div class="wx-hero-stats"><div class="wx-hero-stat"><span class="wx-hero-stat-lbl">Ressenti</span><span class="wx-hero-stat-val">'+Math.round(cur.apparent_temperature)+'°C</span></div><div class="wx-hero-stat"><span class="wx-hero-stat-lbl">Humidité</span><span class="wx-hero-stat-val">'+Math.round(cur.relative_humidity_2m)+'%</span></div><div class="wx-hero-stat"><span class="wx-hero-stat-lbl">Vent</span><span class="wx-hero-stat-val">'+Math.round(cur.windspeed_10m)+' km/h '+wxDir(cur.winddirection_10m)+'</span></div><div class="wx-hero-stat"><span class="wx-hero-stat-lbl">Précip.</span><span class="wx-hero-stat-val">'+cur.precipitation.toFixed(1)+' mm</span></div></div>'
    +'<div class="wx-hero-sun"><div class="wx-hero-sun-row">&#9728; Lever <b>'+sunrise+'</b></div><div class="wx-hero-sun-row">&#127769; Coucher <b>'+sunset+'</b></div></div>';
}
function wxRenderHourly(z,hourly){
  var el=document.getElementById('wx-'+z+'-hourly');if(!el)return;
  var now=new Date(),todayStr=now.toISOString().slice(0,10),nowH=now.getHours();

  /* Collecter les points */
  var pts=[];
  for(var i=0;i<hourly.time.length;i++){
    var t=hourly.time[i],h=parseInt(t.slice(11,13)),day=t.slice(0,10);
    if(day===todayStr&&h<nowH-1)continue;
    pts.push({
      h:h,day:day,
      isNow:(day===todayStr&&h===nowH),
      isFirstOfDay:(pts.length===0||(pts.length>0&&pts[pts.length-1].day!==day)),
      dayName:day===todayStr?'Aujourd\'hui':wxDayName(1),
      hLabel:(h<10?'0':'')+h+'h',
      temp:Math.round(hourly.temperature_2m[i]),
      code:hourly.weathercode[i],
      pop:hourly.precipitation_probability?hourly.precipitation_probability[i]:0,
      wind:Math.round(hourly.windspeed_10m[i]),
      wdir:hourly.winddirection_10m?wxDir(hourly.winddirection_10m[i]):''
    });
    if(pts.length>=30)break;
  }
  if(!pts.length){el.innerHTML='<div class="wx-loading-msg" style="padding:20px">Pas de données</div>';return;}

  var COL_W=70,PAD_L=16,PAD_R=16;
  var TOTAL_W=PAD_L+pts.length*COL_W+PAD_R;
  /* Layout vertical :
     0→20   : bandeau jour (en haut)
     20→70  : espace noms de jour
     70→120 : courbe de température
     120→200: zone étiquettes (heure, icône, pluie)
  */
  var DAY_BAND_H=20;  /* hauteur du bandeau coloré du jour */
  var DAY_LBL_Y=44;   /* y du texte du jour */
  var CURVE_TOP=72;   /* début de la zone courbe */
  var CURVE_H=60;     /* hauteur de la zone courbe */
  var CURVE_BOT=CURVE_TOP+CURVE_H; /* 132 */
  var HOUR_Y=CURVE_BOT+18;  /* 150 : heure seule */
  var ICON_Y=CURVE_BOT+38;  /* 170 : icône */
  var POP_Y=CURVE_BOT+56;   /* 188 : pluie */
  var SVG_H=200;

  var temps=pts.map(function(p){return p.temp;});
  var tMin=Math.min.apply(null,temps)-2;
  var tMax=Math.max.apply(null,temps)+2;
  var tRange=tMax-tMin||1;

  function cx(k){return PAD_L+k*COL_W+COL_W/2;}
  function cy(temp){return CURVE_TOP+CURVE_H-(temp-tMin)/tRange*CURVE_H;}

  /* Path courbe */
  var pathD='M'+cx(0)+','+cy(pts[0].temp);
  for(var k=1;k<pts.length;k++){
    var x0=cx(k-1),y0=cy(pts[k-1].temp),x1=cx(k),y1=cy(pts[k].temp),cpx=(x0+x1)/2;
    pathD+=' C'+cpx+','+y0+' '+cpx+','+y1+' '+x1+','+y1;
  }
  var areaD=pathD+' L'+cx(pts.length-1)+','+CURVE_BOT+' L'+cx(0)+','+CURVE_BOT+' Z';

  /* Identifier les groupes de jours */
  var dayGroups=[];
  pts.forEach(function(p,k){
    if(k===0||p.day!==pts[k-1].day){dayGroups.push({day:p.day,name:p.dayName,startK:k});}
  });

  var svgParts=[];
  svgParts.push('<svg xmlns="http://www.w3.org/2000/svg" width="'+TOTAL_W+'" height="'+SVG_H+'" style="display:block;">');
  svgParts.push('<defs><linearGradient id="wx-area-'+z+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1B5EB8" stop-opacity="0.4"/><stop offset="100%" stop-color="#1B5EB8" stop-opacity="0.03"/></linearGradient></defs>');

  /* ── Bandeaux de jour (en haut) ── */
  dayGroups.forEach(function(g,gi){
    var endK=gi+1<dayGroups.length?dayGroups[gi+1].startK:pts.length;
    var x1b=PAD_L+g.startK*COL_W;
    var x2b=PAD_L+endK*COL_W;
    var isToday=(g.day===todayStr);
    /* Bandeau couleur */
    svgParts.push('<rect x="'+x1b+'" y="0" width="'+(x2b-x1b)+'" height="'+DAY_BAND_H+'" fill="'+(isToday?'rgba(27,94,184,0.35)':'rgba(255,255,255,0.06)')+'" rx="0"/>');
    /* Nom du jour centré dans le bandeau */
    var midX=(x1b+x2b)/2;
    svgParts.push('<text x="'+midX+'" y="14" text-anchor="middle" font-family="\'Barlow Condensed\',sans-serif" font-size="11" font-weight="800" letter-spacing="0.1em" fill="'+(isToday?'rgba(100,160,255,0.9)':'rgba(255,255,255,0.35)')+'">'+g.name.toUpperCase()+'</text>');
    /* Séparateur vertical entre jours */
    if(gi>0){
      svgParts.push('<line x1="'+x1b+'" y1="0" x2="'+x1b+'" y2="'+SVG_H+'" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>');
    }
  });

  /* ── Aire + courbe ── */
  svgParts.push('<path d="'+areaD+'" fill="url(#wx-area-'+z+')" />');
  svgParts.push('<path d="'+pathD+'" fill="none" stroke="#4A90D9" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>');

  /* ── Ligne NOW ── */
  var nowIdx=pts.findIndex(function(p){return p.isNow;});
  if(nowIdx>=0){
    svgParts.push('<line x1="'+cx(nowIdx)+'" y1="'+DAY_BAND_H+'" x2="'+cx(nowIdx)+'" y2="'+CURVE_BOT+'" stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-dasharray="3,3"/>');
  }

  /* ── Points, température, heure, icône, pluie ── */
  pts.forEach(function(p,k){
    var x=cx(k),y=cy(p.temp);
    var isNow=p.isNow;
    var col=isNow?'#fff':'rgba(255,255,255,0.85)';

    /* Dot */
    svgParts.push('<circle cx="'+x+'" cy="'+y+'" r="'+(isNow?5:3)+'" fill="'+(isNow?'#fff':'#4A90D9')+'" stroke="'+(isNow?'#1B5EB8':'none')+'" stroke-width="'+(isNow?2.5:0)+'"/>');

    /* Température au-dessus du dot */
    svgParts.push('<text x="'+x+'" y="'+(y-9)+'" text-anchor="middle" font-family="\'Share Tech Mono\',monospace" font-size="12" font-weight="700" fill="'+col+'">'+p.temp+'°</text>');

    /* Heure (UNIQUEMENT) */
    var hlbl=isNow?'NOW':p.hLabel;
    svgParts.push('<text x="'+x+'" y="'+HOUR_Y+'" text-anchor="middle" font-family="\'Barlow Condensed\',sans-serif" font-size="'+(isNow?13:11)+'" font-weight="'+(isNow?800:600)+'" fill="'+(isNow?'#4A90D9':'rgba(255,255,255,0.45)')+'">'+hlbl+'</text>');

    /* Icône */
    svgParts.push('<text x="'+x+'" y="'+ICON_Y+'" text-anchor="middle" font-size="18">'+wxIco(p.code,p.h)+'</text>');

    /* Pluie */
    svgParts.push('<text x="'+x+'" y="'+POP_Y+'" text-anchor="middle" font-family="\'Share Tech Mono\',monospace" font-size="9" fill="'+(p.pop>0?'#5599ff':'rgba(255,255,255,0.2)')+'">'+p.pop+'%</text>');
  });

  svgParts.push('</svg>');

  el.innerHTML='<div style="overflow-x:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) transparent;">'+svgParts.join('')+'</div>';
  setTimeout(function(){
    var wrap=el.querySelector('div');
    if(!wrap||nowIdx<0)return;
    wrap.scrollLeft=Math.max(0,cx(nowIdx)-wrap.clientWidth/2);
  },100);
}




function wxRender3Days(z,daily){
  var el=document.getElementById('wx-'+z+'-3days');if(!el)return;
  var days=['Aujourd\'hui','Demain','Après-demain'];
  var html='<div class="wx-3d-grid">';
  for(var d=0;d<3;d++){
    if(!daily.weathercode[d]&&daily.weathercode[d]!==0)continue;
    var tmax=Math.round(daily.temperature_2m_max[d]);
    var tmin=Math.round(daily.temperature_2m_min[d]);
    var pop=daily.precipitation_probability_max?daily.precipitation_probability_max[d]:0;
    var wind=Math.round(daily.windspeed_10m_max[d]);
    var wdir=daily.winddirection_10m_dominant?wxDir(daily.winddirection_10m_dominant[d]):'';
    var precip=(daily.precipitation_sum[d]||0).toFixed(1);
    var sunrise=daily.sunrise?daily.sunrise[d].slice(11,16):'—';
    var sunset=daily.sunset?daily.sunset[d].slice(11,16):'—';
    html+='<div class="wx-3d-col'+(d===0?' wx-3d-today':'')+'">'
      /* Jour + icône */
      +'<div class="wx-3d-head">'
        +'<div class="wx-3d-day">'+days[d]+'</div>'
        +'<div class="wx-3d-icon">'+wxIco(daily.weathercode[d])+'</div>'
        +'<div class="wx-3d-cond">'+wxShort(daily.weathercode[d])+'</div>'
      +'</div>'
      /* Températures */
      +'<div class="wx-3d-temps">'
        +'<span class="wx-3d-tmax">'+tmax+'°</span>'
        +'<span class="wx-3d-bar">'
          +wxTempBar(tmin,tmax,daily)
        +'</span>'
        +'<span class="wx-3d-tmin">'+tmin+'°</span>'
      +'</div>'
      /* Détails */
      +'<div class="wx-3d-meta">'
        +'<div class="wx-3d-meta-row"><span class="wx-3d-ml">Vent</span><span class="wx-3d-mv">'+wind+' km/h '+wdir+'</span></div>'
        +'<div class="wx-3d-meta-row"><span class="wx-3d-ml">Pluie</span><span class="wx-3d-mv">'+precip+' mm ('+pop+'%)</span></div>'
        +'<div class="wx-3d-meta-row"><span class="wx-3d-ml">&#9728; Lever</span><span class="wx-3d-mv">'+sunrise+'</span></div>'
        +'<div class="wx-3d-meta-row"><span class="wx-3d-ml">&#127769; Coucher</span><span class="wx-3d-mv">'+sunset+'</span></div>'
      +'</div>'
    +'</div>';
  }
  html+='</div>';
  el.innerHTML=html;
}

function wxTempBar(tmin,tmax,daily){
  /* Barre de température relative aux 3 jours */
  var allMax=daily.temperature_2m_max.slice(0,3);
  var allMin=daily.temperature_2m_min.slice(0,3);
  var globalMin=Math.min.apply(null,allMin)-1;
  var globalMax=Math.max.apply(null,allMax)+1;
  var range=globalMax-globalMin||1;
  var pctMin=((tmin-globalMin)/range*100).toFixed(1);
  var pctMax=((tmax-globalMin)/range*100).toFixed(1);
  var width=(pctMax-pctMin).toFixed(1);
  return '<div class="wx-3d-bar-bg">'
    +'<div class="wx-3d-bar-fill" style="left:'+pctMin+'%;width:'+width+'%"></div>'
    +'</div>';
}

/* ── Prêt à lire ── */
var wxPalDay={am:0,idf:0};
var wxPalData={am:null,idf:null};

function wxPalSwitch(z,day){
  wxPalDay[z]=day;
  document.getElementById('wx-'+z+'-pal-tab0').classList.toggle('active',day===0);
  document.getElementById('wx-'+z+'-pal-tab1').classList.toggle('active',day===1);
  /* Si déjà généré, régénérer */
  var body=document.getElementById('wx-'+z+'-pal-body');
  if(body&&body.querySelector('.wx-pal-text')){wxPalGenerate(z);}
}

function wxPalGenerate(z){
  var body=document.getElementById('wx-'+z+'-pal-body');if(!body)return;
  var copyBtn=document.getElementById('wx-'+z+'-pal-copy');
  if(copyBtn)copyBtn.style.display='none';
  body.innerHTML='<div class="wx-pal-loading">G\u00e9n\u00e9ration\u2026</div>';

  var d=wxPalData[z];
  if(!d){body.innerHTML='<div class="wx-pal-hint">Donn\u00e9es m\u00e9t\u00e9o non charg\u00e9es. Patientez.</div>';return;}

  var off=wxPalDay[z];
  var daily=d.daily;
  var zone=WX_ZONES[z];
  var tmax=Math.round(daily.temperature_2m_max[off]);
  var tmin=Math.round(daily.temperature_2m_min[off]);
  var cond=wxShort(daily.weathercode[off]);
  var wind=Math.round(daily.windspeed_10m_max[off]);
  var wdir=daily.winddirection_10m_dominant?wxDir(daily.winddirection_10m_dominant[off]):'';
  var precip=parseFloat((daily.precipitation_sum[off]||0).toFixed(1));
  var pop=daily.precipitation_probability_max?daily.precipitation_probability_max[off]:0;
  var dayLbl=off===0?'aujourd\'hui':'demain';
  var dayFull=off===0?wxDayName(0)+' '+new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long'}):wxDayName(1);

  /* Villes */
  var citiesEl=document.getElementById('wx-'+z+'-cities');
  var cityTemps=[];
  if(citiesEl){
    citiesEl.querySelectorAll('.wx-city-tile').forEach(function(tile){
      var n=tile.querySelector('.wx-city-tile-name');
      var tm=tile.querySelector('.wx-city-tile-tmax');
      var tn=tile.querySelector('.wx-city-tile-tmin');
      if(n&&tm)cityTemps.push({name:n.textContent.trim(),tmax:tm.textContent.trim(),tmin:tn?tn.textContent.trim():''});
    });
  }

  /* Bulletin local */
  var phrTemps=dayFull+' sur '+zone.name+', '+cond.toLowerCase()+' avec un maximum de '+tmax+'\u00b0C et un minimum de '+tmin+'\u00b0C.';
  var phrVent=wind>=30?'Le vent souffle jusqu\'\u00e0 '+wind+' km/h'+( wdir?' en provenance du '+wdir:'')+'.' :'';
  var phrPluie=precip>1||pop>40?'Des pr\u00e9cipitations sont possibles ('+pop+'%).' :'Pas de pr\u00e9cipitations pr\u00e9vues.';
  var phrVilles=cityTemps.length?'Les temp\u00e9ratures maximales : '+cityTemps.slice(0,5).map(function(ct){return ct.name+' '+ct.tmax;}).join(', ')+'.':'';
  var bulletin=[phrTemps,phrVent,phrPluie,phrVilles].filter(function(s){return s.length>2;}).join(' ');

  function showResult(text){
    var th='';
    if(cityTemps.length){
      th='<div class="wx-pal-temps">';
      cityTemps.forEach(function(ct){
        th+='<div class="wx-pal-temp-item"><span class="wx-pal-temp-city">'+ct.name+'</span><span class="wx-pal-temp-val">'+ct.tmax+' <span>'+ct.tmin+'</span></span></div>';
      });
      th+='</div>';
    }
    body.innerHTML='<div class="wx-pal-text">'+text.replace(/\n/g,'<br>')+'</div>'+th;
    body.dataset.text=text+(cityTemps.length?'\n\n'+cityTemps.map(function(ct){return ct.name+' : '+ct.tmax+' / '+ct.tmin;}).join(' | '):'');
    if(copyBtn)copyBtn.style.display='';
  }

  showResult(bulletin);

  /* Upgrade via Worker (si disponible) */
  fetch(W+'/ai',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      model:'claude-sonnet-4-20250514',max_tokens:350,
      messages:[{role:'user',content:'Bulletin m\u00e9t\u00e9o radio 4 phrases pour '+dayLbl+' \u00e0 '+zone.name+': '+cond+', max '+tmax+'\u00b0, min '+tmin+'\u00b0, vent '+wind+' km/h '+wdir+', pluie '+precip+'mm ('+pop+'%). '+(cityTemps.length?'Villes max: '+cityTemps.map(function(ct){return ct.name+' '+ct.tmax;}).join(', ')+'. ':'')}]
    })
  })
  .then(function(r){if(!r.ok)throw 0;return r.json();})
  .then(function(data){var t=(data.content&&data.content[0]&&data.content[0].text)||'';if(t.length>20)showResult(t);})
  .catch(function(){});
}

function wxPalCopy(z){
  var body=document.getElementById('wx-'+z+'-pal-body');if(!body)return;
  var text=body.dataset.text||body.innerText;
  if(navigator.clipboard){navigator.clipboard.writeText(text);}
  var btn=document.getElementById('wx-'+z+'-pal-copy');
  if(btn){btn.textContent='✓ Copié';setTimeout(function(){btn.innerHTML='&#128203; Copier';},2000);}
}

/* ══ NOTE ANTENNE ═════════════════════════════════════════════════════════ */


/* ── INCIDENT ANTENNE ── */
var naIncSelectedType = '';

function naIncInit(){
  var dateEl = document.getElementById('na-inc-date');
  if(dateEl) dateEl.textContent = new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  /* Heure de début = maintenant par défaut */
  var now = new Date();
  var hh = ('0'+now.getHours()).slice(-2);
  var mm = ('0'+now.getMinutes()).slice(-2);
  var heureEl = document.getElementById('na-inc-heure-debut');
  if(heureEl) heureEl.value = hh+':'+mm;
  /* Charger les incidents récents depuis le storage */
  naIncLoadRecent();
}

function naIncSelect(btn){
  document.querySelectorAll('.na-inc-type').forEach(function(b){ b.classList.remove('selected'); });
  btn.classList.add('selected');
  naIncSelectedType = btn.dataset.type;
  var typeEl = document.getElementById('na-inc-selected-type');
  if(typeEl) typeEl.textContent = naIncSelectedType;
  var form = document.getElementById('na-inc-form');
  if(form) form.style.display = 'flex';
}

function naIncCancel(){
  naIncSelectedType = '';
  document.querySelectorAll('.na-inc-type').forEach(function(b){ b.classList.remove('selected'); });
  var form = document.getElementById('na-inc-form');
  if(form) form.style.display = 'none';
}

function naIncDeclare(){
  if(!naIncSelectedType) return;
  var heureDebut = document.getElementById('na-inc-heure-debut').value || '—';
  var heureFin   = document.getElementById('na-inc-heure-fin').value   || '';
  var descEl     = document.getElementById('na-inc-desc-inline') || document.getElementById('na-inc-desc');
  var desc       = descEl ? descEl.value.trim() : '';
  var auteurEl   = document.getElementById('na-inc-auteur');
  var auteur     = auteurEl ? auteurEl.value.trim() : '';

  var incident = {
    id:        'inc_' + Date.now(),
    type:      naIncSelectedType,
    date:      new Date().toLocaleDateString('fr-FR'),
    heureDebut: heureDebut,
    heureFin:   heureFin,
    desc:       desc,
    auteur:     auteur,
    declaredAt: new Date().toISOString(),
    status:     'actif'
  };

  /* Envoyer au Worker Cloudflare */
  fetch('https://adminsend.nicolas7lejeune.workers.dev/incidents', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(incident)
  }).catch(function(){});

  /* Sauvegarder dans le storage partagé (lu par la page incidents) */
  var key = 'rm_incidents';
  var save = function(existing){
    var list = existing ? JSON.parse(existing) : [];
    list.unshift(incident);  /* Plus récent en premier */
    if(list.length > 50) list = list.slice(0, 50);  /* Max 50 incidents */
    if(typeof window.storage !== 'undefined'){
      window.storage.set(key, JSON.stringify(list), true)
        .catch(function(){ localStorage.setItem(key, JSON.stringify(list)); });
    } else {
      localStorage.setItem(key, JSON.stringify(list));
    }
  };

  if(typeof window.storage !== 'undefined'){
    window.storage.get(key, true)
      .then(function(r){ save(r && r.value ? r.value : null); })
      .catch(function(){ save(localStorage.getItem(key)); });
  } else {
    save(localStorage.getItem(key));
  }

  /* On ne recharge pas la liste locale — l'incident part vers Admin Tool */
  naIncCancel();
  /* Reset champs */
  var descEl2 = document.getElementById('na-inc-desc-inline') || document.getElementById('na-inc-desc');
  if(descEl2) descEl2.value = '';
  var auteurEl2 = document.getElementById('na-inc-auteur');
  if(auteurEl2) auteurEl2.value = '';
}

function naIncLoadRecent(){
  var el = document.getElementById('na-inc-recent'); if(!el) return;

  function render(list){
    if(!list || !list.length){
      el.innerHTML = '<div class="na-empty">Aucun incident d\u00e9clar\u00e9</div>';
      return;
    }
    var today = new Date().toLocaleDateString('fr-FR');
    var todayItems = list.filter(function(i){ return i.date === today; });
    if(!todayItems.length){
      el.innerHTML = '<div class="na-empty">Aucun incident aujourd\'hui</div>';
      return;
    }
    el.innerHTML = todayItems.slice(0,5).map(function(inc){
      var isMajor = inc.type === 'Incident Majeur';
      var timeStr = escHtml(inc.heureDebut) + (inc.heureFin ? ' \u2192 ' + escHtml(inc.heureFin) : '');
      return '<div class="na-inc-item'+(isMajor?' na-inc-item--major':'')+'">'
        +'<span class="na-inc-item-time">'+timeStr+'</span>'
        +'<div class="na-inc-item-body">'
          +'<div class="na-inc-item-type">'+escHtml(inc.type)+'</div>'
          +(inc.desc?'<div class="na-inc-item-desc">'+escHtml(inc.desc)+'</div>':'')
        +'</div>'
        +'<span class="na-inc-item-status">'+escHtml(inc.status)+'</span>'
      +'</div>';
    }).join('');
  }

  var key = 'rm_incidents';
  if(typeof window.storage !== 'undefined'){
    window.storage.get(key, true)
      .then(function(r){
        var list = (r && r.value) ? JSON.parse(r.value) : [];
        render(list);
      })
      .catch(function(){
        render(JSON.parse(localStorage.getItem(key)||'[]'));
      });
  } else {
    render(JSON.parse(localStorage.getItem(key)||'[]'));
  }
}

var NA_WORKER_URL = 'https://adminsend.nicolas7lejeune.workers.dev/broadcast';

function naGFmt(h){
  if(h==null)return'--:--';
  var hh=Math.floor(h),mm=(h%1)?30:0;
  return String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0');
}

/* Toute la journée est affichée (plus de filtre Morning/DJ) */
function naGKeepSlot(slot){
  return true;
}

function naGBuildPeople(slot){
  var people=[];
  (slot.animateurs||[]).forEach(function(a){people.push({nom:escHtml(a.prenom+' '+(a.nom||'').toUpperCase()),color:escHtml(a.color||'#E4032E'),role:'Animateur'});});
  (slot.journalistes||[]).forEach(function(j){people.push({nom:escHtml(j.prenom+' '+(j.nom||'').toUpperCase()),color:escHtml(j.color||'#E87C3E'),role:'Journaliste'});});
  return people;
}

function naGCardHtml(slot){
  var now=new Date();
  var nowH=now.getHours()+now.getMinutes()/60;
  var isLive=(slot.hdebut!=null && slot.hfin!=null && nowH>=slot.hdebut && nowH<slot.hfin);
  var isPast=(slot.hfin!=null && nowH>=slot.hfin);
  var people=naGBuildPeople(slot);
  var peopleHtml=people.length
    ? people.map(function(p){
        return '<span class="ng-person-chip"><span class="ng-person-dot" style="background:'+p.color+';"></span>'+p.nom+' <span style="opacity:.4;font-weight:600;">&middot; '+p.role+'</span></span>';
      }).join('')
    : '<span class="ng-card-extra">Aucun intervenant renseigné</span>';
  var jeuHtml='';
  if(slot.jeu&&slot.jeu.nom){
    jeuHtml='<div class="ng-card-extra">&#127918; '+escHtml(slot.jeu.nom)+(slot.jeu.gain?' — Gain : '+escHtml(slot.jeu.gain):'')+'</div>';
  }
  return '<div class="ng-card'+(isLive?' live':'')+(isPast?' past':'')+'">'
    +'<div class="ng-card-time">'
      +'<div class="ng-card-time-val">'+naGFmt(slot.hdebut)+'</div>'
      +'<div class="ng-card-time-sep">&#8595;</div>'
      +'<div class="ng-card-time-val">'+naGFmt(slot.hfin)+'</div>'
    +'</div>'
    +'<div class="ng-card-body">'
      +'<div class="ng-card-head">'
        +'<span class="ng-card-name">'+escHtml(slot.emission||'—')+'</span>'
        +(isLive?'<span class="ng-live-badge"><span class="ng-live-dot"></span>En direct</span>':'')
      +'</div>'
      +'<div class="ng-card-people">'+peopleHtml+'</div>'
      +jeuHtml
    +'</div>'
  +'</div>';
}

/* Retrouve l'objet "jour" correspondant à aujourd'hui, quel que soit le format renvoyé par le Worker */
function naFindTodayDay(days){
  var todayIso=new Date().toISOString().slice(0,10);
  var jsDay=new Date().getDay();       /* 0=Dim..6=Sam (natif JS) */
  var mondayIdx=(jsDay+6)%7;           /* 0=Lun..6=Dim (convention utilisée ailleurs dans l'app) */
  var d;
  d=days.find(function(x){return x.isoDate===todayIso;}); if(d)return d;
  d=days.find(function(x){return x.date===todayIso;});    if(d)return d;
  d=days.find(function(x){return x.dateISO===todayIso;}); if(d)return d;
  d=days.find(function(x){return x.dayIdx===mondayIdx;}); if(d)return d;
  d=days.find(function(x){return x.dayIdx===jsDay;});     if(d)return d;
  /* Dernier recours : si un seul jour est renvoyé, on suppose que c'est celui d'aujourd'hui */
  if(days.length===1)return days[0];
  return null;
}

function naRenderGrilleDuJour(slots,debugInfo){
  var el=document.getElementById('ng-grid-container');if(!el)return;
  if(!slots||!slots.length){
    el.innerHTML='<div class="ng-empty">Aucun programme trouvé pour aujourd\'hui'
      +(debugInfo?'<div style="margin-top:10px;font-family:\'Share Tech Mono\',monospace;font-size:10px;color:rgba(255,255,255,.2);letter-spacing:0;text-transform:none;">'+debugInfo+'</div>':'')
      +'</div>';
    return;
  }
  slots.sort(function(a,b){return (a.hdebut||0)-(b.hdebut||0);});
  el.innerHTML=slots.map(naGCardHtml).join('');
}

var NA_GRILLE_LAST_DAY=null;
function naLoadGrilleDuJour(){
  return fetch(NA_WORKER_URL,{cache:'no-store'})
    .then(function(r){if(!r.ok)throw 0;return r.json();})
    .then(function(data){
      console.log('[grille du jour] réponse worker:',data);
      if(!data||data.empty){naRenderGrilleDuJour([],'Le Worker n\'a renvoyé aucune donnée (data.empty) — rien n\'a encore été publié depuis RM-Admin.');naRenderJeuxEnCours([]);return false;}
      var days=data.days||[];
      var day=naFindTodayDay(days);
      NA_GRILLE_LAST_DAY=day||null;

      if(!day){
        var recap=days.map(function(x){return '{dayIdx:'+x.dayIdx+', isoDate:'+(x.isoDate||'—')+'}';}).join(' ');
        naRenderGrilleDuJour([], days.length?('Jour introuvable parmi '+days.length+' reçus &rarr; '+recap):'Aucun jour reçu du Worker.');
        naRenderJeuxEnCours([]);
        return false;
      }

      var slots=[];
      if(day.matin&&day.matin.slots)slots=slots.concat(day.matin.slots);
      if(day.soir&&day.soir.slots)slots=slots.concat(day.soir.slots);

      if(!slots.length){
        naRenderGrilleDuJour([], 'La grille du '+(day.isoDate||'jour')+' est vide côté RM-Admin — aucune émission n\'y a été placée pour l\'instant.');
        naRenderJeuxEnCours([]);
        var badge0=document.getElementById('na-sync-badge');
        if(badge0&&data.publishedAt){badge0.textContent='Sync '+new Date(data.publishedAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});badge0.style.display='inline-block';}
        return true;
      }

      var filtered=slots.filter(naGKeepSlot);
      if(!filtered.length){
        var noms=slots.map(function(s){return s.emission;}).join(', ');
        naRenderGrilleDuJour([], 'Des émissions existent aujourd\'hui ('+noms+') mais aucune ne correspond au filtre Morning / Morning+ / DJ 20h+.');
      } else {
        naRenderGrilleDuJour(filtered);
      }
      naRenderJeuxEnCours(slots);
      var badge=document.getElementById('na-sync-badge');
      if(badge&&data.publishedAt){badge.textContent='Sync '+new Date(data.publishedAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});badge.style.display='inline-block';}
      return true;
    })
    .catch(function(e){console.warn('[grille du jour] erreur:',e);naRenderGrilleDuJour([],'Erreur réseau lors de l\'appel au Worker.');naRenderJeuxEnCours([]);return false;});
}

/* ── Jeux en cours (tous les jeux antenne du jour, toutes émissions confondues) ── */
function naJeuCardHtml(item){
  var now=new Date();
  var nowH=now.getHours()+now.getMinutes()/60;
  var isLive=(item.hdebut!=null && item.hfin!=null && nowH>=item.hdebut && nowH<item.hfin);
  var isPast=(item.hfin!=null && nowH>=item.hfin);
  return '<div class="ng-card'+(isLive?' live':'')+(isPast?' past':'')+'">'
    +'<div class="ng-card-time" style="width:110px;">'
      +'<div class="ng-card-time-val" style="font-size:18px;">'+(item.heure||naGFmt(item.hdebut))+'</div>'
      +'<div class="ng-card-time-sep">'+escHtml(item.emission||'')+'</div>'
    +'</div>'
    +'<div class="ng-card-body">'
      +'<div class="ng-card-head">'
        +'<span class="ng-card-name" style="font-size:22px;">&#127918; '+escHtml(item.nom||'Jeu')+'</span>'
        +(isLive?'<span class="ng-live-badge"><span class="ng-live-dot"></span>En cours</span>':'')
      +'</div>'
      +(item.desc?'<div class="ng-card-extra">'+escHtml(item.desc)+'</div>':'')
      +(item.gain?'<div class="ng-card-extra">&#127873; Gain : '+escHtml(item.gain)+'</div>':'')
    +'</div>'
  +'</div>';
}

function naRenderJeuxEnCours(slots){
  var el=document.getElementById('ng-jeux-container');if(!el)return;
  var items=(slots||[]).filter(function(s){return s.jeu&&s.jeu.nom;}).map(function(s){
    return {nom:s.jeu.nom,desc:s.jeu.gain?'':'',gain:s.jeu.gain,heure:naGFmt(s.hdebut),hdebut:s.hdebut,hfin:s.hfin,emission:s.emission};
  });
  if(!items.length){
    el.innerHTML='<div class="ng-empty">Aucun jeu antenne configuré aujourd\'hui</div>';
    return;
  }
  items.sort(function(a,b){return (a.hdebut||0)-(b.hdebut||0);});
  el.innerHTML=items.map(naJeuCardHtml).join('');
}

function initNoteAntenne(){
  naIncInit();
  naLoadGrilleDuJour();
  setInterval(naLoadGrilleDuJour,30000);
}

/* ── Live antenne Radio Monaco ── */
var NA_GRILLE_HEURES=[
  {h:0,name:'Non-stop Music',host:''},
  {h:6,name:'Le Morning Made in Monte-Carlo',host:''},
  {h:9,name:'Non-stop Music',host:''}
];
function naGetEmissionFromGrille(){
  var hNow=new Date().getHours(),found=NA_GRILLE_HEURES[0];
  for(var i=0;i<NA_GRILLE_HEURES.length;i++){if(hNow>=NA_GRILLE_HEURES[i].h)found=NA_GRILLE_HEURES[i];}
  return found;
}
function naUpdateClock(){
  var el=document.getElementById('na-live-heure');
  if(el)el.textContent=new Date().toLocaleTimeString('fr-FR',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
function naApplyEmission(name,host,src){
  var eEl=document.getElementById('na-live-emission');
  var tEl=document.getElementById('na-live-titre');
  var sEl=document.getElementById('na-live-source');
  if(eEl)eEl.textContent=name;
  if(tEl)tEl.textContent=host||'';
  if(sEl)sEl.textContent=src||'';
}
function naFetchLive(){
  fetch('https://radio-monaco.com/',{cache:'no-cache'})
    .then(function(r){return r.text();})
    .then(function(html){
      var m1=html.match(/aintenant[\s\S]{0,30}<[^>]+>([^<]{3,60})</);
      var emName=m1?m1[1].replace(/&[^;]+;/g,'').trim():'';
      if(emName.length>2){
        naApplyEmission(emName,'','● Live');
      } else {
        var em=naGetEmissionFromGrille();
        naApplyEmission(em.name,em.host,'↻ Grille locale');
      }
    })
    .catch(function(){
      var em=naGetEmissionFromGrille();
      naApplyEmission(em.name,em.host,'↻ Grille locale');
    });
}
function naInitLive(){
  var em=naGetEmissionFromGrille();
  naApplyEmission(em.name,em.host,'...');
  naFetchLive();
  naUpdateClock();
  setInterval(naUpdateClock,1000);
  setInterval(naFetchLive,60000);
}


function naInitLive(){
  naFetchLive();
  naUpdateClock();
  setInterval(naUpdateClock,1000);
  setInterval(naFetchLive,60000);
}

/* ── Modal Incident Global ── */
function naIncOpenModal(){
  var modal=document.getElementById('inc-modal-overlay');
  if(!modal)return;
  modal.style.display='flex';
  var dateEl=document.getElementById('inc-modal-date');
  if(dateEl)dateEl.textContent=new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
  var now=new Date();
  var hEl=document.getElementById('na-inc-heure-debut');
  if(hEl)hEl.value=('0'+now.getHours()).slice(-2)+':'+('0'+now.getMinutes()).slice(-2);
  naIncLoadRecent();
}
function naIncCloseModal(e){
  if(e&&e.target!==document.getElementById('inc-modal-overlay'))return;
  var modal=document.getElementById('inc-modal-overlay');
  if(modal)modal.style.display='none';
  naIncCancel();
}

(function(){
  var params=new URLSearchParams(window.location.search);
  var tab=params.get('tab');
  switchTab(tab==='weather'?'weather':(tab==='antenne'?'antenne':'trafic'));
  setTimeout(naLoadGrilleDuJour,1000);
})();

/* ══ DIFFUSEUR DE SECOURS ════════════════════════════════════════════════ */
(function(){
  var _diffLoaded = false;
  var _diffHTML = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DIFF SECOURS</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css">
<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Oswald:wght@600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --mono:'Share Tech Mono',monospace; --display:'Oswald',sans-serif;
    /* ── Gris dominants ── */
    --bg:#16181e;        /* fond principal */
    --s1:#1e2028;        /* panneaux */
    --s2:#252830;        /* headers */
    --s3:#1a1c22;        /* sous-headers */
    --border:#38404e;    /* bordures */
    /* ── Accents ── */
    --cyan:#ffffff;      --cyan-dim:#aab8c8;
    --green:#00c85a;     --green-dk:#005828;
    --yellow:#e8b800;    --orange:#e07000;
    --red:#d42818;
    /* ── Textes ── */
    --txt:#e8ecf4;       --txt-dim:#8090a8;    --txt-mute:#4a5468;
  }
  html{height:100%;overflow:hidden;background:var(--bg)!important;}
  body{display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)!important;margin:0;}
  .section.is-console{padding:0;background:var(--bg);flex:1;display:flex;flex-direction:column;min-height:0;}
  .card.is-dark-card{background:var(--s1);border:1px solid var(--border);border-radius:0;box-shadow:none;flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;}
  .card.is-dark-card .card-header{background:var(--s2);border-bottom:1px solid var(--border);box-shadow:none;border-radius:0;flex-shrink:0;}
  .card.is-dark-card .card-header-title{color:var(--txt);font-family:var(--display);font-size:15px;letter-spacing:1px;padding:.6rem 1rem;}
  .card.is-dark-card .card-content{padding:0;flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;}
  .card.is-dark-card .card-footer{background:var(--s3);border-top:1px solid var(--border);border-radius:0;padding:.4rem 1rem;gap:1rem;flex-shrink:0;}
  .card.is-dark-card .card-footer-item{color:var(--txt-dim);font-family:var(--mono);font-size:11px;border:none;padding:0;justify-content:flex-start;}
  .diff-badge{font-family:var(--mono);font-size:11px;font-weight:700;letter-spacing:2px;padding:2px 10px;border-radius:4px;}
  .notification.is-onair{background:var(--s2);border:1px solid var(--border);border-top:none;border-radius:0;padding:.4rem 1rem;margin:0;display:flex;align-items:center;justify-content:space-between;transition:background .2s,border-color .2s;flex-shrink:0;}

  /* ── État EN DIRECT — rouge sur TOUT le module ── */
  .card.is-dark-card.is-live-card { border-color:#6a1010 !important; }
  .diff-card-header.is-live{
    background:linear-gradient(90deg,#2e0808 0%,#220606 100%) !important;
    border-bottom-color:#7a1010 !important;
    transition:background .3s,border-color .3s;
  }
  .diff-card-header.is-live .diff-badge{background:#5a0000!important;color:#ff6060!important;border-color:#991818!important;box-shadow:0 0 8px rgba(200,30,30,.4);}
  .diff-onair-bar.is-live{
    background:linear-gradient(90deg,#2e0808 0%,#200606 100%) !important;
    border-color:#6a1010 !important;
  }
  .diff-onair-bar.is-live .onair-title{color:#ff5050!important;}
  .diff-onair-bar.is-live .dot-live{background:#ff3030!important;box-shadow:0 0 6px #ff3030,0 0 12px rgba(255,30,30,.6)!important;animation:live-pulse .8s ease-in-out infinite!important;}
  /* Zone PAZ rouge */
  #paz.is-playing { background:linear-gradient(180deg,#1a0404 0%,#120202 100%) !important; }
  /* Progress bar rouge */
  .progress.is-elapsed.is-live { background:#3a0808 !important; }
  .progress.is-elapsed.is-live::-webkit-progress-value { background:#d42818 !important; }
  .progress.is-elapsed.is-live::-moz-progress-bar { background:#d42818 !important; }
  @keyframes live-pulse{0%,100%{opacity:1;box-shadow:0 0 6px #ff3030,0 0 14px rgba(255,30,30,.5);}50%{opacity:.6;box-shadow:0 0 3px #ff3030;}}
  .onair-title{font-family:var(--display);font-size:22px;font-weight:700;color:var(--txt);letter-spacing:3px;}
  .onair-track-name{font-family:var(--display);font-size:16px;font-weight:700;letter-spacing:2px;color:var(--yellow);margin-left:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:320px;transition:opacity .3s;}
  .dot-live{display:inline-block;width:8px;height:8px;background:var(--red);border-radius:50%;animation:blink 1s step-start infinite;vertical-align:middle;margin-right:6px;}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
  /* ══ MODULATION ══ */
  .mod-chan-card{background:var(--s1);border:1px solid var(--border);border-radius:6px;padding:10px;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;transition:border-color .15s,background .12s;user-select:none;}
  .mod-chan-card:hover{background:var(--s2);border-color:var(--txt-mute);}
  .mod-chan-card.selected{border-color:#9b6de5!important;background:#1a1428!important;}
  .mod-chan-header{font-family:var(--mono);font-size:10px;letter-spacing:2px;color:var(--txt-mute);font-weight:700;}
  .mod-vu-wrap{display:flex;gap:3px;height:60px;align-items:flex-end;}
  .mod-vu-wrap.mod-vu-mini{height:36px;}
  .mod-vu-bar-wrap{width:10px;height:100%;background:#0a0c10;border-radius:2px;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;}
  .mod-vu-bar{width:100%;height:0%;background:linear-gradient(to top,#00c85a 0%,#e8b800 75%,#d42818 100%);border-radius:2px;transition:height .05s;}
  .mod-chan-db{font-family:var(--mono);font-size:9px;color:var(--txt-mute);}
  .mod-chan-info{font-family:var(--mono);font-size:8px;color:#4a3a70;letter-spacing:1px;}
  .mod-cart-card{padding:6px;}
  /* DSP Editor */
  .mod-dsp-block{background:var(--s2);border-radius:5px;padding:12px;display:flex;flex-direction:column;gap:8px;}
  .mod-dsp-label{font-family:var(--mono);font-size:8px;color:#9b6de5;letter-spacing:3px;font-weight:700;}
  .mod-dsp-row{display:flex;align-items:center;gap:8px;}
  .mod-dsp-name{font-family:var(--mono);font-size:9px;color:var(--txt-mute);width:56px;flex-shrink:0;}
  .mod-dsp-slider{flex:1;height:3px;accent-color:#9b6de5;cursor:pointer;}
  .mod-dsp-val{font-family:var(--mono);font-size:9px;color:var(--txt);width:52px;text-align:right;flex-shrink:0;}
  .mod-bypass-btn{font-family:var(--mono);font-size:8px;padding:3px 8px;background:transparent;border:1px solid var(--border);color:var(--txt-mute);border-radius:3px;cursor:pointer;letter-spacing:1px;transition:all .12s;}
  .mod-bypass-btn.active{background:#1a0a30;border-color:#9b6de5;color:#9b6de5;}
  @keyframes vu-anim{to{height:0%;}}
  .table.is-radio{background:transparent;width:100%;}
  .table.is-radio thead th{background:var(--s3);color:var(--txt-mute);font-family:var(--mono);font-size:9px;letter-spacing:1px;text-transform:uppercase;border-color:var(--border)!important;padding:6px 10px;font-weight:400;}
  .table.is-radio tbody tr{border-bottom:1px solid var(--border);cursor:pointer;position:relative;overflow:hidden;}
  .table.is-radio tbody tr:hover td{background:#22252d;}
  .table.is-radio tbody td{border-color:var(--border)!important;color:var(--txt-dim);padding:0 10px;height:56px;vertical-align:middle;white-space:nowrap;}

  /* ── Ligne active : grande, waveform en fond ── */
  .table.is-radio tbody tr.row-active{
    background:#080a10;
    border-left:3px solid var(--red);
    border-top:1px solid #3a0808;
    border-bottom:1px solid #3a0808;
  }
  .table.is-radio tbody tr.row-active td{
    position:relative;z-index:2;
    height:96px; /* plus haute */
    vertical-align:middle;
  }
  /* Fond de progression rouge */
  .table.is-radio tbody tr.row-active::before{
    content:'';position:absolute;inset:0;
    background:linear-gradient(90deg,rgba(60,5,5,.9) 0%,rgba(30,3,3,.7) 100%);
    z-index:0;transform-origin:left;transform:scaleX(var(--prog,0));
    transition:transform .1s linear;
  }
  /* Waveform fond : canvas positionné en absolu z-index:1 */
  .row-active-wv-bg{
    position:absolute;inset:0;z-index:1;
    width:100%;height:100%;
    opacity:0.55;object-fit:fill;pointer-events:none;
    display:block;
  }
  /* Titre en gros sur la ligne active */
  .row-active-title{
    font-family:var(--display);
    font-size:22px;font-weight:700;
    color:#ffffff;letter-spacing:2px;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    text-shadow:0 1px 8px rgba(0,0,0,.8);
    position:relative;z-index:3;
  }
  /* Timecode à droite sur ligne active */
  .row-active-tc{
    font-family:var(--mono);
    font-size:13px;color:#ff4040;
    letter-spacing:1px;font-weight:700;
    position:relative;z-index:3;
  }
  /* Durée sur ligne active */
  .row-active-dur{
    font-family:var(--mono);font-size:11px;
    color:#7a9ab8;position:relative;z-index:3;
  }
  /* Horaire sur ligne active */
  .row-active-time{
    font-family:var(--mono);font-size:11px;
    color:var(--cyan-dim);position:relative;z-index:3;
  }
  /* IN/OUT labels sous le titre sur ligne active */
  .row-active-cues{
    font-family:var(--mono);font-size:8px;
    color:rgba(0,212,240,.6);letter-spacing:1px;
    position:relative;z-index:3;margin-top:2px;
  }

  .table.is-radio tbody tr.row-next{background:#141a12;border-left:3px solid var(--green-dk);}
  .cell-num{width:36px;font-family:var(--mono);font-size:12px;text-align:center;}
  .cell-num.is-playing{color:var(--red)!important;}
  .cell-time{width:80px;font-family:var(--mono);font-size:11px;color:var(--cyan-dim)!important;}
  .cell-sub{font-size:9px;color:var(--txt-mute)!important;display:block;}
  .cell-title{min-width:120px;max-width:160px;}
  .cell-simple{font-size:12px;color:#7a98b8!important;overflow:hidden;text-overflow:ellipsis;display:block;max-width:150px;}
  .row-active .cell-simple{color:#ff6060!important;}
  .row-active .cell-num{color:#ff4040!important;}
  .row-next .cell-simple{color:#40d870!important;}
  .row-next .cell-cd{color:#40d870!important;}
  .cell-dur{width:64px;font-family:var(--mono);font-size:11px;text-align:right;}
  .cell-cd{width:84px;font-family:var(--mono);font-size:12px;text-align:right;padding-right:10px!important;}
  .cell-wv{padding:4px 8px!important;vertical-align:middle!important;}
  .cell-bar{width:5px;padding:0!important;}
  .color-bar{height:56px;width:5px;display:block;}
  .progress.is-elapsed{height:3px;margin:0;border-radius:0;background:var(--border);}
  .progress.is-elapsed::-webkit-progress-value{background:var(--red);transition:width .1s linear;}
  .progress.is-elapsed::-moz-progress-bar{background:var(--red);}
  .console-sep{height:24px;background:#14161c;border-top:1px solid #0d1830;border-bottom:1px solid #0d1830;display:flex;align-items:center;padding:0 1rem;gap:1rem;}
  .sep-line{flex:1;height:1px;background:var(--s2);}
  .sep-label{font-family:var(--mono);font-size:9px;color:var(--txt-mute);letter-spacing:3px;}
  .columns.is-console{margin:0;}
  .columns.is-console .column{padding:0;}
  .button{font-family:var(--mono)!important;font-size:11px!important;letter-spacing:1px!important;border-radius:2px!important;}
  .button.is-dark{background:transparent!important;border-color:var(--border)!important;color:var(--txt-dim)!important;}
  .button.is-dark:hover{border-color:var(--cyan-dim)!important;color:var(--txt)!important;}
  .button.is-success{background:transparent!important;border-color:var(--green)!important;color:var(--green)!important;}
  .button.is-success:hover{background:#141e10!important;}
  .button.is-danger{background:transparent!important;border-color:var(--red)!important;color:var(--red)!important;}
  .button.is-danger:hover{background:#2a1010!important;}
  .button.is-auto{background:transparent!important;border-color:var(--border)!important;color:var(--txt-dim)!important;transition:all .15s!important;}
  .button.is-auto.active{background:#1a2818!important;border-color:var(--green)!important;color:var(--green)!important;}
  #auto-btn-1.active{background:#120d22!important;border-color:#9b5de5!important;color:#9b5de5!important;}
  .tag{font-family:var(--mono)!important;font-size:10px!important;letter-spacing:1px!important;border-radius:2px!important;}

  /* ── Zone dépôt (additive) ── */
  .file-drop-zone{border:1px dashed var(--border);border-radius:6px;padding:6px 10px;cursor:pointer;transition:border-color .15s,background .15s;text-align:center;margin:6px 10px;}
  .file-drop-zone:hover,.file-drop-zone.drag-over{border-color:var(--cyan-dim);background:#1e2230;}
  .file-drop-zone input[type=file]{display:none;}
  .fdz-row{display:flex;align-items:center;justify-content:center;gap:8px;}
  .fdz-icon{font-family:var(--mono);font-size:13px;color:var(--cyan-dim);}
  .fdz-text{font-family:var(--mono);font-size:10px;color:var(--txt-dim);letter-spacing:1px;}
  .fdz-count{font-family:var(--mono);font-size:9px;color:var(--cyan);}
  .fdz-add-badge{font-family:var(--mono);font-size:9px;color:var(--green);background:#141e10;border:1px solid var(--green-dk);border-radius:3px;padding:1px 6px;margin-left:4px;}

  /* ── Waveform IN/OUT ── */
  .wv-outer{padding:4px 6px 0;}
  .wv-wrap{
    position:relative;
    height:80px;
    cursor:crosshair;
    user-select:none;
    border-radius:3px;
  }
  .wv-canvas{display:block;width:100%;height:80px;border-radius:3px;}
  .wv-pre{position:absolute;top:0;bottom:0;left:0;background:rgba(0,0,0,.55);pointer-events:none;border-radius:3px 0 0 3px;}
  .wv-post{position:absolute;top:0;bottom:0;right:0;background:rgba(0,0,0,.55);pointer-events:none;border-radius:0 3px 3px 0;}
  .wv-playhead{position:absolute;top:0;bottom:0;width:2px;background:rgba(0,212,240,.9);pointer-events:none;display:none;z-index:2;}
  .wv-handle{
    position:absolute;top:0;bottom:0;
    width:4px;cursor:ew-resize;z-index:4;
    transform:translateX(-2px);
  }
  .wv-handle-in {background:#00d96a;}
  .wv-handle-out{background:#e03020;}
  .wv-handle::before{
    content:attr(data-label);
    position:absolute;
    bottom:calc(100% + 2px);left:50%;transform:translateX(-50%);
    font-family:var(--mono);font-size:8px;white-space:nowrap;
    padding:1px 4px;border-radius:2px;pointer-events:none;
  }
  .wv-handle-in::before {color:#00d96a;background:rgba(0,30,10,.9);}
  .wv-handle-out::before{color:#e03020;background:rgba(30,0,0,.9);}
  .wv-handle::after{content:'';position:absolute;top:0;bottom:0;left:-10px;right:-10px;}
  .wv-labels{display:flex;justify-content:space-between;margin-top:3px;padding:0 2px;}
  .wv-label{font-family:var(--mono);font-size:8px;color:var(--txt-mute);}
  .wv-label.in-lbl{color:var(--green);}
  .wv-label.out-lbl{color:var(--red);}
  /* Indicateur zoom actif */
  .wv-wrap.zoomed .wv-canvas{border:1px solid rgba(0,212,240,.3);}
  /* Bouton ouvrir éditeur */
  .wv-edit-btn{
    position:absolute;bottom:4px;right:4px;z-index:6;
    background:rgba(6,11,24,.8);border:1px solid var(--border);
    color:var(--txt-mute);font-family:var(--mono);font-size:8px;
    padding:1px 6px;border-radius:2px;cursor:pointer;letter-spacing:1px;
    transition:all .12s;
  }
  .wv-edit-btn:hover{border-color:var(--cyan);color:var(--cyan);}

  /* ── Modal éditeur waveform — style broadcast ── */
  .wv-modal-overlay{
    display:none;position:fixed;inset:0;
    background:rgba(0,0,16,.92);
    z-index:2000;align-items:center;justify-content:center;
  }
  .wv-modal-overlay.open{display:flex;}

  .wv-modal{
    background:#03050f;
    border:3px solid #1a3a9a;
    border-radius:10px;
    width:min(780px,96vw);
    box-shadow:0 0 40px rgba(0,60,255,.25), inset 0 0 80px rgba(0,10,40,.8);
    overflow:hidden;
    font-family:'Share Tech Mono',monospace;
  }

  /* Barre titre broadcast */
  .wvm-titlebar{
    background:#1c1e26;
    border-bottom:2px solid #1a3a9a;
    padding:5px 14px;
    display:flex; align-items:center; justify-content:space-between;
  }
  .wvm-ver{font-size:10px;color:#4a6aaa;letter-spacing:1px;}
  .wvm-trackname{
    font-family:'Oswald',sans-serif;font-size:15px;font-weight:700;
    color:#00d4f0;letter-spacing:2px;text-align:center;flex:1;
    text-transform:uppercase; overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    padding:0 1rem;
  }
  .wvm-close{
    background:transparent;border:1px solid #3a1010;color:#e03020;
    font-family:'Share Tech Mono',monospace;font-size:10px;padding:2px 8px;
    border-radius:2px;cursor:pointer;letter-spacing:1px;transition:all .12s;
  }
  .wvm-close:hover{background:#2a0000;}

  /* Écran waveform */
  .wvm-screen{
    background:#000;
    border-bottom:2px solid #0a1a40;
    position:relative;
  }
  .wvm-canvas-main{display:block;width:100%;height:180px;}
  .wvm-pre{position:absolute;top:0;bottom:0;left:0;background:rgba(0,0,0,.6);pointer-events:none;}
  .wvm-post{position:absolute;top:0;bottom:0;right:0;background:rgba(0,0,0,.6);pointer-events:none;}
  .wvm-ph{position:absolute;top:0;bottom:0;width:2px;background:rgba(255,255,100,.9);pointer-events:none;z-index:3;}
  .wvm-handle{
    position:absolute;top:0;bottom:0;width:3px;cursor:ew-resize;z-index:4;
  }
  .wvm-handle::after{content:'';position:absolute;top:0;bottom:0;left:-14px;right:-14px;}
  .wvm-handle-in{background:#00ff60;}
  .wvm-handle-out{background:#ff2020;}
  /* Timecode flags sur les poignées */
  .wvm-handle-in::before{
    content:attr(data-tc);
    position:absolute;bottom:4px;left:6px;
    font-size:9px;color:#00ff60;background:rgba(0,20,0,.85);
    padding:1px 5px;border-radius:2px;white-space:nowrap;pointer-events:none;
  }
  .wvm-handle-out::before{
    content:attr(data-tc);
    position:absolute;bottom:4px;right:6px;left:auto;
    font-size:9px;color:#ff2020;background:rgba(20,0,0,.85);
    padding:1px 5px;border-radius:2px;white-space:nowrap;pointer-events:none;
  }

  /* Bande de timecodes */
  .wvm-timecodes{
    background:#1c1e26;border-bottom:2px solid #0a1a40;
    display:grid;grid-template-columns:repeat(6,1fr);
    padding:4px 8px;gap:4px;
  }
  .wvm-tc-cell{display:flex;flex-direction:column;align-items:center;gap:1px;}
  .wvm-tc-label{font-size:7px;color:#2a4a8a;letter-spacing:2px;text-transform:uppercase;}
  .wvm-tc-value{font-size:13px;letter-spacing:1px;font-family:'Share Tech Mono',monospace;}

  /* VU horizontal L/R */
  .wvm-vu-section{
    background:#030710;border-bottom:2px solid #0a1a40;
    padding:5px 10px;display:flex;flex-direction:column;gap:4px;
  }
  .wvm-vu-row{display:flex;align-items:center;gap:6px;}
  .wvm-vu-lbl{font-size:9px;color:#4a6aaa;width:10px;text-align:center;letter-spacing:0;}
  .wvm-vu-bar-wrap{
    flex:1;height:12px;background:#020510;
    border:1px solid #0a1a40;border-radius:1px;position:relative;overflow:hidden;
  }
  .wvm-vu-bar{height:100%;width:0%;transition:width .04s linear;border-radius:1px;}
  .wvm-vu-scale{
    display:flex;justify-content:space-between;
    padding:0 2px;margin-top:1px;
  }
  .wvm-vu-scale span{font-size:6px;color:#2a4060;letter-spacing:0;}
  .wvm-vu-threshold{position:absolute;top:0;bottom:0;width:2px;background:rgba(255,255,255,.15);pointer-events:none;}

  /* Barre du bas : overview + transport */
  .wvm-bottom{
    background:#1c1e26;
    display:grid;grid-template-columns:100px 1fr 110px;
    gap:0;
  }
  /* Format / cues */
  .wvm-cues-panel{
    border-right:2px solid #0a1a40;
    padding:8px 10px;display:flex;flex-direction:column;gap:5px;
    justify-content:center;
  }
  .wvm-cue-row{display:flex;align-items:center;gap:5px;}
  .wvm-cue-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
  .wvm-cue-input{
    background:#020510;border:1px solid #384058;color:#ddeeff;
    font-family:'Share Tech Mono',monospace;font-size:11px;
    padding:2px 6px;border-radius:2px;outline:none;width:76px;text-align:center;
  }
  .wvm-cue-input.in{border-color:#00ff60;color:#00ff60;}
  .wvm-cue-input.out{border-color:#ff2020;color:#ff2020;}
  .wvm-cue-input:focus{background:#030a14;}

  /* Transport */
  .wvm-transport{
    border-right:2px solid #0a1a40;
    padding:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
  }
  .wvm-transport-row{display:flex;gap:5px;}
  .wvm-tbtn{
    width:34px;height:28px;
    background:linear-gradient(180deg,#1a2a6a,#0a1440);
    border:1px solid #2a4a9a;
    border-radius:4px;cursor:pointer;
    display:flex;align-items:center;justify-content:center;
    font-size:13px;color:#8ab0ff;
    transition:all .1s;position:relative;
  }
  .wvm-tbtn:hover{background:linear-gradient(180deg,#2a3a8a,#1a2450);border-color:#4a6abb;}
  .wvm-tbtn:active{background:#0a1030;transform:scale(.95);}
  .wvm-tbtn.red{background:linear-gradient(180deg,#6a1010,#3a0808);border-color:#9a2020;color:#ff6060;}
  .wvm-tbtn.red:hover{background:linear-gradient(180deg,#8a1a1a,#5a1010);}
  .wvm-tbtn.green{background:linear-gradient(180deg,#0a4a1a,#052810);border-color:#2a7038;color:#60ff90;}
  .wvm-tbtn.green:hover{background:linear-gradient(180deg,#1a5a2a,#0a3820);}
  .wvm-tbtn.active-btn{background:linear-gradient(180deg,#3a5a1a,#1a3008);border-color:#6aaa30;color:#aaff50;}

  /* OPTIONS */
  .wvm-options{
    padding:6px 8px;display:flex;flex-direction:column;gap:3px;justify-content:center;
  }
  .wvm-opt-title{font-size:7px;color:#2a4a8a;letter-spacing:2px;margin-bottom:2px;}
  .wvm-opt-grid{display:grid;grid-template-columns:1fr 1fr;gap:3px;}
  .wvm-opt-btn{
    font-size:8px;padding:3px 4px;text-align:center;
    background:#030810;border:1px solid #0a1a40;border-radius:2px;
    color:#2a4a8a;cursor:pointer;letter-spacing:1px;transition:all .12s;
  }
  .wvm-opt-btn:hover{border-color:#4a6aaa;color:#8ab0ff;}
  .wvm-opt-btn.active{border-color:#00d4f0;color:#00d4f0;background:#020a14;}

  /* Overview */
  .wvm-overview-wrap{position:relative;height:36px;background:#000;border-top:1px solid #0a1a40;}
  .wvm-overview-canvas{display:block;width:100%;height:36px;}
  .wvm-overview-region{position:absolute;top:0;bottom:0;background:rgba(0,120,220,.15);border:1px solid rgba(0,180,255,.5);pointer-events:none;}


  /* ── VU Mètre ── */
  /* ══ VU Section sticky ══ */
  .vu-section{
    background:#14161c;
    border-top:2px solid var(--border);
    padding:.4rem 1rem;
    flex-shrink:0;
    z-index:10;
  }

  /* Grille : col gauche (diffuseurs) + col droite (départs) */
  .vu-grid{
    display:grid;
    grid-template-columns: 1fr 1fr;
    gap:.75rem;
  }
  .vu-group{
    display:flex;
    flex-direction:column;
    gap:.3rem;
  }
  .vu-group-label{
    font-family:var(--mono);font-size:7px;color:var(--txt-mute);
    letter-spacing:3px;text-transform:uppercase;margin-bottom:2px;
  }
  .vu-row-wrap{display:flex;gap:.5rem;}

  /* Card VU — diffuseurs (compacts, hauteur commune) */
  .vu-wrap{
    background:var(--s1);border:1px solid var(--border);border-radius:6px;
    padding:.5rem .75rem;
    display:flex;align-items:stretch;gap:.75rem;
    flex:1;
  }
  /* Card VU — départs (plus grands) */
  .vu-wrap.vu-depart{
    background:#16181e;
    border-color:#384058;
    border-radius:6px;
    padding:.6rem 1rem;
    gap:1rem;
  }

  .vu-label-block{display:flex;flex-direction:column;justify-content:space-between;min-width:44px;}
  .vu-main-title{
    font-family:var(--mono);font-size:9px;color:var(--txt-dim);
    letter-spacing:2px;text-transform:uppercase;
  }
  .vu-wrap.vu-depart .vu-main-title{
    font-size:10px;color:var(--cyan);letter-spacing:3px;
  }
  .vu-db-group{display:flex;flex-direction:column;}
  .vu-db-val{font-family:var(--mono);font-size:16px;color:var(--cyan);letter-spacing:1px;line-height:1;}
  .vu-wrap.vu-depart .vu-db-val{font-size:20px;}
  .vu-db-unit{font-family:var(--mono);font-size:8px;color:var(--txt-mute);margin-top:1px;}

  /* Barres verticales — hauteur unifiée */
  .vu-channel-v{display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;max-width:60px;}
  .vu-wrap.vu-depart .vu-channel-v{max-width:80px;}
  .vu-ch-label{font-family:var(--mono);font-size:8px;color:var(--txt-mute);letter-spacing:1px;}
  .vu-meter-v{display:flex;flex-direction:column-reverse;gap:1px;width:100%;height:80px;}
  .vu-wrap.vu-depart .vu-meter-v{height:100px;}
  .vu-row{flex:1;border-radius:1px;min-height:2px;transition:opacity .05s ease-out;}
  .vu-scale-v{display:flex;flex-direction:column;justify-content:space-between;height:80px;padding:2px 0;}
  .vu-wrap.vu-depart .vu-scale-v{height:100px;}
  .vu-scale-v span{font-family:var(--mono);font-size:7px;color:var(--txt-mute);text-align:right;line-height:1;}


  /* Zone de drop dans les playlists */
  .table.is-radio tbody.drag-over-active { outline:2px dashed var(--yellow); outline-offset:-2px; }


  /* ── Macros CSS (déjà existant, complété) ── */
  /* ── VU strip latéral sur chaque diffuseur ── */
  .card.is-dark-card { position:relative; }
  .vu-strip {
    position:absolute; top:0; right:-9px; bottom:0;
    width:7px; border-radius:0 4px 4px 0;
    display:flex; flex-direction:column-reverse; gap:1px;
    padding:2px 0; overflow:hidden; z-index:5;
    background:rgba(6,11,22,.9);
    border:1px solid var(--border); border-left:none;
  }
  .vu-strip-bar {
    width:100%; border-radius:1px;
    min-height:2px; flex:1;
    opacity:0.08; transition:opacity .05s ease-out;
  }


  #c2-progress::-moz-progress-bar      { background: #9b5de5 !important; }

  /* Cards avec position relative pour popup */
  .card.is-dark-card { position: relative; }

  /* ── Journal de modulation ── */
  .mod-journal{
    background:#12141a;
    border-top:1px solid #282e3a;
    padding:.5rem 1rem;
    max-height:120px;
    overflow-y:auto;
    scroll-behavior:smooth;
  }
  .mod-journal::-webkit-scrollbar{width:4px;}
  .mod-journal::-webkit-scrollbar-track{background:#12141a;}
  .mod-journal::-webkit-scrollbar-thumb{background:#38404e;border-radius:2px;}
  .mod-journal-empty{
    font-family:var(--mono);font-size:9px;color:#2a3a50;
    letter-spacing:2px;padding:4px 0;
  }
  .mod-journal-line{
    display:flex;align-items:center;gap:8px;
    padding:2px 0;border-bottom:1px solid #0a1020;
    font-family:var(--mono);font-size:10px;letter-spacing:.5px;
  }
  .mod-journal-line:last-child{border-bottom:none;}
  .mod-journal-dot{
    width:7px;height:7px;border-radius:50%;flex-shrink:0;
  }
  .mod-journal-line.absence .mod-journal-dot{background:#e03020;box-shadow:0 0 4px rgba(220,30,20,.6);}
  .mod-journal-line.reprise  .mod-journal-dot{background:#00d96a;box-shadow:0 0 4px rgba(0,217,106,.6);}
  .mod-journal-line.absence .mod-journal-txt{color:#ff6060;}
  .mod-journal-line.reprise  .mod-journal-txt{color:#00d96a;}
  .mod-journal-line .mod-journal-time{color:#5a6880;font-size:9px;flex-shrink:0;}

  /* ── Liste PR rows ── */
  .pr-del{background:none;border:none;color:#3a4050;cursor:pointer;font-size:12px;padding:0;text-align:center;transition:color .1s;}
  .pr-del:hover{color:var(--red);}


  /* ══ CARTWALL ══ */
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DIFF SECOURS</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css">
<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Oswald:wght@600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --mono:'Share Tech Mono',monospace; --display:'Oswald',sans-serif;
    /* ── Gris dominants ── */
    --bg:#16181e;        /* fond principal */
    --s1:#1e2028;        /* panneaux */
    --s2:#252830;        /* headers */
    --s3:#1a1c22;        /* sous-headers */
    --border:#38404e;    /* bordures */
    /* ── Accents ── */
    --cyan:#ffffff;      --cyan-dim:#aab8c8;
    --green:#00c85a;     --green-dk:#005828;
    --yellow:#e8b800;    --orange:#e07000;
    --red:#d42818;
    /* ── Textes ── */
    --txt:#e8ecf4;       --txt-dim:#8090a8;    --txt-mute:#4a5468;
  }
  html{height:100%;overflow:hidden;background:var(--bg)!important;}
  body{display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)!important;margin:0;}
  .section.is-console{padding:0;background:var(--bg);flex:1;display:flex;flex-direction:column;min-height:0;}
  .card.is-dark-card{background:var(--s1);border:1px solid var(--border);border-radius:0;box-shadow:none;flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;}
  .card.is-dark-card .card-header{background:var(--s2);border-bottom:1px solid var(--border);box-shadow:none;border-radius:0;flex-shrink:0;}
  .card.is-dark-card .card-header-title{color:var(--txt);font-family:var(--display);font-size:15px;letter-spacing:1px;padding:.6rem 1rem;}
  .card.is-dark-card .card-content{padding:0;flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;}
  .card.is-dark-card .card-footer{background:var(--s3);border-top:1px solid var(--border);border-radius:0;padding:.4rem 1rem;gap:1rem;flex-shrink:0;}
  .card.is-dark-card .card-footer-item{color:var(--txt-dim);font-family:var(--mono);font-size:11px;border:none;padding:0;justify-content:flex-start;}
  .diff-badge{font-family:var(--mono);font-size:11px;font-weight:700;letter-spacing:2px;padding:2px 10px;border-radius:4px;}
  .notification.is-onair{background:var(--s2);border:1px solid var(--border);border-top:none;border-radius:0;padding:.4rem 1rem;margin:0;display:flex;align-items:center;justify-content:space-between;transition:background .2s,border-color .2s;flex-shrink:0;}

  /* ── État EN DIRECT — rouge sur TOUT le module ── */
  .card.is-dark-card.is-live-card { border-color:#6a1010 !important; }
  .diff-card-header.is-live{
    background:linear-gradient(90deg,#2e0808 0%,#220606 100%) !important;
    border-bottom-color:#7a1010 !important;
    transition:background .3s,border-color .3s;
  }
  .diff-card-header.is-live .diff-badge{background:#5a0000!important;color:#ff6060!important;border-color:#991818!important;box-shadow:0 0 8px rgba(200,30,30,.4);}
  .diff-onair-bar.is-live{
    background:linear-gradient(90deg,#2e0808 0%,#200606 100%) !important;
    border-color:#6a1010 !important;
  }
  .diff-onair-bar.is-live .onair-title{color:#ff5050!important;}
  .diff-onair-bar.is-live .dot-live{background:#ff3030!important;box-shadow:0 0 6px #ff3030,0 0 12px rgba(255,30,30,.6)!important;animation:live-pulse .8s ease-in-out infinite!important;}
  /* Zone PAZ rouge */
  #paz.is-playing { background:linear-gradient(180deg,#1a0404 0%,#120202 100%) !important; }
  /* Progress bar rouge */
  .progress.is-elapsed.is-live { background:#3a0808 !important; }
  .progress.is-elapsed.is-live::-webkit-progress-value { background:#d42818 !important; }
  .progress.is-elapsed.is-live::-moz-progress-bar { background:#d42818 !important; }
  @keyframes live-pulse{0%,100%{opacity:1;box-shadow:0 0 6px #ff3030,0 0 14px rgba(255,30,30,.5);}50%{opacity:.6;box-shadow:0 0 3px #ff3030;}}
  .onair-title{font-family:var(--display);font-size:22px;font-weight:700;color:var(--txt);letter-spacing:3px;}
  .onair-track-name{font-family:var(--display);font-size:16px;font-weight:700;letter-spacing:2px;color:var(--yellow);margin-left:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:320px;transition:opacity .3s;}
  .dot-live{display:inline-block;width:8px;height:8px;background:var(--red);border-radius:50%;animation:blink 1s step-start infinite;vertical-align:middle;margin-right:6px;}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
  /* ══ MODULATION ══ */
  .mod-chan-card{background:var(--s1);border:1px solid var(--border);border-radius:6px;padding:10px;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;transition:border-color .15s,background .12s;user-select:none;}
  .mod-chan-card:hover{background:var(--s2);border-color:var(--txt-mute);}
  .mod-chan-card.selected{border-color:#9b6de5!important;background:#1a1428!important;}
  .mod-chan-header{font-family:var(--mono);font-size:10px;letter-spacing:2px;color:var(--txt-mute);font-weight:700;}
  .mod-vu-wrap{display:flex;gap:3px;height:60px;align-items:flex-end;}
  .mod-vu-wrap.mod-vu-mini{height:36px;}
  .mod-vu-bar-wrap{width:10px;height:100%;background:#0a0c10;border-radius:2px;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;}
  .mod-vu-bar{width:100%;height:0%;background:linear-gradient(to top,#00c85a 0%,#e8b800 75%,#d42818 100%);border-radius:2px;transition:height .05s;}
  .mod-chan-db{font-family:var(--mono);font-size:9px;color:var(--txt-mute);}
  .mod-chan-info{font-family:var(--mono);font-size:8px;color:#4a3a70;letter-spacing:1px;}
  .mod-cart-card{padding:6px;}
  /* DSP Editor */
  .mod-dsp-block{background:var(--s2);border-radius:5px;padding:12px;display:flex;flex-direction:column;gap:8px;}
  .mod-dsp-label{font-family:var(--mono);font-size:8px;color:#9b6de5;letter-spacing:3px;font-weight:700;}
  .mod-dsp-row{display:flex;align-items:center;gap:8px;}
  .mod-dsp-name{font-family:var(--mono);font-size:9px;color:var(--txt-mute);width:56px;flex-shrink:0;}
  .mod-dsp-slider{flex:1;height:3px;accent-color:#9b6de5;cursor:pointer;}
  .mod-dsp-val{font-family:var(--mono);font-size:9px;color:var(--txt);width:52px;text-align:right;flex-shrink:0;}
  .mod-bypass-btn{font-family:var(--mono);font-size:8px;padding:3px 8px;background:transparent;border:1px solid var(--border);color:var(--txt-mute);border-radius:3px;cursor:pointer;letter-spacing:1px;transition:all .12s;}
  .mod-bypass-btn.active{background:#1a0a30;border-color:#9b6de5;color:#9b6de5;}
  @keyframes vu-anim{to{height:0%;}}
  .table.is-radio{background:transparent;width:100%;}
  .table.is-radio thead th{background:var(--s3);color:var(--txt-mute);font-family:var(--mono);font-size:9px;letter-spacing:1px;text-transform:uppercase;border-color:var(--border)!important;padding:6px 10px;font-weight:400;}
  .table.is-radio tbody tr{border-bottom:1px solid var(--border);cursor:pointer;position:relative;overflow:hidden;}
  .table.is-radio tbody tr:hover td{background:#22252d;}
  .table.is-radio tbody td{border-color:var(--border)!important;color:var(--txt-dim);padding:0 10px;height:56px;vertical-align:middle;white-space:nowrap;}

  /* ── Ligne active : grande, waveform en fond ── */
  .table.is-radio tbody tr.row-active{
    background:#080a10;
    border-left:3px solid var(--red);
    border-top:1px solid #3a0808;
    border-bottom:1px solid #3a0808;
  }
  .table.is-radio tbody tr.row-active td{
    position:relative;z-index:2;
    height:96px; /* plus haute */
    vertical-align:middle;
  }
  /* Fond de progression rouge */
  .table.is-radio tbody tr.row-active::before{
    content:'';position:absolute;inset:0;
    background:linear-gradient(90deg,rgba(60,5,5,.9) 0%,rgba(30,3,3,.7) 100%);
    z-index:0;transform-origin:left;transform:scaleX(var(--prog,0));
    transition:transform .1s linear;
  }
  /* Waveform fond : canvas positionné en absolu z-index:1 */
  .row-active-wv-bg{
    position:absolute;inset:0;z-index:1;
    width:100%;height:100%;
    opacity:0.55;object-fit:fill;pointer-events:none;
    display:block;
  }
  /* Titre en gros sur la ligne active */
  .row-active-title{
    font-family:var(--display);
    font-size:22px;font-weight:700;
    color:#ffffff;letter-spacing:2px;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    text-shadow:0 1px 8px rgba(0,0,0,.8);
    position:relative;z-index:3;
  }
  /* Timecode à droite sur ligne active */
  .row-active-tc{
    font-family:var(--mono);
    font-size:13px;color:#ff4040;
    letter-spacing:1px;font-weight:700;
    position:relative;z-index:3;
  }
  /* Durée sur ligne active */
  .row-active-dur{
    font-family:var(--mono);font-size:11px;
    color:#7a9ab8;position:relative;z-index:3;
  }
  /* Horaire sur ligne active */
  .row-active-time{
    font-family:var(--mono);font-size:11px;
    color:var(--cyan-dim);position:relative;z-index:3;
  }
  /* IN/OUT labels sous le titre sur ligne active */
  .row-active-cues{
    font-family:var(--mono);font-size:8px;
    color:rgba(0,212,240,.6);letter-spacing:1px;
    position:relative;z-index:3;margin-top:2px;
  }

  .table.is-radio tbody tr.row-next{background:#141a12;border-left:3px solid var(--green-dk);}
  .cell-num{width:36px;font-family:var(--mono);font-size:12px;text-align:center;}
  .cell-num.is-playing{color:var(--red)!important;}
  .cell-time{width:80px;font-family:var(--mono);font-size:11px;color:var(--cyan-dim)!important;}
  .cell-sub{font-size:9px;color:var(--txt-mute)!important;display:block;}
  .cell-title{min-width:120px;max-width:160px;}
  .cell-simple{font-size:12px;color:#7a98b8!important;overflow:hidden;text-overflow:ellipsis;display:block;max-width:150px;}
  .row-active .cell-simple{color:#ff6060!important;}
  .row-active .cell-num{color:#ff4040!important;}
  .row-next .cell-simple{color:#40d870!important;}
  .row-next .cell-cd{color:#40d870!important;}
  .cell-dur{width:64px;font-family:var(--mono);font-size:11px;text-align:right;}
  .cell-cd{width:84px;font-family:var(--mono);font-size:12px;text-align:right;padding-right:10px!important;}
  .cell-wv{padding:4px 8px!important;vertical-align:middle!important;}
  .cell-bar{width:5px;padding:0!important;}
  .color-bar{height:56px;width:5px;display:block;}
  .progress.is-elapsed{height:3px;margin:0;border-radius:0;background:var(--border);}
  .progress.is-elapsed::-webkit-progress-value{background:var(--red);transition:width .1s linear;}
  .progress.is-elapsed::-moz-progress-bar{background:var(--red);}
  .console-sep{height:24px;background:#14161c;border-top:1px solid #0d1830;border-bottom:1px solid #0d1830;display:flex;align-items:center;padding:0 1rem;gap:1rem;}
  .sep-line{flex:1;height:1px;background:var(--s2);}
  .sep-label{font-family:var(--mono);font-size:9px;color:var(--txt-mute);letter-spacing:3px;}
  .columns.is-console{margin:0;}
  .columns.is-console .column{padding:0;}
  .button{font-family:var(--mono)!important;font-size:11px!important;letter-spacing:1px!important;border-radius:2px!important;}
  .button.is-dark{background:transparent!important;border-color:var(--border)!important;color:var(--txt-dim)!important;}
  .button.is-dark:hover{border-color:var(--cyan-dim)!important;color:var(--txt)!important;}
  .button.is-success{background:transparent!important;border-color:var(--green)!important;color:var(--green)!important;}
  .button.is-success:hover{background:#141e10!important;}
  .button.is-danger{background:transparent!important;border-color:var(--red)!important;color:var(--red)!important;}
  .button.is-danger:hover{background:#2a1010!important;}
  .button.is-auto{background:transparent!important;border-color:var(--border)!important;color:var(--txt-dim)!important;transition:all .15s!important;}
  .button.is-auto.active{background:#1a2818!important;border-color:var(--green)!important;color:var(--green)!important;}
  #auto-btn-1.active{background:#120d22!important;border-color:#9b5de5!important;color:#9b5de5!important;}
  .tag{font-family:var(--mono)!important;font-size:10px!important;letter-spacing:1px!important;border-radius:2px!important;}

  /* ── Zone dépôt (additive) ── */
  .file-drop-zone{border:1px dashed var(--border);border-radius:6px;padding:6px 10px;cursor:pointer;transition:border-color .15s,background .15s;text-align:center;margin:6px 10px;}
  .file-drop-zone:hover,.file-drop-zone.drag-over{border-color:var(--cyan-dim);background:#1e2230;}
  .file-drop-zone input[type=file]{display:none;}
  .fdz-row{display:flex;align-items:center;justify-content:center;gap:8px;}
  .fdz-icon{font-family:var(--mono);font-size:13px;color:var(--cyan-dim);}
  .fdz-text{font-family:var(--mono);font-size:10px;color:var(--txt-dim);letter-spacing:1px;}
  .fdz-count{font-family:var(--mono);font-size:9px;color:var(--cyan);}
  .fdz-add-badge{font-family:var(--mono);font-size:9px;color:var(--green);background:#141e10;border:1px solid var(--green-dk);border-radius:3px;padding:1px 6px;margin-left:4px;}

  /* ── Waveform IN/OUT ── */
  .wv-outer{padding:4px 6px 0;}
  .wv-wrap{
    position:relative;
    height:80px;
    cursor:crosshair;
    user-select:none;
    border-radius:3px;
  }
  .wv-canvas{display:block;width:100%;height:80px;border-radius:3px;}
  .wv-pre{position:absolute;top:0;bottom:0;left:0;background:rgba(0,0,0,.55);pointer-events:none;border-radius:3px 0 0 3px;}
  .wv-post{position:absolute;top:0;bottom:0;right:0;background:rgba(0,0,0,.55);pointer-events:none;border-radius:0 3px 3px 0;}
  .wv-playhead{position:absolute;top:0;bottom:0;width:2px;background:rgba(0,212,240,.9);pointer-events:none;display:none;z-index:2;}
  .wv-handle{
    position:absolute;top:0;bottom:0;
    width:4px;cursor:ew-resize;z-index:4;
    transform:translateX(-2px);
  }
  .wv-handle-in {background:#00d96a;}
  .wv-handle-out{background:#e03020;}
  .wv-handle::before{
    content:attr(data-label);
    position:absolute;
    bottom:calc(100% + 2px);left:50%;transform:translateX(-50%);
    font-family:var(--mono);font-size:8px;white-space:nowrap;
    padding:1px 4px;border-radius:2px;pointer-events:none;
  }
  .wv-handle-in::before {color:#00d96a;background:rgba(0,30,10,.9);}
  .wv-handle-out::before{color:#e03020;background:rgba(30,0,0,.9);}
  .wv-handle::after{content:'';position:absolute;top:0;bottom:0;left:-10px;right:-10px;}
  .wv-labels{display:flex;justify-content:space-between;margin-top:3px;padding:0 2px;}
  .wv-label{font-family:var(--mono);font-size:8px;color:var(--txt-mute);}
  .wv-label.in-lbl{color:var(--green);}
  .wv-label.out-lbl{color:var(--red);}
  /* Indicateur zoom actif */
  .wv-wrap.zoomed .wv-canvas{border:1px solid rgba(0,212,240,.3);}
  /* Bouton ouvrir éditeur */
  .wv-edit-btn{
    position:absolute;bottom:4px;right:4px;z-index:6;
    background:rgba(6,11,24,.8);border:1px solid var(--border);
    color:var(--txt-mute);font-family:var(--mono);font-size:8px;
    padding:1px 6px;border-radius:2px;cursor:pointer;letter-spacing:1px;
    transition:all .12s;
  }
  .wv-edit-btn:hover{border-color:var(--cyan);color:var(--cyan);}

  /* ── Modal éditeur waveform — style broadcast ── */
  .wv-modal-overlay{
    display:none;position:fixed;inset:0;
    background:rgba(0,0,16,.92);
    z-index:2000;align-items:center;justify-content:center;
  }
  .wv-modal-overlay.open{display:flex;}

  .wv-modal{
    background:#03050f;
    border:3px solid #1a3a9a;
    border-radius:10px;
    width:min(780px,96vw);
    box-shadow:0 0 40px rgba(0,60,255,.25), inset 0 0 80px rgba(0,10,40,.8);
    overflow:hidden;
    font-family:'Share Tech Mono',monospace;
  }

  /* Barre titre broadcast */
  .wvm-titlebar{
    background:#1c1e26;
    border-bottom:2px solid #1a3a9a;
    padding:5px 14px;
    display:flex; align-items:center; justify-content:space-between;
  }
  .wvm-ver{font-size:10px;color:#4a6aaa;letter-spacing:1px;}
  .wvm-trackname{
    font-family:'Oswald',sans-serif;font-size:15px;font-weight:700;
    color:#00d4f0;letter-spacing:2px;text-align:center;flex:1;
    text-transform:uppercase; overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    padding:0 1rem;
  }
  .wvm-close{
    background:transparent;border:1px solid #3a1010;color:#e03020;
    font-family:'Share Tech Mono',monospace;font-size:10px;padding:2px 8px;
    border-radius:2px;cursor:pointer;letter-spacing:1px;transition:all .12s;
  }
  .wvm-close:hover{background:#2a0000;}

  /* Écran waveform */
  .wvm-screen{
    background:#000;
    border-bottom:2px solid #0a1a40;
    position:relative;
  }
  .wvm-canvas-main{display:block;width:100%;height:180px;}
  .wvm-pre{position:absolute;top:0;bottom:0;left:0;background:rgba(0,0,0,.6);pointer-events:none;}
  .wvm-post{position:absolute;top:0;bottom:0;right:0;background:rgba(0,0,0,.6);pointer-events:none;}
  .wvm-ph{position:absolute;top:0;bottom:0;width:2px;background:rgba(255,255,100,.9);pointer-events:none;z-index:3;}
  .wvm-handle{
    position:absolute;top:0;bottom:0;width:3px;cursor:ew-resize;z-index:4;
  }
  .wvm-handle::after{content:'';position:absolute;top:0;bottom:0;left:-14px;right:-14px;}
  .wvm-handle-in{background:#00ff60;}
  .wvm-handle-out{background:#ff2020;}
  /* Timecode flags sur les poignées */
  .wvm-handle-in::before{
    content:attr(data-tc);
    position:absolute;bottom:4px;left:6px;
    font-size:9px;color:#00ff60;background:rgba(0,20,0,.85);
    padding:1px 5px;border-radius:2px;white-space:nowrap;pointer-events:none;
  }
  .wvm-handle-out::before{
    content:attr(data-tc);
    position:absolute;bottom:4px;right:6px;left:auto;
    font-size:9px;color:#ff2020;background:rgba(20,0,0,.85);
    padding:1px 5px;border-radius:2px;white-space:nowrap;pointer-events:none;
  }

  /* Bande de timecodes */
  .wvm-timecodes{
    background:#1c1e26;border-bottom:2px solid #0a1a40;
    display:grid;grid-template-columns:repeat(6,1fr);
    padding:4px 8px;gap:4px;
  }
  .wvm-tc-cell{display:flex;flex-direction:column;align-items:center;gap:1px;}
  .wvm-tc-label{font-size:7px;color:#2a4a8a;letter-spacing:2px;text-transform:uppercase;}
  .wvm-tc-value{font-size:13px;letter-spacing:1px;font-family:'Share Tech Mono',monospace;}

  /* VU horizontal L/R */
  .wvm-vu-section{
    background:#030710;border-bottom:2px solid #0a1a40;
    padding:5px 10px;display:flex;flex-direction:column;gap:4px;
  }
  .wvm-vu-row{display:flex;align-items:center;gap:6px;}
  .wvm-vu-lbl{font-size:9px;color:#4a6aaa;width:10px;text-align:center;letter-spacing:0;}
  .wvm-vu-bar-wrap{
    flex:1;height:12px;background:#020510;
    border:1px solid #0a1a40;border-radius:1px;position:relative;overflow:hidden;
  }
  .wvm-vu-bar{height:100%;width:0%;transition:width .04s linear;border-radius:1px;}
  .wvm-vu-scale{
    display:flex;justify-content:space-between;
    padding:0 2px;margin-top:1px;
  }
  .wvm-vu-scale span{font-size:6px;color:#2a4060;letter-spacing:0;}
  .wvm-vu-threshold{position:absolute;top:0;bottom:0;width:2px;background:rgba(255,255,255,.15);pointer-events:none;}

  /* Barre du bas : overview + transport */
  .wvm-bottom{
    background:#1c1e26;
    display:grid;grid-template-columns:100px 1fr 110px;
    gap:0;
  }
  /* Format / cues */
  .wvm-cues-panel{
    border-right:2px solid #0a1a40;
    padding:8px 10px;display:flex;flex-direction:column;gap:5px;
    justify-content:center;
  }
  .wvm-cue-row{display:flex;align-items:center;gap:5px;}
  .wvm-cue-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
  .wvm-cue-input{
    background:#020510;border:1px solid #384058;color:#ddeeff;
    font-family:'Share Tech Mono',monospace;font-size:11px;
    padding:2px 6px;border-radius:2px;outline:none;width:76px;text-align:center;
  }
  .wvm-cue-input.in{border-color:#00ff60;color:#00ff60;}
  .wvm-cue-input.out{border-color:#ff2020;color:#ff2020;}
  .wvm-cue-input:focus{background:#030a14;}

  /* Transport */
  .wvm-transport{
    border-right:2px solid #0a1a40;
    padding:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
  }
  .wvm-transport-row{display:flex;gap:5px;}
  .wvm-tbtn{
    width:34px;height:28px;
    background:linear-gradient(180deg,#1a2a6a,#0a1440);
    border:1px solid #2a4a9a;
    border-radius:4px;cursor:pointer;
    display:flex;align-items:center;justify-content:center;
    font-size:13px;color:#8ab0ff;
    transition:all .1s;position:relative;
  }
  .wvm-tbtn:hover{background:linear-gradient(180deg,#2a3a8a,#1a2450);border-color:#4a6abb;}
  .wvm-tbtn:active{background:#0a1030;transform:scale(.95);}
  .wvm-tbtn.red{background:linear-gradient(180deg,#6a1010,#3a0808);border-color:#9a2020;color:#ff6060;}
  .wvm-tbtn.red:hover{background:linear-gradient(180deg,#8a1a1a,#5a1010);}
  .wvm-tbtn.green{background:linear-gradient(180deg,#0a4a1a,#052810);border-color:#2a7038;color:#60ff90;}
  .wvm-tbtn.green:hover{background:linear-gradient(180deg,#1a5a2a,#0a3820);}
  .wvm-tbtn.active-btn{background:linear-gradient(180deg,#3a5a1a,#1a3008);border-color:#6aaa30;color:#aaff50;}

  /* OPTIONS */
  .wvm-options{
    padding:6px 8px;display:flex;flex-direction:column;gap:3px;justify-content:center;
  }
  .wvm-opt-title{font-size:7px;color:#2a4a8a;letter-spacing:2px;margin-bottom:2px;}
  .wvm-opt-grid{display:grid;grid-template-columns:1fr 1fr;gap:3px;}
  .wvm-opt-btn{
    font-size:8px;padding:3px 4px;text-align:center;
    background:#030810;border:1px solid #0a1a40;border-radius:2px;
    color:#2a4a8a;cursor:pointer;letter-spacing:1px;transition:all .12s;
  }
  .wvm-opt-btn:hover{border-color:#4a6aaa;color:#8ab0ff;}
  .wvm-opt-btn.active{border-color:#00d4f0;color:#00d4f0;background:#020a14;}

  /* Overview */
  .wvm-overview-wrap{position:relative;height:36px;background:#000;border-top:1px solid #0a1a40;}
  .wvm-overview-canvas{display:block;width:100%;height:36px;}
  .wvm-overview-region{position:absolute;top:0;bottom:0;background:rgba(0,120,220,.15);border:1px solid rgba(0,180,255,.5);pointer-events:none;}


  /* ── VU Mètre ── */
  /* ══ VU Section sticky ══ */
  .vu-section{
    background:#14161c;
    border-top:2px solid var(--border);
    padding:.4rem 1rem;
    flex-shrink:0;
    z-index:10;
  }

  /* Grille : col gauche (diffuseurs) + col droite (départs) */
  .vu-grid{
    display:grid;
    grid-template-columns: 1fr 1fr;
    gap:.75rem;
  }
  .vu-group{
    display:flex;
    flex-direction:column;
    gap:.3rem;
  }
  .vu-group-label{
    font-family:var(--mono);font-size:7px;color:var(--txt-mute);
    letter-spacing:3px;text-transform:uppercase;margin-bottom:2px;
  }
  .vu-row-wrap{display:flex;gap:.5rem;}

  /* Card VU — diffuseurs (compacts, hauteur commune) */
  .vu-wrap{
    background:var(--s1);border:1px solid var(--border);border-radius:6px;
    padding:.5rem .75rem;
    display:flex;align-items:stretch;gap:.75rem;
    flex:1;
  }
  /* Card VU — départs (plus grands) */
  .vu-wrap.vu-depart{
    background:#16181e;
    border-color:#384058;
    border-radius:6px;
    padding:.6rem 1rem;
    gap:1rem;
  }

  .vu-label-block{display:flex;flex-direction:column;justify-content:space-between;min-width:44px;}
  .vu-main-title{
    font-family:var(--mono);font-size:9px;color:var(--txt-dim);
    letter-spacing:2px;text-transform:uppercase;
  }
  .vu-wrap.vu-depart .vu-main-title{
    font-size:10px;color:var(--cyan);letter-spacing:3px;
  }
  .vu-db-group{display:flex;flex-direction:column;}
  .vu-db-val{font-family:var(--mono);font-size:16px;color:var(--cyan);letter-spacing:1px;line-height:1;}
  .vu-wrap.vu-depart .vu-db-val{font-size:20px;}
  .vu-db-unit{font-family:var(--mono);font-size:8px;color:var(--txt-mute);margin-top:1px;}

  /* Barres verticales — hauteur unifiée */
  .vu-channel-v{display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;max-width:60px;}
  .vu-wrap.vu-depart .vu-channel-v{max-width:80px;}
  .vu-ch-label{font-family:var(--mono);font-size:8px;color:var(--txt-mute);letter-spacing:1px;}
  .vu-meter-v{display:flex;flex-direction:column-reverse;gap:1px;width:100%;height:80px;}
  .vu-wrap.vu-depart .vu-meter-v{height:100px;}
  .vu-row{flex:1;border-radius:1px;min-height:2px;transition:opacity .05s ease-out;}
  .vu-scale-v{display:flex;flex-direction:column;justify-content:space-between;height:80px;padding:2px 0;}
  .vu-wrap.vu-depart .vu-scale-v{height:100px;}
  .vu-scale-v span{font-family:var(--mono);font-size:7px;color:var(--txt-mute);text-align:right;line-height:1;}


  /* Zone de drop dans les playlists */
  .table.is-radio tbody.drag-over-active { outline:2px dashed var(--yellow); outline-offset:-2px; }


  /* ── Macros CSS (déjà existant, complété) ── */
  /* ── VU strip latéral sur chaque diffuseur ── */
  .card.is-dark-card { position:relative; }
  .vu-strip {
    position:absolute; top:0; right:-9px; bottom:0;
    width:7px; border-radius:0 4px 4px 0;
    display:flex; flex-direction:column-reverse; gap:1px;
    padding:2px 0; overflow:hidden; z-index:5;
    background:rgba(6,11,22,.9);
    border:1px solid var(--border); border-left:none;
  }
  .vu-strip-bar {
    width:100%; border-radius:1px;
    min-height:2px; flex:1;
    opacity:0.08; transition:opacity .05s ease-out;
  }


  #c2-progress::-moz-progress-bar      { background: #9b5de5 !important; }

  /* Cards avec position relative pour popup */
  .card.is-dark-card { position: relative; }

  /* ── Journal de modulation ── */
  .mod-journal{
    background:#12141a;
    border-top:1px solid #282e3a;
    padding:.5rem 1rem;
    max-height:120px;
    overflow-y:auto;
    scroll-behavior:smooth;
  }
  .mod-journal::-webkit-scrollbar{width:4px;}
  .mod-journal::-webkit-scrollbar-track{background:#12141a;}
  .mod-journal::-webkit-scrollbar-thumb{background:#38404e;border-radius:2px;}
  .mod-journal-empty{
    font-family:var(--mono);font-size:9px;color:#2a3a50;
    letter-spacing:2px;padding:4px 0;
  }
  .mod-journal-line{
    display:flex;align-items:center;gap:8px;
    padding:2px 0;border-bottom:1px solid #0a1020;
    font-family:var(--mono);font-size:10px;letter-spacing:.5px;
  }
  .mod-journal-line:last-child{border-bottom:none;}
  .mod-journal-dot{
    width:7px;height:7px;border-radius:50%;flex-shrink:0;
  }
  .mod-journal-line.absence .mod-journal-dot{background:#e03020;box-shadow:0 0 4px rgba(220,30,20,.6);}
  .mod-journal-line.reprise  .mod-journal-dot{background:#00d96a;box-shadow:0 0 4px rgba(0,217,106,.6);}
  .mod-journal-line.absence .mod-journal-txt{color:#ff6060;}
  .mod-journal-line.reprise  .mod-journal-txt{color:#00d96a;}
  .mod-journal-line .mod-journal-time{color:#5a6880;font-size:9px;flex-shrink:0;}

  /* ── Liste PR rows ── */
  .pr-del{background:none;border:none;color:#3a4050;cursor:pointer;font-size:12px;padding:0;text-align:center;transition:color .1s;}
  .pr-del:hover{color:var(--red);}


  /* ══ CARTWALL ══ */
</style>
</head>
<body>


<!-- ══ MODAL ÉDITEUR WAVEFORM ══ -->
<div class="wv-modal-overlay" id="wv-modal">
  <div class="wv-modal">

    <!-- Barre titre -->
    <div class="wvm-titlebar">
      <span class="wvm-ver">ÉDITEUR IN/OUT</span>
      <span class="wvm-trackname" id="wv-modal-title">—</span>
      <button class="wvm-close" onclick="wvModalClose()">✕</button>
    </div>

    <!-- Écran waveform -->
    <div class="wvm-screen" id="wv-modal-wrap">
      <canvas class="wvm-canvas-main" id="wv-modal-canvas" width="780" height="180"></canvas>
      <div class="wvm-pre"  id="wv-modal-pre"></div>
      <div class="wvm-post" id="wv-modal-post"></div>
      <div class="wvm-ph"   id="wv-modal-ph" style="display:none"></div>
      <div class="wvm-handle wvm-handle-in"  id="wv-modal-in"  data-tc="IN 00:00.0"></div>
      <div class="wvm-handle wvm-handle-out" id="wv-modal-out" data-tc="OUT 00:00.0"></div>
    </div>

    <!-- Timecodes row -->
    <div class="wvm-timecodes">
      <div class="wvm-tc-cell">
        <span class="wvm-tc-label">POSITION</span>
        <span class="wvm-tc-value" id="wvm-tc-pos" style="color:#f5c400">00:00:000</span>
      </div>
      <div class="wvm-tc-cell">
        <span class="wvm-tc-label">IN</span>
        <span class="wvm-tc-value" id="wvm-tc-in" style="color:#00ff60">00:00:000</span>
      </div>
      <div class="wvm-tc-cell">
        <span class="wvm-tc-label">OUT</span>
        <span class="wvm-tc-value" id="wvm-tc-out" style="color:#ff3030">00:00:000</span>
      </div>
      <div class="wvm-tc-cell">
        <span class="wvm-tc-label">DURÉE</span>
        <span class="wvm-tc-value" id="wvm-tc-dur" style="color:#ddeeff">00:00:000</span>
      </div>
      <div class="wvm-tc-cell">
        <span class="wvm-tc-label">RESTANT</span>
        <span class="wvm-tc-value" id="wvm-tc-rem" style="color:#f07800">00:00:000</span>
      </div>
      <div class="wvm-tc-cell">
        <span class="wvm-tc-label">TOTAL</span>
        <span class="wvm-tc-value" id="wvm-tc-total" style="color:#5a7090">00:00:000</span>
      </div>
    </div>

    <!-- VU-mètres L/R -->
    <div class="wvm-vu-section">
      <div class="wvm-vu-row">
        <span class="wvm-vu-lbl" style="color:#00d96a">L</span>
        <div class="wvm-vu-bar-wrap">
          <div class="wvm-vu-bar" id="wvm-vu-L" style="background:linear-gradient(90deg,#00d96a 0%,#f5c400 70%,#e03020 90%)"></div>
          <div class="wvm-vu-threshold" style="left:70%"></div>
          <div class="wvm-vu-threshold" style="left:85%"></div>
        </div>
      </div>
      <div class="wvm-vu-row">
        <span class="wvm-vu-lbl" style="color:#00d96a">R</span>
        <div class="wvm-vu-bar-wrap">
          <div class="wvm-vu-bar" id="wvm-vu-R" style="background:linear-gradient(90deg,#00d96a 0%,#f5c400 70%,#e03020 90%)"></div>
          <div class="wvm-vu-threshold" style="left:70%"></div>
          <div class="wvm-vu-threshold" style="left:85%"></div>
        </div>
      </div>
      <div class="wvm-vu-scale">
        <span>-50</span><span>-40</span><span>-30</span><span>-20</span>
        <span>LOOP</span><span>THRESHOLD</span><span>-18</span><span>-9</span><span>0</span>
      </div>
    </div>

    <!-- Bande du bas -->
    <div class="wvm-bottom">

      <!-- Cues IN/OUT -->
      <div class="wvm-cues-panel">
        <div class="wvm-cue-row">
          <div class="wvm-cue-dot" style="background:#00ff60"></div>
          <input class="wvm-cue-input in" id="wv-modal-in-input"  type="text" placeholder="0.000" title="IN en secondes" onchange="wvModalSetIn()">
        </div>
        <div class="wvm-cue-row">
          <div class="wvm-cue-dot" style="background:#ff2020"></div>
          <input class="wvm-cue-input out" id="wv-modal-out-input" type="text" placeholder="0.000" title="OUT en secondes" onchange="wvModalSetOut()">
        </div>
      </div>

      <!-- Transport -->
      <div class="wvm-transport">
        <div class="wvm-transport-row">
          <button class="wvm-tbtn red"   onclick="wvModalStop()"    title="STOP">■</button>
          <button class="wvm-tbtn"       onclick="wvModalGoIn()"    title="Aller au IN">|◀</button>
          <button class="wvm-tbtn green" id="wvm-play-btn" onclick="wvModalPlayPause()" title="PLAY">▶</button>
          <button class="wvm-tbtn"       onclick="wvModalGoOut()"   title="Aller au OUT">▶|</button>
          <button class="wvm-tbtn"       onclick="wvModalReset()"   title="Réinitialiser">↺</button>
        </div>
        <div class="wvm-transport-row">
          <button class="wvm-tbtn apply" onclick="wvModalApply()" title="Appliquer et fermer"
            style="width:auto;padding:0 10px;font-size:9px;letter-spacing:1px;color:#60ff90;border-color:#2a7038;background:linear-gradient(180deg,#0a4a1a,#052810)">
            ✓ APPLIQUER
          </button>
        </div>
      </div>

      <!-- Options -->
      <div class="wvm-options">
        <div class="wvm-opt-title">OPTIONS</div>
        <div class="wvm-opt-grid">
          <div class="wvm-opt-btn" onclick="this.classList.toggle('active')">INTRO</div>
          <div class="wvm-opt-btn" onclick="this.classList.toggle('active')">HOOK</div>
          <div class="wvm-opt-btn active" onclick="this.classList.toggle('active')">MACRO</div>
          <div class="wvm-opt-btn" onclick="this.classList.toggle('active')">PONT</div>
          <div class="wvm-opt-btn" onclick="this.classList.toggle('active')">REPÈRE</div>
          <div class="wvm-opt-btn" onclick="this.classList.toggle('active')">CHAIN</div>
          <div class="wvm-opt-btn" onclick="this.classList.toggle('active')">ÉVÈNEM.</div>
          <div class="wvm-opt-btn" onclick="this.classList.toggle('active')">FIN</div>
        </div>
      </div>

    </div><!-- /bottom -->

    <!-- Overview -->
    <div class="wvm-overview-wrap">
      <canvas class="wvm-overview-canvas" id="wv-modal-zoom" width="780" height="36"></canvas>
      <div class="wvm-overview-region" id="wv-modal-zoom-region"></div>
    </div>

  </div>
</div>

<section class="section is-console" style="padding:0;flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;">

<div class="card is-dark-card">
  <div class="card-header diff-card-header" id="diff-header-0" style="display:flex;align-items:stretch">
    <div style="display:flex;align-items:center;padding:0 1rem;border-right:1px solid #38404e">
      <span class="tag diff-badge" style="background:#1a2a00;color:#f5c400;border:1px solid #3a4a00">DIFF SECOURS</span>
    </div>
  </div>
  <div class="notification is-onair diff-onair-bar" id="diff-onair-0">
    <div style="display:flex;align-items:center;gap:10px">
      <span class="dot-live"></span><span class="onair-title">DIFF SECOURS</span><span id="onair-track-0" class="onair-track-name"></span>
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      <button class="button is-success is-small is-outlined" onclick="D[0].togglePlay()">▶ PLAY</button>
      <button class="button is-danger is-small is-outlined"  onclick="D[0].stopAll()">■ STOP</button>
      <button class="button is-dark is-small" onclick="D[0].prevTrack()">|◀</button>
      <button class="button is-dark is-small" onclick="D[0].nextTrack()">▶|</button><span class="tag" style="background:#0c1428;color:#5a6880;border:1px solid #38404e">PISTE <strong id="c1-counter" style="color:#5a7090;margin-left:4px">0/0</strong></span>
    </div>
  </div>
  <progress class="progress is-elapsed" id="c1-progress" value="0" max="100"></progress>

  <div class="card-content" style="display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;padding:0;">

    <!-- ══ BLOC DIFF : waveform + contrôles (hauteur fixe) ══ -->
    <div style="flex-shrink:0;">

      <!-- Zone active waveform -->
      <div id="paz" style="position:relative;height:160px;overflow:hidden;border-bottom:2px solid var(--border);background:#12141a;">
        <!-- Waveform fond HD — pleine largeur jusqu'au countdown -->
        <canvas id="paz-bg" style="position:absolute;top:0;bottom:0;left:0;right:260px;display:block;pointer-events:none;z-index:0;width:calc(100% - 260px);"></canvas>

        <!-- Tous les overlays dans la zone waveform (0 → right:260px) -->
        <div id="paz-center-zone" style="position:absolute;top:0;bottom:0;left:0;right:260px;overflow:hidden;pointer-events:none;">
          <div id="paz-red"    style="position:absolute;top:0;bottom:0;left:0;width:0;z-index:1;background:linear-gradient(90deg,rgba(160,8,8,.72),rgba(80,3,3,.5));"></div>
          <div id="paz-yellow" style="position:absolute;top:0;bottom:0;left:0;width:0;z-index:2;background:linear-gradient(90deg,rgba(190,148,0,.55),rgba(120,90,0,.35));display:none;"></div>
          <div id="paz-ph"     style="position:absolute;top:0;bottom:0;width:2px;background:rgba(255,255,200,.8);z-index:5;display:none;"></div>
          <div id="paz-mn"     style="position:absolute;top:0;bottom:0;width:2px;background:#00d96a;z-index:4;display:none;">
            <span style="position:absolute;bottom:4px;left:4px;font-family:var(--mono);font-size:8px;color:#00d96a;background:rgba(0,0,0,.8);padding:1px 4px;border-radius:2px;white-space:nowrap;">NEXT</span>
          </div>
          <div id="paz-mi"     style="position:absolute;top:0;bottom:0;width:2px;background:#f5c400;z-index:4;display:none;">
            <span style="position:absolute;bottom:18px;left:4px;font-family:var(--mono);font-size:8px;color:#f5c400;background:rgba(0,0,0,.8);padding:1px 4px;border-radius:2px;white-space:nowrap;">INTRO</span>
          </div>
          <div id="paz-zoom-bar" style="position:absolute;bottom:0;left:0;right:0;height:3px;background:rgba(255,255,255,.06);display:none;z-index:6;">
            <div id="paz-zoom-pos" style="position:absolute;height:100%;background:rgba(255,255,255,.3);"></div>
          </div>
        </div>

        <!-- Titre + cues superposés sur la waveform -->
        <div style="position:absolute;top:0;bottom:0;left:0;right:260px;display:flex;flex-direction:column;justify-content:center;padding:14px 20px;gap:5px;z-index:6;overflow:hidden;pointer-events:none;">
          <div id="paz-title" style="font-family:var(--display);font-size:34px;font-weight:700;letter-spacing:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 2px 18px rgba(0,0,0,.95);color:rgba(220,228,240,.55);transition:color .2s;">AUCUNE PISTE</div>
          <div id="paz-cues" style="font-family:var(--mono);font-size:9px;color:rgba(255,255,255,.35);letter-spacing:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 4px rgba(0,0,0,.8);"></div>
        </div>

        <!-- Colonne droite : décompte + boutons -->
        <div style="position:absolute;top:0;bottom:0;right:0;width:260px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border-left:1px solid rgba(255,255,255,.08);padding:0 18px;z-index:6;background:rgba(14,16,22,.7);">
          <span id="paz-cd-lbl" style="font-family:var(--mono);font-size:8px;color:rgba(255,255,255,.3);letter-spacing:4px;text-transform:uppercase;">NEXT</span>
          <span id="paz-cd" style="font-family:var(--mono);font-size:52px;font-weight:700;letter-spacing:0px;line-height:1;color:#ffffff;text-shadow:0 0 24px rgba(255,255,255,.3);">--:--:--</span>
          <div style="display:flex;gap:5px;margin-top:6px;">
            <button id="paz-next-btn" onclick="pazToggleNext()" style="background:rgba(0,40,10,.5);border:1px solid rgba(0,217,106,.5);border-radius:2px;color:var(--green);font-family:var(--mono);font-size:8px;padding:3px 10px;cursor:pointer;letter-spacing:2px;transition:all .15s;font-weight:700;">⬥ NEXT</button>
            <button onclick="openEditModal()" style="background:rgba(20,10,40,.5);border:1px solid rgba(100,70,180,.4);border-radius:2px;color:#7060a0;font-family:var(--mono);font-size:8px;padding:3px 8px;cursor:pointer;letter-spacing:1px;transition:all .15s;" onmouseover="this.style.color='#9b6de5';this.style.borderColor='#9b6de5'" onmouseout="this.style.color='#7060a0';this.style.borderColor='rgba(100,70,180,.4)'">✦ EDIT</button>
          </div>
        </div>
      </div>

    </div><!-- /bloc DIFF -->

    <!-- ══ BLOC PLAYLIST : hauteur explicite calculée, jamais 0 ══ -->
    <div style="flex:1;display:flex;flex-direction:column;min-height:200px;background:var(--bg);border-top:2px solid var(--border);overflow:hidden;">

      <!-- En-tête PLAYLIST + zone drop -->
      <div style="flex-shrink:0;display:flex;align-items:stretch;background:var(--s2);border-bottom:1px solid var(--border);">
        <div style="padding:0 14px;display:flex;align-items:center;border-right:1px solid var(--border);flex-shrink:0;">
          <span style="font-family:var(--display);font-size:12px;font-weight:700;color:var(--txt-dim);letter-spacing:2px;">PLAYLIST</span>
        </div>
        <label for="fi1" style="flex:1;margin:0;border:none;border-radius:0;padding:10px 20px;display:flex;align-items:center;min-height:52px;cursor:pointer;background:transparent;transition:background .12s;"
          ondragover="event.preventDefault();this.style.background='#0a1e30'"
          ondragleave="this.style.background='transparent'"
          ondrop="this.style.background='transparent';handleDrop(event,0)">
          <input type="file" id="fi1" multiple accept="audio/*" style="display:none" onchange="handleFiles(this.files,0)">
          <span style="font-size:20px;color:var(--cyan-dim);margin-right:12px;">⊕</span>
          <span style="font-family:var(--mono);font-size:11px;color:var(--txt-dim);letter-spacing:1px;">Glisser des fichiers audio ici · ou cliquer pour parcourir</span>
          <span style="font-family:var(--mono);font-size:10px;color:var(--green);background:#141e10;border:1px solid var(--green-dk);border-radius:3px;padding:2px 10px;letter-spacing:1px;margin-left:12px;">+ AJOUTER</span>
          <span id="fdz1-count" style="font-family:var(--mono);font-size:10px;color:var(--cyan);margin-left:auto;">Aucun fichier</span>
        </label>
      </div>

      <!-- En-têtes colonnes -->
      <div style="display:flex;align-items:center;height:24px;background:var(--s3);border-bottom:1px solid var(--border);flex-shrink:0;">
        <div style="width:40px;flex-shrink:0;font-family:var(--mono);font-size:9px;color:var(--txt-mute);letter-spacing:1px;text-align:center;">#</div>
        <div style="width:80px;flex-shrink:0;font-family:var(--mono);font-size:9px;color:var(--txt-mute);letter-spacing:1px;padding-left:6px;">HORAIRE</div>
        <div style="width:60px;flex-shrink:0;font-family:var(--mono);font-size:9px;color:var(--txt-mute);letter-spacing:1px;text-align:center;">NEXT</div>
        <div style="flex:1;font-family:var(--mono);font-size:9px;color:var(--txt-mute);letter-spacing:1px;padding-left:4px;">TITRE</div>
        <div style="width:72px;flex-shrink:0;font-family:var(--mono);font-size:9px;color:var(--txt-mute);letter-spacing:1px;text-align:right;">DURÉE</div>
        <div style="width:88px;flex-shrink:0;font-family:var(--mono);font-size:9px;color:var(--txt-mute);letter-spacing:1px;text-align:right;padding-right:10px;">DÉCOMPTE</div>
        <div style="width:58px;flex-shrink:0;"></div>
      </div>

      <!-- Liste scrollable — hauteur min garantie -->
      <div id="paz-list" style="flex:1;overflow-y:auto;min-height:100px;"></div>
          <div onclick="cartCtxDelete()" style="padding:9px 16px;font-size:10px;letter-spacing:1px;color:#8090a8;cursor:pointer;" onmouseover="this.style.background='#2a1010';this.style.color='#e03020'" onmouseout="this.style.background='';this.style.color='#8090a8'">✕ Supprimer le son</div>
        </div>
      </div>
    </div><!-- /bloc PLAYLIST -->

    <!-- IDs fantômes pour compatibilité -->
    <div style="display:none">
      <tbody id="c1-body"></tbody>
      <span id="c1-micros">00:00</span>
      <span id="c1-total">00:00:00</span>
      <span id="c1-suffix">A</span>
      <span id="c1-counter">0/0</span>
    </div>
  </div>
  <div class="card-footer" style="display:none"><span></span></div>
  <div class="vu-strip" id="vu-strip-d0"><div class="vu-strip-bar" style="background:#00d96a"></div><div class="vu-strip-bar" style="background:#00d96a"></div><div class="vu-strip-bar" style="background:#00d96a"></div><div class="vu-strip-bar" style="background:#00d96a"></div><div class="vu-strip-bar" style="background:#00d96a"></div><div class="vu-strip-bar" style="background:#00d96a"></div><div class="vu-strip-bar" style="background:#00d96a"></div><div class="vu-strip-bar" style="background:#00d96a"></div><div class="vu-strip-bar" style="background:#00d96a"></div><div class="vu-strip-bar" style="background:#00d96a"></div><div class="vu-strip-bar" style="background:#00d96a"></div><div class="vu-strip-bar" style="background:#f5c400"></div><div class="vu-strip-bar" style="background:#f5c400"></div><div class="vu-strip-bar" style="background:#f5c400"></div><div class="vu-strip-bar" style="background:#e03020"></div><div class="vu-strip-bar" style="background:#e03020"></div></div>
</div>
</div>


</section>


<script>
const COLORS=['#1a6b3a','#1a3a6e','#5b21b6','#6b3a1a','#1a5a6b','#3a1a6b','#6b5a1a','#1a6b5a'];
const CONFIGS=[
  {tracks:[],ids:{counter:'c1-counter',body:'c1-body',micros:'c1-micros',total:'c1-total',suffix:'c1-suffix',progress:'c1-progress'},fdzCount:'fdz1-count',autoBtn:'auto-btn-0'}
];

const fmt2=n=>String(n).padStart(2,'0');
const fmtSec=s=>{s=Math.round(s||0);return fmt2(Math.floor(s/60))+':'+fmt2(s%60);};
const fmtFull=s=>{s=Math.round(s||0);return fmt2(Math.floor(s/3600))+':'+fmt2(Math.floor((s%3600)/60))+':'+fmt2(s%60);};
const fmtMs=s=>{s=Math.max(0,s||0);const m=Math.floor(s/60),sec=Math.floor(s%60),ms=Math.round((s%1)*10);return fmt2(m)+':'+fmt2(sec)+'.'+ms;};
const nowClock=()=>{const d=new Date();return[d.getHours(),d.getMinutes(),d.getSeconds()].map(fmt2).join(':');};

// ── Chargement ADDITIF des fichiers ──
function handleFiles(files,idx){
  const arr=Array.from(files).filter(f=>f.type.startsWith('audio/'));
  if(!arr.length)return;
  arr.sort((a,b)=>a.name.localeCompare(b.name));
  const existing=CONFIGS[idx].tracks;
  const newTracks=arr.map((f,i)=>({
    file:URL.createObjectURL(f),
    title:f.name.replace(/\\.[^/.]+$/,''),
    color:COLORS[(existing.length+i)%COLORS.length],
    inCue:0, outCue:null, autoNext:false
  }));
  CONFIGS[idx].tracks=[...existing,...newTracks];
  const total=CONFIGS[idx].tracks.length;
  const fdzEl=document.getElementById(CONFIGS[idx].fdzCount);
  if(fdzEl) fdzEl.textContent=total+' fichier'+(total>1?'s':'');

  // Peupler allTracks et tracks DIRECTEMENT (sans passer par addTracks qui appelle render interne)
  const d=D[idx];
  const offset=d.tracks.length;
  d.tracks.push(...newTracks);
  d.durs.push(...newTracks.map(()=>0));
  newTracks.forEach(t=>{ t._status='pending'; d.allTracks.push(t); });

  // Créer les Audio() et charger les métadonnées
  newTracks.forEach((_,i)=>{
    const trackIdx=offset+i;
    const a=new Audio();
    a.src=d.tracks[trackIdx].file;
    a.preload='metadata';
    // Enregistrer sur la sortie PROG
    audioRegisterProg(a);
    a.addEventListener('loadedmetadata',()=>{
      const tr=d.tracks[trackIdx]; if(!tr) return;
      d.durs[trackIdx]=a.duration||0;
      if(tr.outCue==null) tr.outCue=a.duration;
      // Décoder waveform en arrière-plan
      const fileUrl=tr.file;
      drawWaveform(document.createElement('canvas'), fileUrl).then(()=>{
        if(idx===0 && trackIdx===d.ci){ _pazWvFile=null; pazDrawBg(false); }
      });
      pazRenderList(); // mise à jour de la durée dans la liste
    });
    d.audios[trackIdx]=a;
  });

  // Mise à jour UI immédiate — pas de RAF, pas de délai
  if(idx===0){
    const tEl=document.getElementById('paz-title');
    const t0=d.allTracks.find(t=>!t.isMacro);
    if(tEl && t0){
      tEl.textContent=t0.title;
      tEl.style.color=d.playing?'#ffffff':'rgba(200,220,255,.6)';
    }
    _pazUpdateNextBtn();
    pazRenderList();           // SYNCHRONE — liste mise à jour immédiatement
    requestAnimationFrame(()=>pazDrawBg(true));
  }
}
function handleDrop(ev,idx){ev.preventDefault();handleFiles(ev.dataTransfer.files,idx);}

// ── Dessin waveform ──
const WV_DATA_CACHE={}; // file → Float32Array (cache pour zoom)

async function drawWaveform(canvas, file, startRatio=0, endRatio=1){
  try{
    const resp=await fetch(file);
    const buf=await resp.arrayBuffer();
    const offCtx=new OfflineAudioContext(1,1,44100);
    const ab=await offCtx.decodeAudioData(buf);
    const rawData=ab.getChannelData(0);
    WV_DATA_CACHE[file]=rawData;
    drawWaveformFromData(canvas, rawData, startRatio, endRatio);
    return ab.duration;
  }catch(e){ console.warn('waveform',e); return 0; }
}

// ── Dessin waveform standard (playlist) ──
function drawWaveformFromData(canvas, data, startRatio=0, endRatio=1){
  const W=canvas.width, H=canvas.height;
  const c=canvas.getContext('2d');

  // Fond
  c.fillStyle='#181a20';
  c.fillRect(0,0,W,H);

  // Grille légère
  c.strokeStyle='rgba(30,50,90,.6)'; c.lineWidth=1;
  [0.25,0.5,0.75].forEach(y=>{
    c.beginPath(); c.moveTo(0,Math.round(H*y)+.5); c.lineTo(W,Math.round(H*y)+.5); c.stroke();
  });

  const start=Math.floor(startRatio*data.length);
  const end=Math.floor(endRatio*data.length);
  const len=Math.max(1,end-start);
  const step=Math.max(1,Math.floor(len/W));

  // Zone remplie (silhouette symétrique)
  const grad=c.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,'rgba(0,180,220,0.08)');
  grad.addColorStop(0.5,'rgba(0,200,240,0.18)');
  grad.addColorStop(1,'rgba(0,180,220,0.08)');
  c.fillStyle=grad;
  c.beginPath(); c.moveTo(0,H/2);
  for(let x=0;x<W;x++){
    let mx=0;
    for(let j=0;j<step;j++){const v=Math.abs(data[start+x*step+j]||0);if(v>mx)mx=v;}
    c.lineTo(x, H/2-mx*(H/2)*.95);
  }
  for(let x=W-1;x>=0;x--){
    let mx=0;
    for(let j=0;j<step;j++){const v=Math.abs(data[start+x*step+j]||0);if(v>mx)mx=v;}
    c.lineTo(x, H/2+mx*(H/2)*.95);
  }
  c.closePath(); c.fill();

  // Traits min/max — couleur uniforme cyan
  c.strokeStyle='rgba(0,212,240,0.8)';
  c.lineWidth=1;
  for(let x=0;x<W;x++){
    let mn=0,mx=0;
    for(let j=0;j<step;j++){
      const v=data[start+x*step+j]||0;
      if(v<mn)mn=v; if(v>mx)mx=v;
    }
    const y1=Math.round((1+mn)/2*H);
    const y2=Math.round((1+mx)/2*H);
    if(y2>y1){
      c.beginPath(); c.moveTo(x+.5,y1); c.lineTo(x+.5,y2); c.stroke();
    }
  }
}

// ── Waveform fond de la ligne active ──
function drawWaveformBg(canvas, data){
  const W=canvas.width, H=canvas.height;
  const c=canvas.getContext('2d');
  c.clearRect(0,0,W,H);

  const step=Math.max(1,Math.floor(data.length/W));

  // Zone remplie cyan transparente
  c.fillStyle='rgba(0,190,230,0.12)';
  c.beginPath(); c.moveTo(0,H/2);
  for(let x=0;x<W;x++){
    let mx=0;
    for(let j=0;j<step;j++){const v=Math.abs(data[x*step+j]||0);if(v>mx)mx=v;}
    c.lineTo(x, H/2-mx*(H/2)*.9);
  }
  for(let x=W-1;x>=0;x--){
    let mx=0;
    for(let j=0;j<step;j++){const v=Math.abs(data[x*step+j]||0);if(v>mx)mx=v;}
    c.lineTo(x, H/2+mx*(H/2)*.9);
  }
  c.closePath(); c.fill();

  // Traits — blanc cassé pour contraster sur fond rouge
  c.strokeStyle='rgba(255,255,255,0.5)';
  c.lineWidth=1;
  for(let x=0;x<W;x++){
    let mn=0,mx=0;
    for(let j=0;j<step;j++){
      const v=data[x*step+j]||0;
      if(v<mn)mn=v; if(v>mx)mx=v;
    }
    const y1=Math.round((1+mn)/2*H);
    const y2=Math.round((1+mx)/2*H);
    if(y2>y1){
      c.beginPath(); c.moveTo(x+.5,y1); c.lineTo(x+.5,y2); c.stroke();
    }
  }
}

// ── Classe Diffuser ──
class Diffuser{
  constructor(cfg,diffIdx){
    this.cfg=cfg; this.idx=diffIdx;
    this.ids=cfg.ids;
    this.tracks=[];
    this.durs=[];
    this.audios=[];
    this.playing=false;
    this.ci=0;
    this.auto=false;
    this.allTracks=[];      // TABLEAU PERMANENT — jamais vidé, status: 'pending'|'playing'|'done'
    this._playedTracks=[];
    this._chainDone=new Set(); // pistes dont l'enchainement a été déclenché
    this._playToken=0;         // token unique par session de lecture
    this._outTimer=null;       // timer précis pour le point OUT
  }

  addTracks(newTracks){
    const offset=this.tracks.length;
    this.tracks.push(...newTracks);
    this.durs.push(...newTracks.map(()=>0));
    // Ajouter dans allTracks avec statut pending — immédiatement visible dans la liste
    newTracks.forEach(t=>{ t._status='pending'; this.allTracks.push(t); });
    // Créer un Audio() par nouvelle piste — PAS de listener 'ended' ici,
    // c'est _startTrack qui pose audio.onended avec le token de session
    newTracks.forEach((_,i)=>{
      const idx=offset+i;
      const a=new Audio();
      a.src=this.tracks[idx].file;
      a.preload='metadata';
      // Précharger les métadonnées
      a.preload='metadata';
      a.addEventListener('loadedmetadata',()=>{
        const tr=this.tracks[idx]; if(!tr) return;
        this.durs[idx]=a.duration||0;
        if(tr.outCue==null) tr.outCue=a.duration;
        // Décoder la waveform en arrière-plan AVANT render() pour remplir le cache
        const fileUrl=this.tracks[idx].file;
        const diffIdx=this.idx;
        drawWaveform(document.createElement('canvas'), fileUrl).then(()=>{
          // Cache rempli : mettre à jour le vrai canvas s'il existe dans le DOM
          const cv=document.getElementById(\`wv-\${diffIdx}-\${idx}\`);
          if(cv && WV_DATA_CACHE[fileUrl]){
            cv.width=800; cv.height=80;
            drawWaveformFromData(cv, WV_DATA_CACHE[fileUrl], 0, 1);
          }
          // Waveform fond PAZ si c'est la piste en tête
          if(diffIdx===0 && idx===this.ci){ _pazWvFile=null; pazDrawBg(false); }
        });
        this.render();
      });
      this.audios[idx]=a;
    });
    this.render();
  }

  _onTrackEnded(i){
    // Méthode conservée pour compatibilité mais désactivée —
    // la suppression et l'avance sont gérées par audio.onended + token dans _startTrack
  }

  _effectiveDur(i){return this.durs[i]||0;}
  _inOf(i){return Math.max(0,this.tracks[i]?.inCue||0);}
  _outOf(i){const t=this.tracks[i]; if(!t)return 0; if(t.nextCue!=null) return t.nextCue; return t.outCue!=null?t.outCue:this.durs[i]||0;}
  _playDur(i){return Math.max(0,this._outOf(i)-this._inOf(i));}

  render(){
    const now=new Date();let cur=new Date(now);
    const starts=this.tracks.map((_,i)=>{const t=new Date(cur);cur=new Date(cur.getTime()+this._playDur(i)*1000);return t;});
    const tbody=document.getElementById(this.ids.body);
    tbody.innerHTML='';
    this.tracks.forEach((t,i)=>{
      const isActive=i===this.ci&&this.playing;
      const isNext=i===this.ci+(this.playing?1:0)&&!isActive;
      const tr=document.createElement('tr');
      if(isActive)tr.className='row-active';else if(i===this.ci+1&&this.playing)tr.className='row-next';
      tr.onclick=()=>this.jumpTo(i);
      const st=starts[i];
      const hhmm=fmt2(st.getHours())+':'+fmt2(st.getMinutes())+':'+fmt2(st.getSeconds());
      const sub='('+fmt2(st.getHours())+':'+fmt2(st.getMinutes()+Math.floor(this._playDur(i)/60))+')';
      const audio=this.audios[i];
      const pos=audio?audio.currentTime:0;
      const rem=isActive?Math.max(0,this._outOf(i)-pos):this._playDur(i);
      const cd=isActive?\`<span id="\${this.ids.body}-cd-\${i}">\${fmtFull(rem)}</span>\`:fmtFull(this._playDur(i));
      const wvId=\`wv-\${this.idx}-\${i}\`;
      const dur=this.durs[i]||1;
      const inPct=(this._inOf(i)/dur*100).toFixed(1);
      // Clamp OUT à 98% max pour qu'elle soit toujours visible
      const outPct=Math.min(98,(this._outOf(i)/dur*100)).toFixed(1);
      const delBtn=\`<button onclick="event.stopPropagation();diffRemoveTrack(\${this.idx},\${i})" style="background:transparent;border:none;color:#3a4050;cursor:pointer;font-size:11px;padding:0 4px;line-height:1;transition:color .1s" onmouseover="this.style.color='#e03020'" onmouseout="this.style.color='#3a4050'" title="Supprimer">✕</button>\`;

      // ── Piste MACRO : affichage spécial ──
      if(t.isMacro){
        tr.classList.add('playlist-macro-row');
        tr.innerHTML=\`
          <td class="cell-num" style="color:var(--yellow)">\${isActive?'⚡':(i+1)}</td>
          <td class="cell-time" style="font-family:var(--mono);font-size:10px;color:var(--yellow);letter-spacing:1px">MACRO</td>
          <td class="cell-title" style="display:flex;align-items:center;gap:4px">\${delBtn}
            <span style="font-family:var(--display);font-size:13px;font-weight:700;color:var(--yellow);letter-spacing:2px">\${t.title}</span>
          </td>
          <td class="cell-wv" style="padding:4px 12px!important">
            <span style="font-family:var(--mono);font-size:9px;color:var(--txt-mute)">→ s'exécute à la lecture</span>
          </td>
          <td class="cell-dur" style="color:var(--txt-mute);font-size:10px">—</td>
          <td class="cell-cd" style="color:var(--yellow);font-family:var(--mono);font-size:11px;text-align:right;padding-right:10px">ACTION</td>
          <td class="cell-bar"><span class="color-bar" style="background:#6a5a00"></span></td>\`;
        tbody.appendChild(tr);
        return;
      }

      if(isActive){
        // ── LIGNE ACTIVE : waveform en fond pleine ligne, titre en gros ──
        tr.innerHTML=\`
          <!-- Canvas waveform fond (z-index:1, absolu) -->
          <canvas class="row-active-wv-bg" id="\${wvId}-bg" width="1200" height="96"></canvas>
          <!-- Poignées IN/OUT fond -->
          <div style="position:absolute;top:0;bottom:0;z-index:1;pointer-events:none;
            left:\${inPct}%;width:2px;background:rgba(0,255,96,.5)"></div>
          <div style="position:absolute;top:0;bottom:0;z-index:1;pointer-events:none;
            left:\${outPct}%;width:2px;background:rgba(255,40,40,.5)"></div>
          <!-- Numéro -->
          <td class="cell-num is-playing" style="width:32px">▶</td>
          <!-- Horaire -->
          <td class="cell-time" style="width:72px">
            <span class="row-active-time">\${hhmm}</span>
            <span class="cell-sub" style="color:rgba(0,212,240,.5)">\${sub}</span>
          </td>
          <!-- Titre en gros -->
          <td class="cell-title" style="max-width:none;flex:1;padding-left:8px!important">
            \${delBtn}
            <div>
              <div class="row-active-title">\${t.title}</div>
              <div class="row-active-cues">IN \${fmtMs(this._inOf(i))} &nbsp;·&nbsp; OUT \${fmtMs(this._outOf(i))}</div>
            </div>
          </td>
          <!-- Waveform interactive (mini, à droite) -->
          <td class="cell-wv" style="width:220px;padding:4px 6px!important">
            <div class="wv-outer" style="padding:0">
              <div class="wv-wrap" id="\${wvId}-wrap" style="height:80px">
                <canvas class="wv-canvas" id="\${wvId}" width="800" height="80"></canvas>
                <div class="wv-pre"  id="\${wvId}-pre"  style="width:\${inPct}%"></div>
                <div class="wv-post" id="\${wvId}-post" style="left:\${outPct}%"></div>
                <div class="wv-playhead" id="\${wvId}-ph"></div>
                <div class="wv-handle wv-handle-in"  id="\${wvId}-in"  data-label="IN"  style="left:\${inPct}%"></div>
                <div class="wv-handle wv-handle-out" id="\${wvId}-out" data-label="OUT" style="left:\${outPct}%"></div>
                <button class="wv-edit-btn" onclick="wvModalOpen('\${wvId}',\${this.idx},\${i})" title="Éditer IN/OUT">✎</button>
              </div>
              <div class="wv-labels">
                <span class="wv-label in-lbl"  id="\${wvId}-inlbl">IN \${fmtMs(this._inOf(i))}</span>
                <span class="wv-label out-lbl" id="\${wvId}-outlbl">OUT \${fmtMs(this._outOf(i))}</span>
              </div>
            </div>
          </td>
          <!-- Durée -->
          <td class="cell-dur"><span class="row-active-dur">\${fmtFull(this.durs[i]||0)}</span></td>
          <!-- Décompte en rouge -->
          <td class="cell-cd"><span class="row-active-tc" id="\${this.ids.body}-cd-\${i}">\${fmtFull(rem)}</span></td>
          <!-- Barre couleur -->
          <td class="cell-bar"><span class="color-bar" style="background:\${t.color};height:96px"></span></td>\`;
        tbody.appendChild(tr);
        this._bindHandles(wvId,i);
        // Waveform mini (interactive) — depuis le cache si dispo, sinon décodage
        const cv=document.getElementById(wvId);
        if(cv&&this.durs[i]>0){
          cv.width=800;cv.height=80;
          if(WV_DATA_CACHE[t.file]) drawWaveformFromData(cv,WV_DATA_CACHE[t.file],0,1);
          else drawWaveform(cv,t.file);
        }
        // Waveform fond (grande, pleine ligne)
        const bgCv=document.getElementById(wvId+'-bg');
        if(bgCv&&this.durs[i]>0){
          bgCv.width=1200;bgCv.height=96;
          if(WV_DATA_CACHE[t.file]) drawWaveformBg(bgCv,WV_DATA_CACHE[t.file]);
          else drawWaveform(document.createElement('canvas'),t.file).then(()=>{
            if(WV_DATA_CACHE[t.file]&&document.getElementById(wvId+'-bg'))
              drawWaveformBg(document.getElementById(wvId+'-bg'),WV_DATA_CACHE[t.file]);
          });
        }
      } else {
        // ── LIGNE NORMALE ──
        tr.innerHTML=\`
          <td class="cell-num">\${i+1}</td>
          <td class="cell-time"><span>\${hhmm}</span><span class="cell-sub">\${sub}</span></td>
          <td class="cell-title" style="display:flex;align-items:center;gap:4px">\${delBtn}<span class="cell-simple" title="\${t.title}">\${t.title}</span></td>
          <td class="cell-wv">
            <div class="wv-outer">
              <div class="wv-wrap" id="\${wvId}-wrap">
                <canvas class="wv-canvas" id="\${wvId}" width="800" height="80"></canvas>
                <div class="wv-pre"      id="\${wvId}-pre"  style="width:\${inPct}%"></div>
                <div class="wv-post"     id="\${wvId}-post" style="left:\${outPct}%"></div>
                <div class="wv-playhead" id="\${wvId}-ph"></div>
                <div class="wv-handle wv-handle-in"  id="\${wvId}-in"  data-label="IN"  style="left:\${inPct}%"></div>
                <div class="wv-handle wv-handle-out" id="\${wvId}-out" data-label="OUT" style="left:\${outPct}%"></div>
                <button class="wv-edit-btn" onclick="wvModalOpen('\${wvId}',\${this.idx},\${i})" title="Éditer IN/OUT">✎</button>
              </div>
              <div class="wv-labels">
                <span class="wv-label in-lbl"  id="\${wvId}-inlbl">IN \${fmtMs(this._inOf(i))}</span>
                <span class="wv-label out-lbl" id="\${wvId}-outlbl">OUT \${fmtMs(this._outOf(i))}</span>
              </div>
            </div>
          </td>
          <td class="cell-dur">\${fmtFull(this.durs[i]||0)}</td>
          <td class="cell-cd">\${fmtFull(this._playDur(i))}</td>
          <td class="cell-bar"><span class="color-bar" style="background:\${t.color}"></span></td>\`;
        tbody.appendChild(tr);
        this._bindHandles(wvId,i);
        const cv=document.getElementById(wvId);
        if(cv&&this.durs[i]>0){
          cv.width=800;cv.height=80;
          if(WV_DATA_CACHE[t.file]) drawWaveformFromData(cv,WV_DATA_CACHE[t.file],0,1);
          else drawWaveform(cv,t.file);
        }
      }
    });

    document.getElementById(this.ids.counter).textContent=this.tracks.length?\`\${this.ci+1}/\${this.tracks.length}\`:'0/0';
    let tot=0;this.tracks.forEach((_,i)=>tot+=this._playDur(i));
    document.getElementById(this.ids.total).textContent=fmtFull(tot);
    document.getElementById(this.ids.suffix).textContent=this.playing?'EN DIRECT':'A';
    // Nom de la piste en lecture dans la barre is-onair
    const trackNameEl=document.getElementById('onair-track-'+this.idx);
    if(trackNameEl){
      const activeTrack=this.playing&&this.tracks[this.ci];
      trackNameEl.textContent=activeTrack&&!activeTrack.isMacro?'— '+activeTrack.title:'';
      trackNameEl.style.opacity=activeTrack?'1':'0';
    }
    // ── Indicateur visuel EN DIRECT : header + barre rouge ──
    const hdr=document.getElementById('diff-header-'+this.idx);
    const bar=document.getElementById('diff-onair-'+this.idx);
    if(hdr) hdr.classList.toggle('is-live', this.playing);
    if(bar) bar.classList.toggle('is-live', this.playing);
  }

  _bindHandles(wvId, trackIdx){
    const wrap=document.getElementById(wvId+'-wrap');
    const inH =document.getElementById(wvId+'-in');
    const outH=document.getElementById(wvId+'-out');
    if(!wrap||!inH||!outH) return;

    // Convertit un clientX en ratio [0,1] sur le wrap — scroll-safe
    const xToRatio=(clientX)=>{
      const rect=wrap.getBoundingClientRect();
      return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    };

    // Met à jour l'UI d'une poignée sans changer l'échelle de la waveform
    const applyIn=(sec)=>{
      const dur=this.durs[trackIdx]||1;
      const pct=(sec/dur*100).toFixed(2);
      inH.style.left=pct+'%';
      const pre=document.getElementById(wvId+'-pre');
      if(pre) pre.style.width=pct+'%';
      const lbl=document.getElementById(wvId+'-inlbl');
      if(lbl) lbl.textContent='IN '+fmtMs(sec);
    };
    const applyOut=(sec)=>{
      const dur=this.durs[trackIdx]||1;
      const pct=(sec/dur*100).toFixed(2);
      outH.style.left=pct+'%';
      const post=document.getElementById(wvId+'-post');
      if(post) post.style.left=pct+'%';
      const lbl=document.getElementById(wvId+'-outlbl');
      if(lbl) lbl.textContent='OUT '+fmtMs(sec);
    };

    const bindOne=(handle, type)=>{
      let active=false;

      const onStart=(e)=>{
        e.stopPropagation();
        e.preventDefault();
        active=true;
        document.body.style.userSelect='none'; // empêche la sélection de texte
      };

      const onMove=(e)=>{
        if(!active) return;
        const clientX=e.touches ? e.touches[0].clientX : e.clientX;
        const dur=this.durs[trackIdx]||1;
        const t=this.tracks[trackIdx];
        if(!t) return;
        const ratio=xToRatio(clientX);
        const sec=ratio*dur;

        if(type==='in'){
          t.inCue=Math.min(sec, (t.outCue??dur) - 0.1);
          t.inCue=Math.max(0, t.inCue);
          applyIn(t.inCue);
        } else {
          t.outCue=Math.max(sec, (t.inCue||0) + 0.1);
          t.outCue=Math.min(dur, t.outCue);
          applyOut(t.outCue);
        }
      };

      const onEnd=()=>{
        if(!active) return;
        active=false;
        document.body.style.userSelect='';
        // Redessiner la waveform complète après le drag (pas pendant)
        const cv=document.getElementById(wvId);
        const file=this.tracks[trackIdx]?.file;
        if(cv && file && WV_DATA_CACHE[file]){
          drawWaveformFromData(cv, WV_DATA_CACHE[file], 0, 1);
        }
      };

      handle.addEventListener('mousedown',  onStart, {passive:false});
      handle.addEventListener('touchstart', onStart, {passive:false});
      document.addEventListener('mousemove',  onMove);
      document.addEventListener('touchmove',  onMove, {passive:true});
      document.addEventListener('mouseup',   onEnd);
      document.addEventListener('touchend',  onEnd);
    };

    bindOne(inH,  'in');
    bindOne(outH, 'out');
  }

  // tick() = mise à jour UI — décompte jusqu'au point d'enchaînement (OUT)
  tick(){
    if(!this.playing || !this.tracks.length) return;
    const i=0;
    const audio=this.audios[i];
    if(!audio || audio.paused) return;

    const pos    = audio.currentTime;
    const inCue  = this._inOf(i);
    const outCue = this._outOf(i);
    const dur    = this.durs[i]||1;
    const rem    = Math.max(0, outCue - pos);

    // ── Zoom waveform sur les 30 dernières secondes avant OUT ──
    const ZOOM_WIN = 30;
    const cv = document.getElementById(\`wv-\${this.idx}-\${i}\`);
    const ph = document.getElementById(\`wv-\${this.idx}-\${i}-ph\`);
    const trackFile = this.tracks[i]?.file;

    if(cv && trackFile && WV_DATA_CACHE[trackFile]){
      const data = WV_DATA_CACHE[trackFile];
      if(rem <= ZOOM_WIN && rem > 0){
        // Zone : 5s de contexte avant pos → jusqu'au OUT
        const startR = Math.max(0, (pos - 5) / dur);
        const endR   = Math.min(1, (outCue + 0.5) / dur);
        // Redessiner seulement si la fenêtre a bougé de >0.3%
        const newKey = (startR*1000|0) + '_' + (endR*1000|0);
        if(cv._zoomKey !== newKey){
          cv._zoomKey = newKey;
          cv._zoomed  = true;
          drawWaveformFromData(cv, data, startR, endR);
        }
        // Playhead relatif à la fenêtre zoomée
        if(ph){
          const range = endR - startR || 0.001;
          const relPct = Math.max(0, Math.min(100, ((pos/dur) - startR) / range * 100));
          ph.style.display = 'block';
          ph.style.left = relPct.toFixed(2) + '%';
        }
      } else {
        // Hors zoom : vue complète
        if(cv._zoomed){
          cv._zoomed  = false;
          cv._zoomKey = null;
          drawWaveformFromData(cv, data, 0, 1);
        }
        if(ph){ ph.style.display='block'; ph.style.left=(pos/dur*100).toFixed(2)+'%'; }
      }
    } else if(ph){
      ph.style.display='block'; ph.style.left=(pos/dur*100).toFixed(2)+'%';
    }

    // Décompte jusqu'au point d'enchaînement
    const cd=document.getElementById(\`\${this.ids.body}-cd-\${i}\`);
    if(cd) cd.textContent = fmtFull(rem);

    // Barre de progression (IN→OUT = 0→100%)
    const prog=Math.min(1,Math.max(0,(pos-inCue)/Math.max(0.01,this._playDur(i))));
    const ar=document.querySelector(\`#\${this.ids.body} tr.row-active\`);
    if(ar) ar.style.setProperty('--prog',prog.toFixed(4));
    const pb=document.getElementById(this.ids.progress);
    if(pb) pb.value=Math.round(prog*100);    const micEl=document.getElementById(this.ids.micros); if(micEl) micEl.textContent = fmtSec(pos-inCue);
  }

  // ──────────────────────────────────────────────────────────────
  // Lance la piste à l'index idx dans this.tracks
  // Approche simple : un seul token global, un seul timer.
  // L'enchaînement se fait par suppression de la piste 0 puis
  // appel récursif à _startTrack(0).
  // ──────────────────────────────────────────────────────────────
  _startTrack(idx){
    const t = this.tracks[idx];
    if(!t){ this.playing=false; this.render(); return; }

    // ── MACRO ──
    if(t.isMacro){
      if(typeof fireMacroTrack==='function') fireMacroTrack(t.macroKey,this.idx);
      this.tracks.splice(idx,1); this.durs.splice(idx,1); this.audios.splice(idx,1);
      this.ci=0; this._updateFdzCount();
      if(this.playing && this.tracks.length) this._startTrack(0);
      else this.playing=false;
      this.render(); return;
    }

    const audio = this.audios[idx];
    if(!audio){ this.playing=false; this.render(); return; }

    // Marquer la piste comme en cours dans allTracks
    t._status = 'playing';

    // Annuler tout timer précédent
    if(this._outTimer){ clearTimeout(this._outTimer); this._outTimer=null; }
    // Token unique pour cette session de lecture
    const tok = ++this._playToken;

    // Positionner au point START
    const inCue = this._inOf(idx);
    try{ audio.currentTime = inCue; }catch(e){}

    // ── Quand le son finit naturellement : marquer done et retirer de tracks ──
    audio.onended = ()=>{
      audio.onended = null;
      if(tok !== this._playToken) return;
      t._status = 'done';
      const pos = this.tracks.indexOf(t);
      if(pos !== -1){
        this._playedTracks.push({...t, _done:true});
        this.tracks.splice(pos,1); this.durs.splice(pos,1); this.audios.splice(pos,1);
      }
      this.ci=0; this._updateFdzCount();
      if(!this.tracks.length) this.playing=false;
      this.render();
    };

    // ── Lancer la lecture ──
    console.log('[PLAY] Tentative lecture piste', idx, 'src:', audio.src.slice(0,60), 'paused:', audio.paused, 'readyState:', audio.readyState);
    audio.play().then(()=>{
      console.log('[PLAY] Lecture démarrée OK, piste', idx);
    }).catch(e=>{ console.warn('[PLAY] ERREUR:', e.name, e.message); });

    // ── Armer le timer au point cible (NEXT si autoNext ON, END sinon) ──
    const arm = ()=>{
      if(tok !== this._playToken || !this.playing) return;
      const totalDur = this.durs[idx]||0;
      const targetCue = _getTargetCue(t, totalDur);
      const elapsed = Math.max(0, audio.currentTime - inCue);
      const delay   = Math.max(0, (targetCue - inCue) - elapsed);
      if(this._outTimer){ clearTimeout(this._outTimer); this._outTimer=null; }
      this._outTimer = setTimeout(()=>{
        _pazHandleTimerFired(this, t, tok);
      }, delay * 1000);
    };

    // Si durée déjà connue : armer immédiatement
    if(this.durs[idx] > 0){
      arm();
    } else {
      // Sinon attendre loadedmetadata
      const onMeta = ()=>{
        audio.removeEventListener('loadedmetadata', onMeta);
        if(tok !== this._playToken || !this.playing) return;
        const dur = audio.duration || 0;
        this.durs[idx] = dur;
        if(t.outCue == null) t.outCue = dur;
        arm();
        this.render(); // met à jour la durée dans la liste
      };
      audio.addEventListener('loadedmetadata', onMeta);
      // Sécurité : si audio.duration déjà dispo (chrome le fait parfois avant loadedmetadata)
      if(audio.duration && !isNaN(audio.duration) && audio.duration > 0){
        audio.removeEventListener('loadedmetadata', onMeta);
        this.durs[idx] = audio.duration;
        if(t.outCue == null) t.outCue = audio.duration;
        arm();
      }
    }

    this.render();
  }

  // Mettre à jour le compteur de fichiers dans la dropzone
  _updateFdzCount(){
    const cfg=CONFIGS[this.idx];
    if(!cfg) return;
    cfg.tracks=this.tracks;
    const n=this.tracks.length;
    const el=document.getElementById(cfg.fdzCount);
    if(el) el.textContent=n?n+' fichier'+(n>1?'s':''):'Aucun fichier';
  }

  togglePlay(){
    if(!this.tracks.length)return;
    if(!this.playing){
      this.playing=true;
      this.ci=0;
      this._chainDone.clear();
      this._startTrack(0);
      this.render();
    } else {
      // Pause — invalider token + annuler timer OUT
      this._playToken++;
      if(this._outTimer){ clearTimeout(this._outTimer); this._outTimer=null; }
      this.audios.forEach(a=>{
        if(a){ a.onended=null; if(!a.paused)a.pause(); }
      });
      this.playing=false;
      this.render();
    }
  }

  stopAll(){
    this._playToken++;
    if(this._outTimer){ clearTimeout(this._outTimer); this._outTimer=null; }
    this.audios.forEach(a=>{
      if(a){ a.onended=null; a.pause(); a.currentTime=0; }
    });
    this.playing=false;
    this.ci=0;
    this._playedTracks=[];
    // Remettre toutes les pistes allTracks en pending (sauf done)
    this.allTracks.forEach(t=>{ if(t._status==='playing') t._status='pending'; });
    this._chainDone.clear();
    const pb=document.getElementById(this.ids.progress);if(pb)pb.value=0;
    this.render();
  }

  toggleAuto(){ /* supprimé — le NEXT global est géré par pazToggleNext() */ }

  nextTrack(){} // désactivé — lecture séquentielle auto
  prevTrack(){} // désactivé — lecture séquentielle auto
  jumpTo(i){ // garde pour usage interne uniquement
    if(this.playing){this.audios.forEach(a=>{if(a&&!a.paused)a.pause();});this.ci=i;this._chainDone.clear();this._startTrack(i);}
    else{this.ci=i;}
    this.render();
  }
}

const D=CONFIGS.map((cfg,i)=>new Diffuser(cfg,i));

// ══════════════════════════════════════════════════════════════
// PAZ — Player Active Zone + Modal Éditeur de Points
// ══════════════════════════════════════════════════════════════

// ── Variables d'état ──
let _pazWvFile    = null;
let _pazLaunchTime = null;
let _pazZoom      = { on:false, s:0, e:1, key:'' };

// ── Accesseurs cues ──
function pazT()    { const d=D[0]; return d.tracks[d.ci]||null; }
function pazPos()  { const a=D[0].audios[D[0].ci]; return (a&&!isNaN(a.currentTime))?a.currentTime:0; }
function pazDur()  { return D[0].durs[D[0].ci]||0; }
function cStart(t) { return t?(t.inCue||0):0; }
function cEnd(t)   { return t?(t.outCue!=null?t.outCue:pazDur()):0; }
function cNext(t)  { return t?(t.nextCue!=null?t.nextCue:cEnd(t)):0; }
function cIntro(t) { return t?(t.introCue!=null?t.introCue:null):null; }

// ── Charger + dessiner la waveform de fond ──
function pazDrawBg(force){
  const d = D[0];
  const t = d.tracks[d.ci]||null;
  if(!t||!t.file){ _pazWvFile=null; return; }
  if(!force && t.file===_pazWvFile) return;

  const bg  = document.getElementById('paz-bg'); if(!bg) return;
  const paz = document.getElementById('paz');    if(!paz) return;
  // Largeur = zone entière moins la colonne countdown (260px)
  const pazW = Math.max(paz.getBoundingClientRect().width, 200);
  const W = Math.max(Math.round(pazW - 260), 100);
  const H = Math.max(paz.getBoundingClientRect().height, paz.offsetHeight, 100) || 160;
  if(W < 10 || H < 10){
    requestAnimationFrame(()=>{ _pazWvFile=null; pazDrawBg(true); });
    return;
  }
  bg.width=W; bg.height=H;
  _pazWvFile = t.file;

  const draw = (data)=>{
    pazPaintBg(bg, data, _pazZoom.on?_pazZoom.s:0, _pazZoom.on?_pazZoom.e:1);
    pazMarkers(); // ← repositionner NEXT/INTRO après chaque redessin
  };

  if(WV_DATA_CACHE[t.file]){ draw(WV_DATA_CACHE[t.file]); return; }
  // Feedback pendant chargement
  const ctx=bg.getContext('2d');
  ctx.fillStyle='rgba(255,255,255,.04)'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(255,255,255,.25)'; ctx.font="11px 'Share Tech Mono',monospace";
  ctx.fillText('⟳ Chargement…',16,H/2+4);
  drawWaveform(document.createElement('canvas'), t.file).then(()=>{
    if(t.file!==_pazWvFile) return;
    const b=document.getElementById('paz-bg'); if(!b) return;
    b.width = Math.max(Math.round(paz.getBoundingClientRect().width - 260), 100);
    b.height= paz.getBoundingClientRect().height || 160;
    if(WV_DATA_CACHE[t.file]) draw(WV_DATA_CACHE[t.file]);
  });
}

function pazPaintBg(canvas, data, vS, vE){
  const W=canvas.width, H=canvas.height;
  if(!W||!H) return;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);
  const total=data.length;
  const s=Math.floor(vS*total), e=Math.floor(vE*total);
  const len=Math.max(1,e-s), step=Math.max(1,Math.floor(len/W));

  // Silhouette
  const gr=ctx.createLinearGradient(0,0,0,H);
  gr.addColorStop(0,'rgba(0,170,220,.16)');
  gr.addColorStop(.5,'rgba(0,210,250,.40)');
  gr.addColorStop(1,'rgba(0,170,220,.16)');
  ctx.fillStyle=gr;
  ctx.beginPath(); ctx.moveTo(0,H/2);
  for(let x=0;x<W;x++){
    let mx=0; for(let j=0;j<step;j++){const v=Math.abs(data[s+x*step+j]||0);if(v>mx)mx=v;}
    ctx.lineTo(x,H/2-mx*(H/2)*.88);
  }
  for(let x=W-1;x>=0;x--){
    let mx=0; for(let j=0;j<step;j++){const v=Math.abs(data[s+x*step+j]||0);if(v>mx)mx=v;}
    ctx.lineTo(x,H/2+mx*(H/2)*.88);
  }
  ctx.closePath(); ctx.fill();

  // Traits
  ctx.strokeStyle='rgba(180,225,255,.78)'; ctx.lineWidth=1;
  for(let x=0;x<W;x++){
    let mn=0,mx=0;
    for(let j=0;j<step;j++){const v=data[s+x*step+j]||0;if(v<mn)mn=v;if(v>mx)mx=v;}
    const y1=Math.round((1-mx)/2*H),y2=Math.round((1-mn)/2*H);
    if(y2>y1){ctx.beginPath();ctx.moveTo(x+.5,y1);ctx.lineTo(x+.5,y2);ctx.stroke();}
  }

  // Barre mini zoom
  const zb=document.getElementById('paz-zoom-bar');
  const zp=document.getElementById('paz-zoom-pos');
  if(_pazZoom.on && zb && zp){
    zb.style.display='block';
    zp.style.left=(_pazZoom.s*100).toFixed(1)+'%';
    zp.style.width=((_pazZoom.e-_pazZoom.s)*100).toFixed(1)+'%';
  } else if(zb){ zb.style.display='none'; }
}

// ── pazRender — titre, cues, waveform, liste ──
function pazRender(){
  const d=D[0], t=pazT(), play=d.playing;

  // Titre
  const tEl=document.getElementById('paz-title');
  if(tEl){
    const tDisp = d.tracks[d.ci]||(d.tracks.length?d.tracks[0]:null);
    if(tDisp&&!tDisp.isMacro){
      tEl.textContent=tDisp.title;
      tEl.style.color=play?'#ffffff':'rgba(200,220,255,.6)';
    } else {
      tEl.textContent='AUCUNE PISTE'; tEl.style.color='rgba(100,120,150,.5)';
    }
  }

  // Heure de lancement
  const lEl=document.getElementById('paz-launch');
  if(lEl) lEl.textContent=_pazLaunchTime||'--:--:--';

  // Cues
  const cEl=document.getElementById('paz-cues');
  if(cEl&&t){
    const parts=['START '+fmtMs(cStart(t))];
    if(t.introCue!=null) parts.push('INTRO '+fmtMs(t.introCue));
    parts.push('NEXT '+fmtMs(cNext(t)));
    parts.push('END '+fmtMs(cEnd(t)));
    cEl.textContent=parts.join('  ·  ');
  } else if(cEl){ cEl.textContent=''; }

  // Waveform
  pazDrawBg(false);
  pazMarkers();
  pazRenderList();
  _pazUpdateNextBtn();
}

// ── pazTick — 80ms ──
function pazTick(){
  const d=D[0], t=pazT();

  // Déclencher waveform si dispo mais pas encore dessinée
  if(t&&t.file&&WV_DATA_CACHE[t.file]&&t.file!==_pazWvFile) pazDrawBg(true);

  if(!d.playing||!t){
    ['paz-red','paz-yellow'].forEach(id=>{const el=document.getElementById(id);if(el){el.style.left='0';el.style.width='0';}});
    const ph=document.getElementById('paz-ph'); if(ph) ph.style.display='none';
    const cd=document.getElementById('paz-cd');
    if(cd){cd.textContent='--:--:--';cd.style.color='#ffffff';cd.style.animation='none';cd.style.textShadow='none';}
    const lb=document.getElementById('paz-cd-lbl');
    if(lb){lb.textContent='NEXT';lb.style.color='rgba(255,255,255,.3)';}
    const pazEl=document.getElementById('paz');
    if(pazEl){pazEl.classList.remove('is-playing');pazEl.style.background='';}
    document.getElementById('diff-header-0')?.classList.remove('is-live');
    document.getElementById('diff-onair-0')?.classList.remove('is-live');
    document.querySelector('.card.is-dark-card')?.classList.remove('is-live-card');
    document.getElementById('c1-progress')?.classList.remove('is-live');
    return;
  }

  const pos=pazPos(), dur=pazDur()||1;
  const inT=cStart(t), endT=cEnd(t), nextT=cNext(t), introT=cIntro(t);

  // Maintenir rouge en lecture
  const pazEl=document.getElementById('paz');
  if(pazEl&&!pazEl.classList.contains('is-playing')) pazEl.classList.add('is-playing');
  const card=document.querySelector('.card.is-dark-card');
  if(card&&!card.classList.contains('is-live-card')) card.classList.add('is-live-card');
  const prog=document.getElementById('c1-progress');
  if(prog&&!prog.classList.contains('is-live')) prog.classList.add('is-live');

  // Progression rouge (inT → pos)
  const rEl=document.getElementById('paz-red');
  if(rEl){
    const span=_pazZoom.on?(_pazZoom.e-_pazZoom.s):1;
    const lPct=_pazZoom.on?(((inT/dur)-_pazZoom.s)/span*100):((inT/dur)*100);
    const wPct=Math.max(0,pos-inT)/dur/span*100;
    rEl.style.left=lPct.toFixed(2)+'%'; rEl.style.width=wPct.toFixed(2)+'%';
  }

  // Zone jaune (inT → introT) — fixe tant que pos < introT
  const yEl=document.getElementById('paz-yellow');
  if(yEl){
    if(introT!=null&&pos<introT){
      const span=_pazZoom.on?(_pazZoom.e-_pazZoom.s):1;
      const lPct=_pazZoom.on?(((inT/dur)-_pazZoom.s)/span*100):((inT/dur)*100);
      const wPct=(introT-inT)/dur/span*100;
      yEl.style.left=lPct.toFixed(2)+'%'; yEl.style.width=Math.max(0,wPct).toFixed(2)+'%';
      yEl.style.display='block';
    } else { yEl.style.display='none'; }
  }

  // Couleur titre
  const tEl=document.getElementById('paz-title');
  if(tEl) tEl.style.color=(introT!=null&&pos<introT)?'#f5c400':'#ffffff';

  // (playhead, progression rouge et décomptes gérés par le rAF dédié)

  // ── ZOOM : approche INTRO (±10s centrés sur INTRO) et NEXT (±20s) ──
  const ZI=10, ZN=20;
  let wantOn=false, wS=0, wE=1, wKey='';
  if(introT!=null&&pos<introT&&(introT-pos)<=ZI){
    // Centrer exactement sur introT : [introT-ZI, introT+ZI]
    wantOn=true; wS=Math.max(0,(introT-ZI)/dur); wE=Math.min(1,(introT+ZI)/dur); wKey='intro';
  } else if(introT!=null&&pos>=introT&&(pos-introT)<=ZI){
    // Juste après le point INTRO : garder la même fenêtre
    wantOn=true; wS=Math.max(0,(introT-ZI)/dur); wE=Math.min(1,(introT+ZI)/dur); wKey='intro+';
  } else if(nextT>0&&pos<nextT&&(nextT-pos)<=ZN){
    // Centrer sur nextT
    wantOn=true; wS=Math.max(0,(nextT-ZN)/dur); wE=Math.min(1,(nextT+ZN)/dur); wKey='next';
  }
  // Appliquer le zoom seulement si l'état cible change
  if(wantOn!==_pazZoom.on||wKey!==_pazZoom.key){
    _pazZoom={on:wantOn,s:wS,e:wE,key:wKey};
    // Démarrer une interpolation douce vers la nouvelle vue
    _pazZoomAnimate(wantOn?wS:0, wantOn?wE:1, wS, wE);
  }
}

// ── Zoom animé (interpolation smooth) ──
let _pazZoomRaf=null;
function _pazZoomAnimate(sFrom, eFrom, sTo, eTo){
  const DUR=600; // ms pour la transition
  const t0=performance.now();
  const sS=sFrom, eS=eFrom;
  if(_pazZoomRaf){ cancelAnimationFrame(_pazZoomRaf); _pazZoomRaf=null; }
  const step=(now)=>{
    const prog=Math.min(1,(now-t0)/DUR);
    // Ease in-out cubic
    const ease=prog<.5?4*prog*prog*prog:1-Math.pow(-2*prog+2,3)/2;
    const curS=sS+(sTo-sS)*ease;
    const curE=eS+(eTo-eS)*ease;
    _pazZoom.s=curS; _pazZoom.e=curE;
    pazDrawBg(true); pazMarkers();
    if(prog<1) _pazZoomRaf=requestAnimationFrame(step);
    else { _pazZoom.s=sTo; _pazZoom.e=eTo; _pazZoomRaf=null; }
  };
  _pazZoomRaf=requestAnimationFrame(step);
}

// ── Marqueurs NEXT / INTRO ──
function pazMarkers(){
  const t=pazT(), dur=pazDur();
  const sec2pct=s=>{
    const r=s/dur;
    const span=_pazZoom.on?(_pazZoom.e-_pazZoom.s):1;
    return _pazZoom.on?((r-_pazZoom.s)/span*100):(r*100);
  };
  const show=(id,pct)=>{
    const el=document.getElementById(id); if(!el) return;
    if(!t||dur<=0||pct<0||pct>100){ el.style.display='none'; return; }
    el.style.display='block'; el.style.left=pct.toFixed(2)+'%';
  };
  if(t&&dur>0){
    show('paz-mn',sec2pct(cNext(t)));
    const iT=cIntro(t);
    show('paz-mi', iT!=null?sec2pct(iT):-1);
  } else {
    ['paz-mn','paz-mi'].forEach(id=>{ const el=document.getElementById(id);if(el)el.style.display='none'; });
  }
}

// ── Liste des pistes — rendu direct et simple ──
function pazRenderList(){
  const d = D[0];
  const list = document.getElementById('paz-list');
  if(!list) return;

  const all = d.allTracks || [];

  if(!all.length){
    list.innerHTML = \`<div style="padding:28px;text-align:center;font-family:var(--mono);font-size:11px;color:#2a3a50;letter-spacing:2px;">— Aucun fichier · Glisse des sons dans la zone PLAYLIST —</div>\`;
    return;
  }

  // ── Calcul des horaires ──
  // La piste playing utilise son heure de lancement réelle (_launchTime)
  // Les pistes pending utilisent un curseur cumulatif
  const now = new Date();
  let cursor = new Date(now);
  const schedules = [];

  // Si une piste joue, le curseur part de la fin estimée de cette piste
  const playingTrack = d.allTracks.find(t=>t._status==='playing');
  if(playingTrack && d.playing){
    const ti = d.tracks.indexOf(playingTrack);
    const audio = ti>=0 ? d.audios[ti] : null;
    const inCue = playingTrack.inCue||0;
    const nextCue = playingTrack.nextCue!=null ? playingTrack.nextCue
                  : (playingTrack.outCue!=null ? playingTrack.outCue : (d.durs[ti]||0));
    const elapsed = audio ? Math.max(0, audio.currentTime - inCue) : 0;
    const remaining = Math.max(0, nextCue - inCue - elapsed);
    cursor = new Date(now.getTime() + remaining*1000);
  }

  d.allTracks.forEach((t, i) => {
    const isDone = t._status==='done';
    const isPlay = t._status==='playing';
    if(isDone){
      // Piste terminée : affiche l'heure de lancement mémorisée
      schedules.push(t._launchTime ? new Date(t._launchTime) : null);
    } else if(isPlay){
      // Piste en cours : affiche l'heure de lancement mémorisée (ou now)
      schedules.push(t._launchTime ? new Date(t._launchTime) : now);
    } else {
      schedules.push(new Date(cursor));
      const ti = d.tracks.indexOf(t);
      const inCue = t.inCue||0;
      const nextCue = t.nextCue!=null ? t.nextCue
                    : (t.outCue!=null ? t.outCue : (ti>=0 ? d.durs[ti]||0 : 0));
      const dur = Math.max(0, nextCue - inCue);
      cursor = new Date(cursor.getTime() + dur*1000);
    }
  });

  const fmtHHMMSS = d => {
    if(!d) return '—:—:—';
    return fmt2(d.getHours())+':'+fmt2(d.getMinutes())+':'+fmt2(d.getSeconds());
  };

  // Construire le HTML en une seule passe
  let html = '';
  all.forEach((t, i) => {
    const isDone   = t._status === 'done';
    const isPlay   = t._status === 'playing';
    const ti       = d.tracks.indexOf(t);
    const isNext   = !isDone && !isPlay && d.playing && ti === 1;
    const durSec   = ti >= 0 ? (d.durs[ti] || 0) : 0;
    const outCue   = t.outCue != null ? t.outCue : durSec;
    const inCue    = t.inCue  || 0;
    const playDur  = Math.max(0, outCue - inCue);
    const durStr   = fmtFull(durSec);
    const cdStr    = fmtFull(playDur);
    const nOn      = t.autoNext !== false;
    const schedStr = fmtHHMMSS(schedules[i]);

    if(isDone){
      const doneSchedStr = t._launchTime ? fmtHHMMSS(new Date(t._launchTime)) : '—:—:—';
      html += \`<div style="display:flex;align-items:center;height:40px;border-bottom:1px solid #0a0f1a;opacity:.28;filter:saturate(0.15);">
        <div style="width:40px;flex-shrink:0;text-align:center;font-family:var(--mono);font-size:11px;color:#3a4050;">✓</div>
        <div style="width:80px;flex-shrink:0;font-family:var(--mono);font-size:10px;color:#3a4050;padding-left:6px;">\${doneSchedStr}</div>
        <div style="width:60px;flex-shrink:0;"></div>
        <div style="flex:1;font-family:var(--display);font-size:15px;font-weight:700;color:#4a5060;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 8px;">\${t.title}</div>
        <div style="width:72px;flex-shrink:0;font-family:var(--mono);font-size:11px;color:#3a4050;text-align:right;">\${durStr}</div>
        <div style="width:88px;flex-shrink:0;font-family:var(--mono);font-size:11px;color:#3a4050;text-align:right;padding-right:10px;">—</div>
        <div style="width:52px;flex-shrink:0;"></div>
        <div style="width:5px;flex-shrink:0;background:\${t.color};align-self:stretch;opacity:.2;"></div>
      </div>\`;
      return;
    }

    const bgCss  = isPlay ? 'background:#1e0808;border-left:3px solid #e03020;'
                 : isNext ? 'background:#081408;border-left:3px solid #006630;'
                 : 'border-left:3px solid transparent;';
    const numTxt = isPlay ? '▶' : isNext ? '▷' : String(i+1);
    const numCol = isPlay ? 'color:#e03020' : isNext ? 'color:#00d96a' : 'color:#5a6880';
    const titleCol = isPlay ? 'color:#ff7070' : isNext ? 'color:#50e880' : 'color:#ddeeff';
    const cdId   = isPlay ? 'id="paz-row-cd-active"' : '';
    const cdCol  = isPlay ? 'color:#ff4040' : 'color:#6a8aaa';
    const schedCol = isPlay ? 'color:#ff7070' : 'color:#3a8aaa';

    const nBadgeColor  = nOn ? '#00d96a' : '#2a3a2a';
    const nBadgeBg     = nOn ? 'rgba(0,60,15,.6)' : 'rgba(0,0,0,.2)';
    const nBadgeBorder = nOn ? '#00d96a' : '#2a3a2a';
    const nBadgeOp     = nOn ? '1' : '.35';
    const nClick       = ti >= 0 ? \`onclick="pazToggleAutoFor(\${ti})"\` : '';
    const nBadge = \`<span \${nClick} style="flex-shrink:0;cursor:pointer;font-family:var(--mono);font-size:8px;font-weight:700;color:\${nBadgeColor};opacity:\${nBadgeOp};background:\${nBadgeBg};border:1px solid \${nBadgeBorder};border-radius:2px;padding:2px 5px;letter-spacing:1px;user-select:none;">NEXT</span>\`;

    const editBtn = ti >= 0 ? \`<button onclick="event.stopPropagation();openEditModal(\${ti})" style="width:24px;background:none;border:none;color:#4a3a70;cursor:pointer;font-size:11px;padding:0;transition:color .1s;" onmouseover="this.style.color='#9b6de5'" onmouseout="this.style.color='#4a3a70'" title="Éditer">✦</button>\` : '';
    const delBtn  = ti >= 0 ? \`<button onclick="event.stopPropagation();diffRemoveTrack(0,\${ti})" style="width:24px;background:none;border:none;color:#3a4050;cursor:pointer;font-size:12px;padding:0;transition:color .1s;" onmouseover="this.style.color='#e03020'" onmouseout="this.style.color='#3a4050'">✕</button>\` : '';

    // Drag & drop pour réordonner — pas de clic pour lancer
    const dragAttrs = ti >= 0 && !isPlay
      ? \`draggable="true"
         ondragstart="plDragStart(event,\${ti})"
         ondragover="event.preventDefault();this.style.background='#0a1a2a'"
         ondragleave="this.style.background=''"
         ondrop="event.preventDefault();this.style.background='';plDragDrop(event,\${ti})"\`
      : '';

    html += \`<div \${dragAttrs} style="display:flex;align-items:center;height:48px;border-bottom:1px solid #1e2028;cursor:\${ti>=0&&!isPlay?'grab':'default'};\${bgCss}position:relative;user-select:none;" \${isPlay ? 'id="paz-row-active"' : ''}>
      \${isPlay ? '<div id="paz-row-prog" style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(120,6,6,.65),rgba(60,2,2,.45));transform-origin:left;transform:scaleX(0);pointer-events:none;z-index:0;"></div>' : ''}
      <div style="position:relative;z-index:1;display:flex;align-items:center;width:100%;">
        <div style="width:40px;flex-shrink:0;text-align:center;font-family:var(--mono);font-size:13px;\${numCol};">\${numTxt}</div>
        <div style="width:80px;flex-shrink:0;font-family:var(--mono);font-size:10px;\${schedCol};padding-left:6px;letter-spacing:.5px;">\${schedStr}</div>
        <div style="width:60px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">\${nBadge}</div>
        <div style="flex:1;font-family:var(--display);font-size:17px;font-weight:700;\${titleCol};letter-spacing:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;padding:0 8px;">\${t.title}</div>
        <div style="width:72px;flex-shrink:0;font-family:var(--mono);font-size:11px;color:#5a7a9a;text-align:right;">\${durStr}</div>
        <div style="width:88px;flex-shrink:0;font-family:var(--mono);font-size:13px;\${cdCol};text-align:right;padding-right:10px;" \${cdId}>\${cdStr}</div>
        \${editBtn}\${delBtn}
        <div style="width:5px;flex-shrink:0;background:\${t.color};align-self:stretch;"></div>
      </div>
    </div>\`;
  });

  list.innerHTML = html;
}

// ── Réordonnancement par drag & drop dans la playlist ──
let _plDragIdx = null;

function plDragStart(e, fromIdx){
  _plDragIdx = fromIdx;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(fromIdx));
}

function plDragDrop(e, toIdx){
  e.preventDefault();
  if(_plDragIdx === null || _plDragIdx === toIdx) return;
  const d = D[0];
  // Déplacer dans tracks, durs, audios, allTracks
  const moveArr = (arr, from, to) => {
    const item = arr.splice(from, 1)[0];
    arr.splice(to, 0, item);
  };
  moveArr(d.tracks, _plDragIdx, toIdx);
  moveArr(d.durs,   _plDragIdx, toIdx);
  moveArr(d.audios, _plDragIdx, toIdx);
  // Synchroniser allTracks (seulement les pending/playing)
  const activeInAll = d.allTracks.filter(t => t._status !== 'done');
  const fromT = activeInAll[_plDragIdx];
  const toT   = activeInAll[toIdx];
  if(fromT && toT){
    const ai = d.allTracks.indexOf(fromT);
    const bi = d.allTracks.indexOf(toT);
    if(ai !== -1 && bi !== -1){
      d.allTracks.splice(ai, 1);
      d.allTracks.splice(bi, 0, fromT);
    }
  }
  // Ajuster ci si nécessaire
  if(d.ci === _plDragIdx) d.ci = toIdx;
  else if(_plDragIdx < d.ci && toIdx >= d.ci) d.ci--;
  else if(_plDragIdx > d.ci && toIdx <= d.ci) d.ci++;
  _plDragIdx = null;
  pazRenderList();
}

// ── Barre de progression dans la liste ──


// ── AUTO NEXT — état global + par piste ──
// Chaque piste t a t.autoNext (bool).
// Le bouton global ⬥ NEXT active/désactive toutes les pistes.
// Si t.autoNext=true  → au point NEXT on enchaîne automatiquement
// Si t.autoNext=false → la lecture continue jusqu'au point END (outCue), puis s'arrête

let _pazNextGlobal = false; // état global (reflète si toutes les pistes sont ON)

function pazToggleNext(){
  // Inverser l'état global
  _pazNextGlobal = !_pazNextGlobal;
  // Appliquer à toutes les pistes
  D[0].tracks.forEach(t=>{ if(!t.isMacro) t.autoNext = _pazNextGlobal; });
  // Réarmer le timer si en cours de lecture
  if(D[0].playing) _pazRearmTimer();
  _pazUpdateNextBtn();
  pazRenderList();
}

function pazToggleAutoFor(idx){
  const t = D[0].tracks[idx]; if(!t||t.isMacro) return;
  t.autoNext = !t.autoNext;
  // Mettre à jour l'état global : ON si toutes les pistes non-macro sont ON
  _pazSyncGlobal();
  // Réarmer le timer si c'est la piste active
  if(D[0].playing && idx === D[0].ci) _pazRearmTimer();
  _pazUpdateNextBtn();
  pazRenderList();
}

function _pazSyncGlobal(){
  const nonMacro = D[0].tracks.filter(t=>!t.isMacro);
  if(!nonMacro.length){ _pazNextGlobal=false; return; }
  _pazNextGlobal = nonMacro.every(t=>t.autoNext!==false);
}

// Réarme le timer d'enchaînement pour la piste en cours (après changement d'état NEXT)
// NE redémarre JAMAIS le son — repart juste de la position courante
function _pazRearmTimer(){
  const d = D[0];
  if(!d.playing) return;
  const t = d.tracks[d.ci]; if(!t) return;
  const audio = d.audios[d.ci]; if(!audio || audio.paused) return;
  if(d._outTimer){ clearTimeout(d._outTimer); d._outTimer=null; }
  const tok = d._playToken;
  const inCue = d._inOf(d.ci);
  const targetCue = _getTargetCue(t, d.durs[d.ci]||0);
  // Délai calculé depuis la position ACTUELLE de l'audio — jamais depuis 0
  const elapsed = Math.max(0, audio.currentTime - inCue);
  const delay = Math.max(0, (targetCue - inCue) - elapsed);
  if(delay <= 0){
    // Déjà dépassé — déclencher immédiatement mais sans redémarrer
    _pazHandleTimerFired(d, t, tok);
    return;
  }
  d._outTimer = setTimeout(()=>{
    if(tok !== d._playToken || !d.playing) return;
    _pazHandleTimerFired(d, t, tok);
  }, delay * 1000);
}

// Calcule le point cible selon l'état autoNext de la piste
function _getTargetCue(t, totalDur){
  if(t.autoNext !== false){
    // NEXT ON → point nextCue si défini, sinon outCue, sinon fin
    if(t.nextCue!=null && t.nextCue>0) return t.nextCue;
  }
  // NEXT OFF ou pas de nextCue → point END (outCue ou fin totale)
  if(t.outCue!=null && t.outCue>0) return t.outCue;
  return totalDur||0;
}

// Ce qui se passe quand le timer se déclenche
function _pazHandleTimerFired(d, t, tok){
  if(tok !== d._playToken || !d.playing) return;
  if(t.autoNext !== false && d.tracks.length > 1){
    t._status = 'done';
    const pos = d.tracks.indexOf(t);
    if(pos !== -1){
      d._playedTracks.push({...t, _done:true});
      d.tracks.splice(pos,1); d.durs.splice(pos,1); d.audios.splice(pos,1);
      d._updateFdzCount();
    }
    d.ci=0;
    d._startTrack(0);
  } else {
    // NEXT OFF : juste rendre l'UI, la lecture continue naturellement jusqu'à onended
    d.render();
  }
}

function _pazUpdateNextBtn(){
  const btn = document.getElementById('paz-next-btn'); if(!btn) return;
  const nonMacro = D[0].tracks.filter(t=>!t.isMacro);
  const allOn = nonMacro.length > 0 && nonMacro.every(t=>t.autoNext!==false);
  const someOn = nonMacro.some(t=>t.autoNext!==false);
  if(allOn){
    btn.textContent = '⬥ NEXT ON';
    btn.style.color = 'var(--green)';
    btn.style.borderColor = 'var(--green)';
    btn.style.background = 'rgba(0,80,20,.55)';
    btn.style.opacity = '1';
    btn.style.boxShadow = '0 0 8px rgba(0,217,106,.35)';
  } else if(someOn){
    btn.textContent = '⬥ NEXT ~';
    btn.style.color = '#a0d070';
    btn.style.borderColor = '#507030';
    btn.style.background = 'rgba(0,40,10,.4)';
    btn.style.opacity = '0.85';
    btn.style.boxShadow = 'none';
  } else {
    btn.textContent = '⬥ NEXT';
    btn.style.color = '#3a4a3a';
    btn.style.borderColor = 'rgba(40,60,40,.5)';
    btn.style.background = 'rgba(0,10,4,.4)';
    btn.style.opacity = '.55';
    btn.style.boxShadow = 'none';
  }
}

// Compat (ancienne ref dans pazRender)


// ── Patches D[0] ──
const _r0=D[0].render.bind(D[0]);
D[0].render=function(){ _r0(); pazRender(); pazRenderList(); };

const _s0=D[0]._startTrack.bind(D[0]);
D[0]._startTrack=function(i){
  console.log('[PLAY] _startTrack appelé, i:', i, 'tracks:', D[0].tracks.length);
  _pazWvFile=null;
  _pazZoom={on:false,s:0,e:1,key:''};
  _pazLaunchTime=nowClock();
  const newT = D[0].tracks[i];
  if(newT) newT._launchTime = Date.now();
  const tEl = document.getElementById('paz-title');
  if(tEl && newT && !newT.isMacro){
    tEl.textContent = newT.title;
    tEl.style.color = '#ffffff';
  }
  // Cacher immédiatement les marqueurs de l'ancienne piste
  ['paz-mn','paz-mi'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.style.display='none';
  });
  // Redessin waveform + marqueurs correctement positionnés
  requestAnimationFrame(()=>{
    _pazWvFile=null;
    pazDrawBg(true); // appelle pazMarkers() en interne après le dessin
    if(newT && newT.file && !WV_DATA_CACHE[newT.file]){
      drawWaveform(document.createElement('canvas'), newT.file).then(()=>{
        if(D[0].tracks[D[0].ci]===newT){ _pazWvFile=null; pazDrawBg(true); }
      });
    }
    pazRenderList();
  });
  _s0(i);
  // Tout le module devient rouge
  document.getElementById('paz')?.classList.add('is-playing');
  document.getElementById('diff-header-0')?.classList.add('is-live');
  document.getElementById('diff-onair-0')?.classList.add('is-live');
  document.querySelector('.card.is-dark-card')?.classList.add('is-live-card');
  document.getElementById('c1-progress')?.classList.add('is-live');
};

const _add0=D[0].addTracks.bind(D[0]);
D[0].addTracks=function(newTracks){
  _pazWvFile=null;
  _add0(newTracks); // peuple this.tracks ET this.allTracks
  // Titre immédiat dans la PAZ
  const tEl=document.getElementById('paz-title');
  const t0=D[0].tracks[D[0].ci]||D[0].tracks[0];
  if(tEl && t0 && !t0.isMacro){
    tEl.textContent=t0.title;
    tEl.style.color=D[0].playing?'#ffffff':'rgba(200,220,255,.6)';
  } else if(tEl && D[0].allTracks.length){
    // Fallback : premier élément de allTracks
    const first=D[0].allTracks.find(t=>!t.isMacro);
    if(first){ tEl.textContent=first.title; tEl.style.color='rgba(200,220,255,.6)'; }
  }
  _pazUpdateNextBtn();
  pazRenderList(); // appelé APRÈS _add0 → allTracks est garanti peuplé
};

// Patch _outOf : retourne le point cible selon autoNext de la piste
const _out0=D[0]._outOf.bind(D[0]);
D[0]._outOf=function(i){
  const t=this.tracks[i]; if(!t) return 0;
  const audio=this.audios[i];
  let totalDur=this.durs[i]||0;
  if(!totalDur && audio && audio.duration && !isNaN(audio.duration) && audio.duration>0){
    this.durs[i]=audio.duration; totalDur=audio.duration;
    if(t.outCue==null) t.outCue=audio.duration;
  }
  return _getTargetCue(t, totalDur);
};

// Redimensionner la waveform si la fenêtre change
window.addEventListener('resize',()=>{ _pazWvFile=null; pazDrawBg(true); });

// Initialiser l'état du bouton NEXT au démarrage
_pazUpdateNextBtn();

// ── RAF dédié au playhead (60fps, indépendant du setInterval 80ms) ──
(function pazPhRaf(){
  requestAnimationFrame(pazPhRaf);
  const d=D[0]; if(!d.playing) return;
  const a=D[0].audios[D[0].ci]; if(!a||a.paused) return;
  const pos=a.currentTime, dur=D[0].durs[D[0].ci]||1;
  const t=pazT(); if(!t) return;

  // Playhead dans la zone active PAZ
  const ph=document.getElementById('paz-ph');
  if(ph){
    const span=_pazZoom.on?(_pazZoom.e-_pazZoom.s):1;
    const pct=_pazZoom.on?(((pos/dur)-_pazZoom.s)/span*100):((pos/dur)*100);
    if(pct>=0&&pct<=100.5){ ph.style.display='block'; ph.style.left=pct.toFixed(3)+'%'; }
    else ph.style.display='none';
  }

  // Progression rouge (fluide)
  const rEl=document.getElementById('paz-red');
  if(rEl){
    const inT=cStart(t);
    const span=_pazZoom.on?(_pazZoom.e-_pazZoom.s):1;
    const lPct=_pazZoom.on?(((inT/dur)-_pazZoom.s)/span*100):((inT/dur)*100);
    const wPct=Math.max(0,pos-inT)/dur/span*100;
    rEl.style.left=lPct.toFixed(3)+'%'; rEl.style.width=wPct.toFixed(3)+'%';
  }

  // Barre de progression dans la liste
  const prog=document.getElementById('paz-row-prog');
  if(prog){
    const inT=cStart(t), nextT=cNext(t), span2=nextT-inT||1;
    const ratio=Math.min(1,Math.max(0,(pos-inT)/span2));
    prog.style.transform='scaleX('+ratio.toFixed(4)+')';
  }

  // Décompte (fluide, pas seulement au tick 80ms)
  const cd=document.getElementById('paz-cd');
  const lb=document.getElementById('paz-cd-lbl');
  const introT=cIntro(t), nextT2=cNext(t);
  const totalDur2=D[0].durs[D[0].ci]||0;
  const targetCue2 = (typeof _getTargetCue==='function') ? _getTargetCue(t, totalDur2) : nextT2;
  if(cd){
    const isIntro=introT!=null&&pos<introT;
    if(isIntro){
      // En INTRO : jaune, pas de clignotement
      const r=Math.max(0,introT-pos);
      cd.textContent=fmtFull(r);
      cd.style.color='#e8b800';
      cd.style.animation='none';
      cd.style.textShadow='0 0 20px rgba(232,184,0,.4)';
      if(lb){lb.textContent='INTRO';lb.style.color='#e8b800';}
    } else {
      // En lecture : rouge vif, clignotant à 20s
      const r=Math.max(0,targetCue2-pos);
      cd.textContent=fmtFull(r);
      const isNear = r <= 20 && r > 0;
      cd.style.color='#e03020';
      cd.style.textShadow=isNear?'0 0 24px rgba(220,48,32,.7)':'0 0 16px rgba(220,48,32,.35)';
      cd.style.animation=isNear?'cd-blink .5s step-start infinite':'none';
      if(lb){lb.textContent=t.autoNext!==false?'NEXT':'END';lb.style.color='#e03020';}
    }
  }

  // Zone PAZ : fond rouge pendant la lecture
  const pazEl=document.getElementById('paz');
  if(pazEl) pazEl.classList.add('is-playing');
  const hdr=document.getElementById('diff-header-0');
  if(hdr) hdr.classList.add('is-live');

  // Décompte dans la liste
  const cdR=document.getElementById('paz-row-cd-active');
  if(cdR) cdR.textContent=fmtFull(Math.max(0,targetCue2-pos));
})();


// Rafraîchir les horaires de la playlist toutes les secondes
setInterval(()=>{ if(D[0].allTracks.length) pazRenderList(); }, 1000);

// Init
setTimeout(()=>{ pazRender(); },200);

// ══════════════════════════════════════════════════════════════
// MODAL ÉDITEUR DE POINTS
// ══════════════════════════════════════════════════════════════
const EM={trackIdx:null,dur:0,audio:null,playing:false,drag:null,raf:null,vs:0,ve:1};

function openEditModal(idx){
  const d=D[0];
  const ti=(idx!==undefined)?idx:d.ci;
  const t=d.tracks[ti]; if(!t||t.isMacro) return;
  EM.trackIdx=ti; EM.dur=d.durs[ti]||0; EM.vs=0; EM.ve=1;
  if(EM.audio){audioUnregister(EM.audio);EM.audio.pause();}
  EM.audio=new Audio(t.file); EM.playing=false;
  audioRegisterPfl(EM.audio); // pré-écoute sur PFL
  document.getElementById('em-title').textContent=t.title;
  const modal=document.getElementById('edit-modal');
  modal.style.display='flex';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    emResize(); emDraw(); emHandles(); emZones(); emTc(); emPlayBtn();
  }));
  emStartRaf();
}

function closeEditModal(){
  emStop(); if(EM.raf){cancelAnimationFrame(EM.raf);EM.raf=null;}
  document.getElementById('edit-modal').style.display='none';
  pazRender();
}

function emResize(){
  const z=document.getElementById('em-wv'); if(!z) return;
  const cv=document.getElementById('em-cv'); if(!cv) return;
  const W=z.getBoundingClientRect().width||860;
  const H=Math.max(160,Math.round(W*0.22));
  cv.width=Math.round(W); cv.height=H;
  z.style.height=H+'px';
}

function emDraw(){
  const cv=document.getElementById('em-cv'); if(!cv) return;
  const W=cv.width,H=cv.height;
  const ctx=cv.getContext('2d');
  ctx.fillStyle='#01020a'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(20,40,80,.7)'; ctx.lineWidth=1;
  [.25,.5,.75].forEach(y=>{ctx.beginPath();ctx.moveTo(0,y*H+.5);ctx.lineTo(W,y*H+.5);ctx.stroke();});
  const t=D[0].tracks[EM.trackIdx]; if(!t) return;
  // Mettre à jour la durée si disponible
  if(!EM.dur && D[0].durs[EM.trackIdx]) EM.dur=D[0].durs[EM.trackIdx];
  if(WV_DATA_CACHE[t.file]){
    emPaint(ctx,WV_DATA_CACHE[t.file],W,H);
    emHandles(); emZones();
    _emDrawMinimap(WV_DATA_CACHE[t.file],W);
  } else {
    ctx.fillStyle='rgba(0,212,240,.45)'; ctx.font="11px 'Share Tech Mono',monospace";
    ctx.fillText('⟳ Décodage audio…',18,H/2+4);
    drawWaveform(document.createElement('canvas'),t.file).then(()=>{
      if(EM.trackIdx===null) return;
      const t2=D[0].tracks[EM.trackIdx]; if(!t2||t2.file!==t.file) return;
      if(!EM.dur && D[0].durs[EM.trackIdx]) EM.dur=D[0].durs[EM.trackIdx];
      emResize(); emDraw();
    });
  }
}

function emPaint(ctx,data,W,H){
  const total=data.length;
  const s=Math.floor(EM.vs*total),e=Math.floor(EM.ve*total);
  const len=Math.max(1,e-s),step=Math.max(1,Math.floor(len/W));
  const gr=ctx.createLinearGradient(0,0,0,H);
  gr.addColorStop(0,'rgba(0,160,210,.16)'); gr.addColorStop(.5,'rgba(0,210,250,.42)'); gr.addColorStop(1,'rgba(0,160,210,.16)');
  ctx.fillStyle=gr;
  ctx.beginPath(); ctx.moveTo(0,H/2);
  for(let x=0;x<W;x++){let mx=0;for(let j=0;j<step;j++){const v=Math.abs(data[s+x*step+j]||0);if(v>mx)mx=v;}ctx.lineTo(x,H/2-mx*(H/2)*.88);}
  for(let x=W-1;x>=0;x--){let mx=0;for(let j=0;j<step;j++){const v=Math.abs(data[s+x*step+j]||0);if(v>mx)mx=v;}ctx.lineTo(x,H/2+mx*(H/2)*.88);}
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(0,212,240,.82)'; ctx.lineWidth=1;
  for(let x=0;x<W;x++){
    let mn=0,mx=0;
    for(let j=0;j<step;j++){const v=data[s+x*step+j]||0;if(v<mn)mn=v;if(v>mx)mx=v;}
    const y1=Math.round((1-mx)/2*H),y2=Math.round((1-mn)/2*H);
    if(y2>y1){ctx.beginPath();ctx.moveTo(x+.5,y1);ctx.lineTo(x+.5,y2);ctx.stroke();}
  }
}

function emSec2x(s){
  const cv=document.getElementById('em-cv'); if(!cv) return 0;
  const dur=EM.dur||1, span=EM.ve-EM.vs||1;
  return ((s/dur-EM.vs)/span)*cv.width;
}
function emX2sec(x){
  const cv=document.getElementById('em-cv'); if(!cv) return 0;
  const dur=EM.dur||1, span=EM.ve-EM.vs||1;
  return Math.max(0,Math.min(dur,(EM.vs+x/cv.width*span)*dur));
}

function emHandles(){
  const t=EM.trackIdx!==null?D[0].tracks[EM.trackIdx]:null; if(!t) return;
  const cv=document.getElementById('em-cv'); if(!cv) return;
  const place=(id,sec,show)=>{
    const el=document.getElementById(id); if(!el) return;
    const x=emSec2x(sec);
    if(!show||x<-10||x>cv.width+10){el.style.display='none';return;}
    el.style.display='block'; el.style.left=x+'px';
  };
  place('em-h-start',cStart(t),true);
  place('em-h-end',cEnd(t),true);
  place('em-h-next',cNext(t),true);
  place('em-h-intro',t.introCue!=null?t.introCue:0,t.introCue!=null);
}

function emZones(){
  const t=EM.trackIdx!==null?D[0].tracks[EM.trackIdx]:null; if(!t) return;
  const cv=document.getElementById('em-cv'); if(!cv) return;
  const W=cv.width;
  const z=(id,s,e,show)=>{
    const el=document.getElementById(id); if(!el) return;
    if(!show){el.style.display='none';return;}
    const x1=Math.max(0,emSec2x(s)), x2=Math.min(W,emSec2x(e));
    el.style.left=x1+'px'; el.style.width=Math.max(0,x2-x1)+'px'; el.style.display='block';
  };
  z('em-z-body',cStart(t),cEnd(t),true);
  z('em-z-intro',cStart(t),t.introCue??0,t.introCue!=null);
}

function emTc(){
  const t=EM.trackIdx!==null?D[0].tracks[EM.trackIdx]:null;
  const sv=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  sv('em-v-start',t?fmtMs(cStart(t)):'—');
  sv('em-v-intro',t?(t.introCue!=null?fmtMs(t.introCue):'—'):'—');
  sv('em-v-next',t?fmtMs(cNext(t)):'—');
  sv('em-v-end',t?fmtMs(cEnd(t)):'—');
}

function emStartRaf(){
  if(EM.raf) cancelAnimationFrame(EM.raf);
  const tick=()=>{
    EM.raf=requestAnimationFrame(tick);
    const a=EM.audio; if(!a) return;
    const pos=a.currentTime, dur=EM.dur||1;
    const ph=document.getElementById('em-ph');
    if(ph){ const x=emSec2x(pos); ph.style.display='block'; ph.style.left=x+'px'; }
  };
  tick();
}

function emTogglePlay(){
  if(!EM.audio) return;
  const btn=document.getElementById('em-play-btn');
  if(EM.playing){
    EM.audio.pause(); EM.playing=false;
    if(btn){btn.textContent='▶ PLAY';btn.style.background='linear-gradient(180deg,#0a4a1a,#052810)';btn.style.borderColor='#2a7038';btn.style.color='#60ff90';}
  } else {
    EM.audio.play(); EM.playing=true;
    if(btn){btn.textContent='❙❙ PAUSE';btn.style.background='linear-gradient(180deg,#2a3a00,#141e00)';btn.style.borderColor='#6a8a00';btn.style.color='#ccff40';}
  }
}
function emStop(){
  if(!EM.audio) return;
  EM.audio.pause(); EM.audio.currentTime=0; EM.playing=false; emPlayBtn();
}
function emPlayBtn(){
  const btn=document.getElementById('em-play-btn'); if(!btn) return;
  btn.textContent='▶ PLAY'; btn.style.background='linear-gradient(180deg,#0a4a1a,#052810)'; btn.style.borderColor='#2a7038'; btn.style.color='#60ff90';
}
function emGoTo(type){
  const t=EM.trackIdx!==null?D[0].tracks[EM.trackIdx]:null; if(!t||!EM.audio) return;
  const map={start:cStart(t),end:cEnd(t),next:cNext(t),intro:t.introCue};
  if(map[type]!=null) EM.audio.currentTime=map[type];
}
function emSetHere(type){
  const t=EM.trackIdx!==null?D[0].tracks[EM.trackIdx]:null; if(!t||!EM.audio) return;
  const pos=EM.audio.currentTime;
  if(type==='start') t.inCue=pos;
  if(type==='end')   t.outCue=pos;
  if(type==='next')  t.nextCue=pos;
  if(type==='intro') t.introCue=pos;
  emHandles(); emZones(); emTc(); pazMarkers();
}

// Clic waveform → curseur
document.addEventListener('click',e=>{
  if(EM.drag) return;
  const cv=document.getElementById('em-cv'); if(!cv) return;
  if(!e.target.closest('#em-wv')) return;
  const rect=cv.getBoundingClientRect();
  const x=(e.clientX-rect.left)*(cv.width/rect.width);
  if(EM.audio) EM.audio.currentTime=emX2sec(x);
});

// Drag poignées
function emStartDrag(e,type){ e.preventDefault(); e.stopPropagation(); EM.drag=type; }
document.addEventListener('mousemove',e=>{
  if(!EM.drag) return;
  const cv=document.getElementById('em-cv'); if(!cv) return;
  const rect=cv.getBoundingClientRect();
  const x=(e.clientX-rect.left)*(cv.width/rect.width);
  const t=EM.trackIdx!==null?D[0].tracks[EM.trackIdx]:null; if(!t) return;
  const pos=emX2sec(x);
  if(EM.drag==='start') t.inCue=pos;
  if(EM.drag==='end')   t.outCue=pos;
  if(EM.drag==='next')  t.nextCue=pos;
  if(EM.drag==='intro') t.introCue=pos;
  emHandles(); emZones(); emTc();
});
document.addEventListener('mouseup',()=>{
  if(EM.drag){
    EM.drag=null; pazMarkers();
    // Redessiner pour mettre à jour la minimap après le drag
    const t=EM.trackIdx!==null?D[0].tracks[EM.trackIdx]:null;
    if(t&&WV_DATA_CACHE[t.file]){
      const cv=document.getElementById('em-cv');
      if(cv){ const ctx=cv.getContext('2d'); ctx.fillStyle='#01020a'; ctx.fillRect(0,0,cv.width,cv.height); ctx.strokeStyle='rgba(20,40,80,.7)'; ctx.lineWidth=1; [.25,.5,.75].forEach(y=>{ctx.beginPath();ctx.moveTo(0,y*cv.height+.5);ctx.lineTo(cv.width,y*cv.height+.5);ctx.stroke();}); emPaint(ctx,WV_DATA_CACHE[t.file],cv.width,cv.height); emHandles(); emZones(); _emDrawMinimap(WV_DATA_CACHE[t.file],cv.width); }
    }
  }
});
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){const m=document.getElementById('edit-modal');if(m&&m.style.display!=='none')closeEditModal();} });

// ── Zoom molette dans l'éditeur ──
(function setupEmWheel(){
  // Attendre que le DOM soit prêt
  const attach=()=>{
    const wv=document.getElementById('em-wv'); if(!wv) return;
    wv.addEventListener('wheel', e=>{
      e.preventDefault();
      const cv=document.getElementById('em-cv'); if(!cv) return;
      const data=EM.trackIdx!==null&&D[0].tracks[EM.trackIdx]?WV_DATA_CACHE[D[0].tracks[EM.trackIdx].file]:null;
      if(!data) return;

      // Position du curseur en ratio [0,1] sur la vue courante
      const rect=cv.getBoundingClientRect();
      const mx=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
      const cur_s=EM.vs, cur_e=EM.ve, cur_span=cur_e-cur_s;

      // Facteur de zoom : molette vers le haut = zoom in
      const ZOOM_SPEED=0.15;
      const factor=e.deltaY<0 ? (1-ZOOM_SPEED) : (1+ZOOM_SPEED);
      const new_span=Math.min(1, Math.max(0.002, cur_span*factor));

      // Centrer le zoom sur la position du curseur
      const pivot=cur_s+mx*cur_span;
      let ns=pivot-mx*new_span;
      let ne=pivot+(1-mx)*new_span;
      // Clamp dans [0,1]
      if(ns<0){ ne=Math.min(1,ne-ns); ns=0; }
      if(ne>1){ ns=Math.max(0,ns-(ne-1)); ne=1; }
      EM.vs=ns; EM.ve=ne;

      // Redessiner
      const c=cv.getContext('2d');
      c.fillStyle='#01020a'; c.fillRect(0,0,cv.width,cv.height);
      c.strokeStyle='rgba(20,40,80,.7)'; c.lineWidth=1;
      [.25,.5,.75].forEach(y=>{c.beginPath();c.moveTo(0,y*cv.height+.5);c.lineTo(cv.width,y*cv.height+.5);c.stroke();});
      emPaint(c,data,cv.width,cv.height);
      emHandles(); emZones(); emTc();

      // Minimap : afficher la fenêtre de zoom en bas du canvas
      _emDrawMinimap(data, cv.width);
    }, {passive:false});
  };
  // Attacher immédiatement si possible, sinon au premier openEditModal
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',attach);
  else attach();
})();

function _emDrawMinimap(data, W){
  // Affiche une miniature en bas du canvas montrant la zone zoomée
  const cv=document.getElementById('em-cv'); if(!cv||!data) return;
  const H=cv.height, ctx=cv.getContext('2d');
  const MH=18; // hauteur de la minimap
  // Fond
  ctx.fillStyle='rgba(0,0,10,.75)'; ctx.fillRect(0,H-MH,W,MH);
  // Waveform résumée (vue complète)
  const step=Math.max(1,Math.floor(data.length/W));
  ctx.strokeStyle='rgba(0,160,200,.5)'; ctx.lineWidth=1;
  for(let x=0;x<W;x++){
    let mn=0,mx2=0; for(let j=0;j<step;j++){const v=data[x*step+j]||0;if(v<mn)mn=v;if(v>mx2)mx2=v;}
    const y1=H-MH+Math.round((1-mx2)/2*MH), y2=H-MH+Math.round((1-mn)/2*MH);
    if(y2>y1){ctx.beginPath();ctx.moveTo(x+.5,y1);ctx.lineTo(x+.5,y2);ctx.stroke();}
  }
  // Fenêtre de zoom en surbrillance
  ctx.fillStyle='rgba(0,212,240,.18)';
  ctx.fillRect(EM.vs*W, H-MH, (EM.ve-EM.vs)*W, MH);
  ctx.strokeStyle='rgba(0,212,240,.6)'; ctx.lineWidth=1;
  ctx.strokeRect(EM.vs*W+.5, H-MH+.5, (EM.ve-EM.vs)*W-1, MH-1);
}


// Supprimer une piste d'un diffuseur
function diffRemoveTrack(diffIdx, trackIdx){
  const d=D[diffIdx];
  if(!d||!d.tracks.length) return;
  if(d.ci===trackIdx && d.playing){ d.stopAll(); }
  const t=d.tracks[trackIdx];
  if(t && t.file && t.file.startsWith('blob:')) URL.revokeObjectURL(t.file);
  // Retirer de allTracks aussi
  if(t){
    const ai=d.allTracks.indexOf(t);
    if(ai!==-1) d.allTracks.splice(ai,1);
  }
  d.tracks.splice(trackIdx, 1);
  d.durs.splice(trackIdx, 1);
  const removedAudio = d.audios.splice(trackIdx, 1)[0];
  if(removedAudio) audioUnregister(removedAudio);
  if(d.ci >= d.tracks.length) d.ci = Math.max(0, d.tracks.length-1);
  const cfg=CONFIGS[diffIdx];
  if(cfg){ cfg.tracks=d.tracks; }
  const fdzId=cfg?cfg.fdzCount:null;
  if(fdzId){
    const n=d.tracks.length;
    const el=document.getElementById(fdzId);
    if(el) el.textContent=n?n+' fichier'+(n>1?'s':''):'Aucun fichier';
  }
  d.render();
  if(diffIdx===0) pazRenderList();
}

// ── VU Mètre ──
const NUM_BARS=24; let sharedCtx=null;

function rowColor(i,t){const p=i/t;return p>.85?'#e03020':p>.65?'#f5c400':'#00d96a';}

function getCtx(){if(!sharedCtx)sharedCtx=new(window.AudioContext||window.webkitAudioContext)();return sharedCtx;}
function getRMS(an){const d=new Float32Array(an.fftSize);an.getFloatTimeDomainData(d);let s=0;for(const v of d)s+=v*v;return Math.sqrt(s/d.length);}
const TARGET_LUFS=-23;
function applyEBU(gn,rL,rR){const r=Math.max(rL,rR);if(r<0.0001)return;gn.gain.setTargetAtTime(Math.min(4,Math.max(0.05,Math.pow(10,(TARGET_LUFS-20*Math.log10(r))/20))),getCtx().currentTime,0.5);}
function paintBars(idL,idR,aL,aR,dbId,gn,neutralColor){
  const rL=getRMS(aL),rR=getRMS(aR);
  if(gn)applyEBU(gn,rL,rR);
  [{id:idL,rms:rL},{id:idR,rms:rR}].forEach(({id,rms})=>{
    const db=rms>0?Math.max(-60,20*Math.log10(rms)):-60;
    const act=Math.round(((db+60)/60)*NUM_BARS);
    document.querySelectorAll(\`#\${id} .vu-row\`).forEach((r,i)=>r.style.opacity=i<act?'1':'0.1');
  });
  const db=Math.max(rL,rR)>0?Math.max(-60,20*Math.log10(Math.max(rL,rR))):-60;
  const el=document.getElementById(dbId);
  if(el){el.textContent=db>-60?db.toFixed(1):'—∞';el.style.color=db>-3?'#e03020':db>-10?'#f5c400':(neutralColor||'#00d4f0');}
}






// ── DIFF 1 — source unique → VU sticky ──
const _t0_orig=D[0].togglePlay.bind(D[0]);
D[0].togglePlay=function(){
  console.log('[PLAY] D[0].togglePlay appelé, tracks:', D[0].tracks.length, 'playing:', D[0].playing);
  getCtx().resume();
  _t0_orig();
};


function vuLoop(){
  requestAnimationFrame(vuLoop);
  if(vu1) paintBars('vu1-L','vu1-R', vu1.aL, vu1.aR, 'vu1-db', vu1.gn, '#00d4f0');
}
vuLoop();


setInterval(()=>{D.forEach(d=>d.tick());rdvTick();pazTick();},80);


function rdvTick(){}

// ══════════════════════════════════════
// VU STRIPS LATÉRAUX SUR CHAQUE DIFFUSEUR
// ══════════════════════════════════════
const STRIP_NUM_BARS = 16;

// Peindre un strip vertical à partir d'un analyser
function paintStrip(stripId, analyser){
  const el = document.getElementById(stripId);
  if(!el || !analyser) return;
  const bars = el.querySelectorAll('.vu-strip-bar');
  if(!bars.length) return;
  const data = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(data);
  let s=0; for(const v of data) s+=v*v;
  const rms = Math.sqrt(s/data.length);
  const db = rms>0 ? Math.max(-60, 20*Math.log10(rms)) : -60;
  const active = Math.round(((db+60)/60)*STRIP_NUM_BARS);
  bars.forEach((b,i) => b.style.opacity = i < active ? '1' : '0.08');
}

// Analysers dédiés aux strips (séparés des analyseurs VU-mètres)
// ════════════════════════════════════════════════════════════════
// ROUTING AUDIO — PROG (antenne) / PFL (pré-écoute / edit)
// Utilise setSinkId() — Chrome 110+ requis
// ════════════════════════════════════════════════════════════════

const AUDIO_ROUTING = {
  progSinkId: '',
  pflSinkId:  '',
  progElements: [],
  pflElements:  [],
};

async function audioEnumerateDevices() {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {});
    const devices = await navigator.mediaDevices.enumerateDevices();
    const outputs = devices.filter(d => d.kind === 'audiooutput');
    ['prog-output-select', 'pfl-output-select'].forEach(id => {
      const sel = document.getElementById(id); if(!sel) return;
      const current = sel.value;
      sel.innerHTML = '<option value="">— Sortie par défaut —</option>';
      outputs.forEach(dev => {
        const opt = document.createElement('option');
        opt.value = dev.deviceId;
        opt.textContent = dev.label || \`Sortie audio \${dev.deviceId.slice(0,6)}…\`;
        sel.appendChild(opt);
      });
      if(current) sel.value = current;
    });
  } catch(err) { console.warn('[AUDIO] Énumération:', err); }
}



async function audioRegister(el, type) {
  const key    = type === 'prog' ? 'progElements' : 'pflElements';
  const sinkKey = type === 'prog' ? 'progSinkId'  : 'pflSinkId';
  if(!AUDIO_ROUTING[key].includes(el)) AUDIO_ROUTING[key].push(el);
  const sinkId = AUDIO_ROUTING[sinkKey];
  if(sinkId && 'setSinkId' in el) { try { await el.setSinkId(sinkId); } catch(e) {} }
}

function audioUnregister(el) {
  ['progElements','pflElements'].forEach(k => {
    const idx = AUDIO_ROUTING[k].indexOf(el);
    if(idx !== -1) AUDIO_ROUTING[k].splice(idx, 1);
  });
}

// Énumérer au chargement
if('setSinkId' in HTMLAudioElement.prototype) {
  window.addEventListener('load', audioEnumerateDevices);
} else {
  window.addEventListener('load', () => {
    const row = document.getElementById('prog-output-select')?.closest('[style*="border-right"]');
    if(row) { row.innerHTML = '<span style="font-family:var(--mono);font-size:8px;color:#e07800;">⚠ setSinkId non supporté</span>'; }
  });
}

// ── PROG : éléments audio du diffuseur principal ──
// Patché après création dans handleFiles / addTracks
function audioRegisterProg(el) { audioRegister(el, 'prog'); }
function audioRegisterPfl(el)  { audioRegister(el, 'pfl'); }

const STRIP_ANALYSERS = {}; // {d0, d1, nat, sat, dab, hz}


// Boucle de mise à jour des strips
function stripLoop(){
  requestAnimationFrame(stripLoop);
  if(!STRIP_ANALYSERS.d0 && vu1) STRIP_ANALYSERS.d0 = vu1.aL;
  paintStrip('vu-strip-d0', STRIP_ANALYSERS.d0);
}
stripLoop();


// ══════════════════════════════════════════════════════════════
// MODAL ÉDITEUR WAVEFORM
// ══════════════════════════════════════════════════════════════
let _wvModal={diffIdx:null, trackIdx:null, wvId:null, dur:1, dragging:null};

function wvModalOpen(wvId, diffIdx, trackIdx){
  const d=D[diffIdx]; if(!d) return;
  const t=d.tracks[trackIdx]; if(!t||!t.file) return;
  const dur=d.durs[trackIdx]||1;
  _wvModal={diffIdx,trackIdx,wvId,dur,dragging:null,playing:false};

  // Titre
  document.getElementById('wv-modal-title').textContent=t.title;

  // Canvas principal
  const cv=document.getElementById('wv-modal-canvas');
  cv.width=780; cv.height=180;
  const data=WV_DATA_CACHE[t.file];
  if(data){ drawWaveformFromData(cv,data,0,1); }
  else { drawWaveform(cv,t.file).then(()=>wvModalRedraw()); }

  // Overview
  const zv=document.getElementById('wv-modal-zoom');
  zv.width=780; zv.height=36;
  if(data) drawWaveformFromData(zv,data,0,1);

  // Timecodes initiaux
  _wvModalUpdateTC();

  // Poignées
  _wvModalUpdateHandles();

  // Inputs
  document.getElementById('wv-modal-in-input').value=t.inCue.toFixed(3);
  document.getElementById('wv-modal-out-input').value=(t.outCue??dur).toFixed(3);

  document.getElementById('wv-modal').classList.add('open');
  _wvModalBindDrag();
  _wvModalVULoop();
}

function _wvModalUpdateTC(){
  const d=D[_wvModal.diffIdx]; if(!d) return;
  const t=d.tracks[_wvModal.trackIdx]; if(!t) return;
  const dur=_wvModal.dur;
  const inT=t.inCue||0;
  const outT=t.outCue??dur;
  const selDur=Math.max(0,outT-inT);
  // Position de l'audio si en lecture
  const audio=d.audios[_wvModal.trackIdx];
  const pos=audio?audio.currentTime:inT;
  const rem=Math.max(0,outT-pos);
  const tc=s=>{const ms=Math.round((s%1)*1000);const sec=Math.floor(s%60);const min=Math.floor(s/60);return fmt2(min)+':'+fmt2(sec)+'.'+String(ms).padStart(3,'0');};
  const el=id=>document.getElementById(id);
  if(el('wvm-tc-pos'))  el('wvm-tc-pos').textContent  = tc(pos);
  if(el('wvm-tc-in'))   el('wvm-tc-in').textContent   = tc(inT);
  if(el('wvm-tc-out'))  el('wvm-tc-out').textContent  = tc(outT);
  if(el('wvm-tc-dur'))  el('wvm-tc-dur').textContent  = tc(selDur);
  if(el('wvm-tc-rem'))  el('wvm-tc-rem').textContent  = tc(rem);
  if(el('wvm-tc-total')) el('wvm-tc-total').textContent = tc(dur);
  // data-tc sur les poignées
  const inH=document.getElementById('wv-modal-in');
  const outH=document.getElementById('wv-modal-out');
  if(inH)  inH.setAttribute('data-tc',  'IN  '+tc(inT));
  if(outH) outH.setAttribute('data-tc', 'OUT '+tc(outT));
}

// VU loop dans le modal (lecture de l'audio en preview)
let _wvModalVUFrame=null;
function _wvModalVULoop(){
  if(_wvModalVUFrame) cancelAnimationFrame(_wvModalVUFrame);
  const step=()=>{
    if(!document.getElementById('wv-modal').classList.contains('open')) return;
    _wvModalVUFrame=requestAnimationFrame(step);
    _wvModalUpdateTC();
    // VU depuis l'analyseur du diffuseur si disponible
    const diffIdx=_wvModal.diffIdx;
    const vuSrc=vu1;
    const barL=document.getElementById('wvm-vu-L');
    const barR=document.getElementById('wvm-vu-R');
    if(vuSrc&&barL&&barR){
      const rL=getRMS(vuSrc.aL),rR=getRMS(vuSrc.aR);
      const pctL=Math.min(100,Math.max(0,((Math.max(-60,rL>0?20*Math.log10(rL):-60)+60)/60)*100));
      const pctR=Math.min(100,Math.max(0,((Math.max(-60,rR>0?20*Math.log10(rR):-60)+60)/60)*100));
      barL.style.width=pctL+'%';
      barR.style.width=pctR+'%';
    }
    // Playhead
    const d=D[_wvModal.diffIdx]; if(!d) return;
    const t=d.tracks[_wvModal.trackIdx]; if(!t) return;
    const audio=d.audios[_wvModal.trackIdx];
    if(audio&&!audio.paused){
      const pct=(audio.currentTime/_wvModal.dur)*100;
      const ph=document.getElementById('wv-modal-ph');
      if(ph){ph.style.display='block';ph.style.left=pct+'%';}
    }
  };
  _wvModalVUFrame=requestAnimationFrame(step);
}

function wvModalPlayPause(){
  const d=D[_wvModal.diffIdx]; if(!d) return;
  const audio=d.audios[_wvModal.trackIdx]; if(!audio) return;
  const btn=document.getElementById('wvm-play-btn');
  if(audio.paused){
    if(audio.currentTime<(d.tracks[_wvModal.trackIdx]?.inCue||0)||
       audio.currentTime>=(d.tracks[_wvModal.trackIdx]?.outCue??_wvModal.dur)){
      audio.currentTime=d.tracks[_wvModal.trackIdx]?.inCue||0;
    }
    audio.play().catch(e=>console.warn(e));
    if(btn){btn.textContent='⏸';btn.classList.add('green');}
  }else{
    audio.pause();
    if(btn){btn.textContent='▶';btn.classList.remove('green');}
  }
}
function wvModalStop(){
  const d=D[_wvModal.diffIdx]; if(!d) return;
  const audio=d.audios[_wvModal.trackIdx]; if(!audio) return;
  audio.pause();
  audio.currentTime=d.tracks[_wvModal.trackIdx]?.inCue||0;
  const btn=document.getElementById('wvm-play-btn');
  if(btn){btn.textContent='▶';btn.classList.remove('green');}
  const ph=document.getElementById('wv-modal-ph');
  if(ph) ph.style.display='none';
}
function wvModalGoIn(){
  const d=D[_wvModal.diffIdx]; if(!d) return;
  const audio=d.audios[_wvModal.trackIdx]; if(!audio) return;
  audio.currentTime=d.tracks[_wvModal.trackIdx]?.inCue||0;
}
function wvModalGoOut(){
  const d=D[_wvModal.diffIdx]; if(!d) return;
  const audio=d.audios[_wvModal.trackIdx]; if(!audio) return;
  const t=d.tracks[_wvModal.trackIdx];
  audio.currentTime=Math.max(0,(t?.outCue??_wvModal.dur)-1);
}

function wvModalClose(){
  wvModalStop();
  document.getElementById('wv-modal').classList.remove('open');
  if(_wvModalVUFrame){cancelAnimationFrame(_wvModalVUFrame);_wvModalVUFrame=null;}
  _wvModal={diffIdx:null,trackIdx:null,wvId:null,dur:1,dragging:null};
}

function wvModalRedraw(){
  const d=D[_wvModal.diffIdx]; if(!d) return;
  const t=d.tracks[_wvModal.trackIdx]; if(!t) return;
  const dur=_wvModal.dur;
  const data=WV_DATA_CACHE[t.file]; if(!data) return;
  const inR=t.inCue/dur;
  const outR=(t.outCue??dur)/dur;
  const pad=0.04;
  const s=Math.max(0,inR-pad);
  const e=Math.min(1,outR+pad);
  const cv=document.getElementById('wv-modal-canvas');
  drawWaveformFromData(cv,data,s,e);
  // Zoom region sur le mini
  const zr=document.getElementById('wv-modal-zoom-region');
  if(zr){ zr.style.left=(s*100)+'%'; zr.style.width=((e-s)*100)+'%'; }
  _wvModalUpdateHandles(s,e);
  _wvModalUpdateTC();
}

function _wvModalUpdateHandles(startR=0,endR=1){
  const d=D[_wvModal.diffIdx]; if(!d) return;
  const t=d.tracks[_wvModal.trackIdx]; if(!t) return;
  const dur=_wvModal.dur;
  const range=endR-startR;
  const inPct=range>0?((t.inCue/dur-startR)/range*100).toFixed(2):0;
  const outPct=range>0?(((t.outCue??dur)/dur-startR)/range*100).toFixed(2):100;
  const inH=document.getElementById('wv-modal-in');
  const outH=document.getElementById('wv-modal-out');
  const pre=document.getElementById('wv-modal-pre');
  const post=document.getElementById('wv-modal-post');
  if(inH) inH.style.left=Math.max(0,Math.min(98,inPct))+'%';
  if(outH) outH.style.left=Math.max(0,Math.min(98,outPct))+'%';
  if(pre) pre.style.width=Math.max(0,inPct)+'%';
  if(post) post.style.left=Math.max(0,outPct)+'%';
  // Stocker pour le drag
  _wvModal._startR=startR; _wvModal._endR=endR;
  // Inputs
  document.getElementById('wv-modal-in-input').value=t.inCue.toFixed(3);
  document.getElementById('wv-modal-out-input').value=(t.outCue??_wvModal.dur).toFixed(3);
}

function _wvModalBindDrag(){
  const wrap=document.getElementById('wv-modal-wrap');
  const inH=document.getElementById('wv-modal-in');
  const outH=document.getElementById('wv-modal-out');

  const move=(type,clientX)=>{
    const rect=wrap.getBoundingClientRect();
    const pct=Math.min(1,Math.max(0,(clientX-rect.left)/rect.width));
    const d=D[_wvModal.diffIdx]; if(!d) return;
    const t=d.tracks[_wvModal.trackIdx]; if(!t) return;
    const dur=_wvModal.dur;
    const sR=_wvModal._startR||0;
    const eR=_wvModal._endR||1;
    const realPct=sR+pct*(eR-sR);
    const realTime=realPct*dur;
    if(type==='in'){
      t.inCue=Math.min(realTime,(t.outCue??dur)-0.05);
      t.inCue=Math.max(0,t.inCue);
    } else {
      t.outCue=Math.max(realTime,t.inCue+0.05);
      t.outCue=Math.min(dur,t.outCue);
    }
    wvModalRedraw();
    // Sync waveform dans la playlist
    const wvId=_wvModal.wvId;
    const dur2=dur;
    const inPct=(t.inCue/dur2*100).toFixed(1);
    const outPct=Math.min(98,(t.outCue??dur2)/dur2*100).toFixed(1);
    const hdIn=document.getElementById(wvId+'-in');
    const hdOut=document.getElementById(wvId+'-out');
    const pr=document.getElementById(wvId+'-pre');
    const po=document.getElementById(wvId+'-post');
    const lIn=document.getElementById(wvId+'-inlbl');
    const lOut=document.getElementById(wvId+'-outlbl');
    if(hdIn)hdIn.style.left=inPct+'%';
    if(hdOut)hdOut.style.left=outPct+'%';
    if(pr)pr.style.width=inPct+'%';
    if(po)po.style.left=outPct+'%';
    if(lIn)lIn.textContent='IN '+fmtMs(t.inCue);
    if(lOut)lOut.textContent='OUT '+fmtMs(t.outCue??dur2);
  };

  inH._wvBound=true;
  ['in','out'].forEach(type=>{
    const el=type==='in'?inH:outH;
    if(el._wvBound&&el._wvBound!==true) return;
    el._wvBound='done';
    el.addEventListener('mousedown',e=>{e.stopPropagation();_wvModal.dragging=type;});
    el.addEventListener('touchstart',e=>{e.stopPropagation();_wvModal.dragging=type;},{passive:true});
  });
  // Listeners globaux (une seule fois)
  if(!window._wvModalListeners){
    window._wvModalListeners=true;
    document.addEventListener('mousemove',e=>{if(_wvModal.dragging)move(_wvModal.dragging,e.clientX);});
    document.addEventListener('mouseup',()=>{_wvModal.dragging=null;});
    document.addEventListener('touchmove',e=>{if(_wvModal.dragging)move(_wvModal.dragging,e.touches[0].clientX);},{passive:true});
    document.addEventListener('touchend',()=>{_wvModal.dragging=null;});
  }
}

function wvModalSetIn(){
  const d=D[_wvModal.diffIdx]; if(!d) return;
  const t=d.tracks[_wvModal.trackIdx]; if(!t) return;
  const v=parseFloat(document.getElementById('wv-modal-in-input').value);
  if(isNaN(v)) return;
  t.inCue=Math.max(0,Math.min(v,(t.outCue??_wvModal.dur)-0.05));
  wvModalRedraw();
}
function wvModalSetOut(){
  const d=D[_wvModal.diffIdx]; if(!d) return;
  const t=d.tracks[_wvModal.trackIdx]; if(!t) return;
  const v=parseFloat(document.getElementById('wv-modal-out-input').value);
  if(isNaN(v)) return;
  t.outCue=Math.min(_wvModal.dur,Math.max(v,t.inCue+0.05));
  wvModalRedraw();
}
function wvModalReset(){
  const d=D[_wvModal.diffIdx]; if(!d) return;
  const t=d.tracks[_wvModal.trackIdx]; if(!t) return;
  t.inCue=0; t.outCue=_wvModal.dur;
  _wvModal._startR=0; _wvModal._endR=1;
  const cv=document.getElementById('wv-modal-canvas');
  const data=WV_DATA_CACHE[t.file];
  if(cv&&data) drawWaveformFromData(cv,data,0,1);
  wvModalRedraw();
}
function wvModalApply(){
  // Les changements sont déjà appliqués en temps réel
  // Re-render la ligne dans la playlist pour mettre les labels à jour
  const d=D[_wvModal.diffIdx]; if(!d) return;
  d.render();
  wvModalClose();
}
// Fermer en cliquant sur l'overlay
document.getElementById('wv-modal').addEventListener('click',e=>{
  if(e.target===document.getElementById('wv-modal')) wvModalClose();
});


// ══════════════════════════════════════════════════════════════
// SYSTÈME DE PLAYLISTS PERSISTANTES
// ══════════════════════════════════════════════════════════════
// Structure sauvegardée dans localStorage :
// PL_STORAGE_KEY → [ { id, name, tracks:[{title,dur,inCue,outCue,color,fileRef}] } ]
// fileRef = null (fichier à restaurer) ou blob URL (session courante)

const PL_STORAGE_KEY = 'radio_playlists_v1';
const DIFF_LABELS_PL = ['DIFF SECOURS','DIFF 2','PUB SAT','PUB DAB+','PUB Hz','NATIONAL'];

let playlists = [];          // tableau en mémoire
let plPendingRestore = null; // index playlist en attente de restauration

// ── Charger depuis localStorage ──
function plLoad(){
  try{
    const raw = localStorage.getItem(PL_STORAGE_KEY);
    playlists = raw ? JSON.parse(raw) : [];
  }catch(e){ playlists = []; }
}

// ── Sauvegarder ──
function plSave(){
  // Ne sauvegarder que les métadonnées (pas les blob URLs qui ne survivent pas)
  const toSave = playlists.map(pl=>({
    ...pl,
    tracks: pl.tracks.map(t=>({ title:t.title, dur:t.dur||0, inCue:t.inCue||0, outCue:t.outCue||null, color:t.color||'#1a6b3a', fileRef:null }))
  }));
  localStorage.setItem(PL_STORAGE_KEY, JSON.stringify(toSave));
}

// ── Générer un ID unique ──


// ── Créer une playlist ──


// ── Supprimer une playlist ──
function plDelete(id){
  if(!confirm('Supprimer cette playlist ?')) return;
  playlists = playlists.filter(p=>p.id!==id);
  plSave(); plRender();
}

// ── Renommer ──
function plRename(id, newName){
  const pl = playlists.find(p=>p.id===id);
  if(pl){ pl.name=newName.trim()||pl.name; plSave(); plRender(); }
}

// ── Toggle collapsed ──
function plToggle(id){
  const pl = playlists.find(p=>p.id===id);
  if(pl){ pl.open=!pl.open; plRender(); }
}

// ── Supprimer une piste d'une playlist ──
function plRemoveTrack(plId, ti){
  const pl = playlists.find(p=>p.id===plId);
  if(pl){ pl.tracks.splice(ti,1); plSave(); plRender(); }
}

// ── Monter / Descendre une piste ──
function plMoveTrack(plId, ti, dir){
  const pl = playlists.find(p=>p.id===plId);
  if(!pl) return;
  const ni = ti + dir;
  if(ni<0||ni>=pl.tracks.length) return;
  [pl.tracks[ti], pl.tracks[ni]] = [pl.tracks[ni], pl.tracks[ti]];
  plSave(); plRender();
}

// ── Ajouter des fichiers à une playlist ──
function plAddFiles(files, plId){
  const pl = playlists.find(p=>p.id===plId);
  if(!pl) return;
  Array.from(files).filter(f=>f.type.startsWith('audio/')).forEach(f=>{
    const blobUrl = URL.createObjectURL(f);
    pl.tracks.push({
      title: f.name.replace(/\\.[^/.]+$/,''),
      dur: 0,
      inCue: 0, outCue: null,
      color: COLORS[pl.tracks.length % COLORS.length],
      fileRef: blobUrl,
      _file: f   // référence temporaire pour durée
    });
    // Lire la durée
    const a = new Audio(blobUrl);
    a.addEventListener('loadedmetadata', ()=>{
      const t = pl.tracks.find(tr=>tr.fileRef===blobUrl);
      if(t){ t.dur=a.duration; plSave(); plRender(); }
    });
  });
  plSave(); plRender();
}

// ── Envoyer une playlist dans un diffuseur ──
function plSendToDiff(plId, diffIdx){
  const pl = playlists.find(p=>p.id===plId);
  if(!pl||!pl.tracks.length){ alert('Playlist vide.'); return; }
  // Vérifier que tous les fichiers sont disponibles (fileRef non null)
  const missing = pl.tracks.filter(t=>!t.fileRef);
  if(missing.length){
    alert(missing.length + ' fichier(s) non chargé(s). Clique sur "RESTAURER LES FICHIERS" pour les recharger.');
    plPendingRestore = plId;
    document.getElementById('pl-restore-btn').style.display='inline-block';
    return;
  }
  // Injecter dans le diffuseur
  const d = D[diffIdx];
  const cfg = CONFIGS[diffIdx];
  const newTracks = pl.tracks.map(t=>({
    file: t.fileRef,
    title: t.title,
    color: t.color,
    inCue: t.inCue||0,
    outCue: t.outCue||null
  }));
  cfg.tracks = [...cfg.tracks, ...newTracks];
  const total = cfg.tracks.length;
  const fdzEl = document.getElementById(cfg.fdzCount);
  if(fdzEl) fdzEl.textContent = total+' fichier'+(total>1?'s':'');
  d.addTracks(newTracks);
  // Feedback
  alert('✓ ' + pl.tracks.length + ' pistes envoyées dans ' + DIFF_LABELS_PL[diffIdx]);
}

// ── Restaurer les fichiers après rechargement ──


// ── Vérifier si des fichiers manquent (au chargement) ──
function plCheckMissing(){
  const hasMissing = playlists.some(pl=>pl.tracks.some(t=>!t.fileRef));
  document.getElementById('pl-restore-btn').style.display = hasMissing ? 'inline-block' : 'none';
}

// ── Rendu HTML ──
function plRender(){
  const container = document.getElementById('pl-list');
  if(!container) return;
  if(!playlists.length){
    container.innerHTML = '<p style="font-family:var(--mono);font-size:9px;color:var(--txt-mute);letter-spacing:1px">Aucune playlist. Crée-en une ci-dessus.</p>';
    return;
  }
  container.innerHTML = playlists.map(pl=>{
    const missingCount = pl.tracks.filter(t=>!t.fileRef).length;
    const tracksHtml = pl.tracks.map((t,i)=>\`
      <div class="pl-track-row\${t.fileRef?'':' missing'}">
        <span class="pl-track-num">\${i+1}</span>
        <div class="color-bar" style="background:\${t.color};width:3px;height:14px;border-radius:1px;flex-shrink:0"></div>
        <span class="pl-track-title" title="\${t.title}">\${t.fileRef?'':' ⚠ '}\${t.title}</span>
        <span class="pl-track-dur">\${t.dur?fmtFull(t.dur):'--:--'}</span>
        <button class="pl-track-del" onclick="plMoveTrack('\${pl.id}',\${i},-1)" title="Monter">↑</button>
        <button class="pl-track-del" onclick="plMoveTrack('\${pl.id}',\${i},+1)" title="Descendre">↓</button>
        <button class="pl-track-del" onclick="plRemoveTrack('\${pl.id}',\${i})" title="Supprimer">✕</button>
      </div>\`).join('');

    const sendBtns = DIFF_LABELS_PL.map((lbl,i)=>
      \`<button class="pl-btn send" onclick="plSendToDiff('\${pl.id}',\${i})">→ \${lbl}</button>\`
    ).join('');

    const inputId = 'pl-file-input-'+pl.id;
    const dropId  = 'pl-drop-'+pl.id;

    return \`<div class="pl-card\${pl.open?'':' pl-collapsed'}" id="plcard-\${pl.id}">
  <div class="pl-card-header" onclick="plToggle('\${pl.id}')">
    <span class="pl-chevron">▾</span>
    <span class="pl-name" ondblclick="event.stopPropagation();plStartRename('\${pl.id}',this)" title="Double-clic pour renommer">\${pl.name}</span>
    <span class="pl-count">\${pl.tracks.length} piste\${pl.tracks.length!==1?'s':''} \${missingCount?'<span style="color:var(--red)">· '+missingCount+' manquant(s)</span>':''}</span>
    <div class="pl-actions" onclick="event.stopPropagation()">
      <button class="pl-btn" onclick="plExport('\${pl.id}')">⬇ JSON</button>
      <button class="pl-btn danger" onclick="plDelete('\${pl.id}')">✕ SUPPR.</button>
    </div>
  </div>
  <div class="pl-body">
    \${pl.tracks.length ? tracksHtml : '<p style="font-family:var(--mono);font-size:9px;color:var(--txt-mute);padding:4px 0">Aucune piste. Glisse des fichiers ci-dessous.</p>'}
    <input type="file" id="\${inputId}" multiple accept="audio/*" style="display:none"
      onchange="plAddFiles(this.files,'\${pl.id}')">
    <div class="pl-drop-zone" id="\${dropId}"
      onclick="document.getElementById('\${inputId}').click()"
      ondragover="event.preventDefault();this.classList.add('drag-over')"
      ondragleave="this.classList.remove('drag-over')"
      ondrop="event.preventDefault();this.classList.remove('drag-over');plAddFiles(event.dataTransfer.files,'\${pl.id}')">
      ⊕ Ajouter des fichiers audio
    </div>
    <div class="pl-send-row">
      <span style="font-family:var(--mono);font-size:9px;color:var(--txt-mute);letter-spacing:1px;align-self:center">ENVOYER DANS →</span>
      \${sendBtns}
    </div>
  </div>
</div>\`;
  }).join('');
}

// ── Renommer inline (double-clic) ──
function plStartRename(id, el){
  const oldName = el.textContent;
  const inp = document.createElement('input');
  inp.className = 'pl-name-edit';
  inp.value = oldName;
  el.replaceWith(inp);
  inp.focus(); inp.select();
  const done=()=>{ plRename(id, inp.value||oldName); };
  inp.onblur = done;
  inp.onkeydown = e=>{ if(e.key==='Enter') inp.blur(); if(e.key==='Escape'){inp.value=oldName;inp.blur();} };
}

// ── Export JSON ──
function plExport(id){
  const pl = playlists.find(p=>p.id===id);
  if(!pl) return;
  const data = { ...pl, tracks: pl.tracks.map(({title,dur,inCue,outCue,color})=>({title,dur,inCue,outCue,color})) };
  const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = pl.name.replace(/[^a-z0-9]/gi,'_')+'.json';
  a.click();
}

// ── Init ──
function plInit(){
  plLoad();
  plCheckMissing();
  plRender();
}
plInit();


// ════════════════════════════════════════════════════════════════
// RACCOURCIS CLAVIER
// ════════════════════════════════════════════════════════════════
document.addEventListener('keydown', function(e) {
  // Ignorer si focus sur un input/textarea/select
  const tag = document.activeElement?.tagName?.toLowerCase();
  if(tag === 'input' || tag === 'textarea' || tag === 'select') return;
  // Ignorer si modale ouverte
  const modal = document.getElementById('edit-modal');
  if(modal && modal.style.display !== 'none') return;

  if(e.key === '0') {
    e.preventDefault();
    D[0].togglePlay();
  }
});


<\/script>
<!-- ══ MODAL ÉDITEUR DE POINTS ══ -->
<div id="edit-modal" style="display:none;position:fixed;inset:0;background:rgba(0,4,18,.92);z-index:9999;align-items:center;justify-content:center;flex-direction:column;">
  <div style="background:#10121a;border:2px solid #1e3a8a;border-radius:10px;width:92vw;max-width:980px;max-height:94vh;box-shadow:0 0 80px rgba(0,30,180,.3);overflow:hidden;display:flex;flex-direction:column;font-family:var(--mono);">

    <!-- Titre -->
    <div style="background:#1c1e26;border-bottom:1px solid #1e3a8a;padding:8px 16px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
      <div style="display:flex;align-items:center;gap:14px;">
        <span style="font-size:9px;color:#4a6aaa;letter-spacing:3px;">✦ ÉDITEUR DE POINTS</span>
        <span id="em-title" style="font-family:var(--display);font-size:17px;font-weight:700;color:var(--cyan);letter-spacing:2px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:55vw;">—</span>
      </div>
      <button onclick="closeEditModal()" style="background:transparent;border:1px solid #4a1010;color:#e03020;font-family:var(--mono);font-size:10px;padding:4px 12px;border-radius:2px;cursor:pointer;transition:background .1s;" onmouseover="this.style.background='#2a1010'" onmouseout="this.style.background='transparent'">✕ FERMER</button>
    </div>

    <!-- Waveform -->
    <div id="em-wv" style="position:relative;background:#000;flex-shrink:0;overflow:hidden;">
      <canvas id="em-cv" style="display:block;width:100%;"></canvas>
      <!-- Zones -->
      <div id="em-z-body"  style="position:absolute;top:0;bottom:0;left:0;width:0;background:rgba(140,8,8,.20);z-index:1;pointer-events:none;display:none;"></div>
      <div id="em-z-intro" style="position:absolute;top:0;bottom:0;left:0;width:0;background:rgba(180,140,0,.28);z-index:2;pointer-events:none;display:none;"></div>
      <!-- Playhead -->
      <div id="em-ph" style="position:absolute;top:0;bottom:0;width:2px;background:rgba(255,255,180,.85);z-index:8;pointer-events:none;display:block;left:0;box-shadow:0 0 4px rgba(255,255,150,.4);"></div>
      <!-- Poignées — zone de hit 28px, trait 2px centré -->
      <div id="em-h-start" onmousedown="emStartDrag(event,'start')" style="position:absolute;top:0;bottom:0;width:28px;transform:translateX(-14px);cursor:ew-resize;z-index:6;touch-action:none;display:none;">
        <div style="position:absolute;left:13px;top:0;bottom:0;width:2px;background:#00d4f0;pointer-events:none;"></div>
        <div style="position:absolute;left:18px;top:6px;font-size:8px;color:#00d4f0;background:rgba(0,0,0,.9);padding:2px 5px;border-radius:2px;white-space:nowrap;pointer-events:none;letter-spacing:1px;">START</div>
      </div>
      <div id="em-h-intro" onmousedown="emStartDrag(event,'intro')" style="position:absolute;top:0;bottom:0;width:28px;transform:translateX(-14px);cursor:ew-resize;z-index:7;touch-action:none;display:none;">
        <div style="position:absolute;left:13px;top:0;bottom:0;width:2px;background:#f5c400;pointer-events:none;"></div>
        <div style="position:absolute;right:18px;top:6px;font-size:8px;color:#f5c400;background:rgba(0,0,0,.9);padding:2px 5px;border-radius:2px;white-space:nowrap;pointer-events:none;letter-spacing:1px;">INTRO</div>
      </div>
      <div id="em-h-next" onmousedown="emStartDrag(event,'next')" style="position:absolute;top:0;bottom:0;width:28px;transform:translateX(-14px);cursor:ew-resize;z-index:7;touch-action:none;display:none;">
        <div style="position:absolute;left:13px;top:0;bottom:0;width:2px;background:#00d96a;pointer-events:none;"></div>
        <div style="position:absolute;left:18px;bottom:6px;font-size:8px;color:#00d96a;background:rgba(0,0,0,.9);padding:2px 5px;border-radius:2px;white-space:nowrap;pointer-events:none;letter-spacing:1px;">NEXT</div>
      </div>
      <div id="em-h-end" onmousedown="emStartDrag(event,'end')" style="position:absolute;top:0;bottom:0;width:28px;transform:translateX(-14px);cursor:ew-resize;z-index:6;touch-action:none;display:none;">
        <div style="position:absolute;left:13px;top:0;bottom:0;width:2px;background:#e03020;pointer-events:none;"></div>
        <div style="position:absolute;right:18px;bottom:6px;font-size:8px;color:#e03020;background:rgba(0,0,0,.9);padding:2px 5px;border-radius:2px;white-space:nowrap;pointer-events:none;letter-spacing:1px;">END</div>
      </div>
    </div>

    <!-- Timecodes -->
    <div style="background:#04070f;border-top:1px solid #0e1c3a;border-bottom:1px solid #0e1c3a;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;flex-shrink:0;">
      <div style="display:flex;flex-direction:column;align-items:center;padding:8px 0;border-right:1px solid #0e1c3a;gap:3px;">
        <span style="font-size:8px;color:#00d4f0;letter-spacing:2px;">START</span>
        <span id="em-v-start" style="font-size:15px;color:#00d4f0;letter-spacing:1px;">—</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;padding:8px 0;border-right:1px solid #0e1c3a;gap:3px;">
        <span style="font-size:8px;color:#f5c400;letter-spacing:2px;">INTRO</span>
        <span id="em-v-intro" style="font-size:15px;color:#f5c400;letter-spacing:1px;">—</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;padding:8px 0;border-right:1px solid #0e1c3a;gap:3px;">
        <span style="font-size:8px;color:#00d96a;letter-spacing:2px;">NEXT</span>
        <span id="em-v-next" style="font-size:15px;color:#00d96a;letter-spacing:1px;">—</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;padding:8px 0;gap:3px;">
        <span style="font-size:8px;color:#e03020;letter-spacing:2px;">END</span>
        <span id="em-v-end" style="font-size:15px;color:#e03020;letter-spacing:1px;">—</span>
      </div>
    </div>

    <!-- Transport -->
    <div style="background:#030610;padding:10px 14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex-shrink:0;">
      <button id="em-play-btn" onclick="emTogglePlay()" style="min-width:80px;background:linear-gradient(180deg,#0a4a1a,#052810);border:1px solid #2a7038;border-radius:3px;color:#60ff90;font-family:var(--mono);font-size:11px;padding:6px 14px;cursor:pointer;letter-spacing:1px;">▶ PLAY</button>
      <button onclick="emStop()" style="background:linear-gradient(180deg,#3a0808,#200404);border:1px solid #6a2020;border-radius:3px;color:#ff6060;font-family:var(--mono);font-size:11px;padding:6px 14px;cursor:pointer;letter-spacing:1px;">■ STOP</button>
      <div style="width:1px;height:22px;background:#1e2840;"></div>
      <button onclick="emGoTo('start')" style="background:#020510;border:1px solid #384058;border-radius:2px;color:#00d4f0;font-family:var(--mono);font-size:9px;padding:4px 9px;cursor:pointer;letter-spacing:1px;">|◀ START</button>
      <button onclick="emGoTo('intro')" style="background:#020510;border:1px solid #3a3000;border-radius:2px;color:#f5c400;font-family:var(--mono);font-size:9px;padding:4px 9px;cursor:pointer;letter-spacing:1px;">|◀ INTRO</button>
      <button onclick="emGoTo('next')" style="background:#020510;border:1px solid #004a20;border-radius:2px;color:#00d96a;font-family:var(--mono);font-size:9px;padding:4px 9px;cursor:pointer;letter-spacing:1px;">|◀ NEXT</button>
      <button onclick="emGoTo('end')" style="background:#020510;border:1px solid #3a1010;border-radius:2px;color:#e03020;font-family:var(--mono);font-size:9px;padding:4px 9px;cursor:pointer;letter-spacing:1px;">|◀ END</button>
      <div style="margin-left:auto;display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
        <span style="font-family:var(--mono);font-size:9px;color:#2a4060;letter-spacing:1px;">PLACER ICI →</span>
        <button onclick="emSetHere('start')" style="background:rgba(0,212,240,.06);border:1px solid #00d4f0;border-radius:2px;color:#00d4f0;font-family:var(--mono);font-size:9px;padding:3px 8px;cursor:pointer;letter-spacing:1px;">START</button>
        <button onclick="emSetHere('intro')" style="background:rgba(245,196,0,.06);border:1px solid #f5c400;border-radius:2px;color:#f5c400;font-family:var(--mono);font-size:9px;padding:3px 8px;cursor:pointer;letter-spacing:1px;">INTRO</button>
        <button onclick="emSetHere('next')" style="background:rgba(0,217,106,.06);border:1px solid #00d96a;border-radius:2px;color:#00d96a;font-family:var(--mono);font-size:9px;padding:3px 8px;cursor:pointer;letter-spacing:1px;">NEXT</button>
        <button onclick="emSetHere('end')" style="background:rgba(224,48,32,.06);border:1px solid #e03020;border-radius:2px;color:#e03020;font-family:var(--mono);font-size:9px;padding:3px 8px;cursor:pointer;letter-spacing:1px;">END</button>
      </div>
    </div>

  </div>
</div>

</body>
</html>
`;
  function loadDiffSecours() {
    if (_diffLoaded) return;
    _diffLoaded = true;
    var blob = new Blob([_diffHTML], {type: 'text/html'});
    var url  = URL.createObjectURL(blob);
    document.getElementById('diff-secours-frame').src = url;
  }
  window.loadDiffSecours = loadDiffSecours;
})();
