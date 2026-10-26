const KEY = "ihr-data-v1";
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const today = () => new Date().toISOString().slice(0,10);
const uid = () => "P" + Math.random().toString(36).slice(2,7).toUpperCase();
const list = v => v.split(",").map(x => x.trim()).filter(Boolean);

const seed = () => [
  {id:"P1001",name:"Asha Reddy",age:54,sex:"Female",blood:"B+",conditions:["Type 2 diabetes","Hypertension"],allergies:["Penicillin"],
   vitals:[{date:"2026-09-12",sys:128,dia:82,hr:76,spo2:98,temp:36.8,glu:142,wt:68,ht:160},{date:"2026-10-20",sys:152,dia:96,hr:88,spo2:97,temp:36.9,glu:212,wt:70,ht:160}],
   records:[{date:"2026-10-20",type:"Visit note",title:"Quarterly review",text:"Reports fatigue and increased thirst. Adjust metformin dose; repeat HbA1c in 3 months."}]},
  {id:"P1002",name:"Ravi Kumar",age:31,sex:"Male",blood:"O+",conditions:["Asthma"],allergies:[],
   vitals:[{date:"2026-10-18",sys:118,dia:76,hr:72,spo2:93,temp:37.1,glu:92,wt:74,ht:176}],
   records:[{date:"2026-10-18",type:"Prescription",title:"Inhaler refill",text:"Salbutamol inhaler as needed. Review technique at next visit."}]}
];

let db = (() => { try { const d = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(d) && d.length) return d; } catch(e){} return seed(); })();
let sel = db[0]?.id, q = "";
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch(e){} };

// Rule-based clinical screening on the latest vitals
function analyse(v, p) {
  const out = [];
  if (!v) return out;
  const add = (lvl, t) => out.push({lvl, t});
  if (v.sys >= 180 || v.dia >= 120) add("crit", `Blood pressure ${v.sys}/${v.dia} is in the hypertensive crisis range. Seek urgent review.`);
  else if (v.sys >= 140 || v.dia >= 90) add("warn", `Blood pressure ${v.sys}/${v.dia} is elevated (stage 2 range).`);
  else if (v.sys < 90 || v.dia < 60) add("warn", `Blood pressure ${v.sys}/${v.dia} is low.`);
  if (v.spo2 < 90) add("crit", `Oxygen saturation ${v.spo2}% is critically low.`);
  else if (v.spo2 < 95) add("warn", `Oxygen saturation ${v.spo2}% is below normal.`);
  if (v.hr > 120 || v.hr < 45) add("crit", `Heart rate ${v.hr} bpm is outside the safe range.`);
  else if (v.hr > 100 || v.hr < 55) add("warn", `Heart rate ${v.hr} bpm is outside the normal range.`);
  if (v.temp >= 39) add("crit", `High fever: ${v.temp} °C.`);
  else if (v.temp >= 37.8) add("warn", `Fever: ${v.temp} °C.`);
  if (v.glu >= 300) add("crit", `Blood glucose ${v.glu} mg/dL is very high.`);
  else if (v.glu >= 180) add("warn", `Blood glucose ${v.glu} mg/dL is high.`);
  else if (v.glu < 70) add("crit", `Blood glucose ${v.glu} mg/dL is low (hypoglycaemia).`);
  if (v.wt && v.ht) { const b = v.wt / Math.pow(v.ht/100, 2);
    if (b >= 30) add("warn", `BMI ${b.toFixed(1)} is in the obese range.`);
    else if (b < 18.5) add("warn", `BMI ${b.toFixed(1)} is underweight.`); }
  // Trend: compare with previous reading
  const prev = p.vitals[p.vitals.length - 2];
  if (prev && v.sys - prev.sys >= 20) add("warn", `Systolic pressure rose ${v.sys - prev.sys} mmHg since ${prev.date}.`);
  if (prev && v.glu - prev.glu >= 50) add("warn", `Glucose rose ${v.glu - prev.glu} mg/dL since ${prev.date}.`);
  if (p.conditions.some(c => /diabet/i.test(c)) && v.glu >= 180) add("warn", "Patient has diabetes and glucose is above target. Review medication and diet.");
  if (p.conditions.some(c => /hypertens/i.test(c)) && v.sys >= 140) add("warn", "Patient has hypertension and BP is above target. Review treatment.");
  return out;
}
const level = a => a.some(x => x.lvl === "crit") ? "crit" : a.length ? "warn" : "ok";
const label = {crit:"Critical", warn:"Review", ok:"Stable"};
const latest = p => p.vitals[p.vitals.length - 1];

function matches(p) {
  if (!q) return true;
  const hay = [p.id, p.name, p.conditions.join(" "), p.allergies.join(" "), p.records.map(r => r.title + " " + r.text + " " + r.type).join(" ")].join(" ").toLowerCase();
  return q.toLowerCase().split(/\s+/).every(w => hay.includes(w));
}

function renderList() {
  const rows = db.filter(matches);
  $("#list").innerHTML = (rows.length ? rows.map(p => {
    const l = level(analyse(latest(p), p));
    return `<button class="pt" data-id="${p.id}" aria-current="${p.id === sel}"><span>${esc(p.name)}<br><small>${p.id} · ${p.age} ${esc(p.sex[0])}</small></span><span class="badge b-${l}">${label[l]}</span></button>`;
  }).join("") : `<p class="mute">No patients match. Clear the search or add a new patient.</p>`);
}

