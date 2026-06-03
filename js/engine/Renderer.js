import * as THREE from 'three';

export class Renderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);

        // Setup WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.dithering = true;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#1e2b1e');

        // Camera Setup
        this.frustumSize = 800;
        this.zoom = 1;
        const aspect = window.innerWidth / window.innerHeight;

        this.camera = new THREE.OrthographicCamera(
            -this.frustumSize * aspect / 2,
            this.frustumSize * aspect / 2,
            this.frustumSize / 2,
            -this.frustumSize / 2,
            1,
            3000
        );

        this.camera.position.set(1000, 1000, 1000);
        this.camera.lookAt(this.scene.position);

        // Resize Event
        window.addEventListener('resize', () => this.updateCamera());

        // Scrollwheel Zoom Event
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSpeed = 0.1;
            // Zoom out if scrolling down, in if scrolling up
            if (e.deltaY > 0) this.zoom = Math.max(0.5, this.zoom - zoomSpeed);
            else this.zoom = Math.min(3, this.zoom + zoomSpeed);
            this.updateCamera();
        }, { passive: false });

        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(this.ambientLight);

        this.dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.dirLight.position.set(200, 400, 300);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.camera.left = -1000;
        this.dirLight.shadow.camera.right = 1000;
        this.dirLight.shadow.camera.top = 1000;
        this.dirLight.shadow.camera.bottom = -1000;
        this.dirLight.shadow.mapSize.width = 2048;
        this.dirLight.shadow.mapSize.height = 2048;
        this.dirLight.shadow.bias = -0.0005;
        this.scene.add(this.dirLight);

        const groundGeo = new THREE.PlaneGeometry(100000, 100000);
        const groundMat = new THREE.MeshStandardMaterial({ color: '#2d4c22' });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        ground.userData = { isGround: true };
        this.scene.add(ground);

        const grassCount = 4000;
        const grassGeo = new THREE.ConeGeometry(1.5, 5, 3);
        const grassMat = new THREE.MeshStandardMaterial({ color: '#448530', flatShading: true });

        this.grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
        this.grassMesh.receiveShadow = true;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < grassCount; i++) {
            const x = (Math.random() - 0.5) * 3000;
            const z = (Math.random() - 0.5) * 3000;

            dummy.position.set(x, 2.5, z);
            dummy.rotation.y = Math.random() * Math.PI;
            dummy.rotation.x = (Math.random() - 0.5) * 0.2;
            dummy.rotation.z = (Math.random() - 0.5) * 0.2;

            const scale = 0.5 + Math.random() * 1.5;
            dummy.scale.set(scale, scale, scale);

            dummy.updateMatrix();
            this.grassMesh.setMatrixAt(i, dummy.matrix);
        }
        this.scene.add(this.grassMesh);

        this.survivorMesh = null;
        this.resourceMeshes = new Map();
    }

    updateCamera() {
        const aspect = window.innerWidth / window.innerHeight;
        const viewSize = this.frustumSize / this.zoom;
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.camera.left = -viewSize * aspect / 2;
        this.camera.right = viewSize * aspect / 2;
        this.camera.top = viewSize / 2;
        this.camera.bottom = -viewSize / 2;
        this.camera.updateProjectionMatrix();
    }

    render(state) {
        let px = 0;
        let pz = 0;
        if (state.survivor) {
            px = state.survivor.x;
            pz = state.survivor.y;
        }

        this.camera.position.set(px + 800, 800, pz + 800);
        this.camera.lookAt(px, 0, pz);

        if (this.grassMesh) {
            this.grassMesh.position.x = Math.floor(px / 2000) * 2000;
            this.grassMesh.position.z = Math.floor(pz / 2000) * 2000;
        }

        // --- DAY / NIGHT CYCLE VISUALS ---
        const sunAngle = state.time.sunAngle;
        this.dirLight.position.x = px + Math.cos(sunAngle) * 1000;
        this.dirLight.position.y = Math.sin(sunAngle) * 1000;
        this.dirLight.position.z = pz + Math.cos(sunAngle) * 500;

        this.dirLight.target.position.set(px, 0, pz);
        this.dirLight.target.updateMatrixWorld();

        this.dirLight.intensity = state.time.directionalLightIntensity;
        this.ambientLight.intensity = state.time.ambientLightIntensity;

        if (!this.skyDay) {
            this.skyDay = new THREE.Color('#1e2b1e');
            this.skyNight = new THREE.Color('#020406');
            this.currentSky = new THREE.Color();
        }

        this.scene.background = this.currentSky.copy(this.skyNight).lerp(this.skyDay, state.time.skyTransition);

        // --- RENDER SURVIVOR ---
        if (state.survivor) {
            if (!this.survivorMesh) {
                this.survivorMesh = new THREE.Group();
                this.scene.add(this.survivorMesh);

                const scale = state.survivor.size;

                const torsoGeo = new THREE.BoxGeometry(0.6 * scale, 1.2 * scale, 0.4 * scale);
                const torsoMat = new THREE.MeshStandardMaterial({ color: state.survivor.color, roughness: 0.3 });
                const torso = new THREE.Mesh(torsoGeo, torsoMat);
                torso.castShadow = true;
                torso.position.y = 0.8 * scale;
                this.survivorMesh.add(torso);

                const headGeo = new THREE.SphereGeometry(0.3 * scale, 32, 32);
                const headMat = new THREE.MeshStandardMaterial({ color: state.survivor.color, roughness: 0.3 });
                const head = new THREE.Mesh(headGeo, headMat);
                head.castShadow = true;
                head.position.y = 1.6 * scale;
                this.survivorMesh.add(head);

                const limbMat = new THREE.MeshStandardMaterial({ color: state.survivor.color, roughness: 0.3 });
                const armGeo = new THREE.CylinderGeometry(0.1 * scale, 0.1 * scale, 1.0 * scale, 12);

                const leftArm = new THREE.Mesh(armGeo, limbMat);
                leftArm.position.set(-0.45 * scale, 0.8 * scale, 0);
                leftArm.rotation.z = -Math.PI / 12;
                leftArm.castShadow = true;
                this.survivorMesh.add(leftArm);

                const rightArm = new THREE.Mesh(armGeo, limbMat);
                rightArm.position.set(0.45 * scale, 0.8 * scale, 0);
                rightArm.rotation.z = Math.PI / 12;
                rightArm.castShadow = true;
                this.survivorMesh.add(rightArm);

                const legGeo = new THREE.CylinderGeometry(0.12 * scale, 0.12 * scale, 0.7 * scale, 12);

                const leftLeg = new THREE.Mesh(legGeo, limbMat);
                leftLeg.position.set(-0.2 * scale, 0.35 * scale, 0);
                leftLeg.castShadow = true;
                this.survivorMesh.add(leftLeg);

                const rightLeg = new THREE.Mesh(legGeo, limbMat);
                rightLeg.position.set(0.2 * scale, 0.35 * scale, 0);
                rightLeg.castShadow = true;
                this.survivorMesh.add(rightLeg);
            }

            this.survivorMesh.position.x = px;
            this.survivorMesh.position.z = pz;

            const pulse = 1 + Math.abs(Math.sin(Date.now() / 300)) * 0.05;
            this.survivorMesh.scale.set(pulse, pulse, pulse);
        }

        // --- RESOURCE GARBAGE COLLECTION ---
        const currentIds = new Set(state.resources.map(r => r.id));
        for (let [id, mesh] of this.resourceMeshes.entries()) {
            if (!currentIds.has(id)) {
                this.scene.remove(mesh);
                this.resourceMeshes.delete(id);
            }
        }

        // --- RENDER NEW RESOURCES ---
        state.resources.forEach((resource) => {
            const key = resource.id;

            if (!this.resourceMeshes.has(key)) {
                let mesh;

                if (resource.type === 'tree') {
                    mesh = new THREE.Group();
                    const trunkGeo = new THREE.CylinderGeometry(resource.size * 0.2, resource.size * 0.3, resource.size * 1.5, 8);
                    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5c4033' });
                    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
                    trunk.position.y = resource.size * 0.75;
                    trunk.castShadow = true;
                    trunk.receiveShadow = true;
                    mesh.add(trunk);

                    const leavesGeo = new THREE.ConeGeometry(resource.size, resource.size * 2.5, 8);
                    const leavesMat = new THREE.MeshStandardMaterial({ color: resource.color });
                    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
                    leaves.position.y = (resource.size * 1.5) + (resource.size * 1.25) - 2;
                    leaves.castShadow = true;
                    leaves.receiveShadow = true;
                    mesh.add(leaves);

                } else if (resource.type === 'rock') {
                    const geo = new THREE.DodecahedronGeometry(resource.size);
                    const mat = new THREE.MeshStandardMaterial({ color: resource.color, flatShading: true });
                    mesh = new THREE.Mesh(geo, mat);
                    mesh.position.y = resource.size;
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;

                } else if (resource.type === 'water') {
                    const geo = new THREE.BoxGeometry(resource.size * 2, 4, resource.size * 1.5);
                    const mat = new THREE.MeshStandardMaterial({ color: resource.color, transparent: true, opacity: 0.7 });
                    mesh = new THREE.Mesh(geo, mat);
                    mesh.position.y = 2;
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;

                } else if (resource.type === 'stick') {
                    const geo = new THREE.CylinderGeometry(0.5, 0.5, 8, 6);
                    const mat = new THREE.MeshStandardMaterial({ color: resource.color });
                    mesh = new THREE.Mesh(geo, mat);
                    mesh.rotation.z = Math.PI / 2;
                    mesh.rotation.y = Math.random() * Math.PI;
                    mesh.position.y = 1;
                    mesh.castShadow = true;

                } else if (resource.type === 'pebble') {
                    const geo = new THREE.DodecahedronGeometry(resource.size);
                    const mat = new THREE.MeshStandardMaterial({ color: resource.color, flatShading: true });
                    mesh = new THREE.Mesh(geo, mat);
                    mesh.position.y = 1.5;
                    mesh.castShadow = true;

                } else if (resource.type === 'crafting_table') {
                    mesh = new THREE.Group();
                    const legsGeo = new THREE.BoxGeometry(8, 8, 8);
                    const legsMat = new THREE.MeshStandardMaterial({ color: '#5c4033' });
                    const legs = new THREE.Mesh(legsGeo, legsMat);
                    legs.position.y = 4;
                    mesh.add(legs);

                    const topGeo = new THREE.BoxGeometry(12, 2, 12);
                    const topMat = new THREE.MeshStandardMaterial({ color: resource.color });
                    const top = new THREE.Mesh(topGeo, topMat);
                    top.position.y = 9;
                    mesh.add(top);
                    mesh.castShadow = true;
                }

                mesh.position.x = resource.x;
                mesh.position.z = resource.y;
                mesh.userData = { resource: resource };

                this.scene.add(mesh);
                this.resourceMeshes.set(key, mesh);
            }
        });

        this.renderer.render(this.scene, this.camera);
    }
}