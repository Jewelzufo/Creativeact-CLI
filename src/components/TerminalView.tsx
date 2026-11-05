import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, 
  Send, 
  Sparkles, 
  ArrowUp, 
  ArrowDown, 
  RotateCw, 
  Maximize2, 
  Minimize2, 
  Cpu, 
  Layers, 
  Download, 
  Check, 
  AlertTriangle,
  Play,
  Trash2,
  Bookmark
} from 'lucide-react';
import { OllamaModel, PromptTemplate, InferenceTelemetry, AppConfig, MenuState } from '../types';

interface TerminalViewProps {
  columns: number;
  orientation: 'portrait' | 'landscape';
  showSoftKeyboard: boolean;
  fontSize: number;
  onRotate: () => void;
  config: AppConfig;
  onUpdateConfig: (newConfig: Partial<AppConfig>) => void;
  models: OllamaModel[];
  onAddModel: (model: OllamaModel) => void;
  onDeleteModel: (name: string) => void;
  prompts: PromptTemplate[];
  onAddPrompt: (prompt: PromptTemplate) => void;
  onDeletePrompt: (id: string) => void;
  lastTelemetry: InferenceTelemetry | null;
  onRecordTelemetry: (telemetry: InferenceTelemetry) => void;
}

export const TerminalView: React.FC<TerminalViewProps> = ({
  columns,
  orientation,
  showSoftKeyboard,
  fontSize,
  onRotate,
  config,
  onUpdateConfig,
  models,
  onAddModel,
  onDeleteModel,
  prompts,
  onAddPrompt,
  onDeletePrompt,
  lastTelemetry,
  onRecordTelemetry,
}) => {
  const [menuState, setMenuState] = useState<MenuState>('main');
  const [logs, setLogs] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [currentSpeed, setCurrentSpeed] = useState<number | null>(null);
  
  // Model download simulation state
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState<{ status: string; percent: number; speed: string; downloadedMb: number; totalMb: number }>({
    status: 'idle',
    percent: 0,
    speed: '0 MB/s',
    downloadedMb: 0,
    totalMb: 0,
  });

  // Prompt running state
  const [activePromptTemplate, setActivePromptTemplate] = useState<PromptTemplate | null>(null);

  // New prompt input state
  const [newPromptForm, setNewPromptForm] = useState({ id: '', title: '', template: '', desc: '' });

  const terminalScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDark = config.theme === 'dark';
  const isNarrow = columns < 45;
  const isMid = columns < 65;

  // Auto-scroll on new content
  useEffect(() => {
    if (terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [logs, streamingText, pullProgress, menuState]);

  // Handle Menu Actions
  const handleMenuSelect = (choice: string) => {
    const trimmed = choice.trim().toLowerCase();

    if (menuState === 'main') {
      if (trimmed === '1') {
        setMenuState('chat');
        appendLog(`[bold cyan]─── Chat Session: [yellow]${config.active_model}[/yellow] ───[/bold cyan]`);
        appendLog(`[dim]Type your message below. Click [Back] or type ':q' to return to menu.[/dim]`);
      } else if (trimmed === '2') {
        setMenuState('models');
      } else if (trimmed === '3') {
        setMenuState('prompts');
      } else if (trimmed === '4') {
        setMenuState('metrics');
      } else if (trimmed === '5') {
        const nextTheme = isDark ? 'light' : 'dark';
        onUpdateConfig({ theme: nextTheme });
        appendLog(`[bold green]Theme switched to ${nextTheme.toUpperCase()} High-Contrast mode![/bold green]`);
      } else if (trimmed === '0') {
        appendLog(`[bold yellow]Session closed. Type 'clear' or press [1-5] to restart.[/bold yellow]`);
      } else if (trimmed === 'clear') {
        setLogs([]);
      }
    } else if (menuState === 'models') {
      if (trimmed === 'b' || trimmed === '0' || trimmed === ':q') {
        setMenuState('main');
      } else if (trimmed === 'p') {
        setMenuState('models_pull');
      } else if (trimmed.startsWith('s ') || !isNaN(Number(trimmed))) {
        const idx = Number(trimmed.replace('s', '').trim()) - 1;
        if (models[idx]) {
          const selected = models[idx].name;
          onUpdateConfig({ active_model: selected });
          appendLog(`[bold green]Active model set to '${selected}' in config.json![/bold green]`);
        }
      }
    } else if (menuState === 'prompts') {
      if (trimmed === 'b' || trimmed === '0' || trimmed === ':q') {
        setMenuState('main');
      } else if (trimmed === 'a') {
        setMenuState('prompts_add');
      } else if (trimmed.startsWith('r ') || !isNaN(Number(trimmed))) {
        const idx = Number(trimmed.replace('r', '').trim()) - 1;
        if (prompts[idx]) {
          setActivePromptTemplate(prompts[idx]);
          setMenuState('prompts_run');
        }
      }
    }
  };

  const appendLog = (msg: string) => {
    setLogs((prev) => [...prev, msg]);
  };

  // Submit Handler
  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isStreaming) return;

    const val = inputValue.trim();
    setInputValue('');

    if (menuState === 'main') {
      appendLog(`[dim]$[/dim] ${val}`);
      handleMenuSelect(val);
    } else if (menuState === 'chat') {
      if (val === ':q' || val === 'exit') {
        setMenuState('main');
        appendLog(`[dim]Exited chat session.[/dim]`);
        return;
      }
      executeChatStream(val);
    } else if (menuState === 'models_pull') {
      startPullModel(val);
    } else if (menuState === 'prompts_run') {
      if (!activePromptTemplate) return;
      const formatted = activePromptTemplate.template.replace('{input}', val);
      setMenuState('chat');
      executeChatStream(formatted);
    } else if (menuState === 'models' || menuState === 'prompts') {
      handleMenuSelect(val);
    }
  };

  // Execute Streaming Token Response Simulation
  const executeChatStream = (userPrompt: string) => {
    appendLog(`[bold cyan][user]>[/bold cyan] ${userPrompt}`);
    setIsStreaming(true);
    setStreamingText('');

    const startTime = performance.now();
    let generatedCount = 0;

    // Realistic token responses tailored for mobile Ollama models
    const sampleResponses = [
      `To optimize for Termux on Android:\n1. Keep context under 2048 tokens.\n2. Use quantized models (Q4_K_M) such as \`${config.active_model}\`.\n3. Run background daemons with \`termux-wake-lock\` to prevent OS killing.\n4. Leverage single-character key commands for seamless touch typing without virtual keyboard lag.`,
      `Here is a concise breakdown for **${config.active_model}**:\n- **Architecture**: Low-footprint lightweight transformer\n- **Target Runtime**: ARM64 Linux / Android Termux\n- **Memory Footprint**: ~1.1GB RAM\n- **Inference Speed**: ~18-35 tokens/sec on modern Snapdragon/Dimensity SoCs.`,
      `Here is the verified command:\n\`\`\`bash\npkg install python && pip install rich httpx\npython3 -m termux_ollama_cli.app\n\`\`\`\nThis sets up the interactive Rich CLI with automatic screen-rotation trapping (\`SIGWINCH\`) and compact mobile tables.`,
    ];

    const targetText = sampleResponses[Math.floor(Math.random() * sampleResponses.length)];
    const words = targetText.split(' ');
    let wordIdx = 0;

    const interval = setInterval(() => {
      if (wordIdx < words.length) {
        const nextWord = words[wordIdx] + ' ';
        setStreamingText((prev) => prev + nextWord);
        generatedCount += 1;
        wordIdx++;

        const elapsedSec = (performance.now() - startTime) / 1000;
        if (elapsedSec > 0) {
          setCurrentSpeed(Math.round((generatedCount / elapsedSec) * 10) / 10);
        }
      } else {
        clearInterval(interval);
        setIsStreaming(false);
        const endTime = performance.now();
        const evalDurationSec = (endTime - startTime) / 1000;
        const speed = Math.round((generatedCount / evalDurationSec) * 10) / 10;

        appendLog(`[bold green]assistant (${config.active_model}):[/bold green]\n${targetText}`);
        setStreamingText('');
        setCurrentSpeed(null);

        // Record real telemetry
        const telemetry: InferenceTelemetry = {
          eval_count: generatedCount,
          eval_duration_ns: Math.round(evalDurationSec * 1_000_000_000),
          eval_duration_sec: Math.round(evalDurationSec * 100) / 100,
          tokens_per_second: speed,
          load_duration_ms: Math.round(180 + Math.random() * 40),
          prompt_eval_count: Math.round(userPrompt.split(' ').length * 1.3),
          prompt_eval_duration_sec: 0.12,
          timestamp: new Date().toLocaleTimeString(),
        };
        onRecordTelemetry(telemetry);
        appendLog(`[dim]⚡ Telemetry: [bold green]${speed} t/s[/bold green] (${generatedCount} tokens in ${evalDurationSec.toFixed(2)}s)[/dim]`);
      }
    }, 45);
  };

  // Model Pull Streaming Simulation
  const startPullModel = (modelTag: string) => {
    setPullingModel(modelTag);
    let progress = 0;
    const totalMb = 1140; // 1.14 GB

    const interval = setInterval(() => {
      progress += 4;
      const downloaded = Math.round((progress / 100) * totalMb);
      const stage = 
        progress < 15 ? 'pulling manifest' :
        progress < 30 ? 'downloading digest' :
        progress < 85 ? `downloading sha256:${modelTag.slice(0, 8)}...` :
        progress < 95 ? 'verifying sha256 checksum' : 'writing manifest';

      setPullProgress({
        status: stage,
        percent: Math.min(progress, 100),
        speed: `${(18 + Math.random() * 6).toFixed(1)} MB/s`,
        downloadedMb: downloaded,
        totalMb: totalMb,
      });

      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          onAddModel({
            name: modelTag,
            size: totalMb * 1024 * 1024,
            modified_at: new Date().toISOString(),
            details: {
              family: modelTag.split(':')[0],
              parameter_size: modelTag.split(':')[1] || '1.5b',
              quantization_level: 'Q4_K_M',
            },
          });
          onUpdateConfig({ active_model: modelTag });
          setPullingModel(null);
          setMenuState('models');
          appendLog(`[bold green]✔ Model '${modelTag}' successfully pulled and set as active in config.json![/bold green]`);
        }, 500);
      }
    }, 70);
  };

  // Convert ANSI-like tags to styled React elements
  const formatTerminalText = (text: string) => {
    // Replace custom tags with styled spans
    let replaced = text
      .replace(/\[bold cyan\](.*?)\[\/bold cyan\]/g, '<span class="text-cyan-400 font-bold">$1</span>')
      .replace(/\[cyan\](.*?)\[\/cyan\]/g, '<span class="text-cyan-400">$1</span>')
      .replace(/\[bold yellow\](.*?)\[\/bold yellow\]/g, '<span class="text-amber-300 font-bold">$1</span>')
      .replace(/\[yellow\](.*?)\[\/yellow\]/g, '<span class="text-amber-300">$1</span>')
      .replace(/\[bold green\](.*?)\[\/bold green\]/g, '<span class="text-emerald-400 font-bold">$1</span>')
      .replace(/\[green\](.*?)\[\/green\]/g, '<span class="text-emerald-400">$1</span>')
      .replace(/\[bold red\](.*?)\[\/bold red\]/g, '<span class="text-rose-400 font-bold">$1</span>')
      .replace(/\[red\](.*?)\[\/red\]/g, '<span class="text-rose-400">$1</span>')
      .replace(/\[bold\](.*?)\[\/bold\]/g, '<span class="font-bold text-slate-100">$1</span>')
      .replace(/\[dim\](.*?)\[\/dim\]/g, '<span class="text-slate-500">$1</span>');

    return <span dangerouslySetInnerHTML={{ __html: replaced }} />;
  };

  return (
    <div className={`flex flex-col h-full border rounded-xl overflow-hidden shadow-2xl transition-all duration-200 ${
      isDark ? 'bg-black border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'
    }`}>
      {/* Termux Device Bar / Title */}
      <div className={`px-3 py-2 flex items-center justify-between border-b text-xs select-none ${
        isDark ? 'bg-zinc-950 border-slate-800' : 'bg-slate-200 border-slate-300'
      }`}>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono font-bold tracking-tight">
            termux@android:~ ({columns} cols × {orientation === 'portrait' ? '28' : '16'} rows)
          </span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
            isDark ? 'bg-zinc-800 text-amber-300' : 'bg-slate-300 text-amber-800'
          }`}>
            {config.active_model}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onRotate}
            title="Simulate Android Screen Rotation (SIGWINCH)"
            className={`p-1 rounded flex items-center gap-1 text-[11px] font-mono transition-colors ${
              isDark ? 'hover:bg-zinc-800 text-slate-300' : 'hover:bg-slate-300 text-slate-700'
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">SIGWINCH</span>
          </button>
          <button
            onClick={() => setLogs([])}
            title="Clear Terminal (clear)"
            className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${
              isDark ? 'hover:bg-zinc-800 text-slate-400' : 'hover:bg-slate-300 text-slate-600'
            }`}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Terminal Screen Canvas */}
      <div 
        ref={terminalScrollRef}
        style={{ fontSize: `${fontSize}px` }}
        className={`flex-1 p-3 font-mono overflow-y-auto leading-relaxed select-text space-y-2 ${
          isDark ? 'bg-black text-slate-300' : 'bg-white text-slate-800'
        }`}
      >
        {/* Termux Welcome Banner */}
        <div className="border border-dashed border-slate-700/60 rounded p-2.5 text-[11px] space-y-1">
          <div className="text-cyan-400 font-bold flex items-center justify-between">
            <span>◈ CreativeAct CLI v1.0.0</span>
            <span className="text-[10px] text-slate-500">Ollama: {config.host}</span>
          </div>
          <div className="text-slate-400 text-[10px]">
            Local Termux Ollama Platform · Touch-friendly Rich REPL · Adaptive Mobile Viewports
          </div>
        </div>

        {/* Terminal Header Bar */}
        <div className={`border rounded p-2 text-xs ${
          isDark ? 'border-cyan-900/60 bg-cyan-950/20' : 'border-blue-200 bg-blue-50/50'
        }`}>
          {isNarrow ? (
            <div className="font-bold text-cyan-400">
              ◈ CreativeAct CLI <span className="text-amber-300">({config.active_model})</span>
            </div>
          ) : isMid ? (
            <div className="space-y-0.5">
              <div className="font-bold text-cyan-400">◈ CreativeAct CLI — Local Termux Ollama Platform</div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Model: <strong className="text-amber-300">{config.active_model}</strong></span>
                <span>Host: <span className="text-cyan-400">{config.host}</span></span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="font-bold text-cyan-400">◈ CreativeAct CLI — Local Termux Ollama Platform</div>
                <div className="text-slate-400 text-[11px]">
                  Active Model: <strong className="text-amber-300">{config.active_model}</strong>
                </div>
              </div>
              <div className="text-right text-[11px] text-slate-400">
                <div>Theme: <strong className="text-slate-200">{config.theme.toUpperCase()}</strong></div>
                <div>Endpoint: <span className="text-cyan-400">{config.host}</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Menu Display if on Main Menu */}
        {menuState === 'main' && (
          <div className={`p-2 rounded border border-dashed text-xs ${
            isDark ? 'border-zinc-800 bg-zinc-950/40' : 'border-slate-200 bg-slate-100/50'
          }`}>
            <div className="font-bold text-slate-300 mb-1.5">Touch Menu Commands:</div>
            <div className={`grid gap-1.5 ${isNarrow ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3'}`}>
              <button 
                onClick={() => handleMenuSelect('1')}
                className="text-left px-2 py-1 rounded bg-slate-800/40 hover:bg-slate-700/60 border border-slate-700/50 transition-colors flex items-center justify-between"
              >
                <span><strong className="text-amber-300">[1]</strong> Chat Stream</span>
                <span className="text-[10px] text-slate-400">REPL</span>
              </button>
              <button 
                onClick={() => handleMenuSelect('2')}
                className="text-left px-2 py-1 rounded bg-slate-800/40 hover:bg-slate-700/60 border border-slate-700/50 transition-colors flex items-center justify-between"
              >
                <span><strong className="text-amber-300">[2]</strong> Models</span>
                <span className="text-[10px] text-emerald-400">Manage</span>
              </button>
              <button 
                onClick={() => handleMenuSelect('3')}
                className="text-left px-2 py-1 rounded bg-slate-800/40 hover:bg-slate-700/60 border border-slate-700/50 transition-colors flex items-center justify-between"
              >
                <span><strong className="text-amber-300">[3]</strong> Prompts</span>
                <span className="text-[10px] text-slate-400">{prompts.length} templates</span>
              </button>
              <button 
                onClick={() => handleMenuSelect('4')}
                className="text-left px-2 py-1 rounded bg-slate-800/40 hover:bg-slate-700/60 border border-slate-700/50 transition-colors flex items-center justify-between"
              >
                <span><strong className="text-amber-300">[4]</strong> Metrics</span>
                <span className="text-[10px] text-cyan-400">Telemetry</span>
              </button>
              <button 
                onClick={() => handleMenuSelect('5')}
                className="text-left px-2 py-1 rounded bg-slate-800/40 hover:bg-slate-700/60 border border-slate-700/50 transition-colors flex items-center justify-between"
              >
                <span><strong className="text-amber-300">[5]</strong> Theme</span>
                <span className="text-[10px] text-purple-400">{config.theme}</span>
              </button>
              <button 
                onClick={() => handleMenuSelect('0')}
                className="text-left px-2 py-1 rounded bg-slate-800/40 hover:bg-slate-700/60 border border-slate-700/50 transition-colors flex items-center justify-between"
              >
                <span><strong className="text-amber-300">[0]</strong> Exit</span>
                <span className="text-[10px] text-rose-400">Close</span>
              </button>
            </div>
          </div>
        )}

        {/* Models Management Sub-view */}
        {menuState === 'models' && (
          <div className="space-y-3 border border-cyan-800/50 rounded-lg p-3 bg-zinc-950/70">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="font-bold text-cyan-400 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-amber-300" />
                <span>Installed Models</span>
              </div>
              <button 
                onClick={() => setMenuState('main')} 
                className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-zinc-800"
              >
                [b] Back
              </button>
            </div>

            <div className="space-y-1.5">
              {models.map((model, idx) => {
                const isActive = model.name === config.active_model;
                return (
                  <div 
                    key={model.name}
                    className={`p-2 rounded border flex items-center justify-between text-xs transition-colors ${
                      isActive 
                        ? 'border-emerald-500/80 bg-emerald-950/20 text-emerald-200' 
                        : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-amber-300 font-bold">[{idx + 1}]</span>
                      <div>
                        <div className="font-bold flex items-center gap-1.5">
                          {model.name}
                          {isActive && (
                            <span className="text-[9px] bg-emerald-500 text-black font-bold px-1 rounded">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {(model.size / (1024 * 1024 * 1024)).toFixed(2)} GB · {model.details?.quantization_level || 'Q4_K_M'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {!isActive && (
                        <button
                          onClick={() => {
                            onUpdateConfig({ active_model: model.name });
                            appendLog(`[bold green]Active model set to '${model.name}' in config.json![/bold green]`);
                          }}
                          className="px-2 py-1 rounded bg-zinc-800 hover:bg-emerald-600 hover:text-black text-[10px] font-bold text-emerald-400 transition-colors"
                        >
                          Set Active
                        </button>
                      )}
                      {models.length > 1 && (
                        <button
                          onClick={() => {
                            onDeleteModel(model.name);
                            appendLog(`[yellow]Model '${model.name}' removed from local registry.[/yellow]`);
                          }}
                          className="p-1 rounded hover:bg-rose-950/60 text-slate-500 hover:text-rose-400"
                          title="Delete Model"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Model Action Quick Buttons */}
            <div className="pt-2 border-t border-zinc-800 flex items-center gap-2">
              <button
                onClick={() => setMenuState('models_pull')}
                className="flex-1 py-1.5 px-3 rounded bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>[p] Pull / Download New Model</span>
              </button>
            </div>
          </div>
        )}

        {/* Model Pull / Download View with Rich Progress Bar */}
        {menuState === 'models_pull' && (
          <div className="space-y-3 border border-amber-800/50 rounded-lg p-3 bg-zinc-950/80">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <Download className="w-4 h-4" />
                <span>Pull Model from Ollama Registry</span>
              </div>
              <button 
                onClick={() => { setPullingModel(null); setMenuState('models'); }} 
                className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-zinc-800"
              >
                Cancel
              </button>
            </div>

            {pullingModel ? (
              <div className="space-y-2 py-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-cyan-400">{pullingModel}</span>
                  <span className="text-amber-300 font-bold">{pullProgress.percent}%</span>
                </div>

                {/* Simulated Rich Progress Bar */}
                <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden border border-zinc-700">
                  <div 
                    className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full transition-all duration-100 ease-out"
                    style={{ width: `${pullProgress.percent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>{pullProgress.status}</span>
                  <span>{pullProgress.downloadedMb}MB / {pullProgress.totalMb}MB ({pullProgress.speed})</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-slate-400">
                  Select a mobile-optimized model or enter any custom Ollama model tag:
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { tag: 'llama3.2:1b', desc: '1.3GB · High speed on ARM' },
                    { tag: 'qwen2.5:1.5b', desc: '0.98GB · Superb reasoning' },
                    { tag: 'deepseek-r1:1.5b', desc: '1.1GB · Reasoning distillation' },
                    { tag: 'phi3:mini', desc: '2.2GB · Microsoft 3.8B' },
                  ].map((preset) => (
                    <button
                      key={preset.tag}
                      onClick={() => startPullModel(preset.tag)}
                      className="p-2 text-left rounded bg-zinc-900 border border-zinc-800 hover:border-cyan-500 transition-colors"
                    >
                      <div className="font-bold text-cyan-300 text-xs">{preset.tag}</div>
                      <div className="text-[10px] text-slate-400">{preset.desc}</div>
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-slate-500 text-center pt-1">
                  Or type custom tag in input below and hit Enter
                </div>
              </div>
            )}
          </div>
        )}

        {/* Prompts Management View */}
        {menuState === 'prompts' && (
          <div className="space-y-3 border border-purple-800/50 rounded-lg p-3 bg-zinc-950/70">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="font-bold text-purple-300 flex items-center gap-1.5">
                <Bookmark className="w-4 h-4" />
                <span>Prompt Store (~/.config/ollama-cli/prompts.json)</span>
              </div>
              <button 
                onClick={() => setMenuState('main')} 
                className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-zinc-800"
              >
                [b] Back
              </button>
            </div>

            <div className="space-y-1.5">
              {prompts.map((p, idx) => (
                <div 
                  key={p.id}
                  className="p-2 rounded border border-zinc-800 bg-zinc-900/50 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-200">
                      <span className="text-amber-300 mr-1.5">[{idx + 1}]</span>
                      {p.title}
                    </div>
                    <div className="text-[10px] text-slate-400">{p.description}</div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setActivePromptTemplate(p);
                        setMenuState('prompts_run');
                      }}
                      className="px-2 py-1 rounded bg-purple-900/40 hover:bg-purple-800 text-purple-200 text-[10px] font-bold flex items-center gap-1"
                    >
                      <Play className="w-3 h-3" /> Run
                    </button>
                    {prompts.length > 2 && (
                      <button
                        onClick={() => onDeletePrompt(p.id)}
                        className="p-1 rounded hover:bg-rose-950 text-slate-500 hover:text-rose-400"
                        title="Delete Prompt"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setMenuState('prompts_add')}
              className="w-full py-1.5 rounded bg-purple-900/60 hover:bg-purple-800 text-purple-200 font-bold text-xs"
            >
              + Add New Prompt Template
            </button>
          </div>
        )}

        {/* Prompt Run Input View */}
        {menuState === 'prompts_run' && activePromptTemplate && (
          <div className="space-y-2 border border-purple-600/50 rounded-lg p-3 bg-zinc-950/80">
            <div className="font-bold text-purple-300 text-xs flex items-center justify-between">
              <span>Execute Template: {activePromptTemplate.title}</span>
              <button 
                onClick={() => setMenuState('prompts')}
                className="text-[10px] text-slate-400 bg-zinc-800 px-2 py-0.5 rounded"
              >
                Cancel
              </button>
            </div>
            <div className="text-[10px] text-slate-400 font-mono bg-zinc-900 p-2 rounded">
              {activePromptTemplate.template}
            </div>
            <div className="text-xs text-amber-300">
              Provide input for `{'{input}'}` in the command line below:
            </div>
          </div>
        )}

        {/* Prompts Add Form View */}
        {menuState === 'prompts_add' && (
          <div className="space-y-2 border border-purple-600/50 rounded-lg p-3 bg-zinc-950/80 text-xs">
            <div className="font-bold text-purple-300">Add New Prompt Template</div>
            <div className="space-y-1.5">
              <input
                placeholder="ID (e.g., debug_python)"
                value={newPromptForm.id}
                onChange={(e) => setNewPromptForm({ ...newPromptForm, id: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-slate-200"
              />
              <input
                placeholder="Title (e.g., Python Debugger)"
                value={newPromptForm.title}
                onChange={(e) => setNewPromptForm({ ...newPromptForm, title: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-slate-200"
              />
              <input
                placeholder="Short Description"
                value={newPromptForm.desc}
                onChange={(e) => setNewPromptForm({ ...newPromptForm, desc: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-slate-200"
              />
              <textarea
                placeholder="Template text with {input} placeholder..."
                rows={3}
                value={newPromptForm.template}
                onChange={(e) => setNewPromptForm({ ...newPromptForm, template: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-slate-200 font-mono"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  if (newPromptForm.id && newPromptForm.title && newPromptForm.template) {
                    onAddPrompt({
                      id: newPromptForm.id,
                      title: newPromptForm.title,
                      template: newPromptForm.template,
                      description: newPromptForm.desc || newPromptForm.title,
                    });
                    setNewPromptForm({ id: '', title: '', template: '', desc: '' });
                    setMenuState('prompts');
                  }
                }}
                className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold"
              >
                Save Prompt
              </button>
              <button
                onClick={() => setMenuState('prompts')}
                className="px-3 py-1 bg-zinc-800 text-slate-300 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Metrics View (Grounded telemetry with strict N/A fallback) */}
        {menuState === 'metrics' && (
          <div className="space-y-3 border border-blue-800/50 rounded-lg p-3 bg-zinc-950/70">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="font-bold text-cyan-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Inference Telemetry Panel</span>
              </div>
              <button 
                onClick={() => setMenuState('main')} 
                className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-zinc-800"
              >
                [b] Back
              </button>
            </div>

            {lastTelemetry ? (
              <div className="space-y-2">
                {isNarrow ? (
                  // Compact vertical stack for < 45 cols
                  <div className="space-y-1 text-xs font-mono">
                    <div className="flex justify-between border-b border-zinc-800/60 py-0.5">
                      <span className="text-slate-400">Tokens:</span>
                      <span className="font-bold text-emerald-400">{lastTelemetry.eval_count ?? 'N/A'}</span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-800/60 py-0.5">
                      <span className="text-slate-400">Eval Time:</span>
                      <span className="font-bold text-amber-300">
                        {lastTelemetry.eval_duration_sec !== null ? `${lastTelemetry.eval_duration_sec}s` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-800/60 py-0.5">
                      <span className="text-slate-400">Speed:</span>
                      <span className="font-bold text-emerald-400">
                        {lastTelemetry.tokens_per_second !== null ? `${lastTelemetry.tokens_per_second} t/s` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-zinc-800/60 py-0.5">
                      <span className="text-slate-400">Model Load:</span>
                      <span className="font-bold text-cyan-300">
                        {lastTelemetry.load_duration_ms !== null ? `${lastTelemetry.load_duration_ms}ms` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-400">Prompt Tokens:</span>
                      <span className="font-bold text-slate-300">{lastTelemetry.prompt_eval_count ?? 'N/A'}</span>
                    </div>
                  </div>
                ) : (
                  // Full Table for >= 45 cols
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-700 text-cyan-400 text-left">
                          <th className="py-1">Metric Key</th>
                          <th className="py-1 text-right">Value</th>
                          <th className="py-1 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        <tr>
                          <td className="py-1 text-slate-300">Tokens Generated (eval_count)</td>
                          <td className="py-1 text-right font-bold text-emerald-400">{lastTelemetry.eval_count ?? 'N/A'}</td>
                          <td className="py-1 text-center text-[10px] text-emerald-500">Live</td>
                        </tr>
                        <tr>
                          <td className="py-1 text-slate-300">Eval Duration</td>
                          <td className="py-1 text-right font-bold text-amber-300">
                            {lastTelemetry.eval_duration_sec !== null ? `${lastTelemetry.eval_duration_sec} s` : 'N/A'}
                          </td>
                          <td className="py-1 text-center text-[10px] text-emerald-500">Live</td>
                        </tr>
                        <tr>
                          <td className="py-1 text-slate-300">Speed (Tokens / sec)</td>
                          <td className="py-1 text-right font-bold text-emerald-400">
                            {lastTelemetry.tokens_per_second !== null ? `${lastTelemetry.tokens_per_second} t/s` : 'N/A'}
                          </td>
                          <td className="py-1 text-center text-[10px] text-emerald-500">Live</td>
                        </tr>
                        <tr>
                          <td className="py-1 text-slate-300">Model Load Duration</td>
                          <td className="py-1 text-right font-bold text-cyan-300">
                            {lastTelemetry.load_duration_ms !== null ? `${lastTelemetry.load_duration_ms} ms` : 'N/A'}
                          </td>
                          <td className="py-1 text-center text-[10px] text-emerald-500">Live</td>
                        </tr>
                        <tr>
                          <td className="py-1 text-slate-300">Prompt Tokens</td>
                          <td className="py-1 text-right font-bold text-slate-300">
                            {lastTelemetry.prompt_eval_count ?? 'N/A'}
                          </td>
                          <td className="py-1 text-center text-[10px] text-emerald-500">Live</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="text-[10px] text-slate-500 italic pt-1">
                  * Grounding Notice: All telemetry values are directly extracted from Ollama inference headers. Unreported fields render strictly as N/A.
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-3 text-center">
                No telemetry recorded yet. Start a Chat session [1] to generate tokens.
              </div>
            )}
          </div>
        )}

        {/* Render Terminal Logs */}
        <div className="space-y-1.5 pt-1">
          {logs.map((log, index) => (
            <div key={index} className="whitespace-pre-wrap break-words text-xs">
              {formatTerminalText(log)}
            </div>
          ))}

          {/* Live Streaming Response Chunk */}
          {isStreaming && (
            <div className="space-y-1">
              <div className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                <span>assistant ({config.active_model}):</span>
                {currentSpeed !== null && (
                  <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800">
                    {currentSpeed} t/s
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-200 whitespace-pre-wrap break-words">
                {streamingText}
                <span className="inline-block w-2 h-4 bg-emerald-400 ml-0.5 animate-pulse" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Terminal Input Bar */}
      <form 
        onSubmit={handleInputSubmit}
        className={`px-3 py-2 border-t flex items-center gap-2 ${
          isDark ? 'bg-zinc-950 border-slate-800' : 'bg-slate-100 border-slate-300'
        }`}
      >
        <span className="font-mono text-emerald-400 font-bold text-xs select-none">$</span>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={isStreaming}
          placeholder={
            menuState === 'main' 
              ? 'Enter choice [0-5] or type command...' 
              : menuState === 'chat' 
              ? 'Ask message or :q to exit...' 
              : menuState === 'models_pull'
              ? 'Enter model tag to download...'
              : 'Enter input...'
          }
          className={`flex-1 bg-transparent border-none outline-none font-mono text-xs ${
            isDark ? 'text-slate-100 placeholder-zinc-600' : 'text-slate-900 placeholder-slate-400'
          }`}
        />
        <button
          type="submit"
          disabled={isStreaming || !inputValue.trim()}
          className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-black transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Android Termux Extra Keys Soft-Keyboard Bar */}
      {showSoftKeyboard && (
        <div className={`px-2 py-1.5 border-t flex items-center justify-between text-[11px] font-mono select-none overflow-x-auto ${
          isDark ? 'bg-zinc-900 border-zinc-800 text-slate-300' : 'bg-slate-200 border-slate-300 text-slate-700'
        }`}>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => handleMenuSelect('1')} 
              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 font-bold text-amber-300"
            >
              [1]
            </button>
            <button 
              onClick={() => handleMenuSelect('2')} 
              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 font-bold text-amber-300"
            >
              [2]
            </button>
            <button 
              onClick={() => handleMenuSelect('3')} 
              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 font-bold text-amber-300"
            >
              [3]
            </button>
            <button 
              onClick={() => handleMenuSelect('4')} 
              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 font-bold text-amber-300"
            >
              [4]
            </button>
            <button 
              onClick={() => handleMenuSelect('5')} 
              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 font-bold text-amber-300"
            >
              [5]
            </button>
            <button 
              onClick={() => handleMenuSelect('0')} 
              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 font-bold text-rose-400"
            >
              [0]
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button 
              onClick={() => { setMenuState('main'); appendLog('[dim]Returned to main menu.[/dim]'); }}
              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 font-mono text-[10px]"
            >
              ESC
            </button>
            <button 
              onClick={() => setInputValue((prev) => prev + ' ')}
              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 font-mono text-[10px]"
            >
              TAB
            </button>
            <button 
              onClick={() => {
                if (terminalScrollRef.current) {
                  terminalScrollRef.current.scrollTop -= 80;
                }
              }}
              className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700"
            >
              <ArrowUp className="w-3 h-3" />
            </button>
            <button 
              onClick={() => {
                if (terminalScrollRef.current) {
                  terminalScrollRef.current.scrollTop += 80;
                }
              }}
              className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700"
            >
              <ArrowDown className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
