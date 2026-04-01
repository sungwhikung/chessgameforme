window.onload = function () {
    var board = null;
    var game = new Chess();
    var engine = null;

    // 1. 이미지 경로 설정
    function pieceTheme(piece) {
        return 'https://chessboardjs.com/img/chesspieces/wikipedia/' + piece + '.png';
    }

    // 2. Stockfish AI 로드 (CORS 방지 Blob 방식)
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

    // 3. 체스판 규칙 설정
    function onDragStart(source, piece) {
        if (game.game_over()) return false;
        if (game.turn() === 'b' || piece.search(/^b/) !== -1) return false;
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
        var status = game.turn() === 'w' ? "당신의 차례입니다" : "AI가 수 계산 중...";
        if (game.in_checkmate()) status = "체크메이트! 게임 종료";
        else if (game.in_draw()) status = "무승부입니다";

        $('#status').text(status);
        $('#pgn-log').text(game.pgn());
    }

    // 4. 보드 생성 (이게 실행될 때 HTML은 이미 준비 완료 상태)
    var config = {
        draggable: true,
        position: 'start',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: () => board.position(game.fen()),
        pieceTheme: pieceTheme
    };

    board = Chessboard('myBoard', config);
    updateStatus();

    // 5. 버튼 연동
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
};
