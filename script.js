const firebaseConfig = {
  apiKey: "AIzaSyAa7AB13P8HLuB5cRWHhOsRAHBowcMJsc4",
  authDomain: "food-delivery-app-46de1.firebaseapp.com",
  databaseURL: "https://food-delivery-app-46de1-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "food-delivery-app-46de1",
  storageBucket: "food-delivery-app-46de1.firebasestorage.app",
  messagingSenderId: "218219407862",
  appId: "1:218219407862:web:df17a3059dfa3ece347fd7"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const dbOrders = database.ref('orders');
const dbCounter = database.ref('orderCounter');
const dbMenu = database.ref('menu'); 
const dbDailyCash = database.ref('daily_cash'); 

console.log("App Version 36.0 Loaded! Smart Duplicate Catcher Active.");

function getLocalIsoDate() {
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10);
}

window.showToast = function(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    if(!container) { alert(msg); return; }
    const t = document.createElement('div');
    t.className = `px-4 py-2 rounded shadow-lg text-white text-sm font-bold transition-all duration-300 transform translate-y-0 opacity-100 ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(-10px)'; setTimeout(()=>t.remove(), 300); }, 3000);
};

let allOrders = [], menuList = [], depositedCashData = {}, currentTotalCash = 0, cashSaveTimeout, editingMenuId = null; 
let currentlyEditingOrderId = null, originalOrderItems = [], editRestCount = 0;
let currentShiftFilter = 'All', currentTableFilter = 'All', currentRestFilter = 'All', currentRiderFilter = 'All';
let orderCounter = 0, pendingDelete = null;
let menuCollapsedState = {};

const $ = id => document.getElementById(id);

let currentFilterDate = getLocalIsoDate();
if ($('date-filter')) {
    $('date-filter').value = currentFilterDate;
}

const defaultConfig = { app_title: 'Daily Delivery Sales', background_color: '#0f1117', primary_action_color: '#e85d3a' };

dbOrders.on('value', (snapshot) => {
  try {
      const data = snapshot.val(); allOrders = [];
      if (data) { Object.keys(data).forEach(key => { allOrders.push({ __backendId: key, ...data[key] }); }); }
      updateStats(); renderOrders(); 
      if($('report-modal') && !$('report-modal').classList.contains('hidden')) window.populateReportDropdown();
  } catch (error) {
      console.error("Dashboard Load Error:", error);
  }
});

dbCounter.on('value', (snapshot) => { orderCounter = snapshot.val() || 0; });
dbMenu.on('value', (snapshot) => {
  const data = snapshot.val(); menuList = [];
  if (data) { Object.keys(data).forEach(key => { menuList.push({ __backendId: key, ...data[key] }); }); }
  renderMenuTable();
});
dbDailyCash.on('value', (snapshot) => { depositedCashData = snapshot.val() || {}; updatePendingCashUI(); });

window.handleDepositedCashChange = function() {
  if (!currentFilterDate || currentShiftFilter === 'All') return; 
  const val = parseFloat($('deposited-cash-input').value) || 0;
  updatePendingCashUI(val); 
  clearTimeout(cashSaveTimeout);
  cashSaveTimeout = setTimeout(() => { const key = currentFilterDate + "_" + (currentShiftFilter.replace(/\s+/g, '')); dbDailyCash.child(key).set(val); }, 800);
};

window.updatePendingCashUI = function(inputVal = null) {
  const inputEl = $('deposited-cash-input'), labelEl = $('deposited-label'), display = $('pending-cash-display');
  if (!currentFilterDate) {
      if (inputEl && labelEl) { inputEl.value = ''; inputEl.disabled = true; inputEl.parentElement.style.opacity = '0.5'; labelEl.textContent = 'Select Date for Cash:'; labelEl.style.color = '#94a3b8'; }
      if (display) display.textContent = ''; return;
  }
  
  const dateStr = currentFilterDate;
  const shiftStr = currentShiftFilter.replace(/\s+/g, '');
  const key = dateStr + "_" + shiftStr;
  let deposited = inputVal;
  
  if (currentShiftFilter === 'All') {
    deposited = 0;
    Object.keys(depositedCashData).forEach(k => {
        if (k.startsWith(dateStr + "_")) {
            deposited += parseFloat(depositedCashData[k]) || 0;
        }
    });

    if (inputEl && labelEl) { 
        inputEl.value = deposited || ''; 
        inputEl.disabled = true; 
        inputEl.parentElement.style.opacity = '0.5'; 
        inputEl.parentElement.style.pointerEvents = 'none'; 
        labelEl.textContent = 'Auto Sum (All Shifts):'; 
        labelEl.style.color = '#a855f7'; 
    }
  } else {
    if (deposited === null) { deposited = depositedCashData[key] || 0; }
    if (inputEl && labelEl) { 
        inputEl.value = deposited || ''; 
        inputEl.disabled = false; 
        inputEl.parentElement.style.opacity = '1'; 
        inputEl.parentElement.style.pointerEvents = 'auto'; 
        labelEl.textContent = 'Rider Deposited:'; 
        labelEl.style.color = '#94a3b8'; 
    }
  }
  
  let numDeposited = parseFloat(deposited) || 0;
  let pending = currentTotalCash - numDeposited;
  
  if (!display) return;
  
  if (pending > 0) { 
      display.textContent = `⚠️ Pending: ₹${pending.toFixed(2)}`; 
      display.style.color = '#ef4444'; 
  } else if (pending < 0) { 
      display.textContent = `⚠️ Extra: ₹${Math.abs(pending).toFixed(2)}`; 
      display.style.color = '#f59e0b'; 
  } else if (currentTotalCash > 0 && pending === 0) { 
      display.textContent = `✅ Clear: ₹0.00`; 
      display.style.color = '#10b981'; 
  } else { 
      display.textContent = ''; 
  }
};

window.toggleModal = function(show) { 
    const modal = document.getElementById('form-modal'); if(!modal) return; 
    if (show) { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; } else { modal.classList.add('hidden'); document.body.style.overflow = 'auto'; } 
};
window.toggleEditModal = function(show) { 
    const modal = document.getElementById('edit-modal'); if(!modal) return; 
    if (show) { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; } else { modal.classList.add('hidden'); document.body.style.overflow = 'auto'; } 
};
window.toggleMenuModal = function(show) { 
    const modal = document.getElementById('menu-modal'); if(!modal) return; 
    if (show) { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; if (typeof lucide !== 'undefined') lucide.createIcons(); } else { modal.classList.add('hidden'); document.body.style.overflow = 'auto'; cancelMenuEdit(); } 
};

window.toggleReportModal = function(show) {
    const modal = $('report-modal'); if(!modal) return;
    if(show) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        
        let endD = new Date(); endD.setMinutes(endD.getMinutes() - endD.getTimezoneOffset());
        let startD = new Date(); startD.setMinutes(startD.getMinutes() - startD.getTimezoneOffset());
        startD.setDate(startD.getDate() - 9); 
        
        if ($('report-end-date')) $('report-end-date').value = endD.toISOString().slice(0, 10);
        if ($('report-start-date')) $('report-start-date').value = startD.toISOString().slice(0, 10);

        window.populateReportDropdown();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } else {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
};

window.populateReportDropdown = function() {
    const sel = document.getElementById('report-rest-select'); 
    if(!sel) return;
    
    const rests = new Set();
    allOrders.forEach(o => { 
        if(o && o.customer_name) {
            rests.add(String(o.customer_name).trim()); 
        }
    });
    
    const currVal = sel.value;
    sel.innerHTML = '<option value="ALL">-- All Restaurants (Total) --</option>';
    
    Array.from(rests).filter(Boolean).sort().forEach(r => {
        const opt = document.createElement('option'); 
        opt.value = r; 
        opt.textContent = r; 
        sel.appendChild(opt);
    });
    
    if(Array.from(rests).includes(currVal) || currVal === "ALL") {
         sel.value = currVal;
    } else {
         sel.value = "ALL";
    }
    if(typeof generateCustomReport === 'function') generateCustomReport(); 
};

window.generateCustomReport = function() {
    const sel = $('report-rest-select');
    const tbody = $('report-table-body');
    const totalEl = $('report-grand-total');
    const startInputEl = $('report-start-date');
    const endInputEl = $('report-end-date');

    if(!sel || !tbody || !totalEl) return;
    
    const rName = sel.value;
    if(!rName) {
        tbody.innerHTML = '<tr><td colspan="2" class="text-center py-8 text-slate-500 italic">Select a restaurant above to view sales</td></tr>';
        totalEl.textContent = '₹0.00';
        return;
    }

    let startInput = startInputEl ? startInputEl.value : null;
    let endInput = endInputEl ? endInputEl.value : null;

    if (!startInput || !endInput) {
        let endD = new Date(); endD.setMinutes(endD.getMinutes() - endD.getTimezoneOffset());
        let startD = new Date(); startD.setMinutes(startD.getMinutes() - startD.getTimezoneOffset());
        startD.setDate(startD.getDate() - 9);
        startInput = startD.toISOString().slice(0, 10);
        endInput = endD.toISOString().slice(0, 10);
    }

    let start = new Date(startInput);
    let end = new Date(endInput);
    
    if (start > end) {
        tbody.innerHTML = '<tr><td colspan="2" class="text-center py-8 text-red-500 italic">Start Date cannot be after End Date</td></tr>';
        totalEl.textContent = '₹0.00';
        return;
    }

    const dates = [];
    let curr = new Date(start);
    while(curr <= end) {
        dates.push(curr.toISOString().slice(0, 10));
        curr.setDate(curr.getDate() + 1);
    }
    dates.reverse();

    let grandTotal = 0; let html = '';

    dates.forEach(dateStr => {
        let dailyTotal = 0;
        allOrders.forEach(o => {
            if(o.status !== 'Cancelled' && o.date && String(o.date).includes(dateStr)) {
                if(rName === "ALL" || String(o.customer_name || '').trim().toLowerCase() === String(rName).toLowerCase()) {
                    dailyTotal += (parseFloat(o.total) || 0); 
                }
            }
        });

        let displayDate = new Date(dateStr).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'});
        
        html += `
        <tr class="hover:bg-[#1e212b] transition-colors">
          <td class="px-5 py-3 text-slate-300 font-medium">${displayDate}</td>
          <td class="px-5 py-3 text-right font-bold ${dailyTotal > 0 ? 'text-[#ff5a36]' : 'text-slate-500'}">₹${dailyTotal.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
        </tr>
        `;
        grandTotal += dailyTotal;
    });

    tbody.innerHTML = html;
    totalEl.textContent = '₹' + grandTotal.toLocaleString('en-IN', {minimumFractionDigits:2});
};

document.addEventListener('DOMContentLoaded', function() {
  $('form-modal')?.addEventListener('click', e => { if (e.target === $('form-modal')) toggleModal(false); });
  $('edit-modal')?.addEventListener('click', e => { if (e.target === $('edit-modal')) toggleEditModal(false); });
  $('menu-modal')?.addEventListener('click', e => { if (e.target === $('menu-modal')) toggleMenuModal(false); });
  $('report-modal')?.addEventListener('click', e => { if (e.target === $('report-modal')) toggleReportModal(false); });
});

window.handleMenuSubmit = async function(event) {
  if (event) event.preventDefault();
  const btn = $('menu-save-btn'); if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  try {
    const rest = $('menu-rest-input').value.trim(); const item = $('menu-item-input').value.trim(); const rate = parseFloat($('menu-rate-input').value) || 0; 
    if(!rest || !item) { showToast('Please fill Restaurant and Item Name!', 'error'); return; }
    if (editingMenuId) { 
        await dbMenu.child(editingMenuId).update({ restaurant: rest, item: item, rate: rate }); 
        
        const targetDate = $('date-filter') ? $('date-filter').value : getLocalIsoDate();
        let ordersToSync = allOrders.filter(o => 
            (o.date === targetDate || String(o.date).includes(targetDate)) && 
            String(o.customer_name).toLowerCase() === rest.toLowerCase() && 
            String(o.item_name).toLowerCase() === item.toLowerCase()
        );
        
        for (let o of ordersToSync) {
            let isAR = String(o.customer_name).toLowerCase() === 'ar';
            let newBaseTot = rate * (parseFloat(o.quantity) || 1);
            let newFinalTot = isAR ? newBaseTot * 1.05 : newBaseTot; 
            await dbOrders.child(o.__backendId).update({ unit_price: rate, total: newFinalTot });
        }
        
        if (ordersToSync.length > 0) {
            showToast(`✅ Rate Updated & ${ordersToSync.length} orders of ${targetDate} Synced!`);
        } else {
            showToast(`✅ Menu Updated!`);
        }
        cancelMenuEdit(); 
    } else {
        const isDuplicate = menuList.some(m => (m.restaurant || '').toLowerCase() === rest.toLowerCase() && (m.item || '').toLowerCase() === item.toLowerCase());
        if (isDuplicate) { showToast(`⚠️ ${item} already added for ${rest}!`, 'error'); return; }
        await dbMenu.push().set({ restaurant: rest, item: item, rate: rate }); showToast(`✅ ${item} added!`); cancelMenuEdit();
    }
  } catch (err) { console.error(err); showToast('Error: ' + err.message, 'error'); } finally { if (btn) { btn.disabled = false; btn.textContent = editingMenuId ? 'Update' : 'Add'; } }
};

window.editMenuItem = function(id) {
  const m = menuList.find(x => x.__backendId === id); if(!m) return;
  $('menu-rest-input').value = m.restaurant || ''; $('menu-item-input').value = m.item || '';
  let clnRate = parseFloat(String(m.rate).replace(/[^\d.-]/g, '')); $('menu-rate-input').value = isNaN(clnRate) ? '' : clnRate;
  editingMenuId = id; $('menu-form-title').textContent = 'Update Menu Item'; $('menu-form-title').style.color = '#ff5a36'; $('menu-save-btn').textContent = 'Update'; $('menu-cancel-btn').classList.remove('hidden'); 
};
window.cancelMenuEdit = function() {
  $('menu-rest-input').value = ''; $('menu-item-input').value = ''; $('menu-rate-input').value = ''; editingMenuId = null;
  $('menu-form-title').textContent = 'Add New Menu Item'; $('menu-form-title').style.color = ''; $('menu-save-btn').textContent = 'Add'; $('menu-cancel-btn').classList.add('hidden'); 
};
window.deleteMenuItem = async function(id) { if(confirm("Delete this menu item?")) { await dbMenu.child(id).remove(); showToast('🗑️ Deleted'); if (editingMenuId === id) cancelMenuEdit(); } };

window.toggleMenuGroup = function(rName) {
    menuCollapsedState[rName] = !menuCollapsedState[rName];
    const rows = document.querySelectorAll(`.menu-item-row[data-restaurant="${rName}"]`);
    const icon = document.getElementById(`icon-${rName}`);
    rows.forEach(row => { if (menuCollapsedState[rName]) { row.style.display = 'none'; } else { row.style.display = 'table-row'; } });
    if (icon) {
        if (menuCollapsedState[rName]) { icon.setAttribute('data-lucide', 'chevron-right'); } else { icon.setAttribute('data-lucide', 'chevron-down'); }
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
};

window.renderMenuTable = function() {
  const tbody = $('menu-list-body'); if(!tbody) return; 
  const searchT = ($('menu-search-input') ? $('menu-search-input').value.trim().toLowerCase() : '');
  const filtered = menuList.filter(m => { if (!searchT) return true; return String(m.restaurant||'').toLowerCase().includes(searchT) || String(m.item||'').toLowerCase().includes(searchT); });
  
  if(filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="3" class="text-center py-6 text-slate-500">No match found</td></tr>`; return; }

  const groupedMenu = {};
  filtered.forEach(m => { let rName = m.restaurant || 'Unknown'; if(!groupedMenu[rName]) groupedMenu[rName] = []; groupedMenu[rName].push(m); });

  let htmlStr = ''; 
  Object.keys(groupedMenu).sort((a,b)=>String(a).localeCompare(String(b),undefined,{sensitivity:'base'})).forEach(rName => {
      let isCollapsed = menuCollapsedState[rName] || false;
      let chevronIcon = isCollapsed ? 'chevron-right' : 'chevron-down';
      let safeRName = String(rName).replace(/[^a-zA-Z0-9]/g, '');

      htmlStr += `
        <tr class="bg-[#181a24] border-t-2 border-b border-[#2d3139] cursor-pointer hover:bg-[#1e212b] transition-colors" onclick="toggleMenuGroup('${safeRName}')">
          <td colspan="3" class="px-4 py-2 font-black text-sm uppercase tracking-wider flex items-center gap-2" style="color:#ff5a36; user-select:none;">
            <i id="icon-${safeRName}" data-lucide="${chevronIcon}" style="width:16px;height:16px; transition: transform 0.2s;"></i>
            <i data-lucide="store" style="width:14px;height:14px;"></i> ${esc(rName)} 
            <span class="text-[10px] text-slate-500 ml-2 normal-case font-normal tracking-normal">(${groupedMenu[rName].length} items)</span>
          </td>
        </tr>
      `;

      let items = groupedMenu[rName].sort((a,b) => String(a.item||'').localeCompare(String(b.item||''), undefined, {sensitivity: 'base'}));
      items.forEach(m => {
        let r = parseFloat(String(m.rate).replace(/[^\d.-]/g, '')); r = isNaN(r) ? 0 : r;
        let displayStyle = isCollapsed ? 'display: none;' : 'display: table-row;';
        htmlStr += `
        <tr class="menu-item-row hover:bg-[#1e212b] transition-colors border-b border-slate-700/30 last:border-0" data-restaurant="${safeRName}" style="${displayStyle}">
          <td class="px-4 py-2.5 text-slate-300 font-medium pl-8 w-[50%]">» ${esc(m.item)}</td>
          <td class="px-4 py-2.5 text-right font-bold text-slate-100">₹${r}</td>
          <td class="px-4 py-2.5 text-center">
            <div class="flex items-center justify-center gap-3">
              <button onclick="event.stopPropagation(); editMenuItem('${m.__backendId}')" class="text-blue-400 hover:text-blue-300 p-1"><i data-lucide="pencil" style="width:16px;height:16px;"></i></button>
              <button onclick="event.stopPropagation(); deleteMenuItem('${m.__backendId}')" class="text-slate-500 hover:text-red-500 p-1"><i data-lucide="trash-2" style="width:16px;height:16px;"></i></button>
            </div>
          </td>
        </tr>`;
      });
  });
  
  tbody.innerHTML = htmlStr; 
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.autoFillRate = function(inp) {
  const r = inp.closest('.item-row'), b = inp.closest('.rest-block'); if(!r || !b) return;
  const rest = String(b.querySelector('.rest-name').value).trim().toLowerCase(), item = String(inp.value).trim().toLowerCase(), rInp = r.querySelector('.item-rate');
  if(rest && item) {
    const match = menuList.find(m => String(m.restaurant||'').toLowerCase() === rest && String(m.item||'').toLowerCase() === item);
    if(match && rInp.value != match.rate) { rInp.value = match.rate; if(inp.closest('#edit-modal')) calcEditTotal(); else calcPremiumTotal(); inp.style.borderColor = '#10b981'; setTimeout(() => inp.style.borderColor = '', 1000); }
  }
};

window.autoFillAllItemsInBlock = function(rInp) { 
  const b = rInp.closest('.rest-block'); if(!b) return; 
  b.querySelectorAll('.item-name').forEach(i => autoFillRate(i)); 
  if (rInp.closest('#edit-modal')) { if(typeof calcEditTotal === 'function') calcEditTotal(); } 
  else { if(typeof calcPremiumTotal === 'function') calcPremiumTotal(); }
};

window.toggleEditSplitFields = function() { const mode = $('edit-payment-status').value; if (mode === 'Split') $('edit-split-inputs').classList.remove('hidden'); else $('edit-split-inputs').classList.add('hidden'); };

window.addEditItem = function(rId) {
  const c = document.getElementById(`edit-items-rest-${rId}`), d = document.createElement('div'); d.className = 'item-row flex gap-2 items-start';
  d.innerHTML = `<div class="flex-1"><label class="block text-[10px] text-slate-500 mb-1">Item Name</label><input type="text" class="item-name w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" oninput="autoFillRate(this)"></div><div class="w-24"><label class="block text-[10px] text-slate-500 mb-1">Rate (₹)</label><input type="number" class="item-rate w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" min="0" oninput="if(typeof calcEditTotal === 'function') calcEditTotal()"></div><div class="w-20"><label class="block text-[10px] text-slate-500 mb-1">Qty</label><input type="number" class="item-qty w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" value="1" min="1" oninput="if(typeof calcEditTotal === 'function') calcEditTotal()"></div><button type="button" class="mt-5 p-2 text-slate-500 hover:text-red-500" onclick="removeEditItem(this)">✕</button>`;
  c.appendChild(d);
};
window.addEditRestaurant = function() {
  editRestCount++; const w = $('edit-restaurants-wrapper'), d = document.createElement('div'); d.className = 'rest-block p-4 rounded-lg border border-slate-700 bg-[#16181f] relative mt-4'; d.dataset.restId = editRestCount;
  d.innerHTML = `<button type="button" class="absolute top-3 right-3 text-slate-500 hover:text-red-500 text-xs font-bold uppercase tracking-wider" onclick="removeEditRest(this)">Remove</button><div class="mb-4 pr-16"><label class="block text-xs font-medium text-slate-400 mb-1">Restaurant Name *</label><input type="text" class="rest-name w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" oninput="autoFillAllItemsInBlock(this)"></div><div class="items-container space-y-3 mb-3" id="edit-items-rest-${editRestCount}"><div class="item-row flex gap-2 items-start"><div class="flex-1"><label class="block text-[10px] text-slate-500 mb-1">Item Name</label><input type="text" class="item-name w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" oninput="autoFillRate(this)"></div><div class="w-24"><label class="block text-[10px] text-slate-500 mb-1">Rate (₹)</label><input type="number" class="item-rate w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" min="0" oninput="if(typeof calcEditTotal === 'function') calcEditTotal()"></div><div class="w-20"><label class="block text-[10px] text-slate-500 mb-1">Qty</label><input type="number" class="item-qty w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" value="1" min="1" oninput="if(typeof calcEditTotal === 'function') calcEditTotal()"></div><button type="button" class="mt-5 p-2 text-slate-500 hover:text-red-500" onclick="removeEditItem(this)">✕</button></div></div><button type="button" onclick="addEditItem(${editRestCount})" class="text-xs font-semibold hover:opacity-80" style="color: #ff5a36;">+ Add Item</button>`;
  w.appendChild(d);
};
window.removeEditItem = function(btn) { btn.parentElement.remove(); if(typeof calcEditTotal === 'function') calcEditTotal(); };
window.removeEditRest = function(btn) { btn.parentElement.remove(); if(typeof calcEditTotal === 'function') calcEditTotal(); };

window.calcEditTotal = function() {
  let baseTot = 0; 
  let gstTot = 0;
  
  document.querySelectorAll('#edit-restaurants-wrapper .rest-block').forEach(b => { 
      const rName = b.querySelector('.rest-name').value.trim().toLowerCase();
      const isAR = rName === 'ar';
      
      b.querySelectorAll('.item-row').forEach(r => {
          let itemTot = ((parseFloat(r.querySelector('.item-rate').value) || 0) * (parseFloat(r.querySelector('.item-qty').value) || 0));
          baseTot += itemTot;
          if (isAR) { gstTot += itemTot * 0.05; } 
      }); 
  });
  
  const delInput = $('edit-del-charge');
  const del = delInput ? (parseFloat(delInput.value) || 0) : 0; 
  const g = baseTot + gstTot + del;
  
  if ($('edit-subtotal')) $('edit-subtotal').textContent = '₹' + baseTot.toLocaleString('en-IN', { minimumFractionDigits: 2 }); 
  
  if ($('edit-gst-row') && $('edit-gst-display')) {
      if (gstTot > 0) {
          $('edit-gst-row').classList.remove('hidden');
          $('edit-gst-row').classList.add('flex');
          $('edit-gst-display').textContent = '+ ₹' + gstTot.toLocaleString('en-IN', { minimumFractionDigits: 2 });
      } else {
          $('edit-gst-row').classList.remove('flex');
          $('edit-gst-row').classList.add('hidden');
      }
  }

  if ($('edit-delivery-display')) $('edit-delivery-display').textContent = '₹' + del.toLocaleString('en-IN', { minimumFractionDigits: 2 }); 
  if ($('edit-grand-total')) $('edit-grand-total').textContent = '₹' + g.toLocaleString('en-IN', { minimumFractionDigits: 2 });
};

window.openEditModal = function(backendId) {
    try {
      const item = allOrders.find(o => o.__backendId === backendId); 
      if (!item) { showToast("Item not found", "error"); return; }
      
      currentlyEditingOrderId = item.order_id || item.__backendId; 
      
      const idDisplay = $('edit-order-id-display');
      if (idDisplay) idDisplay.textContent = `#${currentlyEditingOrderId}`;
      
      if (item.order_id) {
          originalOrderItems = allOrders.filter(o => o.order_id === item.order_id);
      } else {
          originalOrderItems = [item];
      }
      
      const first = originalOrderItems[0];
      
      if ($('edit-address')) $('edit-address').value = first.address || ''; 
      if ($('edit-contact')) $('edit-contact').value = first.contact || ''; 
      if ($('edit-rider')) $('edit-rider').value = first.rider || ''; 
      if ($('edit-shift')) $('edit-shift').value = first.shift || 'Before Lunch';
      
      if ($('edit-time')) $('edit-time').value = first.order_time || '';
      if ($('edit-upi-time')) $('edit-upi-time').value = first.upi_time || '';
      if ($('edit-doubtful')) $('edit-doubtful').checked = first.is_doubtful || false;
      if ($('edit-note')) $('edit-note').value = first.note || '';
      
      let tDel = 0; 
      originalOrderItems.forEach(o => tDel += (parseFloat(o.delivery_charge) || 0)); 
      if ($('edit-del-charge')) $('edit-del-charge').value = tDel;
      
      let pStatus = String(first.payment_status || '');
      if (pStatus.includes('Split')) { 
          if ($('edit-payment-status')) $('edit-payment-status').value = 'Split'; 
          let totalSplitCash = pStatus.match(/Cash ₹([\d.]+)/) ? parseFloat(pStatus.match(/Cash ₹([\d.]+)/)[1]) : 0;
          let totalSplitUpi = pStatus.match(/UPI ₹([\d.]+)/) ? parseFloat(pStatus.match(/UPI ₹([\d.]+)/)[1]) : 0; 
          if ($('edit-split-cash')) $('edit-split-cash').value = Math.max(0, totalSplitCash - tDel); 
          if ($('edit-split-upi')) $('edit-split-upi').value = totalSplitUpi; 
          if ($('edit-split-inputs')) $('edit-split-inputs').classList.remove('hidden'); 
      } else { 
          if ($('edit-payment-status')) $('edit-payment-status').value = pStatus; 
          if ($('edit-split-inputs')) $('edit-split-inputs').classList.add('hidden'); 
      }
      
      const wrapper = $('edit-restaurants-wrapper'); 
      if (wrapper) {
          wrapper.innerHTML = ''; 
          editRestCount = 0;
          const rests = {}; 
          originalOrderItems.forEach(o => { 
              let rN = String(o.customer_name || 'Unknown').trim(); 
              if(!rests[rN]) rests[rN] = []; 
              rests[rN].push(o); 
          });
          for(let rN in rests) {
              editRestCount++; let iHtml = '';
              rests[rN].forEach(it => { 
                  iHtml += `<div class="item-row flex gap-2 items-start" data-backend-id="${it.__backendId}"><div class="flex-1"><label class="block text-[10px] text-slate-500 mb-1">Item Name</label><input type="text" class="item-name w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" value="${esc(it.item_name)}" oninput="autoFillRate(this)"></div><div class="w-24"><label class="block text-[10px] text-slate-500 mb-1">Rate (₹)</label><input type="number" class="item-rate w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" value="${it.unit_price}" min="0" oninput="if(typeof calcEditTotal === 'function') calcEditTotal()"></div><div class="w-20"><label class="block text-[10px] text-slate-500 mb-1">Qty</label><input type="number" class="item-qty w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" value="${it.quantity}" min="1" oninput="if(typeof calcEditTotal === 'function') calcEditTotal()"></div><button type="button" class="mt-5 p-2 text-slate-500 hover:text-red-500" onclick="removeEditItem(this)">✕</button></div>`; 
              });
              const rDiv = document.createElement('div'); rDiv.className = 'rest-block p-4 rounded-lg border border-slate-700 bg-[#16181f] relative mt-4'; rDiv.dataset.restId = editRestCount;
              rDiv.innerHTML = `<button type="button" class="absolute top-3 right-3 text-slate-500 hover:text-red-500 text-xs font-bold uppercase tracking-wider" onclick="removeEditRest(this)">Remove</button><div class="mb-4 pr-16"><label class="block text-xs font-medium text-slate-400 mb-1">Restaurant Name *</label><input type="text" class="rest-name w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" value="${esc(rN)}" oninput="autoFillAllItemsInBlock(this)"></div><div class="items-container space-y-3 mb-3" id="edit-items-rest-${editRestCount}">${iHtml}</div><button type="button" onclick="addEditItem(${editRestCount})" class="text-xs font-semibold hover:opacity-80" style="color: #ff5a36;">+ Add Item</button>`;
              wrapper.appendChild(rDiv);
          }
      }
      if (typeof calcEditTotal === 'function') calcEditTotal(); 
      toggleEditModal(true);
    } catch (err) {
        console.error("Edit Modal Error:", err);
        showToast('Error: ' + err.message, 'error');
    }
};

window.handleFullEditSubmit = async function(event) {
  if (event) event.preventDefault(); 
  const btn = $('edit-save-btn'); 
  if(btn) { btn.disabled = true; btn.style.opacity = '0.5'; btn.textContent = 'Saving...'; }
  try {
    let finalItems = [];
    document.querySelectorAll('#edit-restaurants-wrapper .rest-block').forEach(b => {
      const rName = b.querySelector('.rest-name').value.trim();
      if(rName) { 
          const isAR = rName.toLowerCase() === 'ar';
          b.querySelectorAll('.item-row').forEach(row => { 
              const bId = row.dataset.backendId || null;
              const name = row.querySelector('.item-name').value.trim();
              const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
              const qty = parseFloat(row.querySelector('.item-qty').value) || 1; 
              if(name && rate >= 0) {
                  let itemBaseTotal = rate * qty;
                  let itemFinalTotal = isAR ? itemBaseTotal * 1.05 : itemBaseTotal;
                  finalItems.push({ __backendId: bId, name, rate, qty, total: itemFinalTotal, restaurant: rName }); 
              }
          }); 
      }
    });
    
    if(finalItems.length === 0) throw new Error("At least one item is required!");
    const pMode = $('edit-payment-status').value, addr = $('edit-address').value.trim(), cont = $('edit-contact').value.trim(), rider = $('edit-rider').value.trim(), shift = $('edit-shift').value, dChg = parseFloat($('edit-del-charge').value) || 0;
    
    const oTime = $('edit-time') ? $('edit-time').value : '';
    const uTime = $('edit-upi-time') ? $('edit-upi-time').value : '';
    const isDoubtful = $('edit-doubtful') ? $('edit-doubtful').checked : false;
    const orderNote = $('edit-note') ? $('edit-note').value.trim() : '';

    if(!pMode) throw new Error("Select Payment Mode!"); if(!addr) throw new Error("Delivery Address required!");
    let fPMode = pMode;
    if(pMode === 'Split') { 
        let sC = (parseFloat($('edit-split-cash').value) || 0) + dChg;
        let sU = parseFloat($('edit-split-upi').value) || 0; 
        fPMode = `Split: Cash ₹${sC.toFixed(2)} | UPI ₹${sU.toFixed(2)}`; 
    }
    let sIds = finalItems.map(i => i.__backendId).filter(id => id !== null), oIds = originalOrderItems.map(i => i.__backendId), delIds = oIds.filter(id => !sIds.includes(id));
    for(let id of delIds) { await dbOrders.child(id).remove(); }
    const oDate = originalOrderItems[0].date || getLocalIsoDate(); let isFirst = true;
    
    for(let i of finalItems) {
      let stat = "Payment Pending"; 
      if(pMode === "UPI Done" || pMode === "Cash" || pMode === "Split" || pMode === "UPI (Unverified)") stat = "Delivered";
      let itemPaymentStatus = isFirst ? fPMode : pMode; 
      if (fPMode.includes('Split') && !isFirst) {
          itemPaymentStatus = "Split (Included in total)";
      }
      let iData = { order_id: currentlyEditingOrderId, customer_name: i.restaurant, item_name: i.name, quantity: i.qty, unit_price: i.rate, total: i.total, status: stat, date: oDate, shift: shift, order_time: oTime, upi_time: uTime, is_doubtful: isDoubtful, note: orderNote, address: addr, customer_address: addr, location: addr, payment_status: itemPaymentStatus, contact: cont, rider: rider, delivery_charge: isFirst ? dChg : 0 };
      if(i.__backendId) { await dbOrders.child(i.__backendId).update(iData); } else { await dbOrders.push().set(iData); }
      isFirst = false;
    }
    toggleEditModal(false); showToast('✅ Order Updated successfully!');
  } catch (err) { showToast('❌ ' + err.message, 'error'); } finally { if(btn) { btn.disabled = false; btn.style.opacity = '1'; btn.textContent = 'Save Update'; } }
};

window.openNewOrderModal = function() {
    const form = $('new-premium-order-form');
    if (form) form.reset(); 
    if ($('p-time')) $('p-time').value = '';
    if ($('p-upi-time')) $('p-upi-time').value = '';
    if ($('p-del-charge')) $('p-del-charge').value = '10';

    const mainShift = $('shift-filter') ? $('shift-filter').value : 'All';
    if ($('p-shift')) {
        if (mainShift !== 'All') {
            $('p-shift').value = mainShift; 
        } else {
            $('p-shift').value = 'Before Lunch'; 
        }
    }

    const wrapper = $('restaurants-wrapper');
    if (wrapper) {
        wrapper.innerHTML = `
        <div class="rest-block p-4 rounded-lg border border-slate-700 bg-[#16181f]" data-rest-id="1">
         <div class="mb-4">
          <label class="block text-xs font-medium text-slate-400 mb-1">Restaurant Name *</label> 
          <input type="text" name="rest_name[]" class="rest-name w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" oninput="autoFillAllItemsInBlock(this)">
         </div>
         <div class="items-container space-y-3 mb-3" id="items-rest-1">
          <div class="item-row flex gap-2 items-start">
           <div class="flex-1">
            <label class="block text-[10px] text-slate-500 mb-1">Item Name</label> 
            <input type="text" name="item_name[]" class="item-name w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" oninput="autoFillRate(this)">
           </div>
           <div class="w-24">
            <label class="block text-[10px] text-slate-500 mb-1">Rate (₹)</label> 
            <input type="number" name="rate[]" class="item-rate w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" min="0" oninput="calcPremiumTotal()">
           </div>
           <div class="w-20">
            <label class="block text-[10px] text-slate-500 mb-1">Qty</label> 
            <input type="number" name="qty[]" class="item-qty w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" value="1" min="1" oninput="calcPremiumTotal()">
           </div>
           <button type="button" class="mt-5 p-2 text-slate-500 hover:text-red-500" onclick="removePremiumItem(this)">✕</button>
          </div>
         </div>
         <button type="button" onclick="addPremiumItem(1)" class="text-xs font-semibold tracking-wide hover:opacity-80 transition-opacity" style="color: #ff5a36;">+ Add Item</button>
        </div>`;
    }
    premRestCount = 1;
    
    if (typeof calcPremiumTotal === 'function') {
        calcPremiumTotal();
    } else {
        if($('p-grand-total')) $('p-grand-total').textContent = '₹0';
        if($('p-subtotal')) $('p-subtotal').textContent = '₹0';
        if($('p-delivery-display')) $('p-delivery-display').textContent = '₹0';
    }

    if($('split-inputs')) $('split-inputs').classList.add('hidden');
    toggleModal(true);
};

let premRestCount = 1;
window.toggleSplitFields = function() { const mode = $('p-payment').value; if (mode === 'Split') $('split-inputs').classList.remove('hidden'); else $('split-inputs').classList.add('hidden'); };
window.addPremiumItem = function(restId) {
  const container = document.getElementById(`items-rest-${restId}`), div = document.createElement('div'); div.className = 'item-row flex gap-2 items-start';
  div.innerHTML = `<div class="flex-1"><label class="block text-[10px] text-slate-500 mb-1">Item Name</label><input type="text" name="item_name[]" class="item-name w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="Item Name" oninput="autoFillRate(this)"></div><div class="w-24"><label class="block text-[10px] text-slate-500 mb-1">Rate (₹)</label><input type="number" name="rate[]" class="item-rate w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="0" min="0" oninput="calcPremiumTotal()"></div><div class="w-20"><label class="block text-[10px] text-slate-500 mb-1">Qty</label><input type="number" name="qty[]" class="item-qty w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="1" value="1" min="1" oninput="calcPremiumTotal()"></div><button type="button" class="mt-5 p-2 text-slate-500 hover:text-red-500 transition-colors" onclick="removePremiumItem(this)">✕</button>`;
  container.appendChild(div);
};
window.removePremiumItem = function(btn) { btn.parentElement.remove(); calcPremiumTotal(); };
window.addPremiumRestaurant = function() {
  premRestCount++; const wrapper = $('restaurants-wrapper'), div = document.createElement('div'); div.className = 'rest-block p-4 rounded-lg border border-slate-700 bg-[#16181f] relative mt-4'; div.dataset.restId = premRestCount;
  div.innerHTML = `<button type="button" class="absolute top-3 right-3 text-slate-500 hover:text-red-500 text-xs font-bold uppercase tracking-wider" onclick="removePremiumRest(this)">Remove</button><div class="mb-4 pr-16"><label class="block text-xs font-medium text-slate-400 mb-1">Restaurant Name *</label><input type="text" name="rest_name[]" class="rest-name w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="Enter restaurant name" oninput="autoFillAllItemsInBlock(this)"></div><div class="items-container space-y-3 mb-3" id="items-rest-${premRestCount}"><div class="item-row flex gap-2 items-start"><div class="flex-1"><label class="block text-[10px] text-slate-500 mb-1">Item Name</label><input type="text" name="item_name[]" class="item-name w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="Item Name" oninput="autoFillRate(this)"></div><div class="w-24"><label class="block text-[10px] text-slate-500 mb-1">Rate (₹)</label><input type="number" name="rate[]" class="item-rate w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="0" min="0" oninput="calcPremiumTotal()"></div><div class="w-20"><label class="block text-[10px] text-slate-500 mb-1">Qty</label><input type="number" name="qty[]" class="item-qty w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="1" value="1" min="1" oninput="calcPremiumTotal()"></div><button type="button" class="mt-5 p-2 text-slate-500 hover:text-red-500 transition-colors" onclick="removePremiumItem(this)">✕</button></div></div><button type="button" onclick="addPremiumItem(${premRestCount})" class="text-xs font-semibold hover:opacity-80" style="color: #ff5a36;">+ Add Item</button>`;
  wrapper.appendChild(div);
};
window.removePremiumRest = function(btn) { btn.parentElement.remove(); calcPremiumTotal(); };

window.calcPremiumTotal = function() {
  let baseTot = 0; 
  let gstTot = 0;
  
  document.querySelectorAll('#restaurants-wrapper .rest-block').forEach(b => { 
      const rName = b.querySelector('.rest-name').value.trim().toLowerCase();
      const isAR = rName === 'ar';
      
      b.querySelectorAll('.item-row').forEach(r => { 
          let itemTot = ((parseFloat(r.querySelector('.item-rate').value) || 0) * (parseFloat(r.querySelector('.item-qty').value) || 0)); 
          baseTot += itemTot;
          if (isAR) { gstTot += itemTot * 0.05; } 
      }); 
  });
  
  const delCharge = parseFloat($('p-del-charge').value) || 0; 
  const grandTotal = baseTot + gstTot + delCharge;
  
  $('p-subtotal').textContent = '₹' + baseTot.toLocaleString('en-IN', { minimumFractionDigits: 2 }); 
  
  if ($('p-gst-row') && $('p-gst-display')) {
      if (gstTot > 0) {
          $('p-gst-row').classList.remove('hidden');
          $('p-gst-row').classList.add('flex');
          $('p-gst-display').textContent = '+ ₹' + gstTot.toLocaleString('en-IN', { minimumFractionDigits: 2 });
      } else {
          $('p-gst-row').classList.remove('flex');
          $('p-gst-row').classList.add('hidden');
      }
  }

  $('p-delivery-display').textContent = '₹' + delCharge.toLocaleString('en-IN', { minimumFractionDigits: 2 }); 
  $('p-grand-total').textContent = '₹' + grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
};

window.handlePremiumFormSubmit = async function(event) {
  if (event) event.preventDefault(); 
  const btn = $('place-order-btn'); 
  if(btn) { btn.disabled = true; btn.style.opacity = '0.5'; btn.textContent = 'Saving to Cloud...'; }
  
  try {
    const restBlocks = document.querySelectorAll('#restaurants-wrapper .rest-block'); let allItems = [];
    restBlocks.forEach(block => {
      const restName = block.querySelector('.rest-name').value.trim();
      if (restName) { 
          const isAR = restName.toLowerCase() === 'ar';
          block.querySelectorAll('.item-row').forEach(row => { 
              const name = row.querySelector('.item-name').value.trim();
              const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
              const qty = parseFloat(row.querySelector('.item-qty').value) || 1; 
              if (name && rate >= 0) {
                  let itemBaseTotal = rate * qty;
                  let itemFinalTotal = isAR ? itemBaseTotal * 1.05 : itemBaseTotal; 
                  allItems.push({ name, rate, qty, total: itemFinalTotal, restaurant: restName }); 
              }
          }); 
      }
    });
    
    if (allItems.length === 0) throw new Error("Add at least one item!");
    
    const pMode = $('p-payment').value, cont = $('p-contact').value.trim(), addr = $('p-address').value.trim(), rider = $('p-rider').value.trim(), shift = $('p-shift').value, delChg = parseFloat($('p-del-charge').value) || 0;
    
    const oTime = $('p-time') ? $('p-time').value : '';
    const uTime = $('p-upi-time') ? $('p-upi-time').value : '';

    if (!pMode) throw new Error("Select Payment Mode!"); if (!addr) throw new Error("Address is required!");
    let fPMode = pMode;
    if (pMode === 'Split') { let sC = (parseFloat($('split-cash').value) || 0) + delChg, sU = parseFloat($('split-upi').value) || 0; fPMode = `Split: Cash ₹${sC.toFixed(2)} | UPI ₹${sU.toFixed(2)}`; }
    const oDate = $('date-filter').value || getLocalIsoDate();
    
    // 🚨 JADOO: SMART DUPLICATE CATCHER 🚨
    let duplicateFoundId = null;
    let duplicateItemName = "";
    for (let item of allItems) {
        let match = allOrders.find(o => 
            (o.date === oDate || String(o.date).includes(oDate)) &&
            String(o.customer_name).toLowerCase() === String(item.restaurant).toLowerCase() &&
            String(o.item_name).toLowerCase() === String(item.name).toLowerCase() &&
            o.status !== 'Cancelled'
        );
        if (match) {
            duplicateFoundId = match.__backendId;
            duplicateItemName = item.name;
            break; 
        }
    }

    if (duplicateFoundId) {
        const proceed = confirm(`⚠️ DUPLICATE ALERT!\n\n"${duplicateItemName}" for this restaurant is already added today.\n\nDo you still want to add a new one?`);
        if (!proceed) {
            toggleModal(false);
            
            // Highlight Table Row Animation
            setTimeout(() => {
                const row = document.getElementById(`row-${duplicateFoundId}`);
                if (row) {
                    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const originalBg = row.style.backgroundColor;
                    row.style.transition = 'background-color 0.5s ease';
                    row.style.backgroundColor = 'rgba(234, 179, 8, 0.4)'; // Yellow Flash
                    setTimeout(() => { row.style.backgroundColor = originalBg; }, 3000);
                }
            }, 300);
            
            if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.textContent = 'Place Order'; }
            return; 
        }
    }

    orderCounter++; await dbCounter.set(orderCounter); const cOrderId = String(orderCounter).padStart(3, '0'); let isFirst = true;
    for (const item of allItems) {
      let stat = "Payment Pending"; 
      if (pMode === "UPI Done" || pMode === "Cash" || pMode === "Split" || pMode === "UPI (Unverified)") stat = "Delivered";
      
      let itemPaymentStatus = isFirst ? fPMode : pMode;
      if (fPMode.includes('Split') && !isFirst) {
          itemPaymentStatus = "Split (Included in total)";
      }

      await dbOrders.push().set({ order_id: cOrderId, customer_name: item.restaurant, item_name: item.name, quantity: item.qty, unit_price: item.rate, total: item.total, status: stat, date: oDate, shift: shift, order_time: oTime, upi_time: uTime, is_doubtful: false, note: '', address: addr, customer_address: addr, location: addr, payment_status: itemPaymentStatus, contact: cont, rider: rider, delivery_charge: isFirst ? delChg : 0 });
      isFirst = false;
    }
    
    toggleModal(false);
    showToast(`✅ Sync Success! ${allItems.length} item(s) saved!`);

  } catch (err) { 
      showToast('❌ Error: ' + err.message, 'error'); 
  } finally { 
      if(btn) { btn.disabled = false; btn.style.opacity = '1'; btn.textContent = 'Place Order'; } 
  }
};

