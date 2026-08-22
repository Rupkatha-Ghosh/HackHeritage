import React, { useState, useEffect } from 'react';
import { 
  Waves, 
  Compass, 
  Activity, 
  Globe, 
  ShieldCheck, 
  Layers, 
  Satellite, 
  Cpu, 
  SlidersHorizontal, 
  BookOpen,
  Radio,
  Clock,
  Menu,
  X,
  ChevronRight,
  Anchor
} from 'lucide-react';
import { LanguageCode } from '../types';
import { MULTILINGUAL_DICTIONARY } from '../data/coastalData';

interface LeftNavbarProps {
  currentTab: 'dashboard' | 'analysis' | 'satellite' | 'evidence' | 'simulator';
  setCurrentTab: (tab: 'dashboard' | 'analysis' | 'satellite' | 'evidence' | 'simulator') => void;
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  isProcessing?: boolean;
}

export const LeftNavbar: React.FC<LeftNavbarProps> = ({
  currentTab,
  setCurrentTab,
  language,
  setLanguage,
  isProcessing = false
}) => {
  const [timeUtc, setTimeUtc] = useState<string>('');
  const [timeIst, setTimeIst] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeUtc(now.toUTCString().slice(17, 25) + ' UTC');
      setTimeIst(
        now.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }) + ' IST'
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const dict = MULTILINGUAL_DICTIONARY[language] || MULTILINGUAL_DICTIONARY.en;

  const languages: { code: LanguageCode; label: string; native: string }[] = [
    { code: 'en', label: 'English', native: 'English' },
    { code: 'bn', label: 'Bengali', native: 'বাংলা' },
    { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
    { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
    { code: 'or', label: 'Odia', native: 'ଓଡ଼ିଆ' },
    { code: 'te', label: 'Telugu', native: 'తెలుగు' }
  ];

  const navItems: {
    id: 'dashboard' | 'analysis' | 'satellite' | 'evidence' | 'simulator';
    label: string;
    description: string;
    icon: React.ElementType;
    badge?: string;
  }[] = [
    {
      id: 'dashboard',
      label: 'Mission Control',
      description: 'Primary advisory & live GIS map',
      icon: Compass,
      badge: 'LIVE'
    },
    {
      id: 'analysis',
      label: 'ML Risk Drivers',
      description: 'Feature attribution & SHAP values',
      icon: Activity
    },
    {
      id: 'satellite',
      label: 'Satellite GIS',
      description: 'Sentinel-3 / SAR Remote Sensing',
      icon: Satellite,
      badge: 'SAR'
    },
    {
      id: 'evidence',
      label: 'RAG Corpus',
      description: 'INCOIS, IMD & NDMA Guidelines',
      icon: BookOpen
    },
    {
      id: 'simulator',
      label: 'What-If Studio',
      description: 'Synthetic marine perturbation testing',
      icon: SlidersHorizontal
    }
  ];

  return (
    <>
      {/* Mobile Top App Bar with Hamburger */}
      <header className="lg:hidden sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 flex items-center justify-center shadow-md shadow-cyan-500/20 border border-cyan-400/30">
            <Waves className="h-5 w-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-200 bg-clip-text text-transparent">
                ORCA-X
              </span>
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-700/50 text-cyan-300 font-mono">
                v2.4
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Status Indicator */}
          <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[10px]">
            <span className={`h-1.5 w-1.5 rounded-full ${isProcessing ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
            <span className="font-mono text-slate-300">{isProcessing ? 'BUSY' : 'ONLINE'}</span>
          </div>

          {/* Hamburger toggle */}
          <button
            id="mobile-nav-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            className="w-72 max-w-[85vw] bg-slate-950 border-r border-slate-800 h-full p-4 flex flex-col justify-between overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              {/* Header inside drawer */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center space-x-2.5">
                  <div className="h-8 w-8 rounded-lg bg-cyan-600 flex items-center justify-center">
                    <Waves className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <span className="font-bold text-base text-white">ORCA-X</span>
                    <p className="text-[10px] text-slate-400 font-mono">Ocean Reasoning AI</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Navigation Items */}
              <nav className="space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setCurrentTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30'
                          : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className={`h-4 w-4 ${isActive ? 'text-slate-950' : 'text-cyan-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${isActive ? 'bg-slate-950 text-cyan-300' : 'bg-slate-800 text-slate-400'}`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Language Selector */}
              <div className="pt-2 border-t border-slate-800/80">
                <label className="block text-[11px] font-mono text-slate-400 mb-1.5 flex items-center space-x-1">
                  <Globe className="h-3 w-3 text-cyan-400" />
                  <span>Interface Language</span>
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-2 font-medium"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code} className="bg-slate-900 text-slate-200">
                      {lang.native} ({lang.label})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Time & System Status */}
            <div className="pt-4 border-t border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
              <div className="flex items-center justify-between">
                <span>Time (IST):</span>
                <span className="text-slate-200">{timeIst}</span>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span>Time (UTC):</span>
                <span>{timeUtc}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Left-Side Vertical Navbar */}
      <aside 
        id="left-sidebar-navigation"
        className="hidden lg:flex flex-col justify-between w-64 xl:w-72 bg-slate-950 border-r border-slate-800 shrink-0 sticky top-0 h-screen z-30 overflow-y-auto"
      >
        {/* Top Branding Section */}
        <div className="p-5 space-y-6">
          <div className="flex items-center space-x-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-400/30 shrink-0">
              <Waves className="h-6 w-6 text-white animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-200 bg-clip-text text-transparent">
                  ORCA-X
                </span>
                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-950/90 border border-cyan-700/60 text-cyan-300 font-mono">
                  v2.4 SIH
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5" title={dict.missionSubtitle}>
                {dict.missionSubtitle}
              </p>
            </div>
          </div>

          {/* Live Ingestion & Telemetry Badge */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-inner">
            <div className="flex items-center justify-between text-xs mb-2">
              <div className="flex items-center space-x-1.5">
                <span className={`h-2 w-2 rounded-full ${isProcessing ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 shadow-sm shadow-emerald-400/60'}`} />
                <span className="font-mono text-[11px] font-bold text-slate-200">
                  {isProcessing ? 'PROCESSING QUERY' : 'TELEMETRY LIVE'}
                </span>
              </div>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/60 text-emerald-300">
                100% ONLINE
              </span>
            </div>

            <div className="text-[11px] font-mono text-slate-400 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Telemetry Clock:</span>
                <span className="text-slate-300 font-medium">{timeIst}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Universal:</span>
                <span className="text-slate-400">{timeUtc}</span>
              </div>
            </div>
          </div>

          {/* Navigation Section */}
          <div className="space-y-1.5">
            <div className="px-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Decision Support Modules
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;

                return (
                  <button
                    key={item.id}
                    id={`left-nav-tab-${item.id}`}
                    onClick={() => setCurrentTab(item.id)}
                    className={`w-full group flex items-center justify-between p-2.5 rounded-xl text-left transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold shadow-md shadow-cyan-500/25 border border-cyan-400/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-900/80 border border-transparent hover:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                        isActive 
                          ? 'bg-slate-950/20 text-slate-950' 
                          : 'bg-slate-900 text-cyan-400 group-hover:text-cyan-300 group-hover:bg-slate-800'
                      }`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate leading-tight">
                          {item.label}
                        </div>
                        <div className={`text-[10px] truncate leading-tight mt-0.5 ${isActive ? 'text-slate-900/80' : 'text-slate-400'}`}>
                          {item.description}
                        </div>
                      </div>
                    </div>

                    {item.badge ? (
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ml-2 shrink-0 ${
                        isActive
                          ? 'bg-slate-950 text-cyan-300 font-bold'
                          : 'bg-slate-800 text-slate-400 group-hover:text-slate-300'
                      }`}>
                        {item.badge}
                      </span>
                    ) : (
                      <ChevronRight className={`h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? 'text-slate-950 opacity-100' : 'text-slate-400'}`} />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Configuration & Multi-Language Footer */}
        <div className="p-5 border-t border-slate-900 bg-slate-950/60 space-y-4">
          
          {/* Language Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
              <span className="flex items-center space-x-1">
                <Globe className="h-3 w-3 text-cyan-400" />
                <span>Regional Language</span>
              </span>
              <span className="text-[10px] text-cyan-400 font-bold uppercase">{language}</span>
            </div>
            
            <div className="relative">
              <select
                id="sidebar-language-selector"
                value={language}
                onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                className="w-full bg-slate-900 border border-slate-750 hover:border-cyan-600/60 text-slate-200 text-xs rounded-xl px-3 py-2 font-medium focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 cursor-pointer appearance-none pr-8 transition-colors"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-slate-900 text-slate-200 py-1">
                    {lang.native} — ({lang.label})
                  </option>
                ))}
              </select>
              <Globe className="h-3.5 w-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Quick Authority Sources */}
          <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[10px] font-mono text-slate-400 px-1">
            <span>INCOIS • IMD • NOAA</span>
            <span className="text-cyan-400 flex items-center space-x-1">
              <ShieldCheck className="h-3 w-3 inline" />
              <span>Verified</span>
            </span>
          </div>

        </div>
      </aside>
    </>
  );
};
