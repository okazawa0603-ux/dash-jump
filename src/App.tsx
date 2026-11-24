import React, { useState, useEffect, useRef } from 'react';
import './App.css';

type Difficulty = 'easy' | 'normal' | 'hard';
type GameState = 'START' | 'PLAYING' | 'GAMEOVER' | 'CLEAR';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
}

interface Obstacle {
  x: number;
  width: number;
  height: number;
  isGap: boolean;
}

interface Enemy {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  type: 'bug' | 'skull';
}

interface Item {
  x: number;
  y: number;
  collected: boolean;
  type: 'coin' | 'star';
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('START');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [coins, setCoins] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('onekey_highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const config = {
      easy: { speed: 4, gapFreq: 0.01, enemyFreq: 0.015 },
      normal: { speed: 5.5, gapFreq: 0.018, enemyFreq: 0.025 },
      hard: { speed: 7, gapFreq: 0.025, enemyFreq: 0.04 },
    }[difficulty];

    const courseLength = config.speed * 60 * 60;
    let distance = 0;

    const player = {
      x: 80,
      y: 200,
      width: 24,
      height: 40,
      vy: 0,
      gravity: 0.65,
      jumpPower: -12.5,
      isGrounded: false,
      starTimer: 0,
    };

    const groundY = 280;
    let obstacles: Obstacle[] = [];
    let enemies: Enemy[] = [];
    let items: Item[] = [];
    let particles: Particle[] = [];
    let currentScore = 0;
    let currentCoins = 0;
    let frameCount = 0;

    let animId: number;
    let nextSpawnX = 300;

    const drawStar = (
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      spikes: number,
      outerRadius: number,
      innerRadius: number,
      color: string
    ) => {
      let rot = (Math.PI / 2) * 3;
      let x = cx;
      let y = cy;
      const step = Math.PI / spikes;

      ctx.beginPath();
      ctx.moveTo(cx, cy - outerRadius);
      for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
      }
      ctx.lineTo(cx, cy - outerRadius);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    const spawnObjects = (currentX: number) => {
      if (currentX > courseLength - 600) return;

      if (currentX > nextSpawnX) {
        const isGap = Math.random() < config.gapFreq * 15;
        const width = isGap ? 70 + Math.random() * 30 : 35 + Math.random() * 25;
        const height = isGap ? 0 : 35 + Math.random() * 35;

        const spawnX = canvas.width + 50;

        obstacles.push({
          x: spawnX,
          width,
          height,
          isGap,
        });

        if (!isGap && Math.random() < config.enemyFreq * 15) {
          enemies.push({
            x: spawnX + 100,
            y: groundY - 24,
            width: 24,
            height: 24,
            speed: 1.5,
            type: Math.random() > 0.5 ? 'bug' : 'skull',
          });
        }

        // 多彩なアイテム配置パターン（ランダム選択）
        const pattern = Math.random();

        if (pattern < 0.25) {
          // パターンA: ポツンと単体のコイン（地面近く）
          items.push({
            x: spawnX + width + 40,
            y: groundY - 30,
            collected: false,
            type: 'coin',
          });
        } else if (pattern < 0.50) {
          // パターンB: 単体の高めジャンプコイン or スター
          items.push({
            x: spawnX + width + 50,
            y: groundY - 80,
            collected: false,
            type: Math.random() > 0.7 ? 'star' : 'coin',
          });
        } else if (pattern < 0.75) {
          // パターンC: 空中アーチ状のコイン群（土管と被らない安全位置）
          for (let k = 0; k < 4; k++) {
            const archY = groundY - 55 - Math.sin((k / 3) * Math.PI) * 45;
            items.push({
              x: spawnX + width + 30 + k * 26,
              y: archY,
              collected: false,
              type: 'coin',
            });
          }
        } else {
          // パターンD: 地面に並ぶ連続コイン
          if (!isGap) {
            for (let k = 0; k < 3; k++) {
              items.push({
                x: spawnX + width + 20 + k * 28,
                y: groundY - 20,
                collected: false,
                type: 'coin',
              });
            }
          }
        }

        // 次の出現間隔をランダムに大きく変動させる
        nextSpawnX = currentX + 160 + Math.random() * 180;
      }
    };

