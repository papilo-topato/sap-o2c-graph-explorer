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
  const containerRef = useRef(null);
  const fgRef = useRef();
  const animationFrameRef = useRef(null);

  // UX Interaction States
  const [hoverNode, setHoverNode] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [focusNodeIds, setFocusNodeIds] = useState(new Set());
  const [focusLinkIds, setFocusLinkIds] = useState(new Set());
  const [hoverNodeIds, setHoverNodeIds] = useState(new Set());
  const [hoverLinkIds, setHoverLinkIds] = useState(new Set());
  const [isLegendOpen, setIsLegendOpen] = useState(true);

  const getLinkColor = (link) => {
    // Subtle colors per flow logic if desired, defaulting for now
    return 'rgba(100, 116, 139, 0.4)'; // slate-500 equivalent but translucent
  };

  const getNodeId = useCallback((node) => {
    if (!node) {
      return null;
    }
    return String(node.node_id ?? node.id);
  }, []);

  const getLinkNodeId = useCallback((endpoint) => {
    if (!endpoint) {
      return null;
    }
    return typeof endpoint === 'object' ? getNodeId(endpoint) : String(endpoint);
  }, [getNodeId]);

  const getLinkKey = useCallback((link) => {
    const sourceId = getLinkNodeId(link.source ?? link.source_id);
    const targetId = getLinkNodeId(link.target ?? link.target_id);
    const relationType = link.relation_type || 'LINK';
    return `${sourceId}-${relationType}-${targetId}`;
  }, [getLinkNodeId]);

  const getNodeColor = (node) => {
    switch (node.node_type) {
      case 'SalesOrder': return '#3b82f6';
      case 'Delivery': return '#22c55e';
      case 'Invoice': return '#f59e0b';
      case 'Payment': return '#10b981';
      case 'Customer': return '#a855f7';
      case 'Product': return '#8b5cf6';
      default: return '#94a3b8';
    }
  };

  const handleNodeHover = node => {
    setHoverNode(node || null);
    if (!node) {
      setHoverNodeIds(new Set());
      setHoverLinkIds(new Set());
      return;
    }

    const nodeId = getNodeId(node);
    const nextHoverNodes = new Set([nodeId]);
    const nextHoverLinks = new Set();

    graphData.links.forEach(link => {
      const sourceId = getLinkNodeId(link.source);
      const targetId = getLinkNodeId(link.target);
      if (sourceId === nodeId || targetId === nodeId) {
        nextHoverNodes.add(sourceId);
        nextHoverNodes.add(targetId);
        nextHoverLinks.add(getLinkKey(link));
      }
    });

    setHoverNodeIds(nextHoverNodes);
    setHoverLinkIds(nextHoverLinks);
  };

  const handleLinkHover = link => {
    if (!link) {
      setHoverNodeIds(new Set());
      setHoverLinkIds(new Set());
      return;
    }

    const sourceId = getLinkNodeId(link.source);
    const targetId = getLinkNodeId(link.target);
    setHoverNodeIds(new Set([sourceId, targetId]));
    setHoverLinkIds(new Set([getLinkKey(link)]));
  };

  const collectConnectedSubgraph = useCallback((rootId) => {
    const visitedNodeIds = new Set();
    const visitedLinkIds = new Set();
    const queue = [String(rootId)];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (visitedNodeIds.has(currentId)) {
        continue;
      }
      visitedNodeIds.add(currentId);

      graphData.links.forEach(link => {
        const sourceId = getLinkNodeId(link.source);
        const targetId = getLinkNodeId(link.target);
        if (sourceId !== currentId && targetId !== currentId) {
          return;
        }

        visitedLinkIds.add(getLinkKey(link));
        const neighborId = sourceId === currentId ? targetId : sourceId;
        if (neighborId && !visitedNodeIds.has(neighborId)) {
          queue.push(neighborId);
        }
      });
    }

    return {
      nodeIds: visitedNodeIds,
      linkIds: visitedLinkIds,
    };
  }, [getLinkKey, getLinkNodeId, graphData.links]);

  const focusNode = useCallback((node) => {
    const nodeId = getNodeId(node);
    if (!nodeId) {
      return;
    }

    const { nodeIds, linkIds } = collectConnectedSubgraph(nodeId);
    setSelectedNodeId(nodeId);
    setFocusNodeIds(nodeIds);
    setFocusLinkIds(linkIds);
    onNodeSelect(node);

    if (fgRef.current && typeof node.x === 'number' && typeof node.y === 'number') {
      fgRef.current.centerAt(node.x, node.y, 800);
      fgRef.current.zoom(3, 800);
    }
  }, [collectConnectedSubgraph, getNodeId, onNodeSelect]);

  const clearFocus = useCallback(() => {
    setSelectedNodeId(null);
    setFocusNodeIds(new Set());
    setFocusLinkIds(new Set());
    setHoverNode(null);
    setHoverNodeIds(new Set());
    setHoverLinkIds(new Set());
    onNodeSelect(null);
  }, [onNodeSelect]);

  const handleNodeClick = useCallback((node) => {
    focusNode(node);
    
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
  }, [focusNode, setGraphData]);

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
            focusNode(targetNode);
        } else {
            handleNodeClick({ node_id: searchedNodeId, node_type: 'Searched', label: 'Searched Node' });
        }
    }
  }, [searchedNodeId, graphData.nodes, handleNodeClick, focusNode]);

  useEffect(() => {
    if (!selectedNodeId || focusNodeIds.size === 0) {
      return;
    }

    const refreshedNode = graphData.nodes.find(node => getNodeId(node) === selectedNodeId);
    if (!refreshedNode) {
      return;
    }

    const { nodeIds, linkIds } = collectConnectedSubgraph(selectedNodeId);
    requestAnimationFrame(() => {
      setFocusNodeIds(nodeIds);
      setFocusLinkIds(linkIds);
      onNodeSelect(refreshedNode);
    });
  }, [collectConnectedSubgraph, getNodeId, graphData, onNodeSelect, selectedNodeId, focusNodeIds.size]);

  useEffect(() => {
    if (focusNodeIds.size === 0) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const animate = () => {
      fgRef.current?.refresh();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [focusNodeIds]);

  const handleZoomIn = () => fgRef.current && fgRef.current.zoom(fgRef.current.zoom() * 1.5, 400);
  const handleZoomOut = () => fgRef.current && fgRef.current.zoom(fgRef.current.zoom() / 1.5, 400);
  const handleFitAll = () => fgRef.current && fgRef.current.zoomToFit(800, 50);

  const handleExportImage = useCallback(() => {
    const sourceCanvas = containerRef.current?.querySelector('canvas');
    if (!sourceCanvas) {
      console.error('Graph canvas not found for export');
      return;
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = sourceCanvas.width;
    exportCanvas.height = sourceCanvas.height;

    const context = exportCanvas.getContext('2d');
    if (!context) {
      console.error('Failed to create export canvas context');
      return;
    }

    context.fillStyle = '#0b1120';
    context.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    context.drawImage(sourceCanvas, 0, 0);

    const link = document.createElement('a');
    link.href = exportCanvas.toDataURL('image/png');
    link.download = `o2c-graph-${Date.now()}.png`;
    link.click();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#0b1120] relative group">
        
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
                onClick={(e) => { e.stopPropagation(); handleExportImage(); }} 
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
        linkWidth={link => {
          const linkKey = getLinkKey(link);
          if (focusLinkIds.has(linkKey)) {
            return 3.5;
          }
          if (hoverLinkIds.has(linkKey)) {
            return 2.5;
          }
          return focusNodeIds.size > 0 ? 0.8 : 1.5;
        }}
        linkColor={link => {
          const linkKey = getLinkKey(link);
          if (focusLinkIds.has(linkKey)) {
            return '#93c5fd';
          }
          if (hoverLinkIds.has(linkKey)) {
            return '#60a5fa';
          }
          return focusNodeIds.size > 0 ? 'rgba(51, 65, 85, 0.28)' : getLinkColor(link);
        }}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        linkCurvature={0.2}

        // Subgraph Hover Dimming
        nodeColor={node => {
            const nodeId = getNodeId(node);
            const isFocused = focusNodeIds.has(nodeId);
            const isHovered = hoverNodeIds.has(nodeId);
            const baseColor = getNodeColor(node);

            if (focusNodeIds.size > 0) {
              return isFocused ? baseColor : '#334155';
            }

            if (hoverNode && !isHovered) {
              return '#334155';
            }

            return baseColor;
        }}
        
        d3VelocityDecay={0.3}
        warmupTicks={50}
        onEngineStop={() => fgRef.current.zoomToFit(1000, 60)}

        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onLinkHover={handleLinkHover}
        onBackgroundClick={clearFocus}

        // We disable default native tooltips completely because we are building a custom HTML React div instead
        nodeLabel={() => ''}
        
        nodeCanvasObjectMode={() => 'replace'}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const nodeId = getNodeId(node);
          const isFocused = focusNodeIds.has(nodeId);
          const isHovered = hoverNodeIds.has(nodeId);
          const isSelected = selectedNodeId === nodeId;
          const isTargeted = (searchedNodeId && searchedNodeId === node.node_id) || (highlightIds && highlightIds.includes(String(node.node_id)));
          const pulse = Math.sin(Date.now() / 260) * 0.5 + 0.5;
          const baseRadius = isSelected ? 7.5 : 6;
          const baseColor = getNodeColor(node);
          const nodeFill = focusNodeIds.size > 0
            ? (isFocused ? baseColor : '#334155')
            : (hoverNode && !isHovered ? '#334155' : baseColor);

          if (isFocused || isTargeted) {
            const glowRadius = baseRadius + 6 + pulse * 6;
            const gradient = ctx.createRadialGradient(node.x, node.y, baseRadius, node.x, node.y, glowRadius);
            gradient.addColorStop(0, `${baseColor}cc`);
            gradient.addColorStop(1, `${baseColor}00`);

            ctx.beginPath();
            ctx.arc(node.x, node.y, glowRadius, 0, 2 * Math.PI, false);
            ctx.fillStyle = gradient;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(node.x, node.y, baseRadius + 2 + pulse * 2, 0, 2 * Math.PI, false);
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = `${baseColor}aa`;
            ctx.stroke();
          }

          ctx.beginPath();
          ctx.arc(node.x, node.y, baseRadius, 0, 2 * Math.PI, false);
          ctx.fillStyle = nodeFill;
          ctx.fill();

          if (isSelected) {
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
          } else if (isTargeted) {
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#ef4444';
            ctx.stroke();
          }

          const shouldShowLabel = globalScale >= 2 || hoverNode === node || isFocused || isSelected;
          const isDimmed = focusNodeIds.size > 0 ? !isFocused : (hoverNode && !isHovered);
          if (!isDimmed && shouldShowLabel) {
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
