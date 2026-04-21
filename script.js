// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyAa7AB13P8HLuB5cRWHhOsRAHBowcMJsc4",
  authDomain: "food-delivery-app-46de1.firebaseapp.com",
  databaseURL: "https://food-delivery-app-46de1-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "food-delivery-app-46de1",
  storageBucket: "food-delivery-app-46de1.firebasestorage.app",
  messagingSenderId: "218219407862",
  appId: "1:218219407862:web:df17a3059dfa3ece347fd7"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const dbOrders = database.ref('orders');
const dbCounter = database.ref('orderCounter');

// --- TIMEZONE DATE FIX ---
function getLocalIsoDate() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

let allOrders = [];
let currentFilter = 'All';
let currentFilterDate = getLocalIsoDate(); 
let orderCounter = 0;
let pendingDelete = null;

const defaultConfig = { app_title: 'Daily Delivery Sales', background_color: '#0f1117' };
const $ = id => document.getElementById(id);

if ($('date-filter')) {
  $('date-filter').value = currentFilterDate;
}

// --- FIREBASE LIVE LISTENERS ---
dbOrders.on('value', (snapshot) => {
  const data = snapshot.val();
  allOrders = [];
  if (data) {
    Object.keys(data).forEach(key => {
      allOrders.push(data[key]);
    });
  }
  updateStats();
  renderOrders();
});

dbCounter.on('value', (snapshot) => {
  orderCounter = snapshot.val() || 0;
});

// --- UI FUNCTIONS ---
window.toggleModal = function(show) {
  const modal = $('form-modal');
  if (show) { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; } 
  else { modal.classList.add('hidden'); document.body.style.overflow = 'auto'; }
};

window.toggleEditModal = function(show) {
  const modal = $('edit-modal');
  if (show) { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; } 
  else { modal.classList.add('hidden'); document.body.style.overflow = 'auto'; }
};

document.addEventListener('DOMContentLoaded', function() {
  $('form-modal').addEventListener('click', e => { if (e.target === $('form-modal')) toggleModal(false); });
  $('edit-modal').addEventListener('click', e => { if (e.target === $('edit-modal')) toggleEditModal(false); });
  $('edit-rate')?.addEventListener('input', updateEditTotal);
  $('edit-qty')?.addEventListener('input', updateEditTotal);
  $('edit-delivery')?.addEventListener('input', updateEditTotal);
});

let premRestCount = 1;
window.toggleSplitFields = function() {
  const mode = $('p-payment').value;
  if (mode === 'Split') $('split-inputs').classList.remove('hidden'); else $('split-inputs').classList.add('hidden');
};

window.toggleEditSplitFields = function() {
  const mode = $('edit-payment-status').value;
  if (mode === 'Split') $('edit-split-inputs').classList.remove('hidden'); else $('edit-split-inputs').classList.add('hidden');
};

window.addPremiumItem = function(restId) {
  const container = document.getElementById(`items-rest-${restId}`);
  const div = document.createElement('div');
  div.className = 'item-row flex gap-2 items-start';
  div.innerHTML = `<div class="flex-1"><label class="block text-[10px] text-slate-500 mb-1">Item Name</label><input type="text" name="item_name[]" class="item-name w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="Item Name"></div><div class="w-24"><label class="block text-[10px] text-slate-500 mb-1">Rate (₹)</label><input type="number" name="rate[]" class="item-rate w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="0" min="0" oninput="calcPremiumTotal()"></div><div class="w-20"><label class="block text-[10px] text-slate-500 mb-1">Qty</label><input type="number" name="qty[]" class="item-qty w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="1" value="1" min="1" oninput="calcPremiumTotal()"></div><button type="button" class="mt-5 p-2 text-slate-500 hover:text-red-500 transition-colors" onclick="removePremiumItem(this)">✕</button>`;
  container.appendChild(div);
};

window.removePremiumItem = function(btn) { btn.parentElement.remove(); calcPremiumTotal(); };

