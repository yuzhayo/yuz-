import React, { useRef, useEffect, useState } from 'react';

// Constants from launcher
const STAGE_WIDTH = 2048;
const STAGE_HEIGHT = 2048;

// CSS styles from launcher
const STAGE_CSS = `
.stage-cover-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  transform-origin: center center;
  overflow: hidden;
  width: 2048px;
  height: 2048px;
}

.stage-cover-canvas {
  display: block;
  transform-origin: 0 0;
  width: 2048px !important;
  height: 2048px !important;
  max-width: none !important;
  max-height: none !important;
  min-width: 2048px !important;
  min-height: 2048px !important;
  will-change: transform;
  pointer-events: none;
}

.stage-cover-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  z-index: 1;
  background: transparent;
  cursor: crosshair;
}

.stage-cover-root {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
`;

interface StageTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  containerWidth: number;
  containerHeight: number;
}

interface StageCoordinates {
  stageX: number;
  stageY: number;
}

function calculateStageTransform(viewportWidth: number, viewportHeight: number): StageTransform {
  // Cover behavior: scale to fill viewport, crop what doesn't fit
  const scaleX = viewportWidth / STAGE_WIDTH;
  const scaleY = viewportHeight / STAGE_HEIGHT;
  const scale = Math.max(scaleX, scaleY); // Use larger scale for cover

  const scaledWidth = STAGE_WIDTH * scale;
  const scaledHeight = STAGE_HEIGHT * scale;

  // Center the scaled stage
  const offsetX = (viewportWidth - scaledWidth) / 2;
  const offsetY = (viewportHeight - scaledHeight) / 2;

  return {
    scale,
    offsetX,
    offsetY,
    containerWidth: scaledWidth,
    containerHeight: scaledHeight,
  };
}

// Inject CSS once
let stylesInjected = false;
function ensureStageStyles(): void {
  if (stylesInjected) return;
  
  const styleElement = document.createElement("style");
  styleElement.id = "stage2048-styles";
  styleElement.textContent = STAGE_CSS;
  document.head.appendChild(styleElement);
  stylesInjected = true;
}

interface Stage2048SystemProps {
  onStageReady?: (canvas: HTMLCanvasElement, transform: StageTransform) => void;
}