window.changeStatus = async function(bId, nPStat) {
  const idx = allOrders.findIndex(o => o.__backendId === bId); if (idx === -1) return; let o = allOrders[idx];
  
  let nStat = o.status; 
  if (nPStat === 'UPI Done' || nPStat === 'Cash' || nPStat.includes('Split') || nPStat === 'UPI (Unverified)') { 
      nStat = 'Delivered'; 
  } else if (nPStat === 'Payment Pending') { 
      nStat = 'Payment Pending'; 
  }
  
  await dbOrders.child(bId).update({ payment_status: nPStat, status: nStat }); showToast('Cloud Status updated'); 
};

window.toggleDoubtful = async function(bId) {
    const order = allOrders.find(o => o.__backendId === bId);
    if (!order) return;
    let isDoubtful = order.is_doubtful === true || String(order.is_doubtful) === 'true';
    
    if (isDoubtful) {
        if (confirm("Is the issue resolved? Remove Red Flag? 🚩")) {
            await dbOrders.child(bId).update({ is_doubtful: false, note: '' });
            showToast('✅ Doubt cleared! Flag removed.');
        }
    } else {
        let reason = prompt("What is the doubt? (e.g., 20 Rs short, Fake screenshot)", order.note || "");
        if (reason !== null) { 
            await dbOrders.child(bId).update({ is_doubtful: true, note: reason.trim() });
            showToast('🚩 Order marked as Doubtful!');
        }
    }
};

