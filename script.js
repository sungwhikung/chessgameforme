var board = null;
var game = new Chess();
var engine = null;

// 1. 체스말 이미지 경로 해결
function pieceTheme(piece) {
    return 'https://chessboardjs.com/img/chesspieces/wikipedia/' + piece + '.png';
}

// 2. AI 엔진(Stockfish) 초기화
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

// 3. 게임 로직 함수들
function onDragStart(source, piece) {
    if (game.game_over()) return false;
    // 플레이어는 흰색만 조종 가능
    if (game.turn() === 'w' && piece.search(/^b/) !== -1) return false;
    if (game.turn() === 'b') return false;
}

function onDrop(source, target) {
    var move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';

    updateStatus();
    // AI에게 수 요청
    window.setTimeout(function() {
        const depth = $('#difficulty').val();
        engine.postMessage('position fen ' + game.fen());
        engine.postMessage('go depth ' + depth);
    }, 250);
}

function updateStatus() {
    let status = "";
    let moveColor = game.turn() === 'w' ? "흰색(플레이어)" : "검은색(AI)";

    if (game.in_checkmate()) status = "게임 종료 - " + moveColor + " 패배(체크메이트)";
    else if (game.in_draw()) status = "무승부!";
    else {
        status = moveColor + " 차례";
        if (game.in_check()) status += " (체크!)";
    }

    $('#status').text(status);
    $('#pgn-log').text(game.pgn());
}

// 4. 페이지 로드 완료 시 체스판 초기화 (Error 1003 해결)
$(document).ready(function() {
    var config = {
        draggable: true,
        position: 'start',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: () => board.position(game.fen()),
        pieceTheme: pieceTheme
    };

    // 'myBoard'라는 ID를 가진 엘리먼트에 체스판 생성
    board = Chessboard('myBoard', config);
    updateStatus();

    // 버튼 조작
    $('#resetBtn').on('click', function() {
        game.reset();
        board.start();
        updateStatus();
    });

    $('#undoBtn').on('click', function() {
        game.undo(); // AI 무르기
        game.undo(); // 나 무르기
        board.position(game.fen());
        updateStatus();
    });
});
