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
    python3 \
    python3-pip \
    && locale-gen ja_JP.UTF-8 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# グローバルnpmパッケージ（オプション）
RUN npm install -g npm@latest

# nodeユーザーで実行（セキュリティ向上）
USER node

# uv (Python package manager) のインストール (nodeユーザーで実行)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

# uvのパスを通す
ENV PATH="/home/node/.local/bin:${PATH}"

# デフォルトシェルをbashに
SHELL ["/bin/bash", "-c"]