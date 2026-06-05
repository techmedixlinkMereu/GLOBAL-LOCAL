// ─────────────────────────────────────────────────────────────────
// TechMedixLink · js/main.js
// Vue app entry point — wires state + actions into setup()
// ─────────────────────────────────────────────────────────────────

import * as S from './state.js';
import * as A from './actions.js';
import * as F from './formatters.js';
import { sb } from './db.js';
import { TECHMEDIX_CONFIG } from '../config.js';

const { createApp, ref, computed, watch, onMounted, nextTick } = Vue;

const app = createApp({
  setup() {

    // At-risk requests (quoted > 48h not accepted)
    const atRiskRequests = computed(() => {
      return A.getAtRiskRequests(S.allRequests.value);
    });

    // Search autocomplete suggestions
    const searchSuggestions = computed(() => {
      if (!S.globalSearch.value || S.globalSearch.value.length < 2) return [];
      const q = S.globalSearch.value.toLowerCase();
      return S.products.value
        .filter(p => p.is_active && (
          p.name?.toLowerCase().includes(q) ||
          p.manufacturer?.toLowerCase().includes(q) ||
          p.product_type?.toLowerCase().includes(q)
        ))
        .slice(0, 6);
    });

    // Landing page filtered products
    const lpFilteredProducts = computed(() => {
      let list = S.products.value.filter(p => p.is_active);
      if (S.lpCatFilter.value !== 'all') list = list.filter(p => p.product_type === S.lpCatFilter.value);
      if (S.lpTmdaOnly.value) list = list.filter(p => p.tmda_certified);
      if (S.lpSort.value === 'price_asc')  list = [...list].sort((a,b) => a.base_price_usd - b.base_price_usd);
      if (S.lpSort.value === 'price_desc') list = [...list].sort((a,b) => b.base_price_usd - a.base_price_usd);
      if (S.lpSort.value === 'tmda')       list = [...list].sort((a,b) => (b.tmda_certified?1:0) - (a.tmda_certified?1:0));
      return list;
    });

    // FIX 17: Products loading skeleton state
    const productsLoading = computed(() => S.products.value.length === 0 && S.loading.value);

    // ── Computed: roles ─────────────────────────────────────────
    const isAdmin = computed(() => S.profile.value?.user_role === 'admin');
    const canBuy  = computed(() => !S.profile.value || ['buyer', 'both'].includes(S.profile.value?.user_role));
    const canSell = computed(() => !!S.profile.value && ['seller', 'both'].includes(S.profile.value?.user_role));

    // ── Computed: UI ────────────────────────────────────────────
    const pageTitle = computed(() => ({
      home: 'Dashboard', browse: 'Browse Products', 'my-requests': 'My Requests',
      'my-listings': 'My Listings', inquiries: 'Inquiries', 'seller-analytics': 'My Analytics',
      tracking: 'Tracking', payments: 'Payments', admin: 'Admin Panel',
      'admin-users': 'All Users', 'admin-listings': 'All Listings',
      analytics: 'Analytics', shoppers: 'Shoppers'
    })[S.tab.value] || 'TechMedixLink');

    const primaryLabel = computed(() => {
      if (!S.profile.value) return 'Sign In';
      if (isAdmin.value) return 'Admin';
      if (canBuy.value) return 'Request';
      if (canSell.value) return 'List Product';
      return 'Browse';
    });

    const userInitial = computed(() => S.profile.value?.full_name?.charAt(0)?.toUpperCase() || '?');
    const today = computed(() => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    const unreadCount = computed(() => S.notifications.value.filter(n => !n.is_read).length);
    const uniqueCats  = computed(() => new Set(S.products.value.map(p => p.product_type).filter(Boolean)).size);

    const groupedNotifications = computed(() => {
      const groups = {};
      S.notifications.value.forEach(n => {
        const type = n.notification_type || 'general';
        if (!groups[type]) groups[type] = [];
        groups[type].push(n);
      });
      return groups;
    });

    // ── Computed: request aggregates ────────────────────────────
    const myRequests   = computed(() => !S.profile.value ? [] : S.allRequests.value.filter(r => r.user_id === S.profile.value.id));
    const myListings   = computed(() => !S.profile.value ? [] : S.products.value.filter(p => p.user_id === S.profile.value.id));

    const incomingReqs = computed(() => {
      if (!S.profile.value || !canSell.value) return [];
      const myProdIds = myListings.value.map(p => p.id);
      return S.allRequests.value.filter(r => r.items?.some(it => myProdIds.includes(it.product_id)));
    });

    const myActiveReqs    = computed(() => myRequests.value.filter(r => !['delivered', 'completed', 'cancelled', 'installed'].includes(r.status)));
    const myDoneReqs      = computed(() => myRequests.value.filter(r => ['delivered', 'completed', 'installed'].includes(r.status)));
    const myTotalSpent    = computed(() => myRequests.value.reduce((s, r) => s + (r.deposit_paid || 0), 0));
    const myBalanceDue    = computed(() => myRequests.value.reduce((s, r) => s + (r.balance_due || 0), 0));
    const pendingPayCount = computed(() => myRequests.value.filter(r => (r.balance_due || 0) > 0).length);
    const pendingAdminCount = computed(() => S.allRequests.value.filter(r => r.status === 'pending').length);
    const avgListingPrice = computed(() => !myListings.value.length ? 0 : myListings.value.reduce((s, p) => s + (p.base_price_usd || 0), 0) / myListings.value.length);

    // ── Computed: selected product for request form ─────────────
    const selectedProduct = computed(() => S.rF.product_id ? S.products.value.find(p => p.id === S.rF.product_id) : null);

    const reqCostEstimate = computed(() => {
      const p = selectedProduct.value;
      if (!p) return { items: 0, shipping: 0, duty: 0, fee: 0, total: 0 };
      const items    = Math.round(p.base_price_usd * S.rF.quantity * S.usdToTzs.value);
      const shipping = Math.round(items * TECHMEDIX_CONFIG.app.shippingPercent);
      const duty     = S.rF.platform_type === 'globaldoor' ? Math.round(items * ((p.import_duty_percent || 25) / 100)) : 0;
      const fee      = Math.round((items + shipping + duty) * TECHMEDIX_CONFIG.app.serviceFeePercent);
      return { items, shipping, duty, fee, total: items + shipping + duty + fee };
    });

    // ── Computed: basket ────────────────────────────────────────
    const basketTotal = computed(() => S.basket.value.reduce((s, i) => s + (i.product.base_price_usd * i.quantity * (S.usdToTzs.value || 2650)), 0));
    const basketCount = computed(() => S.basket.value.reduce((s, i) => s + i.quantity, 0));

    // ── Computed: filtered lists ─────────────────────────────────
    const filteredProds = computed(() => {
      let list = S.products.value.filter(p => p.is_active);
      if (S.prodSearch.value) { const q = S.prodSearch.value.toLowerCase(); list = list.filter(p => p.name?.toLowerCase().includes(q) || p.manufacturer?.toLowerCase().includes(q) || p.country?.toLowerCase().includes(q)); }
      if (S.prodFilter.value !== 'all') {
        if (S.prodFilter.value === 'techmedix')      list = list.filter(p => p.platform_type === 'techmedix');
        else if (S.prodFilter.value === 'globaldoor') list = list.filter(p => p.platform_type === 'globaldoor');
        else if (S.prodFilter.value === 'tmda')       list = list.filter(p => p.tmda_certified);
        else if (S.prodFilter.value === 'local')      list = list.filter(p => p.country?.toLowerCase().includes('tanzania'));
        else if (S.prodFilter.value === 'international') list = list.filter(p => !p.country?.toLowerCase().includes('tanzania'));
      }
      if (S.prodTypeFilter.value !== 'all') list = list.filter(p => p.product_type === S.prodTypeFilter.value);
      if (S.filterTmda.value)   list = list.filter(p => p.tmda_certified);
      if (S.priceMin.value > 0) list = list.filter(p => (p.base_price_usd || 0) >= S.priceMin.value);
      if (S.priceMax.value < 100000) list = list.filter(p => (p.base_price_usd || 0) <= S.priceMax.value);
      if (S.manufFilter.value)  { const q = S.manufFilter.value.toLowerCase(); list = list.filter(p => p.manufacturer?.toLowerCase().includes(q)); }
      if (S.filterInStock.value) list = list.filter(p => (p.stock_quantity || 0) > 0);
      if (S.sortProd.value === 'price_asc')   list = [...list].sort((a, b) => (a.base_price_usd || 0) - (b.base_price_usd || 0));
      else if (S.sortProd.value === 'price_desc') list = [...list].sort((a, b) => (b.base_price_usd || 0) - (a.base_price_usd || 0));
      else if (S.sortProd.value === 'name')   list = [...list].sort((a, b) => a.name?.localeCompare(b.name) || 0);
      else list = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return list;
    });

    const filteredMyReqs = computed(() => {
      let list = myRequests.value;
      if (S.reqSearch.value)       list = list.filter(r => r.request_number?.toLowerCase().includes(S.reqSearch.value.toLowerCase()));
      if (S.reqFilter.value !== 'all')    list = list.filter(r => r.status === S.reqFilter.value);
      if (S.reqPlatFilter.value !== 'all') list = list.filter(r => r.platform_type === S.reqPlatFilter.value);
      return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    });

    const filteredAdminReqs = computed(() => {
      let list = S.allRequests.value;
      if (S.adminReqSearch.value) {
        const q = S.adminReqSearch.value.toLowerCase();
        list = list.filter(r => {
          const buyer = S.adminUsers.value.find(u => u.id === r.user_id);
          return r.request_number?.toLowerCase().includes(q)
            || buyer?.full_name?.toLowerCase().includes(q)
            || buyer?.email?.toLowerCase().includes(q)
            || buyer?.phone?.includes(q);
        });
      }
      if (S.adminReqFilter.value !== 'all')   list = list.filter(r => r.status === S.adminReqFilter.value);
      if (S.adminPlatFilter.value !== 'all')  list = list.filter(r => r.platform_type === S.adminPlatFilter.value);
      return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    });

    const filteredAdminUsers = computed(() => {
      let users = S.adminUsers.value;
      if (S.adminUserSearch.value) {
        const q = S.adminUserSearch.value.toLowerCase();
        users = users.filter(u => u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.phone?.includes(q));
      }
      if (S.adminUserRoleFilter.value !== 'all') users = users.filter(u => u.user_role === S.adminUserRoleFilter.value);
      return users;
    });

    const recentActivity = computed(() => {
      return myRequests.value.slice().sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)).slice(0, 5)
        .map(r => ({ id: r.id, title: r.request_number, sub: F.fDate(r.created_at), status: r.status, ico: r.platform_type === 'techmedix' ? 'tm' : 'gd', icon: r.platform_type === 'techmedix' ? 'fas fa-heart-pulse' : 'fas fa-globe' }));
    });

    const allManufacturers = computed(() => [...new Set(S.products.value.map(p => p.manufacturer).filter(Boolean))].sort());

    const browseSubtitle = computed(() => {
      const total = S.products.value.filter(p => p.is_active).length;
      const shown = filteredProds.value.length;
      const parts = [];
      if (S.prodFilter.value === 'techmedix')      parts.push('TechMedixLink');
      if (S.prodFilter.value === 'globaldoor')     parts.push('GlobalDoor');
      if (S.prodFilter.value === 'tmda')           parts.push('TMDA certified');
      if (S.prodFilter.value === 'local')          parts.push('Tanzania stock');
      if (S.prodFilter.value === 'international')  parts.push('International');
      if (S.prodTypeFilter.value !== 'all')        parts.push(S.prodTypeFilter.value.replace(/_/g, ' '));
      if (S.filterTmda.value)                      parts.push('TMDA only');
      if (S.filterInStock.value)                   parts.push('in stock');
      if (S.prodSearch.value)                      parts.push('"' + S.prodSearch.value + '"');
      const label = parts.length ? parts.join(' · ') : 'all platforms';
      return shown === total ? total + ' products · ' + label : shown + ' of ' + total + ' · ' + label;
    });

    const activeFilterCount = computed(() => {
      let n = 0;
      if (S.prodFilter.value !== 'all')     n++;
      if (S.prodTypeFilter.value !== 'all') n++;
      if (S.filterTmda.value)               n++;
      if (S.filterInStock.value)            n++;
      if (S.prodSearch.value)               n++;
      return n;
    });

    const pStats = computed(() => {
      const total = S.products.value.length || 1;
      const tm = S.products.value.filter(p => p.platform_type === 'techmedix').length;
      return { tm: Math.round((tm / total) * 100), gd: Math.round(((total - tm) / total) * 100) };
    });

    const adminTriage = computed(() => {
      const reqs = S.allRequests.value;
      return {
        pendingPayments: reqs.filter(r => r.payment_status === 'pending' && r.total_cost > 0 && r.status !== 'cancelled'),
        awaitingQuote:   reqs.filter(r => ['pending', 'submitted'].includes(r.status)),
        verifyRequests:  (S.adminUsers.value || []).filter(u => u.company_name?.startsWith('[VERIFY_REQUESTED]')),
        stalled:         reqs.filter(r => {
          if (['completed', 'cancelled', 'delivered'].includes(r.status)) return false;
          return (Date.now() - new Date(r.updated_at || r.created_at)) / 86400000 > 3;
        }),
      };
    });

    const profileCompletion = computed(() => {
      if (!S.profile.value) return { pct: 0, unlocks: [], next: null };
      const p = S.profile.value;
      const checks = [
        { key: 'name',    done: !!p.full_name,   pts: 15, label: 'Add your full name' },
        { key: 'phone',   done: !!p.phone,        pts: 10, label: 'Add phone number' },
        { key: 'avatar',  done: !!p.avatar_url,   pts: 20, label: 'Upload profile photo' },
        { key: 'type',    done: true,              pts: 5,  label: 'Set account type' },
        { key: 'address', done: S.addresses.value.length > 0, pts: 15, label: 'Add delivery address' },
        { key: 'company', done: !!p.company_name?.replace(/^\[.*?\]/, '').trim(), pts: 5, label: 'Add organisation name' },
        { key: 'verified', done: p.company_name?.startsWith('[VERIFIED]'), pts: 15, label: 'Get seller verified' },
        { key: 'request', done: S.allRequests.value.filter(r => r.user_id === p.id).length > 0, pts: 10, label: 'Submit your first request' },
        { key: 'review',  done: false, pts: 5, label: 'Receive your first review' },
      ];
      const total  = checks.reduce((s, c) => s + c.pts, 0);
      const earned = checks.filter(c => c.done).reduce((s, c) => s + c.pts, 0);
      const pct    = Math.round((earned / total) * 100);
      const unlocks = [
        { at: 25,  label: 'Browse & request products',       icon: 'fa-magnifying-glass', done: pct >= 25  },
        { at: 50,  label: 'Order tracking unlocked',          icon: 'fa-location-dot',    done: pct >= 50  },
        { at: 75,  label: 'Priority support access',          icon: 'fa-headset',         done: pct >= 75  },
        { at: 100, label: 'Featured listing / buyer badge',   icon: 'fa-star',            done: pct >= 100 },
      ];
      return { pct, unlocks, next: checks.find(c => !c.done), checks };
    });

    // ITEM 97: Admin products search
    const filteredAdminProds = computed(() => {
      if (!S.adminProdSearch.value) return S.products.value;
      const q = S.adminProdSearch.value.toLowerCase();
      return S.products.value.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.manufacturer?.toLowerCase().includes(q) ||
        p.seller_name?.toLowerCase().includes(q)
      );
    });

    const allUsersSelected = computed(() =>
      filteredAdminUsers.value.length > 0 &&
      filteredAdminUsers.value.every(u => S.selectedUserIds.value.has(u.id))
    );
    const allProductsSelected = computed(() =>
      filteredProds.value.length > 0 &&
      filteredProds.value.every(p => S.selectedProductIds.value.has(p.id))
    );

    // ── Wrappers for actions that need computed values ───────────
    function primaryAction() {
      if (!S.profile.value) { S.showAuth.value = true; return; }
      if (canBuy.value) { S.showReqModal.value = true; return; }
      if (canSell.value) { A.openListingModal(); return; }
      S.tab.value = 'browse';
    }

    function goTab(t) {
      A.goTab(t, A.loadAnalytics, () => A.loadSellerAnalytics(myListings.value));
      if (t === 'facility') A.loadMyFacility();
    }

    function saveReq() { return A.saveReq(selectedProduct.value, reqCostEstimate.value); }
    function submitBasket() { return A.submitBasket(basketTotal.value); }
    function toggleAllUsers() { A.toggleAllUsers(filteredAdminUsers.value, allUsersSelected.value); }
    function toggleAllProducts() { A.toggleAllProducts(filteredProds.value, allProductsSelected.value); }

    // Notification click needs openDetailModal
    function clickNotification(n) { A.clickNotification(n, A.openDetailModal, goTab); }

    // ── Keyboard handler ─────────────────────────────────────────
    function handleKey(e) {
      if (e.key === 'Escape') {
        if (S.showMessagesPanel.value) { A.closeMessages(); return; }
        if (S.detailReq.value) { S.detailReq.value = null; return; }
        if (S.showListingModal.value) { A.closeListing(); return; }
        if (S.showReqModal.value) { S.showReqModal.value = false; return; }
        if (S.showAuth.value) { S.showAuth.value = false; return; }
        if (S.showQuoteModal.value) { S.showQuoteModal.value = false; return; }
        if (S.showReviewModal.value) { S.showReviewModal.value = false; return; }
        if (S.showVerifyModal.value) { S.showVerifyModal.value = false; return; }
        A.closeAllMenus();
      }
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        e.preventDefault();
        document.querySelector('.srch-w input')?.focus();
      }
    }

    // ── Watcher ──────────────────────────────────────────────────
    watch(S.authTab, () => { S.authErr.value = ''; S.magicSent.value = false; S.aF.password = ''; });

    // ITEM 47: body scroll lock when any modal open
    const anyModalOpen = computed(() =>
      S.showAuth.value || S.showListingModal.value || S.showReqModal.value ||
      S.showQuoteModal.value || S.showReviewModal.value || S.showProfileModal.value ||
      S.showBasket.value || S.showVerifyModal.value || S.showCancelModal.value ||
      S.showOrderDetail.value || S.showAdminUserModal.value || S.showTcModal.value ||
      !!S.confirm.value || S.showOnboarding.value
    );
    watch(anyModalOpen, (v) => {
      document.body.classList.toggle('modal-open', v);
    });

    // ITEM 93: Reactive rate age timer — recalculate every minute
    function updateRateAge() {
      if (!S.rateUpdatedAt.value) { S.rateAgeDisplay.value = ''; return; }
      const h = Math.round((Date.now() - new Date(S.rateUpdatedAt.value)) / 3600000);
      const m = Math.round((Date.now() - new Date(S.rateUpdatedAt.value)) / 60000);
      if (m < 1) S.rateAgeDisplay.value = 'Updated just now';
      else if (m < 60) S.rateAgeDisplay.value = 'Updated ' + m + 'm ago';
      else if (h < 24) S.rateAgeDisplay.value = 'Updated ' + h + 'h ago';
      else S.rateAgeDisplay.value = 'Updated ' + Math.round(h/24) + 'd ago';
    }
    S.rateAgeClock.value = setInterval(updateRateAge, 60000);
    updateRateAge();

    // ITEM 84: Auto-refresh exchange rate every 30 min
    setInterval(() => { A.loadExchangeRate(); }, 30 * 60 * 1000);

    // FIX 13: Update document title on tab change
    // FIX 9: Offline detection
    const isOffline = ref(false); // Don't show on load — only after confirmed disconnect
    window.addEventListener('online',  () => { S.toast('ok', 'Back online', 'Internet connection restored'); });
    window.addEventListener('offline', () => { S.toast('wn', 'No internet connection', 'Some features may not work'); });

    watch(S.tab, (t) => {
      const titles = {
        home: 'Dashboard', browse: 'Browse Products', 'my-requests': 'My Requests',
        tracking: 'Track Order', payments: 'Payments', 'my-listings': 'My Listings',
        inquiries: 'Inquiries', 'seller-analytics': 'My Analytics',
        admin: 'Admin Panel', 'admin-users': 'All Users',
        'admin-listings': 'All Listings', analytics: 'Analytics', shoppers: 'Shoppers'
      };
      document.title = (titles[t] || t) + ' · TechMedixLink';
    });

    // FIX 13: Persist browse filters across tab switches using sessionStorage
    // ITEM 85: Persist basket to localStorage
    watch(S.basket, (v) => {
      try { localStorage.setItem('tml_basket', JSON.stringify(v)); } catch {}
    }, { deep: true });

    watch([S.prodSearch, S.prodFilter, S.prodTypeFilter, S.sortProd, S.filterTmda, S.filterInStock, S.priceMin, S.priceMax, S.manufFilter], () => {
      try {
        sessionStorage.setItem('tml_browse_filters', JSON.stringify({
          prodSearch: S.prodSearch.value, prodFilter: S.prodFilter.value,
          prodTypeFilter: S.prodTypeFilter.value, sortProd: S.sortProd.value,
          filterTmda: S.filterTmda.value, filterInStock: S.filterInStock.value,
          priceMin: S.priceMin.value, priceMax: S.priceMax.value, manufFilter: S.manufFilter.value,
        }));
      } catch {}
    });

    // ── onMounted: auth state machine ────────────────────────────
    onMounted(() => {
      document.addEventListener('keydown', handleKey);

      // Load platform features (ads, group buys, templates)
      A.loadPlatformFeatures();
      A.loadVerifiedSellers();
      A.loadRecentlyViewed();

      // ITEM 85: Restore basket from localStorage
      try {
        const savedBasket = localStorage.getItem('tml_basket');
        if (savedBasket) {
          const parsed = JSON.parse(savedBasket);
          if (parsed?.length) {
            S.basket.value = parsed;
            S.basketRestored.value = true;
          }
        }
      } catch {}

      // FIX 14: Deep link support — ?track=TML-2026-XXXXX
      const urlParams = new URLSearchParams(window.location.search);
      const trackParam = urlParams.get('track');
      if (trackParam) {
        S.tab.value = 'tracking';
        S.trackId.value = trackParam.toUpperCase();
        history.replaceState(null, '', window.location.pathname);
        setTimeout(() => A.fetchTracking(), 1500);
      }

      // FIX 13: Restore browse filters from sessionStorage
      try {
        const saved = sessionStorage.getItem('tml_browse_filters');
        if (saved) {
          const f = JSON.parse(saved);
          if (f.prodSearch)    S.prodSearch.value    = f.prodSearch;
          if (f.prodFilter)    S.prodFilter.value    = f.prodFilter;
          if (f.prodTypeFilter) S.prodTypeFilter.value = f.prodTypeFilter;
          if (f.sortProd)      S.sortProd.value      = f.sortProd;
          if (f.filterTmda)    S.filterTmda.value    = f.filterTmda;
          if (f.filterInStock) S.filterInStock.value = f.filterInStock;
          if (f.priceMin > 0)  S.priceMin.value      = f.priceMin;
          if (f.priceMax < 100000) S.priceMax.value  = f.priceMax;
          if (f.manufFilter)   S.manufFilter.value   = f.manufFilter;
        }
      } catch {}

      const params = new URLSearchParams(
        window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : window.location.search.slice(1)
      );
      const urlError = params.get('error_description');
      const urlType  = params.get('type');
      const urlToken = params.get('access_token');

      if (urlError) {
        S.showAuth.value = true;
        S.authErr.value  = decodeURIComponent(urlError).replace(/\+/g, ' ');
        history.replaceState(null, '', window.location.pathname);
      } else if (urlToken || ['recovery','magiclink','signup'].includes(urlType)) {
        S.authLanding.value    = true;
        S.authLandingMsg.value = urlType === 'recovery' ? 'Verifying your reset link…' : 'Signing you in securely…';
        history.replaceState(null, '', window.location.pathname);
      }

      S.loading.value = true;
      S.loadMsg.value = 'Loading…';

      sb.auth.onAuthStateChange(async (event, session) => {
        try {
          if (event === 'PASSWORD_RECOVERY') {
            S.authLanding.value = false;
            S.showPasswordUpdate.value = true;
            await A.loadAll();

          } else if (event === 'SIGNED_IN' && session) {
            S.authLanding.value = false;
            S.showPasswordUpdate.value = false;
            S.showAuth.value = false;
            S.magicSent.value = false;
            await A.loadUserProfile(session.user.id);
            await A.loadAll();
            await A.loadNotifications();
            if (isAdmin.value) { await A.loadAdminUsers(); await A.loadShoppers(); }
            await A.loadAddresses();
            await A.loadUnreadMessageCounts();
            const isNewish = S.profile.value?.onboarding_done === false;
            if (isNewish) A.startOnboarding();
            else S.toast('ok', 'Welcome back!', S.profile.value?.full_name || session.user.email || '');

            // Realtime subscriptions
            const realtimeChannel = sb.channel('tml-live')
              .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, async (payload) => {
                if (!S.profile.value) return;
                const isRelevant = isAdmin.value || payload.new?.user_id === S.profile.value.id || payload.old?.user_id === S.profile.value.id;
                if (!isRelevant) return;
                if (payload.eventType === 'UPDATE') {
                  const idx = S.allRequests.value.findIndex(r => r.id === payload.new.id);
                  if (idx >= 0) S.allRequests.value[idx] = { ...S.allRequests.value[idx], ...payload.new };
                  else await A.loadReqs();
                } else if (payload.eventType === 'INSERT') {
                  await A.loadReqs();
                }
              })
              .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
                if (!S.profile.value || payload.new?.user_id !== S.profile.value.id) return;
                S.notifications.value.unshift(payload.new);
              })
              .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'payments' }, async (payload) => {
                if (!S.profile.value) return;
                if (payload.new?.user_id !== S.profile.value.id && !isAdmin.value) return;
                await A.loadPayments(); await A.loadReqs();
              })
              .subscribe();

            window.addEventListener('beforeunload', () => { sb.removeChannel(realtimeChannel); });

          } else if (event === 'TOKEN_REFRESHED' && session) {
            if (!S.profile.value) await A.loadUserProfile(session.user.id);
            await A.loadAll();

          } else if (event === 'SIGNED_OUT') {
            S.profile.value = null; S.notifications.value = []; S.addresses.value = [];
            S.allRequests.value = []; S.payments.value = [];
            S.tab.value = 'home';

          } else if (event === 'INITIAL_SESSION') {
            if (!session) await A.loadAll();
          }
        } catch(e) {
        } finally {
          S.loading.value = false;
        }
      });
    });

    // ── Lightbox navigation ─────────────────────────────────────
    function lightboxPrev() {
      if (!S.viewedProduct.value) return;
      const all = [S.viewedProduct.value.image_url, ...(S.viewedProduct.value.images||[])].filter(Boolean);
      const cur = all.indexOf(S.lightboxImg.value);
      S.lightboxIndex.value = Math.max(0, cur - 1);
      S.lightboxImg.value = all[S.lightboxIndex.value];
    }
    function lightboxNext() {
      if (!S.viewedProduct.value) return;
      const all = [S.viewedProduct.value.image_url, ...(S.viewedProduct.value.images||[])].filter(Boolean);
      const cur = all.indexOf(S.lightboxImg.value);
      S.lightboxIndex.value = Math.min(all.length - 1, cur + 1);
      S.lightboxImg.value = all[S.lightboxIndex.value];
    }

    // Password strength helpers (regex can't go in templates)
    function pwStrengthPct(pw) {
      if (!pw || pw.length < 6) return 25;
      if (pw.length < 8) return 50;
      if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) return 100;
      return 75;
    }
    function pwStrengthColor(pw) {
      const p = pwStrengthPct(pw);
      if (p <= 25) return 'var(--err)';
      if (p <= 50) return 'var(--warn)';
      if (p <= 75) return 'var(--info)';
      return 'var(--ok)';
    }
    function pwStrengthLabel(pw) {
      if (!pw || pw.length < 6) return 'Too short';
      if (pw.length < 8) return 'Weak — try 8+ characters';
      if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) return 'Strong password';
      return 'Medium — add uppercase and a number';
    }

    // ── Return: everything the template needs ────────────────────
    return {
      // State — spread directly
      ...S,

      // Computed (defined in main.js)
      isAdmin, canBuy, canSell, pageTitle, primaryLabel, userInitial, today, productsLoading, isOffline, anyModalOpen, filteredAdminProds, reqCatalogSearch: S.reqCatalogSearch, lpFilteredProducts,
      unreadCount, uniqueCats, groupedNotifications,
      myRequests, myListings, incomingReqs, myActiveReqs, myDoneReqs,
      myTotalSpent, myBalanceDue, pendingPayCount, pendingAdminCount, avgListingPrice,
      selectedProduct, reqCostEstimate, basketTotal, basketCount,
      filteredProds, filteredMyReqs, filteredAdminReqs, filteredAdminUsers,
      recentActivity, allManufacturers, browseSubtitle, activeFilterCount,
      pStats, adminTriage, profileCompletion,
      allUsersSelected, allProductsSelected,

      // Formatters (bound for template use)
      fNum: F.fNum, tzs: F.tzs, fDate: F.fDate, fDateTime: F.fDateTime,
      fEvent: F.fEvent, fCountdown: F.fCountdown, stockLabel: F.stockLabel,
      stockClass: F.stockClass, roleLabel: F.roleLabel, roleIcon: F.roleIcon,
      fStatus: (s) => F.fStatus(S.statusList, s),
      sBadge: F.sBadge,
      stepCls: (status, idx) => F.stepCls(S.stepperStages, status, idx),

      // Actions
      ...A,
      quickRequestWithQty: A.quickRequestWithQty,
      lightboxPrev, lightboxNext,

      // Wrappers (need computed values from this scope)
      goTab, primaryAction, saveReq, submitBasket,
      toggleAllUsers, toggleAllProducts, clickNotification,
      confirmPaymentAdmin: A.confirmPaymentAdmin,
      exportRequestsCSV: (reqs) => A.exportRequestsCSV(reqs, S.adminUsers.value),
      markNotificationRead: A.markNotificationRead,
    };
  }
});

app.config.compilerOptions.isCustomElement = tag => tag === 'model-viewer';
app.mount('#app');
