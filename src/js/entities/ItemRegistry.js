import { createClient } from '@supabase/supabase-js';

// REPLACE THESE WITH YOUR SUPABASE CREDENTIALS WHEN READY
const SUPABASE_URL = 'https://chziobarpialqujkmrln.supabase.co';
const SUPABASE_KEY = 'sb_publishable_m_Qu1iVGCaEXLSKL4XdAQA_DLPttOCc';

export class Item {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.icon = data.icon || 'placeholder.png';
        this.maxStack = data.max_stack || 100;
        this.type = data.type || 'resource';
        this.craftingStation = data.crafting_station || null;
        this.recipe = data.recipe ? (typeof data.recipe === 'string' ? JSON.parse(data.recipe) : data.recipe) : null;

        if (data.equip_slot) this.equipSlot = data.equip_slot;
        if (data.tool_type) this.toolType = data.tool_type;
        if (data.tier) this.tier = data.tier;
        if (data.damage) this.damage = data.damage;
        if (data.health) this.health = data.health;
        if (data.satiety) this.satiety = data.satiety;
        if (data.hydration) this.hydration = data.hydration;
    }
}

export const Registry = {};

const defaultItemsData = [
    { id: 'wood', name: 'Wood', icon: 'wood.png', type: 'resource', max_stack: 100 },
    { id: 'stick', name: 'Stick', icon: 'stick.png', type: 'resource', max_stack: 100 },
    { id: 'fiber', name: 'Fiber', icon: 'fiber.png', type: 'resource', max_stack: 100 },
    { id: 'pebble', name: 'Pebble', icon: 'pebble.png', type: 'resource', max_stack: 100 },
    { id: 'stone', name: 'Stone', icon: 'stone.png', type: 'resource', max_stack: 100 },
    { id: 'iron_ore', name: 'Iron Ore', icon: 'iron_ore.png', type: 'resource', max_stack: 100 },
    { id: 'coal', name: 'Coal', icon: 'coal.png', type: 'resource', max_stack: 100 },
    { id: 'leather', name: 'Leather', icon: 'leather.png', type: 'resource', max_stack: 100 },

    { id: 'rope', name: 'Rope', icon: 'rope.png', type: 'resource', max_stack: 100, crafting_station: 'hand', recipe: { fiber: 3 } },
    { id: 'iron_ingot', name: 'Iron Ingot', icon: 'iron_ingot.png', type: 'resource', max_stack: 100, crafting_station: 'furnace', recipe: { iron_ore: 1, coal: 1 } },

    { id: 'stone_axe', name: 'Stone Axe', icon: 'stone_axe.png', type: 'tool', max_stack: 1, equip_slot: 'axe', tool_type: 'axe', tier: 1, crafting_station: 'hand', recipe: { stick: 2, pebble: 2 } },
    { id: 'stone_pickaxe', name: 'Stone Pickaxe', icon: 'stone_pickaxe.png', type: 'tool', max_stack: 1, equip_slot: 'pickaxe', tool_type: 'pickaxe', tier: 1, crafting_station: 'hand', recipe: { stick: 2, pebble: 3 } },

    { id: 'iron_axe', name: 'Iron Axe', icon: 'iron_axe.png', type: 'tool', max_stack: 1, equip_slot: 'axe', tool_type: 'axe', tier: 2, crafting_station: 'blacksmith', recipe: { iron_ingot: 3, stick: 2 } },
    { id: 'iron_pickaxe', name: 'Iron Pickaxe', icon: 'iron_pickaxe.png', type: 'tool', max_stack: 1, equip_slot: 'pickaxe', tool_type: 'pickaxe', tier: 2, crafting_station: 'blacksmith', recipe: { iron_ingot: 3, stick: 2 } },

    { id: 'wood_sword', name: 'Wood Sword', icon: 'wood_sword.png', type: 'weapon', max_stack: 1, equip_slot: 'weapon', damage: 10, crafting_station: 'workbench', recipe: { wood: 5, stick: 2 } },
    { id: 'iron_sword', name: 'Iron Sword', icon: 'iron_sword.png', type: 'weapon', max_stack: 1, equip_slot: 'weapon', damage: 25, crafting_station: 'blacksmith', recipe: { iron_ingot: 2, stick: 1 } },
    { id: 'bow', name: 'Wooden Bow', icon: 'bow.png', type: 'weapon', max_stack: 1, equip_slot: 'weapon', damage: 15, crafting_station: 'workbench', recipe: { wood: 2, rope: 2 } },
    { id: 'arrow', name: 'Stone Arrow', icon: 'arrow.png', type: 'resource', max_stack: 100, crafting_station: 'workbench', recipe: { stick: 1, pebble: 1 } },

    { id: 'leather_helmet', name: 'Leather Helmet', icon: 'leather_helmet.png', type: 'equippable', max_stack: 1, equip_slot: 'helmet', crafting_station: 'workbench', recipe: { leather: 5 } },
    { id: 'backpack', name: 'Backpack', icon: 'backpack.png', type: 'equippable', max_stack: 1, equip_slot: 'backpack', crafting_station: 'workbench', recipe: { leather: 5, rope: 2 } },

    { id: 'blueberry', name: 'Blueberry', icon: 'blueberry.png', type: 'consumable', max_stack: 100, health: 0, satiety: 10, hydration: 5 },
    { id: 'raw_meat', name: 'Raw Meat', icon: 'raw_meat.png', type: 'consumable', max_stack: 100, health: -10, satiety: 15, hydration: 0 },
    { id: 'cooked_meat', name: 'Cooked Meat', icon: 'cooked_meat.png', type: 'consumable', max_stack: 100, health: 20, satiety: 40, hydration: 0, crafting_station: 'campfire', recipe: { raw_meat: 1, wood: 1 } },

    { id: 'campfire', name: 'Campfire', icon: 'campfire.png', type: 'placeable', max_stack: 100, crafting_station: 'hand', recipe: { wood: 5, pebble: 5 } },
    { id: 'crafting_table', name: 'Crafting Table', icon: 'crafting_table.png', type: 'placeable', max_stack: 100, crafting_station: 'hand', recipe: { wood: 10 } },
    { id: 'furnace', name: 'Furnace', icon: 'furnace.png', type: 'placeable', max_stack: 100, crafting_station: 'workbench', recipe: { stone: 10 } },
    { id: 'chest', name: 'Storage Chest', icon: 'chest.png', type: 'placeable', max_stack: 100, crafting_station: 'hand', recipe: { wood: 8 } },
    { id: 'blacksmith', name: 'Blacksmith', icon: 'blacksmith.png', type: 'placeable', max_stack: 100, crafting_station: 'workbench', recipe: { iron_ingot: 2, stone: 5, wood: 5 } }
];

export async function initRegistry() {
    try {
        if (!SUPABASE_URL.includes('YOUR-PROJECT-ID')) {
            const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
            const { data, error } = await supabase.from('items').select('*');
            if (error) throw error;
            if (data && data.length > 0) {
                data.forEach(d => { Registry[d.id] = new Item(d); });
                console.log("Items loaded from Supabase.");
                return;
            }
        }
        throw new Error("Missing credentials or empty table.");
    } catch (err) {
        console.warn("Supabase not connected or error fetching data. Falling back to local default items.", err.message);
        defaultItemsData.forEach(d => { Registry[d.id] = new Item(d); });
    }
}