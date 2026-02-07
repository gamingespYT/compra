// Estado de la aplicación
let products = [];
let currentOfferCategory = 'none';
let editingProductId = null;
let ticketMode = 'single'; // 'single' o 'dual'
let currentView = 'all'; // 'all', 'ticket1', 'ticket2'

// Cargar productos desde localStorage
function loadProducts() {
    try {
        const saved = localStorage.getItem('shoppingList');
        if (saved) {
            products = JSON.parse(saved);
            // Migrar productos sin ticketId (compatibilidad)
            products = products.map(p => ({ ...p, ticketId: p.ticketId || 1 }));
        }
        // Cargar modo de ticket
        const savedMode = localStorage.getItem('ticketMode');
        if (savedMode) ticketMode = savedMode;
    } catch (e) {
        console.error('Error al cargar productos:', e);
        products = [];
    }
}

function saveProducts() {
    try {
        localStorage.setItem('shoppingList', JSON.stringify(products));
        localStorage.setItem('ticketMode', ticketMode);
    } catch (e) {
        console.error('Error al guardar productos:', e);
    }
}

// Gestión de tickets
function setTicketMode(mode) {
    ticketMode = mode;
    const viewSelector = document.getElementById('viewSelector');
    const ticketSelector = document.getElementById('ticketSelector');

    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    if (mode === 'dual') {
        viewSelector.classList.remove('hidden');
        if (ticketSelector) ticketSelector.classList.remove('hidden');
    } else {
        viewSelector.classList.add('hidden');
        if (ticketSelector) ticketSelector.classList.add('hidden');
        currentView = 'all';
    }

    saveProducts();
    render();
}

function setCurrentView(view) {
    currentView = view;
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    render();
}

function moveProduct(id) {
    const product = products.find(p => p.id === id);
    if (product) {
        product.ticketId = product.ticketId === 1 ? 2 : 1;
        saveProducts();
        render();
    }
}

function getFilteredProducts() {
    if (ticketMode === 'single' || currentView === 'all') {
        return products;
    }
    const ticketId = currentView === 'ticket1' ? 1 : 2;
    return products.filter(p => p.ticketId === ticketId);
}


// Calcular total de un producto
function calculateProductTotal(product) {
    const basePrice = product.price * product.quantity;
    let finalPrice = basePrice;
    let discount = 0;
    let clubValue = 0;
    let couponValue = 0;
    let giftCouponValue = 0; // Nueva: para productos gratis (cupón regalo)

    if (product.offerCategory === 'none') {
        return { basePrice, finalPrice, discount, clubValue, couponValue, giftCouponValue };
    }

    const calc = calculateOfferDiscount(product);
    discount = calc.discount;

    if (product.offerCategory === 'direct') {
        // Productos gratis: NO cuentan como descuento, sino como cupón regalo
        if (product.offerType === 'free') {
            giftCouponValue = basePrice; // Va a la línea "Cupón regalo"
            discount = 0; // No suma al ahorro total
            finalPrice = basePrice; // No se reduce el total a pagar
        } else {
            finalPrice = basePrice - discount; // Descuento normal se aplica
        }
    } else if (product.offerCategory === 'club') {
        clubValue = discount;
        finalPrice = basePrice;
    } else if (product.offerCategory === 'coupon') {
        couponValue = discount;
        finalPrice = basePrice;
    }

    return { basePrice, finalPrice, discount, clubValue, couponValue, giftCouponValue };
}

