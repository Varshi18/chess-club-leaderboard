import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Text3D, Center } from '@react-three/drei';
import * as THREE from 'three';

const ChessPiece = ({ position, rotation, scale = 1, color = '#ffffff' }) => {
  const meshRef = useRef();
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.005;
      meshRef.current.position.y += Math.sin(state.clock.elapsedTime + position[0]) * 0.01;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
      <mesh ref={meshRef} position={position} rotation={rotation} scale={scale}>
        <cylinderGeometry args={[0.3, 0.4, 0.8, 8]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.4} />
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshStandardMaterial color={color} metalness={0.3} roughness={0.4} />
        </mesh>
      </mesh>
    </Float>
  );
};

const Knight = ({ position, rotation, scale = 1, color = '#ffffff' }) => {
  const meshRef = useRef();
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.003;
      meshRef.current.position.y += Math.sin(state.clock.elapsedTime + position[0] * 2) * 0.008;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.3} floatIntensity={0.3}>
      <group ref={meshRef} position={position} rotation={rotation} scale={scale}>
        <mesh>
          <cylinderGeometry args={[0.25, 0.35, 0.6, 8]} />
          <meshStandardMaterial color={color} metalness={0.4} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.4, 0.1]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.3, 0.4, 0.2]} />
          <meshStandardMaterial color={color} metalness={0.4} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.6, 0.15]} rotation={[0.2, 0, 0]}>
          <coneGeometry args={[0.1, 0.2, 6]} />
          <meshStandardMaterial color={color} metalness={0.4} roughness={0.3} />
        </mesh>
      </group>
    </Float>
  );
};

const Rook = ({ position, rotation, scale = 1, color = '#ffffff' }) => {
  const meshRef = useRef();
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.004;
      meshRef.current.position.y += Math.sin(state.clock.elapsedTime + position[0] * 1.5) * 0.006;
    }
  });

  return (
    <Float speed={1.2} rotationIntensity={0.4} floatIntensity={0.4}>
      <group ref={meshRef} position={position} rotation={rotation} scale={scale}>
        <mesh>
          <cylinderGeometry args={[0.3, 0.4, 0.7, 8]} />
          <meshStandardMaterial color={color} metalness={0.5} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 0.2, 8]} />
          <meshStandardMaterial color={color} metalness={0.5} roughness={0.2} />
        </mesh>
        {[0, Math.PI/2, Math.PI, 3*Math.PI/2].map((angle, i) => (
          <mesh key={i} position={[Math.cos(angle) * 0.25, 0.6, Math.sin(angle) * 0.25]}>
            <boxGeometry args={[0.08, 0.15, 0.08]} />
            <meshStandardMaterial color={color} metalness={0.5} roughness={0.2} />
          </mesh>
        ))}
      </group>
    </Float>
  );
};

const Bishop = ({ position, rotation, scale = 1, color = '#ffffff' }) => {
  const meshRef = useRef();
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.006;
      meshRef.current.position.y += Math.sin(state.clock.elapsedTime + position[0] * 0.8) * 0.01;
    }
  });

  return (
    <Float speed={1.8} rotationIntensity={0.6} floatIntensity={0.6}>
      <group ref={meshRef} position={position} rotation={rotation} scale={scale}>
        <mesh>
          <cylinderGeometry args={[0.25, 0.35, 0.6, 8]} />
          <meshStandardMaterial color={color} metalness={0.3} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.4, 0]}>
          <coneGeometry args={[0.2, 0.4, 8]} />
          <meshStandardMaterial color={color} metalness={0.3} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.7, 0]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial color={color} metalness={0.3} roughness={0.5} />
        </mesh>
      </group>
    </Float>
  );
};

const Pawn = ({ position, rotation, scale = 1, color = '#ffffff' }) => {
  const meshRef = useRef();
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.008;
      meshRef.current.position.y += Math.sin(state.clock.elapsedTime + position[0] * 3) * 0.005;
    }
  });

  return (
    <Float speed={2.5} rotationIntensity={0.2} floatIntensity={0.2}>
      <group ref={meshRef} position={position} rotation={rotation} scale={scale}>
        <mesh>
          <cylinderGeometry args={[0.15, 0.2, 0.4, 8]} />
          <meshStandardMaterial color={color} metalness={0.2} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial color={color} metalness={0.2} roughness={0.6} />
        </mesh>
      </group>
    </Float>
  );
};

const ThreeBackground = ({ variant = 'default' }) => {
  const pieces = useMemo(() => {
    const pieceTypes = [ChessPiece, Knight, Rook, Bishop, Pawn];
    const colors = ['#f4f4f4', '#2d2d2d', '#ffd700', '#c0c0c0'];
    const positions = [];
    
    for (let i = 0; i < 15; i++) {
      const PieceComponent = pieceTypes[Math.floor(Math.random() * pieceTypes.length)];
      const position = [
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 20
      ];
      const rotation = [
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      ];
      const scale = 0.3 + Math.random() * 0.4;
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      positions.push({
        Component: PieceComponent,
        position,
        rotation,
        scale,
        color,
        key: i
      });
    }
    
    return positions;
  }, []);

  return (
    <div className="fixed inset-0 -z-10">
      <Canvas
        camera={{ position: [0, 0, 10], fov: 60 }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.3} />
        <directionalLight position={[10, 10, 5]} intensity={0.5} />
        <pointLight position={[-10, -10, -5]} intensity={0.3} color="#ffd700" />
        
        {pieces.map(({ Component, position, rotation, scale, color, key }) => (
          <Component
            key={key}
            position={position}
            rotation={rotation}
            scale={scale}
            color={color}
          />
        ))}
        
        <fog attach="fog" args={['#000000', 15, 25]} />
      </Canvas>
    </div>
  );
};

export default ThreeBackground;