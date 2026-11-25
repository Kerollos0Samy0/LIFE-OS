import React, { useState } from 'react';
import {
  Activity,
  BarChart3,
  Clock,
  Flame,
  Globe,
  Home,
  Link2,
  Menu,
  Settings,
  Smartphone,
  Sparkles,
  Target,
  Wallet,
  X,
} from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LifeOsProvider, useLifeOs } from './context/LifeOsContext';
import { HomeDashboard } from './components/HomeDashboard';
import { HabitsModule } from './components/HabitsModule';
import { FinanceModule } from './components/FinanceModule';
import { TimeModule } from './components/TimeModule';
import { HealthEnergyModule } from './components/HealthEnergyModule';
import { WellbeingModule } from './components/WellbeingModule';
import { LifeAiModule } from './components/LifeAiModule';
import { GoalsModule } from './components/GoalsModule';
import { ReportsModule } from './components/ReportsModule';
import { ConnectionsSettingsModule } from './components/ConnectionsSettingsModule';
import { VoiceExpenseModal } from './components/VoiceExpenseModal';
import { UI_TEXT } from './i18n/translations';
import type { NavDestination } from './types/lifeos';

const PRIMARY_NAV: Array<{ id: NavDestination; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'home', icon: Home },
  { id: 'habits', icon: Flame },
  { id: 'finance', icon: Wallet },
  { id: 'time', icon: Clock },
  { id: 'health', icon: Activity },
  { id: 'ai', icon: Sparkles },
];

const SECONDARY_NAV: Array<{ id: NavDestination; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'wellbeing', icon: Smartphone },
  { id: 'goals', icon: Target },
  { id: 'reports', icon: BarChart3 },
  { id: 'connections', icon: Link2 },
  { id: 'settings', icon: Settings },
];

