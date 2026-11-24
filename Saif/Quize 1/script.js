
let medicines = [
  {id:1, name:"Paracetamol 500mg", price:3.5, stock:120},
  {id:2, name:"Ibuprofen 400mg", price:4.2, stock:65},
  {id:3, name:"Amoxicillin 500mg", price:8.5, stock:9},
  {id:4, name:"Vitamin C 1000mg", price:6, stock:80},
  {id:5, name:"Cetirizine 10mg", price:5.5, stock:6},
  {id:6, name:"Omeprazole 20mg", price:7.25, stock:42},
  {id:7, name:"Azithromycin 250mg", price:9, stock:24},
  {id:8, name:"Vitamin D3", price:7.5, stock:3}
];

let cart = [];
let sales = 0;
let transactions = 0;

const money = n => "$" + n.toFixed(2);

function renderMedicines(filter = "") {
  let list = medicines.filter(m =>
    m.name.toLowerCase().includes(filter.toLowerCase())
  );

  document.getElementById("medicineList").innerHTML =
    list.map(m => `
      <div class="medicine">
        <h3>${m.name}</h3>
        <p>Price: ${money(m.price)}</p>
        <p>Stock: ${m.stock}</p>
        <button
          onclick="addToCart(${m.id})"
          ${m.stock === 0 ? "disabled" : ""}
        >
          Add to Bill
        </button>
      </div>
    `).join("");

  updateDashboard();
}

function addToCart(id) {
  let medicine = medicines.find(m => m.id === id);

  if (!medicine || medicine.stock <=
      cart.filter(c => c.id === id).length) {
    alert("Insufficient stock!");
    return;
  }

  let item = cart.find(c => c.id === id);

  if (item) {
    item.quantity++;
  } else {
    cart.push({...medicine, quantity:1});
  }

  renderCart();
}

function renderCart() {
  let cartElement = document.getElementById("cart");

  if (cart.length === 0) {
    cartElement.innerHTML =
      '<p class="empty">No medicines added.</p>';
  } else {
    cartElement.innerHTML = cart.map(item => `
      <div class="cart-item">
        <div>
          <strong>${item.name}</strong>
          <p>${money(item.price)} × ${item.quantity}</p>
        </div>

        <div>
          <button onclick="changeQty(${item.id}, -1)">−</button>
          <button onclick="changeQty(${item.id}, 1)">+</button>
          <button onclick="removeItem(${item.id})">✕</button>
        </div>
      </div>
    `).join("");
  }

  calculateBill();
}

function changeQty(id, amount) {
  let item = cart.find(c => c.id === id);
  let medicine = medicines.find(m => m.id === id);

  if (!item) return;

  if (amount > 0 && item.quantity >= medicine.stock) {
    alert("Not enough stock!");
    return;
  }

  item.quantity += amount;

  if (item.quantity <= 0) {
    removeItem(id);
    return;
  }

  renderCart();
}

function removeItem(id) {
  cart = cart.filter(c => c.id !== id);
  renderCart();
}

function calculateBill() {
  let subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity, 0
  );

  let discount = Math.min(
    100,
    Math.max(0, Number(document.getElementById("discount").value) || 0)
  );

  document.getElementById("discount").value = discount;

  let total = subtotal * (1 - discount / 100);

  document.getElementById("subtotal").textContent = money(subtotal);
  document.getElementById("total").textContent = money(total);

  return {subtotal, total};
}

function checkout() {
  if (cart.length === 0) {
    alert("Please add medicines first!");
    return;
  }

  let customer = document.getElementById("customer").value || "Walk-in Customer";

  let {total} = calculateBill();

  let receipt = cart.map(item =>
    `${item.name} x ${item.quantity}`
  ).join("\n");

  if (!confirm(
    `Customer: ${customer}\n\n${receipt}\n\nTotal: ${money(total)}\n\nConfirm sale?`
  )) return;

  // Check all quantities before changing stock
  for (let item of cart) {
    let medicine = medicines.find(m => m.id === item.id);
    if (item.quantity > medicine.stock) {
      alert("Insufficient stock for " + item.name);
      return;
    }
  }

  cart.forEach(item => {
    let medicine = medicines.find(m => m.id === item.id);
    medicine.stock -= item.quantity;
  });

  sales += total;
  transactions++;

  alert("Sale completed successfully!\nTotal: " + money(total));

  cart = [];
  document.getElementById("customer").value = "";
  document.getElementById("discount").value = 0;

  renderCart();
  renderMedicines();
  updateDashboard();
  updateAlerts();
}

function clearCart() {
  cart = [];
  renderCart();
}

function updateDashboard() {
  document.getElementById("sales").textContent = money(sales);

  document.getElementById("transactions").textContent =
    transactions;

  document.getElementById("medicineCount").textContent =
    medicines.length;

  document.getElementById("lowStock").textContent =
    medicines.filter(m => m.stock <= 10).length;
}

function updateAlerts() {
  let lowStock = medicines.filter(m => m.stock <= 10);

  document.getElementById("stockAlerts").innerHTML =
    lowStock.map(m => `
      <div class="alert">
        ⚠ ${m.name} — Only ${m.stock} units remaining!
      </div>
    `).join("") || "All stock levels are healthy.";
}

document.getElementById("search").addEventListener(
  "input", e => renderMedicines(e.target.value)
);

document.getElementById("discount").addEventListener(
  "input", calculateBill
);

renderMedicines();
renderCart();
updateAlerts();
