/* ===================== Data & constants ===================== */

const COLORS = [
  {name:"Paper",   value:"#FBFAF6"},
  {name:"Sage",    value:"#DCE6D8"},
  {name:"Moss",    value:"#A9C3A6"},
  {name:"Teal",    value:"#8FB9AE"},
  {name:"Deep Teal",value:"#3E6E64"},
  {name:"Sky",     value:"#BFD7DE"},
  {name:"Butter",  value:"#F3DE9B"},
  {name:"Gold",    value:"#D1A03A"},
  {name:"Blush",   value:"#EFC7C0"},
  {name:"Rust",    value:"#C77A5E"},
  {name:"Berry",   value:"#B08199"},
  {name:"Plum",    value:"#6E5170"},
  {name:"Sand",    value:"#E4DCC8"},
  {name:"Charcoal",value:"#3A3F3A"},
  {name:"Ink",     value:"#24312B"},
];

const PATTERNS = [
  {name:"Dots",   base:"#FBFAF6", image:"radial-gradient(rgba(36,49,43,0.35) 1.4px, transparent 1.6px)", size:"14px 14px"},
  {name:"Grid",   base:"#FBFAF6", image:"linear-gradient(rgba(36,49,43,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(36,49,43,0.18) 1px, transparent 1px)", size:"16px 16px"},
  {name:"Stripe", base:"#F3DE9B", image:"repeating-linear-gradient(115deg, rgba(36,49,43,0.16) 0 2px, transparent 2px 14px)", size:"auto"},
  {name:"Cross",  base:"#DCE6D8", image:"linear-gradient(45deg, rgba(36,49,43,0.15) 1px, transparent 1px), linear-gradient(-45deg, rgba(36,49,43,0.15) 1px, transparent 1px)", size:"14px 14px"},
  {name:"Waves",  base:"#BFD7DE", image:"radial-gradient(circle at 50% -10%, transparent 22%, rgba(36,49,43,0.14) 23%, rgba(36,49,43,0.14) 24%, transparent 25%)", size:"26px 20px"},
  {name:"Confetti",base:"#EFC7C0", image:"radial-gradient(rgba(176,71,58,0.5) 1.6px, transparent 1.8px), radial-gradient(rgba(62,110,100,0.5) 1.6px, transparent 1.8px)", size:"22px 22px, 22px 22px"},
];

const FONTS = [
  {label:"Clean (Work Sans)", value:"'Work Sans', sans-serif"},
  {label:"Friendly (Nunito)", value:"'Nunito', sans-serif"},
  {label:"Storybook (Fraunces)", value:"'Fraunces', serif"},
  {label:"Editorial (Playfair)", value:"'Playfair Display', serif"},
  {label:"Handwritten (Caveat)", value:"'Caveat', cursive"},
  {label:"Typewriter", value:"'Special Elite', monospace"},
  {label:"Mono (Space Mono)", value:"'Space Mono', monospace"},
];

const DEFAULT_NOTE_DESIGN = {type:"color", value:"#F3DE9B"};
const DEFAULT_FOLDER_DESIGN = {type:"color", value:"#8FB9AE"};
const PINNED_ID = "pinned-today";

/* ===================== Tiny IndexedDB KV wrapper ===================== */

const DB_NAME = "leaflet-db", STORE = "kv";
let _dbp = null;
function openDB(){
  if(_dbp) return _dbp;
  _dbp = new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbp;
}
async function dbGet(key){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(STORE,"readonly").objectStore(STORE).get(key);
    tx.onsuccess=()=>resolve(tx.result);
    tx.onerror=()=>reject(tx.error);
  });
}
async function dbSet(key,val){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(STORE,"readwrite").objectStore(STORE).put(val,key);
    tx.onsuccess=()=>resolve();
    tx.onerror=()=>reject(tx.error);
  });
}
async function dbDelete(key){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(STORE,"readwrite").objectStore(STORE).delete(key);
    tx.onsuccess=()=>resolve();
    tx.onerror=()=>reject(tx.error);
  });
}

