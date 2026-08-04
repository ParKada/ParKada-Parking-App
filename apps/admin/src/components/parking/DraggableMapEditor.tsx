import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { RotateCw, Move } from "lucide-react";
import { cn } from "@/lib/utils";

interface DraggableMapEditorProps {
  slots: any[];
  onUpdateSlot: (id: string, updates: Partial<any>) => void;
  interactive?: boolean; // false for managers
}

export default function DraggableMapEditor({ slots, onUpdateSlot, interactive = true }: DraggableMapEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Local state to power the live dragging visually without spamming DB updates
  const [localSlots, setLocalSlots] = useState<any[]>(slots);

  // Sync local slots when props change (except when dragging)
  useEffect(() => {
    if (!draggingId) {
      setLocalSlots(slots);
    }
  }, [slots, draggingId]);

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    if (!interactive) return;
    
    // Only left click
    if (e.button !== 0) return;
    e.stopPropagation();
    
    setSelectedSlotId(id);
    setDraggingId(id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent, id: string) => {
    if (!interactive || draggingId !== id) return;
    e.stopPropagation();

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    // Calculate new percentage based on mouse position relative to container
    let newX = ((e.clientX - rect.left) / rect.width) * 100;
    let newY = ((e.clientY - rect.top) / rect.height) * 100;

    // Clamp between 0 and 100
    newX = Math.max(0, Math.min(newX, 95));
    newY = Math.max(0, Math.min(newY, 90));

    setLocalSlots((prev) => 
      prev.map((s) => s.id === id ? { ...s, ui_x: newX, ui_y: newY } : s)
    );
  };

  const handlePointerUp = (e: React.PointerEvent, id: string) => {
    if (!interactive || draggingId !== id) return;
    e.stopPropagation();
    
    setDraggingId(null);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    // Find final position and save
    const finalSlot = localSlots.find((s) => s.id === id);
    if (finalSlot) {
      onUpdateSlot(id, { ui_x: finalSlot.ui_x, ui_y: finalSlot.ui_y });
    }
  };

  const handleRotate = (e: React.MouseEvent, id: string, currentRotation: number) => {
    e.stopPropagation();
    if (!interactive) return;
    
    let newRot = (currentRotation || 0) + 90;
    if (newRot >= 360) newRot = 0;
    
    setLocalSlots((prev) => 
      prev.map((s) => s.id === id ? { ...s, ui_rotation: newRot } : s)
    );
    onUpdateSlot(id, { ui_rotation: newRot });
  };

  const handleClickBackground = () => {
    setSelectedSlotId(null);
  };

  return (
    <div 
      className="w-full aspect-[16/9] bg-[#1e293b] rounded-2xl relative overflow-hidden shadow-inner border-2 border-slate-700/50"
      ref={containerRef}
      onPointerDown={handleClickBackground}
      style={{ backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)', backgroundSize: '20px 20px' }}
    >
      {localSlots.map((slot) => {
        const isSelected = selectedSlotId === slot.id && interactive;
        const x = typeof slot.ui_x === 'number' ? slot.ui_x : 10;
        const y = typeof slot.ui_y === 'number' ? slot.ui_y : 10;
        const rot = typeof slot.ui_rotation === 'number' ? slot.ui_rotation : 0;
        
        // Colors match screenshot: Green for available, Red for occupied, Gray for unmapped
        const isMapped = slot.coordinates && slot.coordinates.length > 0;
        const bgColor = !isMapped 
          ? "bg-slate-500 border-slate-400" // Unmapped
          : slot.status === "available" 
            ? "bg-[#10b981] border-[#047857]" // Green
            : "bg-[#ef4444] border-[#b91c1c]"; // Red

        return (
          <div
            key={slot.id}
            onPointerDown={(e) => handlePointerDown(e, slot.id)}
            onPointerMove={(e) => handlePointerMove(e, slot.id)}
            onPointerUp={(e) => handlePointerUp(e, slot.id)}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: `rotate(${rot}deg)`,
              position: 'absolute',
              touchAction: 'none' // Prevent scrolling while dragging on touch screens
            }}
            className={cn(
              "flex flex-col items-center justify-center rounded shadow-lg select-none transition-shadow",
              "w-12 h-20 sm:w-16 sm:h-24 md:w-20 md:h-32", // Responsive sizing
              bgColor,
              "border-b-4", // 3D effect
              interactive ? "cursor-grab active:cursor-grabbing" : "cursor-default",
              isSelected && "ring-4 ring-white shadow-2xl z-20 scale-105 transition-transform"
            )}
          >
            <span className="font-bold text-white text-sm sm:text-base md:text-xl">{slot.label}</span>
            {isMapped && (
              <span className="text-[10px] sm:text-xs text-white/80 font-semibold mt-1">
                {slot.status === 'available' ? 'P' : 'X'}
              </span>
            )}
            
            {/* Editor Controls Overlay */}
            {isSelected && (
              <div 
                className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white p-1 rounded-lg shadow-xl"
                style={{ transform: `translateX(-50%) rotate(-${rot}deg)` }} // Counter-rotate so buttons are always upright
              >
                <button 
                  onClick={(e) => handleRotate(e, slot.id, rot)}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition-colors"
                  title="Rotate 90°"
                >
                  <RotateCw size={14} />
                </button>
                <div className="w-[1px] h-4 bg-slate-200"></div>
                <div className="p-1.5 text-slate-400 cursor-move">
                  <Move size={14} />
                </div>
              </div>
            )}
          </div>
        );
      })}
      
      {/* Floor Grid Overlay indicator */}
      {!interactive && localSlots.length === 0 && (
         <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-slate-400 font-medium">No slots on this floor</p>
         </div>
      )}
    </div>
  );
}
