import * as THREE from 'three';
import { getElevation } from '../engine/Renderer.js';

export class InputSystem {
    init(canvasId, rendererInstance, stateManager, uiManager) {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.canvas = document.getElementById(canvasId);
        this.rendererInstance = rendererInstance;
        this.stateManager = stateManager;
        this.uiManager = uiManager;

        this.ghostMode = false;
        this.isDraggingCam = false;
        this.isAiming = false;
        this.movedCam = false;
        this.lastX = 0;
        this.lastY = 0;

        this.canvas.addEventListener('contextmenu', e => e.preventDefault());

        this.canvas.addEventListener('pointerdown', (e) => {
            if (e.button === 0) {
                this.isDraggingCam = true;
                this.lastX = e.clientX;
                this.lastY = e.clientY;
                this.movedCam = false;
            } else if (e.button === 2) {
                const s = this.stateManager.getState().survivor;
                if (s && s.equipped.weapon === 'bow') {
                    s.targetResource = null;
                    s.targetX = s.x;
                    s.targetY = s.y;
                    s.currentTask = 'Aiming';
                    this.isAiming = true;
                    this.stateManager.getState().aiming = true;
                    this.stateManager.getState().aimStartTime = Date.now();
                    this.stateManager.getState().aimMaxPower = 150;
                    this.updateAim(e);
                }
            }
        });

        this.canvas.addEventListener('pointermove', (e) => {
            if (this.ghostMode) {
                const pt = this._getGroundPoint(e);
                if (pt) this.rendererInstance.updateGhostMesh(pt.x, pt.z);
            }

            if (this.isDraggingCam) {
                const dx = e.clientX - this.lastX;
                const dy = e.clientY - this.lastY;
                if (Math.abs(dx) > 2 || Math.abs(dy) > 2) this.movedCam = true;
                this.rendererInstance.rotateCamera(dx, dy);
                this.lastX = e.clientX;
                this.lastY = e.clientY;
            } else if (this.isAiming) {
                this.updateAim(e);
            }
        });

        this.canvas.addEventListener('pointerleave', () => {
            if (this.isAiming) {
                this.isAiming = false;
                this.stateManager.getState().aiming = false;
            }
        });

        this.canvas.addEventListener('pointerup', (e) => {
            if (e.button === 0) {
                this.isDraggingCam = false;
                if (!this.movedCam) this.onClick(e);
            } else if (e.button === 2) {
                if (this.isAiming) {
                    this.isAiming = false;
                    this.shootArrow();
                }
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'z') {
                const state = this.stateManager.getState();
                if (state.survivor) state.survivor.currentTask = state.survivor.currentTask === 'Sleeping' ? 'Idle' : 'Sleeping';
            }
        });

        document.addEventListener('ghostPlacementStarted', (e) => {
            this.ghostMode = true;
            this.canvas.style.cursor = 'crosshair';
            this.rendererInstance.createGhostMesh(e.detail.itemType);
        });

        document.addEventListener('ghostPlacementCancelled', () => {
            this.ghostMode = false;
            this.canvas.style.cursor = '';
            this.rendererInstance.removeGhostMesh();
        });
    }

