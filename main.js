import { parseOBJ } from "./helpers/parser.js";


main();

const mat4 = glMatrix.mat4;
const vec3 = glMatrix.vec3;

const treePositions = [
            [0, 12],
            [4, 14],
            [-6, 16],
        ];





function main() {
	const canvas = document.querySelector("#gl-canvas");
	const gl = canvas.getContext("webgl2");
	if (!gl) {
		alert("No webgl for you!");
		return;
	}

	function resizeCanvas() {
		canvas.width = canvas.clientWidth;
		canvas.height = canvas.clientHeight;
		gl.viewport(0, 0, canvas.width, canvas.height);
	}

	resizeCanvas();
	window.addEventListener("resize", resizeCanvas);

	Promise.all([
		fetch("shaders/grass.vert").then(r => r.text()),
		fetch("shaders/grass.frag").then(r => r.text()),
		fetch("shaders/sun.vert").then(r => r.text()),
		fetch("shaders/sun.frag").then(r => r.text()),
		fetch("shaders/tree.vert").then(r => r.text()),
		fetch("shaders/tree.frag").then(r => r.text()),
		fetch("models/tree.obj").then(r => r.text())
	])
		.then(([grassVert, grassFrag, sunVert, sunFrag, treeVert,treeFrag, treeObj]) => {
			initializeScene(gl, grassVert, grassFrag, sunVert, sunFrag, treeVert, treeFrag,treeObj);
		})
		.catch(err => console.error("Failed to load shaders:", err));
}

