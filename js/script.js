document.addEventListener('DOMContentLoaded', function() {
    // Elementos de audio
    const backgroundMusic = document.getElementById('background-music');
    const gameStartSound = document.getElementById('game-start-sound');
    const crashSound = document.getElementById('crash-sound');
    const musicBtn = document.getElementById('music-btn');
    
    // Configuración del juego
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const gameContainer = document.getElementById('game-container');
    const startBtn = document.getElementById('start-btn');
    const resetBtn = document.getElementById('reset-btn');
    const gameModeSelect = document.getElementById('game-mode');
    const scoreDisplay = document.querySelector('.score-display');
    const gameOverModal = new bootstrap.Modal(document.getElementById('gameOverModal'));
    const loadingScreen = document.getElementById('loading-screen');
    
    // Ajustar tamaño del canvas al contenedor
    function resizeCanvas() {
        canvas.width = gameContainer.clientWidth;
        canvas.height = gameContainer.clientHeight;
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Variables del juego
    let gameRunning = false;
    let animationId;
    let scores = { player1: 0, player2: 0 };
    let gameMode = 'single';
    let musicPlaying = false;
    
    // Cargar recursos
    function loadResources() {
        // Simular carga de recursos
        setTimeout(function() {
            loadingScreen.style.display = 'none';
            
            // Intentar reproducir música (requiere interacción del usuario)
            document.body.addEventListener('click', function initAudio() {
                if (!musicPlaying) {
                    backgroundMusic.volume = 0.3;
                    gameStartSound.volume = 0.5;
                    crashSound.volume = 0.7;
                    
                    backgroundMusic.play().then(() => {
                        backgroundMusic.pause();
                        musicPlaying = true;
                        updateMusicButton();
                    }).catch(e => {
                        console.log("Autoplay no permitido:", e);
                    });
                }
                
                // Eliminar el event listener después del primer click
                document.body.removeEventListener('click', initAudio);
            }, { once: true });
        }, 2000); // Simular 2 segundos de carga
    }
    
    // Control de música
    function toggleMusic() {
        if (musicPlaying) {
            backgroundMusic.pause();
            musicPlaying = false;
        } else {
            backgroundMusic.play().catch(e => console.log("Error al reproducir:", e));
            musicPlaying = true;
        }
        updateMusicButton();
    }
    
    function updateMusicButton() {
        musicBtn.innerHTML = musicPlaying ? '♫' : '🔇';
    }
    
    musicBtn.addEventListener('click', toggleMusic);
    
    // Clase para las motos
    class Bike {
        constructor(x, y, color, controls, isAI = false) {
            this.x = x;
            this.y = y;
            this.color = color;
            this.width = 8;
            this.height = 8;
            this.speed = 3;
            this.direction = { x: 0, y: 0 };
            this.trail = [];
            this.maxTrailLength = 1000;
            this.controls = controls;
            this.isAI = isAI;
            this.alive = true;
        }
        
        update(opponentTrail) {
            if (!this.alive) return;
            
            // Movimiento de la IA (solo en modo single player)
            if (this.isAI && gameMode === 'single') {
                this.AIMovement(opponentTrail);
            }
            
            // Actualizar posición
            this.x += this.direction.x * this.speed;
            this.y += this.direction.y * this.speed;
            
            // Mantener dentro de los límites
            if (this.x < 0) this.x = 0;
            if (this.x > canvas.width - this.width) this.x = canvas.width - this.width;
            if (this.y < 0) this.y = 0;
            if (this.y > canvas.height - this.height) this.y = canvas.height - this.height;
            
            // Añadir posición actual al rastro
            this.trail.push({ x: this.x, y: this.y });
            
            // Limitar longitud del rastro
            if (this.trail.length > this.maxTrailLength) {
                this.trail.shift();
            }
            
            // Detectar colisiones
            this.checkCollisions(opponentTrail);
        }
        
        AIMovement(opponentTrail) {
            // Simple IA que intenta evitar colisiones y mantenerse alejada de los bordes
            const margin = 50;
            const changeDirectionChance = 0.02;
            
            // Cambiar dirección aleatoriamente a veces
            if (Math.random() < changeDirectionChance) {
                const directions = [
                    { x: 1, y: 0 }, { x: -1, y: 0 },
                    { x: 0, y: 1 }, { x: 0, y: -1 }
                ];
                const newDir = directions[Math.floor(Math.random() * directions.length)];
                this.direction = newDir;
            }
            
            // Evitar bordes
            if (this.x < margin && this.direction.x < 0) {
                this.direction = { x: 0, y: Math.random() < 0.5 ? 1 : -1 };
            }
            if (this.x > canvas.width - margin && this.direction.x > 0) {
                this.direction = { x: 0, y: Math.random() < 0.5 ? 1 : -1 };
            }
            if (this.y < margin && this.direction.y < 0) {
                this.direction = { x: Math.random() < 0.5 ? 1 : -1, y: 0 };
            }
            if (this.y > canvas.height - margin && this.direction.y > 0) {
                this.direction = { x: Math.random() < 0.5 ? 1 : -1, y: 0 };
            }
        }
        
        checkCollisions(opponentTrail) {
            // Verificar colisión con los bordes
            if (this.x <= 0 || this.x >= canvas.width - this.width || 
                this.y <= 0 || this.y >= canvas.height - this.height) {
                this.alive = false;
                crashSound.play();
                return;
            }
            
            // Verificar colisión con propio rastro (excepto los últimos segmentos)
            for (let i = 0; i < this.trail.length - 10; i++) {
                const point = this.trail[i];
                if (this.checkPointCollision(point)) {
                    this.alive = false;
                    crashSound.play();
                    return;
                }
            }
            
            // Verificar colisión con el rastro del oponente
            for (const point of opponentTrail) {
                if (this.checkPointCollision(point)) {
                    this.alive = false;
                    crashSound.play();
                    return;
                }
            }
        }
        
        checkPointCollision(point) {
            return this.x < point.x + 2 && 
                   this.x + this.width > point.x - 2 && 
                   this.y < point.y + 2 && 
                   this.y + this.height > point.y - 2;
        }
        
        draw() {
            if (!this.alive) return;
            
            // Dibujar moto
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);
            
            // Dibujar rastro
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            if (this.trail.length > 1) {
                ctx.moveTo(this.trail[0].x + this.width/2, this.trail[0].y + this.height/2);
                
                for (let i = 1; i < this.trail.length; i++) {
                    ctx.lineTo(this.trail[i].x + this.width/2, this.trail[i].y + this.height/2);
                }
            }
            
            ctx.stroke();
        }
        
        handleKeyDown(key) {
            if (!this.alive) return;
            
            if (key === this.controls.up && this.direction.y !== 1) {
                this.direction = { x: 0, y: -1 };
            } else if (key === this.controls.down && this.direction.y !== -1) {
                this.direction = { x: 0, y: 1 };
            } else if (key === this.controls.left && this.direction.x !== 1) {
                this.direction = { x: -1, y: 0 };
            } else if (key === this.controls.right && this.direction.x !== -1) {
                this.direction = { x: 1, y: 0 };
            }
        }
    }
    
    // Crear motos
    let player1, player2;
    
    function createBikes() {
        player1 = new Bike(
            canvas.width * 0.25, 
            canvas.height * 0.5, 
            '#00ffff', 
            { up: 'w', down: 's', left: 'a', right: 'd' }
        );
        
        player2 = new Bike(
            canvas.width * 0.75, 
            canvas.height * 0.5, 
            '#ff00ff', 
            { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
            gameMode === 'single'
        );
        
        // Dar direcciones iniciales opuestas
        player1.direction = { x: 1, y: 0 };
        player2.direction = { x: -1, y: 0 };
    }
    
    // Inicializar juego
    function initGame() {
        gameRunning = false;
        scores = { player1: 0, player2: 0 };
        updateScoreDisplay();
        createBikes();
    }
    
    // Actualizar marcador
    function updateScoreDisplay() {
        scoreDisplay.querySelector('.player-1').textContent = `Jugador 1: ${scores.player1}`;
        scoreDisplay.querySelector('.player-2').textContent = `Jugador 2: ${scores.player2}`;
    }
    
    // Bucle del juego
    function gameLoop() {
        if (!gameRunning) return;
        
        // Limpiar canvas
        ctx.fillStyle = 'rgba(0, 0, 51, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Actualizar y dibujar motos
        player1.update(player2.trail);
        player2.update(player1.trail);
        player1.draw();
        player2.draw();
        
        // Verificar si el juego ha terminado
        if (!player1.alive || !player2.alive) {
            endGame();
            return;
        }
        
        animationId = requestAnimationFrame(gameLoop);
    }
    
    // Finalizar juego
    function endGame() {
        gameRunning = false;
        cancelAnimationFrame(animationId);
        
        // Determinar ganador
        let winner;
        if (!player1.alive && !player2.alive) {
            winner = 'Empate!';
        } else if (!player1.alive) {
            winner = 'Jugador 2 ha ganado!';
            scores.player2++;
        } else {
            winner = 'Jugador 1 ha ganado!';
            scores.player1++;
        }
        
        updateScoreDisplay();
        
        // Mostrar modal de fin de juego
        document.getElementById('gameOverBody').textContent = winner;
        gameOverModal.show();
    }
    
    // Event listeners
    startBtn.addEventListener('click', function() {
        if (!gameRunning) {
            gameRunning = true;
            createBikes();
            gameLoop();
            startBtn.textContent = 'Pausa';
            gameStartSound.currentTime = 0;
            gameStartSound.play();
            
            // Reproducir música si está pausada
            if (musicPlaying && backgroundMusic.paused) {
                backgroundMusic.play();
            }
        } else {
            gameRunning = false;
            cancelAnimationFrame(animationId);
            startBtn.textContent = 'Continuar';
            backgroundMusic.pause();
        }
    });
    
    resetBtn.addEventListener('click', function() {
        gameRunning = false;
        cancelAnimationFrame(animationId);
        initGame();
        startBtn.textContent = 'Iniciar Juego';
        
        // Limpiar canvas
        ctx.fillStyle = '#000033';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    });
    
    gameModeSelect.addEventListener('change', function() {
        gameMode = this.value;
        initGame();
    });
    
    document.addEventListener('keydown', function(e) {
        if (!gameRunning) return;
        
        // Prevenir comportamiento por defecto para teclas de juego
        const gameKeys = ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        if (gameKeys.includes(e.key)) {
            e.preventDefault();
        }
        
        player1.handleKeyDown(e.key);
        player2.handleKeyDown(e.key);
    });
    
    // Iniciar carga de recursos
    loadResources();
});