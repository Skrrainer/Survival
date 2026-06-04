import * as THREE from 'three';

export function getElevation(x, z) {
    const continent = Math.cos(x * 0.00005) * Math.cos(z * 0.00005) * 1200;
    const mountains = Math.sin(x * 0.0002 + 123) * Math.cos(z * 0.0002 + 321) * 800;
    const plains = Math.sin(x * 0.001) * Math.cos(z * 0.001) * 120;
    const details = Math.sin(x * 0.005) * Math.cos(z * 0.005) * 40;
    return continent + mountains + plains + details - 880;
}

export class Renderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#1e2b1e');

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);

        this.zoomDist = 800;
        this.camAzimuth = Math.PI / 4;
        this.camPolar = Math.PI / 3;

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.deltaY > 0) this.zoomDist = Math.min(2500, this.zoomDist + 100);
            else this.zoomDist = Math.max(300, this.zoomDist - 100);
        }, { passive: false });

        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(this.ambientLight);

        this.dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.camera.left = -1500;
        this.dirLight.shadow.camera.right = 1500;
        this.dirLight.shadow.camera.top = 1500;
        this.dirLight.shadow.camera.bottom = -1500;
        this.dirLight.shadow.mapSize.width = 2048;
        this.dirLight.shadow.mapSize.height = 2048;
        this.scene.add(this.dirLight);

        this.groundGeo = new THREE.PlaneGeometry(12000, 12000, 200, 200);
        this.groundGeo.rotateX(-Math.PI / 2);

        const posAttr = this.groundGeo.attributes.position;
        const colors = new Float32Array(posAttr.count * 3);
        this.groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
        this.ground = new THREE.Mesh(this.groundGeo, groundMat);
        this.ground.receiveShadow = true;
        this.ground.userData = { isGround: true };
        this.ground.frustumCulled = false;
        this.scene.add(this.ground);

        const seaMat = new THREE.MeshStandardMaterial({ color: '#1a5b7d', transparent: true, opacity: 0.8, depthWrite: false });
        this.sea = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000), seaMat);
        this.sea.rotation.x = -Math.PI / 2;
        this.sea.frustumCulled = false;
        this.scene.add(this.sea);

        this.survivorMesh = null;
        this.resourceMeshes = new Map();
        this.animalMeshes = new Map();
        this.projectileMeshes = [];
        this.ghostMesh = null;

        this._treeTrunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 1.5, 8);
        this._treeTrunkGeo.translate(0, 0.75, 0);
        this._treeLeavesGeo = new THREE.ConeGeometry(1.0, 2.5, 8);
        this._treeLeavesGeo.translate(0, 2.6, 0);
        this._rockGeo = new THREE.DodecahedronGeometry(1.0);
        this._rockGeo.translate(0, 1.0, 0);
        this._waterGeo = new THREE.CylinderGeometry(1, 1, 0.1, 16);

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

    rotateCamera(dx, dy) {
        this.camAzimuth -= dx * 0.005;
        this.camPolar -= dy * 0.005;
        this.camPolar = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, this.camPolar));
    }

    createGhostMesh(itemType) {
        if (this.ghostMesh) this.scene.remove(this.ghostMesh);
        this.ghostMesh = new THREE.Mesh(
            new THREE.BoxGeometry(10, 10, 10),
            new THREE.MeshBasicMaterial({ color: '#00ff88', transparent: true, opacity: 0.5 })
        );
        this.ghostMesh.userData = { isGhost: true };
        this.scene.add(this.ghostMesh);
    }

    updateGhostMesh(x, z) {
        if (this.ghostMesh) this.ghostMesh.position.set(x, getElevation(x, z) + 5, z);
    }

    removeGhostMesh() {
        if (this.ghostMesh) { this.scene.remove(this.ghostMesh); this.ghostMesh = null; }
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
        group.userData.offset = 0;
        return group;
    }

    render(state) {
        let px = 0, pz = 0, playerY = 0;
        if (state.survivor) {
            px = state.survivor.x;
            pz = state.survivor.y;
            playerY = getElevation(px, pz);
        }

        const camX = px + this.zoomDist * Math.sin(this.camPolar) * Math.sin(this.camAzimuth);
        const camY = playerY + this.zoomDist * Math.cos(this.camPolar);
        const camZ = pz + this.zoomDist * Math.sin(this.camPolar) * Math.cos(this.camAzimuth);
        this.camera.position.set(camX, camY, camZ);
        this.camera.lookAt(px, playerY + 10, pz);

        const snapX = Math.floor(px / 60) * 60;
        const snapZ = Math.floor(pz / 60) * 60;
        if (this.lastSnapX !== snapX || this.lastSnapZ !== snapZ) {
            this.ground.position.set(snapX, 0, snapZ);
            this.sea.position.set(snapX, 0, snapZ);
            const posAttr = this.groundGeo.attributes.position;
            const colAttr = this.groundGeo.attributes.color;
            const c3 = new THREE.Color();
            for (let i = 0; i < posAttr.count; i++) {
                const worldX = snapX + posAttr.getX(i);
                const worldZ = snapZ + posAttr.getZ(i);
                const elev = getElevation(worldX, worldZ);
                posAttr.setY(i, elev);

                if (elev <= 5) c3.set('#e6d690');
                else if (elev < 30) c3.set('#e6d690').lerp(new THREE.Color('#39602b'), (elev-5)/25);
                else if (elev > 800) c3.set('#666666').lerp(new THREE.Color('#ffffff'), Math.min(1,(elev-800)/200));
                else if (elev > 400) c3.set('#39602b').lerp(new THREE.Color('#666666'), Math.min(1,(elev-400)/400));
                else c3.set('#39602b');

                colAttr.setXYZ(i, c3.r, c3.g, c3.b);
            }
            posAttr.needsUpdate = true;
            colAttr.needsUpdate = true;
            this.groundGeo.computeVertexNormals();
            this.lastSnapX = snapX; this.lastSnapZ = snapZ;
        }

        const sunAngle = state.time.sunAngle;
        this.dirLight.position.set(px + Math.cos(sunAngle)*2000, playerY + Math.sin(sunAngle)*2000, pz + Math.cos(sunAngle)*1000);
        this.dirLight.target.position.set(px, playerY, pz);
        this.dirLight.target.updateMatrixWorld();
        this.dirLight.intensity = state.time.directionalLightIntensity;
        this.ambientLight.intensity = state.time.ambientLightIntensity;
        this.scene.background = new THREE.Color('#020406').lerp(new THREE.Color('#65a1c9'), state.time.skyTransition);

        if (state.survivor) {
            if (!this.survivorMesh) {
                this.survivorMesh = new THREE.Group();
                this.survivorBody = new THREE.Group();
                this.survivorMesh.add(this.survivorBody);

                this.upperBody = new THREE.Group();
                this.upperBody.position.y = 10;
                this.survivorBody.add(this.upperBody);

                const torso = new THREE.Mesh(new THREE.BoxGeometry(6, 12, 4), new THREE.MeshStandardMaterial({ color: '#3498db' }));
                torso.position.y = 4;
                torso.castShadow = true;
                this.upperBody.add(torso);

                // Add distinguishing features so we can easily tell front from back
                const backpack = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 2.5), new THREE.MeshStandardMaterial({ color: '#27ae60' }));
                backpack.position.set(0, 6, -2.5); // Back
                backpack.castShadow = true;
                this.upperBody.add(backpack);

                const visor = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1, 2), new THREE.MeshStandardMaterial({ color: '#222' }));
                visor.position.set(0, 12.5, 2.5); // Front (+Z)
                visor.castShadow = true;
                this.upperBody.add(visor);

                const head = new THREE.Mesh(new THREE.SphereGeometry(3), new THREE.MeshStandardMaterial({ color: '#f1c27d' }));
                head.position.y = 12;
                head.castShadow = true;
                this.upperBody.add(head);

                const armGeo = new THREE.CylinderGeometry(1, 1, 10);
                armGeo.translate(0, -5, 0);
                this.leftArm = new THREE.Mesh(armGeo, new THREE.MeshStandardMaterial({ color: '#f1c27d' }));
                this.leftArm.position.set(-4.5, 9, 0);
                this.leftArm.castShadow = true;
                this.upperBody.add(this.leftArm);

                this.rightArm = new THREE.Mesh(armGeo, new THREE.MeshStandardMaterial({ color: '#f1c27d' }));
                this.rightArm.position.set(4.5, 9, 0);
                this.rightArm.castShadow = true;
                this.upperBody.add(this.rightArm);

                this.toolGroup = new THREE.Group();
                this.toolGroup.position.set(0, -8, 0);
                this.rightArm.add(this.toolGroup);

                this.axeVisual = new THREE.Group();
                const axeHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 8), new THREE.MeshStandardMaterial({color:'#5c4033'}));
                const axeHead = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 0.5), new THREE.MeshStandardMaterial({color:'#7f8c8d'}));
                axeHead.position.set(1.5, 3, 0);
                this.axeVisual.add(axeHandle, axeHead);
                this.axeVisual.rotation.x = Math.PI / 2;
                this.toolGroup.add(this.axeVisual);

                this.pickaxeVisual = new THREE.Group();
                const pickHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 8), new THREE.MeshStandardMaterial({color:'#5c4033'}));
                const pickHead = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1, 0.5), new THREE.MeshStandardMaterial({color:'#7f8c8d'}));
                pickHead.position.set(0, 3, 0);
                this.pickaxeVisual.add(pickHandle, pickHead);
                this.pickaxeVisual.rotation.x = Math.PI / 2;
                this.toolGroup.add(this.pickaxeVisual);

                this.bowVisual = new THREE.Mesh(new THREE.TorusGeometry(4, 0.3, 8, 20, Math.PI), new THREE.MeshStandardMaterial({color:'#5c4033'}));
                this.bowVisual.rotation.set(Math.PI/2, 0, 0); // Rotated so it's pointing forward 
                this.toolGroup.add(this.bowVisual);

                const legGeo = new THREE.CylinderGeometry(1.2, 1.2, 8);
                legGeo.translate(0, -4, 0);
                this.leftLeg = new THREE.Mesh(legGeo, new THREE.MeshStandardMaterial({ color: '#2c3e50' }));
                this.leftLeg.position.set(-2, 8, 0);
                this.leftLeg.castShadow = true;
                this.survivorBody.add(this.leftLeg);

                this.rightLeg = new THREE.Mesh(legGeo, new THREE.MeshStandardMaterial({ color: '#2c3e50' }));
                this.rightLeg.position.set(2, 8, 0);
                this.rightLeg.castShadow = true;
                this.survivorBody.add(this.rightLeg);
                this.scene.add(this.survivorMesh);
            }

            if (state.survivor.deathTimer > 0) {
                this.survivorMesh.visible = false;
            } else {
                this.survivorMesh.visible = true;
                const inWater = playerY < 2;

                this.survivorMesh.position.set(px, inWater ? Math.max(playerY - 6, 0) : playerY, pz);

                if (state.aiming && state.aimTarget) {
                    this.survivorMesh.rotation.y = Math.atan2(state.aimTarget.x - px, state.aimTarget.z - pz);
                } else if (state.survivor.rotation !== undefined) {
                    this.survivorMesh.rotation.y = state.survivor.rotation;
                }

                this.axeVisual.visible = !!state.survivor.isChopping;
                this.pickaxeVisual.visible = !!state.survivor.isMining;
                this.bowVisual.visible = !!state.aiming;

                if (inWater) {
                    this.survivorBody.rotation.x = Math.PI / 2;
                    this.upperBody.rotation.x = 0;
                    const swim = Math.sin(Date.now() * 0.005) * 0.5;
                    this.leftArm.rotation.set(0, 0, -Math.PI / 2 + swim);
                    this.rightArm.rotation.set(0, 0, Math.PI / 2 - swim);
                    this.leftLeg.rotation.set(swim, 0, 0);
                    this.rightLeg.rotation.set(-swim, 0, 0);
                } else {
                    this.survivorBody.rotation.x = 0;

                    if (state.survivor.isBowing) {
                        this.upperBody.rotation.x = Math.PI / 3.5;
                        this.leftArm.rotation.set(-Math.PI / 8, 0, 0);
                        this.rightArm.rotation.set(-Math.PI / 8, 0, 0);
                    } else if (state.survivor.isChopping) {
                        const swing = -Math.PI / 2 + Math.sin(Date.now() * 0.015) * 1.5;
                        this.upperBody.rotation.x = -Math.PI / 12;
                        this.rightArm.rotation.set(swing, 0, 0);
                        this.leftArm.rotation.set(-Math.PI / 8, 0, 0);
                    } else if (state.survivor.isMining) {
                        const swing = -Math.PI / 2 + Math.sin(Date.now() * 0.015) * 1.5;
                        this.upperBody.rotation.x = -Math.PI / 8;
                        this.rightArm.rotation.set(swing, 0, 0);
                        this.leftArm.rotation.set(-Math.PI / 8, 0, 0);
                    } else {
                        this.upperBody.rotation.x = state.aiming ? 0 : (this.upperBody.rotation.x * 0.8);

                        if (state.aiming) {
                            this.leftArm.rotation.set(-Math.PI / 2, 0, 0);
                            this.rightArm.rotation.set(-Math.PI / 2, 0, 0);
                        } else if (state.survivor.isMoving) {
                            const walk = Math.sin(Date.now() * 0.015) * 0.8;
                            this.leftArm.rotation.set(-walk, 0, 0);
                            this.rightArm.rotation.set(walk, 0, 0);
                            this.leftLeg.rotation.set(walk, 0, 0);
                            this.rightLeg.rotation.set(-walk, 0, 0);
                        } else {
                            this.leftArm.rotation.x *= 0.8; this.rightArm.rotation.x *= 0.8;
                            this.leftLeg.rotation.x *= 0.8; this.rightLeg.rotation.x *= 0.8;
                            this.leftArm.rotation.z = 0; this.rightArm.rotation.z = 0;
                        }
                    }
                }
            }
        }

        if (state.aiming && state.aimTarget) {
            // Dynamic Charge Calculator
            const holdTime = (Date.now() - (state.aimStartTime || Date.now())) / 1000;
            const chargeRatio = Math.min(1, holdTime / 1.5);
            const power = 50 + ((state.aimMaxPower || 50) - 50) * chargeRatio;

            const points = [];
            let ax = px, ay = playerY + 10, az = pz;
            const dx = state.aimTarget.x - px, dz = state.aimTarget.z - pz;
            const angle = Math.atan2(dz, dx);
            let vx = Math.cos(angle) * power, vy = power * 0.4, vz = Math.sin(angle) * power;

            const dt = 0.016;
            for(let i=0; i<150; i++) {
                points.push(new THREE.Vector3(ax, ay, az));
                ax += vx * dt; ay += vy * dt; az += vz * dt;
                vy -= 200 * dt;
                if (ay < getElevation(ax, az)) break;
            }
            if (!this.trajLine) {
                this.trajLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xff0000 }));
                this.scene.add(this.trajLine);
            } else {
                this.trajLine.geometry.dispose();
                this.trajLine.geometry = new THREE.BufferGeometry().setFromPoints(points);
                this.trajLine.visible = true;
            }
        } else if (this.trajLine) {
            this.trajLine.visible = false;
        }

        const activeAnimals = new Set(state.animals?.map(a => a.id));
        for (let [id, mesh] of this.animalMeshes.entries()) {
            if (!activeAnimals.has(id)) { this.scene.remove(mesh); this.animalMeshes.delete(id); }
        }
        if (state.animals) {
            state.animals.forEach(a => {
                let mesh = this.animalMeshes.get(a.id);
                if (!mesh) {
                    mesh = new THREE.Mesh(
                        new THREE.BoxGeometry(a.type === 'deer' ? 8 : 4, a.type === 'deer' ? 8 : 4, a.type === 'deer' ? 12 : 4),
                        new THREE.MeshStandardMaterial({ color: a.type === 'deer' ? '#8B4513' : '#ecf0f1' })
                    );
                    mesh.castShadow = true;
                    this.scene.add(mesh);
                    this.animalMeshes.set(a.id, mesh);
                }
                mesh.position.set(a.x, getElevation(a.x, a.y) + (a.type==='deer'?4:2), a.y);
                mesh.rotation.y = a.rotation;
            });
        }

        this.projectileMeshes.forEach(pm => this.scene.remove(pm));
        this.projectileMeshes = [];
        if (state.projectiles) {
            state.projectiles.forEach(p => {
                const arr = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 4), new THREE.MeshStandardMaterial({color: '#e74c3c'}));
                arr.position.set(p.x, p.y, p.z);
                arr.rotation.x = Math.PI / 2;
                this.scene.add(arr);
                this.projectileMeshes.push(arr);
            });
        }

        const activeRes = new Set(state.resources.map(r => r.id));
        for (let [id, mesh] of this.resourceMeshes.entries()) {
            if (!activeRes.has(id)) { this.scene.remove(mesh); this.resourceMeshes.delete(id); }
        }
        state.resources.forEach((r) => {
            if (!this.resourceMeshes.has(r.id)) {
                let mesh;

                if (r.type === 'tree') {
                    mesh = new THREE.Group();
                    const trunk = new THREE.Mesh(this._treeTrunkGeo, new THREE.MeshStandardMaterial({ color: '#5c4033' }));
                    trunk.castShadow = true; trunk.receiveShadow = true;
                    mesh.add(trunk);
                    const leaves = new THREE.Mesh(this._treeLeavesGeo, new THREE.MeshStandardMaterial({ color: r.color }));
                    leaves.castShadow = true; leaves.receiveShadow = true;
                    mesh.add(leaves);
                    mesh.scale.setScalar(r.size);
                    mesh.userData = { offset: 0 };
                } else if (r.type === 'rock' || r.type === 'iron_node' || r.type === 'coal_node') {
                    mesh = new THREE.Mesh(this._rockGeo, new THREE.MeshStandardMaterial({ color: r.color, flatShading: true }));
                    mesh.castShadow = true; mesh.receiveShadow = true;
                    mesh.scale.setScalar(r.size);
                    mesh.userData = { offset: 0 };
                } else if (r.type === 'water') {
                    mesh = new THREE.Mesh(this._waterGeo, new THREE.MeshStandardMaterial({ color: '#2980b9', transparent: true, opacity: 0.65, depthWrite: false }));
                    mesh.scale.set(r.size, 1, r.size);
                    mesh.receiveShadow = true;
                    mesh.userData = { offset: 0.5 };
                } else if (r.type === 'stick') {
                    mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 8, 6), new THREE.MeshStandardMaterial({ color: r.color }));
                    mesh.rotation.z = Math.PI / 2; mesh.rotation.y = Math.random() * Math.PI;
                    mesh.castShadow = true;
                    mesh.userData = { offset: 1.5 };
                } else if (r.type === 'pebble') {
                    mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(r.size), new THREE.MeshStandardMaterial({ color: r.color, flatShading: true }));
                    mesh.castShadow = true;
                    mesh.userData = { offset: 1.5 };
                } else if (r.type === 'tall_bush') {
                    mesh = new THREE.Group();
                    const base = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8), new THREE.MeshStandardMaterial({ color: r.color }));
                    base.position.y = 4; base.castShadow = true;
                    mesh.add(base);
                    mesh.userData = { offset: 0 };
                } else if (r.type === 'blueberry_bush') {
                    mesh = this._buildBlueberryBush(r);
                } else if (r.type === 'crafting_table') {
                    mesh = new THREE.Group();
                    const legs = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 8), new THREE.MeshStandardMaterial({ color: '#5c4033' }));
                    legs.position.y = 4; mesh.add(legs);
                    const top = new THREE.Mesh(new THREE.BoxGeometry(12, 2, 12), new THREE.MeshStandardMaterial({ color: r.color }));
                    top.position.y = 9; mesh.add(top);
                    mesh.castShadow = true;
                    mesh.userData = { offset: 0 };
                } else if (r.type === 'furnace') {
                    mesh = new THREE.Group();
                    const body = new THREE.Mesh(new THREE.BoxGeometry(10, 12, 10), new THREE.MeshStandardMaterial({ color: '#34495e' }));
                    body.position.y = 6; mesh.add(body);
                    const fire = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 1), new THREE.MeshBasicMaterial({ color: '#e67e22' }));
                    fire.position.set(0, 4, 5); mesh.add(fire);
                    mesh.castShadow = true;
                    mesh.userData = { offset: 0 };
                } else if (r.type === 'campfire') {
                    mesh = new THREE.Group();
                    const logs = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 6), new THREE.MeshStandardMaterial({ color: '#5c4033' }));
                    logs.rotation.z = Math.PI / 2; logs.position.y = 1; mesh.add(logs);
                    const fire = new THREE.Mesh(new THREE.ConeGeometry(3, 6), new THREE.MeshBasicMaterial({ color: '#e74c3c' }));
                    fire.position.y = 4; mesh.add(fire);

                    const light = new THREE.PointLight('#ff7700', 2000, 600);
                    light.position.y = 15;
                    mesh.add(light);

                    mesh.castShadow = true;
                    mesh.userData = { offset: 0 };
                } else {
                    mesh = new THREE.Mesh(new THREE.BoxGeometry(r.size, r.size, r.size), new THREE.MeshStandardMaterial({ color: r.color || '#fff' }));
                    mesh.position.y = r.size / 2;
                    mesh.userData = { offset: 1.0 };
                }

                mesh.position.set(r.x, getElevation(r.x, r.y) + mesh.userData.offset, r.y);
                this.scene.add(mesh);
                this.resourceMeshes.set(r.id, mesh);
            } else {
                const mesh = this.resourceMeshes.get(r.id);
                if (r.isFalling) {
                    mesh.rotation.x = r.fallAngle;
                    mesh.position.y = getElevation(r.x, r.y) + mesh.userData.offset - (r.fallAngle * 5);
                } else if (r.type === 'blueberry_bush') {
                    if (mesh.userData.lastBerryCount !== r.berryCount) {
                        mesh.userData.lastBerryCount = r.berryCount;
                        mesh.userData.berryMeshes.forEach((berry, i) => {
                            berry.visible = i < r.berryCount;
                        });
                        mesh.children.forEach(child => {
                            if (child.userData.isFoliage) {
                                child.material = r.berryCount === 0 ? this._bushFoliageBareMat : this._bushFoliageMat;
                            }
                        });
                    }
                }
            }
        });

        this.renderer.render(this.scene, this.camera);
    }
}