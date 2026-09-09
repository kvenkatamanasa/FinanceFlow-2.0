const KEY="financeFlow20";
let state=JSON.parse(localStorage.getItem(KEY)||"null")||{
  transactions:[], budgets:{}, goals:{}, recurring:[], dark:false
};
let trendChart=null, categoryChart=null;

const categoryIcons={Food:"🍔",Travel:"✈️",Shopping:"🛍️",Bills:"💡",Education:"📚",Entertainment:"🎬",Others:"📦"};
const incomeCategories=["Salary","Freelance","Business","Scholarship","Gift","Other"];

document.addEventListener("DOMContentLoaded",()=>{
  if(state.dark)document.body.classList.add("dark");
  document.getElementById("darkModeBtn").textContent=state.dark?"☀️":"🌙";
  document.getElementById("currentDate").textContent=new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
  setDateDefaults(); populateMonths(); renderRecurring(); refreshDashboard();
});

function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function money(v){return "₹"+Number(v||0).toLocaleString("en-IN",{maximumFractionDigits:2})}
function today(){return new Date().toISOString().slice(0,10)}
function monthKey(date){return String(date).slice(0,7)}
function selectedMonth(){return document.getElementById("monthFilter").value||monthKey(today())}
function setDateDefaults(){document.getElementById("incomeDate").value=today();document.getElementById("expenseDate").value=today()}

function populateMonths(){
  const select=document.getElementById("monthFilter"), current=monthKey(today()), old=select.value;
  const keys=new Set([current,...Object.keys(state.budgets),...Object.keys(state.goals),...state.transactions.map(t=>monthKey(t.date))]);
  const sorted=[...keys].sort().reverse();
  select.innerHTML=sorted.map(k=>`<option value="${k}">${new Date(k+"-01").toLocaleDateString("en-IN",{month:"long",year:"numeric"})}</option>`).join("");
  select.value=sorted.includes(old)?old:current;
}

function refreshDashboard(){
  populateMonths();
  const m=selectedMonth();
  document.getElementById("selectedMonthLabel").textContent=new Date(m+"-01").toLocaleDateString("en-IN",{month:"long",year:"numeric"});
  const tx=state.transactions.filter(t=>monthKey(t.date)===m);
  const income=tx.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const expense=tx.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  const balance=income-expense, budget=Number(state.budgets[m]||0);
  const rate=income>0?Math.round((balance/income)*100):0;
  document.getElementById("income").textContent=money(income);
  document.getElementById("expense").textContent=money(expense);
  document.getElementById("balance").textContent=money(balance);
  document.getElementById("budgetDisplay").textContent=money(budget);
  document.getElementById("savingsRate").textContent=Math.max(0,rate)+"%";
  document.getElementById("budgetInput").value=budget||"";
  const percent=budget>0?Math.round(expense/budget*100):0;
  document.getElementById("budgetPercent").textContent=percent+"%";
  document.getElementById("budgetProgress").style.width=Math.min(percent,100)+"%";
  const msg=document.getElementById("budgetMessage");
  if(!budget)msg.textContent="Set a budget to start monitoring spending.";
  else if(percent>100)msg.textContent=`🚨 Budget exceeded by ${money(expense-budget)}.`;
  else if(percent>=90)msg.textContent="🔴 Careful — you are very close to your budget limit.";
  else if(percent>=70)msg.textContent="🟡 Warning — more than 70% of the budget is used.";
  else msg.textContent=`🟢 ${money(budget-expense)} remaining from your monthly budget.`;
  renderGoal(m);renderTransactions();updateCharts(m,tx);renderInsights(m,tx,income,expense,balance,budget);renderRecurring();
}

function setBudget(){
  const v=Number(document.getElementById("budgetInput").value);
  if(!v||v<0)return showToast("Enter a valid budget.");
  state.budgets[selectedMonth()]=v;save();refreshDashboard();showToast("Budget saved.");
}

function addIncome(){
  const amount=Number(document.getElementById("incomeAmount").value), date=document.getElementById("incomeDate").value;
  if(!amount||amount<=0||!date)return showToast("Enter amount and date.");
  state.transactions.unshift({id:Date.now(),type:"income",amount,category:document.getElementById("incomeCategory").value,note:"Income received",date});
  document.getElementById("incomeAmount").value="";save();refreshDashboard();showToast("Income added.");
}

function addExpense(){
  const amount=Number(document.getElementById("expenseAmount").value),date=document.getElementById("expenseDate").value;
  if(!amount||amount<=0||!date)return showToast("Enter amount and date.");
  state.transactions.unshift({id:Date.now(),type:"expense",amount,category:document.getElementById("category").value,note:document.getElementById("expenseNote").value.trim()||document.getElementById("category").value+" expense",date});
  document.getElementById("expenseAmount").value="";document.getElementById("expenseNote").value="";
  save();refreshDashboard();showToast("Expense added.");
}