window.addPremiumRestaurant = function() {
  premRestCount++;
  const wrapper = $('restaurants-wrapper');
  const div = document.createElement('div');
  div.className = 'rest-block p-4 rounded-lg border border-slate-700 bg-[#16181f] relative mt-4';
  div.dataset.restId = premRestCount;
  div.innerHTML = `<button type="button" class="absolute top-3 right-3 text-slate-500 hover:text-red-500 text-xs font-bold uppercase tracking-wider" onclick="removePremiumRest(this)">Remove</button><div class="mb-4 pr-16"><label class="block text-xs font-medium text-slate-400 mb-1">Restaurant Name *</label><input type="text" name="rest_name[]" class="rest-name w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="Enter restaurant name"></div><div class="items-container space-y-3 mb-3" id="items-rest-${premRestCount}"><div class="item-row flex gap-2 items-start"><div class="flex-1"><label class="block text-[10px] text-slate-500 mb-1">Item Name</label><input type="text" name="item_name[]" class="item-name w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="Item Name"></div><div class="w-24"><label class="block text-[10px] text-slate-500 mb-1">Rate (₹)</label><input type="number" name="rate[]" class="item-rate w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="0" min="0" oninput="calcPremiumTotal()"></div><div class="w-20"><label class="block text-[10px] text-slate-500 mb-1">Qty</label><input type="number" name="qty[]" class="item-qty w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="1" value="1" min="1" oninput="calcPremiumTotal()"></div><button type="button" class="mt-5 p-2 text-slate-500 hover:text-red-500 transition-colors" onclick="removePremiumItem(this)">✕</button></div></div><button type="button" onclick="addPremiumItem(${premRestCount})" class="text-xs font-semibold hover:opacity-80" style="color: #ff5a36;">+ Add Item</button>`;
  wrapper.appendChild(div);
};

window.removePremiumRest = function(btn) { btn.parentElement.remove(); calcPremiumTotal(); };

