import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LayoutDashboard, ClipboardList, Menu, AlertTriangle, X, BarChart2, Layers, Settings, FolderOpen, ChevronLeft, Archive as ArchiveIcon, CalendarRange, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';

const ALL_NAV_ITEMS = [
  { name: 'Dashboard', page: 'Dashboard', icon: LayoutDashboard },
  { name: 'Issues', page: 'Issues', icon: ClipboardList },
  { name: 'Production Monitor', page: 'BatchMonitor', icon: Layers },
  { name: 'Analytics', page: 'Analytics', icon: BarChart2 },
  { name: 'Documents', page: 'Documents', icon: FolderOpen },
  { name: 'Archive', page: 'Archive', icon: ArchiveIcon },
  { name: 'Visual Inspection', page: 'VisualInspection', icon: Sparkles },
];

const ALL_BOTTOM_NAV_ITEMS = [
  { name: 'Dashboard', page: 'Dashboard', icon: LayoutDashboard },
  { name: 'Issues', page: 'Issues', icon: ClipboardList },
  { name: 'Monitor', page: 'BatchMonitor', icon: Layers },
  { name: 'Docs', page: 'Documents', icon: FolderOpen },
  { name: 'Archive', page: 'Archive', icon: ArchiveIcon },
];

function parsePerms(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

const OWNER_USERNAME = 'Rares728';

// Default access for new users with no permissions set yet
const DEFAULT_ACCESS = ['Dashboard', 'Issues'];

function hasAccess(user, pageKey) {
  if (!user) return false;
  // Admins and the owner always have full access
  if (user.role === 'admin' || (user.full_name || '').toLowerCase() === OWNER_USERNAME.toLowerCase()) return true;
  const perms = parsePerms(user.page_permissions);
  // No permissions set yet → only default pages
  if (!perms) return DEFAULT_ACCESS.includes(pageKey);
  return !!perms[pageKey];
}

const ROOT_PAGES = ALL_NAV_ITEMS.map(i => i.page);
const isSubPage = (pageName) => !ROOT_PAGES.includes(pageName) || pageName === 'IssueDetail';
const tabHistory = {};

function SidebarContent({ currentPageName, onClose, user }) {
  const navItems = ALL_NAV_ITEMS.filter(item => hasAccess(user, item.page));
  const showProductionMeeting = hasAccess(user, 'ProductionMeeting');
  const showSettings = hasAccess(user, 'Settings');

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="p-5 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Aeronamic Sibiu</p>
            <p className="text-slate-400 text-xs">Machining Shop</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ name, page, icon: Icon }) => (
          <Link
            key={page}
            to={createPageUrl(page)}
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors select-none min-h-[44px] ${
              currentPageName === page
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {name}
          </Link>
        ))}
        {showProductionMeeting && (
          <Link
            to={createPageUrl('ProductionMeeting')}
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors select-none min-h-[44px] ${
              currentPageName === 'ProductionMeeting'
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <CalendarRange className="w-4 h-4 flex-shrink-0" />
            Production Meeting
          </Link>
        )}
      </nav>
      <div className="p-4 border-t border-slate-700">
        {showSettings && (
          <Link
            to={createPageUrl('Settings')}
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors select-none min-h-[44px] ${
              currentPageName === 'Settings'
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            Settings
          </Link>
        )}
        <p className="text-xs text-slate-500 mt-3">AEE AI System - Push limits</p>
      </div>
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const showProductionMeeting = hasAccess(user, 'ProductionMeeting');
  const bottomNavItems = ALL_BOTTOM_NAV_ITEMS.filter(item => hasAccess(user, item.page));

  useEffect(() => {
    const tab = ALL_BOTTOM_NAV_ITEMS.find(t => currentPageName === t.page || location.pathname.includes(t.page));
    if (tab) {
      tabHistory[tab.page] = location.pathname + location.search;
    }
  }, [location, currentPageName]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (e) => { document.documentElement.classList.toggle('dark', e.matches); };
    apply(mq);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      <style>{`
        @media (max-width: 1024px) and (orientation: landscape) {
          .mobile-bottom-nav { padding-bottom: 0 !important; }
          .mobile-bottom-nav a { min-height: 36px !important; padding-top: 4px !important; padding-bottom: 4px !important; }
          .mobile-bottom-nav span.nav-label { display: none !important; }
          .mobile-main { padding-bottom: 40px !important; }
          .mobile-header { padding-top: calc(env(safe-area-inset-top) + 0.3rem) !important; padding-bottom: 0.3rem !important; }
        }
      `}</style>
      <aside className="hidden lg:flex w-56 flex-shrink-0 flex-col overscroll-none overflow-auto">
        <SidebarContent currentPageName={currentPageName} user={user} />
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-50 lg:hidden flex"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
            <motion.aside
              className="relative w-64 flex-shrink-0"
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: 'tween', duration: 0.22 }}
            >
              <SidebarContent currentPageName={currentPageName} onClose={() => setMobileOpen(false)} user={user} />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col overflow-hidden" style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
        <header
          className="mobile-header lg:hidden flex items-center gap-3 px-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex-shrink-0"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)', paddingBottom: '0.75rem' }}
        >
          {isSubPage(currentPageName) ? (
            <button onClick={() => navigate(-1)} className="text-slate-600 dark:text-slate-300 select-none min-h-[44px] min-w-[44px] flex items-center justify-center">
              <ChevronLeft className="w-6 h-6" />
            </button>
          ) : (
            <button onClick={() => setMobileOpen(true)} className="text-slate-600 dark:text-slate-300 select-none min-h-[44px] min-w-[44px] flex items-center justify-center">
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 select-none">RCCA Tracker</span>
          </div>
        </header>

        <main className="mobile-main flex-1 overflow-auto overscroll-none" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {children}
        </main>
      </div>

      <nav
        className="mobile-bottom-nav lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex select-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {bottomNavItems.map(({ name, page, icon: Icon }) => {
          const isActive = currentPageName === page;
          const savedUrl = tabHistory[page];
          const destUrl = (!isActive && savedUrl) ? savedUrl : createPageUrl(page);
          return (
            <Link
              key={page}
              to={destUrl}
              replace={isActive}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors min-h-[44px] select-none ${
                isActive ? 'text-blue-600' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="nav-label text-[10px] font-medium">{name}</span>
            </Link>
          );
        })}
        {showProductionMeeting && (
          <Link
            to={createPageUrl('ProductionMeeting')}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors min-h-[44px] select-none ${
              currentPageName === 'ProductionMeeting' ? 'text-blue-600' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
            }`}
          >
            <CalendarRange className="w-5 h-5" />
            <span className="nav-label text-[10px] font-medium">Meeting</span>
          </Link>
        )}
      </nav>
    </div>
  );
}