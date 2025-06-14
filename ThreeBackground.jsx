import React, { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, OrbitControls, useGLTF, Preload } from '@react-three/drei';

// --- LOAD AND ANIMATE GLB PIECES ---

const AnimatedGLB = ({ modelPath, position, rotation, scale = 1, animPhase = 0 }) => {
  const gltf = useGLTF(modelPath);
  const ref = useRef();

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y += 0.003;
      ref.current.position.y =
        position[1] + Math.sin(state.clock.elapsedTime + animPhase) * 0.07;
    }
  });

  return (
    <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.1}>
      <primitive
        object={gltf?.scene || null}
        ref={ref}
        position={position}
        rotation={rotation}
        scale={scale}
      />
    </Float>
  );
};

// --- PIECE MAPPINGS ---

const pieceMap = {
  Rook: (props) => <AnimatedGLB modelPath={`/models/${props.color}_rook.glb`} {...props} />,
  Knight: (props) => <AnimatedGLB modelPath={`/models/${props.color}_knight.glb`} {...props} />,
  Bishop: (props) => <AnimatedGLB modelPath={`/models/${props.color}_bishop.glb`} {...props} />,
  Queen: (props) => <AnimatedGLB modelPath={`/models/${props.color}_queen.glb`} {...props} />,
  King: (props) => <AnimatedGLB modelPath={`/models/${props.color}_king.glb`} {...props} />,
  Pawn: (props) => <AnimatedGLB modelPath={`/models/${props.color}_pawn.glb`} {...props} />,
};

const pieceRows = [
  ['Rook', 'Knight', 'Bishop', 'Queen', 'King', 'Bishop', 'Knight', 'Rook'],
  Array(8).fill('Pawn'),
  [],
  [],
  [],
  [],
  Array(8).fill('Pawn'),
  ['Rook', 'Knight', 'Bishop', 'Queen', 'King', 'Bishop', 'Knight', 'Rook'],
];

const getColorName = (rowIdx) => {
  return rowIdx < 2 ? 'white' : 'black';
};

// --- COMPONENT ---

const ThreeBackground = () => {
  const pieces = useMemo(() => {
    const spacingX = 1.4;
    const spacingZ = 1.4;
    const rows = [];
    for (let row = 0; row < pieceRows.length; row++) {
      const cols = pieceRows[row];
      if (!cols.length) continue;
      for (let col = 0; col < cols.length; col++) {
        const name = cols[col];
        if (!name) continue;
        const PieceComp = pieceMap[name];
        if (!PieceComp) continue;
        const colorName = getColorName(row);
        const offsetX = (Math.random() - 0.5) * 0.2;
        const offsetZ = (Math.random() - 0.5) * 0.2;
        const animPhase = (row + 1) * 0.4 + col * 0.7;
        rows.push(
          <PieceComp
            key={`${row}-${col}`}
            position={[(col - 3.5) * spacingX + offsetX, 0, (row - 3.5) * spacingZ + offsetZ]}
            rotation={[0, 0, 0]}
            scale={row === 0 || row === 7 ? 1.15 : 1}
            color={colorName}
            animPhase={animPhase}
          />
        );
      }
    }
    return rows;
  }, []);

  return (
    <div className="fixed inset-0 -z-10 w-screen h-screen overflow-hidden">
      <Canvas camera={{ position: [0, 3, 10], fov: 55 }} shadows>
        <ambientLight intensity={0.7} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <Suspense fallback={null}>
          {pieces}
        </Suspense>
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          maxPolarAngle={Math.PI / 2.1}
          minPolarAngle={Math.PI / 3.5}
        />
        <Preload all />
      </Canvas>
    </div>
  );
};

export default ThreeBackground;

useGLTF.preload('/models/white_rook.glb');
useGLTF.preload('/models/black_rook.glb');
useGLTF.preload('/models/white_knight.glb');
useGLTF.preload('/models/black_knight.glb');
useGLTF.preload('/models/white_bishop.glb');
useGLTF.preload('/models/black_bishop.glb');
useGLTF.preload('/models/white_queen.glb');
useGLTF.preload('/models/black_queen.glb');
useGLTF.preload('/models/white_king.glb');
useGLTF.preload('/models/black_king.glb');
useGLTF.preload('/models/white_pawn.glb');
useGLTF.preload('/models/black_pawn.glb');