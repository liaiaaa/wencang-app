import { supabase } from "@/db/supabase";
import type {
  Pattern,
  Artisan,
  ExperienceProject,
  Booking,
  Product,
  Order,
  AiPattern,
  PlatformStats,
  PatternCategory,
  ContentStatus,
} from "@/types/types";
import { backfillArtisanLinks, keepLiveArtisanLinks } from "@/lib/productLink";

const safeArray = <T>(data: T[] | null): T[] => (Array.isArray(data) ? data : []);

// ============ 平台统计（首页实时统计条） ============
export async function fetchPlatformStats(): Promise<PlatformStats> {
  const [p, a, e] = await Promise.all([
    supabase.from("patterns").select("id", { count: "exact", head: true }),
    supabase.from("artisans").select("id", { count: "exact", head: true }),
    supabase.from("experience_projects").select("id", { count: "exact", head: true }),
  ]);
  return {
    patternCount: p.count ?? 0,
    artisanCount: a.count ?? 0,
    projectCount: e.count ?? 0,
  };
}

// ============ 纹样 ============
export async function fetchPatterns(params?: {
  category?: PatternCategory | "all";
  keyword?: string;
}): Promise<Pattern[]> {
  let query = supabase
    .from("patterns")
    .select("*")
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(100);
  if (params?.category && params.category !== "all") {
    query = query.eq("category", params.category);
  }
  if (params?.keyword && params.keyword.trim()) {
    const kw = params.keyword.trim();
    query = query.or(`name.ilike.%${kw}%,technique.ilike.%${kw}%,region.ilike.%${kw}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return safeArray<Pattern>(data);
}

export async function fetchPatternById(id: string): Promise<Pattern | null> {
  const { data, error } = await supabase.from("patterns").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchFeaturedPatterns(limit = 5): Promise<Pattern[]> {
  const { data, error } = await supabase
    .from("patterns")
    .select("*")
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return safeArray<Pattern>(data);
}

// ============ 守艺人 ============
export async function fetchArtisans(): Promise<Artisan[]> {
  const { data, error } = await supabase
    .from("artisans")
    .select("*")
    .neq("status", "archived")
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw error;
  return safeArray<Artisan>(data);
}

export async function fetchArtisanById(id: string): Promise<Artisan | null> {
  const { data, error } = await supabase.from("artisans").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

// ============ 体验项目 ============
export async function fetchExperienceProjects(): Promise<ExperienceProject[]> {
  const { data, error } = await supabase.from("experience_projects").select("*").order("created_at", { ascending: true }).limit(100);
  if (error) throw error;
  return safeArray<ExperienceProject>(data);
}

// ============ 预约 ============
export async function createBooking(payload: {
  artisan_id: string | null;
  artisan_name: string;
  project_id: string | null;
  project_name: string;
  book_date: string;
  time_slot: string;
  contact_name: string;
  contact_phone: string;
}): Promise<void> {
  const { error } = await supabase.from("bookings").insert(payload);
  if (error) throw error;
}

export async function fetchMyBookings(): Promise<Booking[]> {
  const { data, error } = await supabase.from("bookings").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return safeArray<Booking>(data);
}

export async function updateBookingStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
  if (error) throw error;
}

// ============ 商品 ============
export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return withLiveArtisanLinks(safeArray<Product>(data));
}

export async function fetchProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [product] = await withLiveArtisanLinks([data]);
  return product ?? null;
}

/**
 * 前台商品的关联校验：artisan_id 必须指向一位在架守艺人，否则清空。
 * 清空后前台自动回落为不可点击的纯文本，不会出现点开 404 的死链；
 * 守艺人列表读取失败时同样清空——宁可不给链接，也不给坏链接。
 */
async function withLiveArtisanLinks(rows: Product[]): Promise<Product[]> {
  if (!rows.some((r) => r.artisan_id)) return rows;
  const artisans = await fetchArtisans().catch(() => [] as Artisan[]);
  return keepLiveArtisanLinks(rows, new Set(artisans.map((a) => a.id)));
}

// ============ 订单 ============
export async function createOrder(payload: {
  product_id: string | null;
  product_name: string;
  price: number;
  contact_name: string;
  contact_phone: string;
  address: string;
}): Promise<void> {
  const { error } = await supabase.from("orders").insert(payload);
  if (error) throw error;
}

export async function fetchMyOrders(): Promise<Order[]> {
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return safeArray<Order>(data);
}

// ============ AI 纹样 ============
export async function saveAiPattern(payload: {
  theme: string;
  category: PatternCategory;
  image_url: string;
  name: string;
  meaning: string;
}): Promise<void> {
  const { error } = await supabase.from("ai_patterns").insert(payload);
  if (error) throw error;
}

export async function fetchMyAiPatterns(): Promise<AiPattern[]> {
  const { data, error } = await supabase.from("ai_patterns").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return safeArray<AiPattern>(data);
}

export async function deleteAiPattern(id: string): Promise<void> {
  const { error } = await supabase.from("ai_patterns").delete().eq("id", id);
  if (error) throw error;
}

// 上传 AI 生成的图片到 Storage，返回公开 URL
export async function uploadAiPatternImage(blob: Blob, userId: string): Promise<string> {
  const safeName = `${Date.now()}.png`;
  const { data, error } = await supabase.storage
    .from("ai-patterns")
    .upload(`${userId}/${safeName}`, blob, { contentType: "image/png" });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from("ai-patterns").getPublicUrl(data.path);
  return urlData.publicUrl;
}

// 调用 Edge Function 生成纹样图片
export async function generatePatternImage(prompt: string, size = "1024x1024"): Promise<string> {
  const { data, error } = await supabase.functions.invoke("image-generations", {
    body: { prompt, size },
    method: "POST",
  });
  if (error) {
    const msg = await error?.context?.text?.();
    throw new Error(msg || error.message || "生成失败");
  }
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("生成失败，未返回图片");
  return b64;
}

/* ============================================================
 * 管理后台：内容维护（纹样 / 守艺人 / 商品）
 *
 * 所有写操作统一走本层，页面组件不得直接操作 localStorage。
 * 权限由数据层（mock 的 RLS 模拟 / 云端 RLS 策略）负责，
 * 普通用户调用将得到 403 错误。
 * ============================================================ */

/** 把数据层返回的错误转成带状态码的 Error，便于页面区分 403 */
function throwIfError(error: { message?: string; code?: string } | null): void {
  if (!error) return;
  const err = new Error(error.message || "操作失败") as Error & { code?: string };
  err.code = error.code;
  throw err;
}

export type PatternInput = Omit<Pattern, "id" | "created_at" | "status">;
export type ArtisanInput = Omit<Artisan, "id" | "created_at" | "status">;
export type ProductInput = Omit<Product, "id" | "created_at" | "status">;

/* ---------- 纹样 ---------- */

/** 管理后台列表：包含已归档记录（不加 status 过滤） */
export async function fetchAllPatternsAdmin(): Promise<Pattern[]> {
  const { data, error } = await supabase
    .from("patterns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  throwIfError(error);
  return safeArray<Pattern>(data);
}

export async function createPattern(input: PatternInput): Promise<Pattern> {
  const { data, error } = await supabase
    .from("patterns")
    .insert({ ...input, status: "published" satisfies ContentStatus })
    .select()
    .single();
  throwIfError(error);
  return data as Pattern;
}

export async function updatePattern(id: string, patch: Partial<PatternInput>): Promise<void> {
  const { error } = await supabase.from("patterns").update(patch).eq("id", id);
  throwIfError(error);
}

/** 归档（软删除）：列表与图库不再展示 */
export async function archivePattern(id: string): Promise<void> {
  const { error } = await supabase.from("patterns").update({ status: "archived" }).eq("id", id);
  throwIfError(error);
}

export async function restorePattern(id: string): Promise<void> {
  const { error } = await supabase.from("patterns").update({ status: "published" }).eq("id", id);
  throwIfError(error);
}

/* ---------- 守艺人 ---------- */

export async function fetchAllArtisansAdmin(): Promise<Artisan[]> {
  const { data, error } = await supabase
    .from("artisans")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(500);
  throwIfError(error);
  return safeArray<Artisan>(data);
}

export async function createArtisan(input: ArtisanInput): Promise<Artisan> {
  const { data, error } = await supabase
    .from("artisans")
    .insert({ ...input, status: "published" satisfies ContentStatus })
    .select()
    .single();
  throwIfError(error);
  return data as Artisan;
}

export async function updateArtisan(id: string, patch: Partial<ArtisanInput>): Promise<void> {
  const { error } = await supabase.from("artisans").update(patch).eq("id", id);
  throwIfError(error);
}

export async function archiveArtisan(id: string): Promise<void> {
  const { error } = await supabase.from("artisans").update({ status: "archived" }).eq("id", id);
  throwIfError(error);
}

export async function restoreArtisan(id: string): Promise<void> {
  const { error } = await supabase.from("artisans").update({ status: "published" }).eq("id", id);
  throwIfError(error);
}

/* ---------- 商品 ---------- */

export async function fetchAllProductsAdmin(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  throwIfError(error);
  const rows = safeArray<Product>(data);
  // 老数据只有 artisan_name 没有 artisan_id：按名字反查补齐，后台下拉才能正确回显。
  // 只补副本、不写回数据层，管理员保存时才落库，避免"读一次就改了数据"。
  if (rows.some((r) => !r.artisan_id && r.artisan_name)) {
    const artisans = await fetchAllArtisansAdmin().catch(() => [] as Artisan[]);
    const patched = backfillArtisanLinks(rows.map((r) => ({ ...r })), artisans);
    patched.forEach((row, i) => {
      rows[i] = row;
    });
  }
  return rows;
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const { data, error } = await supabase
    .from("products")
    .insert({ ...input, status: "published" satisfies ContentStatus })
    .select()
    .single();
  throwIfError(error);
  return data as Product;
}

export async function updateProduct(id: string, patch: Partial<ProductInput>): Promise<void> {
  const { error } = await supabase.from("products").update(patch).eq("id", id);
  throwIfError(error);
}

export async function archiveProduct(id: string): Promise<void> {
  const { error } = await supabase.from("products").update({ status: "archived" }).eq("id", id);
  throwIfError(error);
}

export async function restoreProduct(id: string): Promise<void> {
  const { error } = await supabase.from("products").update({ status: "published" }).eq("id", id);
  throwIfError(error);
}

/* ---------- 图片上传（管理后台） ---------- */

/**
 * 上传内容图片（纹样 / 守艺人 / 商品），返回可持久化的 URL。
 * 演示模式下为 data URL，云端模式下为 Storage 公开地址。
 */
export async function uploadContentImage(file: Blob, folder = "admin"): Promise<string> {
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const { data, error } = await supabase.storage
    .from("ai-patterns")
    .upload(`${folder}/${safeName}`, file, { contentType: "image/png" });
  throwIfError(error);
  if (!data) throw new Error("图片上传失败");
  const { data: urlData } = supabase.storage.from("ai-patterns").getPublicUrl(data.path);
  return urlData.publicUrl;
}

/* ---------- 运营看板 ---------- */

export interface AdminOverview {
  patternCount: number;
  artisanCount: number;
  productCount: number;
  userCount: number;
  todayBookings: number;
  pendingBookings: number;
  archivedCount: number;
}

const isToday = (iso: string): boolean => {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
};

/** 看板概况：全部数字均实时从数据层聚合，与各列表同源 */
export async function fetchAdminOverview(): Promise<AdminOverview> {
  const [patterns, artisans, products, bookings, users] = await Promise.all([
    fetchAllPatternsAdmin(),
    fetchAllArtisansAdmin(),
    fetchAllProductsAdmin(),
    supabase.from("bookings").select("*").limit(1000),
    supabase.from("profiles").select("id").limit(1000),
  ]);

  const allBookings = safeArray<Booking>(bookings.data);
  const livePatterns = patterns.filter((p) => p.status !== "archived");
  const liveArtisans = artisans.filter((a) => a.status !== "archived");
  const liveProducts = products.filter((p) => p.status !== "archived");

  return {
    patternCount: livePatterns.length,
    artisanCount: liveArtisans.length,
    productCount: liveProducts.length,
    userCount: safeArray(users.data).length,
    todayBookings: allBookings.filter((b) => isToday(b.created_at)).length,
    pendingBookings: allBookings.filter((b) => b.status === "待确认").length,
    archivedCount:
      patterns.length - livePatterns.length +
      (artisans.length - liveArtisans.length) +
      (products.length - liveProducts.length),
  };
}