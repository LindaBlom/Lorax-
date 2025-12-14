import {parseOBJ} from "./helpers/parser.js";
import {addEventListeners} from"./helpers/eventlisteners.js";
import {getHeightAt, applyGroundCollision, applyWorldBoundsCollision, applyTreeCollision} from "./helpers/utils.js";
import {createShaderProgram, createBuffer, loadTexture, drawFloorTiles, buildFloorGeometry, buildSunGeometry} from "./helpers/graphics.js";
import {updateCamera} from "./helpers/camera.js";

const mat4 = glMatrix.mat4;
const vec3 = glMatrix.vec3;
const WORLD_RADIUS = 75.0;

// ---- perspective and camera setup ----
const keys = {};
const cameraState = { yaw: Math.PI / 2, pitch: -0.2 };
const cameraPos = vec3.fromValues(0, -30, 15); // starting position
let smoothedCameraPos = [...cameraPos];
let gravityEnabled = false;
let verticalVelocity = 0;     // z-velocity
const gravity = -0.08;        // tweak as you like
let lastFDown = false;

const treePositions = [
	[0, 12],
	//[-10, -5],
	//[15, 8],
	//[-20, 15],
	//[25, -10],
];

main();

// ---- Main Application ----
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
	const { program: ballProgram, uniforms: ballUniforms } = createShaderProgram(gl, ballVert, ballFrag, ["uModel", "uView", "uProj", "uShellOffset", "uShellIndex", "uFurTexture", "uLightDir"]);

	const ballData = parseOBJ(ballObjText);

	const ballVBO = createBuffer(gl, ballData.positions, 0, 3);
	const ballUVBO = createBuffer(gl, ballData.texCoords, 2, 2);
	const ballNBO = createBuffer(gl, ballData.normals, 1, 3);

	const ballTexture = loadTexture(gl, "textures/treeFurPink.jpg");

	// ---- Stem Setup ----
	const { program: stemProgram, uniforms: stemUniforms } = createShaderProgram(gl, stemVert, stemFrag, ["uView", "uModel", "uProj", "uStemTexture", "uLightDir", "uLightColor", "uAmbientColor"]);

	const stemData = parseOBJ(stemObj);

	const stemVBO = createBuffer(gl, stemData.positions, 0, 3);
	const stemUVBO = createBuffer(gl, stemData.texCoords, 2, 2);
	const stemNBO = createBuffer(gl, stemData.normals, 1, 3);

	const stemTexture = loadTexture(gl, "textures/birchWood.png", { minFilter: gl.LINEAR, magFilter: gl.NEAREST });

	// ---- Floor Setup ----
	const { program: floorProgram, uniforms: floorUniforms } = createShaderProgram(gl, grassVert, grassFrag, ["uLightDir", "uLightColor", "uAmbientColor", "uLightVP", "uShadowMap", "uShadowTexelSize", "uModel", "uView", "uProj", "uGrass", "uWorldRadius", "uSeed"]);

	gl.useProgram(floorProgram);

	const seed = Math.random() * 100.0;
	gl.uniform1f(floorUniforms.uSeed, seed);

	const sunDir = vec3.fromValues(2.0, 1.0, 1.0);
	vec3.normalize(sunDir, sunDir);

	gl.uniform3fv(floorUniforms.uLightDir, sunDir);
	gl.uniform3f(floorUniforms.uLightColor, 1.0, 0.99, 0.95);
	gl.uniform3f(floorUniforms.uAmbientColor, 0.25, 0.35, 0.45);

	// ---- Sun Setup ----
	const { program: sunProgram, uniforms: sunUniforms } = createShaderProgram(gl, sunVert, sunFrag, ["uModel", "uView", "uProj", "uSunColor"]);

	const sunModelMatrix = mat4.create();
	const sunDistance = 100.0;
	const sunPos = vec3.create();
	vec3.scale(sunPos, sunDir, sunDistance);
	const sunBillboardRot = mat4.create();

	const lightView = mat4.create();
	const lightProj = mat4.create();
	const lightVP = mat4.create();
	const lightOrthoSize = 80.0;

	// ---- Post-Processing Setup ----
	const { program: postProgram, uniforms: postUniforms } = createShaderProgram(gl, postVert, bloomFrag, ["uScene"]);

	const { program: shadowProgram, uniforms: shadowUniforms } = createShaderProgram(gl, shadowVert, shadowFrag, ["uModel", "uLightVP", "uSeed"]);

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

        gl.bindTexture(gl.TEXTURE_2D, sceneTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.bindRenderbuffer(gl.RENDERBUFFER, sceneDepth);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);

        gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFBO);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTex, 0);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, sceneDepth);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    }

	const SHADOW_MAP_SIZE = 2048;

	const shadowFBO      = gl.createFramebuffer();
	const shadowDepthTex = gl.createTexture();

	gl.bindTexture(gl.TEXTURE_2D, shadowDepthTex);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT16, SHADOW_MAP_SIZE, SHADOW_MAP_SIZE, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFBO);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowDepthTex, 0);
	// no color buffer
	gl.drawBuffers([gl.NONE]);
	gl.readBuffer(gl.NONE);

	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.bindTexture(gl.TEXTURE_2D, null);

    // call once now (canvas already resized earlier)
    resizeSceneTargets();

	// set shadow texel size (used for PCF sampling in shaders)
	gl.useProgram(floorProgram);
	gl.uniform2f(floorUniforms.uShadowTexelSize, 1.0 / SHADOW_MAP_SIZE, 1.0 / SHADOW_MAP_SIZE);

	// --- Matrices ---
	const viewMatrix = mat4.create();
	const modelMatrix = mat4.create();
	const projMatrix = mat4.create();
	Ma
	// rebuild viewtrix from cameraPos, yaw, pitch
	function updateViewMatrix() {
		const forward = vec3.fromValues(
			Math.cos(cameraState.yaw) * Math.cos(cameraState.pitch),
			Math.sin(cameraState.yaw) * Math.cos(cameraState.pitch),
			Math.sin(cameraState.pitch)
		);
		const target = vec3.create();
		vec3.add(target, smoothedCameraPos, forward);

		mat4.lookAt(viewMatrix, smoothedCameraPos, target, [0, 0, 1]); // Z-up
	}

	// call once to initialize
	updateViewMatrix();

	const out = projMatrix;
	const fovy = Math.PI / 4; // 45 degrees
	const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
	const near = 0.1;
	const far = 200.0;

	mat4.perspective(out, fovy, aspect, near, far);
	addEventListeners(gl, keys, cameraState ,gravityEnabled, verticalVelocity, updateViewMatrix);
	
	const segments = 10;              // increase this for more resolution (e.g. 40, 80)
	const size     = 20.0;           

	const { verts, inds } = buildFloorGeometry(segments, size);
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

	const { vertices: sunVertices, indices: sunIndices } = buildSunGeometry();

	const sunVBO = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, sunVBO);
	gl.bufferData(gl.ARRAY_BUFFER, sunVertices, gl.STATIC_DRAW);

	const sunEBO = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sunEBO);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sunIndices, gl.STATIC_DRAW);

	render();

	function render(){
		const result = updateCamera({ keys, cameraState, gravityEnabled, verticalVelocity, cameraPos, seed, treePositions, updateViewMatrix, smoothedCameraPos, lastFDown, gravity, WORLD_RADIUS, applyGroundCollision, applyWorldBoundsCollision, applyTreeCollision });
		gravityEnabled = result.gravityEnabled;
		verticalVelocity = result.verticalVelocity;
		lastFDown = result.lastFDown;
		drawScene();
		requestAnimationFrame(render);
	}

	function drawScene() {
		// ---- Shadow Pass ----
		gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFBO);
        gl.viewport(0, 0, SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
        gl.enable(gl.DEPTH_TEST);
        gl.colorMask(false, false, false, false);   // depth only
        gl.clear(gl.DEPTH_BUFFER_BIT);

        // recompute light matrices (sunPos already defined earlier)
        const up = [0, 0, 1];
        mat4.lookAt(lightView, sunPos, [0, 0, 0], up);
        mat4.ortho(
            lightProj,
            -lightOrthoSize, lightOrthoSize,
            -lightOrthoSize, lightOrthoSize,
            1.0, 200.0
        );
        mat4.multiply(lightVP, lightProj, lightView);

        gl.useProgram(shadowProgram);
        gl.uniformMatrix4fv(shadowUniforms.uLightVP, false, lightVP);

        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(2.0, 4.0);

        // ---- draw ball into shadow map ----
        treePositions.forEach(([xCoord, yCoord]) => {
            const model = mat4.create();
            const ground = getHeightAt(xCoord, yCoord, seed);
            mat4.translate(model, model, [xCoord, yCoord + 11, ground + 3]);
            mat4.rotateX(model, model, Math.PI / 2);
            mat4.scale(model, model, [3, 3, 3]);

            gl.uniformMatrix4fv(shadowUniforms.uModel, false, model);

            gl.bindBuffer(gl.ARRAY_BUFFER, ballVBO);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(0);

            gl.drawArrays(gl.TRIANGLES, 0, ballData.vertexCount);
        });

        // ---- draw stems into shadow map ----
        treePositions.forEach(([xCoord, yCoord]) => {
            const model = mat4.create();
            const ground = getHeightAt(xCoord, yCoord, seed);
            mat4.translate(model, model, [xCoord, yCoord, ground]);
            mat4.rotateX(model, model, Math.PI / 2);
            mat4.scale(model, model, [3, 3, 3]);

            gl.uniformMatrix4fv(shadowUniforms.uModel, false, model);

            gl.bindBuffer(gl.ARRAY_BUFFER, stemVBO);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(0);

            gl.drawArrays(gl.TRIANGLES, 0, stemData.vertexCount);
        });

		// ---- draw floor into shadow map (so grass heightfield casts shadows) ----
		// local tile params (match the ones used in the main pass)
		const tileSize_shadow = 20.0;
		const gridRadius_shadow = 9;

		gl.bindBuffer(gl.ARRAY_BUFFER, floorVBO);
		// floor VBO layout: 3 pos, 2 uv => stride = 5 * 4
		gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 5 * 4, 0);
		gl.enableVertexAttribArray(0);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, floorEBO);

		// ensure seed matches grass shader noise
		gl.uniform1f(shadowUniforms.uSeed, seed);

		drawFloorTiles(gl, shadowUniforms, modelMatrix, tileSize_shadow, gridRadius_shadow, floorIndices, mat4);

		gl.disable(gl.POLYGON_OFFSET_FILL);
        gl.colorMask(true, true, true, true);

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

		gl.uniform3fv(ballUniforms.uLightDir, sunDir);

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

		const shellCount = 1000;

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
		gl.uniform3fv(stemUniforms.uLightDir, sunDir);
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

		// place sun at its world position
		mat4.translate(sunModelMatrix, sunModelMatrix, sunPos);

		// build a rotation that cancels the camera rotation (billboard)
		mat4.copy(sunBillboardRot, viewMatrix);
		// remove translation from view matrix
		sunBillboardRot[12] = 0.0;
		sunBillboardRot[13] = 0.0;
		sunBillboardRot[14] = 0.0;
		// invert rotation to get camera orientation
		mat4.invert(sunBillboardRot, sunBillboardRot);

		// apply billboard rotation so quad faces camera
		mat4.multiply(sunModelMatrix, sunModelMatrix, sunBillboardRot);

		// scale to desired angular size
		const sunSize = 10.0;
		mat4.scale(sunModelMatrix, sunModelMatrix, [sunSize, sunSize, sunSize]);

		gl.useProgram(sunProgram);

		gl.uniformMatrix4fv(sunUniforms.uView, false, viewMatrix);
		gl.uniformMatrix4fv(sunUniforms.uProj, false, projMatrix);
		gl.uniformMatrix4fv(sunUniforms.uModel, false, sunModelMatrix);
		gl.uniform3f(sunUniforms.uSunColor, 1.0, 0.99, 0.95); // warm color

		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		// configure attributes for sun (same as before)
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

		gl.uniformMatrix4fv(floorUniforms.uLightVP, false, lightVP);

		gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, shadowDepthTex);
        gl.uniform1i(floorUniforms.uShadowMap, 1);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, grassTexture);
		gl.uniform1i(floorUniforms.uGrass, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, floorVBO);
		gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 5 * 4, 0);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 5 * 4, 3 * 4);
		gl.enableVertexAttribArray(1);

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, floorEBO);

		const tileSize = 20.0;     // your quad covers -10..10 ⇒ size 20
		const gridRadius = 9;      // draws (2*4+1)^2 = 81 tiles

		drawFloorTiles(gl, floorUniforms, modelMatrix, tileSize, gridRadius, floorIndices, mat4);

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
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