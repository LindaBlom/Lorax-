const vec3 = glMatrix.vec3;

export function updateCamera(params) {
    let {keys, cameraState, gravityEnabled, verticalVelocity, cameraPos, seed, treePositions, updateViewMatrix, smoothedCameraPos, lastFDown, gravity, WORLD_RADIUS, applyGroundCollision, applyWorldBoundsCollision, applyTreeCollision, deltaTime, fluffyGrass, lastGDown} = params;

    const dt = Math.min(Math.max(deltaTime || 0, 0), 0.05);

    const baseSpeed = 8.0; 
    const moveSpeed = baseSpeed * (keys["shift"] ? 2.0 : 1.0);
    

    if (keys["f"] && !lastFDown) {
        gravityEnabled = !gravityEnabled;
    }
    lastFDown = keys["f"];

    if (keys["g"] && !lastGDown) {
        fluffyGrass = !fluffyGrass;
    }
    lastGDown = keys["g"];

    if (keys[" "] && gravityEnabled && Math.abs(verticalVelocity) < 0.001){
        verticalVelocity = 30.0; // jump
    }

    if (gravityEnabled) {
        verticalVelocity += (gravity * dt);         // accelerate downward
        cameraPos[2] += (verticalVelocity * dt);    // apply vertical motion
    } else {
        verticalVelocity = 0;  // no gravity = no vertical speed
    }

    const forward = vec3.fromValues(Math.cos(cameraState.yaw), Math.sin(cameraState.yaw), 0);
    const right   = vec3.fromValues(forward[1], -forward[0], 0);
    const step = moveSpeed * dt;

    if (keys["w"]) {
        vec3.scaleAndAdd(cameraPos, cameraPos, forward, step);
    }
    if (keys["s"]) {
        vec3.scaleAndAdd(cameraPos, cameraPos, forward, -step);
    }
    if (keys["a"]) {
        vec3.scaleAndAdd(cameraPos, cameraPos, right, -step);
    }
    if (keys["d"]) {
        vec3.scaleAndAdd(cameraPos, cameraPos, right, step);
    }
    if (keys["e"] && !gravityEnabled) {
        cameraPos[2] += step;
    }
    if (keys["q"] && !gravityEnabled) {
        cameraPos[2] -= step;
    }

    const rotationSpeed = 1.5 * dt;
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
    verticalVelocity = applyGroundCollision(cameraPos, verticalVelocity, seed);
    applyWorldBoundsCollision(cameraPos, WORLD_RADIUS);
    applyTreeCollision(cameraPos, treePositions, seed);

    const smoothingPerSecond = 12.0;
    const alpha = 1.0 - Math.exp(-smoothingPerSecond * dt);

    for (let i = 0; i < 3; i++) {
        smoothedCameraPos[i] += (cameraPos[i] - smoothedCameraPos[i]) * alpha;
    }

    updateViewMatrix();

    return {gravityEnabled, verticalVelocity, lastFDown, fluffyGrass, lastGDown};
}