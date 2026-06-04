import { getElevation } from '../engine/Renderer.js';
import { Registry } from '../entities/ItemRegistry.js';

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
            blacksmithUI: document.getElementById('blacksmith-ui'),
            chestUI: document.getElementById('chest-ui'),

            recipesHand: document.getElementById('recipes-hand'),
            recipesWorkbench: document.getElementById('recipes-workbench'),
            recipesFurnace: document.getElementById('recipes-furnace'),
            recipesCampfire: document.getElementById('recipes-campfire'),
            recipesBlacksmith: document.getElementById('recipes-blacksmith'),

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

        this.buildDynamicCraftingMenus();

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

        const depBtn = document.getElementById('btn-deposit-all');
        if (depBtn) {
            depBtn.onclick = () => {
                const s = this.stateManager.getState().survivor;
                const nearbyChests = this.getNearbyChests();
                if (nearbyChests.length === 0) return;

                for (let i = 0; i < s.inventory.length; i++) {
                    let pSlot = s.inventory[i];
                    if (pSlot) {
                        const def = Registry[pSlot.type];
                        if (def && (def.type === 'tool' || def.type === 'weapon' || def.type === 'equippable')) continue;

                        let existsInChests = false;
                        for (let c of nearbyChests) {
                            for (let j = 0; j < 10; j++) {
                                if (c.slots[j] && c.slots[j].type === pSlot.type) {
                                    existsInChests = true; break;
                                }
                            }
                            if(existsInChests) break;
                        }

                        if (existsInChests) {
                            let deposited = false;
                            for (let c of nearbyChests) {
                                for (let j = 0; j < 10; j++) {
                                    if (c.slots[j] && c.slots[j].type === pSlot.type) {
                                        c.slots[j].amount += pSlot.amount;
                                        deposited = true; break;
                                    }
                                }
                                if(deposited) break;
                            }
                            if (!deposited) {
                                for (let c of nearbyChests) {
                                    for (let j = 0; j < 10; j++) {
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

    buildDynamicCraftingMenus() {
        const containers = {
            'hand': this.elements.recipesHand,
            'workbench': this.elements.recipesWorkbench,
            'furnace': this.elements.recipesFurnace,
            'campfire': this.elements.recipesCampfire,
            'blacksmith': this.elements.recipesBlacksmith
        };

        for (const [id, item] of Object.entries(Registry)) {
            if (item.craftingStation && item.recipe && containers[item.craftingStation]) {
                const reqString = Object.entries(item.recipe).map(([reqId, amt]) => {
                    return `${amt} ${Registry[reqId]?.name || reqId}`;
                }).join(', ');

                const card = document.createElement('div');
                card.className = 'recipe-card';
                card.innerHTML = `
                    <div class="recipe-info">
                        <span class="recipe-icon" style="width:28px;height:28px;">${this.getItemIcon(item.id)}</span>
                        <div class="recipe-text">
                            <h4>${item.name}</h4>
                            <p>${reqString}</p>
                        </div>
                    </div>
                    <button id="craft-btn-${item.id}" class="btn-craft">Craft</button>
                `;
                containers[item.craftingStation].appendChild(card);

                const btn = card.querySelector(`#craft-btn-${item.id}`);
                btn.onclick = () => {
                    if (item.type === 'placeable') this.craftPlaceable(item.id, item.recipe);
                    else this.craftItem(item.id, item.recipe);
                };
            }
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
                if (!r.slots) r.slots = Array(10).fill(null);
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
        for (let j = 0; j < 10; j++) {
            if (chest.slots[j] && chest.slots[j].type === item.type) {
                chest.slots[j].amount += item.amount;
                deposited = true; break;
            }
        }
        if (!deposited) {
            for (let j = 0; j < 10; j++) {
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
        const def = Registry[type];
        if (def && def.icon) {
            return `<img src="src/assets/imgs/itemsIcons/${def.icon}" onerror="this.outerHTML='<span style=&quot;font-size: 1.5rem; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;&quot;>📦</span>'" style="width: 100%; height: 100%; object-fit: contain; pointer-events: none;" alt="${def.name}">`;
        }
        return `<span style="font-size: 1.5rem; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">📦</span>`;
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
                    if (elev > 1800) ctx.fillStyle = '#eee';
                    else if (elev > 600) ctx.fillStyle = '#444';
                    else if (elev <= 5) ctx.fillStyle = '#887';
                    else ctx.fillStyle = '#232';
                    ctx.fillRect(x, z, step+1, step+1);
                }
            }
        }

        resources.forEach(r => {
            if (['crafting_table', 'furnace', 'campfire', 'chest', 'blacksmith'].includes(r.type)) {
                ctx.fillStyle = r.color || '#8b5a2b';
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

    startGhostPlacement(itemType) {
        this.ghostPlacementActive = true;
        this.ghostItemType = itemType;
        this.isInventoryOpen = false;
        if (this.elements.inventoryPanel) this.elements.inventoryPanel.style.display = 'none';
        document.dispatchEvent(new CustomEvent('ghostPlacementStarted', { detail: { itemType } }));
    }

    confirmGhostPlacement(x, z) {
        if (!this.ghostPlacementActive || !this.ghostItemType) return;

        const state = this.stateManager.getState();
        const s = state.survivor;

        if (s.removeItem(this.ghostItemType, 1)) {
            state.resources.push({
                id: Math.random().toString(),
                type: this.ghostItemType,
                x: x,
                y: z,
                size: 8,
                health: 100,
                color: '#8b5a2b'
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

        // Dynamic Injection of Level / XP tracker UI
        if (!this.elements.levelText) {
            this.elements.levelText = document.createElement('div');
            this.elements.levelText.id = 'player-level-ui';
            this.elements.levelText.style.position = 'absolute';
            this.elements.levelText.style.top = '20px';
            this.elements.levelText.style.left = '50%';
            this.elements.levelText.style.transform = 'translateX(-50%)';
            this.elements.levelText.style.color = '#f1c40f';
            this.elements.levelText.style.fontFamily = 'monospace';
            this.elements.levelText.style.fontWeight = 'bold';
            this.elements.levelText.style.fontSize = '24px';
            this.elements.levelText.style.textShadow = '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';
            this.elements.levelText.style.pointerEvents = 'none';
            this.elements.levelText.style.zIndex = '1000';
            document.body.appendChild(this.elements.levelText);
        }
        this.elements.levelText.innerText = `Level ${s.level} [XP: ${s.xp}/${s.xpToNextLevel}]`;

        if (s.equipped.backpack === undefined) s.equipped.backpack = null;

        if (!s.inventory.initializedForBackpack) {
            s.inventory.length = 10;
            s.inventory.initializedForBackpack = true;
            this.inventorySlotsCreated = false;
        }

        for (const [key, element] of Object.entries(this.elements.equipSlots)) {
            if (!element) continue;
            if (s.equipped[key]) {
                const def = Registry[s.equipped[key]];
                element.className = 'inv-slot';
                element.innerHTML = `<span class="icon" style="width:24px;height:24px;">${this.getItemIcon(s.equipped[key])}</span><span class="label">${def ? def.name : s.equipped[key]}</span>`;
                element.onclick = () => {
                    if (typeof s.unequip === 'function') s.unequip(key);
                };
            } else {
                element.className = 'inv-slot empty';
                element.innerHTML = `<span class="label" style="opacity:0.4; margin-top:2px;">${key.charAt(0).toUpperCase() + key.slice(1)}</span>`;
                element.onclick = null;
            }
        }

        let nearTable = false, nearFurnace = false, nearCampfire = false, nearBlacksmith = false;
        let openChest = null;
        const nearbyChests = this.getNearbyChests();

        if (s.currentTask === 'Using Storage Chest' && s.targetResource?.type === 'chest') {
            openChest = s.targetResource;
            if (!openChest.slots) openChest.slots = Array(10).fill(null);
        }

        state.resources.forEach(r => {
            const dist = Math.hypot(r.x - s.x, r.y - s.y);
            if (dist < 80) {
                if (r.type === 'crafting_table') nearTable = true;
                if (r.type === 'furnace') nearFurnace = true;
                if (r.type === 'campfire') nearCampfire = true;
                if (r.type === 'blacksmith') nearBlacksmith = true;
            }
        });

        if (this.elements.advRecipes) this.elements.advRecipes.style.display = nearTable ? 'block' : 'none';

        if (this.elements.stationPanel) {
            this.elements.stationPanel.style.display = (nearFurnace || nearCampfire || openChest || nearbyChests.length > 0 || nearBlacksmith) ? 'block' : 'none';
            if (this.elements.furnaceUI) this.elements.furnaceUI.style.display = nearFurnace ? 'block' : 'none';
            if (this.elements.campfireUI) this.elements.campfireUI.style.display = nearCampfire ? 'block' : 'none';
            if (this.elements.blacksmithUI) this.elements.blacksmithUI.style.display = nearBlacksmith ? 'block' : 'none';
            if (this.elements.chestUI) this.elements.chestUI.style.display = openChest ? 'block' : 'none';
            if (this.elements.nearbyChestsUI) this.elements.nearbyChestsUI.style.display = (nearbyChests.length > 0 && !openChest) ? 'block' : 'none';
        }

        const updateSlotVisuals = (div, slot) => {
            if (slot === null) {
                div.className = 'inv-slot empty';
                div.innerHTML = '';
                div.removeAttribute('draggable');
            } else {
                const def = Registry[slot.type];
                div.className = 'inv-slot';
                div.innerHTML = `<span class="icon" style="width:28px;height:28px;">${this.getItemIcon(slot.type)}</span><span class="label">${def ? def.name : slot.type}</span><span class="amount">${slot.amount > 1 ? slot.amount : ''}</span>`;
                div.setAttribute('draggable', 'true');
            }
        };

        if (this.elements.inventoryGrid && this.slotElements.length !== s.inventory.length) {
            this.elements.inventoryGrid.innerHTML = '';
            this.slotElements = [];
            s.inventory.forEach((_, index) => {
                const slotDiv = this.createSlotElement('inventory', index);
                this.elements.inventoryGrid.appendChild(slotDiv);
                this.slotElements[index] = slotDiv;
            });
        }

        s.inventory.forEach((slot, index) => {
            const div = this.slotElements[index];
            updateSlotVisuals(div, slot);

            div.onclick = (e) => {
                if (slot === null) return;

                if (e.shiftKey) {
                    if (openChest) this.depositItemToChest(index, openChest);
                    return;
                }

                const def = Registry[slot.type];
                if (!def) return;

                if (def.type === 'placeable') {
                    this.startGhostPlacement(slot.type);
                } else if (def.equipSlot) {
                    s.equipItemFromSlot(index);
                } else if (def.type === 'consumable') {
                    if (s.removeItem(slot.type, 1)) {
                        s.stats.health = Math.min(100, s.stats.health + def.health);
                        s.stats.satiety = Math.min(100, s.stats.satiety + def.satiety);
                        s.stats.hydration = Math.min(100, s.stats.hydration + def.hydration);
                    }
                }
            };
        });

        if (openChest && this.elements.chestGrid) {
            if (this.chestSlotElements.length !== 10) {
                this.elements.chestGrid.innerHTML = '';
                this.chestSlotElements = [];
                openChest.slots.forEach((_, index) => {
                    const slotDiv = this.createSlotElement('chest', index);
                    this.elements.chestGrid.appendChild(slotDiv);
                    this.chestSlotElements[index] = slotDiv;
                });
            }

            openChest.slots.forEach((slot, index) => {
                const div = this.chestSlotElements[index];
                updateSlotVisuals(div, slot);

                div.onclick = (e) => {
                    if (slot === null) return;
                    this.withdrawItemFromChest(index, openChest);
                };
            });
        } else if (!openChest && this.chestSlotElements.length > 0) {
            this.elements.chestGrid.innerHTML = '';
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

        if (this.isCraftingOpen || nearTable || nearFurnace || nearCampfire || nearBlacksmith) {
            for (const [id, item] of Object.entries(Registry)) {
                if (item.craftingStation && item.recipe) {
                    const btn = document.getElementById(`craft-btn-${item.id}`);
                    if (btn) {
                        let canCraft = window.godMode;
                        if (!canCraft) {
                            canCraft = true;
                            for (const [reqId, amt] of Object.entries(item.recipe)) {
                                if (this.getIngredientCount(s, state, reqId) < amt) {
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
}