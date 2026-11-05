import React from 'react';
import { 
  Smartphone, 
  RotateCw, 
  Sliders, 
  Keyboard, 
  Type, 
  Terminal, 
  Code, 
  Settings,
  Wifi,
  Sparkles
} from 'lucide-react';
import { AppConfig } from '../types';

interface ViewportControlsProps {
  columns: number;
  onChangeColumns: (cols: number) => void;
  orientation: 'portrait' | 'landscape';
  onToggleOrientation: () => void;
  showSoftKeyboard: boolean;
  onToggleSoftKeyboard: () => void;
  fontSize: number;
  onChangeFontSize: (size: number) => void;
  activeTab: 'terminal' | 'code';
  onChangeTab: (tab: 'terminal' | 'code') => void;
  config: AppConfig;
  onOpenSettings: () => void;
}

export const ViewportControls: React.FC<ViewportControlsProps> = ({
  columns,
  onChangeColumns,
  orientation,
  onToggleOrientation,
  showSoftKeyboard,
  onToggleSoftKeyboard,
  fontSize,
  onChangeFontSize,
  activeTab,
  onChangeTab,
  config,
  onOpenSettings,
}) => {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 shadow-lg space-y-3">
      {/* Top Bar: Tabs & Quick Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-800/80">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
          <button
            onClick={() => onChangeTab('terminal')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'terminal'
                ? 'bg-cyan-500 text-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Interactive Terminal</span>
          </button>
          <button
            onClick={() => onChangeTab('code')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'code'
                ? 'bg-cyan-500 text-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Python Source Code</span>
          </button>
        </div>

        {/* Ollama Connection Indicator & Settings */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-slate-300 transition-colors"
          >
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono text-[11px] truncate max-w-[130px]">{config.host}</span>
            <Settings className="w-3.5 h-3.5 text-slate-500 ml-1" />
          </button>
        </div>
      </div>

      {/* Terminal Viewport Simulation Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {/* Terminal Width Slider */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-slate-400">
            <span className="flex items-center gap-1">
              <Sliders className="w-3 h-3 text-cyan-400" />
              <span>Terminal Width:</span>
            </span>
            <span className="font-mono font-bold text-amber-300">
              {columns} cols {columns < 40 ? '(Micro)' : columns < 60 ? '(Compact)' : '(Wide)'}
            </span>
          </div>
          <input
            type="range"
            min="34"
            max="100"
            step="2"
            value={columns}
            onChange={(e) => onChangeColumns(Number(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
          />
        </div>

        {/* Viewport Presets */}
        <div className="space-y-1">
          <span className="text-slate-400 block">Presets:</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onChangeColumns(38)}
              className={`flex-1 py-1 rounded font-mono text-[11px] border transition-colors ${
                columns === 38 ? 'bg-zinc-800 border-cyan-400 text-cyan-300 font-bold' : 'bg-zinc-900 border-zinc-800 text-slate-400 hover:text-white'
              }`}
              title="<40 cols: Strict micro stack layout"
            >
              38c
            </button>
            <button
              onClick={() => onChangeColumns(56)}
              className={`flex-1 py-1 rounded font-mono text-[11px] border transition-colors ${
                columns === 56 ? 'bg-zinc-800 border-cyan-400 text-cyan-300 font-bold' : 'bg-zinc-900 border-zinc-800 text-slate-400 hover:text-white'
              }`}
              title="<60 cols: Compact mobile layout"
            >
              56c
            </button>
            <button
              onClick={() => onChangeColumns(74)}
              className={`flex-1 py-1 rounded font-mono text-[11px] border transition-colors ${
                columns === 74 ? 'bg-zinc-800 border-cyan-400 text-cyan-300 font-bold' : 'bg-zinc-900 border-zinc-800 text-slate-400 hover:text-white'
              }`}
              title="Landscape orientation"
            >
              74c
            </button>
            <button
              onClick={() => onChangeColumns(92)}
              className={`flex-1 py-1 rounded font-mono text-[11px] border transition-colors ${
                columns === 92 ? 'bg-zinc-800 border-cyan-400 text-cyan-300 font-bold' : 'bg-zinc-900 border-zinc-800 text-slate-400 hover:text-white'
              }`}
              title="Desktop / Tablet full table"
            >
              92c
            </button>
          </div>
        </div>

        {/* Rotation & Soft Keyboard Toggles */}
        <div className="space-y-1">
          <span className="text-slate-400 block">Termux Hardware:</span>
          <div className="flex items-center gap-1">
            <button
              onClick={onToggleOrientation}
              className={`flex-1 py-1 px-2 rounded font-mono text-[11px] border flex items-center justify-center gap-1 transition-colors ${
                orientation === 'landscape' ? 'bg-zinc-800 border-amber-400 text-amber-300 font-bold' : 'bg-zinc-900 border-zinc-800 text-slate-300 hover:text-white'
              }`}
              title="Simulates screen rotation and SIGWINCH signal handling"
            >
              <RotateCw className="w-3 h-3" />
              <span>{orientation === 'portrait' ? 'Rotate (SIGWINCH)' : 'Portrait'}</span>
            </button>
            <button
              onClick={onToggleSoftKeyboard}
              className={`py-1 px-2.5 rounded font-mono text-[11px] border flex items-center justify-center gap-1 transition-colors ${
                showSoftKeyboard ? 'bg-zinc-800 border-emerald-400 text-emerald-300 font-bold' : 'bg-zinc-900 border-zinc-800 text-slate-400 hover:text-white'
              }`}
              title="Toggle Termux extra keys touch bar"
            >
              <Keyboard className="w-3 h-3" />
              <span>Key Bar</span>
            </button>
          </div>
        </div>

        {/* Font Scaling */}
        <div className="space-y-1">
          <span className="text-slate-400 block">Font Scale:</span>
          <div className="flex items-center gap-1">
            {[11, 12, 14, 16].map((sz) => (
              <button
                key={sz}
                onClick={() => onChangeFontSize(sz)}
                className={`flex-1 py-1 rounded font-mono text-[11px] border transition-colors ${
                  fontSize === sz ? 'bg-zinc-800 border-cyan-400 text-cyan-300 font-bold' : 'bg-zinc-900 border-zinc-800 text-slate-400 hover:text-white'
                }`}
              >
                {sz}px
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
