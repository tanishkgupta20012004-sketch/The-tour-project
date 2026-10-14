const API_BASE = '/api/v1';

export async function apiRequest(endpoint, { method = 'GET', body, token, rawText = false } = {}) {
  const headers = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (rawText) {
    const text = await res.text();
    if (!res.ok) {
      throw new Error(text || 'API request failed');
    }
    return text;
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'API request failed');
  }
  return data.data;
}

/**
 * Complete typed SDK mapping all 45 Backend API endpoints across Phases 1–6
 */
export const backendApi = {
  // System Health
  health: () => apiRequest('/health'),

  // Phase 1: Auth & Traveler Vibe Preferences
  auth: {
    sendOtp: (body) => apiRequest('/auth/send-otp', { method: 'POST', body }),
    verifyOtp: (body) => apiRequest('/auth/verify-otp', { method: 'POST', body }),
    register: (body) => apiRequest('/auth/register', { method: 'POST', body }),
    login: (body) => apiRequest('/auth/login', { method: 'POST', body }),
    getMe: (token) => apiRequest('/auth/me', { token }),
    updatePreferences: (token, body) =>
      apiRequest('/auth/me/preferences', { method: 'PUT', token, body })
  },

  // Phase 1 & 3: Operators, KYC Verification & B2B Dashboard
  operators: {
    listPublic: (verifiedOnly = true) =>
      apiRequest(`/operators?verified_only=${verifiedOnly ? 'true' : 'false'}`),
    getBySlug: (slug) => apiRequest(`/operators/${slug}`),
    onboard: (token, body) => apiRequest('/operators/onboard', { method: 'POST', token, body }),
    getMyProfile: (token) => apiRequest('/operators/me/profile', { token }),
    updateMyProfile: (token, body) =>
      apiRequest('/operators/me/profile', { method: 'PUT', token, body }),
    getDashboard: (token) => apiRequest('/operators/me/dashboard', { token }),
    verifyKyc: (token, operatorId, body) =>
      apiRequest(`/operators/${operatorId}/verify`, { method: 'PATCH', token, body }),
    getVerificationLogs: (token, operatorId) =>
      apiRequest(`/operators/${operatorId}/verification-logs`, { token })
  },

  // Phase 2: Trips, Discovery & Side-by-Side Comparison
  trips: {
    discover: (queryString = '') => apiRequest(`/trips${queryString ? `?${queryString}` : ''}`),
    compare: (ids) => apiRequest(`/trips/compare?ids=${ids.join(',')}`),
    getBySlug: (slug) => apiRequest(`/trips/${slug}`),
    getMyOperatorTrips: (token) => apiRequest('/trips/operator/my-trips', { token }),
    create: (token, body) => apiRequest('/trips', { method: 'POST', token, body }),
    update: (token, tripId, body) =>
      apiRequest(`/trips/${tripId}`, { method: 'PUT', token, body }),
    updateStatus: (token, tripId, status) =>
      apiRequest(`/trips/${tripId}/status`, { method: 'PATCH', token, body: { status } }),
    createDeparture: (token, tripId, body) =>
      apiRequest(`/trips/${tripId}/departures`, { method: 'POST', token, body })
  },

  // Phase 2, 3, 4 & 6: Departures, Seat Sync, Manifests, Waitlist & Batch Cancellation
  departures: {
    getById: (id) => apiRequest(`/departures/${id}`),
    getGroupInsights: (id) => apiRequest(`/departures/${id}/group-insights`),
    syncInventory: (token, id, body) =>
      apiRequest(`/departures/${id}/inventory`, { method: 'PATCH', token, body }),
    getManifest: (token, id) => apiRequest(`/departures/${id}/manifest`, { token }),
    downloadManifestCsv: (token, id) =>
      apiRequest(`/departures/${id}/manifest?format=csv`, { token, rawText: true }),
    cancelBatch: (token, id, reason) =>
      apiRequest(`/departures/${id}/cancel-batch`, {
        method: 'POST',
        token,
        body: { reason }
      }),
    registerInterest: (token, id, body) =>
      apiRequest(`/departures/${id}/interest`, { method: 'POST', token, body }),
    getInterestList: (token, id) => apiRequest(`/departures/${id}/interest`, { token })
  },

  // Phase 3 & 4: Bookings, Atomic Locks, Custom Enquiries & Policy Cancellations
  bookings: {
    reserve: (token, body) => apiRequest('/bookings/reserve', { method: 'POST', token, body }),
    getMyBookings: (token) => apiRequest('/bookings/my-bookings', { token }),
    getByReference: (token, reference) => apiRequest(`/bookings/${reference}`, { token }),
    previewCancellation: (token, reference) =>
      apiRequest(`/bookings/${reference}/cancellation-preview`, { token }),
    cancel: (token, reference, reason) =>
      apiRequest(`/bookings/${reference}/cancel`, { method: 'POST', token, body: { reason } }),
    createEnquiry: (token, body) =>
      apiRequest('/bookings/enquiry', { method: 'POST', token, body }),
    getMyEnquiries: (token) => apiRequest('/bookings/my-enquiries', { token }),
    getOperatorBookings: (token) => apiRequest('/bookings/operator/list', { token }),
    confirmManual: (token, bookingId, body) =>
      apiRequest(`/bookings/operator/${bookingId}/confirm-manual`, {
        method: 'PATCH',
        token,
        body
      }),
    getOperatorEnquiries: (token) => apiRequest('/bookings/operator/enquiries', { token }),
    quoteEnquiry: (token, enquiryId, body) =>
      apiRequest(`/bookings/operator/enquiries/${enquiryId}/quote`, {
        method: 'PATCH',
        token,
        body
      })
  },

  // Phase 4: Payments, Escrow Payouts & Marketplace Unit Economics
  payments: {
    createOrder: (token, body) =>
      apiRequest('/payments/create-order', { method: 'POST', token, body }),
    verify: (token, body) => apiRequest('/payments/verify', { method: 'POST', token, body }),
    getMyTransactions: (token) => apiRequest('/payments/my-transactions', { token }),
    getOperatorPayouts: (token) => apiRequest('/payments/operator/payouts', { token }),
    settleOperatorPayout: (token, payoutId, body) =>
      apiRequest(`/payments/admin/payouts/${payoutId}/settle`, {
        method: 'PATCH',
        token,
        body
      }),
    getUnitEconomics: (token) => apiRequest('/payments/admin/unit-economics', { token })
  },

  // Phase 5: Verified Reviews, Composite Trust Score & Safety Incidents
  reviews: {
    getTripReviews: (tripId) => apiRequest(`/reviews/trip/${tripId}`),
    getOperatorTrustAndReviews: (operatorSlug) =>
      apiRequest(`/reviews/operator/${operatorSlug}`),
    createReview: (token, body) => apiRequest('/reviews', { method: 'POST', token, body }),
    replyToReview: (token, reviewId, operator_public_reply) =>
      apiRequest(`/reviews/${reviewId}/reply`, {
        method: 'POST',
        token,
        body: { operator_public_reply }
      }),
    reportIncident: (token, body) =>
      apiRequest('/reviews/incidents', { method: 'POST', token, body }),
    getMyIncidents: (token) => apiRequest('/reviews/incidents/my-reports', { token }),
    getOperatorIncidents: (token) => apiRequest('/reviews/incidents/operator', { token }),
    submitOperatorIncidentExplanation: (token, incidentId, operator_explanation) =>
      apiRequest(`/reviews/incidents/${incidentId}/operator-response`, {
        method: 'PATCH',
        token,
        body: { operator_explanation }
      }),
    resolveIncidentByAdmin: (token, incidentId, body) =>
      apiRequest(`/reviews/incidents/${incidentId}/resolve`, {
        method: 'PATCH',
        token,
        body
      })
  },

  // Phase 6: Compatibility & Group Insights
  compatibility: {
    getGroupInsights: (departureId) =>
      apiRequest(`/compatibility/departures/${departureId}/group-insights`),
    getRecommendations: (token) => apiRequest('/compatibility/recommendations', { token }),
    checkTripCompatibility: (token, tripId) =>
      apiRequest(`/compatibility/trips/${tripId}/check`, { token }),
    upsertTripProfile: (token, tripId, body) =>
      apiRequest(`/compatibility/trips/${tripId}/profile`, {
        method: 'PUT',
        token,
        body
      })
  }
};
