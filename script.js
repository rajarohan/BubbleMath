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

  let score = 0
  let level = 1
  let gameStarted = false
  const MAX_LEVEL = 25
  let timeLimit = 15.0 // seconds (will reduce slightly as levels increase)
  let timeLeft = timeLimit
  let timerInterval = null
  let currentSet = [] // {expr, value, id}
  let accepting = true

  // utilities
  function randInt(min, max){ return Math.floor(Math.random()*(max-min+1))+min }

  // generate an expression with integers 1-20 and operators + - × ÷ or squared (²)
  // generate a basic expression suitable for the current level
  function genExpression(currentLevel){
    const ops = ['+','-','×','÷','²']
    const op = ops[randInt(0, ops.length-1)]

    // determine operand ranges based on level - keep operations simple but numbers larger
    function rangesForLevel(l){
      if(l <= 10) return {min:1, max:20, type: 'small'}
      if(l <= 20) return {min:1, max:99, type: 'med'}
      // levels 21-25: use larger numbers but keep operations basic
      return {min:1, max:999, type: 'large'}
    }

    const r = rangesForLevel(currentLevel)

    if(op === '²'){
      // keep squares reasonable even at high levels
      let maxSquareBase = 15
      if(r.type === 'med') maxSquareBase = 12
      if(r.type === 'large') maxSquareBase = 20
      const n = randInt(2, maxSquareBase)
      return {text: `${n}²`, value: n*n}
    }

    // for high levels, strategically pick numbers to keep basic operations
    let a, b
    if(r.type === 'large'){
      // for large numbers, use simpler combinations to keep mental math doable
      if(op === '×'){
        // multiplication: use smaller numbers or nice round numbers
        if(Math.random() < 0.5){
          a = randInt(100, 999)
          b = randInt(2, 9) // multiply large number by single digit
        } else {
          a = randInt(10, 99) 
          b = randInt(10, 99) // two 2-digit numbers
        }
      } else if(op === '÷'){
        // division: ensure clean division with larger numbers
        b = randInt(2, 20)
        a = b * randInt(10, 50) // ensure a is divisible by b
      } else {
        // addition/subtraction: use mix of large and small numbers
        if(Math.random() < 0.5){
          a = randInt(100, 999)
          b = randInt(1, 99)
        } else {
          a = randInt(10, 99)
          b = randInt(100, 999)
        }
      }
    } else {
      // for small/med levels, use normal ranges
      a = randInt(r.min, r.max)
      b = randInt(r.min, r.max)
      
      // for division, try to find clean divisors
      if(op === '÷'){
        const divisors = []
        for(let d=1; d<=r.max && d<=a; d++){ 
          if(a % d === 0) divisors.push(d) 
        }
        if(divisors.length > 1){ 
          b = divisors[randInt(1, divisors.length-1)] // avoid dividing by 1
        }
      }
    }

    // generate the expression
    if(op === '÷'){
      return {text: `${a} ÷ ${b}`, value: Math.round((a / b) * 100) / 100} // round to 2 decimals max
    }
    if(op === '×') return {text: `${a} × ${b}`, value: a * b}
    if(op === '+') return {text: `${a} + ${b}`, value: a + b}
    // '-'
    return {text: `${a} - ${b}`, value: a - b}
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
    startLevel()
  }

  function resetGame(){
    gameStarted = false
    score = 0
    level = 1
    accepting = false
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
    
    // show start screen
    startScreen.classList.remove('hidden')
  }

  function startLevel(){
    if (!gameStarted) return
    accepting = true
    timeLimit = Math.max(5, 15 - (level-1)*0.5) // get slightly faster each level, min 5s
    timeLeft = timeLimit
    timeEl.textContent = timeLeft.toFixed(1)
    levelEl.textContent = level

    // generate three distinct expressions suited to this level
    currentSet = []
    while(currentSet.length < 3){
      const expr = genExpression(level)
      // avoid duplicate text
      if(!currentSet.some(e=>e.text===expr.text)) currentSet.push(Object.assign({},expr))
    }

    // assign to buttons shuffled
    const order = shuffle([0,1,2])
    bubbleButtons.forEach((btn, i)=>{
      const data = currentSet[order[i]]
      btn.textContent = data.text
      btn.dataset.value = data.value
      btn.classList.remove('selected','disabled')
      btn.disabled = false
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
    showFeedback(false)
    // move to next level (no score)
    setTimeout(()=>{ level = Math.min(MAX_LEVEL, level + 1); startLevel() }, 900)
  }

  function evaluateSelection(){
    // map current visible buttons to their numeric values and sort
    const vals = bubbleButtons.map(b=>({el:b, v: parseFloat(b.dataset.value)}))
    const sorted = [...vals].sort((a,b)=>a.v-b.v)
    return sorted // lowest to highest
  }

  function handleBubbleClick(e){
    if(!accepting) return
    const clicked = e.currentTarget
    const expectedOrder = evaluateSelection()
    // find index among non-disabled buttons of clicked
    const nextExpected = expectedOrder.findIndex(x=> !x.el.classList.contains('disabled'))
    const expectedEl = expectedOrder[nextExpected].el

    if(clicked === expectedEl){
      // correct
      clicked.classList.add('disabled')
      clicked.style.transform = 'scale(0.9)'
      // disable pointer
      clicked.disabled = true

      // if that was the last (all disabled), success
      const allDisabled = bubbleButtons.every(b=>b.disabled)
      if(allDisabled){
        accepting = false
        score += 1
        scoreEl.textContent = score
        showFeedback(true)
        clearInterval(timerInterval)
          setTimeout(()=>{ level = Math.min(MAX_LEVEL, level + 1); startLevel() }, 700)
      }
    } else {
      // wrong selection
      accepting = false
      showFeedback(false)
      clearInterval(timerInterval)
      setTimeout(()=>{ level = Math.min(MAX_LEVEL, level + 1); startLevel() }, 900)
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

  // initial setup - show start screen
  resetGame()

  // expose for debugging on window
  window.MathBubbles = {startGame, resetGame, startLevel}

})();