function initializeScene(gl, grassVert, grassFrag, sunVert, sunFrag, treeVert,treeFrag,treeObjText) {



	// --- TREES -----
	const treeProgram = gl.createProgram();

	const treeVertShader = compileShader(gl,treeVert, gl.VERTEX_SHADER);
	const treeFragShader = compileShader(gl,treeFrag, gl.FRAGMENT_SHADER);

	gl.attachShader(treeProgram, treeVertShader);
	gl.attachShader(treeProgram,treeFragShader);
	gl.linkProgram(treeProgram);

	if(!gl.getProgramParameter(treeProgram, gl.LINK_STATUS)){
		console.log(gl.getShaderInfoLog(treeVertShader))
		console.log(gl.getShaderInfoLog(treeFragShader))
	}
	gl.useProgram(treeProgram);


	const treeData = parseOBJ(treeObjText);

    const treeVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, treeVBO);
    gl.bufferData(gl.ARRAY_BUFFER, treeData.positions, gl.STATIC_DRAW);

    const treeUVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, treeUVBO);
    gl.bufferData(gl.ARRAY_BUFFER, treeData.texCoords, gl.STATIC_DRAW);

    const treeNBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, treeNBO);
    gl.bufferData(gl.ARRAY_BUFFER, treeData.normals, gl.STATIC_DRAW);

    //// Hämta locations (om du inte redan gjort det)
    const uTreeModelLoc = gl.getUniformLocation(treeProgram, "uModel");
    const uTreeViewLoc  = gl.getUniformLocation(treeProgram, "uView");
    const uTreeProjLoc  = gl.getUniformLocation(treeProgram, "uProj");
    



	// ---- FLOOR -------
	const floorProgram = gl.createProgram();
	
	const grassVertShader = compileShader(gl, grassVert, gl.VERTEX_SHADER);
	const grassFragShader = compileShader(gl, grassFrag, gl.FRAGMENT_SHADER);

	gl.attachShader(floorProgram, grassVertShader);
	gl.attachShader(floorProgram, grassFragShader);
	gl.linkProgram(floorProgram);

	if(!gl.getProgramParameter(floorProgram, gl.LINK_STATUS)){
		console.log(gl.getShaderInfoLog(grassVertShader))
		console.log(gl.getShaderInoLog(grassFragShader))
	}

	const uLightDirLoc     = gl.getUniformLocation(floorProgram, "uLightDir");
	const uLightColorLoc   = gl.getUniformLocation(floorProgram, "uLightColor");
	const uAmbientColorLoc = gl.getUniformLocation(floorProgram, "uAmbientColor");

	const uModelLoc 	= gl.getUniformLocation(floorProgram, "uModel");
	const uViewLoc 		= gl.getUniformLocation(floorProgram, "uView");
	const uProjLoc 		= gl.getUniformLocation(floorProgram, "uProj");
	const uGrassLoc 	= gl.getUniformLocation(floorProgram, "uGrass");

	const uSeedLoc 		= gl.getUniformLocation(floorProgram, "uSeed");

	gl.useProgram(floorProgram);

	const seed = Math.random() * 100.0;
	gl.uniform1f(uSeedLoc, seed);

	const sunDir = vec3.fromValues(0.3, 0.3, 1.0);
	vec3.normalize(sunDir, sunDir);

	gl.uniform3fv(uLightDirLoc, sunDir);

	// warm-ish sunlight, soft ambient
	gl.uniform3f(uLightColorLoc,   1.0, 0.95, 0.85);  // sunlight
	gl.uniform3f(uAmbientColorLoc, 0.25, 0.35, 0.45); // sky/ambient



	// ---- SUN -------
	const sunProgram = gl.createProgram();

	const sunVertShader = compileShader(gl, sunVert, gl.VERTEX_SHADER);
	const sunFragShader = compileShader(gl, sunFrag, gl.FRAGMENT_SHADER);

	gl.attachShader(sunProgram, sunVertShader);
	gl.attachShader(sunProgram, sunFragShader);
	gl.linkProgram(sunProgram);

	if(!gl.getProgramParameter(sunProgram, gl.LINK_STATUS)){
		console.log(gl.getShaderInfoLog(sunVertShader))
		console.log(gl.getShaderInoLog(sunFragShader))
	}

	const uSunModelLoc = gl.getUniformLocation(sunProgram, "uModel");
	const uSunViewLoc  = gl.getUniformLocation(sunProgram, "uView");
	const uSunProjLoc  = gl.getUniformLocation(sunProgram, "uProj");
	const uSunColorLoc = gl.getUniformLocation(sunProgram, "uSunColor");

	const sunModelMatrix = mat4.create();
	const sunDistance = 80.0;

	const sunPos = vec3.create();
	vec3.scale(sunPos, sunDir, sunDistance);

	mat4.translate(sunModelMatrix, sunModelMatrix, sunPos);
	// make it visible in the sky
	mat4.scale(sunModelMatrix, sunModelMatrix, [15.0, 15.0, 15.0]);

	// --- Matrices ---
	const viewMatrix = mat4.create();
	const modelMatrix = mat4.create();
	const projMatrix = mat4.create();
	
	// ---- perspective and camera setup ----
	const cameraPos = vec3.fromValues(0, -30, 15); // starting position
	let yaw   = Math.PI / 2;  // looking roughly along +X
	let pitch = -0.2;
	let gravityEnabled = true;
	let verticalVelocity = 0;     // z-velocity
	const gravity = -0.08;        // tweak as you like

	// rebuild viewMatrix from cameraPos, yaw, pitch
	function updateViewMatrix() {
		const forward = vec3.fromValues(
			Math.cos(yaw) * Math.cos(pitch),
			Math.sin(yaw) * Math.cos(pitch),
			Math.sin(pitch)
		);
		const target = vec3.create();
		vec3.add(target, cameraPos, forward);

		mat4.lookAt(viewMatrix, cameraPos, target, [0, 0, 1]); // Z-up
	}

	// call once to initialize
	updateViewMatrix();

	function applyGroundCollision() {
		const ground = getHeightAt(cameraPos[0], cameraPos[1]);
		const eyeHeight = 2.0; // how high above ground the "head" should be
		const minZ = ground + eyeHeight;

		if (cameraPos[2] < minZ) {
			cameraPos[2] = minZ;
			verticalVelocity = 0; // reset 
		}
	}
	function applyTreeCollision(){
		// using pythagoras 
		for (const [treeX, treeY] of treePositions){
			const treeRadius = 1.5; // adjust as needed
			const catX = cameraPos[0] - treeX;
			const catY = cameraPos[1] - treeY;
			const treeDist = Math.sqrt(catX*catX + catY*catY);

			if (treeDist < treeRadius){
				const overlap = treeRadius - treeDist;
				const pushX = (catX / treeDist) * overlap;
				const pushY = (catY / treeDist) * overlap;
				cameraPos[0] += pushX;
				cameraPos[1] += pushY;
			}
		}
	}
	
	const out = projMatrix;
	const fovy = Math.PI / 4; // 45 degrees
	const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
	const near = 0.1;
	const far = 100.0;

	mat4.perspective(out, fovy, aspect, near, far);

	function hash2D(x, y) {
		// same as GLSL hash(vec2) using dot + sin + fract
		const p1 = x * 127.1 + y * 311.7;
		const p2 = x * 269.5 + y * 183.3;
		const v  = p1 + p2 + seed;

		const s = Math.sin(v) * 43758.5453123;
		return s - Math.floor(s); // fract
	}

	function getHeightAt(x, y) {
		// must match grass.vert:getHeight
		const wave =
			0.5 * Math.sin(x * 0.18) *
			Math.cos(y * 0.18);

		const nx = x * 0.12;
		const ny = y * 0.12;
		const n = hash2D(nx, ny);
		const noise = (n - 0.5) * 0.25;

		const height = (wave + noise) * 2.0; // same factor as in your vertex shader
		return height;
	}
 
	const keys = {};

	window.addEventListener("keydown", (e) => {
		const key = e.key;
		keys[key.toLowerCase()] = true;   // w, a, s, d etc
		if (key === "f") {
			gravityEnabled = !gravityEnabled;
			if (!gravityEnabled) {
				verticalVelocity = 0; // optional, stops falling instantly
			}
			console.log("Gravity:", gravityEnabled ? "ON" : "OFF");
		}
	});

	window.addEventListener("keyup", (e) => {
		const key = e.key;
		keys[key.toLowerCase()] = false;  // w, a, s, d etc
	});

	const canvas = gl.canvas; 
	let isDragging = false;
	let lastMouseX = 0;
	let lastMouseY = 0;
	const mouseSensitivity = 0.003; // radians per pixel-ish

	window.addEventListener("mousedown", (e) => {
		if (e.button === 0) {
			isDragging = true;
			canvas.classList.add("dragging");
			lastMouseX = e.clientX;
			lastMouseY = e.clientY;
		}
	});

	window.addEventListener("mouseup", (e) => {
		if (e.button === 0) {
			isDragging = false;
			canvas.classList.remove("dragging");
		}
	});

	window.addEventListener("mouseleave", () => {
		isDragging = false;
	});

	window.addEventListener("mousemove", (e) => {
		if (!isDragging) return;

		const dx = e.clientX - lastMouseX;
		const dy = e.clientY - lastMouseY;

		lastMouseX = e.clientX;
		lastMouseY = e.clientY;

		// convert pixels → radians
		yaw   -= dx * mouseSensitivity; // left/right
		pitch -= dy * mouseSensitivity; // up/down

		// clamp pitch so you can’t flip over
		const maxPitch = Math.PI / 2 - 0.1;
		if (pitch > maxPitch) pitch = maxPitch;
		if (pitch < -maxPitch) pitch = -maxPitch;
		updateViewMatrix();
	});
	
	const segments = 10;              // increase this for more resolution (e.g. 40, 80)
	const size     = 20.0;           
	const halfSize = size * 0.5;

	const verts = [];
	const inds  = [];

	// build (segments+1) x (segments+1) vertices
	for (let y = 0; y <= segments; y++) {
		const tY = y / segments;
		const py = -halfSize + tY * size;

		for (let x = 0; x <= segments; x++) {
			const tX = x / segments;
			const px = -halfSize + tX * size;

			verts.push(
				px, py, 0,          // position
				tX * 5.0, tY * 5.0  // texcoords
			);
		}
	}

	// build indices for two triangles per cell
	const stride = segments + 1;
	for (let y = 0; y < segments; y++) {
		for (let x = 0; x < segments; x++) {
			const i0 = y * stride + x;
			const i1 = i0 + 1;
			const i2 = i0 + stride;
			const i3 = i2 + 1;

			// triangle 1
			inds.push(i0, i1, i2);
			// triangle 2
			inds.push(i1, i3, i2);
		}
	}

	const floorVertices = new Float32Array(verts);
	const floorIndices  = new Uint16Array(inds);

	const floorVBO = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, floorVBO);
	gl.bufferData(gl.ARRAY_BUFFER, floorVertices, gl.STATIC_DRAW);

	const floorEBO = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, floorEBO);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, floorIndices, gl.STATIC_DRAW);

	gl.useProgram(floorProgram);
	gl.bindBuffer(gl.ARRAY_BUFFER, floorVBO);

	// Position attribute (location = 0)
	gl.vertexAttribPointer(
		0,        // index
		3,        // x,y,z
		gl.FLOAT,
		false,
		5 * 4,    // stride: 5 floats * 4 bytes
		0         // offset
	);
	gl.enableVertexAttribArray(0);

	// Texcoord attribute (location = 1)
	gl.vertexAttribPointer(
		1,        // index
		2,        // u,v
		gl.FLOAT,
		false,
		5 * 4,
		3 * 4     // offset: after 3 floats
	);
	gl.enableVertexAttribArray(1);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, floorEBO);

	// --- Texture setup ---
	const grassTexture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, grassTexture);

	// Temporary 1x1 green pixel so something exists before image loads
	const tempPixel = new Uint8Array([0, 255, 0, 255]);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA,
		1,
		1,
		0,
		gl.RGBA,
		gl.UNSIGNED_BYTE,
		tempPixel
	);

	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

	const image = new Image();
	image.onload = function () {
		gl.bindTexture(gl.TEXTURE_2D, grassTexture);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			image
		);

		gl.generateMipmap(gl.TEXTURE_2D);
		render();
	};
	image.src = "textures/grass.png"; 

	const sunVertices = new Float32Array([
		// x,  y,  z,   u, v
		-1, -1,  0,   0, 0,
		1, -1,  0,   1, 0,
		1,  1,  0,   1, 1,
		-1,  1,  0,   0, 1,
	]);

	const sunIndices = new Uint16Array([0, 1, 2, 0, 2, 3]);

	const sunVBO = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, sunVBO);
	gl.bufferData(gl.ARRAY_BUFFER, sunVertices, gl.STATIC_DRAW);

	const sunEBO = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sunEBO);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sunIndices, gl.STATIC_DRAW);

	function render(){
		updateCamera();     // WASD, mus, etc'
		drawScene();
		requestAnimationFrame(render);
	}

	function updateCamera(){
		let speed = 0.2;
		if (keys["shift"]) speed = 0.4;

		if (gravityEnabled) {
			verticalVelocity += gravity;         // accelerate downward
			cameraPos[2] += verticalVelocity;    // apply vertical motion
		} else {
			verticalVelocity = 0;  // no gravity = no vertical speed
		}

		// horizontal forward direction (ignore pitch for movement)
		const forward = vec3.fromValues(Math.cos(yaw), Math.sin(yaw), 0);
		const right   = vec3.fromValues(forward[1], -forward[0], 0);

		if (keys["w"]) {
			vec3.scaleAndAdd(cameraPos, cameraPos, forward, speed);
		}
		if (keys["s"]) {
			vec3.scaleAndAdd(cameraPos, cameraPos, forward, -speed);
		}
		if (keys["a"]) {
			vec3.scaleAndAdd(cameraPos, cameraPos, right, -speed);
		}
		if (keys["d"]) {
			vec3.scaleAndAdd(cameraPos, cameraPos, right, speed);
		}
		if (keys["e"] && !gravityEnabled) {
			cameraPos[2] += speed;
		}
		if (keys["q"] && !gravityEnabled) {
			cameraPos[2] -= speed;
		}

		// arrow keys also rotate view (optional)
		const rotationSpeed = 0.02;
		if (keys["arrowleft"]) {
			yaw += rotationSpeed;
		}
		if (keys["arrowright"]) {
			yaw -= rotationSpeed;
		}
		if (keys["arrowup"]) {
			pitch += rotationSpeed;
		}
		if (keys["arrowdown"]) {
			pitch -= rotationSpeed;
		}

		const maxPitch = Math.PI / 2 - 0.1;
		if (pitch > maxPitch) pitch = maxPitch;
		if (pitch < -maxPitch) pitch = -maxPitch;

		// apply collision + rebuild view
		applyGroundCollision();
		applyTreeCollision();
		updateViewMatrix();
	}


	function drawScene() {
		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
		gl.enable(gl.DEPTH_TEST);
		gl.clearColor(0.45, 0.75, 1.0, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


		// ---- draw trees ----
		gl.useProgram(treeProgram);
		
		gl.uniformMatrix4fv(uTreeViewLoc,  false, viewMatrix);
		gl.uniformMatrix4fv(uTreeProjLoc,  false, projMatrix);

		gl.bindBuffer(gl.ARRAY_BUFFER, treeVBO);
    	gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    	gl.enableVertexAttribArray(0);

    	gl.bindBuffer(gl.ARRAY_BUFFER, treeNBO);
    	gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    	gl.enableVertexAttribArray(1);

    	gl.bindBuffer(gl.ARRAY_BUFFER, treeUVBO);
    	gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
    	gl.enableVertexAttribArray(2);


    	
		// render trees
        treePositions.forEach(([xCoord, yCoord]) => {
            const model = mat4.create();
            const ground = getHeightAt(xCoord, yCoord);
            mat4.translate(model, model, [xCoord, yCoord, ground]);
			mat4.rotateX(model, model, Math.PI / 2);
            gl.uniformMatrix4fv(uTreeModelLoc, false, model);
            gl.drawArrays(gl.TRIANGLES, 0, treeData.vertexCount);
        });



		// --- draw sun first ---
		gl.useProgram(sunProgram);

		gl.uniformMatrix4fv(uSunViewLoc,  false, viewMatrix);
		gl.uniformMatrix4fv(uSunProjLoc,  false, projMatrix);
		gl.uniformMatrix4fv(uSunModelLoc, false, sunModelMatrix);
		gl.uniform3f(uSunColorLoc, 1.0, 0.95, 0.8); // warm color

		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		// configure attributes for sun (same layout 3 pos + 2 uv)
		gl.bindBuffer(gl.ARRAY_BUFFER, sunVBO);
		gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 5 * 4, 0);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 5 * 4, 3 * 4);
		gl.enableVertexAttribArray(1);

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sunEBO);
		gl.drawElements(gl.TRIANGLES, sunIndices.length, gl.UNSIGNED_SHORT, 0);

		gl.disable(gl.BLEND);

		gl.useProgram(floorProgram);

		gl.uniformMatrix4fv(uViewLoc, false, viewMatrix);
		gl.uniformMatrix4fv(uProjLoc, false, projMatrix);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, grassTexture);
		gl.uniform1i(uGrassLoc, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, floorVBO);
		gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 5 * 4, 0);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 5 * 4, 3 * 4);
		gl.enableVertexAttribArray(1);

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, floorEBO);

		const tileSize = 20.0;     // your quad covers -10..10 ⇒ size 20
		const gridRadius = 4;      // draws (2*4+1)^2 = 81 tiles

		for (let gy = -gridRadius; gy <= gridRadius; gy++) {
			for (let gx = -gridRadius; gx <= gridRadius; gx++) {
				const tileModel = mat4.clone(modelMatrix);
				mat4.translate(tileModel, tileModel, [gx * tileSize, gy * tileSize, 0.0]);
				gl.uniformMatrix4fv(uModelLoc, false, tileModel);

				gl.drawElements(
					gl.TRIANGLES,
					floorIndices.length,
					gl.UNSIGNED_SHORT,
					0
				);
			}
		}
	}  
}

function compileShader(gl, source, type) {
	const shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	return shader;
}