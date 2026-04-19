window.toggleModal = function(show) {
  const modal = document.getElementById('form-modal');
  if (show) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  } else {
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
  }
};

window.toggleEditModal = function(show) {
  const modal = document.getElementById('edit-modal');
  if (show) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  } else {
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
  }
};

document.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('form-modal');
  modal.addEventListener('click', function(e) {
    if (e.target === modal) toggleModal(false);
  });
  const editModal = document.getElementById('edit-modal');
  editModal.addEventListener('click', function(e) {
    if (e.target === editModal) toggleEditModal(false);
  });
  document.getElementById('edit-rate')?.addEventListener('input', updateEditTotal);
  document.getElementById('edit-qty')?.addEventListener('input', updateEditTotal);
  document.getElementById('edit-delivery')?.addEventListener('input', updateEditTotal);
});

let premRestCount = 1;

window.toggleSplitFields = function() {
  const mode = document.getElementById('p-payment').value;
  const splitDiv = document.getElementById('split-inputs');
  if (mode === 'Split') splitDiv.classList.remove('hidden');
  else splitDiv.classList.add('hidden');
};

window.toggleEditSplitFields = function() {
  const mode = document.getElementById('edit-payment-status').value;
  const splitDiv = document.getElementById('edit-split-inputs');
  if (mode === 'Split') splitDiv.classList.remove('hidden');
  else splitDiv.classList.add('hidden');
};

window.addPremiumItem = function(restId) {
  const container = document.getElementById(`items-rest-${restId}`);
  const div = document.createElement('div');
  div.className = 'item-row flex gap-2 items-start';
  div.innerHTML = `
    <div class="flex-1"><label class="block text-[10px] text-slate-500 mb-1">Item Name</label><input type="text" name="item_name[]" class="item-name w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="Item Name"></div>
    <div class="w-24"><label class="block text-[10px] text-slate-500 mb-1">Rate (₹)</label><input type="number" name="rate[]" class="item-rate w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="0" min="0" oninput="calcPremiumTotal()"></div>
    <div class="w-20"><label class="block text-[10px] text-slate-500 mb-1">Qty</label><input type="number" name="qty[]" class="item-qty w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="1" value="1" min="1" oninput="calcPremiumTotal()"></div>
    <button type="button" class="mt-5 p-2 text-slate-500 hover:text-red-500 transition-colors" onclick="removePremiumItem(this)">✕</button>
  `;
  container.appendChild(div);
};

window.removePremiumItem = function(btn) {
  btn.parentElement.remove();
  calcPremiumTotal();
};

window.addPremiumRestaurant = function() {
  premRestCount++;
  const wrapper = document.getElementById('restaurants-wrapper');
  const div = document.createElement('div');
  div.className = 'rest-block p-4 rounded-lg border border-slate-700 bg-[#16181f] relative mt-4';
  div.dataset.restId = premRestCount;
  div.innerHTML = `
    <button type="button" class="absolute top-3 right-3 text-slate-500 hover:text-red-500 text-xs font-bold uppercase tracking-wider" onclick="removePremiumRest(this)">Remove</button>
    <div class="mb-4 pr-16"><label class="block text-xs font-medium text-slate-400 mb-1">Restaurant Name *</label><input type="text" name="rest_name[]" class="rest-name w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="Enter restaurant name"></div>
    <div class="items-container space-y-3 mb-3" id="items-rest-${premRestCount}">
      <div class="item-row flex gap-2 items-start">
        <div class="flex-1"><label class="block text-[10px] text-slate-500 mb-1">Item Name</label><input type="text" name="item_name[]" class="item-name w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="Item Name"></div>
        <div class="w-24"><label class="block text-[10px] text-slate-500 mb-1">Rate (₹)</label><input type="number" name="rate[]" class="item-rate w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="0" min="0" oninput="calcPremiumTotal()"></div>
        <div class="w-20"><label class="block text-[10px] text-slate-500 mb-1">Qty</label><input type="number" name="qty[]" class="item-qty w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="1" value="1" min="1" oninput="calcPremiumTotal()"></div>
        <button type="button" class="mt-5 p-2 text-slate-500 hover:text-red-500 transition-colors" onclick="removePremiumItem(this)">✕</button>
      </div>
    </div>
    <button type="button" onclick="addPremiumItem(${premRestCount})" class="text-xs font-semibold hover:opacity-80" style="color: #ff5a36;">+ Add Item</button>
  `;
  wrapper.appendChild(div);
};

window.removePremiumRest = function(btn) {
  btn.parentElement.remove();
  calcPremiumTotal();
};

