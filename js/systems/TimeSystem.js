export class TimeSystem {
    update(deltaTime, state) {
        if (typeof state.time.continuousHours === 'undefined') {
            state.time.continuousHours = state.time.hours + (state.time.minutes / 60);
        }

        // Standard speed is 5 in-game minutes per real second. 
        // Sleeping fast-forwards the clock 20x faster.
        const timeSpeedMultiplier = state.survivor && state.survivor.currentTask === 'Sleeping' ? 100 : 5;

        const minutesPassed = deltaTime * timeSpeedMultiplier;
        state.time.continuousHours += minutesPassed / 60;

        if (state.time.continuousHours >= 24) {
            state.time.continuousHours -= 24;
        }

        state.time.hours = Math.floor(state.time.continuousHours);
        state.time.minutes = Math.floor((state.time.continuousHours % 1) * 60);

        state.time.isNight = state.time.hours >= 19 || state.time.hours < 5;
        state.time.sunAngle = ((state.time.continuousHours - 5) / 24) * Math.PI * 2;
        state.time.sunHeight = Math.sin(state.time.sunAngle);

        state.time.directionalLightIntensity = Math.max(0, state.time.sunHeight * 0.8);
        state.time.ambientLightIntensity = Math.max(0.05, state.time.sunHeight * 0.35 + 0.1);
        state.time.skyTransition = Math.max(0, Math.min(1, state.time.sunHeight + 0.3));
    }
}