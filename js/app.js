/* Few globals to be used by all classes:
   - x_division and y_division - constants for moving around the board
   - stop - if the game is paused
   - occupied - array used to avoid placing elements on the same tiles
   - level - current game level
   - state - current state of the game for ovelays purposes
*/
var x_division = 101;
var y_division = 83;
var stop = false;
var occupied = [];
var level = 1;
var state = null;

/* Global function to check whether given tile is occupied */
function isOccupied(x, y) {
    for (var i in occupied) {
        if (occupied[i].toString() == [x, y].toString()) {
            return true;
        }
    }
    return false;
}

/* Global function for getting random number in an inclusive range */
function get_random_in_range(min, max) {
    return Math.floor((Math.random() * (max-min+1)) + min);
}

/* Global function for setting an initial state of the game */
function presetGame(keepScoreBoard) {
    allEnemies = [new Enemy()];
    player = new Player();
    // If game over, we want to keep scoreboard and level info until new game
    if (!keepScoreBoard) {
        scoreBoard = new ScoreBoard();
        level = 1;
    }
    gems = [new Gem()];
    gate = new Gate();
    key = new Key();
    overlay = new Overlay();
    levelup = new LevelUp();
    gameover = new GameOver();
    state = null;
    stop = false;
}

/* 
    Global function for resetting the game
    Parameters:
    - reason - whether the game was restarted by user, through level up or game over
*/
function resetGame(reason) {
    if (reason == 'levelup') {
        // If the user leveled up, increment level and reset entities
        level += 1;
        allEnemies.push(new Enemy());
        for (var idx in allEnemies) {
            allEnemies[idx].reset();
        }
        player.reset();
        key.reset();
        gate.reset();
        state = 'levelup';
    } else if (reason != 'restart') {
        // If game over then reset then change state to show overlay
        state = 'gameover';
    } else {
        // Reset the game to the initial state
        presetGame();
    }
}

/* 
    An Element superclass used by entities (enemies and player)
    Parameters:
    - sprite - picture for the element
    - rand_x, rand_y - min and max ranges for getting random position (e.g. [1,3])
    - x_offset, y_offset - offsets for calculation the colision zone
    - modifiers - modifiers for calculating the collision zone:
                  [a, b, c, d] used in the following collision array calculation
                  [this.x + a, this.y + b, this.width - a - c, this.height - b - d]
*/
var Element = function(sprite, rand_x, rand_y, x_offset, y_offset, modifiers) {
    this.sprite = sprite;
    this.rand_x = rand_x;
    this.rand_y = rand_y;
    this.x_offset = x_offset;
    this.y_offset = y_offset;
    this.modifiers = modifiers;
    this.width = 101;
    this.height = 171;
    this.getPosition();
}

/* Get position on the screen and collision zone, can be overwritten by subclasses */
Element.prototype.getPosition = function() {
    if (this.rand_x == null) {
        this.x = 0;
    } else {
        this.x = get_random_in_range.apply(null, this.rand_x) * x_division - this.x_offset;
    }
    if (this.rand_y == null) {
        this.y = 0;
    } else {
        this.y = get_random_in_range.apply(null, this.rand_y) * y_division - this.y_offset;
    }
    this.collisionZone = this.getCollisionZone();
}

/* Reset to the initial state */
Element.prototype.reset = function() {
    this.getPosition();
}

/* 
    Dummy callbacks, to be overwritten by subclasses where needed.
    Called when collision/no collision detected.
*/
Element.prototype.collisionCallback = function() {}
Element.prototype.noCollisionCallback = function() {}

/* Get collision zone. This is the are within which contact with player is treated as collision */
Element.prototype.getCollisionZone = function() {
    return [
        this.x+this.modifiers[0], 
        this.y+this.modifiers[1], 
        this.width-this.modifiers[0]-this.modifiers[2], 
        this.height-this.modifiers[1]-this.modifiers[3]
    ];
}

/* Check if in collision with the player and call appropriate callbacks */
Element.prototype.checkCollision = function() {
    if (player.collisionZone[0] < this.collisionZone[0] + this.collisionZone[2] &&
       player.collisionZone[0] + player.collisionZone[2] > this.collisionZone[0] &&
       player.collisionZone[1] < this.collisionZone[1] + this.collisionZone[3] &&
       player.collisionZone[3] + player.collisionZone[1] > this.collisionZone[1]) {
        this.collisionCallback.call(this);
    } else {
        this.noCollisionCallback.call(this);
    }
}

