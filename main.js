import {parseOBJ} from "./helpers/parser.js";
import {addEventListeners} from"./helpers/eventlisteners.js";
import {getHeightAt, applyGroundCollision, applyWorldBoundsCollision, applyTreeCollision} from "./helpers/utils.js";
import {createShaderProgram, createBuffer, loadTexture, drawFloorTiles, buildFloorGeometry, buildSunGeometry} from "./helpers/graphics.js";
import {updateCamera} from "./helpers/camera.js";

const mat4 = glMatrix.mat4;
const vec3 = glMatrix.vec3;
const WORLD_RADIUS = 75.0;
const shellCount = 1000;
let fluffyGrass = true;
let lastGDown = false;

// ---- perspective and camera setup ----
const keys = {};
const cameraState = { yaw: Math.PI / 2, pitch: -0.2 };
const cameraPos = vec3.fromValues(0, -30, 15); // starting position
let smoothedCameraPos = [...cameraPos];
let gravityEnabled = true;
let verticalVelocity = 0;     // z-velocity
const gravity = -69;        
let lastFDown = false;
let lastTime = performance.now();

const treePositions = [
	[0, 12],
	//[-10, -5],
	//[15, 8],
	//[-20, 15],
	//[25, -10],
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
		const dpr = window.devicePixelRatio || 1;
		const w = Math.floor(canvas.clientWidth * dpr);
		const h = Math.floor(canvas.clientHeight * dpr);

		if (canvas.width !== w || canvas.height !== h) {
			canvas.width = w;
			canvas.height = h;
			gl.viewport(0, 0, w, h);
		}
	}

	resizeCanvas();
	window.addEventListener("resize", resizeCanvas);

	// ---- Asset Loading ----
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
    	fetch("shaders/bloom.frag").then(r => r.text()),
		fetch("shaders/shadow.vert").then(r => r.text()),
		fetch("shaders/shadow.frag").then(r => r.text())		
	])
		.then(([grassVert, grassFrag, sunVert, sunFrag, ballVert,ballFrag, ballObj, stemVert, stemFrag, stemObj, postVert, bloomFrag, shadowVert, shadowFrag]) => {
			initializeScene(gl, grassVert, grassFrag, sunVert, sunFrag, ballVert, ballFrag, ballObj, stemVert, stemFrag, stemObj, postVert, bloomFrag, shadowVert, shadowFrag);
		})
		.catch(err => console.error("Failed to load shaders:", err));
}