function LifeOsShell() {
  const { lang, setLanguage, user, isCloudMode, signInWithGoogle, signOut, syncError } = useLifeOs();
  const [activeNav, setActiveNav] = useState<NavDestination>('home');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);

  const isAr = lang === 'ar';
  const navLabels = UI_TEXT[lang].nav;

  const handleNavigate = (dest: NavDestination) => {
    setActiveNav(dest);
    setDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-dvh bg-[#0B0D10] text-[#F4F6F8] flex">
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:start-0 bg-[#0F1216] border-e border-[#232A33] z-30 no-print">
        <div className="h-16 px-6 flex items-center border-b border-[#232A33]">
          <button
            type="button"
            onClick={() => handleNavigate('home')}
            className="text-lg font-bold tracking-tight text-[#F4F6F8] whitespace-nowrap shrink-0 flex items-center gap-2.5"
          >
            <img src="/logo.png" alt="KYVORA" className="w-8 h-8 rounded-lg shadow-md shrink-0 object-cover" />
            <span className="tracking-wider bg-gradient-to-r from-white via-slate-100 to-amber-200 bg-clip-text text-transparent font-black">
              KYVORA
            </span>
          </button>
        </div>

        <nav aria-label={isAr ? 'القائمة الرئيسية' : 'Main Navigation'} className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          <div className="space-y-1">
            {PRIMARY_NAV.map(({ id, icon: Icon }) => {
              const active = activeNav === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleNavigate(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'text-[#A9B3C1] hover:text-[#F4F6F8] hover:bg-[#171C22]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{navLabels[id]}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-[#1D232C] space-y-1">
            <p className="px-3.5 pb-1.5 text-[11px] font-medium text-[#6C7787]">
              {isAr ? 'الأقسام الإضافية' : 'Workspace Modules'}
            </p>
            {SECONDARY_NAV.map(({ id, icon: Icon }) => {
              const active = activeNav === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleNavigate(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full min-h-[42px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'text-[#A9B3C1] hover:text-[#F4F6F8] hover:bg-[#171C22]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{navLabels[id]}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="p-4 border-t border-[#232A33] space-y-2.5">
          <button
            type="button"
            onClick={() => setLanguage(isAr ? 'en' : 'ar')}
            className="w-full min-h-[40px] px-3.5 rounded-xl bg-[#13171C] border border-[#232A33] text-xs font-medium text-[#D2DAE5] hover:border-emerald-500/50 flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              {isAr ? 'English (LTR)' : 'العربية (RTL)'}
            </span>
            <span className="font-mono-nums text-[#8E99A8]">{lang.toUpperCase()}</span>
          </button>

          {isCloudMode && user ? (
            <div className="flex items-center justify-between gap-2 px-1 text-xs">
              <span className="text-[#A9B3C1] truncate">{user.displayName || user.email}</span>
              <button
                type="button"
                onClick={() => void signOut()}
                className="text-[#8E99A8] hover:text-red-400 whitespace-nowrap shrink-0"
              >
                {UI_TEXT[lang].auth.signOut}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F4F6F8] text-[#0B0D10] hover:bg-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>{UI_TEXT[lang].auth.signInGoogle}</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:ps-64">
        {/* Mobile Compact Top App Bar (52px — keeps aggregate sticky <= 14% of 844px viewport) */}
        <header className="lg:hidden sticky top-0 z-30 h-[52px] px-4 bg-[#0B0D10]/95 backdrop-blur-md border-b border-[#232A33] flex items-center justify-between gap-4 no-print">
          <button
            type="button"
            onClick={() => handleNavigate('home')}
            className="text-base font-bold tracking-tight text-[#F4F6F8] whitespace-nowrap shrink-0 flex items-center gap-2"
          >
            <img src="/logo.png" alt="KYVORA" className="w-6 h-6 rounded-md shrink-0 object-cover" />
            <span className="tracking-wider bg-gradient-to-r from-white via-slate-100 to-amber-200 bg-clip-text text-transparent font-black">
              KYVORA
            </span>
          </button>

          <span className="text-xs font-medium text-[#8E99A8] truncate">{navLabels[activeNav]}</span>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setLanguage(isAr ? 'en' : 'ar')}
              aria-label={isAr ? 'تبديل اللغة إلى الإنجليزية' : 'Switch language to Arabic'}
              className="min-h-[40px] px-2.5 rounded-lg text-xs font-mono-nums font-semibold text-[#C8D0DC] hover:bg-[#191F27]"
            >
              {isAr ? 'EN' : 'AR'}
            </button>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label={isAr ? 'فتح الأقسام الإضافية' : 'Open more sections'}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#C8D0DC] hover:bg-[#191F27]"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Sync error banner if any */}
        {syncError ? (
          <div className="mx-4 sm:mx-6 lg:mx-8 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
            {syncError}
          </div>
        ) : null}

        {/* Primary Scrollable Viewport */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-10">
          {activeNav === 'home' ? (
            <HomeDashboard
              onNavigate={handleNavigate}
              onOpenVoiceExpense={() => setVoiceModalOpen(true)}
            />
          ) : null}
          {activeNav === 'habits' ? <HabitsModule /> : null}
          {activeNav === 'finance' ? (
            <FinanceModule onOpenVoiceExpense={() => setVoiceModalOpen(true)} />
          ) : null}
          {activeNav === 'time' ? <TimeModule /> : null}
          {activeNav === 'health' ? <HealthEnergyModule /> : null}
          {activeNav === 'ai' ? <LifeAiModule /> : null}
          {activeNav === 'wellbeing' ? <WellbeingModule /> : null}
          {activeNav === 'goals' ? <GoalsModule /> : null}
          {activeNav === 'reports' ? <ReportsModule /> : null}
          {activeNav === 'connections' ? <ConnectionsSettingsModule mode="connections" /> : null}
          {activeNav === 'settings' ? <ConnectionsSettingsModule mode="settings" /> : null}
        </main>
      </div>

      {/* Mobile Fixed 6-Destination Bottom Navigation Bar (64px) */}
      <nav
        aria-label={isAr ? 'شريط التنقل السفلي' : 'Bottom Navigation'}
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-[#0F1216]/95 backdrop-blur-md border-t border-[#232A33] grid grid-cols-6 items-center px-0.5 no-print"
      >
        {PRIMARY_NAV.map(({ id, icon: Icon }) => {
          const active = activeNav === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleNavigate(id)}
              aria-current={active ? 'page' : undefined}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl transition-colors ${
                active ? 'text-emerald-400' : 'text-[#8E99A8]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium whitespace-nowrap truncate max-w-full px-1">
                {navLabels[id]}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Mobile Secondary Sections Bottom Sheet Drawer */}
      {drawerOpen ? (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end"
          role="dialog"
          aria-modal="true"
          aria-label={isAr ? 'الأقسام الإضافية' : 'More Sections'}
        >
          <div className="w-full bg-[#13171C] border-t border-[#232A33] rounded-t-3xl p-5 space-y-4">
            <div className="w-10 h-1 bg-[#33404F] rounded-full mx-auto" />
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#F4F6F8]">
                {isAr ? 'الأقسام الإضافية والحساب' : 'More Modules & Account'}
              </h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label={isAr ? 'إغلاق القائمة' : 'Close menu'}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#8E99A8]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              {SECONDARY_NAV.map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleNavigate(id)}
                  className={`w-full min-h-[46px] px-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
                    activeNav === id ? 'bg-emerald-500/15 text-emerald-400' : 'text-[#D2DAE5] hover:bg-[#1B212A]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{navLabels[id]}</span>
                </button>
              ))}
            </div>

            <div className="pt-3 border-t border-[#232A33]">
              {isCloudMode && user ? (
                <button
                  type="button"
                  onClick={() => {
                    void signOut();
                    setDrawerOpen(false);
                  }}
                  className="w-full min-h-[44px] rounded-xl border border-[#2A3340] text-xs font-semibold text-[#D2DAE5]"
                >
                  {UI_TEXT[lang].auth.signOut} ({user.email})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    void signInWithGoogle();
                    setDrawerOpen(false);
                  }}
                  className="w-full min-h-[44px] rounded-xl bg-[#F4F6F8] text-[#0B0D10] text-xs font-semibold"
                >
                  {UI_TEXT[lang].auth.signInGoogle}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <VoiceExpenseModal open={voiceModalOpen} onClose={() => setVoiceModalOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LifeOsProvider>
        <LifeOsShell />
      </LifeOsProvider>
    </ErrorBoundary>
  );
}
