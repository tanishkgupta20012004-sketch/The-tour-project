import React, { useState, useEffect } from 'react';
import { backendApi } from './api';

const ROLE_CREDENTIALS = [
  {
    role: 'TRAVELER',
    badge: '🎒 TRAVELER PORTAL',
    title: 'Aarav Verma (Traveler — Indore)',
    identifier: 'aarav@example.com',
    phone: '9000000005',
    password: 'Password@123',
    desc: 'Discover & compare trips, check 5-dimension vibe match, book seats with token deposit, preview policy refunds, and report trip incidents.'
  },
  {
    role: 'OPERATOR',
    badge: '📊 OPERATOR B2B PORTAL',
    title: 'Vikram Singh (Malwa Trails & Expeditions)',
    identifier: 'vikram@malwatrails.in',
    phone: '9000000003',
    password: 'Password@123',
    desc: 'B2B Command Center: create trip packages, sync +1 Instagram offline seats, export CSV participant manifests, quote custom enquiries, and track escrow.'
  },
  {
    role: 'OPERATOR',
    badge: '📊 OPERATOR B2B PORTAL (HIMALAYAS)',
    title: 'Rohan Mehta (Himalayan Nomads Community)',
    identifier: 'rohan@himalayannomads.in',
    phone: '9000000002',
    password: 'Password@123',
    desc: 'Manage Manali & Leh–Ladakh bike expeditions, verify driving licenses in manifests, and respond to traveler reviews.'
  },
  {
    role: 'ADMIN',
    badge: '🏛️ ADMIN GOVERNANCE PORTAL',
    title: 'Platform Admin (Trust, KYC & Escrow)',
    identifier: 'admin@tourmarketplace.in',
    phone: '9000000001',
    password: 'Password@123',
    desc: 'Audit marketplace unit economics, approve pending operator KYC (e.g. Royal Desert), resolve safety incidents, and settle escrow payouts via UTR.'
  }
];

function getTripCoverImage(trip) {
  const text = `${trip.title || ''} ${trip.destination_city || ''} ${trip.trip_category || ''}`.toLowerCase();
  if (text.includes('ladakh') || text.includes('motorcycle') || text.includes('bike')) {
    return 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=900&q=80';
  }
  if (text.includes('manali') || text.includes('solang') || text.includes('spiti')) {
    return 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=900&q=80';
  }
  if (text.includes('choral') || text.includes('camp') || text.includes('starlight')) {
    return 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=900&q=80';
  }
  if (text.includes('pachmarhi') || text.includes('satpura') || text.includes('waterfall')) {
    return 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=900&q=80';
  }
  if (text.includes('udaipur') || text.includes('jaisalmer') || text.includes('rajasthan')) {
    return 'https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=900&q=80';
  }
  return 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=80';
}

function formatCategoryLabel(cat) {
  const map = {
    STRANGER_GROUP: '🏔️ Stranger Group',
    BIKE_CAR_EXPEDITION: '🏍️ Bike & Road Expedition',
    WEEKEND_NICHE: '⛺ Weekend & Niche',
    PRIVATE_CUSTOM: '✨ Private Custom'
  };
  return map[cat] || String(cat || '').replace(/_/g, ' ');
}

