import { StateManager } from './engine/StateManager.js';
import { Renderer } from './engine/Renderer.js';
import { GameLoop } from './engine/GameLoop.js';
import { TimeSystem } from './systems/TimeSystem.js';
import { AISystem } from './systems/AISystem.js';
import { ResourceSystem } from './systems/ResourceSystem.js';
import { InputSystem } from './systems/InputSystem.js';
import { UIManager } from './ui/UIManager.js';
import { Survivor } from './entities/Survivor.js';
import { initRegistry } from './entities/ItemRegistry.js';

async function bootGame() {
    console.log("Connecting to Database and Loading Items...");
    await initRegistry();

    const stateManager = new StateManager();
    const renderer = new Renderer('game-canvas');
    const uiManager = new UIManager(stateManager);

    const timeSystem = new TimeSystem();
    const aiSystem = new AISystem();
    const resourceSystem = new ResourceSystem();
    const inputSystem = new InputSystem();

    resourceSystem.init(stateManager);
    const mainCharacter = new Survivor(0, 0);
    stateManager.setSurvivor(mainCharacter);

    inputSystem.init('game-canvas', renderer, stateManager, uiManager);

    function update(deltaTime) {
        const currentState = stateManager.getState();
        timeSystem.update(deltaTime, currentState);
        aiSystem.update(deltaTime, currentState);
        resourceSystem.update(currentState);
        uiManager.update(currentState);
    }

    function render() {
        renderer.render(stateManager.getState());
    }

    const engine = new GameLoop(update, render);
    engine.start();

    console.log("Active Survival Architecture Initialized Successfully.");
}

bootGame();