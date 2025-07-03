import * as THREE from 'three';
import { XRButton } from 'three/addons/webxr/XRButton.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

let scene, camera, renderer;
let spheres = [];
let markers = [];
let markerPositions = [];
let sphereTextures = [
    "https://cdn.glitch.global/86a46bb0-a4d7-4cd0-a288-f2a6f516ee40/360_beach_panorama.jpg?v=1747147255201",
    "https://wallpapercave.com/wp/wp10981056.jpg",
    "https://wallpapercave.com/wp/wp10981049.jpg",
    "https://wallpapercave.com/wp/wp10981057.jpg"
];
let maxMarkers = 4;
let controller; // Controller for AR interaction


function init() {
    // Create scene
    scene = new THREE.Scene();

    // Create camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.layers.enable(1);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Add XRButton
    document.body.appendChild(XRButton.createButton(renderer));

    // Load all sphere textures
    const textureLoader = new THREE.TextureLoader();
    let loaded = 0;
    for (let i = 0; i < sphereTextures.length; i++) {
        textureLoader.load(
            sphereTextures[i],
            function (texture) {
                const geometry = new THREE.SphereGeometry(500, 60, 40);
                const material = new THREE.MeshBasicMaterial({
                    map: texture,
                    side: THREE.DoubleSide,
                });
                const sphere = new THREE.Mesh(geometry, material);
                sphere.rotation.y = Math.PI;
                scene.add(sphere);
                sphere.layers.set(1);
                sphere.visible = false;
                spheres.push(sphere);
                loaded++;
                if (loaded === sphereTextures.length) {
                    // FBX-Stuhl auf dem Boden platzieren (z.B. bei x=0, y=0, z=-2)
                    addFBXToScene('monoblock_CHAIR.fbx', {x: 0, y: 0, z: -2});
                }
            }
        );
    }

    // Add controller for AR interaction
    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    // Add fallback for touch interaction
    window.addEventListener('click', onTouch);

    // Start animation
    animate();
}

function onSelect() {
    placeMarker();
}

function onTouch(event) {
    // Ensure AR session is active
    if (!renderer.xr.isPresenting) {
        return;
    }

    placeMarker();
}

function placeMarker() {
    // Determine marker index (max 4)
    let markerIndex = markers.length;
    if (markerIndex >= maxMarkers) {
        // Move the first marker instead of creating a new one
        markerIndex = 0;
    }

    let marker;
    if (markers[markerIndex]) {
        marker = markers[markerIndex];
    } else {
        // Create cone geometry for the marker
        const geometry = new THREE.CylinderGeometry(0, 0.05, 0.2, 32).rotateX(Math.PI / 2);
        const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 }); // Green color
        marker = new THREE.Mesh(geometry, material);
        scene.add(marker);
        markers.push(marker);
        markerPositions.push({x:0, y:0, z:0});
    }

    // Position the marker at the controller's position or fallback to camera position
    if (controller) {
        marker.position.set(0, 0, -0.3).applyMatrix4(controller.matrixWorld);
        marker.quaternion.setFromRotationMatrix(controller.matrixWorld);
    } else {
        // Fallback for touch: place marker in front of the camera
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        marker.position.copy(camera.position).add(cameraDirection.multiplyScalar(1.5));
    }

    // Save the marker's position
    markerPositions[markerIndex] = {
        x: marker.position.x,
        y: marker.position.y,
        z: marker.position.z,
    };

    // FBX-Stuhl unter den Marker setzen
    addFBXToScene('monoblock_CHAIR.fbx', {
        x: marker.position.x,
        y: marker.position.y - 0.1, // etwas unterhalb des Markers
        z: marker.position.z
    });
}



function addFBXToScene(url, position = {x:0, y:0, z:0}) {
    const loader = new FBXLoader();
    loader.load(url, function(object) {
        // FBX Modelle können verschachtelt sein, daher BoundingBox bestimmen
        let box = new THREE.Box3().setFromObject(object);
        let size = new THREE.Vector3();
        box.getSize(size);
        let maxDim = Math.max(size.x, size.y, size.z);
        let scale = 1.0;
        if (maxDim > 0) {
            scale = 0.3 / maxDim; // Zielgröße: ca. 0.3m
        }
        object.scale.set(scale, scale, scale);
        object.position.set(position.x, position.y, position.z);
        object.traverse(function(child) {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.material.side = THREE.DoubleSide;
            }
        });
        scene.add(object);
        // Debug: BoundingBox anzeigen
        // const helper = new THREE.Box3Helper(new THREE.Box3().setFromObject(object), 0xff0000);
        // scene.add(helper);
        console.log('FBX geladen und skaliert:', size, 'Skalierung:', scale);
    }, undefined, function(error) {
        console.error('FBX load error:', error);
    });
}



function animate() {
    renderer.setAnimationLoop(render);
}

function render(timestamp, xrFrame) {
    if (xrFrame) {
        const session = xrFrame.session;
        const referenceSpace = renderer.xr.getReferenceSpace();
        const viewerPose = xrFrame.getViewerPose(referenceSpace);

        // Hide all spheres by default
        for (let s of spheres) {
            s.visible = false;
        }

        if (viewerPose && markerPositions.length > 0) {
            const position = viewerPose.transform.position;
            // Zeige nur die Sphere, die dem Nutzer am nächsten ist (statt alle, die <1m entfernt sind)
            let minDist = Infinity;
            let minIndex = -1;
            for (let i = 0; i < markerPositions.length && i < spheres.length; i++) {
                const markerPos = markerPositions[i];
                if (!markerPos) continue;
                const distance = Math.sqrt(
                    Math.pow(position.x - markerPos.x, 2) +
                    Math.pow(position.y - markerPos.y, 2) +
                    Math.pow(position.z - markerPos.z, 2)
                );
                if (distance < minDist) {
                    minDist = distance;
                    minIndex = i;
                }
            }
            if (minIndex !== -1 && minDist < 1.0) {
                spheres[minIndex].visible = true;
            }
        }
    }
    renderer.render(scene, camera);
}

// Initialize
init();
