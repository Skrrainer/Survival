import * as THREE from 'three';
import { MeshBuilder } from './MeshBuilder.js';

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

        this.resourceMeshes = new Map();
        this.animalMeshes = new Map();
        this.enemyMeshes = new Map();
        this.projectileMeshes = [];
        this.ghostMesh = null;

        this.meshBuilder = new MeshBuilder();

        this.survivorNodes = this.meshBuilder.buildSurvivorMesh();
        this.survivorMesh = this.survivorNodes.mesh;
        this.scene.add(this.survivorMesh);

        this.avatarCanvas = document.getElementById('inventory-avatar-canvas');
        if (this.avatarCanvas) {
            this.avatarRenderer = new THREE.WebGLRenderer({ canvas: this.avatarCanvas, antialias: true, alpha: true });
            this.avatarRenderer.setSize(130, 150);
            this.avatarScene = new THREE.Scene();

            this.avatarCamera = new THREE.PerspectiveCamera(45, 130 / 150, 1, 100);
            this.avatarCamera.position.set(0, 11, 26);
            this.avatarCamera.lookAt(0, 10, 0);

            const avLight = new THREE.AmbientLight(0xffffff, 0.6);
            const avDir = new THREE.DirectionalLight(0xffffff, 0.8);
            avDir.position.set(5, 15, 10);
            this.avatarScene.add(avLight, avDir);

            this.avatarNodes = this.meshBuilder.buildSurvivorMesh();
            this.avatarNodes.mesh.position.set(0, -2, 0);
            this.avatarScene.add(this.avatarNodes.mesh);
        }
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

        // Reset rotations
        this.survivorNodes.upperBody.rotation.y = 0;

        if (state.survivor) {
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

                this.survivorNodes.backpackMesh.visible = !!state.survivor.equipped.backpack;
                this.survivorNodes.axeVisual.visible = !!state.survivor.isChopping;
                this.survivorNodes.pickaxeVisual.visible = !!state.survivor.isMining;
                this.survivorNodes.bowVisual.visible = !!state.aiming;
                this.survivorNodes.swordVisual.visible = !!state.survivor.isAttacking;

                if (inWater) {
                    this.survivorNodes.body.rotation.x = Math.PI / 2;
                    this.survivorNodes.upperBody.rotation.x = 0;
                    const swim = Math.sin(Date.now() * 0.005) * 0.5;
                    this.survivorNodes.leftArm.rotation.set(0, 0, -Math.PI / 2 + swim);
                    this.survivorNodes.rightArm.rotation.set(0, 0, Math.PI / 2 - swim);
                    this.survivorNodes.leftLeg.rotation.set(swim, 0, 0);
                    this.survivorNodes.rightLeg.rotation.set(-swim, 0, 0);
                } else {
                    this.survivorNodes.body.rotation.x = 0;

                    if (state.survivor.isBowing) {
                        this.survivorNodes.upperBody.rotation.x = Math.PI / 3.5;
                        this.survivorNodes.leftArm.rotation.set(-Math.PI / 8, 0, 0);
                        this.survivorNodes.rightArm.rotation.set(-Math.PI / 8, 0, 0);
                    } else if (state.survivor.isAttacking) {
                        const p = (0.4 - state.survivor.attackTimer) / 0.4;
                        const swingY = Math.sin(p * Math.PI) * 0.8;
                        const armX = -Math.PI / 2 + Math.cos(p * Math.PI) * 2.0;
                        const armZ = Math.sin(p * Math.PI) * 1.2;

                        this.survivorNodes.upperBody.rotation.y = -swingY;
                        this.survivorNodes.upperBody.rotation.x = -Math.PI / 12;
                        this.survivorNodes.rightArm.rotation.set(armX, 0, armZ);
                        this.survivorNodes.leftArm.rotation.set(-Math.PI / 8, 0, 0);
                    } else if (state.survivor.isChopping) {
                        const swing = -Math.PI / 2 + Math.sin(Date.now() * 0.015) * 1.5;
                        this.survivorNodes.upperBody.rotation.x = -Math.PI / 12;
                        this.survivorNodes.rightArm.rotation.set(swing, 0, 0);
                        this.survivorNodes.leftArm.rotation.set(-Math.PI / 8, 0, 0);
                    } else if (state.survivor.isMining) {
                        const swing = -Math.PI / 2 + Math.sin(Date.now() * 0.015) * 1.5;
                        this.survivorNodes.upperBody.rotation.x = -Math.PI / 8;
                        this.survivorNodes.rightArm.rotation.set(swing, 0, 0);
                        this.survivorNodes.leftArm.rotation.set(-Math.PI / 8, 0, 0);
                    } else {
                        this.survivorNodes.upperBody.rotation.x = state.aiming ? 0 : (this.survivorNodes.upperBody.rotation.x * 0.8);

                        if (state.aiming) {
                            this.survivorNodes.leftArm.rotation.set(-Math.PI / 2, 0, 0);
                            this.survivorNodes.rightArm.rotation.set(-Math.PI / 2, 0, 0);
                        } else if (state.survivor.isMoving) {
                            const walk = Math.sin(Date.now() * 0.015) * 0.8;
                            this.survivorNodes.leftArm.rotation.set(-walk, 0, 0);
                            this.survivorNodes.rightArm.rotation.set(walk, 0, 0);
                            this.survivorNodes.leftLeg.rotation.set(walk, 0, 0);
                            this.survivorNodes.rightLeg.rotation.set(-walk, 0, 0);
                        } else {
                            this.survivorNodes.leftArm.rotation.x *= 0.8; this.survivorNodes.rightArm.rotation.x *= 0.8;
                            this.survivorNodes.leftLeg.rotation.x *= 0.8; this.survivorNodes.rightLeg.rotation.x *= 0.8;
                            this.survivorNodes.leftArm.rotation.z = 0; this.survivorNodes.rightArm.rotation.z = 0;
                        }
                    }
                }
            }
        }

        if (state.aiming && state.aimTarget) {
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
        for (let [id, meshObj] of this.animalMeshes.entries()) {
            if (!activeAnimals.has(id)) {
                this.scene.remove(meshObj.group);
                this.animalMeshes.delete(id);
            }
        }
        if (state.animals) {
            state.animals.forEach(a => {
                let meshObj = this.animalMeshes.get(a.id);
                if (!meshObj) {
                    meshObj = a.type === 'deer' ? this.meshBuilder.buildDeerMesh() : this.meshBuilder.buildBunnyMesh();
                    meshObj.group.castShadow = true;
                    this.scene.add(meshObj.group);
                    this.animalMeshes.set(a.id, meshObj);
                }

                const group = meshObj.group;
                group.position.set(a.x, getElevation(a.x, a.y), a.y);
                group.rotation.y = a.rotation;

                if (a.isMoving) {
                    if (a.type === 'deer') {
                        const walk = Math.sin(Date.now() * 0.01) * 0.5;
                        meshObj.flLeg.rotation.x = walk;
                        meshObj.brLeg.rotation.x = walk;
                        meshObj.frLeg.rotation.x = -walk;
                        meshObj.blLeg.rotation.x = -walk;
                    } else if (a.type === 'bunny') {
                        const hop = Math.abs(Math.sin(Date.now() * 0.015)) * 1.5;
                        group.position.y += hop;
                        meshObj.body.rotation.x = -Math.sin(Date.now() * 0.015) * 0.2;
                    }
                } else {
                    if (a.type === 'deer') {
                        meshObj.flLeg.rotation.x = 0; meshObj.brLeg.rotation.x = 0;
                        meshObj.frLeg.rotation.x = 0; meshObj.blLeg.rotation.x = 0;
                    } else if (a.type === 'bunny') {
                        meshObj.body.rotation.x = 0;
                    }
                }
            });
        }

        const activeEnemies = new Set(state.enemies?.map(e => e.id));
        for (let [id, mesh] of this.enemyMeshes.entries()) {
            if (!activeEnemies.has(id)) { this.scene.remove(mesh); this.enemyMeshes.delete(id); }
        }
        if (state.enemies) {
            state.enemies.forEach(e => {
                let mesh = this.enemyMeshes.get(e.id);
                if (!mesh) {
                    mesh = this.meshBuilder.buildSlimeMesh(e);
                    this.scene.add(mesh);
                    this.enemyMeshes.set(e.id, mesh);
                }
                mesh.position.set(e.x, getElevation(e.x, e.y) + (e.zOffset || 0), e.y);
                mesh.rotation.y = e.rotation || 0;
                if (e.scaleY) {
                    mesh.scale.set(1, e.scaleY, 1);
                }
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
                    const trunk = new THREE.Mesh(this.meshBuilder.geometries.treeTrunk, this.meshBuilder.materials.wood);
                    trunk.castShadow = true; trunk.receiveShadow = true;
                    mesh.add(trunk);
                    const leaves = new THREE.Mesh(this.meshBuilder.geometries.treeLeaves, new THREE.MeshStandardMaterial({ color: r.color }));
                    leaves.castShadow = true; leaves.receiveShadow = true;
                    mesh.add(leaves);
                    mesh.scale.setScalar(r.size);
                    mesh.userData = { offset: 0 };
                } else if (r.type === 'rock' || r.type === 'iron_node' || r.type === 'coal_node') {
                    mesh = new THREE.Mesh(this.meshBuilder.geometries.rock, new THREE.MeshStandardMaterial({ color: r.color, flatShading: true }));
                    mesh.castShadow = true; mesh.receiveShadow = true;
                    mesh.scale.setScalar(r.size);
                    mesh.userData = { offset: 0 };
                } else if (r.type === 'water') {
                    mesh = new THREE.Mesh(this.meshBuilder.geometries.water, new THREE.MeshStandardMaterial({ color: '#2980b9', transparent: true, opacity: 0.65, depthWrite: false }));
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
                    mesh = this.meshBuilder.buildBlueberryBush(r);
                } else if (r.type === 'crafting_table') {
                    mesh = new THREE.Group();
                    const legs = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 8), this.meshBuilder.materials.wood);
                    legs.position.y = 4; mesh.add(legs);
                    const top = new THREE.Mesh(new THREE.BoxGeometry(12, 2, 12), new THREE.MeshStandardMaterial({ color: r.color }));
                    top.position.y = 9; mesh.add(top);
                    mesh.castShadow = true;
                    mesh.userData = { offset: 0 };
                } else if (r.type === 'furnace') {
                    mesh = new THREE.Group();
                    const body = new THREE.Mesh(new THREE.BoxGeometry(10, 12, 10), new THREE.MeshStandardMaterial({ color: '#34495e' }));
                    body.position.y = 6; mesh.add(body);
                    const fire = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 1), this.meshBuilder.materials.fire);
                    fire.position.set(0, 4, 5); mesh.add(fire);
                    mesh.castShadow = true;
                    mesh.userData = { offset: 0 };
                } else if (r.type === 'blacksmith') {
                    mesh = this.meshBuilder.buildBlacksmithMesh();
                } else if (r.type === 'campfire') {
                    mesh = new THREE.Group();
                    const logs = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 6), this.meshBuilder.materials.wood);
                    logs.rotation.z = Math.PI / 2; logs.position.y = 1; mesh.add(logs);
                    const fire = new THREE.Mesh(new THREE.ConeGeometry(3, 6), this.meshBuilder.materials.fire);
                    fire.position.y = 4; mesh.add(fire);
                    const light = new THREE.PointLight('#ff7700', 2000, 600);
                    light.position.y = 15;
                    mesh.add(light);
                    mesh.castShadow = true;
                    mesh.userData = { offset: 0 };
                } else if (r.type === 'chest') {
                    mesh = this.meshBuilder.buildChestMesh();
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
                                child.material = r.berryCount === 0 ? mesh.userData.foliageBareMat : mesh.userData.foliageMat;
                            }
                        });
                    }
                }
            }
        });

        this.renderer.render(this.scene, this.camera);

        if (this.avatarCanvas && document.getElementById('inventory-panel').style.display === 'flex') {
            this.avatarNodes.mesh.rotation.y += 0.015;
            this.avatarNodes.leftArm.rotation.z = Math.sin(Date.now() * 0.003) * 0.08;
            this.avatarNodes.rightArm.rotation.z = -Math.sin(Date.now() * 0.003) * 0.08;

            this.avatarNodes.backpackMesh.visible = !!state.survivor.equipped.backpack;

            this.avatarRenderer.render(this.avatarScene, this.avatarCamera);
        }
    }
}