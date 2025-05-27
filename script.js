import * as THREE from 'https://threejs.org/build/three.module.js';
import { XRButton } from "https://threejs.org/examples/jsm/webxr/XRButton.js";
import { FBXLoader } from 'https://threejs.org/examples/jsm/loaders/FBXLoader.js';

let scene, camera, renderer, sphere, marker;
let markerPosition = null; // Position of the marker
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

    // Load 360-degree image as texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
        "https://cdn.glitch.global/86a46bb0-a4d7-4cd0-a288-f2a6f516ee40/360_beach_panorama.jpg?v=1747147255201",
        function (texture) {
            const geometry = new THREE.SphereGeometry(500, 60, 40);
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide,
            });
            sphere = new THREE.Mesh(geometry, material);
            sphere.rotation.y = Math.PI; // Flip the image
            scene.add(sphere);
            sphere.layers.set(1);
            sphere.visible = false; // Sphere is initially hidden

            // FBX-Stuhl auf dem Boden platzieren (z.B. bei x=0, y=0, z=-2)
            addFBXToScene('monoblock_CHAIR.fbx', {x: 0, y: 0, z: 0});
        }
    );

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
    // Create cone geometry for the marker
    const geometry = new THREE.CylinderGeometry(0, 0.05, 0.2, 32).rotateX(Math.PI / 2);
    const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 }); // Green color
    marker = new THREE.Mesh(geometry, material);

    // Position the marker at the controller's position or fallback to camera position
    if (controller) {
        marker.position.set(0, 0, -0.3).applyMatrix4(controller.matrixWorld);
        marker.quaternion.setFromRotationMatrix(controller.matrixWorld);
    } else {
        // Fallback for touch: place marker in front of the camera
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        marker.position.copy(camera.position).add(cameraDirection.multiplyScalar(1.5)); // 1.5 meters in front
    }

    // Add the marker to the scene
    scene.add(marker);

    // Save the marker's position
    markerPosition = {
        x: marker.position.x,
        y: marker.position.y,
        z: marker.position.z,
    };
}



function addFBXToScene(url, position = {x:0, y:0, z:0}) {
    const loader = new FBXLoader();
    loader.load(url, function(object) {
        object.position.set(position.x, position.y, position.z);
        scene.add(object);
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

        if (viewerPose && markerPosition) {
            const position = viewerPose.transform.position;

            // Calculate the distance from the marker
            const distance = Math.sqrt(
                Math.pow(position.x - markerPosition.x, 2) +
                Math.pow(position.y - markerPosition.y, 2) +
                Math.pow(position.z - markerPosition.z, 2)
            );

            // Toggle sphere visibility based on distance
            if (sphere) {
                sphere.visible = distance < 1.0; // Sphere is visible if closer than 1.0 meters
            }
        }
    }

    renderer.render(scene, camera);
}

// Initialize
init();