window.calcPremiumTotal = function() {
  let total = 0;
  document.querySelectorAll('.item-row').forEach(row => {
    const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    total += (rate * qty);
  });
  const delCharge = parseFloat($('p-del-charge').value) || 0;
  const grandTotal = total + delCharge;
  $('p-subtotal').textContent = '₹' + total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  $('p-delivery-display').textContent = '₹' + delCharge.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  $('p-grand-total').textContent = '₹' + grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function showToast(msg, type='success') {
  const t = document.createElement('div');
  t.className = 'toast rounded-lg px-4 py-2 text-sm font-medium shadow-lg z-[9999]';
  t.style.cssText = type === 'error' ? 'background:#dc2626;color:#fff;' : 'background:#16a34a;color:#fff;';
  t.textContent = msg;
  const container = document.getElementById('toast-container');
  if(container) { container.appendChild(t); setTimeout(() => t.remove(), 4000); } else { alert(msg); }
}

function filterByDate() { currentFilterDate = $('date-filter').value; renderOrders(); updateStats(); }

// --- FIREBASE SUBMIT LOGIC ---
window.handlePremiumFormSubmit = async function(event) {
  if (event) event.preventDefault();
  const btn = $('place-order-btn');
  if(btn) { btn.disabled = true; btn.style.opacity = '0.5'; btn.textContent = 'Saving to Cloud...'; }

  try {
    const restBlocks = document.querySelectorAll('.rest-block');
    let allItems = [];
    restBlocks.forEach(block => {
      const restName = block.querySelector('.rest-name') ? block.querySelector('.rest-name').value.trim() : '';
      if (restName) {
        block.querySelectorAll('.item-row').forEach(row => {
          const name = row.querySelector('.item-name') ? row.querySelector('.item-name').value.trim() : '';
          const rate = row.querySelector('.item-rate') ? parseFloat(row.querySelector('.item-rate').value) || 0 : 0;
          const qty = row.querySelector('.item-qty') ? parseFloat(row.querySelector('.item-qty').value) || 1 : 1;
          if (name && rate > 0) allItems.push({ name, rate, qty, total: rate * qty, restaurant: restName });
        });
      }
    });

    if (allItems.length === 0) throw new Error("Please add at least one item with name and rate!");

    const paymentMode = $('p-payment').value;
    const contact = $('p-contact').value.trim();
    const address = $('p-address').value.trim();
    const rider = $('p-rider').value.trim();
    const deliveryCharge = parseFloat($('p-del-charge').value) || 0;

    if (!paymentMode) throw new Error("Select a Payment Mode!");
    if (!address) throw new Error("Delivery Address is required!");

    let finalPaymentMode = paymentMode;
    if (paymentMode === 'Split') {
      let splitCash = (parseFloat($('split-cash').value) || 0) + deliveryCharge;
      let splitUpi = parseFloat($('split-upi').value) || 0;
      if (splitCash <= 0 && splitUpi <= 0) throw new Error("Enter at least one amount for Split payment!");
      finalPaymentMode = `Split: Cash ₹${splitCash.toFixed(2)} | UPI ₹${splitUpi.toFixed(2)}`;
    }

    const orderDate = $('date-filter') && $('date-filter').value ? $('date-filter').value : getLocalIsoDate();

    orderCounter++;
    await dbCounter.set(orderCounter);
    const currentOrderId = String(orderCounter).padStart(3, '0');
    
    let isFirstItem = true;
    for (const item of allItems) {
      let status = "Payment Pending";
      if (paymentMode === "UPI Done" || paymentMode === "Cash" || paymentMode === "Split") status = "Delivered";
      
      const newOrderRef = dbOrders.push(); 
      const newOrder = {
        __backendId: newOrderRef.key, 
        order_id: currentOrderId,
        customer_name: item.restaurant,
        item_name: item.name,
        quantity: item.qty,
        unit_price: item.rate,
        total: item.total,
        status: status,
        date: orderDate,
        address: address,
        customer_address: address,
        location: address,
        payment_status: finalPaymentMode,
        contact: contact,
        rider: rider,
        delivery_charge: isFirstItem ? deliveryCharge : 0
      };
      
      await newOrderRef.set(newOrder); 
      isFirstItem = false;
    }

    if(btn) { btn.disabled = false; btn.style.opacity = '1'; btn.textContent = 'Place Order'; }
    showToast(`✅ Cloud Sync Success! ${allItems.length} item(s) saved!`);
    
    // Reset Form
    $('new-premium-order-form').reset(); $('p-grand-total').textContent = '₹0'; $('p-subtotal').textContent = '₹0'; $('p-delivery-display').textContent = '₹0'; $('split-inputs').classList.add('hidden');
    $('restaurants-wrapper').innerHTML = `<div class="rest-block p-4 rounded-lg border border-slate-700 bg-[#16181f]" data-rest-id="1"><div class="mb-4"><label class="block text-xs font-medium text-slate-400 mb-1">Restaurant Name *</label><input type="text" name="rest_name[]" class="rest-name w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="Enter restaurant name"></div><div class="items-container space-y-3 mb-3" id="items-rest-1"><div class="item-row flex gap-2 items-start"><div class="flex-1"><label class="block text-[10px] text-slate-500 mb-1">Item Name</label><input type="text" name="item_name[]" class="item-name w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="Item Name"></div><div class="w-24"><label class="block text-[10px] text-slate-500 mb-1">Rate (₹)</label><input type="number" name="rate[]" class="item-rate w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="0" min="0" oninput="calcPremiumTotal()"></div><div class="w-20"><label class="block text-[10px] text-slate-500 mb-1">Qty</label><input type="number" name="qty[]" class="item-qty w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="1" value="1" min="1" oninput="calcPremiumTotal()"></div><button type="button" class="mt-5 p-2 text-slate-500 hover:text-red-500 transition-colors" onclick="removePremiumItem(this)">✕</button></div></div><button type="button" onclick="addPremiumItem(1)" class="text-xs font-semibold tracking-wide hover:opacity-80 transition-opacity" style="color: #ff5a36;">+ Add Item</button></div>`;
    premRestCount = 1;
    setTimeout(() => toggleModal(false), 500);

  } catch (err) {
    console.error(err); 
    showToast('❌ Cloud Error: ' + err.message, 'error'); 
    if(btn) { btn.disabled = false; btn.style.opacity = '1'; btn.textContent = 'Place Order'; }
  }
};

// --- FIREBASE STATUS & DELETE LOGIC ---
window.changeStatus = async function(backendId, newPaymentStatus) {
  const orderIndex = allOrders.findIndex(o => o.__backendId === backendId);
  if (orderIndex === -1) return;
  
  let order = allOrders[orderIndex];
  let oldStatus = order.payment_status;

  if (newPaymentStatus === 'Cash' && (oldStatus === 'UPI Done' || oldStatus.includes('Split'))) {
      await dbOrders.child(backendId).update({ status: 'Delivered' });
      showToast('✅ UPI Amount Protected! (Status Delivered)'); 
      return; 
  }
  
  let newStatus = order.status;
  if (newPaymentStatus === 'UPI Done' || newPaymentStatus === 'Cash') newStatus = 'Delivered';
  else if (newPaymentStatus === 'Payment Pending') newStatus = 'Payment Pending';
  
  await dbOrders.child(backendId).update({
      payment_status: newPaymentStatus,
      status: newStatus
  });
  showToast('Cloud Status updated'); 
};

window.requestDelete = function(backendId) { pendingDelete = backendId; renderOrders(); };
window.cancelDelete = function() { pendingDelete = null; renderOrders(); };
window.confirmDelete = async function(backendId) {
  await dbOrders.child(backendId).remove();
  pendingDelete = null; 
  showToast('Order deleted from Cloud');
};

// --- FIREBASE EDIT LOGIC ---
let editingOrderId = null;
window.openEditModal = function(backendId) {
  editingOrderId = backendId;
  const order = allOrders.find(o => o.__backendId === backendId);
  if (!order) return;
  $('edit-restaurant').value = order.customer_name || ''; $('edit-item-name').value = order.item_name || ''; $('edit-rate').value = order.unit_price || ''; $('edit-qty').value = order.quantity || ''; $('edit-delivery').value = order.delivery_charge || ''; $('edit-rider').value = order.rider || ''; $('edit-contact').value = order.contact || ''; $('edit-address').value = order.address || order.customer_address || '';
  let pStatus = order.payment_status || '';
  if (pStatus.includes('Split')) {
      $('edit-payment-status').value = 'Split';
      let savedCash = pStatus.match(/Cash ₹([\d.]+)/) ? parseFloat(pStatus.match(/Cash ₹([\d.]+)/)[1]) : 0;
      let savedUpi = pStatus.match(/UPI ₹([\d.]+)/) ? parseFloat(pStatus.match(/UPI ₹([\d.]+)/)[1]) : 0;
      let delCharge = parseFloat(order.delivery_charge) || 0;
      $('edit-split-cash').value = Math.max(0, savedCash - delCharge); $('edit-split-upi').value = savedUpi; $('edit-split-inputs').classList.remove('hidden');
  } else { $('edit-payment-status').value = pStatus; $('edit-split-inputs').classList.add('hidden'); }
  updateEditTotal(); toggleEditModal(true);
};

window.updateEditTotal = function() {
  const total = (parseFloat($('edit-rate').value) || 0) * (parseFloat($('edit-qty').value) || 1) + (parseFloat($('edit-delivery').value) || 0);
  $('edit-total-display').textContent = '₹' + total.toFixed(2);
};

window.handleEditSubmit = async function(event) {
  if (event) event.preventDefault();
  if (!editingOrderId) return;
  const orderIndex = allOrders.findIndex(o => o.__backendId === editingOrderId);
  if (orderIndex === -1) return;
  
  const btn = $('edit-save-btn');
  if(btn) { btn.disabled = true; btn.style.opacity = '0.5'; btn.textContent = 'Saving...'; }
  
  try {
    let order = allOrders[orderIndex];
    let updatedData = {
      customer_name: $('edit-restaurant').value.trim(),
      item_name: $('edit-item-name').value.trim(),
      unit_price: parseFloat($('edit-rate').value) || 0,
      quantity: parseFloat($('edit-qty').value) || 1,
      delivery_charge: parseFloat($('edit-delivery').value) || 0,
      rider: $('edit-rider').value.trim(),
      contact: $('edit-contact').value.trim(),
      address: $('edit-address').value.trim()
    };
    updatedData.total = updatedData.unit_price * updatedData.quantity;
    updatedData.customer_address = updatedData.address;
    updatedData.location = updatedData.address;
    
    let editMode = $('edit-payment-status').value;
    if (editMode === 'Split') {
        let splitCash = (parseFloat($('edit-split-cash').value) || 0) + updatedData.delivery_charge;
        let splitUpi = parseFloat($('edit-split-upi').value) || 0;
        updatedData.payment_status = `Split: Cash ₹${splitCash.toFixed(2)} | UPI ₹${splitUpi.toFixed(2)}`;
    } else updatedData.payment_status = editMode;

    await dbOrders.child(editingOrderId).update(updatedData);
    showToast('✅ Order updated in Cloud!'); 
    toggleEditModal(false);

  } catch (err) { 
      showToast('❌ ' + err.message, 'error'); 
  } finally {
      if(btn) { btn.disabled = false; btn.style.opacity = '1'; btn.textContent = 'Save Changes'; }
  }
};

// --- RENDER AND STATS FUNCTIONS ---
$('app-title').textContent = defaultConfig.app_title;
$('app').style.background = defaultConfig.background_color;
if (typeof lucide !== 'undefined') lucide.createIcons();

function updateStats() {
  const filteredByDate = allOrders.filter(o => o.date && o.date.slice(0, 10) === currentFilterDate);
  let upiTotal = 0, cashTotal = 0, pendingTotal = 0, pureSales = 0, totalWithDelivery = 0;

  filteredByDate.forEach(o => {
    if (o.status === 'Cancelled') return;
    const itemTotal = parseFloat(o.total) || 0;
    const delCharge = parseFloat(o.delivery_charge) || 0;
    const status = o.payment_status || "";
    const orderTotalWithDel = itemTotal + delCharge;

    pureSales += itemTotal;
    totalWithDelivery += orderTotalWithDel;

    if (status === 'UPI Done') { upiTotal += orderTotalWithDel; }
    else if (status === 'Cash') { cashTotal += orderTotalWithDel; }
    else if (status === 'Payment Pending') { pendingTotal += orderTotalWithDel; }
    else if (status.includes('Split')) {
      const cashMatch = status.match(/Cash ₹([\d.]+)/);
      const upiMatch = status.match(/UPI ₹([\d.]+)/);
      let splitCash = cashMatch ? parseFloat(cashMatch[1]) : 0;
      let splitUpi = upiMatch ? parseFloat(upiMatch[1]) : 0;
      cashTotal += splitCash; upiTotal += splitUpi;
    }
  });

  // Calculate Specific Counts for the New Boxes
  const deliveredCashOrders = filteredByDate.filter(o => o.payment_status === 'Cash' || (o.payment_status || '').includes('Split'));
  const deliveredUpiOrders = filteredByDate.filter(o => o.payment_status === 'UPI Done' || (o.payment_status || '').includes('Split'));
  const allDeliveredOrders = filteredByDate.filter(o => o.status === 'Delivered');
  const pendingOrders = filteredByDate.filter(o => o.payment_status === 'Payment Pending');

  if ($('stat-sales-inr')) $('stat-sales-inr').textContent = '₹' + pureSales.toFixed(2);
  if ($('stat-sales-delivery')) $('stat-sales-delivery').textContent = '₹' + totalWithDelivery.toFixed(2);

  // New Delivered (Cash) Box updates
  if ($('stat-delivered-cash')) $('stat-delivered-cash').textContent = deliveredCashOrders.length;
  if ($('stat-delivered-cash-total')) $('stat-delivered-cash-total').textContent = '₹' + cashTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });

  // Renamed Delivered (UPI) Box updates
  if ($('stat-delivered-upi')) $('stat-delivered-upi').textContent = deliveredUpiOrders.length;
  if ($('stat-delivered-upi-total')) $('stat-delivered-upi-total').textContent = '₹' + upiTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });

  // Total Delivered updates
  if ($('stat-delivered')) $('stat-delivered').textContent = allDeliveredOrders.length;
  if ($('stat-delivered-total')) $('stat-delivered-total').textContent = '₹' + (cashTotal + upiTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  // Payment Pending updates
  if ($('stat-payment-pending')) $('stat-payment-pending').textContent = pendingOrders.length;
  if ($('stat-payment-pending-total')) $('stat-payment-pending-total').textContent = '₹' + pendingTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });

  let uniqueAddresses = new Set();
  filteredByDate.filter(o => o.status !== 'Cancelled').forEach(o => { let addr = (o.address || '').trim().toLowerCase(); if (addr) uniqueAddresses.add(addr); });
  if ($('stat-total-orders')) $('stat-total-orders').textContent = uniqueAddresses.size || filteredByDate.filter(o => o.status !== 'Cancelled').length;

  let riderData = {}, totalRiderSales = 0;
  const PER_ORDER_RATE = $('rider-rate-input') ? (parseFloat($('rider-rate-input').value) || 0) : 25;

  filteredByDate.forEach(o => {
    if (o.status === 'Cancelled') return;
    let rawRiderName = (o.rider || '').trim();
    if (!rawRiderName || rawRiderName.toLowerCase() === 'unassigned') return; 
    let isSalary = rawRiderName.toLowerCase().includes('salary');
    let rName = rawRiderName.replace(/\(salary\)/i, '').trim(); 
    let orderTotal = (parseFloat(o.total)||0) + (parseFloat(o.delivery_charge)||0); 
    if (!riderData[rName]) riderData[rName] = { amount: 0, addresses: new Set(), uniqueOrders: new Set(), isSalary: isSalary };
    riderData[rName].amount += orderTotal;
    if (o.order_id) riderData[rName].uniqueOrders.add(o.order_id);
    let addr = (o.address || '').trim().toLowerCase();
    if (addr) riderData[rName].addresses.add(addr);
    totalRiderSales += orderTotal;
  });

  if ($('stat-riders-count')) $('stat-riders-count').textContent = Object.keys(riderData).length;
  if ($('stat-riders-amount')) $('stat-riders-amount').textContent = '₹' + totalRiderSales.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  if ($('rider-breakdown-content')) {
      if (Object.keys(riderData).length === 0) $('rider-breakdown-content').innerHTML = '<div class="text-slate-500 italic mt-1">No active riders yet</div>';
      else {
          let html = '';
          for (let r in riderData) {
              let d = riderData[r];
              let payoutText = d.isSalary ? `<span class="text-xs font-semibold text-blue-400 mt-1">📊 On Salary</span>` : `<span class="text-xs font-bold text-green-400 mt-1">💰 Payout: ₹${d.addresses.size * PER_ORDER_RATE}</span>`;
              html += `<div class="flex justify-between items-start gap-4 mb-3 border-b border-slate-700/50 pb-2 last:border-0 last:pb-0"><div class="flex flex-col flex-1"><span class="font-medium text-slate-300 capitalize">${r}</span><span class="text-[10px] text-slate-500">${d.uniqueOrders.size} Orders | ${d.addresses.size} Addr</span>${payoutText}</div><div class="text-right"><span class="text-[10px] text-slate-500 block mb-0.5">Collected</span><span class="font-bold text-white">₹${d.amount.toFixed(2)}</span></div></div>`;
          }
          $('rider-breakdown-content').innerHTML = html;
      }
  }

  let restData = {}, totalRestPureSales = 0;
  filteredByDate.forEach(o => {
    if (o.status === 'Cancelled') return;
    let restName = (o.customer_name || 'Unknown').trim();
    if (!restName) return;
    let itemTotal = parseFloat(o.total) || 0;
    if (!restData[restName]) restData[restName] = 0;
    restData[restName] += itemTotal;
    totalRestPureSales += itemTotal;
  });

  if ($('stat-rest-count')) $('stat-rest-count').textContent = Object.keys(restData).length;
  if ($('stat-rest-amount')) $('stat-rest-amount').textContent = '₹' + totalRestPureSales.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  if ($('rest-breakdown-content')) {
      if (Object.keys(restData).length === 0) $('rest-breakdown-content').innerHTML = '<div class="text-slate-500 italic mt-1">No orders yet</div>';
      else {
          let html = '';
          for (let r in restData) { html += `<div class="flex justify-between items-center gap-6 mb-2 border-b border-slate-700/50 pb-2 last:border-0 last:pb-0"><span class="font-medium text-slate-300 capitalize">${r}</span><span class="font-bold text-white">₹${restData[r].toFixed(2)}</span></div>`; }
          $('rest-breakdown-content').innerHTML = html;
      }
  }
}

