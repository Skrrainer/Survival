import { getElevation } from '../engine/Renderer.js';
import { Registry } from '../entities/ItemRegistry.js';

export class AISystem {
    findNextResource(currentType, survivor, state) {
        let closest = null;
        let minDist = 300;
        state.resources.forEach(r => {
            if (r.type === currentType && !r.isFalling && !r.dead) {
                if (r.type === 'blueberry_bush' && r.berryCount === 0) return;
                const d = Math.hypot(r.x - survivor.x, r.y - survivor.y);
                if (d < minDist && d > 0.1) { minDist = d; closest = r; }
            }
        });
        if (closest) {
            survivor.targetResource = closest;
            survivor.targetX = closest.x;
            survivor.targetY = closest.y;
            return true;
        }
        return false;
    }

    update(deltaTime, state) {
        if (!state.survivor) return;
        let survivor = state.survivor;

        if (survivor.deathTimer > 0) {
            survivor.deathTimer -= deltaTime;
            survivor.currentTask = 'YOU DIED! Starved/Dehydrated.';
            return;
        }

        if (!window.godMode) {
            if (survivor.stats.hydration <= 0 && survivor.stats.satiety <= 0) {
                survivor.stats.health -= 5 * deltaTime;
            } else if (survivor.stats.hydration <= 0) {
                survivor.stats.health -= 2 * deltaTime;
            } else if (survivor.stats.satiety <= 0) {
                survivor.stats.health -= 1 * deltaTime;
            }

            if (survivor.stats.health <= 0) {
                survivor.stats.health = 100;
                survivor.stats.hydration = 100;
                survivor.stats.satiety = 100;
                survivor.x = 0; survivor.y = 0;
                survivor.inventory.fill(null);
                survivor.deathTimer = 3.0;
                return;
            }

            if (survivor.currentTask === 'Sleeping') {
                survivor.stats.hydration -= 0.05 * deltaTime;
                survivor.stats.satiety  -= 0.03 * deltaTime;
            } else {
                survivor.stats.hydration -= 0.3 * deltaTime;
                survivor.stats.satiety   -= 0.4 * deltaTime;
            }
        } else {
            survivor.stats.health = 100;
            survivor.stats.hydration = 100;
            survivor.stats.satiety = 100;
        }

        survivor.stats.hydration = Math.max(0, Math.min(100, survivor.stats.hydration));
        survivor.stats.satiety   = Math.max(0, Math.min(100, survivor.stats.satiety));

        survivor.inLake = false;
        state.resources.forEach(r => {
            if (r.type === 'water' && Math.hypot(r.x - survivor.x, r.y - survivor.y) < r.size) {
                survivor.inLake = true;
            }
        });

        if (!state.projectiles) state.projectiles = [];
        state.projectiles.forEach(p => {
            p.x += p.vx * deltaTime;
            p.y += p.vy * deltaTime;
            p.z += p.vz * deltaTime;
            p.vy -= 200 * deltaTime;
            p.life -= deltaTime;

            if (state.animals) {
                state.animals.forEach(a => {
                    if (!a.dead && Math.hypot(a.x - p.x, a.y - p.z) < 15) {
                        a.hp -= 20;
                        p.life = 0;
                    }
                });
            }
        });
        state.projectiles = state.projectiles.filter(p => p.life > 0 && p.y > -10);

        if (!state.animals) state.animals = [];
        state.animals.forEach(a => {
            if (a.hp <= 0) {
                a.dead = true;
                state.resources.push({ id: Math.random().toString(), type: 'raw_meat', x: a.x, y: a.y, size: 5 });
                if (a.type === 'deer') {
                    state.resources.push({ id: Math.random().toString(), type: 'leather', x: a.x + 5, y: a.y + 5, size: 5 });
                }
                return;
            }

            const distToPlayer = Math.hypot(survivor.x - a.x, survivor.y - a.y);
            if (distToPlayer < 150) {
                const angle = Math.atan2(a.y - survivor.y, a.x - survivor.x);
                a.x += Math.cos(angle) * a.speed * 2 * deltaTime;
                a.y += Math.sin(angle) * a.speed * 2 * deltaTime;
                a.rotation = Math.atan2(Math.cos(angle), Math.sin(angle));
            } else {
                a.timer -= deltaTime;
                if (a.timer <= 0) {
                    a.timer = 2 + Math.random() * 3;
                    a.isMoving = Math.random() > 0.5;
                    a.targetAngle = Math.random() * Math.PI * 2;
                }
                if (a.isMoving) {
                    a.x += Math.cos(a.targetAngle) * a.speed * deltaTime;
                    a.y += Math.sin(a.targetAngle) * a.speed * deltaTime;
                    a.rotation = Math.atan2(Math.cos(a.targetAngle), Math.sin(a.targetAngle));
                }
            }
        });
        state.animals = state.animals.filter(a => !a.dead);

        const dx = survivor.targetX - survivor.x;
        const dy = survivor.targetY - survivor.y;
        const distanceToTarget = Math.sqrt(dx * dx + dy * dy);

        let stopDistance = 5;
        if (survivor.targetResource) {
            if (survivor.targetResource.type === 'water') stopDistance = 15;
            else stopDistance = survivor.targetResource.size + 4;
        }

        if (distanceToTarget > stopDistance) {
            survivor.x += (dx / distanceToTarget) * survivor.speed * deltaTime;
            survivor.y += (dy / distanceToTarget) * survivor.speed * deltaTime;

            const targetRotation = Math.atan2(dx, dy);
            survivor.rotation = survivor.rotation || 0;
            let diff = targetRotation - survivor.rotation;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            survivor.rotation += diff * 15 * deltaTime;

            survivor.isMoving = true;
            survivor.isBowing = false;
            survivor.isChopping = false;
            survivor.isMining = false;
            survivor.actionTimer = 0;

            const inWater = getElevation(survivor.x, survivor.y) < 2;
            if (inWater) {
                if (survivor.currentTask.includes('Walking')) survivor.currentTask = survivor.currentTask.replace('Walking', 'Swimming');
            } else {
                if (survivor.currentTask.includes('Swimming')) survivor.currentTask = survivor.currentTask.replace('Swimming', 'Walking');
            }

        } else {
            survivor.isMoving = false;

            if (survivor.targetResource && distanceToTarget > 0.1) {
                const targetRotation = Math.atan2(dx, dy);
                survivor.rotation = survivor.rotation || 0;
                let diff = targetRotation - survivor.rotation;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                survivor.rotation += diff * 15 * deltaTime;
            }

            if (survivor.targetResource && !survivor.targetResource.isFalling) {
                const res = survivor.targetResource;
                let taskSet = false;

                if (res.type === 'water') {
                    survivor.currentTask = 'Drinking Water';
                    survivor.isBowing = true;
                    survivor.stats.hydration = Math.min(100, survivor.stats.hydration + 20 * deltaTime);
                    taskSet = true;
                } else if (res.type === 'tree') {
                    const toolDef = Registry[survivor.equipped.axe];
                    if ((toolDef && toolDef.type === 'tool' && toolDef.toolType === 'axe') || window.godMode) {
                        survivor.currentTask = 'Chopping Tree';
                        survivor.isChopping = true;
                        survivor.actionTimer += deltaTime * (toolDef ? toolDef.tier : 1);
                        if (survivor.actionTimer > 1) {
                            if (survivor.addItem('wood', 1)) res.health -= 1;
                            survivor.actionTimer = 0;
                        }
                        taskSet = true;
                    } else {
                        survivor.currentTask = 'Requires Axe';
                        taskSet = true;
                    }
                } else if (res.type === 'rock' || res.type === 'iron_node' || res.type === 'coal_node') {
                    const toolDef = Registry[survivor.equipped.pickaxe];
                    if ((toolDef && toolDef.type === 'tool' && toolDef.toolType === 'pickaxe') || window.godMode) {
                        survivor.currentTask = 'Mining Node';
                        survivor.isMining = true;
                        survivor.actionTimer += deltaTime * (toolDef ? toolDef.tier : 1);
                        if (survivor.actionTimer > 1) {
                            const dropMap = { rock: 'stone', iron_node: 'iron_ore', coal_node: 'coal' };
                            if (survivor.addItem(dropMap[res.type], 1)) res.health -= 1;
                            survivor.actionTimer = 0;
                        }
                        taskSet = true;
                    } else {
                        survivor.currentTask = 'Requires Pickaxe';
                        taskSet = true;
                    }
                } else if (res.type === 'tall_bush') {
                    survivor.currentTask = 'Gathering Fiber';
                    survivor.isBowing = true;
                    survivor.actionTimer += deltaTime;
                    if (survivor.actionTimer > 1) {
                        survivor.addItem('fiber', 1);
                        res.isFalling = true;
                        survivor.actionTimer = 0;
                        if (!this.findNextResource('tall_bush', survivor, state)) {
                            survivor.targetResource = null;
                        }
                    }
                    taskSet = true;
                } else if (['stick', 'pebble', 'raw_meat', 'leather', 'cooked_meat'].includes(res.type)) {
                    survivor.currentTask = 'Gathering';
                    survivor.isBowing = true;
                    survivor.actionTimer += deltaTime;
                    if (survivor.actionTimer >= 0.6) {
                        if (survivor.addItem(res.type, 1)) {
                            state.resources = state.resources.filter(r => r.id !== res.id);
                            if (!this.findNextResource(res.type, survivor, state)) {
                                survivor.targetResource = null;
                            }
                        }
                        survivor.actionTimer = 0;
                    }
                    taskSet = true;
                } else if (res.type === 'blueberry_bush') {
                    if (res.berryCount > 0) {
                        survivor.currentTask = 'Picking Berries';
                        survivor.isBowing = true;
                        survivor.actionTimer += deltaTime;
                        if (survivor.actionTimer >= 0.6) {
                            if (survivor.addItem('blueberry', res.berryCount)) {
                                res.berryCount = 0;
                                if (!this.findNextResource('blueberry_bush', survivor, state)) {
                                    survivor.targetResource = null;
                                }
                            }
                            survivor.actionTimer = 0;
                        }
                        taskSet = true;
                    } else survivor.currentTask = 'Bush is Empty';
                } else if (['crafting_table', 'furnace', 'campfire', 'chest', 'blacksmith'].includes(res.type)) {
                    survivor.currentTask = `Using ${res.type === 'chest' ? 'Storage Chest' : res.type}`;
                    survivor.isBowing = false;
                    survivor.isChopping = false;
                    survivor.isMining = false;
                    taskSet = true;
                }

                if (res.health !== undefined && res.health <= 0) {
                    res.isFalling = true;
                    const lastType = res.type;
                    if (!this.findNextResource(lastType, survivor, state)) {
                        survivor.targetResource = null;
                        survivor.currentTask = 'Idle';
                        survivor.isChopping = false;
                        survivor.isMining = false;
                    }
                }

                if (!taskSet) {
                    survivor.currentTask = 'Idle';
                    survivor.isBowing = false;
                    survivor.isChopping = false;
                    survivor.isMining = false;
                }
            } else {
                survivor.currentTask = 'Idle';
                survivor.isBowing = false;
                survivor.isChopping = false;
                survivor.isMining = false;
            }
        }
    }
}