/* ===================== State ===================== */

let state = { folders: [], notes: [] };
let currentFolderId = null;   // null = home
let currentNoteId = null;     // note open in editor
let designTarget = null;      // {kind:'note'|'folder', id}
let notifTimers = new Map();  // planItemId -> timeoutId

function uid(){ return (crypto.randomUUID ? crypto.randomUUID() : "id-"+Date.now()+"-"+Math.random().toString(16).slice(2)); }

async function loadState(){
  const saved = await dbGet("state");
  if(saved){ state = saved; }
  if(!state.notes.find(n=>n.id===PINNED_ID)){
    state.notes.unshift({
      id: PINNED_ID, type:"planning", title:"Today's Plan",
      folderId:null, pinned:true, items:[],
      design: {type:"color", value:"#D1A03A"},
      createdAt: Date.now()
    });
    await saveState();
  }
}
async function saveState(){ await dbSet("state", state); }

/* ===================== Utilities ===================== */

function toast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>t.classList.remove("show"), 2200);
}

function backgroundStyleFor(design){
  if(!design) design = DEFAULT_NOTE_DESIGN;
  if(design.type === "color"){
    return { background: design.value };
  }
  if(design.type === "pattern"){
    const p = PATTERNS.find(p=>p.name===design.value) || PATTERNS[0];
    return { background: p.base, backgroundImage:p.image, backgroundSize:p.size };
  }
  if(design.type === "photo"){
    return { backgroundImage:`url(${design.dataUrl})`, backgroundSize:"cover", backgroundPosition:"center" };
  }
  return { background: DEFAULT_NOTE_DESIGN.value };
}

function applyStyleObj(el, styleObj){
  Object.assign(el.style, styleObj);
}

function isLightColor(hex){
  if(!hex || hex[0] !== "#") return true;
  const c = hex.substring(1);
  const r = parseInt(c.substring(0,2),16), g = parseInt(c.substring(2,4),16), b = parseInt(c.substring(4,6),16);
  return (0.299*r + 0.587*g + 0.114*b) > 150;
}

function textColorFor(design){
  if(design && design.type === "color") return isLightColor(design.value) ? "#24312B" : "#F7F5EF";
  if(design && design.type === "pattern"){
    const p = PATTERNS.find(p=>p.name===design.value);
    return p && isLightColor(p.base) ? "#24312B" : "#F7F5EF";
  }
  return "#24312B";
}

function fmtRelTime(ts){
  const d = new Date(ts), now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if(sameDay) return d.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"});
  return d.toLocaleDateString([], {month:"short", day:"numeric"});
}

/* ===================== Home rendering ===================== */

const homeGrid = document.getElementById("home-grid");
const emptyState = document.getElementById("empty-state");
const crumbTitle = document.getElementById("crumb-title");
const btnBackFolder = document.getElementById("btn-back-folder");
const btnFolderCover = document.getElementById("btn-folder-cover");
const btnFolderDelete = document.getElementById("btn-folder-delete");

function currentFolder(){ return state.folders.find(f=>f.id===currentFolderId) || null; }

function renderHome(){
  homeGrid.innerHTML = "";
  const folder = currentFolder();

  crumbTitle.value = folder ? folder.name : "Leaflet";
  crumbTitle.readOnly = !folder;
  btnBackFolder.classList.toggle("hidden", !folder);
  btnFolderCover.classList.toggle("hidden", !folder);
  btnFolderDelete.classList.toggle("hidden", !folder);

  let anyContent = false;

  if(!folder){
    // folders first, at root only
    state.folders.forEach(f=>{
      anyContent = true;
      homeGrid.appendChild(renderFolderCard(f));
    });
  }

  const notesHere = state.notes.filter(n => (n.folderId||null) === (currentFolderId||null));
  // pinned note always first, full width
  notesHere.sort((a,b)=>{
    if(a.pinned) return -1;
    if(b.pinned) return 1;
    return b.createdAt - a.createdAt;
  });
  notesHere.forEach(n=>{
    anyContent = true;
    homeGrid.appendChild(renderNoteCard(n));
  });

  emptyState.classList.toggle("hidden", anyContent);

  // Folders can't be nested, so hide "New folder" while inside one
  const newFolderOpt = document.querySelector('.fab-option[data-action="new-folder"]');
  if(newFolderOpt) newFolderOpt.classList.toggle("hidden", !!folder);
}

