import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";

export default function StudioScene() {
  return (
    <div className="h-full w-full rounded-3xl overflow-hidden">
      <Canvas camera={{ position: [4, 4, 4], fov: 50 }}>
        {/* Licht */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={1} />

        {/* Grid vloer */}
        <Grid
          position={[0, 0, 0]}
          args={[20, 20]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#000000"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#000000"
          fadeDistance={30}
          fadeStrength={1}
        />

        {/* Test blok */}
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#999999" />
        </mesh>

        <OrbitControls />
      </Canvas>
    </div>
  );
}
