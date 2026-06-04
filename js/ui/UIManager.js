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
            chestUI: document.getElementById('chest-ui'),
            chestGrid: document.getElementById('chest-grid'),
            nearbyChestsUI: document.getElementById('nearby-chests-ui'),

            equipSlots: {
                axe: document.getElementById('equip-axe'),
                pickaxe: document.getElementById('equip-pickaxe'),
                helmet: document.getElementById('equip-helmet'),
                chest: document.getElementById('equip-chest'),
                pants: document.getElementById('equip-pants'),
                shoes: document.getElementById('equip-shoes'),
                weapon: document.getElementById('equip-weapon'),
                backpack: document.getElementById('equip-backpack')
            }
        };

        this.isInventoryOpen = false;
        this.isCraftingOpen = false;

        this.inventorySlotsCreated = false;
        this.chestSlotsCreated = false;
        this.slotElements = [];
        this.chestSlotElements = [];

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
            if (e.key === 'Tab') {
                e.preventDefault();
                this.isInventoryOpen = !this.isInventoryOpen;
                if (this.elements.inventoryPanel) {
                    this.elements.inventoryPanel.style.display = this.isInventoryOpen ? 'flex' : 'none';
                }
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
        bindBtn('craft-chest', () => this.craftPlaceable('chest', { wood: 8 }));
        bindBtn('craft-campfire', () => this.craftPlaceable('campfire', { wood: 5, pebble: 5 }));
        bindBtn('craft-table', () => this.craftPlaceable('crafting_table', { wood: 10 }));
        bindBtn('craft-bow', () => this.craftItem('bow', { wood: 2, rope: 2 }));
        bindBtn('craft-arrow', () => this.craftItem('arrow', { stick: 1, pebble: 1 }));
        bindBtn('craft-backpack', () => this.craftItem('backpack', { leather: 5, rope: 2 }));
        bindBtn('craft-furnace', () => this.craftPlaceable('furnace', { stone: 10 }));
        bindBtn('craft-sword', () => this.craftItem('wood_sword', { wood: 5, stick: 2 }));
        bindBtn('craft-helmet', () => this.craftItem('leather_helmet', { leather: 5 }));
        bindBtn('action-smelt', () => this.craftItem('iron_ingot', { iron_ore: 1, coal: 1 }));
        bindBtn('action-cook', () => this.craftItem('cooked_meat', { raw_meat: 1, wood: 1 }));

        const depBtn = document.getElementById('btn-deposit-all');
        if (depBtn) {
            depBtn.onclick = () => {
                const s = this.stateManager.getState().survivor;
                const nearbyChests = this.getNearbyChests();
                const nonResources = ['stone_axe', 'stone_pickaxe', 'wood_sword', 'bow', 'arrow', 'leather_helmet', 'backpack'];

                for (let i = 0; i < s.inventory.length; i++) {
                    let pSlot = s.inventory[i];
                    if (pSlot && !nonResources.includes(pSlot.type)) {

                        let existsInChests = false;
                        for (let c of nearbyChests) {
                            for (let j = 0; j < 8; j++) {
                                if (c.slots[j] && c.slots[j].type === pSlot.type) {
                                    existsInChests = true; break;
                                }
                            }
                            if(existsInChests) break;
                        }

                        if (existsInChests) {
                            let deposited = false;
                            for (let c of nearbyChests) {
                                for (let j = 0; j < 8; j++) {
                                    if (c.slots[j] && c.slots[j].type === pSlot.type) {
                                        c.slots[j].amount += pSlot.amount;
                                        deposited = true; break;
                                    }
                                }
                                if(deposited) break;
                            }
                            if (!deposited) {
                                for (let c of nearbyChests) {
                                    for (let j = 0; j < 8; j++) {
                                        if (!c.slots[j]) {
                                            c.slots[j] = { type: pSlot.type, amount: pSlot.amount };
                                            deposited = true; break;
                                        }
                                    }
                                    if(deposited) break;
                                }
                            }
                            if(deposited) s.inventory[i] = null;
                        }
                    }
                }
            };
        }
    }

    createSlotElement(source, index) {
        const div = document.createElement('div');
        div.dataset.source = source;
        div.dataset.index = index;

        div.addEventListener('dragstart', (e) => {
            if (div.classList.contains('empty')) { e.preventDefault(); return; }
            e.dataTransfer.setData('application/json', JSON.stringify({ source, index }));
            e.dataTransfer.effectAllowed = 'move';
        });

        div.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });

        div.addEventListener('drop', (e) => {
            e.preventDefault();
            const dataStr = e.dataTransfer.getData('application/json');
            if (!dataStr) return;
            const payload = JSON.parse(dataStr);

            const state = this.stateManager.getState();
            const s = state.survivor;

            let openChest = null;
            if (s.currentTask === 'Using Storage Chest' && s.targetResource?.type === 'chest') {
                openChest = s.targetResource;
            }

            const getArray = (src) => src === 'inventory' ? s.inventory : (openChest ? openChest.slots : null);
            const sourceArray = getArray(payload.source);
            const targetArray = getArray(source);

            if (!sourceArray || !targetArray) return;

            const sourceItem = sourceArray[payload.index];
            const targetItem = targetArray[index];

            if (!sourceItem) return;
            if (payload.source === source && payload.index === index) return;

            if (!targetItem) {
                targetArray[index] = sourceItem;
                sourceArray[payload.index] = null;
            } else if (targetItem.type === sourceItem.type) {
                targetItem.amount += sourceItem.amount;
                sourceArray[payload.index] = null;
            } else {
                targetArray[index] = sourceItem;
                sourceArray[payload.index] = targetItem;
            }
        });

        return div;
    }

    getNearbyChests() {
        const state = this.stateManager.getState();
        const s = state.survivor;
        let chests = [];
        state.resources.forEach(r => {
            if (r.type === 'chest' && Math.hypot(r.x - s.x, r.y - s.y) < 120) {
                if (!r.slots) r.slots = Array(8).fill(null);
                chests.push(r);
            }
        });
        return chests;
    }

    depositItemToChest(inventoryIndex, chest) {
        const state = this.stateManager.getState();
        const s = state.survivor;
        const item = s.inventory[inventoryIndex];
        if (!item) return;

        let deposited = false;
        for (let j = 0; j < 8; j++) {
            if (chest.slots[j] && chest.slots[j].type === item.type) {
                chest.slots[j].amount += item.amount;
                deposited = true; break;
            }
        }
        if (!deposited) {
            for (let j = 0; j < 8; j++) {
                if (!chest.slots[j]) {
                    chest.slots[j] = { ...item };
                    deposited = true; break;
                }
            }
        }
        if (deposited) s.inventory[inventoryIndex] = null;
    }

    withdrawItemFromChest(chestIndex, chest) {
        const state = this.stateManager.getState();
        const s = state.survivor;
        const item = chest.slots[chestIndex];
        if (!item) return;

        if (s.addItem(item.type, item.amount)) {
            chest.slots[chestIndex] = null;
        }
    }

    getItemIcon(type) {
        const icons = {
            'wood': '🪵', 'stick': '🌿', 'fiber': '🌾', 'pebble': '🪨', 'stone': '🗿',
            'iron_ore': '🪨', 'coal': '⬛', 'raw_meat': '🥩', 'cooked_meat': '🍖',
            'leather': '🐂', 'blueberry': '🫐', 'rope': '🪢', 'stone_axe': '🪓',
            'stone_pickaxe': '⛏️', 'wood_sword': '🗡️', 'bow': '🏹', 'arrow': '🎯',
            'leather_helmet': '🪖', 'iron_ingot': '🔩', 'campfire': '🏕️',
            'crafting_table': '🛠️', 'furnace': '🧱', 'chest': '📦', 'backpack': '🎒'
        };
        return icons[type] || '📦';
    }

    getIngredientCount(s, state, itemType) {
        let count = 0;
        s.inventory.forEach(slot => { if (slot && slot.type === itemType) count += slot.amount; });
        this.getNearbyChests().forEach(chest => {
            chest.slots.forEach(slot => { if (slot && slot.type === itemType) count += slot.amount; });
        });
        return count;
    }

    consumeIngredient(s, state, itemType, amount) {
        let remaining = amount;
        for (let i = 0; i < s.inventory.length; i++) {
            let slot = s.inventory[i];
            if (slot && slot.type === itemType) {
                if (slot.amount > remaining) { slot.amount -= remaining; remaining = 0; break; }
                else { remaining -= slot.amount; s.inventory[i] = null; }
            }
        }
        if (remaining <= 0) return;

        for (let r of this.getNearbyChests()) {
            for (let i = 0; i < r.slots.length; i++) {
                let slot = r.slots[i];
                if (slot && slot.type === itemType) {
                    if (slot.amount > remaining) { slot.amount -= remaining; remaining = 0; break; }
                    else { remaining -= slot.amount; r.slots[i] = null; }
                }
            }
            if (remaining <= 0) break;
        }
    }

    drawMap(ctx, width, height, player, resources, zoom, panX, panY) {
        if (!ctx) return;
        ctx.save();
        ctx.fillStyle = '#111';
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
                    if (elev > 400) ctx.fillStyle = '#444';
                    else if (elev > 250) ctx.fillStyle = '#333';
                    else if (elev <= 5) ctx.fillStyle = '#887';
                    else ctx.fillStyle = '#232';
                    ctx.fillRect(x, z, step+1, step+1);
                }
            }
        }

        resources.forEach(r => {
            if (['crafting_table', 'furnace', 'campfire', 'chest'].includes(r.type)) {
                ctx.fillStyle = r.color;
                ctx.fillRect(r.x - 15, r.y - 15, 30, 30);
            }
        });

        ctx.translate(player.x, player.y);
        ctx.rotate(-player.rotation);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(0, -15);
        ctx.lineTo(12, 15);
        ctx.lineTo(-12, 15);
        ctx.fill();
        ctx.restore();
    }

    craftItem(resultItem, ingredients) {
        const state = this.stateManager.getState();
        const survivor = state.survivor;
        if (!window.godMode) {
            for (let [item, amount] of Object.entries(ingredients)) {
                if (this.getIngredientCount(survivor, state, item) < amount) return;
            }
            for (let [item, amount] of Object.entries(ingredients)) {
                this.consumeIngredient(survivor, state, item, amount);
            }
        }
        survivor.addItem(resultItem, 1);
    }

    craftPlaceable(item, ingredients) {
        const state = this.stateManager.getState();
        const survivor = state.survivor;
        if (!window.godMode) {
            for (let [i, amt] of Object.entries(ingredients)) {
                if (this.getIngredientCount(survivor, state, i) < amt) return;
            }
        }
        if (survivor.addItem(item, 1)) {
            if (!window.godMode) {
                for (let [i, amt] of Object.entries(ingredients)) {
                    this.consumeIngredient(survivor, state, i, amt);
                }
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
            if (this.ghostItemType === 'chest') { color = '#8b5a2b'; size = 8; }

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

        if (s.equipped.backpack === undefined) s.equipped.backpack = null;

        if (!s.inventory.initializedForBackpack) {
            s.inventory.length = 10;
            s.inventory.initializedForBackpack = true;
            this.inventorySlotsCreated = false;
        }

        if (s.equipped.backpack === 'backpack' && s.inventory.length === 10) {
            s.inventory.push(...Array(10).fill(null));
            this.inventorySlotsCreated = false;
        } else if (!s.equipped.backpack && s.inventory.length === 20) {
            s.inventory.length = 10;
            this.inventorySlotsCreated = false;
        }

        for (const [key, element] of Object.entries(this.elements.equipSlots)) {
            if (!element) continue;
            if (s.equipped[key]) {
                element.className = 'inv-slot';
                element.innerHTML = `<span class="icon">${this.getItemIcon(s.equipped[key])}</span><span class="label">${s.equipped[key].replace(/_/g, ' ')}</span>`;
                element.onclick = () => {
                    if (key === 'backpack') {
                        if (s.addItem('backpack', 1)) s.equipped.backpack = null;
                    } else {
                        if (typeof s.unequip === 'function') s.unequip(key);
                    }
                };
            } else {
                element.className = 'inv-slot empty';
                element.innerHTML = `<span class="label" style="opacity:0.4; margin-top:2px;">${key.charAt(0).toUpperCase() + key.slice(1)}</span>`;
                element.onclick = null;
            }
        }

        let nearTable = false, nearFurnace = false, nearCampfire = false;
        let openChest = null;
        const nearbyChests = this.getNearbyChests();

        if (s.currentTask === 'Using Storage Chest' && s.targetResource?.type === 'chest') {
            openChest = s.targetResource;
            if (!openChest.slots) openChest.slots = Array(8).fill(null);
        }

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
            this.elements.stationPanel.style.display = (nearFurnace || nearCampfire || openChest || nearbyChests.length > 0) ? 'block' : 'none';
            if (this.elements.furnaceUI) this.elements.furnaceUI.style.display = nearFurnace ? 'block' : 'none';
            if (this.elements.campfireUI) this.elements.campfireUI.style.display = nearCampfire ? 'block' : 'none';
            if (this.elements.chestUI) this.elements.chestUI.style.display = openChest ? 'block' : 'none';
            if (this.elements.nearbyChestsUI) this.elements.nearbyChestsUI.style.display = (nearbyChests.length > 0 && !openChest) ? 'block' : 'none';
        }

        const updateSlotVisuals = (div, slot) => {
            if (slot === null) {
                div.className = 'inv-slot empty';
                div.innerHTML = '';
                div.removeAttribute('draggable');
            } else {
                div.className = 'inv-slot';
                div.innerHTML = `<span class="icon">${this.getItemIcon(slot.type)}</span><span class="label">${slot.type.replace(/_/g, ' ')}</span><span class="amount">${slot.amount > 1 ? slot.amount : ''}</span>`;
                div.setAttribute('draggable', 'true');
            }
        };

        if (this.elements.inventoryGrid && !this.inventorySlotsCreated) {
            this.elements.inventoryGrid.innerHTML = '';
            s.inventory.forEach((_, index) => {
                const slotDiv = this.createSlotElement('inventory', index);
                this.elements.inventoryGrid.appendChild(slotDiv);
                this.slotElements[index] = slotDiv;
            });
            this.inventorySlotsCreated = true;
        }

        if (this.inventorySlotsCreated) {
            s.inventory.forEach((slot, index) => {
                const div = this.slotElements[index];
                updateSlotVisuals(div, slot);

                div.onclick = (e) => {
                    if (slot === null) return;

                    if (e.shiftKey) {
                        if (openChest) this.depositItemToChest(index, openChest);
                        return;
                    }

                    const placeables = ['crafting_table', 'furnace', 'campfire', 'chest'];
                    const consumables = ['blueberry', 'cooked_meat', 'raw_meat'];

                    if (slot.type === 'backpack') {
                        if (!s.equipped.backpack) {
                            s.equipped.backpack = 'backpack';
                            s.inventory[index] = null;
                        }
                    } else if (placeables.includes(slot.type)) {
                        this.startGhostPlacement(slot.type);
                    } else if (!!s.getSlotForItem(slot.type)) {
                        s.equip(slot.type);
                    } else if (consumables.includes(slot.type)) {
                        this.consumeItem(slot.type);
                    }
                };
            });
        }

        if (openChest && this.elements.chestGrid) {
            if (!this.chestSlotsCreated) {
                this.elements.chestGrid.innerHTML = '';
                openChest.slots.forEach((_, index) => {
                    const slotDiv = this.createSlotElement('chest', index);
                    this.elements.chestGrid.appendChild(slotDiv);
                    this.chestSlotElements[index] = slotDiv;
                });
                this.chestSlotsCreated = true;
            }

            if (this.chestSlotsCreated) {
                openChest.slots.forEach((slot, index) => {
                    const div = this.chestSlotElements[index];
                    updateSlotVisuals(div, slot);

                    div.onclick = (e) => {
                        if (slot === null) return;
                        this.withdrawItemFromChest(index, openChest);
                    };
                });
            }
        } else if (!openChest && this.chestSlotsCreated) {
            this.elements.chestGrid.innerHTML = '';
            this.chestSlotsCreated = false;
            this.chestSlotElements = [];
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

        if (this.isCraftingOpen || nearTable || nearFurnace || nearCampfire) {
            const recipes = {
                'craft-rope': { fiber: 3 },
                'craft-axe': { stick: 2, pebble: 2 },
                'craft-pickaxe': { stick: 2, pebble: 3 },
                'craft-chest': { wood: 8 },
                'craft-campfire': { wood: 5, pebble: 5 },
                'craft-table': { wood: 10 },
                'craft-bow': { wood: 2, rope: 2 },
                'craft-arrow': { stick: 1, pebble: 1 },
                'craft-backpack': { leather: 5, rope: 2 },
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
                            if (this.getIngredientCount(s, state, item) < amt) {
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