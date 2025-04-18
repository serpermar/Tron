document.addEventListener('DOMContentLoaded', function() {
    // Configuración del juego
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const gameContainer = document.getElementById('game-container');
    const startBtn = document.getElementById('start-btn');
    const resetBtn = document.getElementById('reset-btn');
    const gameModeSelect = document.getElementById('game-mode');
    const scoreDisplay = document.querySelector('.score-display');
    const gameOverModal = new bootstrap.Modal(document.getElementById('gameOverModal'));
    const bike1Sprite = document.getElementById('bike1-sprite');
    const bike2Sprite = document.getElementById('bike2-sprite');
    const volumeControl = document.getElementById('volume-control');
    
    // Elementos de audio
    const engineSound = document.getElementById('engine-sound');
    const crashSound = document.getElementById('crash-sound');
    const startSound = document.getElementById('start-sound');
    const trailSound = document.getElementById('trail-sound');
    
    // Sprites para las motos (usando emojis como alternativa si no se cargan imágenes)
    const bikeSprites = {
        player1: '🏍️', // Puedes reemplazar con URL de imagen
        player2: '🏍️'  // Puedes reemplazar con URL de imagen
    };
    
    // Configurar sprites iniciales
    bike1Sprite.style.backgroundImage = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="20" y="40" width="60" height="20" fill="cyan"/><rect x="30" y="30" width="10" height="40" fill="cyan"/><rect x="60" y="30" width="10" height="40" fill="cyan"/></svg>')`;
    bike2Sprite.style.backgroundImage = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="magenta"/><rect x="20" y="45" width="60" height="10" fill="magenta"/></svg>')`;
    
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
    let lastTrailSoundTime = 0;
    
    // Control de volumen
    volumeControl.addEventListener('input', function() {
        const volume = parseFloat(this.value);
        engineSound.volume = volume;
        crashSound.volume = volume;
        startSound.volume = volume;
        trailSound.volume = volume * 0.5;
    });
    
    // Clase para las motos
    class Bike {
        constructor(x, y, color, controls, isAI = false) {
            this.x = x;
            this.y = y;
            this.color = color;
            this.width = 24;
            this.height = 24;
            this.speed = 3;
            this.direction = { x: 0, y: 0 };
            this.trail = [];
            this.maxTrailLength = 1000;
            this.controls = controls;
            this.isAI = isAI;
            this.alive = true;
            this.rotation = 0;
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
            
            // Actualizar rotación según la dirección
            if (this.direction.x === 1) this.rotation = 0; // Derecha
            if (this.direction.x === -1) this.rotation = 180; // Izquierda
            if (this.direction.y === 1) this.rotation = 90; // Abajo
            if (this.direction.y === -1) this.rotation = 270; // Arriba
            
            // Mantener dentro de los límites
            if (this.x < 0) this.x = 0;
            if (this.x > canvas.width - this.width) this.x = canvas.width - this.width;
            if (this.y < 0) this.y = 0;
            if (this.y > canvas.height - this.height) this.y = canvas.height - this.height;
            
            // Añadir posición actual al rastro
            this.trail.push({ 
                x: this.x, 
                y: this.y,
                rotation: this.rotation
            });
            
            // Sonido del rastro (limitado para no saturar)
            const now = Date.now();
            if (now - lastTrailSoundTime > 100) {
                trailSound.currentTime = 0;
                trailSound.play().catch(e => console.log("Error de audio:", e));
                lastTrailSoundTime = now;
            }
            
            // Limitar longitud del rastro
            if (this.trail.length > this.maxTrailLength) {
                this.trail.shift();
            }
            
            // Detectar colisiones
            this.checkCollisions(opponentTrail);
        }
        
        AIMovement(opponentTrail) {
            // IA mejorada que evita colisiones y bordes
            const margin = 70;
            const changeDirectionChance = 0.03;
            const lookAhead = 50;
            
            // Cambiar dirección aleatoriamente a veces
            if (Math.random() < changeDirectionChance) {
                this.randomDirectionChange();
            }
            
            // Detectar peligro adelante
            const futureX = this.x + this.direction.x * lookAhead;
            const futureY = this.y + this.direction.y * lookAhead;
            
            // Verificar colisión futura con bordes
            if (futureX < margin || futureX > canvas.width - margin || 
                futureY < margin || futureY > canvas.height - margin) {
                this.randomDirectionChange();
            }
            
            // Verificar colisión futura con rastros
            for (let i = 0; i < opponentTrail.length - 10; i += 5) {
                const point = opponentTrail[i];
                const dist = Math.sqrt(Math.pow(futureX - point.x, 2) + Math.pow(futureY - point.y, 2));
                if (dist < 30) {
                    this.randomDirectionChange();
                    break;
                }
            }
        }
        
        randomDirectionChange() {
            const directions = [
                { x: 1, y: 0 }, { x: -1, y: 0 },
                { x: 0, y: 1 }, { x: 0, y: -1 }
            ].filter(dir => 
                !(dir.x === -this.direction.x && dir.y === -this.direction.y) // Evitar reversa inmediata
            );
            
            if (directions.length > 0) {
                const newDir = directions[Math.floor(Math.random() * directions.length)];
                this.direction = newDir;
            }
        }
        
        checkCollisions(opponentTrail) {
            // Verificar colisión con los bordes
            if (this.x <= 0 || this.x >= canvas.width - this.width || 
                this.y <= 0 || this.y >= canvas.height - this.height) {
                this.crash();
                return;
            }
            
            // Verificar colisión con propio rastro (excepto los últimos segmentos)
            for (let i = 0; i < this.trail.length - 10; i++) {
                const point = this.trail[i];
                if (this.checkPointCollision(point)) {
                    this.crash();
                    return;
                }
            }
            
            // Verificar colisión con el rastro del oponente
            for (let i = 0; i < opponentTrail.length; i++) {
                const point = opponentTrail[i];
                if (this.checkPointCollision(point)) {
                    this.crash();
                    return;
                }
            }
        }
        
        checkPointCollision(point) {
            return this.x < point.x + 4 && 
                   this.x + this.width > point.x - 4 && 
                   this.y < point.y + 4 && 
                   this.y + this.height > point.y - 4;
        }
        
        crash() {
            this.alive = false;
            crashSound.currentTime = 0;
            crashSound.play().catch(e => console.log("Error de audio:", e));
        }
        
        draw() {
            if (!this.alive) return;
            
            // Dibujar rastro
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            
            if (this.trail.length > 1) {
                ctx.moveTo(this.trail[0].x + this.width/2, this.trail[0].y + this.height/2);
                
                for (let i = 1; i < this.trail.length; i++) {
                    ctx.lineTo(this.trail[i].x + this.width/2, this.trail[i].y + this.height/2);
                }
            }
            
            ctx.stroke();
            
            // Dibujar moto (ahora se hace con el sprite HTML)
            this.updateSpritePosition();
        }
        
        updateSpritePosition() {
            const sprite = this === player1 ? bike1Sprite : bike2Sprite;
            sprite.style.left = `${this.x}px`;
            sprite.style.top = `${this.y}px`;
            sprite.style.transform = `rotate(${this.rotation}deg)`;
            sprite.style.opacity = this.alive ? '1' : '0.5';
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
        
        // Actualizar sprites iniciales
        player1.updateSpritePosition();
        player2.updateSpritePosition();
    }
    
    // Inicializar juego
    function initGame() {
        gameRunning = false;
        engineSound.pause();
        scores = { player1: 0, player2: 0 };
        updateScoreDisplay();
        createBikes();
        
        // Limpiar canvas
        ctx.fillStyle = '#000033';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Actualizar marcador
    function updateScoreDisplay() {
        scoreDisplay.querySelector('.player-1').textContent = `Jugador 1: ${scores.player1}`;
        scoreDisplay.querySelector('.player-2').textContent = `Jugador 2: ${scores.player2}`;
    }
    
    // Bucle del juego
    function gameLoop() {
        if (!gameRunning) return;
        
        // Limpiar canvas con efecto de desvanecimiento
        ctx.fillStyle = 'rgba(0, 0, 51, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Dibujar rejilla de fondo
        drawGrid();
        
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
    
    // Dibujar rejilla de fondo estilo Tron
    function drawGrid() {
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        
        // Líneas verticales
        for (let x = 0; x < canvas.width; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        
        // Líneas horizontales
        for (let y = 0; y < canvas.height; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    }
    
    // Finalizar juego
    function endGame() {
        gameRunning = false;
        engineSound.pause();
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
            startSound.currentTime = 0;
            startSound.play().catch(e => console.log("Error de audio:", e));
            engineSound.currentTime = 0;
            engineSound.play().catch(e => console.log("Error de audio:", e));
            gameLoop();
            startBtn.textContent = 'Pausa';
        } else {
            gameRunning = false;
            engineSound.pause();
            cancelAnimationFrame(animationId);
            startBtn.textContent = 'Continuar';
        }
    });
    
    resetBtn.addEventListener('click', function() {
        gameRunning = false;
        engineSound.pause();
        cancelAnimationFrame(animationId);
        initGame();
        startBtn.textContent = 'Iniciar Juego';
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
    
    // Inicializar juego al cargar
    initGame();
});