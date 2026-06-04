import { Registry } from './ItemRegistry.js';

export class Survivor {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.speed = 40;
        this.rotation = 0;

        // Leveling System
        this.level = 1;
        this.xp = 0;
        this.xpToNextLevel = 100;

        this.inventory = new Array(10).fill(null);

        this.equipped = {
            helmet: null, chest: null, pants: null, shoes: null,
            axe: null, pickaxe: null, weapon: null, backpack: null
        };

        this.stats = { health: 100, hydration: 100, satiety: 100 };
        this.currentTask = 'Idle';
        this.targetResource = null;
        this.deathTimer = 0;
    }

    addXP(amount) {
        this.xp += amount;
        while (this.xp >= this.xpToNextLevel) {
            this.xp -= this.xpToNextLevel;
            this.level++;
            this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.5);

            // Level Up Rewards
            this.stats.health = 100;
            this.stats.hydration = 100;
            this.stats.satiety = 100;
            this.currentTask = 'Leveled Up!';
        }
    }

    addItem(type, amount) {
        const def = Registry[type];
        if (!def) return false;

        let remaining = amount;
        for (let i = 0; i < this.inventory.length; i++) {
            if (this.inventory[i] && this.inventory[i].type === type) {
                const space = def.maxStack - this.inventory[i].amount;
                if (space > 0) {
                    const add = Math.min(space, remaining);
                    this.inventory[i].amount += add;
                    remaining -= add;
                    if (remaining <= 0) return true;
                }
            }
        }

        for (let i = 0; i < this.inventory.length; i++) {
            if (this.inventory[i] === null) {
                const add = Math.min(def.maxStack, remaining);
                this.inventory[i] = { type: type, amount: add };
                remaining -= add;
                if (remaining <= 0) return true;
            }
        }

        this.currentTask = 'Inventory Full!';
        return false;
    }

    removeItem(type, amount) {
        let remaining = amount;
        for (let i = 0; i < this.inventory.length; i++) {
            if (this.inventory[i] && this.inventory[i].type === type) {
                if (this.inventory[i].amount > remaining) {
                    this.inventory[i].amount -= remaining;
                    return true;
                } else {
                    remaining -= this.inventory[i].amount;
                    this.inventory[i] = null;
                }
            }
        }
        return remaining <= 0;
    }

    hasEnough(type, amount) {
        let count = 0;
        for (let item of this.inventory) {
            if (item && item.type === type) count += item.amount;
        }
        return count >= amount;
    }

    equipItemFromSlot(index) {
        const itemData = this.inventory[index];
        if (!itemData) return;

        const def = Registry[itemData.type];
        if (!def || !def.equipSlot) return;

        const targetSlot = def.equipSlot;
        const currentlyEquipped = this.equipped[targetSlot];

        if (targetSlot === 'backpack') {
            this.equipped.backpack = itemData.type;
            this.inventory.length = 20;
            if (itemData.contents) {
                for (let i = 0; i < 10; i++) this.inventory[10 + i] = itemData.contents[i] || null;
            } else {
                for (let i = 10; i < 20; i++) this.inventory[i] = null;
            }
            this.inventory[index] = null;
            return;
        }

        this.equipped[targetSlot] = itemData.type;
        this.inventory[index] = null;

        if (currentlyEquipped) {
            this.addItem(currentlyEquipped, 1);
        }
    }

    unequip(slotKey) {
        if (!this.equipped[slotKey]) return;

        if (slotKey === 'backpack') {
            let emptySlot0to9 = -1;
            for(let i = 0; i < 10; i++) {
                if (!this.inventory[i]) { emptySlot0to9 = i; break; }
            }

            if (emptySlot0to9 === -1) {
                this.currentTask = 'Main Inventory Full! Cannot unequip Backpack.';
                return;
            }

            const savedData = this.inventory.slice(10, 20);
            this.inventory[emptySlot0to9] = { type: 'backpack', amount: 1, contents: savedData };

            this.inventory.length = 10;
            this.equipped.backpack = null;
            return;
        }

        if (this.addItem(this.equipped[slotKey], 1)) {
            this.equipped[slotKey] = null;
        }
    }
}