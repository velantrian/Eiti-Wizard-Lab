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
    { name: 'research_route', description: 'RESEARCH PLANE pointer (read-only; independent of Working Memory): route into docs/research/EXPERIMENT_EVIDENCE_INDEX.md. No args = overview; card = research CARD number (not a file line); query = case-insensitive substring terms over title/name/question/status/verdict/open finding/primary evidence (e.g. NOT_RUN, BLOCKED, TCE). Give card OR query, not both. Returns verbatim index fields as pointers; no verdict is derived. Research is NOT working state and never a user decision.', parameters: { type: 'object', properties: { query: { type: 'string' }, card: { type: 'number', description: 'research card number' } } } },
  ].map(t => Object.freeze(t)));
  const TOOL_NAMES = Object.freeze(TOOLS_SPEC.map(t => t.name));

  // DIAGNOSTIC ONLY: not invoked at runtime and not acceptance evidence for model routing.
  // Routing authority in B1 = tool descriptions + GUIDANCE + explicit plane labels on every result.
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
    'When resuming work or asked about working state in a fresh session, call wm_orientation first (otherwise answer without tools). "Where did we stop / what is in progress / blocked / next step" -> wm_* tools.',
    '"What experiments / what did TCE show / what is NOT_RUN / where is evidence" -> research_route (query or card), then verify at PRIMARY_EVIDENCE. research_route works even if Working Memory is unavailable.',
    'Mixed question -> answer with separate labeled sections "WORKING:" and "RESEARCH:"; never merge into one unlabeled state.',
    'A research candidate (e.g. CANDIDATE + NOT_RUN) is NOT a working decision. A working HYPOTHESIS is NOT an experiment result or evidence.',
    'MODEL_PROPOSAL / MODEL_SUMMARY != USER_DECISION. UNKNOWN != FALSE. NOT_RUN != FAIL. BLOCKED != FAIL. CURRENT is not unresolved. RESOLVED != COMPLETED.',
    'These tools are read-only. Do not write to Working Memory or promote research into it.',
  ].join('\n');

  function cap(value, def, max) {
    const n = Number(value);
    return Math.max(1, Math.min(max, Number.isFinite(n) && n > 0 ? Math.floor(n) : def));
  }

  // Agent-facing text caps. The database is never changed; clipped fields are listed in truncated_fields.
  const CAPS = Object.freeze({ title: 200, name: 200, summary: 500, current_question: 300, status_note: 300, next_action: 300,
    note: 300, tags_json: 500, body_md: 4000 });
  function boundText(value, max) {
    if (typeof value !== 'string') return { text: value, truncated: false };
    return value.length > max ? { text: value.slice(0, max) + '…', truncated: true } : { text: value, truncated: false };
  }
  function boundFields(source, spec, truncated) {
    const out = {};
    for (const [key, max] of spec) {
      const r = boundText(source[key], max);
      out[key] = r.text;
      if (r.truncated) truncated.push(key);
    }
    return out;
  }
  function compact(item) {
    const truncated_fields = [];
    const text = boundFields(item, [['title', CAPS.title], ['summary', CAPS.summary], ['current_question', CAPS.current_question],
      ['status_note', CAPS.status_note], ['next_action', CAPS.next_action]], truncated_fields);
    return Object.assign({ work_id: item.work_id, project_id: item.project_id, thread: item.thread, type: item.type, status: item.status, priority: item.priority },
      text, { provenance_class: item.provenance_class, non_canon: item.non_canon, updated_at: item.updated_at, archived_at: item.archived_at, truncated_fields });
  }
  function projectView(p) {
    const truncated_fields = [];
    return Object.assign({ project_id: p.project_id, code: p.code }, boundFields(p, [['name', CAPS.name], ['summary', CAPS.summary]], truncated_fields), { truncated_fields });
  }
  function byPriority(a, b) {
    return (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) || (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0) ||
      (a.work_id < b.work_id ? -1 : a.work_id > b.work_id ? 1 : 0);
  }
  function byRecency(a, b) {
    return (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0) || (a.work_id < b.work_id ? -1 : a.work_id > b.work_id ? 1 : 0);
  }
  // Explicit role precedence for source pointers (never alphabetical): PRIMARY before NAVIGATION.
  const SOURCE_ROLE_ORDER = Object.freeze({ PRIMARY: 0, NAVIGATION: 1 });
  function bySourcePrecedence(a, b) {
    const ra = SOURCE_ROLE_ORDER[a.role], rb = SOURCE_ROLE_ORDER[b.role];
    return ((ra == null ? 9 : ra) - (rb == null ? 9 : rb)) || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0) ||
      (a.source_id < b.source_id ? -1 : a.source_id > b.source_id ? 1 : 0);
  }
  // The locator is never clipped (a clipped locator would stop working).
  function sourcePointer(s) {
    const truncated_fields = [];
    const text = boundFields(s, [['title', CAPS.title], ['note', CAPS.note]], truncated_fields);
    return { source_id: s.source_id, project_id: s.project_id, surface: s.surface, role: s.role, title: text.title, locator: s.locator, revision: s.revision, note: text.note, truncated_fields };
  }
  const REQUIRED_STORE_METHODS = Object.freeze(['listItems', 'listProjects', 'listSources', 'listItemSources', 'listRelations', 'getItem', 'searchItems']);
  function unavailable(reason) {
    const e = new Error(reason); e.code = 'WORKING_MEMORY_UNAVAILABLE'; return e;
  }

  function nextActionView(i) {
    const title = boundText(i.title, CAPS.title), next = boundText(i.next_action, CAPS.next_action);
    return { work_id: i.work_id, project_id: i.project_id, status: i.status, priority: i.priority, title: title.text, next_action: next.text,
      truncated_fields: [title.truncated && 'title', next.truncated && 'next_action'].filter(Boolean) };
  }

  const SOURCE_POINTERS_PER_PROJECT = 3, SOURCE_POINTERS_TOTAL = 15;

  // options.store may be null/undefined: the Working Plane tools then report WORKING_MEMORY_UNAVAILABLE
  // while research_route keeps working (WORKING PLANE FAILURE != RESEARCH PLANE FAILURE).
  function create(options) {
    options = options || {};
    const store = options.store || null;
    const router = options.router || (root && root.ResearchRouter) || null;
    const loadResearchIndex = typeof options.loadResearchIndex === 'function' ? options.loadResearchIndex : null;

    function requireStore() {
      if (!store) throw unavailable('Working Memory is not initialised');
      const missing = REQUIRED_STORE_METHODS.filter(m => typeof store[m] !== 'function');
      if (missing.length) throw unavailable('Working Memory script is stale or incomplete (missing ' + missing.join(', ') + '); reload the app');
      return store;
    }
    function resolveProject(ref, projects) {
      if (ref == null || ref === '') return null;
      const key = String(ref).trim();
      const all = projects || requireStore().listProjects();
      const hit = all.find(p => p.project_id === key) || all.find(p => p.code.toLowerCase() === key.toLowerCase());
      if (!hit) { const e = new Error('Unknown project: ' + key); e.code = 'NOT_FOUND'; throw e; }
      return hit;
    }
    function itemsFor(project, statuses) {
      let items = [];
      for (const status of statuses) items = items.concat(store.listItems({ status, project_id: project ? project.project_id : undefined }));
      return items;
    }
    function bucket(project, statuses, limit, order) {
      const items = itemsFor(project, statuses).sort(order || byPriority);
      return { items: items.slice(0, limit).map(compact), total: items.length, truncated: items.length > limit };
    }

    function orientation(args) {
      args = args || {};
      requireStore();
      const limit = cap(args.limit, BUCKET_LIMIT, BUCKET_MAX);
      const allProjects = store.listProjects();
      const project = resolveProject(args.project, allProjects);
      const projects = project ? [project] : allProjects;
      const current = bucket(project, ['CURRENT'], limit), inProgress = bucket(project, ['IN_PROGRESS'], limit),
        open = bucket(project, ['OPEN'], limit), blocked = bucket(project, ['BLOCKED'], limit),
        unknown = bucket(project, ['UNKNOWN'], limit),
        completed = bucket(project, ['COMPLETED'], limit, byRecency);   // recent = updated_at DESC, never priority-first
      const nextAll = itemsFor(project, UNRESOLVED).filter(i => i.next_action && String(i.next_action).trim()).sort(byPriority);
      const withNext = { total: nextAll.length, truncated: nextAll.length > limit,
        items: nextAll.slice(0, limit).map(nextActionView) };

      let pointerTotal = 0;
      const pointerItems = [], omitted = [];
      for (const p of projects) {
        const eligible = store.listSources(p.project_id).filter(x => Object.prototype.hasOwnProperty.call(SOURCE_ROLE_ORDER, x.role)).sort(bySourcePrecedence);
        pointerTotal += eligible.length;
        const room = SOURCE_POINTERS_TOTAL - pointerItems.length;
        const take = eligible.slice(0, Math.min(SOURCE_POINTERS_PER_PROJECT, Math.max(0, room)));
        for (const src of take) pointerItems.push(sourcePointer(src));
        if (eligible.length && !take.length) omitted.push(p.project_id);
      }
      return {
        plane: 'WORKING', mode: DEFAULT_MODE, notice: WORKING_NOTICE, read_only: true,
        unresolved_statuses: UNRESOLVED.slice(), archived_included: false,
        projects: projects.map(projectView),
        current: current.items, in_progress: inProgress.items, open: open.items, blocked: blocked.items, unknown: unknown.items,
        next_actions: withNext.items, recent_completed: completed.items,
        totals: { current: current.total, in_progress: inProgress.total, open: open.total, blocked: blocked.total, unknown: unknown.total, next_actions: withNext.total, recent_completed: completed.total },
        truncated: { current: current.truncated, in_progress: inProgress.truncated, open: open.truncated, blocked: blocked.truncated, unknown: unknown.truncated, next_actions: withNext.truncated, recent_completed: completed.truncated },
        source_pointers: { items: pointerItems, total: pointerTotal, truncated: pointerItems.length < pointerTotal,
          per_project_cap: SOURCE_POINTERS_PER_PROJECT, total_cap: SOURCE_POINTERS_TOTAL, omitted_project_ids: omitted,
          order: 'PRIMARY before NAVIGATION, then title' },
        research: { available: true, loaded: false, entrypoint: RESEARCH_ENTRYPOINT },
      };
    }

    function list(args) {
      args = args || {};
      requireStore();
      const project = resolveProject(args.project || args.project_id);
      const limit = cap(args.limit, LIST_DEFAULT, LIST_MAX);
      const filters = { includeArchived: !!args.includeArchived };
      for (const k of ['status', 'type', 'priority', 'thread']) if (args[k] != null && args[k] !== '') filters[k] = args[k];
      if (project) filters.project_id = project.project_id;
      const all = store.listItems(filters);
      return { plane: 'WORKING', notice: WORKING_NOTICE, items: all.slice(0, limit).map(compact), total: all.length, truncated: all.length > limit, archived_included: filters.includeArchived };
    }
    function get(args) {
      requireStore();
      const item = store.getItem(args && args.work_id);
      if (!item) return { plane: 'WORKING', found: false, work_id: args && args.work_id };
      const body = boundText(item.body_md, CAPS.body_md), tags = boundText(item.tags_json, CAPS.tags_json);
      const view = compact(item);
      view.body_md = body.text; view.tags_json = tags.text;
      if (body.truncated) { view.truncated_fields.push('body_md'); view.body_md_total_chars = item.body_md.length; }
      if (tags.truncated) view.truncated_fields.push('tags_json');
      return { plane: 'WORKING', notice: WORKING_NOTICE, found: true, item: view,
        sources: store.listItemSources(item.work_id).map(src => Object.assign(sourcePointer(src), { is_primary: !!src.is_primary })),
        relations: store.listRelations(item.work_id).map(r => ({ relation_id: r.relation_id, from_work_id: r.from_work_id, to_work_id: r.to_work_id, relation_type: r.relation_type })) };
    }
    function search(args) {
      args = args || {};
      requireStore();
      const project = resolveProject(args.project || args.project_id);
      const limit = cap(args.limit, LIST_DEFAULT, LIST_MAX);
      // Project scope is applied inside the store search BEFORE ranking and LIMIT; ask for limit+1 to detect truncation.
      const hits = store.searchItems(args.query, limit + 1, { includeArchived: !!args.includeArchived, project_id: project ? project.project_id : null });
      return { plane: 'WORKING', notice: WORKING_NOTICE, order: 'WORK_ID > exact title > title contains > tag > summary > body',
        items: hits.slice(0, limit).map(compact), returned: Math.min(hits.length, limit), truncated: hits.length > limit };
    }
    function related(args) {
      requireStore();
      const item = store.getItem(args && args.work_id);
      if (!item) return { plane: 'WORKING', found: false, work_id: args && args.work_id };
      return { plane: 'WORKING', found: true, work_id: item.work_id, inferred_edges: false,
        relations: store.listRelations(item.work_id).map(r => ({ relation_id: r.relation_id, from_work_id: r.from_work_id, to_work_id: r.to_work_id, relation_type: r.relation_type })) };
    }
    function projectSources(args) {
      requireStore();
      const project = resolveProject(args && (args.project || args.project_id));
      if (!project) { const e = new Error('project is required'); e.code = 'VALIDATION'; throw e; }
      return { plane: 'WORKING', project_id: project.project_id, code: project.code, fetched: false,
        sources: store.listSources(project.project_id).sort(bySourcePrecedence).map(sourcePointer) };
    }
    async function researchRoute(args) {
      if (!router) return { plane: 'RESEARCH', index_loaded: false, parse_status: 'ROUTER_UNAVAILABLE', entrypoint: RESEARCH_ENTRYPOINT, note: 'Research router unavailable; open the entrypoint directly.' };
      return router.routeWithLoader(loadResearchIndex, args || {});
    }

    const HANDLERS = { wm_orientation: orientation,
      wm_list_projects: () => { requireStore(); return { plane: 'WORKING', projects: store.listProjects().map(projectView) }; },
      wm_list: list, wm_get: get, wm_search: search, wm_related: related, wm_project_sources: projectSources, research_route: researchRoute };

    // Returns a JSON-serialisable object; never throws (errors become { ok:false }).
    async function execute(name, args) {
      const fn = Object.prototype.hasOwnProperty.call(HANDLERS, name) ? HANDLERS[name] : null;
      if (!fn) return { ok: false, error: 'Unknown read tool: ' + name, code: 'UNKNOWN_TOOL' };
      try { return await fn(args || {}); }
      catch (error) {
        const code = error && error.code || 'ERROR';
        return { ok: false, plane: name === 'research_route' ? 'RESEARCH' : 'WORKING', error: String(error && error.message || error), code };
      }
    }
    return Object.freeze({ execute, orientation, TOOL_NAMES });
  }

  return Object.freeze({ DEFAULT_MODE, RESEARCH_ENTRYPOINT, TOOLS_SPEC, TOOL_NAMES, GUIDANCE, routeIntent, create });
});
