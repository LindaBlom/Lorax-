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
let gravityEnabled = false;
let verticalVelocity = 0;     // z-velocity
const gravity = -0.08;        // tweak as you like

const treePositions = [
	[0, 12],
	[10, 24],
	[-5, 10],
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
		fetch("shaders/ball.vert").then(r => r.text()),
		fetch("shaders/ball.frag").then(r => r.text()),
		fetch("models/träd1-kula.obj").then(r => r.text()),
		fetch("shaders/stem.vert").then(r => r.text()),
		fetch("shaders/stem.frag").then(r => r.text()),
		fetch("models/träd2-stam.obj").then(r => r.text()),
		fetch("shaders/post.vert").then(r => r.text()),
    	fetch("shaders/bloom.frag").then(r => r.text())		
	])
		.then(([grassVert, grassFrag, sunVert, sunFrag, ballVert,ballFrag, ballObj, stemVert, stemFrag, stemObj, postVert, bloomFrag]) => {
			initializeScene(gl, grassVert, grassFrag, sunVert, sunFrag, ballVert, ballFrag, ballObj, stemVert, stemFrag, stemObj, postVert, bloomFrag);
		})
		.catch(err => console.error("Failed to load shaders:", err));
}

function initializeScene(gl, grassVert, grassFrag, sunVert, sunFrag, ballVert,ballFrag, ballObjText,stemVert, stemFrag, stemObj, postVert, bloomFrag) {
	// --- BALLS-----
	const ballProgram = gl.createProgram();

	const ballVertShader = compileShader(gl,ballVert, gl.VERTEX_SHADER);
	const ballFragShader = compileShader(gl,ballFrag, gl.FRAGMENT_SHADER);

	
	gl.attachShader(ballProgram, ballVertShader);
	gl.attachShader(ballProgram,ballFragShader);
	gl.linkProgram(ballProgram);

	const uBallModelLoc = gl.getUniformLocation(ballProgram, "uModel");
    const uBallViewLoc  = gl.getUniformLocation(ballProgram, "uView");
    const uBallProjLoc  = gl.getUniformLocation(ballProgram, "uProj");
	

	if(!gl.getProgramParameter(ballProgram, gl.LINK_STATUS)){
		console.log(gl.getShaderInfoLog(ballVertShader))
		console.log(gl.getShaderInfoLog(ballFragShader))
	}
	gl.useProgram(ballProgram);


	// reading objects and saving to buffer
	const ballData = parseOBJ(ballObjText);

    const ballVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ballVBO);
    gl.bufferData(gl.ARRAY_BUFFER, ballData.positions, gl.STATIC_DRAW);

    const ballUVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ballUVBO);
    gl.bufferData(gl.ARRAY_BUFFER, ballData.texCoords, gl.STATIC_DRAW);

    const ballNBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ballNBO);
    gl.bufferData(gl.ARRAY_BUFFER, ballData.normals, gl.STATIC_DRAW);

    //// Hämta locations (om du inte redan gjort det)
    


	const ballTexture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D,ballTexture);
	gl.bindTexture(gl.TEXTURE_2D, ballTexture);
	// WTF ÄR DETTA
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 0, 255, 255]));

	const ballImg = new Image();
	ballImg.onload = () => {
	  gl.bindTexture(gl.TEXTURE_2D, ballTexture);
	  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ballImg);
	  gl.generateMipmap(gl.TEXTURE_2D);
	};
	ballImg.src = "textures/treeFurPink.jpg";
    

	//// ----- STEMS ------//
	const stemProgram = gl.createProgram();

	const stemVertShader = compileShader(gl,stemVert, gl.VERTEX_SHADER);
	const stemFragShader = compileShader(gl,stemFrag, gl.FRAGMENT_SHADER);

	
	gl.attachShader(stemProgram, stemVertShader);
	gl.attachShader(stemProgram, stemFragShader);
	gl.linkProgram(stemProgram);

    const uStemViewLoc  = gl.getUniformLocation(stemProgram, "uView");
	const uStemModelLoc = gl.getUniformLocation(stemProgram, "uModel");
    const uStemProjLoc  = gl.getUniformLocation(stemProgram, "uProj");
	const uShellOffsetLoc = gl.getUniformLocation(ballProgram, "uShellOffset");
	const uShellIndexLoc = gl.getUniformLocation(ballProgram,"uShellIndex");


	if(!gl.getProgramParameter(stemProgram, gl.LINK_STATUS)){
		console.log(gl.getShaderInfoLog(stemVertShader))
		console.log(gl.getShaderInfoLog(stemFragShader))
	}
	gl.useProgram(stemProgram);


	// reading objects and saving to buffer
	const stemData = parseOBJ(stemObj);

    const stemVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, stemVBO);
    gl.bufferData(gl.ARRAY_BUFFER, stemData.positions, gl.STATIC_DRAW);

    const stemUVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, stemUVBO);
    gl.bufferData(gl.ARRAY_BUFFER, stemData.texCoords, gl.STATIC_DRAW);

    const stemNBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, stemNBO);
    gl.bufferData(gl.ARRAY_BUFFER, stemData.normals, gl.STATIC_DRAW);

    //// Hämta locations (om du inte redan gjort det)

	const stemTexture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D,stemTexture);
	gl.bindTexture(gl.TEXTURE_2D, stemTexture);
	// WTF ÄR DETTA
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 0, 255, 255]));

	const stemImg = new Image();
	stemImg.onload = () => {
	  gl.bindTexture(gl.TEXTURE_2D, stemTexture);
	  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, stemImg);
	  gl.generateMipmap(gl.TEXTURE_2D);
	};
	stemImg.src = "textures/birchWood.png";

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
		//render();
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



	render();


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


		// ---- draw Balls ----


	


		gl.useProgram(ballProgram);

		// ---Textures -----
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, ballTexture);
		gl.uniform1i(gl.getUniformLocation(ballProgram, "uFurTexture"), 0);

		gl.uniformMatrix4fv(uBallViewLoc,  false, viewMatrix);
		gl.uniformMatrix4fv(uBallProjLoc,  false, projMatrix);

		gl.bindBuffer(gl.ARRAY_BUFFER, ballVBO);
    	gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    	gl.enableVertexAttribArray(0);

    	gl.bindBuffer(gl.ARRAY_BUFFER, ballNBO);
    	gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    	gl.enableVertexAttribArray(1);

    	gl.bindBuffer(gl.ARRAY_BUFFER, ballUVBO);
    	gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
    	gl.enableVertexAttribArray(2);

		
		//gl.enable(gl.BLEND);
		//gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); 




		const shellCount = 12;

		treePositions.forEach(([xCoord, yCoord]) => {
			const model = mat4.create();
			const ground = getHeightAt(xCoord, yCoord, seed);
			mat4.translate(model, model, [xCoord, yCoord+11, ground + 3]);
			mat4.rotateX(model, model, Math.PI / 2);
			mat4.scale(model, model, [3, 3, 3]);

			// 1) bas-sfär – depthMask(true), cull back faces
			//gl.enable(gl.POLYGON_OFFSET_FILL);
			//gl.polygonOffset(1.0, 1.0);
			gl.depthMask(true);
			gl.disable(gl.BLEND);
			gl.cullFace(gl.BACK);
	
			gl.uniformMatrix4fv(uBallModelLoc, false, model);
			gl.uniform1f(uShellIndexLoc, 0.0);
			gl.uniform1f(uShellOffsetLoc, 0.04);
			gl.drawArrays(gl.TRIANGLES, 0, ballData.vertexCount);
			gl.disable(gl.POLYGON_OFFSET_FILL);

			// 2) shells – depthMask(false), cull front faces
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);


			for (let i = shellCount - 1; i >= 0; i--) {
			  const shellIndex = i / (shellCount - 1);
			  gl.uniform1f(uShellIndexLoc, shellIndex);
			  gl.drawArrays(gl.TRIANGLES, 0, ballData.vertexCount);
			}

			// reset state
			gl.disable(gl.BLEND);
			//gl.cullFace(gl.BACK);
		});

		// --------------draw stems---------------------------

		gl.useProgram(stemProgram);

		// ---Textures -----
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, stemTexture);
		gl.uniform1i(gl.getUniformLocation(stemProgram, "uTreeTex"), 0);
		gl.uniform3fv(gl.getUniformLocation(stemProgram, "uLightDir"), sunDir);

		gl.uniformMatrix4fv(uStemViewLoc,  false, viewMatrix);
		gl.uniformMatrix4fv(uStemProjLoc,  false, projMatrix);

		gl.bindBuffer(gl.ARRAY_BUFFER, stemVBO);
    	gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    	gl.enableVertexAttribArray(0);

    	gl.bindBuffer(gl.ARRAY_BUFFER, stemNBO);
    	gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    	gl.enableVertexAttribArray(1);

    	gl.bindBuffer(gl.ARRAY_BUFFER, stemUVBO);
    	gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
    	gl.enableVertexAttribArray(2);


    	
		// render trees
        treePositions.forEach(([xCoord, yCoord]) => {
            const model = mat4.create();
            const ground = getHeightAt(xCoord, yCoord, seed);
            mat4.translate(model, model, [xCoord, yCoord, ground]);
			mat4.rotateX(model, model, Math.PI / 2);
			mat4.scale(model,model,[3,3,3]);
            gl.uniformMatrix4fv(uStemModelLoc, false, model);
            gl.drawArrays(gl.TRIANGLES, 0, stemData.vertexCount);
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