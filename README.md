# 체스 — AI 대국

브라우저에서 Stockfish와 두는 체스 게임입니다. 빌드 과정 없이 정적 파일만으로 동작합니다.

- 클릭 또는 드래그로 이동, 갈 수 있는 칸 표시, 승급 선택, 무르기, 보드 뒤집기, 백/흑 선택
- 난이도 5단계 (입문 ~ 최강). 탐색을 시간으로 제한해 최강에서도 약 1초 안에 응수합니다.
- 엔진은 Web Worker에서 돌아가므로 생각하는 동안 화면이 멈추지 않습니다.

## 실행

Web Worker와 WASM을 쓰기 때문에 `docs/index.html`을 직접 열지 말고 웹 서버로 띄워야 합니다.

```bash
python3 -m http.server 8000 --directory docs
```

그다음 `http://localhost:8000`을 엽니다. GitHub Pages에서는 그대로 동작합니다.

## 포함된 외부 코드 (`docs/vendor/`)

| 파일 | 출처 | 라이선스 |
| --- | --- | --- |
| `stockfish-19-lite-single.js/.wasm` | [Stockfish.js](https://github.com/nmrugg/stockfish.js) 19.0.1 | GPL-3.0 (`stockfish.COPYING.txt`) |
| `chess.js` | [chess.js](https://github.com/jhlywa/chess.js) 0.10.3 | BSD-2-Clause (`chess.js.LICENSE`) |
| `pieces.svg` | Wikimedia Commons 기물 (Cburnett, Rfc1394), [cm-chessboard](https://github.com/shaack/cm-chessboard) 스프라이트 | CC BY-SA 3.0 |

사이트 파일은 `docs/` 폴더에 있습니다. GitHub Pages가 `main` 브랜치의 `/docs` 폴더를 배포하도록 설정되어 있기 때문입니다.
