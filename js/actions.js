// ─────────────────────────────────────────────────────────────────
// TechMedixLink · js/actions.js
// All business logic functions — imports state + db, no Vue setup()
// ─────────────────────────────────────────────────────────────────

import { sb } from './db.js';
import {
  loading, loadMsg, profile, products, allRequests, payments, notifications,
  toast, killToast,
  adminUsers, shoppers, addresses, analyticsData, sellerAnalytics,
  sellerAnalyticsLoading, productReviews, pdReviews, pdLoading,
  usdToTzs, rateSource, rateUpdatedAt,
  basket, showBasket,
  showAuth, showListingModal, showReqModal, showQuoteModal, showReviewModal,
  showShopperModal, showProfileModal, showNotifPanel, showUserPanel,
  showAdminUserModal, adminViewUser, adminEditingUser,
  showVerifyModal, showCancelModal, showOrderDetail, showProductDetail,
  showPasswordUpdate, showInquiryDetail, showMessagesPanel, showOnboarding,
  showMessagesPanel as _showMsg,
  authLanding, authLandingMsg, authErr, magicSent, rateLimitUntil, rateLimitSecs,
  newPassword, newPasswordErr, onboardStep, onboardingDone,
  tab, platform, sidebarOpen, openStatusMenu, assignShopperId, addingAddress,
  activeDetailImage, pd3dMode, lpCarousel, trackId, trackedReq,
  detailReq, orderDetailReq, paymentReq, quoteReq, reviewReq,
  editingProd, editingShopper, viewedProduct, inquiryReq, cancelReq, cancelReason,
  verifyDocs, confirm,
  aF, pF, rF, uF, pmtF, qF, reviewF, shF, addrF, adminUF, obF,
  prodSearch, prodFilter, prodTypeFilter, sortProd, filterTmda, filterInStock,
  priceMin, priceMax, manufFilter, reqSearch, reqFilter, reqPlatFilter,
  adminUserSearch, adminUserRoleFilter, adminReqSearch, adminReqFilter, adminPlatFilter,
  adminSubTab, prodPage, reqPage, userPage, prodTotal, reqTotal, userTotal,
  PROD_PER_PAGE, REQ_PER_PAGE, USER_PER_PAGE,
  messages, messagesReq, messagesLoading, newMessageText, unreadMessageCounts,
  selectedUserIds, selectedProductIds, bulkActionLoading,
  statusList, stepperStages, toasts,
  toast, killToast,
  lastReqNumber, showReqSuccess, pdQty
} from './state.js';

import { fStatus, tzs, fDate, fDateTime } from './formatters.js';

// ── SECURITY ─────────────────────────────────────────────────────
export function sanitize(str, maxLen = 500) {
  if (!str) return '';
  return String(str).replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
}

export async function verifyAdminServer() {
  if (!profile.value || profile.value.user_role !== 'admin') return false;
  try {
    const { data } = await sb.from('users').select('user_role').eq('id', profile.value.id).single();
    return data?.user_role === 'admin';
  } catch { return false; }
}

let rateLimitTimer = null;
export function startRateLimitCountdown(seconds) {
  rateLimitUntil.value = Date.now() + seconds * 1000;
  rateLimitSecs.value  = seconds;
  if (rateLimitTimer) clearInterval(rateLimitTimer);
  rateLimitTimer = setInterval(() => {
    const remaining = Math.ceil((rateLimitUntil.value - Date.now()) / 1000);
    if (remaining <= 0) {
      rateLimitSecs.value = 0; rateLimitUntil.value = 0;
      clearInterval(rateLimitTimer);
    } else {
      rateLimitSecs.value = remaining;
    }
  }, 1000);
}

const authAttempts = { count: 0, resetAt: 0 };
export function checkAuthRateLimit() {
  const now = Date.now();
  if (now > authAttempts.resetAt) { authAttempts.count = 0; authAttempts.resetAt = now + 60000; }
  authAttempts.count++;
  if (authAttempts.count > 5) {
    authErr.value = 'Too many attempts. Please wait 60 seconds before trying again.';
    return false;
  }
  return true;
}

// ── NOTIFICATIONS ────────────────────────────────────────────────
export async function sendWhatsApp(phone, message) {
  if (!phone) return;
  try {
    await sb.functions.invoke('send-whatsapp', {
      body: { phone: phone.replace(/[^0-9+]/g, ''), message }
    });
  } catch(e) { console.warn('WhatsApp fn:', e.message); }
}

export async function createNotification(userId, type, title, message, requestId = null, channel = 'in_app') {
  try {
    await sb.from('notifications').insert({
      user_id: userId, request_id: requestId,
      notification_type: type, channel,
      title, message, is_read: false, is_delivered: false,
      sent_at: new Date().toISOString()
    });
  } catch(e) { console.warn('Notification failed:', e); }
}

// ── DATA LOADERS ─────────────────────────────────────────────────
export async function loadAll() {
  await loadExchangeRate().catch(e => console.warn('loadExchangeRate:', e));
  await loadProds().catch(e => console.warn('loadProds:', e));
  await loadReqs().catch(e => console.warn('loadReqs:', e));
  await loadPayments().catch(e => console.warn('loadPayments:', e));
}

export async function loadExchangeRate() {
  try {
    const { data } = await sb.from('exchange_rates')
      .select('*').eq('is_current', true)
      .order('created_at', { ascending: false }).limit(1).single();
    if (data?.rate) {
      usdToTzs.value = parseFloat(data.rate);
      rateSource.value = 'live';
      rateUpdatedAt.value = data.created_at || data.valid_from;
    } else {
      rateSource.value = 'fallback'; rateUpdatedAt.value = null;
    }
  } catch {
    rateSource.value = 'fallback'; rateUpdatedAt.value = null;
  }
}

export async function loadProds(page = 0) {
  try {
    const from = page * PROD_PER_PAGE;
    const to   = from + PROD_PER_PAGE - 1;
    const { data, error, count } = await sb.from('products')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    products.value = data || [];
    prodTotal.value = count || 0;
    prodPage.value  = page;
  } catch(e) { console.error('loadProds:', e); }
}

export async function loadReqs(page = 0) {
  try {
    const from = page * REQ_PER_PAGE;
    const to   = from + REQ_PER_PAGE - 1;
    let q = sb.from('requests')
      .select('*, items:request_items(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (profile.value?.user_role !== 'admin' && profile.value) {
      q = q.eq('user_id', profile.value.id);
    }
    const { data, error, count } = await q;
    if (error) throw error;
    allRequests.value = data || [];
    reqTotal.value = count || 0;
    reqPage.value  = page;
  } catch(e) { console.error('loadReqs:', e); }
}