window.calcPremiumTotal = function() {
  let total = 0;
  document.querySelectorAll('.item-row').forEach(row => {
    const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    total += (rate * qty);
  });
  const delCharge = parseFloat(document.getElementById('p-del-charge').value) || 0;
  const grandTotal = total + delCharge;
  
  document.getElementById('p-subtotal').textContent = '₹' + total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById('p-delivery-display').textContent = '₹' + delCharge.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById('p-grand-total').textContent = '₹' + grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// LOCAL STORAGE DATA FUNCTIONS
function saveLocalData() {
  try {
    localStorage.setItem('dailyDeliveryApp_Data', JSON.stringify(allOrders));
    localStorage.setItem('dailyDeliveryApp_Counter', orderCounter.toString());
  } catch(e) {
    showToast('Storage Error: Data safe nahi ho raha.', 'error');
    console.error(e);
  }
}

function loadLocalData() {
  const savedData = localStorage.getItem('dailyDeliveryApp_Data');
  const savedCounter = localStorage.getItem('dailyDeliveryApp_Counter');
  if (savedData) allOrders = JSON.parse(savedData);
  else allOrders = [];
  if (savedCounter) orderCounter = parseInt(savedCounter);
  else orderCounter = 0;
  updateStats();
  renderOrders();
}

window.handlePremiumFormSubmit = function(event) {
  if (event) event.preventDefault();
  
  const btn = document.getElementById('place-order-btn');
  if(btn) {
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.textContent = 'Saving...';
  }

  try {
    const restBlocks = document.querySelectorAll('.rest-block');
    let allItems = [];
    let itemsTotal = 0;

    restBlocks.forEach(block => {
      const restNameInput = block.querySelector('.rest-name');
      const restName = restNameInput ? restNameInput.value.trim() : '';
      if (restName) {
        const itemRows = block.querySelectorAll('.item-row');
        itemRows.forEach(row => {
          const nameInput = row.querySelector('.item-name');
          const rateInput = row.querySelector('.item-rate');
          const qtyInput = row.querySelector('.item-qty');
          const name = nameInput ? nameInput.value.trim() : '';
          const rate = rateInput ? parseFloat(rateInput.value) || 0 : 0;
          const qty = qtyInput ? parseFloat(qtyInput.value) || 1 : 1;
          if (name && rate > 0) {
            const total = rate * qty;
            itemsTotal += total;
            allItems.push({ name, rate, qty, total, restaurant: restName });
          }
        });
      }
    });

    if (allItems.length === 0) throw new Error("Please add at least one item with name and rate!");

    const paymentMode = document.getElementById('p-payment').value;
    const contact = document.getElementById('p-contact').value.trim();
    const address = document.getElementById('p-address').value.trim();
    const rider = document.getElementById('p-rider').value.trim();
    const deliveryCharge = parseFloat(document.getElementById('p-del-charge').value) || 0;

    if (!paymentMode) throw new Error("Select a Payment Mode!");
    if (!address) throw new Error("Delivery Address is required!");

    let splitCash = null;
    let splitUpi = null;
    let finalPaymentMode = paymentMode;

    if (paymentMode === 'Split') {
      splitCash = parseFloat(document.getElementById('split-cash').value) || 0;
      splitUpi = parseFloat(document.getElementById('split-upi').value) || 0;
      if (splitCash <= 0 && splitUpi <= 0) throw new Error("Enter at least one amount for Split payment!");
      splitCash += deliveryCharge;
      finalPaymentMode = `Split: Cash ₹${splitCash.toFixed(2)} | UPI ₹${splitUpi.toFixed(2)}`;
    }

    const dateInput = document.getElementById('date-filter');
    const orderDate = dateInput && dateInput.value ? dateInput.value : new Date().toISOString().split('T')[0];

    let isFirstItem = true;
    orderCounter++;
    const currentOrderId = String(orderCounter).padStart(3, '0');
    
    for (const item of allItems) {
      let status = "Payment Pending";
      if (paymentMode === "UPI Done" || paymentMode === "Cash" || paymentMode === "Split") {
        status = "Delivered";
      }
      const appliedDeliveryCharge = isFirstItem ? deliveryCharge : 0;
      
      const newOrder = {
        __backendId: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        order_id: currentOrderId,
        customer_name: item.restaurant,
        item_name: item.name,
        quantity: item.qty,
        unit_price: item.rate,
        total: item.total,
        status: status,
        date: new Date(orderDate).toISOString(),
        address: address,
        customer_address: address,
        location: address,
        payment_status: finalPaymentMode,
        contact: contact,
        rider: rider,
        delivery_charge: appliedDeliveryCharge
      };
      allOrders.push(newOrder);
      isFirstItem = false;
    }

    saveLocalData();

    if(btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.textContent = 'Place Order';
    }

    showToast(`✅ Perfect! ${allItems.length} item(s) saved successfully!`);
    document.getElementById('new-premium-order-form').reset();
    document.getElementById('p-grand-total').textContent = '₹0';
    document.getElementById('p-subtotal').textContent = '₹0';
    document.getElementById('p-delivery-display').textContent = '₹0';
    document.getElementById('split-inputs').classList.add('hidden');
    
    const wrapper = document.getElementById('restaurants-wrapper');
    wrapper.innerHTML = `
      <div class="rest-block p-4 rounded-lg border border-slate-700 bg-[#16181f]" data-rest-id="1">
        <div class="mb-4"><label class="block text-xs font-medium text-slate-400 mb-1">Restaurant Name *</label><input type="text" name="rest_name[]" class="rest-name w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="Enter restaurant name"></div>
        <div class="items-container space-y-3 mb-3" id="items-rest-1">
          <div class="item-row flex gap-2 items-start">
            <div class="flex-1"><label class="block text-[10px] text-slate-500 mb-1">Item Name</label><input type="text" name="item_name[]" class="item-name w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="Item Name"></div>
            <div class="w-24"><label class="block text-[10px] text-slate-500 mb-1">Rate (₹)</label><input type="number" name="rate[]" class="item-rate w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="0" min="0" oninput="calcPremiumTotal()"></div>
            <div class="w-20"><label class="block text-[10px] text-slate-500 mb-1">Qty</label><input type="number" name="qty[]" class="item-qty w-full bg-transparent border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-[#ff5a36] outline-none" placeholder="1" value="1" min="1" oninput="calcPremiumTotal()"></div>
            <button type="button" class="mt-5 p-2 text-slate-500 hover:text-red-500 transition-colors" onclick="removePremiumItem(this)">✕</button>
          </div>
        </div>
        <button type="button" onclick="addPremiumItem(1)" class="text-xs font-semibold tracking-wide hover:opacity-80 transition-opacity" style="color: #ff5a36;">+ Add Item</button>
      </div>
    `;
    premRestCount = 1;
    renderOrders();
    updateStats();
    setTimeout(() => toggleModal(false), 500);

  } catch (err) {
    console.error(err);
    showToast('❌ ' + err.message, 'error');
    if(btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.textContent = 'Place Order';
    }
  }
};

let allOrders = [];
let currentFilter = 'All';
let currentFilterDate = new Date().toISOString().slice(0, 10);
let orderCounter = 0;
let pendingDelete = null;

const defaultConfig = { app_title: 'Daily Delivery Sales', background_color: '#0f1117' };

const $ = id => document.getElementById(id);
const today = new Date();
$('date-filter').valueAsDate = today;

function showToast(msg, type='success') {
  const t = document.createElement('div');
  t.className = 'toast rounded-lg px-4 py-2 text-sm font-medium shadow-lg z-[9999]';
  t.style.cssText = type === 'error' ? 'background:#dc2626;color:#fff;' : 'background:#16a34a;color:#fff;';
  t.textContent = msg;
  const container = document.getElementById('toast-container');
  if(container) {
    container.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  } else {
    alert(msg);
  }
}

function filterByDate() {
  currentFilterDate = $('date-filter').value;
  renderOrders();
  updateStats();
}

function updateStats() {
  const filteredByDate = allOrders.filter(o => o.date && o.date.slice(0, 10) === currentFilterDate);
  let upiTotal = 0, cashTotal = 0, pendingTotal = 0, pureSales = 0, totalWithDelivery = 0;
  let upiItemsTotal = 0, upiDeliveryTotal = 0, cashItemsTotal = 0, cashDeliveryTotal = 0, pendingItemsTotal = 0, pendingDeliveryTotal = 0, deliveredItemsTotal = 0, deliveredDeliveryTotal = 0, deliveredTotal = 0;

  filteredByDate.forEach(o => {
    if (o.status === 'Cancelled') return;
    const itemTotal = parseFloat(o.total) || 0;
    const delCharge = parseFloat(o.delivery_charge) || 0;
    const status = o.payment_status || "";
    const orderTotalWithDel = itemTotal + delCharge;

    pureSales += itemTotal;
    totalWithDelivery += orderTotalWithDel;

    if (o.status === 'Delivered') { deliveredTotal += orderTotalWithDel; deliveredItemsTotal += itemTotal; deliveredDeliveryTotal += delCharge; }
    if (status === 'UPI Done') { upiTotal += orderTotalWithDel; upiItemsTotal += itemTotal; upiDeliveryTotal += delCharge; }
    else if (status === 'Cash') { cashTotal += orderTotalWithDel; cashItemsTotal += itemTotal; cashDeliveryTotal += delCharge; }
    else if (status === 'Payment Pending') { pendingTotal += orderTotalWithDel; pendingItemsTotal += itemTotal; pendingDeliveryTotal += delCharge; }
    else if (status.includes('Split')) {
      const cashMatch = status.match(/Cash ₹([\d.]+)/);
      const upiMatch = status.match(/UPI ₹([\d.]+)/);
      let splitCash = cashMatch ? parseFloat(cashMatch[1]) : 0;
      let splitUpi = upiMatch ? parseFloat(upiMatch[1]) : 0;
      cashTotal += splitCash; upiTotal += splitUpi;
      let cashDelCharge = Math.min(splitCash, delCharge);
      let upiDelCharge = delCharge - cashDelCharge;
      cashDeliveryTotal += cashDelCharge; cashItemsTotal += (splitCash - cashDelCharge);
      upiDeliveryTotal += upiDelCharge; upiItemsTotal += (splitUpi - upiDelCharge);
    }
  });

  if ($('breakdown-upi')) $('breakdown-upi').textContent = '₹' + upiTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if ($('breakdown-cash')) $('breakdown-cash').textContent = '₹' + cashTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if ($('breakdown-pending')) $('breakdown-pending').textContent = '₹' + pendingTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if ($('upi-items-total')) $('upi-items-total').textContent = '₹' + upiItemsTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  if ($('upi-delivery-total')) $('upi-delivery-total').textContent = '₹' + upiDeliveryTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  if ($('upi-grand-total')) $('upi-grand-total').textContent = '₹' + upiTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });

  if ($('cash-items-total')) $('cash-items-total').textContent = '₹' + cashItemsTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  if ($('cash-delivery-total')) $('cash-delivery-total').textContent = '₹' + cashDeliveryTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  if ($('cash-grand-total')) $('cash-grand-total').textContent = '₹' + cashTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });

  if ($('pending-items-total')) $('pending-items-total').textContent = '₹' + pendingItemsTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  if ($('pending-delivery-total')) $('pending-delivery-total').textContent = '₹' + pendingDeliveryTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  if ($('pending-grand-total')) $('pending-grand-total').textContent = '₹' + pendingTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });

  if ($('stat-sales-inr')) $('stat-sales-inr').textContent = '₹' + pureSales.toFixed(2);
  if ($('stat-sales-delivery')) $('stat-sales-delivery').textContent = '₹' + totalWithDelivery.toFixed(2);

  const active = filteredByDate.filter(o => o.status !== 'Cancelled');
  let deliveredSales = 0, pendingSales = 0, upiSales = 0;
  
  const deliveredOrders = filteredByDate.filter(o => o.status === 'Delivered');
  deliveredOrders.forEach(o => deliveredSales += ((parseFloat(o.total)||0) + (parseFloat(o.delivery_charge)||0)));
  
  const pendingOrders = filteredByDate.filter(o => o.payment_status === 'Payment Pending');
  pendingOrders.forEach(o => pendingSales += ((parseFloat(o.total)||0) + (parseFloat(o.delivery_charge)||0)));
  
  const upiOrders = filteredByDate.filter(o => o.payment_status === 'UPI Done');
  upiOrders.forEach(o => upiSales += ((parseFloat(o.total)||0) + (parseFloat(o.delivery_charge)||0)));

  let uniqueAddresses = new Set();
  active.forEach(o => { let addr = (o.address || '').trim().toLowerCase(); if (addr) uniqueAddresses.add(addr); });

  if ($('stat-total-orders')) $('stat-total-orders').textContent = uniqueAddresses.size || active.length;
  if ($('stat-delivered')) $('stat-delivered').textContent = deliveredOrders.length;
  if ($('stat-delivered-total')) $('stat-delivered-total').textContent = '₹' + deliveredSales.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  if ($('stat-payment-pending')) $('stat-payment-pending').textContent = pendingOrders.length;
  if ($('stat-payment-pending-total')) $('stat-payment-pending-total').textContent = '₹' + pendingSales.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  if ($('stat-upi-done')) $('stat-upi-done').textContent = upiOrders.length;
  if ($('stat-upi-done-total')) $('stat-upi-done-total').textContent = '₹' + upiSales.toLocaleString('en-IN', { minimumFractionDigits: 2 });

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
    if (currentFilter === 'Delivered') return o.status === 'Delivered';
    if (currentFilter === 'Payment Pending') return o.payment_status === 'Payment Pending' || o.payment_status === 'Pending';
    if (currentFilter === 'UPI Done') return o.payment_status === 'UPI Done';
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
  const statusColor = (order.payment_status === 'UPI Done') ? '#3b82f6' : (order.payment_status === 'Payment Pending') ? '#f59e0b' : (order.payment_status === 'Cash') ? '#22c55e' : (order.payment_status && order.payment_status.includes('Split')) ? '#a855f7' : '#6b7084';

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
        <option value="Cash" ${order.payment_status === 'Cash' ? 'selected' : ''} style="color:#22c55e; background:#181a24;">Delivered (Cash)</option>
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

