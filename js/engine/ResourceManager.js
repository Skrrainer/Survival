import * as THREE from 'three';
import { getElevation } from './TerrainManager.js';

export class ResourceManager {
    constructor(scene) {
        this.scene = scene;
        this.meshes = new Map();
        this.ghostMesh = null;

        // Base Geometries
        this._treeTrunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 1.5, 8);
        this._treeTrunkGeo.translate(0, 0.75, 0);
        this._treeLeavesGeo = new THREE.ConeGeometry(1.0, 2.5, 8);
        this._treeLeavesGeo.translate(0, 2.6, 0);
        this._treeTrunkMat = new THREE.MeshStandardMaterial({ color: '#5c4033' });

        this._rockGeo = new THREE.DodecahedronGeometry(1.0);
        this._rockGeo.translate(0, 1.0, 0);

        this._waterGeo = new THREE.CylinderGeometry(1, 1, 0.1, 16);
        this._waterMat = new THREE.MeshStandardMaterial({ color: '#2980b9', transparent: true, opacity: 0.65, roughness: 0.1, metalness: 0.2, depthWrite: false });

        this._bushFoliageGeo = new THREE.SphereGeometry(1, 7, 6);
        this._bushFoliageMat = new THREE.MeshStandardMaterial({ color: '#3a6e30', roughness: 0.9, flatShading: true });
        this._bushFoliageBareMat = new THREE.MeshStandardMaterial({ color: '#2a4a20', roughness: 0.9, flatShading: true });
        this._bushStemGeo = new THREE.CylinderGeometry(0.4, 0.7, 4, 6);
        this._bushStemMat = new THREE.MeshStandardMaterial({ color: '#4a3728', roughness: 1.0 });
        this._berryGeo = new THREE.SphereGeometry(0.9, 6, 5);
        this._berryMat = new THREE.MeshStandardMaterial({ color: '#2c3e9e', roughness: 0.4, metalness: 0.1 });

