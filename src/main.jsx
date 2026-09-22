import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import { authApi, authStorage, bidderApi, messageFromError, notificationApi, officerApi } from './services/api';

export const AppContext = createContext(null);
export const bidderCompanies = [];
const formatDate = value => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const normalizeRequirement = requirement => ({ ...requirement, type: requirement.required ? 'Mandatory' : 'Optional', note: requirement.description || '' });
const normalizeTender = tender => ({ ...tender, displayId: tender.tenderNumber, department: tender.category, organisation: 'CPCL', location: 'Chennai', value: '—', published: formatDate(tender.startDate), closing: formatDate(tender.closingDate), applications: tender._count?.applications || 0, pending: 0, requirements: (tender.requirements || []).map(normalizeRequirement) });
const normalizeApplication = application => ({ ...application, bidder: application.company?.companyName || 'Unknown company', submitted: formatDate(application.submittedAt), compliance: application.complianceScore ?? 0, risk: application.complianceScore >= 85 ? 'Low' : application.complianceScore >= 70 ? 'Medium' : 'High', status: application.status?.replaceAll('_', ' ') || 'Under Review', updated: formatDate(application.updatedAt || application.submittedAt) });

export function AppProvider({ children }) {
  const [user, setUser] = useState(authStorage.user);
  const [role, setRole] = useState(authStorage.user?.role?.toLowerCase() || null);
  const [tenders, setTenders] = useState([]); const [applications, setApplications] = useState([]); const [documents, setDocuments] = useState([]);
  const [notifications, setNotifications] = useState({ bidder: 0, officer: 0 }); const [notificationItems, setNotificationItems] = useState([]);
  const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [toast, setToast] = useState(null); const [profileComplete, setProfileComplete] = useState(false);
  const notify = (message, tone = 'success') => { setToast({ message, tone }); window.setTimeout(() => setToast(null), 3400); };
  const signIn = session => { authStorage.save(session); setUser(session.user); setRole(session.user.role.toLowerCase()); };
  const signOut = async () => { await authApi.logout(); setUser(null); setRole(null); setTenders([]); setApplications([]); setDocuments([]); setNotificationItems([]); };
  const refreshData = async () => {
    if (!user) return; setLoading(true); setError('');
    try {
      const [tenderResponse, applicationResponse, documentResponse, notificationResponse] = await Promise.all([role === 'officer' ? officerApi.tenders() : bidderApi.tenders(), role === 'officer' ? Promise.resolve({ data: [] }) : bidderApi.applications(), role === 'officer' ? Promise.resolve({ data: [] }) : bidderApi.documents(), notificationApi.list()]);
      setTenders((tenderResponse.data || []).map(normalizeTender)); setApplications((applicationResponse.data || []).map(normalizeApplication)); setDocuments(documentResponse.data || []);
      const items = notificationResponse.data || []; setNotificationItems(items); setNotifications(current => ({ ...current, [role]: items.filter(item => !item.read).length }));
    } catch (requestError) { setError(messageFromError(requestError, 'Unable to load workspace data.')); } finally { setLoading(false); }
  };
  useEffect(() => { refreshData(); }, [user, role]);
  useEffect(() => { const handler = () => { setUser(null); setRole(null); notify('Your session has expired. Please sign in again.', 'danger'); }; window.addEventListener('cpcl:auth-expired', handler); return () => window.removeEventListener('cpcl:auth-expired', handler); }, []);
  const updateApplication = (id, updates) => setApplications(items => items.map(item => item.id === id ? { ...item, ...updates } : item));
  const value = useMemo(() => ({ user, role, signIn, signOut, tenders, applications, documents, notificationItems, notifications, setNotifications, updateApplication, refreshData, loading, error, toast, notify, profileComplete, setProfileComplete }), [user, role, tenders, applications, documents, notificationItems, notifications, loading, error, toast, profileComplete]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export const useApp = () => useContext(AppContext);
export { authApi, bidderApi, officerApi, notificationApi, messageFromError };
createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><AppProvider><App /></AppProvider></BrowserRouter></React.StrictMode>);