export async function loadPayments() {
  if (!profile.value) return;
  try {
    const isAdmin = profile.value.user_role === 'admin';
    const query = isAdmin
      ? sb.from('payments').select('*').order('payment_date', { ascending: false }).limit(100)
      : sb.from('payments').select('*').eq('user_id', profile.value.id).order('payment_date', { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    payments.value = data || [];
  } catch(e) { console.error('loadPayments:', e); }
}

export async function loadNotifications() {
  if (!profile.value) return;
  try {
    const { data } = await sb.from('notifications').select('*')
      .eq('user_id', profile.value.id)
      .order('sent_at', { ascending: false }).limit(30);
    notifications.value = data || [];
  } catch {}
}

export async function loadAdminUsers(page = 0) {
  if (profile.value?.user_role !== 'admin') return;
  try {
    const from = page * USER_PER_PAGE;
    const to   = from + USER_PER_PAGE - 1;
    const { data, count } = await sb.from('users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    adminUsers.value = data || [];
    userTotal.value  = count || 0;
    userPage.value   = page;
  } catch {}
}

export async function loadShoppers() {
  try {
    const { data } = await sb.from('shoppers').select('*').order('created_at', { ascending: false });
    shoppers.value = data || [];
  } catch {}
}

export async function loadAddresses() {
  if (!profile.value) return;
  try {
    const { data } = await sb.from('addresses').select('*').eq('user_id', profile.value.id);
    addresses.value = data || [];
  } catch {}
}

// ── ANALYTICS ────────────────────────────────────────────────────
export async function loadAnalytics() {
  if (profile.value?.user_role !== 'admin') return;
  try {
    const [
      { count: totalReqs },
      { data: statusData },
      { data: gmvData },
      { data: rvData },
      { data: deliveryData },
    ] = await Promise.all([
      sb.from('requests').select('*', { count: 'exact', head: true }),
      sb.from('requests').select('status'),
      sb.from('requests').select('total_cost,deposit_paid'),
      sb.from('reviews').select('rating'),
      sb.from('requests').select('actual_delivery_date,created_at')
        .in('status', ['delivered', 'completed'])
        .not('actual_delivery_date', 'is', null),
    ]);
    const total = totalReqs || 1;
    const done  = (statusData || []).filter(r => ['delivered', 'completed', 'installed'].includes(r.status)).length;
    const gmv   = (gmvData || []).reduce((s, r) => s + (r.total_cost || 0), 0);
    const collected = (gmvData || []).reduce((s, r) => s + (r.deposit_paid || 0), 0);
    const avgDays = deliveryData?.length
      ? Math.round(deliveryData.reduce((s, r) => s + (new Date(r.actual_delivery_date) - new Date(r.created_at)) / 86400000, 0) / deliveryData.length)
      : null;
    const avgRating = rvData?.length
      ? (rvData.reduce((s, r) => s + r.rating, 0) / rvData.length).toFixed(1)
      : null;
    const { data: monthlyData } = await sb.from('requests')
      .select('total_cost,created_at')
      .gte('created_at', new Date(Date.now() - 180 * 86400000).toISOString());
    analyticsData.value = {
      totalGmv: gmv, totalCollected: collected,
      completionRate: Math.round((done / total) * 100),
      avgDays: avgDays !== null ? avgDays + 'd' : '--',
      avgRating: avgRating || '--',
      totalReqs: total, doneCount: done,
      monthlyData: monthlyData || [],
      statusData: statusData || [],
    };
    setTimeout(() => { renderCharts(); }, 0);
  } catch(e) { console.error('loadAnalytics:', e); }
}

export async function loadSellerAnalytics(myListings) {
  if (!profile.value || !['seller','both'].includes(profile.value.user_role)) return;
  sellerAnalyticsLoading.value = true;
  try {
    const myProductIds = myListings.map(p => p.id);
    if (!myProductIds.length) {
      const totalRevenueTzs = Math.round(totalRevenue * (usdToTzs.value || 2650));
  sellerAnalytics.value = { noProducts: true };
      sellerAnalyticsLoading.value = false;
      return;
    }
    const [{ data: inquiries }, { data: revenue }, { data: reviews }] = await Promise.all([
      sb.from('request_items').select('product_id,quantity,total_price,request:request_id(status,created_at)').in('product_id', myProductIds),
      sb.from('request_items').select('product_id,total_price,request:request_id(status,deposit_paid)').in('product_id', myProductIds),
      sb.from('reviews').select('rating,reviewed_entity_id').in('reviewed_entity_id', myProductIds),
    ]);
    const totalInquiries = inquiries?.length || 0;
    const converted = (inquiries || []).filter(i => ['deposit_paid','processing','sourcing','shipped','delivered','completed'].includes(i.request?.status)).length;
    const totalRevenue = (revenue || []).reduce((s, i) => s + (i.total_price || 0), 0);
    const avgRating = reviews?.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;
    const byProduct = {};
    (inquiries || []).forEach(i => {
      if (!byProduct[i.product_id]) byProduct[i.product_id] = { inquiries: 0, converted: 0, revenue: 0 };
      byProduct[i.product_id].inquiries++;
      if (['deposit_paid','processing','sourcing','shipped','delivered','completed'].includes(i.request?.status)) byProduct[i.product_id].converted++;
    });
    (revenue || []).forEach(i => { if (byProduct[i.product_id]) byProduct[i.product_id].revenue += (i.total_price || 0); });
    sellerAnalytics.value = {
      totalInquiries, converted,
      conversionRate: totalInquiries ? Math.round(converted / totalInquiries * 100) : 0,
      totalRevenue, avgRating, byProduct, totalReviews: reviews?.length || 0
    };
  } catch(e) { console.error('sellerAnalytics:', e); }
  sellerAnalyticsLoading.value = false;
}

export function renderCharts() {
  const reqs = analyticsData.value.statusData || allRequests.value;
  const chartOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#3a5070', font: { size: 11, family: 'Nunito Sans' } } } } };
  const statusCounts = {};
  statusList.forEach(s => { statusCounts[s.label] = reqs.filter(r => r.status === s.val).length; });
  const filtered = Object.entries(statusCounts).filter(([, v]) => v > 0);
  const scEl = document.getElementById('statusChart');
  if (scEl) {
    if (scEl._chart) scEl._chart.destroy();
    scEl._chart = new Chart(scEl, { type: 'bar', data: { labels: filtered.map(([k]) => k), datasets: [{ data: filtered.map(([, v]) => v), backgroundColor: 'rgba(0,102,161,0.65)', borderColor: 'rgba(0,102,161,1)', borderWidth: 1.5, borderRadius: 4 }] }, options: { ...chartOpts, scales: { x: { ticks: { color: '#7a90aa', font: { size: 10, family: 'Nunito Sans' } }, grid: { color: 'rgba(0,30,80,0.06)' } }, y: { ticks: { color: '#7a90aa', font: { size: 10, family: 'Nunito Sans' } }, grid: { color: 'rgba(0,30,80,0.06)' } } }, plugins: { legend: { display: false } } } });
  }
  const tml = reqs.filter(r => r.platform_type === 'techmedix').length;
  const gd  = reqs.filter(r => r.platform_type === 'globaldoor').length;
  const pcEl = document.getElementById('platformChart');
  if (pcEl) {
    if (pcEl._chart) pcEl._chart.destroy();
    pcEl._chart = new Chart(pcEl, { type: 'doughnut', data: { labels: ['TechMedixLink', 'GlobalDoor'], datasets: [{ data: [tml, gd], backgroundColor: ['rgba(0,102,161,0.75)', 'rgba(0,168,176,0.75)'], borderColor: ['#0066a1', '#00a8b0'], borderWidth: 2 }] }, options: { ...chartOpts } });
  }
  const prodCounts = {};
  reqs.forEach(r => r.items?.forEach(it => { prodCounts[it.product_name] = (prodCounts[it.product_name] || 0) + 1; }));
  const top5 = Object.entries(prodCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const prEl = document.getElementById('productsChart');
  if (prEl) {
    if (prEl._chart) prEl._chart.destroy();
    prEl._chart = new Chart(prEl, { type: 'bar', data: { labels: top5.map(([k]) => k.length > 22 ? k.slice(0, 22) + '…' : k), datasets: [{ data: top5.map(([, v]) => v), backgroundColor: 'rgba(0,168,176,0.60)', borderColor: 'rgba(0,168,176,1)', borderWidth: 1.5, borderRadius: 4 }] }, options: { ...chartOpts, indexAxis: 'y', scales: { x: { ticks: { color: '#7a90aa', font: { size: 10, family: 'Nunito Sans' } }, grid: { color: 'rgba(0,30,80,0.06)' } }, y: { ticks: { color: '#7a90aa', font: { size: 10, family: 'Nunito Sans' } }, grid: { display: false } } }, plugins: { legend: { display: false } } } });
  }
}

// ── AUTH ─────────────────────────────────────────────────────────
export async function doLogin() {
  if (!aF.loginId || !aF.password) return;
  if (!checkAuthRateLimit()) return;
  loading.value = true; loadMsg.value = 'Signing in…';
  let email = aF.loginId.trim();
  const isPhone = /^[+]?[0-9]{8,15}$/.test(email.replace(/[\s\-]/g, ''));
  const isEmail = email.includes('@');
  if (!isEmail) {
    const q = isPhone
      ? sb.from('users').select('email').eq('phone', email.replace(/[^0-9+]/g, ''))
      : sb.from('users').select('email').ilike('full_name', email);
    const { data: found } = await q.limit(1).single();
    if (found?.email) { email = found.email; }
    else { loading.value = false; authErr.value = 'No account found. Try your email address.'; return; }
  }
  const { error } = await sb.auth.signInWithPassword({ email, password: aF.password });
  loading.value = false;
  if (error) {
    const msg = error.message || '';
    authErr.value = (msg.includes('Invalid login') || msg.includes('400'))
      ? 'Incorrect email or password. If you signed up recently, check your email for a confirmation link first.'
      : msg;
    return;
  }
  showAuth.value = false; aF.password = ''; aF.loginId = '';
}

export async function updatePassword() {
  if (!newPassword.value || newPassword.value.length < 6) {
    newPasswordErr.value = 'Password must be at least 6 characters.'; return;
  }
  loading.value = true; loadMsg.value = 'Updating password…';
  const { error } = await sb.auth.updateUser({ password: newPassword.value });
  loading.value = false;
  if (error) { newPasswordErr.value = error.message; return; }
  showPasswordUpdate.value = false;
  newPassword.value = ''; newPasswordErr.value = '';
  toast('ok', 'Password updated', 'You are now signed in with your new password.');
}

export async function doPasswordReset() {
  if (!aF.email) return;
  if (rateLimitSecs.value > 0) { authErr.value = `Please wait before requesting another email.`; return; }
  if (!checkAuthRateLimit()) return;
  loading.value = true; loadMsg.value = 'Sending reset link…';
  const { error } = await sb.auth.resetPasswordForEmail(aF.email, {
    redirectTo: window.location.origin + window.location.pathname
  });
  loading.value = false;
  if (error) {
    const msg = error.message || '';
    if (msg.toLowerCase().includes('rate limit') || msg.includes('429')) { startRateLimitCountdown(3600); authErr.value = ''; }
    else { authErr.value = msg; }
    return;
  }
  magicSent.value = true;
}

export async function doMagicLink() {
  if (!aF.email) return;
  if (rateLimitSecs.value > 0) { authErr.value = `Please wait before requesting another link.`; return; }
  if (!checkAuthRateLimit()) return;
  loading.value = true; loadMsg.value = 'Sending magic link…';
  const { error } = await sb.auth.signInWithOtp({
    email: aF.email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname }
  });
  loading.value = false;
  if (error) {
    const msg = error.message || '';
    if (msg.toLowerCase().includes('rate limit') || msg.includes('429')) { startRateLimitCountdown(3600); authErr.value = ''; }
    else { authErr.value = msg; }
    return;
  }
  magicSent.value = true;
}

export async function doSignup() {
  if (!aF.email || !aF.password || !aF.full_name) return;
  if (!checkAuthRateLimit()) return;
  loading.value = true; loadMsg.value = 'Creating account…';
  const { data, error } = await sb.auth.signUp({ email: aF.email, password: aF.password });
  if (error) { loading.value = false; authErr.value = error.message; return; }
  if (data?.user) {
    await sb.from('users').insert({
      id: data.user.id, email: aF.email, full_name: aF.full_name,
      phone: aF.phone || null, user_role: aF.user_role, user_type: aF.user_type,
      company_name: aF.company_name || null, onboarding_done: false, created_at: new Date().toISOString()
    });
    await loadUserProfile(data.user.id);
    showAuth.value = false;
    await loadAll();
    await loadNotifications();
    if (profile.value?.user_role === 'admin') { await loadAdminUsers(); await loadShoppers(); }
    startOnboarding();
  }
  loading.value = false;
}

export async function doLogout() {
  await sb.auth.signOut();
  profile.value = null; notifications.value = []; allRequests.value = [];
  payments.value = []; addresses.value = [];
  showUserPanel.value = false; showProfileModal.value = false;
  tab.value = 'home';
  toast('info', 'Signed out');
}

export async function loadUserProfile(userId) {
  try {
    const { data } = await sb.from('users').select('*').eq('id', userId).single();
    if (data) {
      profile.value = data;
      Object.assign(uF, {
        full_name: data.full_name || '', phone: data.phone || '',
        user_type: data.user_type || 'individual', user_role: data.user_role || 'buyer',
        company_name: data.company_name || ''
      });
    }
  } catch {}
}

// ── PROFILE & ONBOARDING ─────────────────────────────────────────
export function startOnboarding() {
  if (profile.value?.full_name) obF.full_name = profile.value.full_name;
  if (profile.value?.phone) obF.phone = profile.value.phone;
  onboardStep.value = 1;
  showOnboarding.value = true;
}

export async function obSetRole(role) {
  await sb.from('users').update({ user_role: role, updated_at: new Date().toISOString() }).eq('id', profile.value.id);
  await loadUserProfile(profile.value.id);
  onboardStep.value = 2;
}

export async function obSetType(type) {
  await sb.from('users').update({ user_type: type, updated_at: new Date().toISOString() }).eq('id', profile.value.id);
  await loadUserProfile(profile.value.id);
  onboardStep.value = 3;
}

export function obHandleAvatar(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!['image/jpeg','image/jpg','image/png','image/webp'].includes(file.type)) { toast('err','Invalid type','Please upload a JPG or PNG'); return; }
  if (file.size > 3 * 1024 * 1024) { toast('err','Too large','Profile photo must be under 3MB'); return; }
  obF.avatar_file = file;
  const reader = new FileReader();
  reader.onload = ev => { obF.avatar_preview = ev.target.result; };
  reader.readAsDataURL(file);
}

export async function obUploadAvatar() {
  if (!obF.avatar_file) return profile.value?.avatar_url || null;
  obF.avatar_uploading = true;
  try {
    const ext  = obF.avatar_file.name.split('.').pop();
    const path = `avatars/${profile.value.id}.${ext}`;
    await sb.storage.from('avatars').upload(path, obF.avatar_file, { upsert: true, cacheControl: '3600' });
    const { data } = sb.storage.from('avatars').getPublicUrl(path);
    obF.avatar_uploading = false;
    return data.publicUrl;
  } catch(e) { obF.avatar_uploading = false; console.error('Avatar upload:', e); return null; }
}

export async function obSaveProfile() {
  if (!obF.full_name) return;
  const avatarUrl = await obUploadAvatar();
  const update = { full_name: sanitize(obF.full_name, 100), phone: obF.phone || null, updated_at: new Date().toISOString() };
  if (avatarUrl) update.avatar_url = avatarUrl;
  await sb.from('users').update(update).eq('id', profile.value.id);
  await loadUserProfile(profile.value.id);
  onboardStep.value = 4;
}

export async function obSaveRoleDetail() {
  const p = profile.value;
  const isSeller = ['seller', 'both'].includes(p?.user_role);
  const update = { updated_at: new Date().toISOString() };
  if (isSeller) {
    const existing = p.company_name?.replace(/^\[.*?\]/, '') || '';
    update.company_name = existing;
  } else {
    if (obF.facility_type) update.company_name = obF.facility_type + (obF.bed_count ? ` (${obF.bed_count} beds)` : '');
  }
  await sb.from('users').update(update).eq('id', profile.value.id);
  await loadUserProfile(profile.value.id);
  showOnboarding.value = false; onboardStep.value = 0; onboardingDone.value = true;
  toast('ok', 'Profile complete!', 'Welcome to TechMedixLink');
  await loadAll(); await loadNotifications();
  if (profile.value?.user_role === 'admin') { await loadAdminUsers(); await loadShoppers(); }
  await loadAddresses();
}

export function obSkip() { showOnboarding.value = false; onboardStep.value = 0; }

export async function handleAvatarChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!['image/jpeg','image/jpg','image/png','image/webp'].includes(file.type)) { toast('err','Invalid type','Please upload a JPG or PNG'); return; }
  if (file.size > 3 * 1024 * 1024) { toast('err','Too large','Profile photo must be under 3MB'); return; }
  loading.value = true; loadMsg.value = 'Uploading photo…';
  try {
    const ext  = file.name.split('.').pop();
    const path = `avatars/${profile.value.id}.${ext}`;
    await sb.storage.from('avatars').upload(path, file, { upsert: true, cacheControl: '3600' });
    const { data } = sb.storage.from('avatars').getPublicUrl(path);
    await sb.from('users').update({ avatar_url: data.publicUrl, updated_at: new Date().toISOString() }).eq('id', profile.value.id);
    await loadUserProfile(profile.value.id);
    toast('ok', 'Photo updated');
  } catch(e) { toast('err', 'Upload failed', e.message); }
  loading.value = false;
}

