// 모든 변수를 밖으로 빼서 어디서든 접근 가능하게 설정
var board = null;
var game = new Chess();
var engine = null;

// 이미지 경로 (공식 경로)
function pieceTheme(piece) {
    return 'https://chessboardjs.com/img/chesspieces/wikipedia/' + piece + '.png';
}

// 초기화 함수를 별도로 만듦
function initGame() {
    var boardEl = document.getElementById('myBoard');
    
    // 만약 아직 HTML에 myBoard가 없다면 0.1초 뒤에 다시 시도 (무한 루프 방지 위해 체크)
    if (!boardEl) {
        console.log("보드를 찾는 중...");
        setTimeout(initGame, 100);
        return;
    }

    var config = {
        draggable: true,
        position: 'start',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: function() { board.position(game.fen()); },
        pieceTheme: pieceTheme
    };

    board = Chessboard('myBoard', config);
    updateStatus();
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
                game.move({ from: moveStr.substring(0, 2), to: moveStr.substring(2, 4), promotion: 'q' });
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

// 브라우저가 준비되면 실행
$(document).ready(initGame);

// 버튼 이벤트
$(document).on('click', '#resetBtn', function() { game.reset(); board.start(); updateStatus(); });
$(document).on('click', '#undoBtn', function() { game.undo(); game.undo(); board.position(game.fen()); updateStatus(); });
