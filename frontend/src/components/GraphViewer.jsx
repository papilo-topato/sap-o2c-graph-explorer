// src/components/GraphViewer.jsx
import React, { useEffect, useRef, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import axios from 'axios';
import { Download, ZoomIn, ZoomOut, Maximize, ChevronDown, ChevronUp } from 'lucide-react';
import * as d3 from 'd3-force';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Disable SSR for WebGL Force Graph
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

export default function GraphViewer({ graphData, setGraphData, onNodeSelect, highlightIds, searchedNodeId }) {
  const fgRef = useRef();

  // UX Interaction States
  const [hoverNode, setHoverNode] = useState(null);
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [isLegendOpen, setIsLegendOpen] = useState(true);

  const getNodeColor = (node) => {
    switch (node.node_type) {
      case 'SalesOrder': return '#3b82f6'; // Blue
      case 'Delivery': return '#14b8a6'; // Teal
      case 'Invoice': return '#f59e0b'; // Amber
      case 'Payment': return '#10b981'; // Green
      case 'Customer': return '#8b5cf6'; // Purple
      case 'Product': return '#8b5cf6'; // Purple
      default: return '#9ca3af'; // Gray
    }
  };

  const getLinkColor = (link) => {
    // Subtle colors per flow logic if desired, defaulting for now
    return 'rgba(100, 116, 139, 0.4)'; // slate-500 equivalent but translucent
  };

  const updateHighlight = () => {
    setHighlightNodes(highlightNodes);
    setHighlightLinks(highlightLinks);
  };

  const handleNodeHover = node => {
    setHoverNode(node || null);

    highlightNodes.clear();
    highlightLinks.clear();
    if (node) {
      highlightNodes.add(node);
      // Pre-compute neighbors for the dimming effect
      graphData.links.forEach(link => {
        const s = typeof link.source === 'object' ? link.source.node_id : link.source;
        const t = typeof link.target === 'object' ? link.target.node_id : link.target;
        if (s === node.node_id || t === node.node_id) {
          highlightLinks.add(link);
          highlightNodes.add(typeof link.source === 'object' ? link.source : graphData.nodes.find(n => n.node_id === s));
          highlightNodes.add(typeof link.target === 'object' ? link.target : graphData.nodes.find(n => n.node_id === t));
        }
      });
    }
    updateHighlight();
  };

  const handleLinkHover = link => {
    highlightNodes.clear();
    highlightLinks.clear();
    if (link) {
      highlightLinks.add(link);
      highlightNodes.add(typeof link.source === 'object' ? link.source : graphData.nodes.find(n => n.node_id === link.source));
      highlightNodes.add(typeof link.target === 'object' ? link.target : graphData.nodes.find(n => n.node_id === link.target));
    }
    updateHighlight();
  };

  const handleNodeClick = useCallback((node) => {
    onNodeSelect(node);
    
    // Zoom and highlight the specific sub-graph automatically!
    if (fgRef.current) {
        fgRef.current.centerAt(node.x, node.y, 800);
        fgRef.current.zoom(3, 800);
    }
    
    // Fetch neighbors to expand the graph dynamically
    axios.get(`${API_URL}/api/graph/neighbors/${node.node_id}`)
      .then(res => {
        const { nodes: newNodes, links: newLinks } = res.data;
        
        setGraphData(prev => {
          // Merge avoiding duplicates
          const nodeIds = new Set(prev.nodes.map(n => n.node_id));
          const addedNodes = newNodes.filter(n => !nodeIds.has(n.node_id));
          
          const linkIds = new Set(prev.links.map(l => typeof l.source === 'object' ? `${l.source.node_id}-${l.target.node_id}` : `${l.source}-${l.target}`));
          const addedLinks = newLinks.filter(l => !linkIds.has(`${l.source_id}-${l.target_id}`));
          
          const mappedLinks = addedLinks.map(l => ({ ...l, source: l.source_id, target: l.target_id }));

          return {
            nodes: [...prev.nodes, ...addedNodes],
            links: [...prev.links, ...mappedLinks]
          };
        });
      })
      .catch(err => console.error("Failed to load neighbors", err));
  }, [setGraphData, onNodeSelect]);

  useEffect(() => {
    if (fgRef.current) {
        // Redefined Forward Deployed Engineer specific clustering constraints
        fgRef.current.d3Force('charge').strength(-150);
        fgRef.current.d3Force('link').distance(20);
        fgRef.current.d3Force('collide', d3.forceCollide().radius(25));
        fgRef.current.d3Force('x', d3.forceX(0).strength(0.08));
        fgRef.current.d3Force('y', d3.forceY(0).strength(0.08));
    }
  }, [graphData]); // Re-trigger on data load

  useEffect(() => {
    if (searchedNodeId && fgRef.current && graphData.nodes.length > 0) {
        const targetNode = graphData.nodes.find(n => n.node_id === searchedNodeId);
        if (targetNode) {
            fgRef.current.centerAt(targetNode.x, targetNode.y, 1000);
            fgRef.current.zoom(4, 1000);
            onNodeSelect(targetNode);
        } else {
            handleNodeClick({ node_id: searchedNodeId, node_type: 'Searched', label: 'Searched Node' });
        }
    }
  }, [searchedNodeId, graphData.nodes, handleNodeClick, onNodeSelect]);

  const handleZoomIn = () => fgRef.current && fgRef.current.zoom(fgRef.current.zoom() * 1.5, 400);
  const handleZoomOut = () => fgRef.current && fgRef.current.zoom(fgRef.current.zoom() / 1.5, 400);
  const handleFitAll = () => fgRef.current && fgRef.current.zoomToFit(800, 50);

  return (
    <div className="w-full h-full bg-[#0b1120] relative group">
        
      {/* Background Mask - Gentle Radial Gradient */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.05)_0%,rgba(11,17,32,1)_100%)] z-0"></div>

      {/* Visual Legend (Collapsible) */}
      <div className="absolute top-4 right-4 z-10 bg-slate-900/90 p-3 rounded-xl border border-slate-700/80 backdrop-blur-md shadow-2xl text-xs select-none min-w-[160px] transition-all duration-300">
        <div className="font-bold text-slate-200 border-b border-slate-700/60 pb-2 mb-2 flex justify-between items-center cursor-pointer" onClick={() => setIsLegendOpen(!isLegendOpen)}>
            <div className="flex items-center space-x-2">
                {isLegendOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span>Graph Legend</span>
            </div>
            <button 
                onClick={(e) => { e.stopPropagation(); if(fgRef.current && fgRef.current.exportImg) fgRef.current.exportImg(); }} 
                className="bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-white p-1.5 rounded transition-colors ring-1 ring-slate-600/50"
                title="Export Image"
            >
                <Download className="w-3.5 h-3.5" />
            </button>
        </div>
        
        {isLegendOpen && (
            <div className="space-y-2.5 pt-1 mt-2 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-blue-500 mr-2 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></span><span className="text-slate-300 font-medium">Sales Order</span></div>
                <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-teal-500 mr-2 shadow-[0_0_8px_rgba(20,184,166,0.6)]"></span><span className="text-slate-300 font-medium">Delivery</span></div>
                <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-amber-500 mr-2 shadow-[0_0_8px_rgba(245,158,11,0.6)]"></span><span className="text-slate-300 font-medium">Invoice</span></div>
                <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-emerald-500 mr-2 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span><span className="text-slate-300 font-medium">Payment</span></div>
                <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-purple-500 mr-2 shadow-[0_0_8px_rgba(139,92,246,0.6)]"></span><span className="text-slate-300 font-medium">Customer / Item</span></div>
            </div>
        )}
      </div>

      {/* Floating Zoom Controls Overlay */}
      <div className="absolute bottom-6 left-4 z-10 flex flex-col space-y-2 bg-slate-900/80 p-1.5 rounded-lg border border-slate-700/80 backdrop-blur-md shadow-xl">
         <button onClick={handleZoomIn} className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"><ZoomIn className="w-4 h-4" /></button>
         <button onClick={handleZoomOut} className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"><ZoomOut className="w-4 h-4" /></button>
         <div className="h-px bg-slate-700 w-full"></div>
         <button onClick={handleFitAll} className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 hover:text-blue-400 transition-colors" title="Fit to Screen"><Maximize className="w-4 h-4" /></button>
      </div>

      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        nodeId="node_id"
        nodeRelSize={8}
        
        // Edge Polish
        linkWidth={link => highlightLinks.has(link) ? 3 : 1.5}
        linkColor={link => highlightLinks.has(link) ? '#60a5fa' : getLinkColor(link)}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        linkCurvature={0.2}

        // Subgraph Hover Dimming
        nodeColor={node => {
            const isDimmed = hoverNode && !highlightNodes.has(node);
            const baseColor = getNodeColor(node);
            return isDimmed ? '#334155' : baseColor; // dim inactive nodes to dark slate
        }}
        
        d3VelocityDecay={0.3}
        warmupTicks={50}
        onEngineStop={() => fgRef.current.zoomToFit(1000, 60)}

        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onLinkHover={handleLinkHover}

        // We disable default native tooltips completely because we are building a custom HTML React div instead
        nodeLabel={() => ''}
        
        nodeCanvasObjectMode={() => 'after'}
        nodeCanvasObject={(node, ctx, globalScale) => {
          // Draw Pulse/Glow Ring for Searched & LLM Extracted IDs
          const isTargeted = (searchedNodeId && searchedNodeId === node.node_id) || (highlightIds && highlightIds.includes(String(node.node_id)));
          if (isTargeted) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, 14, 0, 2 * Math.PI, false);
            ctx.fillStyle = 'rgba(239, 68, 68, 0.2)'; 
            ctx.fill();
            
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = '#ef4444'; // Red outer ping barrier
            ctx.stroke();
          }
          
          // Force Node Labels explicitly on the canvas
          const isDimmed = hoverNode && !highlightNodes.has(node);
          if (!isDimmed && (globalScale >= 2 || hoverNode === node)) {
            const label = String(node.label).substring(0, 20); // truncate super long titles
            const fontSize = Math.max(12 / globalScale, 4);
            ctx.font = `${fontSize}px Inter, Sans-Serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            
            // Add tiny background pill to text for readability over complex edges
            const textWidth = ctx.measureText(label).width;
            const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.4);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
            ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y + 10, bckgDimensions[0], bckgDimensions[1]);
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillText(label, node.x, node.y + (10 + fontSize * 0.2));
          }
        }}
      />
      
      {/* HTML Hover Tooltip (Extremely fast, zero WebGL clipping issues) */}
      {hoverNode && (
          <div className="absolute z-50 pointer-events-none bg-slate-900/95 backdrop-blur shadow-2xl border border-slate-700/80 rounded-xl p-4 min-w-[200px] animate-in fade-in zoom-in-95 duration-150"
               style={{ top: '24px', left: '24px' }}>
              <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">{hoverNode.node_type}</div>
              <div className="text-[15px] font-semibold text-white mb-0.5">{hoverNode.label}</div>
              <div className="text-xs font-mono text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded max-w-fit">{hoverNode.node_id}</div>
          </div>
      )}
    </div>
  );
}
