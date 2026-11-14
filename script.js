/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const productInfoDialog = document.getElementById("productInfoDialog");
const productInfoTitle = document.getElementById("productInfoTitle");
const productInfoDescription = document.getElementById(
  "productInfoDescription",
);
const closeProductInfoButton = document.getElementById("closeProductInfo");
const selectedProductsList = document.getElementById("selectedProductsList");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendBtn");
const generateRoutineButton = document.getElementById("generateRoutine");
const clearProductsButton = document.getElementById("clearSelectedProducts");
const workerURL = "https://openailorealproject.charismamarlow.workers.dev/";
const selectedProductsStorageKey = "lorealRoutineBuilderSelectedProducts";

/* Keep selected products available while users browse different categories */
let selectedProducts = [];
let displayedProducts = [];
let productCatalog = [];
let productsPromise = null;
let messages = [
  {
    role: "system",
    content:
      "You are a friendly, polite L'Oréal beauty advisor. Use the full conversation history to understand follow-up questions and remember the user's earlier requests and preferences. Give concise but detailed, clear, and practical answers when creating routines and answering follow-up questions. Format answers for readability with short paragraphs, blank lines between sections, and numbered steps or bullets when helpful. Do not use too many hashtags or *. Use emojis to highlight headers of sections. If a question is unrelated to L'Oréal products or routines using them, politely refuse and explain that you can only help with L'Oréal products and routines, then invite the user to ask a related question.",
  },
];

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

selectedProductsList.innerHTML = "<p>No products selected yet.</p>";

