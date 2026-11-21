/* =========================================================
   Restaurant Cashier - script.js
   Sections:
   1. Data            2. Helper functions   3. Tables dashboard
   4. Table panel     5. Order editing      6. Add-item menu
   7. Payment & receipt  8. Admin (add items, sales history)
   9. Customer orders    10. Start the app
   (shared data and helpers are in data.js)
   ========================================================= */

/* ---------- 1. DATA ---------- */

// Data that is kept while the app is running
let tables = [];
let orderHistory = [];       // completed orders (used in a later step)
let pendingOrders = [];      // orders sent by customers, waiting for the cashier
let selectedTableId = null;  // table open in the side panel
let panelMode = "order";     // "order" = show the order, "menu" = show the products
let activeCategory = "All";
let searchText = "";
let discountPercent = 0;                    // discount typed by the cashier (0 - 100)
let historyDate = toDateKey(new Date());    // the day shown in the sales history

/* ---------- 2. HELPER FUNCTIONS ---------- */

// Save tables and history so a refresh does not delete them
function saveData() {
  saveToStorage(TABLES_KEY, tables);
  saveToStorage(HISTORY_KEY, orderHistory);
}

// Save the customer orders that are waiting for the cashier
function savePendingOrders() {
  saveToStorage(PENDING_KEY, pendingOrders);
}

// Load everything. Uses the sample tables the first time.
function loadData() {
  tables = loadFromStorage(TABLES_KEY, sampleTables);
  orderHistory = loadFromStorage(HISTORY_KEY, []);
  pendingOrders = loadFromStorage(PENDING_KEY, []);
}

function findTable(tableId) {
  return tables.find(table => table.id === tableId);
}

// "occupied" -> "Occupied"
function statusLabel(status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// Turn a date into "2026-11-19" (used to find the orders of one day)
function toDateKey(date) {
  return date.getFullYear() + "-" +
    String(date.getMonth() + 1).padStart(2, "0") + "-" +
    String(date.getDate()).padStart(2, "0");
}

// Show a small message at the bottom of the screen for 1.5 seconds
let toastTimer;
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1500);
}

// Small helper: create a button element
function createButton(text, cssClass, onClick) {
  const button = document.createElement("button");
  button.textContent = text;
  button.className = cssClass;
  button.addEventListener("click", onClick);
  return button;
}

/* ---------- 3. TABLES DASHBOARD ---------- */

// Fill the 4 overview cards
function renderSummary() {
  const occupied = tables.filter(t => t.status === "occupied").length;
  const available = tables.filter(t => t.status === "available").length;
  const reserved = tables.filter(t => t.status === "reserved").length;

  let totalSales = 0;
  for (const order of orderHistory) {
    totalSales += order.total;
  }

  document.getElementById("occupiedCount").textContent = occupied;
  document.getElementById("availableCount").textContent = available;
  document.getElementById("reservedCount").textContent = reserved;
  document.getElementById("totalSales").textContent = formatIQD(totalSales);
}

// Draw one card for every table
function renderTables() {
  const grid = document.getElementById("tablesGrid");
  grid.innerHTML = "";

  for (const table of tables) {
    const card = document.createElement("button");
    card.className = "table-card " + table.status;
    if (table.id === selectedTableId) card.classList.add("selected");

    let totalText = "No order";
    if (table.status === "occupied") {
      totalText = formatIQD(calculateOrderTotal(table.order));
    } else if (table.status === "reserved") {
      totalText = "Waiting for guests";
    }

    card.innerHTML =
      '<span class="table-name">Table ' + table.id + "</span>" +
      '<span class="status-pill ' + table.status + '">' + statusLabel(table.status) + "</span>" +
      '<span class="table-total">' + totalText + "</span>";

    card.addEventListener("click", () => openTablePanel(table.id));
    grid.appendChild(card);
  }
}

// Redraw everything that depends on the table data.
// Call this after ANY change to the data.
function renderAll() {
  renderSummary();
  renderTables();
  renderPendingOrders();
  renderPanel();
  renderMenuList();
  renderHistory();
}

/* ---------- 4. TABLE PANEL ---------- */

