# 半马 AI 教练 - 容器镜像（用于 CloudBase 云托管 / 任意容器平台）
FROM node:18-alpine

WORKDIR /app

# 安装依赖（含 vite 构建所需 devDependencies）
COPY package*.json ./
RUN npm config set registry https://registry.npmjs.org/ && npm install

# 拷贝源码并构建前端
COPY . .
RUN npm run build

# 运行时仅依赖 Node 内置模块，无需 node_modules 也可；为稳妥保留
EXPOSE 8080
ENV PORT=8080
CMD ["node", "server/index.js"]