window.changeStatus = function(backendId, newPaymentStatus) {
  const orderIndex = allOrders.findIndex(o => o.__backendId === backendId);
  if (orderIndex === -1) return;
  
  let order = allOrders[orderIndex];
  let oldStatus = order.payment_status;

  // SAFETY LOCK: Agar already UPI ya Split tha, aur user galti se 'Cash' ("Delivered (Cash)") daba de,
  // toh hum UPI ka paisa kam nahi hone denge!
  if (newPaymentStatus === 'Cash' && (oldStatus === 'UPI Done' || oldStatus.includes('Split'))) {
      order.status = 'Delivered';
      saveLocalData(); 
      showToast('✅ UPI Amount Protected! (Status Delivered)'); 
      updateStats(); 
      renderOrders();
      return; // Yahan se aage code nahi jayega, taaki paisa na kate
  }
  
  order.payment_status = newPaymentStatus;
  if (newPaymentStatus === 'UPI Done' || newPaymentStatus === 'Cash') order.status = 'Delivered';
  else if (newPaymentStatus === 'Payment Pending') order.status = 'Payment Pending';
  
  saveLocalData(); 
  showToast('Status updated'); 
  updateStats(); 
  renderOrders();
};

window.requestDelete = function(backendId) { pendingDelete = backendId; renderOrders(); };
window.cancelDelete = function() { pendingDelete = null; renderOrders(); };
window.confirmDelete = function(backendId) {
  const orderIndex = allOrders.findIndex(o => o.__backendId === backendId);
  if (orderIndex !== -1) { allOrders.splice(orderIndex, 1); saveLocalData(); }
  pendingDelete = null; showToast('Order deleted'); updateStats(); renderOrders();
};

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

