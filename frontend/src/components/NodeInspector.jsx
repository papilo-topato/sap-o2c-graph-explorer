// src/components/NodeInspector.jsx
import React from 'react';

export default function NodeInspector({ node }) {
  if (!node) {
    return (
      <div className="p-5 text-center text-slate-500 text-sm italic mt-10">
        Click a node on the graph to inspect its metadata.
      </div>
    );
  }

  return (
    <div className="h-64 border-t border-slate-700 bg-slate-800 text-sm overflow-y-auto">
      <div className="sticky top-0 bg-slate-900 px-4 py-2 border-b border-slate-700 font-semibold text-slate-300 flex justify-between items-center shadow-sm">
        <span>Node Inspector</span>
        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded border border-blue-500/30">
            {node.node_type}
        </span>
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
