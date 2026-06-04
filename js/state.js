// ─────────────────────────────────────────────────────────────────
// TechMedixLink · js/state.js
// Single source of truth — all refs, reactives, computed
// Import what you need: import { profile, products } from './state.js'
// ─────────────────────────────────────────────────────────────────

import { TECHMEDIX_CONFIG } from '../config.js';

const { ref, reactive, computed } = Vue;

// ── Core UI ──────────────────────────────────────────────────────
export const loading             = ref(false);
export const loadMsg             = ref('Loading…');
export const authLanding         = ref(false);
export const authLandingMsg      = ref('Signing you in securely…');
export const showPasswordUpdate  = ref(false);
export const newPassword         = ref('');
export const newPasswordErr      = ref('');
export const platform            = ref('techmedix');
export const tab                 = ref('home');
export const sidebarOpen         = ref(false);
export const globalSearch        = ref('');
export const appLogoUrl          = ref(TECHMEDIX_CONFIG.app?.logoUrl || null);

// ── Data ─────────────────────────────────────────────────────────
export const products            = ref([]);
export const allRequests         = ref([]);
export const payments            = ref([]);
export const profile             = ref(null);
export const notifications       = ref([]);
export const adminUsers          = ref([]);
export const shoppers            = ref([]);
export const addresses           = ref([]);
export const analyticsData       = ref({});
export const sellerAnalytics     = ref({});
export const sellerAnalyticsLoading = ref(false);
export const productReviews      = ref([]);

// ── Basket ───────────────────────────────────────────────────────
export const basket              = ref([]);
export const showBasket          = ref(false);

// ── Exchange rate ────────────────────────────────────────────────
export const usdToTzs            = ref(TECHMEDIX_CONFIG.app.fallbackRate);
export const rateSource          = ref('fallback');
export const rateUpdatedAt       = ref(null);
export const rateAge             = computed(() => {
  if (!rateUpdatedAt.value) return null;
  const h = Math.round((Date.now() - new Date(rateUpdatedAt.value)) / 3600000);
  return h < 1 ? 'Updated just now' : h < 24 ? `Updated ${h}h ago` : `Updated ${Math.round(h / 24)}d ago`;
});

// ── Modals & panels ──────────────────────────────────────────────
export const showAuth            = ref(false);
export const showProfileModal    = ref(false);
export const showListingModal    = ref(false);
export const showReqModal        = ref(false);
export const showNotifPanel      = ref(false);
export const showUserPanel       = ref(false);
export const showQuoteModal      = ref(false);
export const showReviewModal     = ref(false);
export const showShopperModal    = ref(false);
export const showInquiryDetail   = ref(false);
export const inquiryReq          = ref(null);
export const showAdminUserModal  = ref(false);
export const adminViewUser       = ref(null);
export const adminEditingUser    = ref(false);
export const showTcModal         = ref(false);
export const showCancelModal     = ref(false);
export const cancelReq           = ref(null);
export const cancelReason        = ref('');
export const showVerifyModal     = ref(false);
export const editingProd         = ref(null);
export const editingShopper      = ref(null);
export const detailReq           = ref(null);
export const showOrderDetail     = ref(false);
export const orderDetailReq      = ref(null);
export const paymentReq          = ref(null);
export const quoteReq            = ref(null);
export const reviewReq           = ref(null);
export const viewedProduct       = ref(null);
export const showProductDetail   = ref(false);
export const lpCarousel          = ref(0);
export const pd3dMode            = ref(false);
export const pdReviews           = ref([]);
export const pdLoading           = ref(false);
export const trackId             = ref('');
export const trackedReq          = ref(null);
export const confirm             = ref(null);
export const openStatusMenu      = ref(null);
export const assignShopperId     = ref('');
export const addingAddress       = ref(false);
export const activeDetailImage   = ref(null);

// ── Verification docs ────────────────────────────────────────────
export const verifyDocs = reactive({
  business_reg: null, tax_cert: null, tmda_license: null, notes: '',
  business_reg_name: '', tax_cert_name: '', tmda_license_name: '',
});

// ── Auth ─────────────────────────────────────────────────────────
export const authTab         = ref('login');
export const onboardingDone  = ref(false);
export const rateLimitUntil  = ref(0);
export const rateLimitSecs   = ref(0);
export const tcAccepted      = ref(false);
export const authErr         = ref('');
export const magicSent       = ref(false);
export const aF = reactive({
  email: '', password: '', full_name: '', phone: '',
  phoneCode: '+255', rememberMe: false, _emailTouched: false,
  user_role: 'buyer', user_type: 'individual', company_name: '', loginId: ''
});

