/* Research Paper Summarizer - on-device extractive summarization */
(function(){
'use strict';
const $=s=>document.querySelector(s);
const STOP=new Set(('a,an,the,and,or,but,if,then,else,when,at,by,for,with,about,against,between,into,through,during,before,after,above,below,to,from,up,down,in,out,on,off,over,under,again,further,once,here,there,all,any,both,each,few,more,most,other,some,such,no,nor,not,only,own,same,so,than,too,very,can,will,just,should,now,is,are,was,were,be,been,being,have,has,had,having,do,does,did,doing,would,could,shall,may,might,must,of,it,its,this,that,these,those,we,our,us,they,them,their,he,she,his,her,i,you,your,as,also,which,who,whom,what,where,why,how,via,et,al,fig,figure,table,section,however,moreover,furthermore,thus,therefore,hence').split(','));

const SAMPLE=`Attention Is All You Need

Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Lukasz Kaiser, Illia Polosukhin

Abstract
The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. Experiments on two machine translation tasks show these models to be superior in quality while being more parallelizable and requiring significantly less time to train. Our model achieves 28.4 BLEU on the WMT 2014 English-to-German translation task, improving over the existing best results, including ensembles, by over 2 BLEU. On the WMT 2014 English-to-French task, our model establishes a new single-model state-of-the-art BLEU score of 41.8 after training for 3.5 days on eight GPUs, a small fraction of the training costs of the best models from the literature.

1 Introduction
Recurrent neural networks, long short-term memory and gated recurrent neural networks in particular, have been firmly established as state of the art approaches in sequence modeling and transduction problems such as language modeling and machine translation. Numerous efforts have since continued to push the boundaries of recurrent language models and encoder-decoder architectures. Recurrent models typically factor computation along the symbol positions of the input and output sequences. This inherently sequential nature precludes parallelization within training examples, which becomes critical at longer sequence lengths, as memory constraints limit batching across examples.

2 Model Architecture
The Transformer follows this overall architecture using stacked self-attention and point-wise, fully connected layers for both the encoder and decoder. The encoder is composed of a stack of 6 identical layers. Each layer has two sub-layers. The first is a multi-head self-attention mechanism, and the second is a simple, position-wise fully connected feed-forward network. We employ multi-head attention with 8 attention heads in our model. An attention function can be described as mapping a query and a set of key-value pairs to an output, where the query, keys, values, and output are all vectors. We compute the dot products of the query with all keys, divide each by the square root of the key dimension, and apply a softmax function to obtain the weights on the values.

3 Training
We trained on the standard WMT 2014 English-German dataset consisting of about 4.5 million sentence pairs. We used the Adam optimizer with a custom learning rate schedule that increases linearly for the first warmup steps and decreases thereafter proportionally to the inverse square root of the step number. Regularization is applied in the form of dropout and label smoothing during training.

4 Results
On the WMT 2014 English-to-German translation task, the big transformer model outperforms the best previously reported models, including ensembles, by more than 2.0 BLEU, establishing a new state-of-the-art BLEU score of 28.4. On the WMT 2014 English-to-French task, our big model achieves a BLEU score of 41.0, outperforming all of the previously published single models, at less than one quarter the training cost of the previous state-of-the-art model. The Transformer generalizes well to English constituency parsing both with limited and abundant training data.

5 Conclusion
In this work, we presented the Transformer, the first sequence transduction model based entirely on attention, replacing the recurrent layers most commonly used in encoder-decoder architectures with multi-headed self-attention. For translation tasks, the Transformer can be trained significantly faster than architectures based on recurrent or convolutional layers. However, the model assumes fixed-length context and does not address very long sequences efficiently, which remains a limitation. We plan to extend the Transformer to problems involving input and output modalities other than text and to investigate local, restricted attention mechanisms to efficiently handle large inputs such as images, audio and video.

References
[1] Dzmitry Bahdanau, Kyunghyun Cho, and Yoshua Bengio. Neural machine translation by jointly learning to align and translate. ICLR 2015.`;

function tokens(s){return s.toLowerCase().match(/[a-z][a-z'-]+/g)||[];}
function sentSplit(text){return text.split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/).map(s=>s.trim()).filter(s=>s.split(/\s+/).length>=5);}

const SECTION_RE=/^(abstract|introduction|background|related work|method|methods|methodology|model|model architecture|approach|experiments|experimental setup|training|results|evaluation|discussion|conclusion|conclusions|limitations|future work|references)\b/i;
const SEC_CANON=[['abstract','Abstract'],['introduction','Introduction'],['background','Introduction'],['related work','Background'],
 ['method','Method'],['methods','Method'],['methodology','Method'],['model','Method'],['approach','Method'],
 ['experiment','Method'],['training','Method'],['result','Results'],['evaluation','Results'],
 ['discussion','Discussion'],['conclusion','Conclusion'],['limitation','Limitations'],['future work','Limitations'],['reference','References']];

function parseSections(text){
  const lines=text.split('\n');
  const secs=[{name:'Preamble',body:''}];
  for(const ln of lines){
    const m=ln.trim().replace(/^\d+(\.\d+)*\s+/,'').match(SECTION_RE);
    if(m && ln.trim().length<70){secs.push({name:ln.trim(),body:''});}
    else secs[secs.length-1].body+=ln+'\n';
  }
  return secs.filter(s=>s.body.trim()||s.name!=='Preamble');
}
function canon(name){const low=name.toLowerCase().replace(/^\d+(\.\d+)*\s+/,'');for(const [k,v] of SEC_CANON)if(low.startsWith(k))return v;return 'Body';}

function analyze(text,topN){
  const secs=parseSections(text);
  const title=(text.split('\n').map(l=>l.trim()).find(l=>l.length>10)||'Untitled paper');
  // sentences with section labels and positions
  const sents=[];
  let idx=0;
  for(const s of secs){
    const c=canon(s.name);
    for(const sn of sentSplit(s.body))sents.push({text:sn,sec:c,pos:idx++,name:s.name});
  }
  const total=sents.length;
  // document freq
  const df={};
  for(const s of sents){const seen=new Set();for(const t of tokens(s.text)){if(STOP.has(t)||t.length<3)continue;if(!seen.has(t)){df[t]=(df[t]||0)+1;seen.add(t);}}}
  function score(s){
    let sc=0;const toks=tokens(s.text);
    for(const t of toks){if(STOP.has(t)||t.length<3)continue;sc+=1/(1+(df[t]||0));}
    sc=sc/Math.sqrt(toks.length||1);
    if(s.sec==='Abstract')sc*=1.8;
    if(s.sec==='Conclusion')sc*=1.4;
    if(s.pos<total*0.15)sc*=1.25;
    return sc;
  }
  const ranked=sents.map(s=>({...s,score:score(s)})).sort((a,b)=>b.score-a.score);
  const tldr=ranked.slice(0,topN).sort((a,b)=>a.pos-b.pos);
  const pick=(re,from,n)=>from.filter(s=>re.test(s.text)).slice(0,n);
  const contrib=pick(/\b(we (propose|present|introduce|show|demonstrate|achieve|develop|design)|in this (paper|work), we|our (model|approach|method|contribution)|first .* to)\b/i,sents,5);
  const results=pick(/\d+(\.\d+)?\s*(%|bleu|f1|accuracy|rouge|percent)|outperform|state-of-the-art|improv(e|es|ing) (over|upon)|achieves? a|new (best|state)/i,sents,5);
  const method=pick(/\b(we (use|employ|train|compute|adopt)|architecture|consists? of|composed of|optimizer|dataset|layer)s?\b/i,sents.filter(s=>s.sec==='Method'||s.sec==='Introduction'),4);
  const lims=pick(/\b(however|although|limitation|future work|remains? to|does not|fails? to|drawback|open question)\b/i,sents.filter(s=>s.sec!=='References'),4);
  // keywords: top terms by df-weighted freq
  const freq={};
  for(const s of sents)for(const t of tokens(s.text)){if(STOP.has(t)||t.length<3)continue;freq[t]=(freq[t]||0)+1;}
  const keywords=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([t])=>t);
  const words=text.split(/\s+/).length;
  return {title,sents,tldr,contrib,results,method,lims,keywords,words,secs:secs.filter(s=>canon(s.name)!=='References')};
}

let last=null;
function render(a){
  last=a;
  $('#briefing').classList.remove('hidden');
  $('#paperTitle').textContent=a.title.length>90?a.title.slice(0,87)+'...':a.title;
  $('#briefMeta').textContent=`${a.words.toLocaleString()} words · about ${Math.max(1,Math.round(a.words/220))} min reading time · ${a.secs.length} sections found`;
  $('#kpis').innerHTML=[
    ['Words',a.words.toLocaleString()],['Sentences',a.sents.length],['Contributions',a.contrib.length],['Keywords',a.keywords.length]
  ].map(([l,v])=>`<div class="card kpi"><div class="small muted">${l}</div><div class="kpi-val">${v}</div></div>`).join('');
  const sent=(s,tag)=>`<div class="card card-pad-sm"><p>${esc(s.text)}</p><span class="small muted chip chip-accent mt8">${tag||s.name||s.sec}</span></div>`;
  $('#tldr').innerHTML=a.tldr.map(s=>sent(s,s.sec)).join('');
  const fill=(id,arr,tag)=>{const el=$(id);el.innerHTML=arr.length?arr.map(s=>sent(s,tag||s.sec)).join(''):'<p class="muted small">None detected.</p>';};
  fill('#contrib',a.contrib);fill('#results',a.results);fill('#method',a.method);fill('#limitsList',a.lims);
  $('#keywords').innerHTML=a.keywords.map(k=>`<span class="chip">${esc(k)}</span>`).join('');
  $('#briefing').scrollIntoView({behavior:'smooth',block:'start'});
}

function go(){
  const t=$('#paperText').value.trim();
  if(t.split(/\s+/).length<100){toast('Paste at least a few paragraphs of paper text.');return;}
  render(analyze(t,+$('#sumLen').value));
}
function updateStats(){const t=$('#paperText').value.trim();$('#paperStats').textContent=t?`${t.split(/\s+/).length.toLocaleString()} words pasted`:'';}
$('#paperText').addEventListener('input',updateStats);
$('#btnGo').addEventListener('click',go);
$('#btnSample').addEventListener('click',()=>{$('#paperText').value=SAMPLE;updateStats();go();});
$('#fileInput').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;$('#paperText').value=await f.text();updateStats();go();});
$('#btnExport').addEventListener('click',()=>{
  if(!last)return;
  const a=last;
  let md=`# ${a.title}\n\nBriefing - ${a.words.toLocaleString()} words, ${a.secs.length} sections\n\n## TL;DR\n\n`;
  for(const s of a.tldr)md+=`- ${s.text} _(${s.sec})_\n`;
  const sec=(t,arr)=>{if(!arr.length)return '';let m=`\n## ${t}\n\n`;for(const s of arr)m+=`- ${s.text}\n`;return m;};
  md+=sec('Key contributions',a.contrib)+sec('Results and numbers',a.results)+sec('Method',a.method)+sec('Limitations',a.lims);
  md+=`\n## Keywords\n\n${a.keywords.join(', ')}\n\n_Extractive summary - every sentence above appears in the original paper._\n`;
  download('paper-briefing.md',md,'text/markdown');toast('Briefing downloaded');
});

window._test={analyze:()=>{const a=analyze(SAMPLE,5);render(a);return {title:a.title,sents:a.sents.length,tldr:a.tldr.length,contrib:a.contrib.length,results:a.results.length,lims:a.lims.length,keywords:a.keywords,secs:a.secs.map(s=>canon(s.name))};},
  analyzeText:(t,n)=>{const a=analyze(t,n||5);render(a);return {title:a.title,sents:a.sents.length,contrib:a.contrib.length,lims:a.lims.length};},
  sample:()=>SAMPLE, state:()=>last?{sents:last.sents.length,keywords:last.keywords.length}:null};
})();
