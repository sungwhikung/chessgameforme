let board = null;
let game = new Chess();
let engine = null;

// AI 엔진 로드 (Web Worker)
fetch('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.0/stockfish.js')
    .then(res => res.text())
    .then(text => {
        const blob = new Blob([text], { type: 'application/javascript' });
        engine = new Worker(URL.createObjectURL(blob));
        engine.postMessage('uci');
        engine.onmessage = (e) => {
            if (e.data.includes('bestmove')) {
                const move = e.data.split(' ')[1];
                game.move({ from: move.substring(0, 2), to: move.substring(2, 4), promotion: 'q' });
                board.position(game.fen());
                updateStatus();
                $('#loading').hide();
            }
        };
    });

function onDragStart(source, piece) {
    if (game.game_over() || piece.search(/^b/) !== -1) return false;
}

function onDrop(source, target) {
    const move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';
    
    updateStatus();
    $('#loading').show();
    
    const depth = $('#difficulty').val();
    engine.postMessage(`position fen ${game.fen()}`);
    engine.postMessage(`go depth ${depth}`);
}

function updateStatus() {
    let status = '플레이어의 차례입니다.';
    if (game.in_checkmate()) status = '체크메이트! AI 승리.';
    else if (game.in_draw()) status = '무승부!';
    else if (game.in_check()) status = '체크입니다!';

    $('#status').text(status);
    $('#pgn-output').text(game.pgn());
}

// 초기화 설정
board = Chessboard('board', {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: () => board.position(game.fen())
});

$('#resetBtn').on('click', () => {
    game.reset();
    board.start();
    updateStatus();
});

$('#undoBtn').on('click', () => {
    game.undo(); // AI 수 무르기
    game.undo(); // 내 수 무르기
    board.position(game.fen());
    updateStatus();
});
