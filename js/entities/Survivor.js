export class Survivor {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 10;
        this.color = '#3498db';
        this.speed = 50;
        this.targetX = x;
        this.targetY = y;
        this.targetResource = null;
        this.actionTimer = 0;
        this.inLake = false;

        this.inventoryCapacity = 15;
        this.inventory = new Array(this.inventoryCapacity).fill(null);

        this.equipped = {
            axe: null,
            pickaxe: null,
            helmet: null,
            chest: null,
            pants: null,
            shoes: null,
            weapon: null
        };

        this.stats = { health: 100.0, hydration: 100.0, satiety: 100.0 };
        this.currentTask = 'Idle';
    }

    getSlotForItem(itemType) {
        if (itemType === 'stone_axe') return 'axe';
        if (itemType === 'stone_pickaxe') return 'pickaxe';
        if (itemType.includes('helmet')) return 'helmet';
        if (itemType.includes('chest')) return 'chest';
        if (itemType.includes('pants')) return 'pants';
        if (itemType.includes('shoes')) return 'shoes';
        if (itemType === 'bow' || itemType.includes('sword')) return 'weapon';
        return null;
    }

    equip(itemType) {
        const slot = this.getSlotForItem(itemType);
        if (!slot) return;
        if (this.equipped[slot]) {
            this.unequip(slot);
        }
        if (this.removeItem(itemType, 1)) {
            this.equipped[slot] = itemType;
        }
    }

    unequip(slot) {
        if (this.equipped[slot]) {
            const itemType = this.equipped[slot];
            this.addItem(itemType, 1);
            this.equipped[slot] = null;
        }
    }

    hasEnough(itemType, amount) {
        let total = 0;
        this.inventory.forEach(slot => {
            if (slot !== null && slot.type === itemType) total += slot.amount;
        });
        return total >= amount;
    }

    removeItem(itemType, amount) {
        if (!this.hasEnough(itemType, amount)) return false;
        let amountLeft = amount;

        for (let i = 0; i < this.inventoryCapacity; i++) {
            let slot = this.inventory[i];
            if (slot !== null && slot.type === itemType) {
                if (slot.amount > amountLeft) {
                    slot.amount -= amountLeft;
                    return true;
                } else {
                    amountLeft -= slot.amount;
                    this.inventory[i] = null;
                    if (amountLeft <= 0) return true;
                }
            }
        }
        return true;
    }

    addItem(itemType, amount) {
        let existingItem = this.inventory.find(slot => slot !== null && slot.type === itemType);
        if (existingItem) {
            existingItem.amount += amount;
            return true;
        }

        let emptyIndex = this.inventory.findIndex(slot => slot === null);
        if (emptyIndex !== -1) {
            this.inventory[emptyIndex] = { type: itemType, amount: amount };
            return true;
        }
        return false;
    }
}