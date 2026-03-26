// src/components/NodeInspector.jsx
import React from 'react';
import { Minus, X } from 'lucide-react';

export default function NodeInspector({
  node,
  isCollapsed = false,
  onClose,
  onMinimize,
  onRestore,
}) {
  if (!node) {
    return (
      <div className="h-full overflow-hidden bg-slate-800 text-sm">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-700 bg-slate-900 px-4 py-3 shadow-sm">
          <div>
            <div className="font-semibold text-slate-200">Node Inspector</div>
            <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-slate-500">
              Selected graph metadata
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isCollapsed ? (
              <button
                onClick={onRestore}
                className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-400 shadow-sm transition-all hover:bg-slate-700 hover:text-white"
                title="Restore Inspector"
              >
                <Minus className="h-4 w-4 rotate-180" />
              </button>
            ) : (
              <button
                onClick={onMinimize}
                className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-400 shadow-sm transition-all hover:bg-slate-700 hover:text-white"
                title="Minimize Inspector"
              >
                <Minus className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-400 shadow-sm transition-all hover:border-red-500/40 hover:bg-red-500/20 hover:text-white"
              title="Close Inspector"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="p-5 text-center text-slate-500 text-sm italic mt-10">
          Click a node on the graph to inspect its metadata.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-800 text-sm overflow-y-auto">
      <div className="sticky top-0 z-10 border-b border-slate-700 bg-slate-900 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-slate-200">Node Inspector</div>
            <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-slate-500">
              Selected graph metadata
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded border border-blue-500/30">
              {node.node_type}
            </span>
            {isCollapsed ? (
              <button
                onClick={onRestore}
                className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-400 shadow-sm transition-all hover:bg-slate-700 hover:text-white"
                title="Restore Inspector"
              >
                <Minus className="h-4 w-4 rotate-180" />
              </button>
            ) : (
              <button
                onClick={onMinimize}
                className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-400 shadow-sm transition-all hover:bg-slate-700 hover:text-white"
                title="Minimize Inspector"
              >
                <Minus className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-400 shadow-sm transition-all hover:border-red-500/40 hover:bg-red-500/20 hover:text-white"
              title="Close Inspector"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <div className="p-4">
        <div className="space-y-2">
            <div className="flex flex-col mb-1 border-b border-slate-700/50 pb-2">
                <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">ID / Key</span>
                <span className="text-slate-100 font-mono text-[13px] break-all">{node.node_id}</span>
            </div>
            {Object.entries(node.properties || {}).map(([key, val]) => (
                <div key={key} className="flex flex-col mb-1">
                    <span className="text-slate-500 text-xs font-medium">{key}</span>
                    <span className="text-slate-300 break-words leading-relaxed text-[13px]">{val !== null ? String(val) : 'null'}</span>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}