function renderFolderCard(folder){
  const el = document.createElement("div");
  el.className = "card folder-card";
  applyStyleObj(el, backgroundStyleFor(folder.design));
  el.style.color = textColorFor(folder.design);
  const count = state.notes.filter(n=>n.folderId===folder.id).length;
  el.innerHTML = `
    <div class="card-scallop"></div>
    <p class="card-kicker">Folder · ${count} ${count===1?"note":"notes"}</p>
    <h3 class="card-title">${escapeHtml(folder.name)}</h3>
  `;
  el.addEventListener("click", ()=>{ currentFolderId = folder.id; renderHome(); });
  return el;
}

function renderNoteCard(note){
  const el = document.createElement("div");
  el.className = "card" + (note.pinned ? " pinned" : "");
  applyStyleObj(el, backgroundStyleFor(note.design));
  el.style.color = textColorFor(note.design);

  let sub = "";
  if(note.type === "planning"){
    const total = note.items.length;
    const done = note.items.filter(i=>i.done).length;
    sub = total ? `${done}/${total} done` : "No plans yet";
  } else {
    const text = (note.content||"").trim();
    sub = text ? text.slice(0,60) : "Empty note";
  }

  if(note.pinned){
    el.innerHTML = `
      <div>
        <p class="card-kicker">Daily plan</p>
        <h3 class="card-title">${escapeHtml(note.title||"Today's Plan")}</h3>
        <p class="card-sub">${escapeHtml(sub)}</p>
      </div>
      <span class="pin-tag">Pinned</span>
    `;
  } else {
    el.innerHTML = `
      <div class="card-scallop"></div>
      <p class="card-kicker">${note.type === "planning" ? "Plan" : "Writing"} · ${fmtRelTime(note.createdAt)}</p>
      <h3 class="card-title">${escapeHtml(note.title || "Untitled")}</h3>
      <p class="card-sub">${escapeHtml(sub)}</p>
    `;
  }
  el.addEventListener("click", ()=> openEditor(note.id));
  return el;
}

