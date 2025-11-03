// Math Bubbles — core game logic
(function(){
  const scoreEl = document.getElementById('score')
  const levelEl = document.getElementById('level')
  const timeEl = document.getElementById('time')
  const timerBar = document.getElementById('timerBar')
  const bubblesWrap = document.getElementById('bubbles')
  const bubbleButtons = Array.from(document.querySelectorAll('.bubble'))
  const flash = document.getElementById('flash')
  const startScreen = document.getElementById('startScreen')
  const startBtn = document.getElementById('startBtn')
  const resetBtn = document.getElementById('resetBtn')
  const completionScreen = document.getElementById('completionScreen')
  const playAgainBtn = document.getElementById('playAgainBtn')
  const finalScoreEl = document.getElementById('finalScore')
  const scoreMessageEl = document.getElementById('scoreMessage')

  let score = 0
  let level = 1
  let gameStarted = false
  const MAX_LEVEL = 25
  let timeLimit = 15.0 // seconds (will reduce slightly as levels increase)
  let timeLeft = timeLimit
  let timerInterval = null
  let currentSet = [] // {expr, value, id}
  let accepting = true
  let clickedSequence = [] // track order of clicks

  // utilities
  function randInt(min, max){ return Math.floor(Math.random()*(max-min+1))+min }

  // generate an expression with integers 1-20 and operators + - × ÷ or squared (²)
  // generate a basic expression suitable for the current level
  function genExpression(currentLevel){
    const ops = ['+','-','×','÷','²']
    const op = ops[randInt(0, ops.length-1)]

    // determine operand ranges based on level - keep operations simple but numbers larger
    function rangesForLevel(l){
      if(l <= 5) return {min:1, max:20, type: 'small', allowDecimals: false}
      if(l <= 10) return {min:1, max:30, type: 'small', allowDecimals: true}
      if(l <= 15) return {min:5, max:50, type: 'med', allowDecimals: true}
      if(l <= 20) return {min:10, max:80, type: 'med', allowDecimals: true}
      // levels 21-25: larger range but results should still be close
      return {min:20, max:150, type: 'large', allowDecimals: true}
    }

    const r = rangesForLevel(currentLevel)

    if(op === '²'){
      // keep squares reasonable and results closer together
      let maxSquareBase = Math.min(Math.floor(Math.sqrt(r.max * 0.8)), 12)
      let minSquareBase = Math.max(2, Math.floor(Math.sqrt(r.min)))
      const n = randInt(minSquareBase, maxSquareBase)
      return {text: `${n}²`, value: n*n}
    }

    let a, b
    
    // Generate numbers with constraints to avoid problematic operations
    if(op === '×'){
      // avoid multiplying by self, 0, or 1
      if(r.type === 'large'){
        a = randInt(r.min, Math.min(r.max, 50))
        do {
          b = randInt(2, 8) // keep multiplier small for reasonable results
        } while(b === a || b === 0 || b === 1)
      } else {
        a = randInt(r.min, r.max)
        do {
          b = randInt(2, Math.min(r.max, 15))
        } while(b === a || b === 0 || b === 1)
      }
    } else if(op === '÷'){
      // division: ensure clean division, avoid dividing by 1, 0, or self
      let attempts = 0
      do {
        if(r.allowDecimals && Math.random() < 0.4){
          // allow some decimal results after level 5
          a = randInt(r.min, r.max)
          b = randInt(2, Math.min(20, Math.floor(r.max/2)))
        } else {
          // prefer integer results
          b = randInt(2, Math.min(20, Math.floor(r.max/2)))
          const multiplier = randInt(2, Math.floor(r.max/b))
          a = b * multiplier
        }
        attempts++
      } while((b === 0 || b === 1 || b === a) && attempts < 10)
      
      // fallback if we can't find good numbers
      if(b === 0 || b === 1 || b === a){
        b = randInt(2, 5)
        a = b * randInt(3, 8)
      }
    } else {
      // addition/subtraction: choose numbers to keep results in reasonable range
      const targetRange = r.max - r.min
      const halfRange = targetRange / 2
      
      if(op === '+'){
        // for addition, keep both numbers smaller to avoid huge sums
        const maxA = Math.min(r.max, r.min + halfRange)
        const maxB = Math.min(r.max, r.min + halfRange)
        a = randInt(r.min, maxA)
        b = randInt(r.min, maxB)
      } else {
        // for subtraction, ensure positive result and reasonable range
        a = randInt(r.min + halfRange, r.max)
        b = randInt(r.min, Math.min(a - 1, r.min + halfRange))
      }
    }

    // add decimal variations for levels 6+
    if(r.allowDecimals && currentLevel > 5 && Math.random() < 0.3){
      if(op === '+' || op === '-'){
        // occasionally use decimal for one operand
        if(Math.random() < 0.5){
          a = Math.round(a * 10 + randInt(1, 9)) / 10 // add .1 to .9
        } else {
          b = Math.round(b * 10 + randInt(1, 9)) / 10
        }
      }
    }

    // generate the expression
    if(op === '÷'){
      const result = a / b
      return {text: `${a} ÷ ${b}`, value: Math.round(result * 100) / 100} // round to 2 decimals max
    }
    if(op === '×') return {text: `${a} × ${b}`, value: Math.round((a * b) * 100) / 100}
    if(op === '+') return {text: `${a} + ${b}`, value: Math.round((a + b) * 100) / 100}
    // '-'
    return {text: `${a} - ${b}`, value: Math.round((a - b) * 100) / 100}
  }

  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}
    return arr
  }

  function placeBubbles(){
    // add slight random animation durations and delays for more organic motion
    bubbleButtons.forEach((btn, idx)=>{
      const dur = (4 + Math.random()*2).toFixed(2) + 's'
      const delay = (Math.random()*1.2).toFixed(2) + 's'
      btn.style.animationDuration = dur
      btn.style.animationDelay = delay
      btn.style.transform = 'translateZ(0)'
    })
  }

  function startGame(){
    gameStarted = true
    startScreen.classList.add('hidden')
    completionScreen.classList.add('hidden')
    startLevel()
  }

  function showCompletionScreen(){
    gameStarted = false
    accepting = false
    if(timerInterval) clearInterval(timerInterval)
    
    // show completion screen with final score
    finalScoreEl.textContent = score
    
    // personalized message based on score
    let message = "Great job!"
    if(score >= 23) message = "Outstanding! Nearly perfect! 🌟"
    else if(score >= 20) message = "Excellent work! 🎯"
    else if(score >= 15) message = "Well done! 👏"
    else if(score >= 10) message = "Good effort! Keep practicing! 💪"
    else message = "Nice try! Every attempt makes you better! 🚀"
    
    scoreMessageEl.textContent = message
    completionScreen.classList.remove('hidden')
    
    // play celebration sound
    playTone(523, 0.2) // C note
    setTimeout(() => playTone(659, 0.2), 200) // E note
    setTimeout(() => playTone(784, 0.3), 400) // G note
  }

  function resetGame(){
    gameStarted = false
    score = 0
    level = 1
    accepting = false
    clickedSequence = []
    if(timerInterval) clearInterval(timerInterval)
    
    // reset UI
    scoreEl.textContent = score
    levelEl.textContent = level
    timeEl.textContent = '15.0'
    timerBar.style.width = '100%'
    
    // reset bubbles
    bubbleButtons.forEach(btn => {
      btn.textContent = '?'
      btn.classList.remove('selected', 'disabled')
      btn.disabled = false
      btn.style.transform = ''
    })
    
    // hide completion screen and show start screen
    completionScreen.classList.add('hidden')
    startScreen.classList.remove('hidden')
  }

  function startLevel(){
    if (!gameStarted) return
    accepting = true
    clickedSequence = [] // reset click tracking
    timeLimit = 15.0 // keep constant 15 seconds for all levels
    timeLeft = timeLimit
    timeEl.textContent = timeLeft.toFixed(1)
    levelEl.textContent = level

    // generate three distinct expressions with values reasonably close together
    currentSet = []
    let attempts = 0
    while(currentSet.length < 3 && attempts < 50){
      const expr = genExpression(level)
      // avoid duplicate text and ensure values aren't too spread out
      if(!currentSet.some(e=>e.text===expr.text)) {
        currentSet.push(Object.assign({},expr))
        
        // if we have 3 expressions, check if values are reasonably close
        if(currentSet.length === 3){
          const values = currentSet.map(e => e.value).sort((a,b) => a-b)
          const range = values[2] - values[0]
          const maxRange = level <= 5 ? 50 : level <= 10 ? 100 : level <= 15 ? 200 : 300
          
          // if values are too spread out, try again
          if(range > maxRange){
            currentSet = []
          }
        }
      }
      attempts++
    }
    
    // fallback if we couldn't generate good expressions
    if(currentSet.length < 3){
      currentSet = []
      while(currentSet.length < 3){
        const expr = genExpression(level)
        if(!currentSet.some(e=>e.text===expr.text)) currentSet.push(Object.assign({},expr))
      }
    }

    // assign to buttons shuffled
    const order = shuffle([0,1,2])
    bubbleButtons.forEach((btn, i)=>{
      const data = currentSet[order[i]]
      btn.textContent = data.text
      btn.dataset.value = data.value
      btn.classList.remove('selected','disabled')
      btn.disabled = false
      btn.style.transform = '' // reset any scaling
    })

    // start timer
    startTimer()
    placeBubbles()
  }

  function startTimer(){
    if(timerInterval) clearInterval(timerInterval)
    const start = performance.now()
    timerInterval = setInterval(()=>{
      const elapsed = (performance.now() - start)/1000
      timeLeft = Math.max(0, timeLimit - elapsed)
      timeEl.textContent = timeLeft.toFixed(1)
      const pct = (timeLeft/timeLimit) * 100
      timerBar.style.width = pct + '%'
      if(timeLeft <= 0){
        clearInterval(timerInterval)
        onTimeUp()
      }
    }, 80)
  }

  function onTimeUp(){
    accepting = false
    // if incomplete sequence, evaluate what was clicked
    if(clickedSequence.length > 0 && clickedSequence.length < 3) {
      evaluateSequence()
    } else {
      showFeedback(false)
      
      // check if game is complete
      if(level >= MAX_LEVEL){
        setTimeout(() => showCompletionScreen(), 900)
      } else {
        setTimeout(()=>{ level = Math.min(MAX_LEVEL, level + 1); startLevel() }, 900)
      }
    }
  }



  function handleBubbleClick(e){
    if(!accepting) return
    const clicked = e.currentTarget
    
    // prevent clicking the same bubble twice
    if(clicked.disabled) return
    
    // record this click
    clickedSequence.push(clicked)
    
    // visual feedback for clicked bubble
    clicked.classList.add('disabled')
    clicked.disabled = true
    
    // soft click sound
    playTone(300, 0.05)

    // if all three bubbles clicked, evaluate the sequence
    if(clickedSequence.length === 3){
      accepting = false
      clearInterval(timerInterval)
      setTimeout(() => evaluateSequence(), 300) // small delay for visual feedback
    }
  }

  function evaluateSequence(){
    // get the correct order (lowest to highest values)
    const correctOrder = bubbleButtons
      .map(b => ({el: b, value: parseFloat(b.dataset.value)}))
      .sort((a, b) => a.value - b.value)
      .map(item => item.el)
    
    // check if clicked sequence matches correct order
    const isCorrect = clickedSequence.every((clickedEl, index) => clickedEl === correctOrder[index])
    
    if(isCorrect){
      score += 1
      scoreEl.textContent = score
      showFeedback(true)
      
      // check if game is complete
      if(level >= MAX_LEVEL){
        setTimeout(() => showCompletionScreen(), 700)
      } else {
        setTimeout(()=>{ level = Math.min(MAX_LEVEL, level + 1); startLevel() }, 700)
      }
    } else {
      showFeedback(false)
      
      // check if game is complete
      if(level >= MAX_LEVEL){
        setTimeout(() => showCompletionScreen(), 900)
      } else {
        setTimeout(()=>{ level = Math.min(MAX_LEVEL, level + 1); startLevel() }, 900)
      }
    }
  }

  function showFeedback(correct){
    flash.classList.remove('show-correct','show-wrong')
    if(correct){
      flash.classList.add('show-correct')
      // small pulse on center
      flash.style.transition = 'opacity .12s'
      // optional tone
      playTone(600, 0.08)
    } else {
      flash.classList.add('show-wrong')
      playTone(220, 0.18)
    }
    setTimeout(()=>{ flash.classList.remove('show-correct','show-wrong') }, 400)
  }

  // small Web Audio helper for tones/tick
  let audioCtx = null
  function ensureAudio(){ if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)() }
  function playTone(freq, dur){
    try{
      ensureAudio()
      const o = audioCtx.createOscillator()
      const g = audioCtx.createGain()
      o.type = 'sine'
      o.frequency.value = freq
      o.connect(g); g.connect(audioCtx.destination)
      g.gain.value = 0
      const now = audioCtx.currentTime
      g.gain.linearRampToValueAtTime(0.0001, now)
      g.gain.linearRampToValueAtTime(0.14, now + 0.01)
      o.start(now)
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
      o.stop(now + dur + 0.02)
    }catch(e){/* audio lock may prevent autoplay until interaction */}
  }

  // wire events
  bubbleButtons.forEach(b=>b.addEventListener('click', handleBubbleClick))
  startBtn.addEventListener('click', startGame)
  resetBtn.addEventListener('click', resetGame)
  playAgainBtn.addEventListener('click', resetGame)

  // initial setup - show start screen
  resetGame()

  // expose for debugging on window
  window.MathBubbles = {startGame, resetGame, startLevel}

})();
