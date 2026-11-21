/* =========================================================
   customer.js - the page where customers choose their food
   The order is saved in localStorage after a short countdown.
   The cashier page (index.html) reads it and shows it to the cashier.
   (shared data and helpers are in data.js)
   ========================================================= */

// Data kept while the page is open
let cart = [];               // items the customer selected: { name, price, quantity }
let activeCategory = "All";
let searchText = "";

/* ---------- Menu ---------- */

function createButton(text, cssClass, onClick) {
  const button = document.createElement("button");
  button.textContent = text;
  button.className = cssClass;
  button.addEventListener("click", onClick);
  return button;
}

// Fill the "Your table" drop-down with Table 1 ... Table 12
function renderTableSelect() {
  const select = document.getElementById("tableSelect");
  select.innerHTML = '<option value="">Choose your table</option>';
  for (const table of sampleTables) {
    const option = document.createElement("option");
    option.value = table.id;
    option.textContent = "Table " + table.id;
    select.appendChild(option);
  }
}

// Category buttons
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

// Product cards (filtered by category and search text)
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
    card.appendChild(createButton("Add", "btn", () => addToCart(product)));
    grid.appendChild(card);
  }
}

/* ---------- Cart ---------- */

// Add a product. If it is already in the cart, increase its quantity.
function addToCart(product) {
  if (countdownTimer !== null) return; // the cart is locked during the countdown
  const existingItem = cart.find(item => item.name === product.name);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ name: product.name, price: product.price, quantity: 1 });
  }
  document.getElementById("errorText").textContent = "";
  renderCart();
}

// Change quantity by +1 or -1 (0 removes the item)
function changeCartQuantity(itemName, change) {
  if (countdownTimer !== null) return;
  const item = cart.find(cartItem => cartItem.name === itemName);
  item.quantity += change;
  if (item.quantity <= 0) {
    cart = cart.filter(cartItem => cartItem.name !== itemName);
  }
  renderCart();
}

function removeFromCart(itemName) {
  if (countdownTimer !== null) return;
  cart = cart.filter(cartItem => cartItem.name !== itemName);
  renderCart();
}

// Draw the cart on the right side
function renderCart() {
  const container = document.getElementById("cartItems");
  container.innerHTML = "";

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById("cartFab").textContent =
    itemCount === 0 ? "View your order" : "View your order (" + itemCount + ") - " + formatIQD(calculateOrderTotal(cart));

  if (cart.length === 0) {
    container.innerHTML = '<p class="panel-message" style="margin-bottom:14px">Your order is empty. Tap Add on any item.</p>';
    return;
  }

  const list = document.createElement("ul");
  list.className = "order-list";

  for (const item of cart) {
    const line = document.createElement("li");
    line.className = "order-line";

    const top = document.createElement("div");
    top.className = "order-line-top";
    top.innerHTML =
      "<div>" + escapeHtml(item.name) + "<small>" + formatIQD(item.price) + " each</small></div>" +
      "<strong>" + formatIQD(item.price * item.quantity) + "</strong>";

    const bottom = document.createElement("div");
    bottom.className = "order-line-bottom";

    const controls = document.createElement("div");
    controls.className = "qty-controls";
    const quantity = document.createElement("span");
    quantity.className = "qty-number";
    quantity.textContent = item.quantity;
    controls.append(
      createButton("−", "qty-btn", () => changeCartQuantity(item.name, -1)),
      quantity,
      createButton("+", "qty-btn", () => changeCartQuantity(item.name, 1))
    );

    bottom.append(controls, createButton("Remove", "remove-btn", () => removeFromCart(item.name)));
    line.append(top, bottom);
    list.appendChild(line);
  }

  const total = document.createElement("div");
  total.className = "order-total";
  total.innerHTML = "<span>Total</span><span>" + formatIQD(calculateOrderTotal(cart)) + "</span>";

  container.append(list, total);
}

/* ---------- Sending the order (with a countdown) ---------- */

// How long the customer can still cancel before the order is sent (in seconds)
// Change this number to make the countdown shorter or longer
const SEND_DELAY_SECONDS = 10;

let countdownTimer = null;  // the running timer (null = no countdown)
let sendTime = 0;           // the moment (in milliseconds) when the order will be sent
let waitingTableId = 0;     // the table of the order that is waiting