export default function Stage2048System({ onStageReady }: Stage2048SystemProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<StageTransform | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [clickEffects, setClickEffects] = useState<Array<{x: number, y: number, life: number, id: number}>>([]);
  const [isPressed, setIsPressed] = useState(false);

  // Transform event coordinates to stage coordinates (like launcher)
  const transformEventCoordinates = (event: MouseEvent | TouchEvent): StageCoordinates | null => {
    if (!transform || !overlayRef.current) return null;

    let clientX: number, clientY: number;
    if ('touches' in event && event.touches.length > 0) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else if ('clientX' in event) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else {
      return null;
    }

    const rect = overlayRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const relativeY = clientY - rect.top;
    
    // Convert overlay coordinates to stage coordinates
    const stageX = (relativeX / rect.width) * STAGE_WIDTH;
    const stageY = (relativeY / rect.height) * STAGE_HEIGHT;

    return { stageX, stageY };
  };

  // Update transform based on viewport size (like launcher)
  const updateTransform = () => {
    if (!containerRef.current || !canvasRef.current) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const newTransform = calculateStageTransform(viewportWidth, viewportHeight);

    // Apply CSS transforms like launcher
    canvasRef.current.style.transform = `scale(${newTransform.scale})`;
    containerRef.current.style.width = `${newTransform.containerWidth}px`;
    containerRef.current.style.height = `${newTransform.containerHeight}px`;

    setTransform(newTransform);
    
    if (onStageReady && canvasRef.current) {
      onStageReady(canvasRef.current, newTransform);
    }
  };

  useEffect(() => {
    ensureStageStyles();

    // Setup canvas
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = STAGE_WIDTH;
    canvas.height = STAGE_HEIGHT;

    // Initial transform
    updateTransform();

    // Handle resize
    const handleResize = () => updateTransform();
    window.addEventListener('resize', handleResize);

    // Setup event handlers on overlay (like launcher)
    const overlay = overlayRef.current;
    if (!overlay) return;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const coords = transformEventCoordinates(e);
      if (coords) {
        setMousePos({ x: coords.stageX, y: coords.stageY });
      }
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      setIsPressed(true);
      const coords = transformEventCoordinates(e);
      if (coords) {
        setClickEffects(prev => [...prev, { 
          x: coords.stageX, 
          y: coords.stageY, 
          life: 1, 
          id: Date.now() 
        }]);
      }
    };

    const handlePointerUp = () => {
      setIsPressed(false);
    };

    overlay.addEventListener('mousemove', handlePointerMove);
    overlay.addEventListener('mousedown', handlePointerDown);
    overlay.addEventListener('mouseup', handlePointerUp);
    overlay.addEventListener('touchmove', handlePointerMove);
    overlay.addEventListener('touchstart', handlePointerDown);
    overlay.addEventListener('touchend', handlePointerUp);

    // Start animation
    let animationFrame = 0;
    let animationId: number;

    const animate = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear canvas
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

      const time = animationFrame * 0.02;

      // Interactive mouse influence (using stage coordinates)
      const mouseInfluence = {
        x: (mousePos.x - STAGE_WIDTH/2) * 0.001,
        y: (mousePos.y - STAGE_HEIGHT/2) * 0.001
      };

      // Multiple elements positioned across the full 2048x2048 space
      const elements = [
        { x: 0.15, y: 0.25, type: 'square', size: 80, color: 'rgba(99, 102, 241, 0.8)', pressColor: 'rgba(255, 99, 71, 0.9)' },
        { x: 0.85, y: 0.2, type: 'circle', size: 100, color: 'rgba(139, 92, 246, 0.8)', pressColor: 'rgba(255, 215, 0, 0.9)' },
        { x: 0.2, y: 0.75, type: 'triangle', size: 90, color: 'rgba(34, 197, 94, 0.8)', pressColor: 'rgba(255, 20, 147, 0.9)' },
        { x: 0.8, y: 0.8, type: 'hexagon', size: 70, color: 'rgba(236, 72, 153, 0.8)', pressColor: 'rgba(0, 255, 255, 0.9)' },
        { x: 0.5, y: 0.1, type: 'star', size: 60, color: 'rgba(251, 191, 36, 0.8)', pressColor: 'rgba(124, 58, 237, 0.9)' },
        { x: 0.1, y: 0.5, type: 'diamond', size: 76, color: 'rgba(59, 130, 246, 0.8)', pressColor: 'rgba(239, 68, 68, 0.9)' },
        { x: 0.9, y: 0.5, type: 'circle', size: 84, color: 'rgba(168, 85, 247, 0.8)', pressColor: 'rgba(34, 197, 94, 0.9)' },
        { x: 0.5, y: 0.9, type: 'square', size: 96, color: 'rgba(20, 184, 166, 0.8)', pressColor: 'rgba(251, 146, 60, 0.9)' }
      ];
      
      elements.forEach((elem, index) => {
        const elemX = (STAGE_WIDTH * elem.x) + mouseInfluence.x * (100 + index * 20);
        const elemY = (STAGE_HEIGHT * elem.y) + mouseInfluence.y * (60 + index * 10);
        const rotationSpeed = time * (0.8 + index * 0.3) + mouseInfluence.x * (index % 2 === 0 ? 1 : -1);
        const color = isPressed ? elem.pressColor : elem.color;
        
        ctx.save();
        ctx.translate(elemX, elemY);
        ctx.rotate(rotationSpeed);
        ctx.fillStyle = color;
        
        // Draw different shapes
        if (elem.type === 'square') {
          ctx.fillRect(-elem.size/2, -elem.size/2, elem.size, elem.size);
        } else if (elem.type === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, elem.size/2, 0, Math.PI * 2);
          ctx.fill();
        } else if (elem.type === 'triangle') {
          ctx.beginPath();
          ctx.moveTo(0, -elem.size/2);
          ctx.lineTo(-elem.size/2, elem.size/2);
          ctx.lineTo(elem.size/2, elem.size/2);
          ctx.closePath();
          ctx.fill();
        } else if (elem.type === 'hexagon') {
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const x = (elem.size/2) * Math.cos(angle);
            const y = (elem.size/2) * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
        } else if (elem.type === 'star') {
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const angle = (i * Math.PI) / 5;
            const radius = i % 2 === 0 ? elem.size/2 : elem.size/4;
            const x = radius * Math.cos(angle);
            const y = radius * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
        } else if (elem.type === 'diamond') {
          ctx.beginPath();
          ctx.moveTo(0, -elem.size/2);
          ctx.lineTo(elem.size/2, 0);
          ctx.lineTo(0, elem.size/2);
          ctx.lineTo(-elem.size/2, 0);
          ctx.closePath();
          ctx.fill();
        }
        
        ctx.restore();
      });

      // Draw interactive particles
      for (let i = 0; i < 100; i++) {
        const baseX = (Math.sin(time + i) * (STAGE_WIDTH * 0.3)) + (STAGE_WIDTH * 0.5);
        const baseY = (Math.cos(time * 0.7 + i) * (STAGE_HEIGHT * 0.25)) + (STAGE_HEIGHT * 0.5);
        
        // Mouse attraction
        const dx = mousePos.x - baseX;
        const dy = mousePos.y - baseY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const attraction = Math.min(100 / (distance + 1), 40);
        
        const x = baseX + (dx / distance) * attraction;
        const y = baseY + (dy / distance) * attraction;
        
        const opacity = Math.sin(time + i) * 0.3 + 0.5;
        const size = isPressed ? 8 : 4;
        
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw mouse trail
      if (mousePos.x > 0 || mousePos.y > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(mousePos.x, mousePos.y, isPressed ? 30 : 16, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw ripple effect when pressed
        if (isPressed) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(mousePos.x, mousePos.y, 40 + Math.sin(time * 5) * 20, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Draw click effects
      setClickEffects(prev => {
        const updated = prev.map(effect => ({
          ...effect,
          life: effect.life - 0.02
        })).filter(effect => effect.life > 0);
        
        // Draw each effect
        updated.forEach(effect => {
          const radius = (1 - effect.life) * 200;
          const opacity = effect.life * 0.8;
          
          ctx.strokeStyle = `rgba(100, 200, 255, ${opacity})`;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
          ctx.stroke();
          
          // Inner burst
          if (effect.life > 0.7) {
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 2})`;
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, 10, 0, Math.PI * 2);
            ctx.fill();
          }
        });
        
        return updated;
      });

      animationFrame++;
      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);

  return (
    <div ref={rootRef} className="stage-cover-root">
      <div ref={containerRef} className="stage-cover-container">
        <canvas ref={canvasRef} className="stage-cover-canvas" />
        <div ref={overlayRef} className="stage-cover-overlay" />
      </div>
    </div>
  );
}