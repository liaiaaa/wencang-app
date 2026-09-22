// ============================================================
// 演示模式（mock）Supabase 客户端
//
// 本地/断网演示时，通过 vite.config.ts 的 alias 把 "@/db/supabase"
// 指向本文件，从而在不改动任何业务代码的前提下替换云端 Supabase。
//
// 实现了业务代码实际用到的 PostgREST 子集：
//   from().select()/insert()/update()/delete()
//   .eq() .or() .ilike() .order() .limit() .maybeSingle() .single()
//   auth.getSession()/onAuthStateChange()/signInWithPassword()/signUp()/signOut()
//   storage.from().upload()/getPublicUrl()
//   functions.invoke()
//
// 数据保存在内存中，并镜像到 localStorage，刷新页面不丢失。
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { backfillArtisanLinks } from "@/lib/productLink";
import { SEED_VERSION } from "./mockData";
import {
  MOCK_ARTISANS,
  MOCK_PATTERNS,
  MOCK_PROJECTS,
  MOCK_PRODUCTS,
  MOCK_BOOKINGS,
  MOCK_ORDERS,
  MOCK_AI_PATTERNS,
  MOCK_USERS,
  MOCK_ADMIN_EMAIL,
} from "./mockData";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Row = Record<string, any>;
type TableName =
  | "patterns"
  | "artisans"
  | "experience_projects"
  | "bookings"
  | "products"
  | "orders"
  | "ai_patterns"
  | "profiles";

const STORAGE_KEY = "wenzang.mock.db.v1";
const SESSION_KEY = "wenzang.mock.session.v1";
/** 单独存种子版本号：与数据体分开，才不会因为删表而忘记版本 */
const SEED_VERSION_KEY = "wenzang.mock.seed.v1";

/** 需要按用户隔离的表（对应云端 RLS 策略） */
const RLS_TABLES = new Set<TableName>(["bookings", "orders", "ai_patterns"]);

/** 内容表：仅管理员可写，且归档后默认不出现在列表中 */
const CONTENT_TABLES = new Set<TableName>(["patterns", "artisans", "products"]);

// ---------- 工具 ----------
const uuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

const nowIso = () => new Date().toISOString();

function seedTables(): Record<TableName, Row[]> {
  return {
    patterns: MOCK_PATTERNS.map((r) => ({ ...r })),
    artisans: MOCK_ARTISANS.map((r) => ({ ...r })),
    experience_projects: MOCK_PROJECTS.map((r) => ({ ...r })),
    bookings: MOCK_BOOKINGS.map((r) => ({ ...r })),
    products: MOCK_PRODUCTS.map((r) => ({ ...r })),
    orders: MOCK_ORDERS.map((r) => ({ ...r })),
    ai_patterns: MOCK_AI_PATTERNS.map((r) => ({ ...r })),
    // 用户档案：用于运营看板的用户数统计（对应云端 profiles 表）
    profiles: MOCK_USERS.map((u) => ({
      id: u.id,
      role: u.role,
      email: u.email,
      created_at: nowIso(),
    })),
  };
}

/**
 * 载入本地数据后的一次性迁移：老版本 localStorage 里的商品只有 artisan_name
 * 文本、没有 artisan_id，这里按名字反查补齐，保证前台跳转链接可用。
 */
function migrateDb(tables: Record<TableName, Row[]>): Record<TableName, Row[]> {
  backfillArtisanLinks(tables.products, tables.artisans);
  return tables;
}

/** 内容表：随种子版本重建（用户账号与预约、订单等用户数据不在其列） */
const CONTENT_SEED_TABLES: TableName[] = ["patterns", "artisans", "products", "experience_projects"];

function reseedContent(target: Record<TableName, Row[]>): void {
  const fresh = seedTables();
  CONTENT_SEED_TABLES.forEach((t) => {
    target[t] = fresh[t];
  });
}

