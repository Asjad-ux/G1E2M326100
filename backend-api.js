(function () {
  const configuredBase = typeof window.CPCL_API_URL === 'string' ? window.CPCL_API_URL.trim() : '';
  const API_BASE_URL = configuredBase && !configuredBase.startsWith('%VITE_')
    ? configuredBase.replace(/\/+$/, '')
    : '';
  const ACCESS = 'cpcl_access_token';
  const REFRESH = 'cpcl_refresh_token';
  const USER = 'cpcl_user';
  const store = { get access() { return localStorage.getItem(ACCESS); }, get refresh() { return localStorage.getItem(REFRESH); }, get user() { try { return JSON.parse(localStorage.getItem(USER) || 'null'); } catch { return null; } }, save(data) { localStorage.setItem(ACCESS, data.accessToken); localStorage.setItem(REFRESH, data.refreshToken); localStorage.setItem(USER, JSON.stringify(data.user)); }, clear() { localStorage.removeItem(ACCESS); localStorage.removeItem(REFRESH); localStorage.removeItem(USER); } };
  function logHttp(path, method, response, headers, phase) { console.info(`[CPCL API] ${method} ${path} -> HTTP ${response.status}`, { authorizationAttached: headers.has('Authorization'), accessTokenExists: Boolean(store.access), phase }); }
  async function parse(response) { const body = await response.json().catch(() => ({})); if (!response.ok) { const error = new Error(body.message || 'The request could not be completed.'); error.status = response.status; error.details = Array.isArray(body.errors) ? body.errors : []; throw error; } return body; }
  let refreshing = null;
  async function refresh() {
    if (!store.refresh) return { ok: false, authFailure: false };
    if (!refreshing) refreshing = (async () => {
      const headers = new Headers({ 'Content-Type': 'application/json' });
      try {
        const response = await fetch(API_BASE_URL + '/api/auth/refresh', { method: 'POST', headers, body: JSON.stringify({ refreshToken: store.refresh }) });
        logHttp('/api/auth/refresh', 'POST', response, headers, 'refresh');
        if (!response.ok) { const authFailure = response.status === 401 || response.status === 403; if (authFailure) store.clear(); return { ok: false, authFailure }; }
        const body = await parse(response); store.save(body.data); return { ok: true, authFailure: false };
      } catch { return { ok: false, authFailure: false }; }
    })().finally(() => { refreshing = null; });
    return refreshing;
  }
  async function request(path, options, retry) { options = options || {}; retry = retry !== false; const method = options.method || 'GET'; const headers = new Headers(options.headers || {}); const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData; if (options.body && !isFormData && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json'); if (store.access) headers.set('Authorization', 'Bearer ' + store.access); let response = await fetch(API_BASE_URL + path, Object.assign({}, options, { headers })); logHttp(path, method, response, headers, 'initial'); if (response.status === 401 && retry) { const refreshed = await refresh(); if (refreshed.ok) { headers.set('Authorization', 'Bearer ' + store.access); response = await fetch(API_BASE_URL + path, Object.assign({}, options, { headers })); logHttp(path, method, response, headers, 'retry'); } else if (refreshed.authFailure) window.dispatchEvent(new CustomEvent('cpcl:auth-expired')); } return parse(response); }
  async function requestBlob(path, retry) {
    retry = retry !== false;
    const headers = new Headers();
    if (store.access) headers.set('Authorization', 'Bearer ' + store.access);
    let response = await fetch(API_BASE_URL + path, { headers, redirect: 'manual' });
    logHttp(path, 'GET', response, headers, 'document-endpoint');
    if (response.status === 401 && retry) {
      const refreshed = await refresh();
      if (refreshed.ok) { headers.set('Authorization', 'Bearer ' + store.access); response = await fetch(API_BASE_URL + path, { headers, redirect: 'manual' }); logHttp(path, 'GET', response, headers, 'document-retry'); }
      else if (refreshed.authFailure) window.dispatchEvent(new CustomEvent('cpcl:auth-expired'));
    }
    let deliveryResponse = response;
    const location = response.headers.get('Location');
    if ([301, 302, 303, 307, 308].includes(response.status) && location) { deliveryResponse = await fetch(location, { redirect: 'follow' }); logHttp(path, 'GET', deliveryResponse, new Headers(), 'cloudinary-delivery'); }
    if (!deliveryResponse.ok) { const body = await deliveryResponse.json().catch(() => ({})); const error = new Error(body.message || body.error?.message || `The document could not be opened (HTTP ${deliveryResponse.status}).`); error.status = deliveryResponse.status; throw error; }
    return { blob: await deliveryResponse.blob(), fileName: deliveryResponse.headers.get('Content-Disposition') || 'document' };
  }
  const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body || {}) });
  const patch = (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body || {}) });
  function documentForm(data) { const form = new FormData(); if (data.documentType) form.append('documentType', data.documentType); if (data.documentName) form.append('documentName', data.documentName); if (data.requirementId) form.append('requirementId', data.requirementId); if (data.file) form.append('file', data.file, data.file.name); return form; }
  function tenderDocumentForm(data) { const form = new FormData(); if (data.file) form.append('file', data.file, data.file.name); return form; }
  window.CPCLApi = { store, request, requestBlob, auth: { login: (email, password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, false), registerOfficer: data => post('/api/auth/register/officer', data), registerBidder: data => post('/api/auth/register/bidder', data), sendEmail: email => post('/api/auth/otp/email/send', { email }), verifyEmail: (email, code) => post('/api/auth/otp/email/verify', { email, code }), forgot: email => post('/api/auth/forgot-password', { email }), reset: (token, password) => post('/api/auth/reset-password', { token, password }), logout: async () => { if (store.refresh) await post('/api/auth/logout', { refreshToken: store.refresh }).catch(() => {}); store.clear(); } }, officer: { tenders: () => request('/api/officer/tenders'), tender: id => request('/api/officer/tenders/' + encodeURIComponent(id)), createTender: data => post('/api/officer/tenders', data), updateTender: (id, data) => patch('/api/officer/tenders/' + encodeURIComponent(id), data), publish: id => post('/api/officer/tenders/' + encodeURIComponent(id) + '/publish'), close: id => post('/api/officer/tenders/' + encodeURIComponent(id) + '/close'), addRequirement: (id, data) => post('/api/officer/tenders/' + encodeURIComponent(id) + '/requirements', data), updateRequirement: (id, data) => patch('/api/officer/requirements/' + encodeURIComponent(id), data), deleteRequirement: id => request('/api/officer/requirements/' + encodeURIComponent(id), { method: 'DELETE' }), applications: id => request('/api/officer/tenders/' + encodeURIComponent(id) + '/applications'), application: id => request('/api/officer/applications/' + encodeURIComponent(id)), accept: id => post('/api/officer/applications/' + encodeURIComponent(id) + '/accept'), reject: (id, reason) => post('/api/officer/applications/' + encodeURIComponent(id) + '/reject', { reason }), blacklist: (id, reason) => post('/api/officer/applications/' + encodeURIComponent(id) + '/blacklist', { reason }), documentView: id => requestBlob('/api/officer/documents/' + encodeURIComponent(id) + '/view'), documentDownload: id => requestBlob('/api/officer/documents/' + encodeURIComponent(id) + '/download'), tenderDocuments: id => request('/api/officer/tenders/' + encodeURIComponent(id) + '/documents'), createTenderDocument: (id, data) => request('/api/officer/tenders/' + encodeURIComponent(id) + '/documents', { method: 'POST', body: tenderDocumentForm(data) }), tenderDocumentView: id => requestBlob('/api/officer/tender-documents/' + encodeURIComponent(id) + '/view'), tenderDocumentDownload: id => requestBlob('/api/officer/tender-documents/' + encodeURIComponent(id) + '/download'), deleteTenderDocument: id => request('/api/officer/tender-documents/' + encodeURIComponent(id), { method: 'DELETE' }) }, bidder: { tenders: () => request('/api/bidder/tenders'), tender: id => request('/api/bidder/tenders/' + encodeURIComponent(id)), tenderDocuments: id => request('/api/bidder/tenders/' + encodeURIComponent(id) + '/documents'), tenderDocumentView: id => requestBlob('/api/bidder/tender-documents/' + encodeURIComponent(id) + '/view'), tenderDocumentDownload: id => requestBlob('/api/bidder/tender-documents/' + encodeURIComponent(id) + '/download'), applications: () => request('/api/bidder/applications'), application: id => request('/api/bidder/applications/' + encodeURIComponent(id)), apply: (id, documents) => post('/api/bidder/tenders/' + encodeURIComponent(id) + '/apply', { documents: documents || [] }), documents: () => request('/api/bidder/documents'), createDocument: data => request('/api/bidder/documents', { method: 'POST', body: documentForm(data) }), updateDocument: (id, data) => request('/api/bidder/documents/' + encodeURIComponent(id), { method: 'PATCH', body: documentForm(data) }), documentView: id => requestBlob('/api/bidder/documents/' + encodeURIComponent(id) + '/view'), documentDownload: id => requestBlob('/api/bidder/documents/' + encodeURIComponent(id) + '/download'), deleteDocument: id => request('/api/bidder/documents/' + encodeURIComponent(id), { method: 'DELETE' }), attachDocument: (id, data) => data.file ? request('/api/bidder/applications/' + encodeURIComponent(id) + '/documents', { method: 'POST', body: documentForm(data) }) : post('/api/bidder/applications/' + encodeURIComponent(id) + '/documents', data) }, notifications: { list: () => request('/api/notifications'), read: id => patch('/api/notifications/' + encodeURIComponent(id) + '/read'), readAll: () => post('/api/notifications/read-all') } };
  window.CPCLApi.definitions = () => request('/api/documents/definitions');
  window.CPCLApi.auth.me = () => request('/api/auth/me');
  window.CPCLApi.officer.documentRequests = () => request('/api/officer/document-requests');
  window.CPCLApi.officer.createDocumentRequest = data => post('/api/officer/document-requests', data);
})();