// ── Onboarding ───────────────────────────────────────────────────
export const onboardStep    = ref(0);
export const showOnboarding = ref(false);
export const obF = reactive({
  full_name: '', phone: '', avatar_file: null, avatar_preview: '', avatar_uploading: false,
  facility_type: '', bed_count: '', supply_region: 'Dar es Salaam', equipment_categories: [],
  business_reg: '', tmda_license: '', supply_countries: ['Tanzania'], product_categories: [],
});

// ── Forms ────────────────────────────────────────────────────────
export const pF = reactive({
  name: '', manufacturer: '', model_url: '', platform_type: 'techmedix',
  product_type: 'medical_device', description: '', base_price_usd: 0,
  stock_quantity: 0, warranty_months: 12, country: 'Tanzania',
  import_duty_percent: 0, estimated_weight_kg: 0, seller_name: '',
  tmda_certified: false, requires_installation: false, requires_training: false,
  is_active: true, image_url: '', imagePreview: '', imageFile: null,
  uploading: false, imageSize: '', images: [], imagePreviews: [],
});

export const rF = reactive({
  platform_type: 'techmedix', product_id: '', quantity: 1, urgency: 'normal',
  notes: '', source_type: 'catalog', address_id: '',
  custom_name: '', custom_desc: '', source_url: '',
  budget_code: '', insurance_added: false, approval_email: '',
  brief_problem: '', brief_setting: '', brief_volume: 'medium',
  brief_power: 'stable', brief_budget_min: 0, brief_budget_max: 0,
  requires_installation: false, is_available_locally: false
});

export const uF = reactive({
  full_name: '', phone: '', user_type: 'individual', user_role: 'buyer', company_name: ''
});

export const pmtF = reactive({
  amount: 0, method: 'mpesa', type: 'deposit', reference: '', notes: '', phone: ''
});

export const qF = reactive({
  item_cost: 0, shipping_cost: 0, duty_cost: 0, service_fee: 0, delivery_date: '', notes: ''
});

export const reviewF  = reactive({ rating: 0, title: '', body: '' });
export const shF      = reactive({ full_name: '', phone: '', city: '', country: 'Tanzania', specialization: '', is_active: true });
export const addrF    = reactive({ address_type: 'home', region: '', district: '', street: '', landmark: '', is_default: false });
export const adminUF  = reactive({ full_name: '', phone: '', user_type: 'individual', user_role: 'buyer', company_name: '' });

// ── Filters & pagination ─────────────────────────────────────────
export const prodSearch      = ref('');
export const prodFilter      = ref('all');
export const prodTypeFilter  = ref('all');
export const sortProd        = ref('newest');
export const filterTmda      = ref(false);
export const filterInStock   = ref(false);
export const priceMin        = ref(0);
export const priceMax        = ref(100000);
export const manufFilter     = ref('');
export const reqSearch       = ref('');
export const reqFilter       = ref('all');
export const reqPlatFilter   = ref('all');
export const adminSubTab     = ref('requests');
export const adminUserSearch = ref('');
export const adminUserRoleFilter = ref('all');
export const adminReqSearch  = ref('');
export const adminReqFilter  = ref('all');
export const adminPlatFilter = ref('all');
export const adminDateFrom    = ref('');
export const adminDateTo      = ref('');

export const prodPage  = ref(0); export const PROD_PER_PAGE = 20;
export const reqPage   = ref(0); export const REQ_PER_PAGE  = 25;
export const userPage  = ref(0); export const USER_PER_PAGE = 30;
export const prodTotal = ref(0);
export const reqTotal  = ref(0);
export const userTotal = ref(0);


// ── New UI state (improvements batch) ────────────────────────────
export const showSearchOverlay   = ref(false);
export const showReqSuccess      = ref(false);
export const showLightbox         = ref(false);
export const lightboxImg          = ref('');
export const lightboxIndex        = ref(0);
export const pdQty                = ref(1);
export const lastReqNumber        = ref('');
export const reqCatalogSearch     = ref('');
export const lpCatFilter          = ref('all');
export const lpTmdaOnly           = ref(false);
export const lpSort               = ref('newest');
export const basketRestored      = ref(false);
export const adminProdSearch     = ref('');
export const rateAgeDisplay      = ref('');
export const rateAgeClock        = ref(null);

// ── Messages ─────────────────────────────────────────────────────
export const showMessagesPanel   = ref(false);
export const messagesReq         = ref(null);
export const messages            = ref([]);
export const messagesLoading     = ref(false);
export const newMessageText      = ref('');
export const unreadMessageCounts = ref({});

// ── Bulk actions ─────────────────────────────────────────────────
export const selectedUserIds    = ref(new Set());
export const selectedProductIds = ref(new Set());
export const bulkActionLoading  = ref(false);

export const notifTypeFilter  = ref('all');

// ── Toasts ───────────────────────────────────────────────────────
export const toasts = ref([]);

