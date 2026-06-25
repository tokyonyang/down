import "dotenv/config";
import express from "express";
import { Telegraf } from "telegraf";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PORT = Number(process.env.PORT || 3000);
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB || 48);
const DOWNLOAD_TIMEOUT_MS = Number(process.env.DOWNLOAD_TIMEOUT_MS || 180000);
const ALLOWED_USER_IDS = (process.env.ALLOWED_TELEGRAM_USER_IDS || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

if (!BOT_TOKEN) {
  console.error("환경변수 TELEGRAM_BOT_TOKEN이 필요합니다.");
  process.exit(1);
}

const ALLOWED_HOSTS = [
  "twitter.com",
  "x.com",
  "mobile.twitter.com",
  "instagram.com",
  "www.instagram.com",
  "threads.net",
  "www.threads.net",
  "threads.com",
  "www.threads.com",
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be"
];

function isAllowedUser(ctx) {
  if (ALLOWED_USER_IDS.length === 0) return true;
  return ALLOWED_USER_IDS.includes(String(ctx.from?.id));
}

function normalizeUrl(raw) {
  try {
    const url = new URL(raw.trim());
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const ok = ALLOWED_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
    return ok ? url.toString() : null;
  } catch {
    return null;
  }
}

function extractFirstUrl(text = "") {
  const match = text.match(/https?:\/\/[^\s]+/i);
  if (!match) return null;
  return normalizeUrl(match[0].replace(/[)>\]}.,!?]+$/g, ""));
}

function runYtDlp(args, { timeoutMs = DOWNLOAD_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("yt-dlp", args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("다운로드 시간이 너무 오래 걸려 중단했어요."));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => (out += chunk.toString()));
    child.stderr.on("data", (chunk) => (err += chunk.toString()));

    child.on("error", (error) => {
      clearTimeout(timer);
      if (error.code === "ENOENT") {
        reject(new Error("서버에 yt-dlp가 설치되어 있지 않아요."));
      } else {
        reject(error);
      }
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(err || `yt-dlp 종료 코드: ${code}`));
    });
  });
}

async function getVideoInfo(url) {
  try {
    const out = await runYtDlp([
      "-J",
      "--no-playlist",
      "--socket-timeout", "30",
      url
    ], { timeoutMs: 45000 });
    const info = JSON.parse(out);
    return {
      title: info.title || "video",
      duration: info.duration,
      uploader: info.uploader || info.channel || ""
    };
  } catch {
    return { title: "video", duration: null, uploader: "" };
  }
}

function readableSize(bytes) {
  if (!Number.isFinite(bytes)) return "알 수 없음";
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(1)}MB`;
}

async function downloadVideo(url) {
  const id = randomUUID();
  const outTemplate = path.join(os.tmpdir(), `${id}.%(ext)s`);

  await runYtDlp([
    "-f", "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b",
    "--no-playlist",
    "--merge-output-format", "mp4",
    "--socket-timeout", "30",
    "--max-filesize", `${MAX_FILE_SIZE_MB}m`,
    "-o", outTemplate,
    url
  ]);

  const file = fs.readdirSync(os.tmpdir()).find((name) => name.startsWith(id));
  if (!file) throw new Error("다운로드 파일을 찾지 못했어요.");

  const filePath = path.join(os.tmpdir(), file);
  const stat = fs.statSync(filePath);
  if (stat.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    fs.unlinkSync(filePath);
    throw new Error(`파일이 너무 커요. 현재 제한은 ${MAX_FILE_SIZE_MB}MB입니다.`);
  }

  return filePath;
}

function cleanup(filePath) {
  if (!filePath) return;
  fs.unlink(filePath, () => {});
}

const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply([
    "안녕하세요. 링크를 보내면 영상 파일로 변환해서 돌려드릴게요.",
    "",
    "지원 링크: YouTube Shorts, Instagram Reels, Threads, X/Twitter",
    "사용법: 영상 링크를 이 채팅방에 그대로 붙여넣기",
    "내 텔레그램 ID 확인: /id"
  ].join("\n"));
});

bot.command("help", (ctx) => {
  ctx.reply([
    "사용법",
    "1) 쇼츠/릴스/Threads/X 링크 복사",
    "2) 이 봇에게 링크 전송",
    "3) mp4 파일 수신",
    "",
    `파일 제한: ${MAX_FILE_SIZE_MB}MB`,
    "비공개 게시물, 로그인 필요한 게시물, 너무 긴 영상은 실패할 수 있어요."
  ].join("\n"));
});

bot.command("id", (ctx) => {
  ctx.reply(`내 Telegram user ID: ${ctx.from?.id}`);
});

bot.on("text", async (ctx) => {
  if (!isAllowedUser(ctx)) {
    await ctx.reply("허용된 사용자만 이용할 수 있어요.");
    return;
  }

  const url = extractFirstUrl(ctx.message.text);
  if (!url) {
    await ctx.reply("YouTube Shorts, Instagram Reels, Threads, X/Twitter 링크를 보내주세요.");
    return;
  }

  let filePath;
  const status = await ctx.reply("링크 확인 중이에요. 잠시만 기다려주세요.");

  try {
    const info = await getVideoInfo(url);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      status.message_id,
      undefined,
      `다운로드 중이에요.\n${info.title ? `제목: ${info.title}` : ""}`.trim()
    ).catch(() => {});

    filePath = await downloadVideo(url);
    const size = fs.statSync(filePath).size;

    await ctx.telegram.sendChatAction(ctx.chat.id, "upload_video");
    const captionParts = [
      info.title && info.title !== "video" ? info.title : "다운로드 완료",
      `파일 크기: ${readableSize(size)}`
    ];

    try {
      await ctx.replyWithVideo({ source: filePath }, {
        caption: captionParts.join("\n"),
        reply_parameters: { message_id: ctx.message.message_id }
      });
    } catch {
      await ctx.replyWithDocument({ source: filePath, filename: `clip-${Date.now()}.mp4` }, {
        caption: captionParts.join("\n"),
        reply_parameters: { message_id: ctx.message.message_id }
      });
    }

    await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, undefined, "완료했어요.").catch(() => {});
  } catch (error) {
    console.error(error);
    const msg = String(error?.message || error);
    let friendly = "다운로드에 실패했어요. 링크가 비공개이거나 플랫폼에서 차단했을 수 있어요.";
    if (msg.includes("yt-dlp")) friendly = "서버에 yt-dlp가 설치되어 있지 않아요.";
    if (msg.includes("too large") || msg.includes("파일이 너무")) friendly = msg;
    if (msg.includes("File is larger than max-filesize")) friendly = `파일이 너무 커요. 현재 제한은 ${MAX_FILE_SIZE_MB}MB입니다.`;
    await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, undefined, friendly).catch(() => ctx.reply(friendly));
  } finally {
    cleanup(filePath);
  }
});

bot.catch((error) => {
  console.error("Bot error:", error);
});

// Railway/Render 같은 배포 서비스에서 상태 확인용 포트를 열어둡니다.
const app = express();
app.get("/", (_, res) => res.send("clipgrab telegram bot is running"));
app.get("/health", (_, res) => res.json({ ok: true }));
app.listen(PORT, () => console.log(`Health server listening on ${PORT}`));

bot.launch({ dropPendingUpdates: true });
console.log("Telegram bot started");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