export async function saveProfile() {
  if (!profile.value) return;
  const { error } = await sb.from('users').update({
    full_name: uF.full_name, phone: uF.phone, user_type: uF.user_type,
    user_role: uF.user_role, company_name: uF.company_name, updated_at: new Date().toISOString()
  }).eq('id', profile.value.id);
  if (error) { toast('err', 'Error', error.message); return; }
  await loadUserProfile(profile.value.id);
  showProfileModal.value = false;
  toast('ok', 'Profile updated');
}

export async function markNotificationRead(id) {
  await sb.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id);
  const n = notifications.value.find(n => n.id === id);
  if (n) n.is_read = true;
}

export async function clickNotification(n, openDetailModal, goTab) {
  if (!n.is_read) {
    await markNotificationRead(n.id);
    await loadNotifications();
  }
  showNotifPanel.value = false;
  if (n.request_id) {
    const req = allRequests.value.find(r => r.id === n.request_id);
    if (req) openDetailModal(req); else goTab('my-requests');
  } else if (n.action_url) {
    window.location.href = n.action_url;
  }
}

export async function markAllRead() {
  if (!profile.value) return;
  await sb.from('notifications').update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', profile.value.id).eq('is_read', false);
  await loadNotifications();
}

export async function saveAddress() {
  if (!profile.value || !addrF.region) return;
  const { error } = await sb.from('addresses').insert({
    user_id: profile.value.id, address_type: addrF.address_type || 'home',
    region: sanitize(addrF.region, 100), district: sanitize(addrF.district, 100) || null,
    street: sanitize(addrF.street, 200) || null, landmark: sanitize(addrF.landmark, 200) || null,
    is_default: addrF.is_default || false, created_at: new Date().toISOString()
  });
  if (error) { toast('err', 'Error', error.message); return; }
  await loadAddresses();
  Object.assign(addrF, { address_type: 'home', region: '', district: '', street: '', landmark: '', is_default: false });
  addingAddress.value = false;
  toast('ok', 'Address saved');
}

export async function deleteAddress(id) {
  await sb.from('addresses').delete().eq('id', id);
  await loadAddresses();
}

// ── NAVIGATION ───────────────────────────────────────────────────
export function setPlatform(p) {
  platform.value = p;
  document.documentElement.setAttribute('data-platform', p);
  prodFilter.value = p === 'techmedix' ? 'techmedix' : 'globaldoor';
  tab.value = 'browse';
  sidebarOpen.value = false;
}

export function goTab(t, loadAnalyticsFn, loadSellerAnalyticsFn) {
  tab.value = t;
  sidebarOpen.value = false;
  closeAllMenus();
  setTimeout(() => { document.querySelector('.content')?.scrollTo({ top: 0, behavior: 'smooth' }); }, 50);
  if (t === 'analytics') setTimeout(() => loadAnalyticsFn?.(), 0);
  if (t === 'seller-analytics') setTimeout(() => loadSellerAnalyticsFn?.(), 100);
  if (t === 'shoppers') loadShoppers();
  if (t === 'admin-users' || t === 'admin-listings') { loadAdminUsers(); loadProds(); }
  if (t === 'admin') { loadAdminUsers(); loadReqs(); loadPayments(); }
}

export function closeAllMenus() {
  showNotifPanel.value = false; showUserPanel.value = false; openStatusMenu.value = null;
}

export function togglePanel(which) {
  if (which === 'notif') { showNotifPanel.value = !showNotifPanel.value; showUserPanel.value = false; }
  else { showUserPanel.value = !showUserPanel.value; showNotifPanel.value = false; }
}

export function performSearch() {
  if (globalSearch.value) { prodSearch.value = globalSearch.value; tab.value = 'browse'; }
}

export function clearAllFilters() {
  prodSearch.value = ''; prodFilter.value = 'all'; prodTypeFilter.value = 'all';
  sortProd.value = 'newest'; filterTmda.value = false; filterInStock.value = false;
  priceMin.value = 0; priceMax.value = 100000; manufFilter.value = '';
}

// ── PRODUCTS ─────────────────────────────────────────────────────
export function openListingModal(prod = null) {
  editingProd.value = prod;
  if (prod) {
    Object.assign(pF, {
      name: prod.name || '', manufacturer: prod.manufacturer || '', model_url: prod.model_url || '',
      platform_type: prod.platform_type || 'techmedix', product_type: prod.product_type || 'medical_device',
      description: prod.description || '', base_price_usd: prod.base_price_usd || 0,
      stock_quantity: prod.stock_quantity || 0, warranty_months: prod.warranty_months || 12,
      country: prod.country || 'Tanzania', import_duty_percent: prod.import_duty_percent || 0,
      estimated_weight_kg: prod.estimated_weight_kg || 0, seller_name: prod.seller_name || '',
      tmda_certified: prod.tmda_certified || false, requires_installation: prod.requires_installation || false,
      requires_training: prod.requires_training || false, is_active: prod.is_active !== false,
      image_url: prod.image_url || '', imagePreview: prod.image_url || '',
      imageFile: null, uploading: false,
      images: prod.images || [],
      imagePreviews: (prod.images || []).map(url => ({ preview: url, url, file: null, name: '' })),
    });
  } else { resetPF(); }
  showListingModal.value = true;
}

export function closeListing() { showListingModal.value = false; editingProd.value = null; resetPF(); }

export function resetPF() {
  Object.assign(pF, {
    name: '', manufacturer: '', platform_type: 'techmedix', product_type: 'medical_device',
    description: '', base_price_usd: 0, stock_quantity: 0, warranty_months: 12, country: 'Tanzania',
    import_duty_percent: 0, estimated_weight_kg: 0, seller_name: profile.value?.full_name || '',
    tmda_certified: false, requires_installation: false, requires_training: false, is_active: true,
    image_url: '', imagePreview: '', imageFile: null, uploading: false, imageSize: '',
    images: [], imagePreviews: [],
  });
}

export function handleImageChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!['image/jpeg','image/jpg','image/png','image/webp','image/gif'].includes(file.type)) {
    toast('err', 'Invalid file type', 'Please upload a JPG, PNG, WebP, or GIF image.');
    e.target.value = ''; return;
  }
  if (file.size > 5 * 1024 * 1024) {
    toast('err', 'File too large', `Image must be under 5MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`);
    e.target.value = ''; return;
  }
  pF.imageFile = file;
  pF.imageSize = (file.size / 1024).toFixed(0) + 'KB';
  const reader = new FileReader();
  reader.onload = ev => { pF.imagePreview = ev.target.result; };
  reader.readAsDataURL(file);
}

export async function uploadProductImage() {
  if (!pF.imageFile) return pF.image_url || '';
  pF.uploading = true;
  try {
    const ext  = pF.imageFile.name.split('.').pop();
    const path = `products/${Date.now()}.${ext}`;
    const { error: upErr } = await sb.storage.from('products').upload(path, pF.imageFile, { cacheControl: '3600', upsert: false });
    if (upErr) throw upErr;
    const { data } = sb.storage.from('products').getPublicUrl(path);
    pF.uploading = false;
    return data.publicUrl;
  } catch(e) { pF.uploading = false; console.error('Image upload failed:', e); return pF.image_url || ''; }
}

export function handleAdditionalImages(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  const remaining = 5 - pF.imagePreviews.length;
  if (remaining <= 0) { toast('warn', 'Image limit reached', 'Maximum 5 additional images allowed.'); return; }
  const allowed = ['image/jpeg','image/jpg','image/png','image/webp'];
  for (const file of files.slice(0, remaining)) {
    if (!allowed.includes(file.type)) { toast('err', 'Invalid type', `${file.name} is not a supported image type.`); continue; }
    if (file.size > 5 * 1024 * 1024) { toast('err', 'File too large', `${file.name} exceeds 5MB.`); continue; }
    const reader = new FileReader();
    reader.onload = ev => { pF.imagePreviews.push({ preview: ev.target.result, file, name: file.name }); };
    reader.readAsDataURL(file);
  }
  e.target.value = '';
}

export function removeAdditionalImage(idx) {
  pF.imagePreviews.splice(idx, 1);
  if (pF.images[idx]) pF.images.splice(idx, 1);
}

export async function uploadAdditionalImages() {
  const uploaded = [];
  for (const item of pF.imagePreviews) {
    if (!item.file) { uploaded.push({ url: item.url, path: item.path }); continue; }
    try {
      const ext  = item.file.name.split('.').pop();
      const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const { error: upErr } = await sb.storage.from('products').upload(path, item.file, { cacheControl: '3600', upsert: false });
      if (upErr) { console.error('Extra image upload:', upErr); continue; }
      const { data: urlData } = sb.storage.from('products').getPublicUrl(path);
      uploaded.push({ url: urlData.publicUrl, path });
    } catch(e) { console.error('uploadAdditionalImages:', e); }
  }
  return uploaded;
}

export async function saveListing() {
  if (!pF.name || !pF.base_price_usd) return;
  loading.value = true; loadMsg.value = 'Saving listing…';
  const imageUrl = await uploadProductImage();
  const additionalImages = await uploadAdditionalImages();
  const payload = {
    name: sanitize(pF.name, 200), manufacturer: sanitize(pF.manufacturer, 200), model_url: pF.model_url || null,
    platform_type: pF.platform_type, product_type: pF.product_type, description: sanitize(pF.description, 2000),
    base_price_usd: pF.base_price_usd, stock_quantity: pF.stock_quantity, warranty_months: pF.warranty_months,
    country: pF.country, import_duty_percent: pF.import_duty_percent, estimated_weight_kg: pF.estimated_weight_kg,
    seller_name: pF.seller_name || profile.value?.full_name, tmda_certified: pF.tmda_certified,
    requires_installation: pF.requires_installation, requires_training: pF.requires_training,
    is_active: pF.is_active, image_url: imageUrl || null,
    images: additionalImages.map(i => i.url),
    updated_at: new Date().toISOString()
  };
  let error;
  if (editingProd.value) { ({ error } = await sb.from('products').update(payload).eq('id', editingProd.value.id)); }
  else { ({ error } = await sb.from('products').insert({ ...payload, user_id: profile.value.id, created_at: new Date().toISOString() })); }
  loading.value = false;
  if (error) { toast('err', 'Error', error.message); return; }
  await loadProds();
  const wasEditing = !!editingProd.value;
  closeListing();
  if (!wasEditing) {
    // ITEM 66: Show share prompt after new listing
    const freshProds = (await sb.from('products').select('id').order('created_at', { ascending: false }).limit(1)).data;
    const newId = freshProds?.[0]?.id;
    if (newId) {
      setTimeout(() => {
        toast('ok', 'Product listed!', 'Share it with buyers via WhatsApp to get your first inquiry.');
      }, 300);
    }
  } else {
    toast('ok', 'Product updated');
  }
}

export async function toggleListingStatus(p) {
  const { error } = await sb.from('products').update({ is_active: !p.is_active, updated_at: new Date().toISOString() }).eq('id', p.id);
  if (!error) { await loadProds(); toast('ok', p.is_active ? 'Product hidden' : 'Product activated'); }
}

export function askDeleteProduct(p) {
  confirm.value = { title: 'Delete Product', msg: `Permanently delete "${p.name}"? This cannot be undone.`, tone: 'er', icon: 'fas fa-trash', ok_lbl: 'Delete', ok: () => deleteProduct(p.id) };
  if (showListingModal.value) closeListing();
}

export async function deleteProduct(id) {
  const product = products.value.find(p => p.id === id);
  if (product?.user_id !== profile.value?.id) {
    const ok = await verifyAdminServer();
    if (!ok) { toast('err', 'Unauthorised', 'You can only delete your own products.'); return; }
  }
  const { error } = await sb.from('products').delete().eq('id', id);
  if (error) { toast('err', 'Error', error.message); return; }
  await loadProds();
  toast('ok', 'Product deleted');
}

// ── BASKET ───────────────────────────────────────────────────────
export function addToBasket(p, qty = 1) {
  if (!profile.value) { showAuth.value = true; return; }
  const ex = basket.value.find(i => i.product.id === p.id);
  if (ex) { ex.quantity += qty; toast('ok', 'Updated', p.name + ' qty updated'); }
  else { basket.value.push({ product: p, quantity: qty, notes: '' }); toast('ok', 'Added to basket', p.name); }
}

export function removeFromBasket(pid) { basket.value = basket.value.filter(i => i.product.id !== pid); }
export function clearBasket() { basket.value = []; }

export async function submitBasket(basketTotal) {
  if (!basket.value.length || !profile.value) return;
  loading.value = true; loadMsg.value = 'Submitting procurement request…';
  const numId   = Math.random().toString(36).slice(2, 8).toUpperCase();
  const prefix  = platform.value === 'techmedix' ? 'TML' : 'GDR';
  const request_number = `${prefix}-${new Date().getFullYear()}-${numId}`;
  const total   = Math.round(basketTotal);
  const { data: reqData, error: reqErr } = await sb.from('requests').insert({
    user_id: profile.value.id, platform_type: platform.value,
    request_number, status: 'pending', urgency: 'normal', source_type: 'catalog',
    total_cost: total, balance_due: total, deposit_paid: 0, payment_status: 'pending', currency: 'TZS',
    source_notes: `PROCUREMENT BASKET: ${basket.value.length} items`,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  }).select().single();
  if (reqErr) { loading.value = false; toast('err', 'Error', reqErr.message); return; }
  const items = basket.value.map(i => ({
    request_id: reqData.id, product_id: i.product.id, product_name: i.product.name,
    quantity: i.quantity,
    unit_price: Math.round(i.product.base_price_usd * (usdToTzs.value || 2650)),
    total_price: Math.round(i.product.base_price_usd * i.quantity * (usdToTzs.value || 2650)),
    notes: i.notes || null, created_at: new Date().toISOString()
  }));
  await sb.from('request_items').insert(items);
  try {
    await sb.from('tracking_events').insert({
      request_id: reqData.id, event_type: 'order_placed', event_status: 'completed',
      description: `Procurement basket -- ${basket.value.length} items submitted`,
      location: 'TechMedixLink Platform', event_time: new Date().toISOString(), created_at: new Date().toISOString()
    });
  } catch(e) { console.warn('tracking_events:', e.message); }
  await createNotification(profile.value.id, 'status_update', 'Basket Submitted',
    `Procurement request ${request_number} for ${basket.value.length} items submitted.`, reqData.id, 'in_app');
  await loadReqs(); await loadProds();
  loading.value = false; showBasket.value = false; clearBasket();
  toast('ok', 'Procurement request submitted!', request_number);
  tab.value = 'my-requests';
}

// ── REQUESTS ─────────────────────────────────────────────────────
export function quickRequest(p) {
  if (!profile.value) { showAuth.value = true; return; }
  rF.product_id = p.id;
  rF.platform_type = p.platform_type === 'both' ? 'techmedix' : (p.platform_type || 'techmedix');
  showReqModal.value = true;
}

export async function saveReq(selectedProduct, reqCostEstimate) {
  const isCatalog = rF.source_type === 'catalog';
  const isCustom  = rF.source_type === 'manual';
  const isLink    = rF.source_type === 'link';
  if (isCatalog && !rF.product_id) return;
  if (isCustom && !rF.custom_name) return;
  if (isLink && !rF.source_url) return;
  if (isLink && rF.source_url) {
    try { new URL(rF.source_url); } catch {
      toast('err', 'Invalid URL', 'Please enter a valid URL starting with https://');
      return;
    }
  }
  if (!rF.quantity || !profile.value) return;
  loading.value = true; loadMsg.value = 'Submitting request…';
  const p   = selectedProduct;
  const est = isCatalog ? reqCostEstimate : { items: 0, shipping: 0, duty: 0, fee: 0, total: 0 };
  const numId = Math.random().toString(36).slice(2, 8).toUpperCase();
  const prefix = rF.platform_type === 'techmedix' ? 'TML' : 'GDR';
  const request_number = `${prefix}-${new Date().getFullYear()}-${numId}`;
  const sourceNotes = [
    rF.notes,
    isCustom ? `ITEM: ${rF.custom_name}\nSPECS: ${rF.custom_desc}` : '',
    isLink   ? `PRODUCT LINK: ${rF.source_url}\nNOTES: ${rF.custom_desc}` : ''
  ].filter(Boolean).join('\n\n');
  const { data: reqData, error: reqErr } = await sb.from('requests').insert({
    user_id: profile.value.id, platform_type: rF.platform_type, request_number,
    status: isCatalog ? 'pending' : 'submitted', urgency: rF.urgency,
    source_type: rF.source_type, source_url: rF.source_url || null,
    source_notes: sourceNotes || null,
    item_cost: est.items, shipping_cost: est.shipping, duty_cost: est.duty,
    service_fee: est.fee, total_cost: est.total, deposit_paid: 0,
    balance_due: est.total, payment_status: 'pending', currency: 'TZS',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  }).select().single();
  if (reqErr) { loading.value = false; toast('err', 'Error', reqErr.message); return; }
  await sb.from('request_items').insert({
    request_id: reqData.id, product_id: isCatalog ? p.id : null,
    product_name: isCatalog ? p.name : (rF.custom_name || rF.source_url?.slice(0, 80) || 'Custom Item'),
    product_description: isCustom ? rF.custom_desc : (isLink ? rF.source_url : null),
    quantity: rF.quantity,
    unit_price: isCatalog ? Math.round(p.base_price_usd * usdToTzs.value) : 0,
    total_price: isCatalog ? Math.round(p.base_price_usd * rF.quantity * usdToTzs.value) : 0,
    created_at: new Date().toISOString()
  });
  await sb.from('tracking_events').insert({
    request_id: reqData.id, event_type: 'order_placed', event_status: 'completed',
    description: `Request ${request_number} submitted via ${rF.source_type === 'catalog' ? 'catalogue' : rF.source_type === 'link' ? 'product link' : 'custom request'}`,
    location: 'TechMedixLink Platform', event_time: new Date().toISOString(), created_at: new Date().toISOString()
  });
  await loadReqs(); await loadPayments(); await loadProds();
  loading.value = false; showReqModal.value = false;
  Object.assign(rF, { platform_type: 'techmedix', product_id: '', quantity: 1, urgency: 'normal', notes: '', source_type: 'catalog', address_id: '', custom_name: '', custom_desc: '', source_url: '' });
  await createNotification(profile.value.id, 'status_update', 'Request Submitted', `Your request ${request_number} has been submitted and is under review.`, reqData.id, 'in_app');
  try {
    const { data: admins } = await sb.from('users').select('id').eq('user_role', 'admin');
    for (const admin of (admins || [])) {
      await createNotification(admin.id, 'status_update', 'New Request Received', `New request ${request_number} requires review.`, reqData.id, 'in_app');
    }
  } catch {}
  lastReqNumber.value = request_number;
  showReqModal.value = false;
  showReqSuccess.value = true;
  tab.value = 'my-requests';
}

export function toggleStatusMenu(id) { openStatusMenu.value = openStatusMenu.value === id ? null : id; }

// Valid forward transitions per status
const STATUS_TRANSITIONS = {
  pending:           ['quoted','cancelled'],
  quoted:            ['deposit_paid','cancelled'],
  deposit_paid:      ['sourcing','cancelled'],
  sourcing:          ['shipped','cancelled'],
  shipped:           ['in_transit','cancelled'],
  in_transit:        ['customs_clearance','delivered','cancelled'],
  customs_clearance: ['delivered','cancelled'],
  delivered:         ['installed','completed'],
  installed:         ['completed'],
  completed:         [],
  cancelled:         [],
};