function renderOrders() {
  const tbody = $('orders-body');
  const filtered = allOrders.filter(o => o.date && o.date.slice(0, 10) === currentFilterDate).filter(o => {
    if (currentFilter === 'All') return true;
    if (currentFilter === 'Delivered (Total)') return o.status === 'Delivered';
    if (currentFilter === 'Delivered (Cash)') return o.payment_status === 'Cash' || (o.payment_status||'').includes('Split');
    if (currentFilter === 'Delivered (UPI)') return o.payment_status === 'UPI Done' || (o.payment_status||'').includes('Split');
    if (currentFilter === 'Payment Pending') return o.payment_status === 'Payment Pending' || o.payment_status === 'Pending';
    return false;
  });

  if (filtered.length === 0) {
    if(tbody) tbody.innerHTML = '';
    if($('empty-state')) $('empty-state').classList.remove('hidden');
    return;
  }
  if($('empty-state')) $('empty-state').classList.add('hidden');

  const fragment = document.createDocumentFragment();
  filtered.forEach(order => fragment.appendChild(createRow(order)));
  if(tbody) { tbody.innerHTML = ''; tbody.appendChild(fragment); }
}

function createRow(order) {
  const tr = document.createElement('tr');
  tr.style.cssText = 'border-top:1px solid #1e2030;';
  const isConfirming = pendingDelete === order.__backendId;
  const statusColor = (order.payment_status === 'UPI Done') ? '#3b82f6' : (order.payment_status === 'Payment Pending') ? '#f59e0b' : (order.payment_status === 'Cash') ? '#10b981' : (order.payment_status && order.payment_status.includes('Split')) ? '#a855f7' : '#6b7084';

  tr.innerHTML = `
    <td class="px-4 py-3 font-medium" style="color:#60a5fa;">#${esc(order.order_id)}</td>
    <td class="px-4 py-3 font-bold text-white">${esc(order.customer_name)}</td>
    <td class="px-4 py-3 text-xs"><div style="color:#f0ece4;">${esc(order.address)}</div><div style="color:#9ca3af;">${esc(order.contact)}</div></td>
    <td class="px-4 py-3 text-xs"><div style="color:#f0ece4;">${esc(order.item_name)}</div><div style="color:#9ca3af;">₹${esc(order.unit_price)} × ${esc(order.quantity)}</div></td>
    <td class="px-4 py-3 text-xs" style="color:#9ca3af;">${esc(order.rider)}</td>
    <td class="px-4 py-3 text-right font-bold" style="color:#10b981;">₹${(parseFloat(order.total) + parseFloat(order.delivery_charge || 0)).toFixed(2)}</td>
    <td class="px-4 py-3 text-center">
      <select onchange="changeStatus('${order.__backendId}', this.value)" class="bg-transparent border rounded px-2 py-1 outline-none text-xs font-semibold cursor-pointer" style="border-color:${statusColor}; color:${statusColor};">
        <option value="Payment Pending" ${order.payment_status === 'Payment Pending' ? 'selected' : ''} style="color:#f59e0b; background:#181a24;">Payment Pending</option>
        <option value="Cash" ${order.payment_status === 'Cash' ? 'selected' : ''} style="color:#10b981; background:#181a24;">Delivered (Cash)</option>
        <option value="UPI Done" ${order.payment_status === 'UPI Done' ? 'selected' : ''} style="color:#3b82f6; background:#181a24;">Delivered (UPI)</option>
        ${(order.payment_status || '').includes('Split') ? `<option value="${esc(order.payment_status)}" selected style="color:#a855f7; background:#181a24;">Delivered (Split)</option>` : ''}
      </select>
    </td>
    <td class="px-4 py-3 text-center">
      ${isConfirming ? `<div class="flex items-center justify-center gap-1"><button onclick="confirmDelete('${order.__backendId}')" class="rounded px-2 py-1 text-xs" style="background:#dc2626;color:#fff;">Confirm</button><button onclick="cancelDelete()" class="rounded px-2 py-1 text-xs" style="background:#2a2d3e;color:#6b7084;">Cancel</button></div>` : `<div class="flex items-center justify-center gap-3"><button onclick="openEditModal('${order.__backendId}')" class="rounded hover:bg-blue-500/20 p-1.5" style="color:#60a5fa;">✏️</button><button onclick="requestDelete('${order.__backendId}')" class="rounded hover:bg-red-500/20 p-1.5" style="color:#ef4444;">🗑️</button></div>`}
    </td>
  `;
  return tr;
}

function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }