import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX, AlertOctagon, Radio, Play, Square, Sparkles } from 'lucide-react';
import { LanguageCode, GeofenceSpatialAnalysis, RiskPrediction } from '../types';
import { maritimeSiren } from '../services/audio/maritimeSirenService';
import { voiceWarning } from '../services/audio/voiceWarningService';

interface AudioAlertControllerProps {
  language: LanguageCode;
  geofenceAnalysis?: GeofenceSpatialAnalysis;
  risk?: RiskPrediction;
  className?: string;
}

export const AudioAlertController: React.FC<AudioAlertControllerProps> = ({
  language,
  geofenceAnalysis,
  risk,
  className = '',
}) => {
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isPlayingSiren, setIsPlayingSiren] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [lastActionText, setLastActionText] = useState<string>('Standing by for maritime alerts');

  // Subscribe to siren and voice status
  useEffect(() => {
    const unsubSiren = maritimeSiren.subscribe(setIsPlayingSiren);
    const unsubVoice = voiceWarning.subscribe(setIsSpeaking);
    return () => {
      unsubSiren();
      unsubVoice();
    };
  }, []);

  // Sync mute state
  const handleToggleMute = async () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    maritimeSiren.setMuted(nextMuted);
    voiceWarning.setMuted(nextMuted);

    if (!nextMuted) {
      await maritimeSiren.unlock();
      setLastActionText('Audio alerts enabled');
    } else {
      maritimeSiren.stop();
      voiceWarning.cancel();
      setLastActionText('Audio alerts silenced');
    }
  };

  // Test button
  const handleTestAlert = async () => {
    await maritimeSiren.unlock();
    if (isMuted) {
      handleToggleMute();
    }
    setLastActionText(`Testing siren & voice (${language.toUpperCase()})`);
    const testPhrase = voiceWarning.generateTestPhrase(language);
    voiceWarning.speak(testPhrase, language, { playSirenFirst: true, isCritical: false, force: true });
  };

  // Stop button
  const handleStopAll = () => {
    maritimeSiren.stop();
    voiceWarning.cancel();
    setLastActionText('Audio alert halted');
  };

  // Automatic live condition trigger
  useEffect(() => {
    if (isMuted) return;
    const criticalAlert = geofenceAnalysis?.activeAlerts?.find((a) => a.severity === 'CRITICAL_BREACH') ||
      (geofenceAnalysis?.status === 'RESTRICTED_BREACH' ? geofenceAnalysis.nearestImbl || geofenceAnalysis.nearestMpa : undefined);

    const warningAlert = geofenceAnalysis?.activeAlerts?.find((a) => a.severity === 'PROXIMITY_WARNING') ||
      (geofenceAnalysis?.status === 'CAUTION' ? geofenceAnalysis.nearestImbl || geofenceAnalysis.nearestMpa : undefined);

    if (criticalAlert) {
      setLastActionText(`Critical alert sounding: ${criticalAlert.boundaryName}`);
      voiceWarning.evaluateAndAnnounce(criticalAlert, risk, language);
    } else if (warningAlert) {
      setLastActionText(`Proximity alert: ${warningAlert.boundaryName}`);
      voiceWarning.evaluateAndAnnounce(warningAlert, risk, language);
    } else if (risk && risk.riskLevel === 'EXTREME') {
      setLastActionText('Extreme marine weather alert');
      voiceWarning.evaluateAndAnnounce(undefined, risk, language);
    }
  }, [geofenceAnalysis, risk, language, isMuted]);

  const isAudioActive = isPlayingSiren || isSpeaking;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 px-3.5 py-2 rounded-xl bg-slate-950/90 border transition-all ${
        isAudioActive
          ? 'border-rose-500/60 shadow-lg shadow-rose-500/20 ring-1 ring-rose-500/40'
          : 'border-slate-800 shadow-md'
      } ${className}`}
    >
      {/* Left: Audio Status & Animated Soundwave */}
      <div className="flex items-center space-x-2.5 min-w-0">
        <button
          onClick={handleToggleMute}
          title={isMuted ? 'Unmute Maritime Audio Alerts' : 'Mute Maritime Audio Alerts'}
          className={`p-2 rounded-lg transition-all flex items-center justify-center ${
            isMuted
              ? 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-700'
              : isAudioActive
              ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/40 animate-pulse font-bold'
              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30'
          }`}
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center space-x-1.5">
            <span className="text-xs font-bold text-slate-200 tracking-wide flex items-center gap-1 font-mono">
              <Radio className={`h-3 w-3 ${isAudioActive ? 'text-rose-400 animate-spin' : 'text-cyan-400'}`} />
              <span>MARITIME AUDIO:</span>
            </span>
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                isMuted
                  ? 'bg-slate-900 text-slate-400 border-slate-700'
                  : isAudioActive
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}
            >
              {isMuted ? 'MUTED' : isAudioActive ? (isPlayingSiren ? 'SIREN ACTIVE' : 'VOICE ACTIVE') : 'ARMED'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 truncate max-w-[280px] sm:max-w-xs font-sans">
            {lastActionText}
          </span>
        </div>
      </div>

      {/* Center: Live Equalizer Soundwave Animation */}
      <div className="flex items-center space-x-1 h-5 px-2 bg-slate-900/80 rounded-md border border-slate-800">
        {[1, 2, 3, 4, 5].map((bar) => {
          const heights = isAudioActive
            ? isPlayingSiren
              ? ['h-5 bg-rose-400', 'h-3 bg-rose-500', 'h-4 bg-orange-400', 'h-2 bg-rose-500', 'h-5 bg-rose-400']
              : ['h-3 bg-cyan-400', 'h-5 bg-cyan-300', 'h-2 bg-emerald-400', 'h-4 bg-cyan-400', 'h-3 bg-cyan-300']
            : ['h-1.5 bg-slate-700', 'h-2 bg-slate-700', 'h-1.5 bg-slate-700', 'h-2 bg-slate-700', 'h-1.5 bg-slate-700'];
          return (
            <div
              key={bar}
              className={`w-1 rounded-full transition-all duration-150 ${heights[(bar - 1) % heights.length]}`}
            />
          );
        })}
      </div>

      {/* Indic AI Gateway Badge (Bhashini NLTM & Sarvam AI) */}
      <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-900/90 border border-slate-800 text-[10px] font-mono text-cyan-300">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
        <span>Bhashini &amp; Sarvam Indic AI Gateway</span>
      </div>

      {/* Right: Controls (Test Button & Halt) */}
      <div className="flex items-center space-x-2">
        <button
          onClick={handleTestAlert}
          disabled={isAudioActive}
          className="px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-700/50 hover:border-cyan-500 flex items-center space-x-1.5 transition-all active:scale-95 disabled:opacity-50"
        >
          <Sparkles className="h-3 w-3 text-cyan-400" />
          <span>Test Siren &amp; Voice ({language.toUpperCase()})</span>
        </button>

        {isAudioActive && (
          <button
            onClick={handleStopAll}
            className="px-2 py-1.5 rounded-lg text-xs font-bold font-mono text-rose-300 bg-rose-950/80 hover:bg-rose-900/80 border border-rose-700/60 flex items-center space-x-1 transition-all active:scale-95"
            title="Silence active siren or voice immediately"
          >
            <Square className="h-3 w-3 fill-current text-rose-400" />
            <span>Silence</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default AudioAlertController;
