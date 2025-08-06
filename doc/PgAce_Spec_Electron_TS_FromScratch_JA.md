# PgAce – ポータブル PostgreSQL クライアント

**TypeScript / JavaScript + Electron 版 仕様書（From Scratch / 日本語）**

## 1. 目的・スコープ

* **目的**: Windows 上で「フォルダをコピーして実行できる」ポータブルな **PostgreSQL 専用** GUI クライアントを、**Electron + TypeScript** で開発する。
* **主用途**: クエリ実行、スキーマ参照（DB エクスプローラ）、DDL 取得、抽出結果からの **INSERT / COPY** 生成、既存 **.sql** の閲覧・編集（SQL エクスプローラ）。
* **非対象**: 他 DB、ETL、スケジューラ、ER 図自動生成（将来拡張）。

## 2. 対象環境（固定）

| 項目     | 指定                                                   |
| ------ | ---------------------------------------------------- |
| OS     | **Windows 10 / 11 (x64)**                            |
| ランタイム  | **Node.js LTS (18.x または 20.x)**                      |
| デスクトップ | **Electron 27+**（安定系）                                |
| 言語     | **TypeScript 5.x**（Main / Preload / Renderer すべて TS） |
| DB     | **PostgreSQL 12+**                                   |
| 配布     | **フォルダ配布（Zip 展開 → .exe 実行）**、インストーラ不要                |

> 目標は **Zip & Run**：インストール不要、レジストリ最小化、管理者権限不要。

## 3. 技術スタック / 主要ライブラリ

* **DB**: `pg`（node-postgres）。任意で `pg-native` 追加可（libpq 同梱が必要なため当面は非採用）。
* **UI**: **React 18 + Vite**（Renderer）、**MUI**（Material UI）、**MUI Data Grid**（MIT 版）。
* **エディタ**: **Monaco Editor**。
* **レイアウト（ドック）**: **Golden Layout 2**（React 連携）。
* **ファイル監視**: `chokidar`（SQL エクスプローラ）。
* **資格情報/暗号**: **keytar**（Windows 資格情報マネージャ）／`windows-dpapi` フォールバック。
* **ログ**: `electron-log`。
* **ビルド/配布**: **electron-builder**（`dir` / `zip` 生成。**portable/NSIS は使わない**）。
* **品質**: TypeScript / ESLint / Prettier / Vitest。

> **セキュリティ**: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, 厳格 CSP、IPC でのみ Main と通信。

## 4. アーキテクチャ

```
packages/
  main/        # Electron Main（TS）: ウィンドウ/IPC/プロセス管理
  preload/     # Preload（TS）: 安全な Bridge（contextBridge）
  renderer/    # React + Vite（TS）
  shared/      # 型定義（IPC/DTO/設定）
appdata/       # config.json / layout.json / history.log（実行フォルダ直下）
```

### 4.1 IPC 境界

* Renderer → Preload → Main。DB・FS 操作は **Main** に集約。
* 代表チャンネル: `db.connect`, `db.query`, `meta.list`, `meta.props`, `fs.openFolder`, `history.append`, `ddl.export`。
* 共有型で **型安全**（`shared` に定義）。

### 4.2 設定と保存

* `appdata/config.json` … 接続プロファイル、履歴上限、**lazyLoadThreshold**、**chunkSizeDefault**。
* `appdata/layout.json` … Golden Layout の JSON。
* `appdata/history.log` … JSON Lines。
* パスワードは **keytar** に保存（`service=PgAce`, `account={host}:{db}:{user}`）。`config.json` は `credentialKey` のみ。

## 5. 画面レイアウト（初期配置 / 以降ドラッグで再配置）