function loadDb(): Record<TableName, Row[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const fresh = seedTables();
      // 只接受已知表，缺表用种子数据补齐
      (Object.keys(fresh) as TableName[]).forEach((t) => {
        if (!Array.isArray(parsed[t])) parsed[t] = fresh[t];
      });
      return migrateDb(parsed as Record<TableName, Row[]>);
    }
  } catch {
    /* 忽略损坏的本地数据，回落到种子 */
  }
  return migrateDb(seedTables());
}

const db: Record<TableName, Row[]> = loadDb();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* 隐私模式等场景下忽略 */
  }
}

function storedSeedVersion(): number {
  try {
    const n = Number(localStorage.getItem(SEED_VERSION_KEY));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * 种子版本落后（含本地从未记过版本的老数据）时，把内容数据升级到当前版本。
 * 老浏览器里存的还是 15 条纹样、3 位守艺人，代码却已经扩到 45/10——
 * 不升级就会出现「首页统计与实际数据对不上」这类假故障。
 * 只重建内容表：用户账号、预约、订单原样保留。
 */
function ensureSeedVersion(): void {
  if (storedSeedVersion() === SEED_VERSION) return;
  reseedContent(db);
  migrateDb(db);
  try {
    localStorage.setItem(SEED_VERSION_KEY, String(SEED_VERSION));
  } catch {
    /* 忽略 */
  }
  persist();
}

ensureSeedVersion();

/** 清空本地演示内容并恢复当前版本种子（供调试用：控制台执行 __wenzangMock.reset()） */
export function resetMockDb() {
  reseedContent(db);
  migrateDb(db);
  persist();
}

/* ================= 查询构造器 ================= */

type Filter = (row: Row) => boolean;

class MockQuery implements PromiseLike<{ data: any; error: any; count?: number | null }> {
  private table: TableName;
  private filters: Filter[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitCount: number | null = null;
  private mode: "select" | "insert" | "update" | "delete" = "select";
  private payload: Row[] = [];
  private patch: Row = {};
  private countMode: "exact" | null = null;
  private headOnly = false;
  private singleMode: "single" | "maybeSingle" | null = null;

  constructor(table: TableName) {
    this.table = table;
  }

  private rows(): Row[] {
    return db[this.table] ?? [];
  }

  /**
   * 模拟云端 RLS：
   *  - bookings / orders / ai_patterns 仅返回当前用户自己的记录（管理员可见全部）
   *  - 未登录不可见受限表
   *
   * 归档软删不在此处过滤：调用方显式使用 .neq("status","archived")，
   * 这样演示模式与云端模式行为完全一致。
   */
  private applyRls(rows: Row[]): Row[] {
    if (!RLS_TABLES.has(this.table)) return rows;
    if (!currentUser) return [];
    if (mockClient.mockRole() === "admin") return rows;
    return rows.filter((r) => r.user_id === currentUser!.id);
  }

  /**
   * 写操作权限校验：
   *  - 内容表（patterns/artisans/products）仅管理员可写
   *  - bookings / orders / ai_patterns 允许本人写入（沿用原 RLS）
   * 返回 null 表示放行，否则返回错误对象。
   */
  private checkWritePermission(): { message: string; code: string } | null {
    if (!CONTENT_TABLES.has(this.table)) return null;
    if (!currentUser) {
      return { message: "未登录，无权执行该操作", code: "401" };
    }
    if (mockClient.mockRole() !== "admin") {
      return { message: "仅管理员可维护内容数据", code: "403" };
    }
    return null;
  }

  private matched(): Row[] {
    let out = this.applyRls(this.rows()).filter((r) => this.filters.every((f) => f(r)));
    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      out = [...out].sort((a, b) => {
        const av = a[column];
        const bv = b[column];
        if (av === bv) return 0;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const cmp = av > bv ? 1 : -1;
        return ascending ? cmp : -cmp;
      });
    }
    if (this.limitCount !== null) out = out.slice(0, this.limitCount);
    return out;
  }

  // --- 终止方法 ---
  select(_columns?: string, opts?: { count?: "exact"; head?: boolean }) {
    if (this.mode === "select") this.mode = "select";
    if (opts?.count) this.countMode = opts.count;
    if (opts?.head) this.headOnly = true;
    return this;
  }

  insert(payload: Row | Row[]) {
    this.mode = "insert";
    this.payload = Array.isArray(payload) ? payload : [payload];
    return this;
  }

  update(patch: Row) {
    this.mode = "update";
    this.patch = patch;
    return this;
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  // --- 过滤 / 排序 ---
  eq(column: string, value: any) {
    this.filters.push((r) => r[column] === value);
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push((r) => r[column] !== value);
    return this;
  }

  ilike(column: string, pattern: string) {
    const re = new RegExp(
      "^" + String(pattern).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$",
      "i",
    );
    this.filters.push((r) => re.test(String(r[column] ?? "")));
    return this;
  }

  /** 支持 "a.ilike.%x%,b.ilike.%y%" 形式的或条件 */
  or(expression: string) {
    const clauses = expression.split(",").map((c) => c.trim()).filter(Boolean);
    const tests = clauses.map((clause) => {
      const first = clause.indexOf(".");
      const second = clause.indexOf(".", first + 1);
      const column = clause.slice(0, first);
      const op = clause.slice(first + 1, second);
      const value = clause.slice(second + 1);
      if (op === "ilike") {
        const re = new RegExp(
          "^" + value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$",
          "i",
        );
        return (r: Row) => re.test(String(r[column] ?? ""));
      }
      return (r: Row) => String(r[column] ?? "") === value;
    });
    this.filters.push((r) => tests.some((t) => t(r)));
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: opts?.ascending !== false };
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  single() {
    this.singleMode = "single";
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybeSingle";
    return this;
  }

  // --- 执行 ---
  private run(): { data: any; error: any; count?: number | null } {
    try {
      // 写操作先做权限校验（内容表仅管理员可写）
      if (this.mode !== "select") {
        const denied = this.checkWritePermission();
        if (denied) return { data: null, error: denied };
      }

      if (this.mode === "insert") {
        const created: Row[] = [];
        for (const item of this.payload) {
          const row: Row = { ...item };
          if (!row.id) row.id = uuid();
          if (!row.created_at) row.created_at = nowIso();
          // 预约 / 订单 / AI 纹样 自动归属当前登录用户
          if (
            (this.table === "bookings" || this.table === "orders" || this.table === "ai_patterns") &&
            !row.user_id
          ) {
            row.user_id = currentUser?.id ?? "anonymous";
          }
          if (this.table === "bookings" && !row.status) row.status = "待确认";
          if (this.table === "orders") {
            if (!row.status) row.status = "待发货";
            if (!row.order_number) {
              row.order_number =
                "WZ" + new Date().toISOString().slice(0, 10).replace(/-/g, "") +
                String(Math.floor(Math.random() * 100000)).padStart(5, "0");
            }
          }
          this.rows().push(row);
          created.push(row);
        }
        persist();
        return { data: created.length === 1 ? created[0] : created, error: null };
      }

      if (this.mode === "update") {
        const targets = this.matched();
        targets.forEach((row) => Object.assign(row, this.patch));
        persist();
        return { data: targets.length === 1 ? targets[0] : targets, error: null };
      }

      if (this.mode === "delete") {
        const targets = this.matched();
        const ids = new Set(targets.map((r) => r.id));
        db[this.table] = this.rows().filter((r) => !ids.has(r.id));
        persist();
        return { data: targets, error: null };
      }

      // select
      const rows = this.matched();
      if (this.headOnly || this.countMode) {
        return { data: this.headOnly ? null : rows, error: null, count: rows.length };
      }
      return { data: rows, error: null };
    } catch (e) {
      return { data: null, error: { message: e instanceof Error ? e.message : "演示数据查询失败" } };
    }
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const result = this.run();

    // 出错时原样返回，不要被下面的 single 归一化覆盖掉错误信息
    // （否则权限错误会被误报成"未找到记录"）
    if (result.error) {
      return Promise.resolve(result).then(onfulfilled, onrejected);
    }

    // single / maybeSingle 语义：把数组归一化为单条记录
    if (this.singleMode) {
      const data = result.data;
      // insert/update 已返回单条对象，无需再取 [0]
      const rows: Row[] | null = Array.isArray(data) ? data : data ? [data as Row] : [];
      if (this.singleMode === "single") {
        if (rows.length === 0) {
          return Promise.resolve({ data: null, error: { message: "未找到记录" } }).then(
            onfulfilled,
            onrejected,
          );
        }
        return Promise.resolve({ data: rows[0], error: null }).then(onfulfilled, onrejected);
      }
      return Promise.resolve({ data: rows.length ? rows[0] : null, error: null }).then(
        onfulfilled,
        onrejected,
      );
    }

    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

/* ================= 鉴权 ================= */

interface MockSession {
  access_token: string;
  token_type: string;
  user: { id: string; email: string };
}

function loadSession(): MockSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as MockSession) : null;
  } catch {
    return null;
  }
}

let currentSession: MockSession | null = loadSession();
let currentUser = currentSession?.user ?? null;

const authListeners = new Set<(event: string, session: MockSession | null) => void>();

function setSession(session: MockSession | null, event: string) {
  currentSession = session;
  currentUser = session?.user ?? null;
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* 忽略 */
  }
  authListeners.forEach((cb) => cb(event, session));
}

function makeSession(user: { id: string; email: string }): MockSession {
  return { access_token: "mock-token-" + user.id, token_type: "bearer", user };
}

/**
 * 演示模式的账号表：种子账号 + 本地注册账号。
 *
 * 注册必须落盘。早先只往 MOCK_USERS 常量里 push，页面一刷新数组就回到种子状态，
 * 表现为"刚注册完，退出就再也登不上"——账号凭空消失，用户只会认为登录坏了。
 * 种子账号始终以代码为准（便于内置账号随版本更新），本地注册账号叠加在后面；
 * 与内容表分开存放，因此"重置演示数据"不会把用户账号一起清掉。
 */
const USERS_KEY = "wenzang.mock.users.v1";

interface MockAccount {
  id: string;
  email: string;
  password: string;
  role: "admin" | "user";
}

function loadAccounts(): MockAccount[] {
  const seeded = () => MOCK_USERS.map((u) => ({ ...u }));
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return seeded();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seeded();
    const builtin = new Set(MOCK_USERS.map((u) => u.email.toLowerCase()));
    const local = parsed.filter(
      (u: MockAccount) => u?.email && !builtin.has(String(u.email).toLowerCase()),
    );
    return [...seeded(), ...local];
  } catch {
    return seeded();
  }
}

