import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

interface Stage3DProps {
  width?: number;
  height?: number;
}

export default function Stage3D({ width = 2048, height = 2048 }: Stage3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const frameRef = useRef<number>();
  const [webglSupported, setWebglSupported] = useState(true);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [clickEffects, setClickEffects] = useState<Array<{x: number, y: number, life: number, id: number}>>([]);
  const [isPressed, setIsPressed] = useState(false);

  useEffect(() => {
    if (!mountRef.current) return;

    // Check WebGL support
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) {
      setWebglSupported(false);
      createFallbackCanvas();
      return;
    }

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      width / height,
      0.1,
      1000
    );
    camera.position.set(0, 0, 5);
    cameraRef.current = camera;

    // Renderer setup
    try {
      const renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true 
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      rendererRef.current = renderer;

      // Add renderer to DOM
      mountRef.current.appendChild(renderer.domElement);

      // Create some basic 3D objects
      createScene(scene);

      // Animation loop
      const animate = () => {
        frameRef.current = requestAnimationFrame(animate);
        
        // Rotate objects
        scene.traverse((object) => {
          if (object.userData.rotate) {
            object.rotation.x += 0.01;
            object.rotation.y += 0.01;
          }
        });

        renderer.render(scene, camera);
      };

      animate();

      // Handle window resize
      const handleResize = () => {
        const aspectRatio = width / height;
        camera.aspect = aspectRatio;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      };

      window.addEventListener('resize', handleResize);

      // Cleanup
      return () => {
        window.removeEventListener('resize', handleResize);
        if (frameRef.current) {
          cancelAnimationFrame(frameRef.current);
        }
        if (mountRef.current && renderer.domElement) {
          mountRef.current.removeChild(renderer.domElement);
        }
        renderer.dispose();
      };
    } catch (error) {
      console.log('WebGL renderer failed, falling back to canvas');
      setWebglSupported(false);
      createFallbackCanvas();
    }
  }, [width, height]);

  const createFallbackCanvas = () => {
    if (!mountRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.cursor = 'crosshair';
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Add interactive event listeners
    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY;
      if (clientX !== undefined && clientY !== undefined) {
        const x = ((clientX - rect.left) / rect.width) * width;
        const y = ((clientY - rect.top) / rect.height) * height;
        setMousePos({ x, y });
      }
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      setIsPressed(true);
      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY;
      if (clientX !== undefined && clientY !== undefined) {
        const x = ((clientX - rect.left) / rect.width) * width;
        const y = ((clientY - rect.top) / rect.height) * height;
        
        // Create click effect
        setClickEffects(prev => [...prev, { x, y, life: 1, id: Date.now() }]);
      }
    };

    const handlePointerUp = () => {
      setIsPressed(false);
    };

    canvas.addEventListener('mousemove', handlePointerMove);
    canvas.addEventListener('mousedown', handlePointerDown);
    canvas.addEventListener('mouseup', handlePointerUp);
    canvas.addEventListener('touchmove', handlePointerMove);
    canvas.addEventListener('touchstart', handlePointerDown);
    canvas.addEventListener('touchend', handlePointerUp);

    mountRef.current.appendChild(canvas);

    // Create a 2D fallback animation with interactivity
    let animationFrame = 0;
    
    const animate2D = () => {
      frameRef.current = requestAnimationFrame(animate2D);
      
      // Clear canvas
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, width, height);
      
      // Draw animated elements using 2048x2048 coordinate system like Launcher
      const time = animationFrame * 0.02;
      
      // Interactive mouse influence
      const mouseInfluence = {
        x: (mousePos.x - width/2) * 0.001,
        y: (mousePos.y - height/2) * 0.001
      };
      
      // Use percentage-based positioning like Launcher across the full stage
      
      // Multiple elements positioned across the full 2048x2048 space
      const elements = [
        { x: 0.15, y: 0.25, type: 'square', size: 40, color: 'rgba(99, 102, 241, 0.8)', pressColor: 'rgba(255, 99, 71, 0.9)' },
        { x: 0.85, y: 0.2, type: 'circle', size: 50, color: 'rgba(139, 92, 246, 0.8)', pressColor: 'rgba(255, 215, 0, 0.9)' },
        { x: 0.2, y: 0.75, type: 'triangle', size: 45, color: 'rgba(34, 197, 94, 0.8)', pressColor: 'rgba(255, 20, 147, 0.9)' },
        { x: 0.8, y: 0.8, type: 'hexagon', size: 35, color: 'rgba(236, 72, 153, 0.8)', pressColor: 'rgba(0, 255, 255, 0.9)' },
        { x: 0.5, y: 0.1, type: 'star', size: 30, color: 'rgba(251, 191, 36, 0.8)', pressColor: 'rgba(124, 58, 237, 0.9)' },
        { x: 0.1, y: 0.5, type: 'diamond', size: 38, color: 'rgba(59, 130, 246, 0.8)', pressColor: 'rgba(239, 68, 68, 0.9)' },
        { x: 0.9, y: 0.5, type: 'circle', size: 42, color: 'rgba(168, 85, 247, 0.8)', pressColor: 'rgba(34, 197, 94, 0.9)' },
        { x: 0.5, y: 0.9, type: 'square', size: 48, color: 'rgba(20, 184, 166, 0.8)', pressColor: 'rgba(251, 146, 60, 0.9)' }
      ];
      
      elements.forEach((elem, index) => {
        const elemX = (width * elem.x) + mouseInfluence.x * (50 + index * 10);
        const elemY = (height * elem.y) + mouseInfluence.y * (30 + index * 5);
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
      
      // Draw interactive particles across the full stage area
      for (let i = 0; i < 50; i++) {
        const baseX = (Math.sin(time + i) * (width * 0.3)) + (width * 0.5);
        const baseY = (Math.cos(time * 0.7 + i) * (height * 0.25)) + (height * 0.5);
        
        // Mouse attraction
        const dx = mousePos.x - baseX;
        const dy = mousePos.y - baseY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const attraction = Math.min(50 / (distance + 1), 20);
        
        const x = baseX + (dx / distance) * attraction;
        const y = baseY + (dy / distance) * attraction;
        
        const opacity = Math.sin(time + i) * 0.3 + 0.5;
        const size = isPressed ? 4 : 2;
        
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Draw mouse trail
      if (mousePos.x > 0 || mousePos.y > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(mousePos.x, mousePos.y, isPressed ? 15 : 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw ripple effect when pressed
        if (isPressed) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(mousePos.x, mousePos.y, 20 + Math.sin(time * 5) * 10, 0, Math.PI * 2);
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
          const radius = (1 - effect.life) * 100;
          const opacity = effect.life * 0.8;
          
          ctx.strokeStyle = `rgba(100, 200, 255, ${opacity})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
          ctx.stroke();
          
          // Inner burst
          if (effect.life > 0.7) {
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 2})`;
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, 5, 0, Math.PI * 2);
            ctx.fill();
          }
        });
        
        return updated;
      });
      
      animationFrame++;
    };

    animate2D();
  };

  return (
    <div 
      ref={mountRef} 
      className="w-full h-full relative"
      style={{ 
        width: `${width}px`, 
        height: `${height}px`,
        maxWidth: '100%',
        maxHeight: '100%'
      }}
    >
      {!webglSupported && (
        <div className="absolute top-4 right-4 bg-amber-600/80 text-white text-xs px-2 py-1 rounded">
          2D Fallback Mode
        </div>
      )}
    </div>
  );
}

