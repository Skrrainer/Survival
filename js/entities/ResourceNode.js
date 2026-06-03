export class ResourceNode {
    constructor(type, x, y) {
        // Unique ID allows us to delete specific resources off the ground
        this.id = Math.random().toString(36).substr(2, 9);
        this.type = type;
        this.x = x;
        this.y = y;
        this.size = 15;

        switch(type) {
            case 'tree':
                this.color = '#2ecc71';
                break;
            case 'rock':
                this.color = '#7f8c8d';
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
            case 'crafting_table':
                this.color = '#e67e22';
                this.size = 10;
                break;
            default:
                this.color = '#ffffff';
        }
    }
}