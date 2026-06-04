export class TimeSystem {
    update(deltaTime, state) {
        if (typeof state.time.continuousHours === 'undefined') {
            state.time.continuousHours = state.time.hours + (state.time.minutes / 60);
        }

        // Slowed down: 2 in-game minutes per real second. 
        // Sleeping fast-forwards the clock 20x faster (40 minutes/sec).
        const timeSpeedMultiplier = state.survivor && state.survivor.currentTask === 'Sleeping' ? 40 : 2;

        const minutesPassed = deltaTime * timeSpeedMultiplier;
        state.time.continuousHours += minutesPassed / 60;

        if (state.time.continuousHours >= 24) {
            state.time.continuousHours -= 24;
        }

        state.time.hours = Math.floor(state.time.continuousHours);
        state.time.minutes = Math.floor((state.time.continuousHours % 1) * 60);

        const ch = state.time.continuousHours;

        // Day is strictly between 5:00 (5) and 18:00 (18)
        if (ch >= 5 && ch < 18) {
            state.time.isNight = false;
            // Map 13 hours of day to a 0 -> PI curve
            state.time.sunAngle = ((ch - 5) / 13) * Math.PI;
        } else {
            state.time.isNight = true;
            // Map 11 hours of night to a PI -> 2PI curve
            const nightHoursPassed = ch >= 18 ? (ch - 18) : (ch + 6);
            state.time.sunAngle = Math.PI + ((nightHoursPassed / 11) * Math.PI);
        }

        state.time.sunHeight = Math.sin(state.time.sunAngle);

        // Clamp intensities so it doesn't go negative during the night
        state.time.directionalLightIntensity = Math.max(0, state.time.sunHeight * 0.8);
        state.time.ambientLightIntensity = Math.max(0.05, state.time.sunHeight * 0.35 + 0.1);
        state.time.skyTransition = Math.max(0, Math.min(1, state.time.sunHeight + 0.3));
    }
}