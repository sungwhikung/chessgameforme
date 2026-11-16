(function () {
    'use strict';

    // ───────── 설정 ─────────

    // 깊이(depth) 고정 대신 시간 제한으로 탐색 → 최고 난이도도 약 1초 안에 응수
    var LEVELS = [
        { id: 'easy',   name: '입문', skill: 0,  depth: 1 },
        { id: 'casual', name: '초급', skill: 3,  depth: 4 },
        { id: 'mid',    name: '중급', skill: 9,  movetime: 300 },
        { id: 'hard',   name: '상급', skill: 15, movetime: 600 },
        { id: 'max',    name: '최강', skill: 20, movetime: 1000 }
    ];
    var ENGINE_URL = 'vendor/stockfish-19-lite-single.js';
    var SPRITE = 'vendor/pieces.svg';
    var MIN_REPLY_MS = 420;      // AI 수가 내 수 애니메이션과 겹치지 않도록
    var VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    var SVGNS = 'http://www.w3.org/2000/svg';

    var $ = function (id) { return document.getElementById(id); };
    var boardEl = $('board'), squaresEl = $('squares'), piecesEl = $('pieces');
    var promoEl = $('promo'), resultEl = $('result');

    var game = new Chess();
    var state = {
        human: load('color', 'w'),
        level: load('level', 'mid'),
        sound: load('sound', '1') === '1',
        flipped: false,
        selected: null,
        targets: {},        // 도착 칸 -> 합법 수 목록
        lastMove: null,
        thinking: false,
        searchId: 0
    };
    if (!LEVELS.some(function (l) { return l.id === state.level; })) state.level = 'mid';
    state.flipped = state.human === 'b';

    function load(key, fallback) {
        try { return localStorage.getItem('chess.' + key) || fallback; } catch (e) { return fallback; }
    }
    function save(key, value) {
        try { localStorage.setItem('chess.' + key, value); } catch (e) { /* 무시 */ }
    }
    function level() {
        return LEVELS.filter(function (l) { return l.id === state.level; })[0];
    }

    // ───────── 좌표 ─────────

    function xy(square) {
        var f = square.charCodeAt(0) - 97, r = +square[1];
        return state.flipped ? { x: 7 - f, y: r - 1 } : { x: f, y: 8 - r };
    }
    function squareAt(x, y) {
        if (x < 0 || x > 7 || y < 0 || y > 7) return null;
        var f = state.flipped ? 7 - x : x, r = state.flipped ? y + 1 : 8 - y;
        return String.fromCharCode(97 + f) + r;
    }
    function squareFromPoint(clientX, clientY) {
        var rect = boardEl.getBoundingClientRect(), size = rect.width / 8;
        return squareAt(Math.floor((clientX - rect.left) / size), Math.floor((clientY - rect.top) / size));
    }

    function pieceSvg(code, cls) {
        var svg = document.createElementNS(SVGNS, 'svg');
        svg.setAttribute('viewBox', '0 0 40 40');
        if (cls) svg.setAttribute('class', cls);
        var use = document.createElementNS(SVGNS, 'use');
        use.setAttribute('href', SPRITE + '#' + code);
        svg.appendChild(use);
        return svg;
    }

    // ───────── 보드 칸 ─────────

    var sqEls = {};
    function buildSquares() {
        squaresEl.textContent = '';
        sqEls = {};
        for (var y = 0; y < 8; y++) {
            for (var x = 0; x < 8; x++) {
                var name = squareAt(x, y);
                var f = name.charCodeAt(0) - 97, r = +name[1];
                var el = document.createElement('div');
                el.className = 'sq ' + ((f + r) % 2 ? 'light' : 'dark');
                if (x === 0) el.appendChild(coord('rank', name[1]));
                if (y === 7) el.appendChild(coord('file', name[0]));
                squaresEl.appendChild(el);
                sqEls[name] = el;
            }
        }
    }
    function coord(kind, text) {
        var s = document.createElement('span');
        s.className = 'coord ' + kind;
        s.textContent = text;
        return s;
    }

    // ───────── 기물 (칸 이동을 transform 전환으로 부드럽게) ─────────

    var pieces = [];   // { el, sq, code }

    function place(p) {
        var c = xy(p.sq);
        p.el.style.transform = 'translate(' + c.x * 100 + '%,' + c.y * 100 + '%)';
    }
    function pieceOn(sq) {
        for (var i = 0; i < pieces.length; i++) if (pieces[i].sq === sq) return pieces[i];
        return null;
    }
    function setCode(p, code) {
        if (p.code === code) return;
        p.code = code;
        p.el.textContent = '';
        p.el.appendChild(pieceSvg(code));
    }
    function raise(p) {
        p.el.classList.add('moving');
        setTimeout(function () { p.el.classList.remove('moving'); }, 260);
    }

    // 현재 국면에 맞춰 기물 DOM을 맞춘다. hints: [[출발, 도착], …] 은 어떤 기물이 움직였는지 알려 준다.
    function syncPieces(hints) {
        var want = {}, rows = game.board();
        for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) {
            var cell = rows[y][x];
            if (cell) want[String.fromCharCode(97 + x) + (8 - y)] = cell.color + cell.type;
        }

        var free = pieces.slice(), kept = [];
        function claim(p, sq) {
            free.splice(free.indexOf(p), 1);
            if (p.sq !== sq) { p.sq = sq; raise(p); }
            setCode(p, want[sq]);
            place(p);
            kept.push(p);
            delete want[sq];
        }

        (hints || []).forEach(function (h) {
            var p = null;
            for (var i = 0; i < free.length; i++) if (free[i].sq === h[0]) { p = free[i]; break; }
            if (p && want[h[1]] && want[h[1]][0] === p.code[0]) claim(p, h[1]);
        });
        free.slice().forEach(function (p) {
            if (want[p.sq] === p.code) claim(p, p.sq);
        });
        Object.keys(want).forEach(function (sq) {
            var best = null, bestD = 99, t = xy(sq);
            free.forEach(function (p) {
                if (p.code !== want[sq]) return;
                var c = xy(p.sq), d = Math.abs(c.x - t.x) + Math.abs(c.y - t.y);
                if (d < bestD) { best = p; bestD = d; }
            });
            if (best) claim(best, sq);
        });

        // 남은 것은 잡힌 기물 → 사라짐
        free.forEach(function (p) {
            p.el.classList.remove('dragging');
            p.el.classList.add('gone');
            setTimeout(function () { p.el.remove(); }, 320);
        });
        // 모자란 것은 새로 등장
        Object.keys(want).forEach(function (sq) {
            var el = document.createElement('div');
            el.className = 'piece enter';
            var p = { el: el, sq: sq, code: null };
            setCode(p, want[sq]);
            place(p);
            piecesEl.appendChild(el);
            void el.offsetWidth;
            el.classList.remove('enter');
            kept.push(p);
        });
        pieces = kept;
    }

    // ───────── 표시 갱신 ─────────

    function humanCanMove() {
        return !state.thinking && !game.game_over() && game.turn() === state.human && promoEl.hidden;
    }

    function renderMarks() {
        var canMove = humanCanMove();
        var checkSq = null;
        if (game.in_check()) {
            var k = pieces.filter(function (p) { return p.code === game.turn() + 'k'; })[0];
            if (k) checkSq = k.sq;
        }
        Object.keys(sqEls).forEach(function (sq) {
            var el = sqEls[sq], p = pieceOn(sq), moves = state.targets[sq];
            el.classList.toggle('last', !!state.lastMove && (state.lastMove.from === sq || state.lastMove.to === sq));
            el.classList.toggle('sel', state.selected === sq);
            el.classList.toggle('check', checkSq === sq);
            el.classList.toggle('hint', !!moves);
            el.classList.toggle('cap', !!moves && moves[0].flags.search(/[ce]/) !== -1);
            el.classList.toggle('can', canMove && !!p && p.code[0] === state.human);
        });
    }

    function select(sq) {
        state.selected = sq;
        state.targets = {};
        if (sq) {
            game.moves({ square: sq, verbose: true }).forEach(function (m) {
                (state.targets[m.to] = state.targets[m.to] || []).push(m);
            });
        }
        renderMarks();
    }

    function renderBars() {
        var bottom = state.flipped ? 'b' : 'w', top = bottom === 'w' ? 'b' : 'w';
        var taken = { w: [], b: [] }, score = { w: 0, b: 0 };
        game.history({ verbose: true }).forEach(function (m) {
            if (m.captured) { taken[m.color].push(m.captured); score[m.color] += VALUE[m.captured]; }
            if (m.promotion) score[m.color] += VALUE[m.promotion] - 1;
        });
        [[$('barTop'), top], [$('barBottom'), bottom]].forEach(function (pair) {
            var bar = pair[0], color = pair[1], other = color === 'w' ? 'b' : 'w';
            bar.querySelector('.avatar').className = 'avatar ' + color;
            var who = bar.querySelector('.who');
            who.textContent = color === state.human ? '나' : 'Stockfish';
            var small = document.createElement('small');
            small.textContent = color === state.human ? (color === 'w' ? '백' : '흑') : level().name;
            who.appendChild(small);
            var box = bar.querySelector('.taken');
            box.textContent = '';
            var prev = null;
            taken[color].slice().sort(function (a, b) { return VALUE[a] - VALUE[b] || (a < b ? -1 : 1); })
                .forEach(function (t) {
                    box.appendChild(pieceSvg(other + t, prev && prev !== t ? 'gap' : ''));
                    prev = t;
                });
            var diff = score[color] - score[other];
            bar.querySelector('.lead').textContent = diff > 0 ? '+' + diff : '';
            bar.classList.toggle('turn', !game.game_over() && game.turn() === color);
        });
    }

    function renderMoves() {
        var list = $('moves'), hist = game.history();
        list.textContent = '';
        hist.forEach(function (san, i) {
            if (i % 2 === 0) {
                var n = document.createElement('li');
                n.className = 'n';
                n.textContent = (i / 2 + 1) + '.';
                list.appendChild(n);
            }
            var m = document.createElement('li');
            m.className = 'm' + (i === hist.length - 1 ? ' cur' : '');
            m.textContent = san;
            list.appendChild(m);
        });
        list.scrollTop = list.scrollHeight;
    }

    function outcome() {
        if (game.in_checkmate()) {
            var won = game.turn() !== state.human;
            return { title: won ? '승리!' : '패배', sub: '체크메이트 — ' + (game.turn() === 'w' ? '흑' : '백') + ' 승' };
        }
        if (game.in_stalemate()) return { title: '무승부', sub: '스테일메이트' };
        if (game.in_threefold_repetition()) return { title: '무승부', sub: '3회 동형 반복' };
        if (game.insufficient_material()) return { title: '무승부', sub: '기물 부족' };
        if (game.in_draw()) return { title: '무승부', sub: '50수 규칙' };
        return null;
    }

    function renderStatus() {
        var box = $('status'), text, cls = '';
        var end = outcome();
        if (end) { text = end.title + ' · ' + end.sub; cls = 'over'; }
        else if (state.thinking) { text = 'AI가 생각 중…'; cls = 'thinking'; }
        else if (game.in_check()) { text = '체크! 당신의 차례'; cls = 'alert'; }
        else text = '당신의 차례 (' + (state.human === 'w' ? '백' : '흑') + ')';
        box.className = 'status ' + cls;
        $('statusText').textContent = text;
        $('undoBtn').disabled = game.history().length < (state.human === 'w' ? 1 : 2);
    }

    function renderAll() {
        renderMarks();
        renderBars();
        renderMoves();
        renderStatus();
    }

    function showResult() {
        var end = outcome();
        if (!end) { resultEl.hidden = true; return; }
        $('resultTitle').textContent = end.title;
        $('resultSub').textContent = end.sub;
        setTimeout(function () { if (outcome()) resultEl.hidden = false; }, 650);
    }

    // ───────── 수 두기 ─────────

    function commit(move) {
        var done = game.move(move);
        if (!done) return null;
        state.lastMove = { from: done.from, to: done.to };
        select(null);
        syncPieces([[done.from, done.to]]);
        playSound(game.in_checkmate() ? 'end' : game.in_check() ? 'check' : done.captured ? 'capture' : 'move');
        return done;
    }

    function humanMove(from, to, promotion) {
        var options = state.targets[to] || [];
        if (!options.length) return false;
        if (options[0].promotion && !promotion) { askPromotion(from, to); return true; }
        if (!commit({ from: from, to: to, promotion: promotion })) return false;
        afterMove();
        return true;
    }

    function afterMove() {
        if (game.game_over()) { state.thinking = false; renderAll(); showResult(); return; }
        if (game.turn() !== state.human) askEngine();
        else { state.thinking = false; renderAll(); }
    }

    function askPromotion(from, to) {
        var c = xy(to), order = ['q', 'n', 'r', 'b'];
        if (c.y === 7) order.reverse();
        promoEl.textContent = '';
        order.forEach(function (t) {
            var b = document.createElement('button');
            b.setAttribute('aria-label', { q: '퀸', n: '나이트', r: '룩', b: '비숍' }[t]);
            b.appendChild(pieceSvg(game.turn() + t));
            b.addEventListener('click', function () {
                promoEl.hidden = true;
                humanMove(from, to, t);
            });
            promoEl.appendChild(b);
        });
        promoEl.style.transform = 'translateX(' + c.x * 100 + '%)';
        promoEl.style.top = c.y === 7 ? 'auto' : '0';
        promoEl.style.bottom = c.y === 7 ? '0' : 'auto';
        promoEl.hidden = false;
        renderMarks();
    }
    function closePromotion() {
        if (promoEl.hidden) return;
        promoEl.hidden = true;
        syncPieces();
        renderMarks();
    }

    // ───────── 입력: 클릭 이동 + 드래그 ─────────

    var drag = null;

    boardEl.addEventListener('pointerdown', function (e) {
        if (e.button > 0 || !resultEl.hidden) return;
        if (!promoEl.hidden) { if (!promoEl.contains(e.target)) closePromotion(); return; }
        if (!humanCanMove()) return;
        var sq = squareFromPoint(e.clientX, e.clientY);
        if (!sq) return;
        var p = pieceOn(sq);

        if (state.selected && state.targets[sq]) {         // 선택된 기물을 이 칸으로
            humanMove(state.selected, sq);
            return;
        }
        if (!p || p.code[0] !== state.human) { select(null); return; }

        var wasSelected = state.selected === sq;
        select(sq);
        drag = { p: p, from: sq, x: e.clientX, y: e.clientY, active: false, wasSelected: wasSelected, hover: null, id: e.pointerId };
        try { boardEl.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
        e.preventDefault();
    });

    boardEl.addEventListener('pointermove', function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        if (!drag.active) {
            if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 6) return;
            drag.active = true;
            drag.p.el.classList.add('dragging');
            boardEl.classList.add('grabbing');
        }
        var rect = boardEl.getBoundingClientRect(), size = rect.width / 8;
        var px = Math.max(-size / 2, Math.min(rect.width - size / 2, e.clientX - rect.left - size / 2));
        var py = Math.max(-size / 2, Math.min(rect.height - size / 2, e.clientY - rect.top - size / 2));
        drag.p.el.style.transform = 'translate(' + px + 'px,' + py + 'px)';
        var over = squareFromPoint(e.clientX, e.clientY);
        if (over !== drag.hover) {
            if (drag.hover) sqEls[drag.hover].classList.remove('hover');
            drag.hover = over && state.targets[over] ? over : null;
            if (drag.hover) sqEls[drag.hover].classList.add('hover');
        }
    });

    function endDrag(e, cancelled) {
        if (!drag || e.pointerId !== drag.id) return;
        var d = drag;
        drag = null;
        boardEl.classList.remove('grabbing');
        if (d.hover) sqEls[d.hover].classList.remove('hover');
        if (!d.active) {
            if (d.wasSelected) select(null);       // 같은 기물을 다시 누르면 선택 해제
            return;
        }
        d.p.el.classList.remove('dragging');
        var to = cancelled ? null : squareFromPoint(e.clientX, e.clientY);
        if (to && to !== d.from && state.targets[to] && humanMove(d.from, to)) {
            if (!promoEl.hidden) {                  // 승급 선택 중에는 폰을 도착 칸에 올려 둔다
                var c = xy(to);
                d.p.el.style.transform = 'translate(' + c.x * 100 + '%,' + c.y * 100 + '%)';
            }
            return;
        }
        place(d.p);                                 // 제자리로 부드럽게 복귀
        raise(d.p);
        if (to !== d.from) select(null);
    }
    boardEl.addEventListener('pointerup', function (e) { endDrag(e, false); });
    boardEl.addEventListener('pointercancel', function (e) { endDrag(e, true); });
    boardEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { closePromotion(); select(null); }
    });

    // ───────── 엔진 (Stockfish 19 WASM, Web Worker) ─────────

    var engine = { worker: null, ready: false, failed: false, waiting: [], callbacks: [] };

    function startEngine() {
        try {
            engine.worker = new Worker(ENGINE_URL);
        } catch (err) { engine.failed = true; return; }
        engine.worker.onmessage = function (e) {
            var line = typeof e.data === 'string' ? e.data : '';
            if (line === 'uciok') {
                send('setoption name Hash value 32');
                send('isready');
            } else if (line === 'readyok' && !engine.ready) {
                engine.ready = true;
                engine.waiting.splice(0).forEach(function (fn) { fn(); });
            } else if (line.indexOf('bestmove') === 0) {
                var cb = engine.callbacks.shift();
                if (cb) cb(line.split(' ')[1]);
            }
        };
        engine.worker.onerror = function () {
            engine.failed = true;
            engine.ready = false;
            engine.callbacks.splice(0).forEach(function (cb) { cb(null); });
            engine.waiting.splice(0).forEach(function (fn) { fn(); });
        };
        send('uci');
    }
    function send(cmd) { engine.worker.postMessage(cmd); }
    function whenReady(fn) {
        if (engine.ready || engine.failed) fn(); else engine.waiting.push(fn);
    }

    function search(cb) {
        whenReady(function () {
            if (engine.failed) { cb(null); return; }
            var lv = level();
            var moves = game.history({ verbose: true }).map(function (m) { return m.from + m.to + (m.promotion || ''); });
            send('setoption name Skill Level value ' + lv.skill);
            send('position startpos' + (moves.length ? ' moves ' + moves.join(' ') : ''));
            engine.callbacks.push(cb);
            send(lv.depth ? 'go depth ' + lv.depth : 'go movetime ' + lv.movetime);
        });
    }

    // 엔진을 못 불러왔을 때(예: 파일을 직접 열었을 때)를 위한 간단한 대체 AI
    function fallbackMove() {
        var best = null, bestScore = -Infinity;
        game.moves({ verbose: true }).forEach(function (m) {
            var s = Math.random() * 0.5 + (m.captured ? VALUE[m.captured] : 0) + (m.promotion ? 8 : 0);
            game.move(m);
            if (game.in_checkmate()) s += 1000;
            var worst = 0;
            game.moves({ verbose: true }).forEach(function (r) {
                if (r.captured) worst = Math.max(worst, VALUE[r.captured]);
            });
            game.undo();
            s -= worst;
            if (s > bestScore) { bestScore = s; best = m; }
        });
        return best;
    }

    function askEngine() {
        var id = ++state.searchId, started = Date.now();
        state.thinking = true;
        renderAll();
        search(function (uci) {
            if (id !== state.searchId) return;
            setTimeout(function () {
                if (id !== state.searchId) return;
                state.thinking = false;
                var move = uci && uci !== '(none)'
                    ? { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }
                    : fallbackMove();
                if (!move || !commit(move)) { renderAll(); return; }
                afterMove();
            }, Math.max(0, MIN_REPLY_MS - (Date.now() - started)));
        });
    }

    function cancelSearch() {
        state.searchId++;
        if (state.thinking && engine.ready) send('stop');
        state.thinking = false;
    }

    // ───────── 소리 (WebAudio 합성, 파일 없음) ─────────

    var audio = null;
    function playSound(kind) {
        if (!state.sound) return;
        try {
            audio = audio || new (window.AudioContext || window.webkitAudioContext)();
            if (audio.state === 'suspended') audio.resume();
            var notes = {
                move: [[320, 0, .07]], capture: [[190, 0, .11]],
                check: [[520, 0, .08], [700, .09, .1]], end: [[440, 0, .12], [330, .13, .12], [220, .26, .22]]
            }[kind];
            notes.forEach(function (n) {
                var t = audio.currentTime + n[1];
                var osc = audio.createOscillator(), gain = audio.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(n[0], t);
                osc.frequency.exponentialRampToValueAtTime(n[0] * 0.6, t + n[2]);
                gain.gain.setValueAtTime(0.0001, t);
                gain.gain.exponentialRampToValueAtTime(kind === 'capture' ? 0.35 : 0.22, t + 0.008);
                gain.gain.exponentialRampToValueAtTime(0.0001, t + n[2]);
                osc.connect(gain).connect(audio.destination);
                osc.start(t);
                osc.stop(t + n[2] + 0.02);
            });
        } catch (e) { /* 소리 없이 진행 */ }
    }

    // ───────── 조작 버튼 ─────────

    function newGame() {
        cancelSearch();
        promoEl.hidden = true;
        resultEl.hidden = true;
        game.reset();
        state.lastMove = null;
        state.selected = null;
        state.targets = {};
        if (engine.ready) send('ucinewgame');
        syncPieces();
        renderAll();
        if (game.turn() !== state.human) askEngine();
    }

    function undo() {
        cancelSearch();
        promoEl.hidden = true;
        resultEl.hidden = true;
        var hints = [], steps = game.turn() === state.human ? 2 : 1;
        if (game.history().length < steps) steps = 0;
        while (steps--) {
            var m = game.undo();
            if (m) hints.push([m.to, m.from]);
        }
        var hist = game.history({ verbose: true }), last = hist[hist.length - 1];
        state.lastMove = last ? { from: last.from, to: last.to } : null;
        state.selected = null;
        state.targets = {};
        syncPieces(hints);
        renderAll();
        if (game.turn() !== state.human) askEngine();
    }

    function setFlipped(flag) {
        state.flipped = flag;
        buildSquares();
        pieces.forEach(place);
        renderAll();
    }

    function renderSegments() {
        Array.prototype.forEach.call($('levelSeg').children, function (b) {
            b.setAttribute('aria-checked', String(b.dataset.level === state.level));
        });
        Array.prototype.forEach.call($('colorSeg').children, function (b) {
            b.setAttribute('aria-checked', String(b.dataset.color === state.human));
        });
        $('soundBtn').classList.toggle('off', !state.sound);
    }

    LEVELS.forEach(function (lv) {
        var b = document.createElement('button');
        b.textContent = lv.name;
        b.dataset.level = lv.id;
        b.setAttribute('role', 'radio');
        $('levelSeg').appendChild(b);
    });
    $('levelSeg').addEventListener('click', function (e) {
        var id = e.target.dataset.level;
        if (!id || id === state.level) return;
        state.level = id;
        save('level', id);
        renderSegments();
        renderBars();
    });
    $('colorSeg').addEventListener('click', function (e) {
        var c = e.target.dataset.color;
        if (!c || c === state.human) return;
        state.human = c;
        save('color', c);
        renderSegments();
        setFlipped(c === 'b');
        newGame();
    });
    $('newBtn').addEventListener('click', newGame);
    $('resultNew').addEventListener('click', newGame);
    $('resultClose').addEventListener('click', function () { resultEl.hidden = true; });
    $('undoBtn').addEventListener('click', undo);
    $('flipBtn').addEventListener('click', function () { setFlipped(!state.flipped); });
    $('soundBtn').addEventListener('click', function () {
        state.sound = !state.sound;
        save('sound', state.sound ? '1' : '0');
        renderSegments();
        if (state.sound) playSound('move');
    });

    // ───────── 시작 ─────────

    buildSquares();
    renderSegments();
    startEngine();
    newGame();

    window.__chess = { game: game, state: state, engine: engine, sync: function () { syncPieces(); renderAll(); } };   // 디버깅용
})();
