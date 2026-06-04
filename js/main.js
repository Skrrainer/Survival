import { StateManager } from './engine/StateManager.js';
import { Renderer } from './engine/Renderer.js';
import { GameLoop } from './engine/GameLoop.js';
import { TimeSystem } from './systems/TimeSystem.js';
import { AISystem } from './systems/AISystem.js';
import { ResourceSystem } from './systems/ResourceSystem.js';
import { InputSystem } from './systems/InputSystem.js';
import { UIManager } from './ui/UIManager.js';
import { Survivor } from './entities/Survivor.js';

// Initialization
const stateManager = new StateManager();
const renderer = new Renderer('game-canvas');

// The UI Manager takes the stateManager so it can execute crafts
const uiManager = new UIManager(stateManager);

// Instantiate Systems
const timeSystem = new TimeSystem();
const aiSystem = new AISystem();
const resourceSystem = new ResourceSystem();
const inputSystem = new InputSystem();

// Setup initial game state
resourceSystem.init(stateManager);
const mainCharacter = new Survivor(0, 0);
stateManager.setSurvivor(mainCharacter);

// Boot the Input System — now also receives uiManager for ghost placement
inputSystem.init('game-canvas', renderer, stateManager, uiManager);

// The Core Update Logic
function update(deltaTime) {
    const currentState = stateManager.getState();

    timeSystem.update(deltaTime, currentState);
    aiSystem.update(deltaTime, currentState);
    resourceSystem.update(currentState);
    uiManager.update(currentState);
}

// The Core Render Logic
function render() {
    renderer.render(stateManager.getState());
}

// Boot the engine
const engine = new GameLoop(update, render);
engine.start();

console.log("Active Survival Architecture Initialized Successfully.");