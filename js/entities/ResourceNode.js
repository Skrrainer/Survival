export class ResourceNode {
    constructor(type, x, y) {
        this.id = Math.random().toString(36).substr(2, 9);
        this.type = type;
        this.x = x;
        this.y = y;
        this.size = 15;
        this.isFalling = false;
        this.fallAngle = 0;

        switch(type) {
            case 'tree':
                this.color = '#2ecc71';
                this.health = 4;
                break;
            case 'rock':
                this.color = '#7f8c8d';
                this.health = 4;
                break;
            case 'iron_node':
                this.color = '#d35400';
                this.size = 12;
                this.health = 5;
                break;
            case 'coal_node':
                this.color = '#2c3e50';
                this.size = 12;
                this.health = 5;
                break;
            case 'water':
                this.color = '#2980b9';
                this.size = 20;
                break;
            case 'stick':
                this.color = '#8b5a2b';
                this.size = 4;
                break;
            case 'pebble':
                this.color = '#95a5a6';
                this.size = 3;
                break;
            case 'tall_bush':
                this.color = '#27ae60';
                this.size = 12;
                break;
            case 'crafting_table':
                this.color = '#e67e22';
                this.size = 10;
                break;
            case 'furnace':
                this.color = '#34495e';
                this.size = 12;
                break;
            case 'campfire':
                this.color = '#c0392b';
                this.size = 8;
                break;
            case 'blueberry_bush':
                this.color = '#4a7c3f';
                this.size = 8;
                this.berryCount = Math.floor(Math.random() * 5) + 1;
                this.maxBerries = 5;
                this.berryRegenTimer = 0;
                this.berryRegenInterval = 120;
                break;
            default:
                this.color = '#ffffff';
        }
    }
}