        this._berryOffsets = [
            new THREE.Vector3( 5.5,  7.0,  2.0),
            new THREE.Vector3(-4.5,  8.0, -3.5),
            new THREE.Vector3( 1.5, 12.5,  1.5),
            new THREE.Vector3(-2.5,  4.5,  4.5),
            new THREE.Vector3( 4.0,  6.0, -4.5),
        ];
    }

    createGhostMesh(itemType) {
        this.removeGhostMesh();
        if (itemType === 'crafting_table') {
            this.ghostMesh = new THREE.Group();
            const legsMat = new THREE.MeshStandardMaterial({ color: '#5c4033', transparent: true, opacity: 0.5 });
            const legs = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 8), legsMat);
            legs.position.y = 4;
            this.ghostMesh.add(legs);

            const topMat = new THREE.MeshStandardMaterial({ color: '#8B6914', transparent: true, opacity: 0.5 });
            const top = new THREE.Mesh(new THREE.BoxGeometry(12, 2, 12), topMat);
            top.position.y = 9;
            this.ghostMesh.add(top);

            const outlineMat = new THREE.MeshBasicMaterial({ color: '#00ff88', transparent: true, opacity: 0.15, side: THREE.BackSide });
            const outline = new THREE.Mesh(new THREE.BoxGeometry(14, 12, 14), outlineMat);
            outline.position.y = 5;
            this.ghostMesh.add(outline);
        }
        if (this.ghostMesh) {
            this.ghostMesh.userData = { isGhost: true };
            this.scene.add(this.ghostMesh);
        }
    }

    updateGhostMesh(x, z) {
        if (this.ghostMesh) {
            this.ghostMesh.position.set(x, getElevation(x, z), z);
        }
    }

    removeGhostMesh() {
        if (this.ghostMesh) {
            this.scene.remove(this.ghostMesh);
            this.ghostMesh = null;
        }
    }

    _buildBlueberryBush(resource) {
        const group = new THREE.Group();
        const stem = new THREE.Mesh(this._bushStemGeo, this._bushStemMat);
        stem.position.y = 2;
        stem.castShadow = true;
        group.add(stem);

        const foliagePositions = [
            { x:  0,   y: 7,   z:  0,   s: 5.5 },
            { x:  3,   y: 5.5, z:  1,   s: 4.0 },
            { x: -3,   y: 5.5, z: -1,   s: 4.0 },
        ];
        foliagePositions.forEach(fp => {
            const f = new THREE.Mesh(this._bushFoliageGeo, this._bushFoliageMat);
            f.position.set(fp.x, fp.y, fp.z);
            f.scale.setScalar(fp.s);
            f.castShadow = true;
            f.receiveShadow = true;
            f.userData.isFoliage = true;
            group.add(f);
        });

        const berryMeshes = [];
        this._berryOffsets.forEach((offset, i) => {
            const berry = new THREE.Mesh(this._berryGeo, this._berryMat);
            berry.position.copy(offset);
            berry.castShadow = false;
            berry.visible = i < resource.berryCount;
            berry.userData.isBerry = true;
            berry.userData.berryIndex = i;
            group.add(berry);
            berryMeshes.push(berry);
        });

        group.userData.resource = resource;
        group.userData.berryMeshes = berryMeshes;
        group.userData.lastBerryCount = resource.berryCount;
        return group;
    }

    update(state) {
        const currentIds = new Set(state.resources.map(r => r.id));
        for (let [id, mesh] of this.meshes.entries()) {
            if (!currentIds.has(id)) {
                this.scene.remove(mesh);
                this.meshes.delete(id);
            }
        }

        state.resources.forEach((resource) => {
            const key = resource.id;

            if (!this.meshes.has(key)) {
                let mesh;

                if (resource.type === 'tree') {
                    mesh = new THREE.Group();
                    const trunk = new THREE.Mesh(this._treeTrunkGeo, this._treeTrunkMat);
                    trunk.castShadow = true;
                    trunk.receiveShadow = true;
                    mesh.add(trunk);

                    const leavesMat = new THREE.MeshStandardMaterial({ color: resource.color });
                    const leaves = new THREE.Mesh(this._treeLeavesGeo, leavesMat);
                    leaves.castShadow = true;
                    leaves.receiveShadow = true;
                    mesh.add(leaves);
                    mesh.scale.setScalar(resource.size);

                } else if (resource.type === 'rock') {
                    const rockMat = new THREE.MeshStandardMaterial({ color: resource.color, flatShading: true });
                    mesh = new THREE.Mesh(this._rockGeo, rockMat);
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    mesh.scale.setScalar(resource.size);

                } else if (resource.type === 'water') {
                    mesh = new THREE.Mesh(this._waterGeo, this._waterMat);
                    mesh.scale.set(resource.size, 1, resource.size);
                    mesh.receiveShadow = true;

                } else if (resource.type === 'stick') {
                    mesh = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.5, 0.5, 8, 6),
                        new THREE.MeshStandardMaterial({ color: resource.color })
                    );
                    mesh.rotation.z = Math.PI / 2;
                    mesh.rotation.y = Math.random() * Math.PI;
                    mesh.castShadow = true;

                } else if (resource.type === 'pebble') {
                    mesh = new THREE.Mesh(
                        new THREE.DodecahedronGeometry(resource.size),
                        new THREE.MeshStandardMaterial({ color: resource.color, flatShading: true })
                    );
                    mesh.castShadow = true;

                } else if (resource.type === 'crafting_table') {
                    mesh = new THREE.Group();
                    const legs = new THREE.Mesh(
                        new THREE.BoxGeometry(8, 8, 8),
                        new THREE.MeshStandardMaterial({ color: '#5c4033' })
                    );
                    legs.position.y = 4;
                    mesh.add(legs);

                    const top = new THREE.Mesh(
                        new THREE.BoxGeometry(12, 2, 12),
                        new THREE.MeshStandardMaterial({ color: resource.color })
                    );
                    top.position.y = 9;
                    mesh.add(top);
                    mesh.castShadow = true;

                } else if (resource.type === 'blueberry_bush') {
                    mesh = this._buildBlueberryBush(resource);
                }

                if (mesh) {
                    mesh.position.x = resource.x;
                    mesh.position.z = resource.y;

                    const elevation = getElevation(resource.x, resource.y);
                    let baseOffset = 0;
                    if (resource.type === 'water') baseOffset = 0.5;
                    if (resource.type === 'stick') baseOffset = 1.0;
                    if (resource.type === 'pebble') baseOffset = 1.5;

                    mesh.position.y = elevation + baseOffset;

                    if (resource.type !== 'blueberry_bush') {
                        mesh.userData = { resource: resource, baseOffset: baseOffset };
                    } else {
                        mesh.userData.baseOffset = baseOffset;
                    }

                    this.scene.add(mesh);
                    this.meshes.set(key, mesh);
                }

            } else {
                const mesh = this.meshes.get(key);

                if (resource.isFalling) {
                    mesh.rotation.x = resource.fallAngle;
                    mesh.rotation.z = resource.fallAngle * resource.fallDirection;
                    const elevation = getElevation(resource.x, resource.y);
                    mesh.position.y = elevation + mesh.userData.baseOffset - (resource.fallAngle * 5);
                }

                if (resource.type === 'blueberry_bush' && mesh.userData.lastBerryCount !== resource.berryCount) {
                    mesh.userData.lastBerryCount = resource.berryCount;
                    mesh.userData.berryMeshes.forEach((berry, i) => {
                        berry.visible = i < resource.berryCount;
                    });

                    mesh.children.forEach(child => {
                        if (child.userData.isFoliage) {
                            child.material = resource.berryCount === 0
                                ? this._bushFoliageBareMat
                                : this._bushFoliageMat;
                        }
                    });
                }
            }
        });
    }
}