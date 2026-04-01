var board = null;
var game = new Chess();
var engine = null;

// 말 이미지가 안 보이는 문제를 해결하기 위한 공식 이미지 경로 설정
function pieceTheme(piece) {
    return 'https://chessboardjs.com/img/chesspieces/wikipedia/' + piece + '.png';
}

// AI 엔진 로드
fetch('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.0/stockfish.js')
    .then(res => res.text())
    .then(text => {
        const blob = new Blob([text], { type: 'application/javascript' });
        engine = new Worker(URL.createObjectURL(blob));
        engine.postMessage('uci');
        
        engine.onmessage = function(e) {
            if (e.data.includes('bestmove')) {
                const moveStr = e.data.split(' ')[1];
                game.move({
                    from: moveStr.substring(0, 2),
                    to: moveStr.substring(2, 4),
                    promotion: 'q'
                });
                board.position(game.fen());
                updateStatus();
            }
        };
    });

function onDragStart(source, piece) {
    if (game.game_over() || piece.search(/^b/) !== -1) return false;
}

function onDrop(source, target) {
    var move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';

    updateStatus();
    
    // AI 턴
    setTimeout(() => {
        const depth = $('#difficulty').val();
        engine.postMessage('position fen ' + game.fen());
        engine.postMessage('go depth ' + depth);
    }, 250);
}

function updateStatus() {
    let statusText = game.turn() === 'w' ? "내 차례 (흰색)" : "AI 계산 중...";
    if (game.in_checkmate()) statusText = "체크메이트! 게임 종료.";
    else if (game.in_draw()) statusText = "무승부!";
    
    $('#status').text(statusText);
    $('#pgn-log').text(game.pgn());
}

var config = {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: () => board.position(game.fen()),
    pieceTheme: pieceTheme // 수정된 이미지 경로 함수 적용
};

board = Chessboard('myBoard', config);
updateStatus();

$('#resetBtn').on('click', function() {
    game.reset();
    board.start();
    updateStatus();
});

$('#undoBtn').on('click', function() {
    game.undo(); // AI 수 취소
    game.undo(); // 내 수 취소
    board.position(game.fen());
    updateStatus();
});
