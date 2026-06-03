export class UIManager {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.elements = {
            hydrationText: document.getElementById('stat-hydration-text'),
            hydrationBar: document.getElementById('bar-hydration'),
            satietyText: document.getElementById('stat-satiety-text'),
            satietyBar: document.getElementById('bar-satiety'),
            time: document.getElementById('game-time'),
            task: document.getElementById('current-task'),

            inventoryGrid: document.getElementById('inventory-grid'),
            inventoryPanel: document.getElementById('inventory-panel'),

            equipSlots: {
                axe: document.getElementById('equip-axe'),
                pickaxe: document.getElementById('equip-pickaxe'),
                helmet: document.getElementById('equip-helmet'),
                chest: document.getElementById('equip-chest'),
                pants: document.getElementById('equip-pants'),
                shoes: document.getElementById('equip-shoes'),
                weapon: document.getElementById('equip-weapon')
            },

            craftingPanel: document.getElementById('crafting-panel'),
            advRecipes: document.getElementById('advanced-recipes'),
            btnAxe: document.getElementById('craft-axe'),
            btnPickaxe: document.getElementById('craft-pickaxe'),
            btnTable: document.getElementById('craft-table'),
            btnSword: document.getElementById('craft-sword'),
            btnHelmet: document.getElementById('craft-helmet')
        };

        this.isInventoryOpen = false;
        this.isCraftingOpen = false;
        this.inventorySlotsCreated = false;
        this.slotElements = [];

        document.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'i') {
                this.isInventoryOpen = !this.isInventoryOpen;
                if (this.elements.inventoryPanel) this.elements.inventoryPanel.style.display = this.isInventoryOpen ? 'block' : 'none';
            }
            if (e.key.toLowerCase() === 'c') {
                this.isCraftingOpen = !this.isCraftingOpen;
                if (this.elements.craftingPanel) this.elements.craftingPanel.style.display = this.isCraftingOpen ? 'block' : 'none';
            }
        });

        if (this.elements.btnAxe) this.elements.btnAxe.onclick = () => this.craftItem('stone_axe', { stick: 2, pebble: 2 });
        if (this.elements.btnPickaxe) this.elements.btnPickaxe.onclick = () => this.craftItem('stone_pickaxe', { stick: 2, pebble: 3 });
        if (this.elements.btnTable) this.elements.btnTable.onclick = () => this.placeCraftingTable();
        if (this.elements.btnSword) this.elements.btnSword.onclick = () => this.craftItem('wood_sword', { wood: 5, stick: 2 });
        if (this.elements.btnHelmet) this.elements.btnHelmet.onclick = () => this.craftItem('leather_helmet', { leather: 5 });
    }

    craftItem(resultItem, ingredients) {
        const survivor = this.stateManager.getState().survivor;
        for (let [item, amount] of Object.entries(ingredients)) {
            if (!survivor.hasEnough(item, amount)) return;
        }
        for (let [item, amount] of Object.entries(ingredients)) {
            survivor.removeItem(item, amount);
        }
        survivor.addItem(resultItem, 1);
    }

    placeCraftingTable() {
        const survivor = this.stateManager.getState().survivor;
        if (survivor.hasEnough('wood', 10)) {
            survivor.removeItem('wood', 10);
            this.stateManager.addResource({ type: 'crafting_table', x: survivor.x + 30, y: survivor.y + 30, id: Math.random() });
        }
    }

    update(state) {
        if (!state.survivor) return;
        const s = state.survivor;

        // Render Equipment Slots
        for (const [key, element] of Object.entries(this.elements.equipSlots)) {
            if (s.equipped[key]) {
                element.className = 'inv-slot';
                element.innerText = s.equipped[key].replace('_', ' ');
                element.onclick = () => s.unequip(key);
            } else {
                element.className = 'inv-slot empty';
                element.innerText = key.charAt(0).toUpperCase() + key.slice(1);
                element.onclick = null;
            }
        }

        // Render Inventory Grid
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
                    div.innerHTML = '';
                    div.oncontextmenu = null;
                } else {
                    div.className = 'inv-slot';
                    div.innerHTML = `<span>${slot.type}</span><span class="amount">${slot.amount}</span>`;

                    // Right-click to equip
                    div.oncontextmenu = (e) => {
                        e.preventDefault();
                        s.equip(slot.type);
                    };
                }
            });
        }

        if (this.elements.hydrationText) this.elements.hydrationText.innerText = `${Math.floor(s.stats.hydration)}%`;
        if (this.elements.satietyText) this.elements.satietyText.innerText = `${Math.floor(s.stats.satiety)}%`;
        if (this.elements.hydrationBar) this.elements.hydrationBar.style.width = `${s.stats.hydration}%`;
        if (this.elements.satietyBar) this.elements.satietyBar.style.width = `${s.stats.satiety}%`;
        if (this.elements.task && this.elements.task.innerText !== s.currentTask) this.elements.task.innerText = s.currentTask;

        const hoursStr = state.time.hours.toString().padStart(2, '0');
        const minutesStr = state.time.minutes.toString().padStart(2, '0');
        if (this.elements.time && this.elements.time.innerText !== `${hoursStr}:${minutesStr}`) this.elements.time.innerText = `${hoursStr}:${minutesStr}`;
    }
}