function renderTransactions(){
  const list=document.getElementById("history"),empty=document.getElementById("emptyState"),m=selectedMonth();
  const search=document.getElementById("search").value.toLowerCase().trim(),type=document.getElementById("filterType").value,cat=document.getElementById("filterCategory").value;
  const filtered=state.transactions.filter(t=>monthKey(t.date)===m&&(!search||`${t.category} ${t.note}`.toLowerCase().includes(search))&&(type==="all"||t.type===type)&&(cat==="all"||t.category===cat));
  list.innerHTML="";empty.style.display=filtered.length?"none":"block";
  filtered.forEach(t=>{
    const li=document.createElement("li");li.className="transaction";
    const icon=t.type==="income"?"↗":(categoryIcons[t.category]||"📦"),sign=t.type==="income"?"+":"-";
    li.innerHTML=`<div class="tx-icon ${t.type}">${icon}</div><div class="tx-main"><strong>${esc(t.note)}</strong><small>${esc(t.category)} · ${t.type==="income"?"Income":"Expense"}</small></div><div class="tx-date">${formatDate(t.date)}</div><div class="tx-amount ${t.type}">${sign}${money(t.amount)}</div><button class="edit-btn" title="Edit" onclick="openEdit(${t.id})">✎</button><button class="delete-btn" title="Delete" onclick="deleteTransaction(${t.id})">×</button>`;
    list.appendChild(li);
  });
}
function formatDate(d){return new Date(d+"T00:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}
function deleteTransaction(id){if(!confirm("Delete this transaction?"))return;state.transactions=state.transactions.filter(t=>t.id!==id);save();refreshDashboard();showToast("Transaction deleted.")}
function clearAllTransactions(){if(!state.transactions.length)return showToast("No transactions to clear.");if(!confirm("Delete ALL transaction history?"))return;state.transactions=[];save();refreshDashboard();showToast("History cleared.")}

function openEdit(id){
  const t=state.transactions.find(x=>x.id===id);if(!t)return;
  document.getElementById("editId").value=id;document.getElementById("editAmount").value=t.amount;document.getElementById("editNote").value=t.note;document.getElementById("editDate").value=t.date;
  const c=document.getElementById("editCategory");
  const options=t.type==="income"?incomeCategories:["Food","Travel","Shopping","Bills","Education","Entertainment","Others"];
  c.innerHTML=options.map(x=>`<option value="${x}">${x}</option>`).join("");c.value=t.category;
  document.getElementById("modal").classList.remove("hidden");
}
function closeModal(){document.getElementById("modal").classList.add("hidden")}
function updateTransaction(){
  const id=Number(document.getElementById("editId").value),t=state.transactions.find(x=>x.id===id),amount=Number(document.getElementById("editAmount").value);
  if(!t||!amount||amount<=0)return showToast("Enter a valid amount.");
  t.amount=amount;t.category=document.getElementById("editCategory").value;t.note=document.getElementById("editNote").value.trim()||t.category+" transaction";t.date=document.getElementById("editDate").value||today();
  save();closeModal();refreshDashboard();showToast("Transaction updated.");
}

function saveGoal(){
  const name=document.getElementById("goalName").value.trim(),target=Number(document.getElementById("goalTarget").value),saved=Number(document.getElementById("goalSaved").value||0);
  if(!name||!target||target<=0||saved<0)return showToast("Enter goal name and target.");
  state.goals[selectedMonth()]={name,target,saved:Math.min(saved,target)};save();refreshDashboard();showToast("Savings goal saved.");
}
function renderGoal(m){
  const g=state.goals[m],box=document.getElementById("goalDisplay");
  if(!g){box.innerHTML='<p class="small-note">No savings goal for this month yet.</p>';return}
  const p=Math.min(100,Math.round(g.saved/g.target*100));
  box.innerHTML=`<div class="goal-head"><strong>🎯 ${esc(g.name)}</strong><span>${money(g.saved)} / ${money(g.target)}</span></div><div class="goal-bar"><div style="width:${p}%"></div></div><div class="goal-foot"><span>${p}% complete</span><span>${money(Math.max(0,g.target-g.saved))} remaining</span></div>`;
}

function addRecurring(){
  const name=document.getElementById("recurringName").value.trim(),amount=Number(document.getElementById("recurringAmount").value),type=document.getElementById("recurringType").value;
  if(!name||!amount||amount<=0)return showToast("Enter recurring name and amount.");
  state.recurring.push({id:Date.now(),name,amount,type});save();document.getElementById("recurringName").value="";document.getElementById("recurringAmount").value="";renderRecurring();showToast("Recurring template saved.");
}
function applyRecurring(id){
  const r=state.recurring.find(x=>x.id===id);if(!r)return;
  const cat=r.type==="income"?"Other":"Others";
  state.transactions.unshift({id:Date.now(),type:r.type,amount:r.amount,category:cat,note:r.name,date:today()});
  save();refreshDashboard();showToast("Recurring transaction added for today.");
}
function removeRecurring(id){state.recurring=state.recurring.filter(x=>x.id!==id);save();renderRecurring()}
function renderRecurring(){
  const box=document.getElementById("recurringList");box.innerHTML="";
  state.recurring.forEach(r=>{const d=document.createElement("div");d.className="recurring-item";d.innerHTML=`<span>${r.type==="income"?"💵":"🔁"} ${esc(r.name)} · ${money(r.amount)}</span><button onclick="applyRecurring(${r.id})">Add</button><button onclick="removeRecurring(${r.id})">×</button>`;box.appendChild(d)})
}

function updateCharts(m,tx){
  if(trendChart)trendChart.destroy();if(categoryChart)categoryChart.destroy();
  const days=new Date(Number(m.slice(0,4)),Number(m.slice(5,7)),0).getDate(),labels=Array.from({length:days},(_,i)=>String(i+1));
  const inc=labels.map(d=>tx.filter(t=>t.type==="income"&&Number(t.date.slice(8))===Number(d)).reduce((s,t)=>s+t.amount,0));
  const exp=labels.map(d=>tx.filter(t=>t.type==="expense"&&Number(t.date.slice(8))===Number(d)).reduce((s,t)=>s+t.amount,0));
  trendChart=new Chart(document.getElementById("trendChart"),{type:"line",data:{labels,datasets:[{label:"Income",data:inc,tension:.35,borderColor:"#13a673",backgroundColor:"rgba(19,166,115,.08)",fill:true},{label:"Expense",data:exp,tension:.35,borderColor:"#e05260",backgroundColor:"rgba(224,82,96,.06)",fill:true}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom",labels:{usePointStyle:true,boxWidth:8}}},scales:{y:{beginAtZero:true,ticks:{callback:v=>"₹"+Number(v).toLocaleString("en-IN")}},x:{grid:{display:false}}}}});
  const cats=["Food","Travel","Shopping","Bills","Education","Entertainment","Others"],values=cats.map(c=>tx.filter(t=>t.type==="expense"&&t.category===c).reduce((s,t)=>s+t.amount,0));
  categoryChart=new Chart(document.getElementById("categoryChart"),{type:"doughnut",data:{labels:cats,datasets:[{data:values,backgroundColor:["#6c5ce7","#4f7cff","#13a673","#f1a33a","#e05260","#b36ce7","#8490a8"],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:"65%",plugins:{legend:{position:"bottom",labels:{usePointStyle:true,boxWidth:8,padding:12}}}}});
}

function renderInsights(m,tx,income,expense,balance,budget){
  const grid=document.getElementById("insightsGrid"),exp=tx.filter(t=>t.type==="expense");
  const byCat={};exp.forEach(t=>byCat[t.category]=(byCat[t.category]||0)+t.amount);
  const top=Object.entries(byCat).sort((a,b)=>b[1]-a[1])[0];
  const biggest=exp.sort((a,b)=>b.amount-a.amount)[0];
  const avg=exp.length?expense/Math.max(1,new Set(exp.map(t=>t.date)).size):0;
  const savings=Math.max(0,balance);
  let status=budget?`${Math.round(expense/budget*100)}% used`:"Not set";
  const cards=[
    ["Top category",top?top[0]:"No expenses",top?money(top[1]):"Add expenses to see your top category."],
    ["Biggest expense",biggest?money(biggest.amount):"₹0",biggest?`${biggest.category} · ${formatDate(biggest.date)}`:"No expense recorded."],
    ["Average daily spend",money(avg),exp.length?"Based on days with expenses.":"No spending data yet."],
    ["Budget status",status,budget?(expense>budget?"Above your limit":"Within your limit"):"Set a monthly budget."]
  ];
  grid.innerHTML=cards.map(c=>`<div class="insight"><span class="label">${c[0]}</span><strong>${esc(c[1])}</strong><p>${esc(c[2])}</p></div>`).join("");
}

function exportCSV(){
  const rows=[["Date","Type","Category","Note","Amount"],...state.transactions.filter(t=>monthKey(t.date)===selectedMonth()).map(t=>[t.date,t.type,t.category,t.note,t.amount])];
  if(rows.length===1)return showToast("No transactions to export for this month.");
  const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`FinanceFlow_${selectedMonth()}.csv`;a.click();URL.revokeObjectURL(url);showToast("CSV exported.");
}
function setCurrentMonth(){document.getElementById("monthFilter").value=monthKey(today());refreshDashboard()}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

document.getElementById("darkModeBtn").addEventListener("click",()=>{state.dark=!state.dark;document.body.classList.toggle("dark",state.dark);document.getElementById("darkModeBtn").textContent=state.dark?"☀️":"🌙";save()});