function calculateOfferDiscount(product) {
    const basePrice = product.price * product.quantity;
    let discount = 0;

    switch (product.offerType) {
        case '3x2':
            const groupsOf3 = Math.floor(product.quantity / 3);
            const remaining3 = product.quantity % 3;
            discount = basePrice - ((groupsOf3 * 2 * product.price) + (remaining3 * product.price));
            break;
        case '2x1':
            const groupsOf2 = Math.floor(product.quantity / 2);
            const remaining2 = product.quantity % 2;
            discount = basePrice - ((groupsOf2 * product.price) + (remaining2 * product.price));
            break;
        case '2nd50':
            const pairs50 = Math.floor(product.quantity / 2);
            const single50 = product.quantity % 2;
            discount = basePrice - ((pairs50 * product.price * 1.5) + (single50 * product.price));
            break;
        case '2nd70':
            const pairs70 = Math.floor(product.quantity / 2);
            const single70 = product.quantity % 2;
            discount = basePrice - ((pairs70 * product.price * 1.7) + (single70 * product.price));
            break;
        case 'free':
            // Producto gratis: genera descuento visual pero no reduce el total a pagar
            discount = basePrice;
            break;
        case 'discount50':
            discount = basePrice * 0.50;
            break;
        case 'discount20':
            discount = basePrice * 0.20;
            break;
        case 'custom':
            discount = calculateCustomDiscount(product);
            break;
    }

    return { discount };
}

function calculateCustomDiscount(product) {
    const basePrice = product.price * product.quantity;
    let discount = 0;

    switch (product.customType) {
        case 'percentage':
            discount = basePrice * (product.customValue / 100);
            break;
        case '2ndCustom':
            const pairs = Math.floor(product.quantity / 2);
            const single = product.quantity % 2;
            const percentAsDecimal = product.customValue / 100;
            discount = basePrice - ((pairs * product.price * (1 + percentAsDecimal)) + (single * product.price));
            break;
        case 'xForY':
            const groups = Math.floor(product.quantity / product.customX);
            const remaining = product.quantity % product.customX;
            discount = basePrice - ((groups * product.customY * product.price) + (remaining * product.price));
            break;
    }

    return discount;
}

function calculateTotals() {
    let subtotalBruto = 0;
    let totalAPagar = 0;
    let ahorroTotal = 0;
    let clubTotal = 0;
    let couponTotal = 0;
    let giftCouponTotal = 0;

    // Usar productos filtrados según la vista actual
    const productsToCalculate = getFilteredProducts();

    productsToCalculate.forEach(product => {
        const calc = calculateProductTotal(product);
        subtotalBruto += calc.basePrice;
        totalAPagar += calc.finalPrice;
        ahorroTotal += calc.discount;
        clubTotal += calc.clubValue;
        couponTotal += calc.couponValue;
        giftCouponTotal += calc.giftCouponValue;
    });

    return { subtotalBruto, totalAPagar, ahorroTotal, clubTotal, couponTotal, giftCouponTotal };
}

