var board = null;
var game = new Chess();
var engine = null;

// 1. 이미지 경로 설정
function pieceTheme(piece) {
    return 'https://chessboardjs.com/img/chesspieces/wikipedia/' + piece + '.png';
}

// 2. AI 엔진 로드 (비동기)
fetch('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.0/stockfish.js')
    .then(res => res.text())
    .then(text => {
        const blob = new Blob([text], { type: 'application/javascript' });
        engine = new Worker(URL.createObjectURL(blob));
        engine.postMessage('uci');
        engine.onmessage = function(e) {
            if (e.data.includes('bestmove')) {
                const moveStr = e.data.split(' ')[1];
                game.move({ from: moveStr.substring(0, 2), to: moveStr.substring(2, 4), promotion: 'q' });
                if (board) board.position(game.fen());
                updateStatus();
            }
        };
    });

// 3. 체스 보드 초기화 함수 (강력한 에러 방지 버전)
function checkAndInit() {
    var element = document.getElementById('myBoard');
    
    // 만약 엘리먼트가 아직 없으면 0.1초 뒤에 다시 실행
    if (!element) {
        setTimeout(checkAndInit, 100);
        return;
    }

    // 엘리먼트가 발견되면 그때 보드 생성
    var config = {
        draggable: true,
        position: 'start',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: function() { if(board) board.position(game.fen()); },
        pieceTheme: pieceTheme
    };

    board = Chessboard('myBoard', config);
    updateStatus();
    console.log("체스보드 로드 완료!");
}

function onDragStart(source, piece) {
    if (game.game_over() || piece.search(/^b/) !== -1) return false;
}

function onDrop(source, target) {
    var move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';
    updateStatus();
    window.setTimeout(function() {
        engine.postMessage('position fen ' + game.fen());
        engine.postMessage('go depth ' + $('#difficulty').val());
    }, 250);
}

function updateStatus() {
    var status = game.turn() === 'w' ? "내 차례" : "AI 생각 중...";
    if (game.in_checkmate()) status = "체크메이트 종료";
    $('#status').text(status);
    $('#pgn-log').text(game.pgn());
}

// 4. 실행 (HTML이 로드될 때까지 반복 확인)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndInit);
} else {
    checkAndInit();
}

// 버튼 이벤트 (위임 방식)
$(document).on('click', '#resetBtn', function() { game.reset(); board.start(); updateStatus(); });
$(document).on('click', '#undoBtn', function() { game.undo(); game.undo(); board.position(game.fen()); updateStatus(); });
