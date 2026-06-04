import * as THREE from 'three';

// FIX: Mathematical guarantee that (0,0) is land. Cos(0) = 1!
export function getElevation(x, z) {
    // Peak continent sits dead center on the spawn
    const continent = Math.cos(x * 0.00005) * Math.cos(z * 0.00005) * 1200;
    // Offset the mountains so they don't crush the spawn point
    const mountains = Math.sin(x * 0.0002 + 123) * Math.cos(z * 0.0002 + 321) * 800;
    const plains = Math.sin(x * 0.001) * Math.cos(z * 0.001) * 120;
    const details = Math.sin(x * 0.005) * Math.cos(z * 0.005) * 40;

    // (1200 + (-304) + 0 + 0) - 880 = 16 Elevation at spawn! Perfect Grassland.
    return continent + mountains + plains + details - 880;
}

export class TerrainManager {
    constructor(scene) {
        this.scene = scene;

        this.size = 8000;
        this.segments = 200;
        this.segmentSize = this.size / this.segments;

        this.groundGeo = new THREE.PlaneGeometry(this.size, this.size, this.segments, this.segments);
        this.groundGeo.rotateX(-Math.PI / 2);

        const posAttr = this.groundGeo.attributes.position;
        const colors = new Float32Array(posAttr.count * 3);
        this.groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const groundMat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            flatShading: true,
            roughness: 0.9
        });

        this.ground = new THREE.Mesh(this.groundGeo, groundMat);
        this.ground.receiveShadow = true;
        this.ground.userData = { isGround: true };
        this.scene.add(this.ground);

        // --- GLOBAL OCEAN ---
        const seaGeo = new THREE.PlaneGeometry(this.size, this.size);
        seaGeo.rotateX(-Math.PI / 2);
        const seaMat = new THREE.MeshStandardMaterial({
            color: '#1a5b7d',
            transparent: true,
            opacity: 0.75,
            roughness: 0.1,
            metalness: 0.8,
            depthWrite: false
        });
        this.sea = new THREE.Mesh(seaGeo, seaMat);
        this.sea.position.y = 0; // Sea Level
        this.scene.add(this.sea);

        this.lastSnapX = null;
        this.lastSnapZ = null;

        // --- ENDLESS WINDY GRASS SHADER ---
        const grassCount = 10000;
        const grassGeo = new THREE.ConeGeometry(1.5, 5, 3);
        const grassMat = new THREE.MeshStandardMaterial({ color: '#448530', flatShading: true, side: THREE.DoubleSide });

        grassMat.onBeforeCompile = (shader) => {
            shader.uniforms.time = { value: 0 };
            shader.uniforms.playerPos = { value: new THREE.Vector3() };
            this.grassShader = shader;
            shader.vertexShader = `
                uniform float time;
                uniform vec3 playerPos;

                float getShaderElevation(float x, float z) {
                    float continent = cos(x * 0.00005) * cos(z * 0.00005) * 1200.0;
                    float mountains = sin(x * 0.0002 + 123.0) * cos(z * 0.0002 + 321.0) * 800.0;
                    float plains = sin(x * 0.001) * cos(z * 0.001) * 120.0;
                    float details = sin(x * 0.005) * cos(z * 0.005) * 40.0;
                    return continent + mountains + plains + details - 880.0;
                }

                ${shader.vertexShader}
            `.replace(
                `#include <project_vertex>`,
                `
                vec4 mWorld = modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
                float range = 4000.0;
                vec2 delta = mWorld.xz - playerPos.xz;
                vec2 wrappedDelta = mod(delta + range/2.0, range) - range/2.0;
                
                vec4 worldVertex = modelMatrix * instanceMatrix * vec4( transformed, 1.0 );
                worldVertex.xz += (wrappedDelta - delta);
                
                float elev = getShaderElevation(worldVertex.x, worldVertex.z);
                worldVertex.y += elev;
                
                if (elev < 5.0 || elev > 400.0) {
                    worldVertex.y -= 1000.0; 
                } else {
                    float wind = sin(worldVertex.x * 0.005 + time * 1.5) * 0.5 + sin(worldVertex.z * 0.005 + time * 1.2) * 0.5;
                    if (position.y > 1.0) {
                        worldVertex.x += wind * (position.y * 0.2);
                        worldVertex.z += wind * (position.y * 0.2);
                    }
                }

                vec4 mvPosition = viewMatrix * worldVertex;
                gl_Position = projectionMatrix * mvPosition;
                `
            );
        };

        this.grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
        this.grassMesh.receiveShadow = true;
        this.grassMesh.frustumCulled = false;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < grassCount; i++) {
            const x = (Math.random() - 0.5) * 4000;
            const z = (Math.random() - 0.5) * 4000;
            dummy.position.set(x, 2.5, z);
            dummy.rotation.y = Math.random() * Math.PI;
            dummy.rotation.x = (Math.random() - 0.5) * 0.2;
            dummy.rotation.z = (Math.random() - 0.5) * 0.2;
            const scale = 0.5 + Math.random() * 1.5;
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();
            this.grassMesh.setMatrixAt(i, dummy.matrix);
        }
        this.scene.add(this.grassMesh);
    }

    update(px, pz) {
        const snapX = Math.floor(px / this.segmentSize) * this.segmentSize;
        const snapZ = Math.floor(pz / this.segmentSize) * this.segmentSize;

        if (this.lastSnapX !== snapX || this.lastSnapZ !== snapZ) {
            this.ground.position.set(snapX, 0, snapZ);
            this.sea.position.set(snapX, 0, snapZ);

            const posAttr = this.groundGeo.attributes.position;
            const colAttr = this.groundGeo.attributes.color;
            const c3 = new THREE.Color();

            for (let i = 0; i < posAttr.count; i++) {
                const lx = posAttr.getX(i);
                const lz = posAttr.getZ(i);
                const worldX = snapX + lx;
                const worldZ = snapZ + lz;

                const elev = getElevation(worldX, worldZ);
                posAttr.setY(i, elev);

                if (elev <= 5) {
                    c3.set('#e6d690');
                } else if (elev < 30) {
                    const t = (elev - 5) / 25;
                    c3.set('#e6d690').lerp(new THREE.Color('#39602b'), t);
                } else if (elev > 800) {
                    const t = Math.min(1, (elev - 800) / 200);
                    c3.set('#666666').lerp(new THREE.Color('#ffffff'), t);
                } else if (elev > 400) {
                    const t = Math.min(1, (elev - 400) / 400);
                    c3.set('#39602b').lerp(new THREE.Color('#666666'), t);
                } else {
                    c3.set('#39602b');
                }

                colAttr.setXYZ(i, c3.r, c3.g, c3.b);
            }

            posAttr.needsUpdate = true;
            colAttr.needsUpdate = true;
            this.groundGeo.computeVertexNormals();
            this.groundGeo.computeBoundingBox();
            this.groundGeo.computeBoundingSphere();

            this.lastSnapX = snapX;
            this.lastSnapZ = snapZ;
        }

        if (this.grassShader) {
            this.grassShader.uniforms.time.value = Date.now() / 1000;
            this.grassShader.uniforms.playerPos.value.set(px, 0, pz);
        }
    }
}