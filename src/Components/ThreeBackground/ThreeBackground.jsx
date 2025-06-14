import React, { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, useGLTF, Preload } from '@react-three/drei';

const AnimatedGLB = ({ modelPath, position, rotation, scale = 1, animPhase = 0}) => {
  const { scene } = useGLTF(modelPath);
  const ref = useRef();

  useFrame((state) => {
    if (ref.current) {
      const mouseInfluence = (state.pointer.x + state.pointer.y) * 0.1;
      ref.current.rotation.y += 0.0002 + mouseInfluence * 0.0004;
      ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.3 + animPhase) * 0.02;
    }
  });

  return (
    <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.1}>
      <primitive
        object={scene}
        ref={ref}
        position={position}
        rotation={rotation}
        scale={scale}
      />
    </Float>
  );
};

const pieceTypes = [
  { name: 'rook', path: '/models/white_rook.glb' },
  { name: 'knight', path: '/models/white_knight.glb' },
  { name: 'bishop', path: '/models/white_bishop.glb' },
  { name: 'queen', path: '/models/white_queen.glb' },
  { name: 'king', path: '/models/white_king.glb' },
  { name: 'pawn', path: '/models/white_pawn.glb' },
  { name: 'rook', path: '/models/black_rook.glb' },
  { name: 'knight', path: '/models/black_knight.glb' },
  { name: 'bishop', path: '/models/black_bishop.glb' },
  { name: 'queen', path: '/models/black_queen.glb' },
  { name: 'king', path: '/models/black_king.glb' },
  { name: 'pawn', path: '/models/black_pawn.glb' },
];

const ThreeBackground = () => {
  const pieces = useMemo(() => {
    const placements = [];
    for (let i = 0; i < 100; i++) {
      const { path } = pieceTypes[Math.floor(Math.random() * pieceTypes.length)];
      const position = [
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 20,
      ];
      const rotation = [
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      ];
      const scale = 0.8 + Math.random() * 0.6;
      const animPhase = i * 0.5;
      placements.push({ path, position, rotation, scale, animPhase, key: i });
    }
    return placements;
  }, []);

  return (
    <div className="fixed inset-0 -z-10">
      <Canvas camera={{ position: [0, 0, 10], fov: 60 }} style={{ background: 'transparent' }}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[10, 10, 5]} intensity={0.5} />
        <pointLight position={[-10, -10, -5]} intensity={0.3} color="#ffd700" />
        <Suspense fallback={null}>
          {pieces.map(({ path, position, rotation, scale, animPhase, key }) => (
            <AnimatedGLB
              key={key}
              modelPath={path}
              position={position}
              rotation={rotation}
              scale={scale}
              animPhase={animPhase}
            />
          ))}
        </Suspense>
        <fog attach="fog" args={['#000000', 15, 25]} />
        <Preload all />
      </Canvas>
    </div>
  );
};

export default ThreeBackground;

useGLTF.preload('/models/white_rook.glb');
useGLTF.preload('/models/white_knight.glb');
useGLTF.preload('/models/white_bishop.glb');
useGLTF.preload('/models/white_queen.glb');
useGLTF.preload('/models/white_king.glb');
useGLTF.preload('/models/white_pawn.glb');
useGLTF.preload('/models/black_rook.glb');
useGLTF.preload('/models/black_knight.glb');
useGLTF.preload('/models/black_bishop.glb');
useGLTF.preload('/models/black_queen.glb');
useGLTF.preload('/models/black_king.glb');
useGLTF.preload('/models/black_pawn.glb');
