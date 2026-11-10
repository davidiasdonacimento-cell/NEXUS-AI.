"use strict";

(() => {
const $ = (id) => document.getElementById(id);

const KEY = {tabs:"nx_tabs_v2",active:"nx_active_v2",history:"nx_history_v2",bookmarks:"nx_bookmarks_v2",shortcuts:"nx_shortcuts_v2",settings:"nx_settings_v2"};

const HOME="nexus://home", SEARCH="nexus://search/", PRIVATE="nexus://private", MAX_TABS=18;

const state={tabs:[],activeId:null,history:[],bookmarks:[],shortcuts:[],settings:{theme:"dark",restoreTabs:true,showBookmarks:true},request:0};

function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)) ?? fallback}catch{return fallback}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));
return true}catch{toast("Armazenamento indisponível.");
return false}}
function id(){return "tab-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8)}
function tab(options={}){return {id:options.id||id(),title:options.title||"Nova guia",url:options.url||HOME,private:!!options.private,pinned:!!options.pinned,back:options.back||[],forward:options.forward||[]}}
function active(){return state.tabs.find(x=>x.id===state.activeId)||state.tabs[0]}
function http(value){try{const u=new URL(value);
return u.protocol==="http:"||u.protocol==="https:"}catch{return false}}
function host(value){try{return new URL(value).hostname.replace(/^www\./,"")}catch{return "Nova guia"}}
function normalize(value){const v=String(value||"").trim();
if(!v||/^(javascript|data|file|intent|ftp):/i.test(v))return "";
if(/^https?:\/\//i.test(v))return http(v)?v:"";
if(/^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(v))return "https://"+v;
if(/^localhost(:\d+)?/.test(v))return "http://"+v;
return ""}
function toast(message){const node=$("toast");
node.textContent=message;
node.classList.add("show");
clearTimeout(toast.timer);
toast.timer=setTimeout(()=>node.classList.remove("show"),2500)}
function status(message){$("statusText").textContent=message}
function persistTabs(){write(KEY.tabs,state.tabs.filter(t=>!t.private));
write(KEY.active,state.activeId)}
function persistHistory(){write(KEY.history,state.history.slice(0,300))}
function persistBookmarks(){write(KEY.bookmarks,state.bookmarks.slice(0,100));
renderBookmarkBar()}
function persistShortcuts(){write(KEY.shortcuts,state.shortcuts.slice(0,20));
renderShortcuts()}
function persistSettings(){write(KEY.settings,state.settings);
applySettings()}
function applySettings(){document.body.dataset.theme=state.settings.theme||"dark";
$("bookmarkBar").classList.toggle("hidden",!state.settings.showBookmarks)}
function view(id){document.querySelectorAll(".page-view").forEach(x=>x.classList.toggle("active",x.id===id))}
function address(value){$("address").value=value||"";
$("securityIcon").textContent=value.startsWith("https://")?"⌑":"⌕"}
function setUrl(t,url,push=true){if(!t)return;
if(push&&t.url!==url){t.back.push(t.url);
t.back=t.back.slice(-30);
t.forward=[]}t.url=url;
if(!t.private)persistTabs();
renderTabs();
if(t.id===state.activeId)renderCurrent()}
function record(url,t){if(t.private||!http(url))return;
state.history=[{url,title:host(url),time:Date.now()},...state.history.filter(x=>x.url!==url)].slice(0,300);
persistHistory()}
function navigate(url){const t=active();
if(!t)return;
if(url===HOME||url===PRIVATE||url.startsWith(SEARCH)){setUrl(t,url);
return}if(!http(url)){toast("Endereço inválido.");
return}t.title=host(url);
setUrl(t,url);
record(url,t);
status("Carregando "+host(url))}
function input(value){const v=String(value||"").trim();
if(!v)return;
const url=normalize(v);
if(url)navigate(url);
else if(!/^[a-z]+:/i.test(v))search(v);
else toast("Endereço não permitido.")}
async function search(query){const t=active();
if(!t||!query.trim())return;
const q=query.trim();
t.title="Pesquisa: "+q.slice(0,24);
t.url=SEARCH+encodeURIComponent(q);
if(!t.private)persistTabs();
renderTabs();
const request=++state.request;
view("searchPage");
address(q);
$("resultsQuery").value=q;
$("resultsMeta").textContent="Pesquisando por "+q;
$("searchResults").innerHTML="<div class=\"loading-state\"><span class=\"spinner\"></span> Pesquisando...</div>";
status("Pesquisando na web");
try{const response=await fetch("/api/search?q="+encodeURIComponent(q),{headers:{"Accept":"application/json"},cache:"no-store"});
const data=await response.json();
if(request!==state.request||active()?.id!==t.id)return;
renderResults(data,response.ok)}catch(error){if(request!==state.request)return;
$("resultsMeta").textContent="Pesquisa indisponível";
$("searchResults").textContent="Verifique sua conexão e tente novamente."}}
function renderResults(data,ok){const root=$("searchResults");
root.replaceChildren();
const items=Array.isArray(data.results)?data.results:[];
$("resultsMeta").textContent=items.length?items.length+" resultados · DuckDuckGo":"Nenhum resultado disponível";
if(!items.length){const p=document.createElement("p");
p.className="empty-state";
p.textContent=data.error||"Tente outra pesquisa.";
root.append(p);
return}items.forEach(item=>{if(!http(item.url))return;
const article=document.createElement("article");
article.className="result-item";
const url=document.createElement("div");
url.className="result-url";
url.textContent=host(item.url);
const link=document.createElement("a");
link.className="result-title";
link.href="#";
link.textContent=item.title||item.url;
link.addEventListener("click",e=>{e.preventDefault();
navigate(item.url)});
const snippet=document.createElement("p");
snippet.className="result-snippet";
snippet.textContent=item.snippet||"Abrir página";
article.append(url,link,snippet);
root.append(article)})}
function renderCurrent(){const t=active();
if(!t)return;
clearTimeout(renderCurrent.timer);
$("blockedNotice").classList.add("hidden");
$("webLoading").classList.add("hidden");
$("pageFrame").src="about:blank";
$("pageFrame").classList.remove("visible");
if(t.private){if(t.url===PRIVATE||t.url===HOME){view("privatePage");
address("");
status("Navegação privada")}else if(t.url.startsWith(SEARCH))search(decodeURIComponent(t.url.slice(SEARCH.length)));
else loadPage(t.url);
return}if(t.url===HOME){view("startPage");
address("");
status("Página inicial")}else if(t.url.startsWith(SEARCH))search(decodeURIComponent(t.url.slice(SEARCH.length)));
else if(http(t.url))loadPage(t.url);
else view("startPage")}
function loadPage(url){view("webPage");
address(url);
$("webLoading").classList.remove("hidden");
$("pageFrame").classList.add("visible");
$("pageFrame").src=url;
renderCurrent.timer=setTimeout(()=>{if(active()?.url===url&&!$("webLoading").classList.contains("hidden")){$("webLoading").classList.add("hidden");
$("blockedNotice").classList.remove("hidden");
status("O site pode bloquear a incorporação")}},14000);
status("Abrindo "+host(url))}
function frameLoaded(){clearTimeout(renderCurrent.timer);
$("webLoading").classList.add("hidden");
$("blockedNotice").classList.add("hidden");
if(http(active()?.url||""))status("Página carregada · "+host(active().url))}
function renderTabs(){const root=$("tabStrip");
root.replaceChildren();
state.tabs.forEach(t=>{const b=document.createElement("button");
b.className="tab"+(t.id===state.activeId?" active":"")+(t.private?" private-tab":"");
b.setAttribute("role","tab");
b.setAttribute("aria-selected",String(t.id===state.activeId));
const icon=document.createElement("span");
icon.className="tab-favicon";
icon.textContent=t.private?"◉":"N";
const title=document.createElement("span");
title.className="tab-title";
title.textContent=t.title;
const close=document.createElement("span");
close.className="tab-close";
close.textContent="×";
close.addEventListener("click",e=>{e.stopPropagation();
closeTab(t.id)});
b.append(icon,title,close);
b.addEventListener("click",()=>switchTab(t.id));
root.append(b)});
const add=document.createElement("button");
add.className="add-tab";
add.id="newTab";
add.title="Nova aba (Ctrl+T)";
add.textContent="＋";
add.addEventListener("click",()=>createTab(false));
root.append(add);
$("tabCounter").textContent=state.tabs.length+(state.tabs.length===1?" aba":" abas")}
function createTab(privateMode=false){if(state.tabs.length>=MAX_TABS){toast("Limite de "+MAX_TABS+" abas.");
return}const t=tab({private:privateMode,url:privateMode?PRIVATE:HOME,title:privateMode?"Anônima":"Nova guia"});
state.tabs.push(t);
state.activeId=t.id;
renderTabs();
renderCurrent();
persistTabs();
$("address").focus()}
function switchTab(id){if(!state.tabs.some(t=>t.id===id))return;
state.activeId=id;
renderTabs();
renderCurrent();
persistTabs()}
function closeTab(id){const i=state.tabs.findIndex(t=>t.id===id);
if(i<0)return;
const was=state.activeId===id;
state.tabs.splice(i,1);
if(!state.tabs.length)state.tabs.push(tab());
if(was)state.activeId=state.tabs[Math.max(0,i-1)].id;
renderTabs();
renderCurrent();
persistTabs()}
function moveHistory(direction){const t=active();
if(!t)return;
if(direction==="back"&&t.back.length){t.forward.push(t.url);
t.url=t.back.pop()}else if(direction==="forward"&&t.forward.length){t.back.push(t.url);
t.url=t.forward.pop()}else{toast("Não há mais páginas nessa direção.");
return}persistTabs();
renderTabs();
renderCurrent()}
function renderBookmarkBar(){const root=$("bookmarkShortcuts");
root.replaceChildren();
state.bookmarks.slice(0,8).forEach(item=>{const b=document.createElement("button");
b.className="bookmark-link";
b.textContent=item.name;
b.title=item.url;
b.addEventListener("click",()=>navigate(item.url));
root.append(b)})}
function renderShortcuts(){const root=$("quickGrid");
root.querySelectorAll(".custom-shortcut").forEach(x=>x.remove());
state.shortcuts.forEach(item=>{const b=document.createElement("button");
b.className="quick-card custom-shortcut";
const icon=document.createElement("span");
icon.className="quick-icon";
icon.textContent=item.name.slice(0,1).toUpperCase();
const label=document.createElement("span");
label.textContent=item.name;
b.append(icon,label);
b.addEventListener("click",()=>navigate(item.url));
root.append(b)})}
function addBookmark(){const t=active();
if(!t||!http(t.url)){toast("Abra um site para favoritar.");
return}if(state.bookmarks.some(x=>x.url===t.url)){toast("Já está nos favoritos.");
return}state.bookmarks.unshift({name:host(t.url),url:t.url,time:Date.now()});
persistBookmarks();
toast("Favorito salvo.")}
function panelRow(icon,title,subtitle,open,remove){const row=document.createElement("div");
row.className="panel-row";
const glyph=document.createElement("span");
glyph.className="panel-row-icon";
glyph.textContent=icon;
const main=document.createElement("div");
main.className="panel-row-main";
const a=document.createElement("a");
a.href="#";
a.className="panel-row-title";
a.textContent=title;
a.addEventListener("click",e=>{e.preventDefault();
open()});
const small=document.createElement("span");
small.className="panel-row-sub";
small.textContent=subtitle;
main.append(a,small);
row.append(glyph,main);
if(remove){const b=document.createElement("button");
b.className="panel-row-action";
b.textContent="×";
b.addEventListener("click",remove);
row.append(b)}return row}
function emptyPanel(message){const p=document.createElement("div");
p.className="panel-empty";
p.textContent=message;
return p}
function openPanel(name){$("menuPopover").classList.add("hidden");
state.panel=name;
$("panelTitle").textContent=({history:"Histórico",bookmarks:"Favoritos",downloads:"Downloads",settings:"Configurações"})[name]||"NEXUS";
renderPanel(name);
view("panelPage")}
function renderPanel(name){const root=$("panelContent");
root.replaceChildren();
if(name==="history"){const clear=document.createElement("button");
clear.className="small-action";
clear.textContent="Limpar histórico";
clear.addEventListener("click",()=>{state.history=[];
persistHistory();
renderPanel(name)});
const bar=document.createElement("div");
bar.className="panel-toolbar";
bar.append(clear);
root.append(bar);
if(!state.history.length){root.append(emptyPanel("Seu histórico está vazio."));
return}state.history.forEach(x=>root.append(panelRow("◷",x.title,x.url,()=>navigate(x.url))))}else if(name==="bookmarks"){const bar=document.createElement("div");
bar.className="panel-toolbar";
const exp=document.createElement("button");
exp.className="small-action";
exp.textContent="Exportar";
exp.addEventListener("click",exportBookmarks);
const imp=document.createElement("button");
imp.className="small-action";
imp.textContent="Importar";
imp.addEventListener("click",importBookmarks);
bar.append(exp,imp);
root.append(bar);
if(!state.bookmarks.length){root.append(emptyPanel("Nenhum favorito salvo."));
return}state.bookmarks.forEach((x,i)=>root.append(panelRow("☆",x.name,x.url,()=>navigate(x.url),()=>{state.bookmarks.splice(i,1);
persistBookmarks();
renderPanel(name)})))}else if(name==="downloads"){root.append(emptyPanel("Os downloads são gerenciados pelo navegador do dispositivo. O NEXUS não pode consultar downloads de outros aplicativos."))}else if(name==="settings")renderSettings(root)}
function renderSettings(root){const grid=document.createElement("div");
grid.className="settings-grid";
const cards=[["Aparência","Escolha o visual."],["Privacidade","Gerencie os dados locais."],["Inicialização","Restaurar abas normais."],["Barra de favoritos","Mostrar atalhos."]];
cards.forEach((item,i)=>{const card=document.createElement("section");
card.className="setting-card";
const h=document.createElement("h3");
h.textContent=item[0];
const p=document.createElement("p");
p.textContent=item[1];
card.append(h,p);
if(i===0){const row=document.createElement("div");
row.className="theme-options";
[["dark","Escuro"],["light","Claro"],["midnight","Roxo"]].forEach(([v,label])=>{const b=document.createElement("button");
b.className="theme-choice"+(state.settings.theme===v?" active":"");
b.textContent=label;
b.addEventListener("click",()=>{state.settings.theme=v;
persistSettings();
renderPanel("settings")});
row.append(b)});
card.append(row)}else{const b=document.createElement("button");
b.className="theme-choice";
b.textContent=i===1?"Limpar dados":i===2?(state.settings.restoreTabs?"Ativado":"Desativado"):(state.settings.showBookmarks?"Visível":"Oculta");
b.addEventListener("click",()=>{if(i===1)clearData();
if(i===2)state.settings.restoreTabs=!state.settings.restoreTabs;
if(i===3)state.settings.showBookmarks=!state.settings.showBookmarks;
persistSettings();
renderPanel("settings")});
card.append(b)}grid.append(card)});
root.append(grid)}
function exportBookmarks(){const blob=new Blob([JSON.stringify(state.bookmarks,null,2)],{type:"application/json"});
const url=URL.createObjectURL(blob);
const a=document.createElement("a");
a.href=url;
a.download="nexus-favoritos.json";
a.click();
URL.revokeObjectURL(url)}
function importBookmarks(){const input=document.createElement("input");
input.type="file";
input.accept=".json,application/json";
input.addEventListener("change",async()=>{const file=input.files?.[0];
if(!file||file.size>500000){toast("Arquivo inválido.");
return}try{const data=JSON.parse(await file.text());
if(!Array.isArray(data))throw Error();
const valid=data.filter(x=>x&&typeof x.name==="string"&&http(x.url));
state.bookmarks=[...valid,...state.bookmarks].slice(0,100);
persistBookmarks();
renderPanel("bookmarks");
toast(valid.length+" favoritos importados.")}catch{toast("Não foi possível importar o arquivo.")}});
input.click()}
function clearData(){if(!confirm("Apagar histórico, favoritos e atalhos locais?"))return;
state.history=[];
state.bookmarks=[];
state.shortcuts=[];
persistHistory();
persistBookmarks();
persistShortcuts();
toast("Dados locais apagados.")}
function addShortcut(name,value){const url=normalize(value);
if(!url){$("modalError").textContent="Digite um endereço http ou https válido.";
return}if(state.shortcuts.some(x=>x.url===url)){$("modalError").textContent="Esse atalho já existe.";
return}state.shortcuts.push({name:name.trim().slice(0,40),url});
persistShortcuts();
$("modalBackdrop").classList.add("hidden");
toast("Atalho adicionado.")}
function showModal(){$("modalName").value="";
$("modalUrl").value="";
$("modalError").textContent="";
$("modalBackdrop").classList.remove("hidden");
$("modalName").focus()}
function closeModal(){$("modalBackdrop").classList.add("hidden")}
function reload(){const t=active();
if(!t)return;
if(http(t.url))loadPage(t.url);
else renderCurrent()}
function openExternal(){const t=active();
if(t&&http(t.url))window.open(t.url,"_blank","noopener,noreferrer")}
function keyboard(e){const k=e.key.toLowerCase();
if((e.ctrlKey||e.metaKey)&&k==="t"){e.preventDefault();
createTab(false)}else if((e.ctrlKey||e.metaKey)&&e.shiftKey&&k==="n"){e.preventDefault();
createTab(true)}else if((e.ctrlKey||e.metaKey)&&k==="w"){e.preventDefault();
if(active())closeTab(active().id)}else if((e.ctrlKey||e.metaKey)&&k==="l"){e.preventDefault();
$("address").focus();
$("address").select()}else if((e.ctrlKey||e.metaKey)&&k==="r"){e.preventDefault();
reload()}else if(e.altKey&&e.key==="ArrowLeft"){e.preventDefault();
moveHistory("back")}else if(e.altKey&&e.key==="ArrowRight"){e.preventDefault();
moveHistory("forward")}else if((e.ctrlKey||e.metaKey)&&e.key==="Tab"){e.preventDefault();
const i=state.tabs.findIndex(x=>x.id===state.activeId);
switchTab(state.tabs[(i+1)%state.tabs.length].id)}else if(e.key==="Escape")closeModal()}
function restoreTabs(){const saved=state.settings.restoreTabs?read(KEY.tabs,[]):[];
if(Array.isArray(saved))saved.slice(0,MAX_TABS).forEach(x=>{if(x&&(x.url===HOME||x.url.startsWith(SEARCH)||http(x.url)))state.tabs.push(tab(x))});
const previous=read(KEY.active,null);
if(!state.tabs.length)state.tabs.push(tab());
state.activeId=state.tabs.some(x=>x.id===previous)?previous:state.tabs[0].id;
renderTabs();
renderCurrent()}
function events(){
$("addressForm").addEventListener("submit",e=>{e.preventDefault();
input($("address").value);
$("address").blur()});

$("address").addEventListener("focus",()=>$("address").select());

$("clearAddress").addEventListener("click",()=>{$("address").value="";
$("address").focus()});

$("startSearchForm").addEventListener("submit",e=>{e.preventDefault();
input($("startSearch").value);
$("startSearch").value=""});

$("resultsSearchForm").addEventListener("submit",e=>{e.preventDefault();
search($("resultsQuery").value)});

$("privateSearchForm").addEventListener("submit",e=>{e.preventDefault();
input($("privateSearch").value)});

$("newTab").addEventListener("click",()=>createTab(false));
$("privateToggle").addEventListener("click",()=>createTab(true));
$("startPrivate").addEventListener("click",()=>createTab(true));

$("homeButton").addEventListener("click",()=>navigate(HOME));
$("back").addEventListener("click",()=>moveHistory("back"));
$("forward").addEventListener("click",()=>moveHistory("forward"));
$("reload").addEventListener("click",reload);
$("bookmarkCurrent").addEventListener("click",addBookmark);

$("historyButton").addEventListener("click",()=>openPanel("history"));
$("downloadsButton").addEventListener("click",()=>openPanel("downloads"));
$("manageBookmarks").addEventListener("click",()=>openPanel("bookmarks"));
$("bookmarkBar").querySelector("[data-action=home]").addEventListener("click",()=>navigate(HOME));

$("addShortcut").addEventListener("click",showModal);
$("menuButton").addEventListener("click",()=>$("menuPopover").classList.toggle("hidden"));

$("menuPopover").addEventListener("click",e=>{const b=e.target.closest("button");
if(!b)return;
if(b.dataset.panel)openPanel(b.dataset.panel);
if(b.dataset.action==="new-private")createTab(true);
if(b.dataset.action==="clear-data")clearData()});

$("panelBack").addEventListener("click",renderCurrent);
$("panelClose").addEventListener("click",renderCurrent);
$("modalClose").addEventListener("click",closeModal);
$("modalCancel").addEventListener("click",closeModal);

$("modalBackdrop").addEventListener("click",e=>{if(e.target===$("modalBackdrop"))closeModal()});
$("modalForm").addEventListener("submit",e=>{e.preventDefault();
addShortcut($("modalName").value,$("modalUrl").value)});

$("openBlockedExternal").addEventListener("click",openExternal);
$("backToStart").addEventListener("click",()=>navigate(HOME));
$("pageFrame").addEventListener("load",frameLoaded);

document.querySelectorAll(".quick-card:not(.custom-shortcut)").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.url)));

document.addEventListener("keydown",keyboard);
document.addEventListener("click",e=>{if(!e.target.closest("#menuPopover")&&!e.target.closest("#menuButton"))$("menuPopover").classList.add("hidden")});
window.addEventListener("beforeunload",persistTabs);

}
function init(){state.history=read(KEY.history,[]);
state.bookmarks=read(KEY.bookmarks,[]);
state.shortcuts=read(KEY.shortcuts,[]);
state.settings=Object.assign(state.settings,read(KEY.settings,{}));
if(!Array.isArray(state.history))state.history=[];
if(!Array.isArray(state.bookmarks))state.bookmarks=[];
if(!Array.isArray(state.shortcuts))state.shortcuts=[];
applySettings();
renderBookmarkBar();
renderShortcuts();
$("startDate").textContent=new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"});
events();
restoreTabs();
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("/static/sw.js").catch(()=>{}))}
init();

})();