export async function updateStatus(r, newStatus) {
  // Admin can force any status, but warn for backwards moves
  const valid = STATUS_TRANSITIONS[r.status] || [];
  if (!valid.includes(newStatus) && profile.value?.user_role === 'admin') {
    // Allow but it's a backward/non-standard move — just proceed
    console.warn('Non-standard status transition:', r.status, '->', newStatus);
  }
  openStatusMenu.value = null;
  if (profile.value?.user_role === 'admin') {
    const ok = await verifyAdminServer();
    if (!ok) { toast('err', 'Unauthorised', 'Admin access required'); return; }
  }
  const { error } = await sb.from('requests').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', r.id);
  if (error) { toast('err', 'Error', error.message); return; }
  await sb.from('tracking_events').insert({
    request_id: r.id, event_type: 'status_update', event_status: 'completed',
    description: `Status updated to: ${statusList.find(x => x.val === newStatus)?.label || newStatus}`,
    event_time: new Date().toISOString(), created_at: new Date().toISOString()
  });
  if (r.user_id) {
    await createNotification(r.user_id, 'status_update',
      `Order Update: ${statusList.find(x => x.val === newStatus)?.label || newStatus}`,
      `Your request ${r.request_number} has been updated to: ${statusList.find(x => x.val === newStatus)?.label || newStatus}.`,
      r.id, 'in_app');
  }
  await loadReqs();
  try {
    if (!r.user_id) throw new Error('no user_id');
    const { data: buyerD } = await sb.from('users').select('phone,full_name').eq('id', r.user_id).single();
    if (buyerD?.phone && ['shipped', 'delivered', 'customs_clearance'].includes(newStatus)) {
      const msg = newStatus === 'shipped' ? `Bidhaa yako imesafirishwa! Ref: ${r.request_number}`
        : newStatus === 'customs_clearance' ? `Bidhaa ipo customs. Ref: ${r.request_number}`
        : `Bidhaa imefika! Thibitisha kupokea. Ref: ${r.request_number}`;
      await sendWhatsApp(buyerD.phone, `TechMedixLink: ${msg}`);
    }
  } catch {}
  toast('ok', 'Status updated', statusList.find(x => x.val === newStatus)?.label || newStatus);
}

export async function fetchTracking() {
  if (!trackId.value.trim()) return;
  loading.value = true; loadMsg.value = 'Searching…';
  const { data, error } = await sb.from('requests')
    .select('*, tracking_events(*), items:request_items(*)')
    .eq('request_number', trackId.value.trim().toUpperCase()).single();
  loading.value = false;
  if (error || !data) { trackedReq.value = null; toast('warn', 'Not found', 'Check request number and try again'); return; }
  if (data.tracking_events) data.tracking_events.sort((a, b) => new Date(a.event_time) - new Date(b.event_time));
  trackedReq.value = data;
}

export function doTrack(num) {
  tab.value = 'tracking'; trackId.value = num; trackedReq.value = null;
  setTimeout(fetchTracking, 0);
}

export function openOrderDetail(r) { orderDetailReq.value = r; showOrderDetail.value = true; }

export async function openDetailModal(r) {
  let req = { ...r };
  if (!req.tracking_events) {
    const { data } = await sb.from('tracking_events').select('*').eq('request_id', r.id).order('event_time', { ascending: true });
    req.tracking_events = data || [];
  }
  if (!req.items) {
    const { data } = await sb.from('request_items').select('*').eq('request_id', r.id);
    req.items = data || [];
  }
  try {
    const { data: assignments } = await sb.from('shopper_assignments')
      .select('*, shopper:shopper_id(*)')
      .eq('request_id', r.id)
      .in('status', ['assigned', 'accepted', 'in_progress'])
      .order('assigned_at', { ascending: false }).limit(1);
    if (assignments?.length) {
      const asgn = assignments[0];
      req.shopper_name   = asgn.shopper?.full_name || '';
      req.shopper_phone  = asgn.shopper?.phone || '';
      req.shopper_city   = asgn.shopper?.city || '';
      req.shopper_type   = asgn.shopper?.shopper_type || '';
      req.shopper_rating = asgn.shopper?.rating || 0;
      req.assignment_type   = asgn.assignment_type || '';
      req.assignment_status = asgn.status || '';
      req.shopper_assignment_id = asgn.id || null;
      req.shopper_avatar = asgn.shopper?.user_id
        ? (await sb.from('users').select('avatar_url').eq('id', asgn.shopper.user_id).single()).data?.avatar_url || null
        : null;
    }
  } catch(e) { console.error('shopper fetch:', e); }
  detailReq.value = req;
  assignShopperId.value = '';
  if (req.items?.length && req.items[0]?.product_id) loadProductReviews(req.items[0].product_id);
  else productReviews.value = [];
}

// ── PAYMENTS ─────────────────────────────────────────────────────
export function validatePaymentRef(method, ref) {
  if (!ref) return method === 'cash' || method === 'bank_transfer'; // optional for bank/cash
  if (method === 'mereu_pay') return /^MPY-\d{4}-[A-Z0-9]{6}$/i.test(ref) || ref.length >= 6;
  if (method === 'bank_transfer') return ref.length >= 4;
  if (method === 'cash') return true;
  return /^[A-Z0-9]{8,12}$/.test(ref.toUpperCase());
}
// Keep old name for compatibility
export function validateMpesaRef(ref) { return validatePaymentRef('mpesa', ref); }

export function askCancelRequest(r) { cancelReq.value = r; cancelReason.value = ''; showCancelModal.value = true; }

export async function doCancel() {
  if (!cancelReq.value) return;
  loading.value = true; loadMsg.value = 'Cancelling request…';
  const reason = cancelReason.value || 'Cancelled by buyer';
  const { error } = await sb.from('requests').update({
    status: 'cancelled',
    source_notes: (cancelReq.value.source_notes ? cancelReq.value.source_notes + '\n\n' : '') + 'CANCELLATION REASON: ' + reason,
    updated_at: new Date().toISOString()
  }).eq('id', cancelReq.value.id);
  if (error) { loading.value = false; toast('err', 'Error', error.message); return; }
  await sb.from('tracking_events').insert({
    request_id: cancelReq.value.id, event_type: 'order_placed', event_status: 'failed',
    description: 'Request cancelled by buyer. Reason: ' + reason,
    location: 'TechMedixLink Platform', event_time: new Date().toISOString(), created_at: new Date().toISOString()
  });
  await loadReqs();
  loading.value = false; showCancelModal.value = false; cancelReq.value = null;
  toast('warn', 'Request cancelled', reason);
}

export function askPayment(r) {
  paymentReq.value = r;
  pmtF.type      = (r.deposit_paid || 0) > 0 ? 'balance' : 'deposit';
  pmtF.amount    = r.balance_due || 0;
  pmtF.method    = 'mpesa';
  pmtF.reference = '';
  pmtF.notes     = '';
  pmtF.phone     = profile.value?.phone || '';
}

export async function doPayment(r) {
  if (!pmtF.amount || pmtF.amount <= 0) { toast('err', 'Invalid amount', 'Enter a valid payment amount'); return; }
  // Validate reference per method
  if (!validatePaymentRef(pmtF.method, pmtF.reference)) {
    const msgs = {
      mpesa: 'M-Pesa reference should be 8-12 alphanumeric characters (e.g. QHX1234ABC)',
      mereu_pay: 'Enter your Mereu Pay transaction ID',
      tigo_pesa: 'Tigo Pesa reference should be 8-12 characters',
      airtel_money: 'Airtel Money reference should be 8-12 characters',
      bank_transfer: 'Enter your bank transaction reference',
    };
    toast('err', 'Invalid reference', msgs[pmtF.method] || 'Please enter a valid reference');
    return;
  }
  if (pmtF.amount > (r.balance_due || 0) + 1) toast('warn', 'Overpayment warning', `Amount exceeds balance due of ${tzs(r.balance_due)}`);
  loading.value = true; loadMsg.value = 'Recording payment…';
  const isAdmin = profile.value?.user_role === 'admin';
  const newDeposit   = (r.deposit_paid || 0) + pmtF.amount;
  const newBalance   = Math.max(0, (r.total_cost || 0) - newDeposit);
  const newPayStatus = newBalance <= 0 ? 'paid' : 'partial';
  const { error: payErr } = await sb.from('payments').insert({
    request_id: r.id, user_id: r.user_id, amount: pmtF.amount,
    payment_method: pmtF.method, payment_type: pmtF.type,
    status: isAdmin ? 'completed' : 'pending', currency: 'TZS',
    mpesa_reference: pmtF.reference ? pmtF.reference.toUpperCase() : null,
    mpesa_phone: pmtF.phone || null,
    notes: sanitize(pmtF.notes, 500) || null,
    payment_date: new Date().toISOString(), created_at: new Date().toISOString()
  }).select().single();
  if (payErr) { loading.value = false; toast('err', 'Error', payErr.message); return; }
  if (isAdmin) {
    await sb.from('requests').update({
      deposit_paid: newDeposit, balance_due: newBalance, payment_status: newPayStatus,
      status: ['pending','processing','quoted'].includes(r.status) ? 'deposit_paid' : r.status,
      updated_at: new Date().toISOString()
    }).eq('id', r.id);
    const reqItems = (await sb.from('request_items').select('product_id,quantity').eq('request_id', r.id)).data || [];
    for (const item of reqItems) {
      if (!item.product_id) continue;
      const { data: prod } = await sb.from('products').select('stock_quantity').eq('id', item.product_id).single();
      if (prod) await sb.from('products').update({ stock_quantity: Math.max(0, (prod.stock_quantity || 0) - item.quantity), updated_at: new Date().toISOString() }).eq('id', item.product_id);
    }
  }
  await sb.from('tracking_events').insert({
    request_id: r.id, event_type: 'payment_received',
    event_status: isAdmin ? 'completed' : 'pending',
    description: `Payment of ${tzs(pmtF.amount)} ${isAdmin ? 'confirmed' : 'reported'} via ${pmtF.method?.replace(/_/g, ' ')}${pmtF.reference ? ' · Ref: ' + pmtF.reference.toUpperCase() : ''}`,
    location: 'TechMedixLink Platform', event_time: new Date().toISOString(), created_at: new Date().toISOString()
  });
  await loadReqs(); await loadPayments();
  loading.value = false; paymentReq.value = null;
  const payMsg = isAdmin
    ? `Payment of ${tzs(pmtF.amount)} confirmed for request ${r.request_number}.`
    : `Your payment of ${tzs(pmtF.amount)} for ${r.request_number} has been received and is pending verification.`;
  await createNotification(r.user_id, 'payment_received', isAdmin ? 'Payment Confirmed' : 'Payment Received', payMsg, r.id, 'in_app');
  if (pmtF.method === 'mereu_pay') {
    toast('ok', 'Mereu Pay submitted', 'Transaction will be verified instantly');
  } else if (pmtF.method === 'cash') {
    toast('ok', 'Cash payment recorded', 'Our team will contact you to arrange payment');
  } else if (autoConfirm) {
    toast('ok', 'Payment confirmed', tzs(pmtF.amount));
  } else {
    toast('info', 'Payment submitted', 'Admin will confirm within 24 hours · Ref: ' + (pmtF.reference || 'N/A'));
  }
}

