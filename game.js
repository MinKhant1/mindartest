AFRAME.registerComponent('collector-game', {
  init: function () {
    this.score = 0;
    this.targets = [];
    this.vels = [];
    this.pops = [];
    this.collected = [];
    this.entered = [];
    this.playing = false;
    this.waveTimer = 0;
    this.waveIntervalMs = 7000;
    this.waveSize = 12;
    this.nose = document.querySelector('#nose');
    this.hudScore = document.getElementById('score');
    var startBtn = document.getElementById('start');
    var startScreen = document.getElementById('start-screen');
    startBtn.addEventListener('click', () => {
      if (startScreen) {
        startScreen.style.opacity = '0';
        setTimeout(() => { startScreen.style.display = 'none'; }, 500);
      } else {
        startBtn.style.display = 'none';
      }
      this.reset();
      this.startGame();
    });
  },
  reset: function () {
    for (var i = 0; i < this.targets.length; i++) {
      var t = this.targets[i];
      if (t && t.parentNode) t.parentNode.removeChild(t);
    }
    this.targets = [];
    this.vels = [];
    this.collected = [];
    this.entered = [];
    this.score = 0;
    this.hudScore.textContent = '0';
    for (var k = 0; k < this.pops.length; k++) {
      var p = this.pops[k];
      if (p && p.entity && p.entity.parentNode) p.entity.parentNode.removeChild(p.entity);
    }
    this.pops = [];
    this.waveTimer = 0;
  },
  rand: function (min, max) {
    return Math.random() * (max - min) + min;
  },
  getFrustumSize: function (distance) {
    var scene = this.el.sceneEl;
    var cam = scene && scene.camera;
    var fov = cam.fov * Math.PI / 180;
    var height = 2 * Math.tan(fov / 2) * distance;
    var width = height * cam.aspect;
    return { width: width, height: height };
  },
  worldFromCameraOffset: function (x, y, zDist) {
    var scene = this.el.sceneEl;
    var cam = scene && scene.camera;
    var local = new THREE.Vector3(x, y, -zDist);
    return cam.localToWorld(local);
  },
  startGame: function () {
    var tryStart = () => {
      var scene = this.el.sceneEl;
      var cam = scene && scene.camera;
      if (cam) {
        this.spawnTargets(this.waveSize);
        this.playing = true;
        this.waveTimer = 0;
      } else {
        setTimeout(tryStart, 100);
      }
    };
    tryStart();
  },
  worldFromNDC: function (nx, ny, distance) {
    var scene = this.el.sceneEl;
    var cam = scene && scene.camera;
    if (!cam) return new THREE.Vector3(0, 0, -distance);
    var p = new THREE.Vector3(nx, ny, 0.5).unproject(cam);
    var dir = p.clone().sub(cam.position).normalize();
    return cam.position.clone().add(dir.multiplyScalar(distance));
  },
  isOffScreen: function (ndc, margin) {
    var m = margin || 0;
    return ndc.x < -1 - m || ndc.x > 1 + m || ndc.y < -1 - m || ndc.y > 1 + m;
  },
  spawnTargets: function (n) {
    var scene = this.el.sceneEl;
    var cam = scene && scene.camera;
    if (!cam) return;
    for (var i = 0; i < n; i++) {
      var e = document.createElement('a-sphere');
      e.setAttribute('color', '#ff3b3b');
      e.setAttribute('radius', '0.06');
      var side = Math.floor(this.rand(0, 4));
      var distance = this.rand(0.7, 1.1);
      var fr = this.getFrustumSize(distance);
      var x, y;
      if (side === 0) { // left
        x = -(fr.width / 2 + 0.12);
        y = this.rand(-fr.height / 2, fr.height / 2);
      } else if (side === 1) { // right
        x = (fr.width / 2 + 0.12);
        y = this.rand(-fr.height / 2, fr.height / 2);
      } else if (side === 2) { // bottom
        y = -(fr.height / 2 + 0.12);
        x = this.rand(-fr.width / 2, fr.width / 2);
      } else { // top
        y = (fr.height / 2 + 0.12);
        x = this.rand(-fr.width / 2, fr.width / 2);
      }
      var startWorld = this.worldFromCameraOffset(x, y, distance);
      e.object3D.position.copy(startWorld);
      e.setAttribute('material', 'shader: standard; metalness: 0; roughness: 1; opacity: 1; transparent: false; depthTest: true; depthWrite: true; side: double');
      this.el.appendChild(e);
      this.targets.push(e);
      this.collected.push(false);
      this.entered.push(false);
      var inX = this.rand(-fr.width * 0.35, fr.width * 0.35);
      var inY = this.rand(-fr.height * 0.35, fr.height * 0.35);
      var inWorld = this.worldFromCameraOffset(inX, inY, distance);
      var dir = inWorld.clone().sub(startWorld).normalize();
      var speed = this.rand(0.12, 0.25);
      this.vels.push(dir.multiplyScalar(speed));
    }
  },
  spawnPop: function (pos) {
    var e = document.createElement('a-ring');
    e.setAttribute('color', '#ffd54f');
    e.setAttribute('radius-inner', '0.02');
    e.setAttribute('radius-outer', '0.04');
    e.setAttribute('material', 'transparent: true; opacity: 0.8; depthTest: false; depthWrite: false');
    e.setAttribute('position', pos.x + ' ' + pos.y + ' ' + pos.z);
    this.el.appendChild(e);
    e.object3D.renderOrder = 10;
    this.pops.push({ entity: e, elapsed: 0, duration: 300 });
  },
  tick: function (time, dt) {
    if (!this.playing) return;
    if (!this.nose) return;
    var scene = this.el.sceneEl;
    var cam = scene && scene.camera;
    if (!cam) return;
    scene.object3D.updateMatrixWorld(true);
    cam.updateMatrixWorld(true);
    var nosePos = new THREE.Vector3();
    this.nose.object3D.getWorldPosition(nosePos);
    var noseNDC = nosePos.clone().project(cam);
    for (var i = 0; i < this.targets.length; i++) {
      var t = this.targets[i];
      if (!t) continue;
      var tp = new THREE.Vector3();
      t.object3D.getWorldPosition(tp);
      var targetNDC = tp.clone().project(cam);
      var dx = noseNDC.x - targetNDC.x;
      var dy = noseNDC.y - targetNDC.y;
      var dist2d = Math.sqrt(dx * dx + dy * dy);
      if (dist2d < 0.07 && !this.collected[i]) {
        this.collected[i] = true;
        t.setAttribute('color', '#66ff66');
        this.spawnPop(tp);
        this.score += 1;
        this.hudScore.textContent = String(this.score);
        var distance = tp.clone().sub(cam.position).length();
        var outDir2 = new THREE.Vector2(targetNDC.x, targetNDC.y);
        if (outDir2.length() < 0.001) outDir2.set(0, 1);
        outDir2.normalize();
        var endNDCx = outDir2.x * 1.3;
        var endNDCy = outDir2.y * 1.3;
        var endWorld = this.worldFromNDC(endNDCx, endNDCy, distance);
        var outDir = endWorld.clone().sub(tp).normalize();
        this.vels[i] = outDir.multiplyScalar(0.6);
      }
      var v = this.vels[i];
      if (v) {
        t.object3D.position.addScaledVector(v, dt / 1000);
      }
      var tp2 = new THREE.Vector3();
      t.object3D.getWorldPosition(tp2);
      var ndc = tp2.clone().project(cam);
      if (!this.entered[i] && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1) {
        this.entered[i] = true;
      }
      if (this.entered[i] && this.isOffScreen(ndc, 0.15)) {
        if (t.parentNode) t.parentNode.removeChild(t);
        this.targets[i] = null;
      }
    }
    var remaining = 0;
    for (var j = 0; j < this.targets.length; j++) {
      if (this.targets[j]) remaining++;
    }
    if (remaining === 0) {
      this.spawnTargets(this.waveSize);
    }
    this.waveTimer += dt;
    if (this.waveTimer >= this.waveIntervalMs) {
      this.waveTimer = 0;
      this.spawnTargets(this.waveSize);
    }
    if (dt > 0 && this.pops.length) {
      for (var m = 0; m < this.pops.length; m++) {
        var pop = this.pops[m];
        if (!pop || !pop.entity) continue;
        pop.elapsed += dt;
        var tprog = Math.min(1, pop.elapsed / pop.duration);
        var s = 1 + tprog * 2;
        pop.entity.object3D.scale.set(s, s, s);
        var o = Math.max(0, 0.8 * (1 - tprog));
        pop.entity.setAttribute('material', 'transparent: true; opacity: ' + o);
        if (tprog >= 1) {
          if (pop.entity.parentNode) pop.entity.parentNode.removeChild(pop.entity);
          this.pops[m] = null;
        }
      }
      var compact = [];
      for (var n = 0; n < this.pops.length; n++) {
        if (this.pops[n]) compact.push(this.pops[n]);
      }
      this.pops = compact;
    }
  }
});