function renderDetail() {
  const p = db.find(x => x.id === sel);
  if (!p) { $("#detail").innerHTML = `<div class="panel"><p class="mute">Select a patient or add a new one.</p></div>`; return; }
  const v = latest(p), al = analyse(v, p);
  $("#detail").innerHTML = `
  <div class="panel">
    <div class="row" style="align-items:flex-start"><div><h2>${esc(p.name)}</h2>
    <div class="mute">${p.id} · ${p.age} yrs · ${esc(p.sex)} · Blood group ${esc(p.blood)}</div>
    <div>Conditions: ${esc(p.conditions.join(", ") || "None recorded")}</div>
    <div>Allergies: ${esc(p.allergies.join(", ") || "None recorded")}</div></div>
    <div style="flex:0 0 auto"><button class="link" id="delPt">Delete patient</button></div></div>
  </div>
  <div class="panel"><h3>Health screening</h3>
    ${v ? (al.length ? al.map(a => `<div class="alert ${a.lvl}">${esc(a.t)}</div>`).join("") : `<div class="alert ok">All latest readings are within normal ranges.</div>`) : `<p class="mute">Add vitals to run screening.</p>`}
    <small class="mute">Rule-based guidance for demonstration. It does not replace clinical judgement.</small>
  </div>
  <div class="panel"><h3>Vitals</h3>
    <div class="scroll"><table><tr><th>Date</th><th>BP</th><th>HR</th><th>SpO₂</th><th>Temp</th><th>Glucose</th><th>Weight</th></tr>
    ${p.vitals.slice().reverse().map(r => `<tr><td>${r.date}</td><td>${r.sys}/${r.dia}</td><td>${r.hr}</td><td>${r.spo2}%</td><td>${r.temp}</td><td>${r.glu}</td><td>${r.wt} kg</td></tr>`).join("") || `<tr><td colspan="7" class="mute">No readings yet.</td></tr>`}</table></div>
    <form id="vForm" style="margin-top:12px"><div class="grid">
      <label>Systolic<input name="sys" type="number" required></label><label>Diastolic<input name="dia" type="number" required></label>
      <label>Heart rate<input name="hr" type="number" required></label><label>SpO₂ %<input name="spo2" type="number" required></label>
      <label>Temp °C<input name="temp" type="number" step="0.1" required></label><label>Glucose mg/dL<input name="glu" type="number" required></label>
      <label>Weight kg<input name="wt" type="number" step="0.1"></label><label>Height cm<input name="ht" type="number"></label>
    </div><p><button class="primary">Save vitals</button></p></form>
  </div>
  <div class="panel"><h3>Medical records</h3>
    ${p.records.slice().reverse().map((r, i) => `<div class="rec"><strong>${esc(r.title)}</strong> <span class="badge b-ok">${esc(r.type)}</span> <span class="mute">${r.date}</span><div>${esc(r.text)}</div></div>`).join("") || `<p class="mute">No records yet. Add the first one below.</p>`}
    <form id="rForm" class="stack" style="margin-top:12px"><div class="row">
      <label>Type<select name="type"><option>Visit note</option><option>Lab report</option><option>Prescription</option><option>Imaging</option><option>Vaccination</option></select></label>
      <label>Title<input name="title" required></label></div>
      <label>Details<textarea name="text" rows="3" required></textarea></label>
      <div><button class="primary">Save record</button></div></form>
  </div>`;
}
const render = () => { renderList(); renderDetail(); };

document.addEventListener("click", e => {
  const b = e.target.closest(".pt"); if (b) { sel = b.dataset.id; render(); }
  if (e.target.id === "delPt" && confirm("Delete this patient and all their records?")) { db = db.filter(p => p.id !== sel); sel = db[0]?.id; save(); render(); }
});
document.addEventListener("submit", e => {
  const f = e.target, d = Object.fromEntries(new FormData(f)), p = db.find(x => x.id === sel);
  if (f.id === "vForm" && p) { e.preventDefault();
    p.vitals.push({date: today(), sys:+d.sys, dia:+d.dia, hr:+d.hr, spo2:+d.spo2, temp:+d.temp, glu:+d.glu, wt:+d.wt || latest(p)?.wt || 0, ht:+d.ht || latest(p)?.ht || 0}); save(); render(); }
  if (f.id === "rForm" && p) { e.preventDefault(); p.records.push({date: today(), ...d}); save(); render(); }
  if (f.id === "ptForm") { e.preventDefault();
    const n = {id: uid(), name: d.name.trim(), age:+d.age, sex:d.sex, blood:d.blood, conditions:list(d.conditions), allergies:list(d.allergies), vitals:[], records:[]};
    db.push(n); sel = n.id; save(); f.reset(); $("#dlg").close(); render(); }
});
$("#addBtn").onclick = () => $("#dlg").showModal();
$("#cancel").onclick = () => $("#dlg").close();
$("#search").oninput = e => { q = e.target.value.trim(); renderList(); };
$("#exportBtn").onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], {type:"application/json"})); a.download = "healthcare-repository.json"; a.click(); };
render();
