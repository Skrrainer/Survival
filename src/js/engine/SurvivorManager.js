import * as THREE from 'three';
import { getElevation } from './TerrainManager.js';

export class SurvivorManager {
    constructor(scene) {
        this.scene = scene;
        this.mesh = null;
    }

    buildMesh(state) {
        this.mesh = new THREE.Group();
        this.scene.add(this.mesh);

        const scale = state.survivor.size;

        this.bodyGroup = new THREE.Group();
        this.mesh.add(this.bodyGroup);

        this.upperBody = new THREE.Group();
        this.upperBody.position.y = 1.0 * scale;
        this.bodyGroup.add(this.upperBody);

        const torso = new THREE.Mesh(
            new THREE.BoxGeometry(0.6 * scale, 1.2 * scale, 0.4 * scale),
            new THREE.MeshStandardMaterial({ color: state.survivor.color, roughness: 0.3 })
        );
        torso.castShadow = true;
        torso.position.y = 0.4 * scale;
        this.upperBody.add(torso);

        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.3 * scale, 32, 32),
            new THREE.MeshStandardMaterial({ color: state.survivor.color, roughness: 0.3 })
        );
        head.castShadow = true;
        head.position.y = 1.2 * scale;
        this.upperBody.add(head);

        const limbMat = new THREE.MeshStandardMaterial({ color: state.survivor.color, roughness: 0.3 });

        const armGeo = new THREE.CylinderGeometry(0.1 * scale, 0.1 * scale, 1.0 * scale, 12);
        armGeo.translate(0, -0.5 * scale, 0);

        this.leftArm = new THREE.Mesh(armGeo, limbMat);
        this.leftArm.position.set(-0.45 * scale, 0.9 * scale, 0);
        this.leftArm.castShadow = true;
        this.upperBody.add(this.leftArm);

        this.rightArm = new THREE.Mesh(armGeo, limbMat);
        this.rightArm.position.set(0.45 * scale, 0.9 * scale, 0);
        this.rightArm.castShadow = true;
        this.upperBody.add(this.rightArm);

        const legGeo = new THREE.CylinderGeometry(0.12 * scale, 0.12 * scale, 0.8 * scale, 12);
        legGeo.translate(0, -0.4 * scale, 0);

        this.leftLeg = new THREE.Mesh(legGeo, limbMat);
        this.leftLeg.position.set(-0.2 * scale, 0.8 * scale, 0);
        this.leftLeg.castShadow = true;
        this.bodyGroup.add(this.leftLeg);

        this.rightLeg = new THREE.Mesh(legGeo, limbMat);
        this.rightLeg.position.set(0.2 * scale, 0.8 * scale, 0);
        this.rightLeg.castShadow = true;
        this.bodyGroup.add(this.rightLeg);
    }

    update(state) {
        if (!state.survivor) return;
        if (!this.mesh) this.buildMesh(state);

        const px = state.survivor.x;
        const pz = state.survivor.y;
        const playerY = getElevation(px, pz);

        this.mesh.position.set(px, playerY, pz);

        if (state.survivor.rotation !== undefined) {
            this.mesh.rotation.y = state.survivor.rotation;
        }

        // Handle Interactions and Animations
        if (state.survivor.isBowing) {
            const bendAngle = Math.PI / 3;
            this.upperBody.rotation.x = bendAngle;
            this.leftArm.rotation.x = -bendAngle;
            this.rightArm.rotation.x = -bendAngle;
        } else if (state.survivor.isChopping) {
            const swing = -Math.PI / 2 + Math.sin(Date.now() * 0.015) * 1.5;
            this.upperBody.rotation.x = -Math.PI / 12;
            this.leftArm.rotation.x = swing;
            this.rightArm.rotation.x = swing;
        } else if (state.survivor.isMining) {
            const swing = -Math.PI / 2 + Math.sin(Date.now() * 0.015) * 1.5;
            this.upperBody.rotation.x = -Math.PI / 8;
            this.leftArm.rotation.x = swing;
            this.rightArm.rotation.x = swing;
        } else {
            this.upperBody.rotation.x *= 0.8;

            if (state.survivor.isMoving) {
                const walkCycle = Math.sin(Date.now() * 0.015) * 0.8;
                this.leftArm.rotation.x = -walkCycle;
                this.rightArm.rotation.x = walkCycle;
                this.leftLeg.rotation.x = walkCycle;
                this.rightLeg.rotation.x = -walkCycle;
            } else {
                this.leftArm.rotation.x *= 0.8;
                this.rightArm.rotation.x *= 0.8;
                this.leftLeg.rotation.x *= 0.8;
                this.rightLeg.rotation.x *= 0.8;
            }
        }

        const pulse = 1 + Math.abs(Math.sin(Date.now() / 300)) * 0.02;
        this.bodyGroup.scale.set(pulse, pulse, pulse);
    }
}