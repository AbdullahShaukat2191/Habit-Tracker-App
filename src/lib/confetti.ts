import confetti from 'canvas-confetti'

const COLORS = ['#E879B9', '#FFFFFF', '#B8A8C8', '#A7F3D0', '#4F3060']

export function cellConfetti(originX: number, originY: number) {
  confetti({
    particleCount: 12,
    spread: 45,
    origin: { x: originX / window.innerWidth, y: originY / window.innerHeight },
    colors: COLORS,
    ticks: 80,
    gravity: 1.2,
    scalar: 0.8,
    startVelocity: 20,
  })
}

export function taskConfetti() {
  confetti({
    particleCount: 15,
    spread: 60,
    origin: { x: 0.1, y: 0.6 },
    colors: COLORS,
    ticks: 100,
  })
  confetti({
    particleCount: 15,
    spread: 60,
    origin: { x: 0.9, y: 0.6 },
    colors: COLORS,
    ticks: 100,
  })
}

export function allTasksConfetti() {
  const fire = (particleRatio: number, opts: confetti.Options) => {
    confetti({
      ...opts,
      particleCount: Math.floor(150 * particleRatio),
      colors: COLORS,
    })
  }

  fire(0.4, { spread: 80, origin: { x: 0.2, y: 0.6 } })
  fire(0.3, { spread: 80, origin: { x: 0.5, y: 0.6 }, angle: 90 })
  fire(0.4, { spread: 80, origin: { x: 0.8, y: 0.6 } })
}

export function goalConfetti() {
  const fire = (particleRatio: number, opts: confetti.Options) => {
    confetti({
      ...opts,
      particleCount: Math.floor(200 * particleRatio),
      colors: COLORS,
      ticks: 180,
      gravity: 0.8,
    })
  }

  fire(0.35, { spread: 100, origin: { x: 0.1, y: 0.5 } })
  fire(0.3, { spread: 120, origin: { x: 0.5, y: 0.4 }, angle: 90 })
  fire(0.35, { spread: 100, origin: { x: 0.9, y: 0.5 } })
}
