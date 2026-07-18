# 波うつ「破れ」の科学ラボ

中学3年生の理科探究を想定した、薄いフィルムの波状破断を考えるための概念シミュレーションです。

公開予定URL：

**https://hirasunaryou.github.io/film-tear-lab-jhs3/**

## 主な内容

- 応力集中
- 変形エネルギー
- 引裂抵抗
- フィードバック
- 条件を1つずつ変える比較実験
- iPhoneのタッチ操作
- ホーム画面への追加に対応したWebアプリ設定

## ファイル構成

```text
.
├── index.html
├── css/
│   └── styles.css
├── js/
│   └── app.js
├── assets/
│   ├── icon-192.png
│   └── icon-512.png
├── docs/
│   ├── MODEL.md
│   └── ROADMAP.md
├── manifest.webmanifest
├── sw.js
└── .nojekyll
```

## GitHub Pagesで公開する

1. GitHubで `film-tear-lab-jhs3` という**Public**リポジトリを作る
2. このフォルダ内のファイルを、リポジトリの `main` ブランチ直下へ追加する
3. `Settings` → `Pages` を開く
4. `Source` を `Deploy from a branch` にする
5. Branchを `main`、Folderを `/(root)` にして保存する
6. 公開処理の完了後、上記URLを開く

## 今後の更新

Gitを使う場合：

```bash
git clone https://github.com/hirasunaryou/film-tear-lab-jhs3.git
cd film-tear-lab-jhs3

# ファイルを編集した後
git add .
git commit -m "Improve simulation"
git push
```

`main` ブランチへ変更をpushすると、GitHub Pages側も更新されます。

## ローカルで確認する

Service Workerを含めて確認する場合は、ファイルを直接開くのではなく簡易サーバーを使います。

```bash
python3 -m http.server 8000
```

その後、ブラウザで次を開きます。

```text
http://localhost:8000
```

## 注意

このプログラムは有限要素法による厳密な破壊解析ではなく、現象の考え方を伝えるための教育用概念モデルです。