function escapeHtml(s){
  return (s||"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

/* ===================== FAB ===================== */

const fabMain = document.getElementById("fab-main");
const fabMenu = document.getElementById("fab-menu");
fabMain.addEventListener("click", ()=>{
  const open = fabMenu.classList.toggle("hidden");
  fabMain.classList.toggle("open", !open);
});
document.querySelectorAll(".fab-option").forEach(btn=>{
  btn.addEventListener("click", async ()=>{
    fabMenu.classList.add("hidden");
    fabMain.classList.remove("open");
    const action = btn.dataset.action;
    if(action === "new-planning") await createNote("planning");
    if(action === "new-writing") await createNote("writing");
    if(action === "new-folder") await createFolder();
  });
});

async function createNote(type){
  const note = {
    id: uid(), type, title:"",
    folderId: currentFolderId,
    design: {...DEFAULT_NOTE_DESIGN, value: type==="planning" ? "#8FB9AE" : "#FBFAF6"},
    createdAt: Date.now(),
  };
  if(type === "planning") note.items = [];
  else { note.content = ""; note.font = FONTS[0].value; note.textColor = "#24312B"; }
  state.notes.push(note);
  await saveState();
  renderHome();
  openEditor(note.id);
}

async function createFolder(){
  const folder = { id: uid(), name:"New Folder", design: {...DEFAULT_FOLDER_DESIGN}, createdAt: Date.now() };
  state.folders.push(folder);
  await saveState();
  currentFolderId = folder.id;
  renderHome();
  crumbTitle.focus();
  crumbTitle.select();
}

btnBackFolder.addEventListener("click", ()=>{ currentFolderId = null; renderHome(); });

btnFolderDelete.addEventListener("click", async ()=>{
  const folder = currentFolder(); if(!folder) return;
  const count = state.notes.filter(n=>n.folderId===folder.id).length;
  const msg = count
    ? `Delete "${folder.name}"? Its ${count} note${count===1?"":"s"} will move back to Home.`
    : `Delete "${folder.name}"?`;
  if(!confirm(msg)) return;
  state.notes.forEach(n=>{ if(n.folderId===folder.id) n.folderId = null; });
  state.folders = state.folders.filter(f=>f.id!==folder.id);
  await saveState();
  currentFolderId = null;
  renderHome();
  toast("Folder deleted");
});
crumbTitle.addEventListener("change", async ()=>{
  const folder = currentFolder();
  if(!folder) return;
  folder.name = crumbTitle.value.trim() || "New Folder";
  crumbTitle.value = folder.name;
  await saveState();
});

/* ===================== Note editor ===================== */

const editorScreen = document.getElementById("editor");
const noteTitleInput = document.getElementById("note-title");
const writingBody = document.getElementById("writing-body");
const planningBody = document.getElementById("planning-body");
const writingTextarea = document.getElementById("writing-textarea");
const fontSelect = document.getElementById("font-select");
const textColorInput = document.getElementById("text-color-input");
const planList = document.getElementById("plan-list");
const planAddForm = document.getElementById("plan-add-form");
const planTextInput = document.getElementById("plan-text-input");
const planTimeInput = document.getElementById("plan-time-input");
const btnEditorDelete = document.getElementById("btn-editor-delete");

FONTS.forEach(f=>{
  const opt = document.createElement("option");
  opt.value = f.value; opt.textContent = f.label;
  fontSelect.appendChild(opt);
});

function getNote(id){ return state.notes.find(n=>n.id===id); }

function openEditor(id){
  currentNoteId = id;
  const note = getNote(id);
  if(!note) return;

  noteTitleInput.value = note.title || "";
  noteTitleInput.placeholder = note.type === "planning" ? "Plan title" : "Untitled";
  btnEditorDelete.classList.toggle("hidden", !!note.pinned);
  document.getElementById("btn-editor-move").classList.toggle("hidden", !!note.pinned);

  applyStyleObj(editorScreen, backgroundStyleFor(note.design));
  editorScreen.style.color = textColorFor(note.design);

  if(note.type === "writing"){
    writingBody.classList.remove("hidden");
    planningBody.classList.add("hidden");
    writingTextarea.value = note.content || "";
    fontSelect.value = note.font || FONTS[0].value;
    writingTextarea.style.fontFamily = fontSelect.value;
    textColorInput.value = note.textColor || "#24312B";
    writingTextarea.style.color = textColorInput.value;
  } else {
    writingBody.classList.add("hidden");
    planningBody.classList.remove("hidden");
    renderPlanList(note);
  }

  editorScreen.classList.remove("hidden");
}

function closeEditor(){
  editorScreen.classList.add("hidden");
  currentNoteId = null;
  renderHome();
  scheduleAllReminders();
}
document.getElementById("btn-editor-close").addEventListener("click", closeEditor);

noteTitleInput.addEventListener("input", async ()=>{
  const note = getNote(currentNoteId); if(!note) return;
  note.title = noteTitleInput.value;
  await saveState();
});

writingTextarea.addEventListener("input", async ()=>{
  const note = getNote(currentNoteId); if(!note) return;
  note.content = writingTextarea.value;
  await saveState();
});
fontSelect.addEventListener("change", async ()=>{
  const note = getNote(currentNoteId); if(!note) return;
  note.font = fontSelect.value;
  writingTextarea.style.fontFamily = note.font;
  await saveState();
});
textColorInput.addEventListener("input", async ()=>{
  const note = getNote(currentNoteId); if(!note) return;
  note.textColor = textColorInput.value;
  writingTextarea.style.color = note.textColor;
  await saveState();
});

btnEditorDelete.addEventListener("click", async ()=>{
  const note = getNote(currentNoteId); if(!note || note.pinned) return;
  if(!confirm(`Delete "${note.title || "this note"}"? This can't be undone.`)) return;
  state.notes = state.notes.filter(n=>n.id!==note.id);
  await saveState();
  closeEditor();
  toast("Note deleted");
});

/* ---- Planning items ---- */

function renderPlanList(note){
  planList.innerHTML = "";
  const items = [...note.items].sort((a,b)=>{
    if(a.time && b.time) return a.time.localeCompare(b.time);
    if(a.time) return -1;
    if(b.time) return 1;
    return 0;
  });
  items.forEach(item=>{
    const li = document.createElement("li");
    li.className = "plan-item" + (item.done ? " done" : "");
    li.innerHTML = `
      <button class="plan-check" aria-label="Toggle done"></button>
      <input class="plan-text" value="${escapeHtml(item.text)}" />
      ${item.time ? `<span class="plan-time">${escapeHtml(item.time)}</span>` : ""}
      <button class="plan-remove" aria-label="Remove">✕</button>
    `;
    li.querySelector(".plan-check").addEventListener("click", async ()=>{
      item.done = !item.done;
      await saveState();
      renderPlanList(note);
    });
    li.querySelector(".plan-text").addEventListener("change", async (e)=>{
      item.text = e.target.value;
      await saveState();
    });
    li.querySelector(".plan-remove").addEventListener("click", async ()=>{
      note.items = note.items.filter(i=>i.id!==item.id);
      clearTimerFor(item.id);
      await saveState();
      renderPlanList(note);
    });
    planList.appendChild(li);
  });
}

planAddForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const note = getNote(currentNoteId); if(!note) return;
  const text = planTextInput.value.trim();
  if(!text) return;
  note.items.push({ id: uid(), text, time: planTimeInput.value || "", done:false });
  planTextInput.value = ""; planTimeInput.value = "";
  await saveState();
  renderPlanList(note);
  scheduleAllReminders();
});

