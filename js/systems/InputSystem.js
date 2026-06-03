import * as THREE from 'three';

export class InputSystem {
    init(canvasId, rendererInstance, stateManager) {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.canvas = document.getElementById(canvasId);
        this.rendererInstance = rendererInstance;
        this.stateManager = stateManager;

        this.canvas.addEventListener('pointerdown', (e) => this.onClick(e));

        document.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'z') {
                const state = this.stateManager.getState();
                if (state.survivor) {
                    state.survivor.currentTask = state.survivor.currentTask === 'Sleeping' ? 'Idle' : 'Sleeping';
                }
            }
        });
    }

    onClick(event) {
        if (event.target !== this.canvas) return;

        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / this.canvas.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / this.canvas.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.rendererInstance.camera);

        const state = this.stateManager.getState();
        if (!state.survivor) return;

        if (state.survivor.currentTask === 'Sleeping') {
            state.survivor.currentTask = 'Idle';
        }

        const intersects = this.raycaster.intersectObjects(this.rendererInstance.scene.children, true);

        let hitResource = null;
        let groundPoint = null;

        // 1. First, check if we clicked an object directly
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

        // 2. If no direct hit, perform a radius search around the ground intersection point
        if (!hitResource && groundPoint) {
            const clickX = groundPoint.x;
            const clickY = groundPoint.z;
            const searchRadius = 30; // 30 unit radius search

            // Find the closest resource within the radius
            let closestDist = searchRadius;

            state.resources.forEach(res => {
                const dist = Math.hypot(res.x - clickX, res.y - clickY);
                if (dist < closestDist) {
                    closestDist = dist;
                    hitResource = res;
                }
            });
        }

        // 3. Assign task based on the resource found (or ground point)
        if (hitResource) {
            state.survivor.targetResource = hitResource;
            state.survivor.targetX = hitResource.x;
            state.survivor.targetY = hitResource.y;

            // Map types to human-readable tasks
            if (hitResource.type === 'tree') state.survivor.currentTask = 'Walking to Tree';
            else if (hitResource.type === 'rock') state.survivor.currentTask = 'Walking to Rock';
            else if (hitResource.type === 'water') state.survivor.currentTask = 'Walking to Water';
            else if (hitResource.type === 'stick') state.survivor.currentTask = 'Walking to Stick';
            else if (hitResource.type === 'pebble') state.survivor.currentTask = 'Walking to Pebble';
            else if (hitResource.type === 'crafting_table') state.survivor.currentTask = 'Walking to Workbench';

        } else if (groundPoint) {
            state.survivor.targetResource = null;
            state.survivor.targetX = groundPoint.x;
            state.survivor.targetY = groundPoint.z;
            state.survivor.currentTask = 'Walking';
        }
    }
}