```
┌───────────────────────────────────────── PgAce ─────────────────────────────────────────┐
│ ┌─ DB Explorer ───┐ ┌───────────── SQL Editor Tabs ─────────────┐ ┌─ SQL Explorer ──┐ │
│ │  ▸ public       │ │  ← Monaco Editor（複数タブ）             │ │  .sql ツリー    │ │
│ └──────────────────┘ └──────────────────────────────────────────┘ └──────────────────┘ │
│ ┌─ Result Grid ───┐ ┌── Properties ──┐                                                     │
│ └──────────────────┘ └───────────────┘                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

レイアウトは `layout.json` に自動保存・復元。

## 6. 機能要件

### 6.1 接続 & セキュリティ

* 入力: **Host / Port / Database / User / Password**。
* **\[ ] パスワードを保存** → keytar に保存、`config.json` には `credentialKey` を記録。
* 他 PC へコピー時は keytar 情報が無いためパスワード欄は空で再入力。

**config.json 例**

```json
{
  "profiles": [
    {
      "name": "dev-local",
      "host": "127.0.0.1",
      "port": 5432,
      "database": "postgres",
      "user": "postgres",
      "credentialKey": "127.0.0.1:postgres:postgres"
    }
  ],
  "settings": { "maxHistory": 500, "lazyLoadThreshold": 1000, "chunkSizeDefault": 500 }
}
```

### 6.2 DB エクスプローラ（遅延ロード + チャンク選択）

* 対象: **Schemas ▸ Tables ▸ Views ▸ MatViews ▸ Indexes ▸ Sequences ▸ Functions ▸ Types**。
* **初期**: 件数のみ取得。**閾値 N=1000** 超は **「► (N 件, 未ロード)」** 表示。
* **展開時**: ダイアログで **「最初のチャンク / 全件 / キャンセル」** を提示。**チャンク**選択時は **サイズ入力**（既定 500）。
* 以降の展開で順次チャンクを読み込み（無限スクロール相当）。進捗はステータスバーへ。
* クエリは `pg_catalog`/`information_schema` を利用し、応答性を重視。

### 6.3 プロパティ（メタ情報 / DDL）

* テーブル: 列名/型/NULL/既定値/コメント、PK/FK/Unique、推定行数、サイズ。
* インデックス: 列、Unique、条件、サイズ、`pg_get_indexdef()`。
* 関数: 引数、戻り値、言語、`pg_get_functiondef()`。
* **\[DDL]**（読み取り専用タブ）／**\[Export]**（**SQL** / **Markdown** で保存 or クリップボード）。

### 6.4 SQL エクスプローラ

* *File → Open Folder…* でルート選択。`chokidar` で監視し、外部更新時は再読み込み確認。
* `.sql` ダブルクリック → Monaco タブで開く。

### 6.5 SQL エディタ（Monaco）

* ハイライト、折りたたみ、マルチカーソル、スニペット。**F5** 実行、**Ctrl+L** で整形⇔一行化（`sql-formatter`）。

### 6.6 実行 & 結果グリッド

* `pg` で実行し **MUI Data Grid** に表示。コピー/CSV エクスポート、列幅自動、ソート。

### 6.7 INSERT 生成（3 モード）

* **a. 列名あり**: `INSERT INTO tbl (c1,c2) VALUES (...),(...);`
* **b. 列名なし**: `INSERT INTO tbl VALUES (...),(...);`
* **c. COPY**: `COPY tbl (c1,c2) FROM STDIN;` + データ + `\.`
* 文字列 `'` エスケープ、`NULL`/空文字区別、`bytea` = `\x…`、日時 ISO、bool TRUE/FALSE。COPY は TSV 既定、CSV 切替可。

### 6.8 EXPLAIN

* v1.0: テキスト表示（`EXPLAIN`/`EXPLAIN ANALYZE`）。
* 後続: `EXPLAIN (FORMAT JSON)` のツリー可視化、さらに Mermaid/Graph 図化。

### 6.9 DDL エクスポート

* **\[Export]** → **SQL** / **Markdown**。出力は **新規タブ / クリップボード / ファイル**。

### 6.10 履歴

* `history.log`（JSONL）。最大 **500**、超過時に古い順でローテーション。

## 7. 非機能要件

| 区分     | 要件                                             |
| ------ | ---------------------------------------------- |
| 起動     | コールドスタート < **2 秒**                             |
| メモリ    | アイドル < **350 MB**                              |
| 応答     | 1 万行表示でも実用操作（仮想スクロール導入）                        |
| セキュリティ | `contextIsolation`/`sandbox` 有効、IPC 入力検証、CSP   |
| ログ     | `electron-log`（WARN/ERROR）、操作履歴は `history.log` |
| i18n   | EN/JA 切替（`i18next` 等）                          |
| ポータブル  | ユーザーデータはアプリフォルダ直下。レジストリ依存を最小化                  |

## 8. ビルド & 配布

**npm スクリプト例**

```json
{
  "scripts": {
    "dev": "concurrently -k \"tsc -w -p packages\" \"vite --config packages/renderer/vite.config.ts\" \"electron .\"",
    "build": "vite build && tsc -p packages && electron-builder --dir",
    "dist:zip": "vite build && tsc -p packages && electron-builder -w zip"
  }
}
```

**electron-builder（抜粋）**

```json
{ "appId": "jp.example.pgace", "productName": "PgAce",
  "files": ["dist/**","packages/main/**","packages/preload/**","node_modules/**"],
  "directories": { "output": "release" },
  "win": { "target": ["dir","zip"], "artifactName": "PgAce-${version}-${os}-${arch}.${ext}" },
  "extraResources": [{ "from": "appdata", "to": "appdata" }]
}
```

**配布物例**

```
PgAce-win-x64/
  PgAce.exe
  resources/app.asar
  appdata/ (初回起動で自動生成)
```

## 9. 受け入れ基準

1. Zip 展開だけで起動し、keytar による保存/復元が機能。
2. 1000 件超のノードで「チャンク/全件」ダイアログ＋チャンクサイズ入力が動作。
3. プロパティで列/PK/FK/インデックス/コメントが正しく表示。
4. INSERT 3 モード、DDL エクスポート（SQL/Markdown）が期待どおり。
5. SQL エクスプローラが外部更新を検知。
6. レイアウトが保存・復元。履歴 500 件でローテーション。

## 10. 参照クエリ（実装補助）

（省略せず前仕様と同等。必要なら貼付します）

## 11. ライセンス / 表記

* 本体: **MIT**。依存 OSS は `THIRD-PARTY-NOTICES.md` に一覧。

## 12. 将来拡張

* EXPLAIN JSON のツリー + Mermaid/Graph。
* 実行計画差分。スキーマ差分。共有プロファイル。

---

以上です。ダウンロード版のリンク作成、もう一度試しますか？
