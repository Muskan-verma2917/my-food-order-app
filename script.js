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

console.log("App Version 14.0 Loaded! Bulletproof Edit Modal Active.");

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
let currentFilterDate = ''; 
let currentShiftFilter = 'All', currentTableFilter = 'All', currentRestFilter = 'All', currentRiderFilter = 'All';
let orderCounter = 0, pendingDelete = null;
let menuCollapsedState = {};

const defaultConfig = { app_title: 'Daily Delivery Sales', background_color: '#0f1117', primary_action_color: '#e85d3a' };
const $ = id => document.getElementById(id);

if ($('date-filter')) $('date-filter').value = '';

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
  const dateStr = currentFilterDate, shiftStr = currentShiftFilter.replace(/\s+/g, ''), key = dateStr + "_" + shiftStr;
  let deposited = inputVal;
  if (currentShiftFilter === 'All') {
    const beforeVal = parseFloat(depositedCashData[dateStr + "_BeforeLunch"]) || 0, afterVal = parseFloat(depositedCashData[dateStr + "_AfterLunch"]) || 0;
    deposited = beforeVal + afterVal;
    if (inputEl && labelEl) { inputEl.value = deposited || ''; inputEl.disabled = true; inputEl.parentElement.style.opacity = '0.5'; inputEl.parentElement.style.pointerEvents = 'none'; labelEl.textContent = 'Auto Sum (Both Shifts):'; labelEl.style.color = '#a855f7'; }
  } else {
    if (deposited === null) { deposited = depositedCashData[key] || 0; }
    if (inputEl && labelEl) { inputEl.value = deposited || ''; inputEl.disabled = false; inputEl.parentElement.style.opacity = '1'; inputEl.parentElement.style.pointerEvents = 'auto'; labelEl.textContent = 'Rider Deposited:'; labelEl.style.color = '#94a3b8'; }
  }
  let numDeposited = parseFloat(deposited) || 0, pending = currentTotalCash - numDeposited;
  if (!display) return;
  if (pending > 0) { display.textContent = `⚠️ Pending: ₹${pending.toFixed(2)}`; display.style.color = '#ef4444'; } 
  else if (pending < 0) { display.textContent = `⚠️ Extra: ₹${Math.abs(pending).toFixed(2)}`; display.style.color = '#f59e0b'; } 
  else if (currentTotalCash > 0 && pending === 0) { display.textContent = `✅ Clear: ₹0.00`; display.style.color = '#10b981'; } 
  else { display.textContent = ''; }
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
        await dbMenu.child(editingMenuId).update({ restaurant: rest, item: item, rate: rate }); showToast(`✅ ${item} updated!`); cancelMenuEdit(); 
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
  const tbody = $('menu-list-body'); if(!tbody) return; tbody.innerHTML = '';
  const searchT = ($('menu-search-input') ? $('menu-search-input').value.trim().toLowerCase() : '');
  const filtered = menuList.filter(m => { if (!searchT) return true; return String(m.restaurant||'').toLowerCase().includes(searchT) || String(m.item||'').toLowerCase().includes(searchT); });
  if(filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="3" class="text-center py-6 text-slate-500">No match found</td></tr>`; return; }

  const groupedMenu = {};
  filtered.forEach(m => { let rName = m.restaurant || 'Unknown'; if(!groupedMenu[rName]) groupedMenu[rName] = []; groupedMenu[rName].push(m); });

  Object.keys(groupedMenu).sort((a,b)=>String(a).localeCompare(String(b),undefined,{sensitivity:'base'})).forEach(rName => {
      let isCollapsed = menuCollapsedState[rName] || false;
      let chevronIcon = isCollapsed ? 'chevron-right' : 'chevron-down';
      let safeRName = String(rName).replace(/[^a-zA-Z0-9]/g, '');

      tbody.innerHTML += `
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
        tbody.innerHTML += `
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
window.autoFillAllItemsInBlock = function(rInp) { const b = rInp.closest('.rest-block'); if(!b) return; b.querySelectorAll('.item-name').forEach(i => autoFillRate(i)); };


// --- BULLETPROOF EDIT MODAL LOGIC ---
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
  let tot = 0; 
  document.querySelectorAll('#edit-restaurants-wrapper .item-row').forEach(r => { 
      tot += ((parseFloat(r.querySelector('.item-rate').value) || 0) * (parseFloat(r.querySelector('.item-qty').value) || 0)); 
  });
  const delInput = $('edit-del-charge');
  const del = delInput ? (parseFloat(delInput.value) || 0) : 0; 
  const g = tot + del;
  
  if ($('edit-subtotal')) $('edit-subtotal').textContent = '₹' + tot.toLocaleString('en-IN', { minimumFractionDigits: 2 }); 
  if ($('edit-delivery-display')) $('edit-delivery-display').textContent = '₹' + del.toLocaleString('en-IN', { minimumFractionDigits: 2 }); 
  if ($('edit-grand-total')) $('edit-grand-total').textContent = '₹' + g.toLocaleString('en-IN', { minimumFractionDigits: 2 });
};

window.handleFullEditSubmit = async function(event) {
  if (event) event.preventDefault(); 
  const btn = $('edit-save-btn'); 
  if(btn) { btn.disabled = true; btn.style.opacity = '0.5'; btn.textContent = 'Saving...'; }
  try {
    let finalItems = [];
    document.querySelectorAll('#edit-restaurants-wrapper .rest-block').forEach(b => {
      const rName = b.querySelector('.rest-name').value.trim();
      if(rName) { b.querySelectorAll('.item-row').forEach(row => { const bId = row.dataset.backendId || null, name = row.querySelector('.item-name').value.trim(), rate = parseFloat(row.querySelector('.item-rate').value) || 0, qty = parseFloat(row.querySelector('.item-qty').value) || 1; if(name && rate >= 0) finalItems.push({ __backendId: bId, name, rate, qty, total: rate*qty, restaurant: rName }); }); }
    });
    if(finalItems.length === 0) throw new Error("At least one item is required!");
    const pMode = $('edit-payment-status').value, addr = $('edit-address').value.trim(), cont = $('edit-contact').value.trim(), rider = $('edit-rider').value.trim(), shift = $('edit-shift').value, dChg = parseFloat($('edit-del-charge').value) || 0;
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
      let stat = "Payment Pending"; if(pMode === "UPI Done" || pMode === "Cash" || pMode === "Split") stat = "Delivered";
      let itemPaymentStatus = isFirst ? fPMode : pMode; 
      if (fPMode.includes('Split') && !isFirst) {
          itemPaymentStatus = "Split (Included in total)";
      }
      let iData = { order_id: currentlyEditingOrderId, customer_name: i.restaurant, item_name: i.name, quantity: i.qty, unit_price: i.rate, total: i.total, status: stat, date: oDate, shift: shift, address: addr, customer_address: addr, location: addr, payment_status: itemPaymentStatus, contact: cont, rider: rider, delivery_charge: isFirst ? dChg : 0 };
      if(i.__backendId) { await dbOrders.child(i.__backendId).update(iData); } else { await dbOrders.push().set(iData); }
      isFirst = false;
    }
    toggleEditModal(false); showToast('✅ Order Updated successfully!');
  } catch (err) { showToast('❌ ' + err.message, 'error'); } finally { if(btn) { btn.disabled = false; btn.style.opacity = '1'; btn.textContent = 'Save Update'; } }
};

window.openNewOrderModal = function() {
    const form = $('new-premium-order-form');
    if (form) form.reset(); 
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
    if($('p-grand-total')) $('p-grand-total').textContent = '₹0';
    if($('p-subtotal')) $('p-subtotal').textContent = '₹0';
    if($('p-delivery-display')) $('p-delivery-display').textContent = '₹0';
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
  let total = 0; document.querySelectorAll('#restaurants-wrapper .item-row').forEach(row => { total += ((parseFloat(row.querySelector('.item-rate').value) || 0) * (parseFloat(row.querySelector('.item-qty').value) || 0)); });
  const delCharge = parseFloat($('p-del-charge').value) || 0; const grandTotal = total + delCharge;
  $('p-subtotal').textContent = '₹' + total.toLocaleString('en-IN', { minimumFractionDigits: 2 }); $('p-delivery-display').textContent = '₹' + delCharge.toLocaleString('en-IN', { minimumFractionDigits: 2 }); $('p-grand-total').textContent = '₹' + grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
};

window.handlePremiumFormSubmit = async function(event) {
  if (event) event.preventDefault(); 
  const btn = $('place-order-btn'); 
  if(btn) { btn.disabled = true; btn.style.opacity = '0.5'; btn.textContent = 'Saving to Cloud...'; }
  
  try {
    const restBlocks = document.querySelectorAll('#restaurants-wrapper .rest-block'); let allItems = [];
    restBlocks.forEach(block => {
      const restName = block.querySelector('.rest-name').value.trim();
      if (restName) { block.querySelectorAll('.item-row').forEach(row => { const name = row.querySelector('.item-name').value.trim(), rate = parseFloat(row.querySelector('.item-rate').value) || 0, qty = parseFloat(row.querySelector('.item-qty').value) || 1; if (name && rate > 0) allItems.push({ name, rate, qty, total: rate * qty, restaurant: restName }); }); }
    });
    if (allItems.length === 0) throw new Error("Add at least one item!");
    
    const pMode = $('p-payment').value, cont = $('p-contact').value.trim(), addr = $('p-address').value.trim(), rider = $('p-rider').value.trim(), shift = $('p-shift').value, delChg = parseFloat($('p-del-charge').value) || 0;
    if (!pMode) throw new Error("Select Payment Mode!"); if (!addr) throw new Error("Address is required!");
    let fPMode = pMode;
    if (pMode === 'Split') { let sC = (parseFloat($('split-cash').value) || 0) + delChg, sU = parseFloat($('split-upi').value) || 0; fPMode = `Split: Cash ₹${sC.toFixed(2)} | UPI ₹${sU.toFixed(2)}`; }
    const oDate = $('date-filter').value || getLocalIsoDate();
    
    orderCounter++; await dbCounter.set(orderCounter); const cOrderId = String(orderCounter).padStart(3, '0'); let isFirst = true;
    for (const item of allItems) {
      let stat = "Payment Pending"; if (pMode === "UPI Done" || pMode === "Cash" || pMode === "Split") stat = "Delivered";
      
      let itemPaymentStatus = isFirst ? fPMode : pMode;
      if (fPMode.includes('Split') && !isFirst) {
          itemPaymentStatus = "Split (Included in total)";
      }

      await dbOrders.push().set({ order_id: cOrderId, customer_name: item.restaurant, item_name: item.name, quantity: item.qty, unit_price: item.rate, total: item.total, status: stat, date: oDate, shift: shift, address: addr, customer_address: addr, location: addr, payment_status: itemPaymentStatus, contact: cont, rider: rider, delivery_charge: isFirst ? delChg : 0 });
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
  const idx = allOrders.findIndex(o => o.__backendId === bId); if (idx === -1) return; let o = allOrders[idx], oStat = String(o.payment_status || '');
  if (oStat === 'UPI Done' || oStat.includes('Split')) { if (nPStat !== oStat) { showToast('🔒 Locked: Bank amount cannot be changed!', 'error'); renderOrders(); return; } }
  let nStat = o.status; if (nPStat === 'UPI Done' || nPStat === 'Cash' || nPStat.includes('Split')) { nStat = 'Delivered'; } else if (nPStat === 'Payment Pending') { nStat = 'Payment Pending'; }
  await dbOrders.child(bId).update({ payment_status: nPStat, status: nStat }); showToast('Cloud Status updated'); 
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
        ordersGroup[oId] = { totalValue: 0, status: String(o.payment_status || "") };
    }
    
    ordersGroup[oId].totalValue += rowTotal;
    
    if (String(o.payment_status || "").includes("Cash ₹")) {
        ordersGroup[oId].status = String(o.payment_status);
    }
  });

  Object.values(ordersGroup).forEach(grp => {
      let stat = String(grp.status || "");
      if (stat === 'UPI Done') { upiTotal += grp.totalValue; }
      else if (stat === 'Cash') { cashTotal += grp.totalValue; }
      else if (stat === 'Payment Pending') { pendingTotal += grp.totalValue; }
      else if (stat.includes('Split')) {
          const cashMatch = stat.match(/Cash ₹([\d.]+)/);
          const upiMatch = stat.match(/UPI ₹([\d.]+)/);
          cashTotal += cashMatch ? parseFloat(cashMatch[1]) : 0;
          upiTotal += upiMatch ? parseFloat(upiMatch[1]) : 0;
      }
  });

  const activeOrders = filteredData.filter(o => o.status !== 'Cancelled'), deliveredCashOrders = activeOrders.filter(o => o.payment_status === 'Cash' || String(o.payment_status || '').includes('Split')), deliveredUpiOrders = activeOrders.filter(o => o.payment_status === 'UPI Done' || String(o.payment_status || '').includes('Split')), allDeliveredOrders = activeOrders.filter(o => o.status === 'Delivered'), pendingOrders = activeOrders.filter(o => o.payment_status === 'Payment Pending');

  if ($('stat-sales-inr')) $('stat-sales-inr').textContent = '₹' + pureSales.toFixed(2); if ($('stat-sales-delivery')) $('stat-sales-delivery').textContent = '₹' + totalWithDelivery.toFixed(2);
  if ($('stat-delivered-cash')) $('stat-delivered-cash').textContent = countUniqueOrders(deliveredCashOrders); if ($('stat-delivered-cash-total')) $('stat-delivered-cash-total').textContent = '₹' + cashTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  currentTotalCash = cashTotal; updatePendingCashUI();
  if ($('stat-delivered-upi')) $('stat-delivered-upi').textContent = countUniqueOrders(deliveredUpiOrders); if ($('stat-delivered-upi-total')) $('stat-delivered-upi-total').textContent = '₹' + upiTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  if ($('stat-delivered')) $('stat-delivered').textContent = countUniqueOrders(allDeliveredOrders); if ($('stat-delivered-total')) $('stat-delivered-total').textContent = '₹' + (cashTotal + upiTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 });
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

function renderOrders() {
  const tbody = $('orders-body');
  const filtered = allOrders.filter(o => {
    const isDateMatch = !currentFilterDate || (o.date && String(o.date).includes(currentFilterDate));
    const isShiftMatch = currentShiftFilter === 'All' || o.shift === currentShiftFilter || (!o.shift && currentShiftFilter === 'All');
    const isRestMatch = currentRestFilter === 'All' || String(o.customer_name || '').trim() === currentRestFilter;
    const isRiderMatch = currentRiderFilter === 'All' || String(o.rider || '').trim() === currentRiderFilter;
    return isDateMatch && isShiftMatch && isRestMatch && isRiderMatch;
  }).filter(o => {
    if (currentTableFilter === 'All') return true;
    if (currentTableFilter === 'Delivered (Total)') return o.status === 'Delivered';
    if (currentTableFilter === 'Delivered (Cash)') return o.payment_status === 'Cash' || String(o.payment_status||'').includes('Split');
    if (currentTableFilter === 'Delivered (UPI)') return o.payment_status === 'UPI Done' || String(o.payment_status||'').includes('Split');
    if (currentTableFilter === 'Payment Pending') return o.payment_status === 'Payment Pending' || o.payment_status === 'Pending';
    return false;
  });

  if (filtered.length === 0) { if(tbody) tbody.innerHTML = ''; if($('empty-state')) $('empty-state').classList.remove('hidden'); return; }
  if($('empty-state')) $('empty-state').classList.add('hidden');
  const fragment = document.createDocumentFragment();
  for (let i = filtered.length - 1; i >= 0; i--) { fragment.appendChild(createRow(filtered[i])); }
  if(tbody) { tbody.innerHTML = ''; tbody.appendChild(fragment); }
}

function createRow(order) {
  const tr = document.createElement('tr'); tr.style.cssText = 'border-top:1px solid #1e2030;';
  const isConfirming = pendingDelete === order.__backendId;
  const statusColor = (order.payment_status === 'UPI Done') ? '#3b82f6' : (order.payment_status === 'Payment Pending') ? '#f59e0b' : (order.payment_status === 'Cash') ? '#10b981' : (order.payment_status && String(order.payment_status).includes('Split')) ? '#a855f7' : '#6b7084';
  const shiftBadge = order.shift === 'After Lunch' ? '🌙' : (order.shift === 'Before Lunch' ? '☀️' : '');

  let displayPaymentStatus = String(order.payment_status || '');
  if (displayPaymentStatus === "Split (Included in total)") {
      displayPaymentStatus = "Delivered (Split)";
  }

  tr.innerHTML = `
    <td class="px-4 py-3 font-medium" style="color:#60a5fa;">#${esc(order.order_id)}</td>
    <td class="px-4 py-3 font-bold text-white">${esc(order.customer_name)} <span class="text-[10px] opacity-70 ml-1">${shiftBadge}</span></td>
    <td class="px-4 py-3 text-xs"><div style="color:#f0ece4;">${esc(order.address)}</div><div style="color:#9ca3af;">${esc(order.contact)}</div></td>
    <td class="px-4 py-3 text-xs"><div style="color:#f0ece4;">${esc(order.item_name)}</div><div style="color:#9ca3af;">₹${esc(order.unit_price)} × ${esc(order.quantity)}</div></td>
    <td class="px-4 py-3 text-xs" style="color:#9ca3af;">${esc(order.rider)}</td>
    <td class="px-4 py-3 text-right font-bold" style="color:#10b981;">₹${(parseFloat(order.total) + parseFloat(order.delivery_charge || 0)).toFixed(2)}</td>
    <td class="px-4 py-3 text-center">
      <select onchange="changeStatus('${order.__backendId}', this.value)" class="bg-transparent border rounded px-2 py-1 outline-none text-xs font-semibold cursor-pointer" style="border-color:${statusColor}; color:${statusColor};">
        <option value="Payment Pending" ${displayPaymentStatus === 'Payment Pending' ? 'selected' : ''} style="color:#f59e0b; background:#181a24;">Payment Pending</option>
        <option value="Cash" ${displayPaymentStatus === 'Cash' ? 'selected' : ''} style="color:#10b981; background:#181a24;">Delivered (Cash)</option>
        <option value="UPI Done" ${displayPaymentStatus === 'UPI Done' ? 'selected' : ''} style="color:#3b82f6; background:#181a24;">Delivered (UPI)</option>
        ${(displayPaymentStatus.includes('Split')) ? `<option value="${esc(order.payment_status)}" selected style="color:#a855f7; background:#181a24;">Delivered (Split)</option>` : ''}
      </select>
    </td>
    <td class="px-4 py-3 text-center">
      ${isConfirming ? `<div class="flex items-center justify-center gap-1"><button onclick="confirmDelete('${order.__backendId}')" class="rounded px-2 py-1 text-xs" style="background:#dc2626;color:#fff;">Confirm</button><button onclick="cancelDelete()" class="rounded px-2 py-1 text-xs" style="background:#2a2d3e;color:#6b7084;">Cancel</button></div>` : `<div class="flex items-center justify-center gap-3"><button onclick="openEditModal('${order.__backendId}')" class="rounded hover:bg-blue-500/20 p-1.5" style="color:#60a5fa;">✏️</button><button onclick="requestDelete('${order.__backendId}')" class="rounded hover:bg-red-500/20 p-1.5" style="color:#ef4444;">🗑️</button></div>`}
    </td>
  `;
  return tr;
}

function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => { currentTableFilter = btn.dataset.filter; document.querySelectorAll('.filter-btn').forEach(b => { b.style.background = '#2a2d3e'; b.style.color = '#6b7084'; }); btn.style.background = defaultConfig.primary_action_color; btn.style.color = '#fff'; renderOrders(); });
});