window.handleEditSubmit = function(event) {
  if (event) event.preventDefault();
  if (!editingOrderId) return;
  const orderIndex = allOrders.findIndex(o => o.__backendId === editingOrderId);
  if (orderIndex === -1) return;
  const btn = $('edit-save-btn');
  if(btn) { btn.disabled = true; btn.style.opacity = '0.5'; btn.textContent = 'Saving...'; }
  try {
    let order = allOrders[orderIndex];
    order.customer_name = $('edit-restaurant').value.trim(); order.item_name = $('edit-item-name').value.trim(); order.unit_price = parseFloat($('edit-rate').value) || 0; order.quantity = parseFloat($('edit-qty').value) || 1; order.total = order.unit_price * order.quantity; order.delivery_charge = parseFloat($('edit-delivery').value) || 0; order.rider = $('edit-rider').value.trim(); order.contact = $('edit-contact').value.trim(); order.address = $('edit-address').value.trim(); order.customer_address = order.address; order.location = order.address;
    let editMode = $('edit-payment-status').value;
    if (editMode === 'Split') {
        let splitCash = (parseFloat($('edit-split-cash').value) || 0) + order.delivery_charge;
        let splitUpi = parseFloat($('edit-split-upi').value) || 0;
        order.payment_status = `Split: Cash ₹${splitCash.toFixed(2)} | UPI ₹${splitUpi.toFixed(2)}`;
    } else order.payment_status = editMode;
    saveLocalData(); showToast('✅ Order updated successfully!'); renderOrders(); updateStats(); toggleEditModal(false);
  } catch (err) { showToast('❌ ' + err.message, 'error'); } 
  finally { if(btn) { btn.disabled = false; btn.style.opacity = '1'; btn.textContent = 'Save Changes'; } }
};

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentFilter = btn.dataset.filter;
    document.querySelectorAll('.filter-btn').forEach(b => { b.style.background = '#2a2d3e'; b.style.color = '#6b7084'; });
    btn.style.background = defaultConfig.primary_action_color; btn.style.color = '#fff'; renderOrders();
  });
});

$('app-title').textContent = defaultConfig.app_title;
$('app').style.background = defaultConfig.background_color;
loadLocalData();
if (typeof lucide !== 'undefined') lucide.createIcons();