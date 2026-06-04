import { getElevation } from '../engine/Renderer.js';

export class UIManager {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.elements = {
            healthText: document.getElementById('stat-health-text'),
            healthBar: document.getElementById('bar-health'),
            hydrationText: document.getElementById('stat-hydration-text'),
            hydrationBar: document.getElementById('bar-hydration'),
            satietyText: document.getElementById('stat-satiety-text'),
            satietyBar: document.getElementById('bar-satiety'),
            time: document.getElementById('game-time'),
            task: document.getElementById('current-task'),

            inventoryGrid: document.getElementById('inventory-grid'),
            inventoryPanel: document.getElementById('inventory-panel'),
            craftingPanel: document.getElementById('crafting-panel'),
            advRecipes: document.getElementById('advanced-recipes'),
            stationPanel: document.getElementById('station-panel'),
            furnaceUI: document.getElementById('furnace-ui'),
            campfireUI: document.getElementById('campfire-ui'),

            equipSlots: {
                axe: document.getElementById('equip-axe'),
                pickaxe: document.getElementById('equip-pickaxe'),
                helmet: document.getElementById('equip-helmet'),
                chest: document.getElementById('equip-chest'),
                pants: document.getElementById('equip-pants'),
                shoes: document.getElementById('equip-shoes'),
                weapon: document.getElementById('equip-weapon')
            }
        };

        this.isInventoryOpen = false;
        this.isCraftingOpen = false;
        this.inventorySlotsCreated = false;
        this.slotElements = [];
        this.ghostPlacementActive = false;
        this.ghostItemType = null;

        this.minimapCanvas = document.getElementById('minimap');
        this.minimapCtx = this.minimapCanvas?.getContext('2d');

        this.fullmapCanvas = document.getElementById('fullmap');
        this.fullmapCtx = this.fullmapCanvas?.getContext('2d');
        this.isMapOpen = false;
        this.mapZoom = 0.5;
        this.mapPanX = 0;
        this.mapPanY = 0;

        document.getElementById('minimap-container')?.addEventListener('click', () => {
            this.isMapOpen = true;
            document.getElementById('map-modal').style.display = 'block';
        });

        document.getElementById('close-map')?.addEventListener('click', () => {
            this.isMapOpen = false;
            document.getElementById('map-modal').style.display = 'none';
        });

        document.getElementById('btn-godmode')?.addEventListener('click', (e) => {
            window.godMode = !window.godMode;
            e.target.innerText = window.godMode ? "God Mode: ON" : "Enable God Mode";
            e.target.style.background = window.godMode ? "#e74c3c" : "#9b59b6";
        });