/* Render on the screen */
Element.prototype.render = function() {
    ctx.drawImage(Resources.get(this.sprite), this.x, this.y);
};

/* Enemies player must avoid */
var Enemy = function() {
    Element.call(
        this, 'images/enemy-bug.png', null, [1,3], 0, 20, [0, 70, 0, 20]
    );
    this.generate_stats();
};

Enemy.prototype = Object.create(Element.prototype);
Enemy.prototype.constructor = Element;

/* If enemy collides with the player, reset the game */
Enemy.prototype.collisionCallback = resetGame;

/* Enemy also has movement on top of the position and collision zone stats */
Enemy.prototype.generate_stats = function() {
    this.getPosition();
    this.movement = get_random_in_range(80, 150);
}

/*
    Update the enemy's position, required method for game
    Parameters:
    - dt - a time delta between ticks
*/
Enemy.prototype.update = function(dt) {
    if (stop) return;
    if (this.x < 605) {
        this.x += this.movement * dt;
    } else {
        this.x = -100;
        this.generate_stats();
    }
    this.collisionZone = this.getCollisionZone();
    this.checkCollision();
};

/* Player - controllable character of the game */
var Player = function() {
    Element.call(
        this, 'images/char-boy.png', null, null, 0, 10, [15, 64, 15, 30]
    );
};

Player.prototype = Object.create(Element.prototype);
Player.prototype.constructor = Element;

/* Player always starts in the same position */
Player.prototype.getPosition = function() {
    this.x = 100 + 2 * x_division;
    this.y = 5 * y_division - this.y_offset;
    this.collisionZone = this.getCollisionZone();
}

/* Update collision zone of the player */
Player.prototype.update = function(dt) {
    this.collisionZone = this.getCollisionZone();
};

/* 
    Handle user input from the arrow keys.
    Parameters:
    - dir - direction of movement
*/
Player.prototype.handleInput = function(dir) {
    // Don't do anything if game paused
    if (stop) return;

    // Direction to movement mapping
    var movement = {
        'left': [-x_division, 0],
        'up': [0, -y_division],
        'right': [x_division, 0],
        'down': [0, y_division]
    }

    // If direction provided
    if (dir) {
        // Calculate new position
        pos_x = this.x+movement[dir][0];
        pos_y = this.y+movement[dir][1];

        // Check if the position is within boundries
        if ((pos_x/x_division) <= 5 &&
            (pos_x/x_division) >= 0 &&
            (pos_y/y_division) <= 5 &&
            (pos_y/y_division) >= -1) {
            // Update player position
            this.x = pos_x;
            this.y = pos_y;
            // If the player is in the top row, check collision with the gate
            if (this.y/y_division < 0) {
                this.update();
                gate.checkCollision();
                // Player is in the gate
                if (gate.player_in) {
                    // If it's open, level up, otherwise do nothing
                    if (gate.gateOpen) {
                        resetGame('levelup');
                    } else {

                    }
                // Player got to the water, reset the game
                } else {
                    resetGame();
                }
            }
        }
    }
};

/* Special element with extra functionality for gems and key, same params as Element */
var SpecialElement = function(sprite, rand_x, rand_y, x_offset, y_offset, modifiers) {
    Element.call(this, sprite, rand_x, rand_y, x_offset, y_offset, modifiers);
    // Special elements have a visibility flag
    this.visible = true;
    this.arr_x = null;
    this.arr_y = null;
}

SpecialElement.prototype = Object.create(Element.prototype);
SpecialElement.prototype.constructor = Element;

/* Get position of the special element */
SpecialElement.prototype.getPosition = function() {
    var x = null;
    var y = null;
    // Check that this position is not occupied
    do {
        x = get_random_in_range.apply(this, this.rand_x);
        y = get_random_in_range.apply(this, this.rand_y);
        this.x = x * x_division;
        this.y = y * y_division - this.y_offset;
    } while (isOccupied(x, y));
    // Update occupied array
    occupied.push([x, y]);
    this.arr_x = x;
    this.arr_y = y;
    this.collisionZone = this.getCollisionZone();
}

/* Only render special element if it's visible */
SpecialElement.prototype.render = function() {
    if (this.visible) {
        ctx.drawImage(Resources.get(this.sprite), this.x, this.y);
    }
}

/* Player collided with the special element */
SpecialElement.prototype.collided = function() {
    occupied.pop([this.arr_x, this.arr_y]);
}

