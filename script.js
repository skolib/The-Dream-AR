// ---------------------------
// Grundlegende Setup-Variablen
// ---------------------------

// Basiskomponenten für eine WebXR-3D-Szene
let camera, scene, renderer, xrRefSpace, gl;

// Marker-Tracking Setup
let trackableImages = new Array(4); // Platzhalter für 4 trackbare Bilder
let images = [       // Marker Bilder durch ID holen
	'enviroment1', 
	'enviroment2',
	'enviroment3',
	'enviroment4',
]; 
let bitmaps = {}; // Gespeicherte Bitmap-Daten der Markerbilder
let imageBitmapLoadFailed = false; // Fehlerstatus bei Bild-Initialisierung

// 3D-Modell Setup
let loader = new THREE.FBXLoader(); // FBX-Dateien-Loader von Three.js
let models = new Array(4); // Platzhalter für 4 geladene Modelle
let includedModels = []; // Indizes der aktuell in der Szene enthaltenen Modelle
let group; // Modellgruppe für Transformationen

// Umgebungswechsel Setup
const textureLoader = new THREE.TextureLoader(); // Texturloader für Sphären
let sphereTextures = [           // Texturen der Umgebungen
    "spheretexture/Bild1.webp",
    "spheretexture/Bild2.jpg",
    "spheretexture/Bild3.jpg",
    "spheretexture/Bild4.jpg"
];
let spheres = [];  // Enthält alle Sphären mit Umgebungs Textur
let modelProximityStates = [false, false, false, false]; // Nähe-Indikator pro Modell
let minDist = 1.0; // Abstandsschwelle, um Umgebung zu wechseln

// Hilfsfunktion zum Umwandeln von Positionsdaten 
let poseToArray = (obj) => [obj.x, obj.y, obj.z]; 

// ------------------------------------
// Initialisierung von Bildern, Modellen & Umgebungen
// ------------------------------------

for(let image in images){
	let imageName = images[image];

	// Markerbild laden und in Bitmap umwandeln
	let img  = document.getElementById(imageName);
	createImageBitmap(img).then(x=>{
		bitmaps[imageName] = x;
		trackableImages[image] = {
        	image: x,
        	widthInMeters: 0.1  // Physikalische Markerbreit
		};
	}).catch(err => { 										 
		console.error("createImageBitmap failed", err);
    	imageBitmapLoadFailed = true;
	});

	// Modell laden, skalieren und in eine Gruppe einfügen
loader.load('fbx/cloud_test.FBX', function (object) {
	object.scale.set(5.04, 5.04, 5.04);
	object.rotation.y = Math.PI; // Modell drehen
	// Textur laden und auf alle Meshes anwenden
	textureLoader.load('fbx/alpha clouds.jpg', function (texture) {
		object.traverse(function (child) {
			if (child.isMesh) {
				child.material.map = texture;
				child.material.transparent = true;
				child.material.needsUpdate = true;
			}
		});
	});
	group = new THREE.Group();
	group.add(object);
	models[image] = group;  // Modell abspeichern
});
	
	// Umgebungssphäre vorbereiten und in Szene einfügen (unsichtbar)
	textureLoader.load(
        sphereTextures[image],
        function (texture) {
			const geometry = new THREE.SphereGeometry(500, 60, 40);
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide,
            });
            const sphere = new THREE.Mesh(geometry, material);
            sphere.rotation.y = Math.PI;
            scene.add(sphere);
            //sphere.layers.set(1);
            sphere.visible = false;
            spheres[image] = sphere;  // Sphären abspeichern
        }
    );
	
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

// XR Session-Konfiguration vorbereiten
function getXRSessionInit(mode, options) {
  	if (options && options.referenceSpaceType) {
  		renderer.xr.setReferenceSpaceType(options.referenceSpaceType);
  	}
  	var space = (options || {}).referenceSpaceType || 'local-floor';
  	var sessionInit = (options && options.sessionInit) || {};
  
  	// Wenn der Benutzer den Speicherplatz bereits als optionales oder erforderliches Feature angegeben hat, tun Sie nichts
  	if (sessionInit.optionalFeatures && sessionInit.optionalFeatures.includes(space))
  		return sessionInit;
  	//if ( sessionInit.requiredFeatures && sessionInit.requiredFeatures.includes(space) )
  	//	return sessionInit;
  
	// Space als requiredFeature ergänzen
  	var newInit = Object.assign({}, sessionInit);
  	newInit.requiredFeatures = [space];
  	if (sessionInit.requiredFeatures) {
  		newInit.requiredFeatures = newInit.requiredFeatures.concat(sessionInit.requiredFeatures);
  	}
  	return newInit;
   }

// ------------------------------------
// WebXR AR-Modus aktivieren/deaktivieren
// ------------------------------------