    const triggerExplosion = (px: number, py: number, customColors?: string[]) => {
      const colors = customColors || ['#1abc9c', '#f1c40f', '#34495e', '#ffffff'];
      for (let i = 0; i < 30; i++) {
        particles.push({
          x: px + 12,
          y: py + 20,
          vx: (Math.random() - 0.5) * 12,
          vy: (Math.random() - 0.5) * 12,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 4 + Math.random() * 6,
          alpha: 1,
        });
      }
    };

    const handleJump = () => {
      if (player.isGrounded) {
        player.vy = player.jumpPower;
        player.isGrounded = false;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleJump();
      }
    };
    const onPointerDown = () => handleJump();

    window.addEventListener('keydown', onKeyDown);
    canvas.addEventListener('pointerdown', onPointerDown);

    const update = () => {
      frameCount++;
      let isBlocked = false;

      for (const obs of obstacles) {
        if (!obs.isGap) {
          const obsTop = groundY - obs.height;
          if (
            player.x + player.width >= obs.x &&
            player.x < obs.x &&
            player.y + player.height > obsTop + 5
          ) {
            isBlocked = true;
            break;
          }
        }
      }

      const currentSpeed = isBlocked ? 0 : config.speed;
      distance += currentSpeed;

      currentScore = Math.floor(distance / 10) + currentCoins * 50;
      setScore(currentScore);

      if (player.starTimer > 0) player.starTimer--;

      player.vy += player.gravity;
      const nextY = player.y + player.vy;

      let overGap = false;
      for (const obs of obstacles) {
        if (
          obs.isGap &&
          player.x + player.width > obs.x &&
          player.x < obs.x + obs.width
        ) {
          overGap = true;
          break;
        }
      }

      let groundedThisFrame = false;

      if (overGap && player.y + player.height > groundY + 25) {
        triggerExplosion(player.x, player.y);
        gameOver();
        return;
      }

      if (!overGap && nextY + player.height >= groundY) {
        player.y = groundY - player.height;
        player.vy = 0;
        groundedThisFrame = true;
      } else {
        player.y = nextY;
      }

      spawnObjects(distance);

      for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.x -= currentSpeed;

        if (!obs.isGap) {
          const obsTop = groundY - obs.height;
          if (
            player.x + player.width > obs.x &&
            player.x < obs.x + obs.width
          ) {
            if (
              player.vy >= 0 &&
              player.y + player.height >= obsTop &&
              player.y + player.height - player.vy <= obsTop + 12
            ) {
              player.y = obsTop - player.height;
              player.vy = 0;
              groundedThisFrame = true;
            }
          }
        }

        if (obs.x + obs.width < -100) obstacles.splice(i, 1);
      }

      for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.x -= currentSpeed + enemy.speed;

        if (
          player.x < enemy.x + enemy.width &&
          player.x + player.width > enemy.x &&
          player.y < enemy.y + enemy.height &&
          player.y + player.height > enemy.y
        ) {
          if (player.starTimer > 0) {
            triggerExplosion(enemy.x, enemy.y, ['#ff0000', '#00ff00', '#0000ff', '#ffff00']);
            enemies.splice(i, 1);
            currentCoins += 2;
            continue;
          } else {
            triggerExplosion(player.x, player.y);
            gameOver();
            return;
          }
        }