// Create a basic 3D scene
function createScene(scene: THREE.Scene) {
  // Lighting
  const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
  directionalLight.position.set(5, 5, 5);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  scene.add(directionalLight);

  // Create a rotating cube
  const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
  const cubeMaterial = new THREE.MeshLambertMaterial({ 
    color: 0x6366f1,
    transparent: true,
    opacity: 0.8
  });
  const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  cube.position.set(-2, 0, 0);
  cube.userData.rotate = true;
  cube.castShadow = true;
  scene.add(cube);

  // Create a rotating sphere
  const sphereGeometry = new THREE.SphereGeometry(0.8, 32, 32);
  const sphereMaterial = new THREE.MeshLambertMaterial({ 
    color: 0x8b5cf6,
    transparent: true,
    opacity: 0.8
  });
  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  sphere.position.set(2, 0, 0);
  sphere.userData.rotate = true;
  sphere.castShadow = true;
  scene.add(sphere);

  // Create a ground plane
  const planeGeometry = new THREE.PlaneGeometry(10, 10);
  const planeMaterial = new THREE.MeshLambertMaterial({ 
    color: 0x333333,
    transparent: true,
    opacity: 0.3
  });
  const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -2;
  plane.receiveShadow = true;
  scene.add(plane);

  // Add some floating particles
  const particleGeometry = new THREE.BufferGeometry();
  const particleCount = 100;
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 10;
  }

  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  const particleMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.02,
    transparent: true,
    opacity: 0.6
  });

  const particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);
}