'use client';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search } from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import GraphViewer from '@/components/GraphViewer';
import ChatPanel from '@/components/ChatPanel';
import NodeInspector from '@/components/NodeInspector';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Error Boundary definition
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Graph Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-slate-900 text-slate-300">
            <h2 className="text-xl font-bold text-red-400 mb-2">Graph Rendering Error</h2>
            <p>The visual graph encountered an error and crashed. Try reloading the page.</p>
            <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors shadow-lg">Reload Page</button>
        </div>
      );
    }
    return this.props.children; 
  }
}

export default function Home() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [highlightIds, setHighlightIds] = useState([]);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchedNodeId, setSearchedNodeId] = useState(null);

  // Search logic
  useEffect(() => {
    if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
    }
    const timer = setTimeout(() => {
        axios.get(`${API_URL}/api/search?q=${encodeURIComponent(searchQuery)}`)
            .then(res => setSearchResults(res.data.results))
            .catch(err => console.error(err));
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    // Only fetch exactly 50 nodes as per instructions
    axios.get(`${API_URL}/api/graph/init`)
      .then(res => {
        const { nodes, links } = res.data;
        // force-graph requires 'source' and 'target' keys to match 'node_id' strictly.
        const mappedLinks = links.map(l => ({ ...l, source: l.source_id, target: l.target_id }));
        setGraphData({ nodes, links: mappedLinks });
      })
      .catch(err => {
        console.error("Failed to fetch initial graph", err);
        setError("Could not connect to the Python Backend API. Make sure Uvicorn is running on :8000.");
      });
  }, []);

  return (
    <main className="w-screen h-screen flex flex-col overflow-hidden bg-slate-900 font-sans text-slate-100 selection:bg-blue-500/30">
      
      {/* THIN HEADER BAR */}
      <header className="h-14 shrink-0 bg-[#0f172a] border-b border-slate-700/50 flex items-center px-6 justify-between shadow-sm z-50">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
             <span className="font-bold text-white text-lg leading-none">O</span>
          </div>
          <h1 className="text-[19px] font-bold bg-gradient-to-r from-blue-400 via-teal-400 to-emerald-400 text-transparent bg-clip-text tracking-tight">O2C Explorer</h1>
        </div>
        <div className="text-xs text-slate-500 font-medium tracking-wide">FORWARD DEPLOYED ENGINEER EDITION</div>
      </header>
      
      <div className="flex-1 w-full overflow-hidden">
        <PanelGroup direction="horizontal">
            {/* LEFT PANEL - GRAPH */}
            <Panel defaultSize={60} minSize={30}>
              <div className="w-full h-full relative flex flex-col bg-[#0b1120] overflow-hidden">
                  
                  {error && (
                      <div className="absolute top-4 left-4 z-50 bg-red-900/90 text-white px-5 py-3 rounded-lg border border-red-500 shadow-2xl backdrop-blur-sm animate-in fade-in slide-in-from-top-4">
                          <span className="font-semibold block mb-1">Backend Connection Error</span>
                          <span className="text-sm text-red-200">{error}</span>
                      </div>
                  )}
                  
                  {/* SEARCH BAR OVERLAY (CENTERED) */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-[420px] transition-all">
                      <div className="relative group">
                          <input 
                             type="text" 
                             value={searchQuery}
                             onChange={e => setSearchQuery(e.target.value)}
                             placeholder="Search nodes (e.g. 'TechCorp', '900012')..."
                             className="w-full bg-slate-800/80 border border-slate-600/50 rounded-full px-5 py-2.5 pl-11 text-[14px] text-white focus:outline-none focus:border-blue-500/50 focus:bg-slate-800 focus:ring-4 focus:ring-blue-500/20 shadow-xl backdrop-blur-md transition-all"
                          />
                          <Search className="absolute left-4 top-3 h-[18px] w-[18px] text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                      </div>
                      {searchResults.length > 0 && (
                          <div className="absolute top-full mt-2 w-full bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-68 overflow-y-auto animate-in fade-in slide-in-from-top-2 z-50 ring-1 ring-black/50">
                              {searchResults.map(res => (
                                  <div 
                                     key={res.node_id} 
                                     onClick={() => {
                                         setSearchedNodeId(res.node_id);
                                         setSearchQuery('');
                                         setSearchResults([]);
                                     }}
                                     className="px-5 py-3.5 hover:bg-slate-700/80 cursor-pointer flex flex-col border-b border-slate-700/50 last:border-0 group transition-colors"
                                  >
                                      <span className="text-white text-[13px] font-medium truncate group-hover:text-blue-400 transition-colors">{res.label}</span>
                                      <span className="text-slate-400 text-[11px] font-mono mt-1 opacity-80">{res.node_type} · {res.node_id}</span>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
                  
                  <ErrorBoundary>
                    <GraphViewer 
                        graphData={graphData} 
                        setGraphData={setGraphData} 
                        onNodeSelect={setSelectedNode} 
                        highlightIds={highlightIds} 
                        searchedNodeId={searchedNodeId}
                    />
                  </ErrorBoundary>
              </div>
            </Panel>
            
            {/* DRUG HANDLE */}
            <PanelResizeHandle className="w-1 bg-slate-800 hover:bg-blue-500 transition-colors cursor-col-resize z-50" />
            
            {/* RIGHT PANEL - CHAT & INSPECTOR */}
            <Panel defaultSize={40} minSize={20}>
              <div className="w-full flex flex-col h-full bg-[#1e293b] shadow-2xl relative z-20 overflow-hidden ring-1 ring-white/5">
                  <div className="flex-[3] overflow-hidden flex flex-col min-h-0 bg-[#0f172a]">
                    <ChatPanel setHighlightIds={setHighlightIds} />
                  </div>
                  
                  <div className="h-72 shrink-0 flex flex-col shadow-[0_-8px_20px_rgba(0,0,0,0.4)] z-30 border-t border-slate-700/80">
                    <NodeInspector node={selectedNode} />
                  </div>
              </div>
            </Panel>
        </PanelGroup>
      </div>
      
    </main>
  );
}