let accounts: MockAccount[] = loadAccounts();

function persistAccounts() {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(accounts));
  } catch {
    /* 隐私模式等场景下忽略 */
  }
}

const findAccount = (email: string) =>
  accounts.find((u) => String(u.email).toLowerCase() === String(email).toLowerCase());

/** 认证错误返回真正的 Error 实例（与云端 supabase-js 行为一致），否则调用方 `err instanceof Error` 判不中，只能显示"操作失败" */
function authError(message: string): Error {
  return new Error(message);
}

/** 为账号补一条 profiles 记录（对应云端"注册自动建档"触发器），运营看板的注册用户数依赖它 */
function ensureProfile(id: string, email: string, role: "admin" | "user") {
  if (db.profiles.some((p) => p.id === id)) return;
  db.profiles.push({ id, email, role, created_at: nowIso() });
  persist();
}

const auth = {
  async getSession() {
    return { data: { session: currentSession }, error: null };
  },
  async getUser() {
    return { data: { user: currentUser }, error: null };
  },
  onAuthStateChange(cb: (event: string, session: MockSession | null) => void) {
    authListeners.add(cb);
    return { data: { subscription: { unsubscribe: () => authListeners.delete(cb) } } };
  },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const found = findAccount(email);
    if (!found || found.password !== password) {
      return {
        data: { user: null, session: null },
        error: authError("Invalid login credentials"),
      };
    }
    ensureProfile(found.id, found.email, found.role ?? "user");
    const session = makeSession({ id: found.id, email: found.email });
    setSession(session, "SIGNED_IN");
    return { data: { user: session.user, session }, error: null };
  },
  async signUp({ email, password }: { email: string; password: string }) {
    if (findAccount(email)) {
      return {
        data: { user: null, session: null },
        error: authError("User already registered"),
      };
    }
    const account: MockAccount = { id: uuid(), email, password, role: "user" };
    accounts = [...accounts, account];
    persistAccounts();
    ensureProfile(account.id, account.email, account.role);
    const session = makeSession({ id: account.id, email: account.email });
    setSession(session, "SIGNED_IN");
    return { data: { user: session.user, session }, error: null };
  },
  async signOut() {
    setSession(null, "SIGNED_OUT");
    return { error: null };
  },
};