function openTablePanel(tableId) {
  selectedTableId = tableId;
  panelMode = "order"; // always start by showing the order
  discountPercent = 0; // every table starts with no discount
  renderPanel();
  document.getElementById("tablePanel").classList.add("open");
  document.getElementById("backdrop").classList.add("open");
  document.getElementById("tablePanel").setAttribute("aria-hidden", "false");
  renderTables(); // highlight the selected card
}

function closeTablePanel() {
  selectedTableId = null;
  panelMode = "order";
  document.getElementById("tablePanel").classList.remove("open");
  document.getElementById("backdrop").classList.remove("open");
  document.getElementById("tablePanel").setAttribute("aria-hidden", "true");
  renderTables();
}

// Fill the panel with the selected table's information
function renderPanel() {
  if (selectedTableId === null) return;
  const table = findTable(selectedTableId);

  document.getElementById("panelTitle").textContent = "Table " + table.id;
  const statusBadge = document.getElementById("panelStatus");
  statusBadge.textContent = statusLabel(table.status);
  statusBadge.className = "status-pill " + table.status;

  // The product menu can only be shown for an occupied table
  if (table.status !== "occupied") panelMode = "order";
  const showMenu = panelMode === "menu";
  document.getElementById("orderView").classList.toggle("hidden", showMenu);
  document.getElementById("menuView").classList.toggle("hidden", !showMenu);

  const actions = document.getElementById("panelActions");
  actions.innerHTML = "";

  // --- Adding items: show the running total and a Back button ---
  if (showMenu) {
    const totalRow = document.createElement("div");
    totalRow.className = "panel-total";
    totalRow.innerHTML = "<span>Order total</span><span>" + formatIQD(calculateOrderTotal(table.order)) + "</span>";
    actions.appendChild(totalRow);
    actions.appendChild(createButton("Done - back to order", "btn", showOrderView));
    return; // the product grid is NOT redrawn here, so the search box keeps its focus
  }

  // --- Showing the order ---
  const orderView = document.getElementById("orderView");
  orderView.innerHTML = "";
  if (table.status === "available") {
    orderView.innerHTML = '<p class="panel-message">This table is free. Open it to start a new order.</p>';
  } else if (table.status === "reserved") {
    orderView.innerHTML = '<p class="panel-message">This table is reserved. Seat the guests when they arrive.</p>';
  } else {
    renderOrderList(table, orderView);
    if (table.order.length > 0) renderPaymentSummary(table, orderView);
  }

  if (table.status === "available") {
    actions.appendChild(createButton("Open table", "btn", () => changeTableStatus(table.id, "occupied")));
    actions.appendChild(createButton("Reserve table", "btn btn-outline", () => changeTableStatus(table.id, "reserved")));
  }
  if (table.status === "reserved") {
    actions.appendChild(createButton("Seat guests", "btn", () => changeTableStatus(table.id, "occupied")));
    actions.appendChild(createButton("Cancel reservation", "btn btn-danger", () => changeTableStatus(table.id, "available")));
  }
  if (table.status === "occupied") {
    const checkoutButton = createButton("Checkout", "btn", () => completeCheckout(table.id));
    checkoutButton.disabled = table.order.length === 0; // nothing to pay yet
    actions.appendChild(checkoutButton);
    actions.appendChild(createButton("Add item", "btn btn-outline", showMenuView));
    actions.appendChild(createButton("Cancel order", "btn btn-danger", () => cancelOrder(table.id)));
  }
}

// Change a table's status. The order is cleared because a new status = a new start.
function changeTableStatus(tableId, newStatus) {
  const table = findTable(tableId);
  table.status = newStatus;
  table.order = [];
  saveData();
  renderAll();
}

// Remove all items and free the table
function cancelOrder(tableId) {
  const confirmed = confirm("Cancel the order for Table " + tableId + "? This cannot be undone.");
  if (!confirmed) return;
  changeTableStatus(tableId, "available");
}

/* ---------- 5. ORDER EDITING ---------- */

