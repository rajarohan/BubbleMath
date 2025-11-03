# Math Bubbles — Basic Expression Game

Open `index.html` in a browser to play.

What it is
- A tiny web-based mini-game to practice comparing simple math expressions.
- Click the three bubbles in order: Lowest → Middle → Highest. Each level lasts ~15s and gets slightly faster.

How to run
1. Open the folder and double-click `index.html`, or run a simple static server:

```bash
# from macOS zsh terminal
cd '/Users/rajarohanvaidyula/Documents/Playground/Games/Bubble Math'
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```

Notes & tweaks
- Numbers in expressions use integers 1–20. Division attempts to pick a divisor so the result is whole when possible.
- Timer shortens slightly each level (minimum 5s). Score increments only for fully correct selections.
- Uses the Web Audio API for short feedback tones (may require a user gesture to enable audio in some browsers).

Ideas for improvements
- Add background music and ticking sound.
- Track high scores in localStorage.
- Add varying bubble counts or advanced expressions for higher levels.

Have fun and learn!