export default function App() {
  // Auth & Role Session State
  const [token, setToken] = useState(() => localStorage.getItem('trailsync_token') || '');
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('trailsync_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [authMode, setAuthMode] = useState('PASSWORD'); // 'PASSWORD' | 'OTP' | 'REGISTER'
  const [loginIdentifier, setLoginIdentifier] = useState(ROLE_CREDENTIALS[0].identifier);
  const [loginPassword, setLoginPassword] = useState(ROLE_CREDENTIALS[0].password);
  const [authBusy, setAuthBusy] = useState(false);

  // OTP & Register Form state
  const [otpPhone, setOtpPhone] = useState('9876543210');
  const [otpCode, setOtpCode] = useState('');
  const [otpFullName, setOtpFullName] = useState('Riya Kapoor');
  const [devOtpHint, setDevOtpHint] = useState('');
  const [regForm, setRegForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: 'Password@123'
  });

  // Active Navigation Tab (automatically set per Role)
  const [activeTab, setActiveTab] = useState('discover');
  const [healthStatus, setHealthStatus] = useState(null);
  const [toast, setToast] = useState('');

  // ==========================================================================
  // TRAVELER STATE
  // ==========================================================================
  const [trips, setTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [filters, setFilters] = useState({
    trip_category: '',
    origin_city: '',
    max_budget: '',
    only_guaranteed: false
  });
  const [compareIds, setCompareIds] = useState([]);
  const [compareData, setCompareData] = useState(null);
  const [tripDetail, setTripDetail] = useState(null);
  const [groupInsights, setGroupInsights] = useState(null);
  const [tripCompatCheck, setTripCompatCheck] = useState(null);
  const [tripReviewsData, setTripReviewsData] = useState(null);
  const [bookingSeats, setBookingSeats] = useState(1);
  const [paymentPlan, setPaymentPlan] = useState('TOKEN');
  const [drivingLicense, setDrivingLicense] = useState('MP09-20210098765');
  const [bookingBusy, setBookingBusy] = useState(false);
  const [enquiryGroupSize, setEnquiryGroupSize] = useState(6);
  const [enquiryNotes, setEnquiryNotes] = useState(
    'Looking for a private group departure with customized stays.'
  );

  // Compatibility state
  const [recommendations, setRecommendations] = useState(null);
  const [prefForm, setPrefForm] = useState({
    pace_preference: 'HIGH_ADVENTURE',
    morning_style: 'EARLY_BIRD',
    social_style: 'HIGH_ENERGY_GROUP',
    comfort_preference: 'STANDARD_COMFORT',
    home_city: 'Indore'
  });

  // Public Operators & Trust state
  const [operators, setOperators] = useState([]);
  const [selectedOperatorReport, setSelectedOperatorReport] = useState(null);
  const [operatorSlugProfile, setOperatorSlugProfile] = useState(null);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [onboardForm, setOnboardForm] = useState({
    business_name: 'Narmada Valley Explorers',
    tagline: 'Curated river rafting & forest camps from Indore',
    operator_type: 'TRAVEL_COMMUNITY',
    base_city: 'Indore',
    instagram_handle: '@narmada_explorers',
    support_phone: '9826099988',
    emergency_contact_phone: '9826011122',
    gst_number: '23AAAAA1111A1Z5',
    pan_number: 'AAAAA1111A'
  });

  // Traveler Bookings, Enquiries, Transactions & Incidents
  const [myBookings, setMyBookings] = useState([]);
  const [myEnquiries, setMyEnquiries] = useState([]);
  const [myTransactions, setMyTransactions] = useState({ payments: [], refunds: [] });
  const [myIncidents, setMyIncidents] = useState([]);
  const [refundPreview, setRefundPreview] = useState(null);
  const [bookingDetailModal, setBookingDetailModal] = useState(null);
  const [reviewModalBooking, setReviewModalBooking] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    overall_rating: 5,
    itinerary_accuracy_rating: 5,
    safety_and_captain_rating: 5,
    accommodation_and_food_rating: 5,
    group_vibe_rating: 5,
    review_title: 'Unforgettable experience & super organized captain!',
    review_text: 'Everything matched the promised itinerary and the group vibe was amazing.'
  });
  const [incidentModalBooking, setIncidentModalBooking] = useState(null);
  const [incidentForm, setIncidentForm] = useState({
    incident_category: 'SUBSTANDARD_ACCOMMODATION',
    severity: 'HIGH',
    description: 'Campsite tents had water seepage; requesting immediate operator resolution.'
  });

  // ==========================================================================
  // OPERATOR B2B PORTAL STATE
  // ==========================================================================
  const [operatorDashboard, setOperatorDashboard] = useState(null);
  const [operatorProfile, setOperatorProfile] = useState(null);
  const [myOperatorTrips, setMyOperatorTrips] = useState([]);
  const [operatorBookings, setOperatorBookings] = useState([]);
  const [operatorEnquiries, setOperatorEnquiries] = useState([]);
  const [operatorPayouts, setOperatorPayouts] = useState(null);
  const [operatorIncidents, setOperatorIncidents] = useState([]);
  const [operatorTrustSelf, setOperatorTrustSelf] = useState(null);
  const [manifestModal, setManifestModal] = useState(null);
  const [waitlistModal, setWaitlistModal] = useState(null);
  const [showCreateTripModal, setShowCreateTripModal] = useState(false);
  const [newTripForm, setNewTripForm] = useState({
    title: 'Mandu Monsoon Heritage & Waterfalls Escape',
    trip_category: 'WEEKEND_NICHE',
    experience_type: 'Heritage & Nature',
    origin_city: 'Indore',
    destination_city: 'Mandu',
    duration_days: 2,
    duration_nights: 1,
    base_price: 3499
  });

  // ==========================================================================
  // ADMIN GOVERNANCE PORTAL STATE
  // ==========================================================================
  const [unitEconomics, setUnitEconomics] = useState(null);
  const [allOperatorsAdmin, setAllOperatorsAdmin] = useState([]);
  const [kycLogsModal, setKycLogsModal] = useState(null);
  const [adminIncidents, setAdminIncidents] = useState([]);
  const [adminPayouts, setAdminPayouts] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4500);
  };

  // Check API & MySQL Health on mount
  useEffect(() => {
    backendApi
      .health()
      .then((res) => setHealthStatus(res))
      .catch(() => setHealthStatus(null));
  }, []);

  // Set default landing tab whenever user role changes
  useEffect(() => {
    if (!user) return;
    if (user.role === 'TRAVELER') {
      setActiveTab('discover');
    } else if (user.role === 'OPERATOR') {
      setActiveTab('op-dashboard');
    } else if (user.role === 'ADMIN') {
      setActiveTab('admin-economics');
    }
  }, [user?.role, user?.id]);

  // Load role-specific data when token/tab changes
  useEffect(() => {
    if (!token || !user) return;

    if (user.role === 'TRAVELER') {
      if (activeTab === 'discover') fetchTrips();
      if (activeTab === 'compatibility') loadRecommendations();
      if (activeTab === 'operators') loadOperators();
      if (activeTab === 'bookings') loadTravelerHubData();
    } else if (user.role === 'OPERATOR') {
      loadOperatorHubData();
    } else if (user.role === 'ADMIN') {
      loadAdminHubData();
    }
  }, [token, user, activeTab, filters]);

  // ==========================================================================
  // AUTHENTICATION HANDLERS (LOGIN / OTP / REGISTER / LOGOUT)
  // ==========================================================================
  const saveSession = (accessToken, userData) => {
    localStorage.setItem('trailsync_token', accessToken);
    localStorage.setItem('trailsync_user', JSON.stringify(userData));
    setToken(accessToken);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('trailsync_token');
    localStorage.removeItem('trailsync_user');
    setToken('');
    setUser(null);
    showToast('Signed out. Choose a role account to sign in.');
  };

  const handleLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    setAuthBusy(true);
    try {
      const res = await backendApi.auth.login({
        identifier: loginIdentifier,
        password: loginPassword
      });
      const me = await backendApi.auth.getMe(res.accessToken);
      const finalUser = me.user || res.user;
      saveSession(res.accessToken, finalUser);
      showToast(`Welcome ${finalUser.full_name}! Loaded ${finalUser.role} Portal.`);
    } catch (err) {
      showToast(`Login failed: ${err.message}`);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleQuickRoleLogin = async (cred) => {
    setLoginIdentifier(cred.identifier);
    setLoginPassword(cred.password);
    setAuthBusy(true);
    try {
      const res = await backendApi.auth.login({
        identifier: cred.identifier,
        password: cred.password
      });
      const me = await backendApi.auth.getMe(res.accessToken);
      const finalUser = me.user || res.user;
      saveSession(res.accessToken, finalUser);
      showToast(`Switched to ${finalUser.full_name} (${finalUser.role} Portal)`);
    } catch (err) {
      showToast(`Login failed: ${err.message}`);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSendOtp = async () => {
    try {
      const res = await backendApi.auth.sendOtp({ phone: otpPhone, purpose: 'LOGIN' });
      setDevOtpHint(res.dev_otp_code || '');
      setOtpCode(res.dev_otp_code || '');
      showToast(`OTP Sent to ${otpPhone}! Dev OTP auto-filled: ${res.dev_otp_code}`);
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    try {
      const res = await backendApi.auth.verifyOtp({
        phone: otpPhone,
        otp_code: otpCode,
        full_name: otpFullName
      });
      saveSession(res.accessToken, res.user);
      showToast(`Verified via Mobile OTP as ${res.user.full_name} (${res.user.role})!`);
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await backendApi.auth.register(regForm);
      saveSession(res.accessToken, res.user);
      showToast(`Account created! Welcome ${res.user.full_name} (${res.user.role}).`);
    } catch (err) {
      showToast(err.message);
    }
  };

  // ==========================================================================
  // DATA LOADERS & ACTION HANDLERS
  // ==========================================================================
  const fetchTrips = async () => {
    setLoadingTrips(true);
    try {
      const params = new URLSearchParams();
      if (filters.trip_category) params.set('trip_category', filters.trip_category);
      if (filters.origin_city) params.set('origin_city', filters.origin_city);
      if (filters.max_budget) params.set('max_budget', filters.max_budget);
      if (filters.only_guaranteed) params.set('only_guaranteed', 'true');

      const res = await backendApi.trips.discover(params.toString());
      setTrips(res?.trips || []);
    } catch (err) {
      showToast(err.message);
    } finally {
      setLoadingTrips(false);
    }
  };

  const loadRecommendations = async () => {
    try {
      const res = await backendApi.compatibility.getRecommendations(token);
      setRecommendations(res);
      if (res?.traveler_vibe_profile) {
        const p = res.traveler_vibe_profile;
        setPrefForm({
          pace_preference: p.pace_preference || 'HIGH_ADVENTURE',
          morning_style: p.morning_style || 'EARLY_BIRD',
          social_style: p.social_style || 'HIGH_ENERGY_GROUP',
          comfort_preference: p.comfort_preference || 'STANDARD_COMFORT',
          home_city: p.home_city || 'Indore'
        });
      }
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleSavePreferences = async (e) => {
    e.preventDefault();
    try {
      await backendApi.auth.updatePreferences(token, {
        ...prefForm,
        preferred_trip_types: ['STRANGER_GROUP', 'BIKE_CAR_EXPEDITION', 'WEEKEND_NICHE']
      });
      showToast('Traveler vibe preferences updated! Recalculating 5-dimension compatibility...');
      loadRecommendations();
    } catch (err) {
      showToast(err.message);
    }
  };

  const loadOperators = async () => {
    try {
      const res = await backendApi.operators.listPublic(true);
      const ops = res?.operators || [];
      setOperators(ops);
      if (ops.length > 0) {
        inspectOperatorTrust(ops[0].slug);
      }
    } catch (err) {
      showToast(err.message);
    }
  };

  const inspectOperatorTrust = async (operatorSlug) => {
    try {
      const [report, slugProf] = await Promise.all([
        backendApi.reviews.getOperatorTrustAndReviews(operatorSlug),
        backendApi.operators.getBySlug(operatorSlug)
      ]);
      setSelectedOperatorReport(report);
      setOperatorSlugProfile(slugProf);
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleOnboardOperator = async (e) => {
    e.preventDefault();
    try {
      const res = await backendApi.operators.onboard(token, {
        ...onboardForm,
        operating_regions: ['Madhya Pradesh', 'Himachal Pradesh']
      });
      showToast(
        `Operator profile "${res.business_name}" submitted! Your role is now OPERATOR (Pending KYC).`
      );
      setShowOnboardModal(false);
      // Refresh user profile so role upgrades to OPERATOR
      const me = await backendApi.auth.getMe(token);
      if (me?.user) saveSession(token, me.user);
    } catch (err) {
      showToast(err.message);
    }
  };

  const loadTravelerHubData = async () => {
    try {
      const [bRes, eRes, tRes, iRes] = await Promise.all([
        backendApi.bookings.getMyBookings(token),
        backendApi.bookings.getMyEnquiries(token),
        backendApi.payments.getMyTransactions(token),
        backendApi.reviews.getMyIncidents(token)
      ]);
      setMyBookings(bRes?.bookings || []);
      setMyEnquiries(eRes?.enquiries || []);
      setMyTransactions(tRes || { payments: [], refunds: [] });
      setMyIncidents(iRes?.incidents || []);
    } catch (err) {
      showToast(err.message);
    }
  };

  const loadOperatorHubData = async () => {
    try {
      const [dash, prof, myTrips, opBooks, opEnqs, opPay, opInc] = await Promise.all([
        backendApi.operators.getDashboard(token),
        backendApi.operators.getMyProfile(token),
        backendApi.trips.getMyOperatorTrips(token),
        backendApi.bookings.getOperatorBookings(token),
        backendApi.bookings.getOperatorEnquiries(token),
        backendApi.payments.getOperatorPayouts(token),
        backendApi.reviews.getOperatorIncidents(token)
      ]);
      setOperatorDashboard(dash);
      setOperatorProfile(prof);
      setMyOperatorTrips(myTrips?.trips || []);
      setOperatorBookings(opBooks?.bookings || []);
      setOperatorEnquiries(opEnqs?.enquiries || []);
      setOperatorPayouts(opPay);
      setOperatorIncidents(opInc?.incidents || []);

      if (prof?.slug) {
        const trustRep = await backendApi.reviews.getOperatorTrustAndReviews(prof.slug);
        setOperatorTrustSelf(trustRep);
      }
    } catch (err) {
      showToast(err.message);
    }
  };

  const loadAdminHubData = async () => {
    try {
      const [allOps, econ, incList, payList] = await Promise.all([
        backendApi.operators.listPublic(false),
        backendApi.payments.getUnitEconomics(token),
        backendApi.reviews.getOperatorIncidents(token),
        backendApi.payments.getOperatorPayouts(token)
      ]);
      setAllOperatorsAdmin(allOps?.operators || []);
      setUnitEconomics(econ);
      setAdminIncidents(incList?.incidents || []);
      setAdminPayouts(payList);
    } catch (err) {
      showToast(err.message);
    }
  };

  // Open Trip Detail Modal
  const openTripDetail = async (slug) => {
    setGroupInsights(null);
    setTripCompatCheck(null);
    setTripReviewsData(null);
    try {
      const detail = await backendApi.trips.getBySlug(slug);
      setTripDetail(detail);

      const tripId = detail?.trip?.id;
      const promises = [];

      if (detail?.departures && detail.departures.length > 0) {
        const depId = detail.departures[0].id;
        promises.push(
          backendApi.departures.getGroupInsights(depId).then((res) => setGroupInsights(res))
        );
      }
      if (tripId) {
        promises.push(
          backendApi.reviews.getTripReviews(tripId).then((res) => setTripReviewsData(res))
        );
        if (token) {
          promises.push(
            backendApi.compatibility
              .checkTripCompatibility(token, tripId)
              .then((res) => setTripCompatCheck(res))
              .catch(() => {})
          );
        }
      }
      await Promise.all(promises);
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleWatchDeparture = async (departureId) => {
    try {
      await backendApi.departures.registerInterest(token, departureId, {
        seats_interested: Number(bookingSeats) || 2,
        interest_type: 'WAIT_FOR_GUARANTEE',
        notes: 'Notify me as soon as this batch reaches minimum group threshold!'
      });
      showToast('Added to batch watchlist! You will be notified when departure is guaranteed.');
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleCreateEnquiry = async (tripId, originCity, basePrice) => {
    try {
      await backendApi.bookings.createEnquiry(token, {
        trip_id: tripId,
        preferred_start_date: '2026-12-18',
        group_size: Number(enquiryGroupSize) || 6,
        budget_per_person: Number(basePrice) || 15000,
        origin_city: originCity || 'Indore',
        customization_notes: enquiryNotes,
        contact_phone: user?.phone || '9000000005'
      });
      showToast('Custom private group enquiry sent to operator! Track quotes in My Bookings.');
      setTripDetail(null);
      setActiveTab('bookings');
    } catch (err) {
      showToast(err.message);
    }
  };

  const toggleCompare = (id) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id].slice(0, 4)
    );
  };

  const openCompareModal = async () => {
    if (compareIds.length < 2) {
      showToast('Select between 2 and 4 trips to compare side-by-side');
      return;
    }
    try {
      const res = await backendApi.trips.compare(compareIds);
      setCompareData(res);
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleBookAndPay = async (departureId, tripCategory) => {
    setBookingBusy(true);
    try {
      const participants = Array.from({ length: Number(bookingSeats) }).map((_, idx) => ({
        full_name: idx === 0 ? user?.full_name || 'Aarav Verma' : `Companion ${idx + 1}`,
        age: 26,
        gender: 'MALE',
        phone: user?.phone || '9000000005',
        id_proof_type: tripCategory === 'BIKE_CAR_EXPEDITION' ? 'DRIVING_LICENSE' : 'AADHAAR',
        driving_license_number:
          tripCategory === 'BIKE_CAR_EXPEDITION' ? drivingLicense : undefined,
        blood_group: 'O+',
        emergency_contact_name: 'Rajesh Verma',
        emergency_contact_phone: '9826011122'
      }));

      const reserveRes = await backendApi.bookings.reserve(token, {
        departure_id: departureId,
        payment_plan: paymentPlan,
        participants
      });

      const bookingRef = reserveRes.booking.booking_reference;

      const orderRes = await backendApi.payments.createOrder(token, {
        booking_reference: bookingRef,
        payment_purpose: 'INITIAL_BOOKING'
      });

      await backendApi.payments.verify(token, orderRes.dev_webhook_simulator);

      showToast(`Booking Confirmed! Ref: ${bookingRef} (${bookingSeats} seat(s) locked in escrow)`);
      setTripDetail(null);
      fetchTrips();
      setActiveTab('bookings');
    } catch (err) {
      showToast(err.message);
    } finally {
      setBookingBusy(false);
    }
  };

  const handlePayRemainingBalance = async (bookingReference) => {
    try {
      const orderRes = await backendApi.payments.createOrder(token, {
        booking_reference: bookingReference,
        payment_purpose: 'BALANCE_SETTLEMENT'
      });
      await backendApi.payments.verify(token, orderRes.dev_webhook_simulator);
      showToast(`Balance settled in full for ${bookingReference}! Balance due is now ₹0.`);
      loadTravelerHubData();
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleInspectBookingRef = async (bookingReference) => {
    try {
      const res = await backendApi.bookings.getByReference(token, bookingReference);
      setBookingDetailModal(res);
    } catch (err) {
      showToast(err.message);
    }
  };

  const handlePreviewRefund = async (bookingReference) => {
    try {
      const res = await backendApi.bookings.previewCancellation(token, bookingReference);
      setRefundPreview(res);
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleConfirmCancel = async (bookingReference) => {
    try {
      const res = await backendApi.bookings.cancel(
        token,
        bookingReference,
        'Schedule change requested from React Portal'
      );
      showToast(
        `Booking ${bookingReference} cancelled! Refund of ₹${res.refund?.refund_amount ?? 0} (${res.refund?.policy_tier_applied}) processed.`
      );
      setRefundPreview(null);
      loadTravelerHubData();
      fetchTrips();
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    try {
      await backendApi.reviews.createReview(token, {
        booking_reference: reviewModalBooking.booking_reference,
        overall_rating: Number(reviewForm.overall_rating),
        itinerary_accuracy_rating: Number(reviewForm.itinerary_accuracy_rating),
        safety_and_captain_rating: Number(reviewForm.safety_and_captain_rating),
        accommodation_and_food_rating: Number(reviewForm.accommodation_and_food_rating),
        group_vibe_rating: Number(reviewForm.group_vibe_rating),
        review_title: reviewForm.review_title,
        review_text: reviewForm.review_text
      });
      showToast('Verified review published! Operator Composite Trust Score updated.');
      setReviewModalBooking(null);
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleReportIncident = async (e) => {
    e.preventDefault();
    try {
      const res = await backendApi.reviews.reportIncident(token, {
        booking_reference: incidentModalBooking.booking_reference,
        ...incidentForm
      });
      showToast(
        `Incident ${res.incident.incident_reference} logged! Escrow Freeze: ${
          res.incident.payout_frozen ? 'ACTIVE' : 'No'
        }`
      );
      setIncidentModalBooking(null);
      loadTravelerHubData();
    } catch (err) {
      showToast(err.message);
    }
  };

  // Operator Handlers
  const handleSyncOfflineSeats = async (departureId, currentOfflineSeats) => {
    try {
      const res = await backendApi.departures.syncInventory(token, departureId, {
        offline_blocked_seats: Number(currentOfflineSeats) + 1
      });
      showToast(
        `Synced +1 Instagram/Offline seat! Status: ${res.departure_status} (${res.confidence_metrics?.total_occupied_seats}/${res.confidence_metrics?.total_seats} seats)`
      );
      loadOperatorHubData();
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleViewManifest = async (departureId) => {
    try {
      const res = await backendApi.departures.getManifest(token, departureId);
      setManifestModal(res);
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleDownloadCsvManifest = async (departureId, batchCode) => {
    try {
      const csvText = await backendApi.departures.downloadManifestCsv(token, departureId);
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `manifest-${batchCode || departureId}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`Downloaded CSV manifest for ${batchCode}`);
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleViewWaitlist = async (departureId) => {
    try {
      const res = await backendApi.departures.getInterestList(token, departureId);
      setWaitlistModal(res);
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleCancelBatchByOperator = async (departureId) => {
    try {
      const res = await backendApi.departures.cancelBatch(
        token,
        departureId,
        'Severe weather / minimum group threshold not met'
      );
      showToast(
        `Batch cancelled. 100% refunds (₹${res.total_refund_amount_inr}) automatically issued to ${res.cancelled_bookings_count} booking(s).`
      );
      loadOperatorHubData();
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleCreateTripByOperator = async (e) => {
    e.preventDefault();
    try {
      const created = await backendApi.trips.create(token, {
        ...newTripForm,
        duration_days: Number(newTripForm.duration_days),
        duration_nights: Number(newTripForm.duration_nights),
        base_price: Number(newTripForm.base_price),
        comfort_level: 'STANDARD',
        difficulty_level: 'EASY',
        accommodation_type: 'BOUTIQUE_HOMESTAY',
        pace_tag: 'BALANCED',
        vibe_tags: ['Monsoon Forts', 'Indore Weekend', 'Photography'],
        highlights: ['Jahaz Mahal', 'Roopmati Pavilion'],
        inclusions: ['AC Tempo Traveller', 'Stay', 'Breakfast & Dinner'],
        exclusions: ['Personal expenses'],
        status: 'PUBLISHED',
        itineraries: [
          {
            day_number: 1,
            title: 'Indore to Mandu Royal Enclave',
            description: 'Morning departure from Indore, explore Jahaz Mahal & Hindola Mahal.',
            meals_included: 'Dinner'
          },
          {
            day_number: 2,
            title: 'Baz Bahadur Palace & Return to Indore',
            description: 'Sunrise valley trek and return drive to Indore.',
            meals_included: 'Breakfast'
          }
        ]
      });

      await backendApi.trips.createDeparture(token, created.trip.id, {
        start_date: '2026-11-28',
        end_date: '2026-11-29',
        price_per_person: Number(newTripForm.base_price),
        token_amount: 1000,
        total_seats: 16,
        offline_blocked_seats: 4,
        min_group_size: 6,
        booking_deadline: '2026-11-26 20:00:00'
      });

      await backendApi.compatibility.upsertTripProfile(token, created.trip.id, {
        ideal_morning_style: 'FLEXIBLE',
        ideal_social_style: 'BALANCED_SOCIAL',
        solo_traveler_friendly: true,
        ideal_age_brackets: ['21-26', '27-34'],
        activity_intensity_level: 3,
        group_vibe_summary: 'Relaxed heritage & photography weekend group from Indore'
      });

      showToast(`Created & Published "${created.trip.title}" with live departure batch!`);
      setShowCreateTripModal(false);
      loadOperatorHubData();
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleToggleTripStatus = async (tripId, currentStatus) => {
    const nextStatus = currentStatus === 'PUBLISHED' ? 'PAUSED' : 'PUBLISHED';
    try {
      await backendApi.trips.updateStatus(token, tripId, nextStatus);
      showToast(`Trip status updated to ${nextStatus}`);
      loadOperatorHubData();
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleManualConfirmBooking = async (bookingId, totalAmount) => {
    try {
      await backendApi.bookings.confirmManual(token, bookingId, {
        amount_received: Number(totalAmount),
        operator_remarks: 'Confirmed via Operator B2B Dashboard'
      });
      showToast(`Booking #${bookingId} manually confirmed!`);
      loadOperatorHubData();
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleSendEnquiryQuote = async (enquiryId) => {
    try {
      await backendApi.bookings.quoteEnquiry(token, enquiryId, {
        status: 'QUOTED',
        operator_quote_total: 84000,
        operator_response_notes: 'Includes Private SUV / Tempo Traveller, boutique stays & captain.'
      });
      showToast(`Custom quote of ₹84,000 sent to traveler for Enquiry #${enquiryId}!`);
      loadOperatorHubData();
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleOperatorIncidentExplain = async (incidentId) => {
    try {
      await backendApi.reviews.submitOperatorIncidentExplanation(
        token,
        incidentId,
        'We immediately upgraded the guests to weatherproof cottages and provided complimentary dinner.'
      );
      showToast(`Operator explanation submitted for Incident #${incidentId}`);
      loadOperatorHubData();
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleReplyToReview = async (reviewId) => {
    try {
      await backendApi.reviews.replyToReview(
        token,
        reviewId,
        'Thank you so much for traveling with us! Hope to host you again on our next expedition.'
      );
      showToast('Public operator reply posted to review!');
      loadOperatorHubData();
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleUpdateOperatorProfile = async (e) => {
    e.preventDefault();
    try {
      await backendApi.operators.updateMyProfile(token, {
        business_name: operatorProfile.business_name,
        tagline: operatorProfile.tagline,
        bio: operatorProfile.bio,
        instagram_handle: operatorProfile.instagram_handle,
        support_phone: operatorProfile.support_phone,
        emergency_contact_phone: operatorProfile.emergency_contact_phone
      });
      showToast('Operator B2B profile updated successfully!');
      loadOperatorHubData();
    } catch (err) {
      showToast(err.message);
    }
  };

  // Admin Handlers
  const handleAdminVerifyKyc = async (operatorId, kycStatus) => {
    try {
      await backendApi.operators.verifyKyc(token, operatorId, {
        kyc_status: kycStatus,
        remarks: `Admin marked operator as ${kycStatus} after GST/PAN audit.`,
        commission_rate_pct: 10
      });
      showToast(`Operator #${operatorId} KYC updated to ${kycStatus}`);
      loadAdminHubData();
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleViewKycLogs = async (operatorId) => {
    try {
      const logs = await backendApi.operators.getVerificationLogs(token, operatorId);
      setKycLogsModal({ operatorId, logs });
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleAdminResolveIncident = async (incidentId) => {
    try {
      await backendApi.reviews.resolveIncidentByAdmin(token, incidentId, {
        status: 'RESOLVED_NO_FAULT',
        admin_resolution_notes:
          'Verified operator provided cottage upgrade; escrow freeze lifted.',
        unfreeze_operator_payout: true
      });
      showToast(`Incident #${incidentId} resolved & operator escrow payout unfrozen!`);
      loadAdminHubData();
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleAdminSettlePayout = async (payoutId) => {
    try {
      await backendApi.payments.settleOperatorPayout(token, payoutId, {
        settlement_utr_number: `UTRHDFC${Date.now()}`,
        remarks: 'Settled from Platform Escrow Account'
      });
      showToast(`Payout #${payoutId} settled via Bank NEFT/IMPS UTR!`);
      loadAdminHubData();
    } catch (err) {
      showToast(err.message);
    }
  };

  // ==========================================================================
  // VIEW 0: DEDICATED ROLE-BASED LOGIN & CREDENTIALS PORTAL (WHEN SIGNED OUT)
  // ==========================================================================
  if (!token || !user) {
    return (
      <div className="auth-page">
        {toast && (
          <div className="toast">
            <span>✅</span>
            <span>{toast}</span>
          </div>
        )}

        {/* Left Showcase: Role Credentials & 1-Click Role Login */}
        <div className="auth-showcase">
          <div>
            <div className="brand" style={{ marginBottom: '1.5rem' }}>
              <span className="brand-logo">🧭</span>
              <span>TrailSync India</span>
              <span className="brand-badge">Role-Based Multi-Portal System</span>
            </div>

            <h1 style={{ fontSize: '2.15rem', fontWeight: 800, lineHeight: 1.2 }}>
              One Unified Database. Three Dedicated Role Portals.
            </h1>
            <p style={{ color: '#cbd5e1', marginTop: '0.65rem', fontSize: '0.96rem' }}>
              Each role logs into a completely tailored workspace: Travelers get the Consumer
              Discovery & Vibe Matcher Marketplace, Operators get the B2B Inventory & Manifest
              SaaS Console, and Admins get the KYC, Escrow & Unit Economics Command Center.
            </p>

            <div className="auth-role-cards">
              {ROLE_CREDENTIALS.map((cred) => (
                <div
                  key={cred.identifier}
                  className={`auth-role-card ${
                    loginIdentifier === cred.identifier ? 'active' : ''
                  }`}
                  onClick={() => {
                    setLoginIdentifier(cred.identifier);
                    setLoginPassword(cred.password);
                    setAuthMode('PASSWORD');
                  }}
                >
                  <div>
                    <span
                      className="badge"
                      style={{
                        background:
                          cred.role === 'TRAVELER'
                            ? '#ccfbf1'
                            : cred.role === 'OPERATOR'
                              ? '#e0e7ff'
                              : '#fef3c7',
                        color:
                          cred.role === 'TRAVELER'
                            ? '#0f766e'
                            : cred.role === 'OPERATOR'
                              ? '#3730a3'
                              : '#b45309',
                        marginBottom: '0.35rem'
                      }}
                    >
                      {cred.badge}
                    </span>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{cred.title}</div>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                      Email: <strong style={{ color: '#e2e8f0' }}>{cred.identifier}</strong> •
                      Phone: <strong style={{ color: '#e2e8f0' }}>{cred.phone}</strong> • Pass:{' '}
                      <strong style={{ color: '#5eead4' }}>{cred.password}</strong>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: '0.35rem' }}>
                      {cred.desc}
                    </div>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickRoleLogin(cred);
                    }}
                  >
                    Enter {cred.role} UI →
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2rem' }}>
            Backend API Status:{' '}
            <strong style={{ color: '#5eead4' }}>
              {healthStatus?.database === 'CONNECTED'
                ? `Connected to MySQL (${healthStatus.database_name})`
                : 'Checking MySQL connection...'}
            </strong>
          </div>
        </div>

        {/* Right Panel: Interactive Login / Mobile OTP / Registration Form */}
        <div className="auth-panel">
          <div className="auth-box">
            <h2 style={{ fontSize: '1.65rem', marginBottom: '0.35rem' }}>
              Sign In to Your Portal
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.35rem' }}>
              We automatically route you to the Traveler Marketplace, Operator B2B Console, or
              Admin Backoffice based on your account role.
            </p>

            <div className="category-pills" style={{ marginBottom: '1.35rem' }}>
              <button
                type="button"
                className={`category-chip ${authMode === 'PASSWORD' ? 'active' : ''}`}
                onClick={() => setAuthMode('PASSWORD')}
              >
                🔑 Email / Phone Login
              </button>
              <button
                type="button"
                className={`category-chip ${authMode === 'OTP' ? 'active' : ''}`}
                onClick={() => setAuthMode('OTP')}
              >
                📱 Mobile OTP
              </button>
              <button
                type="button"
                className={`category-chip ${authMode === 'REGISTER' ? 'active' : ''}`}
                onClick={() => setAuthMode('REGISTER')}
              >
                ✨ New Account
              </button>
            </div>

            {authMode === 'PASSWORD' && (
              <form
                onSubmit={handleLoginSubmit}
                style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
              >
                <div className="filter-group">
                  <label>Email or 10-Digit Mobile Number</label>
                  <input
                    className="input"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="e.g. aarav@example.com or 9000000005"
                    required
                  />
                </div>
                <div className="filter-group">
                  <label>Password</label>
                  <input
                    type="password"
                    className="input"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Password@123"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '0.75rem', fontSize: '0.95rem' }}
                  disabled={authBusy}
                >
                  {authBusy ? 'Signing In...' : 'Sign In & Open Role Portal →'}
                </button>
              </form>
            )}

            {authMode === 'OTP' && (
              <form
                onSubmit={handleVerifyOtp}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}
              >
                <div className="filter-group">
                  <label>10-Digit Mobile Number</label>
                  <input
                    className="input"
                    value={otpPhone}
                    onChange={(e) => setOtpPhone(e.target.value)}
                    required
                  />
                </div>
                <div className="filter-group">
                  <label>Full Name (For New Traveler Provisioning)</label>
                  <input
                    className="input"
                    value={otpFullName}
                    onChange={(e) => setOtpFullName(e.target.value)}
                  />
                </div>
                <button type="button" className="btn btn-outline" onClick={handleSendOtp}>
                  📲 Send 6-Digit OTP
                </button>
                {devOtpHint && (
                  <div className="confidence-box" style={{ background: '#f0fdf4' }}>
                    Dev Mode OTP Code: <strong>{devOtpHint}</strong>
                  </div>
                )}
                <div className="filter-group">
                  <label>Enter 6-Digit OTP</label>
                  <input
                    className="input"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="6-digit OTP"
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem' }}>
                  Verify OTP & Enter Traveler Portal →
                </button>
              </form>
            )}

            {authMode === 'REGISTER' && (
              <form
                onSubmit={handleRegisterSubmit}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
              >
                <div className="filter-group">
                  <label>Full Name</label>
                  <input
                    className="input"
                    value={regForm.full_name}
                    onChange={(e) => setRegForm({ ...regForm, full_name: e.target.value })}
                    placeholder="e.g. Kabir Sharma"
                    required
                  />
                </div>
                <div className="filter-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    className="input"
                    value={regForm.email}
                    onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                    placeholder="kabir@example.com"
                    required
                  />
                </div>
                <div className="filter-group">
                  <label>10-Digit Mobile Number</label>
                  <input
                    className="input"
                    value={regForm.phone}
                    onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                    placeholder="9876501234"
                    required
                  />
                </div>
                <div className="filter-group">
                  <label>Password</label>
                  <input
                    type="password"
                    className="input"
                    value={regForm.password}
                    onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem' }}>
                  Create Traveler Account →
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // AUTHENTICATED PORTAL SHELL (DISTINCT UI PER ROLE: TRAVELER / OPERATOR / ADMIN)
  // ==========================================================================
  const navbarRoleClass =
    user.role === 'OPERATOR'
      ? 'navbar navbar-operator'
      : user.role === 'ADMIN'
        ? 'navbar navbar-admin'
        : 'navbar';

  return (
    <div>
      {/* Role-Specific Sticky Glass Header */}
      <header className={navbarRoleClass}>
        <div className="navbar-inner">
          <div className="brand">
            <span className="brand-logo">
              {user.role === 'TRAVELER' ? '🧭' : user.role === 'OPERATOR' ? '📊' : '🏛️'}
            </span>
            <span>
              {user.role === 'TRAVELER'
                ? 'TrailSync India'
                : user.role === 'OPERATOR'
                  ? 'TrailSync Partner B2B'
                  : 'TrailSync Admin Console'}
            </span>
            <span className="brand-badge">
              {user.role === 'TRAVELER'
                ? '🎒 Traveler Marketplace'
                : user.role === 'OPERATOR'
                  ? '📊 Operator SaaS'
                  : '🏛️ Platform Governance'}
            </span>
          </div>

          {/* Role-Specific Navigation Bar */}
          {user.role === 'TRAVELER' && (
            <nav className="nav-tabs">
              <button
                className={`nav-tab ${activeTab === 'discover' ? 'active' : ''}`}
                onClick={() => setActiveTab('discover')}
              >
                <span>🌎</span> Discover & Compare
              </button>
              <button
                className={`nav-tab ${activeTab === 'compatibility' ? 'active' : ''}`}
                onClick={() => setActiveTab('compatibility')}
              >
                <span>✨</span> Vibe Matcher
              </button>
              <button
                className={`nav-tab ${activeTab === 'operators' ? 'active' : ''}`}
                onClick={() => setActiveTab('operators')}
              >
                <span>🛡️</span> Verified Operators
              </button>
              <button
                className={`nav-tab ${activeTab === 'bookings' ? 'active' : ''}`}
                onClick={() => setActiveTab('bookings')}
              >
                <span>🎟️</span> My Bookings & Safety
              </button>
            </nav>
          )}

          {user.role === 'OPERATOR' && (
            <nav className="nav-tabs">
              <button
                className={`nav-tab ${activeTab === 'op-dashboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('op-dashboard')}
              >
                <span>📈</span> Live Batches & Manifests
              </button>
              <button
                className={`nav-tab ${activeTab === 'op-catalogue' ? 'active' : ''}`}
                onClick={() => setActiveTab('op-catalogue')}
              >
                <span>📦</span> My Trip Catalogue
              </button>
              <button
                className={`nav-tab ${activeTab === 'op-bookings' ? 'active' : ''}`}
                onClick={() => setActiveTab('op-bookings')}
              >
                <span>🎟️</span> Bookings & Custom Quotes
              </button>
              <button
                className={`nav-tab ${activeTab === 'op-trust' ? 'active' : ''}`}
                onClick={() => setActiveTab('op-trust')}
              >
                <span>🛡️</span> Trust Audit & Incidents
              </button>
              <button
                className={`nav-tab ${activeTab === 'op-profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('op-profile')}
              >
                <span>⚙️</span> Operator Profile
              </button>
            </nav>
          )}

          {user.role === 'ADMIN' && (
            <nav className="nav-tabs">
              <button
                className={`nav-tab ${activeTab === 'admin-economics' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin-economics')}
              >
                <span>💰</span> Unit Economics
              </button>
              <button
                className={`nav-tab ${activeTab === 'admin-kyc' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin-kyc')}
              >
                <span>✅</span> Operator KYC Audit
              </button>
              <button
                className={`nav-tab ${activeTab === 'admin-escrow' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin-escrow')}
              >
                <span>🏦</span> Escrow Payouts (UTR)
              </button>
              <button
                className={`nav-tab ${activeTab === 'admin-incidents' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin-incidents')}
              >
                <span>🚨</span> Safety Incidents
              </button>
            </nav>
          )}

          {/* Signed-in User Badge, Quick Role Switcher & Sign Out */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <div className="persona-switcher">
              <span className="persona-dot" />
              <span style={{ color: '#fff', fontWeight: 700 }}>{user.full_name}</span>
              <span className="badge badge-teal" style={{ fontSize: '0.68rem' }}>
                {user.role}
              </span>
            </div>

            <select
              className="persona-select"
              value=""
              onChange={(e) => {
                const found = ROLE_CREDENTIALS.find((c) => c.identifier === e.target.value);
                if (found) handleQuickRoleLogin(found);
              }}
            >
              <option value="" disabled>
                ⚡ Quick Switch Role...
              </option>
              {ROLE_CREDENTIALS.map((c) => (
                <option key={c.identifier} value={c.identifier}>
                  {c.role}: {c.title}
                </option>
              ))}
            </select>

            <button
              className="btn btn-outline"
              style={{
                padding: '0.36rem 0.75rem',
                fontSize: '0.76rem',
                background: 'rgba(239, 68, 68, 0.16)',
                color: '#fca5a5',
                borderColor: 'rgba(239, 68, 68, 0.35)'
              }}
              onClick={handleLogout}
            >
              🚪 Sign Out
            </button>
          </div>
        </div>
      </header>

      {toast && (
        <div className="toast">
          <span>✅</span>
          <span>{toast}</span>
        </div>
      )}

      {/* ======================================================================
          PORTAL 1: TRAVELER MARKETPLACE UI (user.role === 'TRAVELER')
         ====================================================================== */}
      {user.role === 'TRAVELER' && (
        <main className="container">
          {activeTab === 'discover' && (
            <>
              <section className="hero-banner">
                <div>
                  <div className="hero-eyebrow">
                    <span>🎒 Traveler Portal • Welcome back, {user.full_name}</span>
                  </div>
                  <h1>Book Stranger Group Trips, Bike Expeditions & Camps with Total Confidence</h1>
                  <p>
                    Compare live seat inventory, minimum departure thresholds, 5-dimension group
                    vibe compatibility, and escrow-backed cancellation rules in one place.
                  </p>
                </div>
                <div className="hero-stats">
                  <div className="hero-stat-pill">
                    <div className="hero-stat-value">100% KYC</div>
                    <div className="hero-stat-label">GST & Safety Vetted</div>
                  </div>
                  <div className="hero-stat-pill">
                    <div className="hero-stat-value">Escrow Safe</div>
                    <div className="hero-stat-label">Auto Policy Refunds</div>
                  </div>
                  <div className="hero-stat-pill">
                    <div className="hero-stat-value">Live Sync</div>
                    <div className="hero-stat-label">Platform + IG Seats</div>
                  </div>
                </div>
              </section>

              <div className="category-pills">
                {[
                  { key: '', label: '🔥 All Experiences' },
                  { key: 'STRANGER_GROUP', label: '🏔️ Stranger Group Trips' },
                  { key: 'BIKE_CAR_EXPEDITION', label: '🏍️ Bike & Car Expeditions' },
                  { key: 'WEEKEND_NICHE', label: '⛺ Weekend Starlight Camps' },
                  { key: 'PRIVATE_CUSTOM', label: '✨ Private Family / Friends' }
                ].map((c) => (
                  <button
                    key={c.key}
                    className={`category-chip ${filters.trip_category === c.key ? 'active' : ''}`}
                    onClick={() => setFilters({ ...filters, trip_category: c.key })}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <div className="filter-bar">
                <div className="filter-group">
                  <label>Experience Category</label>
                  <select
                    className="select"
                    value={filters.trip_category}
                    onChange={(e) => setFilters({ ...filters, trip_category: e.target.value })}
                  >
                    <option value="">All Categories</option>
                    <option value="STRANGER_GROUP">Stranger Group Trips</option>
                    <option value="BIKE_CAR_EXPEDITION">Bike & Car Road Trips</option>
                    <option value="WEEKEND_NICHE">Weekend & Niche Camping</option>
                    <option value="PRIVATE_CUSTOM">Private Family / Friends</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label>Departure Origin Hub</label>
                  <select
                    className="select"
                    value={filters.origin_city}
                    onChange={(e) => setFilters({ ...filters, origin_city: e.target.value })}
                  >
                    <option value="">All Departure Cities</option>
                    <option value="Delhi">Delhi</option>
                    <option value="Indore">Indore</option>
                    <option value="Leh">Leh</option>
                    <option value="Jaipur">Jaipur</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label>Max Budget Per Person (₹)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="e.g. 15000"
                    value={filters.max_budget}
                    onChange={(e) => setFilters({ ...filters, max_budget: e.target.value })}
                  />
                </div>

                <div style={{ flex: '0 0 auto' }}>
                  <label className={`toggle-pill ${filters.only_guaranteed ? 'checked' : ''}`}>
                    <input
                      type="checkbox"
                      style={{ display: 'none' }}
                      checked={filters.only_guaranteed}
                      onChange={(e) =>
                        setFilters({ ...filters, only_guaranteed: e.target.checked })
                      }
                    />
                    <span>{filters.only_guaranteed ? '✓' : '○'}</span>
                    <span>Guaranteed Departures Only</span>
                  </label>
                </div>
              </div>

              {loadingTrips ? (
                <p>Loading live marketplace inventory...</p>
              ) : (
                <div className="grid-3">
                  {trips.map((trip) => {
                    const dep = trip.next_departure;
                    const conf = dep?.confidence_metrics;
                    const isCompared = compareIds.includes(trip.id);
                    const coverUrl = getTripCoverImage(trip);
                    const statusClass =
                      dep?.departure_status === 'GUARANTEED'
                        ? 'guaranteed'
                        : dep?.departure_status === 'FILLING_FAST'
                          ? 'filling'
                          : 'open';

                    return (
                      <div className="card" key={trip.id}>
                        <div className="card-media">
                          <img src={coverUrl} alt={trip.title} loading="lazy" />
                          <div className="card-media-overlay">
                            <div className="card-media-top">
                              <span className="glass-pill">
                                {formatCategoryLabel(trip.trip_category)}
                              </span>
                              <span className="glass-rating">
                                ⭐ {trip.operator_rating}{' '}
                                <span style={{ fontWeight: 500, color: '#64748b' }}>
                                  ({trip.operator_reviews_count})
                                </span>
                              </span>
                            </div>
                            <div className="card-media-bottom">
                              <span className="route-pill">
                                📍 {trip.origin_city} → {trip.destination_city}
                              </span>
                              <span className="duration-pill">
                                {trip.duration_days}D / {trip.duration_nights}N
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="card-body">
                          <div>
                            <div className="operator-strip">
                              <span className="operator-verified">
                                <span className="verified-dot">✓</span>
                                {trip.operator_name}
                              </span>
                              <span className="badge badge-amber">{trip.comfort_level}</span>
                            </div>
                            <h3 className="card-title">{trip.title}</h3>
                            <div className="meta-line" style={{ marginTop: '0.45rem' }}>
                              <span>⚡ Pace: {String(trip.pace_tag || '').replace(/_/g, ' ')}</span>
                              <span>•</span>
                              <span>
                                🏕️ {String(trip.accommodation_type || '').replace(/_/g, ' ')}
                              </span>
                            </div>
                          </div>

                          {dep && conf ? (
                            <div className="confidence-box">
                              <div className="confidence-header">
                                <span>
                                  📅{' '}
                                  {new Date(dep.start_date).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric'
                                  })}
                                </span>
                                <span className={`status-chip ${statusClass}`}>
                                  {dep.departure_status.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                {conf.confidence_badge} •{' '}
                                <strong style={{ color: 'var(--primary-dark)' }}>
                                  {conf.available_seats} seats left
                                </strong>
                              </div>
                              <div className="progress-bar-bg">
                                <div
                                  className={`progress-bar-fill ${
                                    conf.is_departure_guaranteed ? '' : 'amber'
                                  }`}
                                  style={{
                                    width: `${Math.min(100, conf.occupancy_percentage || 0)}%`
                                  }}
                                />
                              </div>
                              <div className="freshness-line">
                                <span>
                                  <span className="pulse-dot" />
                                  Synced {conf.inventory_freshness_hours}h ago
                                </span>
                                <span>
                                  Platform: {conf.booked_on_platform} • IG:{' '}
                                  {conf.filled_offline_or_instagram}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="confidence-box">
                              <div className="confidence-header">
                                <span>✨ Flexible Private Departure</span>
                                <span className="status-chip guaranteed">Custom Quote</span>
                              </div>
                              <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
                                Tailor dates, hotels, and private SUV transport for your group.
                              </div>
                            </div>
                          )}

                          <div className="price-row">
                            <div>
                              <div className="price-tag">
                                ₹
                                {Number(dep?.price_per_person || trip.base_price).toLocaleString(
                                  'en-IN'
                                )}{' '}
                                <span>/ person</span>
                              </div>
                              <div className="price-sub">
                                {dep?.token_amount
                                  ? `🔒 Lock seat with ₹${Number(dep.token_amount).toLocaleString('en-IN')} token`
                                  : '✨ Request private group quote'}
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.45rem' }}>
                              <button
                                className={`btn ${isCompared ? 'btn-primary' : 'btn-outline'}`}
                                onClick={() => toggleCompare(trip.id)}
                              >
                                {isCompared ? '✓ Added' : '+ Compare'}
                              </button>
                              <button
                                className="btn btn-primary"
                                onClick={() => openTripDetail(trip.slug)}
                              >
                                Explore →
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {compareIds.length > 0 && (
                <div className="compare-bar">
                  <span>
                    ⚖️ <strong>{compareIds.length}</strong> package(s) selected for side-by-side
                    comparison
                  </span>
                  <button className="btn btn-primary" onClick={openCompareModal}>
                    Compare Side-by-Side
                  </button>
                  <button className="btn btn-outline" onClick={() => setCompareIds([])}>
                    Clear
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === 'compatibility' && (
            <div>
              <section className="hero-banner">
                <div>
                  <div className="hero-eyebrow">
                    ✨ Model B Differentiator • Social Group Harmony
                  </div>
                  <h1>5-Dimension Travel Compatibility Matcher</h1>
                  <p>
                    Know the group vibe before you join a stranger trip. Tune your preferred pace,
                    social energy, morning style, and stay comfort to rank departures by
                    compatibility.
                  </p>
                </div>
              </section>

              <form className="filter-bar" onSubmit={handleSavePreferences}>
                <div className="filter-group">
                  <label>Preferred Pace</label>
                  <select
                    className="select"
                    value={prefForm.pace_preference}
                    onChange={(e) =>
                      setPrefForm({ ...prefForm, pace_preference: e.target.value })
                    }
                  >
                    <option value="CHILL_RELAXED">Chill & Relaxed</option>
                    <option value="BALANCED">Balanced</option>
                    <option value="HIGH_ADVENTURE">High Adventure</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label>Social Vibe</label>
                  <select
                    className="select"
                    value={prefForm.social_style}
                    onChange={(e) => setPrefForm({ ...prefForm, social_style: e.target.value })}
                  >
                    <option value="HIGH_ENERGY_GROUP">High Energy Social & Bonfire</option>
                    <option value="BALANCED_SOCIAL">Balanced Social</option>
                    <option value="INTIMATE_SMALL_GROUP">Intimate Small Group</option>
                    <option value="QUIET_NATURE">Quiet Nature & Reflective</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label>Morning Style</label>
                  <select
                    className="select"
                    value={prefForm.morning_style}
                    onChange={(e) => setPrefForm({ ...prefForm, morning_style: e.target.value })}
                  >
                    <option value="EARLY_BIRD">Early Bird (Sunrise Treks)</option>
                    <option value="FLEXIBLE">Flexible Schedule</option>
                    <option value="LATE_RISER">Late Riser / Leisurely</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label>Comfort Preference</label>
                  <select
                    className="select"
                    value={prefForm.comfort_preference}
                    onChange={(e) =>
                      setPrefForm({ ...prefForm, comfort_preference: e.target.value })
                    }
                  >
                    <option value="BUDGET_BACKPACKER">Budget Backpacker / Camps</option>
                    <option value="STANDARD_COMFORT">Standard Comfort</option>
                    <option value="PREMIUM_BOUTIQUE">Premium / Boutique</option>
                  </select>
                </div>

                <button type="submit" className="btn btn-primary">
                  ✨ Save Vibe & Re-Rank
                </button>
              </form>

              {recommendations?.recommendations && (
                <div className="grid-3">
                  {recommendations.recommendations.map((rec) => {
                    const cm = rec.compatibility_match || {};
                    const dims = cm.dimension_scores || {};
                    const coverUrl = getTripCoverImage(rec);
                    return (
                      <div className="card" key={rec.trip_id}>
                        <div className="card-media" style={{ height: '175px' }}>
                          <img src={coverUrl} alt={rec.title} loading="lazy" />
                          <div className="card-media-overlay">
                            <div className="card-media-top">
                              <span className="glass-pill">
                                {formatCategoryLabel(rec.trip_category)}
                              </span>
                              <span
                                className="glass-rating"
                                style={{ background: '#dcfce7', color: '#15803d' }}
                              >
                                🎯 {cm.match_score_percentage}% Vibe Match
                              </span>
                            </div>
                            <div className="card-media-bottom">
                              <span className="route-pill">
                                📍 {rec.origin_city} → {rec.destination_city}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="card-body">
                          <div>
                            <div className="badge-row" style={{ marginBottom: '0.4rem' }}>
                              <span className="badge badge-green">{cm.match_label}</span>
                            </div>
                            <h3 className="card-title">{rec.title}</h3>
                          </div>

                          <div className="confidence-box">
                            <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>
                              5-Dimension Compatibility Breakdown:
                            </div>
                            <div className="meta-line" style={{ fontSize: '0.77rem' }}>
                              <span>⚡ Pace: {dims.pace_alignment_score}</span>
                              <span>🎉 Social: {dims.social_vibe_score}</span>
                              <span>🌅 Morning: {dims.morning_schedule_score}</span>
                              <span>🛏️ Comfort: {dims.comfort_fit_score}</span>
                              <span>📍 Hub: {dims.category_and_origin_hub_score}</span>
                            </div>
                            {cm.match_highlights && cm.match_highlights.length > 0 && (
                              <ul
                                style={{
                                  marginTop: '0.5rem',
                                  paddingLeft: '1.1rem',
                                  fontSize: '0.79rem',
                                  color: 'var(--success)'
                                }}
                              >
                                {cm.match_highlights.map((r, i) => (
                                  <li key={i}>{r}</li>
                                ))}
                              </ul>
                            )}
                            {cm.things_to_know && cm.things_to_know.length > 0 && (
                              <ul
                                style={{
                                  marginTop: '0.35rem',
                                  paddingLeft: '1.1rem',
                                  fontSize: '0.78rem',
                                  color: 'var(--warning)'
                                }}
                              >
                                {cm.things_to_know.map((note, i) => (
                                  <li key={i}>Heads up: {note}</li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div className="price-row">
                            <div>
                              <div className="price-tag">
                                ₹{Number(rec.base_price).toLocaleString('en-IN')}
                              </div>
                              <div className="price-sub">By {rec.operator?.name}</div>
                            </div>
                            <button
                              className="btn btn-primary"
                              onClick={() => openTripDetail(rec.slug)}
                            >
                              Who&apos;s In This Group →
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'operators' && (
            <div>
              <section className="hero-banner">
                <div>
                  <div className="hero-eyebrow">🛡️ Problem 2 Solution • Trust & Safety Engine</div>
                  <h1>Verified Travel Operators & Composite Trust Scores</h1>
                  <p>
                    Every organizer on TrailSync undergoes GST/PAN verification, emergency response
                    vetting, and real-time tracking of departure reliability and booking-gated
                    reviews.
                  </p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowOnboardModal(true)}>
                  🚀 Apply to Become an Operator
                </button>
              </section>

              <div className="grid-3" style={{ marginBottom: '1.75rem' }}>
                {operators.map((op) => (
                  <div className="card card-padded" key={op.id}>
                    <div>
                      <div className="badge-row" style={{ marginBottom: '0.6rem' }}>
                        <span className="badge badge-green">✓ {op.kyc_status}</span>
                        <span className="badge badge-teal">📍 {op.base_city}</span>
                        <span className="badge badge-amber">
                          {String(op.operator_type || '').replace(/_/g, ' ')}
                        </span>
                      </div>
                      <h3 className="card-title">{op.business_name}</h3>
                      <p
                        style={{
                          fontSize: '0.86rem',
                          color: 'var(--muted)',
                          marginTop: '0.4rem'
                        }}
                      >
                        {op.tagline || op.bio}
                      </p>
                    </div>
                    <div className="price-row">
                      <div>
                        <div className="price-tag">{op.rating_avg} ★</div>
                        <div className="price-sub">
                          {op.reviews_count} Verified Reviews • {op.total_completed_trips} Completed
                          Batches
                        </div>
                      </div>
                      <button
                        className="btn btn-primary"
                        onClick={() => inspectOperatorTrust(op.slug)}
                      >
                        Inspect Trust Audit →
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {selectedOperatorReport && (
                <div className="card card-padded">
                  <div className="modal-header">
                    <div>
                      <h2 style={{ fontSize: '1.35rem' }}>
                        🛡️ Composite Trust Audit: {selectedOperatorReport.operator.business_name}
                      </h2>
                      <p style={{ fontSize: '0.86rem', color: 'var(--muted)' }}>
                        Trust Tier:{' '}
                        <strong>{selectedOperatorReport.trust_profile.trust_tier}</strong> •
                        Completed Trips: {selectedOperatorReport.operator.total_completed_trips} •
                        Published Packages: {operatorSlugProfile?.published_trips?.length || 0}
                      </p>
                    </div>
                    <div
                      className="badge badge-green"
                      style={{ fontSize: '1.05rem', padding: '0.5rem 1.1rem' }}
                    >
                      Composite Score:{' '}
                      {selectedOperatorReport.trust_profile.composite_trust_score} / 100
                    </div>
                  </div>

                  <div className="stat-grid">
                    <div className="stat-card">
                      <div className="stat-label">1. Verified Reviews (Max 40)</div>
                      <div className="stat-value">
                        {
                          selectedOperatorReport.trust_profile.score_breakdown
                            .verified_reviews_points
                        }{' '}
                        pts
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">2. KYC & Legal Audit (Max 25)</div>
                      <div className="stat-value">
                        {
                          selectedOperatorReport.trust_profile.score_breakdown
                            .kyc_verification_points
                        }{' '}
                        pts
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">3. Departure Reliability (Max 20)</div>
                      <div className="stat-value">
                        {
                          selectedOperatorReport.trust_profile.score_breakdown
                            .departure_reliability_points
                        }{' '}
                        pts
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">4. Track Record (Max 15)</div>
                      <div className="stat-value">
                        {
                          selectedOperatorReport.trust_profile.score_breakdown
                            .completed_trips_track_record_points
                        }{' '}
                        pts
                      </div>
                    </div>
                  </div>

                  <h4 style={{ marginBottom: '0.6rem' }}>
                    Verified Booking-Gated Traveler Reviews
                  </h4>
                  <div className="grid-3">
                    {selectedOperatorReport.reviews.map((rev) => (
                      <div className="confidence-box" key={rev.id}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontWeight: 700
                          }}
                        >
                          <span>{rev.reviewer_name}</span>
                          <span className="badge badge-green">{rev.overall_rating} ★</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                          Trip: {rev.trip_title} ({rev.batch_code})
                        </div>
                        <p style={{ fontSize: '0.84rem', marginTop: '0.25rem' }}>
                          {rev.review_text}
                        </p>
                        {rev.operator_public_reply && (
                          <div
                            style={{
                              marginTop: '0.45rem',
                              paddingTop: '0.4rem',
                              borderTop: '1px dashed var(--border)',
                              fontSize: '0.8rem',
                              color: 'var(--primary-dark)'
                            }}
                          >
                            <strong>Operator Reply:</strong> {rev.operator_public_reply}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'bookings' && (
            <div>
              <section className="hero-banner">
                <div>
                  <div className="hero-eyebrow">
                    🎟️ Traveler Command Center • Bookings, Refunds, Reviews & Safety
                  </div>
                  <h1>My Bookings, Token Balances, Custom Quotes & Safety Reports</h1>
                  <p>
                    Settle remaining token balances, preview policy-driven cancellation refunds,
                    submit booking-gated 5-dimension reviews, or report active trip safety
                    incidents.
                  </p>
                </div>
              </section>

              <h3 style={{ marginBottom: '0.85rem' }}>1. Confirmed & Reserved Trip Bookings</h3>
              {myBookings.length === 0 ? (
                <div className="card card-padded" style={{ marginBottom: '1.75rem' }}>
                  <p>
                    No bookings found for {user?.full_name}. Book a trip from the Discover tab!
                  </p>
                </div>
              ) : (
                <div className="grid-3" style={{ marginBottom: '2rem' }}>
                  {myBookings.map((b) => (
                    <div className="card card-padded" key={b.id}>
                      <div>
                        <div className="badge-row" style={{ marginBottom: '0.5rem' }}>
                          <span
                            className={`badge ${
                              b.booking_status === 'CONFIRMED' ? 'badge-green' : 'badge-red'
                            }`}
                          >
                            {b.booking_status}
                          </span>
                          <span className="badge badge-teal">Plan: {b.payment_plan}</span>
                          <span className="badge badge-amber">Ref: {b.booking_reference}</span>
                        </div>
                        <h3 className="card-title">{b.trip_title}</h3>
                        <div className="meta-line" style={{ marginTop: '0.35rem' }}>
                          <span>Operator: {b.operator_name}</span>
                          <span>•</span>
                          <span>Seats: {b.seats_count}</span>
                        </div>
                      </div>

                      <div className="confidence-box">
                        <div>
                          📅 Departure:{' '}
                          <strong>
                            {new Date(b.start_date).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </strong>{' '}
                          ({b.batch_code})
                        </div>
                        <div style={{ marginTop: '0.25rem' }}>
                          Total Package:{' '}
                          <strong>₹{Number(b.total_amount).toLocaleString('en-IN')}</strong>
                        </div>
                        <div>
                          Amount Paid:{' '}
                          <strong style={{ color: 'var(--success)' }}>
                            ₹{Number(b.amount_paid).toLocaleString('en-IN')}
                          </strong>
                        </div>
                        <div>
                          Balance Due:{' '}
                          <strong
                            style={{
                              color: Number(b.balance_due) > 0 ? 'var(--warning)' : 'var(--muted)'
                            }}
                          >
                            ₹{Number(b.balance_due).toLocaleString('en-IN')}
                          </strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-outline"
                          onClick={() => handleInspectBookingRef(b.booking_reference)}
                        >
                          📋 Passengers
                        </button>

                        {b.booking_status === 'CONFIRMED' && Number(b.balance_due) > 0 && (
                          <button
                            className="btn btn-primary"
                            onClick={() => handlePayRemainingBalance(b.booking_reference)}
                          >
                            💳 Pay Balance (₹{Number(b.balance_due).toLocaleString('en-IN')})
                          </button>
                        )}

                        {['CONFIRMED', 'COMPLETED'].includes(b.booking_status) && (
                          <>
                            <button
                              className="btn btn-outline"
                              onClick={() => setReviewModalBooking(b)}
                            >
                              ⭐ Review
                            </button>
                            <button
                              className="btn btn-danger"
                              onClick={() => setIncidentModalBooking(b)}
                            >
                              🚨 Report SOS / Issue
                            </button>
                          </>
                        )}

                        {['CONFIRMED', 'PENDING_PAYMENT'].includes(b.booking_status) && (
                          <button
                            className="btn btn-outline"
                            onClick={() => handlePreviewRefund(b.booking_reference)}
                          >
                            ⚖️ Cancel / Refund Preview
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <h3 style={{ marginBottom: '0.85rem' }}>
                2. My Custom Private Group Enquiries & Operator Quotes ({myEnquiries.length})
              </h3>
              <div className="grid-3" style={{ marginBottom: '2rem' }}>
                {myEnquiries.map((enq) => (
                  <div className="card card-padded" key={enq.id}>
                    <div className="badge-row">
                      <span className="badge badge-teal">{enq.enquiry_reference}</span>
                      <span
                        className={`badge ${
                          enq.status === 'QUOTED' ? 'badge-green' : 'badge-amber'
                        }`}
                      >
                        {enq.status}
                      </span>
                    </div>
                    <h4 className="card-title">{enq.trip_title}</h4>
                    <div className="confidence-box">
                      <div>
                        Group Size: <strong>{enq.group_size} Travelers</strong> • Origin:{' '}
                        {enq.origin_city}
                      </div>
                      <div>Notes: {enq.customization_notes}</div>
                      {enq.operator_quote_total && (
                        <div
                          style={{
                            marginTop: '0.45rem',
                            color: 'var(--primary-dark)',
                            fontWeight: 700
                          }}
                        >
                          Operator Total Quote: ₹
                          {Number(enq.operator_quote_total).toLocaleString('en-IN')} (
                          {enq.operator_response_notes})
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid-3">
                <div className="card card-padded">
                  <h4>💳 Captured Payments ({myTransactions.payments?.length || 0})</h4>
                  {(myTransactions.payments || []).slice(0, 5).map((p) => (
                    <div className="confidence-box" key={p.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>₹{Number(p.amount).toLocaleString('en-IN')}</strong>
                        <span className="badge badge-green">{p.status}</span>
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                        Booking: {p.booking_reference} • Order: {p.razorpay_order_id}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="card card-padded">
                  <h4>💸 Processed Refunds ({myTransactions.refunds?.length || 0})</h4>
                  {(myTransactions.refunds || []).slice(0, 5).map((r) => (
                    <div className="confidence-box" key={r.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>₹{Number(r.refund_amount).toLocaleString('en-IN')}</strong>
                        <span className="badge badge-teal">{r.status}</span>
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                        Ref: {r.refund_reference} • Tier: {r.policy_tier_applied}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="card card-padded">
                  <h4>🚨 Reported Safety Incidents ({myIncidents.length})</h4>
                  {myIncidents.map((inc) => (
                    <div className="confidence-box" key={inc.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{inc.incident_reference}</strong>
                        <span className="badge badge-red">{inc.severity}</span>
                      </div>
                      <div style={{ fontSize: '0.78rem', marginTop: '0.2rem' }}>
                        {inc.description}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--primary-dark)',
                          marginTop: '0.25rem'
                        }}
                      >
                        Status: <strong>{inc.status}</strong> • Escrow Frozen:{' '}
                        {inc.payout_frozen ? 'Yes' : 'No'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {/* ======================================================================
          PORTAL 2: OPERATOR B2B SAAS CONSOLE UI (user.role === 'OPERATOR')
         ====================================================================== */}
      {user.role === 'OPERATOR' && (
        <main className="container">
          <section className="hero-banner hero-operator">
            <div>
              <div className="hero-eyebrow">
                📊 Operator B2B SaaS Workspace • {operatorDashboard?.operator?.business_name || user.full_name}
              </div>
              <h1>Manage Seat Inventory, Instagram Sync, Manifests & Escrow Payouts</h1>
              <p>
                Keep batch inventory fresh across Instagram and TrailSync, export verified
                participant manifests with emergency contacts, and respond to custom group leads.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowCreateTripModal(true)}>
              + Create New Trip & Departure Batch
            </button>
          </section>

          {operatorDashboard && (
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-label">Operator Account</div>
                <div className="stat-value" style={{ fontSize: '1.25rem' }}>
                  {operatorDashboard.operator.business_name}
                </div>
                <div className="price-sub">
                  ✓ KYC Status: {operatorDashboard.operator.kyc_status}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Confirmed Gross GMV</div>
                <div className="stat-value">
                  ₹
                  {Number(operatorDashboard.financial_ledger.confirmed_gmv).toLocaleString(
                    'en-IN'
                  )}
                </div>
                <div className="price-sub">
                  Collected: ₹
                  {Number(
                    operatorDashboard.financial_ledger.total_amount_collected
                  ).toLocaleString('en-IN')}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Net Operator Earnings (After Fee)</div>
                <div className="stat-value" style={{ color: 'var(--success)' }}>
                  ₹
                  {Number(
                    operatorDashboard.financial_ledger.net_operator_payout_after_commission
                  ).toLocaleString('en-IN')}
                </div>
                <div className="price-sub">
                  Escrow Held: ₹
                  {Number(operatorPayouts?.summary?.escrow_held_amount || 0).toLocaleString(
                    'en-IN'
                  )}{' '}
                  • Settled: ₹
                  {Number(operatorPayouts?.summary?.settled_amount || 0).toLocaleString('en-IN')}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Live Fleet Occupancy</div>
                <div className="stat-value">
                  {operatorDashboard.inventory_overview.overall_occupancy_percentage}%
                </div>
                <div className="price-sub">
                  Platform: {operatorDashboard.inventory_overview.seats_booked_on_platform} •
                  Instagram/Offline:{' '}
                  {operatorDashboard.inventory_overview.seats_filled_offline_instagram}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'op-dashboard' && operatorDashboard && (
            <div className="card card-padded">
              <h3 style={{ marginBottom: '0.75rem' }}>
                Live Departure Batches, 1-Click Instagram Seat Sync & CSV Manifests
              </h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Batch Code & Trip</th>
                      <th>Departure Date</th>
                      <th>Seat Breakdown</th>
                      <th>Status</th>
                      <th>Freshness</th>
                      <th>Operator Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operatorDashboard.upcoming_departures.map((dep) => {
                      const occupied =
                        Number(dep.booked_seats) + Number(dep.offline_blocked_seats);
                      return (
                        <tr key={dep.id}>
                          <td>
                            <strong>{dep.trip_title}</strong>
                            <div className="price-sub">
                              {dep.batch_code} • {dep.trip_category}
                            </div>
                          </td>
                          <td>
                            {new Date(dep.start_date).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </td>
                          <td>
                            <strong>
                              {occupied} / {dep.total_seats}
                            </strong>
                            <div className="price-sub">
                              Platform: {dep.booked_seats} | IG/Offline:{' '}
                              {dep.offline_blocked_seats}
                            </div>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                dep.departure_status === 'GUARANTEED'
                                  ? 'badge-green'
                                  : 'badge-amber'
                              }`}
                            >
                              {dep.departure_status}
                            </span>
                          </td>
                          <td>
                            <span className="pulse-dot" />
                            Synced {dep.hours_since_inventory_sync}h ago
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <button
                                className="btn btn-outline"
                                onClick={() =>
                                  handleSyncOfflineSeats(dep.id, dep.offline_blocked_seats)
                                }
                              >
                                +1 IG Seat
                              </button>
                              <button
                                className="btn btn-primary"
                                onClick={() => handleViewManifest(dep.id)}
                              >
                                📋 Manifest
                              </button>
                              <button
                                className="btn btn-outline"
                                onClick={() =>
                                  handleDownloadCsvManifest(dep.id, dep.batch_code)
                                }
                              >
                                ⬇ CSV
                              </button>
                              <button
                                className="btn btn-outline"
                                onClick={() => handleViewWaitlist(dep.id)}
                              >
                                🔔 Waitlist
                              </button>
                              <button
                                className="btn btn-danger"
                                onClick={() => handleCancelBatchByOperator(dep.id)}
                              >
                                Cancel Batch
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'op-catalogue' && (
            <div className="grid-3">
              {myOperatorTrips.map((t) => (
                <div className="card card-padded" key={t.id}>
                  <div>
                    <div className="badge-row" style={{ marginBottom: '0.45rem' }}>
                      <span className="badge badge-teal">{t.status}</span>
                      <span className="badge badge-amber">{t.trip_category}</span>
                    </div>
                    <h3 className="card-title">{t.title}</h3>
                    <div className="meta-line" style={{ marginTop: '0.35rem' }}>
                      <span>
                        📍 {t.origin_city} → {t.destination_city}
                      </span>
                      <span>
                        ₹{Number(t.base_price).toLocaleString('en-IN')} / person
                      </span>
                    </div>
                  </div>
                  <div className="price-row">
                    <button
                      className="btn btn-outline"
                      onClick={() => handleToggleTripStatus(t.id, t.status)}
                    >
                      Toggle {t.status === 'PUBLISHED' ? 'PAUSED' : 'PUBLISHED'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'op-bookings' && (
            <div className="grid-3">
              <div className="card card-padded">
                <h4>🎟️ Traveler Bookings ({operatorBookings.length})</h4>
                {operatorBookings.map((b) => (
                  <div className="confidence-box" key={b.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{b.booking_reference}</strong>
                      <span className="badge badge-green">{b.booking_status}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                      {b.booked_by_name} ({b.booked_by_phone}) • {b.seats_count} seat(s)
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      Paid: ₹{b.amount_paid} / ₹{b.total_amount}
                    </div>
                    {b.booking_status === 'PENDING_PAYMENT' && (
                      <button
                        className="btn btn-primary"
                        style={{ marginTop: '0.4rem', fontSize: '0.76rem' }}
                        onClick={() => handleManualConfirmBooking(b.id, b.total_amount)}
                      >
                        ✓ Confirm Manual UPI Payment
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="card card-padded">
                <h4>✨ Custom Private Group Enquiries ({operatorEnquiries.length})</h4>
                {operatorEnquiries.map((enq) => (
                  <div className="confidence-box" key={enq.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{enq.enquiry_reference}</strong>
                      <span className="badge badge-amber">{enq.status}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                      {enq.traveler_name} • {enq.group_size} Travelers • {enq.origin_city}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      Notes: {enq.customization_notes}
                    </div>
                    {enq.status === 'OPEN' && (
                      <button
                        className="btn btn-primary"
                        style={{ marginTop: '0.4rem', fontSize: '0.76rem' }}
                        onClick={() => handleSendEnquiryQuote(enq.id)}
                      >
                        Send ₹84,000 Custom Quote
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="card card-padded">
                <h4>🔒 Operator Escrow Payout Ledger ({operatorPayouts?.count || 0})</h4>
                {(operatorPayouts?.payouts || []).map((p) => (
                  <div className="confidence-box" key={p.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>₹{Number(p.net_operator_payable).toLocaleString('en-IN')}</strong>
                      <span className="badge badge-teal">{p.payout_status}</span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                      Booking: {p.booking_reference} • Batch: {p.batch_code}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'op-trust' && (
            <div className="grid-3">
              <div className="card card-padded">
                <h4>
                  🛡️ My Composite Trust Score:{' '}
                  {operatorTrustSelf?.trust_profile?.composite_trust_score || 90}/100
                </h4>
                {(operatorTrustSelf?.reviews || []).map((rev) => (
                  <div className="confidence-box" key={rev.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{rev.reviewer_name}</strong>
                      <span className="badge badge-green">{rev.overall_rating} ★</span>
                    </div>
                    <p style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>{rev.review_text}</p>
                    {rev.operator_public_reply ? (
                      <div style={{ fontSize: '0.78rem', color: 'var(--primary-dark)', marginTop: '0.3rem' }}>
                        <strong>Your Reply:</strong> {rev.operator_public_reply}
                      </div>
                    ) : (
                      <button
                        className="btn btn-outline"
                        style={{ marginTop: '0.4rem', fontSize: '0.75rem' }}
                        onClick={() => handleReplyToReview(rev.id)}
                      >
                        💬 Post Official Reply
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="card card-padded">
                <h4>🚨 Reported Safety / Quality Incidents ({operatorIncidents.length})</h4>
                {operatorIncidents.map((inc) => (
                  <div className="confidence-box" key={inc.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{inc.incident_reference}</strong>
                      <span className="badge badge-red">
                        {inc.severity} • {inc.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                      {inc.description}
                    </div>
                    {inc.operator_explanation ? (
                      <div style={{ fontSize: '0.78rem', color: 'var(--primary-dark)', marginTop: '0.3rem' }}>
                        <strong>Explanation Sent:</strong> {inc.operator_explanation}
                      </div>
                    ) : (
                      <button
                        className="btn btn-primary"
                        style={{ marginTop: '0.4rem', fontSize: '0.75rem' }}
                        onClick={() => handleOperatorIncidentExplain(inc.id)}
                      >
                        Submit Incident Resolution Explanation
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'op-profile' && operatorProfile && (
            <div className="card card-padded" style={{ maxWidth: '640px' }}>
              <h3>⚙️ Operator B2B Profile & Emergency Contact Settings</h3>
              <form
                onSubmit={handleUpdateOperatorProfile}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.5rem' }}
              >
                <div className="filter-group">
                  <label>Business / Community Name</label>
                  <input
                    className="input"
                    value={operatorProfile.business_name || ''}
                    onChange={(e) =>
                      setOperatorProfile({ ...operatorProfile, business_name: e.target.value })
                    }
                  />
                </div>
                <div className="filter-group">
                  <label>Tagline</label>
                  <input
                    className="input"
                    value={operatorProfile.tagline || ''}
                    onChange={(e) =>
                      setOperatorProfile({ ...operatorProfile, tagline: e.target.value })
                    }
                  />
                </div>
                <div className="filter-group">
                  <label>Instagram Handle</label>
                  <input
                    className="input"
                    value={operatorProfile.instagram_handle || ''}
                    onChange={(e) =>
                      setOperatorProfile({ ...operatorProfile, instagram_handle: e.target.value })
                    }
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div className="filter-group">
                    <label>Support Phone</label>
                    <input
                      className="input"
                      value={operatorProfile.support_phone || ''}
                      onChange={(e) =>
                        setOperatorProfile({ ...operatorProfile, support_phone: e.target.value })
                      }
                    />
                  </div>
                  <div className="filter-group">
                    <label>24x7 Emergency Phone</label>
                    <input
                      className="input"
                      value={operatorProfile.emergency_contact_phone || ''}
                      onChange={(e) =>
                        setOperatorProfile({
                          ...operatorProfile,
                          emergency_contact_phone: e.target.value
                        })
                      }
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary">
                  Save Operator Profile
                </button>
              </form>
            </div>
          )}
        </main>
      )}

      {/* ======================================================================
          PORTAL 3: ADMIN GOVERNANCE, KYC & ESCROW CONSOLE UI (user.role === 'ADMIN')
         ====================================================================== */}
      {user.role === 'ADMIN' && (
        <main className="container">
          <section className="hero-banner hero-admin">
            <div>
              <div className="hero-eyebrow">
                🏛️ Platform Admin Governance Console • {user.full_name}
              </div>
              <h1>Marketplace Unit Economics, Operator KYC Audit & Escrow Release</h1>
              <p>
                Verify GST/PAN operator applications, monitor contribution margin per booking,
                investigate active safety incidents, and settle operator escrow payouts via Bank UTR.
              </p>
            </div>
          </section>

          {unitEconomics && (
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-label">Confirmed Marketplace GMV</div>
                <div className="stat-value">
                  ₹
                  {Number(unitEconomics.gmv_and_revenue.confirmed_gmv_inr).toLocaleString('en-IN')}
                </div>
                <div className="price-sub">
                  Active Confirmed Bookings:{' '}
                  {unitEconomics.bookings_overview.active_confirmed_bookings}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Gross Platform Commission (10%)</div>
                <div className="stat-value" style={{ color: 'var(--primary-dark)' }}>
                  ₹
                  {Number(
                    unitEconomics.gmv_and_revenue.gross_platform_commission_inr
                  ).toLocaleString('en-IN')}
                </div>
                <div className="price-sub">
                  Gateway Fees: ₹
                  {Number(unitEconomics.gmv_and_revenue.payment_gateway_fees_inr).toLocaleString(
                    'en-IN'
                  )}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Net Contribution Margin</div>
                <div className="stat-value" style={{ color: 'var(--success)' }}>
                  ₹
                  {Number(
                    unitEconomics.gmv_and_revenue.net_contribution_before_cac_inr
                  ).toLocaleString('en-IN')}
                </div>
                <div className="price-sub">
                  Avg Contribution / Booking: ₹
                  {Number(
                    unitEconomics.per_booking_unit_economics.avg_contribution_per_booking_inr
                  ).toLocaleString('en-IN')}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Refunds Processed</div>
                <div className="stat-value">
                  ₹
                  {Number(unitEconomics.refunds_summary.total_refund_amount_inr).toLocaleString(
                    'en-IN'
                  )}
                </div>
                <div className="price-sub">
                  Across {unitEconomics.refunds_summary.total_refund_records} refund record(s)
                </div>
              </div>
            </div>
          )}

          {activeTab === 'admin-economics' && unitEconomics && (
            <div className="card card-padded">
              <h3>💰 Per-Booking Unit Economics & Contribution Margin Breakdown</h3>
              <div className="grid-3" style={{ marginTop: '0.75rem' }}>
                <div className="confidence-box">
                  <strong>Average Booking Value (AOV)</strong>
                  <div className="price-tag" style={{ marginTop: '0.25rem' }}>
                    ₹
                    {Number(
                      unitEconomics.per_booking_unit_economics.avg_booking_value_inr
                    ).toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="confidence-box">
                  <strong>Average Commission Earned / Booking</strong>
                  <div className="price-tag" style={{ marginTop: '0.25rem' }}>
                    ₹
                    {Number(
                      unitEconomics.per_booking_unit_economics.avg_commission_per_booking_inr
                    ).toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="confidence-box">
                  <strong>Net Operator Payout Liability</strong>
                  <div className="price-tag" style={{ marginTop: '0.25rem' }}>
                    ₹
                    {Number(
                      unitEconomics.gmv_and_revenue.net_operator_payout_liability_inr
                    ).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'admin-kyc' && (
            <div className="card card-padded">
              <h3 style={{ marginBottom: '0.75rem' }}>
                ✅ Operator KYC Verification & Audit Logs ({allOperatorsAdmin.length})
              </h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Operator</th>
                      <th>City & Type</th>
                      <th>KYC Status</th>
                      <th>Rating & Completed Trips</th>
                      <th>Admin KYC Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allOperatorsAdmin.map((op) => (
                      <tr key={op.id}>
                        <td>
                          <strong>{op.business_name}</strong>
                          <div className="price-sub">{op.instagram_handle}</div>
                        </td>
                        <td>
                          {op.base_city} • {op.operator_type}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              op.kyc_status === 'VERIFIED' ? 'badge-green' : 'badge-amber'
                            }`}
                          >
                            {op.kyc_status}
                          </span>
                        </td>
                        <td>
                          {op.rating_avg} ★ ({op.total_completed_trips} trips)
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {op.kyc_status !== 'VERIFIED' && (
                              <button
                                className="btn btn-primary"
                                onClick={() => handleAdminVerifyKyc(op.id, 'VERIFIED')}
                              >
                                ✓ Approve KYC
                              </button>
                            )}
                            <button
                              className="btn btn-outline"
                              onClick={() => handleViewKycLogs(op.id)}
                            >
                              📜 Audit Logs
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'admin-escrow' && (
            <div className="card card-padded">
              <h3>🏦 Operator Escrow Payout Ledger ({adminPayouts?.count || 0})</h3>
              <div className="grid-3" style={{ marginTop: '0.75rem' }}>
                {(adminPayouts?.payouts || []).map((pay) => (
                  <div className="confidence-box" key={pay.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>
                        ₹{Number(pay.net_operator_payable).toLocaleString('en-IN')}
                      </strong>
                      <span
                        className={`badge ${
                          pay.payout_status === 'SETTLED' ? 'badge-green' : 'badge-amber'
                        }`}
                      >
                        {pay.payout_status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      Booking: {pay.booking_reference} • {pay.trip_title}
                    </div>
                    {pay.payout_status === 'ESCROW_HELD' && (
                      <button
                        className="btn btn-primary"
                        style={{ marginTop: '0.45rem', fontSize: '0.76rem' }}
                        onClick={() => handleAdminSettlePayout(pay.id)}
                      >
                        🏦 Settle Escrow via Bank UTR
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'admin-incidents' && (
            <div className="card card-padded">
              <h3>🚨 Active Safety Incidents & Escrow Freeze ({adminIncidents.length})</h3>
              <div className="grid-3" style={{ marginTop: '0.75rem' }}>
                {adminIncidents.map((inc) => (
                  <div className="confidence-box" key={inc.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{inc.incident_reference}</strong>
                      <span className="badge badge-red">
                        {inc.severity} • {inc.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', margin: '0.25rem 0' }}>
                      {inc.description}
                    </div>
                    {inc.status !== 'RESOLVED_NO_FAULT' && (
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: '0.76rem' }}
                        onClick={() => handleAdminResolveIncident(inc.id)}
                      >
                        ✓ Resolve & Unfreeze Escrow
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      )}

      {/* ======================================================================
          SHARED MODALS
         ====================================================================== */}
      {compareData && (
        <div className="modal-backdrop" onClick={() => setCompareData(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>⚖️ Side-by-Side Package Comparison ({compareData.compared_count} Trips)</h2>
              </div>
              <button className="btn btn-outline" onClick={() => setCompareData(null)}>
                ✕ Close
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Feature</th>
                    {(compareData.comparison || []).map((item) => (
                      <th key={item.trip_id}>{item.title}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>Operator & Trust</strong>
                    </td>
                    {(compareData.comparison || []).map((item) => (
                      <td key={item.trip_id}>
                        <strong>{item.operator_trust?.name}</strong> (
                        {item.operator_trust?.rating_avg} ★)
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>
                      <strong>Route & Duration</strong>
                    </td>
                    {(compareData.comparison || []).map((item) => (
                      <td key={item.trip_id}>
                        {item.route} ({item.duration?.label})
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>
                      <strong>Pricing & Token</strong>
                    </td>
                    {(compareData.comparison || []).map((item) => (
                      <td key={item.trip_id}>
                        <strong>
                          ₹{Number(item.pricing?.next_batch_price).toLocaleString('en-IN')}
                        </strong>
                        <div className="price-sub">
                          {item.pricing?.token_booking_amount
                            ? `Token: ₹${Number(item.pricing.token_booking_amount).toLocaleString('en-IN')}`
                            : 'Full Payment'}
                        </div>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>
                      <strong>Departure Confidence</strong>
                    </td>
                    {(compareData.comparison || []).map((item) => (
                      <td key={item.trip_id}>
                        {item.next_departure_confidence
                          ? item.next_departure_confidence.confidence_badge
                          : 'Flexible Private Dates'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tripDetail && (
        <div className="modal-backdrop" onClick={() => setTripDetail(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="badge-row" style={{ marginBottom: '0.4rem' }}>
                  <span className="badge badge-teal">
                    {formatCategoryLabel(tripDetail.trip?.trip_category)}
                  </span>
                  <span className="badge badge-green">
                    ✓ {tripDetail.trip?.operator_name} ({tripDetail.trip?.operator_rating} ★)
                  </span>
                  {tripCompatCheck?.compatibility && (
                    <span className="badge badge-amber">
                      🎯 Your Vibe Match:{' '}
                      {tripCompatCheck.compatibility.match_score_percentage}%
                    </span>
                  )}
                </div>
                <h2>{tripDetail.trip?.title}</h2>
                <p style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
                  📍 {tripDetail.trip?.origin_city} → {tripDetail.trip?.destination_city} •{' '}
                  {tripDetail.trip?.duration_days}D / {tripDetail.trip?.duration_nights}N
                </p>
              </div>
              <button className="btn btn-outline" onClick={() => setTripDetail(null)}>
                ✕ Close
              </button>
            </div>

            <p style={{ marginBottom: '1rem', fontSize: '0.92rem' }}>
              {tripDetail.trip?.overview}
            </p>

            {groupInsights && (
              <div
                className="confidence-box"
                style={{ marginBottom: '1.15rem', background: '#f0fdf4' }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.35rem'
                  }}
                >
                  <strong style={{ color: 'var(--primary-dark)' }}>
                    👥 Who&apos;s In This Batch?
                  </strong>
                  {tripDetail.departures?.[0] && (
                    <button
                      className="btn btn-outline"
                      style={{ fontSize: '0.75rem', padding: '0.28rem 0.65rem' }}
                      onClick={() => handleWatchDeparture(tripDetail.departures[0].id)}
                    >
                      🔔 Watch Batch / Join Waitlist
                    </button>
                  )}
                </div>
                <p style={{ fontSize: '0.86rem' }}>
                  <strong>{groupInsights.privacy_safe_headline}</strong>
                </p>
              </div>
            )}

            {tripDetail.itineraries && tripDetail.itineraries.length > 0 && (
              <div style={{ marginBottom: '1.15rem' }}>
                <h4 style={{ marginBottom: '0.5rem' }}>🗓️ Day-by-Day Verified Itinerary</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {tripDetail.itineraries.map((day) => (
                    <div className="confidence-box" key={day.day_number}>
                      <strong>
                        Day {day.day_number}: {day.title}
                      </strong>{' '}
                      {day.meals_included && (
                        <span className="badge badge-amber">🍽️ {day.meals_included}</span>
                      )}
                      <div style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                        {day.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tripDetail.departures && tripDetail.departures.length > 0 && (
              <div
                className="confidence-box"
                style={{
                  border: '2px solid var(--primary)',
                  background: '#f8fafc',
                  marginBottom: '1rem'
                }}
              >
                <h4 style={{ marginBottom: '0.6rem' }}>
                  🔒 Lock Your Seat with Atomic Inventory Protection & Escrow Checkout
                </h4>
                <div className="filter-bar" style={{ marginBottom: '0.6rem' }}>
                  <div className="filter-group">
                    <label>Select Seats</label>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      className="input"
                      value={bookingSeats}
                      onChange={(e) => setBookingSeats(e.target.value)}
                    />
                  </div>
                  <div className="filter-group">
                    <label>Payment Option</label>
                    <select
                      className="select"
                      value={paymentPlan}
                      onChange={(e) => setPaymentPlan(e.target.value)}
                    >
                      {tripDetail.departures[0].token_amount && (
                        <option value="TOKEN">
                          Token Deposit (₹
                          {Number(tripDetail.departures[0].token_amount).toLocaleString('en-IN')} /
                          seat)
                        </option>
                      )}
                      <option value="FULL">
                        Full Package (₹
                        {Number(tripDetail.departures[0].price_per_person).toLocaleString('en-IN')}{' '}
                        / seat)
                      </option>
                    </select>
                  </div>
                  {tripDetail.trip?.trip_category === 'BIKE_CAR_EXPEDITION' && (
                    <div className="filter-group">
                      <label>Driving License Number (Required)</label>
                      <input
                        type="text"
                        className="input"
                        value={drivingLicense}
                        onChange={(e) => setDrivingLicense(e.target.value)}
                      />
                    </div>
                  )}
                  <button
                    className="btn btn-primary"
                    disabled={bookingBusy}
                    onClick={() =>
                      handleBookAndPay(
                        tripDetail.departures[0].id,
                        tripDetail.trip?.trip_category
                      )
                    }
                  >
                    {bookingBusy ? 'Processing Checkout...' : '⚡ Confirm & Pay Now'}
                  </button>
                </div>
              </div>
            )}

            <div className="confidence-box">
              <h4 style={{ marginBottom: '0.5rem' }}>
                ✨ Request Custom Private Group Quote
              </h4>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <input
                  type="number"
                  className="input"
                  style={{ width: '110px' }}
                  value={enquiryGroupSize}
                  onChange={(e) => setEnquiryGroupSize(e.target.value)}
                />
                <input
                  type="text"
                  className="input"
                  style={{ flex: 1 }}
                  value={enquiryNotes}
                  onChange={(e) => setEnquiryNotes(e.target.value)}
                />
                <button
                  className="btn btn-outline"
                  onClick={() =>
                    handleCreateEnquiry(
                      tripDetail.trip?.id,
                      tripDetail.trip?.origin_city,
                      tripDetail.trip?.base_price
                    )
                  }
                >
                  Send Custom Enquiry →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {bookingDetailModal && (
        <div className="modal-backdrop" onClick={() => setBookingDetailModal(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: '640px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>🎟️ Booking Details: {bookingDetailModal.booking?.booking_reference}</h3>
              <button className="btn btn-outline" onClick={() => setBookingDetailModal(null)}>
                ✕
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Passenger Name</th>
                    <th>Age / Gender</th>
                    <th>ID / Driving License</th>
                    <th>Emergency Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {(bookingDetailModal.participants || []).map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.full_name}</strong>
                      </td>
                      <td>
                        {p.age} / {p.gender}
                      </td>
                      <td>
                        {p.id_proof_type} {p.driving_license_number || ''}
                      </td>
                      <td>
                        {p.emergency_contact_name} ({p.emergency_contact_phone})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {refundPreview && (
        <div className="modal-backdrop" onClick={() => setRefundPreview(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: '540px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>⚖️ Automated Policy Refund Calculator</h3>
              <button className="btn btn-outline" onClick={() => setRefundPreview(null)}>
                ✕
              </button>
            </div>
            <div className="confidence-box" style={{ marginBottom: '1rem' }}>
              <p>
                <strong>Booking Ref:</strong> {refundPreview.booking_reference}
              </p>
              <p>
                <strong>Days Before Departure:</strong>{' '}
                {refundPreview.refund_calculation?.days_before_departure} days
              </p>
              <p>
                <strong>Applied Policy Tier:</strong>{' '}
                {refundPreview.refund_calculation?.policy_tier_applied}
              </p>
              <p style={{ marginTop: '0.5rem', fontSize: '1.05rem', color: 'var(--primary-dark)' }}>
                <strong>Eligible Refund Amount:</strong> ₹
                {Number(refundPreview.refund_calculation?.refund_amount || 0).toLocaleString(
                  'en-IN'
                )}{' '}
                ({refundPreview.refund_calculation?.refund_percentage}%)
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button className="btn btn-outline" onClick={() => setRefundPreview(null)}>
                Keep Booking
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleConfirmCancel(refundPreview.booking_reference)}
              >
                Confirm Cancellation & Release Seats
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewModalBooking && (
        <div className="modal-backdrop" onClick={() => setReviewModalBooking(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: '540px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>⭐ Submit Verified Review ({reviewModalBooking.booking_reference})</h3>
              <button className="btn btn-outline" onClick={() => setReviewModalBooking(null)}>
                ✕
              </button>
            </div>
            <form
              onSubmit={handleSubmitReview}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
            >
              <div className="filter-group">
                <label>Overall Rating (1–5)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  className="input"
                  value={reviewForm.overall_rating}
                  onChange={(e) =>
                    setReviewForm({ ...reviewForm, overall_rating: e.target.value })
                  }
                />
              </div>
              <div className="filter-group">
                <label>Review Headline</label>
                <input
                  className="input"
                  value={reviewForm.review_title}
                  onChange={(e) => setReviewForm({ ...reviewForm, review_title: e.target.value })}
                />
              </div>
              <div className="filter-group">
                <label>Detailed Experience Review</label>
                <input
                  className="input"
                  value={reviewForm.review_text}
                  onChange={(e) => setReviewForm({ ...reviewForm, review_text: e.target.value })}
                />
              </div>
              <button type="submit" className="btn btn-primary">
                Publish Verified Review
              </button>
            </form>
          </div>
        </div>
      )}

      {incidentModalBooking && (
        <div className="modal-backdrop" onClick={() => setIncidentModalBooking(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: '540px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>🚨 Report Safety / Quality Incident ({incidentModalBooking.booking_reference})</h3>
              <button className="btn btn-outline" onClick={() => setIncidentModalBooking(null)}>
                ✕
              </button>
            </div>
            <form
              onSubmit={handleReportIncident}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
            >
              <div className="filter-group">
                <label>Incident Category</label>
                <select
                  className="select"
                  value={incidentForm.incident_category}
                  onChange={(e) =>
                    setIncidentForm({ ...incidentForm, incident_category: e.target.value })
                  }
                >
                  <option value="SUBSTANDARD_ACCOMMODATION">Substandard Accommodation</option>
                  <option value="ITINERARY_DEVIATION">Major Itinerary Deviation</option>
                  <option value="VEHICLE_BREAKDOWN_OR_SAFETY">Vehicle / Road Safety Issue</option>
                  <option value="CAPTAIN_MISCONDUCT">Group / Captain Misconduct</option>
                  <option value="MEDICAL_OR_SOS_EMERGENCY">Medical / SOS Emergency</option>
                </select>
              </div>
              <div className="filter-group">
                <label>Severity (HIGH / CRITICAL automatically freezes Operator Escrow)</label>
                <select
                  className="select"
                  value={incidentForm.severity}
                  onChange={(e) => setIncidentForm({ ...incidentForm, severity: e.target.value })}
                >
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH (Freezes Operator Escrow Payout)</option>
                  <option value="CRITICAL_SOS">CRITICAL SOS (Immediate Escalation)</option>
                </select>
              </div>
              <div className="filter-group">
                <label>Description</label>
                <input
                  className="input"
                  value={incidentForm.description}
                  onChange={(e) =>
                    setIncidentForm({ ...incidentForm, description: e.target.value })
                  }
                />
              </div>
              <button type="submit" className="btn btn-danger">
                Submit Incident & Freeze Escrow
              </button>
            </form>
          </div>
        </div>
      )}

      {showOnboardModal && (
        <div className="modal-backdrop" onClick={() => setShowOnboardModal(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '560px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>🚀 Become a KYC-Verified Operator on TrailSync</h3>
              <button className="btn btn-outline" onClick={() => setShowOnboardModal(false)}>
                ✕
              </button>
            </div>
            <form
              onSubmit={handleOnboardOperator}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
            >
              <div className="filter-group">
                <label>Business / Community Name</label>
                <input
                  className="input"
                  value={onboardForm.business_name}
                  onChange={(e) =>
                    setOnboardForm({ ...onboardForm, business_name: e.target.value })
                  }
                />
              </div>
              <div className="filter-group">
                <label>Base City</label>
                <input
                  className="input"
                  value={onboardForm.base_city}
                  onChange={(e) => setOnboardForm({ ...onboardForm, base_city: e.target.value })}
                />
              </div>
              <div className="filter-group">
                <label>Instagram Handle</label>
                <input
                  className="input"
                  value={onboardForm.instagram_handle}
                  onChange={(e) =>
                    setOnboardForm({ ...onboardForm, instagram_handle: e.target.value })
                  }
                />
              </div>
              <button type="submit" className="btn btn-primary">
                Submit KYC Onboarding Application
              </button>
            </form>
          </div>
        </div>
      )}

      {showCreateTripModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateTripModal(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '580px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>📦 Create New Trip Package + Default Batch</h3>
              <button className="btn btn-outline" onClick={() => setShowCreateTripModal(false)}>
                ✕
              </button>
            </div>
            <form
              onSubmit={handleCreateTripByOperator}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
            >
              <div className="filter-group">
                <label>Trip Title</label>
                <input
                  className="input"
                  value={newTripForm.title}
                  onChange={(e) => setNewTripForm({ ...newTripForm, title: e.target.value })}
                />
              </div>
              <div className="filter-group">
                <label>Category</label>
                <select
                  className="select"
                  value={newTripForm.trip_category}
                  onChange={(e) =>
                    setNewTripForm({ ...newTripForm, trip_category: e.target.value })
                  }
                >
                  <option value="STRANGER_GROUP">STRANGER_GROUP</option>
                  <option value="BIKE_CAR_EXPEDITION">BIKE_CAR_EXPEDITION</option>
                  <option value="WEEKEND_NICHE">WEEKEND_NICHE</option>
                  <option value="PRIVATE_CUSTOM">PRIVATE_CUSTOM</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <div className="filter-group">
                  <label>Origin City</label>
                  <input
                    className="input"
                    value={newTripForm.origin_city}
                    onChange={(e) =>
                      setNewTripForm({ ...newTripForm, origin_city: e.target.value })
                    }
                  />
                </div>
                <div className="filter-group">
                  <label>Destination City</label>
                  <input
                    className="input"
                    value={newTripForm.destination_city}
                    onChange={(e) =>
                      setNewTripForm({ ...newTripForm, destination_city: e.target.value })
                    }
                  />
                </div>
                <div className="filter-group">
                  <label>Base Price (₹)</label>
                  <input
                    type="number"
                    className="input"
                    value={newTripForm.base_price}
                    onChange={(e) =>
                      setNewTripForm({ ...newTripForm, base_price: e.target.value })
                    }
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary">
                Publish Trip, Itinerary & First Batch
              </button>
            </form>
          </div>
        </div>
      )}

      {manifestModal && (
        <div className="modal-backdrop" onClick={() => setManifestModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>📋 Participant Manifest: {manifestModal.departure?.trip_title}</h3>
                <p style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>
                  Batch: {manifestModal.departure?.batch_code} • Occupied Seats:{' '}
                  {manifestModal.departure?.confidence_metrics?.total_occupied_seats} /{' '}
                  {manifestModal.departure?.total_seats}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={() =>
                    handleDownloadCsvManifest(
                      manifestModal.departure?.id,
                      manifestModal.departure?.batch_code
                    )
                  }
                >
                  ⬇ Download CSV
                </button>
                <button className="btn btn-outline" onClick={() => setManifestModal(null)}>
                  ✕ Close
                </button>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Booking Ref</th>
                    <th>Participant Name</th>
                    <th>Age / Gender</th>
                    <th>Phone</th>
                    <th>Emergency Contact</th>
                    <th>Booking Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(manifestModal.participants || []).map((p, idx) => (
                    <tr key={idx}>
                      <td>{p.booking_reference}</td>
                      <td>
                        <strong>{p.full_name}</strong>
                      </td>
                      <td>
                        {p.age} / {p.gender}
                      </td>
                      <td>{p.phone}</td>
                      <td>
                        {p.emergency_contact_name} ({p.emergency_contact_phone})
                      </td>
                      <td>
                        <span className="badge badge-green">{p.booking_status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {waitlistModal && (
        <div className="modal-backdrop" onClick={() => setWaitlistModal(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: '620px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>🔔 Interested / Waitlisted Travelers ({waitlistModal.batch_code})</h3>
              <button className="btn btn-outline" onClick={() => setWaitlistModal(null)}>
                ✕
              </button>
            </div>
            {(waitlistModal.waitlist || []).map((w) => (
              <div className="confidence-box" key={w.id} style={{ marginBottom: '0.5rem' }}>
                <strong>{w.traveler_name}</strong> ({w.traveler_phone}) — {w.seats_interested}{' '}
                seat(s) • {w.interest_type}
              </div>
            ))}
          </div>
        </div>
      )}

      {kycLogsModal && (
        <div className="modal-backdrop" onClick={() => setKycLogsModal(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: '600px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>📜 KYC Verification Audit Trail (Operator #{kycLogsModal.operatorId})</h3>
              <button className="btn btn-outline" onClick={() => setKycLogsModal(null)}>
                ✕
              </button>
            </div>
            {(kycLogsModal.logs || []).map((log) => (
              <div className="confidence-box" key={log.id} style={{ marginBottom: '0.5rem' }}>
                <strong>
                  {log.previous_status} → {log.new_status}
                </strong>{' '}
                by {log.admin_name}
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{log.remarks}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
