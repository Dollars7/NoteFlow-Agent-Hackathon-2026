"use client";

import type { GoalProfile, SkillState } from "../lib/flow-engine";
import { useLocale } from "./locale";

type GoalPlannerProps = {
  profile: GoalProfile;
  skills: SkillState[];
  onChange: (profile: GoalProfile) => void;
  agentGenerated?: boolean;
};

export function GoalPlanner({
  profile,
  skills,
  onChange,
  agentGenerated = false,
}: GoalPlannerProps) {
  const { t } = useLocale();
  const update = (patch: Partial<GoalProfile>) => onChange({ ...profile, ...patch });
  const paceLabel = profile.paceBias < 34
    ? t("Retention-first", "记忆优先")
    : profile.paceBias > 66
      ? t("Goal-first", "目标优先")
      : t("Balanced", "均衡");
  const scheduleConfirmed = profile.startMode === "now"
    || (profile.startMode === "scheduled" && Boolean(profile.startDate && profile.preferredTime));
  const themeScopes = skills.map((skill) => ({ id: skill.id, label: skill.name }));
  const invitationFrequency = profile.invitationsPerWeekMin === profile.invitationsPerWeekMax
    ? `${profile.invitationsPerWeekMin}× / ${t("week", "周")}`
    : `${profile.invitationsPerWeekMin}–${profile.invitationsPerWeekMax}× / ${t("week", "周")}`;

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
          <h2>{t("Adjust what matters, then start.", "调整最重要的部分，然后开始。")}</h2>
        </div>
        <span className="mode-status">{paceLabel} · {profile.paceBias}%</span>
      </div>

      <div className="planner-fields planner-identity-fields">
        <label>
          <span>{t("Learning goal", "学习目标")}</span>
          <input value={profile.title} onChange={(event) => update({ title: event.target.value })} />
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

      <div className="range-setting session-range-setting">
        <div className="range-heading"><div><span>{t("Session length", "每次学习时长")}</span><strong>{profile.sessionMinutesMin}–{profile.sessionMinutesMax} min</strong></div></div>
        <label className="range-control">
          <span>{t("Shortest useful session", "最短有效时长")}</span>
          <input type="range" min="5" max="60" step="5" value={profile.sessionMinutesMin} onChange={(event) => {
            const value = Number(event.target.value);
            update({ sessionMinutesMin: value, sessionMinutesMax: Math.max(value, profile.sessionMinutesMax) });
          }} />
        </label>
        <label className="range-control">
          <span>{t("Suggested stopping point", "建议停止点")}</span>
          <input type="range" min="5" max="90" step="5" value={profile.sessionMinutesMax} onChange={(event) => {
            const value = Number(event.target.value);
            update({ sessionMinutesMax: value, sessionMinutesMin: Math.min(value, profile.sessionMinutesMin) });
          }} />
        </label>
      </div>

      <details className="planner-more-settings">
        <summary>
          <span>{t("More settings", "更多设置")}</span>
          <small>{t("Reminders, pattern, timing, and inferred themes", "提醒、学习方式、时间与推断主题")}</small>
        </summary>
        <div className="planner-more-content">
          <div className="planner-fields planner-identity-fields">
            <label>
              <span>{t("Role or baseline · optional", "岗位或基线 · 可选")}</span>
              <input value={profile.roleBaseline} onChange={(event) => update({ roleBaseline: event.target.value })} placeholder={t("Leave blank when it does not apply", "不适用时留空")} />
            </label>
          </div>

          <div className="range-setting">
            <div className="range-heading"><div><span>{t("Study reminder frequency", "学习提醒频率")}</span><strong>{invitationFrequency}</strong></div></div>
            <label className="range-control">
              <span>{t("Fewer reminders", "较少提醒")}</span>
              <input type="range" min="1" max="14" value={profile.invitationsPerWeekMin} onChange={(event) => {
                const value = Number(event.target.value);
                update({ invitationsPerWeekMin: value, invitationsPerWeekMax: Math.max(value, profile.invitationsPerWeekMax) });
              }} />
            </label>
            <label className="range-control">
              <span>{t("More reminders", "较多提醒")}</span>
              <input type="range" min="1" max="14" value={profile.invitationsPerWeekMax} onChange={(event) => {
                const value = Number(event.target.value);
                update({ invitationsPerWeekMax: value, invitationsPerWeekMin: Math.min(value, profile.invitationsPerWeekMin) });
              }} />
            </label>
          </div>

          <fieldset className="pattern-picker">
            <legend>{t("Learning pattern", "学习方式")}</legend>
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
              <span>{t("Daily time available · optional", "每天可投入时长 · 可选")}</span>
              <input
                type="number"
                min="5"
                max="720"
                step="5"
                value={profile.dailyMinutes ?? ""}
                onChange={(event) => update({ dailyMinutes: event.target.value ? Number(event.target.value) : null })}
                placeholder={t("Minutes", "分钟")}
              />
            </label>
            <label>
              <span>{t("Goal or delivery date · optional", "考试或交付日期 · 可选")}</span>
              <input type="date" value={profile.sprintDeadline} onChange={(event) => update({ sprintDeadline: event.target.value })} />
            </label>
          </div>

          <fieldset className="plan-start-picker">
            <legend>{t("When should learning start?", "什么时候开始学习？")}</legend>
            <div className="mode-switch plan-start-switch">
              {([
                ["undecided", t("Decide later", "稍后再定")],
                ["now", t("Start now", "现在开始")],
                ["scheduled", t("Choose a time", "指定时间")],
              ] as const).map(([value, label]) => (
                <button
                  type="button"
                  className={profile.startMode === value ? "selected" : ""}
                  onClick={() => update({
                    startMode: value,
                    reminderOptIn: value === "undecided" ? false : profile.reminderOptIn,
                  })}
                  key={value}
                >{label}</button>
              ))}
            </div>
            {profile.startMode === "scheduled" && (
              <div className="planner-fields plan-start-fields">
                <label>
                  <span>{t("Start date", "开始日期")}</span>
                  <input type="date" value={profile.startDate} onChange={(event) => update({ startDate: event.target.value })} />
                </label>
                <label>
                  <span>{t("Start time", "开始时间")}</span>
                  <input type="time" value={profile.preferredTime} onChange={(event) => update({ preferredTime: event.target.value })} />
                </label>
              </div>
            )}
            <p>{scheduleConfirmed
              ? t("Start time confirmed. Reminder options are now available.", "开始时间已确认，现在可以设置提醒。")
              : t("No calendar event or reminder will be created until this is confirmed.", "确认开始时间之前，不会创建日历事件或提醒。")}</p>
          </fieldset>

          <fieldset className="scope-picker">
            <legend>{agentGenerated ? t("Themes inferred from your input", "根据输入生成的主题") : t("What should this session include?", "这次只学哪些知识")}</legend>
            <div className="scope-chips">
              {agentGenerated
                ? themeScopes.map((scope) => <span className="generated-theme" key={scope.id}>{scope.label}</span>)
                : <>
                    <button type="button" className={profile.focusSkillIds.length === 0 ? "selected" : ""} onClick={() => update({ focusSkillIds: [] })}>{t("All knowledge", "全部知识")}</button>
                    {themeScopes.map((scope) => (
                      <button type="button" className={profile.focusSkillIds.includes(scope.id) ? "selected" : ""} onClick={() => toggleScope(scope.id)} key={scope.id}>{scope.label}</button>
                    ))}
                  </>}
            </div>
          </fieldset>

          <label className="plan-reminder-choice">
            <input
              type="checkbox"
              checked={profile.reminderOptIn}
              disabled={!scheduleConfirmed}
              onChange={(event) => update({ reminderOptIn: event.target.checked })}
            />
            <span>{t("Offer optional study reminders", "提供可选学习提醒")}</span>
          </label>
        </div>
      </details>

      <p className="planner-footnote">{t(
        "The sliders guide priority, reminders, and a suggested stopping point. They never limit learning you start yourself.",
        "滑块只指导优先级、提醒和建议停止点，不限制你主动开始学习。",
      )}</p>
    </section>
  );
}
