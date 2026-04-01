/* AI CHESS MASTER - script.js
   Chessboard.js, Chess.js, Stockfish.js 연동
*/

var board = null;
var game = new Chess();
var engine = null;

// 1. 체스말 이미지 경로 설정 (공식 서버 주소 사용으로 깨짐 방지)
function pieceTheme(piece) {
    return 'https://chessboardjs.com/img/chesspieces/wikipedia/' + piece + '.png';
}

// 2. AI 엔진(Stockfish) 로드 및 설정
// GitHub Pages의 보안 정책(CORS)을 피하기 위해 Blob 방식으로 로드해.
fetch('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.0/stockfish.js')
    .then(res => res.text())
    .then(text => {
        const blob = new Blob([text], { type: 'application/javascript' });
        engine = new Worker(URL.createObjectURL(blob));
        
        // 엔진 초기화 명령
        engine.postMessage('uci');
        
        // AI가 수 계산을 완료했을 때 실행되는 함수
        engine.onmessage = function(e) {
            if (e.data.includes('bestmove')) {
                const moveStr = e.data.split(' ')[1];
                game.move({
                    from: moveStr.substring(0, 2),
                    to: moveStr.substring(2, 4),
                    promotion: 'q' // 폰이 끝까지 가면 퀸으로 승급
                });
                board.position(game.fen());
                updateStatus();
            }
        };
    });

// 3. 사용자가 말을 잡았을 때 (내 턴인지 확인)
function onDragStart(source, piece, position, orientation) {
    // 게임이 끝났거나, 내 차례가 아니거나, 검은색 말을 잡으려 하면 취소
    if (game.game_over()) return false;
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }
}

// 4. 사용자가 말을 놓았을 때 (규칙 확인)
function onDrop(source, target) {
    var move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });

    // 규칙에 어긋나면 원래 자리로 되돌림
    if (move === null) return 'snapback';

    updateStatus();
    
    // 플레이어가 둔 후 0.25초 뒤 AI 계산 시작
    window.setTimeout(makeAIMove, 250);
}

// 5. AI에게 다음 수를 계산하라고 명령
function makeAIMove() {
    if (game.game_over()) return;

    const depth = $('#difficulty').val(); // 설정된 난이도(깊이) 가져오기
    engine.postMessage('position fen ' + game.fen());
    engine.postMessage('go depth ' + depth);
}

// 6. 보드 애니메이션이 끝난 후 상태 업데이트
function onSnapEnd() {
    board.position(game.fen());
}

// 7. 게임 상태(텍스트) 및 기보 업데이트
function updateStatus() {
    let statusText = "";
    let moveColor = game.turn() === 'w' ? "흰색" : "검은색";

    if (game.in_checkmate()) {
        statusText = "게임 종료 - " + moveColor + " 패배(체크메이트)";
    } else if (game.in_draw()) {
        statusText = "게임 종료 - 무승부";
    } else {
        statusText = moveColor + "의 차례입니다.";
        if (game.in_check()) {
            statusText += " (체크!)";
        }
    }

    $('#status').text(statusText);
    $('#pgn-log').text(game.pgn());
}

// 8. 페이지 로드가 완료되면 실행 (Error 1003 해결 포인트)
$(document).ready(function() {
    var config = {
        draggable: true,
        position: 'start',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        pieceTheme: pieceTheme // 이미지 경로 함수 연결
    };

    // HTML의 <div id="myBoard">를 찾아 체스판 생성
    board = Chessboard('myBoard', config);
    
    updateStatus();

    // 버튼 이벤트 연결
    $('#resetBtn').on('click', function() {
        game.reset();
        board.start();
        updateStatus();
    });

    $('#undoBtn').on('click', function() {
        game.undo(); // AI의 수 무르기
        game.undo(); // 플레이어의 수 무르기
        board.position(game.fen());
        updateStatus();
    });
});
