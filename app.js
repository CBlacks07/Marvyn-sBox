(() => {
  'use strict';

  const CART_KEY = 'mb_cart';
  const PLACEHOLDER_IMG = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#EADFC0"/></svg>'
  );
  const FREE_SHIPPING_THRESHOLD = 25000;
  const SHIPPING_FEE = 2000;

  const ICON_CART = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>';
  const ICON_MENU = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
  const ICON_CLOSE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  const ICON_SEARCH = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

  const app = document.getElementById('app');

  const DEFAULT_SETTINGS = {
    logoUrl: null,
    colorBg: '#FBC873', colorDark: '#2E070B', colorAccent: '#3A0A10', colorAccentHover: '#55131B',
    siteName: "Mervyn's Box",
    siteDescription: "L'univers asiatique, réuni en une boîte. Figurines, manga, snacks et streetwear otaku sélectionnés avec passion.",
    whatsappNumber: '',
    heroEyebrow: 'Box mensuelle otaku',
    heroTitle: 'Ton univers otaku,\nlivré chez toi.',
    heroSubtitle: "Figurines, manga, snacks japonais et streetwear : tout l'univers asiatique réuni dans une boîte, chaque mois ou à la carte.",
    heroImageUrl: null,
    heroBadgeLabel: 'Nouveau drop',
    promoEyebrow: 'Abonnement',
    promoTitle: "La Box mensuelle, ton dose d'otaku régulière",
    promoText: 'Chaque mois, reçois une sélection surprise de figurines, snacks, goodies et streetwear choisis par notre équipe otaku.',
    promoImageUrl: null,
    promoButtonLabel: "Je m'abonne à la Box",
    newsletterTitle: 'Ne manque aucun drop',
    newsletterText: 'Inscris-toi à la newsletter pour les nouveautés et offres exclusives.',
    footerShippingText: 'Livraison & retours',
    footerFaqText: 'FAQ',
    footerContactText: 'Contact',
    copyrightText: "© 2026 Mervyn's Box — Tous droits réservés.",
  };

  const state = {
    view: 'home',
    productId: null,
    category: 'all',
    search: '',
    sort: 'popular',
    qty: 1,
    products: [],
    categories: [],
    settings: DEFAULT_SETTINGS,
    cart: loadCart(),
    loading: true,
    error: null,
    notice: null,
    checkout: { name: '', phone: '', status: 'idle', error: null },
    mobileNavOpen: false,
  };

  function showNotice(message) {
    state.notice = message;
    render();
    setTimeout(() => { state.notice = null; render(); }, 6000);
  }

  // ---- Lightbox (zoom photo produit) ----
  function openLightbox(src, alt) {
    const overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.innerHTML = `
      <button class="lightbox-close" aria-label="Fermer">${ICON_CLOSE}</button>
      <img class="lightbox-img" src="${esc(src)}" alt="${esc(alt)}" />
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const img = overlay.querySelector('.lightbox-img');
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      img.classList.toggle('zoomed');
    });

    const close = () => {
      document.body.style.overflow = '';
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    };
    function onKey(e) { if (e.key === 'Escape') close(); }

    overlay.addEventListener('click', close);
    overlay.querySelector('.lightbox-close').addEventListener('click', (e) => { e.stopPropagation(); close(); });
    document.addEventListener('keydown', onKey);
  }

  function applyTheme(s) {
    const root = document.documentElement.style;
    root.setProperty('--bg', s.colorBg);
    root.setProperty('--dark', s.colorDark);
    root.setProperty('--accent', s.colorAccent);
    root.setProperty('--accent-hover', s.colorAccentHover);
    document.title = `${s.siteName} — ${s.heroTitle.replace(/\n/g, ' ')}`;
  }

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || {}; }
    catch { return {}; }
  }
  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function price(n) {
    return Math.round(Number(n)).toLocaleString('fr-FR') + ' FCFA';
  }

  function catLabel(slug) {
    const c = state.categories.find((x) => x.slug === slug);
    return c ? c.label : slug;
  }

  function enrich(p) {
    const inStock = p.stock > 0;
    const lowStock = inStock && p.stock <= 5;
    return {
      ...p,
      priceLabel: price(p.price),
      categoryLabel: catLabel(p.category),
      imageSrc: p.imageUrl || PLACEHOLDER_IMG,
      badgeColor: p.badge === 'Nouveau' ? '#FF6B4A' : '#2E070B',
      inStock,
      stockNote: !inStock ? 'Rupture de stock' : (lowStock ? `Plus que ${p.stock} en stock` : null),
      stockNoteColor: !inStock ? '#b3261e' : '#c9722a',
      addLabel: inStock ? 'Ajouter' : 'Épuisé',
      addBg: inStock ? '#3A0A10' : '#c9b691',
      addCursor: inStock ? 'pointer' : 'not-allowed',
    };
  }

  // ---- Data loading ----
  async function loadData() {
    try {
      const [productsRes, categoriesRes, settingsRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/categories'),
        fetch('/api/settings'),
      ]);
      if (!productsRes.ok || !categoriesRes.ok) throw new Error('bad response');
      state.products = await productsRes.json();
      state.categories = await categoriesRes.json();
      if (settingsRes.ok) state.settings = await settingsRes.json();
      applyTheme(state.settings);
      state.loading = false;
      state.error = null;
    } catch (e) {
      state.loading = false;
      state.error = 'Impossible de charger la boutique pour le moment.';
    }
    render();
  }

  // ---- Cart logic ----
  function addToCart(id, qty) {
    const product = state.products.find((p) => p.id === id);
    const maxStock = product ? product.stock : 0;
    const next = Math.min(maxStock, (state.cart[id] || 0) + (qty || 1));
    if (next <= 0) delete state.cart[id]; else state.cart[id] = next;
    saveCart();
    render();
  }

  function changeCartQty(id, delta) {
    const product = state.products.find((p) => p.id === id);
    const maxStock = product ? product.stock : 0;
    const nq = Math.min(maxStock, (state.cart[id] || 0) + delta);
    if (nq <= 0) delete state.cart[id]; else state.cart[id] = nq;
    saveCart();
    render();
  }

  function removeFromCart(id) {
    delete state.cart[id];
    saveCart();
    render();
  }

  // ---- Checkout ----
  function buildWhatsAppMessage(order, cartItems, totalNum) {
    const lines = [`Bonjour ${state.settings.siteName} !`, 'Je souhaite commander :', ''];
    for (const it of cartItems) {
      lines.push(`- ${it.qty}x ${it.name} — ${price(it.price * it.qty)}`);
    }
    lines.push('', `Total : ${price(totalNum)}`, '', `Nom : ${state.checkout.name}`, `Téléphone : ${state.checkout.phone}`, `Commande #${order.id}`);
    return lines.join('\n');
  }

  async function submitCheckout() {
    const { cartItems, totalNum } = computeCartItems();
    if (cartItems.length === 0) return;

    state.checkout.status = 'sending';
    state.checkout.error = null;
    render();

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: state.checkout.name,
          customerPhone: state.checkout.phone,
          items: cartItems.map((it) => ({ productId: it.id, qty: it.qty })),
        }),
      });
      const order = await res.json();
      if (!res.ok) throw new Error(order.error || 'Impossible d\'envoyer la commande');

      const digits = (state.settings.whatsappNumber || '').replace(/\D/g, '');
      const message = buildWhatsAppMessage(order, cartItems, totalNum);

      state.cart = {};
      saveCart();
      state.checkout = { name: '', phone: '', status: 'idle', error: null };

      if (digits) {
        window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, '_blank');
      }
      location.hash = '#/';
      showNotice(digits
        ? 'Commande envoyée ! Finalise-la sur WhatsApp.'
        : 'Commande enregistrée ! Nous te recontactons pour la finaliser.');
    } catch (e) {
      state.checkout.status = 'idle';
      state.checkout.error = e.message;
      render();
    }
  }

  // ---- Routing ----
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [pathPart, queryPart] = raw.split('?');
    const parts = pathPart.split('/').filter(Boolean);
    const params = new URLSearchParams(queryPart || '');

    if (parts[0] === 'shop') return { view: 'shop', category: params.get('cat') || 'all' };
    if (parts[0] === 'product' && parts[1]) return { view: 'product', productId: Number(parts[1]) };
    if (parts[0] === 'cart') return { view: 'cart' };
    return { view: 'home' };
  }

  function onRoute() {
    Object.assign(state, parseHash());
    state.qty = 1;
    state.mobileNavOpen = false;
    render();
    window.scrollTo({ top: 0 });
  }

  window.addEventListener('hashchange', onRoute);

  // ---- Render: pieces ----
  function renderHeader() {
    const cartCount = Object.values(state.cart).reduce((a, b) => a + b, 0);
    const logoSrc = state.settings.logoUrl || 'assets/logo-lockup.png';
    return `
      <header class="site-header">
        <button class="nav-toggle" data-action="toggle-nav" aria-label="Menu">${state.mobileNavOpen ? ICON_CLOSE : ICON_MENU}</button>
        <img src="${esc(logoSrc)}" alt="${esc(state.settings.siteName)}" class="site-logo" data-action="go-home" />
        <div class="mobile-menu ${state.mobileNavOpen ? 'open' : ''}">
          <nav class="site-nav">
            <a data-action="go-home" class="${state.view === 'home' ? 'active' : ''}">Accueil</a>
            <a data-action="go-shop-all" class="${state.view === 'shop' ? 'active' : ''}">Boutique</a>
            <a data-action="go-home-box">Box mensuelle</a>
          </nav>
        </div>
        <form class="search-form" data-action="submit-search">
          <input type="text" name="search" placeholder="Rechercher un produit..." value="${esc(state.search)}" data-action="input-search" />
          <button type="submit" class="btn btn-dark search-submit">Go</button>
        </form>
        <button class="btn btn-dark cart-btn" data-action="go-cart" aria-label="Panier">
          ${ICON_CART}${cartCount > 0 ? `<span class="cart-count">${cartCount}</span>` : ''}
        </button>
      </header>
      ${state.error ? `<div class="error-banner">${esc(state.error)}</div>` : ''}
      ${state.notice ? `<div class="notice-banner">${esc(state.notice)}</div>` : ''}
    `;
  }

  function renderFooter() {
    const s = state.settings;
    const cats = state.categories.map((c) => `<span data-action="go-shop-cat" data-cat="${esc(c.slug)}">${esc(c.label)}</span>`).join('');
    const logoSrc = s.logoUrl || 'assets/logo-lockup.png';
    return `
      <footer class="site-footer">
        <div class="footer-grid">
          <div class="footer-brand">
            <img src="${esc(logoSrc)}" alt="${esc(s.siteName)}" class="footer-logo" />
            <p>${esc(s.siteDescription)}</p>
          </div>
          <div class="footer-col">
            <div class="footer-col-title">Boutique</div>
            <div class="footer-links">${cats}</div>
          </div>
          <div class="footer-col">
            <div class="footer-col-title">Infos</div>
            <div class="footer-links">
              <span>${esc(s.footerShippingText)}</span>
              <span>${esc(s.footerFaqText)}</span>
              <span>${esc(s.footerContactText)}</span>
            </div>
          </div>
        </div>
        <div class="footer-bottom">${esc(s.copyrightText)}</div>
      </footer>
    `;
  }

  function productCard(p) {
    return `
      <div class="product-card" data-action="open-product" data-id="${p.id}">
        <div class="product-media">
          <img src="${esc(p.imageSrc)}" alt="${esc(p.name)}" />
          ${p.badge ? `<span class="product-badge-tag" style="background:${p.badgeColor};">${esc(p.badge)}</span>` : ''}
        </div>
        <div class="product-body">
          <span class="product-cat">${esc(p.categoryLabel)}</span>
          <span class="product-name">${esc(p.name)}</span>
          ${p.stockNote ? `<span class="product-stock-note" style="color:${p.stockNoteColor};">${esc(p.stockNote)}</span>` : ''}
          <div class="product-foot">
            <span class="product-price">${p.priceLabel}</span>
            <button class="btn add-btn" style="background:${p.addBg};color:#FBC873;cursor:${p.addCursor};" data-action="add-to-cart" data-id="${p.id}">${p.addLabel}</button>
          </div>
        </div>
      </div>
    `;
  }

  // ---- Render: views ----
  function renderHome() {
    const s = state.settings;
    const allProducts = state.products.map(enrich);
    const featured = allProducts.slice(0, 4);
    const categoryCards = state.categories.map((c) => `
      <div class="category-card" data-action="go-shop-cat" data-cat="${esc(c.slug)}">
        <div class="category-badge">${esc(c.initial)}</div>
        <div class="category-label">${esc(c.label)}</div>
      </div>
    `).join('');

    const heroTitleHtml = esc(s.heroTitle).replace(/\n/g, '<br/>');
    const heroImg = s.heroImageUrl || PLACEHOLDER_IMG;
    const promoImg = s.promoImageUrl || PLACEHOLDER_IMG;

    return `
      <main>
        <section class="hero">
          <div class="hero-dots"></div>
          <div class="hero-copy">
            <span class="eyebrow">${esc(s.heroEyebrow)}</span>
            <h1>${heroTitleHtml}</h1>
            <p>${esc(s.heroSubtitle)}</p>
            <div class="hero-actions">
              <button class="btn btn-dark" data-action="go-shop-all">Découvrir la boutique</button>
              <button class="btn btn-outline" data-action="go-home-box">S'abonner à la Box</button>
            </div>
          </div>
          <div class="hero-media">
            <div class="hero-media-inner">
              <img class="hero-img" src="${esc(heroImg)}" alt="${esc(s.heroEyebrow)}" />
              <span class="hero-tag">${esc(s.heroBadgeLabel)}</span>
            </div>
          </div>
        </section>

        <div class="category-grid">${categoryCards}</div>

        <section class="section">
          <div class="section-head">
            <h2>Les plus demandés</h2>
            <a data-action="go-shop-all">Voir tout →</a>
          </div>
          <div class="product-grid">${featured.map((p) => productCard(p)).join('')}</div>
        </section>

        <section class="promo-band">
          <div class="promo-copy">
            <span class="eyebrow">${esc(s.promoEyebrow)}</span>
            <h2>${esc(s.promoTitle)}</h2>
            <p>${esc(s.promoText)}</p>
            <button class="btn btn-dark" data-action="go-home-box" style="padding:15px 30px;font-size:16px;">${esc(s.promoButtonLabel)}</button>
          </div>
          <div class="promo-media">
            <img src="${esc(promoImg)}" alt="${esc(s.promoTitle)}" />
          </div>
        </section>

        <section id="newsletter" class="newsletter">
          <h2>${esc(s.newsletterTitle)}</h2>
          <p>${esc(s.newsletterText)}</p>
          <form class="newsletter-form" data-action="submit-newsletter">
            <input type="email" required placeholder="ton@email.com" />
            <button type="submit" class="btn btn-dark">S'abonner</button>
          </form>
        </section>
      </main>
    `;
  }

  function renderShop() {
    const allProducts = state.products.map(enrich);
    let filtered = allProducts.filter((p) =>
      (state.category === 'all' || p.category === state.category) &&
      p.name.toLowerCase().includes(state.search.toLowerCase())
    );
    if (state.sort === 'price-asc') filtered = [...filtered].sort((a, b) => a.price - b.price);
    else if (state.sort === 'price-desc') filtered = [...filtered].sort((a, b) => b.price - a.price);
    else if (state.sort === 'name') filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

    const sidebarCats = [{ slug: 'all', label: 'Toutes les catégories' }, ...state.categories];
    const sidebarHtml = sidebarCats.map((c) => {
      const isActive = c.slug === state.category;
      return `<span data-action="go-shop-cat" data-cat="${esc(c.slug)}" style="font-weight:${isActive ? 700 : 500};background:${isActive ? '#3A0A10' : 'transparent'};color:${isActive ? '#FBC873' : '#3A0A10'};">${esc(c.label)}</span>`;
    }).join('');

    return `
      <main class="shop-main">
        <h1>Boutique</h1>
        <p class="shop-count">${filtered.length} produit(s)</p>
        <div class="shop-layout">
          <aside class="shop-sidebar">
            <div class="sidebar-card">
              <div class="sidebar-title">Catégories</div>
              <div class="sidebar-cats">${sidebarHtml}</div>
            </div>
            <div class="sidebar-card">
              <div class="sidebar-title">Trier par</div>
              <select class="sidebar-select" data-action="set-sort">
                <option value="popular" ${state.sort === 'popular' ? 'selected' : ''}>Popularité</option>
                <option value="price-asc" ${state.sort === 'price-asc' ? 'selected' : ''}>Prix croissant</option>
                <option value="price-desc" ${state.sort === 'price-desc' ? 'selected' : ''}>Prix décroissant</option>
                <option value="name" ${state.sort === 'name' ? 'selected' : ''}>Nom (A-Z)</option>
              </select>
            </div>
          </aside>
          <div class="shop-results">
            ${filtered.length > 0
              ? `<div class="product-grid">${filtered.map((p) => productCard(p)).join('')}</div>`
              : `<div class="empty-state"><p>Aucun produit ne correspond à ta recherche.</p></div>`
            }
          </div>
        </div>
      </main>
    `;
  }

  function renderProduct() {
    const allProducts = state.products.map(enrich);
    const currentProduct = allProducts.find((p) => p.id === state.productId) || allProducts[0];

    if (!currentProduct) {
      return `<main class="product-main"><div class="empty-state"><p>Produit introuvable.</p></div></main>`;
    }

    const sameCategory = allProducts.filter((p) => p.category === currentProduct.category && p.id !== currentProduct.id);
    const otherCategory = allProducts.filter((p) => p.category !== currentProduct.category && p.id !== currentProduct.id);
    const related = [...sameCategory, ...otherCategory].slice(0, 4);

    return `
      <main class="product-main">
        <span class="back-link" data-action="go-shop-all">← Retour à la boutique</span>
        <div class="product-detail">
          <div class="product-gallery" data-action="open-lightbox" data-src="${esc(currentProduct.imageSrc)}" data-alt="${esc(currentProduct.name)}">
            <img src="${esc(currentProduct.imageSrc)}" alt="${esc(currentProduct.name)}" />
            <span class="zoom-hint">${ICON_SEARCH} Zoomer</span>
          </div>
          <div class="product-info">
            <span class="product-cat">${esc(currentProduct.categoryLabel)}</span>
            <h1>${esc(currentProduct.name)}</h1>
            <div class="price">${currentProduct.priceLabel}</div>
            ${currentProduct.stockNote ? `<div class="product-stock-note" style="color:${currentProduct.stockNoteColor};margin-bottom:12px;">${esc(currentProduct.stockNote)}</div>` : ''}
            <p class="desc">${esc(currentProduct.description)}</p>
            <div class="qty-row">
              <div class="qty-stepper">
                <button data-action="dec-qty">−</button>
                <span>${state.qty}</span>
                <button data-action="inc-qty" data-id="${currentProduct.id}">+</button>
              </div>
              <button class="btn add-to-cart-btn" style="background:${currentProduct.addBg};color:#FBC873;cursor:${currentProduct.addCursor};" data-action="add-current-to-cart" data-id="${currentProduct.id}">${currentProduct.addLabel === 'Ajouter' ? 'Ajouter au panier' : currentProduct.addLabel}</button>
            </div>
            <div class="perks">
              <span>Livraison offerte dès 50€ d'achat</span>
              <span>Retours gratuits sous 30 jours</span>
              <span>Paiement 100% sécurisé</span>
            </div>
          </div>
        </div>

        ${related.length > 0 ? `
          <div class="related-block">
            <h2>Tu aimeras aussi</h2>
            <div class="related-grid">
              ${related.map((p) => `
                <div class="related-card" data-action="open-product" data-id="${p.id}">
                  <img src="${esc(p.imageSrc)}" alt="${esc(p.name)}" />
                  <div class="body">
                    <div class="name">${esc(p.name)}</div>
                    <div class="price">${p.priceLabel}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </main>
    `;
  }

  function computeCartItems() {
    const allProducts = state.products.map(enrich);
    const cartIds = Object.keys(state.cart);
    const cartItems = cartIds.map((idStr) => {
      const id = Number(idStr);
      const p = allProducts.find((pp) => pp.id === id);
      const q = state.cart[idStr];
      if (!p) return null;
      return { ...p, qty: q, lineTotal: price(p.price * q) };
    }).filter(Boolean);
    const subtotalNum = cartItems.reduce((a, it) => a + it.price * it.qty, 0);
    const shippingNum = subtotalNum > 0 && subtotalNum < FREE_SHIPPING_THRESHOLD ? SHIPPING_FEE : 0;
    return { cartItems, subtotalNum, shippingNum, totalNum: subtotalNum + shippingNum };
  }

  function renderCart() {
    const { cartItems, subtotalNum, shippingNum, totalNum } = computeCartItems();

    if (cartItems.length === 0) {
      return `
        <main class="cart-main">
          <h1>Mon panier</h1>
          <div class="cart-empty">
            <p>Ton panier est vide pour le moment.</p>
            <button class="btn btn-dark" style="padding:15px 30px;font-size:15px;" data-action="go-shop-all">Voir la boutique</button>
          </div>
        </main>
      `;
    }

    const freeShipMissing = subtotalNum > 0 && subtotalNum < FREE_SHIPPING_THRESHOLD ? price(FREE_SHIPPING_THRESHOLD - subtotalNum) : null;

    return `
      <main class="cart-main">
        <h1>Mon panier</h1>
        <div class="cart-layout">
          <div class="cart-items">
            ${cartItems.map((it) => `
              <div class="cart-item">
                <img src="${esc(it.imageSrc)}" alt="${esc(it.name)}" />
                <div class="cart-item-info">
                  <div class="name">${esc(it.name)}</div>
                  <div class="cat">${esc(it.categoryLabel)}</div>
                </div>
                <div class="cart-qty">
                  <button data-action="cart-dec" data-id="${it.id}">−</button>
                  <span>${it.qty}</span>
                  <button data-action="cart-inc" data-id="${it.id}">+</button>
                </div>
                <div class="line-total">${it.lineTotal}</div>
                <span class="remove-link" data-action="cart-remove" data-id="${it.id}">Retirer</span>
              </div>
            `).join('')}
          </div>
          <div class="cart-summary">
            <div class="summary-row"><span>Sous-total</span><strong>${price(subtotalNum)}</strong></div>
            <div class="summary-row"><span>Livraison</span><strong>${shippingNum === 0 ? 'Gratuite' : price(shippingNum)}</strong></div>
            ${freeShipMissing ? `<p class="summary-note">Plus que ${freeShipMissing} d'achats pour la livraison gratuite !</p>` : ''}
            <div class="summary-total"><span>Total</span><span>${price(totalNum)}</span></div>

            <form id="checkout-form" data-action="submit-checkout">
              <label class="checkout-label">Nom complet</label>
              <input type="text" class="checkout-input" data-field="name" placeholder="Ton nom" value="${esc(state.checkout.name)}" required />
              <label class="checkout-label">Téléphone</label>
              <input type="tel" class="checkout-input" data-field="phone" placeholder="Ton numéro" value="${esc(state.checkout.phone)}" required />
              ${state.checkout.error ? `<p class="checkout-error">${esc(state.checkout.error)}</p>` : ''}
              <button type="submit" class="btn btn-dark checkout-btn" ${state.checkout.status === 'sending' ? 'disabled' : ''}>
                ${state.checkout.status === 'sending' ? 'Envoi en cours…' : 'Commander sur WhatsApp'}
              </button>
              <p class="checkout-hint">Tu seras redirigé·e vers WhatsApp pour finaliser ta commande avec nous.</p>
            </form>
          </div>
        </div>
      </main>
    `;
  }

  // ---- Render: root ----
  function render() {
    let body;
    if (state.view === 'shop') body = renderShop();
    else if (state.view === 'product') body = renderProduct();
    else if (state.view === 'cart') body = renderCart();
    else body = renderHome();

    app.innerHTML = renderHeader() + body + renderFooter();
  }

  // ---- Event delegation ----
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    const id = el.dataset.id ? Number(el.dataset.id) : null;

    switch (action) {
      case 'go-home': state.mobileNavOpen = false; location.hash = '#/'; break;
      case 'go-shop-all': state.mobileNavOpen = false; location.hash = '#/shop'; break;
      case 'go-shop-cat':
        state.mobileNavOpen = false;
        location.hash = el.dataset.cat === 'all' ? '#/shop' : `#/shop?cat=${encodeURIComponent(el.dataset.cat)}`;
        break;
      case 'go-home-box':
        state.mobileNavOpen = false;
        location.hash = '#/';
        setTimeout(() => { document.getElementById('newsletter')?.scrollIntoView({ behavior: 'smooth' }); }, 60);
        break;
      case 'go-cart': state.mobileNavOpen = false; location.hash = '#/cart'; break;
      case 'toggle-nav': state.mobileNavOpen = !state.mobileNavOpen; render(); break;
      case 'open-product': state.mobileNavOpen = false; location.hash = `#/product/${id}`; break;
      case 'add-to-cart': addToCart(id, 1); break;
      case 'add-current-to-cart': addToCart(id, state.qty); break;
      case 'inc-qty': {
        const product = state.products.find((p) => p.id === id);
        const max = product ? Math.max(1, product.stock) : 99;
        state.qty = Math.min(max, state.qty + 1);
        render();
        break;
      }
      case 'dec-qty': state.qty = Math.max(1, state.qty - 1); render(); break;
      case 'cart-inc': changeCartQty(id, 1); break;
      case 'cart-dec': changeCartQty(id, -1); break;
      case 'cart-remove': removeFromCart(id); break;
      case 'open-lightbox': openLightbox(el.dataset.src, el.dataset.alt); break;
    }
  });

  document.addEventListener('input', (e) => {
    if (e.target.dataset.action === 'input-search') {
      state.search = e.target.value;
      if (state.view === 'shop') {
        const cursorPos = e.target.selectionStart;
        render();
        const newInput = document.querySelector('[data-action="input-search"]');
        if (newInput) {
          newInput.focus();
          newInput.setSelectionRange(cursorPos, cursorPos);
        }
      }
    } else if (e.target.dataset.field === 'name') {
      state.checkout.name = e.target.value;
    } else if (e.target.dataset.field === 'phone') {
      state.checkout.phone = e.target.value;
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.dataset.action === 'set-sort') {
      state.sort = e.target.value;
      render();
    }
  });

  document.addEventListener('submit', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    e.preventDefault();
    if (el.dataset.action === 'submit-search') {
      state.mobileNavOpen = false;
      location.hash = '#/shop';
      render();
    } else if (el.dataset.action === 'submit-newsletter') {
      el.reset();
    } else if (el.dataset.action === 'submit-checkout') {
      submitCheckout();
    }
  });

  // ---- Auto-hide header on scroll down ----
  let lastScrollY = window.scrollY;
  window.addEventListener('scroll', () => {
    const header = document.querySelector('.site-header');
    if (!header) return;
    if (header.querySelector('.mobile-menu.open')) { lastScrollY = window.scrollY; return; }

    const currentY = window.scrollY;
    if (currentY > lastScrollY && currentY > 80) header.classList.add('header-hidden');
    else header.classList.remove('header-hidden');
    lastScrollY = currentY;
  }, { passive: true });

  // ---- Boot ----
  Object.assign(state, parseHash());
  render();
  loadData();
})();
