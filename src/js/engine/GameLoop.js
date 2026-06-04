export class GameLoop {
    constructor(updateCallback, renderCallback) {
        this.updateCallback = updateCallback;
        this.renderCallback = renderCallback;
        this.lastTime = 0;
        this.isRunning = false;
        this.animationFrameId = null;
    }

    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.lastTime = performance.now();
            this.animationFrameId = requestAnimationFrame((time) => this.loop(time));
        }
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }

    loop(currentTime) {
        if (!this.isRunning) return;

        const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;

        this.updateCallback(deltaTime);
        this.renderCallback();

        this.animationFrameId = requestAnimationFrame((time) => this.loop(time));
    }
}