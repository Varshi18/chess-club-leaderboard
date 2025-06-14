import React, { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const pieceLayout = [
  { file: 'white_rook.glb', position: [-4, 0, -2] },
  { file: 'white_knight.glb', position: [-2.5, 0, -1.5] },
  { file: 'white_bishop.glb', position: [-1, 0, -2] },
  { file: 'white_queen.glb', position: [0, 0, -1] },
  { file: 'white_king.glb', position: [1.5, 0, -1.5] },
  { file: 'white_pawn.glb', position: [3, 0, -2] },
  { file: 'black_rook.glb', position: [-4, 0, 2] },
  { file: 'black_knight.glb', position: [-2.5, 0, 1.5] },
  { file: 'black_bishop.glb', position: [-1, 0, 2] },
  { file: 'black_queen.glb', position: [0, 0, 1] },
  { file: 'black_king.glb', position: [1.5, 0, 1.5] },
  { file: 'black_pawn.glb', position: [3, 0, 2] },
];

const ChessPiece = ({ file, position }) => {
  const { scene } = useGLTF(`/models/${file}`);
  const ref = useRef();
  const [hovered, setHovered] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Handle scroll and mouse position
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    const handleMouseMove = (e) => {
      setMousePos({
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1,
      });
    };
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  useFrame((state) => {
    if (ref.current) {
      // Rotate piece
      ref.current.rotation.y += 0.005;

      // Tilt based on mouse position
      ref.current.rotation.x = THREE.MathUtils.lerp(
        ref.current.rotation.x,
        mousePos.y * 0.3,
        0.05
      );
      ref.current.rotation.z = THREE.MathUtils.lerp(
        ref.current.rotation.z,
        -mousePos.x * 0.3,
        0.05
      );

      // Float effect
      ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime + position[0]) * 0.2;

      // Scale based on scroll and hover
      const scrollScale = 0.55 + Math.min(scrollY / 2000, 0.3);
      ref.current.scale.setScalar(hovered ? scrollScale * 1.2 : scrollScale);
    }
  });

  return (
    <primitive
      object={scene}
      ref={ref}
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    />
  );
};

const ChessScene = () => {
  return (
    <>
      {pieceLayout.map((p, idx) => (
        <ChessPiece key={idx} file={p.file} position={p.position} />
      ))}
    </>
  );
};

const ThreeBackground = () => {
  return (
    <div className="fixed inset-0 -z-10 w-full h-full overflow-hidden">
      <Canvas camera={{ position: [0, 3, 10], fov: 50 }} shadows>
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[5,8,5]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <Suspense fallback={null}>
          <ChessScene />
        </Suspense>
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          maxPolarAngle={Math.PI / 2.2}
          minPolarAngle={Math.PI / 3.5}
        />
      </Canvas>
    </div>
  );
};

export default ThreeBackground;