import { type Static, Type } from "typebox";
import { Text } from "@earendil-works/pi-tui";
import {
	defineTool,
	type AgentToolResult,
	type AgentToolUpdateCallback,
	type ExtensionContext,
	type ToolDefinition,
	type ToolRenderContext,
	type ToolRenderResultOptions,
} from "../extensions/types.ts";
import type { Theme } from "../../modes/interactive/theme/theme.ts";

/**
 * arena_plan：Arena Hero 游戏动作工具（arena-bot 桥接用）。
 *
 * 这是给 LLM 的原生 tool calling 入口——模型通过 tool_use 输出下一 Tick 计划，
 * arena-bot 从 tool_execution_start 事件提取 input 并校验后提交游戏。
 * execute 只做"确认接收"并 terminate（回合立即结束，不烧多余 token）。
 *
 * 渲染走 pi 原生 TUI 机制（renderCall/renderResult，与 bash 等原生工具同款）：
 * - renderCall：标题行 + 计划摘要（每单位动作一行）
 * - renderResult：确认文本 + 摘要 + 耗时（Took X.Xs）
 * 工具是即时返回的（无流式输出），因此不挂 bash 那套 partial/interval 状态机。
 */

const actionSchema = Type.Object(
	{
		unit: Type.String({ description: "单位完整 UUID（来自状态中的单位列表）" }),
		kind: Type.Union(
			[
				Type.Literal("MOVE"),
				Type.Literal("SWEEP"),
				Type.Literal("HARVEST"),
				Type.Literal("DEPOSIT"),
				Type.Literal("HEAL"),
				Type.Literal("PICKUP_BEACON"),
				Type.Literal("DROP_BEACON"),
				Type.Literal("SELF_DESTRUCT"),
				Type.Literal("WAIT"),
			],
			{ description: "动作类型（MOVE/SWEEP 需要 direction）" },
		),
		direction: Type.Optional(
			Type.Union(
				[
					Type.Literal("UP"),
					Type.Literal("DOWN"),
					Type.Literal("LEFT"),
					Type.Literal("RIGHT"),
				],
				{ description: "方向（MOVE/SWEEP 必需）" },
			),
		),
		target_id: Type.Optional(
			Type.String({ description: "射击目标 UUID（SHOOT 用）" }),
		),
		expected_cell: Type.Optional(
			Type.Array(Type.Number(), { minItems: 2, maxItems: 2 }),
		),
	},
	{ additionalProperties: false },
);

const arenaPlanSchema = Type.Object(
	{
		actions: Type.Array(actionSchema, {
			description: "每个单位的动作（每单位最多一条）",
		}),
		core: Type.Optional(
			Type.Union(
				[
					Type.Object(
						{
							kind: Type.Literal("SPAWN"),
							unit_type: Type.Union(
								[
									Type.Literal("WORKER"),
									Type.Literal("VANGUARD"),
									Type.Literal("RANGER"),
								],
							),
						},
						{ additionalProperties: false },
					),
					Type.Object({ kind: Type.Literal("HEAL") }, { additionalProperties: false }),
					Type.Object(
						{ kind: Type.Literal("REPAIR_SHIELD") },
						{ additionalProperties: false },
					),
					Type.Object({ kind: Type.Literal("WAIT") }, { additionalProperties: false }),
					Type.Null(),
				],
				{ description: "Core 动作（可选，null 表示不动）" },
			),
		),
		reason: Type.Optional(Type.String({ description: "一句话决策理由" })),
	},
	{ additionalProperties: false },
);

export type ArenaPlanParams = Static<typeof arenaPlanSchema>;

export interface ArenaPlanDetails {
	unitCount: number;
	coreAction: string;
	reason?: string;
}

/** 计划摘要行（renderCall 正文）。返回 null 表示参数非法。 */
function summarizeActions(
	params: ArenaPlanParams | undefined,
): string[] | null {
	if (!params) return null;
	const lines: string[] = [];
	for (const action of params.actions ?? []) {
		const unit = action.unit.slice(0, 8);
		let summary = `${unit} ${action.kind}`;
		if (action.direction) summary += ` ${action.direction}`;
		if (action.target_id) summary += ` →${action.target_id.slice(0, 8)}`;
		if (action.expected_cell) summary += ` @[${action.expected_cell.join(",")}]`;
		lines.push(`- ${summary}`);
	}
	if (params.core && typeof params.core === "object" && "kind" in params.core) {
		const core = params.core;
		const kind = core.kind === "SPAWN" ? `SPAWN ${core.unit_type}` : core.kind;
		lines.push(`core: ${kind}`);
	}
	if (params.reason) lines.push(`💡 ${params.reason}`);
	return lines;
}

