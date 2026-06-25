# Clipgrab Telegram Bot

YouTube Shorts, Instagram Reels, Threads, X/Twitter 링크를 텔레그램 봇에게 보내면 mp4 파일로 다시 보내주는 봇입니다.

## 지원 링크

- YouTube / YouTube Shorts
- Instagram / Reels
- Threads
- X / Twitter

비공개 게시물, 로그인 필요한 게시물, 너무 긴 영상은 실패할 수 있습니다.

## 가장 쉬운 사용 흐름

1. Telegram에서 BotFather로 봇 생성
2. 봇 토큰 복사
3. 이 프로젝트를 GitHub에 업로드
4. Railway 또는 Render에서 배포
5. 환경변수 `TELEGRAM_BOT_TOKEN` 입력
6. 텔레그램에서 봇에게 링크 전송

## BotFather에서 봇 만들기

Telegram에서 `@BotFather` 검색 후 아래 순서로 진행합니다.

```txt
/newbot
봇 이름 입력
봇 username 입력: 예) my_clipgrab_bot
```

마지막에 나오는 토큰을 복사해서 서버 환경변수 `TELEGRAM_BOT_TOKEN`에 넣으면 됩니다.

## 내 Telegram user ID 확인

배포 후 봇에게 아래 명령어를 보냅니다.

```txt
/id
```

봇이 알려주는 숫자를 `ALLOWED_TELEGRAM_USER_IDS`에 넣으면 본인만 사용할 수 있습니다.

예:

```txt
ALLOWED_TELEGRAM_USER_IDS=123456789
```

여러 명을 허용하려면 쉼표로 구분합니다.

```txt
ALLOWED_TELEGRAM_USER_IDS=123456789,987654321
```

비워두면 누구나 봇을 사용할 수 있으므로 공개 배포 시에는 권장하지 않습니다.

## 로컬 실행

### 준비물

- Node.js 20 이상
- Python 3
- yt-dlp
- ffmpeg

설치 예시:

```bash
python -m pip install -U yt-dlp
```

### 실행

```bash
npm install
cp .env.example .env
# .env 안에 TELEGRAM_BOT_TOKEN 입력
npm start
```

## Docker 배포

이 프로젝트는 `Dockerfile`을 포함하고 있습니다.
Docker 기반 배포를 사용하면 서버에 자동으로 아래가 설치됩니다.

- Node.js
- Python
- yt-dlp
- ffmpeg

Railway/Render에서 GitHub 저장소를 연결하고, 환경변수만 입력하면 됩니다.

## 환경변수

| 이름 | 필수 | 설명 |
|---|---:|---|
| `TELEGRAM_BOT_TOKEN` | 필수 | BotFather에서 받은 봇 토큰 |
| `ALLOWED_TELEGRAM_USER_IDS` | 선택 | 허용할 텔레그램 사용자 ID. 쉼표로 여러 명 입력 가능 |
| `MAX_FILE_SIZE_MB` | 선택 | 기본 48. 너무 큰 파일 전송 방지 |
| `DOWNLOAD_TIMEOUT_MS` | 선택 | 기본 180000. 다운로드 제한 시간 |

## 주의사항

- 공개 URL로 운영하면 다른 사람이 봇을 악용할 수 있습니다. 가능하면 `ALLOWED_TELEGRAM_USER_IDS`를 꼭 설정하세요.
- 플랫폼 구조 변경으로 다운로드가 갑자기 실패할 수 있습니다. 이 경우 yt-dlp 업데이트가 필요합니다.
- Threads는 yt-dlp 공식 지원 상태가 변동될 수 있어, 공개 게시물이라도 일부 링크는 실패할 수 있습니다. 실패하면 `yt-dlp -U` 또는 Docker 이미지 재배포로 최신 버전을 받아보세요.
- 타인의 콘텐츠를 무단 재배포하는 용도로 사용하면 안 됩니다.
