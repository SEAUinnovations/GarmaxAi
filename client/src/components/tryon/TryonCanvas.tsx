import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TextureLoader } from "three";
import * as THREE from "three";

interface TryonCanvasProps {
  avatarUrl?: string;
  garments?: Array<{
    id: string;
    imageUrl: string;
    isOverlayable: boolean;
    garmentType: string;
  }>;
}

function AvatarModel({ url }: { url: string }) {
  const gltf = useLoader(GLTFLoader, url);
  const meshRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (meshRef.current) {
      // Subtle idle animation
      meshRef.current.rotation.y += 0.001;
    }
  });

  return (
    <primitive
      ref={meshRef}
      object={gltf.scene}
      scale={1}
      position={[0, -1, 0]}
    />
  );
}

function GarmentOverlay({
  imageUrl,
  garmentType,
}: {
  imageUrl: string;
  garmentType: string;
}) {
  const texture = useLoader(TextureLoader, imageUrl);
  const meshRef = useRef<THREE.Mesh>(null);

  // Position based on garment type
  const getPosition = (): [number, number, number] => {
    switch (garmentType) {
      case "shirt":
      case "top":
        return [0, 0.5, 0.1];
      case "pants":
      case "jeans":
        return [0, -0.3, 0.1];
      case "dress":
        return [0, 0.2, 0.1];
      case "jacket":
        return [0, 0.6, 0.12];
      default:
        return [0, 0, 0.1];
    }
  };

  const getScale = (): [number, number, number] => {
    switch (garmentType) {
      case "shirt":
      case "top":
        return [0.6, 0.8, 1];
      case "pants":
      case "jeans":
        return [0.5, 1, 1];
      case "dress":
        return [0.6, 1.2, 1];
      case "jacket":
        return [0.7, 0.9, 1];
      default:
        return [0.5, 0.5, 1];
    }
  };

  return (
    <mesh ref={meshRef} position={getPosition()} scale={getScale()}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent
        side={THREE.DoubleSide}
        alphaTest={0.5}
      />
    </mesh>
  );
}

function Loader() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#8B5CF6" wireframe />
    </mesh>
  );
}

export default function TryonCanvas({ avatarUrl, garments = [] }: TryonCanvasProps) {
  const [error, setError] = useState<string | null>(null);

  // Use demo avatar if none provided
  const modelUrl = avatarUrl || "/demo-avatar.glb";

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [0, 0, 3], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={<Loader />}>
          {/* Lighting */}
          <ambientLight intensity={0.5} />
          <directionalLight
            position={[5, 5, 5]}
            intensity={1}
            castShadow
          />
          <spotLight
            position={[-5, 5, 5]}
            angle={0.3}
            penumbra={1}
            intensity={0.5}
            castShadow
          />

          {/* Environment */}
          <Environment preset="city" />

          {/* Avatar Model */}
          {modelUrl && (
            <AvatarModel url={modelUrl} />
          )}

          {/* Garment Overlays */}
          {garments
            .filter((g) => g.isOverlayable)
            .map((garment) => (
              <GarmentOverlay
                key={garment.id}
                imageUrl={garment.imageUrl}
                garmentType={garment.garmentType}
              />
            ))}

          {/* Ground Shadow */}
          <ContactShadows
            position={[0, -1, 0]}
            opacity={0.4}
            scale={10}
            blur={1.5}
            far={2}
          />

          {/* Camera Controls */}
          <OrbitControls
            enablePan={false}
            enableZoom={true}
            minDistance={2}
            maxDistance={5}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI / 1.5}
          />
        </Suspense>
      </Canvas>

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="text-center space-y-2">
            <p className="text-destructive font-medium">Error loading 3D model</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {/* Controls Hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full text-xs text-white/80">
        Click & drag to rotate • Scroll to zoom
      </div>
    </div>
  );
}
