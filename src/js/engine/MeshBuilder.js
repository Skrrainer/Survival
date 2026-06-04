import * as THREE from 'three';

export class MeshBuilder {
    constructor() {
        this.materials = {
            wood: new THREE.MeshStandardMaterial({ color: '#5c4033' }),
            stone: new THREE.MeshStandardMaterial({ color: '#7f8c8d' }),
            iron: new THREE.MeshStandardMaterial({ color: '#bdc3c7', metalness: 0.8 }),
            leaves: new THREE.MeshStandardMaterial({ color: '#27ae60' }),
            skin: new THREE.MeshStandardMaterial({ color: '#f1c27d' }),
            clothBlue: new THREE.MeshStandardMaterial({ color: '#3498db' }),
            clothDark: new THREE.MeshStandardMaterial({ color: '#2c3e50' }),
            backpack: new THREE.MeshStandardMaterial({ color: '#27ae60' }),
            visor: new THREE.MeshStandardMaterial({ color: '#222' }),
            fire: new THREE.MeshBasicMaterial({ color: '#e74c3c' }),
            chestBase: new THREE.MeshStandardMaterial({ color: '#8b5a2b', roughness: 0.8 }),
            chestLid: new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.8 }),
            gold: new THREE.MeshStandardMaterial({ color: '#f1c40f', metalness: 0.7, roughness: 0.2 })
        };

        this.geometries = {
            treeTrunk: new THREE.CylinderGeometry(0.2, 0.3, 1.5, 8).translate(0, 0.75, 0),
            treeLeaves: new THREE.ConeGeometry(1.0, 2.5, 8).translate(0, 2.6, 0),
            rock: new THREE.DodecahedronGeometry(1.0).translate(0, 1.0, 0),
            water: new THREE.CylinderGeometry(1, 1, 0.1, 16)
        };
    }

    buildBlueberryBush(resource) {
        const group = new THREE.Group();
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.7, 4, 6), new THREE.MeshStandardMaterial({ color: '#4a3728', roughness: 1.0 }));
        stem.position.y = 2;
        stem.castShadow = true;
        group.add(stem);

        const foliageMat = new THREE.MeshStandardMaterial({ color: '#3a6e30', roughness: 0.9, flatShading: true });
        const foliageBareMat = new THREE.MeshStandardMaterial({ color: '#2a4a20', roughness: 0.9, flatShading: true });
        const foliageGeo = new THREE.SphereGeometry(1, 7, 6);

        const foliagePositions = [
            { x:  0,   y: 7,   z:  0,   s: 5.5 },
            { x:  3,   y: 5.5, z:  1,   s: 4.0 },
            { x: -3,   y: 5.5, z: -1,   s: 4.0 },
        ];
        foliagePositions.forEach(fp => {
            const f = new THREE.Mesh(foliageGeo, foliageMat);
            f.position.set(fp.x, fp.y, fp.z);
            f.scale.setScalar(fp.s);
            f.castShadow = true;
            f.receiveShadow = true;
            f.userData.isFoliage = true;
            group.add(f);
        });

        const berryMat = new THREE.MeshStandardMaterial({ color: '#2c3e9e', roughness: 0.4, metalness: 0.1 });
        const berryGeo = new THREE.SphereGeometry(0.9, 6, 5);
        const berryOffsets = [
            new THREE.Vector3( 5.5,  7.0,  2.0),
            new THREE.Vector3(-4.5,  8.0, -3.5),
            new THREE.Vector3( 1.5, 12.5,  1.5),
            new THREE.Vector3(-2.5,  4.5,  4.5),
            new THREE.Vector3( 4.0,  6.0, -4.5),
        ];

        const berryMeshes = [];
        berryOffsets.forEach((offset, i) => {
            const berry = new THREE.Mesh(berryGeo, berryMat);
            berry.position.copy(offset);
            berry.castShadow = false;
            berry.visible = i < resource.berryCount;
            berry.userData.isBerry = true;
            berry.userData.berryIndex = i;
            group.add(berry);
            berryMeshes.push(berry);
        });

        group.userData.resource = resource;
        group.userData.berryMeshes = berryMeshes;
        group.userData.lastBerryCount = resource.berryCount;
        group.userData.foliageMat = foliageMat;
        group.userData.foliageBareMat = foliageBareMat;
        group.userData.offset = 0;
        return group;
    }

    buildBlacksmithMesh() {
        const mesh = new THREE.Group();
        const base = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 4, 4), new THREE.MeshStandardMaterial({ color: '#5c4033' }));
        base.position.y = 2;
        base.rotation.y = Math.PI / 4;
        const anvil = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 3), new THREE.MeshStandardMaterial({ color: '#34495e', metalness: 0.5 }));
        anvil.position.y = 5.5;
        const horn = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3, 4), new THREE.MeshStandardMaterial({ color: '#34495e', metalness: 0.5 }));
        horn.rotation.z = -Math.PI / 2;
        horn.position.set(4.5, 5.5, 0);
        mesh.add(base, anvil, horn);
        mesh.castShadow = true;
        mesh.userData = { offset: 0 };
        return mesh;
    }

    buildSurvivorMesh() {
        const survivorMesh = new THREE.Group();
        const survivorBody = new THREE.Group();
        survivorMesh.add(survivorBody);

        const upperBody = new THREE.Group();
        upperBody.position.y = 10;
        survivorBody.add(upperBody);

        const torso = new THREE.Mesh(new THREE.BoxGeometry(6, 12, 4), this.materials.clothBlue);
        torso.position.y = 4;
        torso.castShadow = true;
        upperBody.add(torso);

        const backpackMesh = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 2.5), this.materials.backpack);
        backpackMesh.position.set(0, 6, -2.5);
        backpackMesh.castShadow = true;
        backpackMesh.visible = false;
        upperBody.add(backpackMesh);

        const visor = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1, 2), this.materials.visor);
        visor.position.set(0, 12.5, 2.5);
        visor.castShadow = true;
        upperBody.add(visor);

        const head = new THREE.Mesh(new THREE.SphereGeometry(3), this.materials.skin);
        head.position.y = 12;
        head.castShadow = true;
        upperBody.add(head);

        const armGeo = new THREE.CylinderGeometry(1, 1, 10).translate(0, -5, 0);
        const leftArm = new THREE.Mesh(armGeo, this.materials.skin);
        leftArm.position.set(-4.5, 9, 0);
        leftArm.castShadow = true;
        upperBody.add(leftArm);

        const rightArm = new THREE.Mesh(armGeo, this.materials.skin);
        rightArm.position.set(4.5, 9, 0);
        rightArm.castShadow = true;
        upperBody.add(rightArm);

        const toolGroup = new THREE.Group();
        toolGroup.position.set(0, -8, 0);
        rightArm.add(toolGroup);

        const axeVisual = new THREE.Group();
        const axeHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 8), this.materials.wood);
        const axeHead = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 0.5), this.materials.stone);
        axeHead.position.set(1.5, 3, 0);
        axeVisual.add(axeHandle, axeHead);
        axeVisual.rotation.x = Math.PI / 2;
        axeVisual.visible = false;
        toolGroup.add(axeVisual);

        const pickaxeVisual = new THREE.Group();
        const pickHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 8), this.materials.wood);
        const pickHead = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1, 0.5), this.materials.stone);
        pickHead.position.set(0, 3, 0);
        pickaxeVisual.add(pickHandle, pickHead);
        pickaxeVisual.rotation.x = Math.PI / 2;
        pickaxeVisual.visible = false;
        toolGroup.add(pickaxeVisual);

        const bowVisual = new THREE.Mesh(new THREE.TorusGeometry(4, 0.3, 8, 20, Math.PI), this.materials.wood);

        // Exact calculated Euler mapping to force vertical bow facing +Z.
        bowVisual.rotation.set(Math.PI / 2, 0, Math.PI / 2);

        bowVisual.visible = false;
        toolGroup.add(bowVisual);

        const legGeo = new THREE.CylinderGeometry(1.2, 1.2, 8).translate(0, -4, 0);
        const leftLeg = new THREE.Mesh(legGeo, this.materials.clothDark);
        leftLeg.position.set(-2, 8, 0);
        leftLeg.castShadow = true;
        survivorBody.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeo, this.materials.clothDark);
        rightLeg.position.set(2, 8, 0);
        rightLeg.castShadow = true;
        survivorBody.add(rightLeg);

        return { mesh: survivorMesh, body: survivorBody, upperBody, leftArm, rightArm, leftLeg, rightLeg, backpackMesh, axeVisual, pickaxeVisual, bowVisual };
    }

    buildChestMesh() {
        const mesh = new THREE.Group();
        const base = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 6), this.materials.chestBase);
        base.position.y = 3;
        const lid = new THREE.Mesh(new THREE.BoxGeometry(8.2, 1.5, 6.2), this.materials.chestLid);
        lid.position.set(0, 6, 0);
        const latch = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2, 0.4), this.materials.gold);
        latch.position.set(0, 4.5, 3.1);
        mesh.add(base, lid, latch);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { offset: 0 };
        return mesh;
    }
}