// ── QUOTES ───────────────────────────────────────────────────────
export function openQuoteModal(r) {
  quoteReq.value = r;
  Object.assign(qF, { item_cost: r.item_cost || 0, shipping_cost: r.shipping_cost || 0, duty_cost: r.duty_cost || 0, service_fee: r.service_fee || 0, delivery_date: '', notes: '' });
  showQuoteModal.value = true;
}

export async function sendQuote() {
  if (!quoteReq.value || !qF.item_cost) return;
  loading.value = true; loadMsg.value = 'Sending quote…';
  const total = (qF.item_cost || 0) + (qF.shipping_cost || 0) + (qF.duty_cost || 0) + (qF.service_fee || 0);
  const { error } = await sb.from('requests').update({
    status: 'quoted', item_cost: qF.item_cost, shipping_cost: qF.shipping_cost,
    duty_cost: qF.duty_cost, service_fee: qF.service_fee, total_cost: total,
    balance_due: Math.max(0, total - (quoteReq.value.deposit_paid || 0)),
    expected_delivery_date: qF.delivery_date || null, updated_at: new Date().toISOString()
  }).eq('id', quoteReq.value.id);
  if (error) { loading.value = false; toast('err', 'Error', error.message); return; }
  await sb.from('tracking_events').insert({
    request_id: quoteReq.value.id, event_type: 'quote_sent', event_status: 'completed',
    description: `Quote of ${tzs(total)} sent to buyer. Notes: ${qF.notes || 'None'}`,
    event_time: new Date().toISOString(), created_at: new Date().toISOString()
  });
  await loadReqs();
  loading.value = false;
  const savedReq = quoteReq.value;
  showQuoteModal.value = false; quoteReq.value = null;
  if (savedReq?.user_id) {
    await createNotification(savedReq.user_id, 'payment_required', 'Quote Ready for Review',
      `Your quote for ${savedReq.request_number} is ready. Total: ${tzs(total)}. Please review and accept or decline.`, savedReq.id, 'in_app');
  }
  try {
    if (!savedReq?.user_id) throw new Error('no user_id');
    const { data: buyerD } = await sb.from('users').select('phone,full_name').eq('id', savedReq.user_id).single();
    if (buyerD?.phone) await sendWhatsApp(buyerD.phone, `TechMedixLink: Habari ${buyerD.full_name || ''}! Quotation yako iko tayari. Nambari: ${savedReq?.request_number}`);
  } catch {}
  toast('ok', 'Quote sent to buyer');
}

export async function acceptQuote(r) {
  askPayment(r);
  toast('ok', 'Quote accepted! Complete your deposit below to begin sourcing.');
  setTimeout(() => {
    const pmtEl = document.querySelector('.pmt-amount-input, input[placeholder*="amount"], input[placeholder*="Amount"]');
    if (pmtEl) pmtEl.focus();
  }, 300);
}

export async function confirmReceipt(r) {
  confirm.value = {
    title: 'Confirm Delivery', tone: 'ok', icon: 'fas fa-box-open', ok_lbl: 'Confirm Receipt',
    msg: 'Confirm that you have received your order in good condition? This will complete the request and prompt you to leave a review.',
    ok: async () => {
      await sb.from('requests').update({ status: 'completed', actual_delivery_date: new Date().toISOString().split('T')[0], updated_at: new Date().toISOString() }).eq('id', r.id);
      await sb.from('tracking_events').insert({ request_id: r.id, event_type: 'delivered', event_status: 'completed', description: 'Delivery confirmed by buyer.', location: 'Buyer confirmed', event_time: new Date().toISOString(), created_at: new Date().toISOString() });
      await loadReqs();
      const updated = allRequests.value.find(req => req.id === r.id);
      if (updated) openReviewModal(updated);
      toast('ok', 'Receipt confirmed!', 'Thank you -- please leave a review.');
    }
  };
}

export async function declineQuote(r) {
  confirm.value = { title: 'Decline Quote', msg: 'Are you sure you want to decline this quote? The request will be cancelled.', tone: 'er', icon: 'fas fa-times', ok_lbl: 'Decline Quote', ok: async () => { await updateStatus(r, 'cancelled'); toast('info', 'Quote declined'); } };
}

// ── REVIEWS ──────────────────────────────────────────────────────
export function openReviewModal(r) {
  reviewReq.value = r; reviewF.rating = 0; reviewF.title = ''; reviewF.body = '';
  showReviewModal.value = true;
}

export async function openProductDetail(p) {
  viewedProduct.value = p; showProductDetail.value = true; pd3dMode.value = false; pdQty.value = 1;
  pdReviews.value = []; pdLoading.value = true; activeDetailImage.value = null;
  try {
    const { data: rvData } = await sb.from('reviews').select('*')
      .eq('reviewed_entity_type', 'product').eq('reviewed_entity_id', p.id)
      .order('created_at', { ascending: false }).limit(10);
    if (rvData?.length) {
      const userIds = [...new Set(rvData.map(r => r.user_id).filter(Boolean))];
      const { data: usersData } = await sb.from('users').select('id, full_name, avatar_url').in('id', userIds);
      const userMap = Object.fromEntries((usersData || []).map(u => [u.id, u]));
      pdReviews.value = rvData.map(r => ({ ...r, user: userMap[r.user_id] || null }));
    } else { pdReviews.value = []; }
  } catch(e) { console.error('pdReviews:', e); }
  pdLoading.value = false;
}

export async function loadProductReviews(productId) {
  try {
    const { data: rvData } = await sb.from('reviews').select('*')
      .eq('reviewed_entity_type', 'product').eq('reviewed_entity_id', productId)
      .order('created_at', { ascending: false });
    if (rvData?.length) {
      const userIds = [...new Set(rvData.map(r => r.user_id).filter(Boolean))];
      const { data: usersData } = await sb.from('users').select('id, full_name, avatar_url').in('id', userIds);
      const userMap = Object.fromEntries((usersData || []).map(u => [u.id, u]));
      productReviews.value = rvData.map(r => ({ ...r, user: userMap[r.user_id] || null }));
    } else { productReviews.value = []; }
  } catch(e) { console.error('loadProductReviews:', e); }
}

export async function saveReview() {
  if (!reviewReq.value || !reviewF.rating || !profile.value) return;
  const items     = reviewReq.value.items || [];
  const productId = items[0]?.product_id || null;
  const reviewText = [reviewF.title, reviewF.body].filter(Boolean).join('\n\n') || null;
  const { error } = await sb.from('reviews').insert({
    user_id: profile.value.id, request_id: reviewReq.value.id, rating: reviewF.rating,
    review_text: reviewText, reviewed_entity_type: 'product', reviewed_entity_id: productId,
    is_verified_purchase: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  });
  if (error) { toast('err', 'Error', error.message); return; }
  showReviewModal.value = false; reviewF.rating = 0; reviewF.title = ''; reviewF.body = '';
  toast('ok', 'Review submitted', 'Thank you for your feedback!');
}

// ── SHOPPERS ─────────────────────────────────────────────────────
export function openShopperModal(sh = null) {
  editingShopper.value = sh;
  if (sh) Object.assign(shF, { full_name: sh.full_name || '', phone: sh.phone || '', city: sh.city || '', country: sh.country || 'Tanzania', specialization: sh.specialization || '', is_active: sh.is_active !== false });
  else Object.assign(shF, { full_name: '', phone: '', city: '', country: 'Tanzania', specialization: '', is_active: true });
  showShopperModal.value = true;
}

export async function saveShopper() {
  if (!shF.full_name) return;
  const payload = { full_name: shF.full_name, phone: shF.phone || null, city: shF.city, country: shF.country, specialization: shF.specialization || null, is_active: shF.is_active };
  let error;
  if (editingShopper.value) { ({ error } = await sb.from('shoppers').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingShopper.value.id)); }
  else { ({ error } = await sb.from('shoppers').insert({ ...payload, created_at: new Date().toISOString() })); }
  if (error) { toast('err', 'Error', error.message); return; }
  await loadShoppers();
  showShopperModal.value = false;
  toast('ok', editingShopper.value ? 'Shopper updated' : 'Shopper added');
}

export async function updateShopperStatus(r, newStatus) {
  if (!r.shopper_assignment_id) return;
  const { error } = await sb.from('shopper_assignments').update({
    status: newStatus,
    ...(newStatus === 'accepted' ? { accepted_at: new Date().toISOString() } : {}),
    ...(newStatus === 'completed' ? { completed_at: new Date().toISOString() } : {}),
  }).eq('id', r.shopper_assignment_id);
  if (!error) { await loadReqs(); toast('ok', 'Shopper status updated', newStatus); }
}

export async function assignShopper(r) {
  if (!assignShopperId.value) return;
  const sh = shoppers.value.find(s => s.id === assignShopperId.value);
  const { error } = await sb.from('requests').update({ shopper_id: assignShopperId.value, updated_at: new Date().toISOString() }).eq('id', r.id);
  if (error) { toast('err', 'Error', error.message); return; }
  if (detailReq.value?.id === r.id) detailReq.value = { ...detailReq.value, shopper_name: sh?.full_name, shopper_phone: sh?.phone, shopper_id: assignShopperId.value };
  await loadReqs();
  toast('ok', 'Shopper assigned', sh?.full_name || '');
  assignShopperId.value = '';
}

export async function openInquiryDetail(r) {
  let req = { ...r };
  if (!req.items) {
    const { data } = await sb.from('request_items').select('*').eq('request_id', r.id);
    req.items = data || [];
  }
  inquiryReq.value = req; showInquiryDetail.value = true;
}

export async function acceptInquiry(r) {
  const { error } = await sb.from('requests').update({ status: 'submitted', updated_at: new Date().toISOString() }).eq('id', r.id);
  if (error) { toast('err', 'Error', error.message); return; }
  await sb.from('tracking_events').insert({ request_id: r.id, event_type: 'processing', event_status: 'completed', description: 'Inquiry accepted by seller. Quote will be provided shortly.', event_time: new Date().toISOString(), created_at: new Date().toISOString() });
  if (r.user_id) await createNotification(r.user_id, 'status_update', 'Inquiry Accepted', 'Your inquiry ' + r.request_number + ' has been accepted. A quote is being prepared.', r.id, 'in_app');
  await loadReqs();
  toast('ok', 'Inquiry accepted', 'Buyer notified. Please send a quote.');
}

export function acknowledgeInquiry(r) { showInquiryDetail.value = false; inquiryReq.value = null; openQuoteModal(r); }

