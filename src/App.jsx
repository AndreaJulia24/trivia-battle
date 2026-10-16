import { useState, useEffect, useRef } from 'react';
import './App.css';

function decodeHtml(html) {
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
}

function App() {
  const [gameState, setGameState] = useState('menu'); // 'menu' | 'playing' | 'gameover'
  const [difficulty, setDifficulty] = useState('easy');
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [timer, setTimer] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Leaderboard állapotok
  const [playerName, setPlayerName] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [scoreSaved, setScoreSaved] = useState(false);

  const timerRef = useRef(null);

  // Leaderboard betöltése localStorage-ból induláskor
  useEffect(() => {
    const saved = localStorage.getItem('trivia_leaderboard');
    if (saved) {
      setLeaderboard(JSON.parse(saved));
    }
  }, []);

  const startGame = async () => {
    setLoading(true);
    setError(null);
    setCurrentIndex(0);
    setScore(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setPlayerName('');
    setScoreSaved(false);

    try {
      const res = await fetch(
        `https://opentdb.com/api.php?amount=10&category=10&difficulty=${difficulty}&type=multiple`
      );
      const data = await res.json();

      if (data.response_code === 5) {
        setError('Túl sok kérés az API felé, várj pár másodpercet és próbáld újra!');
        setLoading(false);
        return;
      }

      if (data.results && data.results.length > 0) {
        const formatted = data.results.map((q) => {
          const options = [...q.incorrect_answers, q.correct_answer].sort(
            () => Math.random() - 0.5
          );
          return {
            question: decodeHtml(q.question),
            correctAnswer: decodeHtml(q.correct_answer),
            options: options.map((opt) => decodeHtml(opt)),
          };
        });
        setQuestions(formatted);
        setGameState('playing');
        resetTimer();
      } else {
        setError('Ebben a kategóriában nem érhető el elég kérdés.');
      }
    } catch {
      setError('Hálózati hiba történt a lekérés során.');
    } finally {
      setLoading(false);
    }
  };

  const resetTimer = () => {
    clearInterval(timerRef.current);
    setTimer(10);
  };

  useEffect(() => {
    if (gameState === 'playing' && !isAnswered && !loading && questions.length > 0) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [gameState, currentIndex, isAnswered, loading, questions]);

  const handleTimeout = () => {
    setIsAnswered(true);
    setSelectedAnswer('TIMEOUT');
    setTimeout(() => nextQuestion(), 1500);
  };

  const handleSelectAnswer = (opt) => {
    if (isAnswered) return;
    clearInterval(timerRef.current);
    setIsAnswered(true);
    setSelectedAnswer(opt);

    if (opt === questions[currentIndex].correctAnswer) {
      setScore((prev) => prev + 1);
    }

    setTimeout(() => {
      nextQuestion();
    }, 1500);
  };

  const nextQuestion = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setIsAnswered(false);
      resetTimer();
    } else {
      setGameState('gameover');
      clearInterval(timerRef.current);
    }
  };

  // Eredmény mentése localStorage-ba (Top 5 szűréssel)
  const handleSaveScore = (e) => {
    e.preventDefault();
    if (!playerName.trim() || scoreSaved) return;

    const newEntry = {
      name: playerName.trim(),
      score: score,
      total: questions.length,
      date: new Date().toLocaleDateString('hu-HU'),
    };

    const updated = [...leaderboard, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    setLeaderboard(updated);
    localStorage.setItem('trivia_leaderboard', JSON.stringify(updated));
    setScoreSaved(true);
  };

  const getButtonClass = (opt) => {
    if (!isAnswered) return 'option-btn';
    const currentQ = questions[currentIndex];
    if (opt === currentQ.correctAnswer) return 'option-btn correct';
    if (opt === selectedAnswer) return 'option-btn wrong';
    return 'option-btn disabled';
  };

  return (
    <div className="container">
      <h1>Trivia Battle</h1>

      {/* 1. MENÜ NÉZET */}
      {gameState === 'menu' && (
        <div style={{ marginTop: '1.5rem' }}>
          <p style={{ marginBottom: '1rem', color: '#94a3b8' }}>Válassz nehézségi szintet:</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {['easy', 'medium', 'hard'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setDifficulty(lvl)}
                className={`diff-btn ${difficulty === lvl ? 'active-diff' : ''}`}
              >
                {lvl.toUpperCase()}
              </button>
            ))}
          </div>

          {error && <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</p>}

          <button className="start-btn" onClick={startGame} disabled={loading}>
            {loading ? 'Betöltés...' : 'Játék indítása'}
          </button>

          {/* Dicsőségtábla a menüben */}
          {leaderboard.length > 0 && (
            <div className="leaderboard-card">
              <h3>Eredménylista</h3>
              <ol className="leaderboard-list">
                {leaderboard.map((item, idx) => (
                  <li key={idx}>
                    <span className="player-name">{item.name}</span>
                    <span className="player-score">{item.score} / {item.total}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* 2. JÁTÉK NÉZET */}
      {gameState === 'playing' && questions.length > 0 && (
        <div style={{ marginTop: '1rem', textAlign: 'left' }}>
          <div className="progress-container">
            <div
              className="progress-bar"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            ></div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.9rem' }}>
            <span>Kérdés: {currentIndex + 1} / {questions.length}</span>
            <span className={`timer-badge ${timer <= 3 ? 'timer-danger' : ''}`}>
               <i className="fas fa-clock"></i> {timer}s
            </span>
          </div>

          <h3 style={{ margin: '1.2rem 0', fontSize: '1.15rem', lineHeight: '1.4' }}>
            {questions[currentIndex].question}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {questions[currentIndex].options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectAnswer(opt)}
                disabled={isAnswered}
                className={getButtonClass(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. JÁTÉK VÉGE ÉS MENTÉS NÉZET */}
      {gameState === 'gameover' && (
        <div style={{ marginTop: '1.5rem' }}>
          <h2>Játék vége!</h2>
          <p style={{ margin: '1.2rem 0', fontSize: '1.2rem' }}>
            Összesített eredményed: <strong>{score} / {questions.length}</strong> helyes válasz
          </p>

          {!scoreSaved ? (
            <form onSubmit={handleSaveScore} className="save-form">
              <input
                type="text"
                placeholder="Add meg a neved..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={15}
                required
              />
              <button type="submit" className="save-btn">Mentés</button>
            </form>
          ) : (
            <p style={{ color: '#10b981', fontWeight: 'bold', marginBottom: '1rem' }}>
              ✓ Eredmény sikeresen elmentve!
            </p>
          )}

          {/* Dicsőségtábla a végén */}
          <div className="leaderboard-card">
            <h3>Eredménylista</h3>
            {leaderboard.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Még nincsenek mentett pontszámok.</p>
            ) : (
              <ol className="leaderboard-list">
                {leaderboard.map((item, idx) => (
                  <li key={idx}>
                    <span className="player-name">{item.name}</span>
                    <span className="player-score">{item.score} / {item.total}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <button className="start-btn" onClick={() => setGameState('menu')} style={{ marginTop: '1.5rem' }}>
            Új játék indítása
          </button>
        </div>
      )}
    </div>
  );
}

export default App;