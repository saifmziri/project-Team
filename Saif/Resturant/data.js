/* =========================================================
   data.js - data shared by the cashier page (index.html)
   and the customer page (customer.html).
   Both pages talk to each other through localStorage.
   ========================================================= */

const TABLES_KEY = "restaurantTables";
const HISTORY_KEY = "restaurantOrderHistory";
// Orders sent by customers that the cashier has not accepted yet
const PENDING_KEY = "restaurantPendingOrders";
// The menu (the admin can add and remove products)
const PRODUCTS_KEY = "restaurantProducts";

// The 12 sample tables. status: "available", "occupied" or "reserved"
// order is a list of items: { name, price, quantity }
const sampleTables = [
  { id: 1,  status: "available", order: [] },
  { id: 2,  status: "occupied",  order: [
      { name: "Classic Burger", price: 6000, quantity: 2 },
      { name: "Cola",           price: 1000, quantity: 2 } ] },
  { id: 3,  status: "available", order: [] },
  { id: 4,  status: "available", order: [] },
  { id: 5,  status: "occupied",  order: [
      { name: "Margherita Pizza", price: 9000, quantity: 1 },
      { name: "Orange Juice",     price: 2000, quantity: 1 } ] },
  { id: 6,  status: "available", order: [] },
  { id: 7,  status: "reserved",  order: [] },
  { id: 8,  status: "available", order: [] },
  { id: 9,  status: "occupied",  order: [
      { name: "Chicken Sandwich", price: 5000, quantity: 3 },
      { name: "Chocolate Cake",   price: 3500, quantity: 1 } ] },
  { id: 10, status: "available", order: [] },
  { id: 11, status: "reserved",  order: [] },
  { id: 12, status: "available", order: [] }
];

// The menu. "visual" is an emoji used instead of a photo.
// Every product name must be unique (we use the name to find items in an order).
const defaultProducts = [
  { name: "Classic Burger",   price: 6000,  category: "Burgers",    visual: "🍔" },
  { name: "Cheeseburger",     price: 7000,  category: "Burgers",    visual: "🧀" },
  { name: "Chicken Burger",   price: 6500,  category: "Burgers",    visual: "🍗" },
  { name: "Double Burger",    price: 9500,  category: "Burgers",    visual: "🍔" },

  { name: "Margherita Pizza", price: 9000,  category: "Pizza",      visual: "🍕" },
  { name: "Pepperoni Pizza",  price: 11000, category: "Pizza",      visual: "🍕" },
  { name: "Veggie Pizza",     price: 10000, category: "Pizza",      visual: "🥦" },
  { name: "Chicken Pizza",    price: 11500, category: "Pizza",      visual: "🍕" },

  { name: "Chicken Sandwich", price: 5000,  category: "Sandwiches", visual: "🥪" },
  { name: "Club Sandwich",    price: 6000,  category: "Sandwiches", visual: "🥪" },
  { name: "Falafel Wrap",     price: 3500,  category: "Sandwiches", visual: "🌯" },
  { name: "Shawarma",         price: 4000,  category: "Sandwiches", visual: "🌯" },

  { name: "Cola",             price: 1000,  category: "Drinks",     visual: "🥤" },
  { name: "Orange Juice",     price: 2000,  category: "Drinks",     visual: "🧃" },
  { name: "Water",            price: 500,   category: "Drinks",     visual: "💧" },
  { name: "Tea",              price: 750,   category: "Drinks",     visual: "🍵" },
  { name: "Coffee",           price: 2000,  category: "Drinks",     visual: "☕" },

  { name: "Chocolate Cake",   price: 3500,  category: "Desserts",   visual: "🍰" },
  { name: "Cheesecake",       price: 4000,  category: "Desserts",   visual: "🍰" },
  { name: "Ice Cream",        price: 2500,  category: "Desserts",   visual: "🍨" },
  { name: "Baklava",          price: 3000,  category: "Desserts",   visual: "🥮" }
];

const categories = ["All", "Burgers", "Pizza", "Sandwiches", "Drinks", "Desserts"];

// Picture used for a new product when the admin does not type one
const categoryEmoji = {
  Burgers: "🍔", Pizza: "🍕", Sandwiches: "🥪", Drinks: "🥤", Desserts: "🍰"
};

// The menu that both pages use. It is saved in localStorage,
// so products added by the admin stay after a refresh.
let products = loadFromStorage(PRODUCTS_KEY, defaultProducts);

function saveProducts() {
  saveToStorage(PRODUCTS_KEY, products);
}

// Makes text safe to put inside HTML (so a product name can never break the page)
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Turn 15000 into "15,000 IQD"
function formatIQD(amount) {
  return amount.toLocaleString("en-US") + " IQD";
}

// Add up price x quantity for every item in a list of items
function calculateOrderTotal(items) {
  let total = 0;
  for (const item of items) {
    total += item.price * item.quantity;
  }
  return total;
}

// Read something from localStorage (or use the fallback if nothing is saved yet)
function loadFromStorage(key, fallback) {
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : fallback;
}

// Save something to localStorage
function saveToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