/* ===================== Design sheet ===================== */

const sheetBackdrop = document.getElementById("sheet-backdrop");
const designSheet = document.getElementById("design-sheet");
const colorSwatches = document.getElementById("color-swatches");
const patternSwatches = document.getElementById("pattern-swatches");
const photoInput = document.getElementById("photo-input");
const photoRemoveBtn = document.getElementById("photo-remove");

COLORS.forEach(c=>{
  const sw = document.createElement("div");
  sw.className = "swatch"; sw.style.background = c.value; sw.title = c.name;
  sw.dataset.value = c.value;
  sw.addEventListener("click", ()=> applyDesign({type:"color", value:c.value}));
  colorSwatches.appendChild(sw);
});
PATTERNS.forEach(p=>{
  const sw = document.createElement("div");
  sw.className = "swatch"; sw.title = p.name;
  sw.style.background = p.base;
  sw.style.backgroundImage = p.image;
  sw.style.backgroundSize = p.size;
  sw.dataset.value = p.name;
  sw.addEventListener("click", ()=> applyDesign({type:"pattern", value:p.name}));
  patternSwatches.appendChild(sw);
});

document.querySelectorAll(".tab-btn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(p=>p.classList.add("hidden"));
    btn.classList.add("active");
    document.getElementById("tab-"+btn.dataset.tab).classList.remove("hidden");
  });
});

function targetObj(){
  if(!designTarget) return null;
  return designTarget.kind === "folder" ? state.folders.find(f=>f.id===designTarget.id) : getNote(designTarget.id);
}

