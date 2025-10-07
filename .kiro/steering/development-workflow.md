---
inclusion: always
---
# 开发工作流

## 项目配置

- TypeScript: 项目使用TypeScript进行类型检查
- Vite: 使用Vite作为构建工具
- ESLint: 代码质量检查
- Prettier: 代码格式化

## 主要配置文件

- [package.json](mdc:package.json): 项目依赖和脚本
- [tsconfig.json](mdc:tsconfig.json): TypeScript配置
- [vite.config.mts](mdc:vite.config.mts): Vite构建配置
- [.prettierrc.json](mdc:.prettierrc.json): Prettier格式化配置
- [eslint.config.mjs](mdc:eslint.config.mjs): ESLint配置

## 开发环境

项目运行在Windows环境中，使用PowerShell作为默认shell。

## 代码风格

- 使用中文作为用户界面和日志语言
- 注释应尽量简短，必要时使用中文
- 遵循Vue 3组合式API的最佳实践

## 部署流程

项目包含Docker配置，可以使用Docker进行部署：

- [Dockerfile](mdc:Dockerfile): Docker构建配置
