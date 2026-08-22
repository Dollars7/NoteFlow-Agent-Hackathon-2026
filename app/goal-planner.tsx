"use client";

import {
  goals,
  skillScopes,
  type GoalId,
  type GoalProfile,
} from "../lib/flow-engine";
import { useLocale } from "./locale";

type GoalPlannerProps = {
  profile: GoalProfile;
  onChange: (profile: GoalProfile) => void;
};

export function GoalPlanner({ profile, onChange }: GoalPlannerProps) {
  const { locale, t } = useLocale();
  const update = (patch: Partial<GoalProfile>) => onChange({ ...profile, ...patch });
  const scopeLabel = (id: string, fallback: string) => {
    if (locale === "en") return fallback;
    return {
      intervals: "区间",
      ood: "对象设计",
      expression: "技术英语",
      spring: "Spring / JWT",
      graph: "图算法",
    }[id] ?? fallback;
  };

  const toggleScope = (skillId: string) => {
    update({
      focusSkillIds: profile.focusSkillIds.includes(skillId)
        ? profile.focusSkillIds.filter((id) => id !== skillId)
        : [...profile.focusSkillIds, skillId],
    });
  };

  return (
    <section className="goal-planner" aria-label={t("Learning goal settings", "学习目标设置")}>
      <div className="planner-heading">
        <div>
          <p className="eyebrow">{t("What do you need to learn next?", "最近要学什么")}</p>
          <h2>{t("Set a direction, not a task list.", "定义方向，不排任务。")}</h2>
        </div>
        <span className={profile.mode === "sprint" ? "mode-status sprint" : "mode-status"}>
          {profile.mode === "sprint" ? t("Sprint active", "冲刺中") : t("Steady progress", "长期推进")}
        </span>
      </div>

      <div className="mode-switch" role="group" aria-label={t("Learning pace", "学习节奏")}>
        <button
          type="button"
          className={profile.mode === "steady" ? "selected" : ""}
          onClick={() => update({ mode: "steady" })}
        >
          {t("Steady progress", "长期推进")}
          <small>{t("Schedule steadily by memory retention", "按记忆保持度稳定调度")}</small>
        </button>
        <button
          type="button"
          className={profile.mode === "sprint" ? "selected" : ""}
          onClick={() => update({ mode: "sprint" })}
        >
          {t("Interview sprint", "面试冲刺")}
          <small>{t("Increase goal-relevant weight as the interview approaches", "临近面试，提高目标相关知识权重")}</small>
        </button>
      </div>

      <div className="planner-fields">
        <label>
          <span>{t("Goal name", "目标名称")}</span>
          <input
            value={profile.title}
            onChange={(event) => update({ title: event.target.value })}
            placeholder={t("e.g. Amazon SDE II technical interview", "例如：Amazon SDE II 技术面试")}
          />
        </label>
        <label>
          <span>{t("Role baseline", "岗位基线")}</span>
          <select
            value={profile.baseGoal}
            onChange={(event) => update({ baseGoal: event.target.value as GoalId })}
          >
            {Object.entries(goals).map(([id, goal]) => (
              <option value={id} key={id}>{goal.label}</option>
            ))}
          </select>
        </label>
        {profile.mode === "sprint" && (
          <label>
            <span>{t("Interview date", "面试日期")}</span>
            <input
              type="date"
              value={profile.sprintDeadline}
              onChange={(event) => update({ sprintDeadline: event.target.value })}
            />
          </label>
        )}
      </div>

      <fieldset className="scope-picker">
        <legend>{t("What should this session include?", "这次只学哪些知识")}</legend>
        <div className="scope-chips">
          <button
            type="button"
            className={profile.focusSkillIds.length === 0 ? "selected" : ""}
            onClick={() => update({ focusSkillIds: [] })}
          >
            {t("All knowledge", "全部知识")}
          </button>
          {skillScopes.map((scope) => (
            <button
              type="button"
              className={profile.focusSkillIds.includes(scope.id) ? "selected" : ""}
              onClick={() => toggleScope(scope.id)}
              key={scope.id}
            >
              {scopeLabel(scope.id, scope.label)}
            </button>
          ))}
        </div>
      </fieldset>

      <p className="planner-footnote">
        {t(
          "This is a scheduling boundary, not a backlog. The system draws only from the selected scope; anything not shown today returns to the pool.",
          "这是调度边界，不是 backlog。系统只从所选范围取卡；今天没出现的内容会回到池中。",
        )}
      </p>
    </section>
  );
}