function openDesignSheet(kind, id){
  designTarget = {kind, id};
  const obj = targetObj();
  refreshSwatchSelection(obj.design);
  photoRemoveBtn.classList.toggle("hidden", !(obj.design && obj.design.type==="photo"));
  sheetBackdrop.classList.remove("hidden");
  designSheet.classList.remove("hidden");
}
function closeDesignSheet(){
  sheetBackdrop.classList.add("hidden");
  designSheet.classList.add("hidden");
  designTarget = null;
}
function refreshSwatchSelection(design){
  [...colorSwatches.children].forEach(el=> el.classList.toggle("selected", design && design.type==="color" && el.dataset.value===design.value));
  [...patternSwatches.children].forEach(el=> el.classList.toggle("selected", design && design.type==="pattern" && el.dataset.value===design.value));
}

async function applyDesign(design){
  const obj = targetObj(); if(!obj) return;
  obj.design = { ...design };
  await saveState();
  refreshSwatchSelection(obj.design);
  if(designTarget.kind === "note" && currentNoteId){
    applyStyleObj(editorScreen, backgroundStyleFor(obj.design));
    editorScreen.style.color = textColorFor(obj.design);
  }
  renderHome();
}

photoInput.addEventListener("change", async (e)=>{
  const file = e.target.files[0]; if(!file) return;
  const dataUrl = await fileToDataUrl(file);
  await applyDesign({type:"photo", dataUrl});
  photoRemoveBtn.classList.remove("hidden");
  photoInput.value = "";
});
photoRemoveBtn.addEventListener("click", async ()=>{
  const fallback = designTarget.kind === "folder" ? DEFAULT_FOLDER_DESIGN : DEFAULT_NOTE_DESIGN;
  await applyDesign({...fallback});
  photoRemoveBtn.classList.add("hidden");
});

function fileToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = ()=>resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

document.getElementById("btn-editor-design").addEventListener("click", ()=>{
  if(currentNoteId) openDesignSheet("note", currentNoteId);
});
btnFolderCover.addEventListener("click", ()=>{
  if(currentFolderId) openDesignSheet("folder", currentFolderId);
});
document.getElementById("sheet-done").addEventListener("click", closeDesignSheet);
sheetBackdrop.addEventListener("click", ()=>{
  closeDesignSheet();
  closeMoveSheet();
});

/* ===================== Move to folder ===================== */

const moveSheet = document.getElementById("move-sheet");
const moveList = document.getElementById("move-list");

function openMoveSheet(){
  const note = getNote(currentNoteId); if(!note) return;
  moveList.innerHTML = "";
  const homeOpt = document.createElement("button");
  homeOpt.className = "move-option" + (!note.folderId ? " active" : "");
  homeOpt.innerHTML = `<span class="move-swatch" style="background:#E4DCC8"></span> Home (no folder)`;
  homeOpt.addEventListener("click", ()=> moveNoteTo(null));
  moveList.appendChild(homeOpt);

  state.folders.forEach(f=>{
    const opt = document.createElement("button");
    opt.className = "move-option" + (note.folderId===f.id ? " active" : "");
    const bg = f.design && f.design.type==="color" ? f.design.value : "#8FB9AE";
    opt.innerHTML = `<span class="move-swatch" style="background:${bg}"></span> ${escapeHtml(f.name)}`;
    opt.addEventListener("click", ()=> moveNoteTo(f.id));
    moveList.appendChild(opt);
  });
  sheetBackdrop.classList.remove("hidden");
  moveSheet.classList.remove("hidden");
}
function closeMoveSheet(){ moveSheet.classList.add("hidden"); }

async function moveNoteTo(folderId){
  const note = getNote(currentNoteId); if(!note) return;
  note.folderId = folderId;
  await saveState();
  closeMoveSheet();
  sheetBackdrop.classList.add("hidden");
  toast(folderId ? "Moved into folder" : "Moved to Home");
}

