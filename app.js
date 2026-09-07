const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let state=JSON.parse(localStorage.getItem("knastuAI")||'{"all":0,"auto":0,"esc":0,"tickets":[],"unknowns":[]}');

function save(){localStorage.setItem("knastuAI",JSON.stringify(state));renderStaff()}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function norm(s){return s.toLowerCase().replace(/ё/g,"е").replace(/[^\p{L}\p{N}\s]/gu," ")}
function findKB(q){
 let n=norm(q), best=null, score=0;
 KB.forEach(x=>{let sc=0;x.keys.forEach(k=>{if(n.includes(norm(k)))sc+=k.length>5?3:1});if(sc>score){score=sc;best=x}});
 if(score>=2)return best;
 const p=PROGRAMS.find(x=>n.includes(x.id)||n.includes(norm(x.name))||n.includes(norm(x.profile)));
 if(p)return {text:`Нашёл программу «${p.name} — ${p.profile}» (${p.id}). Вступительные предметы: ${p.subjects.join(", ")}. Бюджетных мест в каталоге: ${p.budget}, по договору: ${p.paid}.`,source:"Каталог направлений",url:"https://abit.knastu.ru/page/bak/13",program:p};
 return null;
}
function addMsg(role,text,source,url){
 const box=document.createElement("div");box.className="msg "+role;
 box.innerHTML=`<div class="avatar">${role==="user"?"Вы":"✦"}</div><div class="bubble">${esc(text).replace(/\n/g,"<br>")}${source?`<div class="source">Источник: <a href="${url}" target="_blank">${esc(source)} ↗</a></div>`:""}</div>`;
 $("#chatMessages").appendChild(box);box.scrollIntoView({behavior:"smooth",block:"end"});
}
function ask(q){
 $(".hero")?.remove();addMsg("user",q);
 state.all++;
 const r=findKB(q);
 if(r){state.auto++;setTimeout(()=>addMsg("bot",r.text,r.source,r.url),280)}
 else{
   state.esc++;state.unknowns.unshift({q,date:new Date().toLocaleString("ru-RU")});state.unknowns=state.unknowns.slice(0,20);
   setTimeout(()=>addMsg("bot","Я не уверен в ответе и не хочу вводить вас в заблуждение. Этот вопрос лучше передать сотруднику приёмной комиссии. Я сохранил его в демо-журнале кабинета сотрудника.",null,null),280);
 }
 state.tickets.unshift({q,ok:!!r,date:new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})});state.tickets=state.tickets.slice(0,12);save();
}
$("#chatForm").addEventListener("submit",e=>{e.preventDefault();let q=$("#chatInput").value.trim();if(q){$("#chatInput").value="";ask(q)}});
$$("[data-q]").forEach(b=>b.addEventListener("click",()=>ask(b.dataset.q)));
$$(".nav").forEach(b=>b.addEventListener("click",()=>{ $$(".nav").forEach(x=>x.classList.remove("active"));b.classList.add("active");$$(".page").forEach(p=>p.classList.remove("active"));$("#"+b.dataset.page).classList.add("active");if(b.dataset.page==="programs")renderPrograms();if(b.dataset.page==="staff")renderStaff()}));

function renderPrograms(){
 const q=norm($("#programSearch")?.value||""), sub=$("#subjectFilter")?.value||"";
 let arr=PROGRAMS.filter(p=>(!q||norm(p.name+" "+p.profile+" "+p.id).includes(q))&&(!sub||p.subjects.includes(sub)));
 $("#programGrid").innerHTML=arr.map(p=>`<article class="program"><span class="code">${p.id}</span><h3>${esc(p.name)}</h3><p>${esc(p.profile)} · ${p.form}</p><div class="chips">${p.subjects.map(s=>`<span class="chip">${esc(s)}</span>`).join("")}</div><div class="places"><span><b>${p.budget}</b><br>бюджет</span><span><b>${p.paid}</b><br>договор</span></div></article>`).join("")||'<div class="empty">Ничего не найдено.</div>';
}
$("#programSearch")?.addEventListener("input",renderPrograms);$("#subjectFilter")?.addEventListener("change",renderPrograms);

const SUBJECTS=["Русский язык","Математика","Информатика","Физика","Химия","Иностранный язык","Рисунок"];
function scoreRow(subject="Русский язык",value=""){let d=document.createElement("div");d.className="score-row";d.innerHTML=`<select>${SUBJECTS.map(x=>`<option ${x===subject?"selected":""}>${x}</option>`).join("")}</select><input type="number" min="0" max="100" placeholder="баллы" value="${value}"><button class="remove">×</button>`;d.querySelector(".remove").onclick=()=>d.remove();return d}
function initScores(){let box=$("#scores");box.innerHTML="";box.append(scoreRow("Русский язык"));box.append(scoreRow("Математика"));box.append(scoreRow("Информатика"))}
$("#addScore").onclick=()=>$("#scores").append(scoreRow());
$("#runCheck").onclick=()=>{
 const scores={};$$(".score-row").forEach(r=>{let s=r.querySelector("select").value,v=+r.querySelector("input").value;if(v>0)scores[s]=v});
 const budget=$("#budget").checked;
 let result=PROGRAMS.map(p=>{
   const missing=p.subjects.filter(s=>!(s in scores));
   const avg=p.subjects.filter(s=>s in scores).reduce((a,s)=>a+scores[s],0)/(p.subjects.filter(s=>s in scores).length||1);
   const compatible=missing.length===0;
   const place=budget?p.budget:p.paid;
   return {...p,missing,avg,compatible,place};
 }).filter(p=>p.compatible&&(!budget||p.budget>0)).sort((a,b)=>b.avg-a.avg);
 if(!$("#hasDoc").checked) $("#checkResult").innerHTML='<div class="match"><h3>⚠ Не указан документ об образовании</h3><div class="warn">Перед подачей заявления потребуется документ об образовании.</div></div>';
 else if(!result.length) $("#checkResult").innerHTML='<div class="match"><h3>Подходящих вариантов не найдено</h3><div class="warn">Проверьте предметы. В этой версии проверяется совместимость набора предметов с каталогом, а не вероятность зачисления.</div></div>';
 else $("#checkResult").innerHTML=result.slice(0,8).map(p=>`<div class="match"><h3>${esc(p.name)} <span class="code">${p.id}</span></h3><div>${esc(p.profile)}</div><div class="ok">✓ Предметы подходят · ${p.budget} бюджетных мест · ${p.paid} договорных</div></div>`).join("");
};

function renderStaff(){
 $("#statAll").textContent=state.all;$("#statAuto").textContent=state.auto;$("#statEsc").textContent=state.esc;$("#statRate").textContent=state.all?Math.round(state.auto/state.all*100)+"%":"0%";$("#unknownCount").textContent=state.unknowns.length;
 $("#tickets").innerHTML=state.tickets.length?state.tickets.map(t=>`<div class="ticket"><b>${esc(t.q)}</b><p>${t.date} · <span class="tag">${t.ok?"автоответ":"оператор"}</span></p></div>`).join(""):'<div class="empty">Пока нет обращений.</div>';
 $("#unknowns").innerHTML=state.unknowns.length?state.unknowns.map(x=>`<div class="unknown"><b>${esc(x.q)}</b><p>${x.date}</p><button class="secondary" onclick="alert('Демо: вопрос передан ответственному сотруднику')">Передать</button></div>`).join(""):'<div class="empty">Отлично — вопросов без ответа нет.</div>';
}
$("#resetStats").onclick=()=>{state={all:0,auto:0,esc:0,tickets:[],unknowns:[]};save()};initScores();renderPrograms();renderStaff();