export function toast(type, title, msg = '') {
  const id = Date.now() + Math.random();
  toasts.value.push({ id, type, title, msg });
  setTimeout(() => killToast(id), 4200);
}

export function killToast(id) {
  toasts.value = toasts.value.filter(t => t.id !== id);
}

// ── Status config ────────────────────────────────────────────────
export const statusList = [
  { val: 'pending',           label: 'Pending',       color: '#b8904a', short: 'Pending'   },
  { val: 'quoted',            label: 'Quoted',         color: '#5a90c8', short: 'Quoted'    },
  { val: 'deposit_paid',      label: 'Deposit Paid',   color: '#5da87a', short: 'Deposit'   },
  { val: 'sourcing',          label: 'Sourcing',       color: '#5a90c8', short: 'Sourcing'  },
  { val: 'shipped',           label: 'Shipped',        color: '#7a6fc8', short: 'Shipped'   },
  { val: 'in_transit',        label: 'In Transit',     color: '#5a90c8', short: 'Transit'   },
  { val: 'customs_clearance', label: 'Customs',        color: '#b8904a', short: 'Customs'   },
  { val: 'delivered',         label: 'Delivered',      color: '#5da87a', short: 'Delivered' },
  { val: 'installed',         label: 'Installed',      color: '#5da87a', short: 'Installed' },
  { val: 'completed',         label: 'Completed',      color: '#5da87a', short: 'Complete'  },
  { val: 'cancelled',         label: 'Cancelled',      color: '#c05050', short: 'Cancelled' },
];

export const stepperStages = [
  { val: 'pending',           short: 'Order'    },
  { val: 'quoted',            short: 'Quote'    },
  { val: 'deposit_paid',      short: 'Deposit'  },
  { val: 'sourcing',          short: 'Source'   },
  { val: 'shipped',           short: 'Shipped'  },
  { val: 'in_transit',        short: 'Transit'  },
  { val: 'customs_clearance', short: 'Customs'  },
  { val: 'delivered',         short: 'Delivered'},
];

// ── New features ────────────────────────────────────────────────
export const topAd              = ref(null);
export const activeGroupBuys    = ref([]);
export const reqTemplates       = ref([]);
export const productAccessories = ref([]);
export const priceAlerts        = ref([]);

export const dutyCategory  = ref('');
export const dutyValue     = ref(0);
export const dutyResult    = ref(null);
export const verifiedSellers = ref([]);

// ── 50-feature additions ─────────────────────────────────────────
export const productRequests      = ref([]);
export const newProductRequest    = ref('');
export const newsletterEmail      = ref('');
export const recentlyViewed       = ref([]);
export const showSearchSuggestions = ref(false);
export const rF_budget_code       = ref('');
// rF already has budget_code wired in HTML via v-model

// ── Advanced features state ───────────────────────────────────────
export const myFacility         = ref(null);
export const facilityMembers    = ref([]);
export const showCreateFacility = ref(false);
export const inviteEmail        = ref('');
export const inviteRole         = ref('requester');
export const productBenchmark   = ref(null);
export const benchmarkPct       = ref(50);

export const showSendQuoteModal = ref(false);
export const sendQuoteForm = reactive({ item_cost:0, shipping_cost:0, duty_cost:0, service_fee:0, quoteReqId:null });

export const facilityForm = reactive({ name:'', type:'hospital', region:'', district:'' });
export const quoteReq    = ref(null);
export const quoteForm   = reactive({ item_cost:0, shipping_cost:0, duty_cost:0, service_fee:0 });

// ── 60-feature additions ─────────────────────────────────────────
export const announcement        = ref(null);
export const showKanban          = ref(false);
export const activeCurrency      = ref('TZS');
export const currencyRates       = reactive({ TZS: 1, USD: 0.00037, EUR: 0.00034, KES: 0.048 });
export const showHealthDash      = ref(false);
export const healthStats         = ref(null);
export const buyerIntel          = ref(null);
export const showBuyerIntel      = ref(false);
export const showRecurringModal  = ref(false);
export const recurringForm       = reactive({ product_id:'', product_name:'', quantity:1, frequency:'monthly' });
export const recurringOrders     = ref([]);
export const showDiscount        = ref(false);
export const discountCode        = ref('');
export const discountApplied     = ref(null);
export const showDraftBanner     = ref(false);
export const showPaymentReceipt  = ref(false);
export const receiptPayment      = ref(null);
export const showUploadSlip      = ref(false);
export const uploadSlipPayment   = ref(null);
export const orderNotesReq       = ref(null);
export const orderNotesText      = ref('');
export const showOrderNotes      = ref(false);
export const referralData        = ref(null);
export const warrantyItems       = ref([]);
export const atRiskRequests      = computed ? null : null; // computed in main.js

export const deliveryCodeInput = ref('');
