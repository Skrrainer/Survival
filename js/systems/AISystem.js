export class AISystem {
    update(deltaTime, state) {
        if (!state.survivor) return;
        let survivor = state.survivor;

        if (survivor.currentTask === 'Sleeping') {
            survivor.stats.hydration -= 0.1 * deltaTime;
            survivor.stats.satiety -= 0.05 * deltaTime;
            survivor.stats.hydration = Math.max(0, Math.min(100, survivor.stats.hydration));
            survivor.stats.satiety = Math.max(0, Math.min(100, survivor.stats.satiety));
            return;
        }

        survivor.stats.hydration -= 0.8 * deltaTime;
        survivor.stats.satiety -= 0.4 * deltaTime;
        survivor.stats.hydration = Math.max(0, Math.min(100, survivor.stats.hydration));
        survivor.stats.satiety = Math.max(0, Math.min(100, survivor.stats.satiety));

        const dx = survivor.targetX - survivor.x;
        const dy = survivor.targetY - survivor.y;
        const distanceToTarget = Math.sqrt(dx * dx + dy * dy);

        if (distanceToTarget > 5) {
            const dirX = dx / distanceToTarget;
            const dirY = dy / distanceToTarget;
            survivor.x += dirX * survivor.speed * deltaTime;
            survivor.y += dirY * survivor.speed * deltaTime;
        } else {
            if (survivor.targetResource) {
                if (survivor.targetResource.type === 'water') {
                    survivor.currentTask = 'Drinking Water';
                    survivor.stats.hydration += 20 * deltaTime;
                } else if (survivor.targetResource.type === 'tree') {
                    if (survivor.equipped.axe !== 'stone_axe') {
                        survivor.currentTask = 'Requires Axe';
                    } else {
                        survivor.currentTask = 'Chopping Tree';
                        survivor.actionTimer += deltaTime;
                        if (survivor.actionTimer > 1) {
                            let added = survivor.addItem('wood', 1);
                            if (!added) survivor.currentTask = 'Inventory Full';
                            survivor.actionTimer = 0;
                        }
                    }
                } else if (survivor.targetResource.type === 'rock') {
                    if (survivor.equipped.pickaxe !== 'stone_pickaxe') {
                        survivor.currentTask = 'Requires Pickaxe';
                    } else {
                        survivor.currentTask = 'Mining Rock';
                        survivor.actionTimer += deltaTime;
                        if (survivor.actionTimer > 1) {
                            let added = survivor.addItem('stone', 1);
                            if (!added) survivor.currentTask = 'Inventory Full';
                            survivor.actionTimer = 0;
                        }
                    }
                } else if (survivor.targetResource.type === 'stick' || survivor.targetResource.type === 'pebble') {
                    survivor.currentTask = 'Gathering';
                    let added = survivor.addItem(survivor.targetResource.type, 1);
                    if (added) {
                        state.resources = state.resources.filter(r => r.id !== survivor.targetResource.id);
                        survivor.targetResource = null;
                        survivor.currentTask = 'Idle';
                    } else {
                        survivor.currentTask = 'Inventory Full';
                    }
                }
            } else {
                survivor.currentTask = 'Idle';
            }
        }
    }
}