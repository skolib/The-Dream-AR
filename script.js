// für basic scene
let camera, scene, renderer, xrRefSpace, gl;

// Für Marker
let trackableImages = new Array(4);
let images = [ 
	'enviroment1', //image ID
	'enviroment2', //image ID
	'enviroment3', //image ID
	'enviroment4', //image ID
]; 
let bitmaps = {};

// Für Model
const loader = new THREE.FBXLoader();
let models = new Array(4);
let includedModels = [];
let group;

// für 360° Umgebungs wechsel
const textureLoader = new THREE.TextureLoader();
let sphereTextures = [
    "360grad_bilder/Bild1.jpg",
    "360grad_bilder/Bild2.jpg",
    "360grad_bilder/Bild3.jpg",
    "360grad_bilder/Bild4.jpg"
];
let spheres = [];
let modelProximityStates = [false, false, false, false]; // true = Nutzer ist nahe dran
let minDist = 1.0; 

let poseToArray = (obj) => [obj.x, obj.y, obj.z]; // Helps pose Objects to Marker 

// Setup um Marker, Model und Umgebung vorzubereiten
for(let image in images){
	let imageName = images[image];

	// Ensure the image is loaded and ready for use
	let img  = document.getElementById(imageName);
	createImageBitmap(img).then(x=>{
		bitmaps[imageName] = x;
		trackableImages[image] = {
        	image: x,
        	widthInMeters: 0.1
		};
	});

	// load FBX model
	loader.load( 'fbx/monoblock_CHAIR.fbx', function ( object ) {
		object.scale.x = 0.0004;
    	bject.scale.y = 0.0004;
    	object.scale.z = 0.0004;
    	object.rotation.y = Math.PI;
        group = new THREE.Group();
        group.add(object);

		models[image] = group;
	} );
	
	// Spheren mit 360° als Textur laden
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
            sphere.layers.set(1);
            sphere.visible = false;
			
            spheres[image] = sphere;
        }
    );
	
} 

//   each frame send to socket.
let clock = new THREE.Clock();

// standard webxr scene
function xwwwform(jsonObject){
	return Object.keys(jsonObject).map(key => encodeURIComponent(key) + '=' + encodeURIComponent(jsonObject[key])).join('&');
}

// create scene
scene = new THREE.Scene();

// add light
var ambient = new THREE.AmbientLight( 0x222222 );
scene.add( ambient );
var directionalLight = new THREE.DirectionalLight( 0xdddddd, 1.5 );
directionalLight.position.set( 0.9, 1, 0.6 ).normalize();
scene.add( directionalLight );
var directionalLight2 = new THREE.DirectionalLight( 0xdddddd, 1 );
directionalLight2.position.set( -0.9, -1, -0.4 ).normalize();
scene.add( directionalLight2 );

// add renderer
camera = new THREE.PerspectiveCamera( 80, window.innerWidth / window.innerHeight, 0.1, 20000 );
renderer = new THREE.WebGLRenderer({antialias: true,alpha:true });
renderer.setPixelRatio( window.devicePixelRatio );
camera.aspect = window.innerWidth / window.innerHeight;
renderer.setSize(window.innerWidth, window.innerHeight );
camera.updateProjectionMatrix();
document.body.appendChild( renderer.domElement );	
renderer.xr.enabled = true;

function init() {
	window.addEventListener( 'resize', onWindowResize, false );
}

function getXRSessionInit( mode, options) {
  	if ( options && options.referenceSpaceType ) {
  		renderer.xr.setReferenceSpaceType( options.referenceSpaceType );
  	}
  	var space = (options || {}).referenceSpaceType || 'local-floor';
  	var sessionInit = (options && options.sessionInit) || {};
  
  	// Nothing to do for default features.
  	if ( space == 'viewer' )
  		return sessionInit;
  	if ( space == 'local' && mode.startsWith('immersive' ) )
  		return sessionInit;
  
  	// If the user already specified the space as an optional or required feature, don't do anything.
  	if ( sessionInit.optionalFeatures && sessionInit.optionalFeatures.includes(space) )
  		return sessionInit;
  	if ( sessionInit.requiredFeatures && sessionInit.requiredFeatures.includes(space) )
  		return sessionInit;
  
  	var newInit = Object.assign( {}, sessionInit );
  	newInit.requiredFeatures = [ space ];
  	if ( sessionInit.requiredFeatures ) {
  		newInit.requiredFeatures = newInit.requiredFeatures.concat( sessionInit.requiredFeatures );
  	}
  	return newInit;
   }