        if (enemy.x < -50) enemies.splice(i, 1);
      }

      player.isGrounded = groundedThisFrame;

      if (player.y > canvas.height + 0) {
        triggerExplosion(player.x, player.y);
        gameOver();
        return;
      }

      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        item.x -= currentSpeed;

        if (
          !item.collected &&
          Math.abs(player.x + 12 - item.x) < 25 &&
          Math.abs(player.y + 20 - item.y) < 25
        ) {
          item.collected = true;
          if (item.type === 'star') {
            player.starTimer = 240;
            currentCoins += 3;
          } else {
            currentCoins += 1;
          }
          setCoins(currentCoins);
        }

        if (item.x < -50) items.splice(i, 1);
      }

      const goalX = courseLength - distance + player.x;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 背景
      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 雲
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      const cloudOffset = (distance * 0.2) % (canvas.width + 100);
      ctx.beginPath();
      ctx.arc(400 - cloudOffset, 60, 25, 0, Math.PI * 2);
      ctx.arc(430 - cloudOffset, 50, 30, 0, Math.PI * 2);
      ctx.arc(460 - cloudOffset, 60, 25, 0, Math.PI * 2);
      ctx.fill();

      // 地面
      ctx.fillStyle = '#8B5A2B';
      ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
      ctx.fillStyle = '#2ECC71';
      ctx.fillRect(0, groundY, canvas.width, 12);

      // 穴
      obstacles.forEach((obs) => {
        if (obs.isGap) {
          ctx.fillStyle = '#87CEEB';
          ctx.fillRect(obs.x, groundY, obs.width, canvas.height - groundY);
        }
      });

      // 土管
      obstacles.forEach((obs) => {
        if (!obs.isGap) {
          const obsTop = groundY - obs.height;
          ctx.fillStyle = '#27ae60';
          ctx.fillRect(obs.x, obsTop, obs.width, obs.height);
          ctx.strokeStyle = '#1e8449';
          ctx.lineWidth = 3;
          ctx.strokeRect(obs.x, obsTop, obs.width, obs.height);

          ctx.fillStyle = '#2ecc71';
          ctx.fillRect(obs.x - 3, obsTop, obs.width + 6, 8);
          ctx.strokeRect(obs.x - 3, obsTop, obs.width + 6, 8);
        }
      });

      // 敵
      enemies.forEach((enemy) => {
        if (enemy.type === 'bug') {
          ctx.fillStyle = '#8e44ad';
          ctx.beginPath();
          ctx.arc(enemy.x + 12, enemy.y + 12, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#2c3e50';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(enemy.x + 8, enemy.y + 4);
          ctx.lineTo(enemy.x + 4, enemy.y - 2);
          ctx.moveTo(enemy.x + 16, enemy.y + 4);
          ctx.lineTo(enemy.x + 20, enemy.y - 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = '#ecf0f1';
          ctx.fillRect(enemy.x + 2, enemy.y + 2, 20, 16);
          ctx.fillRect(enemy.x + 6, enemy.y + 18, 12, 6);
          ctx.fillStyle = '#2c3e50';
          ctx.fillRect(enemy.x + 5, enemy.y + 6, 5, 5);
          ctx.fillRect(enemy.x + 14, enemy.y + 6, 5, 5);
        }
      });

      // アイテム描画
      const rainbowColors = ['#ff4d4d', '#ffaf46', '#fff200', '#4cd137', '#00a8ff', '#9c88ff'];

      items.forEach((item) => {
        if (item.collected) return;

        if (item.type === 'star') {
          const rainbowColor = rainbowColors[Math.floor((frameCount / 4) + item.x) % rainbowColors.length];
          drawStar(ctx, item.x, item.y, 5, 14, 7, rainbowColor);
        } else {
          ctx.beginPath();
          ctx.arc(item.x, item.y, 9, 0, Math.PI * 2);
          ctx.fillStyle = '#f1c40f';
          ctx.fill();
          ctx.strokeStyle = '#d35400';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = '#d35400';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('$', item.x, item.y + 1);
        }
      });

      // ゴール
      if (goalX < canvas.width + 100) {
        ctx.fillStyle = '#bdc3c7';
        ctx.fillRect(goalX, groundY - 180, 8, 180);
        ctx.fillStyle = '#1abc9c';
        ctx.beginPath();
        ctx.moveTo(goalX + 8, groundY - 180);
        ctx.lineTo(goalX + 45, groundY - 165);
        ctx.lineTo(goalX + 8, groundY - 150);
        ctx.fill();

        if (player.x + player.width >= goalX) {
          gameClear(currentScore);
          return;
        }
      }

      // キャラクター描画
      const isStarActive = player.starTimer > 0;
      const currentRainbowColor = rainbowColors[Math.floor(frameCount / 3) % rainbowColors.length];

      ctx.fillStyle = isStarActive ? currentRainbowColor : '#f1c40f';
      ctx.fillRect(player.x + 4, player.y, 16, 6);
      ctx.fillRect(player.x + 12, player.y + 4, 12, 4);

      ctx.fillStyle = '#ffdfc4';
      ctx.fillRect(player.x + 4, player.y + 6, 14, 10);
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(player.x + 12, player.y + 8, 7, 4);

      ctx.fillStyle = isStarActive ? '#ffffff' : '#f39c12';
      ctx.fillRect(player.x + 2, player.y + 16, 16, 4);

      ctx.fillStyle = isStarActive ? currentRainbowColor : '#1abc9c';
      ctx.fillRect(player.x + 4, player.y + 20, 14, 10);

      ctx.fillStyle = '#34495e';
      ctx.fillRect(player.x + 6, player.y + 30, 12, 6);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(player.x + 6, player.y + 36, 5, 4);
      ctx.fillRect(player.x + 13, player.y + 36, 5, 4);
      ctx.fillStyle = isStarActive ? currentRainbowColor : '#f1c40f';
      ctx.fillRect(player.x + 9, player.y + 38, 3, 2);
      ctx.fillRect(player.x + 16, player.y + 38, 3, 2);

      // パーティクル
      particles.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.03;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.globalAlpha = 1.0;

        if (p.alpha <= 0) particles.splice(idx, 1);
      });

      animId = requestAnimationFrame(update);
    };

    const gameOver = () => {
      cancelAnimationFrame(animId);
      setTimeout(() => setGameState('GAMEOVER'), 100);
    };

    const gameClear = (finalScore: number) => {
      cancelAnimationFrame(animId);
      if (finalScore > highScore) {
        setHighScore(finalScore);
        localStorage.setItem('onekey_highscore', finalScore.toString());
      }
      setGameState('CLEAR');
    };

    animId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('pointerdown', onPointerDown);
    };
  }, [gameState, difficulty]);

  return (
    <div className="game-container">
      <header className="ui-header">
        <div className="score-box">SCORE: {score}</div>
        <div className="coin-box">🪙 x {coins}</div>
        <div className="highscore-box">BEST: {highScore}</div>
      </header>

      <canvas ref={canvasRef} width={640} height={360} className="game-canvas" />

      {gameState === 'START' && (
        <div className="overlay">
          <h1>ダッシュ＆ジャンプ！</h1>
          <p>画面タップ or スペースキーでジャンプ！</p>
          <div className="difficulty-select">
            {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
              <button
                key={d}
                className={`diff-btn ${difficulty === d ? 'active' : ''}`}
                onClick={() => setDifficulty(d)}
              >
                {d === 'easy' ? 'かんたん' : d === 'normal' ? 'ふつう' : 'むずかしい'}
              </button>
            ))}
          </div>
          <button className="start-btn" onClick={() => setGameState('PLAYING')}>
            スタート！
          </button>
        </div>
      )}

{gameState === 'GAMEOVER' && (
        <div className="overlay red">
          <h1>ゲームオーバー</h1>
          <p>スコア: {score}</p>
          <button className="start-btn" onClick={() => setGameState('PLAYING')}>
            もう一度挑戦！
          </button>
          <button className="back-btn" onClick={() => setGameState('START')}>
            難易度を選ぶ
          </button>
        </div>
      )}

      {gameState === 'CLEAR' && (
        <div className="overlay gold">
          <h1>🎉 ゴールクリア！！ 🎉</h1>
          <p>1分完走おめでとう！</p>
          <p>最終スコア: {score}</p>
          <button className="start-btn" onClick={() => setGameState('PLAYING')}>
            もう一度遊ぶ
          </button>
          <button className="back-btn dark" onClick={() => setGameState('START')}>
            難易度を選ぶ
          </button>
        </div>
      )}
    </div>
  );
}