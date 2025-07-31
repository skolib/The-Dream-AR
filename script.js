// Model of Portal is by: "Magic Portal" (https://skfb.ly/opoAZ) by Nick Broad is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).

window.addEventListener('DOMContentLoaded', () => {

// ---------------------------
// Grundlegende Setup-Variablen
// ---------------------------

// Basiskomponenten für eine AR-3D-Szene
let camera, scene, renderer;
let arSource, arContext, markerRoot;



// 3D-Modell Setup
let loader = new THREE.GLTFLoader(); // GLTFLoader statt FBXLoader
let models = new Array(4); // Platzhalter für 4 geladene Modelle
let loadedModel = null; // das Modell wird einmal geladen und später geklont
let includedModels = []; // Indizes der aktuell in der Szene enthaltenen Modelle

// Umgebungswechsel Setup
const textureLoader = new THREE.TextureLoader(); // Texturloader für Sphären
let sphereTextures = [           // Texturen der Umgebungen
	"spheretexture/Bild1.webp",
	"spheretexture/Bild2.webp",
	"spheretexture/Bild3.webp",
	"spheretexture/Bild4.webp"
];
let spheres = [];  // Enthält alle Sphären mit Umgebungs Textur
let modelProximityStates = [false, false, false, false]; // Nähe-Indikator pro Modell
let minDist = 1.0; // Abstandsschwelle, um Umgebung zu wechseln

// Hilfsfunktion zum Umwandeln von Positionsdaten 
let poseToArray = (obj) => [obj.x, obj.y, obj.z]; 

// ------------------------------------
// Initialisierung von Bildern, Modellen & Umgebungen
// ------------------------------------
init();
animate();

function init() {
// Setup Szene & Kamera
scene = new THREE.Scene();
camera = new THREE.Camera();
scene.add(camera);

// Renderer
renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// ARToolkit Source: Webcam
arSource = new THREEx.ArToolkitSource({ sourceType: 'webcam' });
arSource.init(() => onResize());
window.addEventListener('resize', onResize);

// ARToolkit Context
arContext = new THREEx.ArToolkitContext({
	cameraParametersUrl: 'https://cdn.jsdelivr.net/npm/ar.js@3.4.2/data/camera_para.dat',
	detectionMode: 'mono'
});
arContext.init(() => camera.projectionMatrix.copy(arContext.getProjectionMatrix()));

// Marker-Root für Portal
markerRoot = new THREE.Group();
scene.add(markerRoot);

// NFT-Marker Controls
new THREEx.ArMarkerControls(arContext, markerRoot, {
	type: 'nft',
	descriptorsUrl: 'marker/iset',
	changeMatrixMode: 'modelViewMatrix',
	smooth: true,
	smoothCount: 5,
	smoothTolerance: 0.01,
	smoothThreshold: 5
});

// Lade dein GLTF‑Portal und füge es dem MarkerRoot hinzu
loader.load('gltf/scene.gltf', gltf => {
	let portal = gltf.scene;
	portal.scale.set(0.15, 0.15, 0.15);
	portal.rotation.set(-Math.PI/2, Math.PI, 0);
	portal.position.set(0, 0, 0);
	markerRoot.add(portal);
});

// Verbleibende Umgebungs-Sphären initialisieren (wie gehabt)
sphereTextures.forEach((texPath, i) => {
	textureLoader.load(texPath, texture => {
	texture.wrapS = THREE.RepeatWrapping;
	texture.repeat.x = -1;
	const geo = new THREE.SphereGeometry(500, 60, 40);
	const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
	const sph = new THREE.Mesh(geo, mat);
	sph.rotation.y = Math.PI;
	sph.visible = false;
	scene.add(sph);
	spheres[i] = sph;
	});
});
}



// ---------------------------
// Standard XR & Scene Setup
// ---------------------------

let clock = new THREE.Clock(); // Zeitsteuerung für Animationen

// Formatiert JSON-Objekte für POST-Requests
function xwwwform(jsonObject){
	return Object.keys(jsonObject).map(key => encodeURIComponent(key) + '=' + encodeURIComponent(jsonObject[key])).join('&');
}

// Szene initialisieren
scene = new THREE.Scene();

// Lichtquellen hinzufügen
var ambient = new THREE.AmbientLight(0x222222);
scene.add(ambient);
var directionalLight = new THREE.DirectionalLight(0xdddddd, 1.5);
directionalLight.position.set(0.9, 1, 0.6).normalize();
scene.add(directionalLight);
var directionalLight2 = new THREE.DirectionalLight(0xdddddd, 1);
directionalLight2.position.set(-0.9, -1, -0.4).normalize();
scene.add(directionalLight2);

// Renderer initialisieren
camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 20000);
renderer = new THREE.WebGLRenderer({antialias: true, alpha:true});
renderer.setPixelRatio(window.devicePixelRatio);
camera.aspect = window.innerWidth / window.innerHeight;
renderer.setSize(window.innerWidth, window.innerHeight);
camera.updateProjectionMatrix();
document.body.appendChild(renderer.domElement);	
renderer.xr.enabled = true;

function init() {
	window.addEventListener('resize', onWindowResize, false);
}

function onResize() {
    arSource.onResize();
    arSource.copySizeTo(renderer.domElement);
    if (arContext.arController) {
      arSource.copySizeTo(arContext.arController.canvas);
    }
  }

function animate() {
	requestAnimationFrame(animate);

		if (arSource && arSource.ready !== false) {
			arContext.update(arSource.domElement);
		}
	render();

// ------------------------------------
// Umgebung aktivieren/deaktivieren je nach Modellnähe
// ------------------------------------
	function transitionToEnvironment(index, isEntering) {
		const overlay = document.getElementById('fadeOverlay');

		// Schritt 1: Schwarz einblenden
		overlay.style.opacity = 1;

		setTimeout(() => {
			// Schritt 2: Szene umschalten
			if (isEntering) {
			enterEnvironment(index);
			} else {
				exitEnvironment(index);
			}
			// Schritt 3: Schwarz wieder ausblenden
			setTimeout(() => {
				overlay.style.opacity = 0;
			}, 300); // leicht verzögert, damit 360-Scene geladen ist
		}, 600); // Wartezeit für den "zu schwarz"-Effekt
	}

	function enterEnvironment(index){ 

		// Neue Funktionalität:
		if (spheres[index]) {
			spheres[index].visible = true;
		}
		// Alle Portale ausblenden
		for (let i = 0; i < models.length; i++) {
			if (models[i].visible) {
				models[i].visible = false;
			}
		}
	}

	function exitEnvironment(index){

		// Neue Funktionalität:
		if (spheres[index]) {
			spheres[index].visible = false;
		}
		// Nur die getrackten Modelle wieder anzeigen
		for (let i = 0; i < includedModels.length; i++) {
			let modelIndex = includedModels[i];
			if (models[modelIndex]) {
				models[modelIndex].visible = true;
			}
		}
	}
}
// ---------------------------
// Fenstergröße anpassen
// ---------------------------

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
}