function AR(){
	var currentSession = null;
	
	// AR-Session starten
	function onSessionStarted(session) {
		session.addEventListener('end', onSessionEnded);
		renderer.xr.setSession(session);
		gl = renderer.getContext();
		button.style.display = 'none';
		button.textContent = 'EXIT AR';
		currentSession = session;
		session.requestReferenceSpace('local').then((refSpace) => {
        	xrRefSpace = refSpace;
        	session.requestAnimationFrame(onXRFrame);
        });
	}
	
	// AR-Session beenden
	function onSessionEnded( /*event*/ ) {
		currentSession.removeEventListener('end', onSessionEnded);
		renderer.xr.setSession(null);
		button.textContent = 'ENTER AR' ;
		currentSession = null;
	}
	
	// Session initialisieren oder beenden
	if (currentSession === null) {
        let options = {
            requiredFeatures: ['dom-overlay','image-tracking'],
            trackedImages: trackableImages,
            domOverlay: {root: document.body}
        };
		var sessionInit = getXRSessionInit('immersive-ar', {
			mode: 'immersive-ar',
			referenceSpaceType: 'local', // 'local-floor'
			sessionInit: options
		});
		navigator.xr.requestSession('immersive-ar', sessionInit).then(onSessionStarted).catch(err => { 
			console.error("Unsupported feature", err);
    		showErrorMessage("Image-tracking konnte nicht aktiviert werden. Überprüfe, ob du 'webXR incubations' enabled hast auf chrome://flags oder versuche einen anderen Browser.");
		});
	} else {
		currentSession.end();
	}
	
	// UI-Style bei Sessionwechsel anpassen
	renderer.xr.addEventListener('sessionstart',
		function(ev) {
			console.log('sessionstart', ev);
			document.body.style.backgroundColor = 'rgba(0, 0, 0, 0)';
			renderer.domElement.style.display = 'none';
		});
	renderer.xr.addEventListener('sessionend',
		function(ev) {
			console.log('sessionend', ev);
			document.body.style.backgroundColor = '';
			renderer.domElement.style.display = '';
		});
}

// ------------------------------------
// Umgebung aktivieren/deaktivieren je nach Modellnähe
// ------------------------------------

function enterEnvironment(index){ 
	if (spheres[index]) {
		spheres[index].visible = true;
	}
	
	// Nur das Modell mit dem übergebenen Index anzeigen 
	for (let i = 0; i < models.length; i++) {
        if (models[i]) {
            models[i].visible = (i === index); 
        }
    }
}

function exitEnvironment(index){
	if (spheres[index]) {
		spheres[index].visible = false;
	}
	
	// Alle Modelle wieder anzeigen
	for (let i = 0; i < models.length; i++) {
        if (models[i]) {
            models[i].visible = true;
        }
    }
}

// ------------------------------------
// Frame für Tracking & Umgebungserkennung
// ------------------------------------

function onXRFrame(t, frame) {
   	 const session = frame.session;
    	session.requestAnimationFrame(onXRFrame);
    	const baseLayer = session.renderState.baseLayer;
    	const pose = frame.getViewerPose(xrRefSpace);
	render();

	if (pose) {
		for (const view of pose.views) {
            const viewport = baseLayer.getViewport(view);
            gl.viewport(viewport.x, viewport.y,
                        viewport.width, viewport.height);
			const results = frame.getImageTrackingResults();
			for (const result of results) {
			  	const imageIndex = result.index; // Der Index ist die Position des Bildes im trackedImages-Array, die bei der Sitzungserstellung angegeben wird
			
			  	// Erhalte die Pose des Bildes relativ zu einem Referenzraum.
			 	const pose1 = frame.getPose(result.imageSpace, xrRefSpace);
			 	var model = undefined;
			  	var pos = pose1.transform.position;
			  	var quat = pose1.transform.orientation;

				// Positionier Modell mit dem selben Index auf dem Marker
			   	if( !includedModels.includes(imageIndex) ){
					let posi = poseToArray(pos);
					includedModels.push(imageIndex);
					model = models[imageIndex];
			  		scene.add(model);
			  	}
				else{
					model = models[imageIndex];
			  	}

				// Marker tracking state
			  	const state = result.trackingState;
			  	if (state == "tracked") {
					let posi = poseToArray(pos);
					let index = includedModels.indexOf(imageIndex);
					model.position.copy( pos.toJSON());
					model.quaternion.copy(quat.toJSON());
			  	}
				else if (state == "emulated") {}
			}
       	}
    }

	// Nähe zur Kamera überprüfen und Umgebung wechseln
	let xrCamera = renderer.xr.getCamera(camera);
	let cameraPos = new THREE.Vector3().setFromMatrixPosition(xrCamera.matrixWorld);
	for (let i = 0; i < includedModels.length; i++) {
		let modelIndex = includedModels[i];
		let model = models[modelIndex];

		if (model) {
			let modelPos = new THREE.Vector3().copy(model.position);
			let distance = modelPos.distanceTo(cameraPos);

			let isClose = distance < minDist;
			
			if (isClose && !modelProximityStates[modelIndex]) {
				modelProximityStates[modelIndex] = true;
				enterEnvironment(modelIndex);
			}
			else if (!isClose && modelProximityStates[modelIndex]) {
				modelProximityStates[modelIndex] = false;
				exitEnvironment(modelIndex);
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
