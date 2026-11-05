import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, RefreshCw, Cpu, Server } from 'lucide-react';
import { AppConfig, OllamaModel } from '../types';

interface OllamaConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onUpdateConfig: (newConfig: Partial<AppConfig>) => void;
  onSyncModels: (models: OllamaModel[]) => void;
}

export const OllamaConnectionModal: React.FC<OllamaConnectionModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  onSyncModels,
}) => {
  const [hostInput, setHostInput] = useState(config.host);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; version?: string } | null>(null);

  if (!isOpen) return null;

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    const cleanHost = hostInput.trim().replace(/\/$/, '');

    try {
      // Attempt browser fetch to host version or tags
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const resp = await fetch(`${cleanHost}/api/version`, {
        signal: controller.signal,
      }).catch(() => null);

      clearTimeout(timeoutId);

      if (resp && resp.ok) {
        const data = await resp.json().catch(() => ({}));
        setTestResult({
          success: true,
          message: `Ollama daemon online! Connected to ${cleanHost}`,
          version: data.version || '0.5.x',
        });
        onUpdateConfig({ host: cleanHost });

        // Query tags if possible
        const tagsResp = await fetch(`${cleanHost}/api/tags`).catch(() => null);
        if (tagsResp && tagsResp.ok) {
          const tagsData = await tagsResp.json().catch(() => ({}));
          if (Array.isArray(tagsData.models) && tagsData.models.length > 0) {
            onSyncModels(tagsData.models);
          }
        }
      } else {
        // Fallback for CORS or offline
        setTestResult({
          success: false,
          message: `Unable to reach ${cleanHost} directly from browser due to CORS or host offline. The Termux CLI connects directly over localhost/Termux networking. Simulator mode active.`,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Connection failed: ${err.message || 'Network error'}. Simulator mode active.`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const cleanHost = hostInput.trim().replace(/\/$/, '');
    onUpdateConfig({ host: cleanHost });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl p-5 shadow-2xl space-y-4 text-xs font-mono">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2 font-bold text-sm text-cyan-400">
            <Server className="w-4 h-4 text-emerald-400" />
            <span>Ollama Daemon Host Settings</span>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-slate-400 block">Ollama Host URL (default: http://127.0.0.1:11434):</label>
          <input
            type="text"
            value={hostInput}
            onChange={(e) => setHostInput(e.target.value)}
            placeholder="http://127.0.0.1:11434"
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
          />
          <p className="text-[10px] text-slate-500">
            For Android Termux running Ollama locally, use <code className="text-amber-300">http://127.0.0.1:11434</code>. Or enter an IP (e.g., <code className="text-cyan-300">http://192.168.1.50:11434</code>) on local Wi-Fi.
          </p>
        </div>

        {/* Test Result Message */}
        {testResult && (
          <div className={`p-3 rounded border text-[11px] leading-relaxed flex items-start gap-2 ${
            testResult.success
              ? 'bg-emerald-950/40 border-emerald-600/50 text-emerald-300'
              : 'bg-amber-950/30 border-amber-600/40 text-amber-300'
          }`}>
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold">{testResult.success ? 'Connected Successfully' : 'Local Notice'}</p>
              <p className="text-[10px] text-slate-300 mt-0.5">{testResult.message}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-zinc-800">
          <button
            onClick={testConnection}
            disabled={isTesting}
            className="flex-1 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-cyan-300 font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
            <span>{isTesting ? 'Pinging...' : 'Test Ping'}</span>
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-black font-bold transition-colors"
          >
            Save Host
          </button>
        </div>
      </div>
    </div>
  );
};
