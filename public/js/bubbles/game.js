const Game = {
  canvas: null,
  ctx: null,
  state: 'idle',
  mode: 'en2cn',
  words: [],
  score: 0,
  lives: 3,
  combo: 0,
  distance: 0,
  speed: 3,
  maxSpeed: 8,
  gravity: 0.5,
  groundY: 0,
  width: 0,
  height: 0,

  sponge: null,
  obstacles: [],
  jellyfish: [],
  bubbles: [],
  bgOffset: 0,
  particles: [],
  shakeTimer: 0,
  spawnTimer: 0,
  jellySpawnTimer: 0,
  animFrame: 0,
  difficultyTimer: 0,
  answeredWords: new Set(),
  currentQuestion: null,
  gameLoopId: null,
  keys: {},

  _initialized: false,

  init(canvas, onEvent) {
    if (this._initialized) return;
    this._initialized = true;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onEvent = onEvent;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (['Space', 'ArrowUp'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    canvas.addEventListener('mousedown', () => { if (this.state === 'playing') this.jump(); });
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); if (this.state === 'playing') this.jump(); });
  },

  resize() {
    const parent = this.canvas.parentElement;
    this.width = parent.clientWidth;
    this.height = parent.clientHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.groundY = this.height - 80;
  },

  start(mode, words) {
    this.mode = mode;
    this.words = [...words];
    this.resize();
    this.score = 0;
    this.lives = 3;
    this.combo = 0;
    this.comboSinceBoost = 0;
    this.distance = 0;
    this.speed = 3;
    this.answeredWords.clear();
    this.currentQuestion = null;
    this.obstacles = [];
    this.jellyfish = [];
    this.bubbles = [];
    this.particles = [];
    this.scorePopups = [];
    this.centerTexts = [];
    this.points = { distance: 0, catch: 0, answer: 0, comboBonus: 0 };
    this.spawnTimer = 0;
    this.jellySpawnTimer = 0;
    this.difficultyTimer = 0;
    this.shakeTimer = 0;
    this.invincibleTimer = 0;
    this.speedBoostTimer = 0;
    this.savedSpeed = 3;
    this.questionTimer = 0;
    this.bgOffset = 0;
    this.animFrame = 0;

    this.sponge = {
      x: 120,
      y: this.groundY - 50,
      w: 36,
      h: 48,
      vy: 0,
      vx: 0,
      grounded: true,
      canDoubleJump: true,
      frame: 0,
      frameTimer: 0,
    };

    this.state = 'playing';
    this.gameLoop();
  },

  stop() {
    this.state = 'idle';
    if (this.gameLoopId) {
      cancelAnimationFrame(this.gameLoopId);
      this.gameLoopId = null;
    }
  },

  gameLoop() {
    if (this.state === 'idle') return;
    this.update();
    this.render();
    this.gameLoopId = requestAnimationFrame(() => this.gameLoop());
  },

  jump() {
    if (this.state !== 'playing') return;
    if (this.sponge.grounded) {
      this.sponge.vy = -14;
      this.sponge.vx = 1.8;
      this.sponge.grounded = false;
      this.sponge.canDoubleJump = true;
      AudioManager.playJump();
      this.emitParticles(this.sponge.x + 18, this.groundY, 5, '#c8a96e');
    } else if (this.sponge.canDoubleJump) {
      this.sponge.vy = -12;
      this.sponge.vx = 1.5;
      this.sponge.canDoubleJump = false;
      AudioManager.playJump();
      this.emitParticles(this.sponge.x + 18, this.sponge.y + 48, 5, '#c8a96e');
    }
  },

  emitParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 3 - 1,
        life: 30 + Math.random() * 20,
        maxLife: 50,
        size: 2 + Math.random() * 3,
        color,
      });
    }
  },

  addScorePopup(x, y, text, color) {
    this.scorePopups.push({
      x, y,
      text,
      color,
      vy: -2.5,
      life: 50,
      maxLife: 50,
      size: 16,
    });
  },

  update() {
    this.animFrame++;
    this.difficultyTimer++;

    // Invincible speed boost
    if (this.invincibleTimer > 0) {
      if (this.invincibleTimer === 180) this.savedSpeed = Math.max(3, this.speed);
      this.invincibleTimer--;
      this.speed = 7;
      this.speedBoostTimer--;
      if (this.speedBoostTimer <= 0) this.speed = this.savedSpeed;
    }

    // Increase difficulty
    if (this.difficultyTimer % 600 === 0 && this.speed < this.maxSpeed) {
      this.speed += 0.3;
    }

    const dt = 1;
    const s = this.sponge;

    // Gravity + parabolic horizontal arc
    s.vy += this.gravity;
    s.y += s.vy;
    if (!s.grounded) {
      s.x += s.vx;
      s.vx = Math.max(0, s.vx - 0.1);
    }

    // Ground collision
    if (s.y >= this.groundY - s.h) {
      s.y = this.groundY - s.h;
      s.vy = 0;
      s.vx = 0;
      s.grounded = true;
      s.canDoubleJump = true;
    }

    // Running animation
    s.frameTimer++;
    if (s.frameTimer > 6) {
      s.frameTimer = 0;
      s.frame = (s.frame + 1) % 4;
    }

    // Emit running dust
    if (s.grounded && this.animFrame % 8 === 0) {
      this.emitParticles(s.x + 5, this.groundY, 2, '#c8a96e');
    }

    // Background scroll
    this.bgOffset = (this.bgOffset + this.speed * 0.3) % this.width;

    // Update score popups
    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      const p = this.scorePopups[i];
      p.y += p.vy;
      p.vy *= 0.97;
      p.life--;
      if (p.life <= 0) this.scorePopups.splice(i, 1);
    }

    // Update center text animations
    for (let i = this.centerTexts.length - 1; i >= 0; i--) {
      const ct = this.centerTexts[i];
      const progress = 1 - ct.life / ct.maxLife;
      ct.scale = Math.min(1.5, progress * 3);
      ct.alpha = progress < 0.3 ? progress / 0.3 : 1 - (progress - 0.3) / 0.7;
      ct.life--;
      if (ct.life <= 0) this.centerTexts.splice(i, 1);
    }

    // Slow movement during question (urgency)
    const moveScale = this.state === 'question' ? 0.2 : 1;
    const spawnScale = this.state === 'question' ? 0.3 : 1;

    // Spawn obstacles (reduced during question)
    this.spawnTimer++;
    const spawnInterval = Math.max(100, 200 - this.speed * 10) / spawnScale;
    if (this.spawnTimer >= spawnInterval) {
      this.spawnTimer = 0;
      this.spawnObstacle();
    }

    // Spawn jellyfish (reduced during question)
    this.jellySpawnTimer++;
    if (this.jellySpawnTimer >= Math.max(60, 180 - this.speed * 10) / spawnScale) {
      this.jellySpawnTimer = 0;
      this.spawnJellyfish();
    }

    // Update obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x -= this.speed * moveScale;
      if (obs.x + obs.w < 0) {
        this.obstacles.splice(i, 1);
        continue;
      }
      // Collision (only when not in question to avoid unfair hits)
      if (this.state !== 'question' && this.rectCollide(s, obs)) {
        this.hit();
      }
    }

    // Update jellyfish
    for (let i = this.jellyfish.length - 1; i >= 0; i--) {
      const j = this.jellyfish[i];
      j.x -= this.speed * moveScale;
      j.bobTimer += 0.03;
      j.displayY = j.baseY + Math.sin(j.bobTimer) * 8;
      if (j.x + 50 < 0) {
        this.jellyfish.splice(i, 1);
        continue;
      }
      if (this.state !== 'question' && this.rectCollide(s, { x: j.x + 5, y: j.displayY + 5, w: 40, h: 40 })) {
        this.catchJellyfish(j);
        this.jellyfish.splice(i, 1);
      }
    }

    // Question timer (15 seconds = 900 frames at 60fps)
    if (this.state === 'question') {
      this.questionTimer++;
      if (this.questionTimer >= 900) {
        this.answerQuestion(null);
      }
    }

    // Quick-start: obstacles and jellyfish already on screen to avoid empty road
    if (this.animFrame === 1) {
      for (let i = 0; i < 2; i++) {
        this.obstacles.push({
          type: ['rock', 'anemone'][i],
          x: this.width * 0.5 + i * 260,
          y: this.groundY - 35,
          w: 32, h: 35,
        });
      }
      const word = this.words.find(w => !this.answeredWords.has(w.en)) || this.words[0];
      if (word) {
        this.jellyfish.push({
          word,
          x: this.width * 0.75,
          baseY: this.groundY - 110,
          displayY: this.groundY - 110,
          bobTimer: 0,
        });
      }
      this.spawnTimer = Math.max(0, Math.max(100, 200 - this.speed * 10) - 40);
      this.jellySpawnTimer = Math.max(0, Math.max(60, 180 - this.speed * 10) - 30);
    }

    // Background bubbles (visual only, runs even during question)
    if (this.animFrame % 15 === 0) {
      this.bubbles.push({
        x: Math.random() * this.width,
        y: this.height + 10,
        r: 2 + Math.random() * 6,
        speed: 0.3 + Math.random() * 0.5,
        wobble: Math.random() * Math.PI * 2,
      });
    }

    // Update distance scoring
    this.distance += 0.1;
    if (this.animFrame % 10 === 0) {
      this.score += 1;
      this.points.distance += 1;
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life--;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Update bubbles
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.y -= b.speed;
      b.wobble += 0.02;
      b.x += Math.sin(b.wobble) * 0.3;
      if (b.y + b.r < 0) this.bubbles.splice(i, 1);
    }

    // Shake timer
    if (this.shakeTimer > 0) this.shakeTimer--;
  },

  rectCollide(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  },

  spawnObstacle() {
    // Cap total obstacles to prevent screen flooding
    if (this.obstacles.length > 5) return;
    const types = ['coral', 'rock', 'anemone', 'urchin', 'chest', 'patty'];
    const type = types[Math.floor(Math.random() * types.length)];
    const h = type === 'patty' ? 50 : type === 'chest' ? 35 : 30 + Math.random() * 20;
    // Avoid spawning on jellyfish
    let safeX = this.width + 20;
    for (const j of this.jellyfish) {
      if (Math.abs(j.x - safeX) < 120) {
        safeX = Math.max(safeX, j.x + 140);
      }
    }
    this.obstacles.push({
      type,
      x: safeX,
      y: this.groundY - h,
      w: type === 'patty' ? 30 : type === 'chest' ? 36 : 28 + Math.random() * 12,
      h,
    });
  },

  spawnJellyfish() {
    const available = this.words.filter(w => !this.answeredWords.has(w.en));
    if (available.length === 0) return;

    const word = available[Math.floor(Math.random() * available.length)];
    // Different heights: ground level, mid, high (needs double jump)
    const heights = [
      this.groundY - 80,
      this.groundY - 130,
      this.groundY - 180,
    ];
    const baseY = heights[Math.floor(Math.random() * heights.length)];

    // Ensure jellyfish doesn't overlap with obstacles
    let safeX = this.width + 120;
    for (const obs of this.obstacles) {
      if (Math.abs(obs.x - safeX) < 100) {
        safeX = obs.x + 150;
      }
    }

    this.jellyfish.push({
      word,
      x: safeX,
      baseY,
      displayY: baseY,
      bobTimer: Math.random() * Math.PI * 2,
    });
  },

  catchJellyfish(jelly) {
    AudioManager.playCatch();
    this.score += 30;
    this.points.catch += 30;
    this.addScorePopup(jelly.x + 15, jelly.displayY, '+30', '#ff69b4');
    this.emitParticles(jelly.x + 25, jelly.displayY + 25, 12, '#ff69b4');

    const word = jelly.word;
    const isEn2Cn = this.mode === 'en2cn';

    this.currentQuestion = {
      word,
      prompt: isEn2Cn ? word.en : word.cn,
      answer: isEn2Cn ? word.cn : word.en,
      options: this.generateOptions(word, isEn2Cn),
    };

    this.questionTimer = 0;
    this.state = 'question';
    if (this.onEvent) this.onEvent('question', this.currentQuestion);
  },

  generateOptions(correct, isEn2Cn) {
    const correctAnswer = isEn2Cn ? correct.cn : correct.en;
    const pool = isEn2Cn
      ? BUBBLES_IELTS_WORDS.map(w => w.cn).filter(c => c !== correctAnswer)
      : BUBBLES_IELTS_WORDS.map(w => w.en).filter(e => e !== correctAnswer);

    const options = [correctAnswer];
    while (options.length < 4) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (!options.includes(pick)) options.push(pick);
    }
    // Shuffle
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return options;
  },

  answerQuestion(selected) {
    if (this.state !== 'question') return;
    const correct = selected !== null && selected === this.currentQuestion.answer;

    if (correct) {
      this.combo++;
      this.comboSinceBoost++;
      const bonus = Math.min(this.combo, 10);
      const basePts = 50;
      const bonusPts = bonus * 15;
      this.score += basePts + bonusPts;
      this.points.answer += basePts;
      this.points.comboBonus += bonusPts;
      const popupText = bonusPts > 0 ? `+${basePts} +${bonusPts}x` : `+${basePts}`;
      this.addScorePopup(this.sponge.x + 18, this.sponge.y - 10, popupText, '#ffd700');
      AudioManager.playCorrect();
      this.emitParticles(this.sponge.x + 18, this.sponge.y, 15, '#ffd700');
      this.answeredWords.add(this.currentQuestion.word.en);

      // Every 5 correct answers since last boost = invincible speed boost!
      if (this.comboSinceBoost >= 5) {
        this.comboSinceBoost = 0;
        this.invincibleTimer = 180;
        this.speedBoostTimer = 180;
        AudioManager.playSpeedBoost();
        this.emitParticles(this.sponge.x + 18, this.sponge.y, 20, '#00ffff');
        this.addScorePopup(this.sponge.x + 18, this.sponge.y - 30, '⚡ INVINCIBLE!', '#00ffff');
        // Center screen "EXTREME SPEED" announcement
        this.centerTexts.push({
          text: 'E X T R E M E   S P E E D',
          scale: 0,
          alpha: 1,
          life: 80,
          maxLife: 80,
        });
      }
    } else {
      this.combo = 0;
      this.comboSinceBoost = 0;
      this.lives -= 0.5;
      AudioManager.playWrong();
      this.shakeTimer = 10;
      this.addScorePopup(this.sponge.x + 18, this.sponge.y - 10, '✕ -0.5❤️', '#ff4444');
    }

    this.questionTimer = 0;
    this.currentQuestion = null;
    this.state = 'playing';

    if (this.onEvent) this.onEvent('answered');

    if (this.lives <= 0) {
      this.gameOver();
    }
  },

  hit() {
    if (this.shakeTimer > 0 || this.invincibleTimer > 0) return;
    this.lives--;
    this.shakeTimer = 20;
    this.speed = Math.max(3, this.speed - 0.5);
    AudioManager.playHit();
    this.emitParticles(this.sponge.x + 18, this.sponge.y + 24, 10, '#ff4444');

    // Remove obstacle that was hit
    if (this.obstacles.length > 0) {
      this.obstacles.shift();
    }

    if (this.lives <= 0) {
      this.gameOver();
    }
  },

  gameOver() {
    this.state = 'gameover';
    AudioManager.stopOcean();
    if (this.onEvent) {
      this.onEvent('gameover', {
        score: this.score,
        points: this.points,
        distance: Math.floor(this.distance),
        learned: this.answeredWords.size,
        total: this.words.length,
      });
    }
  },

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.save();

    // Screen shake
    if (this.shakeTimer > 0) {
      const intensity = this.shakeTimer * 0.5;
      ctx.translate(
        (Math.random() - 0.5) * intensity,
        (Math.random() - 0.5) * intensity
      );
    }

    // Sky gradient (ocean surface to deep)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#4dc9f6');
    skyGrad.addColorStop(0.3, '#38b0e0');
    skyGrad.addColorStop(0.7, '#1a8bbf');
    skyGrad.addColorStop(1, '#0d5a7a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Light rays from surface
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < 5; i++) {
      const rx = (this.bgOffset * 0.1 + i * 200) % (w + 200) - 100;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(rx, 0);
      ctx.lineTo(rx + 30, h);
      ctx.lineTo(rx + 10, h);
      ctx.lineTo(rx - 10, 0);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Draw seaweed background
    this.drawSeaweed(ctx);

    // Sandy ground
    ctx.fillStyle = '#d4a76a';
    ctx.fillRect(0, this.groundY, w, h - this.groundY);
    ctx.fillStyle = '#c89b5e';
    for (let i = 0; i < w; i += 30) {
      const sx = (i + this.bgOffset * 0.5) % w;
      ctx.fillRect(sx, this.groundY + 5, 15, 3);
    }

    // Ground top edge
    ctx.fillStyle = '#8a6e42';
    ctx.fillRect(0, this.groundY - 3, w, 4);

    // Background bubbles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for (const b of this.bubbles) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Obstacles
    for (const obs of this.obstacles) {
      this.drawObstacle(ctx, obs);
    }

    // Jellyfish
    for (const j of this.jellyfish) {
      this.drawJellyfish(ctx, j);
    }

    // SpongeBob
    this.drawSpongeBob(ctx);

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // HUD
    this.drawHUD(ctx);

    // Center text animations (e.g. "EXTREME SPEED")
    for (const ct of this.centerTexts) {
      const s = ct.scale;
      ctx.save();
      ctx.translate(this.width / 2, this.height / 2);
      ctx.scale(s, s);
      ctx.globalAlpha = ct.alpha;
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.font = 'bold 48px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ct.text, 2, 2);
      // Rainbow stroke
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3;
      ctx.strokeText(ct.text, 0, 0);
      // Fill
      ctx.fillStyle = '#fff';
      ctx.fillText(ct.text, 0, 0);
      ctx.restore();
    }

    // Rainbow border during invincibility
    if (this.invincibleTimer > 0) {
      const w = this.width;
      const h = this.height;
      const bw = 20;
      const inset = 6;
      const colors = ['#ff0000','#ff8800','#ffdd00','#00cc44','#0088ff','#8800ff'];
      const phase = this.animFrame * 3;
      const alpha = 0.7 + Math.sin(this.animFrame * 0.08) * 0.3;

      // Draw thick border with glow
      for (let pass = 0; pass < 3; pass++) {
        const t = pass === 0 ? 28 : pass === 1 ? 20 : 12;
        ctx.lineWidth = t;
        ctx.lineCap = 'square';
        ctx.globalAlpha = pass === 0 ? alpha * 0.2 : pass === 1 ? alpha * 0.5 : alpha;

        // Top edge
        for (let i = 0; i < Math.ceil(w / bw) + 3; i++) {
          const x = i * bw - (phase % bw) - bw;
          const ci = Math.floor((i * bw + phase) / bw) % colors.length;
          ctx.strokeStyle = colors[ci];
          ctx.beginPath();
          ctx.moveTo(x, inset); ctx.lineTo(x + bw + 4, inset);
          ctx.stroke();
        }
        // Bottom edge
        for (let i = 0; i < Math.ceil(w / bw) + 3; i++) {
          const x = i * bw - (phase % bw) - bw;
          const ci = Math.floor((i * bw - phase) / bw) % colors.length;
          ctx.strokeStyle = colors[((ci % colors.length) + colors.length) % colors.length];
          ctx.beginPath();
          ctx.moveTo(x, h - inset); ctx.lineTo(x + bw + 4, h - inset);
          ctx.stroke();
        }
        // Left edge
        for (let i = 0; i < Math.ceil(h / bw) + 3; i++) {
          const y = i * bw - (phase % bw) - bw;
          const ci = Math.floor((i * bw + phase) / bw) % colors.length;
          ctx.strokeStyle = colors[ci];
          ctx.beginPath();
          ctx.moveTo(inset, y); ctx.lineTo(inset, y + bw + 4);
          ctx.stroke();
        }
        // Right edge
        for (let i = 0; i < Math.ceil(h / bw) + 3; i++) {
          const y = i * bw - (phase % bw) - bw;
          const ci = Math.floor((i * bw - phase) / bw) % colors.length;
          ctx.strokeStyle = colors[((ci % colors.length) + colors.length) % colors.length];
          ctx.beginPath();
          ctx.moveTo(w - inset, y); ctx.lineTo(w - inset, y + bw + 4);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  },

  drawSeaweed(ctx) {
    const baseX = [80, 250, 420, 600, 750];
    for (const bx of baseX) {
      const ox = (bx - this.bgOffset * 0.2) % this.width;
      if (ox < -30) continue;
      ctx.fillStyle = '#2d8a4e';
      for (let i = 0; i < 3; i++) {
        const sway = Math.sin(this.animFrame * 0.02 + i * 0.5) * 8;
        ctx.beginPath();
        ctx.moveTo(ox + i * 10 - 5 + sway, this.groundY);
        ctx.quadraticCurveTo(
          ox + i * 10 + sway - 10, this.groundY - 60 - i * 20,
          ox + i * 10 + sway, this.groundY - 80 - i * 25
        );
        ctx.lineTo(ox + i * 10 + sway + 5, this.groundY - 80 - i * 25);
        ctx.quadraticCurveTo(
          ox + i * 10 + sway, this.groundY - 50 - i * 20,
          ox + i * 10 + sway + 5, this.groundY
        );
        ctx.fill();
      }
    }
  },

  drawObstacle(ctx, obs) {
    const { x, y, w, h, type } = obs;
    if (type === 'coral') {
      ctx.fillStyle = '#cd5c5c';
      ctx.strokeStyle = '#8b3a3a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      ctx.lineTo(x + w * 0.3, y + h * 0.3);
      ctx.lineTo(x + w * 0.5, y + h * 0.5);
      ctx.lineTo(x + w * 0.7, y + h * 0.2);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Coral dots
      ctx.fillStyle = '#ff7a7a';
      ctx.beginPath();
      ctx.arc(x + w * 0.3, y + h * 0.3 + 5, 3, 0, Math.PI * 2);
      ctx.arc(x + w * 0.7, y + h * 0.2 + 5, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'rock') {
      ctx.fillStyle = '#7a7a7a';
      ctx.strokeStyle = '#5a5a5a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Rock texture
      ctx.fillStyle = '#8a8a8a';
      ctx.beginPath();
      ctx.arc(x + w * 0.3, y + h * 0.4, 4, 0, Math.PI * 2);
      ctx.arc(x + w * 0.7, y + h * 0.6, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'anemone') {
      ctx.fillStyle = '#ff6b9d';
      const stemW = 8;
      ctx.fillRect(x + w / 2 - stemW / 2, y, stemW, h);
      for (let i = 0; i < 5; i++) {
        const tx = x + w / 2 - stemW / 2 + (i / 4) * stemW;
        const sway = Math.sin(this.animFrame * 0.05 + i) * 5;
        ctx.strokeStyle = ['#ff8fab', '#ffb3c6', '#ff6b9d', '#ff8fab', '#ffb3c6'][i];
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(tx, y);
        ctx.quadraticCurveTo(tx + sway, y - 15, tx + sway * 1.5, y - 25);
        ctx.stroke();
      }
    } else if (type === 'urchin') {
      // Spiky sea urchin
      ctx.fillStyle = '#6a0dad';
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#4a0080';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Spikes
      ctx.strokeStyle = '#8a2be2';
      ctx.lineWidth = 2;
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2;
        const sx = x + w / 2 + Math.cos(angle) * w / 2;
        const sy = y + h / 2 + Math.sin(angle) * h / 2;
        const ex = x + w / 2 + Math.cos(angle) * (w / 2 + 6);
        const ey = y + h / 2 + Math.sin(angle) * (h / 2 + 6);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x + w / 2 - 3, y + h / 2 - 3, 3, 0, Math.PI * 2);
      ctx.arc(x + w / 2 + 3, y + h / 2 + 3, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'chest') {
      // Treasure chest
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(x, y + h * 0.3, w, h * 0.7);
      ctx.fillStyle = '#A0522D';
      ctx.fillRect(x - 2, y + h * 0.3, w + 4, 6);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(x + w / 2 - 4, y + h * 0.5, 8, 6);
      // Lid open/close animation
      const lidOpen = Math.sin(this.animFrame * 0.04) * 0.3 + 0.3;
      ctx.fillStyle = '#A0522D';
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.3);
      ctx.lineTo(x + w / 2, y + h * 0.3 - 20 * lidOpen);
      ctx.lineTo(x + w, y + h * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#6B3410';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (type === 'patty') {
      // Krabby Patty
      ctx.fillStyle = '#8B4513';
      ctx.beginPath();
      ctx.arc(x + w / 2, y + 8, w / 2 + 2, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#f4a460';
      ctx.fillRect(x + 2, y + 8, w - 4, h - 16);
      ctx.fillStyle = '#228B22';
      ctx.fillRect(x + 4, y + 14, w - 8, 4);
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(x + 4, y + 22, w - 8, 4);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(x + 4, y + 30, w - 8, 4);
      ctx.fillStyle = '#8B4513';
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h - 8, w / 2 + 2, 0, Math.PI);
      ctx.fill();
      // Sesame seeds
      ctx.fillStyle = '#fff8dc';
      ctx.beginPath();
      ctx.arc(x + w * 0.3, y + 4, 2, 0, Math.PI * 2);
      ctx.arc(x + w * 0.6, y + 3, 2, 0, Math.PI * 2);
      ctx.arc(x + w * 0.45, y + 6, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawJellyfish(ctx, j) {
    const x = j.x;
    const y = j.displayY;

    // Glow
    const glow = ctx.createRadialGradient(x + 25, y + 20, 5, x + 25, y + 20, 40);
    glow.addColorStop(0, 'rgba(255, 105, 180, 0.3)');
    glow.addColorStop(1, 'rgba(255, 105, 180, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x + 25, y + 20, 40, 0, Math.PI * 2);
    ctx.fill();

    // Dome
    ctx.fillStyle = '#ff69b4';
    ctx.strokeStyle = '#d44a8a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x + 25, y + 20, 22, 18, 0, Math.PI, 0);
    ctx.fill();
    ctx.stroke();

    // Dome spots
    ctx.fillStyle = '#ff9ecb';
    ctx.beginPath();
    ctx.arc(x + 18, y + 12, 4, 0, Math.PI * 2);
    ctx.arc(x + 32, y + 14, 3, 0, Math.PI * 2);
    ctx.arc(x + 25, y + 8, 3, 0, Math.PI * 2);
    ctx.fill();

    // Tentacles
    ctx.strokeStyle = '#ff69b4';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const tx = x + 10 + i * 10;
      const sway = Math.sin(j.bobTimer + i * 0.8) * 6;
      ctx.beginPath();
      ctx.moveTo(tx, y + 35);
      ctx.quadraticCurveTo(tx + sway, y + 50, tx + sway * 0.5, y + 65);
      ctx.stroke();
    }

    // Word label
    const label = j.word ? (this.state === 'playing' ? '?' : '') : '';
    if (j.word) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('⚡', x + 25, y + 5);
    }
  },

  drawSpongeBob(ctx) {
    const s = this.sponge;
    const x = s.x;
    const y = s.y;
    const w = s.w;
    const h = s.h;

    // Determine animation state
    const isJumping = !s.grounded;
    const runCycle = isJumping ? 0 : Math.sin(this.animFrame * 0.15) * 3;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, this.groundY + 2, w / 2 + 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs (behind body)
    const legOffset = isJumping ? 3 : Math.sin(this.animFrame * 0.15) * 4;
    ctx.strokeStyle = '#e8c800';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + 10, y + h - 4);
    ctx.lineTo(x + 8 + legOffset, y + h + 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 26, y + h - 4);
    ctx.lineTo(x + 28 - legOffset, y + h + 8);
    ctx.stroke();

    // Shoes
    ctx.fillStyle = '#4a2800';
    ctx.beginPath();
    ctx.ellipse(x + 8 + legOffset, y + h + 10, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 28 - legOffset, y + h + 10, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pants (brown)
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x, y + h * 0.6, w, h * 0.25);
    // Belt
    ctx.fillStyle = '#4a2800';
    ctx.fillRect(x, y + h * 0.6, w, 4);
    // Belt buckle
    ctx.fillStyle = '#d4a017';
    ctx.fillRect(x + w / 2 - 4, y + h * 0.6, 8, 5);
    ctx.fillStyle = '#333';
    ctx.fillRect(x + w / 2 - 1, y + h * 0.6 + 1, 2, 3);

    // Body (yellow sponge)
    ctx.fillStyle = '#f7e05e';
    ctx.strokeStyle = '#d4a017';
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, x, y + h * 0.2, w, h * 0.4, 3);
    ctx.fill();
    ctx.stroke();

    // Sponge pores
    ctx.fillStyle = '#d4c04a';
    ctx.beginPath();
    ctx.arc(x + 8, y + h * 0.28, 2, 0, Math.PI * 2);
    ctx.arc(x + 28, y + h * 0.35, 2.5, 0, Math.PI * 2);
    ctx.arc(x + 15, y + h * 0.45, 2, 0, Math.PI * 2);
    ctx.arc(x + 30, y + h * 0.25, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // White shirt
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 4, y + h * 0.2, w - 8, h * 0.08);

    // Red tie
    ctx.fillStyle = '#cc0000';
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + h * 0.2);
    ctx.lineTo(x + w / 2 - 4, y + h * 0.32);
    ctx.lineTo(x + w / 2, y + h * 0.38);
    ctx.lineTo(x + w / 2 + 4, y + h * 0.32);
    ctx.closePath();
    ctx.fill();

    // Eyes
    const eyeY = y + h * 0.22;
    // Left eye
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(x + 11, eyeY, 7, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Right eye
    ctx.beginPath();
    ctx.ellipse(x + 25, eyeY, 7, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Iris
    ctx.fillStyle = '#4aa3df';
    ctx.beginPath();
    ctx.arc(x + 13, eyeY + 1, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 27, eyeY + 1, 4, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x + 14, eyeY + 1, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 28, eyeY + 1, 2, 0, Math.PI * 2);
    ctx.fill();

    // Eyelashes
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 4, eyeY - 7);
    ctx.lineTo(x + 6, eyeY - 10);
    ctx.moveTo(x + 10, eyeY - 8);
    ctx.lineTo(x + 11, eyeY - 11);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 22, eyeY - 8);
    ctx.lineTo(x + 21, eyeY - 11);
    ctx.moveTo(x + 28, eyeY - 7);
    ctx.lineTo(x + 26, eyeY - 10);
    ctx.stroke();

    // Nose
    ctx.strokeStyle = '#e8c800';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 18, eyeY + 5);
    ctx.quadraticCurveTo(x + 22, eyeY + 10, x + 18, eyeY + 12);
    ctx.stroke();

    // Smile
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    const smileWobble = isJumping ? -2 : Math.sin(this.animFrame * 0.08) * 1;
    ctx.beginPath();
    ctx.arc(x + 18, eyeY + 16 + smileWobble, 10, 0.1, Math.PI - 0.1);
    ctx.stroke();

    // Cheeks
    ctx.fillStyle = 'rgba(255, 150, 150, 0.4)';
    ctx.beginPath();
    ctx.ellipse(x + 5, eyeY + 10, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 31, eyeY + 10, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Teeth
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 0.5;
    ctx.fillRect(x + 14, eyeY + 14 + smileWobble, 4, 4);
    ctx.fillRect(x + 18, eyeY + 14 + smileWobble, 4, 4);
    ctx.strokeRect(x + 14, eyeY + 14 + smileWobble, 4, 4);
    ctx.strokeRect(x + 18, eyeY + 14 + smileWobble, 4, 4);

    // Arms
    ctx.strokeStyle = '#f7e05e';
    ctx.lineWidth = 4;
    const armSwing = isJumping ? -5 : Math.sin(this.animFrame * 0.12) * 6;
    ctx.beginPath();
    ctx.moveTo(x - 2, y + h * 0.3);
    ctx.lineTo(x - 6, y + h * 0.45 + armSwing * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w + 2, y + h * 0.3);
    ctx.lineTo(x + w + 6, y + h * 0.45 - armSwing * 0.5);
    ctx.stroke();
  },

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  },

  drawHeart(ctx, x, y, size, full) {
    // Draw a heart at (x,y) with given size, full=true for full heart, false for half
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, size * 0.3);
    ctx.bezierCurveTo(-size * 0.5, -size * 0.3, -size, size * 0.1, 0, size * 0.9);
    ctx.moveTo(0, size * 0.3);
    ctx.bezierCurveTo(size * 0.5, -size * 0.3, size, size * 0.1, 0, size * 0.9);

    if (full === 0) {
      // Empty heart
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (full === 1) {
      // Full heart
      ctx.fillStyle = '#ff4444';
      ctx.fill();
      ctx.strokeStyle = '#cc0000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      // Half heart - clip to left half
      ctx.save();
      ctx.beginPath();
      ctx.rect(-size, -size, size, size * 2);
      ctx.clip();
      ctx.fillStyle = '#ff4444';
      ctx.fill();
      ctx.strokeStyle = '#cc0000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      // Right half empty
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, -size, size, size * 2);
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  },

  drawHUD(ctx) {
    const w = this.width;
    const topY = 30;

    // --- Left panel: Score + Lives ---
    const panelH = this.invincibleTimer > 0 ? 80 : 60;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    this.roundRect(ctx, 10, topY, 150, panelH, 10);
    ctx.fill();

    // Score
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${this.score}`, 20, topY + 4);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '9px Arial, sans-serif';
    ctx.fillText('SCORE', 20, topY + 27);

    // Hearts (3 total, supports half-hearts)
    for (let i = 0; i < 3; i++) {
      const heartX = 20 + i * 26;
      const heartY = topY + 42;
      const healthRemaining = Math.max(0, this.lives - i);
      const fill = healthRemaining >= 1 ? 1 : healthRemaining >= 0.5 ? 0.5 : 0;
      this.drawHeart(ctx, heartX, heartY, 12, fill);
    }

    // Invincibility indicator
    if (this.invincibleTimer > 0) {
      ctx.fillStyle = '#00ffff';
      ctx.font = 'bold 9px Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`⚡ ${(this.invincibleTimer / 60).toFixed(1)}s`, 20, panelH + topY - 4);
    }

    // --- Combo ---
    if (this.combo >= 2) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const comboText = this.combo >= 5 ? `🔥 ${this.combo}x COMBO!` : `${this.combo}x combo`;
      ctx.font = 'bold 14px Arial, sans-serif';
      const tw = ctx.measureText(comboText).width + 20;
      this.roundRect(ctx, w - tw - 10, 10, tw, 28, 10);
      ctx.fill();
      ctx.fillStyle = this.combo >= 5 ? '#ff6b35' : '#ffd700';
      ctx.textAlign = 'right';
      ctx.fillText(comboText, w - 15, 16);
    }

    // --- Progress bar ---
    if (this.words.length > 0) {
      const pct = this.answeredWords.size / this.words.length;
      const barW = 160;
      const barX = w / 2 - barW / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      this.roundRect(ctx, barX, 10, barW, 16, 8);
      ctx.fill();
      ctx.fillStyle = pct >= 1 ? '#4CAF50' : '#ffd700';
      this.roundRect(ctx, barX + 2, 12, (barW - 4) * pct, 12, 6);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${this.answeredWords.size}/${this.words.length}`, w / 2, 18);
    }

    // --- Score popups ---
    for (const p of this.scorePopups) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.font = `bold ${p.size}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  },

  getQuestion() {
    if (this.currentQuestion) {
      return { ...this.currentQuestion, timeLeft: Math.max(0, 900 - this.questionTimer) };
    }
    return this.currentQuestion;
  },
};
