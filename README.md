# @arena/pi-arena

[Pi](https://github.com/microsoft/pi) 的 Arena Hero 扩展包：向 Pi 注册 Arena Hero 专属工具，供策略开发与地图查询使用。

## 工具

| 工具 | 行为 |
|---|---|
| `arena_plan` | 返回一份候选 tick 计划并结束 Pi 回合；不直接提交动作到线上 |
| `arena_map` | 可选查询宿主只读 `/map/query` 端点，获取地图统计、已知障碍或盟友信息；仅在设置 `ARENA_MAP_URL` 时注册 |

地图请求带五秒超时，为宿主保留校验与处理计划的时间。

## 安装

```bash
pnpm add @arena/pi-arena
```

包直接导出 `src/index.ts`，需要支持 TypeScript 扩展的 Pi 宿主加载。

## 运行时契约

- `arena_plan`：单轮候选计划，供宿主校验后决定是否采纳
- `arena_map`：只读查询，不修改任何游戏状态
- 所有工具均为候选语义：游戏状态的持有、校验与最终提交由消费方 Arena 运行时负责

## 许可证

见包内 `LICENSE`。