window.requestDelete = function(bId) { pendingDelete = bId; renderOrders(); };
window.cancelDelete = function() { pendingDelete = null; renderOrders(); };
window.confirmDelete = async function(bId) { await dbOrders.child(bId).remove(); pendingDelete = null; showToast('Order deleted from Cloud'); };

window.filterData = function() { currentFilterDate = $('date-filter').value; currentShiftFilter = $('shift-filter') ? $('shift-filter').value : 'All'; currentRestFilter = $('filter-restaurant') ? $('filter-restaurant').value : 'All'; currentRiderFilter = $('filter-rider') ? $('filter-rider').value : 'All'; updateStats(); renderOrders(); }
function countUniqueOrders(arr) { let s = new Set(); arr.forEach(o => s.add(o.order_id || o.__backendId)); return s.size; }

function updateStats() {
  const baseFilteredData = allOrders.filter(o => { 
      const isDateMatch = !currentFilterDate || (o.date && String(o.date).includes(currentFilterDate)); 
      const isShiftMatch = currentShiftFilter === 'All' || o.shift === currentShiftFilter || (!o.shift && currentShiftFilter === 'All'); 
      return isDateMatch && isShiftMatch; 
  });

  const rests = new Set(), riders = new Set();
  baseFilteredData.forEach(o => { if(o.customer_name) rests.add(String(o.customer_name).trim()); if(o.rider) riders.add(String(o.rider).trim()); });

  function populateSelect(id, set, currVal) {
      const sel = $(id); if(!sel) return currVal; sel.innerHTML = ''; 
      const allOpt = document.createElement('option'); allOpt.value = 'All'; allOpt.textContent = id === 'filter-restaurant' ? 'All Rest.' : 'All Riders'; sel.appendChild(allOpt);
      let found = false;
      Array.from(set).filter(Boolean).sort((a,b)=>String(a).localeCompare(String(b),undefined,{sensitivity:'base'})).forEach(item => { 
          const opt = document.createElement('option'); opt.value = item; opt.textContent = item; sel.appendChild(opt); 
          if(item === currVal) found = true;
      });
      if(found) { sel.value = currVal; return currVal; } else { sel.value = 'All'; return 'All'; }
  }
  currentRestFilter = populateSelect('filter-restaurant', rests, currentRestFilter); currentRiderFilter = populateSelect('filter-rider', riders, currentRiderFilter);

  const filteredData = baseFilteredData.filter(o => { const isRestMatch = currentRestFilter === 'All' || String(o.customer_name || '').trim() === currentRestFilter; const isRiderMatch = currentRiderFilter === 'All' || String(o.rider || '').trim() === currentRiderFilter; return isRestMatch && isRiderMatch; });

  let upiTotal = 0, cashTotal = 0, pendingTotal = 0, pureSales = 0, totalWithDelivery = 0;
  let ordersGroup = {};

  filteredData.forEach(o => {
    if (o.status === 'Cancelled') return;
    
    const itemTotal = parseFloat(o.total) || 0;
    const delCharge = parseFloat(o.delivery_charge) || 0;
    const rowTotal = itemTotal + delCharge;
    
    pureSales += itemTotal; 
    totalWithDelivery += rowTotal;

    let oId = o.order_id || o.__backendId;
    if (!ordersGroup[oId]) {
        ordersGroup[oId] = { totalValue: 0, status: String(o.payment_status || ""), rider: String(o.rider || '').trim() };
    }
    
    ordersGroup[oId].totalValue += rowTotal;
    
    if (String(o.payment_status || "").includes("Cash ₹")) {
        ordersGroup[oId].status = String(o.payment_status);
    }
  });

  let riderCashData = {};
  let riderUpiData = {};
  let riderTotalDeliveredData = {};

  Object.values(ordersGroup).forEach(grp => {
      let stat = String(grp.status || "");
      let rider = grp.rider || 'Unassigned';
      
      if (!riderCashData[rider]) riderCashData[rider] = 0;
      if (!riderUpiData[rider]) riderUpiData[rider] = 0;
      if (!riderTotalDeliveredData[rider]) riderTotalDeliveredData[rider] = 0;

      if (stat === 'UPI Done') { 
          upiTotal += grp.totalValue; 
          riderUpiData[rider] += grp.totalValue;
          riderTotalDeliveredData[rider] += grp.totalValue; 
      }
      else if (stat === 'Cash') { 
          cashTotal += grp.totalValue; 
          riderCashData[rider] += grp.totalValue;
      }
      else if (stat === 'Payment Pending' || stat === 'UPI (Unverified)') { 
          pendingTotal += grp.totalValue; 
      }
      else if (stat.includes('Split')) {
          const cashMatch = stat.match(/Cash ₹([\d.]+)/);
          const upiMatch = stat.match(/UPI ₹([\d.]+)/);
          
          let sC = cashMatch ? parseFloat(cashMatch[1]) : 0;
          let sU = upiMatch ? parseFloat(upiMatch[1]) : 0;
          
          cashTotal += sC;
          upiTotal += sU;
          
          riderCashData[rider] += sC;
          riderUpiData[rider] += sU;
          riderTotalDeliveredData[rider] += sU; 
      }
  });

  if ($('total-breakdown-content')) {
      if (Object.keys(riderTotalDeliveredData).length === 0 || Object.values(riderTotalDeliveredData).every(v => v === 0)) {
          $('total-breakdown-content').innerHTML = '<div class="text-slate-500 italic mt-1">No UPI deliveries yet</div>';
      } else {
          let html = '';
          for (let r in riderTotalDeliveredData) {
              if (riderTotalDeliveredData[r] > 0) {
                  html += `<div class="flex justify-between items-center gap-6 mb-2 border-b border-slate-700/50 pb-2 last:border-0 last:pb-0"><span class="font-medium text-slate-300 capitalize">${r}</span><span class="font-bold text-white">₹${riderTotalDeliveredData[r].toFixed(2)}</span></div>`;
              }
          }
          $('total-breakdown-content').innerHTML = html;
      }
  }

  if ($('cash-breakdown-content')) {
      if (Object.keys(riderCashData).length === 0 || Object.values(riderCashData).every(v => v === 0)) {
          $('cash-breakdown-content').innerHTML = '<div class="text-slate-500 italic mt-1">No cash collected</div>';
      } else {
          let html = '';
          for (let r in riderCashData) {
              if (riderCashData[r] > 0) {
                  html += `<div class="flex justify-between items-center gap-6 mb-2 border-b border-slate-700/50 pb-2 last:border-0 last:pb-0"><span class="font-medium text-slate-300 capitalize">${r}</span><span class="font-bold text-white">₹${riderCashData[r].toFixed(2)}</span></div>`;
              }
          }
          $('cash-breakdown-content').innerHTML = html;
      }
  }

  if ($('upi-breakdown-content')) {
      if (Object.keys(riderUpiData).length === 0 || Object.values(riderUpiData).every(v => v === 0)) {
          $('upi-breakdown-content').innerHTML = '<div class="text-slate-500 italic mt-1">No UPI received</div>';
      } else {
          let html = '';
          for (let r in riderUpiData) {
              if (riderUpiData[r] > 0) {
                  html += `<div class="flex justify-between items-center gap-6 mb-2 border-b border-slate-700/50 pb-2 last:border-0 last:pb-0"><span class="font-medium text-slate-300 capitalize">${r}</span><span class="font-bold text-white">₹${riderUpiData[r].toFixed(2)}</span></div>`;
              }
          }
          $('upi-breakdown-content').innerHTML = html;
      }
  }

  const activeOrders = filteredData.filter(o => o.status !== 'Cancelled');
  
  const deliveredCashOrders = activeOrders.filter(o => o.payment_status === 'Cash' || String(o.payment_status || '').includes('Split'));
  const deliveredUpiOrders = activeOrders.filter(o => o.payment_status === 'UPI Done' || String(o.payment_status || '').includes('Split'));
  const pendingOrders = activeOrders.filter(o => o.payment_status === 'Payment Pending' || o.payment_status === 'UPI (Unverified)');

  if ($('stat-sales-inr')) $('stat-sales-inr').textContent = '₹' + pureSales.toFixed(2); if ($('stat-sales-delivery')) $('stat-sales-delivery').textContent = '₹' + totalWithDelivery.toFixed(2);
  if ($('stat-delivered-cash')) $('stat-delivered-cash').textContent = countUniqueOrders(deliveredCashOrders); if ($('stat-delivered-cash-total')) $('stat-delivered-cash-total').textContent = '₹' + cashTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  currentTotalCash = cashTotal; updatePendingCashUI();
  
  if ($('stat-delivered-upi')) $('stat-delivered-upi').textContent = countUniqueOrders(deliveredUpiOrders); if ($('stat-delivered-upi-total')) $('stat-delivered-upi-total').textContent = '₹' + upiTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  
  if ($('stat-delivered')) $('stat-delivered').textContent = countUniqueOrders(deliveredUpiOrders); 
  if ($('stat-delivered-total')) $('stat-delivered-total').textContent = '₹' + upiTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  
  if ($('stat-payment-pending')) $('stat-payment-pending').textContent = countUniqueOrders(pendingOrders); if ($('stat-payment-pending-total')) $('stat-payment-pending-total').textContent = '₹' + pendingTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  if ($('stat-total-orders')) $('stat-total-orders').textContent = countUniqueOrders(activeOrders);

  let riderData = {}, totalRiderSales = 0; const PER_ORDER_RATE = $('rider-rate-input') ? (parseFloat($('rider-rate-input').value) || 0) : 25;
  activeOrders.forEach(o => {
    let rawRiderName = String(o.rider || '').trim(); if (!rawRiderName || rawRiderName.toLowerCase() === 'unassigned') return; 
    let isSalary = rawRiderName.toLowerCase().includes('salary'), rName = rawRiderName.replace(/\(salary\)/i, '').trim(), orderTotal = (parseFloat(o.total)||0) + (parseFloat(o.delivery_charge)||0); 
    if (!riderData[rName]) riderData[rName] = { amount: 0, addresses: new Set(), uniqueOrders: new Set(), isSalary: isSalary };
    riderData[rName].amount += orderTotal; if (o.order_id) riderData[rName].uniqueOrders.add(o.order_id);
    let addr = String(o.address || '').trim().toLowerCase(); if (addr) riderData[rName].addresses.add(addr); totalRiderSales += orderTotal;
  });

  if ($('stat-riders-count')) $('stat-riders-count').textContent = Object.keys(riderData).length; if ($('stat-riders-amount')) $('stat-riders-amount').textContent = '₹' + totalRiderSales.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  if ($('rider-breakdown-content')) {
      if (Object.keys(riderData).length === 0) $('rider-breakdown-content').innerHTML = '<div class="text-slate-500 italic mt-1">No active riders yet</div>';
      else { let html = ''; for (let r in riderData) { let d = riderData[r], payoutText = d.isSalary ? `<span class="text-xs font-semibold text-blue-400 mt-1">📊 On Salary</span>` : `<span class="text-xs font-bold text-green-400 mt-1">💰 Payout: ₹${d.uniqueOrders.size * PER_ORDER_RATE}</span>`; html += `<div class="flex justify-between items-start gap-4 mb-3 border-b border-slate-700/50 pb-2 last:border-0 last:pb-0"><div class="flex flex-col flex-1"><span class="font-medium text-slate-300 capitalize">${r}</span><span class="text-[10px] text-slate-500">${d.uniqueOrders.size} Orders | ${d.addresses.size} Addr</span>${payoutText}</div><div class="text-right"><span class="text-[10px] text-slate-500 block mb-0.5">Collected</span><span class="font-bold text-white">₹${d.amount.toFixed(2)}</span></div></div>`; } $('rider-breakdown-content').innerHTML = html; }
  }

  let restData = {}, totalRestPureSales = 0;
  activeOrders.forEach(o => {
    let restName = String(o.customer_name || 'Unknown').trim(); if (!restName) return;
    let itemTotal = parseFloat(o.total) || 0; if (!restData[restName]) restData[restName] = 0;
    restData[restName] += itemTotal; totalRestPureSales += itemTotal;
  });

  if ($('stat-rest-count')) $('stat-rest-count').textContent = Object.keys(restData).length; if ($('stat-rest-amount')) $('stat-rest-amount').textContent = '₹' + totalRestPureSales.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  if ($('rest-breakdown-content')) {
      if (Object.keys(restData).length === 0) $('rest-breakdown-content').innerHTML = '<div class="text-slate-500 italic mt-1">No orders yet</div>';
      else { let html = ''; for (let r in restData) { html += `<div class="flex justify-between items-center gap-6 mb-2 border-b border-slate-700/50 pb-2 last:border-0 last:pb-0"><span class="font-medium text-slate-300 capitalize">${r}</span><span class="font-bold text-white">₹${restData[r].toFixed(2)}</span></div>`; } $('rest-breakdown-content').innerHTML = html; }
  }
}

