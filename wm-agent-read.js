// wm-agent-read.js — Working Memory agent READ bridge (Gate B1). Provider-neutral, deterministic.
//
// READ-ONLY: every handler calls only read APIs of the existing WorkingMemory store. There is no
// create/update/archive/link surface here, no LLM, no embeddings, no research loading.
// WORKING_STATE != RESEARCH_STATE.  MODEL_PROPOSAL != USER_DECISION.  UNKNOWN != FALSE.  NOT_RUN != FAIL.
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WmAgentRead = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  const DEFAULT_MODE = 'WORKING';
  const RESEARCH_ENTRYPOINT = 'docs/research/EXPERIMENT_EVIDENCE_INDEX.md';
  const UNRESOLVED = Object.freeze(['OPEN', 'IN_PROGRESS', 'BLOCKED', 'UNKNOWN']);
  const PRIORITY_ORDER = Object.freeze({ P0: 0, P1: 1, P2: 2, P3: 3, TAIL: 4 });
  const BUCKET_LIMIT = 5, BUCKET_MAX = 10, LIST_DEFAULT = 20, LIST_MAX = 50;
  const WORKING_NOTICE = 'WORKING plane (Wm wm_*, NON_CANON). Operational state only; not research evidence, not Canon. ' +
    'MODEL_PROPOSAL/MODEL_SUMMARY items are not user decisions.';

  const TOOLS_SPEC = Object.freeze([
    { name: 'wm_orientation', description: 'WORKING MEMORY (read-only): bounded startup/resume view — current, in_progress, open, blocked, unknown, next actions, recent completed, source pointers. Call first in a fresh session. Does not load research.',
      parameters: { type: 'object', properties: { project: { type: 'string', description: 'project_id or code (optional)' }, limit: { type: 'number', description: 'items per bucket (default 5, max 10)' } } } },
    { name: 'wm_list_projects', description: 'WORKING MEMORY (read-only): list registered Working Memory projects.', parameters: { type: 'object', properties: {} } },
    { name: 'wm_list', description: 'WORKING MEMORY (read-only): list work items. Filters: project, status, type, priority, thread, includeArchived, limit. Archived excluded by default.',
      parameters: { type: 'object', properties: { project: { type: 'string' }, status: { type: 'string' }, type: { type: 'string' }, priority: { type: 'string' }, thread: { type: 'string' }, includeArchived: { type: 'boolean' }, limit: { type: 'number' } } } },
    { name: 'wm_get', description: 'WORKING MEMORY (read-only): one work item by work_id with linked sources and explicit relations only.', parameters: { type: 'object', properties: { work_id: { type: 'string' } }, required: ['work_id'] } },
    { name: 'wm_search', description: 'WORKING MEMORY (read-only): deterministic search (exact WORK_ID > exact title > title contains > tag > summary > body). No embeddings.', parameters: { type: 'object', properties: { query: { type: 'string' }, project: { type: 'string' }, includeArchived: { type: 'boolean' }, limit: { type: 'number' } }, required: ['query'] } },
    { name: 'wm_related', description: 'WORKING MEMORY (read-only): explicit wm_relations of a work item only; no inferred edges.', parameters: { type: 'object', properties: { work_id: { type: 'string' } }, required: ['work_id'] } },
    { name: 'wm_project_sources', description: 'WORKING MEMORY (read-only): where to look for a project\'s detailed source (surface, role, locator). Does not fetch the source.', parameters: { type: 'object', properties: { project: { type: 'string' } }, required: ['project'] } },
    { name: 'research_route', description: 'RESEARCH PLANE pointer (read-only): route into docs/research/EXPERIMENT_EVIDENCE_INDEX.md. Returns research line pointers with verbatim status/verdict/limits. Research is NOT working state and never a user decision.', parameters: { type: 'object', properties: { query: { type: 'string' }, line: { type: 'number' } } } },
  ].map(t => Object.freeze(t)));
  const TOOL_NAMES = Object.freeze(TOOLS_SPEC.map(t => t.name));

  // Deterministic keyword intent router (guidance + test surface; not a model).
  const WORKING_RE = /где мы остановил|что (сейчас )?в работе|что осталось|заблокирован|следующий шаг|рабоч[а-яё]* заметк|where did we (stop|leave)|in progress|what('| i)s blocked|next (step|action)|working note/i;
  const RESEARCH_RE = /эксперимент|исследован|\btce\b|доказательств|not_run|не проверен|research|evidence|candidate|кандидат|experiment/i;
  function routeIntent(text) {
    const s = String(text == null ? '' : text);
    const w = WORKING_RE.test(s), r = RESEARCH_RE.test(s);
    if (w && r) return { intent: 'MIXED', plane: ['WORKING', 'RESEARCH'], answer_format: 'WORKING: ... / RESEARCH: ... (labeled separately, never merged)' };
    if (r) return { intent: 'RESEARCH', plane: ['RESEARCH'], answer_format: 'RESEARCH: ...' };
    if (w) return { intent: 'WORKING', plane: ['WORKING'], answer_format: 'WORKING: ...' };
    return { intent: 'DEFAULT', plane: [DEFAULT_MODE], answer_format: 'WORKING default; enter Research Plane only when the user/task requires it' };
  }

  const GUIDANCE = [
    'DEFAULT_RUNTIME_MODE = WORKING. Working state = Working Memory (wm_*). Research = docs/research/EXPERIMENT_EVIDENCE_INDEX.md (pointer only).',
    'Fresh session: call wm_orientation first. "Where did we stop / what is in progress / blocked / next step" -> wm_* tools.',
    '"What experiments / what did TCE show / what is NOT_RUN / where is evidence" -> research_route, then verify at PRIMARY_EVIDENCE.',
    'Mixed question -> answer with separate labeled sections "WORKING:" and "RESEARCH:"; never merge into one unlabeled state.',
    'A research candidate (e.g. CANDIDATE + NOT_RUN) is NOT a working decision. A working HYPOTHESIS is NOT an experiment result or evidence.',
    'MODEL_PROPOSAL / MODEL_SUMMARY != USER_DECISION. UNKNOWN != FALSE. NOT_RUN != FAIL. BLOCKED != FAIL. CURRENT is not unresolved. RESOLVED != COMPLETED.',
    'These tools are read-only. Do not write to Working Memory or promote research into it.',
  ].join('\n');

  function cap(value, def, max) {
    const n = Number(value);
    return Math.max(1, Math.min(max, Number.isFinite(n) && n > 0 ? Math.floor(n) : def));
  }
  function compact(item) {
    return { work_id: item.work_id, project_id: item.project_id, thread: item.thread, type: item.type, status: item.status, priority: item.priority,
      title: item.title, summary: item.summary, current_question: item.current_question, status_note: item.status_note, next_action: item.next_action,
      provenance_class: item.provenance_class, non_canon: item.non_canon, updated_at: item.updated_at, archived_at: item.archived_at };
  }
  function byPriority(a, b) {
    return (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) || (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0) ||
      (a.work_id < b.work_id ? -1 : a.work_id > b.work_id ? 1 : 0);
  }
  function sourcePointer(s) {
    return { source_id: s.source_id, project_id: s.project_id, surface: s.surface, role: s.role, title: s.title, locator: s.locator, revision: s.revision, note: s.note };
  }

  function create(options) {
    options = options || {};
    const store = options.store;
    if (!store || typeof store.listItems !== 'function') throw new Error('WmAgentRead requires a WorkingMemory store');
    const loadResearchIndex = typeof options.loadResearchIndex === 'function' ? options.loadResearchIndex : null;
    const router = options.router || (root && root.ResearchRouter) || null;

    function resolveProject(ref) {
      if (ref == null || ref === '') return null;
      const key = String(ref).trim();
      const hit = store.listProjects().find(p => p.project_id === key) ||
        store.listProjects().find(p => p.code.toLowerCase() === key.toLowerCase());
      if (!hit) { const e = new Error('Unknown project: ' + key); e.code = 'NOT_FOUND'; throw e; }
      return hit;
    }
    function bucket(project, statuses, limit) {
      let items = [];
      for (const status of statuses) items = items.concat(store.listItems({ status, project_id: project ? project.project_id : undefined }));
      items.sort(byPriority);
      return { items: items.slice(0, limit).map(compact), total: items.length, truncated: items.length > limit };
    }

    function orientation(args) {
      args = args || {};
      const limit = cap(args.limit, BUCKET_LIMIT, BUCKET_MAX);
      const project = resolveProject(args.project);
      const projects = project ? [project] : store.listProjects();
      const current = bucket(project, ['CURRENT'], limit), inProgress = bucket(project, ['IN_PROGRESS'], limit),
        open = bucket(project, ['OPEN'], limit), blocked = bucket(project, ['BLOCKED'], limit),
        unknown = bucket(project, ['UNKNOWN'], limit), completed = bucket(project, ['COMPLETED'], limit);
      let nextAll = [];
      for (const status of UNRESOLVED) nextAll = nextAll.concat(store.listItems({ status, project_id: project ? project.project_id : undefined }));
      nextAll = nextAll.filter(i => i.next_action && String(i.next_action).trim()).sort(byPriority);
      const withNext = { total: nextAll.length, truncated: nextAll.length > limit,
        items: nextAll.slice(0, limit).map(i => ({ work_id: i.work_id, project_id: i.project_id, status: i.status, priority: i.priority, title: i.title, next_action: i.next_action })) };
      const pointers = [];
      for (const p of projects) for (const s of store.listSources(p.project_id).filter(x => x.role === 'PRIMARY' || x.role === 'NAVIGATION').slice(0, 3)) pointers.push(sourcePointer(s));
      return {
        plane: 'WORKING', mode: DEFAULT_MODE, notice: WORKING_NOTICE, read_only: true,
        unresolved_statuses: UNRESOLVED.slice(), archived_included: false,
        projects: projects.map(p => ({ project_id: p.project_id, code: p.code, name: p.name, summary: p.summary })),
        current: current.items, in_progress: inProgress.items, open: open.items, blocked: blocked.items, unknown: unknown.items,
        next_actions: withNext.items, recent_completed: completed.items,
        totals: { current: current.total, in_progress: inProgress.total, open: open.total, blocked: blocked.total, unknown: unknown.total, next_actions: withNext.total, recent_completed: completed.total },
        truncated: { current: current.truncated, in_progress: inProgress.truncated, open: open.truncated, blocked: blocked.truncated, unknown: unknown.truncated, next_actions: withNext.truncated, recent_completed: completed.truncated },
        source_pointers: pointers.slice(0, 15),
        research: { available: true, loaded: false, entrypoint: RESEARCH_ENTRYPOINT },
      };
    }

    function list(args) {
      args = args || {};
      const project = resolveProject(args.project || args.project_id);
      const limit = cap(args.limit, LIST_DEFAULT, LIST_MAX);
      const filters = { includeArchived: !!args.includeArchived };
      for (const k of ['status', 'type', 'priority', 'thread']) if (args[k] != null && args[k] !== '') filters[k] = args[k];
      if (project) filters.project_id = project.project_id;
      const all = store.listItems(filters);
      return { plane: 'WORKING', notice: WORKING_NOTICE, items: all.slice(0, limit).map(compact), total: all.length, truncated: all.length > limit, archived_included: filters.includeArchived };
    }
    function get(args) {
      const item = store.getItem(args && args.work_id);
      if (!item) return { plane: 'WORKING', found: false, work_id: args && args.work_id };
      return { plane: 'WORKING', notice: WORKING_NOTICE, found: true, item: Object.assign(compact(item), { body_md: item.body_md, tags_json: item.tags_json }),
        sources: store.listItemSources(item.work_id).map(s => Object.assign(sourcePointer(s), { is_primary: !!s.is_primary })),
        relations: store.listRelations(item.work_id).map(r => ({ relation_id: r.relation_id, from_work_id: r.from_work_id, to_work_id: r.to_work_id, relation_type: r.relation_type })) };
    }
    function search(args) {
      args = args || {};
      const project = resolveProject(args.project || args.project_id);
      const limit = cap(args.limit, LIST_DEFAULT, LIST_MAX);
      let hits = store.searchItems(args.query, 100, { includeArchived: !!args.includeArchived });
      if (project) hits = hits.filter(i => i.project_id === project.project_id);
      return { plane: 'WORKING', notice: WORKING_NOTICE, order: 'WORK_ID > exact title > title contains > tag > summary > body', items: hits.slice(0, limit).map(compact), total: hits.length, truncated: hits.length > limit };
    }
    function related(args) {
      const item = store.getItem(args && args.work_id);
      if (!item) return { plane: 'WORKING', found: false, work_id: args && args.work_id };
      return { plane: 'WORKING', found: true, work_id: item.work_id, inferred_edges: false,
        relations: store.listRelations(item.work_id).map(r => ({ relation_id: r.relation_id, from_work_id: r.from_work_id, to_work_id: r.to_work_id, relation_type: r.relation_type })) };
    }
    function projectSources(args) {
      const project = resolveProject(args && (args.project || args.project_id));
      if (!project) { const e = new Error('project is required'); e.code = 'VALIDATION'; throw e; }
      return { plane: 'WORKING', project_id: project.project_id, code: project.code, fetched: false, sources: store.listSources(project.project_id).map(sourcePointer) };
    }
    async function researchRoute(args) {
      if (!router) return { plane: 'RESEARCH', index_loaded: false, entrypoint: RESEARCH_ENTRYPOINT, note: 'Research router unavailable; open the entrypoint directly.' };
      let text = null;
      if (loadResearchIndex) { try { text = await loadResearchIndex(); } catch (_) { text = null; } }
      return router.route(text, args || {});
    }

    const HANDLERS = { wm_orientation: orientation, wm_list_projects: () => ({ plane: 'WORKING', projects: store.listProjects().map(p => ({ project_id: p.project_id, code: p.code, name: p.name, summary: p.summary })) }),
      wm_list: list, wm_get: get, wm_search: search, wm_related: related, wm_project_sources: projectSources, research_route: researchRoute };

    // Returns a JSON-serialisable object; never throws (errors become { ok:false }).
    async function execute(name, args) {
      const fn = Object.prototype.hasOwnProperty.call(HANDLERS, name) ? HANDLERS[name] : null;
      if (!fn) return { ok: false, error: 'Unknown read tool: ' + name, code: 'UNKNOWN_TOOL' };
      try { return await fn(args || {}); }
      catch (error) { return { ok: false, error: String(error && error.message || error), code: error && error.code || 'ERROR' }; }
    }
    return Object.freeze({ execute, orientation, TOOL_NAMES });
  }

  return Object.freeze({ DEFAULT_MODE, RESEARCH_ENTRYPOINT, TOOLS_SPEC, TOOL_NAMES, GUIDANCE, routeIntent, create });
});