    _getGroundPoint(event) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / this.canvas.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / this.canvas.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.rendererInstance.camera);
        const intersects = this.raycaster.intersectObjects(this.rendererInstance.scene.children, true);
        for (let i = 0; i < intersects.length; i++) {
            let obj = intersects[i].object;
            while (obj && !obj.userData.isGround) obj = obj.parent;
            if (obj && obj.userData.isGround) return intersects[i].point;
        }
        return null;
    }

    updateAim(event) {
        const pt = this._getGroundPoint(event);
        if (pt) {
            const state = this.stateManager.getState();
            const s = state.survivor;
            const dx = pt.x - s.x;
            const dz = pt.z - s.y;
            const dist = Math.sqrt(dx * dx + dz * dz);
            state.aimTarget = pt;
            state.aimMaxPower = Math.min(dist * 1.5, 300);
        }
    }

    shootArrow() {
        const state = this.stateManager.getState();
        state.aiming = false;
        const s = state.survivor;

        if (Date.now() - (s.lastShotTime || 0) < 500) {
            s.currentTask = 'Reloading...';
            return;
        }
        s.lastShotTime = Date.now();

        if (s.removeItem('arrow', 1)) {
            const target = state.aimTarget;
            const dx = target.x - s.x;
            const dz = target.z - s.y;
            const angle = Math.atan2(dz, dx);

            const holdTime = (Date.now() - state.aimStartTime) / 1000;
            const chargeRatio = Math.min(1, holdTime / 1.5);
            const power = 50 + (state.aimMaxPower - 50) * chargeRatio;

            if (!state.projectiles) state.projectiles = [];
            state.projectiles.push({
                x: s.x,
                y: getElevation(s.x, s.y) + 10,
                z: s.y,
                vx: Math.cos(angle) * power,
                vy: power * 0.4,
                vz: Math.sin(angle) * power,
                life: 5
            });
            s.currentTask = 'Shooting Bow';
        } else {
            s.currentTask = 'No Arrows!';
        }
    }

    onClick(event) {
        if (event.target !== this.canvas) return;
        this.mouse.x = ((event.clientX - this.canvas.getBoundingClientRect().left) / this.canvas.width) * 2 - 1;
        this.mouse.y = -((event.clientY - this.canvas.getBoundingClientRect().top) / this.canvas.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.rendererInstance.camera);

        if (this.ghostMode) {
            const pt = this._getGroundPoint(event);
            if (pt) this.uiManager.confirmGhostPlacement(pt.x, pt.z);
            return;
        }

        const state = this.stateManager.getState();
        if (!state.survivor || state.survivor.deathTimer > 0) return;
        if (state.survivor.currentTask === 'Sleeping') state.survivor.currentTask = 'Idle';

        const intersects = this.raycaster.intersectObjects(this.rendererInstance.scene.children, true);
        let hitResource = null, groundPoint = null;

        for (let i = 0; i < intersects.length; i++) {
            let obj = intersects[i].object;
            while (obj && !obj.userData.resource && !obj.userData.isGround) obj = obj.parent;
            if (obj && obj.userData.resource) {
                hitResource = obj.userData.resource;
                break;
            } else if (obj && obj.userData.isGround && !groundPoint) {
                groundPoint = intersects[i].point;
            }
        }

        if (!hitResource && groundPoint) {
            if (groundPoint.y <= 2) {
                hitResource = { type: 'water', x: groundPoint.x, y: groundPoint.z, size: 5, isFalling: false };
            } else {
                let closestDist = 30;
                state.resources.forEach(res => {
                    const dist = Math.hypot(res.x - groundPoint.x, res.y - groundPoint.z);
                    if (dist < closestDist) { closestDist = dist; hitResource = res; }
                });
            }
        }

        if (hitResource) {
            state.survivor.targetResource = hitResource;
            state.survivor.targetX = hitResource.x;
            state.survivor.targetY = hitResource.y;

            const taskNames = {
                tree: 'Walking to Tree',
                rock: 'Walking to Rock',
                iron_node: 'Walking to Iron Node',
                coal_node: 'Walking to Coal Node',
                water: 'Walking to Water',
                stick: 'Walking to Stick',
                pebble: 'Walking to Pebble',
                tall_bush: 'Walking to Fiber Bush',
                blueberry_bush: 'Walking to Berry Bush',
                crafting_table: 'Walking to Workbench',
                furnace: 'Walking to Furnace',
                campfire: 'Walking to Campfire',
                blacksmith: 'Walking to Blacksmith',
                chest: 'Walking to Storage Chest',
                raw_meat: 'Walking to Loot',
                leather: 'Walking to Loot',
                cooked_meat: 'Walking to Loot'
            };
            state.survivor.currentTask = taskNames[hitResource.type] ?? 'Walking';

        } else if (groundPoint) {
            state.survivor.targetResource = null;
            state.survivor.targetX = groundPoint.x;
            state.survivor.targetY = groundPoint.z;
            state.survivor.currentTask = 'Walking';
        }
    }
}