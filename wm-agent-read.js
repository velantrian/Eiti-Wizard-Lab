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
  const BUCKET_LIMIT = 5, BUCKET_MAX = 10, LIST_DEFAULT = 20, LIST_MAX = 50, SUB_DEFAULT = 10, PROJECT_LIMIT = 10, PROJECT_MAX = 50;
  const WORKING_NOTICE = 'WORKING plane (Wm wm_*, NON_CANON). Operational state only; not research evidence, not Canon. ' +
    'MODEL_PROPOSAL/MODEL_SUMMARY items are not user decisions.';

  const PROJECT_PROPS = { project: { type: 'string', description: 'project_id or code' }, project_id: { type: 'string', description: 'alias of project (project_id or code); if both are given they must name the same project. A supplied blank value is rejected (omit the argument for all projects)' } };
  const LIMIT_NOTE = 'integer >= 1; above the max it is clamped and reported in limit_clamped; invalid values are rejected';
  const TOOLS_SPEC = Object.freeze([
    { name: 'wm_orientation', description: 'WORKING MEMORY (read-only): bounded startup/resume view — current, in_progress, open, blocked, unknown, next actions, recent completed, projects {items,total,truncated}, source pointers (PRIMARY + NAVIGATION roles only; use wm_project_sources for every registered source). Call first when resuming work in a fresh session. Scope with project / project_id (never silently unscoped). Does not load research.',
      parameters: { type: 'object', properties: Object.assign({}, PROJECT_PROPS, { limit: { type: 'number', description: 'items per bucket (default 5, max 10; ' + LIMIT_NOTE + ')' }, project_limit: { type: 'number', description: 'projects listed (default 10, max 50)' } }) } },
    { name: 'wm_list_projects', description: 'WORKING MEMORY (read-only): list registered Working Memory projects (bounded: items/total/truncated).', parameters: { type: 'object', properties: { limit: { type: 'number', description: 'default 20, max 50' } } } },
    { name: 'wm_list', description: 'WORKING MEMORY (read-only): list work items. Filters: project/project_id, status, type, priority, thread, includeArchived (boolean), limit. Archived excluded by default.',
      parameters: { type: 'object', properties: Object.assign({}, PROJECT_PROPS, { status: { type: 'string' }, type: { type: 'string' }, priority: { type: 'string' }, thread: { type: 'string' }, includeArchived: { type: 'boolean' }, limit: { type: 'number' } }) } },
    { name: 'wm_get', description: 'WORKING MEMORY (read-only): one work item by work_id with linked sources (PRIMARY role first) and explicit relations only; sources/relations are bounded as {items,total,truncated}.', parameters: { type: 'object', properties: { work_id: { type: 'string' }, sources_limit: { type: 'number' }, relations_limit: { type: 'number' } }, required: ['work_id'] } },
    { name: 'wm_search', description: 'WORKING MEMORY (read-only): deterministic search (exact WORK_ID > exact title > title contains > tag > summary > body). No embeddings. query is required and must be non-blank.', parameters: { type: 'object', properties: Object.assign({}, PROJECT_PROPS, { query: { type: 'string' }, includeArchived: { type: 'boolean' }, limit: { type: 'number' } }), required: ['query'] } },
    { name: 'wm_related', description: 'WORKING MEMORY (read-only): explicit wm_relations of a work item only; no inferred edges (bounded: items/total/truncated).', parameters: { type: 'object', properties: { work_id: { type: 'string' }, limit: { type: 'number' } }, required: ['work_id'] } },
    { name: 'wm_project_sources', description: 'WORKING MEMORY (read-only): where to look for a project\'s detailed source (surface, role, locator; PRIMARY role first; bounded: items/total/truncated). Does not fetch the source.', parameters: { type: 'object', properties: Object.assign({}, PROJECT_PROPS, { limit: { type: 'number' } }) } },
    { name: 'research_route', description: 'RESEARCH PLANE pointer (read-only; independent of Working Memory): route into docs/research/EXPERIMENT_EVIDENCE_INDEX.md. No args = overview; card = research CARD number (an integer, not a file line); query = case-insensitive substring terms over title/name/question/status/verdict/open finding/primary evidence (e.g. NOT_RUN, BLOCKED, TCE). Give card OR query, not both. Returns verbatim index fields incl. caveats (CONSISTENCY, NOTES, ...); no verdict is derived. A query shows up to 3 cards in full; every matching card number is in matched_card_numbers and the unshown ones in omitted_card_numbers (fetch with card). Research is NOT working state and never a user decision.', parameters: { type: 'object', properties: { query: { type: 'string' }, card: { type: 'number', description: 'research card number' } } } },
  ].map(t => Object.freeze(t)));
  const TOOL_NAMES = Object.freeze(TOOLS_SPEC.map(t => t.name));
  // Explicit allowed-argument set per tool = its declared parameters (+ the one intentional alias `line` of research_route).
  // Any other argument name is a VALIDATION error: a typo such as projectId / include_archived / limt must never be silently ignored.
  const ALLOWED_ARGS = Object.freeze(Object.fromEntries(TOOLS_SPEC.map(t => [t.name,
    Object.freeze(new Set(Object.keys(t.parameters.properties).concat(t.name === 'research_route' ? ['line'] : [])))])));
  const planeOf = name => (name === 'research_route' ? 'RESEARCH' : 'WORKING');
  const isPlainObject = v => Object.prototype.toString.call(v) === '[object Object]';
  const describe = v => (v === null ? 'null' : Array.isArray(v) ? 'an array' : typeof v === 'object' ? 'a non-plain object' : 'a ' + typeof v + ' (' + JSON.stringify(v) + ')');
  // PURE structural preflight shared by bridge.execute and the in-app dispatcher: it runs before any loader, fetch, SQLite init or tool code.
  // Runtime argument-object contract: `undefined` (genuinely omitted) means {}; null / number / boolean / string / array / non-plain object
  // are VALIDATION; a plain object continues with unknown-key and tool-specific validation. Returns null when the call may proceed.
  function preflightCall(name, args) {
    if (!Object.prototype.hasOwnProperty.call(ALLOWED_ARGS, name)) return { ok: false, error: 'Unknown read tool: ' + name, code: 'UNKNOWN_TOOL' };
    const plane = planeOf(name);
    if (args !== undefined && !isPlainObject(args)) return { ok: false, plane, code: 'VALIDATION', error: 'arguments must be an object, or omitted entirely (got ' + describe(args) + '). Nothing was executed.' };
    const unknown = Object.keys(args || {}).filter(k => !ALLOWED_ARGS[name].has(k));
    if (unknown.length) return { ok: false, plane, code: 'VALIDATION', error: 'Unknown argument(s) for ' + name + ': ' + unknown.join(', ') + '. Allowed: ' + [...ALLOWED_ARGS[name]].join(', ') + '. Nothing was executed.' };
    return null;
  }

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

  function validation(message) { const e = new Error(message); e.code = 'VALIDATION'; return e; }
  // ONE documented contract for argument validation (JSON-schema compliance of the model is not relied on):
  //  - limits: omitted/null -> default; otherwise MUST be an integer >= 1 (a JS number; strings, NaN, 0, negatives, fractions are rejected);
  //    above the per-tool max it is clamped to the max and reported in the result's `limit_clamped`.
  //  - booleans: only real true/false (the string "false" is rejected, never coerced).
  //  - strings: must be strings; required ones must be non-blank; optional blank strings count as absent.
  function readLimit(args, key, def, max, ctx) {
    const v = args[key];
    if (v === undefined || v === null) return def;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) throw validation(key + ' must be an integer >= 1 (got ' + JSON.stringify(v) + '); omit it for the default ' + def + ' (max ' + max + ')');
    if (v > max) { ctx.clamped[key] = max; return max; }
    return v;
  }
  function readBool(args, key) {
    const v = args[key];
    if (v === undefined || v === null) return false;
    if (typeof v !== 'boolean') throw validation(key + ' must be boolean true or false (got ' + JSON.stringify(v) + ')');
    return v;
  }
  function readString(args, key, required) {
    const v = args[key];
    if (v === undefined || v === null || v === '') { if (required) throw validation(key + ' is required'); return undefined; }
    if (typeof v !== 'string') throw validation(key + ' must be a string (got ' + JSON.stringify(v) + ')');
    if (!v.trim()) { if (required) throw validation(key + ' must not be blank'); return undefined; }
    return v;
  }

  // Agent-facing text caps (Unicode CODE POINTS, never splitting a surrogate pair). The database is never changed;
  // clipped fields are listed in truncated_fields.
  const CAPS = Object.freeze({ title: 200, name: 200, summary: 500, current_question: 300, status_note: 300, next_action: 300,
    note: 300, tags_json: 500, body_md: 4000 });
  function boundText(value, max) {
    if (typeof value !== 'string') return { text: value, truncated: false };
    if (value.length <= max) return { text: value, truncated: false };   // UTF-16 length <= max implies <= max code points
    let i = 0, count = 0;
    while (i < value.length && count < max) { i += value.codePointAt(i) > 0xFFFF ? 2 : 1; count++; }
    return i >= value.length ? { text: value, truncated: false } : { text: value.slice(0, i) + '…', truncated: true };
  }
  function countCodePoints(text) { let n = 0; for (let i = 0; i < text.length; i += text.codePointAt(i) > 0xFFFF ? 2 : 1) n++; return n; }
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
  // Bounded collection envelope: never drops records silently (total + truncated are explicit).
  function bounded(all, limit, view) {
    return { items: all.slice(0, limit).map(view), total: all.length, truncated: all.length > limit };
  }
  const relationView = r => ({ relation_id: r.relation_id, from_work_id: r.from_work_id, to_work_id: r.to_work_id, relation_type: r.relation_type });

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
  // Intentional bounded startup behaviour: orientation lists only these source roles; total/truncated refer to THEM, not to all registered sources.
  const INCLUDED_POINTER_ROLES = Object.freeze(['PRIMARY', 'NAVIGATION']);

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
      const key = String(ref).trim();
      const all = projects || requireStore().listProjects();
      const hit = all.find(p => p.project_id === key) || all.find(p => p.code.toLowerCase() === key.toLowerCase());
      if (!hit) { const e = new Error('Unknown project: ' + key); e.code = 'NOT_FOUND'; throw e; }
      return hit;
    }
    // project / project_id are aliases: both accepted, conflicting values are a VALIDATION error, an unknown
    // project is NOT_FOUND — a scope argument is never silently ignored.
    // A scope key that is PRESENT must carry a non-blank string: `project: ""` / `"   "` / null is VALIDATION, never "all projects".
    // (Omitting both keys is the only way to ask for all projects.)
    function readScope(args, key) {
      if (!Object.prototype.hasOwnProperty.call(args, key) || args[key] === undefined) return undefined;
      const v = args[key];
      if (typeof v !== 'string' || !v.trim()) throw validation(key + ' must be a non-empty, non-whitespace string when supplied (got ' + JSON.stringify(v) + '); omit it to cover all projects');
      return v;
    }
    function resolveScope(args, projects) {
      const byProject = readScope(args, 'project'), byId = readScope(args, 'project_id');
      const a = byProject ? resolveProject(byProject, projects) : null, b = byId ? resolveProject(byId, projects) : null;
      if (a && b && a.project_id !== b.project_id) throw validation('project and project_id refer to different projects (' + a.project_id + ' vs ' + b.project_id + '); give one');
      return a || b;
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

    function orientation(args, ctx) {
      requireStore();
      const limit = readLimit(args, 'limit', BUCKET_LIMIT, BUCKET_MAX, ctx), projectLimit = readLimit(args, 'project_limit', PROJECT_LIMIT, PROJECT_MAX, ctx);
      const allProjects = store.listProjects();
      const project = resolveScope(args, allProjects);
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
        const eligible = store.listSources(p.project_id).filter(x => INCLUDED_POINTER_ROLES.includes(x.role)).sort(bySourcePrecedence);
        pointerTotal += eligible.length;
        const room = SOURCE_POINTERS_TOTAL - pointerItems.length;
        const take = eligible.slice(0, Math.min(SOURCE_POINTERS_PER_PROJECT, Math.max(0, room)));
        for (const src of take) pointerItems.push(sourcePointer(src));
        if (eligible.length && !take.length) omitted.push(p.project_id);
      }
      return {
        plane: 'WORKING', mode: DEFAULT_MODE, notice: WORKING_NOTICE, read_only: true,
        unresolved_statuses: UNRESOLVED.slice(), archived_included: false,
        scope: project ? { project_id: project.project_id, code: project.code } : 'ALL_PROJECTS',
        projects: bounded(projects, projectLimit, projectView),
        current: current.items, in_progress: inProgress.items, open: open.items, blocked: blocked.items, unknown: unknown.items,
        next_actions: withNext.items, recent_completed: completed.items,
        totals: { current: current.total, in_progress: inProgress.total, open: open.total, blocked: blocked.total, unknown: unknown.total, next_actions: withNext.total, recent_completed: completed.total },
        truncated: { current: current.truncated, in_progress: inProgress.truncated, open: open.truncated, blocked: blocked.truncated, unknown: unknown.truncated, next_actions: withNext.truncated, recent_completed: completed.truncated },
        source_pointers: { items: pointerItems, total: pointerTotal, truncated: pointerItems.length < pointerTotal,
          included_roles: INCLUDED_POINTER_ROLES.slice(), full_source_discovery: 'wm_project_sources',
          per_project_cap: SOURCE_POINTERS_PER_PROJECT, total_cap: SOURCE_POINTERS_TOTAL, omitted_project_ids: omitted,
          order: 'PRIMARY before NAVIGATION, then title' },
        research: { available: !!(router && typeof router.route === 'function'), loaded: false, entrypoint: RESEARCH_ENTRYPOINT },   // available = the router script is really loaded
      };
    }

    function list(args, ctx) {
      requireStore();
      const project = resolveScope(args);
      const limit = readLimit(args, 'limit', LIST_DEFAULT, LIST_MAX, ctx);
      const filters = { includeArchived: readBool(args, 'includeArchived') };
      for (const k of ['status', 'type', 'priority', 'thread']) { const v = readString(args, k); if (v !== undefined) filters[k] = v; }
      if (project) filters.project_id = project.project_id;
      const all = store.listItems(filters);
      return { plane: 'WORKING', notice: WORKING_NOTICE, items: all.slice(0, limit).map(compact), total: all.length, truncated: all.length > limit, archived_included: filters.includeArchived };
    }
    function get(args, ctx) {
      requireStore();
      const workId = readString(args, 'work_id', true);
      const sourcesLimit = readLimit(args, 'sources_limit', SUB_DEFAULT, LIST_MAX, ctx), relationsLimit = readLimit(args, 'relations_limit', LIST_DEFAULT, LIST_MAX, ctx);
      const item = store.getItem(workId);
      if (!item) return { plane: 'WORKING', found: false, work_id: workId };
      const body = boundText(item.body_md, CAPS.body_md), tags = boundText(item.tags_json, CAPS.tags_json);
      const view = compact(item);
      view.body_md = body.text; view.tags_json = tags.text;
      if (body.truncated) { view.truncated_fields.push('body_md'); view.body_md_total_chars = countCodePoints(item.body_md); }
      if (tags.truncated) view.truncated_fields.push('tags_json');
      // Source ROLE precedence (PRIMARY before NAVIGATION), not item-link is_primary ordering; is_primary stays as link metadata.
      const sources = store.listItemSources(item.work_id).sort(bySourcePrecedence);
      return { plane: 'WORKING', notice: WORKING_NOTICE, found: true, item: view,
        sources: bounded(sources, sourcesLimit, src => Object.assign(sourcePointer(src), { is_primary: !!src.is_primary })),
        relations: bounded(store.listRelations(item.work_id), relationsLimit, relationView) };
    }
    function search(args, ctx) {
      requireStore();
      const query = readString(args, 'query', true);
      const project = resolveScope(args);
      const limit = readLimit(args, 'limit', LIST_DEFAULT, LIST_MAX, ctx);
      const includeArchived = readBool(args, 'includeArchived');
      // Project scope is applied inside the store search BEFORE ranking and LIMIT; ask for limit+1 to detect truncation.
      const hits = store.searchItems(query, limit + 1, { includeArchived, project_id: project ? project.project_id : null });
      return { plane: 'WORKING', notice: WORKING_NOTICE, order: 'WORK_ID > exact title > title contains > tag > summary > body',
        items: hits.slice(0, limit).map(compact), returned: Math.min(hits.length, limit), truncated: hits.length > limit };
    }
    function related(args, ctx) {
      requireStore();
      const workId = readString(args, 'work_id', true);
      const limit = readLimit(args, 'limit', LIST_DEFAULT, LIST_MAX, ctx);
      const item = store.getItem(workId);
      if (!item) return { plane: 'WORKING', found: false, work_id: workId };
      return Object.assign({ plane: 'WORKING', found: true, work_id: item.work_id, inferred_edges: false },
        bounded(store.listRelations(item.work_id), limit, relationView));
    }
    function projectSources(args, ctx) {
      requireStore();
      const limit = readLimit(args, 'limit', LIST_DEFAULT, LIST_MAX, ctx);
      const project = resolveScope(args);
      if (!project) throw validation('project (or project_id) is required');
      return Object.assign({ plane: 'WORKING', project_id: project.project_id, code: project.code, fetched: false },
        bounded(store.listSources(project.project_id).sort(bySourcePrecedence), limit, sourcePointer));
    }
    async function researchRoute(args) {
      if (!router) return { plane: 'RESEARCH', index_loaded: false, parse_status: 'ROUTER_UNAVAILABLE', entrypoint: RESEARCH_ENTRYPOINT,
        diagnostics: { reasons: ['research router script is not loaded'] }, note: 'Research router unavailable; no research cards can be served from this call.' };
      return router.routeWithLoader(loadResearchIndex, args);
    }

    const HANDLERS = { wm_orientation: orientation,
      wm_list_projects: (args, ctx) => { requireStore(); return Object.assign({ plane: 'WORKING' }, bounded(store.listProjects(), readLimit(args, 'limit', LIST_DEFAULT, LIST_MAX, ctx), projectView)); },
      wm_list: list, wm_get: get, wm_search: search, wm_related: related, wm_project_sources: projectSources, research_route: researchRoute };

    // Returns a JSON-serialisable object; never throws (errors become { ok:false }).
    async function execute(name, args) {
      const fn = Object.prototype.hasOwnProperty.call(HANDLERS, name) ? HANDLERS[name] : null;
      if (!fn) return { ok: false, error: 'Unknown read tool: ' + name, code: 'UNKNOWN_TOOL' };
      const plane = planeOf(name);
      const bad = preflightCall(name, args);   // before any store, loader or network access
      if (bad) return bad;
      if (args === undefined) args = {};
      const ctx = { clamped: {} };
      try {
        const result = await fn(args, ctx);
        if (Object.keys(ctx.clamped).length && result && typeof result === 'object') result.limit_clamped = ctx.clamped;   // explicit, never silent
        return result;
      } catch (error) {
        return { ok: false, plane, error: String(error && error.message || error), code: error && error.code || 'ERROR' };
      }
    }
    return Object.freeze({ execute, orientation, TOOL_NAMES });
  }

  return Object.freeze({ DEFAULT_MODE, RESEARCH_ENTRYPOINT, TOOLS_SPEC, TOOL_NAMES, GUIDANCE, routeIntent, preflightCall, create });
});
