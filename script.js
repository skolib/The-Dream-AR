import * as THREE from 'three';
import { XRButton } from 'three/addons/webxr/XRButton.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

let scene, camera, renderer;
let spheres = [];
let markers = [];
let markerPositions = [];
let sphereTextures = [
    "Bild1.jpg",
    "Bild2.jpg",
    "Bild3.jpg",
    "Bild4.jpg"
];
let maxMarkers = 4;
let controller; // Controller for AR interaction
let hitTestSource = null;
let hitTestSourceRequested = false;


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
    // Sphären mit korrekter Zuordnung der Texturen laden
    for (let i = 0; i < sphereTextures.length; i++) {
        ((index) => {
            textureLoader.load(
                sphereTextures[index],
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
                    spheres[index] = sphere;
                    loaded++;
                }
            );
        })(i);
    }

    // Add controller for AR interaction
    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    // Add fallback for touch interaction
    window.addEventListener('click', onTouch);

    // WebXR ARCore Hit-Test Setup (nur einmal pro Session)
    renderer.xr.addEventListener('sessionstart', async () => {
        const session = renderer.xr.getSession();
        if (session && session.requestReferenceSpace && session.requestHitTestSource) {
            const referenceSpace = await session.requestReferenceSpace('viewer');
            hitTestSource = await session.requestHitTestSource({ space: referenceSpace });
            hitTestSourceRequested = true;
            session.addEventListener('end', () => {
                hitTestSourceRequested = false;
                hitTestSource = null;
            });
        }
    });

    // Start animation
    animate();
}

function onSelect() {
    const xrFrame = renderer.xr.getFrame();
    tryPlaceMarkerWithHitTest(xrFrame);
}

function onTouch(event) {
    if (!renderer.xr.isPresenting) {
        return;
    }
    const xrFrame = renderer.xr.getFrame();
    tryPlaceMarkerWithHitTest(xrFrame);
}

function tryPlaceMarkerWithHitTest(xrFrame) {
    if (!hitTestSource || !xrFrame) return;
    const referenceSpace = renderer.xr.getReferenceSpace();
    const hitTestResults = xrFrame.getHitTestResults(hitTestSource);
    if (hitTestResults.length > 0) {
        const hit = hitTestResults[0];
        const pose = hit.getPose(referenceSpace);
        if (pose) {
            placeMarkerAtPose(pose);
        }
    }
}

function placeMarkerAtPose(pose) {
    // Determine marker index (max 4)
    // Marker-Index immer zyklisch erhöhen
    if (typeof placeMarkerAtPose.currentIndex === 'undefined') {
        placeMarkerAtPose.currentIndex = 0;
    }
    let markerIndex = placeMarkerAtPose.currentIndex;
    placeMarkerAtPose.currentIndex = (placeMarkerAtPose.currentIndex + 1) % maxMarkers;

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

    // Marker auf erkannte Bodenposition setzen
    marker.position.set(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z);
    // Yaw aus Quaternion berechnen (nur horizontale Drehung)
    let q = pose.transform.orientation;
    let yaw = Math.atan2(2.0 * (q.w * q.y + q.x * q.z), 1.0 - 2.0 * (q.y * q.y + q.z * q.z));

    // Save the marker's position
    markerPositions[markerIndex] = {
        x: marker.position.x,
        y: marker.position.y,
        z: marker.position.z,
    };

    // FBX-Stuhl auf die Ground Plane stellen (Bounding Box Unterkante auf y=marker.position.y)
    function placeChairOnGround(fbxObj) {
        // Bounding Box berechnen
        let box = new THREE.Box3().setFromObject(fbxObj);
        let min = new THREE.Vector3();
        box.getMin(min);
        // Offset von Unterkante zu Objektursprung
        let yOffset = min.y;
        // Stuhl so platzieren, dass Unterkante auf marker.position.y liegt
        fbxObj.position.set(marker.position.x, marker.position.y - yOffset, marker.position.z);
        fbxObj.rotation.set(0, yaw, 0);
    }

    if (!marker.fbxObject) {
        addFBXToScene('monoblock_CHAIR.fbx', {
            x: marker.position.x,
            y: marker.position.y,
            z: marker.position.z
        }, function(fbxObj) {
            marker.fbxObject = fbxObj;
            fbxObj.visible = false;
            placeChairOnGround(fbxObj);
        });
    } else {
        placeChairOnGround(marker.fbxObject);
    }
}



function addFBXToScene(url, position = {x:0, y:0, z:0}, onLoaded) {
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
        if (onLoaded) onLoaded(object);
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

        // Hide all spheres and FBX chairs by default
        for (let s of spheres) {
            s.visible = false;
        }
        for (let m of markers) {
            if (m.fbxObject) m.fbxObject.visible = false;
        }

        if (viewerPose && markerPositions.length > 0) {
            const position = viewerPose.transform.position;
            // Zeige nur die Sphere und den Stuhl, die dem Nutzer am nächsten sind
            let minDist = Infinity;
            let minIndex = -1;
            for (let i = 0; i < markerPositions.length && i < maxMarkers; i++) {
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
            // Sphären-Sichtbarkeit korrekt setzen (immer alle sphären prüfen)
            for (let i = 0; i < spheres.length; i++) {
                spheres[i].visible = (i === minIndex && minDist < 1.0);
            }
            // Nur das aktuelle FBX-Objekt sichtbar machen
            for (let i = 0; i < markers.length; i++) {
                if (markers[i] && markers[i].fbxObject) {
                    markers[i].fbxObject.visible = (i === minIndex && minDist < 1.0);
                }
            }
        }
    }
    renderer.render(scene, camera);
}

// Initialize
init();
