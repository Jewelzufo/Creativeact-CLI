import React, { useState } from 'react';
import { Copy, Check, Download, FileCode, Terminal, ExternalLink, Archive } from 'lucide-react';
import JSZip from 'jszip';
import { PYTHON_FILES, PythonArtifact } from '../data/pythonFiles';

export const CodeViewer: React.FC = () => {
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  const activeFile: PythonArtifact = PYTHON_FILES[activeFileIndex] || PYTHON_FILES[0];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeFile.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleDownloadSingle = () => {
    const blob = new Blob([activeFile.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder('termux_ollama_cli');
      
      PYTHON_FILES.forEach((f) => {
        if (folder) {
          folder.file(f.name, f.code);
        }
      });

      // Add a README
      zip.file('README.md', `# Termux Ollama CLI
Resource-efficient, touch-friendly terminal application for Ollama within Termux on Android.

## Fast Install in Termux:
\`\`\`bash
pkg update && pkg install -y python
pip install --upgrade rich httpx
bash termux_ollama_cli/install_termux.sh
\`\`\`

## Run:
\`\`\`bash
python3 -m termux_ollama_cli.app
\`\`\`
`);

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'termux_ollama_cli.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to zip files', e);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
      {/* File Navigation Tabs */}
      <div className="flex items-center justify-between bg-zinc-900 border-b border-zinc-800 px-3 py-2 text-xs overflow-x-auto">
        <div className="flex items-center gap-1">
          {PYTHON_FILES.map((file, idx) => (
            <button
              key={file.name}
              onClick={() => setActiveFileIndex(idx)}
              className={`px-3 py-1.5 rounded font-mono text-xs transition-colors flex items-center gap-1.5 ${
                idx === activeFileIndex
                  ? 'bg-zinc-800 text-cyan-400 font-bold border border-zinc-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-zinc-800/50'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>{file.name}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 pl-2">
          <button
            onClick={handleDownloadZip}
            disabled={isZipping}
            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-xs flex items-center gap-1 transition-colors"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>{isZipping ? 'Zipping...' : 'Download ZIP'}</span>
          </button>
        </div>
      </div>

      {/* File Meta Header */}
      <div className="px-4 py-2 bg-zinc-900/60 border-b border-zinc-800/80 flex items-center justify-between text-xs">
        <div>
          <span className="font-mono text-slate-400">{activeFile.path}</span>
          <p className="text-[11px] text-slate-500">{activeFile.description}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-slate-200 text-xs flex items-center gap-1 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy Code'}</span>
          </button>
          <button
            onClick={handleDownloadSingle}
            className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-slate-200 text-xs transition-colors"
            title="Download this file"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Code Display Area */}
      <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-300 bg-black select-text">
        <pre className="whitespace-pre overflow-x-auto">
          <code>{activeFile.code}</code>
        </pre>
      </div>

      {/* Termux Fast Execution Helper Card */}
      <div className="p-3 bg-zinc-900 border-t border-zinc-800 text-xs space-y-1.5">
        <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
          <Terminal className="w-3.5 h-3.5" />
          <span>Run in Android Termux</span>
        </div>
        <div className="flex items-center justify-between bg-black rounded p-2 border border-zinc-800 font-mono text-[11px] text-slate-300">
          <code className="text-emerald-400 truncate">
            pip install rich httpx && python3 -m termux_ollama_cli.app
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText('pip install rich httpx && python3 -m termux_ollama_cli.app');
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="ml-2 text-slate-400 hover:text-white"
            title="Copy command"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