// Draw the list of items (with + / - / remove buttons) and the total.
// It is used in the side panel AND in the menu page.
function renderOrderList(table, container) {
  if (table.order.length === 0) {
    container.innerHTML = '<p class="panel-message">No items yet. Click Add item to start the order.</p>';
    return;
  }

  const list = document.createElement("ul");
  list.className = "order-list";

  for (const item of table.order) {
    const line = document.createElement("li");
    line.className = "order-line";

    // Top row: name + price on the left, line total on the right
    const top = document.createElement("div");
    top.className = "order-line-top";
    top.innerHTML =
      "<div>" + escapeHtml(item.name) + "<small>" + formatIQD(item.price) + " each</small></div>" +
      "<strong>" + formatIQD(item.price * item.quantity) + "</strong>";

    // Bottom row: [-] quantity [+]  and  Remove
    const bottom = document.createElement("div");
    bottom.className = "order-line-bottom";

    const controls = document.createElement("div");
    controls.className = "qty-controls";
    const minusButton = createButton("−", "qty-btn", () => changeQuantity(table.id, item.name, -1));
    minusButton.setAttribute("aria-label", "Decrease " + item.name);
    const plusButton = createButton("+", "qty-btn", () => changeQuantity(table.id, item.name, 1));
    plusButton.setAttribute("aria-label", "Increase " + item.name);
    const quantity = document.createElement("span");
    quantity.className = "qty-number";
    quantity.textContent = item.quantity;
    controls.append(minusButton, quantity, plusButton);

    const removeButton = createButton("Remove", "remove-btn", () => removeItem(table.id, item.name));

    bottom.append(controls, removeButton);
    line.append(top, bottom);
    list.appendChild(line);
  }

  const total = document.createElement("div");
  total.className = "order-total";
  total.innerHTML = "<span>Subtotal</span><span>" + formatIQD(calculateOrderTotal(table.order)) + "</span>";

  container.append(list, total);
}

// Add a product to a table's order.
// If the product is already there, increase its quantity instead of adding a new row.
function addProductToOrder(tableId, product) {
  const table = findTable(tableId);
  const existingItem = table.order.find(item => item.name === product.name);

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    table.order.push({ name: product.name, price: product.price, quantity: 1 });
  }

  saveData();
  renderAll();
  showToast("Added " + product.name + " to Table " + tableId);
}

// Change an item's quantity by +1 or -1. At 0 the item is removed.
function changeQuantity(tableId, itemName, change) {
  const table = findTable(tableId);
  const item = table.order.find(orderItem => orderItem.name === itemName);
  item.quantity += change;

  if (item.quantity <= 0) {
    removeItem(tableId, itemName);
    return;
  }
  saveData();
  renderAll();
}

// Remove an item completely
function removeItem(tableId, itemName) {
  const table = findTable(tableId);
  table.order = table.order.filter(item => item.name !== itemName);
  saveData();
  renderAll();
}

/* ---------- 6. ADD-ITEM MENU (inside the panel) ---------- */

// Switch the panel to the product menu
function showMenuView() {
  panelMode = "menu";
  renderProducts();
  renderPanel();
  document.querySelector(".panel-body").scrollTop = 0;
}

// Switch the panel back to the order
function showOrderView() {
  panelMode = "order";
  renderPanel();
}

// Category buttons: All, Burgers, Pizza...
function renderCategories() {
  const bar = document.getElementById("categoryBar");
  bar.innerHTML = "";
  for (const category of categories) {
    const cssClass = category === activeCategory ? "category-btn active" : "category-btn";
    bar.appendChild(createButton(category, cssClass, () => {
      activeCategory = category;
      renderCategories();
      renderProducts();
    }));
  }
}