/* Gem object. Gems are used for increasing game score */
var Gem = function() {
    var colors = ['blue', 'green', 'orange'];
    this.color_idx = get_random_in_range(0,2);
    sprite = 'images/gem-' + colors[this.color_idx] + '-medium.png';
    SpecialElement.call(
        this, sprite, [1, 5], [1, 3], 0, 12, [0, 63, 0, 30]
    );
    this.inCollision = false;
}

Gem.prototype = Object.create(SpecialElement.prototype);
Gem.prototype.constructor = SpecialElement;

/* If player collided with the gem, remove it from the gems pool */
Gem.prototype.collisionCallback = function() {
    var me = this;
    if (!this.inCollision) {
        scoreBoard.gems[this.color_idx] += 1;
        gems = gems.filter(function(el) { return el != me; });
        this.inCollision = true;
        this.collided();
    }
}

/* Reset collision flag */
Gem.prototype.noCollisionCallback = function() {
    this.inCollision = false;
}

/* Check collision on update */
Gem.prototype.update = function() {
    this.checkCollision();
}

/* Key element, used to open the gate to the next level */
var Key = function() {
    SpecialElement.call(
        this, 'images/key.png', [1, 5], [1, 3], 0, 10, [0, 63, 0, 30]
    );
}

Key.prototype = Object.create(SpecialElement.prototype);
Key.prototype.constructor = SpecialElement;

/* Key's reset function to reset it to the initial state */
Key.prototype.reset = function() {
    this.getPosition();
    this.visible = true;
}

/* If the key is visible, check the collision */
Key.prototype.update = function() {
    if (this.visible) {
        this.checkCollision();
    }
}

/* Deal with collision */
Key.prototype.collisionCallback = function() {
    this.visible = false;
    this.collided();
}

/* Gate object, initially closed, key is need for opeening it */
var Gate = function() {
    Element.call(
        this, 'images/gate-closed.png', null, null, 0, 25, [0, 63, 0, 15]
    );
    // Player in the gate flag
    this.player_in = false;
    this.gateOpen = false;
}

Gate.prototype = Object.create(Element.prototype);
Gate.prototype.constructor = Element;

/* Get gate position, it will always be in the top row */
Gate.prototype.getPosition = function() {
    this.x = get_random_in_range(1, 5) * x_division;
    this.y = 0 - this.y_offset;
    this.collisionZone = this.getCollisionZone();
}

/* Reset gate to the initial state */
Gate.prototype.reset = function() {
    this.getPosition();
    this.gateOpen = false;
    this.player_in = false;
}

/* Update gate based on whether the player has picked up the key */
Gate.prototype.update = function() {
    if (!key.visible) {
        this.sprite = 'images/gate-open.png';
        this.gateOpen = true;
    } else {
        this.sprite = 'images/gate-closed.png';
        this.gateOpen = false;
    }
}

/* On collision, set player_in flag, reset when not in collision */
Gate.prototype.collisionCallback = function() { this.player_in = true };
Gate.prototype.noCollisionCallback = function() { this.player_in = false };


/* An overlay for when the game is paused */
var Overlay = function() {
    this.width = 310;
    this.height = 200;
    this.x = 200;
    this.y = 210;
    // Things to print on the overlay
    this.paused = ['Paused', 270, 270];
    this.unpause = ['Press p to unpause', 230, 310];
    this.restart = ['Press r to restart', 230, 350];
}

/* Render overlay if the game is paused and not through level up or game over */
Overlay.prototype.render = function() {
    if (stop && state == null) {
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = '8';
        ctx.rect(this.x, this.y, this.width, this.height);
        ctx.stroke();
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.fillStyle = 'blue';
        ctx.font = '50px Georgia';
        ctx.fillText.apply(ctx, this.paused);
        ctx.font = '20px Georgia';
        ctx.fillText.apply(ctx, this.unpause);
        ctx.fillText.apply(ctx, this.restart);
    }
}

/* Level up overlay, shown after the player went through the open gate */
var LevelUp = function() {
    this.width = 310;
    this.height = 100;
    this.x = 200;
    this.y = 210;
    this.levelup = ['Level up!', 240, 270];
}

