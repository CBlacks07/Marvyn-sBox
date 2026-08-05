(() => {
  'use strict';

  const TOKEN_KEY = 'mb_admin_token';

  const ICON_EDIT = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>';
  const ICON_TRASH = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
  const ICON_MENU = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
  const ICON_CLOSE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  const loginView = document.getElementById('login-view');
  const shell = document.getElementById('app-shell');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const contentEl = document.getElementById('content');
  const topbarTitle = document.getElementById('topbar-title');
  const topbarActions = document.getElementById('topbar-actions');
  const toastStack = document.getElementById('toast-stack');

  const state = {
    route: 'dashboard',
    products: [],
    categories: [],
    movements: [],
    orders: [],
    orderStatusFilter: 'all',
    stats: null,
    filters: { search: '', category: 'all', stock: 'all', sort: 'name' },
    movementFilter: 'all',
  };

  // ---- Auth ----
  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); }

  function showLogin(message) {
    loginView.hidden = false;
    shell.hidden = true;
    if (message) { loginError.textContent = message; loginError.hidden = false; }
  }

  async function showApp() {
    loginView.hidden = true;
    shell.hidden = false;
    await bootData();
    onRoute();
  }

  async function apiFetch(path, opts = {}) {
    const token = getToken();
    const headers = { ...(opts.headers || {}) };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(path, { ...opts, headers });
    if (res.status === 401) {
      clearToken();
      showLogin('Session expirée, reconnecte-toi.');
      throw new Error('unauthorized');
    }
    return res;
  }

  // ---- Toasts ----
  function toast(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    toastStack.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  // ---- Confirm dialog ----
  const confirmOverlay = document.getElementById('confirm-overlay');
  const confirmMessage = document.getElementById('confirm-message');
  const confirmOk = document.getElementById('confirm-ok');
  const confirmCancel = document.getElementById('confirm-cancel');
  let confirmResolver = null;

  function askConfirm(message) {
    confirmMessage.textContent = message;
    confirmOverlay.hidden = false;
    return new Promise((resolve) => { confirmResolver = resolve; });
  }
  function closeConfirm(result) {
    confirmOverlay.hidden = true;
    if (confirmResolver) { confirmResolver(result); confirmResolver = null; }
  }
  confirmOk.addEventListener('click', () => closeConfirm(true));
  confirmCancel.addEventListener('click', () => closeConfirm(false));
  confirmOverlay.addEventListener('click', (e) => { if (e.target === confirmOverlay) closeConfirm(false); });

  // ---- Helpers ----
  function applyAdminTheme(settings) {
    if (!settings) return;
    const root = document.documentElement.style;
    if (settings.adminColorBg) root.setProperty('--bg', settings.adminColorBg);
    if (settings.adminColorSidebar) root.setProperty('--dark', settings.adminColorSidebar);
    if (settings.adminColorGold) root.setProperty('--gold', settings.adminColorGold);
    if (settings.adminColorAccent) root.setProperty('--accent', settings.adminColorAccent);
    if (settings.logoUrl) {
      document.querySelectorAll('.login-logo, .sidebar-brand img').forEach((img) => { img.src = settings.logoUrl; });
    }
  }

  function money(n) { return Math.round(Number(n)).toLocaleString('fr-FR') + ' FCFA'; }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }
  function placeholderSvg() {
    return 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100%" height="100%" fill="#EADFC0"/></svg>'
    );
  }
  function categoryLabel(slug) {
    const c = state.categories.find((x) => x.slug === slug);
    return c ? c.label : slug;
  }
  function stockState(stock) {
    if (stock <= 0) return 'out';
    if (stock <= 5) return 'low';
    return 'ok';
  }
  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  // ---- Data loading ----
  async function bootData() {
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        apiFetch('/api/admin/products'),
        apiFetch('/api/admin/categories'),
      ]);
      state.products = await productsRes.json();
      state.categories = await categoriesRes.json();
    } catch (e) {
      if (e.message !== 'unauthorized') toast('Impossible de charger les données.', 'error');
    }
  }

  async function refreshProducts() {
    const res = await apiFetch('/api/admin/products');
    state.products = await res.json();
  }
  async function refreshCategories() {
    const res = await apiFetch('/api/admin/categories');
    state.categories = await res.json();
  }

  // ---- Routing ----
  const ROUTE_TITLES = {
    dashboard: 'Tableau de bord',
    articles: 'Articles',
    orders: 'Commandes',
    categories: 'Catégories',
    movements: 'Mouvements de stock',
    settings: 'Contenu du site',
  };

  function onRoute() {
    closeMobileMenu();
    const hash = location.hash.replace(/^#\/?/, '') || 'dashboard';
    state.route = ROUTE_TITLES[hash] ? hash : 'dashboard';
    topbarTitle.textContent = ROUTE_TITLES[state.route];

    document.querySelectorAll('.sidebar-nav .nav-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.route === state.route);
    });

    if (state.route === 'dashboard') renderDashboard();
    else if (state.route === 'articles') renderArticles();
    else if (state.route === 'orders') renderOrders();
    else if (state.route === 'categories') renderCategories();
    else if (state.route === 'movements') renderMovements();
    else if (state.route === 'settings') renderSettings();
  }
  window.addEventListener('hashchange', onRoute);

  document.querySelectorAll('.sidebar-nav .nav-item[data-route]').forEach((el) => {
    el.addEventListener('click', () => { location.hash = '#/' + el.dataset.route; });
  });

  // ---- Mobile nav menu (hamburger) ----
  const sidebarEl = document.querySelector('.sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebarMenu = document.getElementById('sidebar-menu');

  function closeMobileMenu() {
    sidebarMenu.classList.remove('open');
    sidebarToggle.innerHTML = ICON_MENU;
  }
  sidebarToggle.addEventListener('click', () => {
    const open = sidebarMenu.classList.toggle('open');
    sidebarToggle.innerHTML = open ? ICON_CLOSE : ICON_MENU;
  });

  let lastScrollY = window.scrollY;
  window.addEventListener('scroll', () => {
    if (sidebarMenu.classList.contains('open')) { lastScrollY = window.scrollY; return; }
    const currentY = window.scrollY;
    if (currentY > lastScrollY && currentY > 80) sidebarEl.classList.add('header-hidden');
    else sidebarEl.classList.remove('header-hidden');
    lastScrollY = currentY;
  }, { passive: true });

  // ==================================================================
  // DASHBOARD
  // ==================================================================
  async function renderDashboard() {
    topbarActions.innerHTML = '';
    contentEl.innerHTML = `<p class="empty-note">Chargement…</p>`;

    let stats;
    try {
      const res = await apiFetch('/api/admin/stats');
      stats = await res.json();
    } catch (e) {
      if (e.message === 'unauthorized') return;
      contentEl.innerHTML = `<p class="empty-note">Impossible de charger les statistiques.</p>`;
      return;
    }

    const alerts = state.products
      .filter((p) => p.active && p.stock <= 5)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 8);

    contentEl.innerHTML = `
      <div class="stat-grid">
        <div class="stat-tile ${stats.pendingOrders > 0 ? 'warn' : ''}" ${stats.pendingOrders > 0 ? 'data-action="goto-orders" style="cursor:pointer;"' : ''}>
          <span class="stat-label">Commandes en attente</span>
          <span class="stat-value">${stats.pendingOrders}</span>
        </div>
        <div class="stat-tile">
          <span class="stat-label">Articles</span>
          <span class="stat-value">${stats.totalArticles}</span>
        </div>
        <div class="stat-tile ok">
          <span class="stat-label">Valeur du stock</span>
          <span class="stat-value">${money(stats.stockValue)}</span>
        </div>
        <div class="stat-tile warn">
          <span class="stat-label">Stock faible (≤ 5)</span>
          <span class="stat-value">${stats.lowStock}</span>
        </div>
        <div class="stat-tile danger">
          <span class="stat-label">Ruptures de stock</span>
          <span class="stat-value">${stats.outOfStock}</span>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">À surveiller</div>
        ${alerts.length === 0
          ? `<p class="empty-note">Aucun article en stock faible ou en rupture.</p>`
          : `<div class="alert-list">${alerts.map((p) => `
              <div class="alert-row">
                <img src="${p.imageUrl || placeholderSvg()}" alt="" />
                <span class="name">${esc(p.name)}</span>
                <span class="tag ${p.stock <= 0 ? 'out' : 'low'}">${p.stock <= 0 ? 'Rupture' : p.stock + ' en stock'}</span>
                <button class="btn btn-ghost btn-sm" data-action="goto-article" data-id="${p.id}">Gérer</button>
              </div>
            `).join('')}</div>`
        }
      </div>
    `;
  }

  // ==================================================================
  // ARTICLES
  // ==================================================================
  function renderArticles() {
    topbarActions.innerHTML = `<button class="btn btn-primary" id="add-article-btn">+ Ajouter un article</button>`;
    document.getElementById('add-article-btn').addEventListener('click', () => openProductModal(null));

    const { search, category, stock, sort } = state.filters;
    let list = state.products.filter((p) => {
      if (category !== 'all' && p.category !== category) return false;
      if (stock !== 'all' && stockState(p.stock) !== stock) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'stock-asc') list = [...list].sort((a, b) => a.stock - b.stock);
    else if (sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);

    const catOptions = state.categories.map((c) => `<option value="${esc(c.slug)}" ${category === c.slug ? 'selected' : ''}>${esc(c.label)}</option>`).join('');

    contentEl.innerHTML = `
      <div class="toolbar">
        <input type="text" class="search-input" id="filter-search" placeholder="Rechercher un article…" value="${esc(search)}" />
        <select id="filter-category">
          <option value="all">Toutes les catégories</option>
          ${catOptions}
        </select>
        <select id="filter-stock">
          <option value="all" ${stock === 'all' ? 'selected' : ''}>Tous les stocks</option>
          <option value="ok" ${stock === 'ok' ? 'selected' : ''}>Stock ok</option>
          <option value="low" ${stock === 'low' ? 'selected' : ''}>Stock faible</option>
          <option value="out" ${stock === 'out' ? 'selected' : ''}>Rupture</option>
        </select>
        <select id="filter-sort">
          <option value="name" ${sort === 'name' ? 'selected' : ''}>Nom (A-Z)</option>
          <option value="stock-asc" ${sort === 'stock-asc' ? 'selected' : ''}>Stock croissant</option>
          <option value="price-desc" ${sort === 'price-desc' ? 'selected' : ''}>Prix décroissant</option>
        </select>
        <span class="spacer"></span>
        <span class="empty-note">${list.length} article(s)</span>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr><th></th><th>Nom</th><th>Catégorie</th><th>Prix</th><th>Stock</th><th>Visible</th><th></th></tr>
          </thead>
          <tbody id="articles-tbody">
            ${list.length === 0
              ? `<tr><td colspan="7" style="text-align:center;padding:40px;"><span class="empty-note">Aucun article ne correspond à ces filtres.</span></td></tr>`
              : list.map(articleRow).join('')
            }
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('filter-search').addEventListener('input', (e) => {
      state.filters.search = e.target.value;
      const cursor = e.target.selectionStart;
      renderArticles();
      const el = document.getElementById('filter-search');
      el.focus(); el.setSelectionRange(cursor, cursor);
    });
    document.getElementById('filter-category').addEventListener('change', (e) => { state.filters.category = e.target.value; renderArticles(); });
    document.getElementById('filter-stock').addEventListener('change', (e) => { state.filters.stock = e.target.value; renderArticles(); });
    document.getElementById('filter-sort').addEventListener('change', (e) => { state.filters.sort = e.target.value; renderArticles(); });

    const tbody = document.getElementById('articles-tbody');
    tbody.addEventListener('click', onArticleTableClick);
    tbody.addEventListener('change', onArticleTableChange);
  }

  function articleRow(p) {
    const sState = stockState(p.stock);
    return `
      <tr data-row-id="${p.id}">
        <td><img class="thumb" src="${p.imageUrl || placeholderSvg()}" alt="" /></td>
        <td>
          <span class="product-name-cell">${esc(p.name)}</span>
          ${p.badge ? `<span class="product-badge-chip">${esc(p.badge)}</span>` : ''}
        </td>
        <td>${esc(categoryLabel(p.category))}</td>
        <td>${money(p.price)}</td>
        <td>
          <div class="stock-cell">
            <button data-action="dec" data-id="${p.id}" title="Retirer 1">−</button>
            <span class="stock-badge ${sState}">${p.stock}</span>
            <button data-action="inc" data-id="${p.id}" title="Ajouter 1">+</button>
          </div>
        </td>
        <td>
          <label class="switch">
            <input type="checkbox" data-action="toggle-active" data-id="${p.id}" ${p.active ? 'checked' : ''} />
            <span class="switch-track"></span>
          </label>
        </td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" data-action="edit" data-id="${p.id}" title="Modifier">${ICON_EDIT}</button>
            <button class="icon-btn danger" data-action="delete" data-id="${p.id}" title="Supprimer">${ICON_TRASH}</button>
          </div>
        </td>
      </tr>
    `;
  }

  function patchRow(p) {
    const idx = state.products.findIndex((x) => x.id === p.id);
    if (idx >= 0) state.products[idx] = p;
    const row = document.querySelector(`tr[data-row-id="${p.id}"]`);
    if (row) row.outerHTML = articleRow(p);
  }

  async function onArticleTableClick(e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const action = btn.dataset.action;

    if (action === 'inc' || action === 'dec') {
      try {
        const res = await apiFetch(`/api/admin/products/${id}/stock`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ delta: action === 'inc' ? 1 : -1 }),
        });
        if (!res.ok) throw new Error();
        patchRow(await res.json());
      } catch (e2) {
        if (e2.message !== 'unauthorized') toast('Mise à jour du stock impossible.', 'error');
      }
    } else if (action === 'edit') {
      openProductModal(state.products.find((p) => p.id === id));
    } else if (action === 'delete') {
      const product = state.products.find((p) => p.id === id);
      if (!product) return;
      const ok = await askConfirm(`Supprimer définitivement « ${product.name} » ? Cette action est irréversible.`);
      if (!ok) return;
      try {
        const res = await apiFetch(`/api/admin/products/${id}`, { method: 'DELETE' });
        if (!res.ok && res.status !== 204) throw new Error();
        state.products = state.products.filter((p) => p.id !== id);
        renderArticles();
        toast('Article supprimé.', 'success');
      } catch (e2) {
        if (e2.message !== 'unauthorized') toast('Suppression impossible.', 'error');
      }
    }
  }

  async function onArticleTableChange(e) {
    if (e.target.dataset.action !== 'toggle-active') return;
    const id = Number(e.target.dataset.id);
    const checked = e.target.checked;
    try {
      const res = await apiFetch(`/api/admin/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: checked }),
      });
      if (!res.ok) throw new Error();
      const idx = state.products.findIndex((p) => p.id === id);
      if (idx >= 0) state.products[idx] = await res.json();
    } catch (e2) {
      e.target.checked = !checked;
      if (e2.message !== 'unauthorized') toast('Impossible de changer la visibilité.', 'error');
    }
  }

  // ---- Product modal ----
  const productModal = document.getElementById('product-modal');
  const productForm = document.getElementById('product-form');
  const modalTitle = document.getElementById('modal-title');
  const formError = document.getElementById('form-error');
  const imageInput = document.getElementById('f-image');
  const imagePreview = document.getElementById('f-image-preview');
  const dropzone = document.getElementById('dropzone');
  const dropzonePlaceholder = document.getElementById('dropzone-placeholder');
  const stockInput = document.getElementById('f-stock');
  const stockLabel = document.getElementById('f-stock-label');
  const stockHint = document.getElementById('f-stock-hint');
  let editingId = null;

  function openProductModal(product) {
    editingId = product ? product.id : null;
    modalTitle.textContent = product ? 'Modifier l’article' : 'Ajouter un article';
    formError.hidden = true;
    productForm.reset();
    imagePreview.hidden = true;
    dropzonePlaceholder.hidden = false;

    document.getElementById('f-category').innerHTML = state.categories
      .map((c) => `<option value="${esc(c.slug)}">${esc(c.label)}</option>`).join('');

    document.getElementById('f-name').value = product ? product.name : '';
    document.getElementById('f-category').value = product ? product.category : (state.categories[0]?.slug || '');
    document.getElementById('f-price').value = product ? product.price : '';
    document.getElementById('f-badge').value = product && product.badge ? product.badge : '';
    document.getElementById('f-description').value = product ? product.description : '';
    document.getElementById('f-active').checked = product ? product.active : true;

    stockInput.value = product ? product.stock : 0;
    stockInput.disabled = !!product;
    stockLabel.textContent = product ? 'Stock actuel' : 'Stock initial';
    stockHint.hidden = !product;

    if (product && product.imageUrl) {
      imagePreview.src = product.imageUrl;
      imagePreview.hidden = false;
      dropzonePlaceholder.hidden = true;
    }

    productModal.hidden = false;
  }

  function closeProductModal() { productModal.hidden = true; editingId = null; }

  document.getElementById('modal-cancel').addEventListener('click', closeProductModal);
  productModal.addEventListener('click', (e) => { if (e.target === productModal) closeProductModal(); });

  function setPreviewFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      imagePreview.src = reader.result;
      imagePreview.hidden = false;
      dropzonePlaceholder.hidden = true;
    };
    reader.readAsDataURL(file);
  }

  dropzone.addEventListener('click', () => imageInput.click());
  imageInput.addEventListener('change', () => setPreviewFile(imageInput.files[0]));
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    imageInput.files = e.dataTransfer.files;
    setPreviewFile(file);
  });

  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.hidden = true;

    const fd = new FormData();
    fd.append('name', document.getElementById('f-name').value.trim());
    fd.append('category', document.getElementById('f-category').value);
    fd.append('price', document.getElementById('f-price').value);
    fd.append('badge', document.getElementById('f-badge').value.trim());
    fd.append('description', document.getElementById('f-description').value.trim());
    fd.append('active', document.getElementById('f-active').checked ? 'true' : 'false');
    if (!editingId) fd.append('stock', stockInput.value);
    if (imageInput.files[0]) fd.append('image', imageInput.files[0]);

    const url = editingId ? `/api/admin/products/${editingId}` : '/api/admin/products';
    const method = editingId ? 'PUT' : 'POST';

    try {
      const res = await apiFetch(url, { method, body: fd });
      const saved = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(saved.error || 'Enregistrement impossible');

      if (editingId) {
        patchRow(saved);
        toast('Article mis à jour.', 'success');
      } else {
        state.products.push(saved);
        toast('Article ajouté.', 'success');
        if (state.route === 'articles') renderArticles();
      }
      closeProductModal();
    } catch (err) {
      if (err.message !== 'unauthorized') {
        formError.textContent = err.message;
        formError.hidden = false;
      }
    }
  });

  contentEl.addEventListener('click', (e) => {
    const articleBtn = e.target.closest('[data-action="goto-article"]');
    if (articleBtn) {
      location.hash = '#/articles';
      setTimeout(() => openProductModal(state.products.find((p) => p.id === Number(articleBtn.dataset.id))), 50);
      return;
    }
    const ordersTile = e.target.closest('[data-action="goto-orders"]');
    if (ordersTile) {
      location.hash = '#/orders';
    }
  });

  // ==================================================================
  // ORDERS
  // ==================================================================
  const ORDER_STATUS_LABELS = { pending: 'En attente', confirmed: 'Confirmée', cancelled: 'Annulée' };

  async function renderOrders() {
    topbarActions.innerHTML = '';
    contentEl.innerHTML = `<p class="empty-note">Chargement…</p>`;

    try {
      const res = await apiFetch('/api/admin/orders');
      if (!res.ok) throw new Error();
      state.orders = await res.json();
    } catch (e) {
      if (e.message === 'unauthorized') return;
      contentEl.innerHTML = `<p class="empty-note">Impossible de charger les commandes.</p>`;
      return;
    }

    const filter = state.orderStatusFilter || 'all';
    const list = filter === 'all' ? state.orders : state.orders.filter((o) => o.status === filter);
    const pendingCount = state.orders.filter((o) => o.status === 'pending').length;

    contentEl.innerHTML = `
      <div class="toolbar">
        <select id="order-status-filter">
          <option value="all" ${filter === 'all' ? 'selected' : ''}>Toutes les commandes</option>
          <option value="pending" ${filter === 'pending' ? 'selected' : ''}>En attente${pendingCount ? ` (${pendingCount})` : ''}</option>
          <option value="confirmed" ${filter === 'confirmed' ? 'selected' : ''}>Confirmées</option>
          <option value="cancelled" ${filter === 'cancelled' ? 'selected' : ''}>Annulées</option>
        </select>
        <span class="spacer"></span>
        <span class="empty-note">${list.length} commande(s)</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Client</th><th>Articles</th><th>Total</th><th>Statut</th><th>Date</th><th></th></tr></thead>
          <tbody id="orders-tbody">
            ${list.length === 0
              ? `<tr><td colspan="7" style="text-align:center;padding:40px;"><span class="empty-note">Aucune commande.</span></td></tr>`
              : list.map(orderRow).join('')
            }
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('order-status-filter').addEventListener('change', (e) => {
      state.orderStatusFilter = e.target.value;
      renderOrders();
    });
    document.getElementById('orders-tbody').addEventListener('click', onOrderTableClick);
  }

  function orderRow(o) {
    const itemsLabel = o.items.map((it) => `${it.qty}x ${it.name}`).join(', ');
    let actions = '';
    if (o.status === 'pending') {
      actions = `
        <button class="btn btn-primary btn-sm" data-action="confirm-order" data-id="${o.id}">Confirmer</button>
        <button class="btn btn-ghost btn-sm" data-action="cancel-order" data-id="${o.id}">Annuler</button>
      `;
    } else if (o.status === 'confirmed') {
      actions = `<button class="btn btn-ghost btn-sm" data-action="cancel-order" data-id="${o.id}">Annuler</button>`;
    }
    return `
      <tr data-order-row="${o.id}">
        <td class="muted">#${o.id}</td>
        <td>
          <div class="product-name-cell">${esc(o.customerName)}</div>
          <div class="muted">${esc(o.customerPhone)}</div>
        </td>
        <td class="muted" title="${esc(itemsLabel)}" style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(itemsLabel)}</td>
        <td>${money(o.total)}</td>
        <td><span class="stock-badge ${o.status === 'confirmed' ? 'ok' : o.status === 'cancelled' ? 'out' : 'low'}">${ORDER_STATUS_LABELS[o.status]}</span></td>
        <td class="muted">${formatDate(o.createdAt)}</td>
        <td><div class="row-actions">${actions}</div></td>
      </tr>
    `;
  }

  async function onOrderTableClick(e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const action = btn.dataset.action;
    const order = state.orders.find((o) => o.id === id);
    if (!order) return;

    if (action === 'confirm-order') {
      const ok = await askConfirm(`Confirmer la commande #${id} ? Le stock des articles commandés sera automatiquement déduit.`);
      if (!ok) return;
      await changeOrderStatus(id, 'confirmed');
    } else if (action === 'cancel-order') {
      const restockNote = order.status === 'confirmed' ? ' Le stock déjà déduit sera restitué.' : '';
      const ok = await askConfirm(`Annuler la commande #${id} ?${restockNote}`);
      if (!ok) return;
      await changeOrderStatus(id, 'cancelled');
    }
  }

  async function changeOrderStatus(id, status) {
    try {
      const res = await apiFetch(`/api/admin/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      state.orders = state.orders.map((o) => (o.id === id ? updated : o));
      const row = document.querySelector(`tr[data-order-row="${id}"]`);
      if (row) row.outerHTML = orderRow(updated);
      await refreshProducts();
      toast(status === 'confirmed' ? 'Commande confirmée, stock mis à jour.' : 'Commande annulée.', 'success');
    } catch (e) {
      if (e.message !== 'unauthorized') toast('Impossible de mettre à jour la commande.', 'error');
    }
  }

  // ==================================================================
  // CATEGORIES
  // ==================================================================
  function renderCategories() {
    topbarActions.innerHTML = `<button class="btn btn-primary" id="add-category-btn">+ Ajouter une catégorie</button>`;
    document.getElementById('add-category-btn').addEventListener('click', () => openCategoryModal(null));

    contentEl.innerHTML = `
      <div class="table-wrap">
        ${state.categories.map((c) => {
          const count = state.products.filter((p) => p.category === c.slug).length;
          return `
            <div class="category-row">
              <div class="cat-badge">${esc(c.initial)}</div>
              <span class="label">${esc(c.label)}</span>
              <span class="count">${count} article(s)</span>
              <div class="row-actions">
                <button class="icon-btn" data-action="edit-cat" data-slug="${esc(c.slug)}" title="Modifier">${ICON_EDIT}</button>
                <button class="icon-btn danger" data-action="delete-cat" data-slug="${esc(c.slug)}" title="Supprimer">${ICON_TRASH}</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    contentEl.querySelectorAll('[data-action="edit-cat"]').forEach((btn) => {
      btn.addEventListener('click', () => openCategoryModal(state.categories.find((c) => c.slug === btn.dataset.slug)));
    });
    contentEl.querySelectorAll('[data-action="delete-cat"]').forEach((btn) => {
      btn.addEventListener('click', () => deleteCategory(btn.dataset.slug));
    });
  }

  async function deleteCategory(slug) {
    const cat = state.categories.find((c) => c.slug === slug);
    if (!cat) return;
    const count = state.products.filter((p) => p.category === slug).length;
    if (count > 0) {
      toast(`Impossible : ${count} article(s) utilisent encore « ${cat.label} ».`, 'error');
      return;
    }
    const ok = await askConfirm(`Supprimer la catégorie « ${cat.label} » ?`);
    if (!ok) return;
    try {
      const res = await apiFetch(`/api/admin/categories/${slug}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error();
      await refreshCategories();
      renderCategories();
      toast('Catégorie supprimée.', 'success');
    } catch (e) {
      if (e.message !== 'unauthorized') toast('Suppression impossible.', 'error');
    }
  }

  const categoryModal = document.getElementById('category-modal');
  const categoryForm = document.getElementById('category-form');
  const categoryModalTitle = document.getElementById('category-modal-title');
  const categoryFormError = document.getElementById('category-form-error');
  const slugInput = document.getElementById('c-slug');
  const slugHint = document.getElementById('c-slug-hint');
  let editingSlug = null;

  function openCategoryModal(category) {
    editingSlug = category ? category.slug : null;
    categoryModalTitle.textContent = category ? 'Modifier la catégorie' : 'Ajouter une catégorie';
    categoryFormError.hidden = true;
    categoryForm.reset();

    document.getElementById('c-label').value = category ? category.label : '';
    slugInput.value = category ? category.slug : '';
    slugInput.disabled = !!category;
    slugHint.hidden = !category;
    document.getElementById('c-initial').value = category ? category.initial : '';

    categoryModal.hidden = false;
  }
  function closeCategoryModal() { categoryModal.hidden = true; editingSlug = null; }
  document.getElementById('category-modal-cancel').addEventListener('click', closeCategoryModal);
  categoryModal.addEventListener('click', (e) => { if (e.target === categoryModal) closeCategoryModal(); });

  categoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    categoryFormError.hidden = true;

    const payload = {
      label: document.getElementById('c-label').value.trim(),
      initial: document.getElementById('c-initial').value.trim(),
    };
    if (!editingSlug) payload.slug = slugInput.value.trim();

    const url = editingSlug ? `/api/admin/categories/${editingSlug}` : '/api/admin/categories';
    const method = editingSlug ? 'PUT' : 'POST';

    try {
      const res = await apiFetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Enregistrement impossible');
      await refreshCategories();
      renderCategories();
      toast('Catégorie enregistrée.', 'success');
      closeCategoryModal();
    } catch (err) {
      if (err.message !== 'unauthorized') {
        categoryFormError.textContent = err.message;
        categoryFormError.hidden = false;
      }
    }
  });

  // ==================================================================
  // STOCK MOVEMENTS
  // ==================================================================
  async function renderMovements() {
    topbarActions.innerHTML = '';
    const productOptions = state.products.map((p) => `<option value="${p.id}" ${state.movementFilter === String(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('');

    contentEl.innerHTML = `
      <div class="toolbar">
        <select id="movement-filter">
          <option value="all">Tous les articles</option>
          ${productOptions}
        </select>
        <span class="spacer"></span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th></th><th>Article</th><th>Variation</th><th>Stock résultant</th><th>Raison</th><th>Date</th></tr></thead>
          <tbody id="movements-tbody"><tr><td colspan="6" style="text-align:center;padding:30px;"><span class="empty-note">Chargement…</span></td></tr></tbody>
        </table>
      </div>
    `;

    document.getElementById('movement-filter').value = state.movementFilter;
    document.getElementById('movement-filter').addEventListener('change', (e) => {
      state.movementFilter = e.target.value;
      loadMovements();
    });

    loadMovements();
  }

  async function loadMovements() {
    const tbody = document.getElementById('movements-tbody');
    const productId = state.movementFilter !== 'all' ? `?productId=${state.movementFilter}` : '';
    try {
      const res = await apiFetch(`/api/admin/stock-movements${productId}`);
      if (!res.ok) throw new Error();
      const movements = await res.json();
      if (!tbody) return;
      tbody.innerHTML = movements.length === 0
        ? `<tr><td colspan="6" style="text-align:center;padding:30px;"><span class="empty-note">Aucun mouvement pour l'instant.</span></td></tr>`
        : movements.map((m) => `
            <tr>
              <td><img class="thumb" src="${m.productImageUrl || placeholderSvg()}" alt="" /></td>
              <td>${esc(m.productName)}</td>
              <td class="${m.delta > 0 ? 'delta-pos' : 'delta-neg'}">${m.delta > 0 ? '+' : ''}${m.delta}</td>
              <td>${m.resultingStock}</td>
              <td class="muted">${esc(m.reason || '—')}</td>
              <td class="muted">${formatDate(m.createdAt)}</td>
            </tr>
          `).join('');
    } catch (e) {
      if (e.message !== 'unauthorized' && tbody) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;"><span class="empty-note">Impossible de charger l'historique.</span></td></tr>`;
      }
    }
  }

  // ==================================================================
  // SITE CONTENT (settings)
  // ==================================================================
  function imgField(id, labelText, currentUrl) {
    return `
      <label>${labelText}</label>
      <div class="dropzone" id="${id}-zone">
        <img id="${id}-preview" class="image-preview" src="${currentUrl || ''}" ${currentUrl ? '' : 'hidden'} />
        <div id="${id}-placeholder" class="dropzone-placeholder" ${currentUrl ? 'hidden' : ''}>
          <span>Glisse une image ici ou clique pour parcourir</span>
          <span class="dropzone-sub">PNG, JPEG ou WebP — 5 Mo max</span>
        </div>
        <input type="file" id="${id}-input" accept="image/png,image/jpeg,image/webp" hidden />
      </div>
    `;
  }

  function wireImgField(id) {
    const zone = document.getElementById(`${id}-zone`);
    const input = document.getElementById(`${id}-input`);
    const preview = document.getElementById(`${id}-preview`);
    const placeholder = document.getElementById(`${id}-placeholder`);

    const setFile = (file) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { preview.src = reader.result; preview.hidden = false; placeholder.hidden = true; };
      reader.readAsDataURL(file);
    };

    zone.addEventListener('click', () => input.click());
    input.addEventListener('change', () => setFile(input.files[0]));
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (!file) return;
      input.files = e.dataTransfer.files;
      setFile(file);
    });
  }

  async function renderSettings() {
    topbarActions.innerHTML = '';
    contentEl.innerHTML = `<p class="empty-note">Chargement…</p>`;

    let s;
    try {
      const res = await apiFetch('/api/admin/settings');
      s = await res.json();
    } catch (e) {
      if (e.message === 'unauthorized') return;
      contentEl.innerHTML = `<p class="empty-note">Impossible de charger les paramètres.</p>`;
      return;
    }

    contentEl.innerHTML = `
      <form id="settings-form">
        <div class="panel">
          <div class="panel-title">Identité</div>
          ${imgField('logo', 'Logo du site', s.logoUrl)}
          <label>Nom du site</label>
          <input type="text" id="s-siteName" value="${esc(s.siteName)}" required />
          <label>Description (pied de page)</label>
          <textarea id="s-siteDescription" rows="2">${esc(s.siteDescription)}</textarea>
        </div>

        <div class="panel">
          <div class="panel-title">Commandes WhatsApp</div>
          <label>Numéro WhatsApp de la boutique</label>
          <input type="text" id="s-whatsappNumber" value="${esc(s.whatsappNumber)}" placeholder="+228 90 xx xx xx" />
          <div class="field-hint">Avec l'indicatif pays. C'est ce numéro qui recevra les commandes envoyées par les clients.</div>
        </div>

        <div class="panel">
          <div class="panel-title">Couleurs — site public</div>
          <div class="field-row">
            <div><label>Fond</label><input type="color" id="s-colorBg" value="${esc(s.colorBg)}" /></div>
            <div><label>En-tête / pied de page</label><input type="color" id="s-colorDark" value="${esc(s.colorDark)}" /></div>
          </div>
          <div class="field-row">
            <div><label>Accent (boutons)</label><input type="color" id="s-colorAccent" value="${esc(s.colorAccent)}" /></div>
            <div><label>Accent au survol</label><input type="color" id="s-colorAccentHover" value="${esc(s.colorAccentHover)}" /></div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-title">Couleurs — administration</div>
          <div class="field-hint" style="margin:0 0 12px;">S'applique uniquement à cet espace d'administration, indépendamment des couleurs du site public.</div>
          <div class="field-row">
            <div><label>Fond</label><input type="color" id="s-adminColorBg" value="${esc(s.adminColorBg)}" /></div>
            <div><label>Barre latérale</label><input type="color" id="s-adminColorSidebar" value="${esc(s.adminColorSidebar)}" /></div>
          </div>
          <div class="field-row">
            <div><label>Accent doré</label><input type="color" id="s-adminColorGold" value="${esc(s.adminColorGold)}" /></div>
            <div><label>Accent boutons</label><input type="color" id="s-adminColorAccent" value="${esc(s.adminColorAccent)}" /></div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-title">Page d'accueil — bandeau héro</div>
          <label>Étiquette</label>
          <input type="text" id="s-heroEyebrow" value="${esc(s.heroEyebrow)}" />
          <label>Titre (une ligne par retour à la ligne)</label>
          <textarea id="s-heroTitle" rows="2">${esc(s.heroTitle)}</textarea>
          <label>Sous-titre</label>
          <textarea id="s-heroSubtitle" rows="2">${esc(s.heroSubtitle)}</textarea>
          <label>Texte du badge sur la photo</label>
          <input type="text" id="s-heroBadgeLabel" value="${esc(s.heroBadgeLabel)}" />
          ${imgField('heroImage', 'Photo héro', s.heroImageUrl)}
        </div>

        <div class="panel">
          <div class="panel-title">Bandeau abonnement</div>
          <label>Étiquette</label>
          <input type="text" id="s-promoEyebrow" value="${esc(s.promoEyebrow)}" />
          <label>Titre</label>
          <input type="text" id="s-promoTitle" value="${esc(s.promoTitle)}" />
          <label>Texte</label>
          <textarea id="s-promoText" rows="2">${esc(s.promoText)}</textarea>
          <label>Texte du bouton</label>
          <input type="text" id="s-promoButtonLabel" value="${esc(s.promoButtonLabel)}" />
          ${imgField('promoImage', 'Photo du bandeau', s.promoImageUrl)}
        </div>

        <div class="panel">
          <div class="panel-title">Newsletter</div>
          <label>Titre</label>
          <input type="text" id="s-newsletterTitle" value="${esc(s.newsletterTitle)}" />
          <label>Texte</label>
          <textarea id="s-newsletterText" rows="2">${esc(s.newsletterText)}</textarea>
        </div>

        <div class="panel">
          <div class="panel-title">Pied de page</div>
          <div class="field-row">
            <div><label>Lien "Livraison"</label><input type="text" id="s-footerShippingText" value="${esc(s.footerShippingText)}" /></div>
            <div><label>Lien "FAQ"</label><input type="text" id="s-footerFaqText" value="${esc(s.footerFaqText)}" /></div>
          </div>
          <div class="field-row">
            <div><label>Lien "Contact"</label><input type="text" id="s-footerContactText" value="${esc(s.footerContactText)}" /></div>
            <div><label>Copyright</label><input type="text" id="s-copyrightText" value="${esc(s.copyrightText)}" /></div>
          </div>
        </div>

        <div id="settings-error" class="field-error" hidden></div>
        <button type="submit" class="btn btn-primary">Enregistrer les modifications</button>
      </form>
    `;

    wireImgField('logo');
    wireImgField('heroImage');
    wireImgField('promoImage');

    document.getElementById('settings-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById('settings-error');
      errorEl.hidden = true;

      const fd = new FormData();
      const textIds = [
        'siteName', 'siteDescription', 'whatsappNumber', 'colorBg', 'colorDark', 'colorAccent', 'colorAccentHover',
        'adminColorBg', 'adminColorSidebar', 'adminColorGold', 'adminColorAccent',
        'heroEyebrow', 'heroTitle', 'heroSubtitle', 'heroBadgeLabel',
        'promoEyebrow', 'promoTitle', 'promoText', 'promoButtonLabel',
        'newsletterTitle', 'newsletterText',
        'footerShippingText', 'footerFaqText', 'footerContactText', 'copyrightText',
      ];
      for (const id of textIds) fd.append(id, document.getElementById(`s-${id}`).value);

      const logoFile = document.getElementById('logo-input').files[0];
      const heroFile = document.getElementById('heroImage-input').files[0];
      const promoFile = document.getElementById('promoImage-input').files[0];
      if (logoFile) fd.append('logo', logoFile);
      if (heroFile) fd.append('heroImage', heroFile);
      if (promoFile) fd.append('promoImage', promoFile);

      try {
        const res = await apiFetch('/api/admin/settings', { method: 'PUT', body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Enregistrement impossible');
        applyAdminTheme(data);
        toast('Contenu du site mis à jour.', 'success');
        renderSettings();
      } catch (err) {
        if (err.message !== 'unauthorized') {
          errorEl.textContent = err.message;
          errorEl.hidden = false;
        }
      }
    });
  }

  // ==================================================================
  // Login / logout wiring
  // ==================================================================
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Connexion impossible');
      setToken(data.token);
      showApp();
    } catch (err) {
      loginError.textContent = err.message;
      loginError.hidden = false;
    }
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    clearToken();
    showLogin();
  });

  // ---- Boot ----
  fetch('/api/settings')
    .then((res) => (res.ok ? res.json() : null))
    .then(applyAdminTheme)
    .catch(() => {});

  if (getToken()) showApp();
  else showLogin();
})();