// Renderizado
function renderProducts() {
    const container = document.getElementById('productsList');
    const filteredProducts = getFilteredProducts();

    if (filteredProducts.length === 0) {
        const emptyMessage = ticketMode === 'dual' && currentView !== 'all'
            ? `No hay productos en ${currentView === 'ticket1' ? 'Ticket 1' : 'Ticket 2'}`
            : 'No hay productos en la lista';
        container.innerHTML = `
            <div class="empty-state">
                <svg class="icon-cart-empty" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="9" cy="21" r="1"></circle>
                    <circle cx="20" cy="21" r="1"></circle>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
                <p>${emptyMessage}</p>
                <p class="small-text">Añade productos para empezar</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredProducts.map(product => {
        const calc = calculateProductTotal(product);
        const offerLabel = getOfferLabel(product);
        const showTicketBadge = ticketMode === 'dual';
        const ticketBadge = showTicketBadge ? `<span class="ticket-badge" data-ticket="${product.ticketId}">${product.ticketId === 1 ? '🟢 T1' : '🟣 T2'}</span>` : '';
        const moveButton = showTicketBadge ? `
            <button class="btn-move" onclick="moveProduct(${product.id})" title="Mover al otro ticket">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="17 1 21 5 17 9"></polyline>
                    <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                    <polyline points="7 23 3 19 7 15"></polyline>
                    <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                </svg>
            </button>` : '';

        return `
            <div class="product-card">
                <div class="product-header">
                    <div class="product-info">
                        <h3 class="product-name">${ticketBadge}${product.name}</h3>
                        <p class="product-details">${product.quantity} × ${product.price.toFixed(2)} €</p>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        ${moveButton}
                        <button class="btn-icon" onclick="editProduct(${product.id})" title="Editar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn-delete" onclick="deleteProduct(${product.id})">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                ${offerLabel ? `<div class="offer-badge"${product.offerType === 'free' ? ' data-free="true"' : ''}>${offerLabel}</div>` : ''}
                <div class="product-footer">
                    <span class="product-footer-label">Subtotal:</span>
                    <div class="product-footer-prices">
                        ${calc.discount > 0 && product.offerCategory === 'direct' ? `<span class="price-original">${calc.basePrice.toFixed(2)} €</span>` : ''}
                        <span class="price-final">${product.offerType === 'free' ? '0.00' : calc.finalPrice.toFixed(2)} €</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function getOfferLabel(product) {
    if (product.offerCategory === 'none') return '';

    const categoryLabels = { 'direct': '🎯 Oferta Directa', 'club': '⭐ Acumulado Club', 'coupon': '🎟️ Cupón' };
    const offerLabels = { '3x2': '3x2', '2x1': '2x1', '2nd50': '2ª al 50%', '2nd70': '2ª al 70%', 'discount50': '-50%', 'discount20': '-20%', 'free': 'GRATIS 🎁', 'custom': 'Personalizada' };

    // Caso especial para producto gratis: mostrar solo el emoji y texto
    if (product.offerType === 'free') {
        return '🎁 GRATIS';
    }

    let label = `${categoryLabels[product.offerCategory]}: ${offerLabels[product.offerType] || product.offerType}`;

    if (product.offerType === 'custom') {
        if (product.customType === 'percentage') label += ` (${product.customValue}%)`;
        else if (product.customType === '2ndCustom') label += ` (2ª al ${product.customValue}%)`;
        else if (product.customType === 'xForY') label += ` (${product.customX}x${product.customY})`;
    }

    return label;
}

function renderTotals() {
    const totals = calculateTotals();

    document.getElementById('subtotalBruto').textContent = `${totals.subtotalBruto.toFixed(2)} €`;
    document.getElementById('ahorroTotal').textContent = `-${totals.ahorroTotal.toFixed(2)} €`;
    document.getElementById('totalFinal').textContent = `${totals.totalAPagar.toFixed(2)} €`;

    // Cupón regalo (productos gratis de fin de semana)
    const giftCouponRow = document.getElementById('giftCouponRow');
    if (totals.giftCouponTotal > 0) {
        document.getElementById('giftCouponTotal').textContent = `${totals.giftCouponTotal.toFixed(2)} €`;
        giftCouponRow.classList.remove('hidden');
    } else {
        giftCouponRow.classList.add('hidden');
    }

    // Añadir automáticamente 1% del total a pagar al acumulado club
    const autoClubAccumulation = totals.totalAPagar * 0.01;
    const totalClubWithAuto = totals.clubTotal + autoClubAccumulation;

    const clubRow = document.getElementById('clubRow');
    if (totalClubWithAuto > 0) {
        document.getElementById('clubTotal').textContent = `${totalClubWithAuto.toFixed(2)} €`;
        clubRow.classList.remove('hidden');
    } else {
        clubRow.classList.add('hidden');
    }

    const couponRow = document.getElementById('couponRow');
    if (totals.couponTotal > 0) {
        document.getElementById('couponTotal').textContent = `${totals.couponTotal.toFixed(2)} €`;
        couponRow.classList.remove('hidden');
    } else {
        couponRow.classList.add('hidden');
    }
}

function render() {
    renderProducts();
    renderTotals();
}

// Gestión de productos
function addProduct() {
    let name = document.getElementById('inputName').value.trim();
    const price = parseFloat(document.getElementById('inputPrice').value);
    const quantity = parseInt(document.getElementById('inputQuantity').value);

    if (!price || price < 0 || !quantity || quantity < 1) return;

    if (!name) name = `Producto ${products.length + 1}`;

    // Obtener ticket seleccionado (por defecto ticket 1)
    const ticketRadio = document.querySelector('input[name="ticketSelect"]:checked');
    const ticketId = ticketMode === 'dual' && ticketRadio ? parseInt(ticketRadio.value) : 1;

    const newProduct = {
        id: Date.now(), name, price, quantity, ticketId,
        offerCategory: currentOfferCategory,
        offerType: 'none', customType: '', customValue: 0, customX: 0, customY: 0
    };

    if (currentOfferCategory === 'direct') {
        newProduct.offerType = document.getElementById('selectDirectOffer').value;
        if (newProduct.offerType === 'custom') {
            newProduct.customType = document.getElementById('selectDirectCustomType').value;
            if (newProduct.customType === 'percentage') newProduct.customValue = parseFloat(document.getElementById('inputDirectPercentage').value) || 0;
            else if (newProduct.customType === '2ndCustom') newProduct.customValue = parseFloat(document.getElementById('inputDirect2ndPercent').value) || 0;
            else if (newProduct.customType === 'xForY') {
                newProduct.customX = parseInt(document.getElementById('inputDirectX').value) || 0;
                newProduct.customY = parseInt(document.getElementById('inputDirectY').value) || 0;
            }
        }
    } else if (currentOfferCategory === 'club') {
        newProduct.offerType = document.getElementById('selectClubOffer').value;
        if (newProduct.offerType === 'custom') {
            newProduct.customType = document.getElementById('selectClubCustomType').value;
            if (newProduct.customType === 'percentage') newProduct.customValue = parseFloat(document.getElementById('inputClubPercentage').value) || 0;
            else if (newProduct.customType === '2ndCustom') newProduct.customValue = parseFloat(document.getElementById('inputClub2ndPercent').value) || 0;
            else if (newProduct.customType === 'xForY') {
                newProduct.customX = parseInt(document.getElementById('inputClubX').value) || 0;
                newProduct.customY = parseInt(document.getElementById('inputClubY').value) || 0;
            }
        }
    } else if (currentOfferCategory === 'coupon') {
        newProduct.offerType = document.getElementById('selectCouponOffer').value;
        if (newProduct.offerType === 'custom') {
            newProduct.customType = document.getElementById('selectCouponCustomType').value;
            if (newProduct.customType === 'percentage') newProduct.customValue = parseFloat(document.getElementById('inputCouponPercentage').value) || 0;
            else if (newProduct.customType === '2ndCustom') newProduct.customValue = parseFloat(document.getElementById('inputCoupon2ndPercent').value) || 0;
            else if (newProduct.customType === 'xForY') {
                newProduct.customX = parseInt(document.getElementById('inputCouponX').value) || 0;
                newProduct.customY = parseInt(document.getElementById('inputCouponY').value) || 0;
            }
        }
    }

    if (editingProductId) {
        // Modo edición: actualizar producto existente
        const index = products.findIndex(p => p.id === editingProductId);
        if (index !== -1) {
            newProduct.id = editingProductId; // Mantener el mismo ID
            products[index] = newProduct;
        }
        editingProductId = null;
    } else {
        // Modo añadir: agregar nuevo producto
        products.push(newProduct);
    }
    saveProducts();
    render();
    closeModal();
    resetForm();
}

function deleteProduct(id) {
    products = products.filter(p => p.id !== id);
    saveProducts();
    render();
}

function editProduct(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;

    editingProductId = id;

    // Cargar datos básicos
    document.getElementById('inputName').value = product.name;
    document.getElementById('inputPrice').value = product.price;
    document.getElementById('inputQuantity').value = product.quantity;

    // Cambiar categoría
    switchOfferCategory(product.offerCategory);

    // Cargar oferta según categoría
    if (product.offerCategory === 'direct') {
        document.getElementById('selectDirectOffer').value = product.offerType;
        toggleDirectCustom();
        if (product.offerType === 'custom') {
            document.getElementById('selectDirectCustomType').value = product.customType;
            updateDirectCustomInputs();
            if (product.customType === 'percentage') {
                document.getElementById('inputDirectPercentage').value = product.customValue;
            } else if (product.customType === '2ndCustom') {
                document.getElementById('inputDirect2ndPercent').value = product.customValue;
            } else if (product.customType === 'xForY') {
                document.getElementById('inputDirectX').value = product.customX;
                document.getElementById('inputDirectY').value = product.customY;
            }
        }
    } else if (product.offerCategory === 'club') {
        document.getElementById('selectClubOffer').value = product.offerType;
        toggleClubCustom();
        if (product.offerType === 'custom') {
            document.getElementById('selectClubCustomType').value = product.customType;
            updateClubCustomInputs();
            if (product.customType === 'percentage') {
                document.getElementById('inputClubPercentage').value = product.customValue;
            } else if (product.customType === '2ndCustom') {
                document.getElementById('inputClub2ndPercent').value = product.customValue;
            } else if (product.customType === 'xForY') {
                document.getElementById('inputClubX').value = product.customX;
                document.getElementById('inputClubY').value = product.customY;
            }
        }
    } else if (product.offerCategory === 'coupon') {
        document.getElementById('selectCouponOffer').value = product.offerType;
        toggleCouponCustom();
        if (product.offerType === 'custom') {
            document.getElementById('selectCouponCustomType').value = product.customType;
            updateCouponCustomInputs();
            if (product.customType === 'percentage') {
                document.getElementById('inputCouponPercentage').value = product.customValue;
            } else if (product.customType === '2ndCustom') {
                document.getElementById('inputCoupon2ndPercent').value = product.customValue;
            } else if (product.customType === 'xForY') {
                document.getElementById('inputCouponX').value = product.customX;
                document.getElementById('inputCouponY').value = product.customY;
            }
        }
    }

    // Cambiar título del modal
    document.querySelector('#modalForm h2').textContent = 'Editar Producto';
    openModal();
}

function clearAllProducts() {
    products = [];
    saveProducts();
    render();
    closeConfirmModal();
}

// Modales
function openModal() {
    document.getElementById('modalForm').classList.remove('hidden');

    // Preseleccionar ticket según la vista actual
    if (ticketMode === 'dual' && currentView !== 'all') {
        const ticketNum = currentView === 'ticket1' ? '1' : '2';
        const radio = document.querySelector(`input[name="ticketSelect"][value="${ticketNum}"]`);
        if (radio) radio.checked = true;
    }
}
function closeModal() {
    document.getElementById('modalForm').classList.add('hidden');
    resetForm(); // Siempre resetear al cerrar para evitar que el estado de edición persista
}
function openConfirmModal() { document.getElementById('modalConfirm').classList.remove('hidden'); }
function closeConfirmModal() { document.getElementById('modalConfirm').classList.add('hidden'); }

function resetForm() {
    document.getElementById('inputName').value = '';
    document.getElementById('inputPrice').value = '';
    document.getElementById('inputQuantity').value = '1';
    currentOfferCategory = 'none';
    editingProductId = null;

    document.querySelector('#modalForm h2').textContent = 'Añadir Producto';
    document.querySelectorAll('.category-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.category === 'none'));
    document.getElementById('directOfferSection').classList.add('hidden');
    document.getElementById('clubOfferSection').classList.add('hidden');
    document.getElementById('couponOfferSection').classList.add('hidden');
}

function switchOfferCategory(category) {
    currentOfferCategory = category;
    document.querySelectorAll('.category-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.category === category));
    document.getElementById('directOfferSection').classList.toggle('hidden', category !== 'direct');
    document.getElementById('clubOfferSection').classList.toggle('hidden', category !== 'club');
    document.getElementById('couponOfferSection').classList.toggle('hidden', category !== 'coupon');
}

function toggleDirectCustom() {
    const offerType = document.getElementById('selectDirectOffer').value;
    document.getElementById('directCustomSection').classList.toggle('hidden', offerType !== 'custom');
    if (offerType === 'custom') updateDirectCustomInputs();
}

function updateDirectCustomInputs() {
    const customType = document.getElementById('selectDirectCustomType').value;
    document.getElementById('directPercentageInput').classList.toggle('hidden', customType !== 'percentage');
    document.getElementById('direct2ndCustomInput').classList.toggle('hidden', customType !== '2ndCustom');
    document.getElementById('directXForYInputs').classList.toggle('hidden', customType !== 'xForY');
}

function toggleClubCustom() {
    const offerType = document.getElementById('selectClubOffer').value;
    document.getElementById('clubCustomSection').classList.toggle('hidden', offerType !== 'custom');
    if (offerType === 'custom') updateClubCustomInputs();
}

function updateClubCustomInputs() {
    const customType = document.getElementById('selectClubCustomType').value;
    document.getElementById('clubPercentageInput').classList.toggle('hidden', customType !== 'percentage');
    document.getElementById('club2ndCustomInput').classList.toggle('hidden', customType !== '2ndCustom');
    document.getElementById('clubXForYInputs').classList.toggle('hidden', customType !== 'xForY');
}

function toggleCouponCustom() {
    const offerType = document.getElementById('selectCouponOffer').value;
    document.getElementById('couponCustomSection').classList.toggle('hidden', offerType !== 'custom');
    if (offerType === 'custom') updateCouponCustomInputs();
}

function updateCouponCustomInputs() {
    const customType = document.getElementById('selectCouponCustomType').value;
    document.getElementById('couponPercentageInput').classList.toggle('hidden', customType !== 'percentage');
    document.getElementById('coupon2ndCustomInput').classList.toggle('hidden', customType !== '2ndCustom');
    document.getElementById('couponXForYInputs').classList.toggle('hidden', customType !== 'xForY');
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();

    // Inicializar UI según modo guardado
    if (ticketMode === 'dual') {
        document.getElementById('viewSelector').classList.remove('hidden');
        document.getElementById('ticketSelector')?.classList.remove('hidden');
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === ticketMode);
        });
    }

    render();

    document.getElementById('btnAddProduct').addEventListener('click', openModal);
    document.getElementById('btnCloseModal').addEventListener('click', closeModal);
    document.getElementById('btnCancel').addEventListener('click', closeModal);
    document.getElementById('btnSubmit').addEventListener('click', addProduct);
    document.getElementById('btnClearAll').addEventListener('click', openConfirmModal);
    document.getElementById('btnCancelDelete').addEventListener('click', closeConfirmModal);
    document.getElementById('btnConfirmDelete').addEventListener('click', clearAllProducts);

    // Event listeners para modo ticket
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => setTicketMode(btn.dataset.mode));
    });

    // Event listeners para selector de vista
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => setCurrentView(btn.dataset.view));
    });

    document.querySelectorAll('.category-btn').forEach(btn => btn.addEventListener('click', () => switchOfferCategory(btn.dataset.category)));

    document.getElementById('selectDirectOffer').addEventListener('change', toggleDirectCustom);
    document.getElementById('selectDirectCustomType').addEventListener('change', updateDirectCustomInputs);
    document.getElementById('selectClubOffer').addEventListener('change', toggleClubCustom);
    document.getElementById('selectClubCustomType').addEventListener('change', updateClubCustomInputs);
    document.getElementById('selectCouponOffer').addEventListener('change', toggleCouponCustom);
    document.getElementById('selectCouponCustomType').addEventListener('change', updateCouponCustomInputs);

    ['inputName', 'inputPrice', 'inputQuantity'].forEach(id => {
        document.getElementById(id).addEventListener('keypress', (e) => { if (e.key === 'Enter') addProduct(); });
    });

    document.getElementById('modalForm').addEventListener('click', (e) => { if (e.target.id === 'modalForm') closeModal(); });
    document.getElementById('modalConfirm').addEventListener('click', (e) => { if (e.target.id === 'modalConfirm') closeConfirmModal(); });
});

window.deleteProduct = deleteProduct;
window.editProduct = editProduct;
window.moveProduct = moveProduct;
