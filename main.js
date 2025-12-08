import { parseOBJ } from "./helpers/parser.js";

import {addEventListeners} from"./helpers/eventlisteners.js";
import {getHeightAt} from "./helpers/utils.js";

const mat4 = glMatrix.mat4;
const vec3 = glMatrix.vec3;
const WORLD_RADIUS = 75.0;

// ---- perspective and camera setup ----
const keys = {};
const cameraState = { yaw: Math.PI / 2, pitch: -0.2 };
const cameraPos = vec3.fromValues(0, -30, 15); // starting position
let gravityEnabled = true;
let verticalVelocity = 0;     // z-velocity
const gravity = -0.08;        // tweak as you like

const treePositions = [
	[0, 12],
	[4, 14],
	[-6, 16],
];

main();


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
		fetch("shaders/post.vert").then(r => r.text()),
    	fetch("shaders/bloom.frag").then(r => r.text()),
		fetch("models/tree.obj").then(r => r.text())
	])
		.then(([grassVert, grassFrag, sunVert, sunFrag, treeVert, treeFrag, postVert, bloomFrag, treeObj]) => {
			initializeScene(gl, grassVert, grassFrag, sunVert, sunFrag, treeVert, treeFrag, postVert, bloomFrag, treeObj);
		})
		.catch(err => console.error("Failed to load shaders:", err));
}