type ArenaRenderState = {
	startedAt: number | undefined;
	endedAt: number | undefined;
};

function formatDuration(ms: number): string {
	return `${(ms / 1000).toFixed(1)}s`;
}

export function createArenaPlanToolDefinition(): ToolDefinition<
	typeof arenaPlanSchema,
	ArenaPlanDetails | undefined,
	ArenaRenderState
> {
	// defineTool 保留参数推断（customTools 数组语境下泛型会被拓宽为 unknown）
	return defineTool({
		name: "arena_plan",
		label: "arena_plan",
		description:
			"提交本 Tick 的 Arena Hero 游戏行动计划（每个受控单位的动作 + 可选 Core 动作）。" +
			"动作必须引用状态中存在的单位 UUID。无法决定时提交空 actions。",
		promptSnippet: "提交 Arena Hero 行动计划的唯一工具",
		promptGuidelines: [
			"每 Tick 必须且只能调用一次 arena_plan 提交完整计划。",
			"不要调用任何其他工具（bash/read 等与本决策无关）。",
			"无法决定时就提交空 actions 而不是犹豫。",
		],
		parameters: arenaPlanSchema,
		async execute(
			_toolCallId: string,
			params: ArenaPlanParams,
			_signal: AbortSignal | undefined,
			_onUpdate: AgentToolUpdateCallback<undefined> | undefined,
			_ctx: ExtensionContext,
		): Promise<AgentToolResult<ArenaPlanDetails | undefined>> {
			// 计划已由调用方（arena-bot）从 tool_use 提取，这里只确认并结束回合。
			const core = params.core;
			const coreAction =
				core === null
					? "null"
					: core && typeof core === "object" && "kind" in core
						? core.kind === "SPAWN"
							? `SPAWN ${core.unit_type}`
							: core.kind
						: "WAIT";
			return {
				content: [
					{
						type: "text",
						text: "计划已接收。请直接结束本轮，不要输出其他内容或调用其他工具。",
					},
				],
				details: {
					unitCount: (params.actions ?? []).length,
					coreAction,
					reason: params.reason,
				},
				terminate: true,
			};
		},
		renderCall(args, theme, context) {
			const state = context.state;
			if (context.executionStarted && state.startedAt === undefined) {
				state.startedAt = Date.now();
				state.endedAt = undefined;
			}
			const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
			const summary = summarizeActions(args);
			const title = theme.fg("toolTitle", theme.bold("🎯 arena_plan"));
			if (summary === null) {
				text.setText(`${title}\n${theme.fg("error", "[invalid arg]")}`);
			} else if (summary.length === 0) {
				text.setText(`${title}\n${theme.fg("muted", "(empty plan)")}`);
			} else {
				text.setText(`${title}\n${summary.join("\n")}`);
			}
			return text;
		},
		renderResult(
			result: AgentToolResult<ArenaPlanDetails | undefined>,
			_options: ToolRenderResultOptions,
			theme: Theme,
			context: ToolRenderContext<ArenaRenderState, ArenaPlanParams>,
		) {
			const state = context.state;
			state.endedAt ??= Date.now();
			const text =
				(context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
			const output = theme.fg(
				"toolOutput",
				(result.content.find((c) => c.type === "text")?.text ?? "").trim(),
			);
			const meta: string[] = [];
			const details = result.details;
			if (details) {
				meta.push(
					`${details.unitCount} unit${details.unitCount === 1 ? "" : "s"}` +
						(details.coreAction ? `, core ${details.coreAction}` : ""),
				);
			}
			if (state.startedAt !== undefined) {
				meta.push(`Took ${formatDuration(state.endedAt - state.startedAt)}`);
			}
			text.setText(
				`${output || theme.fg("muted", "(accepted)")}\n${theme.fg("muted", meta.join(" · "))}`,
			);
			return text;
		},
	});
}
