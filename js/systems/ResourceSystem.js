import { ResourceNode } from '../entities/ResourceNode.js';

export class ResourceSystem {
    init(stateManager) {
        this.stateManager = stateManager;
        stateManager.getState().generatedChunks = new Set();

        // Generate the starting area immediately
        this.update(stateManager.getState());
    }

    update(state) {
        if (!state.survivor) return;

        const chunkSize = 1000;
        const px = state.survivor.x;
        const py = state.survivor.y;

        const cx = Math.floor(px / chunkSize);
        const cy = Math.floor(py / chunkSize);

        for (let x = cx - 1; x <= cx + 1; x++) {
            for (let y = cy - 1; y <= cy + 1; y++) {
                const chunkKey = `${x},${y}`;
                if (!state.generatedChunks.has(chunkKey)) {
                    this.generateChunk(x * chunkSize, y * chunkSize, chunkSize, state);
                    state.generatedChunks.add(chunkKey);
                }
            }
        }
    }

    generateChunk(offsetX, offsetY, size, state) {
        const clampX = (val) => Math.max(offsetX + 50, Math.min(offsetX + size - 50, val));
        const clampY = (val) => Math.max(offsetY + 50, Math.min(offsetY + size - 50, val));

        // Generate Forests
        for (let i = 0; i < 3; i++) {
            let forestX = offsetX + Math.random() * size;
            let forestY = offsetY + Math.random() * size;
            let trees = 5 + Math.random() * 10;
            for (let j = 0; j < trees; j++) {
                state.resources.push(new ResourceNode('tree', clampX(forestX + (Math.random() - 0.5) * 300), clampY(forestY + (Math.random() - 0.5) * 300)));
            }
        }

        // Generate Rock Clusters
        for (let i = 0; i < 2; i++) {
            let rockX = offsetX + Math.random() * size;
            let rockY = offsetY + Math.random() * size;
            let rocks = 3 + Math.random() * 6;
            for (let j = 0; j < rocks; j++) {
                state.resources.push(new ResourceNode('rock', clampX(rockX + (Math.random() - 0.5) * 150), clampY(rockY + (Math.random() - 0.5) * 150)));
            }
        }

        // Generate Lakes
        let lakeX = offsetX + Math.random() * size;
        let lakeY = offsetY + Math.random() * size;
        let water = 5 + Math.random() * 8;
        for (let j = 0; j < water; j++) {
            state.resources.push(new ResourceNode('water', clampX(lakeX + (Math.random() - 0.5) * 100), clampY(lakeY + (Math.random() - 0.5) * 100)));
        }

        // Floor Loot: Scatter 15 Sticks and 15 Pebbles randomly throughout the chunk
        for (let i = 0; i < 15; i++) {
            let sx = offsetX + Math.random() * size;
            let sy = offsetY + Math.random() * size;
            state.resources.push(new ResourceNode('stick', clampX(sx), clampY(sy)));

            let px = offsetX + Math.random() * size;
            let py = offsetY + Math.random() * size;
            state.resources.push(new ResourceNode('pebble', clampX(px), clampY(py)));
        }
    }
}