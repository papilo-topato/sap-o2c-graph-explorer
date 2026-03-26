// src/components/GraphViewer.jsx
import React, { useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import axios from 'axios';
import { Download } from 'lucide-react';
import * as d3 from 'd3-force';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Disable SSR for WebGL Force Graph
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

export default function GraphViewer({ graphData, setGraphData, onNodeSelect, highlightIds, searchedNodeId }) {
  const fgRef = useRef();

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

  const handleNodeClick = useCallback((node) => {
    onNodeSelect(node);
    
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
          
          // react-force-graph links use source/target instead of source_id/target_id
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
    // Smooth the visual movement per user instruction
    if (fgRef.current) {
        fgRef.current.d3Force('charge').strength(-400);
        fgRef.current.d3Force('link').distance(20);
        fgRef.current.d3Force('center', d3.forceCenter(0, 0));
    }
  }, [graphData]); // Re-trigger on data load

  useEffect(() => {
    if (searchedNodeId && fgRef.current && graphData.nodes.length > 0) {
        const targetNode = graphData.nodes.find(n => n.node_id === searchedNodeId);
        if (targetNode) {
            // Node is visible, fly to it
            fgRef.current.centerAt(targetNode.x, targetNode.y, 1000);
            fgRef.current.zoom(4, 1000);
            onNodeSelect(targetNode);
        } else {
            // Node not yet expanded into canvas, mock a click to fetch neighbors and expand
            handleNodeClick({ node_id: searchedNodeId, node_type: 'Searched', label: 'Searched Node' });
        }
    }
  }, [searchedNodeId, graphData.nodes, handleNodeClick, onNodeSelect]);

  return (
    <div className="w-full h-full bg-[#0b1120] overflow-hidden relative border-r border-slate-700/50 group">
      {/* Visual Legend */}
      <div className="absolute top-4 right-4 z-10 bg-slate-900/80 p-3 rounded-lg border border-slate-700 backdrop-blur-sm shadow-xl text-xs space-y-2 select-none pointers-events-none">
        <div className="font-semibold text-slate-300 border-b border-slate-700 pb-1 mb-1 flex justify-between items-center">
            <span>Graph Legend</span>
            <button 
                onClick={() => { if(fgRef.current && fgRef.current.exportImg) fgRef.current.exportImg(); }} 
                className="pointer-events-auto shrink-0 bg-slate-800 hover:bg-slate-700 text-slate-300 p-1 rounded transition-colors ml-4 ring-1 ring-slate-600 outline-none"
                title="Export Image"
            >
                <Download className="w-3.5 h-3.5" />
            </button>
        </div>
        <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-blue-500 mr-2"></span><span className="text-slate-300">Sales Order</span></div>
        <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-teal-500 mr-2"></span><span className="text-slate-300">Delivery</span></div>
        <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-amber-500 mr-2"></span><span className="text-slate-300">Invoice</span></div>
        <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-emerald-500 mr-2"></span><span className="text-slate-300">Payment</span></div>
        <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-purple-500 mr-2"></span><span className="text-slate-300">Customer / Item</span></div>
      </div>

      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        nodeId="node_id"
        nodeLabel={(node) => `Type: ${node.node_type}\nID: ${node.node_id}\nLabel: ${node.label}`}
        nodeColor={getNodeColor}
        nodeRelSize={6}
        linkWidth={1.5}
        linkColor={() => 'rgba(71, 85, 105, 0.4)'}
        d3VelocityDecay={0.3}
        warmupTicks={100}
        onNodeClick={handleNodeClick}
        nodeCanvasObjectMode={() => 'after'}
        nodeCanvasObject={(node, ctx, globalScale) => {
          // Draw Glowing Ring if highlighted from chat (CAST TO STRING TO PREVENT INT COLLISION BUGS)
          if (highlightIds && highlightIds.includes(String(node.node_id))) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, 10, 0, 2 * Math.PI, false);
            ctx.fillStyle = 'rgba(239, 68, 68, 0.3)'; // Red glow inside
            ctx.fill();
            
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#ef4444'; // Red outer border
            ctx.stroke();
          }
          
          // Labels at higher zoom
          if (globalScale >= 2.5) {
            const label = String(node.label);
            const fontSize = 12 / globalScale;
            ctx.font = `${fontSize}px Inter, Sans-Serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillText(label, node.x, node.y + 10);
          }
        }}
      />
    </div>
  );
}