window.renderOrders = function() {
  const tbody = $('orders-body');
  const filtered = allOrders.filter(o => {
    const isDateMatch = !currentFilterDate || (o.date && String(o.date).includes(currentFilterDate));
    const isShiftMatch = currentShiftFilter === 'All' || o.shift === currentShiftFilter || (!o.shift && currentShiftFilter === 'All');
    const isRestMatch = currentRestFilter === 'All' || String(o.customer_name || '').trim() === currentRestFilter;
    const isRiderMatch = currentRiderFilter === 'All' || String(o.rider || '').trim() === currentRiderFilter;
    return isDateMatch && isShiftMatch && isRestMatch && isRiderMatch;
  }).filter(o => {
    if (currentTableFilter === 'All') return true;
    if (currentTableFilter === 'UPI Verified') return o.payment_status === 'UPI Done' || String(o.payment_status || '').includes('Split'); 
    if (currentTableFilter === 'UPI Unverified') return o.payment_status === 'UPI (Unverified)';
    if (currentTableFilter === 'Cash') return o.payment_status === 'Cash' || String(o.payment_status||'').includes('Split');
    if (currentTableFilter === 'Payment Pending') return o.payment_status === 'Payment Pending' || o.payment_status === 'Pending';
    return false;
  });

  filtered.sort((a, b) => {
      const idA = parseInt(a.order_id) || 0;
      const idB = parseInt(b.order_id) || 0;
      return idA - idB; 
  });

  if (filtered.length === 0) { if(tbody) tbody.innerHTML = ''; if($('empty-state')) $('empty-state').classList.remove('hidden'); return; }
  if($('empty-state')) $('empty-state').classList.add('hidden');
  
  const colorPalette = [
      'rgba(99, 102, 241, 0.1)',   
      'rgba(16, 185, 129, 0.1)',   
      'rgba(245, 158, 11, 0.1)',   
      'rgba(244, 63, 94, 0.1)',    
      'rgba(6, 182, 212, 0.1)',    
      'rgba(168, 85, 247, 0.1)'    
  ];
  let colorIndex = 0;
  const assignedColors = {};

  const orderCounts = {};
  filtered.forEach(o => {
      let id = o.order_id || o.__backendId;
      orderCounts[id] = (orderCounts[id] || 0) + 1;
  });

  let prevVisualOrderId = null;
  let htmlStr = ''; 

  for (let i = filtered.length - 1; i >= 0; i--) { 
      let currentOrder = filtered[i];
      let currentId = currentOrder.order_id || currentOrder.__backendId;
      
      let isMulti = orderCounts[currentId] > 1;
      let hideTopBorder = isMulti && (prevVisualOrderId === currentId);
      let rowColor = null;

      if (isMulti) {
          if (!assignedColors[currentId]) {
              assignedColors[currentId] = colorPalette[colorIndex % colorPalette.length];
              colorIndex++;
          }
          rowColor = assignedColors[currentId];
      }
      
      htmlStr += createRowHtml(currentOrder, rowColor, hideTopBorder);
      prevVisualOrderId = currentId;
  }
  
  if(tbody) { tbody.innerHTML = htmlStr; }
}