/* Render only if the state of the game is levelup */
LevelUp.prototype.render = function() {
    if (state == 'levelup') {
        ctx.strokeStyle = 'green';
        ctx.lineWidth = '8';
        ctx.rect(this.x, this.y, this.width, this.height);
        ctx.stroke();
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.fillStyle = 'green';
        ctx.font = '50px Georgia';
        stop = true;
        ctx.fillText.apply(ctx, this.levelup);
        // Set a 1s timeout after which game should be started and overlay should disappear
        setTimeout(function() {
            state = null;
            stop = false;
        }, 1000);
    }
}

/* Game over overlay, shown when the player collided with enemy of water */
var GameOver = function() {
    this.width = 310;
    this.height = 300;
    this.x = 200;
    this.y = 110;
}

/* Only render when game in gameover state */
GameOver.prototype.render = function() {
    if (state == 'gameover') {
		// Prepare things to show on the overlay
		this.gameover = ['Game over!', 210, 170];
		this.score_a = [
			'Your score: blue: 10 x ' + scoreBoard.gems[0] + ',',
			210, 210
		];
		this.score_b = [ 
			'green: 15 x ' + scoreBoard.gems[1] + ',',
			210, 240
		];
		this.score_c = [
			'orange: 20 x ' + scoreBoard.gems[2],
			210, 270
		];
		this.score_d = [
			'and level: 50 x ' + level,
			210, 300
		];
		this.score_e = [
			'= ' + (scoreBoard.gems[0] * 10 + scoreBoard.gems[1] * 15 + 
			scoreBoard.gems[2] * 20 + level * 50), 
			210, 330
		];
		this.restart = ['Press r to restart', 210, 360];
        ctx.strokeStyle = 'red';
        ctx.lineWidth = '8';
        ctx.rect(this.x, this.y, this.width, this.height);
        ctx.stroke();
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.fillStyle = 'red';
        ctx.font = '50px Georgia';
        stop = true;
        ctx.fillText.apply(ctx, this.gameover);
        ctx.font = '20px Georgia';
        ctx.fillText.apply(ctx, this.score_a);
        ctx.fillText.apply(ctx, this.score_b);
        ctx.fillText.apply(ctx, this.score_c);
        ctx.fillText.apply(ctx, this.score_d);
        ctx.fillText.apply(ctx, this.score_e);
        ctx.fillText.apply(ctx, this.restart);
    }
}

/* Score board on the left side of the screen, showing gem counts, level and shortcuts */
var ScoreBoard = function() {
    this.gems = [0, 0, 0]; // Gems: [blue, green, orange]
    this.key = false; // Has the player picked up the key yet
}

/* Render scoreboard based on the current state of the game */
ScoreBoard.prototype.render = function() {
    var pic_pos = [10, 60];
    var text_pos = [55, 100];
    var increment = 50;

    var pics = [
        'images/gem-blue-small.png',
        'images/gem-green-small.png',
        'images/gem-orange-small.png',
    ]

    function draw_element(idx) {
        idx = parseInt(idx);
        ctx.drawImage(Resources.get(pics[idx]), pic_pos[0], idx * increment + pic_pos[1]);
        ctx.fillText(this.gems[idx].toString(), text_pos[0], idx * increment + text_pos[1]);
    }
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 50, ctx.canvas.width-505, ctx.canvas.height-50);
    ctx.font = '16px Georgia bolder';
    ctx.fillStyle = 'orange';
    for (var idx in pics) {
        draw_element.call(this, idx);
    }
    increment = 30;
    var start = (pics.length + 2) * increment;
    ctx.fillText('Level: ' + level, pic_pos[0], start + 1 * increment + pic_pos[1]);
    ctx.fillText('Shortcuts:', pic_pos[0], start + 3 * increment + pic_pos[1]);
    ctx.fillText('r - reset', pic_pos[0], start + 4 * increment + pic_pos[1]);
    ctx.fillText('p - pause', pic_pos[0], start + 5 * increment + pic_pos[1]);
}

// Initialize the game
presetGame();

// This listens for key presses and sends the keys to your
// Player.handleInput() method. You don't need to modify this.
document.addEventListener('keyup', function(e) {
    var allowedKeys = {
        37: 'left',
        38: 'up',
        39: 'right',
        40: 'down'
    };

    switch (e.keyCode) {
        case 80:
            if (state == null)
                stop = !stop;
            break;
        case 82:
            resetGame('restart');
            break;
        default:
            player.handleInput(allowedKeys[e.keyCode]);
    }
});

// Set interval for gems spawning
setInterval(function() {
    if (!gems.length && !stop) {
        gems.push(new Gem());
    }
}, 5000);