export async function declineInquiry(r) {
  confirm.value = {
    title: 'Decline Inquiry', tone: 'er', icon: 'fas fa-times-circle', ok_lbl: 'Decline',
    msg: `Decline the inquiry ${r.request_number}? The buyer will be notified that this item is unavailable.`,
    ok: async () => {
      const { error } = await sb.from('requests').update({ status: 'cancelled', source_notes: (r.source_notes ? r.source_notes + '\n\n' : '') + 'DECLINED BY SELLER: Item unavailable or seller unable to fulfil.', updated_at: new Date().toISOString() }).eq('id', r.id);
      if (!error) {
        await sb.from('tracking_events').insert({ request_id: r.id, event_type: 'order_placed', event_status: 'failed', description: 'Inquiry declined by seller -- item unavailable.', location: 'TechMedixLink Platform', event_time: new Date().toISOString(), created_at: new Date().toISOString() });
        await loadReqs(); showInquiryDetail.value = false; toast('info', 'Inquiry declined');
      }
    }
  };
}

// ── ADMIN ────────────────────────────────────────────────────────
export function adminEditUser(u) {
  adminViewUser.value = u; adminEditingUser.value = false;
  Object.assign(adminUF, { full_name: u.full_name || '', phone: u.phone || '', user_type: u.user_type || 'individual', user_role: u.user_role || 'buyer', company_name: u.company_name || '' });
  showAdminUserModal.value = true;
}

export async function adminSaveUser() {
  if (!adminViewUser.value) return;
  const ok = await verifyAdminServer();
  if (!ok) { toast('err', 'Unauthorised'); return; }
  const { error } = await sb.from('users').update({ full_name: sanitize(adminUF.full_name, 100), phone: adminUF.phone || null, user_type: adminUF.user_type, user_role: adminUF.user_role, company_name: adminUF.company_name || null, updated_at: new Date().toISOString() }).eq('id', adminViewUser.value.id);
  if (error) { toast('err', 'Error', error.message); return; }
  await loadAdminUsers(); adminEditingUser.value = false;
  adminViewUser.value = { ...adminViewUser.value, ...adminUF };
  toast('ok', 'User updated');
}

export async function adminToggleUserRole(u) {
  const ok = await verifyAdminServer();
  if (!ok) { toast('err', 'Unauthorised', 'Admin access required'); return; }
  const roles = ['buyer', 'seller', 'both', 'admin'];
  const next = roles[(roles.indexOf(u.user_role) + 1) % roles.length];
  // ITEM 82: Warn if demoting a seller with active listings
  if (['seller','both'].includes(u.user_role) && next === 'buyer') {
    const { data: listings } = await sb.from('products').select('id').eq('user_id', u.id).eq('is_active', true);
    if (listings?.length) {
      confirm.value = {
        title: 'Demote seller?', tone: 'wn', icon: 'fas fa-exclamation-triangle',
        ok_lbl: 'Demote & Hide Listings',
        msg: `${u.full_name} has ${listings.length} active listing(s). Demoting will hide all their products.`,
        ok: async () => {
          await sb.from('products').update({ is_active: false }).eq('user_id', u.id);
          await sb.from('users').update({ user_role: next, updated_at: new Date().toISOString() }).eq('id', u.id);
          await loadAdminUsers(); await loadProds();
          toast('ok', 'Role updated + listings hidden', `${u.full_name} → ${next}`);
        }
      };
      return;
    }
  }
  const { error } = await sb.from('users').update({ user_role: next, updated_at: new Date().toISOString() }).eq('id', u.id);
  if (!error) { await loadAdminUsers(); toast('ok', 'Role updated', `${u.full_name} → ${next}`); }
}

export async function requestVerification() {
  if (!profile.value) return;
  loading.value = true; loadMsg.value = 'Submitting verification request…';
  try {
    const uploads = {};
    for (const field of ['business_reg', 'tax_cert', 'tmda_license']) {
      const file = verifyDocs[field];
      if (file instanceof File) {
        const ext  = file.name.split('.').pop();
        const path = `verification/${profile.value.id}/${field}_${Date.now()}.${ext}`;
        const { error: upErr } = await sb.storage.from('verification-docs').upload(path, file, { upsert: true, cacheControl: '3600' });
        if (!upErr) {
          const { data: urlData } = sb.storage.from('verification-docs').getPublicUrl(path);
          uploads[field] = urlData.publicUrl;
        }
      }
    }
    const existingName = (profile.value.company_name || '').replace(/^\[(VERIFIED|VERIFY_REQUESTED)\]/, '').trim();
    const { error } = await sb.from('users').update({ company_name: '[VERIFY_REQUESTED]' + existingName, updated_at: new Date().toISOString() }).eq('id', profile.value.id);
    if (error) throw error;
    const { data: admins } = await sb.from('users').select('id').eq('user_role', 'admin');
    for (const admin of (admins || [])) {
      await createNotification(admin.id, 'status_update', 'Verification Request Submitted',
        `${profile.value.full_name || 'A seller'} has submitted documents for verification. Please review in Admin → All Users.`, null, 'in_app');
    }
    await loadUserProfile(profile.value.id);
    showVerifyModal.value = false;
    Object.assign(verifyDocs, { business_reg: null, tax_cert: null, tmda_license: null, notes: '', business_reg_name: '', tax_cert_name: '', tmda_license_name: '' });
    toast('ok', 'Verification submitted!', 'Admin will review your documents within 2 business days.');
  } catch(e) { toast('err', 'Submission failed', e.message); }
  finally { loading.value = false; }
}

export function handleVerifyDocChange(field, e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!['application/pdf','image/jpeg','image/jpg','image/png','image/webp'].includes(file.type)) { toast('err', 'Invalid file type', 'Please upload a PDF, JPG, or PNG.'); e.target.value = ''; return; }
  if (file.size > 8 * 1024 * 1024) { toast('err', 'File too large', 'Maximum file size is 8MB.'); e.target.value = ''; return; }
  verifyDocs[field] = file; verifyDocs[field + '_name'] = file.name;
}

export async function toggleVerified(u) {
  const raw = u.company_name || '';
  const isVerified = raw.startsWith('[VERIFIED]');
  const actualName = raw.replace(/^\[(VERIFIED|VERIFY_REQUESTED)\]/, '').trim();
  const newName = isVerified ? (actualName || null) : '[VERIFIED]' + actualName;
  const { error } = await sb.from('users').update({ company_name: newName, updated_at: new Date().toISOString() }).eq('id', u.id);
  if (!error) {
    if (!isVerified) await createNotification(u.id, 'status_update', 'Account Verified!', 'Congratulations! Your seller account has been verified. You now appear with a verified badge on all your listings.', null, 'in_app');
    await loadAdminUsers();
    toast('ok', isVerified ? 'Verification revoked' : 'User verified');
  }
}

export function userVerifyStatus(u) {
  const cn = u?.company_name || '';
  if (cn.startsWith('[VERIFIED]'))         return 'verified';
  if (cn.startsWith('[VERIFY_REQUESTED]')) return 'pending';
  return 'none';
}

// ── BULK ACTIONS ─────────────────────────────────────────────────
export function toggleUserSelect(id) { const s = new Set(selectedUserIds.value); s.has(id) ? s.delete(id) : s.add(id); selectedUserIds.value = s; }
export function toggleAllUsers(filteredAdminUsers, allSelected) { selectedUserIds.value = allSelected ? new Set() : new Set(filteredAdminUsers.map(u => u.id)); }
export function toggleProductSelect(id) { const s = new Set(selectedProductIds.value); s.has(id) ? s.delete(id) : s.add(id); selectedProductIds.value = s; }
export function toggleAllProducts(filteredProds, allSelected) { selectedProductIds.value = allSelected ? new Set() : new Set(filteredProds.map(p => p.id)); }

export async function bulkVerifyUsers() {
  if (!selectedUserIds.value.size) return;
  const ok = await verifyAdminServer();
  if (!ok) { toast('err', 'Unauthorised'); return; }
  bulkActionLoading.value = true;
  const ids = [...selectedUserIds.value];
  await Promise.all(ids.map(async (userId) => {
    const u = adminUsers.value.find(u => u.id === userId);
    if (!u) return;
    const actualName = (u.company_name || '').replace(/^\[(VERIFIED|VERIFY_REQUESTED)\]/, '').trim();
    const { error } = await sb.from('users').update({ company_name: '[VERIFIED]' + actualName, updated_at: new Date().toISOString() }).eq('id', userId);
    if (!error) await createNotification(userId, 'status_update', 'Account Verified!', 'Congratulations! Your seller account has been verified.', null, 'in_app');
  }));
  await loadAdminUsers(); selectedUserIds.value = new Set(); bulkActionLoading.value = false;
  toast('ok', `${ids.length} users verified`);
}

export async function bulkToggleProductsActive(active) {
  if (!selectedProductIds.value.size) return;
  const ok = await verifyAdminServer();
  if (!ok) { toast('err', 'Unauthorised'); return; }
  bulkActionLoading.value = true;
  const ids = [...selectedProductIds.value];
  await Promise.all(ids.map(id => sb.from('products').update({ is_active: active, updated_at: new Date().toISOString() }).eq('id', id)));
  await loadProds(); selectedProductIds.value = new Set(); bulkActionLoading.value = false;
  toast('ok', `${ids.length} products ${active ? 'activated' : 'hidden'}`);
}

export async function bulkSwitchPlatform(platform_type) {
  if (!selectedProductIds.value.size) return;
  const ok = await verifyAdminServer();
  if (!ok) { toast('err', 'Unauthorised'); return; }
  bulkActionLoading.value = true;
  const ids = [...selectedProductIds.value];
  await Promise.all(ids.map(id => sb.from('products').update({ platform_type, updated_at: new Date().toISOString() }).eq('id', id)));
  await loadProds(); selectedProductIds.value = new Set(); bulkActionLoading.value = false;
  toast('ok', `${ids.length} products moved to ${platform_type}`);
}

export async function bulkSetUserRole(role) {
  if (!selectedUserIds.value.size) return;
  const ok = await verifyAdminServer();
  if (!ok) { toast('err', 'Unauthorised'); return; }
  bulkActionLoading.value = true;
  const ids = [...selectedUserIds.value];
  await Promise.all(ids.map(id => sb.from('users').update({ user_role: role, updated_at: new Date().toISOString() }).eq('id', id)));
  await loadAdminUsers(); selectedUserIds.value = new Set(); bulkActionLoading.value = false;
  toast('ok', `${ids.length} users updated`);
}