// Product cards, filtered by category and by the search box
function renderProducts() {
  const grid = document.getElementById("productsGrid");
  grid.innerHTML = "";

  const visibleProducts = products.filter(product => {
    const matchesCategory = activeCategory === "All" || product.category === activeCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchText.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (visibleProducts.length === 0) {
    grid.innerHTML = '<p class="empty-message">No products found. Try another name or category.</p>';
    return;
  }

  for (const product of visibleProducts) {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML =
      '<div class="product-visual">' + escapeHtml(product.visual) + "</div>" +
      '<span class="product-name">' + escapeHtml(product.name) + "</span>" +
      '<span class="product-price">' + formatIQD(product.price) + "</span>";

    // Add the product to the table that is open in the panel
    card.appendChild(createButton("Add to Order", "btn", () => addProductToOrder(selectedTableId, product)));
    grid.appendChild(card);
  }
}

/* ---------- 7. PAYMENT & RECEIPT ---------- */

// Discount in IQD for a given percent (example: 10% of 20000 = 2000)
function calculateDiscount(subtotal, percent) {
  return Math.round(subtotal * percent / 100);
}

// Draw the payment summary under the order list: discount box + final total.
// (The "Subtotal" row is already drawn by renderOrderList.)
function renderPaymentSummary(table, container) {
  const subtotal = calculateOrderTotal(table.order);

  const summary = document.createElement("div");
  summary.className = "payment-summary";
  summary.innerHTML =
    '<div class="discount-row">' +
      '<label for="discountInput">Discount (%)</label>' +
      '<input type="number" id="discountInput" class="search-input discount-input" min="0" max="100" value="' + discountPercent + '">' +
    "</div>" +
    '<div class="discount-amount"><span>Discount amount</span><span id="discountAmount"></span></div>' +
    '<div class="order-total final-total"><span>Final total</span><span id="finalTotal"></span></div>';
  container.appendChild(summary);

  // Update the two numbers (without redrawing the whole panel, so typing is not interrupted)
  function updateNumbers() {
    const discountAmount = calculateDiscount(subtotal, discountPercent);
    document.getElementById("discountAmount").textContent = "- " + formatIQD(discountAmount);
    document.getElementById("finalTotal").textContent = formatIQD(subtotal - discountAmount);
  }

  document.getElementById("discountInput").addEventListener("input", event => {
    const typedNumber = Number(event.target.value) || 0;
    discountPercent = Math.min(100, Math.max(0, typedNumber)); // keep it between 0 and 100
    updateNumbers();
  });
  updateNumbers();
}

// Checkout: save the order in the history, clear the table, show the receipt
function completeCheckout(tableId) {
  const table = findTable(tableId);
  if (table.order.length === 0) return;

  const subtotal = calculateOrderTotal(table.order);
  const discountAmount = calculateDiscount(subtotal, discountPercent);

  // One record = one paid order
  const paidOrder = {
    id: Date.now(),
    tableId: tableId,
    items: table.order.map(item => ({ name: item.name, price: item.price, quantity: item.quantity })),
    subtotal: subtotal,
    discountPercent: discountPercent,
    discountAmount: discountAmount,
    total: subtotal - discountAmount,
    paidAt: new Date().toISOString()
  };
  orderHistory.push(paidOrder);

  // The table is free again
  table.order = [];
  table.status = "available";
  discountPercent = 0;

  saveData();
  closeTablePanel();
  renderAll();
  showReceipt(paidOrder, true);
}

// Show the digital receipt. justPaid = true shows "Payment completed".
function showReceipt(paidOrder, justPaid) {
  const paidAt = new Date(paidOrder.paidAt);
  const dateText = paidAt.toLocaleDateString("en-GB") + " " +
    paidAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  let itemRows = "";
  for (const item of paidOrder.items) {
    itemRows +=
      '<div class="receipt-row"><span>' + item.quantity + " x " + escapeHtml(item.name) + "</span>" +
      "<span>" + formatIQD(item.price * item.quantity) + "</span></div>";
  }

  let discountRow = "";
  if (paidOrder.discountAmount > 0) {
    discountRow =
      '<div class="receipt-row"><span>Discount (' + paidOrder.discountPercent + "%)</span>" +
      "<span>- " + formatIQD(paidOrder.discountAmount) + "</span></div>";
  }

  document.getElementById("receiptContent").innerHTML =
    "<h2>Restaurant Receipt</h2>" +
    (justPaid ? '<div class="receipt-paid">✓ Payment completed</div>' : "") +
    '<div class="receipt-center">Receipt no. ' + String(paidOrder.id).slice(-6) + "<br>" + dateText + "</div>" +
    '<div class="receipt-line"></div>' +
    '<div class="receipt-row"><strong>Table ' + paidOrder.tableId + "</strong><span></span></div>" +
    itemRows +
    '<div class="receipt-line"></div>' +
    '<div class="receipt-row"><span>Subtotal</span><span>' + formatIQD(paidOrder.subtotal) + "</span></div>" +
    discountRow +
    '<div class="receipt-row receipt-total"><span>TOTAL</span><span>' + formatIQD(paidOrder.total) + "</span></div>" +
    '<div class="receipt-line"></div>' +
    '<div class="receipt-center">Thank you for visiting!</div>';

  document.getElementById("receiptModal").classList.remove("hidden");
}

function closeReceipt() {
  document.getElementById("receiptModal").classList.add("hidden");
}

/* ---------- 8. ADMIN (add items + sales history) ---------- */

// Switch between the Tables page and the Admin page
function showView(viewName) {
  closeTablePanel();
  closeReceipt();
  document.getElementById("tablesView").classList.toggle("hidden", viewName !== "tables");
  document.getElementById("adminView").classList.toggle("hidden", viewName !== "admin");
  document.getElementById("navTables").classList.toggle("active", viewName === "tables");
  document.getElementById("navAdmin").classList.toggle("active", viewName === "admin");
  renderAll();
}

// Switch between the two admin tabs: "add" and "history"
function showAdminTab(tabName) {
  document.getElementById("adminAddTab").classList.toggle("hidden", tabName !== "add");
  document.getElementById("adminHistoryTab").classList.toggle("hidden", tabName !== "history");
  document.getElementById("tabAdd").classList.toggle("active", tabName === "add");
  document.getElementById("tabHistory").classList.toggle("active", tabName === "history");
}

// Fill the category drop-down in the "Add item" form
function renderCategoryOptions() {
  const select = document.getElementById("newCategory");
  select.innerHTML = "";
  for (const category of categories) {
    if (category === "All") continue; // "All" is only a filter, not a real category
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  }
}

// The form was submitted: check the values and add the new product to the menu
function addNewProduct(event) {
  event.preventDefault();

  const name = document.getElementById("newName").value.trim();
  const price = Number(document.getElementById("newPrice").value);
  const category = document.getElementById("newCategory").value;
  let visual = document.getElementById("newVisual").value.trim();
  const errorText = document.getElementById("formError");

  if (name === "") {
    errorText.textContent = "Please type the item name.";
    return;
  }
  if (!(price > 0)) {
    errorText.textContent = "Please type a price bigger than 0.";
    return;
  }
  const alreadyExists = products.some(product => product.name.toLowerCase() === name.toLowerCase());
  if (alreadyExists) {
    errorText.textContent = "An item with this name already exists. Use another name.";
    return;
  }

  if (visual === "") visual = categoryEmoji[category]; // default picture

  products.push({ name: name, price: Math.round(price), category: category, visual: visual });
  saveProducts();

  event.target.reset();
  errorText.textContent = "";
  renderMenuList();
  renderProducts();
  showToast("Added " + name + " to the menu");
}

// Remove a product from the menu (old receipts are not changed)
function removeProduct(productName) {
  const confirmed = confirm("Remove " + productName + " from the menu?");
  if (!confirmed) return;

  products = products.filter(product => product.name !== productName);
  saveProducts();
  renderMenuList();
  renderProducts();
}

// The list of all menu items, grouped by category
function renderMenuList() {
  const list = document.getElementById("menuList");
  document.getElementById("menuCount").textContent = products.length;
  list.innerHTML = "";

  for (const category of categories) {
    if (category === "All") continue;
    const productsInCategory = products.filter(product => product.category === category);
    if (productsInCategory.length === 0) continue;

    const heading = document.createElement("h3");
    heading.className = "menu-category";
    heading.textContent = category;
    list.appendChild(heading);

    for (const product of productsInCategory) {
      const row = document.createElement("div");
      row.className = "menu-row";
      row.innerHTML =
        '<span class="menu-row-visual">' + escapeHtml(product.visual) + "</span>" +
        '<span class="menu-row-name">' + escapeHtml(product.name) + "</span>" +
        '<span class="menu-row-price">' + formatIQD(product.price) + "</span>";
      row.appendChild(createButton("Remove", "remove-btn", () => removeProduct(product.name)));
      list.appendChild(row);
    }
  }
}

// Sales history of one day, table by table
function renderHistory() {
  // 1. Keep only the orders paid on the chosen day
  const ordersOfDay = orderHistory.filter(order => toDateKey(new Date(order.paidAt)) === historyDate);

  // 2. Day totals
  let itemsSold = 0;
  let salesOfDay = 0;
  for (const order of ordersOfDay) {
    salesOfDay += order.total;
    for (const item of order.items) itemsSold += item.quantity;
  }
  document.getElementById("historyOrders").textContent = ordersOfDay.length;
  document.getElementById("historyItems").textContent = itemsSold;
  document.getElementById("historySales").textContent = formatIQD(salesOfDay);

  const container = document.getElementById("historyTables");
  container.innerHTML = "";

  if (ordersOfDay.length === 0) {
    container.innerHTML = '<p class="empty-message">No sales on this day. Paid orders will appear here.</p>';
    return;
  }

  // 3. Group the orders by table
  const salesByTable = {}; // example: { 4: { orders: [...], total: 35000, items: { "Cola": {quantity, amount} } } }
  for (const order of ordersOfDay) {
    if (!salesByTable[order.tableId]) {
      salesByTable[order.tableId] = { orders: [], total: 0, items: {} };
    }
    const tableSales = salesByTable[order.tableId];
    tableSales.orders.push(order);
    tableSales.total += order.total;

    for (const item of order.items) {
      if (!tableSales.items[item.name]) {
        tableSales.items[item.name] = { quantity: 0, amount: 0 };
      }
      tableSales.items[item.name].quantity += item.quantity;
      tableSales.items[item.name].amount += item.price * item.quantity;
    }
  }

  // 4. Draw one card per table (Table 1, Table 2, ...)
  const tableIds = Object.keys(salesByTable).map(Number).sort((a, b) => a - b);
  for (const tableId of tableIds) {
    const tableSales = salesByTable[tableId];

    const card = document.createElement("div");
    card.className = "history-card";

    let soldRows = "";
    for (const itemName in tableSales.items) {
      const sold = tableSales.items[itemName];
      soldRows +=
        '<div class="sold-row"><span>' + sold.quantity + " x " + escapeHtml(itemName) + "</span>" +
        "<span>" + formatIQD(sold.amount) + "</span></div>";
    }

    const orderWord = tableSales.orders.length === 1 ? "order" : "orders";
    card.innerHTML =
      '<div class="history-card-header">' +
        "<h3>Table " + tableId + "</h3>" +
        "<span>" + tableSales.orders.length + " " + orderWord + ", <strong>" + formatIQD(tableSales.total) + "</strong></span>" +
      "</div>" +
      '<div class="history-label">What was sold</div>' + soldRows +
      '<div class="history-label">Receipts</div>';

    for (const order of tableSales.orders) {
      const time = new Date(order.paidAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      const receiptRow = document.createElement("div");
      receiptRow.className = "sold-row";
      receiptRow.innerHTML = "<span>" + time + " - " + formatIQD(order.total) + "</span>";
      receiptRow.appendChild(createButton("View receipt", "remove-btn view-receipt-btn", () => showReceipt(order, false)));
      card.appendChild(receiptRow);
    }

    container.appendChild(card);
  }
}

/* ---------- 9. CUSTOMER ORDERS ---------- */

// Show the orders customers sent from customer.html.
// The section is hidden when there is nothing waiting.
function renderPendingOrders() {
  const section = document.getElementById("pendingSection");
  const list = document.getElementById("pendingList");

  section.classList.toggle("hidden", pendingOrders.length === 0);
  document.getElementById("pendingCount").textContent = pendingOrders.length;
  list.innerHTML = "";

  for (const order of pendingOrders) {
    const card = document.createElement("div");
    card.className = "pending-card";

    const time = new Date(order.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    let itemsHtml = "";
    for (const item of order.items) {
      itemsHtml += "<li><span>" + item.quantity + " x " + escapeHtml(item.name) + "</span></li>";
    }

    card.innerHTML =
      '<div class="pending-top"><strong>Table ' + order.tableId + "</strong><small>" + time + "</small></div>" +
      '<ul class="pending-items">' + itemsHtml + "</ul>" +
      '<div class="pending-total"><span>Total</span><strong>' + formatIQD(order.total) + "</strong></div>";

    const actions = document.createElement("div");
    actions.className = "pending-actions";
    actions.appendChild(createButton("Accept", "btn", () => acceptCustomerOrder(order.id)));
    actions.appendChild(createButton("Reject", "btn btn-danger", () => rejectCustomerOrder(order.id)));
    card.appendChild(actions);

    list.appendChild(card);
  }
}

// Accept: put the customer's items into the table's order and mark the table occupied
function acceptCustomerOrder(orderId) {
  pendingOrders = loadFromStorage(PENDING_KEY, []); // get the newest list first
  const order = pendingOrders.find(pendingOrder => pendingOrder.id === orderId);
  if (!order) { renderAll(); return; }

  const table = findTable(order.tableId);
  table.status = "occupied";

  for (const newItem of order.items) {
    const existingItem = table.order.find(item => item.name === newItem.name);
    if (existingItem) {
      existingItem.quantity += newItem.quantity; // same product: increase quantity
    } else {
      table.order.push({ name: newItem.name, price: newItem.price, quantity: newItem.quantity });
    }
  }

  pendingOrders = pendingOrders.filter(pendingOrder => pendingOrder.id !== orderId);
  saveData();
  savePendingOrders();
  renderAll();
  showToast("Order added to Table " + order.tableId);
}

// Reject: just remove the customer order
function rejectCustomerOrder(orderId) {
  const confirmed = confirm("Reject this customer order?");
  if (!confirmed) return;

  pendingOrders = loadFromStorage(PENDING_KEY, []);
  pendingOrders = pendingOrders.filter(pendingOrder => pendingOrder.id !== orderId);
  savePendingOrders();
  renderAll();
}

// When the customer page (another tab) saves something, the browser tells us here.
// We reload the data so new orders appear without refreshing.
window.addEventListener("storage", () => {
  const oldCount = pendingOrders.length;
  loadData();
  if (pendingOrders.length > oldCount) showToast("New customer order!");
  renderAll();
});

/* ---------- 10. START THE APP ---------- */

document.getElementById("closePanelBtn").addEventListener("click", closeTablePanel);
document.getElementById("backdrop").addEventListener("click", closeTablePanel);
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeReceipt();
    closeTablePanel();
  }
});

// Sidebar buttons
document.getElementById("navTables").addEventListener("click", () => showView("tables"));
document.getElementById("navAdmin").addEventListener("click", () => showView("admin"));

// Admin tabs and the "Add item" form
document.getElementById("tabAdd").addEventListener("click", () => showAdminTab("add"));
document.getElementById("tabHistory").addEventListener("click", () => showAdminTab("history"));
document.getElementById("addItemForm").addEventListener("submit", addNewProduct);

// Sales history: choose a day, or go back to today
const historyDateInput = document.getElementById("historyDate");
historyDateInput.value = historyDate;
historyDateInput.addEventListener("change", event => {
  historyDate = event.target.value || toDateKey(new Date());
  renderHistory();
});
document.getElementById("todayBtn").addEventListener("click", () => {
  historyDate = toDateKey(new Date());
  historyDateInput.value = historyDate;
  renderHistory();
});

// Receipt buttons (clicking the dark area around the receipt also closes it)
document.getElementById("closeReceiptBtn").addEventListener("click", closeReceipt);
document.getElementById("printReceiptBtn").addEventListener("click", () => window.print());
document.getElementById("receiptModal").addEventListener("click", event => {
  if (event.target.id === "receiptModal") closeReceipt();
});

// Typing in the search box filters the products
document.getElementById("searchInput").addEventListener("input", event => {
  searchText = event.target.value;
  renderProducts();
});

document.getElementById("todayDate").textContent = new Date().toLocaleDateString("en-GB", {
  weekday: "long", day: "numeric", month: "long", year: "numeric"
});

loadData();
renderCategoryOptions();
renderCategories();
renderProducts();
renderAll();
