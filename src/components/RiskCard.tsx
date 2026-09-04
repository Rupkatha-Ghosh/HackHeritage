import React, { useState } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  AlertOctagon, 
  Volume2, 
  VolumeX, 
  CheckCircle2, 
  XCircle, 
  Anchor, 
  Clock, 
  Cpu, 
  HelpCircle,
  FileText,
  Printer
} from 'lucide-react';
import { RiskPrediction, LanguageCode, LocationInfo, TimeWindow } from '../types';
import { MULTILINGUAL_DICTIONARY } from '../data/coastalData';

interface RiskCardProps {
  risk: RiskPrediction;
  location: LocationInfo;
  timeWindow: TimeWindow;
  language: LanguageCode;
  groundedSummary: string;
}

export const RiskCard: React.FC<RiskCardProps> = ({
  risk,
  location,
  timeWindow,
  language,
  groundedSummary
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const dict = MULTILINGUAL_DICTIONARY[language] || MULTILINGUAL_DICTIONARY.en;

  // Speak the verdict using browser SpeechSynthesis
  const handleToggleAudio = () => {
    if (!('speechSynthesis' in window)) {
      alert('Text-to-speech is not supported in your browser.');
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    window.speechSynthesis.cancel(); // Stop existing

    // Determine speech text
    const textToSpeak = `${location.name}. Marine Risk Level: ${risk.riskLevel}. Risk score ${risk.riskScore} out of 100. Recommendation: ${risk.primaryRecommendation}. ${risk.safetySummary}`;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);

    // Map language
    const langMap: Record<LanguageCode, string> = {
      en: 'en-IN',
      bn: 'bn-IN',
      hi: 'hi-IN',
      ta: 'ta-IN',
      or: 'or-IN',
      te: 'te-IN',
      ml: 'ml-IN',
      gu: 'gu-IN',
      mr: 'mr-IN',
      kn: 'kn-IN'
    };
    utterance.lang = langMap[language] || 'en-IN';
    utterance.rate = 0.95;

    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
  };

  // Semantic styles for Risk Level
  const getRiskTheme = (level: string) => {
    switch (level) {
      case 'LOW':
        return {
          bg: 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300',
          badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
          icon: <ShieldCheck className="h-6 w-6 text-emerald-400" />,
          gaugeColor: '#6fd6ae',
          shadow: 'shadow-emerald-500/10'
        };
      case 'MODERATE':
        return {
          bg: 'bg-amber-950/40 border-amber-500/40 text-amber-300',
          badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
          icon: <AlertTriangle className="h-6 w-6 text-amber-400" />,
          gaugeColor: '#f2b33d',
          shadow: 'shadow-amber-500/10'
        };
      case 'HIGH':
        return {
          bg: 'bg-rose-950/40 border-rose-500/40 text-rose-300',
          badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
          icon: <AlertTriangle className="h-6 w-6 text-rose-400" />,
          gaugeColor: '#e8734a',
          shadow: 'shadow-rose-500/10'
        };
      case 'EXTREME':
      default:
        return {
          bg: 'bg-red-950/50 border-red-500/60 text-red-300',
          badgeBg: 'bg-red-500/20 text-red-300 border-red-500/60',
          icon: <AlertOctagon className="h-6 w-6 text-red-400 animate-pulse" />,
          gaugeColor: '#d6453d',
          shadow: 'shadow-red-500/20'
        };
    }
  };

  const theme = getRiskTheme(risk.riskLevel);

  return (
    <div className={`rounded-2xl border ${theme.bg} p-4 sm:p-5 shadow-xl ${theme.shadow} space-y-4 transition-all backdrop-blur-sm`}>
      
      {/* FISHERMAN HIGH-VISIBILITY TRAFFIC LIGHT ADVISORY BANNER */}
      <div className={`p-4 rounded-xl border-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left ${
        risk.riskLevel === 'LOW' 
          ? 'bg-emerald-900/80 border-emerald-400 text-emerald-100 shadow-lg shadow-emerald-900/40' 
          : risk.riskLevel === 'MODERATE' 
          ? 'bg-amber-900/80 border-amber-400 text-amber-100 shadow-lg shadow-amber-900/40' 
          : 'bg-red-900/90 border-red-400 text-red-100 shadow-lg shadow-red-900/50 animate-pulse'
      }`}>
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-full bg-slate-950/40 shrink-0">
            {theme.icon}
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest opacity-80 block">
              {location.name} • Official Sea Advisory
            </span>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-none mt-0.5">
              {risk.riskLevel === 'LOW' && '🟢 SAFE TO SAIL'}
              {risk.riskLevel === 'MODERATE' && '🟡 CAUTION ADVISED'}
              {(risk.riskLevel === 'HIGH' || risk.riskLevel === 'EXTREME') && '🔴 STAY IN PORT / DO NOT SAIL'}
            </h2>
            <p className="text-xs font-semibold opacity-90 mt-1">
              {risk.primaryRecommendation}
            </p>
          </div>
        </div>

        {/* Big One-Handed Listen Button */}
        <button
          id="btn-risk-audio-narration"
          onClick={handleToggleAudio}
          title={isPlayingAudio ? 'Stop audio' : 'Listen to marine risk summary'}
          className={`w-full sm:w-auto min-h-[52px] px-5 py-3 rounded-xl text-xs sm:text-sm font-bold border transition-all flex items-center justify-center space-x-2 shrink-0 ${
            isPlayingAudio
              ? 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-lg shadow-cyan-400/50 animate-pulse'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-100 border-slate-600 active:scale-95'
          }`}
        >
          {isPlayingAudio ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5 text-cyan-400" />}
          <span>{isPlayingAudio ? 'Stop Audio' : '🔊 Listen Warning'}</span>
        </button>
      </div>

      {/* Header with Risk Level Badge & Audio Narration */}
      <div className="flex items-start justify-between pt-1">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              {dict.machineLearningAssessment}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400">
              {risk.modelVersion}
            </span>
          </div>
          <h3 className="text-xl font-extrabold text-slate-100 flex items-center gap-2 mt-1">
            <span>{location.name}</span>
          </h3>
          <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 font-mono">
            <Clock className="h-3 w-3 text-cyan-400" />
            <span>{dict.targetWindow}: {timeWindow.requestedText === 'Current Conditions' ? dict.currentConditions : timeWindow.requestedText}</span>
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Print Bulletin Button */}
          <button
            id="btn-print-advisory-bulletin"
            onClick={() => window.print()}
            title="Print Official Safety Bulletin"
            className="flex items-center space-x-1.5 min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-700 bg-slate-900/90 hover:bg-slate-800 text-slate-200 transition-all"
          >
            <Printer className="h-4 w-4 text-cyan-400" />
            <span className="hidden sm:inline">Print Bulletin</span>
          </button>

          {/* Audio TTS Button */}
          <button
            id="btn-risk-audio-narration"
            onClick={handleToggleAudio}
            title={isPlayingAudio ? 'Stop audio' : 'Listen to marine risk summary'}
            className={`flex items-center space-x-1.5 min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              isPlayingAudio
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 animate-pulse shadow-md shadow-cyan-500/50'
                : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700'
            }`}
          >
            {isPlayingAudio ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-cyan-400" />}
            <span className="hidden sm:inline">{isPlayingAudio ? (dict.listening || 'Speaking...') : (dict.listenAudio || 'Listen Audio')}</span>
          </button>
        </div>
      </div>

      {/* Main Score & Categorical Card */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-slate-950/70 border border-slate-800/80 rounded-xl p-4">
        
        {/* Score Circular Gauge */}
        <div className="md:col-span-4 flex items-center space-x-3.5 border-b md:border-b-0 md:border-r border-slate-800 pb-3 md:pb-0 md:pr-4">
          <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
            {/* SVG Circle Progress */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-800"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                strokeDasharray={`${risk.riskScore}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke={theme.gaugeColor}
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-base font-extrabold text-white font-mono">{risk.riskScore}</span>
              <span className="text-[9px] text-slate-400 uppercase font-mono">/ 100</span>
            </div>
          </div>

          <div>
            <div className="flex items-center space-x-1.5">
              {theme.icon}
              <span className={`px-2.5 py-0.5 rounded-md text-xs font-black uppercase tracking-wider border ${theme.badgeBg}`}>
                {risk.riskLevel === 'LOW' ? dict.lowRisk : risk.riskLevel === 'MODERATE' ? dict.moderateRisk : risk.riskLevel === 'HIGH' ? dict.highRisk : dict.extremeRisk}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono flex items-center gap-1">
              <Cpu className="h-3 w-3 text-cyan-400" />
              <span>{dict.confidence}: <strong className="text-slate-200">{risk.confidenceScore}%</strong></span>
            </div>
          </div>
        </div>

        {/* Primary Verdict & Safety Recommendation */}
        <div className="md:col-span-8 space-y-1.5">
          <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-cyan-400"></span>
            <span>{dict.primaryDirective}</span>
          </div>
          <p className="text-sm font-semibold text-slate-200 leading-snug">
            {risk.primaryRecommendation}
          </p>
          <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
            {risk.safetySummary}
          </p>
        </div>

      </div>

      {/* Craft Restrictions & Safe Vessel Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        
        {/* Permitted Craft Types */}
        <div className="bg-emerald-950/30 border border-emerald-900/40 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center space-x-1.5 font-bold text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{dict.permittedVessels}</span>
          </div>
          <ul className="space-y-1 text-slate-300 text-[11px]">
            {risk.safeCraftTypes.length > 0 ? (
              risk.safeCraftTypes.map((craft, i) => (
                <li key={i} className="flex items-center space-x-1.5">
                  <span className="h-1 w-1 rounded-full bg-emerald-400 shrink-0"></span>
                  <span>{craft}</span>
                </li>
              ))
            ) : (
              <li className="text-slate-400 italic">{dict.noCraftsCleared}</li>
            )}
          </ul>
        </div>

        {/* Restricted / Embargoed Craft Types */}
        <div className="bg-rose-950/30 border border-rose-900/40 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center space-x-1.5 font-bold text-rose-400">
            <XCircle className="h-3.5 w-3.5" />
            <span>{dict.restrictedVessels}</span>
          </div>
          <ul className="space-y-1 text-slate-300 text-[11px]">
            {risk.restrictedCraftTypes.length > 0 ? (
              risk.restrictedCraftTypes.map((craft, i) => (
                <li key={i} className="flex items-center space-x-1.5">
                  <span className="h-1 w-1 rounded-full bg-rose-400 shrink-0"></span>
                  <span>{craft}</span>
                </li>
              ))
            ) : (
              <li className="text-emerald-400/80 italic">{dict.noRestrictions}</li>
            )}
          </ul>
        </div>

      </div>

      {/* Actionable Safety Bulletins Checklist */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2">
        <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-cyan-400" />
            <span>{dict.recommendations}</span>
          </span>
          <span className="text-[10px] font-mono text-cyan-400">
            {dict.validUntil}: {new Date(risk.validUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
          {risk.actionableAdvisories.map((advisory, idx) => (
            <div key={idx} className="flex items-start space-x-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
              <span className="text-cyan-400 font-bold font-mono shrink-0">#{idx + 1}</span>
              <span className="leading-snug">{advisory}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
