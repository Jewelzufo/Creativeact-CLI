/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Terminal, 
  Cpu, 
  Bookmark, 
  Sparkles, 
  Sliders, 
  Code2, 
  Download, 
  Moon, 
  Sun,
  ShieldCheck,
  Server,
  Smartphone
} from 'lucide-react';
import { OllamaModel, PromptTemplate, InferenceTelemetry, AppConfig } from './types';
import { TerminalView } from './components/TerminalView';
import { CodeViewer } from './components/CodeViewer';
import { ViewportControls } from './components/ViewportControls';
import { OllamaConnectionModal } from './components/OllamaConnectionModal';

const INITIAL_MODELS: OllamaModel[] = [
  {
    name: 'llama3.2:1b',
    size: 1300000000,
    modified_at: '2026-11-04T10:00:00Z',
    details: { family: 'llama', parameter_size: '1.2B', quantization_level: 'Q4_K_M' },
    lastMetrics: {
      eval_count: 54,
      eval_duration_ns: 2150000000,
      eval_duration_sec: 2.15,
      tokens_per_second: 25.1,
      load_duration_ms: 194.2,
      prompt_eval_count: 14,
      prompt_eval_duration_sec: 0.11,
      timestamp: 'Initial benchmark',
    }
  },
  {
    name: 'qwen2.5:1.5b',
    size: 986000000,
    modified_at: '2026-11-03T14:30:00Z',
    details: { family: 'qwen2', parameter_size: '1.5B', quantization_level: 'Q4_K_M' },
    lastMetrics: {
      eval_count: 62,
      eval_duration_ns: 2820000000,
      eval_duration_sec: 2.82,
      tokens_per_second: 22.0,
      load_duration_ms: 210.5,
      prompt_eval_count: 18,
      prompt_eval_duration_sec: 0.14,
      timestamp: 'Initial benchmark',
    }
  },
  {
    name: 'deepseek-r1:1.5b',
    size: 1120000000,
    modified_at: '2026-11-01T08:15:00Z',
    details: { family: 'qwen2', parameter_size: '1.5B', quantization_level: 'Q4_K_M' },
    lastMetrics: {
      eval_count: 68,
      eval_duration_ns: 3400000000,
      eval_duration_sec: 3.40,
      tokens_per_second: 20.0,
      load_duration_ms: 225.0,
      prompt_eval_count: 16,
      prompt_eval_duration_sec: 0.13,
      timestamp: 'Initial benchmark',
    }
  },
  {
    name: 'phi3:mini',
    size: 2300000000,
    modified_at: '2026-10-28T19:00:00Z',
    details: { family: 'phi3', parameter_size: '3.8B', quantization_level: 'Q4_K_M' },
    lastMetrics: {
      eval_count: 65,
      eval_duration_ns: 6200000000,
      eval_duration_sec: 6.20,
      tokens_per_second: 10.5,
      load_duration_ms: 410.0,
      prompt_eval_count: 15,
      prompt_eval_duration_sec: 0.22,
      timestamp: 'Initial benchmark',
    }
  }
];

const INITIAL_PROMPTS: PromptTemplate[] = [
  {
    id: 'summarize',
    title: 'Quick Summarize',
    template: 'Summarize the following text in 3 concise bullet points:\n\n{input}',
    description: '3-bullet rapid summary for mobile reading'
  },
  {
    id: 'code_explain',
    title: 'Explain Code',
    template: 'Explain how this code works in plain English, noting any potential bugs or performance bottlenecks:\n\n{input}',
    description: 'Code explanation with bug identification'
  },
  {
    id: 'shell_helper',
    title: 'Termux / Shell Command',
    template: 'Provide the exact Linux/Termux command to accomplish this task. Provide command first, then a 1-sentence explanation:\n\n{input}',
    description: 'Fast command generator for Android Termux'
  },
  {
    id: 'grammar_fix',
    title: 'Fix Grammar & Tone',
    template: 'Correct any grammar, spelling, and phrasing issues in this text while keeping it natural and professional:\n\n{input}',
    description: 'Polish text and fix grammar'
  },
  {
    id: 'git_commit',
    title: 'Conventional Commit',
    template: 'Generate 3 clean conventional commit message options for the following git diff / description:\n\n{input}',
    description: 'feat/fix conventional commit generator'
  }
];

const DEFAULT_CONFIG: AppConfig = {
  host: 'http://127.0.0.1:11434',
  active_model: 'llama3.2:1b',
  theme: 'dark',
  timeout_seconds: 60.0,
  max_context_tokens: 2048,
};