function initializeScene(gl, grassVert, grassFrag, sunVert, sunFrag, treeVert, treeFrag, postVert, bloomFrag, treeObjText) {



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
	const uWorldRadiusLoc = gl.getUniformLocation(floorProgram, "uWorldRadius");

	const uSeedLoc 		= gl.getUniformLocation(floorProgram, "uSeed");

	gl.useProgram(floorProgram);

	const seed = Math.random() * 100.0;
	gl.uniform1f(uSeedLoc, seed);

	const sunDir = vec3.fromValues(0.5, 0.5, 1.0);
	vec3.normalize(sunDir, sunDir);

	const lightDir = vec3.create();
	vec3.scale(lightDir, sunDir, -1.0);
	gl.uniform3fv(uLightDirLoc, lightDir);

	// warm-ish sunlight, soft ambient
	gl.uniform3f(uLightColorLoc,   1.0, 0.99, 0.95);  // sunlight
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

	// ==== POST-PROCESS / BLOOM ====
    const postProgram = gl.createProgram();
    const postVertShader  = compileShader(gl, postVert,  gl.VERTEX_SHADER);
    const bloomFragShader = compileShader(gl, bloomFrag, gl.FRAGMENT_SHADER);

    gl.attachShader(postProgram, postVertShader);
    gl.attachShader(postProgram, bloomFragShader);
    gl.linkProgram(postProgram);

    if (!gl.getProgramParameter(postProgram, gl.LINK_STATUS)) {
        console.log(gl.getShaderInfoLog(postVertShader));
        console.log(gl.getShaderInfoLog(bloomFragShader));
    }

    const uPostSceneLoc = gl.getUniformLocation(postProgram, "uScene");

    // fullscreen quad (NDC positions + texcoords)
    const quadVerts = new Float32Array([
        //  x,   y,   u,  v
        -1, -1,  0,  0,
         1, -1,  1,  0,
        -1,  1,  0,  1,
         1,  1,  1,  1,
    ]);

    const quadVBO = gl.createBuffer();
    const quadVAO = gl.createVertexArray();

    gl.bindVertexArray(quadVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

    // aPosition (location = 0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 4 * 4, 0);
    gl.enableVertexAttribArray(0);
    // aTexCoord (location = 1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 4 * 4, 2 * 4);
    gl.enableVertexAttribArray(1);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // framebuffer we render the scene into
    let sceneFBO   = gl.createFramebuffer();
    let sceneTex   = gl.createTexture();
    let sceneDepth = gl.createRenderbuffer();

    function resizeSceneTargets() {
        const w = gl.canvas.width;
        const h = gl.canvas.height;

        gl.bindTexture(gl.TEXTURE_2D, sceneTex);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            w, h,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.bindRenderbuffer(gl.RENDERBUFFER, sceneDepth);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);

        gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFBO);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            sceneTex,
            0
        );
        gl.framebufferRenderbuffer(
            gl.FRAMEBUFFER,
            gl.DEPTH_ATTACHMENT,
            gl.RENDERBUFFER,
            sceneDepth
        );

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    }

    // call once now (canvas already resized earlier)
    resizeSceneTargets();


	// --- Matrices ---
	const viewMatrix = mat4.create();
	const modelMatrix = mat4.create();
	const projMatrix = mat4.create();
	
	

	// rebuild viewMatrix from cameraPos, yaw, pitch
	function updateViewMatrix() {
		const forward = vec3.fromValues(
			Math.cos(cameraState.yaw) * Math.cos(cameraState.pitch),
			Math.sin(cameraState.yaw) * Math.cos(cameraState.pitch),
			Math.sin(cameraState.pitch)
		);
		const target = vec3.create();
		vec3.add(target, cameraPos, forward);

		mat4.lookAt(viewMatrix, cameraPos, target, [0, 0, 1]); // Z-up
	}

	// call once to initialize
	updateViewMatrix();

	function applyGroundCollision() {
		const ground = getHeightAt(cameraPos[0], cameraPos[1], seed);
		const eyeHeight = 2.0; // how high above ground the "head" should be
		const minZ = ground + eyeHeight;

		if (cameraPos[2] < minZ) {
			cameraPos[2] = minZ;
			verticalVelocity = 0; // reset 
		}
	}
	function applyWorldBoundsCollision() {
		const x = cameraPos[0];
		const y = cameraPos[1];

		const distSq   = x * x + y * y;
		const maxDist  = WORLD_RADIUS  - 1.0;
		const maxDistSq = maxDist * maxDist;

		if (distSq > maxDistSq) {
			const dist = Math.sqrt(distSq);
			if (dist > 0.0001) {
				const scale = maxDist / dist;
				cameraPos[0] = x * scale;
				cameraPos[1] = y * scale;
			}
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
	const far = 200.0;

	mat4.perspective(out, fovy, aspect, near, far);
	addEventListeners(gl, keys, cameraState ,gravityEnabled, verticalVelocity, updateViewMatrix);
	
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

		if (keys["f"]) {
			gravityEnabled = !gravityEnabled;
		}

		if (keys[" "]) {
			verticalVelocity = 0.5; // jump
		}

		if (gravityEnabled) {
			verticalVelocity += gravity;         // accelerate downward
			cameraPos[2] += verticalVelocity;    // apply vertical motion
		} else {
			verticalVelocity = 0;  // no gravity = no vertical speed
		}

		// horizontal forward direction (ignore pitch for movement)
		const forward = vec3.fromValues(Math.cos(cameraState.yaw), Math.sin(cameraState.yaw), 0);
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
			cameraState.yaw += rotationSpeed;
		}
		if (keys["arrowright"]) {
			cameraState.yaw -= rotationSpeed;
		}
		if (keys["arrowup"]) {
			cameraState.pitch += rotationSpeed;
		}
		if (keys["arrowdown"]) {
			cameraState.pitch -= rotationSpeed;
		}

		const maxPitch = Math.PI / 2 - 0.1;
		if (cameraState.pitch > maxPitch) cameraState.pitch = maxPitch;
		if (cameraState.pitch < -maxPitch) cameraState.pitch = -maxPitch;

		// apply collision + rebuild view
		applyGroundCollision();
		applyWorldBoundsCollision();
		applyTreeCollision();
		updateViewMatrix();
	}


	function drawScene() {
		gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFBO);
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
            const ground = getHeightAt(xCoord, yCoord, seed);
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
		gl.uniform3f(uSunColorLoc, 1.0, 0.99, 0.95); // warm color

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

		// --- draw floor / grass ---
		gl.useProgram(floorProgram);

		gl.uniformMatrix4fv(uViewLoc, false, viewMatrix);
		gl.uniformMatrix4fv(uProjLoc, false, projMatrix);
		gl.uniform1f(uWorldRadiusLoc, WORLD_RADIUS); 

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
		const gridRadius = 9;      // draws (2*4+1)^2 = 81 tiles

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

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.disable(gl.DEPTH_TEST);
		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT);

		gl.useProgram(postProgram);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, sceneTex);
		gl.uniform1i(uPostSceneLoc, 0);

		gl.bindVertexArray(quadVAO);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		gl.bindVertexArray(null);
	}  
}

function compileShader(gl, source, type) {
	const shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	return shader;
}