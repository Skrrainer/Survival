import { ResourceNode } from '../entities/ResourceNode.js';
import { getElevation } from '../engine/TerrainManager.js';

export class ResourceSystem {
    init(stateManager) {
        this.stateManager = stateManager;
        stateManager.getState().generatedChunks = new Set();
        stateManager.getState().animals = [];
        this.update(stateManager.getState());
    }

    update(state) {
        if (!state.survivor) return;

        const chunkSize = 1000;
        const cx = Math.floor(state.survivor.x / chunkSize);
        const cy = Math.floor(state.survivor.y / chunkSize);

        for (let x = cx - 1; x <= cx + 1; x++) {
            for (let y = cy - 1; y <= cy + 1; y++) {
                const chunkKey = `${x},${y}`;
                if (!state.generatedChunks.has(chunkKey)) {
                    this.generateChunk(x * chunkSize, y * chunkSize, chunkSize, state);
                    state.generatedChunks.add(chunkKey);
                }
            }
        }

        const deltaTime = 1 / 60;
        state.resources.forEach(r => {
            if (r.type === 'blueberry_bush' && r.berryCount < r.maxBerries) {
                r.berryRegenTimer += deltaTime;
                if (r.berryRegenTimer >= r.berryRegenInterval) {
                    r.berryRegenTimer = 0;
                    r.berryCount = Math.min(r.maxBerries, r.berryCount + 1);
                }
            }
            if (r.isFalling) {
                r.fallAngle += deltaTime * 3;
                if (r.fallAngle > Math.PI / 2 + 0.5) r.dead = true;
            }
        });

        state.resources = state.resources.filter(r => !r.dead);
    }

    generateChunk(offsetX, offsetY, size, state) {
        const clampX = (val) => Math.max(offsetX + 50, Math.min(offsetX + size - 50, val));
        const clampY = (val) => Math.max(offsetY + 50, Math.min(offsetY + size - 50, val));

        const trySpawn = (type, count, minElev = 4, maxElev = 250) => {
            for (let i = 0; i < count; i++) {
                let x = clampX(offsetX + Math.random() * size);
                let y = clampY(offsetY + Math.random() * size);

                const elev = getElevation(x, y);
                if (elev > minElev && elev < maxElev) {
                    state.resources.push(new ResourceNode(type, x, y));
                }
            }
        };

        // Note: Removed the "Water" nodes completely, as lakes are now carved mathematically out of the terrain logic!
        trySpawn('tree', 15, 6, 250);
        trySpawn('rock', 8, 10, 500);
        trySpawn('iron_node', 5, 300, 800);
        trySpawn('coal_node', 5, 300, 800);
        trySpawn('tall_bush', 10, 6, 200);
        trySpawn('blueberry_bush', 8, 6, 200);
        trySpawn('stick', 20, 2, 250);
        trySpawn('pebble', 20, 2, 500);

        for (let i = 0; i < 4; i++) {
            let x = clampX(offsetX + Math.random() * size);
            let y = clampY(offsetY + Math.random() * size);
            if (getElevation(x, y) > 6) {
                state.animals.push({
                    id: Math.random().toString(),
                    type: Math.random() > 0.5 ? 'deer' : 'bunny',
                    x: x, y: y,
                    hp: 20, speed: 30, timer: 0, rotation: 0
                });
            }
        }
    }
}