// Show "order" (menu + cart) or "sent" (confirmation message)
function showScreen(screenName) {
  document.getElementById("orderScreen").classList.toggle("hidden", screenName !== "order");
  document.getElementById("confirmation").classList.toggle("hidden", screenName !== "sent");
  document.getElementById("cartFab").classList.toggle("hidden", screenName !== "order");
}

// Switch the cart between "Send button" and "countdown + Cancel button"
function setCountdownMode(isRunning) {
  document.getElementById("orderScreen").classList.toggle("locked", isRunning);
  document.getElementById("sendBox").classList.toggle("hidden", isRunning);
  document.getElementById("countdownBox").classList.toggle("hidden", !isRunning);
  document.getElementById("tableSelect").disabled = isRunning;
}

// Step 1: the customer presses "Send order". We do NOT send it yet.
// We start the countdown instead.
function startSendCountdown() {
  const errorText = document.getElementById("errorText");
  const tableId = Number(document.getElementById("tableSelect").value);

  document.getElementById("noticeText").textContent = "";
  if (!tableId) {
    errorText.textContent = "Please choose your table first.";
    return;
  }
  if (cart.length === 0) {
    errorText.textContent = "Your order is empty. Add at least one item.";
    return;
  }
  errorText.textContent = "";

  waitingTableId = tableId;
  sendTime = Date.now() + SEND_DELAY_SECONDS * 1000;

  setCountdownMode(true);
  updateCountdown();
  countdownTimer = setInterval(updateCountdown, 250);
}

// Runs again and again during the countdown: updates the number, and sends when time is up
function updateCountdown() {
  const millisecondsLeft = sendTime - Date.now();

  if (millisecondsLeft <= 0) {
    finishSending();
    return;
  }

  // The number goes down: 10, 9, 8 ... 1
  const secondsLeft = Math.ceil(millisecondsLeft / 1000);
  document.getElementById("countdownNumber").textContent = secondsLeft;

  const percentLeft = (millisecondsLeft / (SEND_DELAY_SECONDS * 1000)) * 100;
  document.getElementById("countdownFill").style.width = percentLeft + "%";
}

function stopCountdown() {
  clearInterval(countdownTimer);
  countdownTimer = null;
}

// Step 2: the countdown is over. Save the order so the cashier page can see it.
function finishSending() {
  stopCountdown();
  setCountdownMode(false);

  // Read the waiting orders, add the new one, and save the list again
  const pendingOrders = loadFromStorage(PENDING_KEY, []);
  pendingOrders.push({
    id: Date.now(),                       // a simple unique number
    tableId: waitingTableId,
    items: cart,
    total: calculateOrderTotal(cart),
    createdAt: new Date().toISOString()
  });
  saveToStorage(PENDING_KEY, pendingOrders);

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById("confirmationText").textContent =
    "Table " + waitingTableId + " - " + itemCount + " item(s) - " + formatIQD(calculateOrderTotal(cart)) +
    ". The cashier will confirm your order shortly.";

  cart = [];
  renderCart();
  showScreen("sent");
}

// "Cancel": stop the countdown. The order is NOT sent.
// The cart unlocks, so the customer can add or remove items.
// Pressing Send again starts a NEW countdown.
function cancelSending() {
  stopCountdown();
  setCountdownMode(false);
  document.getElementById("noticeText").textContent =
    "Sending was cancelled. Add or remove items, then press Send again.";
}

// "Order more" after the order was sent
function orderMore() {
  document.getElementById("noticeText").textContent = "";
  showScreen("order");
}

/* ---------- Start ---------- */

document.getElementById("sendOrderBtn").addEventListener("click", startSendCountdown);
document.getElementById("cancelSendBtn").addEventListener("click", cancelSending);
document.getElementById("orderMoreBtn").addEventListener("click", orderMore);
document.getElementById("searchInput").addEventListener("input", event => {
  searchText = event.target.value;
  renderProducts();
});

// If the customer tries to close the page during the countdown, the browser warns them
window.addEventListener("beforeunload", event => {
  if (countdownTimer !== null) {
    event.preventDefault();
    event.returnValue = "";
  }
});

// Write the hint under the Send button using the delay number
document.getElementById("sendHint").textContent =
  "After you press Send, you have " + SEND_DELAY_SECONDS + " seconds to cancel.";

renderTableSelect();
renderCategories();
renderProducts();
renderCart();

// When the admin adds or removes a product (in another tab), update the menu here
window.addEventListener("storage", event => {
  if (event.key === PRODUCTS_KEY) {
    products = loadFromStorage(PRODUCTS_KEY, defaultProducts);
    renderProducts();
  }
});