function createRowHtml(order, rowColor = null, hideTopBorder = false) {
  let isZeroRate = parseFloat(order.unit_price) === 0;
  let isDoubtful = order.is_doubtful === true || String(order.is_doubtful) === 'true'; 
  
  let rowStyle = '';
  
  if (hideTopBorder) {
      rowStyle += 'border-top: 1px dashed rgba(148, 163, 184, 0.2); '; 
  } else {
      rowStyle += 'border-top: 1px solid #1e2030; '; 
  }

  if (isDoubtful) {
      rowStyle += 'background-color: rgba(153, 27, 27, 0.4) !important; border-left: 4px solid #ef4444 !important; ';
  } else if (isZeroRate) {
      rowStyle += 'background-color: rgba(239, 68, 68, 0.15); border-left: 4px solid #ef4444; ';
  } else if (rowColor) {
      rowStyle += `background-color: ${rowColor}; border-left: 2px solid ${rowColor.replace('0.1)', '0.5)')}; `; 
  }
  
  const isConfirming = pendingDelete === order.__backendId;
  
  const statusColor = (order.payment_status === 'UPI Done') ? '#3b82f6' : 
                      (order.payment_status === 'UPI (Unverified)') ? '#06b6d4' : 
                      (order.payment_status === 'Payment Pending') ? '#f59e0b' : 
                      (order.payment_status === 'Cash') ? '#10b981' : 
                      (order.payment_status && String(order.payment_status).includes('Split')) ? '#a855f7' : '#6b7084';
  
  const shiftBadge = order.shift === 'After Lunch' ? '🌙' : (order.shift === 'Before Lunch' ? '☀️' : (order.shift === 'No Lunch Break' ? '⚡' : ''));

  let displayPaymentStatus = String(order.payment_status || '');
  if (displayPaymentStatus === "Split (Included in total)") {
      displayPaymentStatus = "Delivered (Split)";
  }

  let timeHtml = '';
  if (order.order_time) {
      let [h, m] = order.order_time.split(':');
      let ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      timeHtml = `<div class="text-[10px] opacity-60 mt-1 tracking-wider">🕒 ${h}:${m} ${ampm}</div>`;
  }
  
  let upiTimeHtml = '';
  if (order.upi_time) {
      let [h, m] = order.upi_time.split(':');
      let ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      upiTimeHtml = `<div class="text-[9px] text-blue-400 mt-1.5 font-bold tracking-wider">🏦 Bank: ${h}:${m} ${ampm}</div>`;
  }
  
  let isAR = String(order.customer_name).trim().toLowerCase() === 'ar';
  let gstBadge = isAR ? ` <span class="text-[9px] font-bold text-red-400 border border-red-400/50 rounded px-1 ml-1" title="5% GST Added">+5% GST</span>` : '';

  let rateHtml = isZeroRate 
      ? `<span class="text-red-400 font-bold">₹0 ⚠️ (RATE MISSING)</span>` 
      : `₹${esc(order.unit_price)}`;

  let dateHtml = '';
  if (!hideTopBorder && order.date) {
      let parts = order.date.split('-');
      if(parts.length === 3) {
          let y = parts[0].length === 4 ? parts[0] : parts[2];
          let m = parts[0].length === 4 ? parts[1] : parts[1];
          let d = parts[0].length === 4 ? parts[2] : parts[0];
          const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          let displayDate = `${d} ${monthNames[parseInt(m)-1]} ${y}`;
          dateHtml = `<div class="font-bold text-slate-300 tracking-wide">${displayDate}</div>`;
      } else {
          dateHtml = `<div class="font-bold text-slate-300 tracking-wide">${order.date}</div>`;
      }
  }

  let noteDisplay = order.note ? `<div class="mt-1.5 text-[11px] font-bold ${isDoubtful ? 'text-red-200 bg-red-950/80 border border-red-500/50' : 'text-slate-300 bg-[#16181f] border border-slate-600'} px-2 py-1 rounded inline-block w-fit max-w-[200px] truncate" title="${esc(order.note)}">📝 ${esc(order.note)}</div>` : '';
  let doubtFlagIconOpacity = isDoubtful ? 'opacity: 1; color: #ef4444;' : 'opacity: 0.4; color: #9ca3af; filter: grayscale(100%);';

  // 🚨 JADOO: ROW MEIN ID ADD KI TAAKI SCROLL HO SAKE
  return `
  <tr id="row-${order.__backendId}" style="${rowStyle}">
    <td class="px-4 py-3 text-xs whitespace-nowrap">
      ${dateHtml}
    </td>
    <td class="px-4 py-3 font-medium" style="color:#60a5fa;">
      #${esc(order.order_id)}
      ${timeHtml}
    </td>
    <td class="px-4 py-3 font-bold text-white">${esc(order.customer_name)} <span class="text-[10px] opacity-70 ml-1">${shiftBadge}</span></td>
    <td class="px-4 py-3 text-xs"><div style="color:#f0ece4;">${esc(order.address)}</div><div style="color:#9ca3af;">${esc(order.contact)}</div></td>
    <td class="px-4 py-3 text-xs">
      <div style="color:#f0ece4;">${esc(order.item_name)}${gstBadge}</div>
      <div style="color:#9ca3af;">${rateHtml} × ${esc(order.quantity)}</div>
      ${noteDisplay}
    </td>
    <td class="px-4 py-3 text-xs" style="color:#9ca3af;">${esc(order.rider)}</td>
    <td class="px-4 py-3 text-right font-bold" style="color:${isZeroRate ? '#ef4444' : '#10b981'};">₹${(parseFloat(order.total) + parseFloat(order.delivery_charge || 0)).toFixed(2)}</td>
    <td class="px-4 py-3 text-center">
      <select onchange="changeStatus('${order.__backendId}', this.value)" class="bg-transparent border rounded px-2 py-1 outline-none text-xs font-semibold cursor-pointer" style="border-color:${statusColor}; color:${statusColor};">
        <option value="Payment Pending" ${displayPaymentStatus === 'Payment Pending' ? 'selected' : ''} style="color:#f59e0b; background:#181a24;">Payment Pending</option>
        <option value="UPI (Unverified)" ${displayPaymentStatus === 'UPI (Unverified)' ? 'selected' : ''} style="color:#06b6d4; background:#181a24;">UPI (Unverified) ⏳</option>
        <option value="UPI Done" ${displayPaymentStatus === 'UPI Done' ? 'selected' : ''} style="color:#3b82f6; background:#181a24;">Delivered (UPI) ✅</option>
        <option value="Cash" ${displayPaymentStatus === 'Cash' ? 'selected' : ''} style="color:#10b981; background:#181a24;">Delivered (Cash)</option>
        ${(displayPaymentStatus.includes('Split')) ? `<option value="${esc(order.payment_status)}" selected style="color:#a855f7; background:#181a24;">Delivered (Split)</option>` : ''}
      </select>
      ${upiTimeHtml}
    </td>
    <td class="px-4 py-3 text-center">
      ${isConfirming 
        ? `<div class="flex items-center justify-center gap-1"><button onclick="confirmDelete('${order.__backendId}')" class="rounded px-2 py-1 text-xs" style="background:#dc2626;color:#fff;">Confirm</button><button onclick="cancelDelete()" class="rounded px-2 py-1 text-xs" style="background:#2a2d3e;color:#6b7084;">Cancel</button></div>` 
        : `<div class="flex items-center justify-center gap-2">
            <button onclick="toggleDoubtful('${order.__backendId}')" class="rounded hover:bg-red-500/20 p-1.5 transition-all" style="${doubtFlagIconOpacity}" title="Mark/Unmark as Doubtful">🚩</button>
            <button onclick="openEditModal('${order.__backendId}')" class="rounded hover:bg-blue-500/20 p-1.5" style="color:#60a5fa;" title="Edit Order">✏️</button>
            <button onclick="requestDelete('${order.__backendId}')" class="rounded hover:bg-red-500/20 p-1.5" style="color:#ef4444;" title="Delete Order">🗑️</button>
           </div>`
      }
    </td>
  </tr>`;
}

function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => { currentTableFilter = btn.dataset.filter; document.querySelectorAll('.filter-btn').forEach(b => { b.style.background = '#2a2d3e'; b.style.color = '#6b7084'; }); btn.style.background = defaultConfig.primary_action_color; btn.style.color = '#fff'; renderOrders(); });
});