document.getElementById("btn-editor-move").addEventListener("click", openMoveSheet);

/* ===================== Settings & Notifications ===================== */

const settingsScreen = document.getElementById("settings");
const btnNotifToggle = document.getElementById("btn-notif-toggle");
const notifStatus = document.getElementById("notif-status");

document.getElementById("btn-settings").addEventListener("click", ()=>{
  settingsScreen.classList.remove("hidden");
  updateNotifUI();
});
document.getElementById("btn-settings-close").addEventListener("click", ()=>{
  settingsScreen.classList.add("hidden");
});

function updateNotifUI(){
  const perm = ("Notification" in window) ? Notification.permission : "unsupported";
  if(perm === "granted"){
    btnNotifToggle.textContent = "Enabled";
    btnNotifToggle.disabled = true;
    notifStatus.textContent = "You'll be notified 10 minutes before each timed plan, while Leaflet is open or recently open.";
  } else if(perm === "denied"){
    btnNotifToggle.textContent = "Blocked";
    btnNotifToggle.disabled = true;
    notifStatus.textContent = "Notifications are blocked in your browser settings. Enable them for this site to get reminders.";
  } else if(perm === "unsupported"){
    btnNotifToggle.textContent = "Unavailable";
    btnNotifToggle.disabled = true;
    notifStatus.textContent = "This browser doesn't support notifications.";
  } else {
    btnNotifToggle.textContent = "Enable";
    btnNotifToggle.disabled = false;
    notifStatus.textContent = "Reminders are off. Tap Enable to allow Leaflet to notify you before your plans.";
  }
}

btnNotifToggle.addEventListener("click", async ()=>{
  if(!("Notification" in window)) return;
  const perm = await Notification.requestPermission();
  updateNotifUI();
  if(perm === "granted"){
    toast("Reminders enabled");
    scheduleAllReminders();
  }
});

function clearTimerFor(itemId){
  if(notifTimers.has(itemId)){
    clearTimeout(notifTimers.get(itemId));
    notifTimers.delete(itemId);
  }
}

function nextOccurrence(timeStr){
  const [h,m] = timeStr.split(":").map(Number);
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  const notifyAt = new Date(target.getTime() - 10*60000);
  if(notifyAt.getTime() <= now.getTime()){
    target.setDate(target.getDate()+1);
    return new Date(target.getTime() - 10*60000);
  }
  return notifyAt;
}

function scheduleAllReminders(){
  if(!("Notification" in window) || Notification.permission !== "granted") return;
  // clear all, reschedule fresh
  notifTimers.forEach(id=>clearTimeout(id));
  notifTimers.clear();

  state.notes.filter(n=>n.type==="planning").forEach(note=>{
    note.items.forEach(item=>{
      if(!item.time || item.done) return;
      const notifyAt = nextOccurrence(item.time);
      const ms = notifyAt.getTime() - Date.now();
      if(ms <= 0 || ms > 2**31-1) return;
      const id = setTimeout(()=>fireNotification(note, item), ms);
      notifTimers.set(item.id, id);
    });
  });
}

function fireNotification(note, item){
  const title = "In 10 minutes: " + item.text;
  const options = { body: `From "${note.title || "Today's Plan"}" · ${item.time}`, icon:"icon-192.png", badge:"icon-192.png", tag:item.id };
  if(navigator.serviceWorker && navigator.serviceWorker.controller){
    navigator.serviceWorker.controller.postMessage({ type:"SHOW_NOTIFICATION", title, options });
  } else if(Notification.permission === "granted"){
    new Notification(title, options);
  }
  // reschedule for the next day automatically
  scheduleAllReminders();
}

/* ===================== Init ===================== */

async function init(){
  await loadState();
  renderHome();
  updateNotifUI();
  scheduleAllReminders();

  if("serviceWorker" in navigator){
    try { await navigator.serviceWorker.register("sw.js"); } catch(e){ console.warn("SW registration failed", e); }
  }
}
init();
