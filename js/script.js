// Warenkorb und Automat Funktion wurde mit https://claude.ai/ implementiert.

const AutomatConfig = {
    limits: {
        berufsschule: 10,
        bahnhof: 10
    },
    
    currentOrders: {
        berufsschule: 0,
        bahnhof: 0
    },
    
    getCurrentOrders: function() {
        const savedOrders = localStorage.getItem('automat_orders');
        if (savedOrders) {
            this.currentOrders = JSON.parse(savedOrders);
        }
        return this.currentOrders;
    },
    
    saveCurrentOrders: function() {
        localStorage.setItem('automat_orders', JSON.stringify(this.currentOrders));
    },
    
    addOrder: function(automat, quantity = 1) {
        this.getCurrentOrders();
        this.currentOrders[automat] += quantity;
        this.saveCurrentOrders();
        this.updateCapacityDisplays();
    },
    
    canAcceptOrders: function(automat, additionalQuantity = 1) {
        this.getCurrentOrders();
        return (this.currentOrders[automat] + additionalQuantity) <= this.limits[automat];
    },
    
    getCapacityPercentage: function(automat) {
        this.getCurrentOrders();
        return Math.round((this.currentOrders[automat] / this.limits[automat]) * 100);
    },
    
    updateCapacityDisplays: function() {
        ['berufsschule', 'bahnhof'].forEach(automat => {
            const percentage = this.getCapacityPercentage(automat);
            const current = this.currentOrders[automat];
            const limit = this.limits[automat];
            
            const capacityBars = document.querySelectorAll(`[id*="capacity-${automat}"]`);
            capacityBars.forEach(bar => {
                if (bar.style !== undefined) {
                    bar.style.width = `${percentage}%`;
                    
                    if (percentage >= 100) {
                        bar.style.backgroundColor = '#dc3545'; 
                    } else if (percentage >= 80) {
                        bar.style.backgroundColor = '#ffc107';
                    } else {
                        bar.style.backgroundColor = '#28a745';
                    }
                }
            });
            
            const capacityTexts = document.querySelectorAll(`[id*="capacity-text-${automat}"]`);
            capacityTexts.forEach(text => {
                text.textContent = `${current}/${limit} Bestellungen`;
                if (percentage >= 100) {
                    text.style.color = '#dc3545';
                    text.innerHTML += ' <strong>(VOLL)</strong>';
                }
            });
        });
    }
};