        this.fullmapCanvas?.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.deltaY > 0) this.mapZoom = Math.max(0.1, this.mapZoom - 0.05);
            else this.mapZoom = Math.min(2.0, this.mapZoom + 0.05);
        });

        let isDraggingMap = false, lastMapX = 0, lastMapY = 0;
        this.fullmapCanvas?.addEventListener('mousedown', e => { isDraggingMap = true; lastMapX = e.clientX; lastMapY = e.clientY; });
        this.fullmapCanvas?.addEventListener('mousemove', e => {
            if (isDraggingMap) {
                this.mapPanX -= (e.clientX - lastMapX) / this.mapZoom;
                this.mapPanY -= (e.clientY - lastMapY) / this.mapZoom;
                lastMapX = e.clientX; lastMapY = e.clientY;
            }
        });
        this.fullmapCanvas?.addEventListener('mouseup', () => isDraggingMap = false);
        this.fullmapCanvas?.addEventListener('mouseleave', () => isDraggingMap = false);

        document.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'i') {
                this.isInventoryOpen = !this.isInventoryOpen;
                if (this.elements.inventoryPanel) this.elements.inventoryPanel.style.display = this.isInventoryOpen ? 'block' : 'none';
            }
            if (e.key.toLowerCase() === 'c') {
                this.isCraftingOpen = !this.isCraftingOpen;
                if (this.elements.craftingPanel) this.elements.craftingPanel.style.display = this.isCraftingOpen ? 'block' : 'none';
            }
            if (e.key === 'Escape' && this.ghostPlacementActive) this.cancelGhostPlacement();
        });

        const bindBtn = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
        bindBtn('craft-rope', () => this.craftItem('rope', { fiber: 3 }));
        bindBtn('craft-axe', () => this.craftItem('stone_axe', { stick: 2, pebble: 2 }));
        bindBtn('craft-pickaxe', () => this.craftItem('stone_pickaxe', { stick: 2, pebble: 3 }));
        bindBtn('craft-campfire', () => this.craftPlaceable('campfire', { wood: 5, pebble: 5 }));
        bindBtn('craft-table', () => this.craftPlaceable('crafting_table', { wood: 10 }));
        bindBtn('craft-bow', () => this.craftItem('bow', { wood: 2, rope: 2 }));
        bindBtn('craft-arrow', () => this.craftItem('arrow', { stick: 1, pebble: 1 }));
        bindBtn('craft-furnace', () => this.craftPlaceable('furnace', { stone: 10 }));
        bindBtn('craft-sword', () => this.craftItem('wood_sword', { wood: 5, stick: 2 }));
        bindBtn('craft-helmet', () => this.craftItem('leather_helmet', { leather: 5 }));
        bindBtn('action-smelt', () => this.craftItem('iron_ingot', { iron_ore: 1, coal: 1 }));
        bindBtn('action-cook', () => this.craftItem('cooked_meat', { raw_meat: 1, wood: 1 }));
    }

    drawMap(ctx, width, height, player, resources, zoom, panX, panY) {
        if (!ctx) return;

        ctx.save();
        ctx.fillStyle = '#1a5b7d';
        ctx.fillRect(0, 0, width, height);

        ctx.translate(width / 2, height / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(-player.x - panX, -player.y - panY);

        const startX = player.x + panX - (width/2)/zoom;
        const endX = player.x + panX + (width/2)/zoom;
        const startZ = player.y + panY - (height/2)/zoom;
        const endZ = player.y + panY + (height/2)/zoom;

        const step = Math.max(3, 15 / zoom);

        for(let x = Math.floor(startX/step)*step; x < endX; x+=step) {
            for(let z = Math.floor(startZ/step)*step; z < endZ; z+=step) {
                const elev = getElevation(x, z);
                if (elev > 2) {
                    if (elev > 400) ctx.fillStyle = '#cccccc';
                    else if (elev > 250) ctx.fillStyle = '#666666';
                    else if (elev <= 5) ctx.fillStyle = '#e6d690';
                    else ctx.fillStyle = '#39602b';

                    ctx.fillRect(x, z, step+1, step+1);
                }
            }
        }

        resources.forEach(r => {
            if (['crafting_table', 'furnace', 'campfire'].includes(r.type)) {
                ctx.fillStyle = r.color;
                ctx.fillRect(r.x - 15, r.y - 15, 30, 30);
            }
        });

        ctx.translate(player.x, player.y);
        ctx.rotate(-player.rotation);
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.moveTo(0, -15);
        ctx.lineTo(12, 15);
        ctx.lineTo(-12, 15);
        ctx.fill();

        ctx.restore();
    }

    craftItem(resultItem, ingredients) {
        const survivor = this.stateManager.getState().survivor;
        if (!window.godMode) {
            for (let [item, amount] of Object.entries(ingredients)) {
                if (!survivor.hasEnough(item, amount)) return;
            }
            for (let [item, amount] of Object.entries(ingredients)) {
                survivor.removeItem(item, amount);
            }
        }
        survivor.addItem(resultItem, 1);
    }

    craftPlaceable(item, ingredients) {
        const survivor = this.stateManager.getState().survivor;
        if (!window.godMode) {
            for (let [i, amt] of Object.entries(ingredients)) {
                if (!survivor.hasEnough(i, amt)) return;
            }
        }
        if (survivor.addItem(item, 1)) {
            if (!window.godMode) {
                for (let [i, amt] of Object.entries(ingredients)) survivor.removeItem(i, amt);
            }
        }
    }

    consumeItem(itemType) {
        const survivor = this.stateManager.getState().survivor;
        if (itemType === 'blueberry' && survivor.removeItem('blueberry', 1)) {
            survivor.stats.satiety = Math.min(100, survivor.stats.satiety + 10);
        } else if (itemType === 'cooked_meat' && survivor.removeItem('cooked_meat', 1)) {
            survivor.stats.satiety = Math.min(100, survivor.stats.satiety + 40);
            survivor.stats.health = Math.min(100, survivor.stats.health + 20);
        } else if (itemType === 'raw_meat' && survivor.removeItem('raw_meat', 1)) {
            survivor.stats.satiety = Math.min(100, survivor.stats.satiety + 15);
            survivor.stats.health -= 10;
        }
    }

    startGhostPlacement(itemType) {
        this.ghostPlacementActive = true;
        this.ghostItemType = itemType;
        this.isInventoryOpen = false;
        if (this.elements.inventoryPanel) this.elements.inventoryPanel.style.display = 'none';
        document.dispatchEvent(new CustomEvent('ghostPlacementStarted', { detail: { itemType } }));
    }

    confirmGhostPlacement(x, y) {
        if (!this.ghostPlacementActive || !this.ghostItemType) return;
        const survivor = this.stateManager.getState().survivor;
        if (survivor.removeItem(this.ghostItemType, 1)) {
            let color = '#ffffff', size = 10;
            if (this.ghostItemType === 'crafting_table') color = '#e67e22';
            if (this.ghostItemType === 'furnace') { color = '#34495e'; size = 12; }
            if (this.ghostItemType === 'campfire') { color = '#c0392b'; size = 8; }

            this.stateManager.addResource({
                type: this.ghostItemType,
                x: x, y: y,
                id: Math.random().toString(),
                color: color, size: size
            });
        }
        this.cancelGhostPlacement();
    }

    cancelGhostPlacement() {
        this.ghostPlacementActive = false;
        this.ghostItemType = null;
        document.dispatchEvent(new CustomEvent('ghostPlacementCancelled'));
    }

    update(state) {
        if (!state.survivor) return;
        const s = state.survivor;

        for (const [key, element] of Object.entries(this.elements.equipSlots)) {
            if (!element) continue;
            if (s.equipped[key]) {
                element.className = 'inv-slot';
                element.innerText = s.equipped[key].replace(/_/g, ' ');
                element.onclick = () => s.unequip(key);
            } else {
                element.className = 'inv-slot empty';
                element.innerText = key.charAt(0).toUpperCase() + key.slice(1);
                element.onclick = null;
            }
        }

        let nearTable = false, nearFurnace = false, nearCampfire = false;
        state.resources.forEach(r => {
            const dist = Math.hypot(r.x - s.x, r.y - s.y);
            if (dist < 80) {
                if (r.type === 'crafting_table') nearTable = true;
                if (r.type === 'furnace') nearFurnace = true;
                if (r.type === 'campfire') nearCampfire = true;
            }
        });

        if (this.elements.advRecipes) this.elements.advRecipes.style.display = nearTable ? 'block' : 'none';

        if (this.elements.stationPanel) {
            this.elements.stationPanel.style.display = (nearFurnace || nearCampfire) ? 'block' : 'none';
            if (this.elements.furnaceUI) this.elements.furnaceUI.style.display = nearFurnace ? 'block' : 'none';
            if (this.elements.campfireUI) this.elements.campfireUI.style.display = nearCampfire ? 'block' : 'none';
        }

        if (this.elements.inventoryGrid) {
            if (!this.inventorySlotsCreated) {
                this.elements.inventoryGrid.innerHTML = '';
                s.inventory.forEach((_, index) => {
                    const slotDiv = document.createElement('div');
                    this.elements.inventoryGrid.appendChild(slotDiv);
                    this.slotElements[index] = slotDiv;
                });
                this.inventorySlotsCreated = true;
            }

            s.inventory.forEach((slot, index) => {
                const div = this.slotElements[index];
                if (slot === null) {
                    div.className = 'inv-slot empty';
                    div.innerHTML = ''; div.onclick = null;
                    div.style.cursor = ''; div.title = '';
                } else {
                    div.className = 'inv-slot';
                    div.innerHTML = `<span style="pointer-events: none;">${slot.type.replace(/_/g, ' ')}</span><span class="amount" style="pointer-events: none;">${slot.amount}</span>`;

                    const placeables = ['crafting_table', 'furnace', 'campfire'];
                    const consumables = ['blueberry', 'cooked_meat', 'raw_meat'];

                    if (placeables.includes(slot.type)) {
                        div.style.cursor = 'crosshair';
                        div.title = 'Left-click to place';
                        div.onclick = () => this.startGhostPlacement(slot.type);
                    } else if (!!s.getSlotForItem(slot.type)) {
                        div.style.cursor = 'pointer';
                        div.title = 'Left-click to equip';
                        div.onclick = () => s.equip(slot.type);
                    } else if (consumables.includes(slot.type)) {
                        div.style.cursor = 'pointer';
                        div.title = 'Left-click to eat';
                        div.onclick = () => this.consumeItem(slot.type);
                    } else {
                        div.style.cursor = ''; div.title = ''; div.onclick = null;
                    }
                }
            });
        }

        if (this.elements.healthText) this.elements.healthText.innerText = `${Math.floor(s.stats.health)}%`;
        if (this.elements.hydrationText) this.elements.hydrationText.innerText = `${Math.floor(s.stats.hydration)}%`;
        if (this.elements.satietyText) this.elements.satietyText.innerText = `${Math.floor(s.stats.satiety)}%`;
        if (this.elements.healthBar) this.elements.healthBar.style.width = `${s.stats.health}%`;
        if (this.elements.hydrationBar) this.elements.hydrationBar.style.width = `${s.stats.hydration}%`;
        if (this.elements.satietyBar) this.elements.satietyBar.style.width = `${s.stats.satiety}%`;
        if (this.elements.task && this.elements.task.innerText !== s.currentTask) this.elements.task.innerText = s.currentTask;

        const h = state.time.hours.toString().padStart(2, '0');
        const m = state.time.minutes.toString().padStart(2, '0');
        if (this.elements.time && this.elements.time.innerText !== `${h}:${m}`) this.elements.time.innerText = `${h}:${m}`;

        this.drawMap(this.minimapCtx, 220, 220, s, state.resources, 0.15, 0, 0);
        if (this.isMapOpen && this.fullmapCanvas) {
            this.fullmapCanvas.width = this.fullmapCanvas.clientWidth;
            this.fullmapCanvas.height = this.fullmapCanvas.clientHeight;
            this.drawMap(this.fullmapCtx, this.fullmapCanvas.width, this.fullmapCanvas.height, s, state.resources, this.mapZoom, this.mapPanX, this.mapPanY);
        }

        // Manage button disabled states based on required resources
        if (this.isCraftingOpen || nearTable || nearFurnace || nearCampfire) {
            const recipes = {
                'craft-rope': { fiber: 3 },
                'craft-axe': { stick: 2, pebble: 2 },
                'craft-pickaxe': { stick: 2, pebble: 3 },
                'craft-campfire': { wood: 5, pebble: 5 },
                'craft-table': { wood: 10 },
                'craft-bow': { wood: 2, rope: 2 },
                'craft-arrow': { stick: 1, pebble: 1 },
                'craft-furnace': { stone: 10 },
                'craft-sword': { wood: 5, stick: 2 },
                'craft-helmet': { leather: 5 },
                'action-smelt': { iron_ore: 1, coal: 1 },
                'action-cook': { raw_meat: 1, wood: 1 }
            };
            for (const [btnId, ingredients] of Object.entries(recipes)) {
                const btn = document.getElementById(btnId);
                if (btn) {
                    let canCraft = window.godMode;
                    if (!canCraft) {
                        canCraft = true;
                        for (const [item, amt] of Object.entries(ingredients)) {
                            if (!s.hasEnough(item, amt)) {
                                canCraft = false;
                                break;
                            }
                        }
                    }
                    btn.disabled = !canCraft;
                }
            }
        }
    }
}