function initializeScene(gl, grassVert, grassFrag, sunVert, sunFrag, ballVert,ballFrag, ballObjText,stemVert, stemFrag, stemObj, postVert, bloomFrag, shadowVert, shadowFrag) {
	// ---- Ball Setup ----
	const {program: ballProgram, uniforms: ballUniforms} = createShaderProgram(gl, ballVert, ballFrag, ["uModel", "uView", "uProj", "uShellOffset", "uShellIndex", "uFurTexture", "uLightPos"]);

	const ballData = parseOBJ(ballObjText);

	const ballVBO = createBuffer(gl, ballData.positions, 0, 3);
	const ballUVBO = createBuffer(gl, ballData.texCoords, 2, 2);
	const ballNBO = createBuffer(gl, ballData.normals, 1, 3);

	const ballTexture = loadTexture(gl, "textures/treeFurPink.jpg");

	// ---- Stem Setup ----
	const {program: stemProgram, uniforms: stemUniforms} = createShaderProgram(gl, stemVert, stemFrag, ["uView", "uModel", "uProj", "uStemTexture", "uLightPos", "uLightColor", "uAmbientColor"]);

	const stemData = parseOBJ(stemObj);

	const stemVBO = createBuffer(gl, stemData.positions, 0, 3);
	const stemUVBO = createBuffer(gl, stemData.texCoords, 2, 2);
	const stemNBO = createBuffer(gl, stemData.normals, 1, 3);

	const stemTexture = loadTexture(gl, "textures/birchWood.png", {minFilter: gl.LINEAR, magFilter: gl.NEAREST});

	// ---- Floor Setup ----
	const {program: floorProgram, uniforms: floorUniforms} = createShaderProgram(gl, grassVert, grassFrag, ["uLightPos", "uLightColor", "uAmbientColor", "uShadowCube", "uShadowFar", "uModel", "uView", "uProj", "uGrass", "uWorldRadius", "uSeed", "uShellIndex","uShellOffset"]);

	gl.useProgram(floorProgram);

	const seed = Math.random() * 100.0;
	gl.uniform1f(floorUniforms.uSeed, seed);

	const sunDir = vec3.fromValues(2.0, 1.0, 1.0);
	vec3.normalize(sunDir, sunDir);
	const sunModelMatrix = mat4.create();
	const sunDistance = 100.0;
	const sunPos = vec3.create();
	vec3.scale(sunPos, sunDir, sunDistance);
	const sunBillboardRot = mat4.create();

	gl.uniform3fv(floorUniforms.uLightPos, sunPos);
	gl.uniform3f(floorUniforms.uLightColor, 1.0, 0.99, 0.95);
	gl.uniform3f(floorUniforms.uAmbientColor, 0.25, 0.35, 0.45);
	gl.uniform1f(floorUniforms.uShellIndex, 0.0);
	gl.uniform1f(floorUniforms.uShellOffset, 0.2);

	// ---- Sun Setup ----
	const {program: sunProgram, uniforms: sunUniforms} = createShaderProgram(gl, sunVert, sunFrag, ["uModel", "uView", "uProj", "uSunColor"]);

	const lightView = mat4.create();
	const lightProj = mat4.create();
	const lightVP = mat4.create();

	// ---- Post-Processing Setup ----
	const {program: postProgram, uniforms: postUniforms} = createShaderProgram(gl, postVert, bloomFrag, ["uScene"]);

	const {program: shadowProgram, uniforms: shadowUniforms} = createShaderProgram(gl, shadowVert, shadowFrag, ["uModel", "uLightVP", "uSeed", "uLightPos", "uShadowFar"]);

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

    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 4 * 4, 0);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 4 * 4, 2 * 4);
    gl.enableVertexAttribArray(1);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

	// === HDR support for render targets ===
    const extColorBufferFloat = gl.getExtension("EXT_color_buffer_float");
    if (!extColorBufferFloat) {
        console.warn("EXT_color_buffer_float not supported - HDR bloom will not work.");
    }

    // framebuffer we render the scene into
    let sceneFBO   = gl.createFramebuffer();
    let sceneTex   = gl.createTexture();
    let sceneDepth = gl.createRenderbuffer();

    function resizeSceneTargets() {
        const w = gl.canvas.width;
		const h = gl.canvas.height;

		// Color texture
		gl.bindTexture(gl.TEXTURE_2D, sceneTex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		// Depth renderbuffer
		gl.bindRenderbuffer(gl.RENDERBUFFER, sceneDepth);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);

		// Attach
		gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFBO);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTex, 0);
		gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, sceneDepth);

		const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
		if (status !== gl.FRAMEBUFFER_COMPLETE) {
			console.error("sceneFBO incomplete after resize:", status.toString(16));
		}

		// Cleanup binds
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    }
	function handleResize() {
		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

		resizeSceneTargets();       // realloc sceneTex + sceneDepth
		updateProjectionMatrix();   // fix aspect ratio
	}
	window.addEventListener("resize", handleResize);

	const SHADOW_MAP_SIZE = 1024;
	const SHADOW_NEAR = 1.0;
	const SHADOW_FAR  = 220.0;

	// One FBO reused for all 6 faces
	const shadowFBO = gl.createFramebuffer();

	// Cubemap COLOR texture storing linear depth in .r
	const shadowCubeTex = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, shadowCubeTex);

	for (let i = 0; i < 6; i++) {
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, gl.RGBA16F, SHADOW_MAP_SIZE, SHADOW_MAP_SIZE, 0, gl.RGBA, gl.HALF_FLOAT, null);
	}

	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

	// Depth buffer for depth testing during shadow render
	const shadowDepthRB = gl.createRenderbuffer();
	gl.bindRenderbuffer(gl.RENDERBUFFER, shadowDepthRB);
	gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);

	// Attach depth RB once; attach cubemap face color per-pass
	gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFBO);
	gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, shadowDepthRB);
	gl.drawBuffers([gl.COLOR_ATTACHMENT0]);

	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
	gl.bindRenderbuffer(gl.RENDERBUFFER, null);

    resizeSceneTargets();

	// set shadow texel size (used for PCF sampling in shaders)
	gl.useProgram(floorProgram);

	// --- Matrices ---
	const viewMatrix = mat4.create();
	const modelMatrix = mat4.create();
	const projMatrix = mat4.create();
	
	// rebuild viewtrix from cameraPos, yaw, pitch
	function updateViewMatrix() {
		const forward = vec3.fromValues(
			Math.cos(cameraState.yaw) * Math.cos(cameraState.pitch),
			Math.sin(cameraState.yaw) * Math.cos(cameraState.pitch),
			Math.sin(cameraState.pitch)
		);
		const target = vec3.create();
		vec3.add(target, smoothedCameraPos, forward);

		mat4.lookAt(viewMatrix, smoothedCameraPos, target, [0, 0, 1]);
	}

	updateViewMatrix();

	const fovy = Math.PI / 4; // 45 degrees
	const near = 0.1;
	const far = 200.0;

	function updateProjectionMatrix() {
		const aspect = gl.canvas.width / gl.canvas.height;
		mat4.perspective(projMatrix, fovy, aspect, near, far);
	}
	updateProjectionMatrix();
	addEventListeners(gl, keys, cameraState, updateViewMatrix);
	
	const segments = 10;
	const size     = 20.0;           

	const {verts, inds} = buildFloorGeometry(segments, size);
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

	gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 5 * 4, 0);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 5 * 4, 3 * 4);
	gl.enableVertexAttribArray(1);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, floorEBO);

	const grassTexture = loadTexture(gl, "textures/grass.png"); 

	const {vertices: sunVertices, indices: sunIndices} = buildSunGeometry();

	const sunVBO = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, sunVBO);
	gl.bufferData(gl.ARRAY_BUFFER, sunVertices, gl.STATIC_DRAW);

	const sunEBO = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sunEBO);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sunIndices, gl.STATIC_DRAW);

	requestAnimationFrame(render);

	function render(now){
		const deltaTime = Math.min((now - lastTime) / 1000, 0.05);
  		lastTime = now;
		
		const result = updateCamera({keys, cameraState, gravityEnabled, verticalVelocity, cameraPos, seed, treePositions, updateViewMatrix, smoothedCameraPos, lastFDown, gravity, WORLD_RADIUS, applyGroundCollision, applyWorldBoundsCollision, applyTreeCollision, deltaTime, fluffyGrass, lastGDown});
		gravityEnabled = result.gravityEnabled;
		verticalVelocity = result.verticalVelocity;
		lastFDown = result.lastFDown;
		lastGDown = result.lastGDown;
		fluffyGrass = result.fluffyGrass;
		drawScene();
		requestAnimationFrame(render);
	}

	function drawScene() {
		// ---- Shadow Pass ----
		gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFBO);
		gl.viewport(0, 0, SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
		gl.enable(gl.DEPTH_TEST);
		gl.disable(gl.CULL_FACE);

		// 6 cubemap face directions + up vectors
		const faceTargets = [
			{ dir: [ 1, 0, 0], up: [0,-1, 0] }, // +X
			{ dir: [-1, 0, 0], up: [0,-1, 0] }, // -X
			{ dir: [ 0, 1, 0], up: [0, 0, 1] }, // +Y
			{ dir: [ 0,-1, 0], up: [0, 0,-1] }, // -Y
			{ dir: [ 0, 0, 1], up: [0,-1, 0] }, // +Z
			{ dir: [ 0, 0,-1], up: [0,-1, 0] }, // -Z
		];

		// Point-light projection: 90° fov, aspect 1
		mat4.perspective(lightProj, Math.PI / 2, 1.0, SHADOW_NEAR, SHADOW_FAR);

		gl.useProgram(shadowProgram);
		gl.uniform3fv(shadowUniforms.uLightPos, sunPos);
		gl.uniform1f(shadowUniforms.uShadowFar, SHADOW_FAR);
		gl.uniform1f(shadowUniforms.uSeed, seed);

		for (let face = 0; face < 6; face++) {
			// Attach cubemap FACE as render target
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, shadowCubeTex, 0);

			gl.clearColor(1, 0, 0, 1);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

			// Look direction for this face
			const target = vec3.create();
			vec3.add(target, sunPos, faceTargets[face].dir);
			mat4.lookAt(lightView, sunPos, target, faceTargets[face].up);

			mat4.multiply(lightVP, lightProj, lightView);
			gl.uniformMatrix4fv(shadowUniforms.uLightVP, false, lightVP);

			// ---- draw balls ----
			treePositions.forEach(([xCoord, yCoord]) => {
				const model = mat4.create();
				const ground = getHeightAt(xCoord, yCoord, seed);
				mat4.translate(model, model, [xCoord, yCoord + 11, ground + 2.8]);
				mat4.rotateX(model, model, Math.PI / 2);
				mat4.scale(model, model, [3, 3, 3]);

				gl.uniformMatrix4fv(shadowUniforms.uModel, false, model);

				gl.bindBuffer(gl.ARRAY_BUFFER, ballVBO);
				gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
				gl.enableVertexAttribArray(0);

				gl.drawArrays(gl.TRIANGLES, 0, ballData.vertexCount);
			});

			// ---- draw stems ----
			treePositions.forEach(([xCoord, yCoord]) => {
				const model = mat4.create();
				const ground = getHeightAt(xCoord, yCoord, seed);
				mat4.translate(model, model, [xCoord, yCoord, ground - 0.2]);
				mat4.rotateX(model, model, Math.PI / 2);
				mat4.scale(model, model, [3, 3, 3]);

				gl.uniformMatrix4fv(shadowUniforms.uModel, false, model);

				gl.bindBuffer(gl.ARRAY_BUFFER, stemVBO);
				gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
				gl.enableVertexAttribArray(0);

				gl.drawArrays(gl.TRIANGLES, 0, stemData.vertexCount);
			});

			// ---- draw floor into shadow cubemap ----
			const tileSize_shadow = 20.0;
			const gridRadius_shadow = 9;

			gl.bindBuffer(gl.ARRAY_BUFFER, floorVBO);
			gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 5 * 4, 0);
			gl.enableVertexAttribArray(0);
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, floorEBO);

			drawFloorTiles(gl, shadowUniforms, modelMatrix, tileSize_shadow, gridRadius_shadow, floorIndices, mat4);
		}

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);

		// ---- Main Render Pass ----
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
		gl.uniform1i(ballUniforms.uFurTexture, 0);

		gl.uniform3fv(ballUniforms.uLightPos, sunPos);

		gl.uniformMatrix4fv(ballUniforms.uView, false, viewMatrix);
		gl.uniformMatrix4fv(ballUniforms.uProj, false, projMatrix);

		gl.bindBuffer(gl.ARRAY_BUFFER, ballVBO);
    	gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    	gl.enableVertexAttribArray(0);

    	gl.bindBuffer(gl.ARRAY_BUFFER, ballNBO);
    	gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    	gl.enableVertexAttribArray(1);

    	gl.bindBuffer(gl.ARRAY_BUFFER, ballUVBO);
    	gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
    	gl.enableVertexAttribArray(2);

		treePositions.forEach(([xCoord, yCoord]) => {
			const model = mat4.create();
			const ground = getHeightAt(xCoord, yCoord, seed);
			mat4.translate(model, model, [xCoord, yCoord+11, ground + 3]);
			mat4.rotateX(model, model, Math.PI / 2);
			mat4.scale(model, model, [3, 3, 3]);

			// BAS
			gl.depthMask(true);
			gl.disable(gl.BLEND);
			gl.cullFace(gl.BACK);
	
			gl.uniformMatrix4fv(ballUniforms.uModel, false, model);
			gl.uniform1f(ballUniforms.uShellIndex, 0.0);
			gl.uniform1f(ballUniforms.uShellOffset, 0.2);
			gl.drawArrays(gl.TRIANGLES, 0, ballData.vertexCount);

			// SHELLS
			for (let i = shellCount - 1; i >= 0; i--) {
				const shellIndex = i / (shellCount - 1);
				gl.uniform1f(ballUniforms.uShellIndex, shellIndex);
				gl.drawArrays(gl.TRIANGLES, 0, ballData.vertexCount);
			}
		});

		// --------------draw stems---------------------------
		gl.useProgram(stemProgram);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, stemTexture);
		gl.uniform1i(stemUniforms.uStemTexture, 0);
		gl.uniform3fv(stemUniforms.uLightPos, sunPos);
		gl.uniform3f(stemUniforms.uLightColor, 1.0, 0.99, 0.95);
		gl.uniform3f(stemUniforms.uAmbientColor, 0.25, 0.35, 0.45);

		gl.uniformMatrix4fv(stemUniforms.uView, false, viewMatrix);
		gl.uniformMatrix4fv(stemUniforms.uProj, false, projMatrix);

		gl.bindBuffer(gl.ARRAY_BUFFER, stemVBO);
    	gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    	gl.enableVertexAttribArray(0);

    	gl.bindBuffer(gl.ARRAY_BUFFER, stemNBO);
    	gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    	gl.enableVertexAttribArray(1);

    	gl.bindBuffer(gl.ARRAY_BUFFER, stemUVBO);
    	gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
    	gl.enableVertexAttribArray(2);

        treePositions.forEach(([xCoord, yCoord]) => {
            const model = mat4.create();
            const ground = getHeightAt(xCoord, yCoord, seed);
            mat4.translate(model, model, [xCoord, yCoord, ground]);
			mat4.rotateX(model, model, Math.PI / 2);
			mat4.scale(model,model,[3,3,3]);
            gl.uniformMatrix4fv(stemUniforms.uModel, false, model);
            gl.drawArrays(gl.TRIANGLES, 0, stemData.vertexCount);
        });

		// --- draw sun first ---
		mat4.identity(sunModelMatrix);

		mat4.translate(sunModelMatrix, sunModelMatrix, sunPos);

		mat4.copy(sunBillboardRot, viewMatrix);

		sunBillboardRot[12] = 0.0;
		sunBillboardRot[13] = 0.0;
		sunBillboardRot[14] = 0.0;

		mat4.invert(sunBillboardRot, sunBillboardRot);

		mat4.multiply(sunModelMatrix, sunModelMatrix, sunBillboardRot);

		const sunSize = 10.0;
		mat4.scale(sunModelMatrix, sunModelMatrix, [sunSize, sunSize, sunSize]);

		gl.useProgram(sunProgram);

		gl.uniformMatrix4fv(sunUniforms.uView, false, viewMatrix);
		gl.uniformMatrix4fv(sunUniforms.uProj, false, projMatrix);
		gl.uniformMatrix4fv(sunUniforms.uModel, false, sunModelMatrix);
		gl.uniform3f(sunUniforms.uSunColor, 1.0, 0.99, 0.95);

		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		// configure attributes for sun
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

		gl.uniformMatrix4fv(floorUniforms.uView, false, viewMatrix);
		gl.uniformMatrix4fv(floorUniforms.uProj, false, projMatrix);
		gl.uniform1f(floorUniforms.uWorldRadius, WORLD_RADIUS); 

		gl.uniform3fv(floorUniforms.uLightPos, sunPos);
		gl.uniform1f(floorUniforms.uShadowFar, SHADOW_FAR);

		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_CUBE_MAP, shadowCubeTex);
		gl.uniform1i(floorUniforms.uShadowCube, 1);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, grassTexture);
		gl.uniform1i(floorUniforms.uGrass, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, floorVBO);
		gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 5 * 4, 0);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 5 * 4, 3 * 4);
		gl.enableVertexAttribArray(1);

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, floorEBO);

		const tileSize = 20.0;
		const gridRadius = 9;      // draws (2*4+1)^2 = 81 tiles
		
		//BASEN
		gl.uniform1f(floorUniforms.uShellIndex, 0.0);
		drawFloorTiles(gl, floorUniforms, modelMatrix, tileSize, gridRadius, floorIndices, mat4);
	
		// Shells, utifrån och in
		const grassShellCount = 100;

		if(fluffyGrass){
			for (let i = 1; i < grassShellCount; i++) {
    			const shellIndex = i / (grassShellCount - 1); // 0 -> 1, inner till outer
    			gl.uniform1f(floorUniforms.uShellIndex, shellIndex);
    			drawFloorTiles(gl, floorUniforms, modelMatrix, tileSize, gridRadius, floorIndices, mat4);
			}
		}

		gl.depthMask(true);
        gl.disable(gl.BLEND);

		gl.bindFramebuffer(gl.	FRAMEBUFFER, null);
		gl.disable(gl.DEPTH_TEST);
		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT);

		// ---- Post-Processing ----
		gl.useProgram(postProgram);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, sceneTex);
		gl.uniform1i(postUniforms.uScene, 0);

		gl.bindVertexArray(quadVAO);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		gl.bindVertexArray(null);
	}  
}