const Cart = {
    storageKey: 'zmitti_cart',
    
    getCurrentAutomat: function() {
        const currentPage = window.location.pathname;
        if (currentPage.includes('berufsschule')) {
            return 'berufsschule';
        } else if (currentPage.includes('bahnhof')) {
            return 'bahnhof';
        }
        return null;
    },
    
    loadCart: function() {
        const savedCart = localStorage.getItem(this.storageKey);
        return savedCart ? JSON.parse(savedCart) : [];
    },
    
    saveCart: function(cartData) {
        localStorage.setItem(this.storageKey, JSON.stringify(cartData));
    },
    
    addItem: function(item) {
        let cartData = this.loadCart();
        const currentAutomat = this.getCurrentAutomat();
        
        if (!currentAutomat) {
            this.showNotification('Fehler: Automat-Standort konnte nicht bestimmt werden.', 'error');
            return;
        }
        
        const cartItemsForAutomat = cartData
            .filter(cartItem => cartItem.automat === currentAutomat)
            .reduce((sum, cartItem) => sum + cartItem.quantity, 0);
        
        if (!AutomatConfig.canAcceptOrders(currentAutomat, cartItemsForAutomat + 1)) {
            this.showNotification(`Der Automat ${currentAutomat === 'berufsschule' ? 'Berufsschule' : 'Bahnhof'} hat seine maximale Kapazität erreicht!`, 'error');
            return;
        }
        
        const existingItemIndex = cartData.findIndex(cartItem => 
            cartItem.title === item.title && 
            cartItem.restaurant === item.restaurant && 
            cartItem.automat === currentAutomat
        );
        
        if (existingItemIndex !== -1) {
            cartData[existingItemIndex].quantity += 1;
        } else {
            cartData.push({
                ...item,
                quantity: 1,
                id: Date.now() + Math.random(),
                automat: currentAutomat
            });
        }
        
        this.saveCart(cartData);
        this.updateCartDisplay();
        this.updateCartCounter();
        this.showNotification(`${item.title} wurde zum Warenkorb hinzugefügt!`);
        
        AutomatConfig.updateCapacityDisplays();
    },
    
    removeItem: function(itemId) {
        let cartData = this.loadCart();
        cartData = cartData.filter(item => item.id !== itemId);
        this.saveCart(cartData);
        this.updateCartDisplay();
        this.updateCartCounter();
        this.showNotification('Artikel wurde entfernt!');
        AutomatConfig.updateCapacityDisplays();
    },
    
    updateQuantity: function(itemId, newQuantity) {
        if (newQuantity <= 0) {
            this.removeItem(itemId);
            return;
        }
        
        let cartData = this.loadCart();
        const itemIndex = cartData.findIndex(item => item.id === itemId);
        
        if (itemIndex !== -1) {
            const item = cartData[itemIndex];
            const currentAutomat = item.automat;
            
            const otherItemsQuantity = cartData
                .filter(cartItem => cartItem.automat === currentAutomat && cartItem.id !== itemId)
                .reduce((sum, cartItem) => sum + cartItem.quantity, 0);
            
            if (!AutomatConfig.canAcceptOrders(currentAutomat, otherItemsQuantity + newQuantity)) {
                this.showNotification(`Kapazität des Automaten ${currentAutomat === 'berufsschule' ? 'Berufsschule' : 'Bahnhof'} würde überschritten!`, 'error');
                return;
            }
            
            cartData[itemIndex].quantity = newQuantity;
            this.saveCart(cartData);
            this.updateCartDisplay();
            this.updateCartCounter();
        }
    },
    
    clearCart: function() {
        localStorage.removeItem(this.storageKey);
        this.updateCartDisplay();
        this.updateCartCounter();
        this.showNotification('Warenkorb wurde geleert!');
        AutomatConfig.updateCapacityDisplays();
    },
    
    getAutomatQuantities: function() {
        const cartData = this.loadCart();
        const quantities = {
            berufsschule: 0,
            bahnhof: 0
        };
        
        cartData.forEach(item => {
            if (item.automat) {
                quantities[item.automat] += item.quantity;
            }
        });
        
        return quantities;
    },

    canCheckout: function() {
        const quantities = this.getAutomatQuantities();
        const automatenStatus = {
            canProcess: true,
            issues: []
        };
        
        ['berufsschule', 'bahnhof'].forEach(automat => {
            if (quantities[automat] > 0) {
                if (!AutomatConfig.canAcceptOrders(automat, quantities[automat])) {
                    automatenStatus.canProcess = false;
                    automatenStatus.issues.push(automat);
                }
            }
        });
        
        return automatenStatus;
    },
    
    updateCartDisplay: function() {
        if (!document.querySelector('.card-container')) return;
        
        const container = document.querySelector('.card-container .row');
        if (!container) return;
        
        const cartData = this.loadCart();
        
        container.innerHTML = '';
        
        if (cartData.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center">
                    <h3>Ihr Warenkorb ist leer</h3>
                    <p>Fügen Sie Artikel aus unserem Menü hinzu!</p>
                    <a href="berufsschule.html" class="btn">Berufsschule Menü</a>
                    <a href="bahnhof.html" class="btn">Bahnhof Menü</a>
                </div>
            `;
            this.updateCartTotal();
            return;
        }
        
        const groupedItems = {
            berufsschule: cartData.filter(item => item.automat === 'berufsschule'),
            bahnhof: cartData.filter(item => item.automat === 'bahnhof')
        };
        
        ['berufsschule', 'bahnhof'].forEach(automat => {
            const items = groupedItems[automat];
            if (items.length > 0) {
                const automatTitle = automat === 'berufsschule' ? 'Berufsschule' : 'Bahnhof';
                container.insertAdjacentHTML('beforeend', `
                    <div class="col-12 mt-3 mb-2">
                        <h4 class="text-primary border-bottom pb-2">
                            <i class="fa-solid fa-location-dot"></i> Automat ${automatTitle}
                        </h4>
                    </div>
                `);
                
                items.forEach(item => {
                    const cartItemHTML = `
                        <div class="col-sm-12 col-xl-4 col-md-6 cart-item" data-item-id="${item.id}">
                            <div class="menu-image-wrapper">
                                <img class="card-image menu-image" src="${item.image}" alt="${item.title}"/>
                            </div>
                            <h5 class="card-title">${item.title}</h5>
                            <p>${item.restaurant}</p>
                            <small class="text-muted">Automat: ${automatTitle}</small>
                            <div class="card-item-label">${item.price}</div>
                            <div class="quantity-controls mt-2 mb-2">
                                <button class="quantity-btn minus" data-item-id="${item.id}">-</button>
                                <span class="quantity mx-3 fw-bold">${item.quantity}x</span>
                                <button class="quantity-btn plus" data-item-id="${item.id}">+</button>
                            </div>
                            <ul class="card-icons-list">
                                <li class="card-icons-list-item">
                                    <i class="fa-solid fa-heart favorite-icon"></i>
                                </li>
                                <li class="card-icons-list-item">
                                    <i class="fa-solid fa-xmark remove-cart" data-item-id="${item.id}"></i>
                                </li>
                            </ul>       
                        </div>
                    `;
                    container.insertAdjacentHTML('beforeend', cartItemHTML);
                });
            }
        });
        
        this.attachCartEventListeners();
        this.updateCartTotal();
    },
    
    attachCartEventListeners: function() {
        document.querySelectorAll('.remove-cart').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = parseFloat(e.target.getAttribute('data-item-id'));
                this.removeItem(itemId);
            });
        });
        
        document.querySelectorAll('.quantity-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = parseFloat(e.target.getAttribute('data-item-id'));
                const isPlus = e.target.classList.contains('plus');
                const cartData = this.loadCart();
                const currentItem = cartData.find(item => item.id === itemId);
                
                if (currentItem) {
                    const newQuantity = isPlus ? 
                        currentItem.quantity + 1 : 
                        currentItem.quantity - 1;
                    this.updateQuantity(itemId, newQuantity);
                }
            });
        });
    },
    
    updateCartTotal: function() {
        const cartData = this.loadCart();
        const quantities = this.getAutomatQuantities();
        const checkoutStatus = this.canCheckout();
        
        const total = cartData.reduce((sum, item) => {
            const price = parseFloat(item.price.replace('CHF ', '').replace(',', '.'));
            return sum + (price * item.quantity);
        }, 0);
        
        let totalElement = document.querySelector('.cart-total');
        if (!totalElement && cartData.length > 0) {
            const container = document.querySelector('.card-container');
            totalElement = document.createElement('div');
            totalElement.className = 'cart-total mt-4 p-3 rounded';
            container.appendChild(totalElement);
        }
        
        if (totalElement) {
            if (cartData.length === 0) {
                totalElement.remove();
            } else {
                const automatOverview = Object.keys(quantities)
                    .filter(automat => quantities[automat] > 0)
                    .map(automat => {
                        const automatTitle = automat === 'berufsschule' ? 'Berufsschule' : 'Bahnhof';
                        const current = AutomatConfig.currentOrders[automat];
                        const limit = AutomatConfig.limits[automat];
                        const cartQuantity = quantities[automat];
                        const wouldExceed = (current + cartQuantity) > limit;
                        
                        return `
                            <div class="row mb-2 ${wouldExceed ? 'text-danger' : ''}">
                                <div class="col-6">
                                    <strong>${automatTitle}:</strong>
                                </div>
                                <div class="col-6">
                                    ${cartQuantity} Artikel ${wouldExceed ? '⚠️' : '✓'}
                                    <br><small>(Aktuell: ${current}/${limit})</small>
                                </div>
                            </div>
                        `;
                    }).join('');
                
                const warningMessage = !checkoutStatus.canProcess ? `
                    <div class="alert alert-danger mt-3">
                        <i class="fa-solid fa-exclamation-triangle"></i>
                        <strong>Zahlung nicht möglich!</strong><br>
                        Die maximale Kapazität der Automaten ${checkoutStatus.issues.map(a => a === 'berufsschule' ? 'Berufsschule' : 'Bahnhof').join(', ')} würde überschritten werden.
                    </div>
                ` : '';
                
                totalElement.innerHTML = `
                    <h4>Bestellübersicht</h4>
                    ${automatOverview}
                    <hr>
                    <div class="row mb-3">
                        <div class="col-6"><strong>Gesamtsumme:</strong></div>
                        <div class="col-6"><strong>CHF ${total.toFixed(2)}</strong></div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-6">Artikel insgesamt:</div>
                        <div class="col-6">${cartData.reduce((sum, item) => sum + item.quantity, 0)}</div>
                    </div>
                    ${warningMessage}
                    <div class="col-12">
                        <button class="btn btn-danger me-2 mb-2" id="clear-cart-btn">
                            Warenkorb leeren
                        </button>
                        <button class="btn btn-success me-2 mb-2" id="checkout-btn" ${!checkoutStatus.canProcess ? 'disabled' : ''}>
                            ${checkoutStatus.canProcess ? 'Zur Kasse' : 'Zahlung nicht möglich'} (CHF ${total.toFixed(2)})
                        </button>
                    </div>
                `;
                
                const checkoutBtn = document.getElementById('checkout-btn');
                const clearBtn = document.getElementById('clear-cart-btn');
                
                if (checkoutBtn) {
                  checkoutBtn.addEventListener('click', () => {
                      if (checkoutStatus.canProcess) {
                          Object.keys(quantities).forEach(automat => {
                              if (quantities[automat] > 0) {
                                  AutomatConfig.addOrder(automat, quantities[automat]);
                              }
                          });

                          // ✅ Gesamtsumme in sessionStorage speichern
                          sessionStorage.setItem('checkout_total', total.toFixed(2));

                          // ✅ Weiterleitung zur Checkout-Seite
                          window.location.href = 'checkout.html';
                      }
                  });
              }
                
                if (clearBtn) {
                    clearBtn.addEventListener('click', () => {
                        if (confirm('Möchten Sie wirklich alle Artikel aus dem Warenkorb entfernen?')) {
                            this.clearCart();
                        }
                    });
                }
            }
        }
    },

    showNotification: function(message, type = 'success') {
        let notification = document.querySelector('.cart-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.className = 'cart-notification';
            notification.style.cssText = `
                position: fixed;
                top: 60px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                z-index: 1000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                transform: translateX(400px);
                transition: all 0.3s ease;
                font-weight: 500;
                max-width: 300px;
            `;
            document.body.appendChild(notification);
        }
        
        if (type === 'error') {
            notification.style.backgroundColor = '#dc3545';
            notification.style.color = 'white';
        } else {
            notification.style.backgroundColor = '#28a745';
            notification.style.color = 'white';
        }
        
        notification.textContent = message;
        notification.style.transform = 'translateX(0)';
        
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
        }, type === 'error' ? 5000 : 3000);
    },
    
    updateCartCounter: function() {
        const cartData = this.loadCart();
        const totalItems = cartData.reduce((sum, item) => sum + item.quantity, 0);
        
        const cartIcons = document.querySelectorAll('.fa-cart-shopping');
        
        cartIcons.forEach(icon => {
            let counter = icon.parentElement.querySelector('.cart-counter');
            
            if (totalItems > 0) {
                if (!counter) {
                    counter = document.createElement('span');
                    counter.className = 'cart-counter';
                    counter.style.cssText = `
                        position: absolute;
                        top: -8px;
                        right: -8px;
                        background: #dc3545;
                        color: white;
                        border-radius: 50%;
                        width: 20px;
                        height: 20px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 12px;
                        font-weight: bold;
                        z-index: 10;
                    `;
                    
                    icon.parentElement.style.position = 'relative';
                    icon.parentElement.appendChild(counter);
                }
                counter.textContent = totalItems;
            } else if (counter) {
                counter.remove();
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', function() {
    AutomatConfig.getCurrentOrders();
    AutomatConfig.updateCapacityDisplays();

    Cart.updateCartCounter();

    if (document.querySelector('.card-container')) {
        Cart.updateCartDisplay();
    }

    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('fa-cart-plus')) {
            const menuItem = e.target.closest('.menu-item');
            if (!menuItem) return;
            
            const title = menuItem.querySelector('.menu-title').textContent.trim();
            const restaurant = menuItem.querySelector('p').textContent.trim();
            const price = menuItem.querySelector('.menu-item-label').textContent.trim();
            const image = menuItem.querySelector('.menu-image').src;
            
            Cart.addItem({
                title: title,
                restaurant: restaurant,
                price: price,
                image: image
            });
        }
    });

    // Mobile Nav
    const btn = document.getElementById("hamburger-btn");
    const menu = document.getElementById("mobile-menu");

    if (btn && menu) {
        btn.addEventListener("click", () => {
            menu.classList.toggle("d-none");
        });
    }

    const elements = document.querySelectorAll('.favorite-icon');
    elements.forEach((element) => {
        element.addEventListener('click', () => {
            element.classList.toggle('clicked');
        });
    });

    // Popovers
    const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
    if (popoverTriggerList.length > 0) {
        const popoverList = [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl));
    }

    setInterval(() => {
        AutomatConfig.updateCapacityDisplays();
    }, 30000);
});

// Map (https://leafletjs.com/) -> Baden Bhf und BBBaden
if (document.getElementById('map')) {
    const badenCoordinates = [47.476194, 8.307611];
    
    const map = L.map('map').setView(badenCoordinates, 18);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);
    
    const marker = L.marker(badenCoordinates).addTo(map);
    marker.bindPopup('<b>Automat - Bahnhof Baden</b><br>Schnell und Lecker!').openPopup();
}

if (document.getElementById('map-bbbaden')) {
    const badenCoordinates = [47.479975, 8.300998];
    
    const map = L.map('map-bbbaden').setView(badenCoordinates, 18);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);
    
    const marker = L.marker(badenCoordinates).addTo(map);
    marker.bindPopup('<b>Automat - Berufsschule Baden</b><br>Schnell und Lecker!').openPopup();
}

document.addEventListener('DOMContentLoaded', () => {
    const cartData = Cart.loadCart();
    const total = cartData.reduce((sum, item) => {
        const price = parseFloat(item.price.replace('CHF ', '').replace(',', '.'));
        return sum + (price * item.quantity);
    }, 0);

    const totalElement = document.getElementById("total");
    if (totalElement) {
        totalElement.textContent = `CHF ${total.toFixed(2)}`;
    }
});