/* ================= 存储 ================= */

/**
 * 演示模式的「对象存储」。
 *
 * 注意：不能用 URL.createObjectURL —— blob: URL 在页面刷新/跳转后就失效了，
 * 而演示数据是要持久化到 localStorage 的，会导致「我的纹样」里图片变空。
 * 因此这里把文件读成 data URL 持久保存。
 */
const objectUrls = new Map<string, string>();

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(blob);
  });
}

const storage = {
  from(_bucket: string) {
    return {
      async upload(path: string, file: Blob, _opts?: any) {
        try {
          const url = await blobToDataUrl(file);
          objectUrls.set(path, url);
          return { data: { path }, error: null };
        } catch (e) {
          return { data: null, error: { message: e instanceof Error ? e.message : "上传失败" } };
        }
      },
      getPublicUrl(path: string) {
        return { data: { publicUrl: objectUrls.get(path) ?? path } };
      },
      async remove(paths: string[]) {
        paths.forEach((p) => objectUrls.delete(p));
        return { data: null, error: null };
      },
    };
  },
};

/* ================= Edge Function ================= */

const functions = {
  async invoke(_name: string, _options?: any) {
    // 演示模式不联网调用生图服务，交由调用方走文字模式降级
    return {
      data: null,
      error: { message: "演示模式：生图服务暂不可用", context: undefined },
    };
  },
};

