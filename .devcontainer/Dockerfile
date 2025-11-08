# Node.js LTS版をベースにする
FROM node:20-bullseye

# 作業ディレクトリ設定
WORKDIR /workspace

# 日本語環境設定
ENV LANG=ja_JP.UTF-8
ENV LC_ALL=ja_JP.UTF-8

# 必要なパッケージインストール
RUN apt-get update && apt-get install -y \
    git \
    curl \
    vim \
    locales \
    && locale-gen ja_JP.UTF-8 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# グローバルnpmパッケージ（オプション）
RUN npm install -g npm@latest

# nodeユーザーで実行（セキュリティ向上）
USER node

# デフォルトシェルをbashに
SHELL ["/bin/bash", "-c"]