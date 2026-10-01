const API_BASE_URL = import.meta.env.VITE_API_URL;
const ACCESS_KEY = 'cpcl_access_token';
const REFRESH_KEY = 'cpcl_refresh_token';
const USER_KEY = 'cpcl_user';

export const authStorage = {
  get accessToken() { return localStorage.getItem(ACCESS_KEY); },
  get refreshToken() { return localStorage.getItem(REFRESH_KEY); },
  get user() { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } },
  save(session) { localStorage.setItem(ACCESS_KEY, session.accessToken); localStorage.setItem(REFRESH_KEY, session.refreshToken); localStorage.setItem(USER_KEY, JSON.stringify(session.user)); },
  clear() { localStorage.removeItem(ACCESS_KEY); localStorage.removeItem(REFRESH_KEY); localStorage.removeItem(USER_KEY); }
};

async function parseResponse(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(body.message || 'The request could not be completed.'); error.status = response.status; error.details = body.errors || []; throw error; }
  return body;
}

let refreshing = null;
async function refreshAccessToken() {
  if (!authStorage.refreshToken) return false;
  if (!refreshing) refreshing = fetch(`${API_BASE_URL}/api/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: authStorage.refreshToken }) }).then(parseResponse).then(body => { authStorage.save(body.data); return true; }).catch(() => { authStorage.clear(); return false; }).finally(() => { refreshing = null; });
  return refreshing;
}

export async function request(path, options = {}, retry = true) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (authStorage.accessToken) headers.set('Authorization', `Bearer ${authStorage.accessToken}`);
  let response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (response.status === 401 && retry && await refreshAccessToken()) { const retryHeaders = new Headers(options.headers || {}); if (options.body && !(options.body instanceof FormData) && !retryHeaders.has('Content-Type')) retryHeaders.set('Content-Type', 'application/json'); if (authStorage.accessToken) retryHeaders.set('Authorization', `Bearer ${authStorage.accessToken}`); response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: retryHeaders }); }
  if (response.status === 401 && retry) window.dispatchEvent(new CustomEvent('cpcl:auth-expired'));
  return parseResponse(response);
}

const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) });
const patch = (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) });

export const authApi = {
  login: (email, password) => post('/api/auth/login', { email, password }), registerOfficer: data => post('/api/auth/register/officer', data), registerBidder: data => post('/api/auth/register/bidder', data), sendEmailOtp: email => post('/api/auth/otp/email/send', { email }), verifyEmailOtp: (email, code) => post('/api/auth/otp/email/verify', { email, code }), forgotPassword: email => post('/api/auth/forgot-password', { email }), resetPassword: (token, password) => post('/api/auth/reset-password', { token, password }), logout: async () => { if (authStorage.refreshToken) await post('/api/auth/logout', { refreshToken: authStorage.refreshToken }).catch(() => {}); authStorage.clear(); }
};

export const officerApi = {
  tenders: () => request('/api/officer/tenders'), tender: id => request(`/api/officer/tenders/${encodeURIComponent(id)}`), createTender: data => post('/api/officer/tenders', data), updateTender: (id, data) => patch(`/api/officer/tenders/${encodeURIComponent(id)}`, data), publishTender: id => post(`/api/officer/tenders/${encodeURIComponent(id)}/publish`), closeTender: id => post(`/api/officer/tenders/${encodeURIComponent(id)}/close`), addRequirement: (tenderId, data) => post(`/api/officer/tenders/${encodeURIComponent(tenderId)}/requirements`, data), updateRequirement: (id, data) => patch(`/api/officer/requirements/${encodeURIComponent(id)}`, data), deleteRequirement: id => request(`/api/officer/requirements/${encodeURIComponent(id)}`, { method: 'DELETE' }), applications: tenderId => request(`/api/officer/tenders/${encodeURIComponent(tenderId)}/applications`), application: id => request(`/api/officer/applications/${encodeURIComponent(id)}`), accept: id => post(`/api/officer/applications/${encodeURIComponent(id)}/accept`), reject: (id, reason) => post(`/api/officer/applications/${encodeURIComponent(id)}/reject`, { reason }), blacklist: (companyId, reason) => post(`/api/officer/companies/${encodeURIComponent(companyId)}/blacklist`, { reason })
};

export const bidderApi = {
  tenders: () => request('/api/bidder/tenders'), tender: id => request(`/api/bidder/tenders/${encodeURIComponent(id)}`), applications: () => request('/api/bidder/applications'), application: id => request(`/api/bidder/applications/${encodeURIComponent(id)}`), apply: (tenderId, documents = []) => post(`/api/bidder/tenders/${encodeURIComponent(tenderId)}/apply`, { documents }), documents: () => request('/api/bidder/documents'), document: id => request(`/api/bidder/documents/${encodeURIComponent(id)}`), createDocument: data => request('/api/bidder/documents', { method: 'POST', body: data instanceof FormData ? data : JSON.stringify(data) }), updateDocument: (id, data) => patch(`/api/bidder/documents/${encodeURIComponent(id)}`, data), deleteDocument: id => request(`/api/bidder/documents/${encodeURIComponent(id)}`, { method: 'DELETE' }), attachDocument: (applicationId, data) => post(`/api/bidder/applications/${encodeURIComponent(applicationId)}/documents`, data)
};

export const notificationApi = { list: () => request('/api/notifications'), read: id => patch(`/api/notifications/${encodeURIComponent(id)}/read`), readAll: () => post('/api/notifications/read-all') };
export function messageFromError(error, fallback = 'Something went wrong. Please try again.') { if (!error) return fallback; if (error.status === 401) return 'Your session has expired. Please sign in again.'; if (error.status === 403) return error.message || 'You do not have permission for this action.'; if (error.status === 404) return 'The requested record was not found.'; if (error.status === 409) return error.message || 'This record already exists.'; if (error.status >= 500) return 'The server is unavailable. Please try again.'; return error.message || fallback; }