/* ================= 导出 ================= */

const mockClient = {
  from(table: string) {
    return new MockQuery(table as TableName);
  },
  auth,
  storage,
  functions,
  /** 演示模式专用：当前登录用户的角色 */
  mockRole: () => {
    const email = currentUser?.email?.toLowerCase();
    if (!email) return null;
    if (email === MOCK_ADMIN_EMAIL) return "admin";
    return findAccount(email)?.role === "admin" ? "admin" : "user";
  },
  /**
   * 演示模式专用：按当前版本重新播种内容数据（纹样 / 守艺人 / 商品 / 体验项目）。
   * 权限与写接口一致——未登录 401、非管理员 403；用户账号与预约、订单不受影响。
   */
  resetDemoContent: (): { error: { message: string; code: string } | null } => {
    if (!currentUser) return { error: { message: "未登录，无权执行该操作", code: "401" } };
    if (mockClient.mockRole() !== "admin") {
      return { error: { message: "仅管理员可维护内容数据", code: "403" } };
    }
    reseedContent(db);
    migrateDb(db);
    persist();
    return { error: null };
  },
};

export const isMockMode = true;

export const supabase = mockClient as unknown as SupabaseClient;

/** 当前演示数据的种子版本号（运营后台展示用，云端模式下不提供） */
export const seedVersion = SEED_VERSION;

// 便于在浏览器控制台调试：__wenzangMock.reset()
if (typeof window !== "undefined") {
  (window as any).__wenzangMock = {
    reset: resetMockDb,
    db,
    role: mockClient.mockRole,
    seedVersion: SEED_VERSION,
  };
}
