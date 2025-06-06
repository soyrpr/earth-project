import {WebGLRenderer, Scene, Color, TextureLoader, Mesh, SphereGeometry, MeshBasicMaterial, PerspectiveCamera, MOUSE, AmbientLight, Raycaster, Vector2, LinearSRGBColorSpace, ColorManagement, REVISION, Vector3, Object3D} from 'three';
import {MapControls} from 'three/examples/jsm/controls/MapControls.js';

// Asegurarnos de que el canvas existe
const canvas = document.getElementById('globeCanvas') as HTMLCanvasElement;
if (!canvas) {
    throw new Error('Canvas element not found');
}

// Constantes
const EARTH_RADIUS = 6371000; // Radio de la Tierra en metros
const SPHERE = 0;
const PLANE = 1;

// List of scenes
let scenes: any[] = [];
let active = SPHERE;
let isInitialized = false;

let renderer = new WebGLRenderer({
    canvas: canvas,
    antialias: true,
    powerPreference: 'high-performance',
    alpha: true
});

// Función para cargar la textura de manera asíncrona
function loadEarthTexture(): Promise<any> {
    return new Promise((resolve, reject) => {
        const loader = new TextureLoader();
        loader.setCrossOrigin('anonymous');
        loader.load(
            '../../assets/textures/2k_earth_daymap.jpg',
            (texture) => {
                if(parseInt(REVISION) >= 152) {
                    texture.colorSpace = 'srgb';
                }
                texture.needsUpdate = true;
                resolve(texture);
            },
            (progress) => {
                console.log('Loading texture:', (progress.loaded / progress.total * 100) + '%');
            },
            (error) => {
                console.error('Error loading texture:', error);
                reject(error);
            }
        );
    });
}

// Create scene for spherical earth
async function createWorldScene(): Promise<any> {
    const scene = new Scene();
    scene.background = new Color(0x000000);
    
    const camera = new PerspectiveCamera(60, 1, 0.01, 1e8);
    scene.add(camera);
    
    const controls = new MapControls(camera, canvas);
    controls.minDistance = EARTH_RADIUS + 3e4;
    controls.maxDistance = EARTH_RADIUS * 1e1;
    controls.enablePan = false;
    controls.zoomSpeed = 0.7;
    controls.rotateSpeed = 0.3; 
    controls.mouseButtons = {
        LEFT: MOUSE.ROTATE,
        MIDDLE: MOUSE.DOLLY,
        RIGHT: MOUSE.PAN
    };

    camera.position.set(0, 0, EARTH_RADIUS + 1e7);

    try {
        const texture = await loadEarthTexture();
        const geometry = new SphereGeometry(EARTH_RADIUS, 64, 64);
        const material = new MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 1,
            side: 2 // THREE.DoubleSide
        });
        const sphere = new Mesh(geometry, material);
        sphere.layers.enable(0); // Enable default layer
        scene.add(sphere);
        
        // Añadir luz ambiental
        const ambientLight = new AmbientLight(0xffffff, 1);
        ambientLight.layers.enable(0);
        scene.add(ambientLight);
    } catch (error) {
        console.error('Error loading world texture:', error);
    }

    return {camera: camera, controls: controls, scene: scene};
}

// Create scene for planar map
async function createMapScene(): Promise<any> {
    const camera = new PerspectiveCamera(60, 1, 0.01, 1e12);
    const controls = new MapControls(camera, canvas);
    controls.minDistance = 1.0;
    controls.zoomSpeed = 1.0;

    const scene = new Scene();
    scene.background = new Color(0x444444);
    scene.add(camera);

    try {
        const texture = await loadEarthTexture();
        const geometry = new SphereGeometry(EARTH_RADIUS, 64, 64);
        const material = new MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 1,
            side: 2 // THREE.DoubleSide
        });
        const plane = new Mesh(geometry, material);
        plane.layers.enable(0); // Enable default layer
        plane.rotation.x = -Math.PI / 2;
        plane.scale.set(1, 1, 1); // Asegurar que la escala sea uniforme
        scene.add(plane);
        
        // Añadir luz ambiental
        const ambientLight = new AmbientLight(0xffffff, 1);
        ambientLight.layers.enable(0);
        scene.add(ambientLight);
    } catch (error) {
        console.error('Error loading map texture:', error);
    }

    return {camera: camera, controls: controls, scene: scene};
}

// Inicializar las escenas
async function initializeScenes() {
    if (isInitialized) return;
    
    try {
        // Asegurarse de que el renderer esté limpio
        renderer.clear();
        renderer.setClearColor(0x000000, 1);
        
        scenes = [await createWorldScene(), await createMapScene()];
        
        // Trigger resize directly
        const width = window.innerWidth;
        const height = window.innerHeight;
        renderer.setSize(width, height);
        
        for (let i = 0; i < scenes.length; i++) {
            const s = scenes[i];
            s.camera.aspect = width / height;
            s.camera.updateProjectionMatrix();
        }
        
        isInitialized = true;
        animate();
    } catch (error) {
        console.error('Error initializing scenes:', error);
    }
}

