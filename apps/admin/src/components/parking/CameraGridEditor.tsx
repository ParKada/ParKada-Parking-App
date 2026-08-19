import React, { useState, useRef, useEffect, MouseEvent as ReactMouseEvent } from 'react';
import { cn } from "@/lib/utils";

interface Point {
  x: number;
  y: number;
}

export interface CameraZone {
  slotId: string;
  points: Point[];
  label: string;
  status: string;
}

interface CameraGridEditorProps {
  interactive: boolean;
  slots: any[];
  cameraId: string;
  onSaveZone: (slotId: string, points: Point[]) => void;
  onDeleteZone: (slotId: string) => void;
}

export default function CameraGridEditor({
  interactive,
  slots,
  cameraId,
  onSaveZone,
  onDeleteZone
}: CameraGridEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter to only slots that belong to this camera (or have points assigned)
  // Since we save camera_id and camera_zone_points in the slot
  const mappedZones: CameraZone[] = slots
    .filter(s => s.camera_id === cameraId && s.camera_zone_points && s.camera_zone_points.length === 4)
    .map(s => ({
      slotId: s.id,
      points: s.camera_zone_points,
      label: s.label || s.slot_number,
      status: s.status
    }));

  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  
  // Dragging state for existing zones
  const [draggingPoint, setDraggingPoint] = useState<{ slotId: string, pointIndex: number } | null>(null);
  // Local state for dragging to make it smooth without immediate DB updates
  const [localZones, setLocalZones] = useState<CameraZone[]>(mappedZones);

  // Sync local zones
  useEffect(() => {
    if (!draggingPoint) {
      setLocalZones(mappedZones);
    }
  }, [slots, cameraId, draggingPoint]);

  // Handle click on the SVG background
  const handleSvgClick = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (!interactive) return;
    if (draggingPoint) return; // Ignore if we were dragging a point

    // If we have selected a slot to draw, and it doesn't already have a full zone, add a point
    if (activeSlotId && drawingPoints.length < 4) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      const newPoints = [...drawingPoints, { x, y }];
      setDrawingPoints(newPoints);

      if (newPoints.length === 4) {
        // Complete the shape
        onSaveZone(activeSlotId, newPoints);
        setDrawingPoints([]);
        setActiveSlotId(null);
      }
    }
  };

  // Handle clicking inside a formed zone to delete it
  const handleZoneClick = (e: ReactMouseEvent<SVGPolygonElement>, slotId: string) => {
    if (!interactive) return;
    e.stopPropagation();
    
    // If not dragging, and we click the zone, delete it
    if (!draggingPoint && window.confirm("Are you sure you want to delete this mapped zone?")) {
      onDeleteZone(slotId);
    }
  };

  // Handle dragging corners
  const handlePointerDown = (e: React.PointerEvent, slotId: string, pointIndex: number) => {
    if (!interactive) return;
    e.stopPropagation();
    setDraggingPoint({ slotId, pointIndex });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!interactive || !draggingPoint) return;
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    let newX = ((e.clientX - rect.left) / rect.width) * 100;
    let newY = ((e.clientY - rect.top) / rect.height) * 100;

    newX = Math.max(0, Math.min(newX, 100));
    newY = Math.max(0, Math.min(newY, 100));

    setLocalZones(prev => prev.map(zone => {
      if (zone.slotId === draggingPoint.slotId) {
        const newPoints = [...zone.points];
        newPoints[draggingPoint.pointIndex] = { x: newX, y: newY };
        return { ...zone, points: newPoints };
      }
      return zone;
    }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!interactive || !draggingPoint) return;
    e.stopPropagation();
    
    const zone = localZones.find(z => z.slotId === draggingPoint.slotId);
    if (zone) {
      onSaveZone(zone.slotId, zone.points);
    }
    
    setDraggingPoint(null);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const getColorForStatus = (status: string) => {
    switch (status) {
      case 'occupied': return 'rgba(239, 68, 68, 0.4)'; // red-500
      case 'reserved': return 'rgba(59, 130, 246, 0.4)'; // blue-500
      case 'maintenance': return 'rgba(245, 158, 11, 0.4)'; // amber-500
      case 'available': return 'rgba(16, 185, 129, 0.4)'; // emerald-500
      default: return 'rgba(148, 163, 184, 0.4)'; // slate-400
    }
  };

  const getBorderColorForStatus = (status: string) => {
    switch (status) {
      case 'occupied': return 'rgb(239, 68, 68)';
      case 'reserved': return 'rgb(59, 130, 246)';
      case 'maintenance': return 'rgb(245, 158, 11)';
      case 'available': return 'rgb(16, 185, 129)';
      default: return 'rgb(148, 163, 184)';
    }
  };

  return (
    <div className="absolute inset-0 z-10" ref={containerRef}>
      
      {/* SVG Canvas for shapes */}
      <svg 
        className="w-full h-full absolute inset-0"
        onClick={handleSvgClick}
        onPointerMove={handlePointerMove}
        style={{ cursor: interactive && activeSlotId && drawingPoints.length < 4 ? 'crosshair' : 'default' }}
      >
        {/* Render fully mapped zones */}
        {localZones.map(zone => (
          <g key={zone.slotId}>
            <polygon
              points={zone.points.map(p => `${p.x}%,${p.y}%`).join(' ')}
              fill={getColorForStatus(zone.status)}
              stroke={getBorderColorForStatus(zone.status)}
              strokeWidth="2"
              className={cn(
                "transition-all duration-300",
                interactive ? "hover:fill-red-500/50 cursor-pointer" : ""
              )}
              onClick={(e) => handleZoneClick(e, zone.slotId)}
            />
            {/* Zone Label placed at the center of the polygon */}
            <text
              x={`${zone.points.reduce((sum, p) => sum + p.x, 0) / 4}%`}
              y={`${zone.points.reduce((sum, p) => sum + p.y, 0) / 4}%`}
              fill="white"
              fontSize="12"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
              className="drop-shadow-md pointer-events-none"
            >
              {zone.label}
            </text>

            {/* Draggable corners */}
            {interactive && zone.points.map((p, i) => (
              <circle
                key={i}
                cx={`${p.x}%`}
                cy={`${p.y}%`}
                r="6"
                fill="white"
                stroke={getBorderColorForStatus(zone.status)}
                strokeWidth="2"
                className="cursor-move hover:scale-150 transition-transform"
                onPointerDown={(e) => handlePointerDown(e, zone.slotId, i)}
                onPointerUp={handlePointerUp}
              />
            ))}
          </g>
        ))}

        {/* Render currently drawing zone */}
        {activeSlotId && drawingPoints.length > 0 && (
          <g>
            {drawingPoints.map((p, i) => (
              <circle
                key={i}
                cx={`${p.x}%`}
                cy={`${p.y}%`}
                r="5"
                fill="orange"
                stroke="white"
                strokeWidth="2"
              />
            ))}
            {/* Draw lines between points */}
            {drawingPoints.length > 1 && (
              <polyline
                points={drawingPoints.map(p => `${p.x}%,${p.y}%`).join(' ')}
                fill="none"
                stroke="orange"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
            )}
          </g>
        )}
      </svg>

      {/* Floating Toolbar for interactive drawing mode */}
      {interactive && (
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md rounded-xl p-4 shadow-xl border border-white/20 w-64 pointer-events-auto">
          <h4 className="font-bold text-slate-800 mb-2">Drawing Mode</h4>
          <p className="text-xs text-slate-600 mb-4">
            Select a slot and click 4 times on the camera feed to draw a zone.
          </p>
          
          <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
            {slots.filter(s => s.status !== 'unmapped').map(slot => {
              const isMapped = mappedZones.some(z => z.slotId === slot.id);
              return (
                <div 
                  key={slot.id} 
                  className={cn(
                    "flex items-center justify-between p-2 rounded-lg text-sm transition-colors border",
                    activeSlotId === slot.id 
                      ? "bg-primary/10 border-primary text-primary font-bold" 
                      : isMapped 
                        ? "bg-slate-50 border-slate-200 text-slate-500" 
                        : "bg-white border-slate-200 text-slate-700 hover:border-primary/50 cursor-pointer"
                  )}
                  onClick={() => {
                    if (!isMapped) {
                      setActiveSlotId(slot.id);
                      setDrawingPoints([]);
                    }
                  }}
                >
                  <span>{slot.label || slot.slot_number}</span>
                  {isMapped && <span className="text-xs font-semibold text-emerald-500">Mapped</span>}
                  {!isMapped && activeSlotId === slot.id && <span className="text-xs font-semibold">Drawing...</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  );
}
