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

  // Slots that already have a zone drawn on this camera
  const mappedZones: CameraZone[] = slots
    .filter(s => s.camera_id === cameraId && s.camera_zone_points && s.camera_zone_points.length === 4)
    .map(s => ({
      slotId: s.id,
      points: s.camera_zone_points,
      label: s.label || s.slot_number,
      status: s.status
    }));

  // Slots that are unmapped and don't yet have a zone on this camera
  const unmappedSlots = slots.filter(
    s => s.status === 'unmapped' && !mappedZones.some(z => z.slotId === s.id)
  );

  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);

  // After finishing 4 points, the zone is "pending" — shown locally and draggable before saving
  const [pendingZone, setPendingZone] = useState<{ slotId: string; points: Point[]; label: string } | null>(null);

  // Dragging state for existing zones and the pending zone
  const [draggingPoint, setDraggingPoint] = useState<{ slotId: string; pointIndex: number; isPending: boolean } | null>(null);
  const [localZones, setLocalZones] = useState<CameraZone[]>(mappedZones);

  // Sync local zones when DB updates come in (but not during dragging)
  useEffect(() => {
    if (!draggingPoint) {
      setLocalZones(mappedZones);
    }
  }, [slots, cameraId, draggingPoint]);

  const getRelativePoint = (e: React.MouseEvent | React.PointerEvent): { x: number; y: number } | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x, y };
  };

  // Handle click on the SVG background to add drawing points
  const handleSvgClick = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (!interactive) return;
    if (draggingPoint) return;
    if (pendingZone) return; // If pending zone exists, wait for user to confirm/cancel

    if (activeSlotId && drawingPoints.length < 4) {
      const pt = getRelativePoint(e);
      if (!pt) return;

      const newPoints = [...drawingPoints, pt];
      setDrawingPoints(newPoints);

      // Once 4 points are placed, create a pending zone (do NOT save yet — let user adjust)
      if (newPoints.length === 4) {
        const slot = slots.find(s => s.id === activeSlotId);
        setPendingZone({
          slotId: activeSlotId,
          points: newPoints,
          label: slot?.label || slot?.slot_number || '?'
        });
        setDrawingPoints([]);
        setActiveSlotId(null);
      }
    }
  };

  // Save the pending zone to the database
  const handleConfirmPending = () => {
    if (!pendingZone) return;
    onSaveZone(pendingZone.slotId, pendingZone.points);
    setPendingZone(null);
  };

  // Discard the pending zone
  const handleCancelPending = () => {
    setPendingZone(null);
    setDrawingPoints([]);
    setActiveSlotId(null);
  };

  // Handle clicking inside a formed saved zone to delete it
  const handleZoneClick = (e: ReactMouseEvent<SVGPolygonElement>, slotId: string) => {
    if (!interactive) return;
    e.stopPropagation();
    if (!draggingPoint && window.confirm("Are you sure you want to delete this mapped zone?")) {
      onDeleteZone(slotId);
    }
  };

  // --- Pointer drag handlers for saved zones ---
  const handlePointerDownSaved = (e: React.PointerEvent, slotId: string, pointIndex: number) => {
    if (!interactive) return;
    e.stopPropagation();
    setDraggingPoint({ slotId, pointIndex, isPending: false });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  // --- Pointer drag handlers for pending zone corners ---
  const handlePointerDownPending = (e: React.PointerEvent, pointIndex: number) => {
    if (!interactive || !pendingZone) return;
    e.stopPropagation();
    setDraggingPoint({ slotId: pendingZone.slotId, pointIndex, isPending: true });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!interactive || !draggingPoint) return;
    const pt = getRelativePoint(e);
    if (!pt) return;

    const clampedX = Math.max(0, Math.min(pt.x, 100));
    const clampedY = Math.max(0, Math.min(pt.y, 100));

    if (draggingPoint.isPending && pendingZone) {
      // Update pending zone points
      const newPoints = [...pendingZone.points];
      newPoints[draggingPoint.pointIndex] = { x: clampedX, y: clampedY };
      setPendingZone({ ...pendingZone, points: newPoints });
    } else {
      // Update saved zone points locally
      setLocalZones(prev => prev.map(zone => {
        if (zone.slotId === draggingPoint.slotId) {
          const newPoints = [...zone.points];
          newPoints[draggingPoint.pointIndex] = { x: clampedX, y: clampedY };
          return { ...zone, points: newPoints };
        }
        return zone;
      }));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!interactive || !draggingPoint) return;
    e.stopPropagation();

    if (!draggingPoint.isPending) {
      // Save adjusted saved zone to DB
      const zone = localZones.find(z => z.slotId === draggingPoint.slotId);
      if (zone) onSaveZone(zone.slotId, zone.points);
    }
    // For pending zone, just let the user keep adjusting before confirming

    setDraggingPoint(null);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const getColorForStatus = (status: string) => {
    switch (status) {
      case 'occupied': return 'rgba(239, 68, 68, 0.4)';
      case 'reserved': return 'rgba(59, 130, 246, 0.4)';
      case 'maintenance': return 'rgba(245, 158, 11, 0.4)';
      case 'available': return 'rgba(16, 185, 129, 0.4)';
      default: return 'rgba(148, 163, 184, 0.4)';
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
    <div className="absolute inset-0 z-10" ref={containerRef} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>

      {/* SVG Canvas for shapes */}
      <svg
        className="w-full h-full absolute inset-0"
        onClick={handleSvgClick}
        style={{ cursor: interactive && activeSlotId && drawingPoints.length < 4 ? 'crosshair' : 'default' }}
      >
        {/* Render fully saved zones */}
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
            {/* Draggable corners for saved zones */}
            {interactive && zone.points.map((p, i) => (
              <circle
                key={i}
                cx={`${p.x}%`}
                cy={`${p.y}%`}
                r="7"
                fill="white"
                stroke={getBorderColorForStatus(zone.status)}
                strokeWidth="2"
                className="cursor-move"
                onPointerDown={(e) => handlePointerDownSaved(e, zone.slotId, i)}
              />
            ))}
          </g>
        ))}

        {/* Render PENDING zone (drawn but not yet confirmed) */}
        {pendingZone && (
          <g>
            <polygon
              points={pendingZone.points.map(p => `${p.x}%,${p.y}%`).join(' ')}
              fill="rgba(251, 191, 36, 0.3)"
              stroke="rgb(251, 191, 36)"
              strokeWidth="2.5"
              strokeDasharray="6 3"
              className="pointer-events-none"
            />
            <text
              x={`${pendingZone.points.reduce((sum, p) => sum + p.x, 0) / 4}%`}
              y={`${pendingZone.points.reduce((sum, p) => sum + p.y, 0) / 4}%`}
              fill="white"
              fontSize="12"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
              className="drop-shadow-md pointer-events-none"
            >
              {pendingZone.label}
            </text>
            {/* Draggable corners for pending zone */}
            {pendingZone.points.map((p, i) => (
              <circle
                key={i}
                cx={`${p.x}%`}
                cy={`${p.y}%`}
                r="8"
                fill="rgb(251, 191, 36)"
                stroke="white"
                strokeWidth="2.5"
                className="cursor-move"
                onPointerDown={(e) => handlePointerDownPending(e, i)}
              />
            ))}
          </g>
        )}

        {/* Render currently drawing points (while placing) */}
        {activeSlotId && drawingPoints.length > 0 && (
          <g>
            {drawingPoints.map((p, i) => (
              <circle key={i} cx={`${p.x}%`} cy={`${p.y}%`} r="5" fill="orange" stroke="white" strokeWidth="2" />
            ))}
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

      {/* Pending Zone Confirmation Banner */}
      {interactive && pendingZone && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-amber-500 text-white rounded-xl px-5 py-3 shadow-2xl flex items-center gap-4 pointer-events-auto z-20">
          <span className="text-sm font-semibold">Adjust corners, then confirm zone for <strong>{pendingZone.label}</strong></span>
          <button onClick={handleConfirmPending} className="bg-white text-amber-600 font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors">✓ Save</button>
          <button onClick={handleCancelPending} className="bg-white/20 text-white font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-white/30 transition-colors">✕ Cancel</button>
        </div>
      )}

      {/* Floating Toolbar for interactive drawing mode */}
      {interactive && (
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md rounded-xl p-4 shadow-xl border border-white/20 w-64 pointer-events-auto">
          <h4 className="font-bold text-slate-800 mb-1">Drawing Mode</h4>
          <p className="text-xs text-slate-500 mb-3">
            {pendingZone
              ? "Drag the yellow corners to adjust, then click Save."
              : activeSlotId
                ? `Click ${4 - drawingPoints.length} more point${4 - drawingPoints.length !== 1 ? 's' : ''} on the feed.`
                : "Select an unmapped slot to begin."}
          </p>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {unmappedSlots.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">All slots are already mapped!</p>
            ) : (
              unmappedSlots.map(slot => (
                <div
                  key={slot.id}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-lg text-sm transition-colors border cursor-pointer",
                    activeSlotId === slot.id
                      ? "bg-primary/10 border-primary text-primary font-bold"
                      : "bg-white border-slate-200 text-slate-700 hover:border-primary/50 hover:bg-slate-50"
                  )}
                  onClick={() => {
                    if (pendingZone) return; // Don't switch while a pending zone exists
                    setActiveSlotId(slot.id);
                    setDrawingPoints([]);
                  }}
                >
                  <span>{slot.label || slot.slot_number}</span>
                  {activeSlotId === slot.id && <span className="text-xs font-semibold animate-pulse">Drawing...</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