var raycaster = new Raycaster();

window.onresize = function(): void
{
    var width = window.innerWidth;
    var height = window.innerHeight;

    renderer.setSize(width, height);
    
    for (let i = 0; i < scenes.length; i++) 
    {
        const s = scenes[i];
        s.camera.aspect = width / height;
        s.camera.updateProjectionMatrix();
    }
};

function animate(): void
{
    if (!isInitialized) return;
    
    requestAnimationFrame(animate);
    
    const s = scenes[active];
    if (!s) return;

    s.controls.update();
    renderer.render(s.scene, s.camera);

    const toggleDistance = 2e6;

    if (active === SPHERE) {
        // Get distance to the surface of earth
        const distance = s.controls.getDistance() - EARTH_RADIUS;
        if (distance < toggleDistance) {
            // Set raycaster to the camera center.
            const pointer = new Vector2(0.0, 0.0);
            raycaster.setFromCamera(pointer, s.camera);
            
            // Get all meshes in the scene
            const meshes = s.scene.children.filter((child: Object3D) => child instanceof Mesh);
            
            // Raycast from center of the camera to the sphere surface
            const intersects = raycaster.intersectObjects(meshes, false);
            if (intersects.length > 0) {
                const point = intersects[0].point;
                
                const planeScene = scenes[PLANE];
                if (!planeScene) return;

                // Calculate plane coordinates
                const coords = cartesianToSpherical(point);
                
                // Ajustar las coordenadas para la vista plana
                const targetX = coords.x;
                const targetZ = -coords.y;
                
                // Ajustar la posición de la cámara para mantener la perspectiva
                const cameraDistance = distance * 0.5; // Reducir la distancia para la vista plana
                planeScene.camera.position.set(targetX, cameraDistance, targetZ);
                planeScene.controls.target.set(targetX, 0, targetZ);
                
                // Ajustar los límites de la cámara
                planeScene.controls.minPolarAngle = 0;
                planeScene.controls.maxPolarAngle = Math.PI / 2;
                planeScene.controls.minAzimuthAngle = -Math.PI;
                planeScene.controls.maxAzimuthAngle = Math.PI;

                console.log('Switched scene from sphere to plane.', point, coords);

                // Change scene to "plane" earth
                active = PLANE;
            }
        }
    }
    else if (active === PLANE) {
        const distance = s.controls.getDistance();

        s.controls.minPolarAngle = 0;
        s.controls.maxPolarAngle = Math.PI / 2;

        s.controls.minAzimuthAngle = -Math.PI;
        s.controls.maxAzimuthAngle = Math.PI;
        
        const ratio = 0.4;
        if (distance > toggleDistance * ratio) {
            // Transition progres (0 to 1)
            const progress = (toggleDistance - distance) / (toggleDistance * (1 - ratio));

            // Limit polar angle
            s.controls.maxPolarAngle = progress * Math.PI / 2;
            
            // Limit range of azimuth rotation
            s.controls.minAzimuthAngle = progress * -Math.PI;
            s.controls.maxAzimuthAngle = progress * Math.PI;
        }

        if (distance > toggleDistance) {
            // Datum coordinates
            const target = s.controls.target;
            const coords = sphericalToCartesian(target.x, -target.z);

            const sphereScene = scenes[SPHERE];
            if (!sphereScene) return;

            // Set camera position 
            const dir = coords.multiplyScalar(EARTH_RADIUS + distance);
            sphereScene.camera.position.copy(dir);
            
            // Ajustar el target de la cámara esférica
            sphereScene.controls.target.set(0, 0, 0);

            console.log('Switched scene from plane to sphere.', s.controls, coords);

            // Change to spherical earth model
            active = SPHERE;
        }
    }
}

// Función para convertir coordenadas cartesianas a esféricas
function cartesianToSpherical(point: Vector3): {x: number, y: number} {
    const radius = Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z);
    const theta = Math.atan2(point.y, point.x);
    const phi = Math.acos(point.z / radius);
    
    return {
        x: theta * EARTH_RADIUS,
        y: phi * EARTH_RADIUS
    };
}

// Función para convertir coordenadas esféricas a cartesianas
function sphericalToCartesian(theta: number, phi: number): Vector3 {
    const x = Math.cos(theta / EARTH_RADIUS) * Math.sin(phi / EARTH_RADIUS);
    const y = Math.sin(theta / EARTH_RADIUS) * Math.sin(phi / EARTH_RADIUS);
    const z = Math.cos(phi / EARTH_RADIUS);
    
    return new Vector3(x, y, z);
}

// Start initialization
initializeScenes(); 