// ── ADMIN: CONFIRM INDIVIDUAL PAYMENT ────────────────────────────
export async function confirmPaymentAdmin(payment) {
  const ok = await verifyAdminServer();
  if (!ok) { toast('err', 'Unauthorised'); return; }
  loading.value = true; loadMsg.value = 'Confirming payment…';
  const { error } = await sb.from('payments').update({
    status: 'completed',
    completed_date: new Date().toISOString(),
  }).eq('id', payment.id);
  if (error) { loading.value = false; toast('err', 'Error', error.message); return; }
  // Update the parent request's deposit/balance
  const req = allRequests.value.find(r => r.id === payment.request_id);
  if (req) {
    const newDeposit   = (req.deposit_paid || 0) + payment.amount;
    const newBalance   = Math.max(0, (req.total_cost || 0) - newDeposit);
    const newPayStatus = newBalance <= 0 ? 'paid' : 'partial';
    await sb.from('requests').update({
      deposit_paid: newDeposit, balance_due: newBalance,
      payment_status: newPayStatus,
      status: ['pending','processing','quoted'].includes(req.status) ? 'deposit_paid' : req.status,
      updated_at: new Date().toISOString()
    }).eq('id', req.id);
    await createNotification(req.user_id, 'payment_received', 'Payment Confirmed',
      `Your payment of ${tzs(payment.amount)} for ${req.request_number} has been confirmed.`,
      req.id, 'in_app');
  }
  await loadPayments(); await loadReqs();
  loading.value = false;
  toast('ok', 'Payment confirmed', tzs(payment.amount));
}


let activeMessageChannel = null;

export async function openMessages(r) {
  messagesReq.value = r; showMessagesPanel.value = true;
  messages.value = []; messagesLoading.value = true;
  try {
    const { data, error } = await sb.from('messages')
      .select('*, sender:sender_id(id, full_name, avatar_url, user_role)')
      .eq('request_id', r.id).order('created_at', { ascending: true });
    if (error) throw error;
    messages.value = data || [];
    await sb.from('messages').update({ is_read: true }).eq('request_id', r.id).neq('sender_id', profile.value?.id);
  } catch(e) { console.error('openMessages:', e); }
  finally { messagesLoading.value = false; }
  if (activeMessageChannel) sb.removeChannel(activeMessageChannel);
  activeMessageChannel = sb.channel(`messages-${r.id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `request_id=eq.${r.id}` }, async (payload) => {
      const { data: senderData } = await sb.from('users').select('id, full_name, avatar_url, user_role').eq('id', payload.new.sender_id).single();
      messages.value.push({ ...payload.new, sender: senderData });
      await loadUnreadMessageCounts();
    }).subscribe();
}

export async function sendMessage() {
  const body = newMessageText.value.trim();
  if (!body || !messagesReq.value || !profile.value) return;
  const optimistic = {
    id: 'tmp-' + Date.now(), request_id: messagesReq.value.id,
    sender_id: profile.value.id, body, is_read: false,
    created_at: new Date().toISOString(),
    sender: { id: profile.value.id, full_name: profile.value.full_name, avatar_url: profile.value.avatar_url, user_role: profile.value.user_role },
  };
  messages.value.push(optimistic);
  newMessageText.value = '';
  const { data, error } = await sb.from('messages').insert({ request_id: messagesReq.value.id, sender_id: profile.value.id, body: sanitize(body, 2000), created_at: new Date().toISOString() }).select().single();
  if (error) {
    messages.value = messages.value.filter(m => m.id !== optimistic.id);
    toast('err', 'Message failed', error.message);
    newMessageText.value = body; return;
  }
  const idx = messages.value.findIndex(m => m.id === optimistic.id);
  if (idx >= 0) messages.value[idx] = { ...data, sender: optimistic.sender };
  const reqUserId = messagesReq.value.user_id;
  if (reqUserId && reqUserId !== profile.value.id) {
    await createNotification(reqUserId, 'status_update', 'New message on your request',
      `${profile.value.full_name || 'Someone'} sent a message on request ${messagesReq.value.request_number}.`, messagesReq.value.id, 'in_app');
  }
}

export function closeMessages() {
  showMessagesPanel.value = false;
  if (activeMessageChannel) { sb.removeChannel(activeMessageChannel); activeMessageChannel = null; }
  messagesReq.value = null; messages.value = []; newMessageText.value = '';
}

export async function loadUnreadMessageCounts() {
  if (!profile.value) return;
  try {
    const { data } = await sb.from('messages').select('request_id').eq('is_read', false).neq('sender_id', profile.value.id);
    const counts = {};
    (data || []).forEach(m => { counts[m.request_id] = (counts[m.request_id] || 0) + 1; });
    unreadMessageCounts.value = counts;
  } catch {}
}

// ── PRINT ────────────────────────────────────────────────────────
export function printPPRA(r) {
  const items = r.items || [];
  const date  = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const rows  = items.map((it, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td><strong>${it.product_name || '--'}</strong>${it.notes ? '<br><span style="font-size:10px;color:#666">' + it.notes + '</span>' : ''}</td>
      <td style="text-align:center">${it.quantity || 1}</td>
      <td style="text-align:right;font-family:monospace">TZS ${Math.round(it.unit_price || 0).toLocaleString()}</td>
      <td style="text-align:right;font-family:monospace">TZS ${Math.round(it.total_price || 0).toLocaleString()}</td>
    </tr>`).join('');
  const totalTZS = Math.round(r.total_cost || 0).toLocaleString();
  const paidTZS  = Math.round(r.deposit_paid || 0).toLocaleString();
  const dueTZS   = Math.round(r.balance_due || 0).toLocaleString();
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>PPRA - ${r.request_number}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11px;padding:20mm 15mm}
  .header{display:flex;justify-content:space-between;border-bottom:3px solid #0066a1;padding-bottom:12px;margin-bottom:16px}
  .org-name{font-size:18px;font-weight:700;color:#0066a1}.doc-title{font-size:13px;font-weight:700;text-align:right;color:#0066a1}
  table{width:100%;border-collapse:collapse}thead tr{background:#0066a1;color:white}th{padding:8px 10px;text-align:left;font-size:10px}
  td{padding:7px 10px;border-bottom:1px solid #eee}tr:nth-child(even) td{background:#f7f9fc}
  .financials{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:14px 0}
  .fin-box{border:1px solid #ddd;border-radius:4px;padding:10px;text-align:center}
  .fin-label{font-size:9px;color:#888;text-transform:uppercase;margin-bottom:4px}
  .fin-val{font-size:13px;font-weight:700;font-family:monospace}.fin-val.paid{color:#1a7a4a}.fin-val.due{color:#c0392b}
  .sig-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:20px}
  .sig-box{border:1px solid #bbb;border-radius:4px;padding:12px;min-height:80px}
  .sig-line{border-bottom:1px solid #999;margin:12px 0 4px}.sig-lbl{font-size:9px;color:#888}
  .footer{margin-top:20px;padding-top:10px;border-top:1px solid #ddd;font-size:9px;color:#777;text-align:center}
  @media print{body{padding:10mm}}</style></head><body>
  <div class="header"><div><div class="org-name">TechMedixLink Ltd</div><div style="font-size:10px;color:#555">Medical Equipment Marketplace · Tanzania</div></div>
  <div><div class="doc-title">PROCUREMENT REQUEST DOCUMENT</div><div style="font-size:10px;text-align:right;color:#555;margin-top:4px"><strong>Ref:</strong> ${r.request_number}<br><strong>Date:</strong> ${date}</div></div></div>
  <table><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
  <tbody>${rows}<tr style="background:#f0f4f8"><td colspan="4" style="text-align:right;font-weight:600">TOTAL</td><td style="text-align:right;font-family:monospace;font-weight:700">TZS ${totalTZS}</td></tr></tbody></table>
  <div class="financials">
    <div class="fin-box"><div class="fin-label">Total</div><div class="fin-val">TZS ${totalTZS}</div></div>
    <div class="fin-box"><div class="fin-label">Paid</div><div class="fin-val paid">TZS ${paidTZS}</div></div>
    <div class="fin-box"><div class="fin-label">Balance Due</div><div class="fin-val due">TZS ${dueTZS}</div></div>
  </div>
  <div class="sig-grid">
    <div class="sig-box"><div style="font-size:9px;font-weight:700;color:#0066a1;margin-bottom:8px">PROCUREMENT OFFICER</div><div class="sig-line"></div><div class="sig-lbl">Name &amp; Signature</div></div>
    <div class="sig-box"><div style="font-size:9px;font-weight:700;color:#0066a1;margin-bottom:8px">AUTHORISED SIGNATORY</div><div class="sig-line"></div><div class="sig-lbl">Name &amp; Signature</div></div>
    <div class="sig-box"><div style="font-size:9px;font-weight:700;color:#0066a1;margin-bottom:8px">SUPPLIER CONFIRMATION</div><div class="sig-line"></div><div class="sig-lbl">Company &amp; Signature</div></div>
  </div>
  <div class="footer">Generated by TechMedixLink Limited · PPRA Cap. 410 · Ref: ${r.request_number} · ${date}</div>
  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 500);
}

export function printQuote(r) { window.print(); }

// ── ADMIN: EXPORT REQUESTS TO CSV ────────────────────────────────
export function exportRequestsCSV(requests, adminUsers) {
  const headers = ['Request #','Status','Platform','Buyer','Total (TZS)','Paid (TZS)','Balance (TZS)','Payment Status','Date'];
  const rows = requests.map(r => {
    const buyer = adminUsers?.find(u => u.id === r.user_id);
    return [
      r.request_number || '',
      r.status || '',
      r.platform_type || '',
      buyer?.full_name || buyer?.email || r.user_id?.slice(0,8) || '',
      Math.round(r.total_cost || 0),
      Math.round(r.deposit_paid || 0),
      Math.round(r.balance_due || 0),
      r.payment_status || '',
      r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB') : '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `techmedixlink-requests-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ── ACCURATE TRIAGE COUNTS (item 83) — queries DB not paginated array ──
export async function loadTriageCounts() {
  try {
    const [pending, payments, verify] = await Promise.all([
      sb.from('requests').select('id', { count: 'exact', head: true }).in('status', ['pending','submitted']),
      sb.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      sb.from('users').select('id', { count: 'exact', head: true }).ilike('company_name', '[VERIFY_REQUESTED]%'),
    ]);
    return {
      pendingRequests: pending.count || 0,
      pendingPayments: payments.count || 0,
      verifyRequests: verify.count || 0,
    };
  } catch { return { pendingRequests: 0, pendingPayments: 0, verifyRequests: 0 }; }
}

// ── UPDATE STOCK QUANTITY inline (seller listings) ───────────────
export async function updateStockQty(p, val) {
  const qty = Math.max(0, parseInt(val) || 0);
  const { error } = await sb.from('products')
    .update({ stock_quantity: qty, updated_at: new Date().toISOString() })
    .eq('id', p.id);
  if (error) { toast('err', 'Error', error.message); return; }
  const idx = products.value.findIndex(x => x.id === p.id);
  if (idx >= 0) products.value[idx].stock_quantity = qty;
}

// ── QUICK REQUEST WITH QUANTITY ───────────────────────────────────
export function quickRequestWithQty(p, qty = 1) {
  if (!profile.value) { showAuth.value = true; return; }
  rF.product_id = p.id;
  rF.quantity = qty || 1;
  rF.platform_type = p.platform_type === 'both' ? 'techmedix' : (p.platform_type || 'techmedix');
  showReqModal.value = true;
}