function AR(){
	var currentSession = null;
	function onSessionStarted( session ) {
		session.addEventListener( 'end', onSessionEnded );
		renderer.xr.setSession( session );
		gl = renderer.getContext();
		button.style.display = 'none';
		button.textContent = 'EXIT AR';
		currentSession = session;
		session.requestReferenceSpace('local').then((refSpace) => {
          xrRefSpace = refSpace;
          session.requestAnimationFrame(onXRFrame);
        });
	}
	function onSessionEnded( /*event*/ ) {
		currentSession.removeEventListener( 'end', onSessionEnded );
		renderer.xr.setSession( null );
		button.textContent = 'ENTER AR' ;
		currentSession = null;
	}
	if ( currentSession === null ) {
		
        let options = {
            requiredFeatures: ['dom-overlay','image-tracking'],
            trackedImages: trackableImages,
            domOverlay: { root: document.body }
        };
		var sessionInit = getXRSessionInit( 'immersive-ar', {
			mode: 'immersive-ar',
			referenceSpaceType: 'local', // 'local-floor'
			sessionInit: options
		});
		navigator.xr.requestSession( 'immersive-ar', sessionInit ).then( onSessionStarted );
	} else {
		currentSession.end();
	}
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

// Functions to change environment
function enterEnvironment(index){
	// Sphere 
	if (spheres[index]) {
		spheres[index].visible = true;
	}
}

function exitEnvironment(index){
	// Sphere 
	if (spheres[index]) {
		spheres[index].visible = false;
	}
}

function onXRFrame(t, frame) {
   	 const session = frame.session;
    	session.requestAnimationFrame(onXRFrame);
    	const baseLayer = session.renderState.baseLayer;
    	const pose = frame.getViewerPose(xrRefSpace);
	render();

	// Image tracking
	if (pose) {
		for (const view of pose.views) {
            const viewport = baseLayer.getViewport(view);
            gl.viewport(viewport.x, viewport.y,
                        viewport.width, viewport.height);
			const results = frame.getImageTrackingResults();
			for (const result of results) {
			  	const imageIndex = result.index; // The result's index is the image's position in the trackedImages array specified at session creation
			
			  	// Get the pose of the image relative to a reference space.
			 	const pose1 = frame.getPose(result.imageSpace, xrRefSpace);
			 	var model = undefined;
			  	var pos = pose1.transform.position;
			  	var quat = pose1.transform.orientation;

				// Position Cube to dedicated Marker
			   	if( !includedModels.includes(imageIndex) ){
					let posi = poseToArray(pos);
					includedModels.push(imageIndex);
					model = models[imageIndex];
			  		scene.add( model );
			  	}
				else{
					model = models[imageIndex];
			  	}

				// Marker tracking state
			  	const state = result.trackingState;
			  	if (state == "tracked") {
					// Position Cube to dedicated Marker
					let posi = poseToArray(pos);
					let index = includedModels.indexOf(imageIndex);
					model.position.copy( pos.toJSON());
					model.quaternion.copy(quat.toJSON());
			  	}
				else if (state == "emulated") {
			  	}
			}
        	}
    	}

	// Model Proximity to change enviornment
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
init();
function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize( window.innerWidth, window.innerHeight );
}
render();
function render() {
	renderer.render( scene, camera );
}

// AR Button
var button = document.createElement( 'button' );
button.id = 'ArButton';
button.textContent = 'ENTER AR' ;
button.style.cssText+= `position: absolute;top:80%;left:40%;width:20%;height:2rem;`;
    
document.body.appendChild(button);
document.getElementById('ArButton').addEventListener('click',x=>AR());
