"use client";

import { skillScopes, type GoalProfile } from "../lib/flow-engine";
import { useLocale } from "./locale";

type GoalPlannerProps = {
  profile: GoalProfile;
  onChange: (profile: GoalProfile) => void;
  agentGenerated?: boolean;
};

export function GoalPlanner({ profile, onChange, agentGenerated = false }: GoalPlannerProps) {
  const { locale, t } = useLocale();
  const update = (patch: Partial<GoalProfile>) => onChange({ ...profile, ...patch });
  const paceLabel = profile.paceBias < 34
    ? t("Retention-first", "记忆优先")
    : profile.paceBias > 66
      ? t("Goal-first", "目标优先")
      : t("Balanced", "均衡");
  const scopeLabel = (id: string, fallback: string) => {
    if (locale === "en") return fallback;
    return { intervals: "区间", ood: "对象设计", expression: "技术英语", spring: "Spring / JWT", graph: "图算法" }[id] ?? fallback;
  };

  const toggleScope = (skillId: string) => {
    update({
      focusSkillIds: profile.focusSkillIds.includes(skillId)
        ? profile.focusSkillIds.filter((id) => id !== skillId)
        : [...profile.focusSkillIds, skillId],
    });
  };

  return (
    <section className="goal-planner" aria-label={t("Learning plan review", "学习计划确认")}>
      <div className="planner-heading">
        <div>
          <p className="eyebrow">{agentGenerated ? t("Agent-generated draft", "Agent 生成的计划草稿") : t("Learning direction", "学习方向")}</p>
          <h2>{t("Review the ranges, then start.", "确认范围，再开始学习。")}</h2>
        </div>
        <span className="mode-status">{paceLabel} · {profile.paceBias}%</span>
      </div>

      <div className="planner-fields planner-identity-fields">
        <label>
          <span>{t("Goal generated from your input", "根据输入生成的目标")}</span>
          <input value={profile.title} onChange={(event) => update({ title: event.target.value })} />
        </label>
        <label>
          <span>{t("Role / baseline · optional", "岗位 / 基线 · 可选")}</span>
          <input value={profile.roleBaseline} onChange={(event) => update({ roleBaseline: event.target.value })} placeholder={t("Hidden when no role is implied", "没有岗位信息时可以留空")} />
        </label>
      </div>

      <div className="range-setting pace-setting">
        <div className="range-heading">
          <div><span>{t("Learning priority", "学习优先级")}</span><strong>{t("Steady", "长期推进")} ↔ {t("Sprint", "冲刺")}</strong></div>
          <b>{profile.paceBias}%</b>
        </div>
        <input type="range" min="0" max="100" value={profile.paceBias} onChange={(event) => update({ paceBias: Number(event.target.value) })} aria-label={t("Steady to sprint priority", "长期推进到冲刺的优先级")} />
        <div className="range-ends"><span>{t("Memory retention", "记忆保持")}</span><span>{t("Goal relevance", "目标相关")}</span></div>
      </div>

      <div className="range-grid">
        <div className="range-setting">
          <div className="range-heading"><div><span>{t("Session range", "Session 时长范围")}</span><strong>{profile.sessionMinutesMin}–{profile.sessionMinutesMax} min</strong></div></div>
          <label className="range-control">
            <span>{t("Minimum", "最短")}</span>
            <input type="range" min="5" max="60" step="5" value={profile.sessionMinutesMin} onChange={(event) => {
              const value = Number(event.target.value);
              update({ sessionMinutesMin: value, sessionMinutesMax: Math.max(value, profile.sessionMinutesMax) });
            }} />
          </label>
          <label className="range-control">
            <span>{t("Suggested stop", "建议停止点")}</span>
            <input type="range" min="5" max="90" step="5" value={profile.sessionMinutesMax} onChange={(event) => {
              const value = Number(event.target.value);
              update({ sessionMinutesMax: value, sessionMinutesMin: Math.min(value, profile.sessionMinutesMin) });
            }} />
          </label>
        </div>

        <div className="range-setting">
          <div className="range-heading"><div><span>{t("Invitation range", "邀请频率范围")}</span><strong>{profile.invitationsPerWeekMin}–{profile.invitationsPerWeekMax}× / {t("week", "周")}</strong></div></div>
          <label className="range-control">
            <span>{t("Minimum rhythm", "最低节奏")}</span>
            <input type="range" min="1" max="14" value={profile.invitationsPerWeekMin} onChange={(event) => {
              const value = Number(event.target.value);
              update({ invitationsPerWeekMin: value, invitationsPerWeekMax: Math.max(value, profile.invitationsPerWeekMax) });
            }} />
          </label>
          <label className="range-control">
            <span>{t("Upper invitation guide", "邀请建议上限")}</span>
            <input type="range" min="1" max="14" value={profile.invitationsPerWeekMax} onChange={(event) => {
              const value = Number(event.target.value);
              update({ invitationsPerWeekMax: value, invitationsPerWeekMin: Math.min(value, profile.invitationsPerWeekMin) });
            }} />
          </label>
        </div>
      </div>

      <fieldset className="pattern-picker">
        <legend>{t("Pattern", "学习方式")}</legend>
        <div className="mode-switch pattern-switch">
          {([
            ["short-frequent", t("Short + frequent", "少量多次")],
            ["fixed-daily", t("Fixed daily time", "每天固定时间")],
            ["energy-aligned", t("Follow energy", "跟随精力窗口")],
          ] as const).map(([value, label]) => (
            <button type="button" className={profile.studyPattern === value ? "selected" : ""} onClick={() => update({ studyPattern: value })} key={value}>{label}</button>
          ))}
        </div>
      </fieldset>

      <div className="planner-fields plan-timing-fields">
        <label>
          <span>{t("Best energy", "最佳精力")}</span>
          <select value={profile.energyWindow} onChange={(event) => update({ energyWindow: event.target.value as GoalProfile["energyWindow"] })}>
            <option value="morning">{t("Morning", "早晨")}</option>
            <option value="midday">{t("Midday", "中午")}</option>
            <option value="evening">{t("Evening", "晚间")}</option>
            <option value="variable">{t("It varies", "每天不同")}</option>
          </select>
        </label>
        <label>
          <span>{t("Preferred invitation time", "偏好的邀请时间")}</span>
          <input type="time" value={profile.preferredTime} onChange={(event) => update({ preferredTime: event.target.value })} />
        </label>
        {profile.paceBias >= 60 && (
          <label>
            <span>{t("Target date · optional", "目标日期 · 可选")}</span>
            <input type="date" value={profile.sprintDeadline} onChange={(event) => update({ sprintDeadline: event.target.value })} />
          </label>
        )}
      </div>

      <fieldset className="scope-picker">
        <legend>{agentGenerated ? t("Themes inferred from your input", "根据输入生成的主题") : t("What should this session include?", "这次只学哪些知识")}</legend>
        <div className="scope-chips">
          {agentGenerated
            ? profile.themes.map((theme) => <span className="generated-theme" key={theme}>{theme}</span>)
            : <>
                <button type="button" className={profile.focusSkillIds.length === 0 ? "selected" : ""} onClick={() => update({ focusSkillIds: [] })}>{t("All knowledge", "全部知识")}</button>
                {skillScopes.map((scope) => (
                  <button type="button" className={profile.focusSkillIds.includes(scope.id) ? "selected" : ""} onClick={() => toggleScope(scope.id)} key={scope.id}>{scopeLabel(scope.id, scope.label)}</button>
                ))}
              </>}
        </div>
      </fieldset>

      <label className="plan-reminder-choice">
        <input type="checkbox" checked={profile.reminderOptIn} onChange={(event) => update({ reminderOptIn: event.target.checked })} />
        <span>{t("Offer reminders inside the invitation range", "按照邀请范围提供可选提醒")}</span>
      </label>

      <p className="planner-footnote">{t(
        "These ranges guide prioritization, invitations, and a suggested stopping point. They never limit voluntary learning—you can start another session whenever you want.",
        "这些范围只指导优先级、邀请和建议停止点，不限制你主动学习；你随时可以再开始一次 Session。",
      )}</p>
    </section>
  );
}