export default function App() {
  const [config, setConfig] = useState<AppConfig>(() => {
    try {
      const saved = localStorage.getItem('termux_ollama_config');
      if (saved) return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    } catch (e) {}
    return DEFAULT_CONFIG;
  });

  const [models, setModels] = useState<OllamaModel[]>(() => {
    try {
      const saved = localStorage.getItem('termux_ollama_models');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_MODELS;
  });

  const [prompts, setPrompts] = useState<PromptTemplate[]>(() => {
    try {
      const saved = localStorage.getItem('termux_ollama_prompts');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_PROMPTS;
  });

  const [lastTelemetry, setLastTelemetry] = useState<InferenceTelemetry | null>({
    eval_count: 54,
    eval_duration_ns: 2150000000,
    eval_duration_sec: 2.15,
    tokens_per_second: 25.1,
    load_duration_ms: 194.2,
    prompt_eval_count: 14,
    prompt_eval_duration_sec: 0.11,
    timestamp: 'Initial startup benchmark',
  });

  // Viewport / Terminal Emulation State
  const [columns, setColumns] = useState<number>(56);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [showSoftKeyboard, setShowSoftKeyboard] = useState<boolean>(true);
  const [fontSize, setFontSize] = useState<number>(12);
  const [activeTab, setActiveTab] = useState<'terminal' | 'code'>('terminal');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Sync config to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('termux_ollama_config', JSON.stringify(config));
    } catch (e) {}
  }, [config]);

  // Sync models to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('termux_ollama_models', JSON.stringify(models));
    } catch (e) {}
  }, [models]);

  // Sync prompts to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('termux_ollama_prompts', JSON.stringify(prompts));
    } catch (e) {}
  }, [prompts]);

  const updateConfig = (newVals: Partial<AppConfig>) => {
    setConfig((prev) => ({ ...prev, ...newVals }));
  };

  const handleAddModel = (newModel: OllamaModel) => {
    setModels((prev) => {
      const filtered = prev.filter((m) => m.name !== newModel.name);
      return [newModel, ...filtered];
    });
  };

  const handleDeleteModel = (name: string) => {
    setModels((prev) => prev.filter((m) => m.name !== name));
    if (config.active_model === name && models.length > 1) {
      const remaining = models.filter((m) => m.name !== name);
      if (remaining.length > 0) {
        updateConfig({ active_model: remaining[0].name });
      }
    }
  };

  const handleRecordTelemetry = (telemetry: InferenceTelemetry, modelName?: string) => {
    setLastTelemetry(telemetry);
    const target = modelName || config.active_model;
    setModels((prev) =>
      prev.map((m) =>
        m.name === target
          ? { ...m, lastMetrics: telemetry }
          : m
      )
    );
  };

  const handleAddPrompt = (prompt: PromptTemplate) => {
    setPrompts((prev) => [prompt, ...prev.filter((p) => p.id !== prompt.id)]);
  };

  const handleDeletePrompt = (id: string) => {
    setPrompts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleRotate = () => {
    if (orientation === 'portrait') {
      setOrientation('landscape');
      setColumns(76);
    } else {
      setOrientation('portrait');
      setColumns(56);
    }
  };

  const isDark = config.theme === 'dark';

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
      isDark ? 'bg-zinc-950 text-slate-100' : 'bg-slate-100 text-slate-900'
    }`}>
      {/* Top Application Header */}
      <header className={`border-b px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${
        isDark ? 'bg-black/90 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center text-black font-black shadow-lg">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm tracking-tight">CreativeAct CLI</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Local Termux Ollama Platform
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Local Termux Ollama Platform · Touch-Friendly Python Rich Interface with Model Management & Telemetry
            </p>
          </div>
        </div>

        {/* Global Active Model & Theme Quick Switch */}
        <div className="flex items-center gap-3">
          {/* Active Model Selector */}
          <div className="flex items-center gap-1.5 text-xs">
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400 hidden sm:inline">Active Model:</span>
            <select
              value={config.active_model}
              onChange={(e) => updateConfig({ active_model: e.target.value })}
              className={`text-xs font-mono font-bold rounded px-2 py-1 outline-none border cursor-pointer ${
                isDark 
                  ? 'bg-zinc-900 border-zinc-700 text-amber-300' 
                  : 'bg-slate-100 border-slate-300 text-amber-900'
              }`}
            >
              {models.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={() => updateConfig({ theme: isDark ? 'light' : 'dark' })}
            className={`p-1.5 rounded-lg border transition-colors ${
              isDark 
                ? 'bg-zinc-900 border-zinc-800 text-amber-300 hover:bg-zinc-800' 
                : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
            }`}
            title="Toggle High-Contrast Dark / Light Theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 md:p-6 flex flex-col gap-4">
        {/* Viewport & Device Controls */}
        <ViewportControls
          columns={columns}
          onChangeColumns={setColumns}
          orientation={orientation}
          onToggleOrientation={handleRotate}
          showSoftKeyboard={showSoftKeyboard}
          onToggleSoftKeyboard={() => setShowSoftKeyboard((v) => !v)}
          fontSize={fontSize}
          onChangeFontSize={setFontSize}
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          config={config}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Dynamic Display Area */}
        <div className="flex-1 flex flex-col min-h-[580px]">
          {activeTab === 'terminal' ? (
            <div className="flex justify-center flex-1">
              {/* Responsive Container constrained to simulated column width */}
              <div 
                style={{ 
                  width: `${Math.min(100, Math.max(38, (columns / 80) * 100))}%`,
                  maxWidth: '1000px',
                  minWidth: '320px'
                }}
                className="flex-1 flex flex-col transition-all duration-200"
              >
                <TerminalView
                  columns={columns}
                  orientation={orientation}
                  showSoftKeyboard={showSoftKeyboard}
                  fontSize={fontSize}
                  onRotate={handleRotate}
                  config={config}
                  onUpdateConfig={updateConfig}
                  models={models}
                  onAddModel={handleAddModel}
                  onDeleteModel={handleDeleteModel}
                  prompts={prompts}
                  onAddPrompt={handleAddPrompt}
                  onDeletePrompt={handleDeletePrompt}
                  lastTelemetry={lastTelemetry}
                  onRecordTelemetry={handleRecordTelemetry}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <CodeViewer />
            </div>
          )}
        </div>
      </main>

      {/* Connection & Settings Modal */}
      <OllamaConnectionModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onUpdateConfig={updateConfig}
        onSyncModels={(newModels) => {
          setModels(newModels);
          if (newModels[0]) updateConfig({ active_model: newModels[0].name });
        }}
      />
    </div>
  );
}