/* Bold product names in chat without inserting message content as HTML */
function displayChatMessage(speaker, content) {
  const messageElement = document.createElement("p");
  messageElement.className = "chat-message";

  const speakerLabel = document.createElement("strong");
  speakerLabel.textContent = `${speaker}: `;
  messageElement.appendChild(speakerLabel);

  const productNames = [
    ...new Set(
      [...productCatalog, ...displayedProducts, ...selectedProducts]
        .map((product) => product.name)
        .filter(Boolean),
    ),
  ].sort((firstName, secondName) => secondName.length - firstName.length);

  if (productNames.length === 0) {
    messageElement.appendChild(document.createTextNode(content));
  } else {
    const productNamesPattern = new RegExp(
      `(${productNames
        .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|")})`,
      "gi",
    );
    const knownProductNames = new Set(
      productNames.map((name) => name.toLowerCase()),
    );

    content.split(productNamesPattern).forEach((part) => {
      if (knownProductNames.has(part.toLowerCase())) {
        const productName = document.createElement("strong");
        productName.textContent = part;
        messageElement.appendChild(productName);
      } else {
        messageElement.appendChild(document.createTextNode(part));
      }
    });
  }

  chatWindow.appendChild(messageElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Restore selected products saved in this browser */
function loadSelectedProducts() {
  try {
    const savedProducts = localStorage.getItem(selectedProductsStorageKey);
    const products = savedProducts ? JSON.parse(savedProducts) : [];
    const productsAreValid =
      Array.isArray(products) &&
      products.every(
        (product) =>
          product &&
          Number.isInteger(product.id) &&
          typeof product.name === "string" &&
          typeof product.brand === "string" &&
          typeof product.description === "string",
      );

    if (!productsAreValid) {
      throw new Error("Saved product data is not in the expected format.");
    }

    return products;
  } catch (error) {
    displayChatMessage("Error", `Could not load saved products. ${error.message}`);
    return [];
  }
}

/* Save selected products so they remain selected after a page reload */
function saveSelectedProducts() {
  try {
    localStorage.setItem(
      selectedProductsStorageKey,
      JSON.stringify(selectedProducts),
    );
  } catch (error) {
    displayChatMessage(
      "Error",
      `Could not save your selected products. ${error.message}`,
    );
  }
}

selectedProducts = loadSelectedProducts();
displaySelectedProducts();

/* Send the full conversation to the class Worker and show its response */
async function sendMessage(content) {
  messages.push({ role: "user", content });
  displayChatMessage("You", content);
  sendButton.disabled = true;
  generateRoutineButton.disabled = true;

  try {
    const response = await fetch(workerURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      throw new Error(`The Worker returned an error (${response.status}).`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;

    if (typeof reply !== "string" || reply.trim() === "") {
      throw new Error("The Worker response did not include a reply.");
    }

    messages.push({ role: "assistant", content: reply });
    displayChatMessage("Advisor", reply);
  } catch (error) {
    messages.pop();
    displayChatMessage("Error", `Could not get a response. ${error.message}`);
  } finally {
    sendButton.disabled = false;
    generateRoutineButton.disabled = false;
  }
}

/* Load product data from JSON file */
async function loadProducts() {
  if (!productsPromise) {
    productsPromise = (async () => {
      const response = await fetch("products.json");

      if (!response.ok) {
        throw new Error(`Could not load products (${response.status}).`);
      }

      const data = await response.json();
      productCatalog = data.products;
      return productCatalog;
    })().catch((error) => {
      productsPromise = null;
      throw error;
    });
  }

  return productsPromise;
}

/* Update the selected-products section */
function displaySelectedProducts() {
  clearProductsButton.disabled = selectedProducts.length === 0;

  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = "<p>No products selected yet.</p>";
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
        <div class="selected-product">
          <span>${product.name}</span>
          <button
            type="button"
            class="remove-product"
            data-product-id="${product.id}"
            aria-label="Remove ${product.name}"
          >
            Remove
          </button>
        </div>
      `,
    )
    .join("");
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  displayedProducts = products;
  productsContainer.innerHTML = products
    .map((product) => {
      const isSelected = selectedProducts.some(
        (selectedProduct) => selectedProduct.id === product.id,
      );

      return `
    <div class="product-card${isSelected ? " selected" : ""}">
      <button
        type="button"
        class="product-select"
        data-product-id="${product.id}"
        aria-pressed="${isSelected}"
      >
        <img src="${product.image}" alt="">
        <span class="product-info">
          <span class="product-name">${product.name}</span>
          <span class="product-brand">${product.brand}</span>
        </span>
      </button>
      <button
        type="button"
        class="product-info-button"
        data-product-id="${product.id}"
        aria-label="View details for ${product.name}"
        title="View product details"
      >
        <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
      </button>
      </div>
  `;
    })
    .join("");
}

/* Show a product description in the accessible modal dialog */
function showProductInfo(productId) {
  const product = displayedProducts.find(
    (displayedProduct) => displayedProduct.id === productId,
  );

  if (!product) {
    return;
  }

  productInfoTitle.textContent = product.name;
  productInfoDescription.textContent =
    product.description || "No description is available for this product.";
  productInfoDialog.showModal();
}

/* Add or remove a product when its card is clicked */
function toggleProduct(productId) {
  const selectedProductIndex = selectedProducts.findIndex(
    (product) => product.id === productId,
  );

  if (selectedProductIndex === -1) {
    const product = displayedProducts.find(
      (displayedProduct) => displayedProduct.id === productId,
    );

    if (product) {
      selectedProducts.push(product);
    }
  } else {
    selectedProducts.splice(selectedProductIndex, 1);
  }

  saveSelectedProducts();
  displaySelectedProducts();
  displayProducts(displayedProducts);
}

/* Let users select and unselect products with a click */
productsContainer.addEventListener("click", (e) => {
  const infoButton = e.target.closest(".product-info-button");

  if (infoButton) {
    showProductInfo(Number(infoButton.dataset.productId));
    return;
  }

  const selectButton = e.target.closest(".product-select");

  if (selectButton) {
    toggleProduct(Number(selectButton.dataset.productId));
  }
});

closeProductInfoButton.addEventListener("click", () => {
  productInfoDialog.close();
});

productInfoDialog.addEventListener("click", (e) => {
  if (e.target === productInfoDialog) {
    productInfoDialog.close();
  }
});

/* Remove a product directly from the selected-products section */
selectedProductsList.addEventListener("click", (e) => {
  if (e.target.matches(".remove-product")) {
    const productId = Number(e.target.dataset.productId);
    selectedProducts = selectedProducts.filter(
      (product) => product.id !== productId,
    );

    saveSelectedProducts();
    displaySelectedProducts();
    displayProducts(displayedProducts);
  }
});

/* Clear the list and save the empty selection */
clearProductsButton.addEventListener("click", () => {
  selectedProducts = [];
  saveSelectedProducts();
  displaySelectedProducts();
  displayProducts(displayedProducts);
});

/* Filter products by both the selected category and search keywords */
async function filterProducts() {
  const selectedCategory = categoryFilter.value;
  const searchTerm = productSearch.value.trim().toLowerCase();

  if (!selectedCategory && !searchTerm) {
    displayedProducts = [];
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        Select a category or search for products
      </div>
    `;
    return;
  }

  const products = await loadProducts();
  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      !selectedCategory || product.category === selectedCategory;
    const searchableText =
      `${product.name} ${product.brand} ${product.category} ${product.description}`.toLowerCase();

    return matchesCategory && searchableText.includes(searchTerm);
  });

  if (filteredProducts.length === 0) {
    displayedProducts = [];
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No matching products found
      </div>
    `;
    return;
  }

  displayProducts(filteredProducts);
}

/* Show product-loading errors in the grid */
async function updateProductGrid() {
  try {
    await filterProducts();
  } catch (error) {
    const errorMessage = document.createElement("div");
    errorMessage.className = "placeholder-message";
    errorMessage.textContent = `Could not load products. ${error.message}`;
    productsContainer.replaceChildren(errorMessage);
  }
}

categoryFilter.addEventListener("change", updateProductGrid);
productSearch.addEventListener("input", updateProductGrid);

/* Generate a routine using the products selected by the user */
generateRoutineButton.addEventListener("click", async () => {
  if (selectedProducts.length === 0) {
    displayChatMessage("Advisor", "Select at least one product first.");
    return;
  }

  const productDetails = selectedProducts
    .map(
      (product) =>
        `- ${product.name} by ${product.brand}: ${product.description}`,
    )
    .join("\n");

  await sendMessage(
    `Create a personalized routine using these selected products:\n${productDetails}`,
  );
});

/* Send follow-up questions while keeping the full conversation history */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const question = userInput.value.trim();

  if (question) {
    userInput.value = "";
    await sendMessage(question);
  }
});
