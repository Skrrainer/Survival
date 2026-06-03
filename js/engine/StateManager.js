export class StateManager {
    constructor() {
        this.gameState = {
            time: {
                hours: 8,
                minutes: 0,
                speedMultiplier: 1
            },
            survivor: null,
            resources: []
        };
    }

    getState() {
        return this.gameState;
    }

    setSurvivor(survivor) {
        this.gameState.survivor = survivor;
    }

    addResource(resource) {
        this.gameState.resources.push(resource);
    }
}