// Szene rendern
function render() {
	renderer.render(scene, camera);
}

// ---------------------------
// AR-Button initialisieren
// ---------------------------

const button = document.createElement('button');
button.id = 'ArButton';
button.textContent = 'ENTER AR' ;
button.style.cssText+= `position: absolute;top:80%;left:40%;width:20%;height:2rem;`;
	
document.body.appendChild(button);
document.getElementById('ArButton').addEventListener('click',x=> {
	if (imageBitmapLoadFailed) {
		showErrorMessage("UPS! Beim Laden ist etwas falsch gelaufen. Überprüfe, ob du 'webXR incubations' enabled hast auf chrome://flags und Lade die Seite neu.");
		return;
	}
	 AR();
});


// ---------------------------
// Fehleranzeige bei Problemen
// ---------------------------

function showErrorMessage(msg) {
	let errorDiv = document.getElementById('errorMsg');
	if (!errorDiv) {
		errorDiv = document.createElement('div');
		errorDiv.id = 'errorMsg';
		errorDiv.style.cssText = `
			position: absolute;
			top: 20%;
			left: 30%;
			width: 40%;
			background: rgba(206, 43, 43, 0.55);
			color: white;
			text-align: center;
			padding: 1rem;
			border-radius: 1rem;
			font-weight: bold;
			font-size: 1.2rem;
			z-index: 9999;
		`;
		document.body.appendChild(errorDiv);
	}
	errorDiv.textContent = msg;
}

// ---------------------------
// Initialisierung starten
// ---------------------------

init();
render();
});