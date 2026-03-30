document.addEventListener('DOMContentLoaded', function() {
    // Elementos
    const backgroundMusic = document.getElementById('background-music');
    const gameStartSound = document.getElementById('game-start-sound');
    const crashSound = document.getElementById('crash-sound');
    const musicBtn = document.getElementById('music-btn');
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const gameContainer = document.getElementById('game-container');
    const startBtn = document.getElementById('start-btn');
    const resetBtn = document.getElementById('reset-btn');
    const gameModeSelect = document.getElementById('game-mode');
    const scoreDisplay = document.querySelector('.score-display');
    const gameOverModal = new bootstrap.Modal(document.getElementById('gameOverModal'));
    const loadingScreen = document.getElementById('loading-screen');

    function resizeCanvas() {
        canvas.width = gameContainer.clientWidth;
        canvas.height = gameContainer.clientHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let gameRunning = false;
    let animationId;
    let scores = { player1: 0, player2: 0 };
    let gameMode = 'single';
    let musicPlaying = false;

    // --- CLASE BIKE ---
    class Bike {
        constructor(x, y, color, controls, isAI = false) {
            this.x = x;
            this.y = y;
            this.color = color;
            this.width = 8;
            this.height = 8;
            this.speed = 4; // Un poco más rápido para emoción
            this.direction = { x: 0, y: 0 };
            this.trail = [];
            this.controls = controls;
            this.isAI = isAI;
            this.alive = true;
        }

        update(opponentTrail) {
            if (!this.alive) return;

            if (this.isAI && gameMode === 'single') {
                this.smartAIMovement(opponentTrail);
            }

            this.x += this.direction.x * this.speed;
            this.y += this.direction.y * this.speed;

            this.trail.push({ x: this.x, y: this.y });
            this.checkCollisions(opponentTrail);
        }

        // IA Mejorada: Detecta muros y rastros
        smartAIMovement(opponentTrail) {
            const lookAhead = 20; 
            let nextX = this.x + this.direction.x * lookAhead;
            let nextY = this.y + this.direction.y * lookAhead;

            // ¿Voy a chocar?
            const willHitWall = nextX <= 0 || nextX >= canvas.width || nextY <= 0 || nextY >= canvas.height;
            const willHitSelf = this.trail.some(p => this.checkPointCollision(p, nextX, nextY));
            const willHitOpponent = opponentTrail.some(p => this.checkPointCollision(p, nextX, nextY));

            if (willHitWall || willHitSelf || willHitOpponent || Math.random() < 0.01) {
                const choices = [
                    {x: 0, y: -1}, {x: 0, y: 1}, {x: -1, y: 0}, {x: 1, y: 0}
                ];
                // Filtrar para no ir hacia atrás y no chocar inmediatamente
                const validChoices = choices.filter(dir => {
                    if (dir.x === -this.direction.x && dir.y === -this.direction.y) return false;
                    let testX = this.x + dir.x * lookAhead;
                    let testY = this.y + dir.y * lookAhead;
                    return testX > 0 && testX < canvas.width && testY > 0 && testY < canvas.height;
                });

                if (validChoices.length > 0) {
                    this.direction = validChoices[Math.floor(Math.random() * validChoices.length)];
                }
            }
        }

        checkCollisions(opponentTrail) {
            // Bordes
            if (this.x <= 0 || this.x >= canvas.width - this.width || 
                this.y <= 0 || this.y >= canvas.height - this.height) {
                this.die();
            }
            // Propio rastro
            for (let i = 0; i < this.trail.length - 15; i++) {
                if (this.checkPointCollision(this.trail[i], this.x, this.y)) this.die();
            }
            // Rastro oponente
            for (const point of opponentTrail) {
                if (this.checkPointCollision(point, this.x, this.y)) this.die();
            }
        }

        checkPointCollision(point, targetX, targetY) {
            const margin = 5;
            return targetX < point.x + margin && targetX + this.width > point.x - margin &&
                   targetY < point.y + margin && targetY + this.height > point.y - margin;
        }

        die() {
            this.alive = false;
            if(crashSound) crashSound.play();
        }

        draw() {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);
            
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            if (this.trail.length > 0) {
                ctx.moveTo(this.trail[0].x + 4, this.trail[0].y + 4);
                this.trail.forEach(p => ctx.lineTo(p.x + 4, p.y + 4));
            }
            ctx.stroke();
        }

        handleKeyDown(key) {
            if (!this.alive) return;
            const k = key.toLowerCase();
            if (k === this.controls.up && this.direction.y !== 1) this.direction = { x: 0, y: -1 };
            else if (k === this.controls.down && this.direction.y !== -1) this.direction = { x: 0, y: 1 };
            else if (k === this.controls.left && this.direction.x !== 1) this.direction = { x: -1, y: 0 };
            else if (k === this.controls.right && this.direction.x !== -1) this.direction = { x: 1, y: 0 };
        }
    }

    let player1, player2;

    function createBikes() {
        player1 = new Bike(100, canvas.height/2, '#00ffff', { up: 'w', down: 's', left: 'a', right: 'd' });
        player2 = new Bike(canvas.width - 100, canvas.height/2, '#ff00ff', 
                          { up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright' }, 
                          gameMode === 'single');
        player1.direction = { x: 1, y: 0 };
        player2.direction = { x: -1, y: 0 };
    }

    function gameLoop() {
        if (!gameRunning) return;
        ctx.fillStyle = 'rgba(0, 0, 51, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        player1.update(player2.trail);
        player2.update(player1.trail);
        player1.draw();
        player2.draw();

        if (!player1.alive || !player2.alive) {
            endGame();
            return;
        }
        animationId = requestAnimationFrame(gameLoop);
    }

    function endGame() {
        gameRunning = false;
        cancelAnimationFrame(animationId);
        let msg = "";
        if (!player1.alive && !player2.alive) msg = "¡COLISIÓN SIMULTÁNEA!";
        else if (!player1.alive) { msg = "JUGADOR 2 GANA"; scores.player2++; }
        else { msg = "JUGADOR 1 GANA"; scores.player1++; }
        
        document.getElementById('gameOverBody').textContent = msg;
        scoreDisplay.querySelector('.player-1').textContent = `Jugador 1: ${scores.player1}`;
        scoreDisplay.querySelector('.player-2').textContent = `Jugador 2: ${scores.player2}`;
        startBtn.textContent = "Nueva Ronda";
        gameOverModal.show();
    }

    startBtn.addEventListener('click', () => {
        if (!gameRunning) {
            if (!player1 || !player1.alive || !player2.alive) createBikes();
            gameRunning = true;
            startBtn.textContent = "Pausar";
            if(gameStartSound) gameStartSound.play();
            gameLoop();
        } else {
            gameRunning = false;
            startBtn.textContent = "Continuar";
        }
    });

    resetBtn.addEventListener('click', () => {
        gameRunning = false;
        cancelAnimationFrame(animationId);
        scores = {player1: 0, player2: 0};
        scoreDisplay.querySelector('.player-1').textContent = `Jugador 1: 0`;
        scoreDisplay.querySelector('.player-2').textContent = `Jugador 2: 0`;
        createBikes();
        ctx.clearRect(0,0, canvas.width, canvas.height);
        startBtn.textContent = "Iniciar Juego";
    });

    document.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)) e.preventDefault();
        player1.handleKeyDown(key);
        player2.handleKeyDown(key);
    });

    // Carga inicial
    setTimeout(() => { 
        loadingScreen.style.display = 'none'; 
        createBikes();
    }, 1500);

    // Música
    musicBtn.addEventListener('click', () => {
        musicPlaying = !musicPlaying;
        musicPlaying ? backgroundMusic.play() : backgroundMusic.pause();
        musicBtn.innerHTML = musicPlaying ? '♫' : '🔇';
    });
});