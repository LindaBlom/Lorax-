const vec3 = glMatrix.vec3;

export function updateCamera(params) {
    let { keys, cameraState, gravityEnabled, verticalVelocity, cameraPos, seed, treePositions, updateViewMatrix, smoothedCameraPos, lastFDown, gravity, WORLD_RADIUS, applyGroundCollision, applyWorldBoundsCollision, applyTreeCollision } = params;

    let speed = 0.2;
    if (keys["shift"]) speed = 0.4;

    if (keys["f"] && !lastFDown) {
        gravityEnabled = !gravityEnabled;
    }
    lastFDown = keys["f"];

    if (keys[" "]) {
        verticalVelocity = 0.5; // jump
    }

    if (gravityEnabled) {
        verticalVelocity += gravity;         // accelerate downward
        cameraPos[2] += verticalVelocity;    // apply vertical motion
    } else {
        verticalVelocity = 0;  // no gravity = no vertical speed
    }

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
    verticalVelocity = applyGroundCollision(cameraPos, verticalVelocity, seed);
    applyWorldBoundsCollision(cameraPos, WORLD_RADIUS);
    applyTreeCollision(cameraPos, treePositions, seed);

    const smoothing = 0.15; // 0.05 = very smooth, 0.3 = more snappy

    for (let i = 0; i < 3; i++) {
        smoothedCameraPos[i] += (cameraPos[i] - smoothedCameraPos[i]) * smoothing;
    }

    updateViewMatrix();

    return { gravityEnabled, verticalVelocity, lastFDown };
}