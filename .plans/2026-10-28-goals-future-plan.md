# Goals — Initial Scope and Future Plan

**Status:** Product planning; no implementation scheduled by this document.
**Source:** [Issue #201](https://github.com/ShadowWalker2014/open-sunsama/issues/201) and the subsequent scoping conversation, 2026-10-28.
**Primary use case:** The person building and using this feature wants support for working with their ADHD: reconnecting with why something matters, deciding what to do next, and returning to intentions after attention has shifted.

## Product intent

Goals begin as ongoing directions to invest in, rather than outcomes that must reach a finish line. Examples supplied by the user:

- Get better at drama.
- Be a better husband.
- Be a better father.

The core journey is to zoom into a goal, optionally explore smaller supporting goals, choose a connected task, and use the existing planner to act. From a task, the user can navigate back to its broader meaning.

Treat ADHD support as a design constraint throughout, not a separate advanced mode. The following are proposed experience principles to validate with this user, rather than assumptions about every person with ADHD:

- Keep capture fast; goal classification is always optional.
- Reveal one level at a time, with a clear way back. Do not require the user to understand or maintain an entire tree at once.
- Make a small next action easy to find without turning every intention into a planning exercise.
- Support returning after a gap without accumulated review debt, punitive language, or streak resets.
- Keep reflection optional and lightweight. Maintaining the tool should not become another obligation.
- Use calm, concrete language. A relationship goal is a personal intention, not a score of someone's worth as a spouse or parent.
- Validate whether each addition reduces decision effort in real use. More structure is not automatically more support.

## Agreed v1 boundary

| Topic | Agreed scope |
| --- | --- |
| Goal meaning | Ongoing intentions; no completion state yet |
| Structure | Optional nesting, without required named levels |
| Time horizons | No weekly/monthly layers |
| Removal | Archive only |
| Parent view | Immediate children only; proposed task section shows directly connected tasks |
| Moving | Supported |
| Progress history | None; proposed current reflection is editable in place |

The current working proposal also includes a title, optional description, breadcrumbs, optional task connections, and navigation between a task and its goal. A single direct goal link per task is the initial recommendation, not a user-confirmed cardinality requirement.

Archive/restore details remain to be confirmed before implementation. The earlier proposal was to archive a subtree while retaining tasks and their links, and restore only descendants archived by that operation. This is a proposal, not an agreed lifecycle contract.

## Deferred work register

Everything below is outside the initial scope. These are options to revisit when there is a demonstrated need, not a commitment to build every item.

### 1. Weekly and monthly priorities

**Deferred:** Explicit weekly/monthly planning layers, periods, current-priority views, past-period views, and unfinished-priority carry-forward behavior.

**Potential value:** Bridge a broad intention such as “be a better father” to a manageable commitment such as “make space for one uninterrupted afternoon together.”

**Revisit when:** Ongoing goals provide useful context, but the user still struggles to choose which goal deserves attention now.

**Decisions before building:** Are priorities separate records attached to goals, time-scoped goals, or simply selections of existing goals? Does choosing a priority require another hierarchy level? How are past periods retained, and how can an unfinished commitment be reconsidered without automatic backlog growth?

**ADHD acceptance:** Selecting a small focus should be optional and quick. Missing a week must not create mandatory catch-up work. A planning period must not silently become a deadline.

### 2. Completion and finite outcomes

**Deferred:** Completed/achieved states, finite goals or projects, milestones, completion dates, and reopen behavior.

**Potential value:** Support an outcome such as “perform in a play” alongside the ongoing direction “get better at drama.”

**Revisit when:** The user has real finishable outcomes that feel awkward to represent as ongoing goals or ordinary tasks.

**Decisions before building:** How do ongoing and finite items coexist? Can a finite child finish while its parent stays ongoing? What happens to open tasks? How are completion, archive, and pausing distinguished? Completion must be explicit rather than inferred from task counts.

**ADHD acceptance:** Ongoing relationship and personal-development goals must never imply perpetual failure because they cannot be finished. A finished supporting outcome should be recognizable without requiring a new project-management workflow.

### 3. Historical progress and dated reflections

**Deferred:** Dated check-ins, reflection timelines, progress snapshots, and comparisons over time. V1 has no user-facing progress history.

**Potential value:** Help the user notice gradual progress and recover context after a break without relying on memory.

**Revisit when:** Replacing the current reflection loses information the user actually wants to revisit.

**Decisions before building:** Manual check-ins versus saved versions; what to retain; editing and deletion; and whether task activity belongs beside reflections. Do not assume private relationship reflections should be included in analytics or assistant context.

**ADHD acceptance:** A check-in can be a sentence. Gaps are normal; no streaks, backfill requirements, or implied obligation to journal.

### 4. Review workflows and cadence

**Deferred:** Weekly/monthly reviews, quarterly/yearly reviews, review reminders, guided prompts, and “needs review” states.

**Potential value:** Make intentions easier to rediscover before they disappear from attention.

**Revisit when:** The user wants help returning to goals and ordinary navigation is insufficient.

**Decisions before building:** User-triggered review versus optional reminders; cadence per goal or globally; reminder dismissal; and which review produces a useful next action. A time horizon, goal type, and review frequency are separate concepts.

**ADHD acceptance:** Reminders must be controllable and easy to stop. Returning after a missed review starts from now, without an overdue-review queue.

### 5. Richer progress measures and rollups

**Deferred:** Percentages, numeric targets, weighted milestones, descendant task totals, automatic parent progress, time-spent summaries, and broad progress dashboards.

**Potential value:** Some goals may benefit from concrete evidence of movement beyond a current reflection.

**Revisit when:** The user identifies a specific measure that helps them choose an action or recognize progress.

**Decisions before building:** Direct versus descendant aggregation; avoiding double-counting; what tracked time means; and how changes to tasks affect prior summaries. Task counts and time spent are activity, not proof of goal attainment.

**ADHD acceptance:** Never score “being a better husband/father” through completed-task percentages. Measurements must be optional and meaningful to the user, with no default performance dashboard.

### 6. Ideas-to-Goals connections

**Deferred:** Linking Ideas boards/cards to goals, converting an idea into a goal, creating goal-linked tasks from an idea, and showing goal context in the Ideas planner surface.

**Potential value:** Let a captured possibility become an intention without rewriting it or losing its origin.

**Revisit when:** Real use shows repeated copying or uncertainty about how an idea becomes something the user wants to pursue.

**Decisions before building:** Reference versus conversion; what happens to the source idea; duplicate prevention; preserving existing task links; and whether a whole board needs a goal connection at all.

**ADHD acceptance:** Capturing an idea must not require choosing a goal, and an idea must be allowed to remain just a possibility.

### 7. External context and integrations

**Deferred:** Goal-level external links, imported project/goal context, provider pickers, and synchronization with external planning systems. The issue discussion raised integrations as an alternative way to keep broader context outside the daily planner.

**Potential value:** Preserve the route back to context maintained elsewhere without duplicating its upkeep.

**Revisit when:** The user actually keeps relevant context in another tool. A simple reference link should be evaluated before import or sync.

**Decisions before building:** Reference-only versus source-of-truth integration; ownership of edits; disconnected/deleted source behavior; and explicit access to personal reflections. Existing provider capabilities must be inspected before implementation.

**ADHD acceptance:** Avoid duplicate planning obligations and conflicting states across tools. Do not make connection/setup a condition of using Goals.

### 8. Multiple goal links per task

**Deferred:** Many-to-many task/goal links, multiple paths back from a task, and primary/secondary goal distinctions.

**Potential value:** One action can support several intentions, such as a family activity supporting both partnership and parenting.

**Revisit when:** The recommended single-link model repeatedly forces an unhelpful choice.

**Decisions before building:** What breadcrumb to show; whether a primary link is needed; search/filter behavior; and deduplication in any future summaries.

**ADHD acceptance:** Extra classification remains optional. Linking a task should not become a multi-step tagging exercise.

### 9. Broader navigation and planner visibility

**Deferred:** Descendant task views, cross-goal summaries, full-tree/map views, and richer planner-level goal summaries. A compact board-card goal label was left for prototype validation rather than accepted as a requirement.

**Potential value:** Help locate work across goals or reconnect with context without opening task details.

**Revisit when:** Immediate-child navigation or task-detail navigation creates a demonstrated obstacle.

**Decisions before building:** Where additional context earns its visual space; explicit direct/descendant modes; deep breadcrumb handling; and how to return to the same planner position.

**ADHD acceptance:** Immediate children remain the default parent view. Avoid exposing the entire life hierarchy during daily execution. Any board label should stay compact and optional.

### 10. Formal horizons, types, and life vision

**Deferred:** Separate life-vision/purpose records, yearly themes, quarterly horizons, formal areas versus goals versus projects, and methodology-specific onboarding.

**Potential value:** Some users may eventually want a clearer distinction between ongoing responsibilities, future direction, and finite outcomes.

**Revisit when:** Flexible ongoing goals are insufficient to express the user's actual thinking, rather than because the conceptual model allows more categories.

**Decisions before building:** Which distinctions have different behavior; which are merely optional labels; and whether vision is better represented by a short optional statement. Horizons of Focus remains inspiration rather than a required schema.

**ADHD acceptance:** No requirement to define one's life vision or classify every item before capturing a task or creating a useful goal. Every intermediate layer must remain skippable.

## Suggested future sequence

This is a learning order, not a dated delivery promise:

1. **Use the ongoing-goal foundation:** Validate “get better at drama,” “be a better husband,” and “be a better father” with real tasks. Include returning after a break and using Goals with no children.
2. **Address the first observed friction:** Consider a small current-focus selection if choosing is difficult, dated reflections if context is lost, or a light review affordance if rediscovery is difficult. Do not bundle these into one large release.
3. **Add finite outcomes when needed:** Introduce explicit completion while preserving ongoing goals as a first-class use case.
4. **Improve connections where duplication appears:** Ideas links, external references, or multiple task links, based on actual usage.
5. **Evaluate richer structures and summaries last:** Formal horizons, metrics, rollups, and dashboards require evidence that they reduce effort rather than add maintenance.

Weekly/monthly layers may remain deferred indefinitely if selecting tasks from ongoing goals works well. Likewise, a review feature does not require historical progress, and an external reference does not require synchronization.

## Validation questions for every future slice

- Does this help the user reconnect with why something matters or identify a manageable next action?
- Is it understandable with one ongoing goal and one task?
- Can it be ignored without degrading quick capture or daily planning?
- Can the user return after several weeks without cleaning up the system first?
- Does it reduce choices or introduce more classification, notifications, and maintenance?
- Does it support meaningful movement without guilt-inducing scores or arbitrary completion pressure?

Review answers with the user through concrete flows and actual use. These goals concern a personal ADHD-supporting workflow; feature adoption and task volume alone are insufficient measures of success.
